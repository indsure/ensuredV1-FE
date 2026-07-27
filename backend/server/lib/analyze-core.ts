/**
 * Shared analysis core logic
 * Used by both public /api/analyze and agent /api/agent/analyze
 */

import { analysisJobs } from '../routes';
import { runAnalysisPipeline } from '../services/analysisPipeline';
import fs from 'fs';

interface AnalysisJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  result?: any;
  error?: string;
  createdAt: number;
  completedAt?: number;
  extractionStartedAt?: number;
  extractionEndedAt?: number;
  fetchStartedAt?: number;
  fetchEndedAt?: number;
  aiStartedAt?: number;
  aiEndedAt?: number;
  prompt_version?: string;
}

/**
 * Kick off analysis for a file
 * Returns jobId immediately, analysis runs in background
 */
export async function kickoffAnalysis(
  file: Express.Multer.File,
  insuranceType: string = 'health',
  persistJob: (job: AnalysisJob) => Promise<void>,
  extractPolicyText: (file: Express.Multer.File) => Promise<string>,
  PROMPT_VERSION: string
): Promise<{ jobId: string }> {
  const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  const job: AnalysisJob = {
    id: jobId,
    status: "pending",
    createdAt: Date.now(),
    prompt_version: PROMPT_VERSION
  };
  
  analysisJobs.set(jobId, job);
  await persistJob(job);
  
  // Start background processing
  (async () => {
    try {
      job.status = "processing";
      job.extractionStartedAt = Date.now();
      await persistJob(job);
      
      const uploadedPolicyText = await extractPolicyText(file);
      job.extractionEndedAt = Date.now();
      
      // Delete temp file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      
      const result = await runAnalysisPipeline(uploadedPolicyText, insuranceType);
      
      if (result.status === "completed") {
        job.status = "completed";
        job.result = result.result;
      } else {
        job.status = "failed";
        job.error = result.error;
      }
      
      job.completedAt = Date.now();
      await persistJob(job);
    } catch (err: any) {
      console.error(`[Job ${jobId}] Processing error:`, err);
      job.status = "failed";
      job.error = err.message || "Unknown error";
      await persistJob(job);
    }
  })();
  
  return { jobId };
}

/**
 * Get analysis result for a jobId
 * Returns null if not found, result if completed, or status info
 */
export async function getAnalysisResult(
  jobId: string,
  loadJobFromDB: (jobId: string) => Promise<AnalysisJob | null>
): Promise<{ status: string; result?: any; error?: string }> {
  // Check in-memory cache first
  let job = analysisJobs.get(jobId);
  
  // Fall back to DB
  if (!job) {
    job = await loadJobFromDB(jobId) ?? undefined;
    if (job) {
      analysisJobs.set(jobId, job);
    }
  }
  
  if (!job) {
    return { status: "not_found", error: "Job not found" };
  }
  
  return {
    status: job.status,
    result: job.result,
    error: job.error
  };
}
