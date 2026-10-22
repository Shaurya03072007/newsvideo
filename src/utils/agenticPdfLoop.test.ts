import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectPdfWithGemini31FlashLite,
  rewriteArchitectureWithGemini35FlashLite,
  buildDeterministicAgenticPdfReportFromHistory,
} from '../engine/agentic-pdf-loop.ts';
import { synthesizeArticleAdaptiveMasterPlan } from '../engine/designer-service.ts';
import { executeAndValidateMasterLayoutPlan } from '../engine/editor-renderer.ts';
import { computeInitialArticleMeasurementsForDesigner } from '../engine/typography-and-measurement.ts';
import { DEFAULT_PUBLICATION_SETTINGS } from './editorialLogic.ts';
import type { Article } from '../shared/types.ts';

const SAMPLE_ARTICLES: Article[] = [
  {
    id: 'art-test-1',
    reporterId: 'rep-1',
    idempotencyKey: 'idem-1',
    currentRevision: 1,
    originalHeadline: 'కృష్ణా డెల్టా ఆయకట్టుకు నీటి విడుదల',
    originalBodyTelugu:
      'విజయవాడ ప్రకాశం బ్యారేజీ నుండి కృష్ణా డెల్టా తూర్పు, పశ్చిమ కాలువలకు సాగునీటిని విడుదల చేశారు. దీనివల్ల 13 లక్షల ఎకరాలకు సాగునీరు అందుతుంది.',
    primaryHeadlineTelugu:
      'కృష్ణా డెల్టా ఆయకట్టుకు ప్రకాశం బ్యారేజీ నుండి సాగునీటి విడుదల ప్రారంభం',
    compactHeadlineTelugu: 'కృష్ణా డెల్టాకు సాగునీటి విడుదల',
    standfirstTelugu: '13.08 లక్షల ఎకరాల ఆయకట్టు రైతాంగానికి ఊరట',
    summaryTelugu: 'ప్రకాశం బ్యారేజీ నుండి కాలువలకు నీటి విడుదల.',
    aiBodyParagraphsFull: [
      'విజయవాడ ప్రకాశం బ్యారేజీ నుండి కృష్ణా డెల్టా తూర్పు, పశ్చిమ కాలువలకు సాగునీటిని విడుదల చేశారు.',
      'దీనివల్ల నాలుగు జిల్లాల పరిధిలోని 13.08 లక్షల ఎకరాలకు సాగునీరు అందుతుంది.',
    ],
    aiBodyParagraphsShort: [
      'విజయవాడ ప్రకాశం బ్యారేజీ నుండి కృష్ణా డెల్టా కాలువలకు సాగునీటిని విడుదల చేశారు.',
    ],
    suggestedCategory: 'Agriculture',
    assignedCategory: 'Agriculture',
    assignedCategoryTelugu: 'వ్యవసాయం',
    location: 'విజయవాడ',
    district: 'ఎన్టీఆర్ జిల్లా',
    eventDate: '2026-10-19',
    submissionTime: '2026-10-19T08:00:00Z',
    status: 'approved',
    priorityScore: 95,
    riskLevel: 'low',
    validationWarnings: [],
    classificationModelId: 'gemma-4-31b-it',
    storyModelId: 'gemini-3.5-flash-lite',
    promptVersion: 'v1.0',
    primaryAssetId: 'ast-1',
    assets: [
      {
        id: 'ast-1',
        articleId: 'art-test-1',
        originalFilename: 'dam.png',
        mimeType: 'image/png',
        fileSizeBytes: 12000,
        width: 800,
        height: 500,
        storageKeyOriginal: 'dam.png',
        storageKeyDerivative: 'dam.png',
        publicUrl: '/api/assets/file/dam.png',
        captionTelugu: 'ప్రకాశం బ్యారేజీ గేట్ల ద్వారా నీటి విడుదల',
        isPrimary: true,
        sha256Hash: 'abc',
        createdAt: '2026-10-19T08:00:00Z',
      },
    ],
    createdAt: '2026-10-19T08:00:00Z',
    updatedAt: '2026-10-19T08:00:00Z',
  },
];

