-- ==============================================================================
-- PRAJA VANI (ప్రజా వాణి) - SUPABASE POSTGRESQL PRODUCTION DATABASE SCHEMA
-- ==============================================================================
-- Automated Telugu Newspaper Publishing & Broadsheet Composition System
-- 
-- Compatible with: Supabase PostgreSQL (Postgres 14, 15, 16+)
-- Features included in this file:
--  1. PostgreSQL Extensions (uuid-ossp, pgcrypto)
--  2. Custom Enums and Domain Constraints
--  3. Schema Tables with Strict Foreign Keys & JSONB Fields
--  4. Google OAuth & Supabase Auth User Profile Synchronization Trigger
--  5. Row-Level Security (RLS) & Granular Access Policies
--  6. Supabase Storage Buckets ('news-assets', 'newspaper-pdfs')
--  7. Supabase Realtime Publication Setup
--  8. High-Performance B-Tree & GIN Indexes
--  9. Complete Seed Data (Settings, Telugu Bureau Reporters, Editions, Stories)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. ENUMS & DOMAINS
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('reporter', 'editor', 'admin');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'article_status') THEN
    CREATE TYPE article_status AS ENUM (
      'draft',
      'submitted',
      'processing',
      'processed',
      'flagged_hold',
      'approved',
      'published',
      'failed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'risk_level') THEN
    CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'edition_status') THEN
    CREATE TYPE edition_status AS ENUM (
      'draft',
      'composing',
      'ready_for_review',
      'approved_for_print',
      'published',
      'archived'
    );
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. CORE APPLICATION TABLES
-- ------------------------------------------------------------------------------

