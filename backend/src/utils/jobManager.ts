import type { AnalysisJob } from "../interfaces";
import { APP_CONFIG } from "../config";

export const analysisJobs = new Map<string, AnalysisJob>();

// Clean up old jobs periodically
setInterval(() => {
  const cutoff = Date.now() - APP_CONFIG.jobMaxAge;
  Array.from(analysisJobs.entries()).forEach(([id, job]) => {
    if (job.createdAt < cutoff) {
      analysisJobs.delete(id);
    }
  });
}, APP_CONFIG.jobCleanupInterval);
