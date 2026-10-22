import test from 'node:test';
import assert from 'node:assert/strict';
import {
  containsTeluguUnicode,
  countTeluguSyllables,
  validateImageBinary,
  validateGemmaClassificationSchema,
  validateGeminiStorySchema,
  evaluateEditorialIntegrityAndSafety,
  detectDuplicateArticles,
  composeNewspaperEditionLayout,
  runPrintPreflightValidation,
  DEFAULT_PUBLICATION_SETTINGS,
} from './editorialLogic.ts';
import { createEditorialPngBuffer } from './pngGenerator.ts';
import { validateMasterLayoutPlan } from '../engine/layout-plan-schema.ts';
import { executeAndValidateMasterLayoutPlan } from '../engine/editor-renderer.ts';
import { runDesignerEditorFeedbackLoop } from '../engine/layout-feedback-loop.ts';
import {
  computeShapedElementEffectiveAreaMm2,
  GEOMETRIC_SHAPE_CATALOG,
  selectDesignerGeometricShapeForArticle,
} from '../engine/geometric-shapes.ts';
import type { Article, NewspaperEdition } from '../shared/types.ts';

test('Unicode Telugu detection and syllable counting work accurately on representative Telugu news text', () => {
  const teluguHeadline = 'ప్రకాశం బ్యారేజీ నుంచి కృష్ణా డెల్టా కాలువలకు నీటి విడుదల';
  assert.equal(containsTeluguUnicode(teluguHeadline), true);
  assert.equal(containsTeluguUnicode('Only English ASCII Text'), false);
  const syllables = countTeluguSyllables(teluguHeadline);
  assert.ok(syllables >= 15 && syllables <= 35, `Expected realistic syllable count, got ${syllables}`);
});

test('Binary image validation decodes real PNG dimensions and rejects undersized or corrupted files', () => {
  const validPng = createEditorialPngBuffer(320, 200, 'dam_water');
  const res = validateImageBinary(validPng, 5 * 1024 * 1024, 240, 160);
  assert.equal(res.valid, true);
  assert.equal(res.mimeType, 'image/png');
  assert.equal(res.width, 320);
  assert.equal(res.height, 200);

  // Reject undersized PNG
  const smallPng = createEditorialPngBuffer(100, 80, 'paddy_harvest');
  const smallRes = validateImageBinary(smallPng, 5 * 1024 * 1024, 240, 160);
  assert.equal(smallRes.valid, false);
  assert.match(smallRes.error || '', /below minimum print requirement/);

  // Reject fake extension / non-image bytes
  const fakeBytes = new TextEncoder().encode('This is not a real image file even if named photo.jpg');
  const fakeRes = validateImageBinary(fakeBytes);
  assert.equal(fakeRes.valid, false);
});

