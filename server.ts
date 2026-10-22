import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import {
  ASSETS_DIR,
  db,
  getArticleById,
  getEditionById,
  getJobById,
  getSettings,
  getUsers,
  initDatabase,
  listArticles,
  listEditions,
  listRecentJobs,
  logAuditEvent,
  PDF_DIR,
  updateSettings,
} from './src/server/db.ts';
import {
  containsTeluguUnicode,
  DEFAULT_CATEGORIES,
  runPrintPreflightValidation,
  validateImageBinary,
} from './src/utils/editorialLogic.ts';
import {
  enqueueEditionGenerationJob,
  enqueueEditorialProcessingJob,
} from './src/server/workers.ts';
import { invalidateArticleCache } from './src/server/aiAdapters.ts';
import { createEditorialPngBuffer } from './src/utils/pngGenerator.ts';
import {
  buildMasterPlanPrintHtml,
  exportMasterPlanToPdfBuffer,
} from './src/engine/pdf-exporter.ts';
import { runAgenticPdfGatekeeperLoop } from './src/engine/agentic-pdf-loop.ts';

initDatabase();

const app = express();
app.use(express.json({ limit: '15mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

// Simple rate limiter middleware for API endpoints
const rateWindowMap = new Map<string, { count: number; resetAt: number }>();
app.use('/api', (req, res, next) => {
  const key = req.ip || 'local';
  const now = Date.now();
  const entry = rateWindowMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateWindowMap.set(key, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  entry.count++;
  if (entry.count > 240) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait before retrying.' });
  }
  return next();
});

// Helper to resolve current user from header or fallback to default reporter/editor
function resolveActorUser(req: express.Request) {
  const userIdHeader = req.headers['x-user-id'];
  const userId = typeof userIdHeader === 'string' && userIdHeader ? userIdHeader : 'rep-vijayawada';
  const users = getUsers();
  return users.find((u) => u.id === userId) || users[0];
}

// Serve stored binary image assets with magic-byte MIME detection
app.get('/api/assets/file/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename);
  const fullPath = path.join(ASSETS_DIR, safeName);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'Image asset file not found.' });
  }
  const bytes = fs.readFileSync(fullPath);
  let mime = 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    mime = 'image/jpeg';
  } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) {
    mime = 'image/webp';
  }
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.send(bytes);
});

// 1. POST /api/auth/login & GET /api/users
app.post('/api/auth/login', (req, res) => {
  const { userId, username } = req.body || {};
  const users = getUsers();
  const matched =
    users.find((u) => u.id === userId || u.username === username) || users[0];
  logAuditEvent(matched.id, 'user', matched.id, 'user_login', { role: matched.role });
  return res.json({
    token: `session-${matched.id}-${Date.now()}`,
    user: matched,
  });
});

app.get('/api/users', (_req, res) => {
  return res.json({ users: getUsers() });
});

// 2. GET /api/overview
app.get('/api/overview', (_req, res) => {
  const articles = listArticles();
  const editions = listEditions();
  const jobs = listRecentJobs(15);
  const settings = getSettings();
  const activeEdition = editions[0] || null;
  const geminiConfigured = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
  );

  return res.json({
    metrics: {
      totalSubmissions: articles.length,
      articlesProcessed: articles.filter((a) => a.status === 'processed' || a.status === 'approved' || a.status === 'published').length,
      articlesAwaitingProcessing: articles.filter((a) => a.status === 'submitted' || a.status === 'draft' || a.status === 'processing').length,
      articlesFlaggedOrRejected: articles.filter((a) => a.status === 'flagged_hold' || a.status === 'failed').length,
      activeEditionNumber: activeEdition ? activeEdition.editionNumber : null,
      activeEditionId: activeEdition ? activeEdition.id : null,
      pagesGenerated: activeEdition ? activeEdition.actualPageCount : 0,
      pdfPublishingStatus: activeEdition ? activeEdition.status : 'none',
    },
    aiStatus: {
      geminiApiKeyConfigured: geminiConfigured,
      modelAId: settings.modelAClassifierId,
      modelBId: settings.modelBStoryId,
      promptVersion: settings.promptVersion,
    },
    activeEdition,
    recentJobs: jobs,
    settings,
  });
});

