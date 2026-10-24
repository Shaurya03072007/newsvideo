import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { editionsRepo } from './editions.repo.ts';
import { articlesRepo } from '../articles/articles.repo.ts';
import { db, getEditionById, getSettings, getUsers, PDF_DIR, logAuditEvent, buildFallbackValidPdfBuffer } from '../../db.ts';
import { enqueueEditionGenerationJob } from '../../workers.ts';
import { buildMasterPlanPrintHtml, exportMasterPlanToPdfBuffer } from '../../../engine/pdf-exporter.ts';
import { runAgenticPdfGatekeeperLoop } from '../../../engine/agentic-pdf-loop.ts';
import { runPrintPreflightValidation } from '../../../utils/editorialLogic.ts';

export const editionsRouter = Router();

function resolveActorUser(req: any) {
  const userIdHeader = req.headers['x-user-id'];
  const userId = typeof userIdHeader === 'string' && userIdHeader ? userIdHeader : 'editor-chief';
  const users = getUsers();
  return users.find((u) => u.id === userId) || users[0];
}

export function ensureEditionPdfReady(
  editionId: string,
  force = false
): {
  filePath: string;
  pdfBytes: Uint8Array;
  filename: string;
  printHtml: string;
} | null {
  const edition = getEditionById(editionId);
  if (!edition) return null;
  const settings = getSettings();
  const articles = articlesRepo.list();

  let storageFilename = `${edition.id}.pdf`;
  const downloadFilename = `PrajaVani-Edition-${edition.editionNumber}-${edition.editionDate}.pdf`;

  if (edition.pdfArtifactId) {
    const artifact = db
      .prepare('SELECT storage_key, preflight_passed FROM pdf_artifacts WHERE id = ?')
      .get(edition.pdfArtifactId) as { storage_key?: string; preflight_passed?: number } | undefined;
    if (artifact?.storage_key) {
      storageFilename = path.basename(artifact.storage_key);
    }
  }

  const filePath = path.join(PDF_DIR, storageFilename);
  let pdfBytes: Uint8Array | null = null;

  if (!force && fs.existsSync(filePath)) {
    try {
      const stat = fs.statSync(filePath);
      const editionUpdatedTime = new Date(edition.updatedAt).getTime();
      const isFresh = stat.mtimeMs >= editionUpdatedTime - 2000;
      const isPreflightPassed = edition.preflightReport?.overallPassed ?? true;

      if (isFresh && isPreflightPassed) {
        const existing = new Uint8Array(fs.readFileSync(filePath));
        if (
          existing.byteLength > 25000 &&
          existing[0] === 0x25 &&
          existing[1] === 0x50 &&
          existing[2] === 0x44 &&
          existing[3] === 0x46
        ) {
          pdfBytes = existing;
        }
      }
    } catch {
      // ignore stat errors and regenerate
    }
  }

  let validPdfBytes: Uint8Array;
  if (!pdfBytes) {
    const exported = exportMasterPlanToPdfBuffer(edition, settings, articles);
    validPdfBytes = exported && exported.byteLength >= 500 ? exported : buildFallbackValidPdfBuffer(edition);
    fs.writeFileSync(filePath, validPdfBytes);
    const pdfHash = crypto.createHash('sha256').update(validPdfBytes).digest('hex');
    const preflight = runPrintPreflightValidation(edition, validPdfBytes, settings);
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
      validPdfBytes.byteLength,
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
  } else {
    validPdfBytes = pdfBytes;
  }

  const printHtml = edition.masterPlan
    ? buildMasterPlanPrintHtml(edition, edition.masterPlan, articles, settings)
    : '';

  return {
    filePath,
    pdfBytes: validPdfBytes,
    filename: downloadFilename,
    printHtml,
  };
}

// 1. GET /api/editions
editionsRouter.get('/', (_req, res) => {
  return res.json({ editions: editionsRepo.list() });
});

// 2. GET /api/editions/:id
editionsRouter.get('/:id', (req, res) => {
  const edition = editionsRepo.getById(req.params.id);
  if (!edition) {
    return res.status(404).json({ error: 'Edition not found.' });
  }
  return res.json({ edition });
});

