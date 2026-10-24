import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { User, Article } from '../shared/types.ts';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

/**
 * Syncs a user record directly to Supabase public.users table and Supabase Auth.
 */
export async function syncUserToSupabase(user: User): Promise<boolean> {
  if (!supabase) return false;
  try {
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email || `${user.username}@prajavani.in`,
      password_hash: '',
      display_name: user.displayName,
      display_name_telugu: user.displayNameTelugu || user.displayName,
      role: user.role,
      district: user.district || 'ఎన్టీఆర్ జిల్లా',
      bureau: user.bureau || 'విజయవాడ ప్రధాన కార్యాలయం',
      avatar_url: user.avatarUrl || null,
      google_id: user.googleId || null,
      active: user.active !== false,
      updated_at: new Date().toISOString(),
    };

    const { error: dbError } = await supabase
      .from('users')
      .upsert(payload, { onConflict: 'id' });

    if (dbError) {
      console.warn('Supabase public.users sync warning:', dbError.message);
    } else {
      console.log(`[Supabase] Synced user ${user.id} (${payload.email}) to public.users`);
    }

    // Attempt to register in Supabase Auth (auth.users) so it appears in the Authentication dashboard
    if (user.email) {
      try {
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
          email: user.email,
          email_confirm: true,
          user_metadata: {
            name: user.displayName,
            full_name: user.displayName,
            displayNameTelugu: user.displayNameTelugu,
            role: user.role,
            sub: user.googleId || user.id,
          },
        });
        if (authErr) {
          // If already registered, that's expected; otherwise log clear diagnosis
          if (!authErr.message.includes('already registered')) {
            console.warn(`[Supabase Auth] Note creating auth user for ${user.email}:`, authErr.message);
          }
        } else if (authData?.user) {
          console.log(`[Supabase Auth] Registered ${user.email} in auth.users (${authData.user.id})`);
        }
      } catch (authErr: any) {
        console.warn(`[Supabase Auth] Catch block creating ${user.email}:`, authErr.message || authErr);
      }
    }

    return !dbError;
  } catch (err) {
    console.warn('Supabase user sync error:', err);
    return false;
  }
}

/**
 * Updates user active state or removes user from Supabase.
 */
export async function removeUserFromSupabase(userId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('users')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.warn('Supabase removeUser warning:', error.message);
      return false;
    }
    console.log(`[Supabase] Deactivated user ${userId} in public.users`);
    return true;
  } catch (err) {
    console.warn('Supabase removeUser error:', err);
    return false;
  }
}

/**
 * Syncs an article directly to Supabase public.articles table.
 */
export async function syncArticleToSupabase(article: Article): Promise<boolean> {
  if (!supabase) return false;
  try {
    const payload = {
      id: article.id,
      reporter_id: article.reporterId,
      idempotency_key: article.idempotencyKey,
      current_revision: article.currentRevision || 1,
      original_headline: article.originalHeadline || null,
      original_body_telugu: article.originalBodyTelugu,
      primary_headline_telugu: article.primaryHeadlineTelugu || null,
      compact_headline_telugu: article.compactHeadlineTelugu || null,
      standfirst_telugu: article.standfirstTelugu || null,
      summary_telugu: article.summaryTelugu || null,
      ai_body_paragraphs_full_json: article.aiBodyParagraphsFull || [],
      ai_body_paragraphs_short_json: article.aiBodyParagraphsShort || [],
      suggested_category: article.suggestedCategory || 'Local news',
      assigned_category: article.assignedCategory || 'Local news',
      assigned_category_telugu: article.assignedCategoryTelugu || 'స్థానిక వార్తలు',
      location: article.location,
      district: article.district,
      event_date: article.eventDate,
      submission_time: article.submissionTime,
      status: article.status,
      priority_score: article.priorityScore ?? 50,
      risk_level: article.riskLevel || 'low',
      validation_warnings_json: article.validationWarnings || [],
      classification_model_id: article.classificationModelId || null,
      story_model_id: article.storyModelId || null,
      prompt_version: article.promptVersion || 'v1',
      primary_asset_id: article.primaryAssetId || null,
      created_at: article.createdAt,
      updated_at: article.updatedAt,
    };

    const { error } = await supabase
      .from('articles')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase articles sync warning:', error.message);
      return false;
    }
    console.log(`[Supabase] Synced article ${article.id} to public.articles`);
    return true;
  } catch (err) {
    console.warn('Supabase article sync error:', err);
    return false;
  }
}

/**
 * Deletes an article from Supabase public.articles table.
 */
export async function deleteArticleFromSupabase(articleId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('articles')
      .delete()
      .eq('id', articleId);

    if (error) {
      console.warn('Supabase deleteArticle warning:', error.message);
      return false;
    }
    console.log(`[Supabase] Deleted article ${articleId} from public.articles`);
    return true;
  } catch (err) {
    console.warn('Supabase deleteArticle error:', err);
    return false;
  }
}