// 3. GET /api/articles
app.get('/api/articles', (req, res) => {
  const { reporterId, location, status, category } = req.query;
  const articles = listArticles({
    reporterId: typeof reporterId === 'string' && reporterId !== 'all' ? reporterId : undefined,
    location: typeof location === 'string' && location.trim() ? location.trim() : undefined,
    status: typeof status === 'string' && status !== 'all' ? status : undefined,
    category: typeof category === 'string' && category !== 'all' ? category : undefined,
  });
  return res.json({ articles });
});

// 4. GET /api/articles/:id
app.get('/api/articles/:id', (req, res) => {
  const article = getArticleById(req.params.id);
  if (!article) {
    return res.status(404).json({ error: 'Article not found.' });
  }
  const jobs = listRecentJobs(30).filter((j) => j.targetId === article.id);
  return res.json({ article, jobs });
});

// 5. POST /api/articles
app.post('/api/articles', (req, res) => {
  const actor = resolveActorUser(req);
  const settings = getSettings();
  const {
    originalHeadline,
    originalBodyTelugu,
    location,
    district,
    eventDate,
    suggestedCategory,
    saveAsDraft,
    autoProcess,
    idempotencyKey,
  } = req.body || {};

  if (!originalBodyTelugu || typeof originalBodyTelugu !== 'string' || originalBodyTelugu.trim().length < 20) {
    return res.status(400).json({
      error: 'Please enter at least 20 characters of Telugu news text (కనీసం 20 అక్షరాల తెలుగు వార్తా పాఠ్యాన్ని నమోదు చేయండి).',
    });
  }
  if (!containsTeluguUnicode(originalBodyTelugu)) {
    return res.status(400).json({
      error: 'Submission must contain Unicode Telugu script (వార్త తప్పనిసరిగా తెలుగు యూనికోడ్ లిపిలో ఉండాలి).',
    });
  }
  if (!location || typeof location !== 'string' || !location.trim()) {
    return res.status(400).json({
      error: 'Please specify the village, town, or city location (గ్రామం / పట్టణం పేరు నమోదు చేయండి).',
    });
  }

  // Idempotency check to prevent accidental duplicate submissions
  const computedIdemKey =
    typeof idempotencyKey === 'string' && idempotencyKey.trim()
      ? idempotencyKey.trim()
      : crypto
          .createHash('sha256')
          .update(`${actor.id}:${location.trim()}:${originalBodyTelugu.trim()}`)
          .digest('hex')
          .slice(0, 24);

  const existingByIdem = db
    .prepare('SELECT id FROM articles WHERE idempotency_key = ?')
    .get(computedIdemKey) as { id: string } | undefined;

  if (existingByIdem) {
    const existingArticle = getArticleById(existingByIdem.id);
    return res.status(200).json({
      article: existingArticle,
      idempotentReplay: true,
      message: 'Existing submission returned (idempotent duplicate guard).',
    });
  }

  const articleId = `art-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const cat =
    settings.categories.find((c) => c.id === suggestedCategory) ||
    DEFAULT_CATEGORIES[0];
  const initialStatus = saveAsDraft ? 'draft' : 'submitted';

  db.prepare(
    `INSERT INTO articles (
      id, reporter_id, idempotency_key, current_revision, original_headline, original_body_telugu,
      primary_headline_telugu, compact_headline_telugu, standfirst_telugu, summary_telugu,
      ai_body_paragraphs_full_json, ai_body_paragraphs_short_json,
      suggested_category, assigned_category, assigned_category_telugu,
      location, district, event_date, submission_time, status, priority_score, risk_level,
      validation_warnings_json, classification_model_id, story_model_id, prompt_version,
      primary_asset_id, created_at, updated_at
    ) VALUES (?, ?, ?, 1, ?, ?, NULL, NULL, NULL, NULL, '[]', '[]', ?, ?, ?, ?, ?, ?, ?, ?, 65, 'low', '[]', NULL, NULL, ?, NULL, ?, ?)`
  ).run(
    articleId,
    actor.id,
    computedIdemKey,
    originalHeadline ? String(originalHeadline).trim() : null,
    originalBodyTelugu.trim(),
    cat.id,
    cat.id,
    cat.teluguLabel,
    location.trim(),
    district ? String(district).trim() : actor.district,
    eventDate || now.slice(0, 10),
    now,
    initialStatus,
    settings.promptVersion,
    now,
    now
  );

  // Store immutable revision #1 (reporter_original)
  db.prepare(
    `INSERT INTO article_revisions (
      id, article_id, revision_number, source_type, headline_original,
      primary_headline_telugu, compact_headline_telugu, standfirst_telugu, summary_telugu,
      body_text_original, body_paragraphs_full_json, body_paragraphs_short_json,
      model_id, prompt_version, created_by_user_id, created_at
    ) VALUES (?, ?, 1, 'reporter_original', ?, NULL, NULL, NULL, NULL, ?, '[]', '[]', NULL, NULL, ?, ?)`
  ).run(
    `rev-${articleId}-1`,
    articleId,
    originalHeadline ? String(originalHeadline).trim() : null,
    originalBodyTelugu.trim(),
    actor.id,
    now
  );

  logAuditEvent(actor.id, 'article', articleId, 'article_submitted', {
    status: initialStatus,
    location: location.trim(),
  });

  let job = null;
  if (!saveAsDraft && autoProcess !== false) {
    job = enqueueEditorialProcessingJob(articleId, actor.id);
  }

  return res.status(201).json({
    article: getArticleById(articleId),
    job,
  });
});

// 6. PATCH /api/articles/:id
app.patch('/api/articles/:id', (req, res) => {
  const actor = resolveActorUser(req);
  const article = getArticleById(req.params.id);
  if (!article) {
    return res.status(404).json({ error: 'Article not found.' });
  }

  // Authorization: A reporter can only manage their own submissions unless editor/admin
  if (actor.role === 'reporter' && article.reporterId !== actor.id) {
    return res.status(403).json({
      error: 'Reporters may only edit their own submissions. Switch to Chief Sub-Editor to manage all stories.',
    });
  }

  const {
    originalHeadline,
    originalBodyTelugu,
    primaryHeadlineTelugu,
    compactHeadlineTelugu,
    standfirstTelugu,
    aiBodyParagraphsFull,
    assignedCategory,
    status,
    priorityScore,
    primaryAssetId,
  } = req.body || {};

  const settings = getSettings();
  const nextRevision = article.currentRevision + 1;
  const now = new Date().toISOString();

  const updatedOriginalBody =
    typeof originalBodyTelugu === 'string' && originalBodyTelugu.trim()
      ? originalBodyTelugu.trim()
      : article.originalBodyTelugu;

  if (updatedOriginalBody !== article.originalBodyTelugu) {
    invalidateArticleCache(article.id);
  }

  const nextCategory =
    typeof assignedCategory === 'string'
      ? (settings.categories.find((c) => c.id === assignedCategory) || DEFAULT_CATEGORIES[0])
      : settings.categories.find((c) => c.id === article.assignedCategory) || DEFAULT_CATEGORIES[0];

  const nextFullParas = Array.isArray(aiBodyParagraphsFull)
    ? aiBodyParagraphsFull.map(String)
    : article.aiBodyParagraphsFull;

  db.prepare(
    `UPDATE articles
     SET current_revision = ?,
         original_headline = ?,
         original_body_telugu = ?,
         primary_headline_telugu = ?,
         compact_headline_telugu = ?,
         standfirst_telugu = ?,
         ai_body_paragraphs_full_json = ?,
         assigned_category = ?,
         assigned_category_telugu = ?,
         status = ?,
         priority_score = ?,
         primary_asset_id = ?,
         updated_at = ?
     WHERE id = ?`
  ).run(
    nextRevision,
    originalHeadline !== undefined ? originalHeadline : article.originalHeadline,
    updatedOriginalBody,
    primaryHeadlineTelugu !== undefined ? primaryHeadlineTelugu : article.primaryHeadlineTelugu,
    compactHeadlineTelugu !== undefined ? compactHeadlineTelugu : article.compactHeadlineTelugu,
    standfirstTelugu !== undefined ? standfirstTelugu : article.standfirstTelugu,
    JSON.stringify(nextFullParas),
    nextCategory.id,
    nextCategory.teluguLabel,
    status || article.status,
    priorityScore !== undefined ? Number(priorityScore) : article.priorityScore,
    primaryAssetId !== undefined ? primaryAssetId : article.primaryAssetId,
    now,
    article.id
  );

  db.prepare(
    `INSERT INTO article_revisions (
      id, article_id, revision_number, source_type, headline_original,
      primary_headline_telugu, compact_headline_telugu, standfirst_telugu, summary_telugu,
      body_text_original, body_paragraphs_full_json, body_paragraphs_short_json,
      model_id, prompt_version, created_by_user_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`
  ).run(
    `rev-${article.id}-${nextRevision}`,
    article.id,
    nextRevision,
    actor.role === 'editor' ? 'editor_override' : 'reporter_edit',
    originalHeadline !== undefined ? originalHeadline : article.originalHeadline,
    primaryHeadlineTelugu !== undefined ? primaryHeadlineTelugu : article.primaryHeadlineTelugu,
    compactHeadlineTelugu !== undefined ? compactHeadlineTelugu : article.compactHeadlineTelugu,
    standfirstTelugu !== undefined ? standfirstTelugu : article.standfirstTelugu,
    article.summaryTelugu,
    updatedOriginalBody,
    JSON.stringify(nextFullParas),
    JSON.stringify(article.aiBodyParagraphsShort),
    actor.id,
    now
  );

  logAuditEvent(actor.id, 'article', article.id, 'article_revision_saved', {
    revisionNumber: nextRevision,
    status: status || article.status,
  });

  return res.json({ article: getArticleById(article.id) });
});

// 7. POST /api/articles/:id/assets (supports multipart file upload OR base64/sample theme upload)
app.post('/api/articles/:id/assets', upload.single('file'), (req, res) => {
  const actor = resolveActorUser(req);
  const article = getArticleById(req.params.id);
  if (!article) {
    return res.status(404).json({ error: 'Article not found.' });
  }
  if (actor.role === 'reporter' && article.reporterId !== actor.id) {
    return res.status(403).json({
      error: 'Reporters may only upload photographs to their own submissions.',
    });
  }

  const settings = getSettings();
  let binaryBuffer: Uint8Array | null = null;
  let originalFilename = 'reporter_photo.png';

  if (req.file && req.file.buffer) {
    binaryBuffer = new Uint8Array(req.file.buffer);
    originalFilename = req.file.originalname || 'uploaded_photo.png';
  } else if (req.body?.base64Data && typeof req.body.base64Data === 'string') {
    const cleaned = req.body.base64Data.replace(/^data:image\/\w+;base64,/, '');
    binaryBuffer = new Uint8Array(Buffer.from(cleaned, 'base64'));
    originalFilename = req.body.filename || 'uploaded_photo.png';
  } else if (req.body?.sampleTheme) {
    const theme = req.body.sampleTheme as 'dam_water' | 'paddy_harvest' | 'smart_school' | 'metro_infra';
    binaryBuffer = createEditorialPngBuffer(560, 350, theme);
    originalFilename = `${theme}_press_photo.png`;
  }

  if (!binaryBuffer) {
    return res.status(400).json({ error: 'No image file or binary payload provided.' });
  }

  const validation = validateImageBinary(
    binaryBuffer,
    settings.maxImageSizeBytes,
    settings.minImageWidthPx,
    settings.minImageHeightPx
  );

  if (!validation.valid || !validation.mimeType || !validation.width || !validation.height) {
    return res.status(400).json({
      error: validation.error || 'Binary image validation failed.',
      validation,
    });
  }

  const captionTelugu =
    typeof req.body?.captionTelugu === 'string' && req.body.captionTelugu.trim()
      ? req.body.captionTelugu.trim()
      : `${article.location}: వార్తా చిత్రం`;

  const isPrimary =
    req.body?.isPrimary === true ||
    req.body?.isPrimary === 'true' ||
    !article.primaryAssetId;

  const ext =
    validation.mimeType === 'image/jpeg'
      ? '.jpg'
      : validation.mimeType === 'image/webp'
      ? '.webp'
      : '.png';
  const assetId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const storedFilename = `${assetId}${ext}`;
  const fullPath = path.join(ASSETS_DIR, storedFilename);
  fs.writeFileSync(fullPath, binaryBuffer);

  const sha256Hash = crypto.createHash('sha256').update(binaryBuffer).digest('hex');
  const now = new Date().toISOString();

  if (isPrimary) {
    db.prepare('UPDATE image_assets SET is_primary = 0 WHERE article_id = ?').run(article.id);
    db.prepare('UPDATE articles SET primary_asset_id = ?, updated_at = ? WHERE id = ?').run(
      assetId,
      now,
      article.id
    );
  }

  db.prepare(
    `INSERT INTO image_assets (
      id, article_id, original_filename, mime_type, file_size_bytes,
      width, height, storage_key_original, storage_key_derivative,
      public_url, caption_telugu, is_primary, sha256_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    assetId,
    article.id,
    originalFilename,
    validation.mimeType,
    binaryBuffer.byteLength,
    validation.width,
    validation.height,
    storedFilename,
    storedFilename,
    `/api/assets/file/${storedFilename}`,
    captionTelugu,
    isPrimary ? 1 : 0,
    sha256Hash,
    now
  );

  logAuditEvent(actor.id, 'image_asset', assetId, 'photo_uploaded_and_verified', {
    articleId: article.id,
    mimeType: validation.mimeType,
    dimensions: `${validation.width}x${validation.height}`,
  });

  return res.status(201).json({
    assetId,
    article: getArticleById(article.id),
  });
});

// 8. POST /api/articles/:id/process
app.post('/api/articles/:id/process', (req, res) => {
  const actor = resolveActorUser(req);
  const article = getArticleById(req.params.id);
  if (!article) {
    return res.status(404).json({ error: 'Article not found.' });
  }
  if (req.body?.forceReprocess) {
    invalidateArticleCache(article.id);
  }
  const job = enqueueEditorialProcessingJob(article.id, actor.id);
  return res.status(202).json({
    jobId: job.id,
    job,
    message: 'Enqueued dual-model editorial processing job (Gemma 4 31B IT -> Gemini 3.5 Flash-Lite).',
  });
});

// 9. GET /api/jobs/:id & GET /api/jobs
app.get('/api/jobs', (_req, res) => {
  return res.json({ jobs: listRecentJobs(30) });
});

app.get('/api/jobs/:id', (req, res) => {
  const job = getJobById(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }
  return res.json({ job });
});

// 10. POST /api/editions & GET /api/editions
app.get('/api/editions', (_req, res) => {
  return res.json({ editions: listEditions() });
});

app.post('/api/editions', (req, res) => {
  const actor = resolveActorUser(req);
  const settings = getSettings();
  const existingEditions = listEditions();
  const nextNumber =
    existingEditions.length > 0
      ? Math.max(...existingEditions.map((e) => e.editionNumber)) + 1
      : 101;

  const {
    editionDate,
    editionTitleTelugu,
    targetPageCount,
    columnsPerPage,
    autoGenerate,
  } = req.body || {};

  const editionId = `ed-${Date.now()}`;
  const now = new Date().toISOString();
  const pagesTarget = Math.min(8, Math.max(1, Number(targetPageCount) || settings.defaultPageCount));
  const cols = Math.min(8, Math.max(4, Number(columnsPerPage) || settings.columnsPerPage));

  db.prepare(
    `INSERT INTO newspaper_editions (
      id, edition_number, edition_date, edition_title_telugu,
      masthead_title_telugu, masthead_subtitle_telugu,
      target_page_count, actual_page_count, page_width_mm, page_height_mm,
      columns_per_page, gutter_mm, status, active_job_id,
      pdf_artifact_id, pdf_public_url, preflight_report_json,
      layout_diagnostics_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'draft', NULL, NULL, NULL, NULL, '{}', ?, ?)`
  ).run(
    editionId,
    nextNumber,
    editionDate || now.slice(0, 10),
    editionTitleTelugu || `${settings.newspaperNameTelugu} — ప్రత్యేక సంచిక #${nextNumber}`,
    settings.newspaperNameTelugu,
    settings.newspaperTaglineTelugu,
    pagesTarget,
    settings.pageWidthMm,
    settings.pageHeightMm,
    cols,
    settings.gutterMm,
    now,
    now
  );

  logAuditEvent(actor.id, 'edition', editionId, 'edition_created', {
    editionNumber: nextNumber,
    targetPageCount: pagesTarget,
  });

  let job = null;
  if (autoGenerate !== false) {
    job = enqueueEditionGenerationJob(editionId, actor.id);
  }

  return res.status(201).json({
    edition: getEditionById(editionId),
    jobId: job ? job.id : null,
    job,
  });
});

// 11. POST /api/editions/:id/generate
app.post('/api/editions/:id/generate', (req, res) => {
  const actor = resolveActorUser(req);
  const edition = getEditionById(req.params.id);
  if (!edition) {
    return res.status(404).json({ error: 'Edition not found.' });
  }
  const job = enqueueEditionGenerationJob(edition.id, actor.id);
  return res.status(202).json({
    jobId: job.id,
    job,
    editionId: edition.id,
  });
});

// 12. GET /api/editions/:id/status
app.get('/api/editions/:id/status', (req, res) => {
  const edition = getEditionById(req.params.id);
  if (!edition) {
    return res.status(404).json({ error: 'Edition not found.' });
  }
  const activeJob = edition.activeJobId ? getJobById(edition.activeJobId) : null;
  return res.json({
    editionId: edition.id,
    status: edition.status,
    activeJob,
    masterPlan: edition.masterPlan,
    editorDiagnostics: edition.editorDiagnostics,
    planHistory: edition.planHistory,
    layoutDiagnostics: edition.layoutDiagnostics,
    preflightReport: edition.preflightReport,
  });
});

// 13. GET /api/editions/:id/pages & GET /api/editions/:id/master-plan
app.get('/api/editions/:id/pages', (req, res) => {
  const edition = getEditionById(req.params.id);
  if (!edition) {
    return res.status(404).json({ error: 'Edition not found.' });
  }
  return res.json({
    editionId: edition.id,
    editionNumber: edition.editionNumber,
    editionDate: edition.editionDate,
    mastheadTitleTelugu: edition.mastheadTitleTelugu,
    mastheadSubtitleTelugu: edition.mastheadSubtitleTelugu,
    pages: edition.pages,
    masterPlan: edition.masterPlan,
    editorDiagnostics: edition.editorDiagnostics,
    planHistory: edition.planHistory,
    preflightReport: edition.preflightReport,
    layoutDiagnostics: edition.layoutDiagnostics,
  });
});

app.get('/api/editions/:id/master-plan', (req, res) => {
  const edition = getEditionById(req.params.id);
  if (!edition) {
    return res.status(404).json({ error: 'Edition not found.' });
  }
  return res.json({
    editionId: edition.id,
    masterPlan: edition.masterPlan,
    editorDiagnostics: edition.editorDiagnostics,
    planHistory: edition.planHistory,
  });
});

function ensureEditionPdfReady(editionId: string): {
  filePath: string;
  pdfBytes: Uint8Array;
  filename: string;
  printHtml: string;
} | null {
  const edition = getEditionById(editionId);
  if (!edition) return null;

  const settings = getSettings();
  const articles = listArticles();
  const downloadFilename = `PrajaVani-Edition-${edition.editionNumber}-${edition.editionDate}.pdf`;

  let storageFilename = `${edition.id}.pdf`;
  if (edition.pdfArtifactId) {
    const artifact = db
      .prepare('SELECT * FROM pdf_artifacts WHERE id = ?')
      .get(edition.pdfArtifactId) as { storage_key: string } | undefined;
    if (artifact?.storage_key) {
      storageFilename = path.basename(artifact.storage_key);
    }
  }

  const filePath = path.join(PDF_DIR, storageFilename);
  let pdfBytes: Uint8Array | null = null;

  if (fs.existsSync(filePath)) {
    const existing = new Uint8Array(fs.readFileSync(filePath));
    // Verify %PDF- header and ensure it's the rich rendered PDF (> 8 KB)
    if (
      existing.byteLength > 8000 &&
      existing[0] === 0x25 &&
      existing[1] === 0x50 &&
      existing[2] === 0x44 &&
      existing[3] === 0x46
    ) {
      pdfBytes = existing;
    }
  }

  if (!pdfBytes) {
    pdfBytes = exportMasterPlanToPdfBuffer(edition, settings, articles);
    fs.writeFileSync(filePath, pdfBytes);
    const pdfHash = crypto.createHash('sha256').update(pdfBytes).digest('hex');
    const preflight = runPrintPreflightValidation(edition, pdfBytes, settings);
    const artifactId = edition.pdfArtifactId || `pdf-${edition.id}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT OR REPLACE INTO pdf_artifacts (
        id, edition_id, storage_key, public_url, file_size_bytes, page_count, sha256_hash, preflight_passed, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      artifactId,
      edition.id,
      storageFilename,
      `/api/editions/${edition.id}/pdf`,
      pdfBytes.byteLength,
      edition.actualPageCount || 2,
      pdfHash,
      preflight.overallPassed ? 1 : 0,
      now
    );

    db.prepare(
      `UPDATE newspaper_editions
       SET pdf_artifact_id = ?, pdf_public_url = ?, preflight_report_json = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      artifactId,
      `/api/editions/${edition.id}/pdf`,
      JSON.stringify(preflight),
      now,
      edition.id
    );
  }

  const printHtml = edition.masterPlan
    ? buildMasterPlanPrintHtml(edition, edition.masterPlan, articles, settings)
    : '';

  return {
    filePath,
    pdfBytes,
    filename: downloadFilename,
    printHtml,
  };
}

