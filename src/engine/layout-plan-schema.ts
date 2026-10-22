import type {
  AllowedCorrectionAction,
  EditorDiagnosticsReport,
  GeometricShapeSpec,
  MasterLayoutPagePlan,
  MasterLayoutPlan,
  PlanElement,
  PlanElementType,
} from '../shared/types.ts';

export const VALID_PLAN_ELEMENT_TYPES: PlanElementType[] = [
  'masthead',
  'edition_strip',
  'running_header',
  'article_container',
  'section_kicker',
  'headline',
  'standfirst',
  'body_text',
  'photograph',
  'caption',
  'callout_box',
  'shaped_medallion',
  'divider',
  'footer',
];

export const VALID_CORRECTION_ACTIONS: AllowedCorrectionAction[] = [
  'increase_height',
  'increase_width',
  'select_compact_headline',
  'select_short_body',
  'reduce_font_size_to_minimum',
  'reposition_element',
  'adjust_image_crop',
  'paginate_continuation',
];

export interface SchemaValidationResult<T> {
  valid: boolean;
  data?: T;
  errors: string[];
}

/**
 * Validates the Designer's MasterLayoutPlan JSON against formal schema rules and physical page geometry.
 */
export function validateMasterLayoutPlan(raw: unknown): SchemaValidationResult<MasterLayoutPlan> {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['MasterLayoutPlan must be a non-null JSON object.'] };
  }

  const obj = raw as Record<string, unknown>;
  if (typeof obj.edition_id !== 'string' || !obj.edition_id.trim()) {
    errors.push('Missing or invalid edition_id.');
  }
  const planVersion = Number(obj.plan_version);
  if (!Number.isInteger(planVersion) || planVersion < 1) {
    errors.push('plan_version must be a positive integer >= 1.');
  }

  const coord = obj.coordinate_system as Record<string, unknown> | undefined;
  if (!coord || coord.unit !== 'mm' || coord.origin !== 'top_left') {
    errors.push('coordinate_system must specify { unit: "mm", origin: "top_left" }.');
  }

  if (!Array.isArray(obj.pages) || obj.pages.length === 0) {
    errors.push('pages must be a non-empty array of page layout plans.');
    return { valid: false, errors };
  }

  const seenElementIds = new Set<string>();
  const validatedPages: MasterLayoutPagePlan[] = [];

  for (let pIdx = 0; pIdx < obj.pages.length; pIdx++) {
    const pRaw = obj.pages[pIdx] as Record<string, unknown>;
    const pageNumber = Number(pRaw.page_number);
    const width = Number(pRaw.width);
    const height = Number(pRaw.height);
    const marginMm = Number(pRaw.margin_mm ?? 10);

    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      errors.push(`Page at index ${pIdx} has invalid page_number.`);
    }
    if (!(width > 50 && height > 50)) {
      errors.push(`Page ${pageNumber} has invalid physical dimensions (${width}x${height} mm).`);
    }
    if (!Array.isArray(pRaw.elements) || pRaw.elements.length === 0) {
      errors.push(`Page ${pageNumber} must contain at least one layout element.`);
      continue;
    }

    const validatedElements: PlanElement[] = [];

    for (let eIdx = 0; eIdx < pRaw.elements.length; eIdx++) {
      const el = pRaw.elements[eIdx] as Record<string, unknown>;
      const elId = typeof el.element_id === 'string' ? el.element_id.trim() : '';
      if (!elId) {
        errors.push(`Page ${pageNumber} element[${eIdx}] is missing element_id.`);
        continue;
      }
      if (seenElementIds.has(elId)) {
        errors.push(`Duplicate element_id '${elId}' detected across plan.`);
      }
      seenElementIds.add(elId);

      const elType = el.type as PlanElementType;
      if (!VALID_PLAN_ELEMENT_TYPES.includes(elType)) {
        errors.push(`Element '${elId}' has unsupported type '${String(el.type)}'.`);
      }

      const geom = el.geometry as Record<string, unknown> | undefined;
      if (!geom) {
        errors.push(`Element '${elId}' is missing geometry.`);
        continue;
      }
      const x = Number(geom.x);
      const y = Number(geom.y);
      const w = Number(geom.width);
      const h = Number(geom.height);

      if ([x, y, w, h].some((n) => Number.isNaN(n)) || w <= 0 || h <= 0) {
        errors.push(`Element '${elId}' has non-positive or NaN geometry (${x}, ${y}, ${w}, ${h}).`);
      }

      const constraintsRaw = (el.constraints as Record<string, unknown>) || {};
      const minW = Number(constraintsRaw.minimum_width_mm ?? constraintsRaw.minimum_width ?? 15);
      const minFontPt = Number(constraintsRaw.minimum_font_size_pt ?? 9);

      const typoRaw = el.typography as Record<string, unknown> | undefined;
      const typography = typoRaw
        ? {
            font_family:
              typoRaw.font_family === 'Noto Serif Telugu' ||
              typoRaw.font_family === 'JetBrains Mono'
                ? (typoRaw.font_family as 'Noto Serif Telugu' | 'JetBrains Mono')
                : ('Noto Sans Telugu' as const),
            font_size_pt: Number(typoRaw.font_size_pt || 10.5),
            font_weight: ([400, 500, 600, 700, 800].includes(Number(typoRaw.font_weight))
              ? Number(typoRaw.font_weight)
              : 400) as 400 | 500 | 600 | 700 | 800,
            line_height: Number(typoRaw.line_height || 1.45),
            alignment: (['left', 'center', 'right', 'justify'].includes(String(typoRaw.alignment))
              ? String(typoRaw.alignment)
              : 'left') as 'left' | 'center' | 'right' | 'justify',
            color_hex: typeof typoRaw.color_hex === 'string' ? typoRaw.color_hex : '#111111',
          }
        : undefined;

      const flowRaw = el.text_flow as Record<string, unknown> | undefined;
      const text_flow = flowRaw
        ? {
            columns: Math.max(1, Math.min(6, Number(flowRaw.columns || 1))),
            column_gap_mm: Number(flowRaw.column_gap_mm ?? 3.5),
            column_rule_color_hex:
              typeof flowRaw.column_rule_color_hex === 'string'
                ? flowRaw.column_rule_color_hex
                : '#D6D1C7',
            wrap_around_element_ids: Array.isArray(flowRaw.wrap_around_element_ids)
              ? flowRaw.wrap_around_element_ids.map(String)
              : [],
            continuation_note_telugu:
              typeof flowRaw.continuation_note_telugu === 'string'
                ? flowRaw.continuation_note_telugu
                : null,
          }
        : undefined;

      const imgRaw = el.image_fit as Record<string, unknown> | undefined;
      const image_fit = imgRaw
        ? {
            fitting_mode:
              imgRaw.fitting_mode === 'contain' ? ('contain' as const) : ('cover' as const),
            focal_point_x: Number(imgRaw.focal_point_x ?? 0.5),
            focal_point_y: Number(imgRaw.focal_point_y ?? 0.5),
            aspect_ratio_label:
              typeof imgRaw.aspect_ratio_label === 'string' ? imgRaw.aspect_ratio_label : '16:10',
            associated_caption_element_id:
              typeof imgRaw.associated_caption_element_id === 'string'
                ? imgRaw.associated_caption_element_id
                : undefined,
          }
        : undefined;

      const styleRaw = el.style as Record<string, unknown> | undefined;
      const style = styleRaw
        ? {
            background_color_hex:
              typeof styleRaw.background_color_hex === 'string'
                ? styleRaw.background_color_hex
                : undefined,
            border_color_hex:
              typeof styleRaw.border_color_hex === 'string'
                ? styleRaw.border_color_hex
                : undefined,
            border_width_mm:
              styleRaw.border_width_mm !== undefined ? Number(styleRaw.border_width_mm) : undefined,
            border_top_width_mm:
              styleRaw.border_top_width_mm !== undefined
                ? Number(styleRaw.border_top_width_mm)
                : undefined,
            border_bottom_width_mm:
              styleRaw.border_bottom_width_mm !== undefined
                ? Number(styleRaw.border_bottom_width_mm)
                : undefined,
            border_left_width_mm:
              styleRaw.border_left_width_mm !== undefined
                ? Number(styleRaw.border_left_width_mm)
                : undefined,
            border_right_width_mm:
              styleRaw.border_right_width_mm !== undefined
                ? Number(styleRaw.border_right_width_mm)
                : undefined,
            padding_mm: styleRaw.padding_mm !== undefined ? Number(styleRaw.padding_mm) : undefined,
            is_container: Boolean(styleRaw.is_container),
            geometric_shape:
              styleRaw.geometric_shape && typeof styleRaw.geometric_shape === 'object'
                ? (styleRaw.geometric_shape as GeometricShapeSpec)
                : undefined,
          }
        : undefined;

      validatedElements.push({
        element_id: elId,
        type: elType,
        article_id: typeof el.article_id === 'string' && el.article_id ? el.article_id : null,
        asset_id: typeof el.asset_id === 'string' && el.asset_id ? el.asset_id : null,
        content_ref: typeof el.content_ref === 'string' && el.content_ref ? el.content_ref : null,
        text_override_telugu:
          typeof el.text_override_telugu === 'string' ? el.text_override_telugu : null,
        reading_order: Number(el.reading_order ?? eIdx + 1),
        z_index: Number(el.z_index ?? 10),
        geometry: {
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
          width: Math.round(w * 100) / 100,
          height: Math.round(h * 100) / 100,
        },
        typography,
        text_flow,
        image_fit,
        style,
        constraints: {
          minimum_width_mm: minW,
          maximum_width_mm:
            constraintsRaw.maximum_width_mm !== undefined
              ? Number(constraintsRaw.maximum_width_mm)
              : undefined,
          minimum_height_mm:
            constraintsRaw.minimum_height_mm !== undefined
              ? Number(constraintsRaw.minimum_height_mm)
              : undefined,
          maximum_height_mm:
            constraintsRaw.maximum_height_mm !== undefined
              ? Number(constraintsRaw.maximum_height_mm)
              : undefined,
          minimum_font_size_pt: minFontPt,
          allow_repositioning: Boolean(constraintsRaw.allow_repositioning ?? true),
          allow_height_expansion: Boolean(constraintsRaw.allow_height_expansion ?? true),
          allow_overlap_with_element_ids: Array.isArray(
            constraintsRaw.allow_overlap_with_element_ids
          )
            ? constraintsRaw.allow_overlap_with_element_ids.map(String)
            : [],
          required: Boolean(constraintsRaw.required ?? true),
          permitted_actions: Array.isArray(constraintsRaw.permitted_actions)
            ? (constraintsRaw.permitted_actions.filter((a) =>
                VALID_CORRECTION_ACTIONS.includes(a as AllowedCorrectionAction)
              ) as AllowedCorrectionAction[])
            : ['increase_height', 'select_compact_headline', 'select_short_body', 'reposition_element'],
        },
      });
    }

    validatedPages.push({
      page_number: pageNumber,
      width,
      height,
      margin_mm: marginMm,
      page_theme_note:
        typeof pRaw.page_theme_note === 'string'
          ? pRaw.page_theme_note
          : `Page ${pageNumber} Broadsheet Composition`,
      visual_hierarchy_summary:
        typeof pRaw.visual_hierarchy_summary === 'string'
          ? pRaw.visual_hierarchy_summary
          : 'Lead story anchored top-left with asymmetric secondary modules and side digest.',
      reference_columns: Number(pRaw.reference_columns || 6),
      elements: validatedElements,
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      edition_id: String(obj.edition_id).trim(),
      plan_version: planVersion,
      designer_model_id:
        typeof obj.designer_model_id === 'string'
          ? obj.designer_model_id
          : 'gemini-3.5-flash-lite',
      design_rationale:
        typeof obj.design_rationale === 'string'
          ? obj.design_rationale
          : 'Asymmetric multi-column Telugu broadsheet layout tailored to article lengths and visual hierarchy.',
      coordinate_system: {
        unit: 'mm',
        origin: 'top_left',
      },
      pages: validatedPages,
      created_at:
        typeof obj.created_at === 'string' ? obj.created_at : new Date().toISOString(),
    },
    errors: [],
  };
}

/**
 * Validates the Editor's structured feedback diagnostics report.
 */
export function validateEditorDiagnostics(
  raw: unknown
): SchemaValidationResult<EditorDiagnosticsReport> {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['EditorDiagnosticsReport must be an object.'] };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.edition_id !== 'string' || !obj.edition_id) {
    errors.push('Missing edition_id.');
  }
  if (obj.status !== 'valid' && obj.status !== 'layout_errors') {
    errors.push('status must be "valid" or "layout_errors".');
  }
  if (!Array.isArray(obj.issues)) {
    errors.push('issues must be an array.');
  }
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, data: obj as unknown as EditorDiagnosticsReport, errors: [] };
}
