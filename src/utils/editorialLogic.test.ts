import test from 'node:test';
import assert from 'node:assert/strict';
import {
  containsTeluguUnicode,
  countTeluguSyllables,
  extractNumericTokens,
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
import {
  derivePageLayoutManifestsFromMasterPlan,
  executeAndValidateMasterLayoutPlan,
} from '../engine/editor-renderer.ts';
import { synthesizeArticleAdaptiveMasterPlan } from '../engine/designer-service.ts';
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

test('English reporter submissions with strict Telugu output: numeric fact preservation, schema verification, and broadsheet typesetting', () => {
  // 1. Verify numeric token extraction normalizes both English ASCII digits and Telugu numerals
  const englishNumericText = 'Government sanctioned 25 health centres with Rs 1.5 crore each on 24 October 2026.';
  const teluguNumericText = 'ప్రభుత్వం ౨౫ ఆరోగ్య కేంద్రాలకు రూ. ౧.౫ కోట్లు కేటాయించింది (౨౪ అక్టోబర్ ౨౦౨౬).';
  const tokensEnglish = extractNumericTokens(englishNumericText);
  const tokensTelugu = extractNumericTokens(teluguNumericText);

  assert.deepEqual(tokensEnglish.sort(), ['1.5', '2026', '24', '25']);
  assert.deepEqual(tokensTelugu.sort(), ['1.5', '2026', '24', '25']);

  // 2. English submission correctly evaluates with pure Telugu Gemini output
  const englishSubmission = 'The State Cabinet approved 25 new primary health centres across coastal districts. Health department allocated Rs 1.5 crore for each centre to modernize medical equipment.';
  assert.equal(containsTeluguUnicode(englishSubmission), false, 'Source submission is in English');

  const gemmaMetadata = validateGemmaClassificationSchema({
    section: 'Health',
    sectionTelugu: 'ఆరోగ్యం',
    principalSubject: 'తీర ప్రాంత జిల్లాల్లో 25 కొత్త ఆరోగ్య కేంద్రాల ఏర్పాటు',
    location: 'విజయవాడ',
    district: 'ఎన్టీఆర్ జిల్లా',
    entities: ['వైద్యారోగ్య శాఖ', 'తీర ప్రాంత జిల్లాలు'],
    localRelevanceScore: 90,
    priorityScore: 85,
    priorityExplanation: 'Public healthcare infrastructure expansion across coastal districts.',
    duplicateCandidateIds: [],
    packageGroupTopic: null,
    missingInformation: [],
    editorialConcerns: [],
    riskLevel: 'low',
    hasSeriousAllegations: false,
    hasUnverifiedClaims: false,
  });
  assert.equal(gemmaMetadata.valid, true);

  // Gemini output MUST BE strictly in Telugu
  const teluguOutput = validateGeminiStorySchema({
    primaryHeadlineTelugu: 'తీర ప్రాంత జిల్లాల్లో 25 నూతన ప్రాథమిక ఆరోగ్య కేంద్రాలు',
    compactHeadlineTelugu: '25 కొత్త ఆరోగ్య కేంద్రాలు',
    standfirstTelugu: 'ఒక్కో కేంద్రానికి రూ. 1.5 కోట్ల నిధులు · ఆధునిక వైద్య పరికరాలు',
    summaryTelugu: 'తీర ప్రాంత జిల్లాల్లో 25 కొత్త ప్రాథమిక ఆరోగ్య కేంద్రాల ఏర్పాటుకు ప్రభుత్వం పరిపాలనా అనుమతి ఇచ్చింది.',
    bodyParagraphsFullTelugu: [
      'విజయవాడ: తీర ప్రాంత జిల్లాల్లో ప్రజారోగ్య రంగాన్ని పటిష్టం చేసేందుకు 25 నూతన ప్రాథమిక ఆరోగ్య కేంద్రాల (పీహెచ్‌సీ) ఏర్పాటుకు ప్రభుత్వం పరిపాలనా అనుమతులు మంజూరు చేసింది.',
      'వైద్య పరికరాలు, మౌలిక వసతుల ఆధునికీకరణ కోసం ఒక్కో కేంద్రానికి రూ. 1.5 కోట్ల నిధులను కేటాయించినట్లు అధికారులు వెల్లడించారు.',
    ],
    bodyParagraphsShortTelugu: [
      'విజయవాడ: తీర ప్రాంత జిల్లాల్లో ఒక్కో కేంద్రానికి రూ. 1.5 కోట్లతో 25 కొత్త ప్రాథమిక ఆరోగ్య కేంద్రాలను ప్రభుత్వం ఏర్పాటు చేస్తోంది.',
    ],
    suggestedCaptions: [
      { assetId: 'photo-1', captionTelugu: 'విజయవాడలో ప్రాథమిక ఆరోగ్య కేంద్రం నిర్మాణ పనుల పరిశీలన', isVerifiedFromMetadata: true },
    ],
    preservedEntities: ['విజయవాడ', 'ఆరోగ్య శాఖ'],
    preservedNumbersAndDates: ['25', '1.5'],
    contradictionFlags: [],
    missingFactsExplicitNote: null,
  });

  assert.equal(teluguOutput.valid, true);
  assert.equal(containsTeluguUnicode(teluguOutput.data!.primaryHeadlineTelugu), true);
  assert.equal(containsTeluguUnicode(teluguOutput.data!.bodyParagraphsFullTelugu.join(' ')), true);

  // 3. Safety evaluation preserves numbers between English source and Telugu output
  const safety = evaluateEditorialIntegrityAndSafety(englishSubmission, gemmaMetadata.data!, teluguOutput.data!);
  assert.equal(safety.shouldHold, false);
  assert.equal(safety.warnings.length, 0);

  // 4. Fabricated statistics in Telugu output from English source trigger hold
  const fabricatedOutput = {
    ...teluguOutput.data!,
    bodyParagraphsFullTelugu: [
      'విజయవాడ: తీర ప్రాంతంలో 950 నూతన ఆసుపత్రులు నిర్మించి రూ. 480 కోట్లు కేటాయించారు.',
    ],
  };
  const fabricatedSafety = evaluateEditorialIntegrityAndSafety(englishSubmission, gemmaMetadata.data!, fabricatedOutput);
  assert.equal(fabricatedSafety.shouldHold, true);
  assert.ok(fabricatedSafety.warnings.some((w) => w.code === 'UNSUPPORTED_NUMERIC_CLAIM'));

  // 5. Broadsheet compositor handles English article and produces 100% Telugu module output
  const englishArticle: Article = {
    id: 'art-english-test',
    currentRevision: 2,
    reporterId: 'rep-vijayawada',
    location: 'విజయవాడ',
    district: 'ఎన్టీఆర్ జిల్లా',
    eventDate: '2026-10-23',
    submissionTime: '2026-10-23T10:00:00Z',
    originalHeadline: 'Government sanctions 25 new primary health centres',
    originalBodyTelugu: englishSubmission,
    primaryHeadlineTelugu: teluguOutput.data!.primaryHeadlineTelugu,
    compactHeadlineTelugu: teluguOutput.data!.compactHeadlineTelugu,
    standfirstTelugu: teluguOutput.data!.standfirstTelugu,
    summaryTelugu: teluguOutput.data!.summaryTelugu,
    aiBodyParagraphsFull: teluguOutput.data!.bodyParagraphsFullTelugu,
    aiBodyParagraphsShort: teluguOutput.data!.bodyParagraphsShortTelugu,
    suggestedCategory: 'Health',
    assignedCategory: 'Health',
    assignedCategoryTelugu: 'ఆరోగ్యం',
    priorityScore: 88,
    riskLevel: 'low',
    status: 'processed',
    assets: [],
    validationWarnings: [],
    idempotencyKey: 'idem-art-english-test',
    classificationModelId: 'gemma-4-31b-it',
    storyModelId: 'gemini-3.5-flash-lite',
    promptVersion: 'v2.4-telugu-broadsheet',
    primaryAssetId: null,
    createdAt: '2026-10-23T10:00:00Z',
    updatedAt: '2026-10-23T10:00:00Z',
  };

  const composed = composeNewspaperEditionLayout([englishArticle], DEFAULT_PUBLICATION_SETTINGS, 1);
  assert.equal(composed.pages.length, 1);
  const p1Mods = composed.pages[0].modules;
  assert.ok(p1Mods.length >= 1);
  assert.equal(containsTeluguUnicode(p1Mods[0].headlineTextTelugu), true);
  assert.ok(p1Mods[0].bodyParagraphsTelugu.every(containsTeluguUnicode));
});

test('Sacred Lead Story Guarantee: Page 1 main canvas is never empty even with 3 low-priority no-photo articles, and Page 2 is populated with Editorial', () => {
  const threeArticles: Article[] = [
    {
      id: 'art-traffic-rules',
      currentRevision: 1,
      reporterId: 'rep-nellore',
      location: 'నెల్లూరు',
      district: 'నెల్లూరు జిల్లా',
      eventDate: '2026-10-15',
      submissionTime: '2026-10-15T09:00:00Z',
      originalHeadline: 'nellre traffic police strict rules',
      originalBodyTelugu: 'నెల్లూరులో ట్రాఫిక్ పోలీసులు కొత్త నిబంధనలు అమల్లోకి తెచ్చారు. రాంగ్ రూట్ డ్రైవింగ్ చేసే వారిపై కేసులు నమోదు చేస్తారు.',
      primaryHeadlineTelugu: 'నెల్లూరులో ట్రాఫిక్ పోలీసుల కఠిన నిబంధనలు',
      compactHeadlineTelugu: 'నెల్లూరు: ట్రాఫిక్ కఠిన నిబంధనలు',
      standfirstTelugu: 'నిబంధనలు ఉల్లంఘిస్తే వాహనాలు సీజ్ చేస్తామని హెచ్చరిక.',
      summaryTelugu: 'ట్రాఫిక్ నిబంధనల అమలు.',
      aiBodyParagraphsFull: [
        'నెల్లూరు: నగరంలో ట్రాఫిక్ రద్దీని నియంత్రించేందుకు మరియు ప్రమాదాల నివారణకు నెల్లూరు ట్రాఫిక్ పోలీసులు కఠిన నిబంధనలను అమల్లోకి తెచ్చారు.',
        'హెల్మెట్ లేకుండా ప్రయాణించే వారికి మరియు ట్రిపుల్ రైడింగ్ చేసేవారిపై కఠినమైన జరిమానాలు విధించనున్నారు.',
      ],
      aiBodyParagraphsShort: ['నెల్లూరు ట్రాఫిక్ పోలీసుల కఠిన నిబంధనలు అమలులోకి వచ్చాయి.'],
      suggestedCategory: 'Public services',
      assignedCategory: 'Public services',
      assignedCategoryTelugu: 'ప్రజా సేవలు',
      priorityScore: 60,
      riskLevel: 'low',
      status: 'processed',
      assets: [],
      validationWarnings: [],
      idempotencyKey: 'idem-traffic-1',
      classificationModelId: 'gemma-4-31b-it',
      storyModelId: 'gemini-3.5-flash-lite',
      promptVersion: 'v2.4-telugu-broadsheet',
      primaryAssetId: null,
      createdAt: '2026-10-15T09:00:00Z',
      updatedAt: '2026-10-15T09:00:00Z',
    },
    {
      id: 'art-cricket-cup',
      currentRevision: 1,
      reporterId: 'rep-sports',
      location: 'హైదరాబాద్',
      district: 'హైదరాబాద్',
      eventDate: '2026-10-15',
      submissionTime: '2026-10-15T10:00:00Z',
      originalHeadline: 'cricket worl cup',
      originalBodyTelugu: 'ప్రపంచకప్ క్రికెట్ పోటీలలో భారత జట్టు అద్భుత ప్రదర్శన కనబరిచింది.',
      primaryHeadlineTelugu: 'ప్రపంచకప్‌లో భారత్ ఘన విజయం',
      compactHeadlineTelugu: 'భారత్ ఘన విజయం',
      standfirstTelugu: 'కీలక మ్యాచ్‌లో ఆస్ట్రేలియాపై ఘన విజయం సాధించిన భారత్.',
      summaryTelugu: 'క్రికెట్ ప్రపంచకప్ విజయం.',
      aiBodyParagraphsFull: [
        'హైదరాబాద్: అంతర్జాతీయ క్రికెట్ ప్రపంచకప్‌లో భారత జట్టు అద్భుతమైన ఆటతీరుతో మరో విజయాన్ని తన ఖాతాలో వేసుకుంది.',
      ],
      aiBodyParagraphsShort: ['ప్రపంచకప్‌లో భారత జట్టు ఘన విజయం సాధించింది.'],
      suggestedCategory: 'Sports',
      assignedCategory: 'Sports',
      assignedCategoryTelugu: 'క్రీడలు',
      priorityScore: 30,
      riskLevel: 'low',
      status: 'processed',
      assets: [],
      validationWarnings: [],
      idempotencyKey: 'idem-cricket-1',
      classificationModelId: 'gemma-4-31b-it',
      storyModelId: 'gemini-3.5-flash-lite',
      promptVersion: 'v2.4-telugu-broadsheet',
      primaryAssetId: null,
      createdAt: '2026-10-15T10:00:00Z',
      updatedAt: '2026-10-15T10:00:00Z',
    },
    {
      id: 'art-telugu-cinema',
      currentRevision: 1,
      reporterId: 'rep-cinema',
      location: 'నెల్లూరు',
      district: 'నెల్లూరు జిల్లా',
      eventDate: '2026-10-15',
      submissionTime: '2026-10-15T11:00:00Z',
      originalHeadline: 'about telugu cinema',
      originalBodyTelugu: 'తెలుగు సినిమా రంగం గురించి నెల్లూరులో ప్రత్యేక సదస్సు జరిగింది.',
      primaryHeadlineTelugu: 'తెలుగు సినిమా విశేషాలపై నెల్లూరులో చర్చ',
      compactHeadlineTelugu: 'తెలుగు సినిమా విశేషాలు',
      standfirstTelugu: 'సినీ రంగ ప్రముఖులు హాజరై పలు అంశాలపై చర్చించారు.',
      summaryTelugu: 'తెలుగు సినిమా సదస్సు.',
      aiBodyParagraphsFull: [
        'నెల్లూరు: తెలుగు సినీ రంగంలో వస్తున్న సాంకేతిక మార్పులు, కథాంశాల ప్రాధాన్యతపై నెల్లూరు కళాభారతి ఆవరణలో ప్రత్యేక సదస్సు నిర్వహించారు.',
      ],
      aiBodyParagraphsShort: ['తెలుగు సినీ రంగంపై నెల్లూరులో ప్రత్యేక చర్చా వేదిక.'],
      suggestedCategory: 'Culture and festivals',
      assignedCategory: 'Culture and festivals',
      assignedCategoryTelugu: 'సంస్కృతి & కళలు',
      priorityScore: 5,
      riskLevel: 'low',
      status: 'processed',
      assets: [],
      validationWarnings: [],
      idempotencyKey: 'idem-cinema-1',
      classificationModelId: 'gemma-4-31b-it',
      storyModelId: 'gemini-3.5-flash-lite',
      promptVersion: 'v2.4-telugu-broadsheet',
      primaryAssetId: null,
      createdAt: '2026-10-15T11:00:00Z',
      updatedAt: '2026-10-15T11:00:00Z',
    },
  ];

  // 1. Test deterministic composition
  const composed = composeNewspaperEditionLayout(threeArticles, DEFAULT_PUBLICATION_SETTINGS, 2);
  assert.equal(composed.pages.length, 2);
  // Page 1 MUST have main modules (never 0!)
  assert.ok(composed.pages[0].modules.length >= 2, `Expected Page 1 modules >= 2, got ${composed.pages[0].modules.length}`);
  // Page 1 Lead story must be present
  assert.equal(composed.pages[0].modules[0].isLeadStory, true);
  assert.equal(composed.pages[0].modules[0].articleId, 'art-traffic-rules');
  // Page 2 must have the 3rd story
  assert.ok(composed.pages[1].modules.length >= 1, `Expected Page 2 modules >= 1, got ${composed.pages[1].modules.length}`);

  // 2. Test Designer Master Plan Synthesis
  const plan = synthesizeArticleAdaptiveMasterPlan({
    editionId: 'ed-test-106',
    editionNumber: 106,
    editionDate: '2026-10-15',
    editionTitleTelugu: 'ప్రజా వాణి దినపత్రిక',
    targetPageCount: 2,
    articles: threeArticles,
    settings: DEFAULT_PUBLICATION_SETTINGS,
  });
  assert.equal(plan.pages.length, 2);

  // Derive manifests from master plan
  const derivedManifests = derivePageLayoutManifestsFromMasterPlan(plan, threeArticles, DEFAULT_PUBLICATION_SETTINGS);
  assert.equal(derivedManifests.length, 2);

  const p1 = derivedManifests[0];
  const p2 = derivedManifests[1];

  // Page 1 MUST NOT BE BLANK: modules must contain Lead Story and Secondary Story!
  assert.ok(p1.modules.length >= 2, `Page 1 modules must have at least 2 stories, got ${p1.modules.length}`);
  assert.equal(p1.modules[0].isLeadStory, true);
  assert.equal(p1.modules[0].articleId, 'art-traffic-rules');
  assert.equal(p1.modules[1].articleId, 'art-cricket-cup');

  // Page 2 MUST NOT BE BLANK: modules must contain Page 2 Lead, Editorial Column, and Cultural/Roundup!
  assert.ok(p2.modules.length >= 2, `Page 2 modules must be well-populated, got ${p2.modules.length}`);
  const hasEditorial = p2.modules.some((m) => m.moduleId.includes('editorial'));
  assert.equal(hasEditorial, true, 'Page 2 must include the Chief Editor Column to eliminate empty space');
});


