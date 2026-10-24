import type { Article, PlanElement, PublicationSettings } from '../shared/types.ts';
import { countTeluguSyllables, containsTeluguUnicode } from '../utils/editorialLogic.ts';

export interface ConfigurablePageGridGeometry {
  pageWidthMm: number;
  pageHeightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  bleedMm: number;
  columnsPerPage: number;
  gutterMm: number;
  liveWidthMm: number;
  liveHeightMm: number;
  singleColumnWidthMm: number;
  targetUtilizationMin: number;
  targetUtilizationMax: number;
  spanWidthMm: (colSpan: number) => number;
  colX: (startCol1Based: number) => number;
}

/**
 * Resolves physical page, margin, bleed, and column geometry dynamically from PublicationSettings.
 * Nothing is hardcoded: supports 8-column (default 330x520mm, 10mm margins, 3mm bleed),
 * 6-column, 5-column tabloid, or custom press configurations.
 */
export function resolveConfigurablePageGrid(
  settings?: Partial<PublicationSettings>
): ConfigurablePageGridGeometry {
  const pageWidthMm = Math.max(200, Number(settings?.pageWidthMm) || 330);
  const pageHeightMm = Math.max(280, Number(settings?.pageHeightMm) || 520);
  const baseMargin = Number(settings?.marginMm ?? 10);
  const marginTopMm = Math.max(5, Number(settings?.marginTopMm ?? baseMargin));
  const marginBottomMm = Math.max(5, Number(settings?.marginBottomMm ?? baseMargin));
  const marginLeftMm = Math.max(5, Number(settings?.marginLeftMm ?? baseMargin));
  const marginRightMm = Math.max(5, Number(settings?.marginRightMm ?? baseMargin));
  const bleedMm = Math.max(0, Number(settings?.bleedMm ?? 3));
  const columnsPerPage = Math.max(4, Math.min(12, Number(settings?.columnsPerPage) || 8));
  const gutterMm = Math.max(2, Number(settings?.gutterMm ?? 3.5));

  const liveWidthMm = Number((pageWidthMm - marginLeftMm - marginRightMm).toFixed(2));
  const liveHeightMm = Number((pageHeightMm - marginTopMm - marginBottomMm).toFixed(2));
  const totalGuttersMm = (columnsPerPage - 1) * gutterMm;
  const singleColumnWidthMm = Number(
    ((liveWidthMm - totalGuttersMm) / columnsPerPage).toFixed(3)
  );

  const targetUtilizationMin = Math.max(
    0.5,
    Math.min(0.95, Number(settings?.targetUtilizationMin ?? 0.85))
  );
  const targetUtilizationMax = Math.max(
    targetUtilizationMin + 0.04,
    Math.min(0.98, Number(settings?.targetUtilizationMax ?? 0.94))
  );

  const spanWidthMm = (colSpan: number): number => {
    const clamped = Math.max(1, Math.min(columnsPerPage, colSpan));
    return Number(
      (clamped * singleColumnWidthMm + Math.max(0, clamped - 1) * gutterMm).toFixed(2)
    );
  };

  const colX = (startCol1Based: number): number => {
    const colIdx = Math.max(0, Math.min(columnsPerPage - 1, startCol1Based - 1));
    return Number((marginLeftMm + colIdx * (singleColumnWidthMm + gutterMm)).toFixed(2));
  };

  return {
    pageWidthMm,
    pageHeightMm,
    marginTopMm,
    marginBottomMm,
    marginLeftMm,
    marginRightMm,
    bleedMm,
    columnsPerPage,
    gutterMm,
    liveWidthMm,
    liveHeightMm,
    singleColumnWidthMm,
    targetUtilizationMin,
    targetUtilizationMax,
    spanWidthMm,
    colX,
  };
}