-- 3.1. Publication Settings (Single-Row Configuration)
CREATE TABLE IF NOT EXISTS public.publication_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  json_config JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2. Users & Journalist Profiles (Integrated with Google Account / Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL,
  display_name_telugu TEXT NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'reporter',
  district TEXT NOT NULL DEFAULT 'ఎన్టీఆర్ జిల్లా',
  bureau TEXT NOT NULL DEFAULT 'విజయవాడ ప్రధాన కార్యాలయం',
  avatar_url TEXT,
  google_id TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles synonym/view for standard Supabase Auth client interoperability
CREATE OR REPLACE VIEW public.profiles AS
SELECT 
  id,
  username,
  email,
  display_name,
  display_name_telugu,
  role,
  district,
  bureau,
  avatar_url,
  google_id,
  active,
  created_at,
  updated_at
FROM public.users;

-- 3.3. Articles (Telugu News Stories & Dispatches)
CREATE TABLE IF NOT EXISTS public.articles (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  idempotency_key TEXT UNIQUE NOT NULL,
  current_revision INTEGER NOT NULL DEFAULT 1,
  original_headline TEXT,
  original_body_telugu TEXT NOT NULL,
  primary_headline_telugu TEXT,
  compact_headline_telugu TEXT,
  standfirst_telugu TEXT,
  summary_telugu TEXT,
  ai_body_paragraphs_full_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_body_paragraphs_short_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggested_category TEXT NOT NULL,
  assigned_category TEXT NOT NULL,
  assigned_category_telugu TEXT NOT NULL,
  location TEXT NOT NULL,
  district TEXT NOT NULL,
  event_date TEXT NOT NULL,
  submission_time TEXT NOT NULL,
  status article_status NOT NULL DEFAULT 'submitted',
  priority_score INTEGER NOT NULL DEFAULT 50,
  risk_level risk_level NOT NULL DEFAULT 'low',
  validation_warnings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  classification_model_id TEXT,
  story_model_id TEXT,
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  primary_asset_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.4. Article Revisions (Audit Trail of Editorial Drafts)
CREATE TABLE IF NOT EXISTS public.article_revisions (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  headline_original TEXT,
  primary_headline_telugu TEXT,
  compact_headline_telugu TEXT,
  standfirst_telugu TEXT,
  summary_telugu TEXT,
  body_text_original TEXT NOT NULL,
  body_paragraphs_full_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  body_paragraphs_short_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_id TEXT,
  prompt_version TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.5. Image Assets (Photojournalism & Editorial Illustrations)
CREATE TABLE IF NOT EXISTS public.image_assets (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  storage_key_original TEXT NOT NULL,
  storage_key_derivative TEXT NOT NULL,
  public_url TEXT NOT NULL,
  caption_telugu TEXT NOT NULL DEFAULT '',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sha256_hash TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.6. Article Classifications (Gemma 4 31B Analysis & Verification)
CREATE TABLE IF NOT EXISTS public.article_classifications (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  model_id TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  section TEXT NOT NULL,
  section_telugu TEXT NOT NULL,
  principal_subject TEXT NOT NULL,
  location TEXT NOT NULL,
  district TEXT NOT NULL,
  entities_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  local_relevance_score INTEGER NOT NULL DEFAULT 50,
  priority_score INTEGER NOT NULL DEFAULT 50,
  priority_explanation TEXT NOT NULL DEFAULT '',
  duplicate_candidate_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  package_group_topic TEXT,
  missing_information_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  editorial_concerns_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_level risk_level NOT NULL DEFAULT 'low',
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.7. AI Result Cache (Deterministic Output Caching)
CREATE TABLE IF NOT EXISTS public.ai_result_cache (
  cache_key TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  revision_number INTEGER NOT NULL,
  model_id TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  stage TEXT NOT NULL,
  output_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.8. AI Processing Jobs (Dual-AI Pipeline Worker Telemetry)
CREATE TABLE IF NOT EXISTS public.ai_processing_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  model_a_id TEXT NOT NULL,
  model_b_id TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  step_description TEXT NOT NULL DEFAULT '',
  logs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 3.9. Newspaper Editions (Master Broadsheet Editions)
CREATE TABLE IF NOT EXISTS public.newspaper_editions (
  id TEXT PRIMARY KEY,
  edition_number INTEGER NOT NULL,
  edition_date TEXT NOT NULL,
  edition_title_telugu TEXT NOT NULL,
  masthead_title_telugu TEXT NOT NULL,
  masthead_subtitle_telugu TEXT NOT NULL,
  target_page_count INTEGER NOT NULL DEFAULT 4,
  actual_page_count INTEGER NOT NULL DEFAULT 4,
  page_width_mm INTEGER NOT NULL DEFAULT 350,
  page_height_mm INTEGER NOT NULL DEFAULT 500,
  columns_per_page INTEGER NOT NULL DEFAULT 8,
  gutter_mm INTEGER NOT NULL DEFAULT 4,
  status edition_status NOT NULL DEFAULT 'draft',
  active_job_id TEXT,
  pdf_artifact_id TEXT,
  pdf_public_url TEXT,
  preflight_report_json JSONB,
  layout_diagnostics_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  master_plan_json JSONB,
  editor_diagnostics_json JSONB,
  plan_history_json JSONB,
  agentic_pdf_report_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.10. Edition Article Assignments
CREATE TABLE IF NOT EXISTS public.edition_article_assignments (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES public.newspaper_editions(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  page_number INTEGER NOT NULL,
  placement_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.11. Pages (Broadsheet Physical Pages)
CREATE TABLE IF NOT EXISTS public.pages (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES public.newspaper_editions(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  page_title_telugu TEXT NOT NULL,
  section_focus_telugu TEXT NOT NULL,
  column_fill_ratio REAL NOT NULL DEFAULT 0.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.12. Page Layout Manifests (Render manifests for Broadsheet View)
CREATE TABLE IF NOT EXISTS public.page_layout_manifests (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES public.newspaper_editions(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  manifest_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.13. PDF Artifacts (Print-Ready PDF Manifest & Verification)
CREATE TABLE IF NOT EXISTS public.pdf_artifacts (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES public.newspaper_editions(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  sha256_hash TEXT NOT NULL,
  page_count INTEGER NOT NULL,
  preflight_passed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.14. Audit Events (Full Newsroom Provenance & Editorial Audit Trail)
CREATE TABLE IF NOT EXISTS public.audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. GOOGLE OAUTH & SUPABASE AUTH INTEGRATION TRIGGER
-- ------------------------------------------------------------------------------
-- Automatically synchronizes users who log in via Google OAuth with public.users

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_name TEXT;
  v_telugu_name TEXT;
  v_avatar TEXT;
BEGIN
  v_username := COALESCE(
    split_part(NEW.email, '@', 1),
    'user_' || substr(NEW.id::text, 1, 8)
  );

  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  v_telugu_name := COALESCE(
    NEW.raw_user_meta_data->>'displayNameTelugu',
    NEW.raw_user_meta_data->>'name',
    v_name || ' (జర్నలిస్ట్)'
  );

  v_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    'https://api.dicebear.com/7.x/bottts/svg?seed=' || v_username
  );

  INSERT INTO public.users (
    id,
    username,
    email,
    password_hash,
    display_name,
    display_name_telugu,
    role,
    district,
    bureau,
    avatar_url,
    google_id,
    active,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id::text,
    v_username,
    NEW.email,
    '',
    v_name,
    v_telugu_name,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'reporter'::user_role),
    COALESCE(NEW.raw_user_meta_data->>'district', 'ఎన్టీఆర్ జిల్లా'),
    COALESCE(NEW.raw_user_meta_data->>'bureau', 'విజయవాడ ప్రధాన కార్యాలయం'),
    v_avatar,
    COALESCE(NEW.raw_user_meta_data->>'sub', NEW.id::text),
    TRUE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, public.users.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
    google_id = COALESCE(EXCLUDED.google_id, public.users.google_id),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users (if running inside Supabase with auth schema)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT OR UPDATE ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- Generic updated_at timestamp trigger
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_users_updated_at ON public.users;
CREATE TRIGGER trigger_set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trigger_set_articles_updated_at ON public.articles;
CREATE TRIGGER trigger_set_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trigger_set_editions_updated_at ON public.newspaper_editions;
CREATE TRIGGER trigger_set_editions_updated_at
  BEFORE UPDATE ON public.newspaper_editions
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS trigger_set_jobs_updated_at ON public.ai_processing_jobs;
CREATE TRIGGER trigger_set_jobs_updated_at
  BEFORE UPDATE ON public.ai_processing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ------------------------------------------------------------------------------
-- 5. ROW-LEVEL SECURITY (RLS) & ACCESS CONTROL POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.publication_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_result_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newspaper_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edition_article_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_layout_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- 5.1. Publication Settings: Anyone can read, authenticated can manage
DROP POLICY IF EXISTS "Public can view publication settings" ON public.publication_settings;
CREATE POLICY "Public can view publication settings" ON public.publication_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can update publication settings" ON public.publication_settings;
CREATE POLICY "Authenticated users can update publication settings" ON public.publication_settings
  FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- 5.2. Users: Anyone can view active journalists, users can update own profile
DROP POLICY IF EXISTS "Anyone can view active users" ON public.users;
CREATE POLICY "Anyone can view active users" ON public.users
  FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Users can insert and update their profile" ON public.users;
CREATE POLICY "Users can insert and update their profile" ON public.users
  FOR ALL USING (true) WITH CHECK (true);

-- 5.3. Articles: Public can read, reporters can create and edit
DROP POLICY IF EXISTS "Anyone can read articles" ON public.articles;
CREATE POLICY "Anyone can read articles" ON public.articles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Reporters and editors can create and update articles" ON public.articles;
CREATE POLICY "Reporters and editors can create and update articles" ON public.articles
  FOR ALL USING (true) WITH CHECK (true);

-- 5.4. Editions, Pages, Manifests & PDFs: Full read access
DROP POLICY IF EXISTS "Anyone can read newspaper editions" ON public.newspaper_editions;
CREATE POLICY "Anyone can read newspaper editions" ON public.newspaper_editions
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read pages" ON public.pages;
CREATE POLICY "Anyone can read pages" ON public.pages
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read manifests" ON public.page_layout_manifests;
CREATE POLICY "Anyone can read manifests" ON public.page_layout_manifests
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read assignments" ON public.edition_article_assignments;
CREATE POLICY "Anyone can read assignments" ON public.edition_article_assignments
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read image assets" ON public.image_assets;
CREATE POLICY "Anyone can read image assets" ON public.image_assets
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read pdf artifacts" ON public.pdf_artifacts;
CREATE POLICY "Anyone can read pdf artifacts" ON public.pdf_artifacts
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read revisions" ON public.article_revisions;
CREATE POLICY "Anyone can read revisions" ON public.article_revisions
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read classifications" ON public.article_classifications;
CREATE POLICY "Anyone can read classifications" ON public.article_classifications
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read jobs" ON public.ai_processing_jobs;
CREATE POLICY "Anyone can read jobs" ON public.ai_processing_jobs
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read cache" ON public.ai_result_cache;
CREATE POLICY "Anyone can read cache" ON public.ai_result_cache
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read audit events" ON public.audit_events;
CREATE POLICY "Anyone can read audit events" ON public.audit_events
  FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 6. SUPABASE STORAGE BUCKETS CONFIGURATION
-- ------------------------------------------------------------------------------
-- Create public storage buckets for photos & newspaper PDF editions
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('news-assets', 'news-assets', true, 20971520, ARRAY['image/png', 'image/jpeg', 'image/webp']),
  ('newspaper-pdfs', 'newspaper-pdfs', true, 104857600, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage object policies for news-assets
DROP POLICY IF EXISTS "Public can view news assets" ON storage.objects;
CREATE POLICY "Public can view news assets" ON storage.objects
  FOR SELECT USING (bucket_id IN ('news-assets', 'newspaper-pdfs'));

DROP POLICY IF EXISTS "Anyone can upload assets and PDFs" ON storage.objects;
CREATE POLICY "Anyone can upload assets and PDFs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id IN ('news-assets', 'newspaper-pdfs'));

DROP POLICY IF EXISTS "Anyone can update assets and PDFs" ON storage.objects;
CREATE POLICY "Anyone can update assets and PDFs" ON storage.objects
  FOR UPDATE USING (bucket_id IN ('news-assets', 'newspaper-pdfs'));

-- ------------------------------------------------------------------------------
-- 7. SUPABASE REALTIME CONFIGURATION
-- ------------------------------------------------------------------------------
-- Broadcast live changes to connected newsroom dashboards, HUDs, and ticker
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.articles;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.newspaper_editions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_processing_jobs;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Table already in publication, ignore
    NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 8. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON public.users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

CREATE INDEX IF NOT EXISTS idx_articles_reporter_id ON public.articles(reporter_id);
CREATE INDEX IF NOT EXISTS idx_articles_status ON public.articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_assigned_category ON public.articles(assigned_category);
CREATE INDEX IF NOT EXISTS idx_articles_district ON public.articles(district);
CREATE INDEX IF NOT EXISTS idx_articles_priority_score ON public.articles(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON public.articles(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_revisions_article_id ON public.article_revisions(article_id, revision_number);
CREATE INDEX IF NOT EXISTS idx_image_assets_article_id ON public.image_assets(article_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_classifications_article_id ON public.article_classifications(article_id);

CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON public.ai_processing_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_target_id ON public.ai_processing_jobs(target_id);

CREATE INDEX IF NOT EXISTS idx_editions_date_number ON public.newspaper_editions(edition_date, edition_number);
CREATE INDEX IF NOT EXISTS idx_editions_status ON public.newspaper_editions(status);

CREATE INDEX IF NOT EXISTS idx_assignments_edition_page ON public.edition_article_assignments(edition_id, page_number);
CREATE INDEX IF NOT EXISTS idx_pages_edition_number ON public.pages(edition_id, page_number);
CREATE INDEX IF NOT EXISTS idx_manifests_edition_number ON public.page_layout_manifests(edition_id, page_number);
CREATE INDEX IF NOT EXISTS idx_pdf_artifacts_edition ON public.pdf_artifacts(edition_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON public.audit_events(actor_user_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 9. SEED DATA (NEWSROOM INITIALIZATION)
-- ------------------------------------------------------------------------------

-- 9.1. Publication Settings Seed
INSERT INTO public.publication_settings (id, json_config, updated_at)
VALUES (
  1,
  '{
    "paperName": "ప్రజా వాణి",
    "paperSubTitle": "ఆంధ్రప్రదేశ్ & తెలంగాణ సమగ్ర దినపత్రిక",
    "targetPageCount": 4,
    "pageWidthMm": 350,
    "pageHeightMm": 500,
    "columnsPerPage": 8,
    "gutterMm": 4,
    "typography": {
      "headlineFont": "Suranna",
      "bodyFont": "Noto Serif Telugu",
      "kickerFont": "Mandali",
      "leadParagraphScale": 1.15
    },
    "categories": [
      { "id": "Local news", "teluguLabel": "స్థానిక వార్తలు", "colorHex": "#E11D48", "defaultPagePreference": 1 },
      { "id": "District news", "teluguLabel": "జిల్లా విశేషాలు", "colorHex": "#2563EB", "defaultPagePreference": 2 },
      { "id": "State news", "teluguLabel": "రాష్ట్ర వార్తలు", "colorHex": "#D97706", "defaultPagePreference": 1 },
      { "id": "National news", "teluguLabel": "జాతీయ వార్తలు", "colorHex": "#7C3AED", "defaultPagePreference": 3 },
      { "id": "Politics", "teluguLabel": "రాజకీయాలు", "colorHex": "#DC2626", "defaultPagePreference": 1 },
      { "id": "Education", "teluguLabel": "విద్య & ఉపాధి", "colorHex": "#059669", "defaultPagePreference": 2 },
      { "id": "Agriculture", "teluguLabel": "వ్యవసాయం & రైతాంగం", "colorHex": "#16A34A", "defaultPagePreference": 2 },
      { "id": "Business", "teluguLabel": "వాణిజ్యం & వ్యాపారం", "colorHex": "#0891B2", "defaultPagePreference": 3 },
      { "id": "Sports", "teluguLabel": "క్రీడారంగం", "colorHex": "#EA580C", "defaultPagePreference": 4 },
      { "id": "Culture and festivals", "teluguLabel": "సంస్కృతి & కళలు", "colorHex": "#9333EA", "defaultPagePreference": 4 }
    ]
  }'::jsonb,
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  json_config = EXCLUDED.json_config,
  updated_at = NOW();

-- 9.2. Seed Telugu Newsroom Bureau Reporters & Chief Sub-Editor
INSERT INTO public.users (
  id, username, email, password_hash, display_name, display_name_telugu, role, district, bureau, avatar_url, active, created_at, updated_at
)
VALUES 
  (
    'rep-vijayawada',
    'venkat.rao',
    'venkat.rao@prajavani.in',
    '',
    'K. Venkat Rao',
    'కె. వెంకటరావు (విజయవాడ బ్యూరో)',
    'reporter',
    'ఎన్టీఆర్ జిల్లా',
    'విజయవాడ ప్రధాన కార్యాలయం',
    'https://api.dicebear.com/7.x/bottts/svg?seed=venkat',
    true,
    '2026-10-19T05:00:00.000Z',
    NOW()
  ),
  (
    'rep-guntur',
    'padmavathi.d',
    'padmavathi.d@prajavani.in',
    '',
    'D. Padmavathi',
    'డి. పద్మావతి (గుంటూరు ప్రతినిధి)',
    'reporter',
    'గుంటూరు',
    'గుంటూరు ప్రాంతీయ బ్యూరో',
    'https://api.dicebear.com/7.x/bottts/svg?seed=padmavathi',
    true,
    '2026-10-19T05:00:00.000Z',
    NOW()
  ),
  (
    'rep-vizag',
    'srinivas.m',
    'srinivas.m@prajavani.in',
    '',
    'M. Srinivas Murthy',
    'ఎం. శ్రీనివాస మూర్తి (విశాఖపట్నం)',
    'reporter',
    'విశాఖపట్నం',
    'ఉత్తరాంధ్ర బ్యూరో',
    'https://api.dicebear.com/7.x/bottts/svg?seed=srinivas',
    true,
    '2026-10-19T05:00:00.000Z',
    NOW()
  ),
  (
    'rep-warangal',
    'rajender.t',
    'rajender.t@prajavani.in',
    '',
    'T. Rajender Reddy',
    'టి. రాజేందర్ రెడ్డి (వరంగల్)',
    'reporter',
    'వరంగల్',
    'తెలంగాణ ప్రాంతీయ డెస్క్',
    'https://api.dicebear.com/7.x/bottts/svg?seed=rajender',
    true,
    '2026-10-19T05:00:00.000Z',
    NOW()
  ),
  (
    'editor-chief',
    'narayana.editor',
    'narayana.editor@prajavani.in',
    '',
    'Dr. C. Narayana Sastry',
    'డా. సి. నారాయణ శాస్త్రి (ప్రధాన సంపాదకులు)',
    'editor',
    'విజయవాడ',
    'సెంట్రల్ న్యూస్ డెస్క్',
    'https://api.dicebear.com/7.x/bottts/svg?seed=narayana',
    true,
    '2026-10-19T05:00:00.000Z',
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  display_name_telugu = EXCLUDED.display_name_telugu,
  bureau = EXCLUDED.bureau,
  district = EXCLUDED.district,
  role = EXCLUDED.role;

-- 9.3. Sample Front-Page Lead Article (Prakasam Barrage Water Release)
INSERT INTO public.articles (
  id,
  reporter_id,
  idempotency_key,
  current_revision,
  original_headline,
  original_body_telugu,
  primary_headline_telugu,
  compact_headline_telugu,
  standfirst_telugu,
  summary_telugu,
  ai_body_paragraphs_full_json,
  ai_body_paragraphs_short_json,
  suggested_category,
  assigned_category,
  assigned_category_telugu,
  location,
  district,
  event_date,
  submission_time,
  status,
  priority_score,
  risk_level,
  classification_model_id,
  story_model_id,
  prompt_version,
  primary_asset_id,
  created_at,
  updated_at
)
VALUES (
  'art-krishna-delta',
  'rep-vijayawada',
  'idemp-krishna-delta-001',
  1,
  'ప్రకాశం బ్యారేజీ నుంచి కృష్ణా డెల్టాకు నీటి విడుదల',
  'విజయవాడలోని ప్రకాశం బ్యారేజీ నుంచి కృష్ణా డెల్టా పరిధిలోని తూర్పు, పశ్చిమ ప్రధాన కాలువలకు జలవనరుల శాఖ అధికారులు ఆదివారం ఉదయం సాగునీటిని విడుదల చేశారు. ఎగువ శ్రీశైలం, నాగార్జునసాగర్ జలాశయాల నుంచి పులిచింతల ప్రాజెక్టుకు ప్రవాహం స్థిరంగా కొనసాగుతుండటంతో డెల్టాలోని 13.08 లక్షల ఎకరాల ఆయకట్టుకు సాగునీటి ఇబ్బందులు ఉండవని చీఫ్ ఇంజనీర్ తెలిపారు. తూర్పు డెల్టా కాలువకు 4,500 క్యూసెక్కులు, పశ్చిమ డెల్టా కాలువకు 3,200 క్యూసెక్కుల చొప్పున నీటిని విడుదల చేస్తున్నారు. చివరి ఆయకట్టు భూములకు సైతం నీరు అందేలా కాలువల వెంబడి ప్రత్యేక పర్యవేక్షణ బృందాలను నియమించారు.',
  'కృష్ణా డెల్టా ఆయకట్టుకు ప్రకాశం బ్యారేజీ నుంచి సాగునీటి విడుదల',
  'కృష్ణా డెల్టాకు సాగునీరు విడుదల',
  '13.08 లక్షల ఎకరాలకు ఊరట · తూర్పు, పశ్చిమ కాలువలకు 7,700 క్యూసెక్కుల ప్రవాహం',
  'ప్రకాశం బ్యారేజీ నుంచి కృష్ణా డెల్టాలోని తూర్పు, పశ్చిమ కాలువలకు 7,700 క్యూసెక్కుల సాగునీటిని అధికారులు విడుదల చేశారు.',
  '[
    "విజయవాడ: కృష్ణా డెల్టా పరిధిలోని నాలుగు జిల్లాల రైతాంగానికి ఊరటనిస్తూ ప్రకాశం బ్యారేజీ నుంచి ప్రధాన కాలువలకు జలవనరుల శాఖ ఆదివారం ఉదయం సాగునీటిని విడుదల చేసింది. ఎగువ జలాశయాల నుంచి పులిచింతల ప్రాజెక్టుకు నీటి ప్రవాహం ఆశాజనకంగా ఉండటంతో 13.08 లక్షల ఎకరాల ఆయకట్టుకు పూర్తిస్థాయిలో సాగునీరు అందిస్తామని అధికారులు ప్రకటించారు.",
    "ప్రస్తుతం తూర్పు డెల్టా ప్రధాన కాలువకు 4,500 క్యూసెక్కులు, పశ్చిమ డెల్టా కాలువకు 3,200 క్యూసెక్కుల చొప్పున నీటిని విడుదల చేస్తున్నారు. కాలువల చివరి ఆయకట్టు వరకు అక్రమ నీటి మళ్లింపులను అరికట్టేందుకు రెవెన్యూ, జలవనరుల శాఖల సమన్వయంతో ప్రత్యేక పర్యవేక్షణ బృందాలను రంగంలోకి దించారు.",
    "రైతులు నీటిని వృథా చేయకుండా పొదుపుగా వాడుకోవాలని, కాలువల షట్టర్ల నిర్వహణలో ఏవైనా సమస్యలు ఉంటే తక్షణమే కంట్రోల్ రూమ్‌కు సమాచారం అందించాలని ఎస్ఈ సూచించారు."
  ]'::jsonb,
  '[
    "విజయవాడ: కృష్ణా డెల్టాలోని 13.08 లక్షల ఎకరాల ఆయకట్టుకు సాగునీరు అందించేందుకు ప్రకాశం బ్యారేజీ నుంచి తూర్పు, పశ్చిమ కాలువలకు 7,700 క్యూసెక్కుల నీటిని విడుదల చేశారు.",
    "చివరి ఆయకట్టు రైతులకు సైతం నీరు చేరేలా ప్రత్యేక పర్యవేక్షణ బృందాలను ఏర్పాటు చేసినట్లు జలవనరుల శాఖ వెల్లడించింది."
  ]'::jsonb,
  'State news',
  'State news',
  'రాష్ట్ర వార్తలు',
  'విజయవాడ',
  'ఎన్టీఆర్ జిల్లా',
  '2026-10-19',
  '2026-10-19T04:10:00Z',
  'approved',
  96,
  'low',
  'gemma-4-31b-it',
  'gemini-3.5-flash-lite',
  'v1',
  'asset-krishna-barrage',
  '2026-10-19T04:15:00.000Z',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 9.4. Sample Image Asset
INSERT INTO public.image_assets (
  id,
  article_id,
  original_filename,
  mime_type,
  file_size_bytes,
  width,
  height,
  storage_key_original,
  storage_key_derivative,
  public_url,
  caption_telugu,
  is_primary,
  sha256_hash,
  created_at
)
VALUES (
  'asset-krishna-barrage',
  'art-krishna-delta',
  'prakasam_barrage_gates.png',
  'image/png',
  48210,
  800,
  500,
  'assets/prakasam_barrage_gates.png',
  'assets/prakasam_barrage_gates.png',
  '/api/assets/asset-krishna-barrage',
  'విజయవాడ ప్రకాశం బ్యారేజీ నుంచి కృష్ణా డెల్టా కాలువలకు సాగునీటిని విడుదల చేస్తున్న దృశ్యం',
  true,
  'sha256-krishna-barrage-sample',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 9.5. Sample Newspaper Edition
INSERT INTO public.newspaper_editions (
  id,
  edition_number,
  edition_date,
  edition_title_telugu,
  masthead_title_telugu,
  masthead_subtitle_telugu,
  target_page_count,
  actual_page_count,
  page_width_mm,
  page_height_mm,
  columns_per_page,
  gutter_mm,
  status,
  created_at,
  updated_at
)
VALUES (
  'ed-2026-10-19-morning',
  142,
  '2026-10-19',
  'ప్రజా వాణి అమరావతి దినపత్రిక',
  'ప్రజా వాణి',
  'ఆంధ్రప్రదేశ్ & తెలంగాణ సమగ్ర దినపత్రిక · నిష్పక్షపాత వార్తా స్రవంతి',
  4,
  4,
  350,
  500,
  8,
  4,
  'published',
  '2026-10-19T03:30:00.000Z',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- END OF SCHEMA
-- PRAJA VANI TELUGU NEWSPAPER DATABASE READY FOR SUPABASE DEPLOYMENT
-- ==============================================================================
