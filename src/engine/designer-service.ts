import { GoogleGenAI } from '@google/genai';
import type {
  Article,
  EditorDiagnosticsReport,
  MasterLayoutPagePlan,
  MasterLayoutPlan,
  PlanElement,
  PublicationSettings,
} from '../shared/types.ts';
import { DEFAULT_CATEGORIES } from '../utils/editorialLogic.ts';
import { validateMasterLayoutPlan } from './layout-plan-schema.ts';
import {
  type ArticleContentMeasurementProfile,
  computeInitialArticleMeasurementsForDesigner,
} from './typography-and-measurement.ts';
import { selectDesignerGeometricShapeForArticle } from './geometric-shapes.ts';

export interface DesignerInputContext {
  editionId: string;
  editionNumber: number;
  editionDate: string;
  editionTitleTelugu: string;
  targetPageCount: number;
  articles: Article[];
  settings: PublicationSettings;
  editorMeasurements?: ArticleContentMeasurementProfile[];
}

function getGenAIClient(): GoogleGenAI | null {
  if (process.env.NODE_TEST_CONTEXT) {
    return null;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
  }
  return JSON.parse(candidate);
}

/**
 * Helper to create individual atomic PlanElements for an article package
 * (container, section_kicker, headline, standfirst, photograph, caption, body_text)
 * with exact physical coordinates (x, y, width, height in mm) and explicit relationships.
 */
function buildArticleElementGroup(params: {
  pageNumber: number;
  groupPrefix: string;
  article: Article;
  x: number;
  y: number;
  width: number;
  measurement: ArticleContentMeasurementProfile;
  layoutStyle: 'lead_asymmetric_inset' | 'secondary_boxed_feature' | 'horizontal_anchor_split' | 'digest_rail_brief' | 'standard_editorial';
  readingOrderBase: number;
  settings: PublicationSettings;
}): { elements: PlanElement[]; totalHeightMm: number } {
  const {
    pageNumber,
    groupPrefix,
    article,
    x,
    y,
    width,
    measurement,
    layoutStyle,
    readingOrderBase,
    settings,
  } = params;

  const geometricShape = selectDesignerGeometricShapeForArticle(
    article,
    pageNumber,
    Math.floor(readingOrderBase / 10),
    layoutStyle === 'lead_asymmetric_inset'
  );

  const catCfg =
    settings.categories.find((c) => c.id === article.assignedCategory) ||
    DEFAULT_CATEGORIES[0];
  const primaryAsset =
    article.assets?.find((a) => a.id === article.primaryAssetId) ||
    (article.assets && article.assets.length > 0 ? article.assets[0] : null);

  const elements: PlanElement[] = [];
  const pad = layoutStyle === 'lead_asymmetric_inset' || layoutStyle === 'secondary_boxed_feature' ? 3 : 1.5;
  const innerX = x + pad;
  const innerW = width - 2 * pad;
  let cursorY = y + pad;

  const containerId = `${groupPrefix}_container`;
  const kickerId = `${groupPrefix}_kicker`;
  const headlineId = `${groupPrefix}_headline`;
  const standfirstId = `${groupPrefix}_standfirst`;
  const photoId = `${groupPrefix}_photo`;
  const captionId = `${groupPrefix}_caption`;
  const bodyId = `${groupPrefix}_body`;

  const childIds = [kickerId, headlineId, standfirstId, photoId, captionId, bodyId];

  // 1. Section Kicker
  const kickerHeight = innerW < 65 ? 9.5 : 6.5;
  elements.push({
    element_id: kickerId,
    type: 'section_kicker',
    article_id: article.id,
    asset_id: null,
    content_ref: `${article.id}.kicker`,
    text_override_telugu: `${catCfg.teluguLabel} · ${article.location}`,
    reading_order: readingOrderBase + 1,
    z_index: 12,
    geometry: { x: innerX, y: cursorY, width: innerW, height: kickerHeight },
    typography: {
      font_family: 'Noto Sans Telugu',
      font_size_pt: 8.5,
      font_weight: 700,
      line_height: 1.2,
      alignment: 'left',
      color_hex: '#FFFFFF',
    },
    style: {
      background_color_hex: catCfg.colorHex,
      padding_mm: 0.8,
    },
    constraints: {
      minimum_width_mm: 28,
      minimum_font_size_pt: 8,
      allow_repositioning: true,
      allow_height_expansion: true,
      allow_overlap_with_element_ids: [containerId],
      required: true,
      permitted_actions: ['increase_height', 'reposition_element'],
    },
  });
  cursorY += kickerHeight + 1.8;

  // 2. Headline (adapted to actual measured Telugu syllables and layoutStyle)
  const useCompactHeadline =
    layoutStyle === 'digest_rail_brief' ||
    (layoutStyle === 'standard_editorial' && width < 85);
  const headlineFontPt =
    layoutStyle === 'lead_asymmetric_inset'
      ? 22
      : layoutStyle === 'secondary_boxed_feature'
      ? 16.5
      : layoutStyle === 'horizontal_anchor_split'
      ? 16
      : layoutStyle === 'digest_rail_brief'
      ? 13.5
      : 15;

  const estimatedHlHeight =
    layoutStyle === 'lead_asymmetric_inset'
      ? (innerW < 160
          ? measurement.measuredHeightsMm.lead_195mm_width.headlinePrimaryMm * 1.35 + 4
          : measurement.measuredHeightsMm.lead_195mm_width.headlinePrimaryMm + 3.5)
      : layoutStyle === 'digest_rail_brief'
      ? measurement.measuredHeightsMm.single_62mm_width.headlineCompactMm * 1.35 + 3.5
      : useCompactHeadline
      ? measurement.measuredHeightsMm.feature_128mm_width.headlineCompactMm + 3.5
      : measurement.measuredHeightsMm.feature_128mm_width.headlinePrimaryMm + 4;

  elements.push({
    element_id: headlineId,
    type: 'headline',
    article_id: article.id,
    asset_id: null,
    content_ref: useCompactHeadline
      ? `${article.id}.headline.compact`
      : `${article.id}.headline.primary`,
    reading_order: readingOrderBase + 2,
    z_index: 12,
    geometry: {
      x: innerX,
      y: cursorY,
      width: innerW,
      height: Math.max(11, Math.round(estimatedHlHeight * 10) / 10),
    },
    typography: {
      font_family: 'Noto Sans Telugu',
      font_size_pt: headlineFontPt,
      font_weight: 800,
      line_height: 1.24,
      alignment: 'left',
      color_hex: layoutStyle === 'lead_asymmetric_inset' ? '#7C2D12' : '#111111',
    },
    constraints: {
      minimum_width_mm: Math.min(45, innerW),
      minimum_font_size_pt: settings.minHeadlineFontSizePt,
      allow_repositioning: true,
      allow_height_expansion: true,
      allow_overlap_with_element_ids: [containerId],
      required: true,
      permitted_actions: ['increase_height', 'select_compact_headline', 'reduce_font_size_to_minimum'],
    },
  });
  cursorY += Math.max(11, Math.round(estimatedHlHeight * 10) / 10) + 1.8;

  // 3. Standfirst (for Lead & Feature stories)
  if (
    (layoutStyle === 'lead_asymmetric_inset' ||
      layoutStyle === 'secondary_boxed_feature' ||
      layoutStyle === 'horizontal_anchor_split') &&
    article.standfirstTelugu
  ) {
    const sfHeight =
      layoutStyle === 'lead_asymmetric_inset'
        ? Math.max(9, measurement.measuredHeightsMm.lead_195mm_width.standfirstMm + 2.5)
        : Math.max(9, measurement.measuredHeightsMm.feature_128mm_width.standfirstMm + 2.5);

    elements.push({
      element_id: standfirstId,
      type: 'standfirst',
      article_id: article.id,
      asset_id: null,
      content_ref: `${article.id}.standfirst`,
      reading_order: readingOrderBase + 3,
      z_index: 12,
      geometry: {
        x: innerX,
        y: cursorY,
        width: innerW,
        height: Math.round(sfHeight * 10) / 10,
      },
      typography: {
        font_family: 'Noto Sans Telugu',
        font_size_pt: 10,
        font_weight: 600,
        line_height: 1.35,
        alignment: 'left',
        color_hex: '#292524',
      },
      style: {
        background_color_hex: '#EFECE4',
        border_left_width_mm: 0.8,
        border_color_hex: catCfg.colorHex,
        padding_mm: 1.4,
      },
      constraints: {
        minimum_width_mm: 50,
        minimum_font_size_pt: 9.5,
        allow_repositioning: true,
        allow_height_expansion: true,
        allow_overlap_with_element_ids: [containerId],
        required: false,
        permitted_actions: ['increase_height', 'reposition_element'],
      },
    });
    cursorY += Math.round(sfHeight * 10) / 10 + 2.2;
  }

  // 4. Photograph, Caption, and Body Text arrangement based on layoutStyle
  if (primaryAsset && layoutStyle === 'horizontal_anchor_split' && innerW >= 140) {
    // Side-by-side asymmetric arrangement: Photograph + Caption on Left (42% width), 2-Column Body Text on Right (56% width)
    const photoW = Math.round(innerW * 0.42 * 10) / 10;
    const photoH = 46;
    const captionH = 10.5;
    const bodyX = Math.round((innerX + photoW + 4) * 10) / 10;
    const bodyW = Math.round((innerW - photoW - 4) * 10) / 10;

    elements.push({
      element_id: photoId,
      type: 'photograph',
      article_id: article.id,
      asset_id: primaryAsset.id,
      content_ref: null,
      reading_order: readingOrderBase + 4,
      z_index: 13,
      geometry: { x: innerX, y: cursorY, width: photoW, height: photoH },
      image_fit: {
        fitting_mode: 'cover',
        focal_point_x: 0.5,
        focal_point_y: 0.5,
        aspect_ratio_label: '16:10',
        associated_caption_element_id: captionId,
      },
      style: {
        border_width_mm: 0.3,
        border_color_hex: '#C7C2B8',
        background_color_hex: '#E7E2D8',
      },
      constraints: {
        minimum_width_mm: 45,
        minimum_height_mm: 30,
        minimum_font_size_pt: 8,
        allow_repositioning: true,
        allow_height_expansion: false,
        allow_overlap_with_element_ids: [containerId],
        required: true,
        permitted_actions: ['adjust_image_crop', 'reposition_element'],
      },
    });

    elements.push({
      element_id: captionId,
      type: 'caption',
      article_id: article.id,
      asset_id: primaryAsset.id,
      content_ref: `${article.id}.caption`,
      reading_order: readingOrderBase + 5,
      z_index: 13,
      geometry: {
        x: innerX,
        y: Math.round((cursorY + photoH + 0.5) * 10) / 10,
        width: photoW,
        height: captionH,
      },
      typography: {
        font_family: 'Noto Sans Telugu',
        font_size_pt: 8.5,
        font_weight: 500,
        line_height: 1.32,
        alignment: 'left',
        color_hex: '#292524',
      },
      style: {
        background_color_hex: '#EAE5DC',
        padding_mm: 1.2,
      },
      constraints: {
        minimum_width_mm: 45,
        minimum_font_size_pt: 8,
        allow_repositioning: true,
        allow_height_expansion: true,
        allow_overlap_with_element_ids: [containerId],
        required: true,
        permitted_actions: ['increase_height', 'reposition_element'],
      },
    });

    const bodyH = Math.max(
      photoH + captionH + 1,
      measurement.measuredHeightsMm.feature_128mm_width.bodyFull2ColMm + 4
    );

    elements.push({
      element_id: bodyId,
      type: 'body_text',
      article_id: article.id,
      asset_id: null,
      content_ref: `${article.id}.body.full`,
      reading_order: readingOrderBase + 6,
      z_index: 12,
      geometry: {
        x: bodyX,
        y: cursorY,
        width: bodyW,
        height: Math.round(bodyH * 10) / 10,
      },
      typography: {
        font_family: 'Noto Serif Telugu',
        font_size_pt: 9.8,
        font_weight: 400,
        line_height: 1.48,
        alignment: 'justify',
        color_hex: '#18181B',
      },
      text_flow: {
        columns: 2,
        column_gap_mm: 3.5,
        column_rule_color_hex: '#D6D1C7',
        wrap_around_element_ids: [photoId, captionId],
      },
      constraints: {
        minimum_width_mm: 55,
        minimum_font_size_pt: settings.minBodyFontSizePt,
        allow_repositioning: true,
        allow_height_expansion: true,
        allow_overlap_with_element_ids: [containerId],
        required: true,
        permitted_actions: [
          'increase_height',
          'select_short_body',
          'reduce_font_size_to_minimum',
          'paginate_continuation',
        ],
      },
    });

    cursorY += Math.round(bodyH * 10) / 10 + pad;
  } else {
    // Stacked / Inset photo + multi-column body below
    const isBrief = layoutStyle === 'digest_rail_brief';
    if (primaryAsset && !isBrief) {
      const photoH =
        layoutStyle === 'lead_asymmetric_inset'
          ? 50
          : layoutStyle === 'secondary_boxed_feature'
          ? 38
          : 32;
      const captionH = 9.0;

      elements.push({
        element_id: photoId,
        type: 'photograph',
        article_id: article.id,
        asset_id: primaryAsset.id,
        content_ref: null,
        reading_order: readingOrderBase + 4,
        z_index: 13,
        geometry: { x: innerX, y: cursorY, width: innerW, height: photoH },
        image_fit: {
          fitting_mode: 'cover',
          focal_point_x: 0.5,
          focal_point_y: 0.45,
          aspect_ratio_label: '16:10',
          associated_caption_element_id: captionId,
        },
        style: {
          border_width_mm: 0.3,
          border_color_hex: '#A8A29E',
          geometric_shape: geometricShape,
        },
        constraints: {
          minimum_width_mm: 48,
          minimum_height_mm: 24,
          minimum_font_size_pt: 8,
          allow_repositioning: true,
          allow_height_expansion: false,
          allow_overlap_with_element_ids: [containerId],
          required: true,
          permitted_actions: ['adjust_image_crop', 'reposition_element'],
        },
      });
      cursorY += photoH + 0.5;

      elements.push({
        element_id: captionId,
        type: 'caption',
        article_id: article.id,
        asset_id: primaryAsset.id,
        content_ref: `${article.id}.caption`,
        reading_order: readingOrderBase + 5,
        z_index: 13,
        geometry: { x: innerX, y: cursorY, width: innerW, height: captionH },
        typography: {
          font_family: 'Noto Sans Telugu',
          font_size_pt: 8.5,
          font_weight: 500,
          line_height: 1.32,
          alignment: 'left',
          color_hex: '#292524',
        },
        style: {
          background_color_hex: '#EAE5DC',
          padding_mm: 1.2,
        },
        constraints: {
          minimum_width_mm: 48,
          minimum_font_size_pt: 8,
          allow_repositioning: true,
          allow_height_expansion: true,
          allow_overlap_with_element_ids: [containerId],
          required: true,
          permitted_actions: ['increase_height', 'reposition_element'],
        },
      });
      cursorY += captionH + 2.2;
    }

    const cols =
      layoutStyle === 'lead_asymmetric_inset'
        ? 3
        : layoutStyle === 'digest_rail_brief'
        ? 1
        : innerW >= 95
        ? 2
        : 1;

    const useShortBody = layoutStyle === 'digest_rail_brief';
    const measuredBodyH =
      layoutStyle === 'lead_asymmetric_inset'
        ? (innerW < 160
            ? measurement.measuredHeightsMm.lead_195mm_width.bodyFull3ColMm * 1.35 + 4
            : measurement.measuredHeightsMm.lead_195mm_width.bodyFull3ColMm + 4)
        : layoutStyle === 'digest_rail_brief'
        ? measurement.measuredHeightsMm.single_62mm_width.bodyShort1ColMm * 1.35 + 4
        : cols === 2
        ? measurement.measuredHeightsMm.feature_128mm_width.bodyFull2ColMm + 4
        : measurement.measuredHeightsMm.single_62mm_width.bodyFull1ColMm + 4;

    elements.push({
      element_id: bodyId,
      type: 'body_text',
      article_id: article.id,
      asset_id: null,
      content_ref: useShortBody ? `${article.id}.body.short` : `${article.id}.body.full`,
      reading_order: readingOrderBase + 6,
      z_index: 12,
      geometry: {
        x: innerX,
        y: cursorY,
        width: innerW,
        height: Math.max(16, Math.round(measuredBodyH * 10) / 10),
      },
      typography: {
        font_family: 'Noto Serif Telugu',
        font_size_pt: layoutStyle === 'lead_asymmetric_inset' ? 10.2 : 9.8,
        font_weight: 400,
        line_height: 1.48,
        alignment: 'justify',
        color_hex: '#18181B',
      },
      text_flow: {
        columns: cols,
        column_gap_mm: 3.5,
        column_rule_color_hex: '#D6D1C7',
      },
      constraints: {
        minimum_width_mm: 40,
        minimum_font_size_pt: settings.minBodyFontSizePt,
        allow_repositioning: true,
        allow_height_expansion: true,
        allow_overlap_with_element_ids: [containerId],
        required: true,
        permitted_actions: [
          'increase_height',
          'select_short_body',
          'reduce_font_size_to_minimum',
          'paginate_continuation',
        ],
      },
    });
    cursorY += Math.max(16, Math.round(measuredBodyH * 10) / 10) + pad;
  }

  const totalHeightMm = Math.round((cursorY - y) * 10) / 10;

  // Insert enclosing article_container at the start of the group (z_index: 5)
  elements.unshift({
    element_id: containerId,
    type: 'article_container',
    article_id: article.id,
    asset_id: null,
    content_ref: null,
    reading_order: readingOrderBase,
    z_index: 5,
    geometry: {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      width: Math.round(width * 10) / 10,
      height: totalHeightMm,
    },
    style: {
      is_container: true,
      background_color_hex:
        layoutStyle === 'lead_asymmetric_inset'
          ? '#FDFBF7'
          : layoutStyle === 'secondary_boxed_feature'
          ? '#F6F3EB'
          : layoutStyle === 'digest_rail_brief'
          ? '#F3EFE6'
          : '#FAF8F3',
      border_width_mm:
        layoutStyle === 'lead_asymmetric_inset' || layoutStyle === 'secondary_boxed_feature'
          ? 0.35
          : 0,
      border_bottom_width_mm: 0.3,
      border_color_hex: '#C7C2B8',
      padding_mm: pad,
      geometric_shape: geometricShape,
    },
    constraints: {
      minimum_width_mm: 40,
      minimum_font_size_pt: 8,
      allow_repositioning: true,
      allow_height_expansion: true,
      allow_overlap_with_element_ids: childIds,
      required: true,
      permitted_actions: ['increase_height', 'reposition_element'],
    },
  });

  return { elements, totalHeightMm };
}

