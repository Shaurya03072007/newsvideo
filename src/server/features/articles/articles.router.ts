import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { articlesRepo } from './articles.repo.ts';
import { getUsers, listRecentJobs, ASSETS_DIR, getSettings } from '../../db.ts';
import { enqueueEditorialProcessingJob } from '../../workers.ts';
import { validateImageBinary, DEFAULT_CATEGORIES } from '../../../utils/editorialLogic.ts';
import { invalidateArticleCache } from '../../aiAdapters.ts';
import { createEditorialPngBuffer } from '../../../utils/pngGenerator.ts';
import { syncArticleToSupabase, deleteArticleFromSupabase } from '../../supabase.ts';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});
const uploadAssetFields = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'image', maxCount: 1 },
]);

export const articlesRouter = Router();

function resolveActorUser(req: any) {
  const userIdHeader = req.headers['x-user-id'];
  const userId = typeof userIdHeader === 'string' && userIdHeader ? userIdHeader : 'rep-vijayawada';
  const users = getUsers();
  return users.find((u) => u.id === userId) || users[0];
}

// 1. GET /api/articles (List articles with optional filters)
articlesRouter.get('/', (req, res) => {
  const { reporterId, location, status, category } = req.query;
  const articles = articlesRepo.list({
    reporterId: typeof reporterId === 'string' && reporterId !== 'all' ? reporterId : undefined,
    location: typeof location === 'string' && location.trim() ? location.trim() : undefined,
    status: typeof status === 'string' && status !== 'all' ? status : undefined,
    category: typeof category === 'string' && category !== 'all' ? category : undefined,
  });
  return res.json({ articles });
});

// 2. GET /api/articles/:id (Single article with related jobs)
articlesRouter.get('/:id', (req, res) => {
  const article = articlesRepo.getById(req.params.id);
  if (!article) {
    return res.status(404).json({ error: 'Article not found.' });
  }
  const jobs = listRecentJobs(30).filter((j) => j.targetId === article.id);
  return res.json({ article, jobs });
});

// 3. POST /api/articles (Create reporter dispatch or breaking story)
articlesRouter.post('/', (req, res) => {
  try {
    const actor = resolveActorUser(req);
    const settings = getSettings();
    const {
      originalHeadline,
      originalBodyTelugu,
      location,
      district,
      eventDate,
      suggestedCategory,
      assignedCategory,
      assignedCategoryTelugu,
      saveAsDraft,
      priorityScore,
      assets,
      idempotencyKey,
    } = req.body || {};

    if (!originalBodyTelugu || typeof originalBodyTelugu !== 'string' || originalBodyTelugu.trim().length < 20) {
      return res.status(400).json({
        error: 'Please enter at least 20 characters of news text in Telugu or English (కనీసం 20 అక్షరాల వార్తా పాఠ్యాన్ని నమోదు చేయండి - తెలుగు లేదా ఆంగ్లం).',
      });
    }
    if (!location || typeof location !== 'string' || !location.trim()) {
      return res.status(400).json({
        error: 'Please specify the village, town, or city location (గ్రామం / పట్టణం పేరు నమోదు చేయండి).',
      });
    }

    // Idempotency guard: replay existing article if key was previously submitted
    const trimmedIdemKey = idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim() ? idempotencyKey.trim() : undefined;
    if (trimmedIdemKey) {
      const existing = articlesRepo.findByIdempotencyKey(trimmedIdemKey);
      if (existing) {
        return res.status(200).json({
          article: existing,
          idempotentReplay: true,
          message: 'Existing submission returned (idempotent duplicate guard).',
        });
      }
    }

    const cat =
      settings.categories.find((c) => c.id === (suggestedCategory || assignedCategory)) ||
      DEFAULT_CATEGORIES[0];

    const article = articlesRepo.create({
      reporterId: actor.id,
      originalHeadline,
      originalBodyTelugu,
      suggestedCategory: cat.id,
      assignedCategory: assignedCategory || cat.id,
      assignedCategoryTelugu: assignedCategoryTelugu || cat.teluguLabel,
      location,
      district,
      eventDate,
      saveAsDraft: Boolean(saveAsDraft),
      priorityScore: priorityScore !== undefined ? Number(priorityScore) : undefined,
      assets,
      idempotencyKey: trimmedIdemKey,
    });

    syncArticleToSupabase(article).catch((e) => console.warn('Supabase article sync warning:', e));

    return res.status(201).json({ article });
  } catch (err: any) {
    console.error('Error creating article:', err);
    return res.status(500).json({
      error: err.message || 'వార్త సృష్టించడంలో అంతర్గత లోపం ఏర్పడింది.',
    });
  }
});