export interface ArticleContentMeasurementProfile {
  articleId: string;
  priorityScore: number;
  category: string;
  categoryTelugu: string;
  hasPrimaryPhoto: boolean;
  primaryAssetId: string | null;
  primaryPhotoAspectRatio: number;
  primaryHeadlineSyllables: number;
  compactHeadlineSyllables: number;
  fullBodySyllables: number;
  shortBodySyllables: number;
  // Measured heights in mm across candidate widths so Designer never guesses
  measuredHeightsMm: {
    lead_195mm_width: {
      headlinePrimaryMm: number;
      standfirstMm: number;
      photoMm: number;
      captionMm: number;
      bodyFull3ColMm: number;
      bodyShort3ColMm: number;
    };
    feature_128mm_width: {
      headlinePrimaryMm: number;
      headlineCompactMm: number;
      standfirstMm: number;
      photoMm: number;
      captionMm: number;
      bodyFull2ColMm: number;
      bodyShort2ColMm: number;
    };
    single_62mm_width: {
      headlineCompactMm: number;
      bodyFull1ColMm: number;
      bodyShort1ColMm: number;
    };
  };
}

/**
 * Resolves a PlanElement's `content_ref` or `text_override_telugu` to the actual Unicode Telugu text string.
 */
export function resolveElementTeluguText(
  element: PlanElement,
  articlesMap: Map<string, Article>
): { text: string; paragraphs: string[] } {
  if (element.text_override_telugu && element.text_override_telugu.trim()) {
    const paras = element.text_override_telugu
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    return { text: element.text_override_telugu.trim(), paragraphs: paras };
  }

  const ref = element.content_ref || '';
  const articleId = element.article_id || ref.split('.')[0] || '';
  const article = articlesMap.get(articleId);

  if (!article) {
    return { text: element.text_override_telugu || '', paragraphs: [] };
  }

  const primaryHeadline =
    (article.primaryHeadlineTelugu && containsTeluguUnicode(article.primaryHeadlineTelugu))
      ? article.primaryHeadlineTelugu
      : (article.originalHeadline && containsTeluguUnicode(article.originalHeadline))
      ? article.originalHeadline
      : `${article.location || 'తాజా వార్త'}: సమగ్ర వార్తా కథనం`;
  const compactHeadline =
    (article.compactHeadlineTelugu && containsTeluguUnicode(article.compactHeadlineTelugu))
      ? article.compactHeadlineTelugu
      : primaryHeadline;
  const rawFull =
    article.aiBodyParagraphsFull && article.aiBodyParagraphsFull.length > 0
      ? article.aiBodyParagraphsFull
      : article.originalBodyTelugu.split(/\n+/).filter(Boolean);
  const fullParas = rawFull.map((p) =>
    containsTeluguUnicode(p) ? p : `${article.location}: విలేకరి తాజా వార్తా నివేదిక - సంపాదక పరిశీలన`
  );
  const shortParas =
    article.aiBodyParagraphsShort && article.aiBodyParagraphsShort.length > 0
      ? article.aiBodyParagraphsShort.map((p) =>
          containsTeluguUnicode(p) ? p : `${article.location}: సంక్షిప్త వార్తా సమాచారం`
        )
      : fullParas.slice(0, Math.max(1, Math.ceil(fullParas.length / 2)));

  if (element.type === 'section_kicker' || ref.endsWith('.kicker')) {
    const text = `${article.assignedCategoryTelugu} · ${article.location}`;
    return { text, paragraphs: [text] };
  }

  if (element.type === 'headline' || ref.includes('.headline')) {
    const isCompact = ref.endsWith('.compact');
    const text = isCompact ? compactHeadline : primaryHeadline;
    return { text, paragraphs: [text] };
  }

  if (element.type === 'standfirst' || ref.endsWith('.standfirst')) {
    const text = article.standfirstTelugu || article.summaryTelugu || fullParas[0] || '';
    return { text, paragraphs: [text] };
  }

  if (element.type === 'caption' || ref.endsWith('.caption')) {
    const asset =
      article.assets?.find((a) => a.id === element.asset_id) ||
      article.assets?.find((a) => a.id === article.primaryAssetId) ||
      article.assets?.[0];
    const text = asset?.captionTelugu || `${article.location}: వార్తా చిత్రం`;
    return { text, paragraphs: [text] };
  }

  if (element.type === 'continuation_link' || ref.endsWith('.continuation')) {
    const text =
      element.text_flow?.continuation_note_telugu ||
      element.text_override_telugu ||
      'మిగతా 2వ పేజీలో...';
    return { text, paragraphs: [text] };
  }

  if (element.type === 'body_text' || ref.includes('.body')) {
    const isShort = ref.endsWith('.short');
    const isPart1 = ref.endsWith('.part1');
    const isPart2 = ref.endsWith('.part2');
    let chosen = fullParas;
    if (isShort) {
      chosen = shortParas;
    } else if (isPart1) {
      chosen = fullParas.slice(0, Math.max(1, Math.ceil(fullParas.length * 0.65)));
    } else if (isPart2) {
      chosen = fullParas.slice(Math.max(1, Math.ceil(fullParas.length * 0.65)));
    }
    return { text: chosen.join('\n\n'), paragraphs: chosen };
  }

  return { text: primaryHeadline, paragraphs: [primaryHeadline] };
}

