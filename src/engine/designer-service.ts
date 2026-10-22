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
        border_color_hex: '#A8A29E',
        geometric_shape: geometricShape,
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
    const isBottomTier = y >= 285;
    if (primaryAsset && layoutStyle !== 'digest_rail_brief' && !isBottomTier) {
      const photoH = layoutStyle === 'lead_asymmetric_inset' ? 50 : 38;
      const captionH = 9.5;

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
        : innerW >= 100
        ? 2
        : 1;

    const useShortBody = layoutStyle === 'digest_rail_brief' || isBottomTier;
    const measuredBodyH =
      layoutStyle === 'lead_asymmetric_inset'
        ? (innerW < 160
            ? measurement.measuredHeightsMm.lead_195mm_width.bodyFull3ColMm * 1.35 + 4
            : measurement.measuredHeightsMm.lead_195mm_width.bodyFull3ColMm + 4)
        : layoutStyle === 'digest_rail_brief'
        ? measurement.measuredHeightsMm.single_62mm_width.bodyShort1ColMm * 1.35 + 4
        : useShortBody
        ? cols === 2
          ? measurement.measuredHeightsMm.feature_128mm_width.bodyShort2ColMm + 4
          : measurement.measuredHeightsMm.single_62mm_width.bodyShort1ColMm + 4
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
 * Synthesizes an intelligent, article-adaptive, asymmetric MasterLayoutPlan using the measured
 * Telugu text dimensions supplied by the Editor (`typography-and-measurement`).
 */
export function synthesizeArticleAdaptiveMasterPlan(
  ctx: DesignerInputContext,
  planVersion = 1,
  designerRationaleOverride?: string
): MasterLayoutPlan {
  const { editionId, editionNumber, editionDate, editionTitleTelugu, targetPageCount, articles, settings } = ctx;
  const measurements =
    ctx.editorMeasurements || computeInitialArticleMeasurementsForDesigner(articles);
  const measMap = new Map(measurements.map((m) => [m.articleId, m]));

  // Filter out held/flagged/draft stories and sort by priorityScore & photo availability
  const eligible = articles
    .filter(
      (a) =>
        a.status !== 'flagged_hold' &&
        a.status !== 'failed' &&
        a.status !== 'draft' &&
        !(settings.autoHoldHighRiskStories && a.riskLevel === 'high' && a.status !== 'approved')
    )
    .sort((a, b) => (b.priorityScore || 50) - (a.priorityScore || 50));

  const pageW = settings.pageWidthMm || 330;
  const pageH = settings.pageHeightMm || 520;
  const margin = settings.marginMm || 12;
  const innerW = pageW - 2 * margin; // 306mm for 330mm width

  const briefs = eligible.filter(
    (a) =>
      a.assignedCategory === 'Announcements' ||
      a.assignedCategory === 'Community events' ||
      (a.priorityScore < 65 && (!a.assets || a.assets.length === 0))
  );
  const mainStories = eligible.filter((a) => !briefs.includes(a));
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
  const hasDigestRail = briefs.length > 0 || allOrdered.length >= 4;
  const railW = hasDigestRail ? 52 : 0;
  const mainCanvasW = hasDigestRail ? innerW - railW - 4 : innerW; // 250mm when rail present

  // Partition stories between Page 1 and Page 2+ so Page 1 is densely packed (up to 5 main stories) and Page 2+ has stories too
  const page1MainPool =
    pageCount > 1 && mainStories.length >= 6
      ? mainStories.slice(0, 5)
      : pageCount > 1 && mainStories.length >= 4
      ? mainStories.slice(0, 4)
      : pageCount > 1 && mainStories.length >= 2
      ? mainStories.slice(0, 1)
      : mainStories.slice(0, 5);

  const page2Pool = allOrdered.filter(
    (a) => !page1MainPool.includes(a) && !briefs.slice(0, 2).includes(a)
  );

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
    p1Elements.push(...leadGroup.elements);
    mainBottomY = Math.max(mainBottomY, contentStartY + leadGroup.totalHeightMm + 3.5);

    // Secondary Top-Right Feature Story (beside Lead Story)
    if (page1MainPool[1]) {
      const secArt = page1MainPool[1];
      const secMeas = measMap.get(secArt.id) || computeInitialArticleMeasurementsForDesigner([secArt])[0];
      const secX = margin + leadW + 4;
      const secW = mainCanvasW - leadW - 4; // ~101mm

      const secGroup = buildArticleElementGroup({
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
      p1Elements.push(...secGroup.elements);
      mainBottomY = Math.max(mainBottomY, contentStartY + secGroup.totalHeightMm + 3.5);
    }

    // Tier 2: Middle Wide Lavender Panorama Split across Main Canvas
    if (page1MainPool[2] && mainBottomY + 60 <= usableBottomY) {
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
      if (mainBottomY + thirdGroup.totalHeightMm <= usableBottomY) {
        p1Elements.push(...thirdGroup.elements);
        mainBottomY += thirdGroup.totalHeightMm + 3.5;
      } else {
        page2Pool.unshift(thirdArt);
      }
    }

    // Tier 3: Bottom Asymmetric Split — Left 40% Red-Alert Story + Right 60% Yellow Sticker-Burst Centerpiece
    if (page1MainPool[3] && mainBottomY + 45 <= usableBottomY) {
      const fourthArt = page1MainPool[3];
      const fourthMeas =
        measMap.get(fourthArt.id) || computeInitialArticleMeasurementsForDesigner([fourthArt])[0];
      const hasFifth = Boolean(page1MainPool[4]);
      const fourthW = hasFifth ? Math.round(mainCanvasW * 0.42) : mainCanvasW;

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
      if (mainBottomY + fourthGroup.totalHeightMm <= usableBottomY + 12) {
        p1Elements.push(...fourthGroup.elements);
      }

      if (page1MainPool[4]) {
        const fifthArt = page1MainPool[4];
        const fifthMeas =
          measMap.get(fifthArt.id) || computeInitialArticleMeasurementsForDesigner([fifthArt])[0];
        const fifthX = margin + fourthW + 4;
        const fifthW = mainCanvasW - fourthW - 4;

        const fifthGroup = buildArticleElementGroup({
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
        if (mainBottomY + fifthGroup.totalHeightMm <= usableBottomY + 12) {
          p1Elements.push(...fifthGroup.elements);
        }
      }
    }
  }

  // Right-Hand News Digest & Announcements Rail on Page 1
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

    const railItems = briefs.length > 0 ? briefs.slice(0, 3) : allOrdered.slice(-2);
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
      if (railY + bGroup.totalHeightMm <= usableBottomY) {
        p1Elements.push(...bGroup.elements);
        railY += bGroup.totalHeightMm + 3;
      }
    });
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
      'Lead story commands 58% upper-left canvas with inset photo and 3-column Telugu prose; flanked by a tinted boxed feature and a vertical digest rail.',
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

      if (targetY + grp.totalHeightMm <= usableBottomY) {
        pElements.push(...grp.elements);
        if (placeOnLeft) {
          leftColY += grp.totalHeightMm + 4;
        } else {
          rightColY += grp.totalHeightMm + 4;
        }
      }
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
