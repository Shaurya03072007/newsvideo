import { db, getJobById, listRecentJobs } from '../../db.ts';
import type { AIProcessingJob } from '../../../shared/types.ts';

export const jobsRepo = {
  list(limit = 25): AIProcessingJob[] {
    return listRecentJobs(limit);
  },

  getById(id: string): AIProcessingJob | null {
    return getJobById(id);
  },

  getActiveJobs(): AIProcessingJob[] {
    return listRecentJobs(50).filter((j) => j.status === 'queued' || j.status === 'active');
  },
};
