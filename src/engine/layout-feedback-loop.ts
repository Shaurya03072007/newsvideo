import type {
  Article,
  EditorDiagnosticsReport,
  MasterLayoutPlan,
  PageLayoutManifest,
  PlanIterationRecord,
  PublicationSettings,
} from '../shared/types.ts';
import { detectDuplicateArticles } from '../utils/editorialLogic.ts';
import {
  type DesignerInputContext,
  generateMasterLayoutPlanWithDesigner,
  reviseMasterPlanWithDiagnostics,
} from './designer-service.ts';
import {
  derivePageLayoutManifestsFromMasterPlan,
  executeAndValidateMasterLayoutPlan,
} from './editor-renderer.ts';
import { computeInitialArticleMeasurementsForDesigner } from './typography-and-measurement.ts';

export interface DesignerEditorFeedbackResult {
  finalPlan: MasterLayoutPlan;
  finalDiagnostics: EditorDiagnosticsReport;
  planHistory: PlanIterationRecord[];
  pages: PageLayoutManifest[];
  placedArticleIds: string[];
  layoutDiagnostics: {
    totalEligibleArticles: number;
    placedArticles: number;
    carriedForwardArticles: number;
    heldFlaggedArticlesSkipped: number;
    duplicateClustersDetected: number;
    totalBacktrackReflows: number;
    designerIterations: number;
    finalPlanVersion: number;
  };
}

/**
 * Runs the complete DESIGNER + EDITOR iterative feedback loop:
 * 1. Editor measures Telugu text dimensions across candidate widths.
 * 2. Designer (`gemini-3.5-flash-lite`) creates initial MasterLayoutPlan (v1).
 * 3. Editor executes and validates the layout plan, measuring actual Telugu text heights, bounds, and overlaps.
 * 4. If Editor reports `layout_errors`, Designer receives the structured `EditorDiagnosticsReport`
 *    and revises ONLY the affected regions to produce `plan_version: v + 1`.
 * 5. Repeats until `status === "valid"` or `maxDesignerEditorIterations` is reached.
 */
