import crypto from 'node:crypto';
import { db, getArticleById, listArticles, logAuditEvent } from '../../db.ts';
import type { Article, ImageAsset } from '../../../shared/types.ts';

export interface CreateArticleAssetInput {
  assetUrl: string;
  assetType?: 'photograph' | 'illustration' | 'graphic';
  captionTelugu?: string;
  photographerCredit?: string;
  resolutionDpi?: number;
  isPrimaryPhoto?: boolean;
}

export interface CreateArticleInput {
  reporterId: string;
  originalHeadline?: string;
  originalBodyTelugu: string;
  suggestedCategory?: string;
  assignedCategory?: string;
  assignedCategoryTelugu?: string;
  location: string;
  district?: string;
  eventDate?: string;
  saveAsDraft?: boolean;
  priorityScore?: number;
  assets?: CreateArticleAssetInput[];
  idempotencyKey?: string;
}

export const articlesRepo = {
  list(filters?: { reporterId?: string; location?: string; status?: string; category?: string }): Article[] {
    return listArticles(filters);
  },

  getById(id: string): Article | null {
    return getArticleById(id);
  },

  findByIdempotencyKey(key: string): Article | null {
    const row = db.prepare('SELECT id FROM articles WHERE idempotency_key = ?').get(key) as { id: string } | undefined;
    return row ? getArticleById(row.id) : null;
  },

  create(input: CreateArticleInput): Article {
    const articleId = `art-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const initialStatus = input.saveAsDraft ? 'draft' : 'submitted';

    const computedIdemKey =
      input.idempotencyKey && input.idempotencyKey.trim()
        ? input.idempotencyKey.trim()
        : `idem-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

    // Gracefully handle duplicate/replay submissions without throwing UNIQUE constraint violation
    const existing = this.findByIdempotencyKey(computedIdemKey);
    if (existing) {
      return existing;
    }

    db.prepare(
      `INSERT INTO articles (
        id, reporter_id, idempotency_key, current_revision, original_headline, original_body_telugu,
        primary_headline_telugu, compact_headline_telugu, standfirst_telugu, summary_telugu,
        ai_body_paragraphs_full_json, ai_body_paragraphs_short_json,
        suggested_category, assigned_category, assigned_category_telugu,
        location, district, event_date, submission_time, status, priority_score, risk_level,
        validation_warnings_json, classification_model_id, story_model_id, prompt_version,
        primary_asset_id, created_at, updated_at
      ) VALUES (?, ?, ?, 1, ?, ?, NULL, NULL, NULL, NULL, '[]', '[]', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'low', '[]', NULL, NULL, 'v2.1', NULL, ?, ?)`
    ).run(
      articleId,
      input.reporterId,
      computedIdemKey,
      input.originalHeadline ? input.originalHeadline.trim() : null,
      input.originalBodyTelugu.trim(),
      input.suggestedCategory || input.assignedCategory || 'general',
      input.assignedCategory || 'general',
      input.assignedCategoryTelugu || 'సాధారణ వార్త',
      input.location.trim(),
      input.district ? input.district.trim() : 'Andhra Pradesh',
      input.eventDate || now.slice(0, 10),
      now,
      initialStatus,
      input.priorityScore ?? 65,
      now,
      now
    );

    // Save initial revision
    db.prepare(
      `INSERT INTO article_revisions (
        id, article_id, revision_number, source_type, headline_original,
        primary_headline_telugu, compact_headline_telugu, standfirst_telugu, summary_telugu,
        body_text_original, body_paragraphs_full_json, body_paragraphs_short_json,
        model_id, prompt_version, created_by_user_id, created_at
      ) VALUES (?, ?, 1, 'reporter_raw', ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 'v1', ?, ?)`
    ).run(
      `rev-${articleId}-1`,
      articleId,
      input.originalHeadline || 'ప్రారంభ సమర్పణ',
      input.originalHeadline || 'ప్రారంభ సమర్పణ',
      input.originalHeadline || 'ప్రారంభ సమర్పణ',
      input.originalHeadline || 'ప్రారంభ సమర్పణ',
      input.originalBodyTelugu.slice(0, 150),
      input.originalBodyTelugu.trim(),
      JSON.stringify([input.originalBodyTelugu.trim()]),
      JSON.stringify([input.originalBodyTelugu.trim()]),
      input.reporterId,
      now
    );

    // Insert assets if supplied
    if (input.assets && input.assets.length > 0) {
      let isFirst = true;
      for (const a of input.assets) {
        if (!a.assetUrl) continue;
        const assetId = `ast-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        db.prepare(
          `INSERT INTO image_assets (
            id, article_id, original_filename, mime_type, file_size_bytes, width, height,
            storage_key_original, storage_key_derivative, public_url, caption_telugu, is_primary, sha256_hash, created_at
          ) VALUES (?, ?, ?, 'image/jpeg', 50000, 900, 600, ?, ?, ?, ?, ?, 'seedhash', ?)`
        ).run(
          assetId,
          articleId,
          'photo.jpg',
          a.assetUrl,
          a.assetUrl,
          a.assetUrl,
          a.captionTelugu || 'వార్తా చిత్రం',
          isFirst ? 1 : 0,
          now
        );
        if (isFirst) {
          db.prepare('UPDATE articles SET primary_asset_id = ? WHERE id = ?').run(assetId, articleId);
          isFirst = false;
        }
      }
    }

    logAuditEvent(input.reporterId, 'article', articleId, 'article_created', {
      category: input.assignedCategory,
      status: initialStatus,
    });

    return getArticleById(articleId)!;
  },

  update(id: string, patch: Partial<Article>, editorId: string): Article | null {
    const existing = getArticleById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const newRev = existing.currentRevision + 1;

    db.prepare(
      `UPDATE articles
       SET primary_headline_telugu = COALESCE(?, primary_headline_telugu),
           compact_headline_telugu = COALESCE(?, compact_headline_telugu),
           standfirst_telugu = COALESCE(?, standfirst_telugu),
           summary_telugu = COALESCE(?, summary_telugu),
           ai_body_paragraphs_full_json = COALESCE(?, ai_body_paragraphs_full_json),
           ai_body_paragraphs_short_json = COALESCE(?, ai_body_paragraphs_short_json),
           assigned_category = COALESCE(?, assigned_category),
           assigned_category_telugu = COALESCE(?, assigned_category_telugu),
           priority_score = COALESCE(?, priority_score),
           risk_level = COALESCE(?, risk_level),
           status = COALESCE(?, status),
           current_revision = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      patch.primaryHeadlineTelugu ?? null,
      patch.compactHeadlineTelugu ?? null,
      patch.standfirstTelugu ?? null,
      patch.summaryTelugu ?? null,
      patch.aiBodyParagraphsFull ? JSON.stringify(patch.aiBodyParagraphsFull) : null,
      patch.aiBodyParagraphsShort ? JSON.stringify(patch.aiBodyParagraphsShort) : null,
      patch.assignedCategory ?? null,
      patch.assignedCategoryTelugu ?? null,
      patch.priorityScore ?? null,
      patch.riskLevel ?? null,
      patch.status ?? null,
      newRev,
      now,
      id
    );

    db.prepare(
      `INSERT INTO article_revisions (
        id, article_id, revision_number, source_type, headline_original,
        primary_headline_telugu, compact_headline_telugu, standfirst_telugu, summary_telugu,
        body_text_original, body_paragraphs_full_json, body_paragraphs_short_json,
        model_id, prompt_version, created_by_user_id, created_at
      ) VALUES (?, ?, ?, 'desk_edited', ?, ?, ?, ?, ?, ?, ?, ?, 'manual_edit', 'v1', ?, ?)`
    ).run(
      `rev-${id}-${newRev}`,
      id,
      newRev,
      existing.originalHeadline || '',
      patch.primaryHeadlineTelugu || existing.primaryHeadlineTelugu || existing.originalHeadline || '',
      patch.compactHeadlineTelugu || existing.compactHeadlineTelugu || '',
      patch.standfirstTelugu || existing.standfirstTelugu || '',
      patch.summaryTelugu || existing.summaryTelugu || '',
      existing.originalBodyTelugu || '',
      JSON.stringify(patch.aiBodyParagraphsFull || existing.aiBodyParagraphsFull || []),
      JSON.stringify(patch.aiBodyParagraphsShort || existing.aiBodyParagraphsShort || []),
      editorId,
      now
    );

    logAuditEvent(editorId, 'article', id, 'article_editorial_revision', {
      revisionNumber: newRev,
      status: patch.status || existing.status,
    });

    return getArticleById(id);
  },

  addAsset(articleId: string, asset: { assetUrl: string; captionTelugu?: string; photographerCredit?: string; resolutionDpi?: number; isPrimaryPhoto?: boolean; widthPx?: number; heightPx?: number }): ImageAsset {
    const assetId = `ast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO image_assets (
        id, article_id, original_filename, mime_type, file_size_bytes, width, height,
        storage_key_original, storage_key_derivative, public_url, caption_telugu, is_primary, sha256_hash, created_at
      ) VALUES (?, ?, 'uploaded-photo.jpg', 'image/jpeg', 65000, ?, ?, ?, ?, ?, ?, ?, 'uploaded-hash', ?)`
    ).run(
      assetId,
      articleId,
      asset.widthPx || 1200,
      asset.heightPx || 800,
      asset.assetUrl,
      asset.assetUrl,
      asset.assetUrl,
      asset.captionTelugu || 'క్షేత్రస్థాయి వార్తా చిత్రం',
      asset.isPrimaryPhoto ? 1 : 0,
      now
    );

    if (asset.isPrimaryPhoto) {
      db.prepare('UPDATE articles SET primary_asset_id = ? WHERE id = ?').run(assetId, articleId);
    }

    return {
      id: assetId,
      articleId,
      originalFilename: 'uploaded-photo.jpg',
      mimeType: 'image/jpeg',
      fileSizeBytes: 65000,
      width: asset.widthPx || 1200,
      height: asset.heightPx || 800,
      storageKeyOriginal: asset.assetUrl,
      storageKeyDerivative: asset.assetUrl,
      publicUrl: asset.assetUrl,
      captionTelugu: asset.captionTelugu || 'క్షేత్రస్థాయి వార్తా చిత్రం',
      isPrimary: Boolean(asset.isPrimaryPhoto),
      sha256Hash: 'uploaded-hash',
      createdAt: now,
    };
  },

  delete(id: string, actorId: string): boolean {
    const existing = getArticleById(id);
    if (!existing) return false;

    db.prepare('DELETE FROM edition_article_assignments WHERE article_id = ?').run(id);
    db.prepare('DELETE FROM article_classifications WHERE article_id = ?').run(id);
    db.prepare('DELETE FROM image_assets WHERE article_id = ?').run(id);
    db.prepare('DELETE FROM article_revisions WHERE article_id = ?').run(id);
    db.prepare('DELETE FROM ai_result_cache WHERE article_id = ?').run(id);
    db.prepare('DELETE FROM ai_processing_jobs WHERE target_id = ?').run(id);
    db.prepare('DELETE FROM articles WHERE id = ?').run(id);

    logAuditEvent(actorId, 'article', id, 'article_deleted', {
      headline: existing.primaryHeadlineTelugu || existing.originalHeadline,
    });

    return true;
  },
};

