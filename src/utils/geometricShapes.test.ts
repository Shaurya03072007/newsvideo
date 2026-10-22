import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GEOMETRIC_SHAPE_CATALOG,
  selectDesignerGeometricShapeForArticle,
  buildGeometricShapeSvgBorder,
  computeShapedElementEffectiveAreaMm2,
} from '../engine/geometric-shapes.ts';
import type { Article } from '../shared/types.ts';

test('Geometric Shapes: Catalog defines 9 non-rectangular and broadsheet shapes with valid CSS and SVG paths', () => {
  const shapes = Object.keys(GEOMETRIC_SHAPE_CATALOG);
  assert.ok(shapes.length >= 9, `Expected at least 9 shapes in catalog, got ${shapes.length}`);

  const requiredShapes = [
    'rectangle',
    'circle',
    'semi_circle_arch',
    'quarter_circle_wedge',
    'tomb_arch',
    'rhombus_diamond',
    'pentagon_shield',
    'hexagon_gem',
    'star_burst',
  ];

  for (const s of requiredShapes) {
    const spec = GEOMETRIC_SHAPE_CATALOG[s as keyof typeof GEOMETRIC_SHAPE_CATALOG];
    assert.ok(spec, `Missing shape spec for ${s}`);
    assert.ok(spec.label_telugu.length > 0, `Telugu label missing for ${s}`);
    assert.ok(spec.area_efficiency_factor > 0 && spec.area_efficiency_factor <= 1.0);
    assert.ok(spec.clip_path_css.length > 0);
  }
});

test('Geometric Shapes: Designer selects creative non-square contours based on article archetype and page placement', () => {
  const cultureArt: Partial<Article> = {
    id: 'art-kuchipudi-utsav',
    category: 'Culture and festivals',
    editorialWeight: 6,
    hasPhotograph: true,
  };
  const cultureShape = selectDesignerGeometricShapeForArticle(cultureArt as Article, 1, 3);
  assert.equal(cultureShape.shape_type, 'rhombus_diamond', 'Culture article receives diamond or tomb arch');

  const agriArt: Partial<Article> = {
    id: 'art-krishna-delta',
    category: 'Agriculture',
    editorialWeight: 10,
    hasPhotograph: true,
  };
  const leadShape = selectDesignerGeometricShapeForArticle(agriArt as Article, 1, 0);
  assert.equal(leadShape.shape_type, 'semi_circle_arch', 'Lead story receives majestic semi_circle_arch');

  const eduArt: Partial<Article> = {
    id: 'art-vizag-education',
    category: 'Education',
    editorialWeight: 7,
    hasPhotograph: true,
  };
  const eduShape = selectDesignerGeometricShapeForArticle(eduArt as Article, 2, 1);
  assert.equal(eduShape.shape_type, 'circle', 'Education feature receives circle medallion');
});

test('Geometric Shapes: computeShapedElementEffectiveAreaMm2 calculates area reclaimed by text wrap', () => {
  const circleSpec = GEOMETRIC_SHAPE_CATALOG.circle;
  const metrics = computeShapedElementEffectiveAreaMm2(50, 50, circleSpec);
  assert.equal(metrics.boundingBoxAreaMm2, 2500);
  assert.ok(metrics.occupiedShapeAreaMm2 < 2500, 'Circle should occupy less bounding box area than square');
  assert.ok(metrics.reclaimedTextWrapAreaMm2 > 0, 'Reclaimed area allows text to wrap closer to the medallion');

  const rectMetrics = computeShapedElementEffectiveAreaMm2(50, 50, GEOMETRIC_SHAPE_CATALOG.rectangle);
  assert.equal(rectMetrics.reclaimedTextWrapAreaMm2, 0, 'Rectangle has no reclaimed text wrap area');
});

test('Geometric Shapes: buildGeometricShapeSvgBorder returns valid SVG vector paths', () => {
  const circleSvg = buildGeometricShapeSvgBorder('circle', '#991B1B', 2.5);
  assert.ok(circleSvg.includes('<svg'), 'Should generate SVG container');
  assert.ok(circleSvg.includes('stroke="#991B1B"'), 'Should preserve stroke color');

  const tombSvg = buildGeometricShapeSvgBorder('tomb_arch', '#1E40AF', 2.0);
  assert.ok(tombSvg.includes('stroke="#1E40AF"'));
});

