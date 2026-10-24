# Supabase Database & Google Account Authentication Guide

This guide details how to deploy the database schema to [Supabase](https://supabase.com) and configure Google Account OAuth login for user profiles in the **Praja Vani (ప్రజా వాణి)** Telugu newspaper publishing system.

---

## 1. Quick Setup: Run the SQL Schema in Supabase

1. Open your project in the [Supabase Dashboard](https://app.supabase.com).
2. In the left navigation, click on the **SQL Editor** tab (`/project/_/sql`).
3. Click **New Query**.
4. Open [supabase_schema.sql](file:///c:/Users/reddy5/Documents/newsvideo/supabase_schema.sql), copy its entire contents, and paste into the Supabase SQL editor.
5. Click **Run** (or press `Ctrl + Enter`).

### What `supabase_schema.sql` creates:
- **14 Production Tables**:
  - `publication_settings` (Newsroom typography, column grids, Telugu news categories)
  - `users` (with standard `profiles` view & Google OAuth integration)
  - `articles` (Telugu stories with classifications, scores, and status)
  - `article_revisions` (Historical audit log of drafts and rewrites)
  - `image_assets` (Photojournalism assets, Telugu captions, and dimensions)
  - `article_classifications` (Gemma 4 31B AI classification outputs)
  - `ai_result_cache` (Deterministic AI generation cache)
  - `ai_processing_jobs` (Background AI pipeline worker logs and progress)
  - `newspaper_editions` (Master broadsheet editions, masthead, and layout plans)
  - `edition_article_assignments` (Page and column placements)
  - `pages` (Page geometry, fill ratios, and section focus)
  - `page_layout_manifests` (Pre-rendered manifests for print broadsheet engine)
  - `pdf_artifacts` (Print-ready PDF manifests with preflight pass state)
  - `audit_events` (Editorial actions and provenance trail)
- **Automated Google Auth Profile Synchronization Trigger**:
  - `handle_new_user()` trigger on `auth.users` automatically provisions new Google OAuth logins into `public.users` with default Telugu name and bureau.
- **Row-Level Security (RLS)**:
  - Enabled on all tables with granular read/write policies for public readers, reporters, and editors.
- **Supabase Storage Buckets**:
  - `news-assets` (public photo bucket, 20MB limit)
  - `newspaper-pdfs` (public PDF edition bucket, 100MB limit)
- **Supabase Realtime**:
  - Broadcasts live changes on `articles`, `newspaper_editions`, and `ai_processing_jobs` to newsroom monitors.
- **Seed Data**:
  - Default publication settings, 5 regional Telugu bureau journalists, and sample articles.

---

## 2. Setting Up Google Account Login

### Step A: Google Cloud Console Credentials
1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** (Web Application).
3. Under **Authorized JavaScript origins**, add:
   - `http://localhost:3000`
   - Your production domain (e.g. `https://your-domain.run.app`)
4. Under **Authorized redirect URIs**, add:
   - `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
   - `http://localhost:3000/auth/callback`
5. Copy your **Client ID** and **Client Secret**.

### Step B: Enable Google Provider in Supabase
1. In the Supabase Dashboard, navigate to **Authentication** > **Providers** > **Google**.
2. Toggle Google **ON**.
3. Paste the **Client ID** and **Client Secret** obtained in Step A.
4. Save the configuration.

### Step C: Client Configuration (.env)
In your `.env` file, you can optionally configure:
```env
# Supabase Configuration
VITE_SUPABASE_URL="https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co"
VITE_SUPABASE_ANON_KEY="<YOUR_SUPABASE_ANON_KEY>"

# Google Client ID for Google Identity One-Tap
VITE_GOOGLE_CLIENT_ID="<YOUR_GOOGLE_CLIENT_ID>.apps.googleusercontent.com"
```

---

## 3. How User Profiles Work in Praja Vani

### In the Web Application:
- Click the **Google Profile** badge in the top navigation bar.
- Choose between:
  1. **Google Account Login (OAuth 2.0)**: Sign in with any real Google Account.
  2. **1-Click Instant Sign In**: Pre-configured for Field Reporters and Chief Editors.
  3. **Edit Telugu Profile**: Update Telugu display name (e.g. `కె. వెంకటరావు`), English name, Assigned District (e.g. `ఎన్టీఆర్ జిల్లా`), Bureau Desk, and Role (`Reporter`, `Editor`, `Admin`).
- Profile preferences and reporter assignments are stored securely in the database.
