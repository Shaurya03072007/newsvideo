# Deploying Praja Vani (ప్రజా వాణి) to Vercel

This repository is pre-configured for full-stack deployment on [Vercel](https://vercel.com):
- **Frontend**: Vite + React 19 + TailwindCSS (compiled to static `dist/` and served via global Edge CDN).
- **Backend API**: Express serverless functions powered by [api/index.ts](file:///c:/Users/reddy5/Documents/newsvideo/api/index.ts) and [vercel.json](file:///c:/Users/reddy5/Documents/newsvideo/vercel.json).
- **Database**: Cloud Supabase PostgreSQL + Auth with local serverless temp storage fallback.

---

## Method 1: Deploy via Vercel Dashboard (Recommended)

### Step 1: Push Your Code to GitHub / GitLab / Bitbucket
Ensure your latest changes are pushed:
```bash
git add .
git commit -m "Configure full-stack Vercel deployment with serverless API"
git push origin main
```

### Step 2: Import Project in Vercel
1. Log in to [vercel.com](https://vercel.com).
2. Click **Add New...** &rarr; **Project**.
3. Select your Git repository and click **Import**.

### Step 3: Configure Project Settings
Vercel will detect Vite automatically. Verify the presets:
- **Framework Preset**: `Vite`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Step 4: Add Environment Variables
In the **Environment Variables** section on the Vercel import screen (or in **Settings &rarr; Environment Variables**), add the following:

| Variable Name | Value | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | `AQ.Ab8RN6...` | AI headline generation & edition layout |
| `APP_URL` | `https://your-app-name.vercel.app` | Production app base URL |
| `VITE_SUPABASE_URL` | `https://zlnrajcrbykejoledivu.supabase.co` | Supabase Cloud API URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Supabase anonymous client key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` | Supabase backend admin key |
| `VITE_GOOGLE_CLIENT_ID` | `210380299044-5r6d59k954pgf7hpnm1nguc50ka0tk56.apps.googleusercontent.com` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | `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` | Google OAuth Client Secret |

### Step 5: Click Deploy
Click **Deploy**. Vercel will build the frontend, package the serverless API routes, and deploy the application.

---

## Method 2: Deploy via Vercel CLI (From Terminal)

You can also deploy directly from your local terminal using the Vercel CLI:

1. **Login to Vercel**:
   ```bash
   npx vercel login
   ```
2. **Deploy to Preview**:
   ```bash
   npx vercel
   ```
   Follow the prompts (accept default settings).
3. **Deploy to Production**:
   ```bash
   npx vercel --prod
   ```

---

## Post-Deployment Checklist

### 1. Update Google Cloud Console Authorized Origins
Once Vercel assigns you a URL (e.g. `https://prajavani-news.vercel.app`):
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Click on your **OAuth 2.0 Client ID**.
3. Under **Authorized JavaScript origins**, add:
   - `https://your-app-name.vercel.app`
4. Under **Authorized redirect URIs**, add:
   - `https://your-app-name.vercel.app`
   - `https://zlnrajcrbykejoledivu.supabase.co/auth/v1/callback`
5. Click **Save**.

### 2. Run the Supabase Auth Trigger Fix
Ensure you run [fix_supabase_trigger.sql](file:///c:/Users/reddy5/Documents/newsvideo/fix_supabase_trigger.sql) in your [Supabase SQL Editor](https://supabase.com/dashboard/project/zlnrajcrbykejoledivu/sql) so that new Google logins and registrations sync cleanly to the Supabase **Authentication &rarr; Users** dashboard.
