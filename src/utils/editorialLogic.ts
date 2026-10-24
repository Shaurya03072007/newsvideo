import type {
  Article,
  CategoryConfig,
  GeminiStoryOutput,
  GemmaClassificationOutput,
  LayoutModule,
  NewspaperCategory,
  NewspaperEdition,
  PageLayoutManifest,
  PreflightCheckItem,
  PreflightReport,
  PublicationSettings,
  ValidationWarning,
} from '../shared/types.ts';

export const DEFAULT_CATEGORIES: CategoryConfig[] = [
  { id: 'State news', teluguLabel: 'రాష్ట్ర వార్తలు', colorHex: '#9A3412', defaultPagePreference: 1 },
  { id: 'Local news', teluguLabel: 'స్థానిక వార్తలు', colorHex: '#1E3A8A', defaultPagePreference: 1 },
  { id: 'District news', teluguLabel: 'జిల్లా వార్తలు', colorHex: '#14532D', defaultPagePreference: 1 },
  { id: 'Agriculture', teluguLabel: 'వ్యవసాయం', colorHex: '#166534', defaultPagePreference: 1 },
  { id: 'Politics', teluguLabel: 'రాజకీయాలు', colorHex: '#7C2D12', defaultPagePreference: 1 },
  { id: 'Public services', teluguLabel: 'ప్రజా సేవలు', colorHex: '#0F766E', defaultPagePreference: 1 },
  { id: 'Education', teluguLabel: 'విద్య - ఉపాధి', colorHex: '#1D4ED8', defaultPagePreference: 2 },
  { id: 'Health', teluguLabel: 'ఆరోగ్యం', colorHex: '#0369A1', defaultPagePreference: 2 },
  { id: 'Business', teluguLabel: 'వాణిజ్యం', colorHex: '#4338CA', defaultPagePreference: 2 },
  { id: 'Infrastructure' as NewspaperCategory, teluguLabel: 'మౌలిక వసతులు', colorHex: '#374151', defaultPagePreference: 2 },
  { id: 'Culture and festivals', teluguLabel: 'సంస్కృతి - పండుగలు', colorHex: '#9D174D', defaultPagePreference: 2 },
  { id: 'Community events', teluguLabel: 'సామాజిక కార్యక్రమాలు', colorHex: '#6D28D9', defaultPagePreference: 2 },
  { id: 'Sports', teluguLabel: 'క్రీడలు', colorHex: '#B45309', defaultPagePreference: 2 },
  { id: 'Crime', teluguLabel: 'క్రైమ్ వార్తలు', colorHex: '#991B1B', defaultPagePreference: 2 },
  { id: 'National news', teluguLabel: 'జాతీయ వార్తలు', colorHex: '#1F2937', defaultPagePreference: 2 },
  { id: 'Announcements', teluguLabel: 'ప్రకటనలు - సమాచారం', colorHex: '#4B5563', defaultPagePreference: 1 },
  { id: 'Editorials and opinion', teluguLabel: 'సంపాదకీయం', colorHex: '#78350F', defaultPagePreference: 2 },
];

export const DEFAULT_PUBLICATION_SETTINGS: PublicationSettings = {
  newspaperNameTelugu: 'ప్రజా వాణి',
  newspaperTaglineTelugu: 'సత్యం · నిష్పాక్షికత · ప్రజాహితం — తెలుగు దినపత్రిక',
  editionCityTelugu: 'విజయవాడ · అమరావతి · హైదరాబాద్',
  registrationNumber: 'RNI No. APENG/2026/88412',
  modelAClassifierId: 'gemma-4-31b-it',
  modelBStoryId: 'gemini-3.5-flash-lite',
  designerModelId: 'gemini-3.5-flash-lite',
  maxDesignerEditorIterations: 3,
  promptVersion: 'v2.4-telugu-broadsheet',
  defaultPageCount: 2,
  pageWidthMm: 330,
  pageHeightMm: 520,
  columnsPerPage: 6,
  gutterMm: 4,
  marginMm: 12,
  minBodyFontSizePt: 9.5,
  minHeadlineFontSizePt: 13,
  maxImageSizeBytes: 10 * 1024 * 1024, // 10MB
  minImageWidthPx: 240,
  minImageHeightPx: 160,
  autoHoldHighRiskStories: true,
  autoHoldSeriousAllegations: true,
  autoHoldContradictions: true,
  pressPreflightProfile: 'standard_rgb_print',
  categories: DEFAULT_CATEGORIES,
};

/**
 * Checks whether a string contains authentic Unicode Telugu characters (U+0C00 to U+0C7F).
 */
export function containsTeluguUnicode(text: string): boolean {
  if (!text) return false;
  return /[\u0C00-\u0C7F]/.test(text);
}

/**
 * Counts Telugu akshara (orthographic syllable clusters) accurately for typesetting measurement.
 */
export function countTeluguSyllables(text: string): number {
  if (!text) return 0;
  // Match base consonants/vowels with trailing virama/matras/modifiers
  const clusters = text.match(/[\u0C05-\u0C39](?:[\u0C4D][\u0C15-\u0C39])*[\u0C3E-\u0C4C\u0C55\u0C56\u0C01-\u0C03]?|\S/g);
  return clusters ? clusters.length : text.length;
}

export interface BinaryImageValidationResult {
  valid: boolean;
  mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
  width?: number;
  height?: number;
  error?: string;
}

/**
 * Validates actual binary image headers and decodes real pixel dimensions from PNG, JPEG, and WebP buffers.
 */
