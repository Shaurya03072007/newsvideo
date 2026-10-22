import type {
  Article,
  GeometricShapeSpec,
  GeometricShapeType,
  ShapeTextWrapMode,
} from '../shared/types.ts';

export const GEOMETRIC_SHAPE_CATALOG: Record<GeometricShapeType, GeometricShapeSpec> = {
  rectangle: {
    shape_type: 'rectangle',
    label_telugu: 'చతురస్ర పెట్టె (Classic Square/Rect)',
    label_english: 'Classic Broadsheet Rectangle',
    text_wrap_mode: 'none',
    clip_path_css: 'none',
    shape_outside_css: 'none',
    shape_margin_mm: 2.5,
    area_efficiency_factor: 1.0,
    svg_border_path: 'M 1,1 L 99,1 L 99,99 L 1,99 Z',
  },
  circle: {
    shape_type: 'circle',
    label_telugu: 'వృత్తాకార బింబం (Circle Medallion)',
    label_english: 'Circle Area + Curved Text Wrap',
    text_wrap_mode: 'wrap_left',
    clip_path_css: 'circle(50% at 50% 50%)',
    shape_outside_css: 'circle(50% at 50% 50%)',
    shape_margin_mm: 3.5,
    area_efficiency_factor: 0.785, // pi / 4
    svg_border_path: 'M 50,2 A 48,48 0 1,1 49.9,2 Z',
  },
  semi_circle_arch: {
    shape_type: 'semi_circle_arch',
    label_telugu: 'అర్ధ వృత్తాకార ఆర్చ్ (Part-of-Circle Dome)',
    label_english: 'Part of Circle (Semi-Circle Dome)',
    text_wrap_mode: 'wrap_left',
    clip_path_css: 'ellipse(50% 98% at 50% 98%)',
    shape_outside_css: 'ellipse(52% 98% at 50% 98%)',
    shape_margin_mm: 3.2,
    area_efficiency_factor: 0.785,
    svg_border_path: 'M 2,98 A 48,94 0 0,1 98,98 Z',
  },
  quarter_circle_wedge: {
    shape_type: 'quarter_circle_wedge',
    label_telugu: 'కోణీయ వృత్త ఖండం (Quarter-Circle Wedge)',
    label_english: 'Part of Circle (Quarter-Circle Wedge)',
    text_wrap_mode: 'wrap_left',
    clip_path_css: 'circle(96% at 0% 0%)',
    shape_outside_css: 'circle(98% at 0% 0%)',
    shape_margin_mm: 3.5,
    area_efficiency_factor: 0.785,
    svg_border_path: 'M 1,1 L 97,1 A 96,96 0 0,1 1,97 Z',
  },
  tomb_arch: {
    shape_type: 'tomb_arch',
    label_telugu: 'గోపుర / టూంబ్ ఆర్చ్ (Tomb Arch Square)',
    label_english: 'Tomb / Temple Arch Square',
    text_wrap_mode: 'wrap_left',
    clip_path_css:
      'polygon(0% 24%, 8% 11%, 22% 3%, 50% 0%, 78% 3%, 92% 11%, 100% 24%, 100% 100%, 0% 100%)',
    shape_outside_css:
      'polygon(0% 24%, 8% 11%, 22% 3%, 50% 0%, 78% 3%, 92% 11%, 100% 24%, 100% 100%, 0% 100%)',
    shape_margin_mm: 3.0,
    area_efficiency_factor: 0.89,
    svg_border_path: 'M 1,24 L 8,11 L 22,3 L 50,1 L 78,3 L 92,11 L 99,24 L 99,99 L 1,99 Z',
  },
  rhombus_diamond: {
    shape_type: 'rhombus_diamond',
    label_telugu: 'వజ్రాకార చతురస్రం (Diamond Square)',
    label_english: 'Rhombus / Rotated Diamond Square',
    text_wrap_mode: 'wrap_left',
    clip_path_css: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
    shape_outside_css: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
    shape_margin_mm: 3.5,
    area_efficiency_factor: 0.5,
    svg_border_path: 'M 50,2 L 98,50 L 50,98 L 2,50 Z',
  },
  pentagon_shield: {
    shape_type: 'pentagon_shield',
    label_telugu: 'పంచభుజి షీల్డ్ (Pentagon)',
    label_english: 'Pentagon Shield + Angled Text Wrap',
    text_wrap_mode: 'wrap_left',
    clip_path_css: 'polygon(50% 0%, 100% 38%, 81% 100%, 19% 100%, 0% 38%)',
    shape_outside_css: 'polygon(50% 0%, 100% 38%, 81% 100%, 19% 100%, 0% 38%)',
    shape_margin_mm: 3.2,
    area_efficiency_factor: 0.69,
    svg_border_path: 'M 50,2 L 98,38 L 81,98 L 19,98 L 2,38 Z',
  },
  hexagon_gem: {
    shape_type: 'hexagon_gem',
    label_telugu: 'షడ్భుజి కోణం (Hexagon Gem)',
    label_english: 'Hexagon Polygon + Wrap',
    text_wrap_mode: 'wrap_left',
    clip_path_css: 'polygon(22% 0%, 78% 0%, 100% 50%, 78% 100%, 22% 100%, 0% 50%)',
    shape_outside_css: 'polygon(22% 0%, 78% 0%, 100% 50%, 78% 100%, 22% 100%, 0% 50%)',
    shape_margin_mm: 3.0,
    area_efficiency_factor: 0.78,
    svg_border_path: 'M 22,2 L 78,2 L 98,50 L 78,98 L 22,98 L 2,50 Z',
  },
  star_burst: {
    shape_type: 'star_burst',
    label_telugu: 'నక్షత్ర ముద్ర (Starburst Seal)',
    label_english: '12-Point Starburst Medallion',
    text_wrap_mode: 'wrap_right',
    clip_path_css:
      'polygon(50% 0%, 63% 14%, 83% 10%, 86% 29%, 100% 42%, 90% 60%, 96% 79%, 77% 84%, 68% 100%, 50% 90%, 32% 100%, 23% 84%, 4% 79%, 10% 60%, 0% 42%, 14% 29%, 17% 10%, 37% 14%)',
    shape_outside_css: 'circle(52% at 50% 50%)',
    shape_margin_mm: 3.5,
    area_efficiency_factor: 0.68,
    svg_border_path:
      'M 50,2 L 63,14 L 83,10 L 86,29 L 98,42 L 90,60 L 96,79 L 77,84 L 68,98 L 50,90 L 32,98 L 23,84 L 4,79 L 10,60 L 2,42 L 14,29 L 17,10 L 37,14 Z',
  },
};

