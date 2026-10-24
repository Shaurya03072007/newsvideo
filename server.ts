import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './src/server/db.ts';

// Independent Modular Feature Routers
import { articlesRouter } from './src/server/features/articles/articles.router.ts';
import { editionsRouter } from './src/server/features/editions/editions.router.ts';
import { jobsRouter } from './src/server/features/jobs/jobs.router.ts';
import { settingsRouter } from './src/server/features/settings/settings.router.ts';
import { usersRouter, authRouter } from './src/server/features/users/users.router.ts';
import { overviewRouter } from './src/server/features/overview/overview.router.ts';
import { assetsRouter } from './src/server/features/assets/assets.router.ts';

initDatabase();

const app = express();
app.use(express.json({ limit: '15mb' }));

// Non-intrusive rate limiter middleware
const rateWindowMap = new Map<string, { count: number; resetAt: number }>();
app.use('/api', (req, res, next) => {
  const key = req.ip || 'local';
  const now = Date.now();
  const entry = rateWindowMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateWindowMap.set(key, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  entry.count++;
  if (entry.count > 300) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait before retrying.' });
  }
  return next();
});

// Mount decoupled feature routers with distinct API namespaces and independent DB access
app.use('/api/articles', articlesRouter);
app.use('/api/editions', editionsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/overview', overviewRouter);
app.use('/api/assets', assetsRouter);

// Explicit 404 for unhandled API routes to prevent Vite SPA HTML fallback
app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Global API error handler returning JSON instead of Express HTML error pages
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API Error:', err);
  const status = typeof err.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(status).json({
    error: err.message || 'Internal server error occurred.',
  });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 5000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Praja Vani Telugu Newspaper Publishing Server listening on http://localhost:${port}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
