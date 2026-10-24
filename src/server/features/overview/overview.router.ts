import { Router } from 'express';
import { articlesRepo } from '../articles/articles.repo.ts';
import { editionsRepo } from '../editions/editions.repo.ts';
import { jobsRepo } from '../jobs/jobs.repo.ts';
import { settingsRepo } from '../settings/settings.repo.ts';

export const overviewRouter = Router();

overviewRouter.get('/', (_req, res) => {
  const articles = articlesRepo.list();
  const editions = editionsRepo.list();
  const jobs = jobsRepo.list(15);
  const settings = settingsRepo.get();
  const activeEdition = editions[0] || null;
  const geminiConfigured = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
  );

  return res.json({
    metrics: {
      totalSubmissions: articles.length,
      articlesProcessed: articles.filter(
        (a) => a.status === 'processed' || a.status === 'approved' || a.status === 'published'
      ).length,
      articlesAwaitingProcessing: articles.filter(
        (a) => a.status === 'submitted' || a.status === 'draft' || a.status === 'processing'
      ).length,
      articlesFlaggedOrRejected: articles.filter(
        (a) => a.status === 'flagged_hold' || a.status === 'failed'
      ).length,
      activeEditionNumber: activeEdition ? activeEdition.editionNumber : null,
      activeEditionId: activeEdition ? activeEdition.id : null,
      pagesGenerated: activeEdition ? activeEdition.actualPageCount : 0,
      pdfPublishingStatus: activeEdition ? activeEdition.status : 'none',
    },
    aiStatus: {
      geminiApiKeyConfigured: geminiConfigured,
      modelAId: settings.modelAClassifierId,
      modelBId: settings.modelBStoryId,
      promptVersion: settings.promptVersion,
    },
    activeEdition,
    recentJobs: jobs,
    settings,
  });
});
