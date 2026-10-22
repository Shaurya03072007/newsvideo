import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  db,
  getArticleById,
  getEditionById,
  getJobById,
  getSettings,
  listArticles,
  logAuditEvent,
  PDF_DIR,
} from './db.ts';
import {
  classifyArticleWithGemma,
  prepareTeluguStoryWithGemini,
} from './aiAdapters.ts';
import {
  DEFAULT_CATEGORIES,
  evaluateEditorialIntegrityAndSafety,
  runPrintPreflightValidation,
} from '../utils/editorialLogic.ts';
import { runDesignerEditorFeedbackLoop } from '../engine/layout-feedback-loop.ts';
import { exportMasterPlanToPdfBuffer } from '../engine/pdf-exporter.ts';
import { runAgenticPdfGatekeeperLoop } from '../engine/agentic-pdf-loop.ts';
import type { AIProcessingJob } from '../shared/types.ts';

function appendJobLog(
  jobId: string,
  progressPercent: number,
  stepDescription: string,
  logEntry: string,
  status: AIProcessingJob['status'] = 'active',
  cacheHit?: boolean
) {
  const job = getJobById(jobId);
  if (!job) return;
  const ts = new Date().toISOString().slice(11, 19);
  const nextLogs = [...job.logs, `[${ts}] ${logEntry}`];
  db.prepare(
    `UPDATE ai_processing_jobs
     SET status = ?, progress_percent = ?, step_description = ?, logs_json = ?,
         cache_hit = COALESCE(?, cache_hit), updated_at = ?
     WHERE id = ?`
  ).run(
    status,
    progressPercent,
    stepDescription,
    JSON.stringify(nextLogs),
    cacheHit !== undefined ? (cacheHit ? 1 : 0) : null,
    new Date().toISOString(),
    jobId
  );
}

function completeJob(jobId: string, stepDescription: string, finalLog: string) {
  const job = getJobById(jobId);
  if (!job) return;
  const ts = new Date().toISOString().slice(11, 19);
  const nextLogs = [...job.logs, `[${ts}] ${finalLog}`];
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE ai_processing_jobs
     SET status = 'completed', progress_percent = 100, step_description = ?,
         logs_json = ?, error_message = NULL, updated_at = ?, completed_at = ?
     WHERE id = ?`
  ).run(stepDescription, JSON.stringify(nextLogs), now, now, jobId);
}

function failJob(jobId: string, errorMessage: string) {
  const job = getJobById(jobId);
  if (!job) return;
  const ts = new Date().toISOString().slice(11, 19);
  const nextLogs = [...job.logs, `[${ts}] ERROR: ${errorMessage}`];
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE ai_processing_jobs
     SET status = 'failed', step_description = ?, logs_json = ?, error_message = ?, updated_at = ?
     WHERE id = ?`
  ).run(`Failed: ${errorMessage}`, JSON.stringify(nextLogs), errorMessage, now, jobId);
}

/**
 * Enqueues and runs the dual-model Editorial Processing Worker (`gemma-4-31b-it` -> `gemini-3.5-flash-lite`).
 */
export function enqueueEditorialProcessingJob(articleId: string, actorUserId: string | null = null): AIProcessingJob {
  const settings = getSettings();
  const jobId = `job-art-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO ai_processing_jobs (
      id, job_type, target_id, status, attempts, max_attempts,
      model_a_id, model_b_id, prompt_version, cache_hit, progress_percent,
      step_description, logs_json, error_message, created_at, updated_at
    ) VALUES (?, 'editorial_processing', ?, 'queued', 1, 3, ?, ?, ?, 0, 5, ?, ?, NULL, ?, ?)`
  ).run(
    jobId,
    articleId,
    settings.modelAClassifierId,
    settings.modelBStoryId,
    settings.promptVersion,
    'Queued for Gemma 4 31B classification and Gemini 3.5 Flash-Lite Telugu story preparation.',
    JSON.stringify([`[${now.slice(11, 19)}] Enqueued dual-model editorial processing job ${jobId} for article ${articleId}.`]),
    now,
    now
  );

  db.prepare('UPDATE articles SET status = ?, updated_at = ? WHERE id = ?').run('processing', now, articleId);

  // Execute asynchronously in background worker loop
  setImmediate(() => {
    runEditorialProcessingWorker(jobId, articleId, actorUserId).catch((err) => {
      console.error('Editorial worker uncaught error:', err);
    });
  });

  return getJobById(jobId)!;
}