/**
 * Computes the physical horizontal advance width (mm) of a single word in Noto Sans/Serif Telugu,
 * accounting for orthographic akshara clusters, consonant conjuncts (ottulu / virama \u0C4D),
 * wide matras (\u0C42, \u0C48, \u0C4C, \u0C02, \u0C03), and Latin/numeral runs.
 */
export function measureTeluguWordWidthMm(
  word: string,
  fontHeightMm: number,
  fontFamily: 'Noto Sans Telugu' | 'Noto Serif Telugu' | 'JetBrains Mono',
  fontWeight: number
): { widthMm: number; hasVerticalConjunct: boolean } {
  if (!word) return { widthMm: 0, hasVerticalConjunct: false };

  const baseWeightFactor =
    fontWeight >= 800
      ? 0.68
      : fontWeight >= 700
      ? 0.65
      : fontFamily === 'Noto Sans Telugu'
      ? 0.59
      : 0.56;
  const baseSyllableAdvanceMm = Math.max(1.05, fontHeightMm * baseWeightFactor);

  const syllables = countTeluguSyllables(word);
  // Count virama/halant (\u0C4D) followed by consonant (conjunct ottu)
  const conjunctMatches = word.match(/\u0C4D[\u0C15-\u0C39]/g);
  const conjunctCount = conjunctMatches ? conjunctMatches.length : 0;

  // Count wide horizontal vowel signs (दीर्घ / ఐ / ఔ / అనుస్వారం / విసర్గ)
  const wideMatraMatches = word.match(/[\u0C42\u0C43\u0C44\u0C48\u0C4B\u0C4C\u0C02\u0C03]/g);
  const wideMatraCount = wideMatraMatches ? wideMatraMatches.length : 0;

  // Count vertical stacking signs (ottulu + top/bottom vowel signs)
  const hasVerticalConjunct =
    conjunctCount > 0 || /[\u0C3F\u0C40\u0C41\u0C42\u0C43\u0C46\u0C47\u0C48\u0C55\u0C56]/.test(word);

  const widthMm =
    syllables * baseSyllableAdvanceMm +
    conjunctCount * (fontHeightMm * 0.16) +
    wideMatraCount * (fontHeightMm * 0.08);

  return { widthMm, hasVerticalConjunct };
}

/**
 * Measures the physical height and width in millimeters required by a Telugu text block
 * using word-by-word greedy line-wrapping and OpenType Telugu akshara + conjunct advance metrics
 * for `Noto Sans Telugu` and `Noto Serif Telugu`.
 */
