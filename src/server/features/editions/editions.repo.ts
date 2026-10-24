import { db, getEditionById, listEditions, getSettings, logAuditEvent } from '../../db.ts';
import type { NewspaperEdition } from '../../../shared/types.ts';
import { executeAndValidateMasterLayoutPlan } from '../../../engine/editor-renderer.ts';
import { articlesRepo } from '../articles/articles.repo.ts';

export const editionsRepo = {
  list(): NewspaperEdition[] {
    return listEditions();
  },

  getById(id: string): NewspaperEdition | null {
    return getEditionById(id);
  },

  updateMasterPlan(
    editionId: string,
    planModifier: (currentPlan: any) => any,
    actorId: string
  ): NewspaperEdition | null {
    const edition = getEditionById(editionId);
    if (!edition || !edition.masterPlan) return null;

    const modifiedPlan = planModifier(edition.masterPlan);
    const articles = articlesRepo.list();
    const settings = getSettings();
    const diagnostics = executeAndValidateMasterLayoutPlan({
      plan: modifiedPlan,
      articles,
      settings,
    });
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE newspaper_editions
       SET master_plan_json = ?,
           editor_diagnostics_json = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      JSON.stringify(modifiedPlan),
      JSON.stringify(diagnostics),
      now,
      editionId
    );

    logAuditEvent(actorId, 'edition', editionId, 'master_plan_modified', {
      planVersion: modifiedPlan.plan_version,
    });

    return getEditionById(editionId);
  },

  savePdfArtifact(
    editionId: string,
    pdfArtifact: {
      artifactId: string;
      storageFilename: string;
      pdfUrl: string;
      sizeBytes: number;
      pageCount: number;
      pdfHash: string;
      preflightPassed: boolean;
      masterPlanJson?: string;
      agenticReportJson?: string;
    }
  ): void {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO pdf_artifacts (
        id, edition_id, storage_key, public_url, file_size_bytes, page_count, sha256_hash, preflight_passed, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      pdfArtifact.artifactId,
      editionId,
      pdfArtifact.storageFilename,
      pdfArtifact.pdfUrl,
      pdfArtifact.sizeBytes,
      pdfArtifact.pageCount,
      pdfArtifact.pdfHash,
      pdfArtifact.preflightPassed ? 1 : 0,
      now
    );

    db.prepare(
      `UPDATE newspaper_editions
       SET actual_page_count = ?,
           pdf_artifact_id = ?,
           pdf_public_url = ?,
           master_plan_json = COALESCE(?, master_plan_json),
           agentic_pdf_report_json = COALESCE(?, agentic_pdf_report_json),
           updated_at = ?
       WHERE id = ?`
    ).run(
      pdfArtifact.pageCount,
      pdfArtifact.artifactId,
      pdfArtifact.pdfUrl,
      pdfArtifact.masterPlanJson || null,
      pdfArtifact.agenticReportJson || null,
      now,
      editionId
    );
  },
};