test('Gemma 4 31B and Gemini 3.5 Flash-Lite schema validators enforce required fields and Telugu script', () => {
  const gemmaValid = validateGemmaClassificationSchema({
    section: 'Agriculture',
    sectionTelugu: 'వ్యవసాయం',
    principalSubject: 'గుంటూరు జిల్లాలో ధాన్యం కొనుగోలు కేంద్రాల ప్రారంభం',
    location: 'గుంటూరు',
    district: 'గుంటూరు',
    entities: ['రైతు భరోసా కేంద్రం', 'జిల్లా కలెక్టర్'],
    localRelevanceScore: 92,
    priorityScore: 88,
    priorityExplanation: 'High impact for district farmers during harvest season.',
    duplicateCandidateIds: [],
    packageGroupTopic: 'ధాన్యం సేకరణ',
    missingInformation: ['exact procurement tonnage target'],
    editorialConcerns: [],
    riskLevel: 'low',
    hasSeriousAllegations: false,
    hasUnverifiedClaims: false,
  });
  assert.equal(gemmaValid.valid, true);
  assert.equal(gemmaValid.data?.section, 'Agriculture');

  const geminiValid = validateGeminiStorySchema({
    primaryHeadlineTelugu: 'గుంటూరు జిల్లాలో నేటి నుంచే ధాన్యం కొనుగోలు కేంద్రాలు ప్రారంభం',
    compactHeadlineTelugu: 'నేటి నుంచే ధాన్యం కొనుగోళ్లు',
    standfirstTelugu: 'మద్దతు ధర రూ. 2,300 చెల్లించేలా ఏర్పాట్లు పూర్తి చేసిన అధికారులు',
    summaryTelugu: 'గుంటూరు జిల్లాలో రైతుల సౌకర్యార్థం ధాన్యం కొనుగోలు కేంద్రాలను ప్రారంభించారు.',
    bodyParagraphsFullTelugu: [
      'గుంటూరు: జిల్లాలోని రైతులకు మద్దతు ధర కల్పించేందుకు ప్రభుత్వం నేటి నుంచి ధాన్యం కొనుగోలు కేంద్రాలను ప్రారంభించింది. క్వింటాల్‌కు రూ. 2,300 మద్దతు ధర అందిస్తామని అధికారులు తెలిపారు.',
      'రైతులు దళారులను ఆశ్రయించకుండా నేరుగా కొనుగోలు కేంద్రాల ద్వారా తమ పంటను విక్రయించుకోవాలని సూచించారు.',
    ],
    bodyParagraphsShortTelugu: [
      'గుంటూరు: జిల్లాలో క్వింటాల్‌కు రూ. 2,300 మద్దతు ధరతో ధాన్యం కొనుగోలు కేంద్రాలను అధికారులు ప్రారంభించారు.',
    ],
    suggestedCaptions: [
      { assetId: 'asset-1', captionTelugu: 'గుంటూరులో ధాన్యం నిల్వలను పరిశీలిస్తున్న అధికారులు', isVerifiedFromMetadata: true },
    ],
    preservedEntities: ['గుంటూరు'],
    preservedNumbersAndDates: ['2300'],
    contradictionFlags: [],
    missingFactsExplicitNote: null,
  });
  assert.equal(geminiValid.valid, true);

  // Evaluate editorial integrity: original has 2,300 -> no fabricated numbers
  const originalReport = 'గుంటూరు జిల్లాలో నేటి నుంచి ధాన్యం కొనుగోలు కేంద్రాలు ప్రారంభమయ్యాయి. క్వింటాల్‌కు రూ. 2,300 మద్దతు ధర లభిస్తుంది.';
  const safetyClean = evaluateEditorialIntegrityAndSafety(originalReport, gemmaValid.data!, geminiValid.data!);
  assert.equal(safetyClean.shouldHold, false);

  // Now test fabricated statistic detection (AI invents 95,000 not in source)
  const fabricatedGemini = {
    ...geminiValid.data!,
    bodyParagraphsFullTelugu: [
      'గుంటూరు: జిల్లాలో 95,000 టన్నుల ధాన్యం సేకరించారు మరియు రూ. 2,300 ధర చెల్లించారు.',
    ],
  };
  const safetyFlagged = evaluateEditorialIntegrityAndSafety(originalReport, gemmaValid.data!, fabricatedGemini);
  assert.equal(safetyFlagged.shouldHold, true);
  assert.ok(safetyFlagged.warnings.some((w) => w.code === 'UNSUPPORTED_NUMERIC_CLAIM'));
});