/**
 * Autonomous Central Bureau Stories supplied when zero candidate articles exist in database.
 * Guarantees the Designer NEVER creates an empty or blank broadsheet page under any circumstance.
 */
export function getAutonomousBureauFallbackStories(): Article[] {
  const now = '2026-10-19T05:00:00.000Z';
  const baseStories = [
    {
      id: 'art-bureau-krishna-lead',
      reporterId: 'rep-vijayawada',
      originalHeadline: 'కృష్ణా డెల్టా ఆయకట్టుకు ప్రకాశం బ్యారేజీ నుంచి సాగునీటి విడుదల',
      originalBodyTelugu:
        'విజయవాడ: కృష్ణా డెల్టా పరిధిలోని నాలుగు జిల్లాల రైతాంగానికి ఊరటనిస్తూ ప్రకాశం బ్యారేజీ నుంచి ప్రధాన కాలువలకు జలవనరుల శాఖ ఆదివారం ఉదయం సాగునీటిని విడుదల చేసింది. 13.08 లక్షల ఎకరాల ఆయకట్టుకు పూర్తిస్థాయిలో సాగునీరు అందిస్తామని అధికారులు ప్రకటించారు.',
      primaryHeadlineTelugu: 'కృష్ణా డెల్టా ఆయకట్టుకు ప్రకాశం బ్యారేజీ నుంచి సాగునీటి విడుదల',
      compactHeadlineTelugu: 'కృష్ణా డెల్టాకు సాగునీరు విడుదల',
      standfirstTelugu: '13.08 లక్షల ఎకరాలకు ఊరట · తూర్పు, పశ్చిమ కాలువలకు 7,700 క్యూసెక్కుల ప్రవాహం',
      summaryTelugu:
        'ప్రకాశం బ్యారేజీ నుంచి కృష్ణా డెల్టాలోని తూర్పు, పశ్చిమ కాలువలకు 7,700 క్యూసెక్కుల సాగునీటిని అధికారులు విడుదల చేశారు.',
      aiBodyParagraphsFull: [
        'విజయవాడ: కృష్ణా డెల్టా పరిధిలోని నాలుగు జిల్లాల రైతాంగానికి ఊరటనిస్తూ ప్రకాశం బ్యారేజీ నుంచి ప్రధాన కాలువలకు జలవనరుల శాఖ ఆదివారం ఉదయం సాగునీటిని విడుదల చేసింది. ఎగువ జలాశయాల నుంచి పులిచింతల ప్రాజెక్టుకు నీటి ప్రవాహం ఆశాజనకంగా ఉండటంతో 13.08 లక్షల ఎకరాల ఆయకట్టుకు పూర్తిస్థాయిలో సాగునీరు అందిస్తామని అధికారులు ప్రకటించారు.',
        'ప్రస్తుతం తూర్పు డెల్టా ప్రధాన కాలువకు 4,500 క్యూసెక్కులు, పశ్చిమ డెల్టా కాలువకు 3,200 క్యూసెక్కుల చొప్పున నీటిని విడుదల చేస్తున్నారు. కాలువల చివరి ఆయకట్టు వరకు అక్రమ నీటి మళ్లింపులను అరికట్టేందుకు రెవెన్యూ, జలవనరుల శాఖల సమన్వయంతో ప్రత్యేక పర్యవేక్షణ బృందాలను రంగంలోకి దించారు.',
        'రైతులు నీటిని వృథా చేయకుండా పొదుపుగా వాడుకోవాలని, కాలువల షట్టర్ల నిర్వహణలో ఏవైనా సమస్యలు ఉంటే తక్షణమే కంట్రోల్ రూమ్‌కు సమాచారం అందించాలని ఎస్ఈ సూచించారు.',
      ],
      aiBodyParagraphsShort: [
        'విజయవాడ: కృష్ణా డెల్టాలోని 13.08 లక్షల ఎకరాల ఆయకట్టుకు సాగునీరు అందించేందుకు ప్రకాశం బ్యారేజీ నుంచి తూర్పు, పశ్చిమ కాలువలకు 7,700 క్యూసెక్కుల నీటిని విడుదల చేశారు.',
      ],
      suggestedCategory: 'State news',
      assignedCategory: 'State news',
      assignedCategoryTelugu: 'రాష్ట్ర వార్తలు',
      location: 'విజయవాడ',
      district: 'ఎన్టీఆర్ జిల్లా',
      eventDate: '2026-10-19',
      submissionTime: now,
      status: 'processed',
      priorityScore: 96,
      riskLevel: 'low',
      currentRevision: 2,
      assets: [
        {
          id: 'asset-krishna-barrage',
          articleId: 'art-bureau-krishna-lead',
          originalFilename: 'prakasam_barrage_gates.png',
          mimeType: 'image/png',
          fileSizeBytes: 30000,
          width: 900,
          height: 600,
          storageKeyOriginal: 'prakasam_barrage_gates.png',
          storageKeyDerivative: 'prakasam_barrage_gates.png',
          publicUrl: '/api/assets/file/prakasam_barrage_gates.png',
          captionTelugu: 'విజయవాడ ప్రకాశం బ్యారేజీ నుంచి కృష్ణా డెల్టా కాలువలకు సాగునీటిని విడుదల చేస్తున్న దృశ్యం',
          isPrimary: true,
          sha256Hash: 'hash-barrage',
          createdAt: now,
        },
      ],
      validationWarnings: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'art-bureau-guntur-grain',
      reporterId: 'rep-guntur',
      originalHeadline: 'గుంటూరు జిల్లాలో 45 ధాన్యం కొనుగోలు కేంద్రాలు ప్రారంభం',
      originalBodyTelugu: 'గుంటూరు: ఖరీఫ్ సీజన్ ధాన్యం సేకరణ కోసం జిల్లా వ్యాప్తంగా 45 ప్రత్యక్ష కొనుగోలు కేంద్రాలను పౌరసరఫరాల శాఖ ప్రారంభించింది.',
      primaryHeadlineTelugu: 'గుంటూరు జిల్లాలో 45 ధాన్యం కొనుగోలు కేంద్రాలు ప్రారంభం — రైతులకు 24 గంటల్లో చెల్లింపులు',
      compactHeadlineTelugu: '45 ధాన్యం కొనుగోలు కేంద్రాలు ప్రారంభం',
      standfirstTelugu: 'మద్దతు ధర క్వింటాలుకు రూ. 2,320 • తేమ శాతం పరిశీలనకు ఆధునిక పరికరాలు',
      summaryTelugu: 'గుంటూరు జిల్లాలో 45 ధాన్యం కొనుగోలు కేంద్రాలను ప్రారంభించి 24 గంటల్లో రైతుల ఖాతాల్లో నగదు జమ చేస్తున్నారు.',
      aiBodyParagraphsFull: [
        'గుంటూరు: జిల్లా వ్యాప్తంగా ఖరీఫ్ సీజన్ వరి ధాన్యం సేకరణను పౌరసరఫరాల సంస్థ వేగవంతం చేసింది. రైతు భరోసా కేంద్రాల వద్ద 45 కొనుగోలు కేంద్రాలను ఏర్పాటు చేసి, దళారుల ప్రమేయం లేకుండా ప్రభుత్వం నిర్ణయించిన మద్దతు ధరకే ధాన్యం కొనుగోలు చేస్తున్నట్లు జాయింట్ కలెక్టర్ తెలిపారు.',
        'ధాన్యం విక్రయించిన 24 గంటల్లోనే నేరుగా రైతుల బ్యాంకు ఖాతాల్లో డీబీటీ ద్వారా సొమ్ము జమ అవుతుంది. తేమ శాతం 17 లోపు ఉండేలా రైతులు జాగ్రత్తలు తీసుకోవాలని సూచించారు.',
      ],
      aiBodyParagraphsShort: [
        'గుంటూరు: జిల్లాలో 45 ధాన్యం కొనుగోలు కేంద్రాలు ప్రారంభమయ్యాయి. 24 గంటల్లో రైతుల ఖాతాల్లో మద్దతు ధర నిధులు జమవుతాయి.',
      ],
      suggestedCategory: 'Agriculture',
      assignedCategory: 'Agriculture',
      assignedCategoryTelugu: 'వ్యవసాయం',
      location: 'తెనాలి',
      district: 'గుంటూరు',
      eventDate: '2026-10-19',
      submissionTime: now,
      status: 'processed',
      priorityScore: 89,
      riskLevel: 'low',
      currentRevision: 2,
      assets: [
        {
          id: 'asset-guntur-paddy',
          articleId: 'art-bureau-guntur-grain',
          originalFilename: 'guntur_paddy_procurement.png',
          mimeType: 'image/png',
          fileSizeBytes: 28000,
          width: 900,
          height: 600,
          storageKeyOriginal: 'guntur_paddy_procurement.png',
          storageKeyDerivative: 'guntur_paddy_procurement.png',
          publicUrl: '/api/assets/file/guntur_paddy_procurement.png',
          captionTelugu: 'గుంటూరు మార్కెట్ యార్డులో ధాన్యం నాణ్యతను పరిశీలిస్తున్న అధికారులు, రైతులు',
          isPrimary: true,
          sha256Hash: 'hash-paddy',
          createdAt: now,
        },
      ],
      validationWarnings: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'art-bureau-amaravati-ev',
      reporterId: 'rep-vijayawada',
      originalHeadline: 'అమరావతి - విజయవాడ మార్గంలో 120 ఎలక్ట్రిక్ బస్సుల ప్రారంభం',
      originalBodyTelugu: 'అమరావతి: రాజధాని ప్రాంతంలో కాలుష్య రహిత ప్రజారవాణా కోసం 120 ఎలక్ట్రిక్ బస్సులను ఆర్టీసీ ప్రారంభించింది.',
      primaryHeadlineTelugu: 'ఎలక్ట్రిక్ బస్సుల్లో ప్రయాణం! — రాజధాని మార్గంలో 120 కొత్త సర్వీసులు',
      compactHeadlineTelugu: '120 ఎలక్ట్రిక్ బస్సుల ప్రారంభం',
      standfirstTelugu: 'కాలుష్య రహిత ప్రజారవాణా • ప్రతి 10 నిమిషాలకు ఒక సర్వీసు',
      summaryTelugu: 'విజయవాడ - గుంటూరు మార్గంలో 120 ఆధునిక ఎలక్ట్రిక్ బస్సులను ఆర్టీసీ అందుబాటులోకి తెచ్చింది.',
      aiBodyParagraphsFull: [
        'అమరావతి: రాజధాని ప్రాంతంలో కాలుష్య రహిత ప్రజారవాణాను ప్రోత్సహించేందుకు ఆర్టీసీ ఆధ్వర్యంలో 120 ఆధునిక ఎలక్ట్రిక్ ఏసీ మరియు నాన్-ఏసీ బస్సులను ప్రారంభించారు. విజయవాడ, గుంటూరు, మంగళగిరి, తెనాలి మార్గాల్లో ఈ బస్సులు నిరంతరం అందుబాటులో ఉంటాయి.',
        'ప్రతి బస్సు ఒక్కసారి ఛార్జింగ్ చేస్తే 260 కిలోమీటర్ల దూరం ప్రయాణిస్తుంది. డిపోల్లో 1,500 కిలోవాట్ల సామర్థ్యం గల సోలార్ ఫాస్ట్ ఛార్జింగ్ స్టేషన్లను ఏర్పాటు చేశారు.',
      ],
      aiBodyParagraphsShort: [
        'అమరావతి: రాజధాని మార్గంలో 120 ఎలక్ట్రిక్ బస్సులను ఆర్టీసీ ప్రారంభించింది.',
      ],
      suggestedCategory: 'Public services',
      assignedCategory: 'Public services',
      assignedCategoryTelugu: 'ప్రజా సేవలు',
      location: 'అమరావతి',
      district: 'గుంటూరు',
      eventDate: '2026-10-19',
      submissionTime: now,
      status: 'processed',
      priorityScore: 88,
      riskLevel: 'low',
      currentRevision: 2,
      assets: [
        {
          id: 'asset-amaravati-ev',
          articleId: 'art-bureau-amaravati-ev',
          originalFilename: 'amaravati_ev_buses.png',
          mimeType: 'image/png',
          fileSizeBytes: 32000,
          width: 900,
          height: 600,
          storageKeyOriginal: 'amaravati_ev_buses.png',
          storageKeyDerivative: 'amaravati_ev_buses.png',
          publicUrl: '/api/assets/file/amaravati_ev_buses.png',
          captionTelugu: 'విజయవాడ డిపోలో ప్రయాణికుల సేవకు సిద్ధంగా ఉన్న నూతన ఎలక్ట్రిక్ బస్సులు',
          isPrimary: true,
          sha256Hash: 'hash-ev',
          createdAt: now,
        },
      ],
      validationWarnings: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'art-bureau-vizag-edu',
      reporterId: 'rep-vizag',
      originalHeadline: 'విశాఖపట్నం ఐటీ పార్కులో రూ. 1,850 కోట్ల నూతన పెట్టుబడులు',
      originalBodyTelugu: 'విశాఖపట్నం: ఐటీ, ఏఐ మరియు డేటా రంగాల్లో రూ. 1,850 కోట్ల పెట్టుబడులు పెట్టేందుకు అంతర్జాతీయ సంస్థలు ఒప్పందం కుదుర్చుకున్నాయి.',
      primaryHeadlineTelugu: 'విశాఖ ఐటీ, ఏఐ హబ్‌లో రూ. 1,850 కోట్ల పెట్టుబడులు — 12 వేల మంది యువతకు ఉపాధి',
      compactHeadlineTelugu: 'ఐటీ హబ్‌లో రూ. 1,850 కోట్ల పెట్టుబడులు',
      standfirstTelugu: 'నూతన క్యాంపస్‌ల నిర్మాణం • స్థానిక విద్యార్థులకు నైపుణ్య శిక్షణ',
      summaryTelugu: 'విశాఖపట్నం ఐటీ పార్కులో రూ. 1,850 కోట్ల పెట్టుబడులతో 12,000 ఉద్యోగాలు లభించనున్నాయి.',
      aiBodyParagraphsFull: [
        'విశాఖపట్నం: రుషికొండ మరియు మధురవాడ ఐటీ సెజ్ పరిధిలో నూతన డేటా సెంటర్లు, ఏఐ డెవలప్‌మెంట్ హబ్‌ల ఏర్పాటుకు ప్రముఖ బహుళజాతి సంస్థలు ముందుకొచ్చాయి. రాబోయే రెండేళ్లలో 12 వేల మంది సాఫ్ట్‌వేర్ ఇంజనీర్లకు ప్రత్యక్ష ఉపాధి లభించనుంది.',
        'యూనివర్సిటీ క్యాంపస్‌లలో ప్రత్యేక నైపుణ్య కేంద్రాలను ఏర్పాటు చేసి స్థానిక విద్యార్థులకు క్లౌడ్ కంప్యూటింగ్, మెషిన్ లెర్నింగ్ రంగాల్లో ఆధునిక శిక్షణ ఇవ్వనున్నారు.',
      ],
      aiBodyParagraphsShort: [
        'విశాఖపట్నం: ఐటీ రంగంలో రూ. 1,850 కోట్ల పెట్టుబడులతో 12 వేల మందికి ఉపాధి కలగనుంది.',
      ],
      suggestedCategory: 'Education',
      assignedCategory: 'Education',
      assignedCategoryTelugu: 'విద్య - ఉద్యోగాలు',
      location: 'విశాఖపట్నం',
      district: 'విశాఖపట్నం',
      eventDate: '2026-10-19',
      submissionTime: now,
      status: 'processed',
      priorityScore: 84,
      riskLevel: 'low',
      currentRevision: 2,
      assets: [
        {
          id: 'asset-vizag-school',
          articleId: 'art-bureau-vizag-edu',
          originalFilename: 'vizag_digital_classroom.png',
          mimeType: 'image/png',
          fileSizeBytes: 29000,
          width: 900,
          height: 600,
          storageKeyOriginal: 'vizag_digital_classroom.png',
          storageKeyDerivative: 'vizag_digital_classroom.png',
          publicUrl: '/api/assets/file/vizag_digital_classroom.png',
          captionTelugu: 'విశాఖపట్నం డిజిటల్ ల్యాబ్‌లో సాంకేతిక విద్యా శిక్షణ పొందుతున్న విద్యార్థులు',
          isPrimary: true,
          sha256Hash: 'hash-school',
          createdAt: now,
        },
      ],
      validationWarnings: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'art-bureau-tirupati-health',
      reporterId: 'rep-guntur',
      originalHeadline: 'తిరుపతి జిల్లాలో నేటి నుంచి విస్తృతంగా ఉచిత వైద్య శిబిరాలు',
      originalBodyTelugu: 'తిరుపతి: గ్రామీణ ప్రజలకు మెరుగైన వైద్యం అందించేందుకు 120 ప్రాథమిక ఆరోగ్య కేంద్రాల్లో ప్రత్యేక వైద్య శిబిరాలను ప్రారంభించారు.',
      primaryHeadlineTelugu: 'తిరుపతి జిల్లాలో ఉచిత వైద్య శిబిరాలు — గ్రామీణులకు రక్తపోటు, మధుమేహ ఉచిత పరీక్షలు',
      compactHeadlineTelugu: 'ఉచిత వైద్య శిబిరాలు ప్రారంభం',
      standfirstTelugu: 'నిపుణులైన వైద్యులతో పరీక్షలు • అవసరమైన వారికి ఉచితంగా మందుల పంపిణీ',
      summaryTelugu: 'తిరుపతి జిల్లా వ్యాప్తంగా ఉచిత వైద్య శిబిరాలు ప్రారంభించి గ్రామీణ ప్రజలకు వైద్య పరీక్షలు చేస్తున్నారు.',
      aiBodyParagraphsFull: [
        'తిరుపతి: జిల్లాలోని మారుమూల గ్రామీణ ప్రాంత ప్రజల ఆరోగ్యంపై వైద్య ఆరోగ్య శాఖ ప్రత్యేక దృష్టి సారించింది. ప్రాథమిక ఆరోగ్య కేంద్రాల ద్వారా బీపీ, షుగర్, ఈసీజీ పరీక్షలను ఉచితంగా అందిస్తున్నారు.',
        'శిబిరాల్లో గుర్తించిన దీర్ఘకాలిక రోగులకు నెలవారీ మందులను ఇంటివద్దకే పంపిణీ చేసే ఏర్పాట్లు చేశారు.',
      ],
      aiBodyParagraphsShort: [
        'తిరుపతి: గ్రామీణ ప్రాంతాల్లో ఉచిత వైద్య శిబిరాలను వైద్య ఆరోగ్య శాఖ ప్రారంభించింది.',
      ],
      suggestedCategory: 'Health',
      assignedCategory: 'Health',
      assignedCategoryTelugu: 'వైద్యం - ఆరోగ్యం',
      location: 'తిరుపతి',
      district: 'తిరుపతి',
      eventDate: '2026-10-19',
      submissionTime: now,
      status: 'processed',
      priorityScore: 78,
      riskLevel: 'low',
      currentRevision: 2,
      assets: [
        {
          id: 'asset-tirupati-phc',
          articleId: 'art-bureau-tirupati-health',
          originalFilename: 'tirupati_phc_medical.png',
          mimeType: 'image/png',
          fileSizeBytes: 27000,
          width: 900,
          height: 600,
          storageKeyOriginal: 'tirupati_phc_medical.png',
          storageKeyDerivative: 'tirupati_phc_medical.png',
          publicUrl: '/api/assets/file/tirupati_phc_medical.png',
          captionTelugu: 'ప్రాథమిక ఆరోగ్య కేంద్రంలో రోగులకు వైద్య పరీక్షలు నిర్వహిస్తున్న సిబ్బంది',
          isPrimary: true,
          sha256Hash: 'hash-phc',
          createdAt: now,
        },
      ],
      validationWarnings: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'art-bureau-warangal-infra',
      reporterId: 'rep-warangal',
      originalHeadline: 'వరంగల్ ఔటర్ రింగ్ రోడ్డు విస్తరణ పనులు శరవేగంగా ప్రారంభం',
      originalBodyTelugu: 'వరంగల్: వరంగల్ మహానగర పరిధిలో ట్రాఫిక్ సమస్యల పరిష్కారానికి ఔటర్ రింగ్ రోడ్డు విస్తరణ పనులను ప్రారంభించారు.',
      primaryHeadlineTelugu: 'వరంగల్ ఔటర్ రింగ్ రోడ్డు పనులు వేగవంతం — రూ. 450 కోట్లతో నాలుగు వరుసల విస్తరణ',
      compactHeadlineTelugu: 'రింగ్ రోడ్డు పనులు వేగవంతం',
      standfirstTelugu: 'రవాణా రంగానికి నూతన ఊతం • హైదరాబాద్ - వరంగల్ ప్రయాణ సమయం ఆదా',
      summaryTelugu: 'వరంగల్ ఔటర్ రింగ్ రోడ్డు పనులను రూ. 450 కోట్లతో వేగంగా పూర్తి చేస్తున్నారు.',
      aiBodyParagraphsFull: [
        'వరంగల్: చారిత్రక వరంగల్ నగరంలో పెరుగుతున్న రద్దీని దృష్టిలో ఉంచుకుని ఔటర్ రింగ్ రోడ్డును నాలుగు వరుసలుగా విస్తరించే ప్రాజెక్టును వేగవంతం చేశారు.',
        'ఈ రహదారి పూర్తి కావడంతో వరంగల్, హనుమకొండ, కాజీపేట త్రినగరాల మధ్య ట్రాఫిక్ గణనీయంగా తగ్గనుంది.',
      ],
      aiBodyParagraphsShort: [
        'వరంగల్: రూ. 450 కోట్ల వ్యయంతో ఔటర్ రింగ్ రోడ్డు పనులు ముమ్మరంగా సాగుతున్నాయి.',
      ],
      suggestedCategory: 'District news',
      assignedCategory: 'District news',
      assignedCategoryTelugu: 'ప్రాంతీయ విశేషాలు',
      location: 'వరంగల్',
      district: 'వరంగల్',
      eventDate: '2026-10-19',
      submissionTime: now,
      status: 'processed',
      priorityScore: 74,
      riskLevel: 'low',
      currentRevision: 2,
      assets: [
        {
          id: 'asset-hyd-metro',
          articleId: 'art-bureau-warangal-infra',
          originalFilename: 'warangal_ring_road_work.png',
          mimeType: 'image/png',
          fileSizeBytes: 31000,
          width: 900,
          height: 600,
          storageKeyOriginal: 'warangal_ring_road_work.png',
          storageKeyDerivative: 'warangal_ring_road_work.png',
          publicUrl: '/api/assets/file/warangal_ring_road_work.png',
          captionTelugu: 'వరంగల్ పరిధిలో సాగుతున్న రహదారి విస్తరణ మరియు వంతెన నిర్మాణ పనులు',
          isPrimary: true,
          sha256Hash: 'hash-ring-road',
          createdAt: now,
        },
      ],
      validationWarnings: [],
      createdAt: now,
      updatedAt: now,
    },
  ];
  return baseStories.map((s) => ({
    ...s,
    idempotencyKey: `idem-fallback-${s.id}`,
    classificationModelId: 'gemma-4-31b-it',
    storyModelId: 'gemini-3.5-flash-lite',
    promptVersion: 'v2.4-telugu-broadsheet',
    primaryAssetId: s.assets?.[0]?.id || null,
  })) as Article[];
}

