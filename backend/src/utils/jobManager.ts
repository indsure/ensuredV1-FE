import type { AnalysisJob } from "../interfaces";
import { APP_CONFIG } from "../config";

// In-memory store (primary during migration, fallback when DB unavailable)
export const analysisJobs = new Map<string, AnalysisJob>();

// DB-backed job operations (dual-write: memory + DB)
let dbAvailable = false;

async function tryDbWrite(jobId: string, job: AnalysisJob) {
  if (!dbAvailable) return;
  try {
    const { db } = await import("../db/client");
    const { analysisJobs: jobsTable, analysisResults } = await import(
      "../db/schema"
    );
    const { eq } = await import("drizzle-orm");

    // Upsert job status to DB
    const existing = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(jobsTable).values({
        id: jobId,
        status: job.status,
        insuranceType: (job as any).insuranceType || "health",
        error: job.error || null,
        createdAt: new Date(job.createdAt),
        completedAt: job.completedAt ? new Date(job.completedAt) : null,
      });
    } else {
      await db
        .update(jobsTable)
        .set({
          status: job.status,
          error: job.error || null,
          completedAt: job.completedAt ? new Date(job.completedAt) : null,
        })
        .where(eq(jobsTable.id, jobId));
    }

    // If completed with result, store in analysis_results
    if (job.status === "completed" && job.result) {
      const { __internal, suitability_analysis, ...reportJson } = job.result;
      const existingResult = await db
        .select()
        .from(analysisResults)
        .where(eq(analysisResults.jobId, jobId))
        .limit(1);

      if (existingResult.length === 0) {
        await db.insert(analysisResults).values({
          jobId,
          reportJson,
          policyText: __internal?.policyText || null,
          suitabilityResult: suitability_analysis || null,
        });
      }
    }
  } catch (err) {
    // DB write failed — in-memory is still the source of truth
    console.warn("[JobManager] DB write failed, using in-memory only:", (err as Error).message);
  }
}

export function setJob(jobId: string, job: AnalysisJob) {
  analysisJobs.set(jobId, job);
  tryDbWrite(jobId, job);
}

export function getJob(jobId: string): AnalysisJob | undefined {
  return analysisJobs.get(jobId);
}

export function updateJob(jobId: string, updates: Partial<AnalysisJob>) {
  const job = analysisJobs.get(jobId);
  if (!job) return;
  Object.assign(job, updates);
  tryDbWrite(jobId, job);
}

// Initialize DB availability check
(async () => {
  try {
    if (process.env.DATABASE_URL) {
      const { db } = await import("../db/client");
      const { sql } = await import("drizzle-orm");
      await db.execute(sql`SELECT 1`);
      dbAvailable = true;
      console.log("[JobManager] DB available — dual-write enabled");
    }
  } catch {
    console.log("[JobManager] DB not available — using in-memory only");
  }
})();

// Clean up old in-memory jobs periodically
setInterval(() => {
  const cutoff = Date.now() - APP_CONFIG.jobMaxAge;
  Array.from(analysisJobs.entries()).forEach(([id, job]) => {
    if (job.createdAt < cutoff) {
      analysisJobs.delete(id);
    }
  });
}, APP_CONFIG.jobCleanupInterval);