// 4. PATCH /api/articles/:id (Editorial review / text revision)
articlesRouter.patch('/:id', (req, res) => {
  const actor = resolveActorUser(req);
  const updated = articlesRepo.update(req.params.id, req.body || {}, actor.id);
  if (!updated) {
    return res.status(404).json({ error: 'Article not found for update.' });
  }
  syncArticleToSupabase(updated).catch((e) => console.warn('Supabase article sync warning:', e));
  return res.json({ article: updated });
});

// 5. POST /api/articles/:id/process (Enqueue AI processing job)
articlesRouter.post('/:id/process', (req, res) => {
  const actor = resolveActorUser(req);
  const article = articlesRepo.getById(req.params.id);
  if (!article) {
    return res.status(404).json({ error: 'Article not found.' });
  }

  const { forceReprocess } = req.body || {};
  if (forceReprocess) {
    invalidateArticleCache(article.id);
  }

  const job = enqueueEditorialProcessingJob(article.id, actor.id);
  return res.status(202).json({
    message: 'Dual-model AI processing job enqueued (Gemma 4 31B Classifier -> Gemini 3.5 Story Architect).',
    job,
  });
});

// 6. POST /api/articles/:id/asset and /api/articles/:id/assets (Upload image asset or attach sample theme)
articlesRouter.post(
  ['/:id/asset', '/:id/assets'],
  (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      return uploadAssetFields(req, res, next);
    }
    return next();
  },
  (req, res) => {
    try {
      const article = articlesRepo.getById(req.params.id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found.' });
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const uploadedFile = files?.file?.[0] || files?.image?.[0] || req.file;

      if (uploadedFile && uploadedFile.buffer) {
        const check = validateImageBinary(uploadedFile.buffer);
        if (!check.valid) {
          return res.status(400).json({ error: check.error || 'Invalid image file.' });
        }

        const ext = check.mimeType === 'image/jpeg' ? '.jpg' : check.mimeType === 'image/webp' ? '.webp' : '.png';
        const filename = `asset-${article.id}-${Date.now()}${ext}`;
        const filePath = path.join(ASSETS_DIR, filename);
        fs.writeFileSync(filePath, uploadedFile.buffer);

        const assetUrl = `/api/assets/file/${filename}`;
        const isPrimary =
          req.body.isPrimary === 'true' ||
          req.body.isPrimary === true ||
          req.body.isPrimaryPhoto === 'true' ||
          req.body.isPrimaryPhoto === true ||
          !article.primaryAssetId;

        const createdAsset = articlesRepo.addAsset(article.id, {
          assetUrl,
          captionTelugu: typeof req.body.captionTelugu === 'string' && req.body.captionTelugu.trim() ? req.body.captionTelugu.trim() : undefined,
          photographerCredit: typeof req.body.photographerCredit === 'string' ? req.body.photographerCredit : undefined,
          resolutionDpi: 300,
          isPrimaryPhoto: isPrimary,
          widthPx: check.width,
          heightPx: check.height,
        });

        return res.status(201).json({ asset: createdAsset });
      }

      // Check if sample theme was requested
      const sampleTheme = req.body?.sampleTheme || req.body?.samplePhotoTheme;
      if (sampleTheme && ['dam_water', 'paddy_harvest', 'smart_school', 'metro_infra'].includes(sampleTheme)) {
        const pngBuf = createEditorialPngBuffer(800, 480, sampleTheme as any);
        const filename = `asset-${article.id}-sample-${Date.now()}.png`;
        const filePath = path.join(ASSETS_DIR, filename);
        fs.writeFileSync(filePath, Buffer.from(pngBuf));

        const assetUrl = `/api/assets/file/${filename}`;
        const createdAsset = articlesRepo.addAsset(article.id, {
          assetUrl,
          captionTelugu: typeof req.body.captionTelugu === 'string' && req.body.captionTelugu.trim() ? req.body.captionTelugu.trim() : 'వార్తా చిత్రం',
          photographerCredit: 'ప్రజా వాణి ఫోటో బ్యూరో',
          resolutionDpi: 300,
          isPrimaryPhoto: req.body.isPrimary !== false,
          widthPx: 800,
          heightPx: 480,
        });

        return res.status(201).json({ asset: createdAsset });
      }

      return res.status(400).json({ error: 'No image file uploaded or sample theme provided.' });
    } catch (err: any) {
      console.error('Error uploading asset:', err);
      return res.status(500).json({ error: err.message || 'చిత్రం అప్‌లోడ్ విఫలమైంది.' });
    }
  }
);

// 7. DELETE /api/articles/:id (Permanent deletion of story submission)
articlesRouter.delete('/:id', (req, res) => {
  const actor = resolveActorUser(req);
  const success = articlesRepo.delete(req.params.id, actor.id);
  if (!success) {
    return res.status(404).json({ error: 'Article not found.' });
  }
  deleteArticleFromSupabase(req.params.id).catch((e) => console.warn('Supabase deleteArticle warning:', e));
  return res.json({
    message: 'Article and related assets permanently deleted.',
    deletedArticleId: req.params.id,
  });
});