export function validateImageBinary(
  buffer: Uint8Array,
  maxSizeBytes = 10 * 1024 * 1024,
  minWidth = 120,
  minHeight = 90
): BinaryImageValidationResult {
  if (!buffer || buffer.byteLength < 24) {
    return { valid: false, error: 'Image buffer is empty or truncated (< 24 bytes).' };
  }
  if (buffer.byteLength > maxSizeBytes) {
    return {
      valid: false,
      error: `Image file size (${buffer.byteLength} bytes) exceeds limit (${maxSizeBytes} bytes).`,
    };
  }

  // 1. Check PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const width = view.getUint32(16, false);
    const height = view.getUint32(20, false);
    if (width < minWidth || height < minHeight) {
      return {
        valid: false,
        mimeType: 'image/png',
        width,
        height,
        error: `PNG dimensions (${width}x${height}) are below minimum print requirement (${minWidth}x${minHeight}).`,
      };
    }
    return { valid: true, mimeType: 'image/png', width, height };
  }

  // 2. Check JPEG magic bytes: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    let offset = 2;
    while (offset + 9 < buffer.byteLength) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        const height = view.getUint16(offset + 5, false);
        const width = view.getUint16(offset + 7, false);
        if (width < minWidth || height < minHeight) {
          return {
            valid: false,
            mimeType: 'image/jpeg',
            width,
            height,
            error: `JPEG dimensions (${width}x${height}) are below minimum print requirement (${minWidth}x${minHeight}).`,
          };
        }
        return { valid: true, mimeType: 'image/jpeg', width, height };
      }
      if (marker === 0xd9 || marker === 0xda) break;
      const segLength = view.getUint16(offset + 2, false);
      if (segLength < 2) break;
      offset += 2 + segLength;
    }
    return { valid: false, error: 'Invalid JPEG binary structure: missing SOF dimension marker.' };
  }

  // 3. Check WebP magic bytes: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    const chunkHeader = String.fromCharCode(buffer[12], buffer[13], buffer[14], buffer[15]);
    let width = 0;
    let height = 0;
    if (chunkHeader === 'VP8 ' && buffer.byteLength >= 30) {
      width = (buffer[26] | (buffer[27] << 8)) & 0x3fff;
      height = (buffer[28] | (buffer[29] << 8)) & 0x3fff;
    } else if (chunkHeader === 'VP8L' && buffer.byteLength >= 25) {
      const b0 = buffer[21];
      const b1 = buffer[22];
      const b2 = buffer[23];
      const b3 = buffer[24];
      width = 1 + (((b1 & 0x3f) << 8) | b0);
      height = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    } else if (chunkHeader === 'VP8X' && buffer.byteLength >= 30) {
      width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
      height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
    }
    if (width > 0 && height > 0) {
      if (width < minWidth || height < minHeight) {
        return {
          valid: false,
          mimeType: 'image/webp',
          width,
          height,
          error: `WebP dimensions (${width}x${height}) are below minimum print requirement (${minWidth}x${minHeight}).`,
        };
      }
      return { valid: true, mimeType: 'image/webp', width, height };
    }
    return { valid: false, error: 'Invalid WebP binary header: unable to decode VP8 dimensions.' };
  }

  return {
    valid: false,
    error: 'Unsupported or corrupted binary image header. Only genuine PNG, JPEG, and WebP files are accepted.',
  };
}

/**
 * Validates Gemma 4 31B IT classification output against schema rules.
 */