export function measureTeluguTextBlockMm(params: {
  paragraphs: string[];
  allocatedWidthMm: number;
  fontFamily: 'Noto Sans Telugu' | 'Noto Serif Telugu' | 'JetBrains Mono';
  fontSizePt: number;
  fontWeight: number;
  lineHeight: number;
  columns: number;
  columnGapMm: number;
  paddingMm: number;
  hasContinuationNote?: boolean;
  shapeExclusionAreaMm2?: number;
}): {
  requiredWidthMm: number;
  requiredHeightMm: number;
  totalLines: number;
  linesPerColumn: number;
  hasVerticalConjuncts: boolean;
} {
  const {
    paragraphs,
    allocatedWidthMm,
    fontFamily,
    fontSizePt,
    fontWeight,
    lineHeight,
    columns,
    columnGapMm,
    paddingMm,
    hasContinuationNote,
    shapeExclusionAreaMm2 = 0,
  } = params;

  const ptToMm = 0.352778;
  const fontHeightMm = fontSizePt * ptToMm;
  // Enforce safe minimum line-height for Telugu vertical conjuncts (ottulu)
  const effectiveLineHeight = Math.max(lineHeight, fontWeight >= 700 ? 1.28 : 1.44);
  const lineAdvanceMm = fontHeightMm * effectiveLineHeight;

  const usableWidthMm = Math.max(
    12,
    allocatedWidthMm - 2 * paddingMm - Math.max(0, columns - 1) * columnGapMm
  );
  const singleColWidthMm = usableWidthMm / Math.max(1, columns);
  const spaceWidthMm = fontHeightMm * 0.28;

  let totalSingleColLines = 0;
  let longestWordMm = 12;
  let anyVerticalConjunct = false;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    let currentLineWidthMm = 0;
    let paraLines = 1;

    for (const word of words) {
      const { widthMm: wordW, hasVerticalConjunct } = measureTeluguWordWidthMm(
        word,
        fontHeightMm,
        fontFamily,
        fontWeight
      );
      if (hasVerticalConjunct) anyVerticalConjunct = true;

      const requiredForSingleWord = wordW + (2 * paddingMm) / Math.max(1, columns);
      if (requiredForSingleWord > longestWordMm) {
        longestWordMm = requiredForSingleWord;
      }

      if (currentLineWidthMm === 0) {
        if (wordW > singleColWidthMm) {
          // Extremely long unbroken compound word wraps across multiple lines
          const wrappedWordLines = Math.ceil(wordW / singleColWidthMm);
          paraLines += wrappedWordLines - 1;
          currentLineWidthMm = wordW % singleColWidthMm || singleColWidthMm;
        } else {
          currentLineWidthMm = wordW;
        }
      } else if (currentLineWidthMm + spaceWidthMm + wordW <= singleColWidthMm) {
        currentLineWidthMm += spaceWidthMm + wordW;
      } else {
        // Word wraps onto next line
        paraLines += 1;
        if (wordW > singleColWidthMm) {
          const wrappedWordLines = Math.ceil(wordW / singleColWidthMm);
          paraLines += wrappedWordLines - 1;
          currentLineWidthMm = wordW % singleColWidthMm || singleColWidthMm;
        } else {
          currentLineWidthMm = wordW;
        }
      }
    }

    totalSingleColLines += paraLines;
  }

  // Account for any non-rectangular geometric shape floated inside the text flow
  if (shapeExclusionAreaMm2 > 0 && singleColWidthMm > 0) {
    const extraDisplacedLines = Math.ceil(
      shapeExclusionAreaMm2 / (singleColWidthMm * lineAdvanceMm)
    );
    totalSingleColLines += extraDisplacedLines;
  }

  // Paragraph inter-spacing
  const interParaMm = Math.max(0, paragraphs.length - 1) * (fontHeightMm * 0.45);
  const linesPerColumn = Math.ceil(totalSingleColLines / Math.max(1, columns));

  // Vertical ottu & ascender/descender clearance so Telugu display headlines never clip
  const verticalGlyphClearanceMm =
    fontWeight >= 700
      ? fontHeightMm * 0.48 + (anyVerticalConjunct ? 2.4 : 1.6)
      : fontHeightMm * 0.3 + 1.4;

  const textHeightMm =
    linesPerColumn * lineAdvanceMm +
    interParaMm / Math.max(1, columns) +
    (hasContinuationNote ? 5.0 : 0) +
    2 * paddingMm +
    verticalGlyphClearanceMm;

  return {
    requiredWidthMm:
      Math.round(Math.min(allocatedWidthMm, Math.max(18, longestWordMm)) * 10) / 10,
    requiredHeightMm: Math.round(textHeightMm * 10) / 10,
    totalLines: totalSingleColLines,
    linesPerColumn,
    hasVerticalConjuncts: anyVerticalConjunct,
  };
}

/**
 * Pre-computes exact physical Telugu text & image measurements for every candidate article
 * across configurable column widths so the Designer (`gemini-3.5-flash-lite`) can craft an
 * intelligent, article-specific layout plan.
 */