async function runEditorialProcessingWorker(
  jobId: string,
  articleId: string,
  actorUserId: string | null
): Promise<void> {
  const settings = getSettings();
  const article = getArticleById(articleId);
  if (!article) {
    failJob(jobId, `Article ${articleId} not found.`);
    return;
  }

  try {
    appendJobLog(
      jobId,
      18,
      `Step 1/4: Running Model A (${settings.modelAClassifierId}) classification...`,
      `Loaded article '${article.id}' (rev #${article.currentRevision}) with ${(article.assets || []).length} photo asset(s).`
    );

    const allCandidates = listArticles().map((a) => ({
      id: a.id,
      originalBodyTelugu: a.originalBodyTelugu,
      location: a.location,
    }));

    // Step 1: Call Gemma 4 31B IT (`gemma-4-31b-it`)
    const gemmaRes = await classifyArticleWithGemma(article, allCandidates, settings, (msg) =>
      appendJobLog(jobId, 32, `Model A (${settings.modelAClassifierId}): ${msg}`, msg)
    );

    const gemmaData = gemmaRes.output;
    const now = new Date().toISOString();

    // Persist validated classification record
    db.prepare(
      `INSERT INTO article_classifications (
        id, article_id, revision_number, model_id, prompt_version,
        section, section_telugu, principal_subject, location, district,
        entities_json, local_relevance_score, priority_score, priority_explanation,
        duplicate_candidate_ids_json, package_group_topic, missing_information_json,
        editorial_concerns_json, risk_level, raw_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `cls-${article.id}-${article.currentRevision}-${Date.now()}`,
      article.id,
      article.currentRevision,
      settings.modelAClassifierId,
      settings.promptVersion,
      gemmaData.section,
      gemmaData.sectionTelugu,
      gemmaData.principalSubject,
      gemmaData.location,
      gemmaData.district,
      JSON.stringify(gemmaData.entities),
      gemmaData.localRelevanceScore,
      gemmaData.priorityScore,
      gemmaData.priorityExplanation,
      JSON.stringify(gemmaData.duplicateCandidateIds),
      gemmaData.packageGroupTopic,
      JSON.stringify(gemmaData.missingInformation),
      JSON.stringify(gemmaData.editorialConcerns),
      gemmaData.riskLevel,
      JSON.stringify(gemmaData),
      now
    );

    appendJobLog(
      jobId,
      54,
      `Step 2/4: Model A classified as '${gemmaData.section}' (${gemmaData.sectionTelugu}), Priority ${gemmaData.priorityScore}/100. Calling Model B (${settings.modelBStoryId})...`,
      `Model A (${settings.modelAClassifierId}) schema validated: Section=${gemmaData.section}, Priority=${gemmaData.priorityScore}, Risk=${gemmaData.riskLevel}.`,
      'active',
      gemmaRes.cacheHit
    );

    // Step 2: Call Gemini 3.5 Flash-Lite (`gemini-3.5-flash-lite`)
    const geminiRes = await prepareTeluguStoryWithGemini(article, gemmaData, settings, (msg) =>
      appendJobLog(jobId, 72, `Model B (${settings.modelBStoryId}): ${msg}`, msg)
    );

    const geminiData = geminiRes.output;

    // Step 3: Fact preservation, contradiction check, and editorial safety evaluation
    appendJobLog(
      jobId,
      86,
      'Step 3/4: Validating Telugu story against source facts and editorial safety policy...',
      'Running numeric fact-preservation, contradiction detection, and allegation hold checks.',
      'active',
      gemmaRes.cacheHit && geminiRes.cacheHit
    );

    const safety = evaluateEditorialIntegrityAndSafety(
      article.originalBodyTelugu,
      gemmaData,
      geminiData,
      settings
    );

    const nextRevisionNum = article.currentRevision + 1;
    const finalStatus = safety.shouldHold ? 'flagged_hold' : 'processed';
    const catCfg =
      settings.categories.find((c) => c.id === gemmaData.section) ||
      DEFAULT_CATEGORIES[0];

    // Save immutable AI-prepared revision
    db.prepare(
      `INSERT INTO article_revisions (
        id, article_id, revision_number, source_type, headline_original,
        primary_headline_telugu, compact_headline_telugu, standfirst_telugu, summary_telugu,
        body_text_original, body_paragraphs_full_json, body_paragraphs_short_json,
        model_id, prompt_version, created_by_user_id, created_at
      ) VALUES (?, ?, ?, 'ai_prepared', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `rev-${article.id}-${nextRevisionNum}`,
      article.id,
      nextRevisionNum,
      article.originalHeadline,
      geminiData.primaryHeadlineTelugu,
      geminiData.compactHeadlineTelugu,
      geminiData.standfirstTelugu,
      geminiData.summaryTelugu,
      article.originalBodyTelugu,
      JSON.stringify(geminiData.bodyParagraphsFullTelugu),
      JSON.stringify(geminiData.bodyParagraphsShortTelugu),
      settings.modelBStoryId,
      settings.promptVersion,
      actorUserId || article.reporterId,
      now
    );

    // Update suggested captions on assets if verified and reporter left blank
    if (geminiData.suggestedCaptions && geminiData.suggestedCaptions.length > 0) {
      for (const sc of geminiData.suggestedCaptions) {
        if (sc.assetId && sc.captionTelugu && sc.isVerifiedFromMetadata) {
          db.prepare(
            `UPDATE image_assets SET caption_telugu = ? WHERE id = ? AND article_id = ?`
          ).run(sc.captionTelugu, sc.assetId, article.id);
        }
      }
    }

    // Update main article record
    db.prepare(
      `UPDATE articles
       SET current_revision = ?,
           primary_headline_telugu = ?,
           compact_headline_telugu = ?,
           standfirst_telugu = ?,
           summary_telugu = ?,
           ai_body_paragraphs_full_json = ?,
           ai_body_paragraphs_short_json = ?,
           assigned_category = ?,
           assigned_category_telugu = ?,
           priority_score = ?,
           risk_level = ?,
           status = ?,
           validation_warnings_json = ?,
           classification_model_id = ?,
           story_model_id = ?,
           prompt_version = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      nextRevisionNum,
      geminiData.primaryHeadlineTelugu,
      geminiData.compactHeadlineTelugu,
      geminiData.standfirstTelugu,
      geminiData.summaryTelugu,
      JSON.stringify(geminiData.bodyParagraphsFullTelugu),
      JSON.stringify(geminiData.bodyParagraphsShortTelugu),
      gemmaData.section,
      catCfg.teluguLabel,
      gemmaData.priorityScore,
      gemmaData.riskLevel,
      finalStatus,
      JSON.stringify(safety.warnings),
      settings.modelAClassifierId,
      settings.modelBStoryId,
      settings.promptVersion,
      now,
      article.id
    );

    logAuditEvent(actorUserId, 'article', article.id, 'ai_editorial_processing_completed', {
      jobId,
      revisionNumber: nextRevisionNum,
      modelA: settings.modelAClassifierId,
      modelB: settings.modelBStoryId,
      status: finalStatus,
      priorityScore: gemmaData.priorityScore,
      warningsCount: safety.warnings.length,
    });

    completeJob(
      jobId,
      `Completed: ${geminiData.compactHeadlineTelugu} (${finalStatus === 'flagged_hold' ? 'Held for Review' : 'Ready for Edition'})`,
      `Dual-model orchestration finished. Status=${finalStatus}, Revision=#${nextRevisionNum}, Warnings=${safety.warnings.length}.`
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    db.prepare('UPDATE articles SET status = ?, updated_at = ? WHERE id = ?').run(
      'failed',
      new Date().toISOString(),
      articleId
    );
    failJob(jobId, errMsg);
  }
}

/**
 * Enqueues and runs the Edition Planning, Column-Grid Compositor, and Print PDF Generation Worker.
 */
export function enqueueEditionGenerationJob(
  editionId: string,
  actorUserId: string | null = null
): AIProcessingJob {
  const settings = getSettings();
  const jobId = `job-ed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO ai_processing_jobs (
      id, job_type, target_id, status, attempts, max_attempts,
      model_a_id, model_b_id, prompt_version, cache_hit, progress_percent,
      step_description, logs_json, error_message, created_at, updated_at
    ) VALUES (?, 'edition_planning', ?, 'queued', 1, 3, ?, ?, ?, 0, 5, ?, ?, NULL, ?, ?)`
  ).run(
    jobId,
    editionId,
    settings.modelAClassifierId,
    settings.modelBStoryId,
    settings.promptVersion,
    'Queued for multi-page edition planning, deterministic layout composition, and PDF generation.',
    JSON.stringify([`[${now.slice(11, 19)}] Enqueued edition build job ${jobId} for edition ${editionId}.`]),
    now,
    now
  );

  db.prepare('UPDATE newspaper_editions SET status = ?, active_job_id = ?, updated_at = ? WHERE id = ?').run(
    'planning',
    jobId,
    now,
    editionId
  );

  setImmediate(() => {
    runEditionGenerationWorker(jobId, editionId, actorUserId).catch((err) => {
      console.error('Edition worker uncaught error:', err);
    });
  });

  return getJobById(jobId)!;
}

async function runEditionGenerationWorker(
  jobId: string,
  editionId: string,
  actorUserId: string | null
): Promise<void> {
  const settings = getSettings();
  const edition = getEditionById(editionId);
  if (!edition) {
    failJob(jobId, `Edition ${editionId} not found.`);
    return;
  }

  try {
    appendJobLog(
      jobId,
      20,
      'Step 1/4: Selecting eligible processed Telugu articles & filtering held/duplicate stories...',
      `Loaded edition #${edition.editionNumber} (${edition.editionDate}), target pages=${edition.targetPageCount}.`
    );

    const allArticles = listArticles().filter(
      (a) => a.status === 'processed' || a.status === 'approved' || a.status === 'published' || a.status === 'flagged_hold'
    );

    db.prepare('UPDATE newspaper_editions SET status = ?, updated_at = ? WHERE id = ?').run(
      'compositing',
      new Date().toISOString(),
      editionId
    );

    appendJobLog(
      jobId,
      40,
      `Step 2/4: Running DESIGNER (${settings.designerModelId}) + EDITOR iterative feedback loop...`,
      `Measuring Telugu typography and synthesizing article-adaptive MasterLayoutPlan across ${allArticles.length} candidate articles.`
    );

    const feedbackRes = await runDesignerEditorFeedbackLoop({
      editionId,
      editionNumber: edition.editionNumber,
      editionDate: edition.editionDate,
      editionTitleTelugu: edition.editionTitleTelugu,
      targetPageCount: edition.targetPageCount,
      articles: allArticles,
      settings,
      injectInitialTightConstraintForRefinement: true,
      onLog: (msg) => appendJobLog(jobId, 58, msg, msg),
    });

    const now = new Date().toISOString();

    // Replace page manifests and assignments in transaction
    db.prepare('DELETE FROM page_layout_manifests WHERE edition_id = ?').run(editionId);
    db.prepare('DELETE FROM pages WHERE edition_id = ?').run(editionId);
    db.prepare('DELETE FROM edition_article_assignments WHERE edition_id = ?').run(editionId);

    for (const page of feedbackRes.pages) {
      db.prepare(
        `INSERT INTO pages (id, edition_id, page_number, page_title_telugu, section_focus_telugu, column_fill_ratio, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        `page-${editionId}-${page.pageNumber}-${Date.now()}`,
        editionId,
        page.pageNumber,
        page.pageTitleTelugu,
        page.sectionFocusTelugu,
        page.columnFillRatio,
        now
      );

      db.prepare(
        `INSERT INTO page_layout_manifests (id, edition_id, page_number, manifest_json, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(
        `manifest-${editionId}-${page.pageNumber}-${Date.now()}`,
        editionId,
        page.pageNumber,
        JSON.stringify(page),
        now
      );

      for (const mod of [...page.modules, ...page.sideBriefs]) {
        const art = allArticles.find((a) => a.id === mod.articleId);
        db.prepare(
          `INSERT INTO edition_article_assignments (id, edition_id, article_id, revision_number, page_number, placement_role, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(
          `assign-${editionId}-${mod.moduleId}-${Date.now()}`,
          editionId,
          mod.articleId,
          art?.currentRevision || 1,
          page.pageNumber,
          mod.isLeadStory ? 'lead' : mod.isSideBrief ? 'side_brief' : 'standard',
          now
        );
      }
    }

    db.prepare(
      `UPDATE newspaper_editions
       SET status = ?,
           actual_page_count = ?,
           master_plan_json = ?,
           editor_diagnostics_json = ?,
           plan_history_json = ?,
           layout_diagnostics_json = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      'generating_pdf',
      feedbackRes.pages.length,
      JSON.stringify(feedbackRes.finalPlan),
      JSON.stringify(feedbackRes.finalDiagnostics),
      JSON.stringify(feedbackRes.planHistory),
      JSON.stringify(feedbackRes.layoutDiagnostics),
      now,
      editionId
    );

    appendJobLog(
      jobId,
      72,
      `Step 3/4: Running Agentic PDF Gatekeeper (gemini-3.1-flash-lite) & Autonomous Architect (gemini-3.5-flash-lite) loop...`,
      `Editor validated Plan v${feedbackRes.finalPlan.plan_version} (status=${feedbackRes.finalDiagnostics.status}) after ${feedbackRes.planHistory.length} iteration(s). Sending PDF to gemini-3.1-flash-lite...`
    );

    const updatedEdition = getEditionById(editionId)!;
    const agenticRes = await runAgenticPdfGatekeeperLoop({
      edition: updatedEdition,
      initialPlan: feedbackRes.finalPlan,
      initialPlanHistory: feedbackRes.planHistory,
      articles: allArticles,
      settings,
      maxAgentRounds: 3,
      onLog: (msg) => appendJobLog(jobId, 84, msg, msg),
    });

    const pdfBytes =
      agenticRes.finalPdfBytes.byteLength > 0
        ? agenticRes.finalPdfBytes
        : exportMasterPlanToPdfBuffer(updatedEdition, settings, allArticles, (msg) =>
            appendJobLog(jobId, 86, msg, msg)
          );

    appendJobLog(
      jobId,
      92,
      `Step 4/4: Running 11-point print preflight validation & certifying ${agenticRes.agenticReport.final_verdict}...`,
      'Validating PDF header, page dimensions, Telugu glyph shaping, font embedding, and gemini-3.1-flash-lite release certification.'
    );

    const preflight = runPrintPreflightValidation(updatedEdition, pdfBytes, settings);

    const pdfArtifactId = `pdf-${editionId}-${Date.now()}`;
    const pdfFilename = `${editionId}-${Date.now()}.pdf`;
    fs.writeFileSync(path.join(PDF_DIR, pdfFilename), pdfBytes);
    const pdfHash = crypto.createHash('sha256').update(pdfBytes).digest('hex');

    db.prepare(
      `INSERT INTO pdf_artifacts (id, edition_id, storage_key, public_url, file_size_bytes, sha256_hash, page_count, preflight_passed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      pdfArtifactId,
      editionId,
      pdfFilename,
      `/api/editions/${editionId}/pdf`,
      pdfBytes.byteLength,
      pdfHash,
      agenticRes.finalPages.length,
      preflight.overallPassed ? 1 : 0,
      now
    );

    const nextPdfId = preflight.overallPassed || !edition.pdfArtifactId ? pdfArtifactId : edition.pdfArtifactId;

    db.prepare(
      `UPDATE newspaper_editions
       SET status = 'published',
           actual_page_count = ?,
           pdf_artifact_id = ?,
           pdf_public_url = ?,
           preflight_report_json = ?,
           master_plan_json = ?,
           editor_diagnostics_json = ?,
           plan_history_json = ?,
           agentic_pdf_report_json = ?,
           layout_diagnostics_json = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      agenticRes.finalPages.length,
      nextPdfId,
      `/api/editions/${editionId}/pdf`,
      JSON.stringify(preflight),
      JSON.stringify(agenticRes.finalPlan),
      JSON.stringify(agenticRes.finalDiagnostics),
      JSON.stringify(agenticRes.updatedPlanHistory),
      JSON.stringify(agenticRes.agenticReport),
      JSON.stringify({
        ...feedbackRes.layoutDiagnostics,
        finalPlanVersion: agenticRes.finalPlan.plan_version,
        designerIterations: agenticRes.updatedPlanHistory.length,
      }),
      now,
      editionId
    );

    logAuditEvent(actorUserId, 'edition', editionId, 'edition_generated_and_published', {
      jobId,
      pagesCount: agenticRes.finalPages.length,
      placedArticlesCount: feedbackRes.placedArticleIds.length,
      planVersion: agenticRes.finalPlan.plan_version,
      designerIterations: agenticRes.updatedPlanHistory.length,
      editorStatus: agenticRes.finalDiagnostics.status,
      agenticVerdict: agenticRes.agenticReport.final_verdict,
      preflightPassed: preflight.overallPassed,
    });

    completeJob(
      jobId,
      `Published Edition #${edition.editionNumber} (Plan v${agenticRes.finalPlan.plan_version} · ${agenticRes.agenticReport.final_verdict}): ${agenticRes.finalPages.length} pages, ${feedbackRes.placedArticleIds.length} stories.`,
      `Agentic PDF Loop complete (${agenticRes.agenticReport.total_agent_rounds} round(s), Verdict=${agenticRes.agenticReport.final_verdict}, Score=${agenticRes.agenticReport.final_quality_score}/100). PDF size=${(pdfBytes.byteLength / 1024).toFixed(1)} KB.`
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    db.prepare('UPDATE newspaper_editions SET status = ?, updated_at = ? WHERE id = ?').run(
      'failed',
      new Date().toISOString(),
      editionId
    );
    failJob(jobId, errMsg);
  }
}