test('gemini-3.1-flash-lite flags clipped PDF in Round 1, gemini-3.5-flash-lite rewrites architecture, and Round 2 is READY_FOR_USER', async () => {
  const measurements = computeInitialArticleMeasurementsForDesigner(SAMPLE_ARTICLES);
  const v1Plan = synthesizeArticleAdaptiveMasterPlan(
    {
      editionId: 'ed-test-agent',
      editionNumber: 101,
      editionDate: '2026-10-20',
      editionTitleTelugu: 'ప్రజా వాణి',
      targetPageCount: 1,
      articles: SAMPLE_ARTICLES,
      settings: DEFAULT_PUBLICATION_SETTINGS,
      editorMeasurements: measurements,
    },
    1
  );

  // Force a tight headline height on v1 so Round 1 has a genuine headline clipping defect
  const leadHeadline = v1Plan.pages[0].elements.find((e) => e.type === 'headline');
  assert.ok(leadHeadline, 'Lead headline element should exist');
  leadHeadline.geometry.height = 6;

  const v1Diag = executeAndValidateMasterLayoutPlan({
    plan: v1Plan,
    articles: SAMPLE_ARTICLES,
    settings: DEFAULT_PUBLICATION_SETTINGS,
  });
  assert.equal(v1Diag.status, 'layout_errors');

  const fakePdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

  // Round 1: Send PDF to gemini-3.1-flash-lite
  const r1Inspection = await inspectPdfWithGemini31FlashLite({
    roundNumber: 1,
    plan: v1Plan,
    diagnostics: v1Diag,
    pdfBytes: fakePdfBytes,
    settings: DEFAULT_PUBLICATION_SETTINGS,
  });

  assert.equal(r1Inspection.inspector_model_id, 'gemini-3.1-flash-lite');
  assert.equal(r1Inspection.verdict, 'NEEDS_ARCHITECTURAL_REWRITE');
  assert.equal(r1Inspection.approved_to_slide, false);
  assert.ok(r1Inspection.defects.length > 0);
  assert.ok(r1Inspection.architectural_directives_for_3_5_flash_lite.length > 0);

  // Send directives to gemini-3.5-flash-lite to rewrite the layout architecture
  const { rewrittenPlan, rewriteRecord } = await rewriteArchitectureWithGemini35FlashLite({
    roundNumber: 1,
    previousPlan: v1Plan,
    diagnostics: v1Diag,
    inspectionReport: r1Inspection,
    articles: SAMPLE_ARTICLES,
    settings: DEFAULT_PUBLICATION_SETTINGS,
  });

  assert.equal(rewriteRecord.architect_model_id, 'gemini-3.5-flash-lite');
  assert.equal(rewrittenPlan.plan_version, 2);
  assert.ok(rewriteRecord.architectural_changes_applied.length > 0);

  // Validate rewritten Plan v2 and send rebuilt PDF back to gemini-3.1-flash-lite
  const v2Diag = executeAndValidateMasterLayoutPlan({
    plan: rewrittenPlan,
    articles: SAMPLE_ARTICLES,
    settings: DEFAULT_PUBLICATION_SETTINGS,
  });
  assert.equal(v2Diag.status, 'valid');

  const r2Inspection = await inspectPdfWithGemini31FlashLite({
    roundNumber: 2,
    plan: rewrittenPlan,
    diagnostics: v2Diag,
    pdfBytes: fakePdfBytes,
    settings: DEFAULT_PUBLICATION_SETTINGS,
  });

  assert.equal(r2Inspection.verdict, 'READY_FOR_USER');
  assert.equal(r2Inspection.approved_to_slide, true);
  assert.equal(r2Inspection.defects.length, 0);

  // Verify deterministic report builder from history
  const fullReport = buildDeterministicAgenticPdfReportFromHistory(
    'ed-test-agent',
    [
      {
        plan_version: 1,
        master_plan: v1Plan,
        editor_diagnostics: v1Diag,
        created_at: new Date().toISOString(),
      },
      {
        plan_version: 2,
        master_plan: rewrittenPlan,
        editor_diagnostics: v2Diag,
        created_at: new Date().toISOString(),
      },
    ],
    rewrittenPlan,
    v2Diag
  );

  assert.equal(fullReport.final_verdict, 'READY_FOR_USER');
  assert.equal(fullReport.ready_for_user, true);
  assert.equal(fullReport.total_agent_rounds, 2);
});