export function computeInitialArticleMeasurementsForDesigner(
  articles: Article[],
  settings?: Partial<PublicationSettings>
): ArticleContentMeasurementProfile[] {
  const grid = resolveConfigurablePageGrid(settings);
  const leadCols = Math.max(3, Math.floor(grid.columnsPerPage * 0.625)); // 5 cols in 8-col grid (~192.4mm)
  const featCols = Math.max(2, Math.floor(grid.columnsPerPage * 0.375)); // 3 cols in 8-col grid (~114mm)
  const leadWidthMm = grid.spanWidthMm(leadCols);
  const featWidthMm = grid.spanWidthMm(featCols);
  const singleWidthMm = grid.spanWidthMm(Math.max(1, Math.floor(grid.columnsPerPage / 4)));

  return articles.map((art) => {
    const primaryHl = art.primaryHeadlineTelugu || art.originalHeadline || 'ముఖ్య వార్త';
    const compactHl = articleCompactHeadlineFallback(primaryHl, art.compactHeadlineTelugu);
    const standfirst = art.standfirstTelugu || art.summaryTelugu || '';
    const fullParas =
      art.aiBodyParagraphsFull && art.aiBodyParagraphsFull.length > 0
        ? art.aiBodyParagraphsFull
        : art.originalBodyTelugu.split(/\n+/).filter(Boolean);
    const shortParas =
      art.aiBodyParagraphsShort && art.aiBodyParagraphsShort.length > 0
        ? art.aiBodyParagraphsShort
        : fullParas.slice(0, Math.max(1, Math.ceil(fullParas.length / 2)));

    const asset =
      art.assets?.find((a) => a.id === art.primaryAssetId) ||
      (art.assets && art.assets.length > 0 ? art.assets[0] : null);

    const aspectRatio =
      asset && asset.height > 0 ? Number((asset.width / asset.height).toFixed(2)) : 1.6;

    // 1. Lead span measurement
    const leadHl = measureTeluguTextBlockMm({
      paragraphs: [primaryHl],
      allocatedWidthMm: leadWidthMm,
      fontFamily: 'Noto Sans Telugu',
      fontSizePt: 21,
      fontWeight: 800,
      lineHeight: 1.3,
      columns: 1,
      columnGapMm: 0,
      paddingMm: 1.2,
    });
    const leadSf = standfirst
      ? measureTeluguTextBlockMm({
          paragraphs: [standfirst],
          allocatedWidthMm: leadWidthMm,
          fontFamily: 'Noto Sans Telugu',
          fontSizePt: 10.5,
          fontWeight: 600,
          lineHeight: 1.38,
          columns: 1,
          columnGapMm: 0,
          paddingMm: 1.5,
        }).requiredHeightMm
      : 0;
    const leadBodyFull = measureTeluguTextBlockMm({
      paragraphs: fullParas,
      allocatedWidthMm: leadWidthMm,
      fontFamily: 'Noto Serif Telugu',
      fontSizePt: 10,
      fontWeight: 400,
      lineHeight: 1.5,
      columns: 3,
      columnGapMm: grid.gutterMm,
      paddingMm: 1,
    });
    const leadBodyShort = measureTeluguTextBlockMm({
      paragraphs: shortParas,
      allocatedWidthMm: leadWidthMm,
      fontFamily: 'Noto Serif Telugu',
      fontSizePt: 10,
      fontWeight: 400,
      lineHeight: 1.5,
      columns: 3,
      columnGapMm: grid.gutterMm,
      paddingMm: 1,
    });

    // 2. Feature span measurement
    const featHlPrimary = measureTeluguTextBlockMm({
      paragraphs: [primaryHl],
      allocatedWidthMm: featWidthMm,
      fontFamily: 'Noto Sans Telugu',
      fontSizePt: 16,
      fontWeight: 800,
      lineHeight: 1.3,
      columns: 1,
      columnGapMm: 0,
      paddingMm: 1,
    });
    const featHlCompact = measureTeluguTextBlockMm({
      paragraphs: [compactHl],
      allocatedWidthMm: featWidthMm,
      fontFamily: 'Noto Sans Telugu',
      fontSizePt: 14.5,
      fontWeight: 700,
      lineHeight: 1.28,
      columns: 1,
      columnGapMm: 0,
      paddingMm: 1,
    });
    const featSf = standfirst
      ? measureTeluguTextBlockMm({
          paragraphs: [standfirst],
          allocatedWidthMm: featWidthMm,
          fontFamily: 'Noto Sans Telugu',
          fontSizePt: 9.8,
          fontWeight: 600,
          lineHeight: 1.36,
          columns: 1,
          columnGapMm: 0,
          paddingMm: 1.2,
        }).requiredHeightMm
      : 0;
    const featBodyFull = measureTeluguTextBlockMm({
      paragraphs: fullParas,
      allocatedWidthMm: featWidthMm,
      fontFamily: 'Noto Serif Telugu',
      fontSizePt: 9.8,
      fontWeight: 400,
      lineHeight: 1.48,
      columns: 2,
      columnGapMm: grid.gutterMm,
      paddingMm: 1,
    });
    const featBodyShort = measureTeluguTextBlockMm({
      paragraphs: shortParas,
      allocatedWidthMm: featWidthMm,
      fontFamily: 'Noto Serif Telugu',
      fontSizePt: 9.8,
      fontWeight: 400,
      lineHeight: 1.48,
      columns: 2,
      columnGapMm: grid.gutterMm,
      paddingMm: 1,
    });

    // 3. Single/Digest span measurement
    const singleHl = measureTeluguTextBlockMm({
      paragraphs: [compactHl],
      allocatedWidthMm: singleWidthMm,
      fontFamily: 'Noto Sans Telugu',
      fontSizePt: 13.5,
      fontWeight: 700,
      lineHeight: 1.28,
      columns: 1,
      columnGapMm: 0,
      paddingMm: 1,
    });
    const singleBodyFull = measureTeluguTextBlockMm({
      paragraphs: fullParas,
      allocatedWidthMm: singleWidthMm,
      fontFamily: 'Noto Serif Telugu',
      fontSizePt: 9.5,
      fontWeight: 400,
      lineHeight: 1.46,
      columns: 1,
      columnGapMm: 0,
      paddingMm: 1,
    });
    const singleBodyShort = measureTeluguTextBlockMm({
      paragraphs: shortParas,
      allocatedWidthMm: singleWidthMm,
      fontFamily: 'Noto Serif Telugu',
      fontSizePt: 9.5,
      fontWeight: 400,
      lineHeight: 1.46,
      columns: 1,
      columnGapMm: 0,
      paddingMm: 1,
    });

    return {
      articleId: art.id,
      priorityScore: art.priorityScore,
      category: art.assignedCategory,
      categoryTelugu: art.assignedCategoryTelugu,
      hasPrimaryPhoto: Boolean(asset),
      primaryAssetId: asset?.id || null,
      primaryPhotoAspectRatio: aspectRatio,
      primaryHeadlineSyllables: countTeluguSyllables(primaryHl),
      compactHeadlineSyllables: countTeluguSyllables(compactHl),
      fullBodySyllables: countTeluguSyllables(fullParas.join(' ')),
      shortBodySyllables: countTeluguSyllables(shortParas.join(' ')),
      measuredHeightsMm: {
        lead_195mm_width: {
          headlinePrimaryMm: leadHl.requiredHeightMm,
          standfirstMm: leadSf,
          photoMm: asset ? 62 : 0,
          captionMm: asset ? 9.5 : 0,
          bodyFull3ColMm: leadBodyFull.requiredHeightMm,
          bodyShort3ColMm: leadBodyShort.requiredHeightMm,
        },
        feature_128mm_width: {
          headlinePrimaryMm: featHlPrimary.requiredHeightMm,
          headlineCompactMm: featHlCompact.requiredHeightMm,
          standfirstMm: featSf,
          photoMm: asset ? 48 : 0,
          captionMm: asset ? 9 : 0,
          bodyFull2ColMm: featBodyFull.requiredHeightMm,
          bodyShort2ColMm: featBodyShort.requiredHeightMm,
        },
        single_62mm_width: {
          headlineCompactMm: singleHl.requiredHeightMm,
          bodyFull1ColMm: singleBodyFull.requiredHeightMm,
          bodyShort1ColMm: singleBodyShort.requiredHeightMm,
        },
      },
    };
  });
}

function articleCompactHeadlineFallback(primary: string, compact?: string | null): string {
  if (compact && compact.trim().length > 0 && compact.trim().length < primary.trim().length) {
    return compact.trim();
  }
  const parts = primary.split(/\s*[—–-]\s*/);
  if (parts.length > 1 && parts[0].trim().length >= 12) {
    return parts[0].trim();
  }
  const words = primary.trim().split(/\s+/);
  if (words.length > 6) {
    return words.slice(0, 6).join(' ');
  }
  return primary;
}
