import { Router } from 'express';
import { jobsRepo } from './jobs.repo.ts';

export const jobsRouter = Router();

// 1. GET /api/jobs (List recent jobs or filter to active jobs)
jobsRouter.get('/', (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 25;
  const activeOnly = req.query.activeOnly === 'true' || req.query.activeOnly === '1';

  if (activeOnly) {
    return res.json({ jobs: jobsRepo.getActiveJobs() });
  }

  return res.json({ jobs: jobsRepo.list(limit) });
});

// 2. GET /api/jobs/:id (Poll single job progress and percentage)
jobsRouter.get('/:id', (req, res) => {
  const job = jobsRepo.getById(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }
  return res.json({ job });
});