// 3. POST /api/editions & POST /api/editions/generate
const handleGenerateEdition = (req: any, res: any) => {
  const actor = resolveActorUser(req);
  const { editionDate, editionTitleTelugu, targetPageCount, columnsPerPage, editionId } = req.body || {};
  let targetEditionId = editionId;

  if (!targetEditionId) {
    const editions = editionsRepo.list();
    const nextNumber = editions.length > 0 ? Math.max(...editions.map((e) => e.editionNumber)) + 1 : 105;
    targetEditionId = `ed-${Date.now()}`;
    const now = new Date().toISOString();
    const settings = getSettings();

    db.prepare(`
      INSERT INTO newspaper_editions (
        id, edition_number, edition_date, edition_title_telugu,
        masthead_title_telugu, masthead_subtitle_telugu,
        target_page_count, actual_page_count, page_width_mm, page_height_mm,
        columns_per_page, gutter_mm, status, active_job_id,
        pdf_artifact_id, pdf_public_url, preflight_report_json,
        layout_diagnostics_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 2, ?, ?, ?, ?, 'planning', NULL, NULL, NULL, NULL, '{}', ?, ?)
    `).run(
      targetEditionId,
      nextNumber,
      editionDate || now.slice(0, 10),
      editionTitleTelugu || `ప్రజా వాణి — సంచిక #${nextNumber}`,
      settings.newspaperNameTelugu,
      settings.newspaperTaglineTelugu,
      targetPageCount || 2,
      settings.pageWidthMm,
      settings.pageHeightMm,
      columnsPerPage || settings.columnsPerPage,
      settings.gutterMm,
      now,
      now
    );
  }

  const job = enqueueEditionGenerationJob(targetEditionId, actor.id);
  return res.status(202).json({
    message: 'Newspaper edition compilation enqueued with autonomous layout agent.',
    job,
    editionId: targetEditionId,
  });
};

editionsRouter.post('/', handleGenerateEdition);
editionsRouter.post('/generate', handleGenerateEdition);

// 4. GET /api/editions/:id/pdf (Direct vector PDF stream)
editionsRouter.get('/:id/pdf', (req, res) => {
  const force = req.query.force === 'true' || req.query.regenerate === 'true';
  const ready = ensureEditionPdfReady(req.params.id, force);
  if (!ready) {
    return res.status(404).json({ error: 'PDF artifact not found for this edition.' });
  }
  const isDownload = req.query.download === 'true';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', String(ready.pdfBytes.byteLength));
  res.setHeader(
    'Content-Disposition',
    `${isDownload ? 'attachment' : 'inline'}; filename="${ready.filename}"`
  );
  return res.end(Buffer.from(ready.pdfBytes));
});

// 5. GET /api/editions/:id/pdf-data (Cookie-safe JSON payload)
editionsRouter.get('/:id/pdf-data', (req, res) => {
  const force = req.query.force === 'true' || req.query.regenerate === 'true';
  const ready = ensureEditionPdfReady(req.params.id, force);
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

// 6. POST /api/editions/:id/agentic-pdf-verify
editionsRouter.post('/:id/agentic-pdf-verify', async (req, res) => {
  try {
    const edition = getEditionById(req.params.id);
    if (!edition || !edition.masterPlan) {
      return res.status(404).json({ error: 'Edition or master layout plan not found.' });
    }
    const settings = getSettings();
    const articles = articlesRepo.list();

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

// 7. PATCH /api/editions/:id/master-plan
editionsRouter.patch('/:id/master-plan', (req, res) => {
  const actor = resolveActorUser(req);
  const { moduleOverrides, planVersion } = req.body || {};
  const updated = editionsRepo.updateMasterPlan(
    req.params.id,
    (currentPlan) => {
      const nextPlan = { ...currentPlan };
      nextPlan.plan_version = (planVersion || currentPlan.plan_version) + 1;
      if (moduleOverrides && typeof moduleOverrides === 'object') {
        nextPlan.placements = nextPlan.placements.map((pl: any) => {
          const ov = moduleOverrides[pl.article_id];
          if (!ov) return pl;
          return {
            ...pl,
            col_span: ov.colSpan || pl.col_span,
            assigned_shape: ov.assignedShape || pl.assigned_shape,
          };
        });
      }
      return nextPlan;
    },
    actor.id
  );

  if (!updated) {
    return res.status(404).json({ error: 'Edition not found for master plan update.' });
  }
  return res.json({ edition: updated });
});