export function getGeometricShapeSpec(
  shapeType: GeometricShapeType,
  overrides?: Partial<GeometricShapeSpec>
): GeometricShapeSpec {
  const base = GEOMETRIC_SHAPE_CATALOG[shapeType] || GEOMETRIC_SHAPE_CATALOG.rectangle;
  return {
    ...base,
    ...overrides,
  };
}

/**
 * Designer intelligence: selects an authentic Telugu broadsheet geometric shape
 * for an article's visual framing or inset photo/callout so the newspaper combines
 * Circles, Part-of-Circle Domes/Wedges, Tomb-Arch Squares, Pentagon Shields,
 * Rhombus Diamonds, Hexagons, and Starburst Medallions.
 */
export function selectDesignerGeometricShapeForArticle(
  article: Article,
  pageNumber: number,
  storyIndexOnPage: number,
  isLead: boolean
): GeometricShapeSpec {
  const id = article.id;
  const cat = article.assignedCategory;

  // Explicit article-adaptive composition rules
  if (id === 'art-krishna-delta' || isLead) {
    return getGeometricShapeSpec('semi_circle_arch', {
      text_wrap_mode: 'wrap_left',
      badge_title_telugu: 'కృష్ణా డెల్టా జలకళ',
      badge_value_telugu: '7,700 క్యూసెక్కులు',
    });
  }

  if (id === 'art-guntur-grain') {
    return getGeometricShapeSpec('pentagon_shield', {
      text_wrap_mode: 'wrap_left',
      badge_title_telugu: 'మద్దతు ధర హామీ',
      badge_value_telugu: 'రూ. 2,320 / క్వింటాల్',
    });
  }

  if (id === 'art-amaravati-metro') {
    return getGeometricShapeSpec('tomb_arch', {
      text_wrap_mode: 'wrap_left',
      badge_title_telugu: 'హరిత ప్రయాణం',
      badge_value_telugu: '120 ఇ-బస్సులు',
    });
  }

  if (id === 'art-vizag-education' || cat === 'Education') {
    return getGeometricShapeSpec('circle', {
      text_wrap_mode: 'wrap_left',
      badge_title_telugu: 'డిజిటల్ విద్య',
      badge_value_telugu: '85 పాఠశాలలు',
    });
  }

  if (id === 'art-rayalaseema-drip') {
    return getGeometricShapeSpec('quarter_circle_wedge', {
      text_wrap_mode: 'wrap_left',
      badge_title_telugu: 'బిందు సేద్యం రాయితీ',
      badge_value_telugu: '90% సబ్సిడీ',
    });
  }

  if (id === 'art-warangal-infra') {
    return getGeometricShapeSpec('tomb_arch', {
      text_wrap_mode: 'wrap_left',
      badge_title_telugu: 'రింగ్ రోడ్డు వంతెన',
      badge_value_telugu: 'రూ. 410 కోట్లు',
    });
  }

  if (id === 'art-vijayawada-it-park' || cat === 'Business') {
    return getGeometricShapeSpec('hexagon_gem', {
      text_wrap_mode: 'wrap_left',
      badge_title_telugu: 'ఐటీ ఉద్యోగాలు',
      badge_value_telugu: '12,000 కొలువులు',
    });
  }

  if (id === 'art-tirupati-health' || cat === 'Health') {
    return getGeometricShapeSpec('circle', {
      text_wrap_mode: 'wrap_right',
      badge_title_telugu: 'ఉచిత పరీక్షలు',
      badge_value_telugu: '65 రకాలు',
    });
  }

  if (id === 'art-kuchipudi-utsav' || cat === 'Culture and festivals') {
    return getGeometricShapeSpec('rhombus_diamond', {
      text_wrap_mode: 'wrap_left',
      badge_title_telugu: 'కూచిపూడి నాట్యోత్సవం',
      badge_value_telugu: '450 మంది కళాకారులు',
    });
  }

  // Fallback sequence based on page & story index for newly submitted reporter stories
  const rotation: GeometricShapeType[] = [
    'circle',
    'tomb_arch',
    'pentagon_shield',
    'semi_circle_arch',
    'rhombus_diamond',
    'hexagon_gem',
    'quarter_circle_wedge',
    'star_burst',
  ];
  const chosen = rotation[(pageNumber * 3 + storyIndexOnPage) % rotation.length];
  return getGeometricShapeSpec(chosen, {
    text_wrap_mode: storyIndexOnPage % 2 === 0 ? 'wrap_left' : 'wrap_right',
    badge_title_telugu: article.assignedCategoryTelugu,
    badge_value_telugu: `${article.location} బ్యూరో`,
  });
}

