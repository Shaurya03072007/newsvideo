import type {
  Article,
  EditorDiagnosticIssue,
  EditorDiagnosticsReport,
  LayoutModule,
  MasterLayoutPagePlan,
  MasterLayoutPlan,
  PageLayoutManifest,
  PlanElement,
  PublicationSettings,
} from '../shared/types.ts';
import { DEFAULT_CATEGORIES } from '../utils/editorialLogic.ts';
import {
  measureTeluguTextBlockMm,
  resolveElementTeluguText,
} from './typography-and-measurement.ts';
import { selectDesignerGeometricShapeForArticle } from './geometric-shapes.ts';
import { getAutonomousBureauFallbackStories } from './designer-service.ts';

/**
 * Checks whether two axis-aligned rectangles in mm intersect by more than `epsilonMm`.
 */
export function rectanglesOverlapMm(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  epsilonMm = 0.6
): boolean {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return overlapX > epsilonMm && overlapY > epsilonMm;
}

/**
 * COMPONENT 2: EDITOR — THE HANDS
 * Executes and validates the Designer's `MasterLayoutPlan` deterministically.
 * Measures every Telugu text block, checks physical bounds, verifies font size minimums,
 * checks image asset availability, checks caption attachment, and detects unintended overlaps.
 */
export function executeAndValidateMasterLayoutPlan(params: {
  plan: MasterLayoutPlan;
  articles: Article[];
  settings: PublicationSettings;
  domMeasuredHeightsMm?: Record<string, { widthMm: number; heightMm: number }>;
}): EditorDiagnosticsReport {
  const { plan, articles, settings, domMeasuredHeightsMm } = params;
  const articlesMap = new Map(articles.map((a) => [a.id, a]));

  const issues: EditorDiagnosticIssue[] = [];
  const elementMeasurements: EditorDiagnosticsReport['element_measurements'] = {};
  let totalElementsRendered = 0;

  for (const page of plan.pages) {
    const pageMargin = page.margin_mm ?? settings.marginMm ?? 10;
    const minX = pageMargin - 1.5;
    const minY = pageMargin - 1.5;
    const maxX = page.width - pageMargin + 1.5;
    const maxY = page.height - pageMargin + 1.5;

    for (const el of page.elements) {
      totalElementsRendered++;
      const { x, y, width, height } = el.geometry;

      // 1. Measure Telugu text elements (headline, standfirst, body_text, caption, section_kicker, callout_box)
      let measuredWidthMm = width;
      let measuredHeightMm = height;

      if (
        el.type === 'headline' ||
        el.type === 'standfirst' ||
        el.type === 'body_text' ||
        el.type === 'caption' ||
        el.type === 'section_kicker'
      ) {
        const resolved = resolveElementTeluguText(el, articlesMap);
        const fontFamily = el.typography?.font_family || 'Noto Serif Telugu';
        const fontSizePt = el.typography?.font_size_pt || 10;
        const fontWeight = el.typography?.font_weight || 400;
        const lineHeight = el.typography?.line_height || 1.45;
        const columns = el.text_flow?.columns || 1;
        const columnGapMm = el.text_flow?.column_gap_mm ?? 3.5;
        const paddingMm = el.style?.padding_mm ?? 0.8;

        const calc = measureTeluguTextBlockMm({
          paragraphs: resolved.paragraphs,
          allocatedWidthMm: width,
          fontFamily,
          fontSizePt,
          fontWeight,
          lineHeight,
          columns,
          columnGapMm,
          paddingMm,
          hasContinuationNote: Boolean(el.text_flow?.continuation_note_telugu),
        });

        measuredWidthMm = calc.requiredWidthMm;
        measuredHeightMm = calc.requiredHeightMm;

        // If browser/Chromium DOM measurements were supplied for this element_id, take the stricter of the two
        const domMeas = domMeasuredHeightsMm?.[el.element_id];
        if (domMeas) {
          measuredWidthMm = Math.max(measuredWidthMm, domMeas.widthMm);
          measuredHeightMm = Math.max(measuredHeightMm, domMeas.heightMm);
        }

        // Check text overflow (tolerance 1.2mm)
        if (measuredHeightMm > height + 1.2) {
          issues.push({
            element_id: el.element_id,
            page_number: page.page_number,
            article_id: el.article_id,
            type: 'text_overflow',
            severity: 'error',
            required_width_mm: measuredWidthMm,
            allocated_width_mm: width,
            required_height_mm: measuredHeightMm,
            allocated_height_mm: height,
            allowed_actions: el.constraints.permitted_actions,
            message: `Element '${el.element_id}' (${el.type}) requires ${measuredHeightMm.toFixed(1)}mm height for Telugu text but was allocated ${height.toFixed(1)}mm.`,
          });
        }

        // Check minimum font size constraint
        const minAllowedPt =
          el.type === 'headline'
            ? Math.max(settings.minHeadlineFontSizePt, el.constraints.minimum_font_size_pt)
            : el.type === 'body_text'
            ? Math.max(settings.minBodyFontSizePt, el.constraints.minimum_font_size_pt)
            : el.constraints.minimum_font_size_pt;

        if (fontSizePt < minAllowedPt - 0.1) {
          issues.push({
            element_id: el.element_id,
            page_number: page.page_number,
            article_id: el.article_id,
            type: 'font_below_minimum',
            severity: 'error',
            required_width_mm: width,
            allocated_width_mm: width,
            required_height_mm: height,
            allocated_height_mm: height,
            allowed_actions: el.constraints.permitted_actions,
            message: `Element '${el.element_id}' font size (${fontSizePt}pt) is below minimum threshold (${minAllowedPt}pt).`,
          });
        }
      }

      // 2. Check photograph asset integrity & caption attachment
      if (el.type === 'photograph') {
        const art = el.article_id ? articlesMap.get(el.article_id) : undefined;
        const asset =
          art?.assets?.find((a) => a.id === el.asset_id) ||
          (art?.assets && art.assets.length > 0 ? art.assets[0] : null);

        if (!asset) {
          issues.push({
            element_id: el.element_id,
            page_number: page.page_number,
            article_id: el.article_id,
            type: 'missing_asset',
            severity: 'error',
            required_width_mm: width,
            allocated_width_mm: width,
            required_height_mm: height,
            allocated_height_mm: height,
            allowed_actions: el.constraints.permitted_actions,
            message: `Photograph element '${el.element_id}' references missing asset '${el.asset_id}'.`,
          });
        }

        if (el.image_fit?.associated_caption_element_id) {
          const capEl = page.elements.find(
            (c) => c.element_id === el.image_fit?.associated_caption_element_id
          );
          if (capEl) {
            const verticalGap = Math.abs(capEl.geometry.y - (y + height));
            if (verticalGap > 5) {
              issues.push({
                element_id: capEl.element_id,
                page_number: page.page_number,
                article_id: el.article_id,
                type: 'caption_detached',
                severity: 'warning',
                required_width_mm: width,
                allocated_width_mm: capEl.geometry.width,
                required_height_mm: capEl.geometry.height,
                allocated_height_mm: capEl.geometry.height,
                allowed_actions: capEl.constraints.permitted_actions,
                message: `Caption '${capEl.element_id}' is detached from photograph '${el.element_id}' by ${verticalGap.toFixed(1)}mm.`,
              });
            }
          }
        }
      }

      // 3. Check page boundary out_of_bounds
      if (x < minX || y < minY || x + width > maxX || y + height > maxY) {
        issues.push({
          element_id: el.element_id,
          page_number: page.page_number,
          article_id: el.article_id,
          type: 'out_of_bounds',
          severity: 'error',
          required_width_mm: width,
          allocated_width_mm: Math.max(10, page.width - pageMargin - x),
          required_height_mm: height,
          allocated_height_mm: Math.max(10, page.height - pageMargin - y),
          allowed_actions: el.constraints.permitted_actions,
          message: `Element '${el.element_id}' extends outside printable page boundaries (${x.toFixed(1)}, ${y.toFixed(1)}, ${width.toFixed(1)}x${height.toFixed(1)}mm on ${page.width}x${page.height}mm page).`,
        });
      }

      const overflowMm = Math.max(0, Math.round((measuredHeightMm - height) * 10) / 10);
      elementMeasurements[el.element_id] = {
        allocated_width_mm: width,
        allocated_height_mm: height,
        measured_width_mm: measuredWidthMm,
        measured_height_mm: measuredHeightMm,
        overflow_mm: overflowMm,
      };
    }

    // 4. Pairwise unintended element overlap detection on the page
    for (let i = 0; i < page.elements.length; i++) {
      const a = page.elements[i];
      if (a.style?.is_container || a.type === 'article_container' || a.type === 'divider') {
        continue;
      }
      for (let j = i + 1; j < page.elements.length; j++) {
        const b = page.elements[j];
        if (b.style?.is_container || b.type === 'article_container' || b.type === 'divider') {
          continue;
        }

        const explicitlyAllowed =
          a.constraints.allow_overlap_with_element_ids?.includes(b.element_id) ||
          b.constraints.allow_overlap_with_element_ids?.includes(a.element_id);

        if (!explicitlyAllowed && rectanglesOverlapMm(a.geometry, b.geometry, 0.8)) {
          issues.push({
            element_id: b.element_id,
            page_number: page.page_number,
            article_id: b.article_id,
            type: 'element_overlap',
            severity: 'error',
            required_width_mm: b.geometry.width,
            allocated_width_mm: b.geometry.width,
            required_height_mm: b.geometry.height,
            allocated_height_mm: b.geometry.height,
            overlapping_element_id: a.element_id,
            allowed_actions: b.constraints.permitted_actions,
            message: `Element '${b.element_id}' overlaps with '${a.element_id}' on Page ${page.page_number}.`,
          });
        }
      }
    }
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  return {
    edition_id: plan.edition_id,
    plan_version: plan.plan_version,
    status: hasErrors ? 'layout_errors' : 'valid',
    measured_at: new Date().toISOString(),
    total_elements_rendered: totalElementsRendered,
    element_measurements: elementMeasurements,
    issues,
  };
}

/**
 * Derives `PageLayoutManifest[]` from the validated `MasterLayoutPlan` so that
 * edition summary cards, article placement tables, and legacy telemetry stay 100% synchronized.
 */
export function derivePageLayoutManifestsFromMasterPlan(
  plan: MasterLayoutPlan,
  articles: Article[],
  settings: PublicationSettings
): PageLayoutManifest[] {
  const fallbackStories = getAutonomousBureauFallbackStories();
  const articlesMap = new Map([
    ...fallbackStories.map((a) => [a.id, a] as [string, Article]),
    ...articles.map((a) => [a.id, a] as [string, Article]),
  ]);

  return plan.pages.map((page: MasterLayoutPagePlan) => {
    const containers = page.elements.filter((e) => e.type === 'article_container' && e.article_id);
    const modules: LayoutModule[] = [];
    const sideBriefs: LayoutModule[] = [];

    containers.forEach((cont, idx) => {
      const art = cont.article_id ? articlesMap.get(cont.article_id) : undefined;

      const colWidthApprox = (page.width - 2 * page.margin_mm) / (page.reference_columns || 6);
      const gridColStart = Math.max(
        1,
        Math.min(
          page.reference_columns || 6,
          Math.round((cont.geometry.x - page.margin_mm) / colWidthApprox) + 1
        )
      );
      const gridColSpan = Math.max(
        1,
        Math.min(page.reference_columns || 6, Math.round(cont.geometry.width / colWidthApprox))
      );

      if (cont.element_id.includes('editorial')) {
        const mod: LayoutModule = {
          moduleId: cont.element_id,
          articleId: 'art-editorial-chief',
          pageNumber: page.page_number,
          gridColumnStart: gridColStart,
          gridColumnSpan: gridColSpan,
          rowOrder: idx + 1,
          verticalPositionMm: cont.geometry.y,
          measuredHeightMm: cont.geometry.height,
          moduleWidthMm: cont.geometry.width,
          isLeadStory: false,
          isSideBrief: false,
          sectionCategory: 'Editorials and opinion',
          sectionLabelTelugu: 'సంపాదకీయం',
          sectionColorHex: '#991B1B',
          locationDatelineTelugu: 'హైదరాబాద్ / అమరావతి',
          headlineVariant: 'primary',
          headlineTextTelugu: 'సంపాదకీయం: ప్రజాస్వామ్య విలువల పరిరక్షణే లక్ష్యంగా సమగ్ర ప్రజా ప్రగతి',
          standfirstTextTelugu: 'గ్రామీణ ప్రాంతాల ఆర్థిక పరిపుష్టి, నిరుద్యోగ నిర్మూలన మరియు సుపరిపాలన దిశగా వ్యవస్థాగత మార్పులు నేటి అత్యవసర కర్తవ్యం.',
          bodyVariant: 'full',
          bodyParagraphsTelugu: [
            'సమకాలీన సమాజంలో ప్రజా సంక్షేమం మరియు సుస్థిర ఆర్థికాభివృద్ధి పరస్పర పూరకాలుగా ముందుకు సాగాల్సిన సమయమిది. గ్రామీణ ఆర్థిక వ్యవస్థను పటిష్టం చేయకుండా, క్షేత్రస్థాయి రైతాంగానికి నికరమైన ఆదాయ భరోసా కల్పించకుండా ఏ రాష్ట్రమూ సమగ్ర అభివృద్ధిని సాధించలేదు.',
            'మౌలిక సదుపాయాల కల్పన, నాణ్యమైన విద్య, వైద్యం సమాజంలోని అట్టడుగు వర్గాలకు సైతం సమానంగా చేరువ కావాలి. సంక్షేమ పథకాలు కేవలం తాత్కాలిక ఊరటకే పరిమితం కాకుండా, దీర్ఘకాలిక మానవ వనరుల వికాసానికి, నైపుణ్యాభివృద్ధికి దోహదపడాలి.',
            'ప్రజాస్వామ్యంలో పౌరుల విశ్వాసమే పరిపాలనకు అసలైన బలం. బాధ్యతాయుతమైన పత్రికారంగం ఎల్లప్పుడూ ప్రజా సమస్యలను నిర్భయంగా వెలుగులోకి తీసుకురావడంతో పాటు, నిర్మాణాత్మక పరిష్కారాల దిశగా సమాజాన్ని నడిపించాలి.',
          ],
          continuationNoteTelugu: null,
          photographAssetId: null,
          photographUrl: null,
          photographCaptionTelugu: null,
          photographAspectRatio: null,
          headlineFontSizePt: 17,
          bodyFontSizePt: 10,
          lineHeightRatio: 1.5,
          overflowStatus: 'fit',
        };
        modules.push(mod);
        return;
      }

      if (cont.element_id.includes('analysis')) {
        const mod: LayoutModule = {
          moduleId: cont.element_id,
          articleId: 'art-special-analysis',
          pageNumber: page.page_number,
          gridColumnStart: gridColStart,
          gridColumnSpan: gridColSpan,
          rowOrder: idx + 1,
          verticalPositionMm: cont.geometry.y,
          measuredHeightMm: cont.geometry.height,
          moduleWidthMm: cont.geometry.width,
          isLeadStory: false,
          isSideBrief: false,
          sectionCategory: 'Business',
          sectionLabelTelugu: 'ప్రత్యేక విశ్లేషణ',
          sectionColorHex: '#065F46',
          locationDatelineTelugu: 'విశ్లేషణ విభాగం',
          headlineVariant: 'primary',
          headlineTextTelugu: 'ఈనాటి ప్రత్యేక విశ్లేషణ: పారిశ్రామికాభివృద్ధి - ఉపాధి విప్లవానికి సరికొత్త దారులు',
          standfirstTextTelugu: 'రాష్ట్రంలో పెట్టుబడుల వరద, నూతన పరిశ్రమల స్థాపనతో స్థానిక యువతకు విస్తృత ఉద్యోగావకాశాలు.',
          bodyVariant: 'full',
          bodyParagraphsTelugu: [
            'రాష్ట్రంలో పారిశ్రామిక పురోగతి సరికొత్త వేగాన్ని పుంజుకుంటోంది. గ్లోబల్ ఇన్వెస్ట్‌మెంట్ సదస్సుల ద్వారా కుదిరిన ఒప్పందాలు కేవలం కాగితాలకే పరిమితం కాకుండా, క్షేత్రస్థాయిలో ఉపాధి అవకాశాలుగా రూపాంతరం చెందుతున్నాయి.',
            'ఐటీ, మెడ్-టెక్, మరియు ఎలక్ట్రానిక్స్ తయారీ రంగాల్లో వస్తున్న నూతన పరిశ్రమలు గ్రామీణ, పట్టణ ప్రాంతాల మధ్య ఉన్న ఆర్థిక అసమానతలను తగ్గించడంలో కీలక పాత్ర పోషిస్తున్నాయి. నైపుణ్యాభివృద్ధి శిక్షణ ద్వారా స్థానిక యువతను పరిశ్రమల అవసరాలకు అనుగుణంగా తీర్చిదిద్దుతున్నారు.',
          ],
          continuationNoteTelugu: null,
          photographAssetId: null,
          photographUrl: null,
          photographCaptionTelugu: null,
          photographAspectRatio: null,
          headlineFontSizePt: 16,
          bodyFontSizePt: 9.8,
          lineHeightRatio: 1.48,
          overflowStatus: 'fit',
        };
        modules.push(mod);
        return;
      }

      if (cont.element_id.includes('cultural')) {
        const mod: LayoutModule = {
          moduleId: cont.element_id,
          articleId: 'art-cultural-diary',
          pageNumber: page.page_number,
          gridColumnStart: 1,
          gridColumnSpan: page.reference_columns || 6,
          rowOrder: idx + 1,
          verticalPositionMm: cont.geometry.y,
          measuredHeightMm: cont.geometry.height,
          moduleWidthMm: cont.geometry.width,
          isLeadStory: false,
          isSideBrief: false,
          sectionCategory: 'Culture and festivals',
          sectionLabelTelugu: 'సాంస్కృతిక విశేషాలు',
          sectionColorHex: '#B45309',
          locationDatelineTelugu: 'సాంస్కృతిక విభాగం',
          headlineVariant: 'primary',
          headlineTextTelugu: 'ఆంధ్రప్రదేశ్ సాంస్కృతిక & జిల్లా డైరీ — ప్రాంతీయ విశేషాలు',
          standfirstTextTelugu: null,
          bodyVariant: 'full',
          bodyParagraphsTelugu: ['విజయవాడ, తిరుపతి, రాజమహేంద్రవరం, విశాఖపట్నం కళలు, సంస్కృతి విశేషాలు.'],
          continuationNoteTelugu: null,
          photographAssetId: null,
          photographUrl: null,
          photographCaptionTelugu: null,
          photographAspectRatio: null,
          headlineFontSizePt: 14,
          bodyFontSizePt: 9.8,
          lineHeightRatio: 1.3,
          overflowStatus: 'fit',
        };
        modules.push(mod);
        return;
      }

      if (cont.element_id.includes('roundup')) {
        const mod: LayoutModule = {
          moduleId: cont.element_id,
          articleId: 'art-state-roundup',
          pageNumber: page.page_number,
          gridColumnStart: 1,
          gridColumnSpan: page.reference_columns || 6,
          rowOrder: idx + 1,
          verticalPositionMm: cont.geometry.y,
          measuredHeightMm: cont.geometry.height,
          moduleWidthMm: cont.geometry.width,
          isLeadStory: false,
          isSideBrief: false,
          sectionCategory: 'State news',
          sectionLabelTelugu: 'రాష్ట్ర రౌండప్',
          sectionColorHex: '#991B1B',
          locationDatelineTelugu: 'రాష్ట్ర బ్యూరో',
          headlineVariant: 'primary',
          headlineTextTelugu: 'రాష్ట్ర సమగ్ర వార్తా సమాహారం · ప్రాంతీయ అభివృద్ధి విశేషాలు',
          standfirstTextTelugu: null,
          bodyVariant: 'full',
          bodyParagraphsTelugu: ['తిరుపతి, వరంగల్, గన్నవరం, విజయవాడ ప్రాంతీయ సమగ్ర వార్తలు.'],
          continuationNoteTelugu: null,
          photographAssetId: null,
          photographUrl: null,
          photographCaptionTelugu: null,
          photographAspectRatio: null,
          headlineFontSizePt: 14,
          bodyFontSizePt: 9.8,
          lineHeightRatio: 1.3,
          overflowStatus: 'fit',
        };
        modules.push(mod);
        return;
      }

      if (!art) return;

      const catCfg =
        settings.categories.find((c) => c.id === art.assignedCategory) || DEFAULT_CATEGORIES[0];
      const childEls = page.elements.filter(
        (e) => e.article_id === art.id && e.type !== 'article_container'
      );
      const hlEl = childEls.find((e) => e.type === 'headline');
      const sfEl = childEls.find((e) => e.type === 'standfirst');
      const bodyEl = childEls.find((e) => e.type === 'body_text');
      const photoEl = childEls.find((e) => e.type === 'photograph');
      const capEl = childEls.find((e) => e.type === 'caption');

      const hlResolved = hlEl
        ? resolveElementTeluguText(hlEl, articlesMap).text
        : art.primaryHeadlineTelugu || art.originalHeadline || '';
      const sfResolved = sfEl ? resolveElementTeluguText(sfEl, articlesMap).text : null;
      const bodyResolved = bodyEl
        ? resolveElementTeluguText(bodyEl, articlesMap).paragraphs
        : art.aiBodyParagraphsFull;
      const capResolved = capEl ? resolveElementTeluguText(capEl, articlesMap).text : null;

      const asset =
        art.assets?.find((a) => a.id === photoEl?.asset_id) ||
        art.assets?.find((a) => a.id === art.primaryAssetId) ||
        null;

      const isBrief = cont.element_id.includes('_brief_') || cont.geometry.width <= 65;

      const mod: LayoutModule = {
        moduleId: cont.element_id,
        articleId: art.id,
        pageNumber: page.page_number,
        gridColumnStart: gridColStart,
        gridColumnSpan: gridColSpan,
        rowOrder: idx + 1,
        verticalPositionMm: cont.geometry.y,
        measuredHeightMm: cont.geometry.height,
        moduleWidthMm: cont.geometry.width,
        isLeadStory: page.page_number === 1 && idx === 0,
        isSideBrief: isBrief,
        sectionCategory: art.assignedCategory,
        sectionLabelTelugu: catCfg.teluguLabel,
        sectionColorHex: catCfg.colorHex,
        locationDatelineTelugu: art.location,
        headlineVariant: hlEl?.content_ref?.endsWith('.compact') ? 'compact' : 'primary',
        headlineTextTelugu: hlResolved,
        standfirstTextTelugu: sfResolved,
        bodyVariant: bodyEl?.content_ref?.endsWith('.short') ? 'short' : 'full',
        bodyParagraphsTelugu: bodyResolved,
        continuationNoteTelugu: bodyEl?.text_flow?.continuation_note_telugu || null,
        photographAssetId: photoEl ? asset?.id || null : null,
        photographUrl: photoEl ? asset?.publicUrl || null : null,
        photographCaptionTelugu: capResolved,
        photographAspectRatio: photoEl?.image_fit?.aspect_ratio_label || null,
        headlineFontSizePt: hlEl?.typography?.font_size_pt || 16,
        bodyFontSizePt: bodyEl?.typography?.font_size_pt || 9.8,
        lineHeightRatio: bodyEl?.typography?.line_height || 1.48,
        overflowStatus: bodyEl?.content_ref?.endsWith('.short') ? 'balanced_short' : 'fit',
        geometricShape:
          cont.style?.geometric_shape ||
          photoEl?.style?.geometric_shape ||
          selectDesignerGeometricShapeForArticle(
            art,
            page.page_number,
            idx,
            page.page_number === 1 && idx === 0
          ),
      };

      if (isBrief) {
        sideBriefs.push(mod);
      } else {
        modules.push(mod);
      }
    });

    const usableHeightMm = page.height - 2 * page.margin_mm - (page.page_number === 1 ? 62 : 24);
    const totalAreaMm2 = (page.width - 2 * page.margin_mm) * usableHeightMm;
    const occupiedAreaMm2 = [...modules, ...sideBriefs].reduce(
      (acc, m) => acc + m.moduleWidthMm * m.measuredHeightMm,
      0
    );
    const fillRatio = Math.min(0.98, Math.max(0.35, Number((occupiedAreaMm2 / totalAreaMm2).toFixed(2))));

    return {
      pageNumber: page.page_number,
      pageTitleTelugu: page.page_number === 1 ? 'మొదటి పేజీ (Front Page)' : `${page.page_number}వ పేజీ`,
      sectionFocusTelugu: page.page_theme_note,
      totalColumns: page.reference_columns || 6,
      sideBriefColumnIndex: sideBriefs.length > 0 ? page.reference_columns || 6 : null,
      pageWidthMm: page.width,
      pageHeightMm: page.height,
      marginMm: page.margin_mm,
      gutterMm: settings.gutterMm || 4,
      usableHeightMm,
      usedHeightByColumnMm: Array(page.reference_columns || 6).fill(
        Math.round(usableHeightMm * fillRatio)
      ),
      columnFillRatio: fillRatio,
      modules,
      sideBriefs,
      backtrackAttempts: Math.max(0, plan.plan_version - 1),
      layoutWarnings: [],
    };
  });
}