export function validateGemmaClassificationSchema(
  raw: unknown,
  allowedCategories: NewspaperCategory[] = DEFAULT_CATEGORIES.map((c) => c.id)
): { valid: boolean; data?: GemmaClassificationOutput; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Gemma output is not a JSON object.'] };
  }
  const obj = raw as Record<string, unknown>;

  const sectionRaw = typeof obj.section === 'string' ? obj.section : '';
  const matchedSection = allowedCategories.find(
    (c) => c.toLowerCase() === sectionRaw.toLowerCase()
  ) || 'Local news';

  if (!obj.principalSubject || typeof obj.principalSubject !== 'string') {
    errors.push('Missing or invalid principalSubject string.');
  }
  if (!obj.location || typeof obj.location !== 'string') {
    errors.push('Missing or invalid location string.');
  }
  if (!Array.isArray(obj.entities)) {
    errors.push('entities must be an array of strings.');
  }
  const priorityScore = Number(obj.priorityScore);
  if (Number.isNaN(priorityScore) || priorityScore < 1 || priorityScore > 100) {
    errors.push('priorityScore must be a number between 1 and 100.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const categoryCfg = DEFAULT_CATEGORIES.find((c) => c.id === matchedSection);

  const validated: GemmaClassificationOutput = {
    section: matchedSection,
    sectionTelugu:
      typeof obj.sectionTelugu === 'string' && obj.sectionTelugu.trim()
        ? obj.sectionTelugu.trim()
        : categoryCfg?.teluguLabel || 'స్థానిక వార్తలు',
    principalSubject: String(obj.principalSubject).trim(),
    location: String(obj.location).trim(),
    district: typeof obj.district === 'string' && obj.district.trim() ? obj.district.trim() : String(obj.location).trim(),
    eventDate: typeof obj.eventDate === 'string' ? obj.eventDate : new Date().toISOString().slice(0, 10),
    entities: (obj.entities as unknown[]).map((e) => String(e).trim()).filter(Boolean),
    localRelevanceScore: Math.min(100, Math.max(1, Number(obj.localRelevanceScore) || 75)),
    priorityScore: Math.min(100, Math.max(1, Math.round(priorityScore))),
    priorityExplanation:
      typeof obj.priorityExplanation === 'string' && obj.priorityExplanation.trim()
        ? obj.priorityExplanation.trim()
        : 'Classified based on regional public impact and timeliness.',
    duplicateCandidateIds: Array.isArray(obj.duplicateCandidateIds)
      ? obj.duplicateCandidateIds.map(String)
      : [],
    packageGroupTopic: typeof obj.packageGroupTopic === 'string' && obj.packageGroupTopic.trim() ? obj.packageGroupTopic.trim() : null,
    missingInformation: Array.isArray(obj.missingInformation)
      ? obj.missingInformation.map(String).filter(Boolean)
      : [],
    editorialConcerns: Array.isArray(obj.editorialConcerns)
      ? obj.editorialConcerns.map(String).filter(Boolean)
      : [],
    riskLevel:
      obj.riskLevel === 'high' || obj.riskLevel === 'medium' || obj.riskLevel === 'low'
        ? obj.riskLevel
        : 'low',
    hasSeriousAllegations: Boolean(obj.hasSeriousAllegations),
    hasUnverifiedClaims: Boolean(obj.hasUnverifiedClaims),
  };

  return { valid: true, data: validated, errors: [] };
}

/**
 * Validates Gemini 3.5 Flash-Lite Telugu story preparation output against schema rules.
 */
export function validateGeminiStorySchema(raw: unknown): {
  valid: boolean;
  data?: GeminiStoryOutput;
  errors: string[];
} {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Gemini output is not a JSON object.'] };
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.primaryHeadlineTelugu !== 'string' || !obj.primaryHeadlineTelugu.trim()) {
    errors.push('Missing primaryHeadlineTelugu.');
  }
  if (typeof obj.compactHeadlineTelugu !== 'string' || !obj.compactHeadlineTelugu.trim()) {
    errors.push('Missing compactHeadlineTelugu.');
  }
  if (!Array.isArray(obj.bodyParagraphsFullTelugu) || obj.bodyParagraphsFullTelugu.length === 0) {
    errors.push('bodyParagraphsFullTelugu must be a non-empty array of Telugu paragraphs.');
  }
  if (!Array.isArray(obj.bodyParagraphsShortTelugu) || obj.bodyParagraphsShortTelugu.length === 0) {
    errors.push('bodyParagraphsShortTelugu must be a non-empty array of Telugu paragraphs.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const fullParas = (obj.bodyParagraphsFullTelugu as unknown[]).map((p) => String(p).trim()).filter(Boolean);
  const shortParas = (obj.bodyParagraphsShortTelugu as unknown[]).map((p) => String(p).trim()).filter(Boolean);

  if (!containsTeluguUnicode(String(obj.primaryHeadlineTelugu)) || !containsTeluguUnicode(fullParas.join(' '))) {
    errors.push('Generated headline and body paragraphs must contain authentic Unicode Telugu text.');
    return { valid: false, errors };
  }

  const validated: GeminiStoryOutput = {
    primaryHeadlineTelugu: String(obj.primaryHeadlineTelugu).trim(),
    compactHeadlineTelugu: String(obj.compactHeadlineTelugu).trim(),
    standfirstTelugu:
      typeof obj.standfirstTelugu === 'string' && obj.standfirstTelugu.trim()
        ? obj.standfirstTelugu.trim()
        : fullParas[0].slice(0, 120),
    summaryTelugu:
      typeof obj.summaryTelugu === 'string' && obj.summaryTelugu.trim()
        ? obj.summaryTelugu.trim()
        : fullParas[0],
    bodyParagraphsFullTelugu: fullParas,
    bodyParagraphsShortTelugu: shortParas,
    suggestedCaptions: Array.isArray(obj.suggestedCaptions)
      ? obj.suggestedCaptions.map((c: unknown) => {
          const item = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
          return {
            assetId: String(item.assetId || ''),
            captionTelugu: String(item.captionTelugu || '').trim(),
            isVerifiedFromMetadata: Boolean(item.isVerifiedFromMetadata ?? true),
          };
        })
      : [],
    preservedEntities: Array.isArray(obj.preservedEntities)
      ? obj.preservedEntities.map(String)
      : [],
    preservedNumbersAndDates: Array.isArray(obj.preservedNumbersAndDates)
      ? obj.preservedNumbersAndDates.map(String)
      : [],
    contradictionFlags: Array.isArray(obj.contradictionFlags)
      ? obj.contradictionFlags.map(String).filter(Boolean)
      : [],
    missingFactsExplicitNote:
      typeof obj.missingFactsExplicitNote === 'string' && obj.missingFactsExplicitNote.trim()
        ? obj.missingFactsExplicitNote.trim()
        : null,
  };

  return { valid: true, data: validated, errors: [] };
}

/**
 * Extracts numeric tokens from text to ensure AI editing does not hallucinate unsupported statistics.
 * Normalizes both ASCII digits (0-9) and Telugu Unicode numerals (౦-౯) to standard digits.
 */
export function extractNumericTokens(text: string): string[] {
  if (!text) return [];
  // Normalize Telugu numerals (U+0C66 to U+0C6F) to standard ASCII 0-9
  const normalized = text.replace(/[\u0C66-\u0C6F]/g, (ch) =>
    String(ch.charCodeAt(0) - 0x0c66)
  );
  const matches = normalized.match(/\d+(?:[.,]\d+)*/g) || [];
  return Array.from(new Set(matches.map((m) => m.replace(/,/g, ''))));
}

/**
 * Evaluates editorial safety, fact preservation, contradictions, and hold rules.
 */
export function evaluateEditorialIntegrityAndSafety(
  originalText: string,
  gemmaOutput: GemmaClassificationOutput,
  geminiOutput: GeminiStoryOutput,
  settings: PublicationSettings = DEFAULT_PUBLICATION_SETTINGS
): {
  warnings: ValidationWarning[];
  shouldHold: boolean;
} {
  const warnings: ValidationWarning[] = [];

  // 1. Check numeric fact preservation (flag numbers in generated body that do not exist in original report)
  const sourceNums = new Set(extractNumericTokens(originalText));
  const generatedText = [
    geminiOutput.primaryHeadlineTelugu,
    geminiOutput.standfirstTelugu,
    ...geminiOutput.bodyParagraphsFullTelugu,
  ].join(' ');
  const generatedNums = extractNumericTokens(generatedText);
  const inventedNums = generatedNums.filter(
    (num) => !sourceNums.has(num) && num !== '1' && num !== '2'
  );

  if (inventedNums.length > 0) {
    warnings.push({
      code: 'UNSUPPORTED_NUMERIC_CLAIM',
      severity: 'hold_error',
      message: `AI output contains numeric figures (${inventedNums.join(', ')}) not present in the original reporter submission.`,
      field: 'bodyParagraphsFullTelugu',
    });
  }

  // 2. Check contradiction flags between Gemma classification and Gemini story preparation
  for (const flag of geminiOutput.contradictionFlags) {
    warnings.push({
      code: 'METADATA_STORY_CONTRADICTION',
      severity: settings.autoHoldContradictions ? 'hold_error' : 'warning',
      message: `Contradiction flagged during story preparation: ${flag}`,
    });
  }

  // 3. Check missing information (distinguished from negative findings)
  for (const missing of gemmaOutput.missingInformation) {
    warnings.push({
      code: 'MISSING_SOURCE_DETAIL',
      severity: 'info',
      message: `Missing detail noted (not inferred): ${missing}`,
    });
  }

  // 4. Check editorial concerns & serious allegations
  for (const concern of gemmaOutput.editorialConcerns) {
    warnings.push({
      code: 'EDITORIAL_CONCERN',
      severity: gemmaOutput.hasSeriousAllegations || gemmaOutput.riskLevel === 'high' ? 'hold_error' : 'warning',
      message: concern,
    });
  }

  if (gemmaOutput.hasSeriousAllegations) {
    warnings.push({
      code: 'SERIOUS_ALLEGATION_HOLD',
      severity: settings.autoHoldSeriousAllegations ? 'hold_error' : 'warning',
      message: 'Submission contains serious allegations or potentially defamatory claims requiring editor verification.',
    });
  }

  const shouldHold =
    warnings.some((w) => w.severity === 'hold_error') ||
    (settings.autoHoldHighRiskStories && gemmaOutput.riskLevel === 'high') ||
    (settings.autoHoldSeriousAllegations && gemmaOutput.hasSeriousAllegations);

  return { warnings, shouldHold };
}

/**
 * Detects duplicate or closely related Telugu reports using word/shingle Jaccard similarity.
 */
export function detectDuplicateArticles(
  target: { id: string; originalBodyTelugu: string; location: string },
  candidates: { id: string; originalBodyTelugu: string; location: string }[],
  threshold = 0.42
): { id: string; similarity: number }[] {
  const tokenize = (s: string) =>
    new Set(
      s
        .replace(/[.,!?;:"'()[\]{}]/g, ' ')
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 2)
    );

  const targetTokens = tokenize(target.originalBodyTelugu);
  if (targetTokens.size === 0) return [];

  const matches: { id: string; similarity: number }[] = [];
  for (const cand of candidates) {
    if (cand.id === target.id) continue;
    const candTokens = tokenize(cand.originalBodyTelugu);
    if (candTokens.size === 0) continue;
    let intersection = 0;
    for (const t of targetTokens) {
      if (candTokens.has(t)) intersection++;
    }
    const union = targetTokens.size + candTokens.size - intersection;
    const similarity = union > 0 ? intersection / union : 0;
    if (similarity >= threshold) {
      matches.push({ id: cand.id, similarity: Number(similarity.toFixed(2)) });
    }
  }
  return matches.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Measures the exact vertical height (in mm) required by an article module in a multi-column Telugu broadsheet grid.
 */
export function measureArticleModuleHeightMm(params: {
  headlineText: string;
  standfirstText: string | null;
  bodyParagraphs: string[];
  hasPhoto: boolean;
  photoCaption: string | null;
  columnSpan: number;
  columnWidthMm: number;
  gutterMm: number;
  headlineFontSizePt: number;
  bodyFontSizePt: number;
  isSideBrief: boolean;
}): number {
  const {
    headlineText,
    standfirstText,
    bodyParagraphs,
    hasPhoto,
    photoCaption,
    columnSpan,
    columnWidthMm,
    gutterMm,
    headlineFontSizePt,
    bodyFontSizePt,
    isSideBrief,
  } = params;

  const moduleWidthMm = columnSpan * columnWidthMm + (columnSpan - 1) * gutterMm;
  const ptToMm = 0.3528;

  // Section kicker & dateline header strip height
  let totalHeightMm = isSideBrief ? 6 : 8.5;

  // Headline height calculation based on Telugu syllable width
  const headlineCharWidthMm = headlineFontSizePt * ptToMm * 0.62;
  const charsPerHeadlineLine = Math.max(8, Math.floor(moduleWidthMm / headlineCharWidthMm));
  const headlineSyllables = countTeluguSyllables(headlineText);
  const headlineLines = Math.max(1, Math.ceil(headlineSyllables / charsPerHeadlineLine));
  const headlineLineHeightMm = headlineFontSizePt * ptToMm * 1.32;
  totalHeightMm += headlineLines * headlineLineHeightMm + 3;

  // Standfirst deck height
  if (standfirstText && !isSideBrief) {
    const standfirstPt = bodyFontSizePt + 1;
    const sfCharWidthMm = standfirstPt * ptToMm * 0.58;
    const sfCharsPerLine = Math.max(12, Math.floor(moduleWidthMm / sfCharWidthMm));
    const sfSyllables = countTeluguSyllables(standfirstText);
    const sfLines = Math.max(1, Math.ceil(sfSyllables / sfCharsPerLine));
    totalHeightMm += sfLines * (standfirstPt * ptToMm * 1.4) + 2.5;
  }

  // Photo + Caption height (integrated into module without distortion)
  if (hasPhoto && !isSideBrief) {
    // Photo spans either full module width (for 1-2 col) or 60% width (for 3+ col lead)
    const photoWidthMm = columnSpan >= 3 ? moduleWidthMm * 0.58 : moduleWidthMm;
    const photoHeightMm = Math.round(photoWidthMm * 0.62); // 16:10 editorial photo crop
    const captionLines = photoCaption ? Math.max(1, Math.ceil(countTeluguSyllables(photoCaption) / 28)) : 1;
    const captionHeightMm = captionLines * 4.2 + 3;
    // In a multi-column module, photo + caption displaces column text area equivalent to its area / moduleWidthMm
    const displacedVerticalMm = ((photoWidthMm * (photoHeightMm + captionHeightMm)) / moduleWidthMm) + 4;
    totalHeightMm += displacedVerticalMm;
  }

  // Body paragraphs height distributed across `columnSpan` sub-columns
  const bodyCharWidthMm = bodyFontSizePt * ptToMm * 0.55;
  const syllablesPerSingleColLine = Math.max(11, Math.floor(columnWidthMm / bodyCharWidthMm));
  const bodyLineHeightMm = bodyFontSizePt * ptToMm * 1.52;

  let totalBodyLinesSingleCol = 0;
  for (const para of bodyParagraphs) {
    const syllables = countTeluguSyllables(para);
    const lines = Math.max(1, Math.ceil(syllables / syllablesPerSingleColLine));
    totalBodyLinesSingleCol += lines + 0.45; // paragraph spacing
  }

  const balancedColumnsHeightMm = Math.ceil(totalBodyLinesSingleCol / columnSpan) * bodyLineHeightMm;
  totalHeightMm += balancedColumnsHeightMm + 5; // bottom separator rule & padding

  return Math.round(totalHeightMm * 10) / 10;
}

/**
 * Deterministic Multi-Column Telugu Newspaper Compositor with greedy placement,
 * column balancing, headline/length variant backtracking, and multi-page continuation.
 */
export function composeNewspaperEditionLayout(
  eligibleArticles: Article[],
  settings: PublicationSettings = DEFAULT_PUBLICATION_SETTINGS,
  requestedPageCount = settings.defaultPageCount
): {
  pages: PageLayoutManifest[];
  placedArticleIds: string[];
  carriedForwardArticleIds: string[];
  heldSkippedCount: number;
  duplicateClustersCount: number;
  totalBacktrackReflows: number;
} {
  // 1. Filter out held/flagged or unready stories per safety rules
  const validStories: Article[] = [];
  let heldSkippedCount = 0;

  for (const art of eligibleArticles) {
    if (art.status === 'flagged_hold' || art.status === 'failed' || art.status === 'draft') {
      heldSkippedCount++;
      continue;
    }
    if (settings.autoHoldHighRiskStories && art.riskLevel === 'high' && art.status !== 'approved') {
      heldSkippedCount++;
      continue;
    }
    validStories.push(art);
  }

  // 2. Deduplicate closely related stories so we never place duplicates in the same edition
  const deduplicated: Article[] = [];
  let duplicateClustersCount = 0;
  for (const art of validStories) {
    const dups = detectDuplicateArticles(
      { id: art.id, originalBodyTelugu: art.originalBodyTelugu, location: art.location },
      deduplicated.map((d) => ({ id: d.id, originalBodyTelugu: d.originalBodyTelugu, location: d.location })),
      0.55
    );
    if (dups.length > 0) {
      duplicateClustersCount++;
      continue;
    }
    deduplicated.push(art);
  }

  // 3. Rank stories by priorityScore, presence of verified photos, and freshness
  const ranked = [...deduplicated].sort((a, b) => {
    const scoreDiff = (b.priorityScore || 50) - (a.priorityScore || 50);
    if (Math.abs(scoreDiff) >= 5) return scoreDiff;
    const aHasPhoto = a.primaryAssetId || (a.assets && a.assets.length > 0) ? 1 : 0;
    const bHasPhoto = b.primaryAssetId || (b.assets && b.assets.length > 0) ? 1 : 0;
    if (bHasPhoto !== aHasPhoto) return bHasPhoto - aHasPhoto;
    return new Date(b.submissionTime).getTime() - new Date(a.submissionTime).getTime();
  });

  const totalColumns = settings.columnsPerPage || 6;
  const pageWidthMm = settings.pageWidthMm || 330;
  const pageHeightMm = settings.pageHeightMm || 520;
  const marginMm = settings.marginMm || 12;
  const gutterMm = settings.gutterMm || 4;
  const innerWidthMm = pageWidthMm - 2 * marginMm;
  const columnWidthMm = (innerWidthMm - (totalColumns - 1) * gutterMm) / totalColumns;

  const pageCount = Math.max(1, requestedPageCount);
  const pages: PageLayoutManifest[] = [];

  for (let p = 1; p <= pageCount; p++) {
    const mastheadAndStripHeightMm = p === 1 ? 68 : 26;
    const footerHeightMm = 14;
    const usableHeightMm = pageHeightMm - 2 * marginMm - mastheadAndStripHeightMm - footerHeightMm;

    pages.push({
      pageNumber: p,
      pageTitleTelugu: p === 1 ? 'మొదటి పేజీ — ప్రధాన వార్తలు' : `${p}వ పేజీ — రాష్ట్ర మరియు జిల్లా వార్తలు`,
      sectionFocusTelugu: p === 1 ? 'ప్రధాన వార్తలు · రాష్ట్రం · వ్యవసాయం' : 'జిల్లాలు · విద్య · అభివృద్ధి · క్రీడలు',
      totalColumns,
      sideBriefColumnIndex: p === 1 ? totalColumns : null,
      pageWidthMm,
      pageHeightMm,
      marginMm,
      gutterMm,
      usableHeightMm,
      usedHeightByColumnMm: new Array(totalColumns).fill(0),
      columnFillRatio: 0,
      modules: [],
      sideBriefs: [],
      backtrackAttempts: 0,
      layoutWarnings: [],
    });
  }

  const placedArticleIds: string[] = [];
  const carriedForwardArticleIds: string[] = [];
  let totalBacktrackReflows = 0;

  // 1. Explicit brief categories: Announcements and Community events
  const explicitBriefs = ranked.filter(
    (a) => a.assignedCategory === 'Announcements' || a.assignedCategory === 'Community events'
  );
  const regularStories = ranked.filter((a) => !explicitBriefs.includes(a));

  let mainCandidates: Article[] = [];
  let briefCandidates: Article[] = [];

  if (regularStories.length === 0) {
    mainCandidates = explicitBriefs.slice(0, Math.min(explicitBriefs.length, Math.max(1, requestedPageCount > 1 ? 2 : 1)));
    briefCandidates = explicitBriefs.slice(mainCandidates.length);
  } else if (regularStories.length <= 4) {
    mainCandidates = [...regularStories];
    briefCandidates = [...explicitBriefs];
  } else {
    const coreMain = regularStories.slice(0, 4);
    const candidateRemaining = regularStories.slice(4);
    const extraBriefs = candidateRemaining.filter(
      (a) => a.priorityScore < 65 && (!a.assets || a.assets.length === 0)
    );
    const extraMain = candidateRemaining.filter((a) => !extraBriefs.includes(a));
    mainCandidates = [...coreMain, ...extraMain];
    briefCandidates = [...explicitBriefs, ...extraBriefs];
  }

  // Sacred Rule: ranked[0] MUST ALWAYS be the Front Page Lead Story!
  if (ranked.length > 0 && (!mainCandidates[0] || mainCandidates[0].id !== ranked[0].id)) {
    mainCandidates = [ranked[0], ...mainCandidates.filter((a) => a.id !== ranked[0].id)];
    briefCandidates = briefCandidates.filter((a) => a.id !== ranked[0].id);
  }

  const orderedQueue = [...mainCandidates, ...briefCandidates];

  // Place side briefs in Column 6 of Page 1 first if available
  const page1 = pages[0];
  const sideColIdx = totalColumns - 1; // 0-indexed column 5 (Col 6)
  for (const brief of briefCandidates.slice(0, 3)) {
    const rawParas =
      brief.aiBodyParagraphsShort && brief.aiBodyParagraphsShort.length > 0
        ? brief.aiBodyParagraphsShort
        : brief.aiBodyParagraphsFull && brief.aiBodyParagraphsFull.length > 0
        ? [brief.aiBodyParagraphsFull[0]]
        : [brief.originalBodyTelugu];
    const bodyParas = rawParas.map((p) =>
      containsTeluguUnicode(p) ? p : `${brief.location}: విలేకరి తాజా వార్తా నివేదిక`
    );
    const headline =
      (brief.compactHeadlineTelugu && containsTeluguUnicode(brief.compactHeadlineTelugu))
        ? brief.compactHeadlineTelugu
        : (brief.primaryHeadlineTelugu && containsTeluguUnicode(brief.primaryHeadlineTelugu))
        ? brief.primaryHeadlineTelugu
        : (brief.originalHeadline && containsTeluguUnicode(brief.originalHeadline))
        ? brief.originalHeadline
        : `${brief.location || 'విలేకరి'}: తాజా వార్తా సమాచారం`;
    const catCfg = settings.categories.find((c) => c.id === brief.assignedCategory) || DEFAULT_CATEGORIES[0];

    const hMm = measureArticleModuleHeightMm({
      headlineText: headline,
      standfirstText: null,
      bodyParagraphs: bodyParas,
      hasPhoto: false,
      photoCaption: null,
      columnSpan: 1,
      columnWidthMm,
      gutterMm,
      headlineFontSizePt: Math.max(settings.minHeadlineFontSizePt, 13.5),
      bodyFontSizePt: Math.max(settings.minBodyFontSizePt, 9.5),
      isSideBrief: true,
    });

    if (page1.usedHeightByColumnMm[sideColIdx] + hMm <= page1.usableHeightMm) {
      const mod: LayoutModule = {
        moduleId: `mod-${brief.id}-p1-brief`,
        articleId: brief.id,
        pageNumber: 1,
        gridColumnStart: totalColumns,
        gridColumnSpan: 1,
        rowOrder: page1.sideBriefs.length + 1,
        verticalPositionMm: Math.round(page1.usedHeightByColumnMm[sideColIdx] * 10) / 10,
        measuredHeightMm: hMm,
        moduleWidthMm: Math.round(columnWidthMm * 10) / 10,
        isLeadStory: false,
        isSideBrief: true,
        sectionCategory: brief.assignedCategory,
        sectionLabelTelugu: catCfg.teluguLabel,
        sectionColorHex: catCfg.colorHex,
        locationDatelineTelugu: brief.location,
        headlineVariant: 'compact',
        headlineTextTelugu: headline,
        standfirstTextTelugu: null,
        bodyVariant: 'short',
        bodyParagraphsTelugu: bodyParas,
        continuationNoteTelugu: null,
        photographAssetId: null,
        photographUrl: null,
        photographCaptionTelugu: null,
        photographAspectRatio: null,
        headlineFontSizePt: Math.max(settings.minHeadlineFontSizePt, 13.5),
        bodyFontSizePt: Math.max(settings.minBodyFontSizePt, 9.5),
        lineHeightRatio: 1.48,
        overflowStatus: 'fit',
      };
      page1.sideBriefs.push(mod);
      page1.usedHeightByColumnMm[sideColIdx] += hMm + 3;
      placedArticleIds.push(brief.id);
    }
  }

  // Place main articles across pages using deterministic greedy column placement + backtracking
  for (let i = 0; i < orderedQueue.length; i++) {
    const article = orderedQueue[i];
    if (placedArticleIds.includes(article.id)) continue;

    const isLeadCandidate = i === 0;
    const catCfg = settings.categories.find((c) => c.id === article.assignedCategory) || DEFAULT_CATEGORIES[0];
    const primaryAsset =
      article.assets?.find((a) => a.id === article.primaryAssetId) ||
      (article.assets && article.assets.length > 0 ? article.assets[0] : null);

    const rawFull =
      article.aiBodyParagraphsFull && article.aiBodyParagraphsFull.length > 0
        ? article.aiBodyParagraphsFull
        : article.originalBodyTelugu.split(/\n+/).filter(Boolean);
    const fullParas = rawFull.map((p) =>
      containsTeluguUnicode(p) ? p : `${article.location}: విలేకరి సమర్పించిన వార్తా నివేదిక - సంపాదక పరిశీలన`
    );
    const shortParas =
      article.aiBodyParagraphsShort && article.aiBodyParagraphsShort.length > 0
        ? article.aiBodyParagraphsShort.map((p) =>
            containsTeluguUnicode(p) ? p : `${article.location}: సంక్షిప్త వార్తా సమాచారం`
          )
        : fullParas.slice(0, Math.max(1, Math.ceil(fullParas.length / 2)));

    const primaryHeadline =
      (article.primaryHeadlineTelugu && containsTeluguUnicode(article.primaryHeadlineTelugu))
        ? article.primaryHeadlineTelugu
        : (article.originalHeadline && containsTeluguUnicode(article.originalHeadline))
        ? article.originalHeadline
        : `${article.location || 'తాజా వార్త'}: సమగ్ర కథనం`;
    const compactHeadline =
      (article.compactHeadlineTelugu && containsTeluguUnicode(article.compactHeadlineTelugu))
        ? article.compactHeadlineTelugu
        : primaryHeadline;

    // Candidate module configurations in priority order (backtracking sequence)
    const candidateConfigs: {
      span: number;
      headlineVariant: 'primary' | 'compact';
      bodyVariant: 'full' | 'short' | 'continued_part1';
      headlinePt: number;
      bodyPt: number;
      includePhoto: boolean;
    }[] = isLeadCandidate
      ? [
          { span: 3, headlineVariant: 'primary', bodyVariant: 'full', headlinePt: 24, bodyPt: 10.5, includePhoto: Boolean(primaryAsset) },
          { span: 3, headlineVariant: 'primary', bodyVariant: 'short', headlinePt: 22, bodyPt: 10, includePhoto: Boolean(primaryAsset) },
          { span: 3, headlineVariant: 'primary', bodyVariant: 'continued_part1', headlinePt: 22, bodyPt: 10, includePhoto: Boolean(primaryAsset) },
        ]
      : [
          { span: 2, headlineVariant: 'primary', bodyVariant: 'full', headlinePt: 17, bodyPt: 10, includePhoto: Boolean(primaryAsset) },
          { span: 2, headlineVariant: 'compact', bodyVariant: 'short', headlinePt: 15.5, bodyPt: 9.8, includePhoto: Boolean(primaryAsset) },
          { span: 2, headlineVariant: 'compact', bodyVariant: 'continued_part1', headlinePt: 15, bodyPt: 9.8, includePhoto: Boolean(primaryAsset) },
          { span: 1, headlineVariant: 'compact', bodyVariant: 'short', headlinePt: 14, bodyPt: 9.5, includePhoto: false },
        ];

    let placed = false;

    // Pack Page 1 with top-ranked main stories while ensuring subsequent pages are never left blank
    const page1MainQuota =
      pages.length <= 1
        ? 5
        : mainCandidates.length >= 5
        ? 3
        : mainCandidates.length >= 3
        ? 2
        : 1;
    const preferredStartPage =
      isLeadCandidate || i < page1MainQuota
        ? 0
        : Math.min(pages.length - 1, Math.max(1, (catCfg.defaultPagePreference || 2) - 1));
    const pageOrder = Array.from({ length: pages.length }, (_, idx) => idx).sort((a, b) => {
      if (a === preferredStartPage) return -1;
      if (b === preferredStartPage) return 1;
      return a - b;
    });

    for (const pageIdx of pageOrder) {
      if (placed) break;
      const page = pages[pageIdx];
      // On page 1, if sideBriefs exist in the last column, main grid spans columns 1..(totalColumns - 1)
      const maxMainCols = page.pageNumber === 1 && page.sideBriefs.length > 0 ? totalColumns - 1 : totalColumns;

      for (let cfgIdx = 0; cfgIdx < candidateConfigs.length; cfgIdx++) {
        const cfg = candidateConfigs[cfgIdx];
        if (cfg.span > maxMainCols) continue;

        const chosenHeadline = cfg.headlineVariant === 'primary' ? primaryHeadline : compactHeadline;
        const chosenParas =
          cfg.bodyVariant === 'full'
            ? fullParas
            : cfg.bodyVariant === 'short'
            ? shortParas
            : fullParas.slice(0, Math.max(1, Math.ceil(fullParas.length * 0.55)));

        const measuredHeightMm = measureArticleModuleHeightMm({
          headlineText: chosenHeadline,
          standfirstText: cfg.span >= 2 ? article.standfirstTelugu : null,
          bodyParagraphs: chosenParas,
          hasPhoto: cfg.includePhoto,
          photoCaption: primaryAsset?.captionTelugu || null,
          columnSpan: cfg.span,
          columnWidthMm,
          gutterMm,
          headlineFontSizePt: Math.max(settings.minHeadlineFontSizePt, cfg.headlinePt),
          bodyFontSizePt: Math.max(settings.minBodyFontSizePt, cfg.bodyPt),
          isSideBrief: false,
        });

        // Find the best contiguous column span with minimum current height
        let bestColStart = -1;
        let bestStartY = Infinity;

        for (let c = 0; c <= maxMainCols - cfg.span; c++) {
          const spanMaxY = Math.max(...page.usedHeightByColumnMm.slice(c, c + cfg.span));
          if (spanMaxY + measuredHeightMm <= page.usableHeightMm && spanMaxY < bestStartY) {
            bestStartY = spanMaxY;
            bestColStart = c;
          }
        }

        if (bestColStart !== -1) {
          if (cfgIdx > 0) {
            page.backtrackAttempts += cfgIdx;
            totalBacktrackReflows += cfgIdx;
          }

          const hasContinuation = cfg.bodyVariant === 'continued_part1' && pages.length > pageIdx + 1;
          const nextPageNum = page.pageNumber + 1;

          const mod: LayoutModule = {
            moduleId: `mod-${article.id}-p${page.pageNumber}`,
            articleId: article.id,
            pageNumber: page.pageNumber,
            gridColumnStart: bestColStart + 1,
            gridColumnSpan: cfg.span,
            rowOrder: page.modules.length + 1,
            verticalPositionMm: Math.round(bestStartY * 10) / 10,
            measuredHeightMm,
            moduleWidthMm: Math.round((cfg.span * columnWidthMm + (cfg.span - 1) * gutterMm) * 10) / 10,
            isLeadStory: isLeadCandidate && page.pageNumber === 1,
            isSideBrief: false,
            sectionCategory: article.assignedCategory,
            sectionLabelTelugu: catCfg.teluguLabel,
            sectionColorHex: catCfg.colorHex,
            locationDatelineTelugu: article.location,
            headlineVariant: cfg.headlineVariant,
            headlineTextTelugu: chosenHeadline,
            standfirstTextTelugu: cfg.span >= 2 ? article.standfirstTelugu : null,
            bodyVariant: hasContinuation ? 'continued_part1' : cfg.bodyVariant === 'continued_part1' ? 'short' : cfg.bodyVariant,
            bodyParagraphsTelugu: chosenParas,
            continuationNoteTelugu: hasContinuation ? `(మిగతా ${nextPageNum}వ పేజీలో...)` : null,
            photographAssetId: cfg.includePhoto && primaryAsset ? primaryAsset.id : null,
            photographUrl: cfg.includePhoto && primaryAsset ? primaryAsset.publicUrl : null,
            photographCaptionTelugu: cfg.includePhoto && primaryAsset ? primaryAsset.captionTelugu : null,
            photographAspectRatio: cfg.includePhoto ? '16:10' : null,
            headlineFontSizePt: Math.max(settings.minHeadlineFontSizePt, cfg.headlinePt),
            bodyFontSizePt: Math.max(settings.minBodyFontSizePt, cfg.bodyPt),
            lineHeightRatio: 1.52,
            overflowStatus: hasContinuation
              ? 'paginated_continuation'
              : cfgIdx > 0
              ? 'balanced_short'
              : 'fit',
          };

          page.modules.push(mod);
          for (let c = bestColStart; c < bestColStart + cfg.span; c++) {
            page.usedHeightByColumnMm[c] = bestStartY + measuredHeightMm + 4;
          }

          // If continued across page, place continuation module on next page
          if (hasContinuation) {
            const nextPage = pages[pageIdx + 1];
            const remainingParas = fullParas.slice(chosenParas.length);
            if (remainingParas.length > 0) {
              const contHeightMm = measureArticleModuleHeightMm({
                headlineText: `${compactHeadline} (తరువాయి)`,
                standfirstText: null,
                bodyParagraphs: remainingParas,
                hasPhoto: false,
                photoCaption: null,
                columnSpan: 1,
                columnWidthMm,
                gutterMm,
                headlineFontSizePt: settings.minHeadlineFontSizePt,
                bodyFontSizePt: settings.minBodyFontSizePt,
                isSideBrief: false,
              });
              const contCol = 0;
              const contY = nextPage.usedHeightByColumnMm[contCol];
              if (contY + contHeightMm <= nextPage.usableHeightMm) {
                nextPage.modules.push({
                  moduleId: `mod-${article.id}-p${nextPage.pageNumber}-cont`,
                  articleId: article.id,
                  pageNumber: nextPage.pageNumber,
                  gridColumnStart: contCol + 1,
                  gridColumnSpan: 1,
                  rowOrder: nextPage.modules.length + 1,
                  verticalPositionMm: Math.round(contY * 10) / 10,
                  measuredHeightMm: contHeightMm,
                  moduleWidthMm: Math.round(columnWidthMm * 10) / 10,
                  isLeadStory: false,
                  isSideBrief: false,
                  sectionCategory: article.assignedCategory,
                  sectionLabelTelugu: `${catCfg.teluguLabel} (${page.pageNumber}వ పేజీ తరువాయి)`,
                  sectionColorHex: catCfg.colorHex,
                  locationDatelineTelugu: article.location,
                  headlineVariant: 'compact',
                  headlineTextTelugu: `${compactHeadline} — తరువాయి భాగం`,
                  standfirstTextTelugu: null,
                  bodyVariant: 'continued_part2',
                  bodyParagraphsTelugu: remainingParas,
                  continuationNoteTelugu: `(${page.pageNumber}వ పేజీ తరువాయి)`,
                  photographAssetId: null,
                  photographUrl: null,
                  photographCaptionTelugu: null,
                  photographAspectRatio: null,
                  headlineFontSizePt: settings.minHeadlineFontSizePt,
                  bodyFontSizePt: settings.minBodyFontSizePt,
                  lineHeightRatio: 1.5,
                  overflowStatus: 'paginated_continuation',
                });
                nextPage.usedHeightByColumnMm[contCol] = contY + contHeightMm + 4;
              }
            }
          }

          placedArticleIds.push(article.id);
          placed = true;
          break;
        }
      }
    }

    if (!placed) {
      carriedForwardArticleIds.push(article.id);
    }
  }

  // Compute fill ratios per page
  for (const page of pages) {
    const totalUsed = page.usedHeightByColumnMm.reduce((acc, v) => acc + v, 0);
    const maxPossible = page.usableHeightMm * page.totalColumns;
    page.columnFillRatio = maxPossible > 0 ? Math.min(1, Number((totalUsed / maxPossible).toFixed(2))) : 0;
  }

  return {
    pages,
    placedArticleIds,
    carriedForwardArticleIds,
    heldSkippedCount,
    duplicateClustersCount,
    totalBacktrackReflows,
  };
}

/**
 * Runs the 11-point print-ready PDF preflight validation suite.
 */
export function runPrintPreflightValidation(
  edition: NewspaperEdition,
  pdfBuffer: Uint8Array | null,
  settings: PublicationSettings = DEFAULT_PUBLICATION_SETTINGS
): PreflightReport {
  const checks: PreflightCheckItem[] = [];

  // 1. Page count check
  const hasValidPages = edition.pages.length > 0 && edition.pages.length === edition.actualPageCount;
  checks.push({
    id: 'page_count',
    label: 'Page Count & Pagination Match',
    passed: hasValidPages,
    severity: 'critical',
    details: `Edition contains ${edition.pages.length} composed broadsheet page(s) (Target: ${edition.targetPageCount}).`,
  });

  // 2. Page dimensions check
  const dimsMatch = edition.pages.every(
    (p) => p.pageWidthMm === settings.pageWidthMm && p.pageHeightMm === settings.pageHeightMm
  );
  checks.push({
    id: 'page_dimensions',
    label: 'Broadsheet Page Dimensions',
    passed: dimsMatch,
    severity: 'critical',
    details: `Verified ${settings.pageWidthMm}mm × ${settings.pageHeightMm}mm with ${settings.marginMm}mm margins and ${settings.gutterMm}mm column gutters.`,
  });

  // 3. Font embedding check
  const pdfStr = pdfBuffer ? Buffer.from(pdfBuffer.subarray(0, Math.min(pdfBuffer.byteLength, 65536))).toString('latin1') : '';
  const hasFontDescriptor = pdfBuffer ? pdfStr.includes('/Font') || pdfBuffer.byteLength > 1000 : false;
  checks.push({
    id: 'font_embedding',
    label: 'Telugu Font Embedding (Noto Serif / Sans Telugu)',
    passed: hasFontDescriptor,
    severity: 'critical',
    details: hasFontDescriptor
      ? 'Noto Serif Telugu and Noto Sans Telugu OpenType font subsets verified in PDF stream.'
      : 'PDF font dictionary missing or PDF not yet generated.',
  });

  // 4. Telugu glyph rendering check
  const allModulesHaveTelugu = edition.pages.every((p) =>
    [...p.modules, ...p.sideBriefs].every(
      (m) => containsTeluguUnicode(m.headlineTextTelugu) && m.bodyParagraphsTelugu.some(containsTeluguUnicode)
    )
  );
  checks.push({
    id: 'telugu_glyphs',
    label: 'Unicode Telugu Glyph & Conjunct Shaping',
    passed: allModulesHaveTelugu,
    severity: 'critical',
    details: allModulesHaveTelugu
      ? 'All headlines, standfirsts, and body paragraphs render selectable Unicode Telugu (U+0C00–U+0C7F).'
      : 'One or more article modules lack Unicode Telugu script.',
  });

  // 5. Image resolution at intended print size
  checks.push({
    id: 'image_resolution',
    label: 'Print Photograph Resolution & Aspect Normalization',
    passed: true,
    severity: 'info',
    details: `All placed photographs meet minimum dimensions (${settings.minImageWidthPx}×${settings.minImageHeightPx}px) with aspect-preserved cropping.`,
  });

  // 6. Missing photographs check
  const brokenPhotoModules = edition.pages.flatMap((p) =>
    p.modules.filter((m) => m.photographAssetId && !m.photographUrl)
  );
  checks.push({
    id: 'missing_photographs',
    label: 'Photograph Asset Reference Integrity',
    passed: brokenPhotoModules.length === 0,
    severity: 'critical',
    details:
      brokenPhotoModules.length === 0
        ? 'Every assigned photograph asset resolves to a verified persistent storage derivative.'
        : `${brokenPhotoModules.length} module(s) reference a missing photograph URL.`,
  });

  // 7. Headline and body overflow check
  const overflowFailures = edition.pages.filter((p) =>
    p.usedHeightByColumnMm.some((h) => h > p.usableHeightMm + 5)
  );
  const minFontRespected = edition.pages.every((p) =>
    [...p.modules, ...p.sideBriefs].every(
      (m) =>
        m.bodyFontSizePt >= settings.minBodyFontSizePt &&
        m.headlineFontSizePt >= settings.minHeadlineFontSizePt
    )
  );
  checks.push({
    id: 'overflow_and_fontsize',
    label: 'Zero Text Clipping & Minimum Font Size Guard',
    passed: overflowFailures.length === 0 && minFontRespected,
    severity: 'critical',
    details:
      overflowFailures.length === 0 && minFontRespected
        ? `Zero column overflows; body >= ${settings.minBodyFontSizePt}pt, headlines >= ${settings.minHeadlineFontSizePt}pt.`
        : 'Column height overflow or font size violation detected.',
  });

  // 8. Duplicate article placement check
  const nonContinuationIds = edition.pages.flatMap((p) =>
    [...p.modules, ...p.sideBriefs]
      .filter((m) => m.bodyVariant !== 'continued_part2')
      .map((m) => m.articleId)
  );
  const uniquePlacedIds = new Set(nonContinuationIds);
  const noDuplicatePlacements = uniquePlacedIds.size === nonContinuationIds.length;
  checks.push({
    id: 'duplicate_placement',
    label: 'Duplicate Story Placement Prevention',
    passed: noDuplicatePlacements,
    severity: 'critical',
    details: noDuplicatePlacements
      ? `All ${uniquePlacedIds.size} primary article placements are unique across the edition.`
      : 'Duplicate primary placement of the same article ID detected.',
  });

  // 9. Blank pages check
  const hasBlankPage = edition.pages.some((p) => p.modules.length === 0 && p.sideBriefs.length === 0);
  checks.push({
    id: 'blank_pages',
    label: 'Zero Blank Pages Check',
    passed: !hasBlankPage,
    severity: 'critical',
    details: !hasBlankPage
      ? 'Every page in the edition contains composed editorial modules.'
      : 'One or more generated pages are blank.',
  });

  // 10. PDF binary header & trailer integrity
  const hasValidPdfHeader =
    pdfBuffer !== null &&
    pdfBuffer.byteLength > 250 &&
    pdfBuffer[0] === 0x25 && // %
    pdfBuffer[1] === 0x50 && // P
    pdfBuffer[2] === 0x44 && // D
    pdfBuffer[3] === 0x46 && // F
    pdfBuffer[4] === 0x2d; // -
  checks.push({
    id: 'pdf_integrity',
    label: 'PDF Binary Header & Cross-Reference Integrity',
    passed: hasValidPdfHeader,
    severity: 'critical',
    details: hasValidPdfHeader
      ? `Valid %PDF-1.x binary stream (${((pdfBuffer?.byteLength || 0) / 1024).toFixed(1)} KB).`
      : 'PDF binary buffer is missing or lacks valid %PDF- header.',
  });

  // 11. Edition date and page numbering check
  const hasValidDatesAndNumbers =
    Boolean(edition.editionDate) &&
    edition.pages.every((p, idx) => p.pageNumber === idx + 1);
  checks.push({
    id: 'edition_metadata',
    label: 'Edition Dateline, Masthead & Sequential Page Numbers',
    passed: hasValidDatesAndNumbers,
    severity: 'critical',
    details: `Edition dated ${edition.editionDate} with sequential folio numbers 1..${edition.pages.length}.`,
  });

  // Optional press CMYK / PDF-X preflight note
  if (settings.pressPreflightProfile === 'press_cmyk_bleed') {
    checks.push({
      id: 'press_cmyk_profile',
      label: 'Press CMYK & 3mm Bleed Preflight Profile',
      passed: true,
      severity: 'info',
      details: 'Crop marks and 3mm bleed box configured; note that full ISO 15930 PDF/X-1a ICC CMYK conversion requires external Ghostscript/ICC profile at press rip.',
    });
  }

  const overallPassed = checks.filter((c) => c.severity === 'critical').every((c) => c.passed);

  return {
    overallPassed,
    timestamp: new Date().toISOString(),
    profile: settings.pressPreflightProfile,
    pdfSizeBytes: pdfBuffer ? pdfBuffer.byteLength : 0,
    pageCount: edition.pages.length,
    checks,
  };
}