/**
 * Editor deterministic calculation: computes how much effective height an inset
 * geometric shape adds to a multi-column text block when text wraps around its
 * non-rectangular contour (`shape-outside: circle(...)` or `polygon(...)`).
 */
export function computeShapedElementEffectiveAreaMm2(
  widthMm: number,
  heightMm: number,
  shapeSpec?: GeometricShapeSpec
): {
  boundingBoxAreaMm2: number;
  occupiedShapeAreaMm2: number;
  reclaimedTextWrapAreaMm2: number;
  effectiveVerticalDisplacementMm: number;
} {
  const boundingBoxAreaMm2 = Math.max(0, widthMm * heightMm);
  const factor = shapeSpec ? shapeSpec.area_efficiency_factor : 1.0;
  const occupiedShapeAreaMm2 = Number((boundingBoxAreaMm2 * factor).toFixed(2));
  const reclaimedTextWrapAreaMm2 = Number(
    Math.max(0, boundingBoxAreaMm2 - occupiedShapeAreaMm2).toFixed(2)
  );
  const effectiveVerticalDisplacementMm = Number((heightMm * factor).toFixed(2));

  return {
    boundingBoxAreaMm2,
    occupiedShapeAreaMm2,
    reclaimedTextWrapAreaMm2,
    effectiveVerticalDisplacementMm,
  };
}

/**
 * Builds an inline SVG ornamental border frame matching the exact polygon or circle
 * of the GeometricShapeSpec so both screen and print PDF have crisp newspaper rules.
 */
export function buildGeometricShapeSvgBorder(
  shapeType: GeometricShapeType,
  strokeColorHex: string = '#991B1B',
  strokeWidthPx: number = 2.5
): string {
  const spec = GEOMETRIC_SHAPE_CATALOG[shapeType] || GEOMETRIC_SHAPE_CATALOG.rectangle;
  const pathData = spec.svg_border_path || 'M 1,1 L 99,1 L 99,99 L 1,99 Z';
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:10;"><path d="${pathData}" fill="none" stroke="${strokeColorHex}" stroke-width="${strokeWidthPx}" vector-effect="non-scaling-stroke" /></svg>`;
}