// 14. GET /api/editions/:id/pdf & GET /api/editions/:id/pdf-data
app.get('/api/editions/:id/pdf', (req, res) => {
  const ready = ensureEditionPdfReady(req.params.id);
  if (!ready) {
    return res.status(404).json({ error: 'PDF artifact not found for this edition.' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', String(ready.pdfBytes.byteLength));
  res.setHeader('Content-Disposition', `attachment; filename="${ready.filename}"`);
  return res.end(Buffer.from(ready.pdfBytes));
});

app.get('/api/editions/:id/pdf-data', (req, res) => {
  const ready = ensureEditionPdfReady(req.params.id);
  if (!ready) {
    return res.status(404).json({ error: 'PDF artifact not found for this edition.' });
  }
  const edition = getEditionById(req.params.id);

  return res.json({
    editionId: req.params.id,
    filename: ready.filename,
    mimeType: 'application/pdf',
    sizeBytes: ready.pdfBytes.byteLength,
    pageCount: edition?.actualPageCount || 2,
    base64: Buffer.from(ready.pdfBytes).toString('base64'),
    printHtml: ready.printHtml,
    agenticPdfReport: edition?.agenticPdfReport || null,
  });
});

// 14b. POST /api/editions/:id/agentic-pdf-verify
// Makes the PDF, sends it to gemini-3.1-flash-lite, and if anything looks wrong dispatches directives to
// gemini-3.5-flash-lite to rewrite the layout architecture until READY_FOR_USER.
app.post('/api/editions/:id/agentic-pdf-verify', async (req, res) => {
  try {
    const edition = getEditionById(req.params.id);
    if (!edition || !edition.masterPlan) {
      return res.status(404).json({ error: 'Edition or master layout plan not found.' });
    }
    const settings = getSettings();
    const articles = listArticles();

    const agenticRes = await runAgenticPdfGatekeeperLoop({
      edition,
      initialPlan: edition.masterPlan,
      initialPlanHistory: edition.planHistory || [],
      articles,
      settings,
      maxAgentRounds: 3,
    });

    const pdfBytes = agenticRes.finalPdfBytes;
    const storageFilename = `${edition.id}.pdf`;
    const filePath = path.join(PDF_DIR, storageFilename);
    fs.writeFileSync(filePath, pdfBytes);

    const pdfHash = crypto.createHash('sha256').update(pdfBytes).digest('hex');
    const preflight = runPrintPreflightValidation(edition, pdfBytes, settings);
    const artifactId = edition.pdfArtifactId || `pdf-${edition.id}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT OR REPLACE INTO pdf_artifacts (
        id, edition_id, storage_key, public_url, file_size_bytes, page_count, sha256_hash, preflight_passed, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      artifactId,
      edition.id,
      storageFilename,
      `/api/editions/${edition.id}/pdf`,
      pdfBytes.byteLength,
      agenticRes.finalPages.length,
      pdfHash,
      preflight.overallPassed ? 1 : 0,
      now
    );

    db.prepare(
      `UPDATE newspaper_editions
       SET actual_page_count = ?,
           master_plan_json = ?,
           editor_diagnostics_json = ?,
           plan_history_json = ?,
           agentic_pdf_report_json = ?,
           pdf_artifact_id = ?,
           pdf_public_url = ?,
           preflight_report_json = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      agenticRes.finalPages.length,
      JSON.stringify(agenticRes.finalPlan),
      JSON.stringify(agenticRes.finalDiagnostics),
      JSON.stringify(agenticRes.updatedPlanHistory),
      JSON.stringify(agenticRes.agenticReport),
      artifactId,
      `/api/editions/${edition.id}/pdf`,
      JSON.stringify(preflight),
      now,
      edition.id
    );

    const updatedEdition = getEditionById(edition.id)!;
    const printHtml = buildMasterPlanPrintHtml(
      updatedEdition,
      agenticRes.finalPlan,
      articles,
      settings
    );

    return res.json({
      edition: updatedEdition,
      agenticPdfReport: agenticRes.agenticReport,
      pdfPayload: {
        editionId: edition.id,
        filename: `PrajaVani-Edition-${edition.editionNumber}-${edition.editionDate}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: pdfBytes.byteLength,
        pageCount: agenticRes.finalPages.length,
        base64: Buffer.from(pdfBytes).toString('base64'),
        printHtml,
        agenticPdfReport: agenticRes.agenticReport,
      },
    });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to run Agentic PDF verification loop.',
    });
  }
});

// 15. GET / PATCH /api/settings
app.get('/api/settings', (_req, res) => {
  return res.json({ settings: getSettings() });
});

app.patch('/api/settings', (req, res) => {
  const actor = resolveActorUser(req);
  const updated = updateSettings(req.body || {});
  logAuditEvent(actor.id, 'settings', '1', 'publication_settings_updated', req.body || {});
  return res.json({ settings: updated });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Praja Vani Telugu Newspaper Publishing Server listening on http://localhost:${port}`);
  });
}

startServer();