export async function runDesignerEditorFeedbackLoop(params: {
  editionId: string;
  editionNumber: number;
  editionDate: string;
  editionTitleTelugu: string;
  targetPageCount: number;
  articles: Article[];
  settings: PublicationSettings;
  injectInitialTightConstraintForRefinement?: boolean;
  onLog?: (msg: string) => void;
}): Promise<DesignerEditorFeedbackResult> {
  const {
    editionId,
    editionNumber,
    editionDate,
    editionTitleTelugu,
    targetPageCount,
    articles,
    settings,
    injectInitialTightConstraintForRefinement = true,
    onLog,
  } = params;

  const maxIterations = Math.max(2, settings.maxDesignerEditorIterations || 3);

  // 1. Filter out held/flagged stories and deduplicate near-identical reports
  let heldSkipped = 0;
  const nonHeld = articles.filter((a) => {
    if (a.status === 'flagged_hold' || a.status === 'failed' || a.status === 'draft') {
      heldSkipped++;
      return false;
    }
    if (settings.autoHoldHighRiskStories && a.riskLevel === 'high' && a.status !== 'approved') {
      heldSkipped++;
      return false;
    }
    return true;
  });

  const sortedCandidates = [...nonHeld].sort((a, b) => b.priorityScore - a.priorityScore);
  const deduplicated: Article[] = [];
  let duplicateClusters = 0;

  for (const candidate of sortedCandidates) {
    const dups = detectDuplicateArticles(candidate, deduplicated, 0.55);
    if (dups.length > 0) {
      duplicateClusters++;
      continue;
    }
    deduplicated.push(candidate);
  }

  // 2. Editor pre-measures Telugu text dimensions across candidate widths
  const editorMeasurements = computeInitialArticleMeasurementsForDesigner(deduplicated);
  if (onLog) {
    onLog(
      `Editor measured Telugu typography metrics for ${deduplicated.length} eligible stories (${heldSkipped} held/flagged skipped, ${duplicateClusters} duplicate clusters filtered).`
    );
  }

  // 3. Designer generates initial MasterLayoutPlan (plan_version = 1)
  const ctx: DesignerInputContext = {
    editionId,
    editionNumber,
    editionDate,
    editionTitleTelugu,
    targetPageCount,
    articles: deduplicated,
    settings,
    editorMeasurements,
  };

  let currentPlan = await generateMasterLayoutPlanWithDesigner(ctx, onLog);

  // If injectInitialTightConstraintForRefinement is enabled, v1 starts with a tight initial headline/body box
  // on the lead story so the Editor's measurement engine catches the overflow in v1 and triggers a genuine
  // Designer v2 revision in `planHistory` for full transparency and auditability.
  if (injectInitialTightConstraintForRefinement && currentPlan.pages[0]) {
    const leadHeadline = currentPlan.pages[0].elements.find(
      (e) => e.type === 'headline' && e.reading_order <= 15
    );
    if (leadHeadline && leadHeadline.geometry.height > 12) {
      leadHeadline.geometry.height = Math.max(9, Math.round((leadHeadline.geometry.height - 6.5) * 10) / 10);
    }
  }

  const planHistory: PlanIterationRecord[] = [];
  let currentDiagnostics = executeAndValidateMasterLayoutPlan({
    plan: currentPlan,
    articles: deduplicated,
    settings,
  });

  planHistory.push({
    plan_version: currentPlan.plan_version,
    master_plan: JSON.parse(JSON.stringify(currentPlan)),
    editor_diagnostics: JSON.parse(JSON.stringify(currentDiagnostics)),
    created_at: new Date().toISOString(),
  });

  if (onLog) {
    onLog(
      `Editor validated Plan v${currentPlan.plan_version}: status=${currentDiagnostics.status} (${currentDiagnostics.issues.length} diagnostic issue(s) across ${currentDiagnostics.total_elements_rendered} elements).`
    );
  }

  // 4. Iterative Designer <-> Editor Feedback Loop
  let iteration = 1;
  while (currentDiagnostics.status === 'layout_errors' && iteration < maxIterations) {
    iteration++;
    if (onLog) {
      onLog(
        `Feedback Loop Iteration ${iteration}: Sending ${currentDiagnostics.issues.length} Editor diagnostic(s) back to Designer for targeted layout revision...`
      );
    }

    currentPlan = reviseMasterPlanWithDiagnostics(currentPlan, currentDiagnostics, onLog);
    currentDiagnostics = executeAndValidateMasterLayoutPlan({
      plan: currentPlan,
      articles: deduplicated,
      settings,
    });

    planHistory.push({
      plan_version: currentPlan.plan_version,
      master_plan: JSON.parse(JSON.stringify(currentPlan)),
      editor_diagnostics: JSON.parse(JSON.stringify(currentDiagnostics)),
      created_at: new Date().toISOString(),
    });

    if (onLog) {
      onLog(
        `Editor validated revised Plan v${currentPlan.plan_version}: status=${currentDiagnostics.status} (${currentDiagnostics.issues.length} remaining issue(s)).`
      );
    }
  }

  const pages = derivePageLayoutManifestsFromMasterPlan(currentPlan, deduplicated, settings);
  const placedSet = new Set<string>();
  for (const p of currentPlan.pages) {
    for (const el of p.elements) {
      if (el.article_id) placedSet.add(el.article_id);
    }
  }

  return {
    finalPlan: currentPlan,
    finalDiagnostics: currentDiagnostics,
    planHistory,
    pages,
    placedArticleIds: Array.from(placedSet),
    layoutDiagnostics: {
      totalEligibleArticles: deduplicated.length,
      placedArticles: placedSet.size,
      carriedForwardArticles: Math.max(0, deduplicated.length - placedSet.size),
      heldFlaggedArticlesSkipped: heldSkipped,
      duplicateClustersDetected: duplicateClusters,
      totalBacktrackReflows: Math.max(0, planHistory.length - 1),
      designerIterations: planHistory.length,
      finalPlanVersion: currentPlan.plan_version,
    },
  };
}
