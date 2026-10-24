import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  THEMES_CATALOG,
  THEME_CATEGORIES,
  STANDARD_THEME_ID,
  getThemeById,
} from './themeCatalog.ts';

describe('100 Comprehensive Themes Engine Verification', () => {
  it('contains exactly 100 uniquely curated themes', () => {
    assert.strictEqual(
      THEMES_CATALOG.length,
      100,
      `Expected exactly 100 themes, but found ${THEMES_CATALOG.length}`
    );
  });

  it('guarantees every theme ID is unique and follows kebab-case slug convention', () => {
    const ids = new Set<string>();
    for (const theme of THEMES_CATALOG) {
      assert.ok(!ids.has(theme.id), `Duplicate theme ID detected: ${theme.id}`);
      assert.match(
        theme.id,
        /^[a-z0-9-]+$/,
        `Theme ID "${theme.id}" must be kebab-case lowercase alphanumerics and dashes`
      );
      ids.add(theme.id);
    }
    assert.strictEqual(ids.size, 100);
  });

  it('ensures the standard default theme is praja-vani-standard (Warm Newsprint)', () => {
    assert.strictEqual(STANDARD_THEME_ID, 'praja-vani-standard');
    assert.strictEqual(THEMES_CATALOG[0].id, 'praja-vani-standard');
    assert.strictEqual(THEMES_CATALOG[0].mode, 'light');
    assert.strictEqual(THEMES_CATALOG[0].colors.bgPage, '#F4F1EA');
    assert.strictEqual(THEMES_CATALOG[0].colors.primary, '#E11D48');
  });

  it('verifies all 100 themes have complete, valid CSS color tokens and Telugu typography metadata', () => {
    const requiredColorKeys = [
      'bgPage',
      'bgSurface',
      'bgElevated',
      'border',
      'borderSubtle',
      'textPrimary',
      'textSecondary',
      'textMuted',
      'primary',
      'primaryHover',
      'primaryText',
      'accent',
      'accentBg',
      'tagBg',
      'tagText',
      'cardShadow',
    ] as const;

    const validCategoryIds = new Set(THEME_CATEGORIES.map((c) => c.id));

    THEMES_CATALOG.forEach((theme, index) => {
      assert.ok(theme.name && theme.name.trim().length > 0, `Theme #${index} missing English name`);
      assert.ok(theme.nameTelugu && theme.nameTelugu.trim().length > 0, `Theme #${index} (${theme.id}) missing Telugu name`);
      assert.ok(theme.description && theme.description.trim().length > 0, `Theme #${index} (${theme.id}) missing description`);
      assert.ok(theme.mode === 'light' || theme.mode === 'dark', `Theme #${index} (${theme.id}) mode must be light or dark`);
      assert.ok(validCategoryIds.has(theme.category as any), `Theme #${index} (${theme.id}) has invalid category: ${theme.category}`);

      for (const key of requiredColorKeys) {
        const val = theme.colors[key];
        assert.ok(
          val && typeof val === 'string' && val.length > 0,
          `Theme #${index} (${theme.id}) missing color token "${key}"`
        );
        if (key !== 'cardShadow') {
          assert.match(
            val,
            /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
            `Theme #${index} (${theme.id}) color token "${key}" must be a valid hex color string: received "${val}"`
          );
        }
      }
    });
  });

  it('resolves themes correctly by ID and falls back gracefully to standard theme for unknown IDs', () => {
    const ftTheme = getThemeById('ft-salmon-peach');
    assert.strictEqual(ftTheme.id, 'ft-salmon-peach');
    assert.strictEqual(ftTheme.name, 'Financial Times Salmon Peach');

    const tokyoTheme = getThemeById('tokyo-night');
    assert.strictEqual(tokyoTheme.id, 'tokyo-night');
    assert.strictEqual(tokyoTheme.mode, 'dark');

    const fallback = getThemeById('non-existent-theme-xyz-123');
    assert.strictEqual(fallback.id, 'praja-vani-standard');
  });

  it('validates theme distribution across all 7 thematic collections', () => {
    const categoryCounts: Record<string, number> = {};
    for (const theme of THEMES_CATALOG) {
      categoryCounts[theme.category] = (categoryCounts[theme.category] || 0) + 1;
    }

    assert.strictEqual(categoryCounts['editorial'], 15, 'Expected 15 editorial themes');
    assert.strictEqual(categoryCounts['heritage'], 15, 'Expected 15 heritage themes');
    assert.strictEqual(categoryCounts['dev-dark'], 15, 'Expected 15 developer dark themes');
    assert.strictEqual(categoryCounts['modern-light'], 15, 'Expected 15 modern light themes');
    assert.strictEqual(categoryCounts['media'], 15, 'Expected 15 world media themes');
    assert.strictEqual(categoryCounts['cyberpunk'], 15, 'Expected 15 cyberpunk & neon themes');
    assert.strictEqual(categoryCounts['nature'], 10, 'Expected 10 nature & earth themes');
  });
});