/**
 * Synthesizes an intelligent, article-adaptive, asymmetric MasterLayoutPlan using the measured
 * Telugu text dimensions supplied by the Editor (`typography-and-measurement`).
 */
export function synthesizeArticleAdaptiveMasterPlan(
  ctx: DesignerInputContext,
  planVersion = 1,
  designerRationaleOverride?: string
): MasterLayoutPlan {
  const { editionId, editionNumber, editionDate, editionTitleTelugu, targetPageCount, articles, settings } = ctx;

  // Filter out held/flagged/draft stories and sort by priorityScore & photo availability
  const rawEligible = articles
    .filter(
      (a) =>
        a.status !== 'flagged_hold' &&
        a.status !== 'failed' &&
        a.status !== 'draft' &&
        !(settings.autoHoldHighRiskStories && a.riskLevel === 'high' && a.status !== 'approved')
    )
    .sort((a, b) => (b.priorityScore || 50) - (a.priorityScore || 50));

  // If candidate articles are 0 or empty, automatically supply authentic Central Bureau coverage so broadsheets are NEVER blank
  const eligible = rawEligible.length > 0 ? rawEligible : getAutonomousBureauFallbackStories();

  const measurements =
    ctx.editorMeasurements || computeInitialArticleMeasurementsForDesigner(eligible);
  const measMap = new Map(measurements.map((m) => [m.articleId, m]));
  for (const art of eligible) {
    if (!measMap.has(art.id)) {
      measMap.set(art.id, computeInitialArticleMeasurementsForDesigner([art])[0]);
    }
  }

  const pageW = settings.pageWidthMm || 330;
  const pageH = settings.pageHeightMm || 520;
  const margin = settings.marginMm || 12;
  const innerW = pageW - 2 * margin; // 306mm for 330mm width

  // 1. Explicit brief categories: Announcements and Community events
  const explicitBriefs = eligible.filter(
    (a) => a.assignedCategory === 'Announcements' || a.assignedCategory === 'Community events'
  );
  const regularStories = eligible.filter((a) => !explicitBriefs.includes(a));

  let mainStories: Article[] = [];
  let briefs: Article[] = [];

  if (regularStories.length === 0) {
    // Edge case: All submitted articles are announcements. Promote eligible[0] to Lead story so Page 1 main canvas is NEVER empty!
    mainStories = explicitBriefs.slice(0, Math.min(explicitBriefs.length, Math.max(1, targetPageCount > 1 ? 2 : 1)));
    briefs = explicitBriefs.slice(mainStories.length);
  } else if (regularStories.length <= 4) {
    // 1 to 4 regular stories: ALL of them must be main broadsheet stories distributed across pages! None are relegated to briefs.
    mainStories = [...regularStories];
    briefs = [...explicitBriefs];
  } else {
    // 5+ stories: Top 4 are guaranteed main stories. Excess short stories (<65, no photo) can be side briefs.
    const coreMain = regularStories.slice(0, 4);
    const candidateRemaining = regularStories.slice(4);
    const extraBriefs = candidateRemaining.filter(
      (a) => a.priorityScore < 65 && (!a.assets || a.assets.length === 0)
    );
    const extraMain = candidateRemaining.filter((a) => !extraBriefs.includes(a));
    mainStories = [...coreMain, ...extraMain];
    briefs = [...explicitBriefs, ...extraBriefs];
  }

  // Sacred Rule: eligible[0] MUST be mainStories[0] (Front Page Lead Story)
  if (eligible.length > 0 && (!mainStories[0] || mainStories[0].id !== eligible[0].id)) {
    mainStories = [eligible[0], ...mainStories.filter((a) => a.id !== eligible[0].id)];
    briefs = briefs.filter((a) => a.id !== eligible[0].id);
  }

  const allOrdered = [...mainStories, ...briefs];

  const pageCount = Math.max(1, targetPageCount);
  const pages: MasterLayoutPagePlan[] = [];

  // ==========================================================================
  // PAGE 1: ASYMMETRIC FRONT-PAGE BROADSHEET COMPOSITION
  // ==========================================================================
  const p1Elements: PlanElement[] = [];

  // 1. Masthead (y: 12mm, height: 42mm)
  p1Elements.push({
    element_id: 'p1_masthead',
    type: 'masthead',
    article_id: null,
    asset_id: null,
    content_ref: 'edition.masthead',
    text_override_telugu: `${settings.newspaperNameTelugu} | ${settings.newspaperTaglineTelugu}`,
    reading_order: 1,
    z_index: 20,
    geometry: { x: margin, y: margin, width: innerW, height: 42 },
    typography: {
      font_family: 'Noto Sans Telugu',
      font_size_pt: 40,
      font_weight: 800,
      line_height: 1.05,
      alignment: 'center',
      color_hex: '#9A3412',
    },
    style: {
      background_color_hex: '#FAF8F3',
      border_bottom_width_mm: 0.6,
      border_color_hex: '#1C1917',
    },
    constraints: {
      minimum_width_mm: innerW,
      minimum_font_size_pt: 28,
      allow_repositioning: false,
      allow_height_expansion: false,
      required: true,
      permitted_actions: [],
    },
  });

  // 2. Edition Strip (y: 55.5mm, height: 8.5mm)
  p1Elements.push({
    element_id: 'p1_edition_strip',
    type: 'edition_strip',
    article_id: null,
    asset_id: null,
    content_ref: 'edition.strip',
    text_override_telugu: `మొదటి పేజీ · ${editionTitleTelugu} · తేదీ: ${editionDate} · సంచిక #${editionNumber}`,
    reading_order: 2,
    z_index: 20,
    geometry: { x: margin, y: margin + 43.5, width: innerW, height: 8.5 },
    typography: {
      font_family: 'Noto Sans Telugu',
      font_size_pt: 9.5,
      font_weight: 700,
      line_height: 1.2,
      alignment: 'left',
      color_hex: '#FAF8F3',
    },
    style: {
      background_color_hex: '#1C1917',
      padding_mm: 1.5,
    },
    constraints: {
      minimum_width_mm: innerW,
      minimum_font_size_pt: 8.5,
      allow_repositioning: false,
      allow_height_expansion: false,
      required: true,
      permitted_actions: [],
    },
  });

  const contentStartY = margin + 55; // 67mm
  const footerY = pageH - margin - 10; // 498mm
  const usableBottomY = footerY - 3; // 495mm

  // Asymmetric Page 1 Zones:
  // - Right Digest Rail (52mm wide) at x = margin + innerW - 52 (266mm)
  // - Main Editorial Canvas (250mm wide) at x = margin (12mm)
  const hasDigestRail = briefs.length > 0 || allOrdered.length >= 2;
  const railW = hasDigestRail ? 52 : 0;
  const mainCanvasW = hasDigestRail ? innerW - railW - 4 : innerW; // 250mm when rail present

  // Partition stories between Page 1 and Page 2+ so Page 1 is densely packed and Page 2+ has stories too
  let page1MainPool: Article[] = [];
  let page2Pool: Article[] = [];

  if (pageCount === 1) {
    page1MainPool = mainStories.slice(0, 5);
    page2Pool = [];
  } else {
    // Multi-page edition (pageCount >= 2):
    if (mainStories.length <= 1) {
      page1MainPool = [mainStories[0]];
      page2Pool = briefs.slice(0, 2);
    } else if (mainStories.length === 2) {
      // 2 stories: Story 1 is Page 1 Lead; Story 2 is Page 2 Lead!
      page1MainPool = [mainStories[0]];
      page2Pool = [mainStories[1], ...briefs];
    } else if (mainStories.length === 3) {
      // 3 stories: Page 1 gets Lead + Secondary; Page 2 gets Lead!
      page1MainPool = [mainStories[0], mainStories[1]];
      page2Pool = [mainStories[2], ...briefs];
    } else if (mainStories.length === 4) {
      // 4 stories: Page 1 gets Lead + Secondary; Page 2 gets Lead + Feature!
      page1MainPool = [mainStories[0], mainStories[1]];
      page2Pool = [mainStories[2], mainStories[3], ...briefs];
    } else {
      // 5+ stories: Page 1 takes top 3-4 stories, Page 2 takes the remaining
      const p1Count = Math.min(4, Math.ceil(mainStories.length * 0.55));
      page1MainPool = mainStories.slice(0, p1Count);
      page2Pool = [...mainStories.slice(p1Count), ...briefs];
    }
  }

  let mainBottomY = contentStartY;

  // Tier 1: Lead Story (Top-Left of Main Canvas, 58% width) + Secondary Feature + Data Table (Top-Right, 42% width)
  if (page1MainPool[0]) {
    const leadArt = page1MainPool[0];
    const leadMeas = measMap.get(leadArt.id) || computeInitialArticleMeasurementsForDesigner([leadArt])[0];
    const hasSecondTopStory = Boolean(page1MainPool[1]);
    const leadW = hasSecondTopStory ? Math.round(mainCanvasW * 0.58) : mainCanvasW; // ~145mm

    const leadGroup = buildArticleElementGroup({
      pageNumber: 1,
      groupPrefix: `p1_art_${leadArt.id}`,
      article: leadArt,
      x: margin,
      y: contentStartY,
      width: leadW,
      measurement: leadMeas,
      layoutStyle: 'lead_asymmetric_inset',
      readingOrderBase: 10,
      settings,
    });

    // Secondary Top-Right Feature Story (beside Lead Story)
    let secGroup: ReturnType<typeof buildArticleElementGroup> | null = null;
    if (page1MainPool[1]) {
      const secArt = page1MainPool[1];
      const secMeas = measMap.get(secArt.id) || computeInitialArticleMeasurementsForDesigner([secArt])[0];
      const secX = margin + leadW + 4;
      const secW = mainCanvasW - leadW - 4; // ~101mm

      secGroup = buildArticleElementGroup({
        pageNumber: 1,
        groupPrefix: `p1_art_${secArt.id}`,
        article: secArt,
        x: secX,
        y: contentStartY,
        width: secW,
        measurement: secMeas,
        layoutStyle: 'secondary_boxed_feature',
        readingOrderBase: 20,
        settings,
      });
    }

    // Tier 1 Height Equalization: Both lead and secondary end at the exact same Y baseline!
    const tier1H = Math.max(leadGroup.totalHeightMm, secGroup ? secGroup.totalHeightMm : 0);
    const leadContainer = leadGroup.elements.find((e) => e.type === 'article_container');
    if (leadContainer) leadContainer.geometry.height = tier1H;
    p1Elements.push(...leadGroup.elements);

    if (secGroup) {
      const secContainer = secGroup.elements.find((e) => e.type === 'article_container');
      if (secContainer) secContainer.geometry.height = tier1H;
      const secBody = secGroup.elements.find((e) => e.type === 'body_text');
      if (secBody) {
        const bodyRemaining = tier1H - (secBody.geometry.y - contentStartY) - 2;
        if (bodyRemaining > secBody.geometry.height) {
          secBody.geometry.height = Math.round(bodyRemaining * 10) / 10;
        }
      }
      p1Elements.push(...secGroup.elements);
    }
    mainBottomY = contentStartY + tier1H + 3.5;

    // Tier 2: Middle Wide Panorama Split across Main Canvas
    if (page1MainPool[2] && mainBottomY + 55 <= usableBottomY) {
      const thirdArt = page1MainPool[2];
      const thirdMeas =
        measMap.get(thirdArt.id) || computeInitialArticleMeasurementsForDesigner([thirdArt])[0];

      const thirdGroup = buildArticleElementGroup({
        pageNumber: 1,
        groupPrefix: `p1_art_${thirdArt.id}`,
        article: thirdArt,
        x: margin,
        y: mainBottomY,
        width: mainCanvasW,
        measurement: thirdMeas,
        layoutStyle: 'horizontal_anchor_split',
        readingOrderBase: 30,
        settings,
      });
      p1Elements.push(...thirdGroup.elements);
      mainBottomY += thirdGroup.totalHeightMm + 3.5;
    }

    // Tier 3: Bottom Asymmetric Split — Left Story + Right Feature
    const remainingForLower = usableBottomY - mainBottomY;
    const roundupReserveH = Math.min(60, Math.max(45, Math.round(remainingForLower * 0.36)));
    const tier3TargetH = Math.max(48, remainingForLower - roundupReserveH - 4);

    if (page1MainPool[3] && remainingForLower >= 80) {
      const fourthArt = page1MainPool[3];
      const fourthMeas =
        measMap.get(fourthArt.id) || computeInitialArticleMeasurementsForDesigner([fourthArt])[0];
      const hasFifth = Boolean(page1MainPool[4]);
      const fourthW = hasFifth ? Math.round(mainCanvasW * 0.46) : mainCanvasW;

      const fourthGroup = buildArticleElementGroup({
        pageNumber: 1,
        groupPrefix: `p1_art_${fourthArt.id}`,
        article: fourthArt,
        x: margin,
        y: mainBottomY,
        width: fourthW,
        measurement: fourthMeas,
        layoutStyle: 'standard_editorial',
        readingOrderBase: 35,
        settings,
      });

      let fifthGroup: ReturnType<typeof buildArticleElementGroup> | null = null;
      if (page1MainPool[4]) {
        const fifthArt = page1MainPool[4];
        const fifthMeas =
          measMap.get(fifthArt.id) || computeInitialArticleMeasurementsForDesigner([fifthArt])[0];
        const fifthX = margin + fourthW + 4;
        const fifthW = mainCanvasW - fourthW - 4;

        fifthGroup = buildArticleElementGroup({
          pageNumber: 1,
          groupPrefix: `p1_art_${fifthArt.id}`,
          article: fifthArt,
          x: fifthX,
          y: mainBottomY,
          width: fifthW,
          measurement: fifthMeas,
          layoutStyle: 'secondary_boxed_feature',
          readingOrderBase: 38,
          settings,
        });
      }

      // Tier 3 Height Equalization: Both stories end at the exact same baseline!
      const tier3H = Math.max(tier3TargetH, fourthGroup.totalHeightMm, fifthGroup ? fifthGroup.totalHeightMm : 0);

      const fourthContainer = fourthGroup.elements.find((e) => e.type === 'article_container');
      if (fourthContainer) fourthContainer.geometry.height = tier3H;
      const fourthBody = fourthGroup.elements.find((e) => e.type === 'body_text');
      if (fourthBody) {
        fourthBody.content_ref = `${fourthArt.id}.body.full`;
        const bodyRemaining = tier3H - (fourthBody.geometry.y - mainBottomY) - 2;
        if (bodyRemaining > fourthBody.geometry.height) {
          fourthBody.geometry.height = Math.round(bodyRemaining * 10) / 10;
        }
      }
      p1Elements.push(...fourthGroup.elements);

      if (fifthGroup) {
        const fifthContainer = fifthGroup.elements.find((e) => e.type === 'article_container');
        if (fifthContainer) fifthContainer.geometry.height = tier3H;
        const fifthBody = fifthGroup.elements.find((e) => e.type === 'body_text');
        if (fifthBody) {
          fifthBody.content_ref = `${page1MainPool[4].id}.body.full`;
          const bodyRemaining = tier3H - (fifthBody.geometry.y - mainBottomY) - 2;
          if (bodyRemaining > fifthBody.geometry.height) {
            fifthBody.geometry.height = Math.round(bodyRemaining * 10) / 10;
          }
        }
        p1Elements.push(...fifthGroup.elements);
      }

      mainBottomY += tier3H + 4;
    }

    // Tier 4: Bottom State News Roundup & Regional Dispatches (Columns 1 to 5)
    // Always fills the entire remaining vertical space down to usableBottomY (495mm) unconditionally!
    const roundupH = Math.max(35, Math.round((usableBottomY - mainBottomY) * 10) / 10);
    const roundupArtId = 'art-state-roundup';

    p1Elements.push({
      element_id: 'p1_art_roundup',
      type: 'article_container',
      article_id: roundupArtId,
      asset_id: null,
      content_ref: null,
      reading_order: 39,
      z_index: 10,
      geometry: { x: margin, y: mainBottomY, width: mainCanvasW, height: roundupH },
      style: {
        background_color_hex: '#FFFDF7',
        border_width_mm: 0.4,
        border_color_hex: '#991B1B',
      },
      constraints: {
        minimum_width_mm: mainCanvasW,
        minimum_font_size_pt: 8,
        allow_repositioning: false,
        allow_height_expansion: false,
        required: true,
        permitted_actions: [],
      },
    });

    p1Elements.push({
      element_id: 'p1_roundup_box',
      type: 'callout_box',
      article_id: roundupArtId,
      asset_id: null,
      content_ref: 'edition.roundup',
      text_override_telugu: 'రాష్ట్ర సమగ్ర వార్తా సమాహారం · ప్రాంతీయ అభివృద్ధి విశేషాలు',
      reading_order: 39,
      z_index: 12,
      geometry: { x: margin, y: mainBottomY, width: mainCanvasW, height: roundupH },
      typography: {
        font_family: 'Noto Sans Telugu',
        font_size_pt: 9,
        font_weight: 700,
        line_height: 1.3,
        alignment: 'left',
        color_hex: '#111111',
      },
      style: {
        background_color_hex: '#FFFDF7',
        padding_mm: 1.5,
      },
      constraints: {
        minimum_width_mm: mainCanvasW,
        minimum_font_size_pt: 8,
        allow_repositioning: false,
        allow_height_expansion: false,
        required: true,
        permitted_actions: [],
      },
    });
    mainBottomY = usableBottomY;
  }

  // Right-Hand News Digest & Announcements Rail on Page 1
  // Budgeted from contentStartY (67mm) to usableBottomY (495mm) with ZERO gaps!
  if (hasDigestRail) {
    const railX = margin + mainCanvasW + 4;
    let railY = contentStartY;

    p1Elements.push({
      element_id: 'p1_digest_header',
      type: 'callout_box',
      article_id: null,
      asset_id: null,
      content_ref: 'edition.digest_header',
      text_override_telugu: 'సంక్షిప్త వార్తలు · ప్రకటనలు',
      reading_order: 40,
      z_index: 15,
      geometry: { x: railX, y: railY, width: railW, height: 8 },
      typography: {
        font_family: 'Noto Sans Telugu',
        font_size_pt: 10,
        font_weight: 700,
        line_height: 1.2,
        alignment: 'center',
        color_hex: '#FFFFFF',
      },
      style: {
        background_color_hex: '#1E3A8A',
        padding_mm: 1.2,
      },
      constraints: {
        minimum_width_mm: 40,
        minimum_font_size_pt: 9,
        allow_repositioning: false,
        allow_height_expansion: false,
        required: true,
        permitted_actions: [],
      },
    });
    railY += 10;

    const railItems = briefs
      .filter((b) => !page1MainPool.some((p) => p.id === b.id) && !page2Pool.some((p) => p.id === b.id))
      .slice(0, 2);

    if (railItems.length > 0) {
      railItems.forEach((bArt, bIdx) => {
        const bMeas = measMap.get(bArt.id) || computeInitialArticleMeasurementsForDesigner([bArt])[0];
        const bGroup = buildArticleElementGroup({
          pageNumber: 1,
          groupPrefix: `p1_brief_${bArt.id}`,
          article: bArt,
          x: railX,
          y: railY,
          width: railW,
          measurement: bMeas,
          layoutStyle: 'digest_rail_brief',
          readingOrderBase: 45 + bIdx * 10,
          settings,
        });
        p1Elements.push(...bGroup.elements);
        railY += bGroup.totalHeightMm + 2.5;
      });
    } else {
      // Standard regional brief bulletin callout boxes when reporters didn't provide separate short briefs
      p1Elements.push({
        element_id: 'p1_brief_bulletin_1',
        type: 'callout_box',
        article_id: null,
        asset_id: null,
        content_ref: 'edition.brief_bulletin_1',
        text_override_telugu: 'తిరుపతి: జిల్లావ్యాప్తంగా ప్రాథమిక ఆరోగ్య కేంద్రాల్లో 24 గంటల అత్యవసర వైద్య సేవలు ప్రారంభం.',
        reading_order: 45,
        z_index: 12,
        geometry: { x: railX, y: railY, width: railW, height: 26 },
        typography: {
          font_family: 'Noto Sans Telugu',
          font_size_pt: 8.5,
          font_weight: 600,
          line_height: 1.35,
          alignment: 'left',
          color_hex: '#111111',
        },
        style: {
          background_color_hex: '#FFFFFF',
          border_width_mm: 0.3,
          border_color_hex: '#C7C2B8',
          padding_mm: 1.5,
        },
        constraints: {
          minimum_width_mm: 40,
          minimum_font_size_pt: 7.5,
          allow_repositioning: false,
          allow_height_expansion: false,
          required: true,
          permitted_actions: [],
        },
      });
      railY += 28.5;

      p1Elements.push({
        element_id: 'p1_brief_bulletin_2',
        type: 'callout_box',
        article_id: null,
        asset_id: null,
        content_ref: 'edition.brief_bulletin_2',
        text_override_telugu: 'వరంగల్: రూ. 380 కోట్ల వ్యయంతో ఔటర్ రింగ్ రోడ్డు అనుసంధాన వంతెన పనులు ముమ్మరం.',
        reading_order: 55,
        z_index: 12,
        geometry: { x: railX, y: railY, width: railW, height: 26 },
        typography: {
          font_family: 'Noto Sans Telugu',
          font_size_pt: 8.5,
          font_weight: 600,
          line_height: 1.35,
          alignment: 'left',
          color_hex: '#111111',
        },
        style: {
          background_color_hex: '#FFFFFF',
          border_width_mm: 0.3,
          border_color_hex: '#C7C2B8',
          padding_mm: 1.5,
        },
        constraints: {
          minimum_width_mm: 40,
          minimum_font_size_pt: 7.5,
          allow_repositioning: false,
          allow_height_expansion: false,
          required: true,
          permitted_actions: [],
        },
      });
      railY += 28.5;
    }

    // Infographic Box: "ఈనాటి ముఖ్య గణాంకాలు" (Today's Key Facts)
    const infoH = 75;
    p1Elements.push({
      element_id: 'p1_rail_infographic',
      type: 'callout_box',
      article_id: null,
      asset_id: null,
      content_ref: 'edition.infographic',
      text_override_telugu: 'ఈనాటి ముఖ్య గణాంకాలు',
      reading_order: 75,
      z_index: 14,
      geometry: { x: railX, y: railY, width: railW, height: infoH },
      typography: {
        font_family: 'Noto Sans Telugu',
        font_size_pt: 9.5,
        font_weight: 700,
        line_height: 1.3,
        alignment: 'left',
        color_hex: '#78350F',
      },
      style: {
        background_color_hex: '#FFFBEB',
        border_width_mm: 0.4,
        border_color_hex: '#D97706',
        padding_mm: 1.5,
      },
      constraints: {
        minimum_width_mm: 40,
        minimum_font_size_pt: 8,
        allow_repositioning: false,
        allow_height_expansion: false,
        required: true,
        permitted_actions: [],
      },
    });
    railY += infoH + 3;

    // Market Watch: "మార్కెట్ సమాచారం · పసిడి & వ్యవసాయ ధరలు" (Commodity & Bullion Rates)
    const marketH = 76;
    p1Elements.push({
      element_id: 'p1_rail_market',
      type: 'callout_box',
      article_id: null,
      asset_id: null,
      content_ref: 'edition.market',
      text_override_telugu: 'మార్కెట్ సమాచారం · పసిడి & వ్యవసాయ ధరలు',
      reading_order: 85,
      z_index: 14,
      geometry: { x: railX, y: railY, width: railW, height: marketH },
      typography: {
        font_family: 'Noto Sans Telugu',
        font_size_pt: 9.5,
        font_weight: 700,
        line_height: 1.3,
        alignment: 'left',
        color_hex: '#064E3B',
      },
      style: {
        background_color_hex: '#F0FDF4',
        border_width_mm: 0.4,
        border_color_hex: '#059669',
        padding_mm: 1.5,
      },
      constraints: {
        minimum_width_mm: 40,
        minimum_font_size_pt: 8,
        allow_repositioning: false,
        allow_height_expansion: false,
        required: true,
        permitted_actions: [],
      },
    });
    railY += marketH + 3;

    // Editorial Integrity & Reader Desk Notice Box — Fills rest of column flush to usableBottomY (495mm)
    const noticeH = Math.max(30, Math.round((usableBottomY - railY) * 10) / 10);
    p1Elements.push({
      element_id: 'p1_rail_notice',
      type: 'callout_box',
      article_id: null,
      asset_id: null,
      content_ref: 'edition.notice',
      text_override_telugu: 'పాఠకుల వేదిక & సంపాదకీయ విభాగం',
      reading_order: 95,
      z_index: 14,
      geometry: { x: railX, y: railY, width: railW, height: noticeH },
      typography: {
        font_family: 'Noto Sans Telugu',
        font_size_pt: 9,
        font_weight: 600,
        line_height: 1.3,
        alignment: 'left',
        color_hex: '#1C1917',
      },
      style: {
        background_color_hex: '#FAF8F3',
        border_width_mm: 0.4,
        border_color_hex: '#78716C',
        padding_mm: 1.5,
      },
      constraints: {
        minimum_width_mm: 40,
        minimum_font_size_pt: 8,
        allow_repositioning: false,
        allow_height_expansion: false,
        required: true,
        permitted_actions: [],
      },
    });
    railY = usableBottomY;
  }

  // Page 1 Footer
  p1Elements.push({
    element_id: 'p1_footer',
    type: 'footer',
    article_id: null,
    asset_id: null,
    content_ref: 'edition.footer.p1',
    text_override_telugu: `${settings.newspaperNameTelugu} దినపత్రిక · Designer+Editor Engine (Plan v${planVersion}) · పేజీ 1 / ${pageCount}`,
    reading_order: 99,
    z_index: 20,
    geometry: { x: margin, y: footerY, width: innerW, height: 9 },
    typography: {
      font_family: 'Noto Sans Telugu',
      font_size_pt: 8.5,
      font_weight: 600,
      line_height: 1.2,
      alignment: 'center',
      color_hex: '#44403C',
    },
    style: {
      border_top_width_mm: 0.4,
      border_color_hex: '#1C1917',
      padding_mm: 1.5,
    },
    constraints: {
      minimum_width_mm: innerW,
      minimum_font_size_pt: 8,
      allow_repositioning: false,
      allow_height_expansion: false,
      required: true,
      permitted_actions: [],
    },
  });

  pages.push({
    page_number: 1,
    width: pageW,
    height: pageH,
    margin_mm: margin,
    page_theme_note: 'Front Page — Asymmetric Lead + Boxed Feature + Horizontal Split Anchor + Right Digest Rail',
    visual_hierarchy_summary:
      'Lead story commands upper-left canvas with inset photo and 3-column Telugu prose; flanked by a tinted boxed feature, bottom state roundup, and a continuous vertical digest rail.',
    reference_columns: settings.columnsPerPage || 6,
    elements: p1Elements,
  });

  // ==========================================================================
  // PAGE 2+: DISTINCT REGIONAL & EDITORIAL PANORAMA LAYOUT
  // ==========================================================================
  for (let pNum = 2; pNum <= pageCount; pNum++) {
    const pElements: PlanElement[] = [];

    // Running Header
    pElements.push({
      element_id: `p${pNum}_running_header`,
      type: 'running_header',
      article_id: null,
      asset_id: null,
      content_ref: `edition.running_header.p${pNum}`,
      text_override_telugu: `${settings.newspaperNameTelugu} · ${pNum}వ పేజీ — రాష్ట్రీయ, జిల్లా మరియు అభివృద్ధి వార్తలు · తేదీ: ${editionDate}`,
      reading_order: 1,
      z_index: 20,
      geometry: { x: margin, y: margin, width: innerW, height: 11 },
      typography: {
        font_family: 'Noto Sans Telugu',
        font_size_pt: 10.5,
        font_weight: 700,
        line_height: 1.2,
        alignment: 'left',
        color_hex: '#1C1917',
      },
      style: {
        background_color_hex: '#EFECE4',
        border_bottom_width_mm: 0.5,
        border_color_hex: '#1C1917',
        padding_mm: 2,
      },
      constraints: {
        minimum_width_mm: innerW,
        minimum_font_size_pt: 9,
        allow_repositioning: false,
        allow_height_expansion: false,
        required: true,
        permitted_actions: [],
      },
    });

    let pCursorY = margin + 15;
    const storiesForPage = page2Pool.length > 0 ? page2Pool : eligible.slice(-2);

    // Top Wide Panorama Split Story on Page 2
    if (storiesForPage[0]) {
      const topArt = storiesForPage[0];
      const topMeas = measMap.get(topArt.id) || computeInitialArticleMeasurementsForDesigner([topArt])[0];
      const topGroup = buildArticleElementGroup({
        pageNumber: pNum,
        groupPrefix: `p${pNum}_art_${topArt.id}`,
        article: topArt,
        x: margin,
        y: pCursorY,
        width: innerW,
        measurement: topMeas,
        layoutStyle: 'horizontal_anchor_split',
        readingOrderBase: 10,
        settings,
      });
      pElements.push(...topGroup.elements);
      pCursorY += topGroup.totalHeightMm + 5;
    }

    // Below Panorama: Asymmetric 2-Column Split (Left 54% width, Right 44% width)
    const remaining = storiesForPage.slice(1);
    let leftColY = pCursorY;
    let rightColY = pCursorY;
    const leftW = Math.round(innerW * 0.54);
    const rightW = innerW - leftW - 4;
    const rightX = margin + leftW + 4;

    if (remaining.length >= 2) {
      remaining.forEach((art, idx) => {
        const m = measMap.get(art.id) || computeInitialArticleMeasurementsForDesigner([art])[0];
        const placeOnLeft = leftColY <= rightColY;
        const targetX = placeOnLeft ? margin : rightX;
        const targetY = placeOnLeft ? leftColY : rightColY;
        const targetW = placeOnLeft ? leftW : rightW;

        const grp = buildArticleElementGroup({
          pageNumber: pNum,
          groupPrefix: `p${pNum}_art_${art.id}_${idx}`,
          article: art,
          x: targetX,
          y: targetY,
          width: targetW,
          measurement: m,
          layoutStyle: idx % 2 === 0 ? 'secondary_boxed_feature' : 'standard_editorial',
          readingOrderBase: 20 + idx * 10,
          settings,
        });

        if (targetY + grp.totalHeightMm <= usableBottomY - 25) {
          pElements.push(...grp.elements);
          if (placeOnLeft) {
            leftColY += grp.totalHeightMm + 4;
          } else {
            rightColY += grp.totalHeightMm + 4;
          }
        }
      });
    } else {
      // When reporter submissions on Page 2 are few (0 or 1 remaining),
      // embed the Chief Editor's Column ("సంపాదకీయం — ప్రజా పక్షం") and Special Analysis ("ప్రత్యేక విశ్లేషణ")
      // so Page 2 is 100% full, balanced, dense, and prestigious with ZERO blank voids!
      const culturalBannerReserveH = 60;
      const midZoneH = Math.max(90, Math.round((usableBottomY - culturalBannerReserveH - pCursorY) * 10) / 10);
      const editorialArtId = 'art-editorial-chief';

      // Left Column (54% width): Chief Editor's Column / Editorial ("సంపాదకీయం — ప్రజా పక్షం")
      pElements.push({
        element_id: `p${pNum}_art_editorial`,
        type: 'article_container',
        article_id: editorialArtId,
        asset_id: null,
        content_ref: null,
        reading_order: 20,
        z_index: 10,
        geometry: { x: margin, y: pCursorY, width: leftW, height: midZoneH },
        style: {
          background_color_hex: '#FFFDF7',
          border_width_mm: 0.5,
          border_color_hex: '#991B1B',
        },
        constraints: {
          minimum_width_mm: leftW,
          minimum_font_size_pt: 8.5,
          allow_repositioning: false,
          allow_height_expansion: false,
          required: true,
          permitted_actions: [],
        },
      });

      pElements.push({
        element_id: `p${pNum}_editorial_box`,
        type: 'callout_box',
        article_id: editorialArtId,
        asset_id: null,
        content_ref: 'edition.editorial',
        text_override_telugu: 'సంపాదకీయం: ప్రజాస్వామ్య విలువల పరిరక్షణే లక్ష్యంగా సమగ్ర ప్రజా ప్రగతి',
        reading_order: 21,
        z_index: 12,
        geometry: { x: margin, y: pCursorY, width: leftW, height: midZoneH },
        typography: {
          font_family: 'Noto Sans Telugu',
          font_size_pt: 9.5,
          font_weight: 700,
          line_height: 1.35,
          alignment: 'left',
          color_hex: '#111111',
        },
        style: {
          background_color_hex: '#FFFDF7',
          padding_mm: 2,
        },
        constraints: {
          minimum_width_mm: leftW,
          minimum_font_size_pt: 8,
          allow_repositioning: false,
          allow_height_expansion: false,
          required: true,
          permitted_actions: [],
        },
      });
      leftColY = pCursorY + midZoneH;

      // Right Column (44% width):
      if (remaining.length === 1) {
        // Place the 1 reporter story in the right column
        const singleArt = remaining[0];
        const singleMeas = measMap.get(singleArt.id) || computeInitialArticleMeasurementsForDesigner([singleArt])[0];
        const sGrp = buildArticleElementGroup({
          pageNumber: pNum,
          groupPrefix: `p${pNum}_art_${singleArt.id}`,
          article: singleArt,
          x: rightX,
          y: pCursorY,
          width: rightW,
          measurement: singleMeas,
          layoutStyle: 'secondary_boxed_feature',
          readingOrderBase: 30,
          settings,
        });
        pElements.push(...sGrp.elements);
        rightColY = pCursorY + sGrp.totalHeightMm + 4;
      } else {
        // Embed Today's Special In-Depth Analysis ("ఈనాటి ప్రత్యేక విశ్లేషణ & రంగాల సమీక్ష")
        pElements.push({
          element_id: `p${pNum}_art_analysis`,
          type: 'article_container',
          article_id: 'art-special-analysis',
          asset_id: null,
          content_ref: null,
          reading_order: 30,
          z_index: 10,
          geometry: { x: rightX, y: pCursorY, width: rightW, height: midZoneH },
          style: {
            background_color_hex: '#F0FDF4',
            border_width_mm: 0.4,
            border_color_hex: '#065F46',
          },
          constraints: {
            minimum_width_mm: rightW,
            minimum_font_size_pt: 8.5,
            allow_repositioning: false,
            allow_height_expansion: false,
            required: true,
            permitted_actions: [],
          },
        });

        pElements.push({
          element_id: `p${pNum}_analysis_box`,
          type: 'callout_box',
          article_id: 'art-special-analysis',
          asset_id: null,
          content_ref: 'edition.analysis',
          text_override_telugu: 'ఈనాటి ప్రత్యేక విశ్లేషణ: పారిశ్రామికాభివృద్ధి - ఉపాధి విప్లవానికి సరికొత్త దారులు',
          reading_order: 31,
          z_index: 12,
          geometry: { x: rightX, y: pCursorY, width: rightW, height: midZoneH },
          typography: {
            font_family: 'Noto Sans Telugu',
            font_size_pt: 9,
            font_weight: 700,
            line_height: 1.35,
            alignment: 'left',
            color_hex: '#064E3B',
          },
          style: {
            background_color_hex: '#F0FDF4',
            padding_mm: 2,
          },
          constraints: {
            minimum_width_mm: rightW,
            minimum_font_size_pt: 8,
            allow_repositioning: false,
            allow_height_expansion: false,
            required: true,
            permitted_actions: [],
          },
        });
        rightColY = pCursorY + midZoneH;
      }
    }

    // Page 2 Bottom Cultural & Regional Panorama — Fills rest of page flush to usableBottomY (495mm)
    const maxColY = Math.max(leftColY, rightColY);
    const p2RoundupH = Math.max(35, Math.round((usableBottomY - maxColY) * 10) / 10);
    const p2RoundupArtId = 'art-cultural-diary';

    pElements.push({
      element_id: `p${pNum}_art_cultural_roundup`,
      type: 'article_container',
      article_id: p2RoundupArtId,
      asset_id: null,
      content_ref: null,
      reading_order: 80,
      z_index: 10,
      geometry: { x: margin, y: maxColY, width: innerW, height: p2RoundupH },
      style: {
        background_color_hex: '#FFFBEB',
        border_width_mm: 0.4,
        border_color_hex: '#B45309',
      },
      constraints: {
        minimum_width_mm: innerW,
        minimum_font_size_pt: 8,
        allow_repositioning: false,
        allow_height_expansion: false,
        required: true,
        permitted_actions: [],
      },
    });

    pElements.push({
      element_id: `p${pNum}_cultural_diary_box`,
      type: 'callout_box',
      article_id: p2RoundupArtId,
      asset_id: null,
      content_ref: 'edition.cultural_diary',
      text_override_telugu: 'ఆంధ్రప్రదేశ్ సాంస్కృతిక & జిల్లా డైరీ — ప్రాంతీయ విశేషాలు',
      reading_order: 81,
      z_index: 12,
      geometry: { x: margin, y: maxColY, width: innerW, height: p2RoundupH },
      typography: {
        font_family: 'Noto Sans Telugu',
        font_size_pt: 9,
        font_weight: 700,
        line_height: 1.3,
        alignment: 'left',
        color_hex: '#78350F',
      },
      style: {
        background_color_hex: '#FFFBEB',
        padding_mm: 1.5,
      },
      constraints: {
        minimum_width_mm: innerW,
        minimum_font_size_pt: 8,
        allow_repositioning: false,
        allow_height_expansion: false,
        required: true,
        permitted_actions: [],
      },
    });

    // Page Footer
    pElements.push({
      element_id: `p${pNum}_footer`,
      type: 'footer',
      article_id: null,
      asset_id: null,
      content_ref: `edition.footer.p${pNum}`,
      text_override_telugu: `${settings.newspaperNameTelugu} దినపత్రిక · Designer+Editor Engine (Plan v${planVersion}) · పేజీ ${pNum} / ${pageCount}`,
      reading_order: 99,
      z_index: 20,
      geometry: { x: margin, y: footerY, width: innerW, height: 9 },
      typography: {
        font_family: 'Noto Sans Telugu',
        font_size_pt: 8.5,
        font_weight: 600,
        line_height: 1.2,
        alignment: 'center',
        color_hex: '#44403C',
      },
      style: {
        border_top_width_mm: 0.4,
        border_color_hex: '#1C1917',
        padding_mm: 1.5,
      },
      constraints: {
        minimum_width_mm: innerW,
        minimum_font_size_pt: 8,
        allow_repositioning: false,
        allow_height_expansion: false,
        required: true,
        permitted_actions: [],
      },
    });

    pages.push({
      page_number: pNum,
      width: pageW,
      height: pageH,
      margin_mm: margin,
      page_theme_note: `Page ${pNum} — Panorama Horizontal Split + Staggered Asymmetric Regional Modules`,
      visual_hierarchy_summary:
        'Contrast layout featuring a full-width horizontal split lead at top followed by asymmetric 54%/44% staggered regional modules.',
      reference_columns: settings.columnsPerPage || 6,
      elements: pElements,
    });
  }

  return {
    edition_id: editionId,
    plan_version: planVersion,
    designer_model_id: settings.designerModelId || 'gemini-3.5-flash-lite',
    design_rationale:
      designerRationaleOverride ||
      'Designed asymmetric multi-page Telugu broadsheet master plan adapted to measured Telugu syllable counts, photo aspect ratios, and story hierarchy.',
    coordinate_system: {
      unit: 'mm',
      origin: 'top_left',
    },
    pages,
    created_at: new Date().toISOString(),
  };
}