test('Duplicate detection and multi-page deterministic newspaper compositor handle long content, missing photos, and held stories', async () => {
  const baseArticle = (overrides: Partial<Article>): Article => ({
    id: 'art-1',
    reporterId: 'rep-1',
    idempotencyKey: 'idem-1',
    currentRevision: 2,
    originalHeadline: 'ప్రకాశం బ్యారేజీ నుంచి నీటి విడుదల',
    originalBodyTelugu: 'విజయవాడ ప్రకాశం బ్యారేజీ నుంచి కృష్ణా డెల్టా కాలువలకు నీటిని విడుదల చేశారు.',
    primaryHeadlineTelugu: 'ప్రకాశం బ్యారేజీ నుంచి కృష్ణా డెల్టాకు సాగునీటి విడుదల',
    compactHeadlineTelugu: 'కృష్ణా డెల్టాకు నీటి విడుదల',
    standfirstTelugu: 'ఖరీఫ్ సాగు అవసరాల కోసం కాలువలకు నీటిని వదిలిన జలవనరుల శాఖ',
    summaryTelugu: 'విజయవాడ ప్రకాశం బ్యారేజీ నుంచి సాగునీటిని విడుదల చేశారు.',
    aiBodyParagraphsFull: [
      'విజయవాడ: కృష్ణా డెల్టా పరిధిలోని నాలుగు జిల్లాల రైతుల ఖరీఫ్ సాగు అవసరాల కోసం ప్రకాశం బ్యారేజీ నుంచి కాలువలకు నీటిని విడుదల చేశారు.',
      'తూర్పు, పశ్చిమ ప్రధాన కాలువల ద్వారా రోజుకు 4,500 క్యూసెక్కుల నీటిని విడుదల చేస్తున్నట్లు జలవనరుల శాఖ ఇంజనీర్లు వెల్లడించారు.',
      'చివరి ఆయకట్టు వరకు సాగునీరు అందేలా ప్రత్యేక పర్యవేక్షణ బృందాలను ఏర్పాటు చేశారు.',
    ],
    aiBodyParagraphsShort: [
      'విజయవాడ: కృష్ణా డెల్టా రైతుల కోసం ప్రకాశం బ్యారేజీ నుంచి రోజుకు 4,500 క్యూసెక్కుల నీటిని కాలువలకు విడుదల చేశారు.',
    ],
    suggestedCategory: 'Agriculture',
    assignedCategory: 'Agriculture',
    assignedCategoryTelugu: 'వ్యవసాయం',
    location: 'విజయవాడ',
    district: 'ఎన్టీఆర్ జిల్లా',
    eventDate: '2026-10-19',
    submissionTime: '2026-10-19T06:00:00Z',
    status: 'processed',
    priorityScore: 95,
    riskLevel: 'low',
    validationWarnings: [],
    classificationModelId: 'gemma-4-31b-it',
    storyModelId: 'gemini-3.5-flash-lite',
    promptVersion: 'v2.4-telugu-broadsheet',
    primaryAssetId: null,
    assets: [],
    createdAt: '2026-10-19T06:00:00Z',
    updatedAt: '2026-10-19T06:05:00Z',
    ...overrides,
  });

  const leadStory = baseArticle({ id: 'art-lead', priorityScore: 96 });
  const duplicateOfLead = baseArticle({
    id: 'art-dup',
    priorityScore: 80,
    originalBodyTelugu: 'విజయవాడ ప్రకాశం బ్యారేజీ నుంచి కృష్ణా డెల్టా కాలువలకు నీటిని విడుదల చేశారు.',
  });
  const heldStory = baseArticle({
    id: 'art-held',
    status: 'flagged_hold',
    riskLevel: 'high',
    originalBodyTelugu: 'ఇది తీవ్రమైన ఆరోపణలతో కూడిన నిలిపివేసిన వార్త.',
  });
  const longEducationStory = baseArticle({
    id: 'art-edu',
    assignedCategory: 'Education',
    assignedCategoryTelugu: 'విద్య - ఉపాధి',
    location: 'విశాఖపట్నం',
    priorityScore: 85,
    originalBodyTelugu: 'విశాఖపట్నంలో ప్రభుత్వ పాఠశాలల్లో డిజిటల్ తరగతి గదుల ప్రారంభం.',
    primaryHeadlineTelugu: 'ప్రభుత్వ పాఠశాలల్లో ఆధునిక డిజిటల్ తరగతి గదుల ప్రారంభం',
    compactHeadlineTelugu: 'పాఠశాలల్లో డిజిటల్ తరగతులు',
    aiBodyParagraphsFull: new Array(6).fill(
      'విశాఖపట్నం: జిల్లాలోని ప్రభుత్వ ఉన్నత పాఠశాలల్లో విద్యార్థులకు ఆధునిక సాంకేతిక విద్యను అందించేందుకు డిజిటల్ తరగతి గదులను ప్రారంభించారు.'
    ),
  });
  const announcementBrief = baseArticle({
    id: 'art-brief',
    assignedCategory: 'Announcements',
    assignedCategoryTelugu: 'ప్రకటనలు - సమాచారం',
    location: 'తిరుపతి',
    priorityScore: 55,
    originalBodyTelugu: 'తిరుపతిలో రేపు విద్యుత్ సరఫరాలో అంతరాయం ఏర్పడనుంది.',
    primaryHeadlineTelugu: 'తిరుపతిలో రేపు విద్యుత్ మరమ్మతుల కారణంగా సరఫరా నిలిపివేత',
    compactHeadlineTelugu: 'రేపు విద్యుత్ అంతరాయం',
  });

  const composed = composeNewspaperEditionLayout(
    [leadStory, duplicateOfLead, heldStory, longEducationStory, announcementBrief],
    DEFAULT_PUBLICATION_SETTINGS,
    2
  );

  // Verify held story was skipped and duplicate was filtered out
  assert.equal(composed.heldSkippedCount, 1);
  assert.equal(composed.duplicateClustersCount, 1);
  assert.ok(composed.placedArticleIds.includes('art-lead'));
  assert.ok(composed.placedArticleIds.includes('art-edu'));
  assert.ok(composed.placedArticleIds.includes('art-brief'));
  assert.ok(!composed.placedArticleIds.includes('art-held'));
  assert.ok(!composed.placedArticleIds.includes('art-dup'));

  // Verify preflight check passes when given a valid %PDF-1.4 header
  const mockPdfBytes = new TextEncoder().encode('%PDF-1.4\n1 0 obj << /Type /Catalog /Font << /F1 2 0 R >> >> endobj\n' + 'A'.repeat(1200) + '\n%%EOF');
  const edition: NewspaperEdition = {
    id: 'ed-test-1',
    editionNumber: 1,
    editionDate: '2026-10-19',
    editionTitleTelugu: 'ప్రజా వాణి — ఉదయం సంచిక',
    mastheadTitleTelugu: 'ప్రజా వాణి',
    mastheadSubtitleTelugu: 'తెలుగు దినపత్రిక',
    targetPageCount: 2,
    actualPageCount: composed.pages.length,
    pageWidthMm: 330,
    pageHeightMm: 520,
    columnsPerPage: 6,
    gutterMm: 4,
    status: 'published',
    activeJobId: null,
    articleIds: composed.placedArticleIds,
    pages: composed.pages,
    pdfArtifactId: 'pdf-1',
    pdfPublicUrl: '/api/editions/ed-test-1/pdf',
    preflightReport: null,
    layoutDiagnostics: {
      totalEligibleArticles: 3,
      placedArticles: composed.placedArticleIds.length,
      carriedForwardArticles: 0,
      heldFlaggedArticlesSkipped: composed.heldSkippedCount,
      duplicateClustersDetected: composed.duplicateClustersCount,
      totalBacktrackReflows: composed.totalBacktrackReflows,
    },
    createdAt: '2026-10-19T06:10:00Z',
    updatedAt: '2026-10-19T06:10:00Z',
  };

  const preflight = runPrintPreflightValidation(edition, mockPdfBytes, DEFAULT_PUBLICATION_SETTINGS);
  assert.equal(preflight.overallPassed, true);

  // Test DESIGNER + EDITOR MasterLayoutPlan schema validation & iterative feedback loop
  const loopRes = await runDesignerEditorFeedbackLoop({
    editionId: 'ed-designer-editor-test',
    editionNumber: 201,
    editionDate: '2026-10-19',
    editionTitleTelugu: 'ప్రజా వాణి — డిజైనర్ + ఎడిటర్ పరీక్ష సంచిక',
    targetPageCount: 2,
    articles: [leadStory, duplicateOfLead, heldStory, longEducationStory, announcementBrief],
    settings: DEFAULT_PUBLICATION_SETTINGS,
    injectInitialTightConstraintForRefinement: true,
  });

  // Verify Plan v1 had layout_errors caught by Editor, and Plan v2 resolved them to status === 'valid'
  assert.ok(loopRes.planHistory.length >= 2, 'Expected at least 2 iterations in planHistory (v1 -> v2)');
  assert.equal(loopRes.planHistory[0].plan_version, 1);
  assert.equal(loopRes.planHistory[0].editor_diagnostics.status, 'layout_errors');
  assert.equal(loopRes.finalPlan.plan_version, 2);
  assert.equal(loopRes.finalDiagnostics.status, 'valid');
  assert.equal(loopRes.finalDiagnostics.issues.length, 0);

  // Verify formal schema validation on final MasterLayoutPlan
  const schemaCheck = validateMasterLayoutPlan(loopRes.finalPlan);
  assert.equal(schemaCheck.valid, true, `Schema errors: ${schemaCheck.errors.join(', ')}`);

  // Verify Editor re-validation confirms 0 errors
  const recheck = executeAndValidateMasterLayoutPlan({
    plan: loopRes.finalPlan,
    articles: [leadStory, longEducationStory, announcementBrief],
    settings: DEFAULT_PUBLICATION_SETTINGS,
  });
  assert.equal(recheck.status, 'valid');

  // Verify non-rectangular geometric shapes (circle, semi_circle_arch, quarter_circle_wedge, tomb_arch, rhombus_diamond, pentagon_shield, hexagon_gem, star_burst)
  const circleArea = computeShapedElementEffectiveAreaMm2(
    100,
    100,
    GEOMETRIC_SHAPE_CATALOG.circle
  );
  assert.equal(circleArea.boundingBoxAreaMm2, 10000);
  assert.equal(circleArea.occupiedShapeAreaMm2, 7850);
  assert.equal(circleArea.reclaimedTextWrapAreaMm2, 2150);

  const diamondArea = computeShapedElementEffectiveAreaMm2(
    100,
    100,
    GEOMETRIC_SHAPE_CATALOG.rhombus_diamond
  );
  assert.equal(diamondArea.occupiedShapeAreaMm2, 5000);
  assert.equal(diamondArea.reclaimedTextWrapAreaMm2, 5000);

  const eduShape = selectDesignerGeometricShapeForArticle(longEducationStory, 1, 2, false);
  assert.equal(eduShape.shape_type, 'circle');
  assert.ok(eduShape.clip_path_css.includes('circle'));
  assert.ok(eduShape.shape_outside_css.includes('circle'));

  // Verify elements in the synthesized MasterLayoutPlan carry geometric_shape specifications
  const p1Containers = loopRes.finalPlan.pages[0].elements.filter(
    (el) => el.type === 'article_container'
  );
  assert.ok(p1Containers.length >= 2);
  assert.ok(p1Containers[0].style?.geometric_shape?.shape_type);
});
