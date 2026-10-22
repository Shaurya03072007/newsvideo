import { GoogleGenAI, Type } from '@google/genai';
import type {
  Article,
  GeminiStoryOutput,
  GemmaClassificationOutput,
  PublicationSettings,
} from '../shared/types.ts';
import {
  DEFAULT_CATEGORIES,
  detectDuplicateArticles,
  validateGeminiStorySchema,
  validateGemmaClassificationSchema,
} from '../utils/editorialLogic.ts';
import { db } from './db.ts';

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in server environment secrets.');
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

function getCachedModelResult<T>(
  articleId: string,
  revisionNumber: number,
  modelId: string,
  promptVersion: string,
  stage: 'gemma_classify' | 'gemini_story'
): T | null {
  const cacheKey = `${articleId}:r${revisionNumber}:${modelId}:${promptVersion}:${stage}`;
  const row = db
    .prepare('SELECT output_json FROM ai_result_cache WHERE cache_key = ?')
    .get(cacheKey) as { output_json: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.output_json) as T;
  } catch {
    return null;
  }
}

function setCachedModelResult(
  articleId: string,
  revisionNumber: number,
  modelId: string,
  promptVersion: string,
  stage: 'gemma_classify' | 'gemini_story',
  output: unknown
) {
  const cacheKey = `${articleId}:r${revisionNumber}:${modelId}:${promptVersion}:${stage}`;
  db.prepare(
    `INSERT OR REPLACE INTO ai_result_cache (cache_key, article_id, revision_number, model_id, prompt_version, stage, output_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    cacheKey,
    articleId,
    revisionNumber,
    modelId,
    promptVersion,
    stage,
    JSON.stringify(output),
    new Date().toISOString()
  );
}

export function invalidateArticleCache(articleId: string) {
  db.prepare('DELETE FROM ai_result_cache WHERE article_id = ?').run(articleId);
}

function extractJsonObject(text: string): unknown {
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

async function withBoundedBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  maxAttempts = 3,
  onRetry?: (attempt: number, err: Error) => void
): Promise<T> {
  let lastError: Error = new Error('Unknown model error');
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts) {
        if (onRetry) onRetry(attempt, lastError);
        const delayMs = Math.min(4000, 500 * Math.pow(2, attempt - 1));
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError;
}

/**
 * Model A Adapter: Gemma 4 31B IT (`gemma-4-31b-it`)
 * Primary responsibility: News classification and editorial metadata.
 */
export async function classifyArticleWithGemma(
  article: Article,
  candidateArticles: { id: string; originalBodyTelugu: string; location: string }[],
  settings: PublicationSettings,
  onLog: (msg: string) => void
): Promise<{ output: GemmaClassificationOutput; cacheHit: boolean }> {
  const modelId = settings.modelAClassifierId || 'gemma-4-31b-it';
  const promptVersion = settings.promptVersion;

  const cached = getCachedModelResult<GemmaClassificationOutput>(
    article.id,
    article.currentRevision,
    modelId,
    promptVersion,
    'gemma_classify'
  );
  if (cached) {
    onLog(`Cache hit for Model A (${modelId}) on ${article.id} rev #${article.currentRevision}.`);
    return { output: cached, cacheHit: true };
  }

  const localDuplicates = detectDuplicateArticles(
    { id: article.id, originalBodyTelugu: article.originalBodyTelugu, location: article.location },
    candidateArticles
  );

  const allowedSectionList = settings.categories.map((c) => `${c.id} (${c.teluguLabel})`).join(', ');

  const prompt = `You are the Editorial Classification Engine for a Telugu daily newspaper.
Analyze the following reporter submission in Telugu and return ONLY a valid JSON object matching the exact schema below.

CRITICAL EDITORIAL RULES:
1. Do NOT invent facts, infer guilt, or treat unverified allegations as established facts.
2. Distinguish missing information from negative findings.
3. Priority score (1-100) is an editorial recommendation based on public interest, local relevance, and completeness.

ALLOWED NEWSPAPER SECTIONS:
${allowedSectionList}

REPORTER SUBMISSION:
- Article ID: ${article.id}
- Reporter Suggested Category: ${article.suggestedCategory}
- Reported Location: ${article.location} (District: ${article.district})
- Event Date: ${article.eventDate}
- Original Headline: ${article.originalHeadline || '(None provided)'}
- Original Telugu Text:
${article.originalBodyTelugu}

CANDIDATE DUPLICATE IDS DETECTED BY SHINGLE MATCH:
${JSON.stringify(localDuplicates)}

Return ONLY valid JSON with these exact keys:
{
  "section": "One of the exact English category names from the allowed list",
  "sectionTelugu": "Telugu section label",
  "principalSubject": "Concise Telugu summary of principal subject",
  "location": "Town/city in Telugu",
  "district": "District name in Telugu",
  "eventDate": "${article.eventDate}",
  "entities": ["Array of key people, departments, or places mentioned in Telugu"],
  "localRelevanceScore": 85,
  "priorityScore": 82,
  "priorityExplanation": "Short explanation of why this priority score was recommended",
  "duplicateCandidateIds": ["Array of duplicate candidate article IDs if any"],
  "packageGroupTopic": "Common news package topic in Telugu or null",
  "missingInformation": ["List any missing source details without guessing them"],
  "editorialConcerns": ["List any unverified allegations, defamation risks, or missing official responses"],
  "riskLevel": "low | medium | high",
  "hasSeriousAllegations": false,
  "hasUnverifiedClaims": false
}`;

  const output = await withBoundedBackoff(
    async (attempt) => {
      onLog(`Calling Model A (${modelId}), attempt ${attempt}...`);
      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          temperature: 0.2,
        },
      });
      const rawText = response.text || '';
      const parsed = extractJsonObject(rawText);
      const validation = validateGemmaClassificationSchema(
        parsed,
        settings.categories.map((c) => c.id)
      );
      if (!validation.valid || !validation.data) {
        throw new Error(`Gemma JSON schema validation failed: ${validation.errors.join('; ')}`);
      }
      // Merge deterministic shingle duplicate IDs if any
      const mergedDups = Array.from(
        new Set([...validation.data.duplicateCandidateIds, ...localDuplicates.map((d) => d.id)])
      );
      validation.data.duplicateCandidateIds = mergedDups;
      return validation.data;
    },
    3,
    (attempt, err) => {
      onLog(`Model A (${modelId}) attempt ${attempt} failed: ${err.message}. Retrying with exponential backoff...`);
    }
  );

  setCachedModelResult(article.id, article.currentRevision, modelId, promptVersion, 'gemma_classify', output);
  return { output, cacheHit: false };
}