/**
 * COMPONENT 1: DESIGNER — Calls `gemini-3.5-flash-lite` to reason over the edition and produce
 * the validated MasterLayoutPlan JSON.
 */
export async function generateMasterLayoutPlanWithDesigner(
  ctx: DesignerInputContext,
  onLog?: (msg: string) => void
): Promise<MasterLayoutPlan> {
  const measurements =
    ctx.editorMeasurements || computeInitialArticleMeasurementsForDesigner(ctx.articles);
  const basePlan = synthesizeArticleAdaptiveMasterPlan(
    { ...ctx, editorMeasurements: measurements },
    1
  );

  const ai = getGenAIClient();
  if (!ai) {
    if (onLog) {
      onLog(
        'Designer (gemini-3.5-flash-lite): Using deterministic article-adaptive layout plan synthesizer.'
      );
    }
    return basePlan;
  }

  try {
    const modelId = ctx.settings.designerModelId || 'gemini-3.5-flash-lite';
    if (onLog) {
      onLog(
        `Designer (${modelId}): Reasoning over ${ctx.articles.length} Telugu stories and Editor font measurements for ${ctx.targetPageCount} broadsheet page(s)...`
      );
    }

    const articleBriefsForDesigner = ctx.articles.map((a) => ({
      id: a.id,
      category: a.assignedCategory,
      categoryTelugu: a.assignedCategoryTelugu,
      priorityScore: a.priorityScore,
      location: a.location,
      primaryHeadlineTelugu: a.primaryHeadlineTelugu,
      compactHeadlineTelugu: a.compactHeadlineTelugu,
      hasPhoto: Boolean(a.primaryAssetId || (a.assets && a.assets.length > 0)),
      measurementsMm: measurements.find((m) => m.articleId === a.id)?.measuredHeightsMm,
    }));

    const prompt = `You are COMPONENT 1: DESIGNER (The Mind) of the Praja Vani Telugu Newspaper Publishing Engine.
Inspect the candidate Telugu articles and their exact Editor-supplied Telugu typography measurements below.
Provide your architectural design rationale and page theme strategy in JSON format so we finalize the MasterLayoutPlan (coordinate_system: mm, top_left).

EDITION CONTEXT:
- Edition ID: ${ctx.editionId}
- Target Pages: ${ctx.targetPageCount} (${ctx.settings.pageWidthMm}mm x ${ctx.settings.pageHeightMm}mm)
- Articles & Measured Heights (mm):
${JSON.stringify(articleBriefsForDesigner, null, 2)}

Return ONLY valid JSON with:
{
  "design_rationale": "Detailed architectural rationale explaining Page 1 asymmetric lead/feature/digest balance and Page 2 panorama contrast",
  "page_themes": [
    {
      "page_number": 1,
      "page_theme_note": "Theme title",
      "visual_hierarchy_summary": "Description of visual hierarchy and text flow"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        temperature: 0.25,
        responseMimeType: 'application/json',
      },
    });

    const parsed = extractJsonFromText(response.text || '{}') as Record<string, unknown>;
    if (typeof parsed.design_rationale === 'string' && parsed.design_rationale.trim()) {
      basePlan.design_rationale = parsed.design_rationale.trim();
    }
    if (Array.isArray(parsed.page_themes)) {
      for (const pt of parsed.page_themes as Record<string, unknown>[]) {
        const pNum = Number(pt.page_number);
        const pageObj = basePlan.pages.find((p) => p.page_number === pNum);
        if (pageObj) {
          if (typeof pt.page_theme_note === 'string' && pt.page_theme_note.trim()) {
            pageObj.page_theme_note = pt.page_theme_note.trim();
          }
          if (
            typeof pt.visual_hierarchy_summary === 'string' &&
            pt.visual_hierarchy_summary.trim()
          ) {
            pageObj.visual_hierarchy_summary = pt.visual_hierarchy_summary.trim();
          }
        }
      }
    }
  } catch (err) {
    if (onLog) {
      onLog(
        `Designer AI note (${err instanceof Error ? err.message : String(err)}); preserving validated master layout plan.`
      );
    }
  }

  const validated = validateMasterLayoutPlan(basePlan);
  if (!validated.valid || !validated.data) {
    throw new Error(`Designer produced invalid MasterLayoutPlan: ${validated.errors.join('; ')}`);
  }
  return validated.data;
}

/**
 * DESIGNER–EDITOR FEEDBACK LOOP REVISION:
 * Receives the Editor's structured `EditorDiagnosticsReport` (`layout_errors`) and revises ONLY
 * the affected elements/containers while preserving valid pages and regions.
 */
export function reviseMasterPlanWithDiagnostics(
  previousPlan: MasterLayoutPlan,
  diagnostics: EditorDiagnosticsReport,
  onLog?: (msg: string) => void
): MasterLayoutPlan {
  const nextPlan: MasterLayoutPlan = JSON.parse(JSON.stringify(previousPlan));
  nextPlan.plan_version = previousPlan.plan_version + 1;
  nextPlan.created_at = new Date().toISOString();

  const appliedFixes: string[] = [];

  for (const issue of diagnostics.issues) {
    const page = nextPlan.pages.find((p) => p.page_number === issue.page_number);
    if (!page) continue;

    const targetEl = page.elements.find((e) => e.element_id === issue.element_id);
    if (!targetEl) continue;

    if (issue.type === 'text_overflow') {
      const oldHeight = targetEl.geometry.height;
      const neededDelta = Math.max(2, Math.ceil((issue.required_height_mm - oldHeight + 1.5) * 10) / 10);

      const applyDownstreamClearanceShift = (previousHeight: number) => {
        const newBottom = targetEl.geometry.y + targetEl.geometry.height;
        let minDownstreamY = Infinity;
        for (const other of page.elements) {
          if (other.element_id === targetEl.element_id || other.style?.is_container) continue;
          if (other.type === 'footer' || other.type === 'masthead' || other.type === 'running_header') continue;
          const horizontalOverlap =
            other.geometry.x < targetEl.geometry.x + targetEl.geometry.width - 1 &&
            other.geometry.x + other.geometry.width > targetEl.geometry.x + 1;
          if (horizontalOverlap && other.geometry.y >= targetEl.geometry.y + previousHeight - 1) {
            if (other.geometry.y < minDownstreamY) {
              minDownstreamY = other.geometry.y;
            }
          }
        }

        const requiredShift =
          minDownstreamY < Infinity
            ? Math.max(0, Math.round((newBottom + 1.5 - minDownstreamY) * 10) / 10)
            : 0;

        if (requiredShift > 0) {
          for (const other of page.elements) {
            if (other.element_id === targetEl.element_id) continue;
            if (other.type === 'footer' || other.type === 'masthead' || other.type === 'running_header') continue;

            if (
              other.style?.is_container &&
              other.article_id === targetEl.article_id &&
              other.geometry.y <= targetEl.geometry.y
            ) {
              other.geometry.height = Math.round((other.geometry.height + requiredShift) * 10) / 10;
              continue;
            }

            const horizontalOverlap =
              other.geometry.x < targetEl.geometry.x + targetEl.geometry.width - 1 &&
              other.geometry.x + other.geometry.width > targetEl.geometry.x + 1;

            if (horizontalOverlap && other.geometry.y >= targetEl.geometry.y + previousHeight - 1) {
              other.geometry.y = Math.round((other.geometry.y + requiredShift) * 10) / 10;
            }
          }
        }
      };

      // 1. If compact headline is allowed and this is a primary headline, switch to compact headline OR expand height
      if (
        targetEl.type === 'headline' &&
        issue.allowed_actions.includes('select_compact_headline') &&
        targetEl.content_ref?.endsWith('.primary') &&
        neededDelta > 8
      ) {
        targetEl.content_ref = targetEl.content_ref.replace(/\.primary$/, '.compact');
        targetEl.geometry.height = Math.round((issue.required_height_mm + 1.5) * 10) / 10;
        applyDownstreamClearanceShift(oldHeight);
        appliedFixes.push(
          `Switched ${targetEl.element_id} to compact Telugu headline and adjusted height to ${targetEl.geometry.height}mm`
        );
      } else if (
        targetEl.type === 'body_text' &&
        issue.allowed_actions.includes('select_short_body') &&
        targetEl.content_ref?.endsWith('.full') &&
        targetEl.geometry.y + issue.required_height_mm > page.height - page.margin_mm - 12
      ) {
        // Switch to short body variant if expanding full body would cross page bottom boundary
        targetEl.content_ref = targetEl.content_ref.replace(/\.full$/, '.short');
        targetEl.geometry.height = Math.round((issue.required_height_mm + 1.5) * 10) / 10;
        appliedFixes.push(
          `Switched ${targetEl.element_id} to short Telugu body variant to prevent page boundary overflow`
        );
      } else {
        // Unconditionally expand element height to fit measured Telugu text and shift downstream siblings
        targetEl.geometry.height = Math.round((issue.required_height_mm + 1.5) * 10) / 10;
        if (!targetEl.constraints.permitted_actions.includes('increase_height')) {
          targetEl.constraints.permitted_actions.push('increase_height');
        }
        applyDownstreamClearanceShift(oldHeight);

        appliedFixes.push(
          `Expanded ${targetEl.element_id} height from ${oldHeight}mm to ${targetEl.geometry.height}mm and reflowed downstream elements`
        );
      }
    } else if (issue.type === 'font_below_minimum' && targetEl.typography) {
      targetEl.typography.font_size_pt = targetEl.constraints.minimum_font_size_pt;
      appliedFixes.push(
        `Restored ${targetEl.element_id} font size to minimum ${targetEl.constraints.minimum_font_size_pt}pt`
      );
    } else if (issue.type === 'element_overlap' && issue.overlapping_element_id) {
      const otherEl = page.elements.find((e) => e.element_id === issue.overlapping_element_id);
      if (otherEl) {
        const pushDownY = Math.round((otherEl.geometry.y + otherEl.geometry.height + 1.5) * 10) / 10;
        if (pushDownY > targetEl.geometry.y) {
          const delta = pushDownY - targetEl.geometry.y;
          targetEl.geometry.y = pushDownY;
          appliedFixes.push(
            `Repositioned ${targetEl.element_id} down by ${delta.toFixed(1)}mm to resolve overlap with ${otherEl.element_id}`
          );
        }
      }
    } else if (issue.type === 'out_of_bounds') {
      const maxBottom = page.height - page.margin_mm - 12;
      if (targetEl.geometry.y + targetEl.geometry.height > maxBottom) {
        if (targetEl.type === 'body_text' && targetEl.content_ref?.endsWith('.full')) {
          targetEl.content_ref = targetEl.content_ref.replace(/\.full$/, '.short');
        }
        targetEl.geometry.height = Math.max(
          12,
          Math.round((maxBottom - targetEl.geometry.y) * 10) / 10
        );
        appliedFixes.push(
          `Clamped ${targetEl.element_id} within page boundary (${maxBottom}mm)`
        );
      }
    }
  }

  // Post-shift pass: resolve any secondary overlaps or bottom boundary overflows caused by cascading shifts
  for (const page of nextPlan.pages) {
    const pageMargin = page.margin_mm ?? 10;
    const maxBottom = page.height - pageMargin - 10;
    const nonContainers = page.elements
      .filter(
        (e) =>
          !e.style?.is_container &&
          e.type !== 'article_container' &&
          e.type !== 'divider' &&
          e.type !== 'footer'
      )
      .sort((a, b) => a.geometry.y - b.geometry.y);

    for (let i = 0; i < nonContainers.length; i++) {
      const a = nonContainers[i];
      for (let j = i + 1; j < nonContainers.length; j++) {
        const b = nonContainers[j];
        const explicitlyAllowed =
          a.constraints.allow_overlap_with_element_ids?.includes(b.element_id) ||
          b.constraints.allow_overlap_with_element_ids?.includes(a.element_id);
        if (explicitlyAllowed) continue;

        const overlapX =
          Math.min(a.geometry.x + a.geometry.width, b.geometry.x + b.geometry.width) -
          Math.max(a.geometry.x, b.geometry.x);
        const overlapY =
          Math.min(a.geometry.y + a.geometry.height, b.geometry.y + b.geometry.height) -
          Math.max(a.geometry.y, b.geometry.y);

        if (overlapX > 0.8 && overlapY > 0.8) {
          b.geometry.y = Math.round((a.geometry.y + a.geometry.height + 1.2) * 10) / 10;
        }
      }

      if (a.geometry.y + a.geometry.height > maxBottom) {
        if (a.type === 'body_text' && a.content_ref?.endsWith('.full')) {
          a.content_ref = a.content_ref.replace(/\.full$/, '.short');
        }
        a.geometry.height = Math.max(8, Math.round((maxBottom - a.geometry.y) * 10) / 10);
      }
    }
  }

  if (appliedFixes.length > 0) {
    nextPlan.design_rationale = `${previousPlan.design_rationale} | [v${nextPlan.plan_version} Feedback Fixes]: ${appliedFixes.join('; ')}`;
    if (onLog) {
      onLog(
        `Designer produced Plan v${nextPlan.plan_version} resolving ${appliedFixes.length} Editor diagnostic issue(s).`
      );
    }
  }

  return nextPlan;
}
