import type { Request, Response } from "express";
import type { Express } from "express";
import type { AnalysisJob } from "../interfaces";
import { upload } from "../middlewares";
import { analysisJobs, setJob, getJob } from "../utils/jobManager";
import { runAnalysisPipeline } from "../services/analysis.service";
import { UserProfileSchema } from "../types/userProfile";

export function handleAnalyze(req: Request, res: Response) {
  let job: AnalysisJob | undefined;
  let jobId: string | undefined;
  let insuranceType: string | undefined;
  let uploadedFile: Express.Multer.File | undefined;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "No file uploaded" },
      });
    }

    uploadedFile = req.file;
    insuranceType = req.body.type || "health";

    // Parse optional userProfile from multipart body
    let userProfile = undefined;
    if (req.body.userProfile) {
      try {
        const profileData =
          typeof req.body.userProfile === "string"
            ? JSON.parse(req.body.userProfile)
            : req.body.userProfile;
        const parsed = UserProfileSchema.safeParse(profileData);
        if (parsed.success) {
          userProfile = parsed.data;
        }
      } catch {
        // Ignore invalid profile — not critical
      }
    }

    jobId = `job-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    job = {
      id: jobId,
      status: "pending",
      createdAt: Date.now(),
    };
    setJob(jobId, job);

    res.json({
      success: true,
      data: { jobId, status: "pending" },
    });

    // Process in background (don't await)
    runAnalysisPipeline(
      job,
      jobId,
      uploadedFile,
      insuranceType || "health",
      userProfile
    );
  } catch (err: any) {
    console.error("Job creation error:", err);
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL", message: "Failed to create analysis job" },
    });
  }
}

export function handleAnalyzeStatus(req: Request, res: Response) {
  const { jobId } = req.params;

  console.log(`[Status Check] Checking status for job: ${jobId}`);

  const job = getJob(jobId);

  if (!job) {
    console.log(`[Status Check] Job not found: ${jobId}`);
    return res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Job not found. It may have expired or never existed.",
      },
    });
  }

  console.log(`[Status Check] Job ${jobId} status: ${job.status}`);

  // Strip internal data from result before sending
  const { __internal, ...publicResult } = job.result || {};

  res.json({
    success: true,
    data: {
      id: job.id,
      status: job.status,
      result: job.result ? publicResult : undefined,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    },
  });
}

export const analyzeUploadMiddleware = (req: Request, res: Response, next: Function) => {
  upload.single("file")(req, res, (err: any) => {
    if (err) {
      console.error("MULTER ERROR:", err);
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "File upload failed: " + (err.message || "Unknown error"),
        },
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
