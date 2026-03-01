import type { Request, Response } from "express";
import type { Express } from "express";
import type { AnalysisJob } from "../interfaces";
import { upload } from "../middlewares";
import { analysisJobs } from "../utils/jobManager";
import { runAnalysisPipeline } from "../services/analysis.service";

export function handleAnalyze(req: Request, res: Response) {
  let job: AnalysisJob | undefined;
  let jobId: string | undefined;
  let insuranceType: string | undefined;
  let uploadedFile: Express.Multer.File | undefined;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    uploadedFile = req.file;
    insuranceType = req.body.type || "health";

    jobId = `job-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    job = {
      id: jobId,
      status: "pending",
      createdAt: Date.now(),
    };
    analysisJobs.set(jobId, job);

    res.json({ jobId, status: "pending" });
  } catch (err: any) {
    console.error("Job creation error:", err);
    return res.status(500).json({ error: "Failed to create analysis job" });
  }

  if (!job || !jobId || !uploadedFile) {
    console.error("Job creation failed - missing required data");
    return;
  }

  // Process in background (don't await)
  runAnalysisPipeline(job, jobId, uploadedFile, insuranceType || "health");
}

export function handleAnalyzeStatus(req: Request, res: Response) {
  const { jobId } = req.params;

  console.log(`[Status Check] Checking status for job: ${jobId}`);

  const job = analysisJobs.get(jobId);

  if (!job) {
    console.log(`[Status Check] Job not found: ${jobId}`);
    return res.status(404).json({
      status: "not_found",
      error: "Job not found. It may have expired or never existed.",
    });
  }

  console.log(`[Status Check] Job ${jobId} status: ${job.status}`);

  res.json({
    id: job.id,
    status: job.status,
    result: job.result,
    error: job.error,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  });
}

export const analyzeUploadMiddleware = (req: Request, res: Response, next: Function) => {
  upload.single("file")(req, res, (err: any) => {
    if (err) {
      console.error("MULTER ERROR:", err);
      return res.status(400).json({
        error: "File upload failed: " + (err.message || "Unknown error"),
      });
    }
    const files = (req as any).files || [];
    const fileField = files.find((f: any) => f.fieldname === "file");
    if (fileField) {
      req.file = fileField;
    }
    next();
  });
};