/**
 * Model B Adapter: Gemini 3.5 Flash-Lite (`gemini-3.5-flash-lite`)
 * Primary responsibility: Complete Telugu story preparation in authentic newspaper style.
 */
export async function prepareTeluguStoryWithGemini(
  article: Article,
  gemmaMetadata: GemmaClassificationOutput,
  settings: PublicationSettings,
  onLog: (msg: string) => void
): Promise<{ output: GeminiStoryOutput; cacheHit: boolean }> {
  const modelId = settings.modelBStoryId || 'gemini-3.5-flash-lite';
  const promptVersion = settings.promptVersion;

  const cached = getCachedModelResult<GeminiStoryOutput>(
    article.id,
    article.currentRevision,
    modelId,
    promptVersion,
    'gemini_story'
  );
  if (cached) {
    onLog(`Cache hit for Model B (${modelId}) on ${article.id} rev #${article.currentRevision}.`);
    return { output: cached, cacheHit: true };
  }

  const assetsList = (article.assets || []).map((a) => ({
    assetId: a.id,
    reporterCaptionTelugu: a.captionTelugu,
    filename: a.originalFilename,
  }));

  const prompt = `మీరు ప్రముఖ తెలుగు దినపత్రిక ('ప్రజా వాణి') ప్రధాన ఉప-సంపాదకులు (Chief Sub-Editor).
క్రింద ఇచ్చిన విలేకరి వార్తా నివేదికను మరియు వర్గీకరణ వివరాలను పరిశీలించి, ముద్రణకు సిద్ధంగా ఉన్న తెలుగు వార్తా కథనాన్ని (JSON ఆకృతిలో) రూపొందించండి.

కఠినమైన సంపాదకీయ నియమాలు (CRITICAL RULES):
1. మూల వార్తలోని వ్యక్తుల పేర్లు, స్థలాలు, తేదీలు, సంఖ్యలు, గణాంకాలు మరియు వాస్తవాలను యథాతథంగా కాపాడాలి.
2. మూలంలో లేని కొత్త గణాంకాలు, ఊహాజనిత వ్యాఖ్యలు, సాక్షులు లేదా నిర్ధారణ కాని విషయాలను అస్సలు చేర్చవద్దు.
3. తెలుగు వ్యాకరణం, అక్షర దోషాలు సరిదిద్ది స్పష్టమైన వార్తాపత్రిక శైలిలో (Newspaper Telugu style) రాయండి. ఆంగ్లంలోకి అనువదించవద్దు.
4. వర్గీకరణ సమాచారం (Gemma Metadata) మూల వార్తకు విరుద్ధంగా ఉంటే, దానిని మౌనంగా మార్చకుండా 'contradictionFlags' లో స్పష్టంగా పేర్కొనండి.
5. ఫోటో క్యాప్షన్లు కేవలం విలేకరి ఇచ్చిన సమాచారం ఆధారంగానే ఉండాలి.

మూల వార్తా వివరాలు (ORIGINAL REPORTER SUBMISSION):
- స్థలం (Location): ${article.location} (${article.district})
- తేదీ (Event Date): ${article.eventDate}
- విలేకరి శీర్షిక (Original Headline): ${article.originalHeadline || '(ఇవ్వలేదు)'}
- మూల తెలుగు పాఠ్యం (Original Telugu Text):
${article.originalBodyTelugu}

మోడల్-A (Gemma 4 31B) వర్గీకరణ:
${JSON.stringify(gemmaMetadata, null, 2)}

ఫోటో వివరాలు (Uploaded Photos):
${JSON.stringify(assetsList, null, 2)}`;

  const output = await withBoundedBackoff(
    async (attempt) => {
      onLog(`Calling Model B (${modelId}) for Telugu story preparation, attempt ${attempt}...`);
      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              primaryHeadlineTelugu: {
                type: Type.STRING,
                description: 'प्रमुख వార్తా శీర్షిక (Primary multi-column Telugu headline, 6-12 words)',
              },
              compactHeadlineTelugu: {
                type: Type.STRING,
                description: 'ఇరుకైన నిలువు వరుసల కోసం చిన్న శీర్షిక (Short compact Telugu headline, 3-6 words)',
              },
              standfirstTelugu: {
                type: Type.STRING,
                description: 'ఉప శీర్షిక / ముఖ్యాంశం (Telugu standfirst/deck under headline)',
              },
              summaryTelugu: {
                type: Type.STRING,
                description: 'ఒకటి లేదా రెండు వాక్యాల సంక్షిప్త సారాంశం (Brief Telugu summary)',
              },
              bodyParagraphsFullTelugu: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'పూర్తి స్థాయి వార్తా పేరాలు (2-4 well-structured Telugu newspaper paragraphs starting with dateline)',
              },
              bodyParagraphsShortTelugu: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'తక్కువ స్థలం ఉన్నప్పుడు వాడే సంక్షిప్త వార్తా పేరాలు (1-2 compact Telugu paragraphs)',
              },
              suggestedCaptions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    assetId: { type: Type.STRING },
                    captionTelugu: { type: Type.STRING },
                    isVerifiedFromMetadata: { type: Type.BOOLEAN },
                  },
                  required: ['assetId', 'captionTelugu', 'isVerifiedFromMetadata'],
                },
              },
              preservedEntities: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              preservedNumbersAndDates: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              contradictionFlags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              missingFactsExplicitNote: {
                type: Type.STRING,
                nullable: true,
              },
            },
            required: [
              'primaryHeadlineTelugu',
              'compactHeadlineTelugu',
              'standfirstTelugu',
              'summaryTelugu',
              'bodyParagraphsFullTelugu',
              'bodyParagraphsShortTelugu',
              'suggestedCaptions',
              'preservedEntities',
              'preservedNumbersAndDates',
              'contradictionFlags',
            ],
          },
        },
      });

      const rawText = response.text || '';
      const parsed = extractJsonObject(rawText);
      const validation = validateGeminiStorySchema(parsed);
      if (!validation.valid || !validation.data) {
        throw new Error(`Gemini Telugu story schema validation failed: ${validation.errors.join('; ')}`);
      }
      return validation.data;
    },
    3,
    (attempt, err) => {
      onLog(`Model B (${modelId}) attempt ${attempt} failed: ${err.message}. Retrying with exponential backoff...`);
    }
  );

  setCachedModelResult(article.id, article.currentRevision, modelId, promptVersion, 'gemini_story', output);
  return { output, cacheHit: false };
}
