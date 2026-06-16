import type { Express } from "express";
import type { Server } from "http";
import multer from "multer";
import fs from "fs";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MASTER_AUDIT_PROMPT, PROMPT_VERSION } from "./promptTemplate";
import { LIFE_INSURANCE_PROMPT } from "./lifeInsurancePrompt";
import { VEHICLE_INSURANCE_PROMPT } from "./vehicleInsurancePrompt";
import { POLICY_EXTRACTION_PROMPT } from "./policyExtractionPrompt";
import { AIService } from "./services/aiService";
import { runAnalysisPipeline } from "./services/analysisPipeline";
import { extractStructuredData } from "./services/dataExtraction";
import { isDataEntryType, deriveSharedColumns } from "./services/extractionFields";
import { filterHospitalNetwork, getHospitalSamples } from "./data/insurance_networks/filter_engine";
import { createClient } from "@supabase/supabase-js";
import pkg from "pg";
import nodemailer from "nodemailer";
const { Pool } = pkg;

/* ---------- SUPABASE ADMIN CLIENT ---------- */

const SUPABASE_URL = process.env.SUPABASE_URL || "https://khxbabotbvnyjwvqtumt.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required but was not provided");
}

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY
);

/* ---------- DB POOL ---------- */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.query("SELECT 1")
  .then(() => console.log("✅ DB connected successfully"))
  .catch((err) => console.error("❌ DB connection failed:", err.message));

/* ---------- MULTER ---------- */

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Supabase Storage bucket where original uploaded policy PDFs are kept,
// so they can be downloaded later (and re-analyzed without re-uploading).
const PDF_BUCKET = "policy-pdfs";

/* ---------- TYPES ---------- */

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

/* ---------- DB-BACKED JOB STORE ---------- */

// In-memory cache for fast status lookups — DB is source of truth
export const analysisJobs = new Map<string, AnalysisJob>();

async function persistJob(job: AnalysisJob): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO analysis_jobs (
        id, status, result, error,
        created_at, completed_at,
        extraction_started_at, extraction_ended_at,
        fetch_started_at, fetch_ended_at,
        ai_started_at, ai_ended_at, prompt_version
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        result = EXCLUDED.result,
        error = EXCLUDED.error,
        completed_at = EXCLUDED.completed_at,
        extraction_started_at = EXCLUDED.extraction_started_at,
        extraction_ended_at = EXCLUDED.extraction_ended_at,
        fetch_started_at = EXCLUDED.fetch_started_at,
        fetch_ended_at = EXCLUDED.fetch_ended_at,
        ai_started_at = EXCLUDED.ai_started_at,
        ai_ended_at = EXCLUDED.ai_ended_at,
        prompt_version = EXCLUDED.prompt_version`,
      [
        job.id,
        job.status,
        job.result ? JSON.stringify(job.result) : null,
        job.error || null,
        job.createdAt,
        job.completedAt || null,
        job.extractionStartedAt || null,
        job.extractionEndedAt || null,
        job.fetchStartedAt || null,
        job.fetchEndedAt || null,
        job.aiStartedAt || null,
        job.aiEndedAt || null,
        job.prompt_version || null
      ]
    );
  } catch (err: any) {
    console.error(`[Job ${job.id}] Failed to persist job:`, err.message);
  }
}

async function loadJobFromDB(jobId: string): Promise<AnalysisJob | null> {
  try {
    const res = await pool.query(
      "SELECT * FROM analysis_jobs WHERE id = $1",
      [jobId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      status: r.status,
      result: r.result,
      error: r.error,
      createdAt: parseInt(r.created_at),
      completedAt: r.completed_at ? parseInt(r.completed_at) : undefined,
      extractionStartedAt: r.extraction_started_at ? parseInt(r.extraction_started_at) : undefined,
      extractionEndedAt: r.extraction_ended_at ? parseInt(r.extraction_ended_at) : undefined,
      fetchStartedAt: r.fetch_started_at ? parseInt(r.fetch_started_at) : undefined,
      fetchEndedAt: r.fetch_ended_at ? parseInt(r.fetch_ended_at) : undefined,
      aiStartedAt: r.ai_started_at ? parseInt(r.ai_started_at) : undefined,
      aiEndedAt: r.ai_ended_at ? parseInt(r.ai_ended_at) : undefined,
      prompt_version: r.prompt_version || undefined,
    };
  } catch (err: any) {
    console.error(`[Job ${jobId}] Failed to load from DB:`, err.message);
    return null;
  }
}

// Cleanup in-memory cache every hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  Array.from(analysisJobs.entries()).forEach(([id, job]) => {
    if (job.createdAt < oneHourAgo) {
      analysisJobs.delete(id);
    }
  });
}, 5 * 60 * 1000);

/* ---------- PDF / TEXT EXTRACTION HELPERS ---------- */

export async function extractTextFromPDF(filePath: string): Promise<string> {
  const fileData = fs.readFileSync(filePath);
  const data = new Uint8Array(fileData);

  try {
    const loadingTask = pdfjs.getDocument({ data, disableFontFace: true });
    const pdf = await loadingTask.promise;

    if (pdf.numPages === 0) {
      console.warn("[PDF Extraction] PDF has 0 pages — trying pdf-parse fallback");
      return await extractTextWithPdfParse(fileData);
    }

    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((it: any) => it.str).join(" ");
        text += pageText + "\n";
      } catch (pageErr: any) {
        console.warn(`[PDF Extraction] Page ${i} failed: ${pageErr.message} — skipping`);
      }
    }

    if (!text.trim()) {
      console.warn("[PDF Extraction] pdfjs returned empty text — trying pdf-parse fallback");
      return await extractTextWithPdfParse(fileData);
    }

    return text;
  } catch (error: any) {
    console.warn("[PDF Extraction] pdfjs error:", error.message?.substring(0, 150));
    try {
      return await extractTextWithPdfParse(fileData);
    } catch (fallbackErr: any) {
      console.error("[PDF Extraction] pdf-parse fallback also failed:", fallbackErr.message);
      throw new Error(`PDF text extraction failed: ${error.message}`);
    }
  }
}

async function extractTextWithPdfParse(buffer: Buffer | Uint8Array): Promise<string> {
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
  const result = await (pdfParse as any)(Buffer.from(buffer));
  return result.text;
}

async function extractTextFromPlain(filePath: string): Promise<string> {
  return fs.readFileSync(filePath, "utf-8");
}

async function extractTextFromImage(
  file: Express.Multer.File,
  apiKey: string
): Promise<string> {
  const buffer = fs.readFileSync(file.path);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "Transcribe all readable text from this insurance policy image. " +
              "Return plain text only. No formatting. No summaries.",
          },
          {
            inlineData: {
              data: buffer.toString("base64"),
              mimeType: file.mimetype || "image/png",
            },
          },
        ],
      },
    ],
  });

  return result.response.text();
}

async function extractPolicyText(file: Express.Multer.File): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  if (file.mimetype.includes("pdf")) return extractTextFromPDF(file.path);
  if (file.mimetype.startsWith("image/")) return extractTextFromImage(file, apiKey);
  if (file.mimetype === "text/plain") return extractTextFromPlain(file.path);

  throw new Error(`Unsupported file type: ${file.mimetype}`);
}

/* ---------- JWT VERIFICATION HELPER ---------- */

const verifyJwt = async (req: any, res: any): Promise<string | null> => {
  const authHeader = req.headers["authorization"] as string | undefined;
  console.log('[verifyJwt] Auth header:', authHeader ? `Bearer ${authHeader.slice(7, 27)}...` : 'missing');
  
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    console.log('[verifyJwt] Verifying token with Supabase admin client...');
    
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    
    if (error) {
      console.error('[verifyJwt] Supabase auth error:', error.message);
      res.status(401).json({ error: "Invalid or expired token", details: error.message });
      return null;
    }
    
    if (!user) {
      console.error('[verifyJwt] No user returned from Supabase');
      res.status(401).json({ error: "Invalid or expired token" });
      return null;
    }
    
    console.log('[verifyJwt] Token verified successfully for user:', user.id);
    return user.id;
  }
  
  console.error('[verifyJwt] Missing authorization header');
  res.status(401).json({ error: "Missing authorization" });
  return null;
};

/* ---------- ADMIN MIDDLEWARE ---------- */

const isAdmin = async (req: any, res: any, next: any) => {
  const userId = await verifyJwt(req, res);
  if (!userId) return;

  try {
    const agentRes = await pool.query(
      "SELECT is_admin FROM agents WHERE id = $1",
      [userId]
    );
    if (agentRes.rows.length === 0 || !agentRes.rows[0].is_admin) {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }
    req.adminUserId = userId;
    next();
  } catch (err: any) {
    console.error("isAdmin check error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/* ================================================================
   ROUTE REGISTRATION
   ================================================================ */

export async function registerRoutes(
  _httpServer: Server,
  app: Express
): Promise<Server> {

  app.use((req, res, next) => {
    next();
  });

  /* ── Public: Policy Analysis ─────────────────────────────────────────── */

  app.post(
    "/api/analyze",
    (req, res, next) => {
      upload.single("file")(req, res, (err: any) => {
        if (err) {
          console.error("MULTER ERROR:", err);
          return res
            .status(400)
            .json({ error: "File upload failed: " + (err.message || "Unknown error") });
        }
        const files = (req as any).files || [];
        const fileField = files.find((f: any) => f.fieldname === "file");
        if (fileField) req.file = fileField;
        next();
      });
    },
    async (req, res) => {
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
        jobId = crypto.randomUUID();

        job = { id: jobId, status: "pending", createdAt: Date.now(), prompt_version: PROMPT_VERSION };
        analysisJobs.set(jobId, job);
        await persistJob(job);

        res.json({ jobId, status: "pending" });
      } catch (err: any) {
        console.error("Job creation error:", err);
        return res.status(500).json({ error: "Failed to create analysis job" });
      }

      if (!job || !jobId || !uploadedFile) {
        console.error("Job creation failed - missing required data");
        return;
      }

      (async () => {
        try {
          job!.status = "processing";
          job!.extractionStartedAt = Date.now();
          await persistJob(job!);

          const uploadedPolicyText = await extractPolicyText(uploadedFile!);
          job!.extractionEndedAt = Date.now();
          fs.unlinkSync(uploadedFile!.path);

          const result = await runAnalysisPipeline(uploadedPolicyText, insuranceType);

          if (result.status === "completed") {
            job!.status = "completed";
            job!.result = result.result;
          } else {
            job!.status = "failed";
            job!.error = result.error;
          }

          job!.completedAt = Date.now();
          await persistJob(job!);
        } catch (err: any) {
          console.error(`[Job ${jobId}] Processing error:`, err);
          job!.status = "failed";
          job!.error = err.message || "Unknown error";
          await persistJob(job!);
        }
      })();
    }
  );

  /* ── Public: Analysis Status ─────────────────────────────────────────── */

  app.get("/api/analyze/status/:jobId", async (req, res) => {
    const { jobId } = req.params;

    // Check in-memory cache first, fall back to DB
    let job = analysisJobs.get(jobId);
    if (!job) {
      job = await loadJobFromDB(jobId) ?? undefined;
      if (job) analysisJobs.set(jobId, job); // re-cache
    }

    if (!job) {
      return res.status(404).json({
        status: "not_found",
        error: "Job not found. It may have expired or never existed.",
      });
    }

    if (job.status === "completed") {
      const durationMs = (job.completedAt || Date.now()) - job.createdAt;
      const extractionMs = (job.extractionEndedAt || 0) - (job.extractionStartedAt || 0);
      const fetchMs = (job.fetchEndedAt || 0) - (job.fetchStartedAt || 0);
      const aiMs = (job.aiEndedAt || 0) - (job.aiStartedAt || 0);
      const overheadMs = durationMs - extractionMs - fetchMs - aiMs;

      return res.json({
        id: job.id,
        status: job.status,
        result: job.result,
        durationMs,
        breakdown: { extractionMs, fetchMs, aiMs, overheadMs },
        error: job.error,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      });
    }

    res.json({
      id: job.id,
      status: job.status,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    });
  });

  /* ── Public: Policy Extraction (archived) ────────────────────────────── */

  app.post(
    "/api/extract-policy",
    (req, res, next) => {
      upload.single("policy_pdf")(req, res, (err: any) => {
        if (err) {
          console.error("MULTER ERROR:", err);
          return res
            .status(400)
            .json({ error: "File upload failed: " + (err.message || "Unknown error") });
        }
        next();
      });
    },
    async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      try {
        await extractPolicyText(req.file);
      } catch (extractError: any) {
        fs.unlinkSync(req.file.path);
        return res
          .status(500)
          .json({ error: "Failed to extract text from PDF: " + extractError.message });
      }

      fs.unlinkSync(req.file.path);
      return res.status(501).json({ error: "Extraction pipeline archived." });
    }
  );

  /* ── Public: Get Sample Hospital Names ──────────────────────────────── */

  app.get("/api/hospitals/samples", async (req, res) => {
    try {
      const { city, pincode, limit = "10" } = req.query;

      console.log(`[Hospital Samples] Request: city=${city}, pincode=${pincode}, limit=${limit}`);
      
      const samples = getHospitalSamples({
        city: city as string | undefined,
        pincode: pincode as string | undefined,
        limit: parseInt(limit as string, 10),
      });

      console.log(`[Hospital Samples] Returning ${samples.length} samples`);
      res.json(samples);
    } catch (error: any) {
      console.error("[Hospital Samples] Error:", error);
      res.status(500).json({
        error: "Failed to get hospital samples",
        details: error.message,
      });
    }
  });

  /* ── Public: Hospital Network Filter ────────────────────────────────── */

  app.get("/api/hospitals/filter", async (req, res) => {
    try {
      const { state, city, pincode } = req.query;

      const result = filterHospitalNetwork({
        state: state as string | undefined,
        city: city as string | undefined,
        pincode: pincode as string | undefined,
      });

      res.json(result);
    } catch (error: any) {
      console.error("[Hospital Filter] Error:", error);
      res.status(500).json({
        error: "Failed to filter hospital network data",
        details: error.message,
      });
    }
  });

  /* ── Public: Get Shared Report ───────────────────────────────────────── */

  app.get("/api/public-report/:uuid", async (req, res) => {
    const uuid = req.params.uuid;

    try {
      const reportRes = await pool.query(
        `SELECT
          pr.report_data AS recommendation_data,
          pr.is_active,
          c.policyholder_name  AS client_name,
          c.insurer            AS current_insurer,
          c.score              AS current_score,
          c.flaws              AS current_flaws,
          a.full_name          AS agent_name
         FROM public_reports pr
         LEFT JOIN clients c ON pr.client_id = c.id
         LEFT JOIN agents  a ON pr.agent_id  = a.id
         WHERE pr.id = $1`,
        [uuid]
      );

      if (reportRes.rows.length === 0 || !reportRes.rows[0].is_active) {
        return res.status(404).json({ error: "Report not found or inactive" });
      }

      return res.json(reportRes.rows[0]);
    } catch (err: any) {
      console.error("PUBLIC REPORT ERROR:", err.message, err.stack);
      res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  });

  /* ── Public: PDF Generation ──────────────────────────────────────────── */

  app.get("/api/generate-pdf/test", (req, res) => {
    res.json({ status: "PDF endpoint is registered and working" });
  });

  app.post("/api/generate-pdf", async (req, res) => {
    try {
      let { url } = req.body;

      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        const protocol = req.protocol;
        const host = req.get("host");
        url = `${protocol}://${host}${url}`;
      }

      // SSRF guard: only render pages on our own / known hosts, and never reach
      // internal addresses in production. The legitimate use is rendering our
      // own report pages, which are always same-origin or a configured domain.
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return res.status(400).json({ error: "Invalid URL" });
      }
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return res.status(400).json({ error: "Invalid URL protocol" });
      }

      const allowedHosts = new Set<string>();
      const ownHost = req.get("host");
      if (ownHost) allowedHosts.add(ownHost);
      [process.env.PUBLIC_URL, ...(process.env.CORS_ORIGIN || "").split(",")]
        .filter(Boolean)
        .forEach((u) => { try { allowedHosts.add(new URL(u!.trim()).host); } catch { /* ignore */ } });
      ["indsure.in", "www.indsure.in", "beta.indsure.in"].forEach((h) => {
        allowedHosts.add(h);
        allowedHosts.add(`https://${h}`.replace("https://", ""));
      });

      const hostname = parsedUrl.hostname.toLowerCase();
      // Cloud metadata, link-local, loopback and RFC1918 ranges are ALWAYS
      // blocked — never depend on NODE_ENV here (this box runs as "development").
      const isPrivate =
        /^(127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0)/.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
        /^(::1|fc00:|fd00:|fe80:)/.test(hostname) ||
        hostname === "localhost" ||
        hostname === "metadata.google.internal";

      if (isPrivate) {
        return res.status(400).json({ error: "Target host not allowed" });
      }
      // Only render pages on our own / explicitly-allowed hosts.
      if (!allowedHosts.has(parsedUrl.host)) {
        return res.status(400).json({ error: "Target host not allowed" });
      }

      const { chromium } = await import("playwright");

      let browser;
      try {
        browser = await chromium.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const page = await browser.newPage();
        await page.setViewportSize({ width: 1200, height: 1600 });
        await page.goto(url, { waitUntil: "networkidle", timeout: 0 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(2000);

        const pdfBuffer = await page.pdf({
          format: "A4",
          printBackground: true,
          margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" },
          preferCSSPageSize: false,
          scale: 0.8,
          displayHeaderFooter: false,
        });

        await browser.close();
        browser = null;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="IndSure-report.pdf"`
        );
        res.send(pdfBuffer);
      } catch (browserError: any) {
        if (browser) await browser.close().catch(() => { });
        throw browserError;
      }
    } catch (error: any) {
      console.error("[PDF] PDF generation error:", error);
      res.status(500).json({
        error: error.message || "PDF generation failed",
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  });

  /* ── Calculator: Save & Get Report ──────────────────────────────────── */

  app.post("/api/calculator/save-report", async (req, res) => {
    const { inputs, result_data, customer_id } = req.body;

    // Basic validation
    if (!inputs || !result_data) {
      return res
        .status(400)
        .json({ error: "inputs and result_data are required" });
    }

    // Validate inputs structure (basic check)
    if (typeof inputs !== "object" || typeof result_data !== "object") {
      return res
        .status(400)
        .json({ error: "Invalid data format" });
    }

    // Optional agent stamping: the public consumer flow sends no auth header
    // and saves anonymously, exactly as before. The agent portal sends its
    // Supabase token so the report is linked to the agent (and optionally a
    // customer, after an ownership check). Auth failures degrade to an
    // anonymous save rather than rejecting the report.
    let agentId: string | null = null;
    let customerId: string | null = null;
    const authHeader = req.headers["authorization"] as string | undefined;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
        if (!error && user) agentId = user.id;
      } catch {
        // anonymous save
      }
    }
    if (agentId && customer_id) {
      const owned = await pool.query(
        "SELECT id FROM customers WHERE id = $1 AND agent_id = $2",
        [customer_id, agentId]
      );
      if (owned.rows.length > 0) customerId = customer_id;
    }

    try {
      const insertRes = await pool.query(
        "INSERT INTO calculator_reports (inputs, result_data, agent_id, customer_id) VALUES ($1, $2, $3, $4) RETURNING id",
        [JSON.stringify(inputs), JSON.stringify(result_data), agentId, customerId]
      );
      return res.json({ uuid: insertRes.rows[0].id, success: true });
    } catch (err: any) {
      console.error("ERROR saving calculator report:", err);
      
      // Check for specific database errors
      if (err.code === "23505") {
        return res.status(409).json({ error: "Report already exists" });
      }
      
      res.status(500).json({ 
        error: "Failed to save report. Please try again.",
        retryable: true 
      });
    }
  });

  app.get("/api/calculator/report/:uuid", async (req, res) => {
    const { uuid } = req.params;
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      return res.status(400).json({ error: "Invalid report ID format" });
    }
    
    try {
      const reportRes = await pool.query(
        "SELECT inputs, result_data, created_at FROM calculator_reports WHERE id = $1",
        [uuid]
      );
      
      if (reportRes.rows.length === 0) {
        return res.status(404).json({ 
          error: "Report not found or has expired",
          code: "REPORT_NOT_FOUND"
        });
      }
      
      return res.json(reportRes.rows[0]);
    } catch (err: any) {
      console.error("ERROR fetching calculator report:", err);
      res.status(500).json({ 
        error: "Failed to load report. Please try again.",
        retryable: true
      });
    }
  });

  /* ── DPDP: Grievance Redressal ─────────────────────────────────────── */

  app.post("/api/grievance", async (req, res) => {
    try {
      const {
        name,
        email,
        phone,
        requestType,
        details,
        acknowledgement,
        submittedAt,
      } = req.body ?? {};

      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "name is required" });
      }
      if (!email || typeof email !== "string" || !email.trim()) {
        return res.status(400).json({ error: "email is required" });
      }
      if (!requestType || typeof requestType !== "string") {
        return res.status(400).json({ error: "requestType is required" });
      }
      if (!details || typeof details !== "string" || details.trim().length < 20) {
        return res.status(400).json({ error: "details must be at least 20 characters" });
      }

      const acknowledgementBool = Boolean(acknowledgement);
      if (!acknowledgementBool) {
        return res.status(400).json({ error: "acknowledgement must be checked" });
      }

      const insertRes = await pool.query(
        `INSERT INTO grievance_requests (name, email, phone, request_type, details, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [name.trim(), email.trim(), phone || null, requestType, details.trim(), submittedAt ? new Date(submittedAt) : new Date()]
      );

      const grievanceOfficerEmail =
        process.env.GRIEVANCE_OFFICER_EMAIL ?? "grievance@ensured.in";

      // Best-effort acknowledgement email: if SMTP env vars are not set, we store the request and respond.
      const smtpHost = process.env.GRIEVANCE_SMTP_HOST;
      const smtpPort = process.env.GRIEVANCE_SMTP_PORT ? Number(process.env.GRIEVANCE_SMTP_PORT) : undefined;
      const smtpUser = process.env.GRIEVANCE_SMTP_USER;
      const smtpPass = process.env.GRIEVANCE_SMTP_PASS;
      const fromEmail = process.env.GRIEVANCE_FROM_EMAIL ?? smtpUser ?? grievanceOfficerEmail;

      if (smtpHost && smtpPort && smtpUser && smtpPass && fromEmail) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });

        const ackSubject =
          process.env.GRIEVANCE_ACK_SUBJECT ??
          "Acknowledgement — IndSure DPDP Grievance Request";

        const ackText = [
          "Thank you for contacting IndSure.",
          "",
          "We have received your DPDP grievance/request and will respond within 30 days as required.",
          "",
          `Reference ID: ${insertRes.rows[0]?.id ?? "-"}`,
          `Request type: ${requestType}`,
          "",
          "If you have additional information, please reply to this email.",
        ].join("\n");

        // Send acknowledgement to the user; optionally also notify the grievance mailbox.
        await transporter.sendMail({
          from: fromEmail,
          to: email.trim(),
          subject: ackSubject,
          text: ackText,
          replyTo: grievanceOfficerEmail,
        });

        if (grievanceOfficerEmail && grievanceOfficerEmail !== email.trim()) {
          await transporter.sendMail({
            from: fromEmail,
            to: grievanceOfficerEmail,
            subject: `New DPDP grievance request: ${requestType}`,
            text: [
              "A new grievance request was submitted through IndSure.",
              "",
              `Reference ID: ${insertRes.rows[0]?.id ?? "-"}`,
              `From: ${name.trim()} <${email.trim()}>`,
              `Phone: ${phone ?? "-"}`,
              `Request type: ${requestType}`,
              "",
              "Details:",
              details.trim(),
            ].join("\n"),
          });
        }
      } else {
        console.log(
          "⚠️ Skipping grievance acknowledgement email: SMTP env vars not configured."
        );
      }

      return res.status(200).json({ success: true, id: insertRes.rows[0]?.id });
    } catch (err: any) {
      console.error("Grievance endpoint error:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });

  /* ── Agent: Create Profile ───────────────────────────────────────────── */

  app.post("/api/agent/create-profile", async (req, res) => {
    try {
      const { id, email, full_name, phone, city, experience_years, invite_code } =
        req.body;

      if (!id || !email || !full_name) {
        return res
          .status(400)
          .json({ error: "Missing required fields: id, email, full_name" });
      }

      // Anti-spoofing: a profile may only be created for a real Supabase auth
      // user. If the signup flow already has a session, the bearer token MUST
      // match the id; if there's no session yet (e.g. email-confirmation mode),
      // verify the id corresponds to an existing auth user before inserting.
      const authHeader = req.headers["authorization"] as string | undefined;
      if (authHeader?.startsWith("Bearer ")) {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
        if (error || !user || user.id !== id) {
          return res.status(403).json({ error: "Token does not match the profile being created" });
        }
      } else {
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
        if (error || !data?.user) {
          return res.status(403).json({ error: "Unknown user id" });
        }
      }

      await pool.query(
        `INSERT INTO agents (id, email, full_name, name, phone, city, location, experience_years, invite_code, consent_given_at)
         VALUES ($1, $2, $3, $3, $4, $5, $5, $6, $7, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          id,
          email,
          full_name,
          phone || null,
          city || null,
          experience_years || 0,
          invite_code || null,
        ]
      );

      return res.json({ success: true });
    } catch (err: any) {
      console.error("Create profile error:", err);
      res.status(500).json({ error: err.message || "Failed to create agent profile" });
    }
  });

  /* ── Agent: Get Own Profile ──────────────────────────────────────────── */

  app.get("/api/agent/me", async (req, res) => {
    try {
      const userId = await verifyJwt(req, res);
      if (!userId) return;

      const result = await pool.query(
        `SELECT id, email, full_name, name, phone, phone AS phone_number, city, location,
                role, status, is_admin, partnered_companies, created_at, NULL AS firm_name
         FROM agents WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Agent not found" });
      }

      return res.json(result.rows[0]);
    } catch (err: any) {
      console.error("Get agent me error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  /* ── Agent: Update Profile ───────────────────────────────────────────── */

  app.patch("/api/agent/update-profile", async (req, res) => {
    const agentId = await verifyJwt(req, res);
    if (!agentId) return;

    const { full_name, phone_number, city } = req.body;

    try {
      const result = await pool.query(
        `UPDATE agents
         SET full_name = COALESCE($1, full_name),
             phone     = COALESCE($2, phone),
             city      = COALESCE($3, city)
         WHERE id = $4
         RETURNING *`,
        [full_name ?? null, phone_number ?? null, city ?? null, agentId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Agent not found" });
      }

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error("Error updating agent profile:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ── Agent: Create Batch ─────────────────────────────────────────────── */

  app.post("/api/agent/create-batch", async (req, res) => {
    try {
      const agentId = await verifyJwt(req, res);
      if (!agentId) return;

      const { total_count } = req.body;
      if (!total_count) {
        return res.status(400).json({ error: "Missing total_count" });
      }

      const result = await pool.query(
        `INSERT INTO batch_uploads (agent_id, total, processed_count, status)
         VALUES ($1, $2, 0, 'pending')
         RETURNING id, agent_id, total, processed_count, status, created_at`,
        [agentId, total_count]
      );

      return res.json(result.rows[0]);
    } catch (err: any) {
      console.error("Create batch error:", err);
      res.status(500).json({ error: err.message || "Failed to create batch" });
    }
  });

  /* ── Agent: Add Client ───────────────────────────────────────────────── */

  app.post("/api/agent/add-client", async (req, res) => {
    try {
      const agentId = await verifyJwt(req, res);
      if (!agentId) return;

      const { batch_id, policy_name, pdf_url } = req.body;
      if (!batch_id || !pdf_url) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Ensure the batch belongs to the caller before attaching a client to it.
      const batchCheck = await pool.query(
        "SELECT id FROM batch_uploads WHERE id = $1 AND agent_id = $2",
        [batch_id, agentId]
      );
      if (batchCheck.rows.length === 0) {
        return res.status(404).json({ error: "Batch not found" });
      }

      const result = await pool.query(
        `INSERT INTO clients (agent_id, batch_id, policy_name, pdf_url, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING id`,
        [agentId, batch_id, policy_name || "Unknown Policy", pdf_url]
      );

      return res.json(result.rows[0]);
    } catch (err: any) {
      console.error("Add client error:", err);
      res.status(500).json({ error: err.message || "Failed to add client" });
    }
  });

  /* ── Agent: Trigger Batch Processing ────────────────────────────────── */

  app.post("/api/agent/trigger-batch-process", async (req, res) => {
    const { batchId } = req.body;
    if (!batchId) return res.status(400).json({ error: "batchId is required" });

    res.json({ status: "started", batchId });

    (async () => {
      try {

        const clientsRes = await pool.query(
          "SELECT * FROM clients WHERE batch_id = $1 AND status = 'pending'",
          [batchId]
        );
        const clients = clientsRes.rows;

        for (const client of clients) {
          try {
            await pool.query(
              "UPDATE clients SET status = 'processing' WHERE id = $1",
              [client.id]
            );

            let downloadUrl = client.pdf_url;

            if (
              downloadUrl &&
              downloadUrl.includes("/storage/v1/object/sign/")
            ) {
              try {
                const urlParsed = new URL(downloadUrl);
                const pathMatch = urlParsed.pathname.match(
                  /\/object\/sign\/([^?]+)/
                );
                if (pathMatch) {
                  const [bucket, ...rest] = pathMatch[1].split("/");
                  const storagePath = rest.join("/");
                  const { data: freshSign, error: signErr } =
                    await supabaseAdmin.storage
                      .from(bucket)
                      .createSignedUrl(storagePath, 60 * 60);
                  if (!signErr && freshSign?.signedUrl) {
                    downloadUrl = freshSign.signedUrl;
                  }
                }
              } catch (e) {
                console.warn(
                  `[Batch ${batchId}] Could not refresh signed URL, using original.`,
                  e
                );
              }
            }

            const storageRes = await fetch(downloadUrl);
            if (!storageRes.ok)
              throw new Error(`Failed to download PDF: ${storageRes.statusText}`);
            const buffer = await storageRes.arrayBuffer();

            if (!fs.existsSync("uploads"))
              fs.mkdirSync("uploads", { recursive: true });
            const tempFilePath = `uploads/temp-${client.id}.pdf`;
            fs.writeFileSync(tempFilePath, Buffer.from(buffer));
            const policyText = await extractPolicyText({
              path: tempFilePath,
              mimetype: "application/pdf",
            } as any);
            fs.unlinkSync(tempFilePath);

            const analysisResult = await runAnalysisPipeline(policyText);

            if (analysisResult.status === "completed") {
              const r = analysisResult.result;
              const meta = analysisResult.metadata || {};
              await pool.query(
                `UPDATE clients SET
                  status = 'done',
                  score = $2,
                  flaws = $3,
                  report_data = $4,
                  policyholder_name = $5,
                  insurer = $6,
                  sum_insured = $7,
                  expiry_date = $8
                 WHERE id = $1`,
                [
                  client.id,
                  r.audit_score?.score || 0,
                  JSON.stringify(r.final_verdict?.key_failure_points || []),
                  JSON.stringify(r),
                  r.identity?.insured_names?.[0] || null,
                  meta.insurer || null,
                  r.coverage_structure?.base_sum_insured || null,
                  r.policy_timeline?.policy_expiry_date || null,
                ]
              );
            } else {
              await pool.query(
                "UPDATE clients SET status = 'error', error_message = $2 WHERE id = $1",
                [client.id, analysisResult.error]
              );
            }

            await pool.query(
              "UPDATE batch_uploads SET processed_count = processed_count + 1 WHERE id = $1",
              [batchId]
            );
          } catch (clientErr: any) {
            console.error(
              `[Batch ${batchId}] Error processing client ${client.id}:`,
              clientErr
            );
            await pool.query(
              "UPDATE clients SET status = 'error', error_message = $2 WHERE id = $1",
              [client.id, clientErr.message]
            );
          }
        }

        await pool.query(
          "UPDATE batch_uploads SET status = 'done' WHERE id = $1",
          [batchId]
        );

        const batchInfo = await pool.query(
          "SELECT agent_id, total FROM batch_uploads WHERE id = $1",
          [batchId]
        );
        if (batchInfo.rows[0]) {
          await pool.query(
            "INSERT INTO notifications (agent_id, message, type, link) VALUES ($1, $2, $3, $4)",
            [
              batchInfo.rows[0].agent_id,
              `Your ${batchInfo.rows[0].total} policies have been analyzed. View results →`,
              "analysis_complete",
              "/agent/dashboard",
            ]
          );
        }

      } catch (batchErr: any) {
        console.error(`[Batch ${batchId}] Batch processing failed:`, batchErr);
      }
    })();
  });

  /* ── Agent: Switch Recommendation ───────────────────────────────────── */

  app.post("/api/agent/switch-recommendation", async (req, res) => {
    const agentId = await verifyJwt(req, res);
    if (!agentId) return;

    const { client_id } = req.body;
    if (!client_id)
      return res.status(400).json({ error: "client_id is required" });

    try {
      const clientRes = await pool.query(
        "SELECT agent_id, insurer, flaws, score FROM clients WHERE id = $1 AND agent_id = $2",
        [client_id, agentId]
      );

      if (clientRes.rows.length === 0) {
        return res.status(404).json({ error: "Client not found" });
      }

      const client = clientRes.rows[0];

      const empanelRes = await pool.query(
        "SELECT insurer_name FROM empanelments WHERE agent_id = $1",
        [client.agent_id]
      );
      const empanelledInsurers = empanelRes.rows.map((r) => r.insurer_name);

      const flaws =
        typeof client.flaws === "string"
          ? JSON.parse(client.flaws)
          : client.flaws || [];

      const systemPrompt = `You are an expert health insurance advisor. Given a client's current policy flaws, recommend the single best alternative policy.
Prioritize: no room rent cap, no co-payment, full restoration.
Available empanelled insurers for this advisor: ${empanelledInsurers.join(", ") || "all major Indian insurers"}.
If no empanelled insurer has a better option, broaden to all major Indian insurers (Star, Care, Niva Bupa, HDFC Ergo, ICICI Lombard).
Return ONLY a JSON object:
{
  "recommended_insurer": string,
  "recommended_plan": string,
  "improvements": string[],
  "premium_delta": string,
  "confidence": "high" | "medium"
}`;

      const userContent = `Current Insurer: ${client.insurer || "Unknown"}
Current Score: ${client.score || 0}/100
Current Flaws: ${JSON.stringify(flaws.slice(0, 5))}`;

      const aiResponse = await AIService.generateContent(
        systemPrompt,
        userContent
      );

      let recommendation: any;
      try {
        const cleaned = aiResponse.replace(/```json|```/g, "").trim();
        recommendation = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error("Failed to parse switch recommendation:", aiResponse);
        return res
          .status(500)
          .json({ error: "Failed to generate recommendation" });
      }

      return res.json(recommendation);
    } catch (err: any) {
      console.error("Switch recommendation error:", err);
      return res.json({
        recommended_insurer: "Niva Bupa",
        recommended_plan: "ReAssure 2.0",
        improvements: [
          "No room rent capping",
          "Unlimited restoration",
          "Zero co-payment",
        ],
        premium_delta: "~₹2,000/yr more",
        confidence: "medium",
      });
    }
  });

  /* ── Agent: Create Public Report ─────────────────────────────────────── */

  app.post("/api/agent/public-report", async (req, res) => {
    const callerId = await verifyJwt(req, res);
    if (!callerId) return;

    const { client_id, recommendation_data } = req.body;
    if (!client_id || !recommendation_data) {
      return res
        .status(400)
        .json({ error: "client_id and recommendation_data are required" });
    }

    try {
      const clientRes = await pool.query(
        "SELECT agent_id FROM clients WHERE id = $1 AND agent_id = $2",
        [client_id, callerId]
      );
      if (clientRes.rows.length === 0)
        return res.status(404).json({ error: "Client not found" });
      const agentId = clientRes.rows[0].agent_id;

      const insertRes = await pool.query(
        "INSERT INTO public_reports (client_id, agent_id, report_data, report_type, is_active) VALUES ($1, $2, $3, 'switch', true) RETURNING id",
        [client_id, agentId, JSON.stringify(recommendation_data)]
      );

      return res.json({ uuid: insertRes.rows[0].id });
    } catch (err: any) {
      console.error("ERROR in public-report creation:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  /* ── Agent: Delete Client ────────────────────────────────────────────── */

  app.delete("/api/agent/delete-client/:id", async (req, res) => {
    try {
      const agentId = await verifyJwt(req, res);
      if (!agentId) return;

      const { id } = req.params;
      const result = await pool.query(
        "DELETE FROM clients WHERE id = $1 AND agent_id = $2",
        [id, agentId]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Client not found" });
      }
      return res.json({ success: true });
    } catch (err: any) {
      console.error("Delete client error:", err);
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  /* ── Agent: Fetch Client Report ──────────────────────────────────────── */

  app.get("/api/client-report/:id", async (req, res) => {
    try {
      const clientId = req.params.id;
      const getClient = await pool.query(
        "SELECT report_data FROM clients WHERE id = $1",
        [clientId]
      );

      if (getClient.rows.length === 0 || !getClient.rows[0].report_data) {
        return res
          .status(404)
          .json({ error: "Report not found or not finished processing" });
      }

      return res.json({ report_data: getClient.rows[0].report_data });
    } catch (err: any) {
      console.error("Fetch client report error:", err);
      res.status(500).json({ error: "Failed to fetch report" });
    }
  });

  /* ── Agent: Portfolio Summary ────────────────────────────────────────── */

  app.get("/api/agent/summary/:agentId", async (req, res) => {
    const callerId = await verifyJwt(req, res);
    if (!callerId) return;

    const { agentId } = req.params;
    if (agentId !== callerId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    try {
      const cached = await pool.query(
        "SELECT insights, generated_at FROM agent_summaries WHERE agent_id = $1",
        [agentId]
      );

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (
        cached.rows.length > 0 &&
        new Date(cached.rows[0].generated_at) > thirtyDaysAgo
      ) {
        return res.json({
          insights: cached.rows[0].insights,
          generated_at: cached.rows[0].generated_at,
          is_cached: true,
        });
      }

      const clientsRes = await pool.query(
        "SELECT flaws FROM clients WHERE agent_id = $1 AND status = 'done'",
        [agentId]
      );

      if (clientsRes.rows.length === 0) {
        return res.json({ insights: [], generated_at: null, empty: true });
      }

      const allFlaws = clientsRes.rows.flatMap((r) => {
        try {
          return typeof r.flaws === "string"
            ? JSON.parse(r.flaws)
            : r.flaws || [];
        } catch {
          return [];
        }
      });

      if (allFlaws.length === 0) {
        return res.json({ insights: [], generated_at: null, empty: true });
      }

      const systemPrompt =
        "You are an insurance portfolio analyst. Given these policy flaws across client policies, generate 4-5 concise actionable insights an insurance advisor should know about their portfolio. Be specific with percentages where possible. Return ONLY a JSON array of strings.";
      const userContent = `Flaws: ${JSON.stringify(allFlaws)}. Number of policies: ${clientsRes.rows.length}`;

      const aiResponse = await AIService.generateContent(
        systemPrompt,
        userContent
      );

      let insights: string[] = [];
      try {
        const cleaned = aiResponse.replace(/```json|```/g, "").trim();
        insights = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error(
          "Failed to parse Gemini response for summary:",
          aiResponse
        );
        return res
          .status(500)
          .json({ error: "Failed to process AI insights" });
      }

      await pool.query(
        `INSERT INTO agent_summaries (agent_id, insights, generated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (agent_id) DO UPDATE SET
           insights = EXCLUDED.insights,
           generated_at = NOW()`,
        [agentId, JSON.stringify(insights)]
      );

      return res.json({
        insights,
        generated_at: new Date(),
        is_cached: false,
      });
    } catch (err: any) {
      console.error("ERROR in /api/agent/summary:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  /* ── Admin: Stats ────────────────────────────────────────────────────── */

  app.get("/api/admin/stats", isAdmin, async (req, res) => {
    try {
      const agentsCount = await pool.query("SELECT COUNT(*) FROM agents");
      const policiesCount = await pool.query(
        "SELECT COUNT(*) FROM clients WHERE status = 'done'"
      );
      const batchesCount = await pool.query(
        "SELECT COUNT(DISTINCT batch_id) FROM clients"
      );
      const reportsCount = await pool.query(
        "SELECT COUNT(*) FROM public_reports"
      );

      res.json({
        totalAgents: parseInt(agentsCount.rows[0].count),
        totalPolicies: parseInt(policiesCount.rows[0].count),
        totalBatches: parseInt(batchesCount.rows[0].count),
        totalReports: parseInt(reportsCount.rows[0].count),
      });
    } catch (err) {
      console.error("Admin stats error:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  /* ── Admin: Agents ───────────────────────────────────────────────────── */

  app.get("/api/admin/agents", isAdmin, async (req, res) => {
    try {
      const agentsRes = await pool.query(`
        SELECT
          a.id, a.full_name, a.email, a.city, a.created_at, a.upload_limit,
          COUNT(c.id)  AS client_count,
          AVG(c.score) AS avg_score
        FROM agents a
        LEFT JOIN clients c ON a.id = c.agent_id
        GROUP BY a.id
        ORDER BY a.created_at DESC
      `);

      const empanelRes = await pool.query(
        "SELECT agent_id, insurer_name FROM empanelments"
      );
      const empanelMap: any = {};
      empanelRes.rows.forEach((r) => {
        if (!empanelMap[r.agent_id]) empanelMap[r.agent_id] = [];
        empanelMap[r.agent_id].push(r.insurer_name);
      });

      const agents = agentsRes.rows.map((a) => ({
        ...a,
        empanelments: empanelMap[a.id] || [],
        client_count: parseInt(a.client_count),
        avg_score: a.avg_score ? parseFloat(a.avg_score).toFixed(1) : "0",
      }));

      res.json(agents);
    } catch (err) {
      console.error("Admin agents error:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.patch("/api/admin/agents/:id", isAdmin, async (req, res) => {
    const { id } = req.params;
    const { upload_limit } = req.body;
    try {
      await pool.query(
        "UPDATE agents SET upload_limit = $1 WHERE id = $2",
        [upload_limit, id]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  /* ── Admin: Invite Codes ─────────────────────────────────────────────── */

  app.get("/api/admin/invite-codes", isAdmin, async (req, res) => {
    try {
      const codesRes = await pool.query(`
        SELECT ic.*, a.full_name AS used_by_name
        FROM invite_codes ic
        LEFT JOIN agents a ON ic.used_by = a.id
        ORDER BY ic.created_at DESC
      `);
      res.json(codesRes.rows);
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post("/api/admin/invite-codes", isAdmin, async (req, res) => {
    const { code, is_random } = req.body;
    let finalCode = code;

    if (is_random) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let randomPart = "";
      for (let i = 0; i < 4; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      finalCode = `INDSURE-${randomPart}`;
    }

    try {
      const insertRes = await pool.query(
        "INSERT INTO invite_codes (code) VALUES ($1) RETURNING *",
        [finalCode]
      );
      res.json(insertRes.rows[0]);
    } catch (err) {
      res
        .status(500)
        .json({ error: "Code already exists or server error" });
    }
  });

  /* ══════════════════════════════════════════════════════════════════════
     NEW AGENT UPLOAD & SHARING ROUTES
     ══════════════════════════════════════════════════════════════════════ */

  /* ── Agent: Upload & Analyze ─────────────────────────────────────────── */
  
  app.post(
    "/api/agent/analyze",
    (req, res, next) => {
      upload.single("file")(req, res, (err: any) => {
        if (err) {
          console.error("MULTER ERROR:", err);
          return res
            .status(400)
            .json({ error: "File upload failed: " + (err.message || "Unknown error") });
        }
        next();
      });
    },
    async (req, res) => {
      try {
        // Verify agent auth
        const agentId = await verifyJwt(req, res);
        if (!agentId) return;

        const insuranceType = (req.body.type || "health").toLowerCase();
        const isDataEntry = isDataEntryType(insuranceType);

        // Credit check — only the health forensic analysis consumes credits.
        // The OCR/data-entry lanes (motor/life/travel/property) are free.
        if (!isDataEntry) {
          const creditRes = await pool.query(
            "SELECT balance FROM agent_credits WHERE agent_id = $1",
            [agentId]
          );
          const credits = creditRes.rows[0]?.balance ?? 0;
          if (credits <= 0) {
            return res.status(403).json({ error: "NO_CREDITS", message: "You have no credits remaining. Contact your admin to top up." });
          }
        }

        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        const file = req.file;

        // Parse optional client detail fields
        const policyholder_name = req.body.policyholder_name || null;
        const client_email = req.body.client_email || null;
        const client_phone = req.body.client_phone || null;
        const policy_identifier = req.body.policy_identifier || null;

        // Create job
        const jobId = crypto.randomUUID();
        const job: AnalysisJob = {
          id: jobId,
          status: "pending",
          createdAt: Date.now(),
          prompt_version: PROMPT_VERSION
        };
        
        analysisJobs.set(jobId, job);
        await persistJob(job);

        // Create client record immediately
        const clientResult = await pool.query(
          `INSERT INTO clients (
            agent_id, status, filename, file_size,
            policyholder_name, client_email, client_phone, policy_identifier,
            insurance_type, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          RETURNING id, share_token`,
          [
            agentId,
            'pending',
            file.originalname,
            file.size,
            policyholder_name,
            client_email,
            client_phone,
            policy_identifier,
            insuranceType
          ]
        );

        const clientId = clientResult.rows[0].id;

        // Store mapping of jobId → clientId. Best-effort: analysis_jobs.policy_id
        // has a legacy FK to the `policies` table, so writing a `clients` id can
        // violate it. Never let that abort the upload — clientId is returned in
        // the response and used by the client to track the job.
        try {
          await pool.query(
            `UPDATE analysis_jobs SET policy_id = $1 WHERE id = $2`,
            [clientId, jobId]
          );
        } catch (mapErr: any) {
          console.warn(`[Job ${jobId}] could not map policy_id → clientId:`, mapErr.message);
        }

        res.json({ clientId, jobId, status: "pending" });

        // Start background processing
        (async () => {
          try {
            job.status = "processing";
            job.extractionStartedAt = Date.now();
            await persistJob(job);

            await pool.query(
              "UPDATE clients SET status = 'processing' WHERE id = $1",
              [clientId]
            );

            const uploadedPolicyText = await extractPolicyText(file);
            job.extractionEndedAt = Date.now();
            
            // Persist the original file to storage so it can be downloaded later
            // and re-analyzed without re-uploading. Best-effort — never blocks analysis.
            try {
              const fileBuffer = fs.readFileSync(file.path);
              const ext = file.originalname.includes(".") ? file.originalname.split(".").pop() : "pdf";
              const storagePath = `${agentId}/${clientId}.${ext}`;
              const { error: upErr } = await supabaseAdmin.storage
                .from(PDF_BUCKET)
                .upload(storagePath, fileBuffer, {
                  contentType: file.mimetype || "application/pdf",
                  upsert: true,
                });
              if (upErr) {
                console.error(`[Job ${jobId}] PDF storage upload failed:`, upErr.message);
              } else {
                const { data: signed } = await supabaseAdmin.storage
                  .from(PDF_BUCKET)
                  .createSignedUrl(storagePath, 60 * 60);
                if (signed?.signedUrl) {
                  await pool.query("UPDATE clients SET pdf_url = $1 WHERE id = $2", [signed.signedUrl, clientId]);
                }
              }
            } catch (storeErr: any) {
              console.error(`[Job ${jobId}] PDF storage error:`, storeErr.message);
            }

            // Delete temp file
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }

            // ── OCR / data-entry lane (no scoring, no credits) ──
            if (isDataEntry) {
              const extraction = await extractStructuredData(uploadedPolicyText, insuranceType);

              if (extraction.status === "completed") {
                job.status = "completed";
                job.result = extraction.data;

                const shared = deriveSharedColumns(insuranceType, extraction.data);
                await pool.query(
                  `UPDATE clients SET
                    status = 'done',
                    insurance_type = $1,
                    extracted_data = $2,
                    insurer = $3,
                    policy_name = $4,
                    expiry_date = $5,
                    sum_insured = $6,
                    policyholder_name = COALESCE(policyholder_name, $7)
                  WHERE id = $8`,
                  [
                    insuranceType,
                    JSON.stringify(extraction.data),
                    shared.insurer ?? null,
                    shared.policy_name ?? null,
                    shared.expiry_date ?? null,
                    shared.sum_insured ?? null,
                    shared.policyholder_name ?? null,
                    clientId,
                  ]
                );
              } else {
                job.status = "failed";
                job.error = extraction.error;
                await pool.query(
                  "UPDATE clients SET status = 'error', error_message = $1 WHERE id = $2",
                  [extraction.error, clientId]
                );
              }

              job.completedAt = Date.now();
              await persistJob(job);
              return;
            }

            const result = await runAnalysisPipeline(uploadedPolicyText, insuranceType);

            if (result.status === "completed") {
              job.status = "completed";
              job.result = result.result;

              // Decrement credits on success
              await pool.query(
                "UPDATE agent_credits SET balance = GREATEST(balance - 1, 0), total_used = total_used + 1 WHERE agent_id = $1",
                [agentId]
              );
              
              // Extract metadata from result. The score lives at the report's
              // top-level audit_score; insurer/product come from the pipeline's
              // metadata step (extractPolicyMetadata), not the report body.
              const reportData = result.result;
              const rawScore = reportData?.audit_score?.score ?? reportData?.final_verdict?.audit_score?.score ?? null;
              // clients.score is integer; the engine emits 12.5-step buckets (e.g. 87.5)
              const score = rawScore == null ? null : Math.round(Number(rawScore));
              const insurer = result.metadata?.insurer || reportData?.identity?.insurer_name || null;
              const policyName = result.metadata?.product || result.metadata?.plan || reportData?.coverage_structure?.policy_name || null;
              const expiryDate = reportData?.policy_timeline?.policy_expiry_date || null;
              const sumInsured = reportData?.coverage_structure?.base_sum_insured || null;
              const flaws = reportData?.final_verdict?.key_failure_points || [];
              const insuredName = reportData?.identity?.insured_names?.[0] || null;

              // Update client record with results
              await pool.query(
                `UPDATE clients SET
                  status = 'done',
                  report_data = $1,
                  score = $2,
                  insurer = $3,
                  policy_name = $4,
                  expiry_date = $5,
                  sum_insured = $6,
                  flaws = $7,
                  policyholder_name = COALESCE(policyholder_name, $8)
                WHERE id = $9`,
                [
                  JSON.stringify(reportData),
                  score,
                  insurer,
                  policyName,
                  expiryDate,
                  sumInsured,
                  JSON.stringify(flaws),
                  insuredName,
                  clientId
                ]
              );
            } else {
              job.status = "failed";
              job.error = result.error;
              
              await pool.query(
                "UPDATE clients SET status = 'error', error_message = $1 WHERE id = $2",
                [result.error, clientId]
              );
            }

            job.completedAt = Date.now();
            await persistJob(job);
          } catch (err: any) {
            console.error(`[Job ${jobId}] Processing error:`, err);
            job.status = "failed";
            job.error = err.message || "Unknown error";
            await persistJob(job);
            
            await pool.query(
              "UPDATE clients SET status = 'error', error_message = $1 WHERE id = $2",
              [err.message, clientId]
            );
          }
        })();
      } catch (err: any) {
        console.error("Agent analyze error:", err);
        res.status(500).json({ error: err.message || "Failed to create analysis job" });
      }
    }
  );

  /* ── Agent: Check Analysis Status ────────────────────────────────────── */
  
  app.get("/api/agent/analyze/status/:jobId", async (req, res) => {
    try {
      const agentId = await verifyJwt(req, res);
      if (!agentId) return;

      const { jobId } = req.params;

      // Check in-memory cache first, fall back to DB
      let job = analysisJobs.get(jobId);
      if (!job) {
        job = await loadJobFromDB(jobId) ?? undefined;
        if (job) analysisJobs.set(jobId, job);
      }

      if (!job) {
        return res.status(404).json({
          status: "not_found",
          error: "Job not found",
        });
      }

      // Get clientId from analysis_jobs
      const jobRecord = await pool.query(
        "SELECT policy_id FROM analysis_jobs WHERE id = $1",
        [jobId]
      );
      
      const clientId = jobRecord.rows[0]?.policy_id;

      if (job.status === "completed") {
        return res.json({
          status: "completed",
          clientId,
          result: job.result
        });
      } else if (job.status === "failed") {
        return res.json({
          status: "error",
          error: job.error,
          clientId
        });
      } else {
        return res.json({
          status: job.status,
          clientId
        });
      }
    } catch (err: any) {
      console.error("Agent analyze status error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ── Agent: Toggle Share ─────────────────────────────────────────────── */
  
  app.post("/api/agent/clients/:id/share/toggle", async (req, res) => {
    try {
      const agentId = await verifyJwt(req, res);
      if (!agentId) return;

      const { id } = req.params;
      const { enabled, regenerate } = req.body;

      // Verify ownership
      const ownerCheck = await pool.query(
        "SELECT id, share_token FROM clients WHERE id = $1 AND agent_id = $2",
        [id, agentId]
      );

      if (ownerCheck.rows.length === 0) {
        return res.status(404).json({ error: "Client not found" });
      }

      let shareToken = ownerCheck.rows[0].share_token;

      // Regenerate token if requested
      if (regenerate) {
        const result = await pool.query(
          "UPDATE clients SET share_token = uuid_generate_v4() WHERE id = $1 RETURNING share_token",
          [id]
        );
        shareToken = result.rows[0].share_token;
      }

      // Update share_enabled
      await pool.query(
        "UPDATE clients SET share_enabled = $1, last_shared_at = NOW() WHERE id = $2",
        [enabled, id]
      );

      const origin = `${req.protocol}://${req.get("host")}`;
      const shareUrl = `${origin}/shared/report/${shareToken}`;

      res.json({
        shareToken,
        shareEnabled: enabled,
        shareUrl
      });
    } catch (err: any) {
      console.error("Toggle share error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ── Agent: Save edited data-entry fields ───────────────────────────── */

  app.patch("/api/agent/clients/:id/extracted-data", async (req, res) => {
    try {
      const agentId = await verifyJwt(req, res);
      if (!agentId) return;

      const { id } = req.params;
      const extractedData = req.body?.extracted_data;

      if (!extractedData || typeof extractedData !== "object") {
        return res.status(400).json({ error: "extracted_data object required" });
      }

      // Verify ownership and fetch the insurance type for shared-column mapping.
      const ownerCheck = await pool.query(
        "SELECT insurance_type FROM clients WHERE id = $1 AND agent_id = $2",
        [id, agentId]
      );
      if (ownerCheck.rows.length === 0) {
        return res.status(404).json({ error: "Client not found" });
      }

      const insuranceType = ownerCheck.rows[0].insurance_type;
      const shared = deriveSharedColumns(insuranceType, extractedData);

      await pool.query(
        `UPDATE clients SET
          extracted_data = $1,
          insurer = $2,
          policy_name = $3,
          expiry_date = $4,
          sum_insured = $5,
          policyholder_name = COALESCE($6, policyholder_name)
        WHERE id = $7 AND agent_id = $8`,
        [
          JSON.stringify(extractedData),
          shared.insurer ?? null,
          shared.policy_name ?? null,
          shared.expiry_date ?? null,
          shared.sum_insured ?? null,
          shared.policyholder_name ?? null,
          id,
          agentId,
        ]
      );

      res.json({ ok: true });
    } catch (err: any) {
      console.error("Save extracted-data error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ── Agent: Re-run analysis from the stored document ────────────────── */
  // Re-processes an existing client row using the PDF persisted in storage at
  // upload time. Health re-runs go through the full pipeline (credits checked
  // up front, decremented on success — failed runs never consumed one);
  // data-entry types re-run the free OCR extraction.

  app.post("/api/agent/clients/:id/rerun", async (req, res) => {
    try {
      const agentId = await verifyJwt(req, res);
      if (!agentId) return;

      const { id } = req.params;

      const clientRes = await pool.query(
        "SELECT id, status, pdf_url, filename, insurance_type FROM clients WHERE id = $1 AND agent_id = $2",
        [id, agentId]
      );
      if (clientRes.rows.length === 0) {
        return res.status(404).json({ error: "Client not found" });
      }

      const client = clientRes.rows[0];

      if (!client.pdf_url) {
        return res.status(409).json({
          error: "NO_PDF",
          message:
            "The original document isn't stored for this policy (it was uploaded before document storage existed). Delete it and re-upload the PDF.",
        });
      }

      const insuranceType = (client.insurance_type || "health").toLowerCase();
      const isDataEntry = isDataEntryType(insuranceType);

      if (!isDataEntry) {
        const creditRes = await pool.query(
          "SELECT balance FROM agent_credits WHERE agent_id = $1",
          [agentId]
        );
        const credits = creditRes.rows[0]?.balance ?? 0;
        if (credits <= 0) {
          return res.status(403).json({ error: "NO_CREDITS", message: "You have no credits remaining. Contact your admin to top up." });
        }
      }

      // Resolve the storage object behind pdf_url (signed or public URL).
      const pathMatch = client.pdf_url.match(/\/storage\/v1\/object\/(?:sign|public)\/(.+?)(?:\?|$)/);
      if (!pathMatch) {
        return res.status(409).json({ error: "NO_PDF", message: "Stored document URL is not recognized. Delete and re-upload the PDF." });
      }
      const [bucket, ...restPath] = pathMatch[1].split("/");
      const storagePath = restPath.join("/");

      const { data: blob, error: dlErr } = await supabaseAdmin.storage
        .from(bucket)
        .download(storagePath);
      if (dlErr || !blob) {
        return res.status(409).json({ error: "NO_PDF", message: "Could not fetch the stored document. Delete and re-upload the PDF." });
      }

      await pool.query(
        "UPDATE clients SET status = 'processing', error_message = NULL WHERE id = $1",
        [id]
      );
      res.json({ ok: true, clientId: id, status: "processing" });

      // Background processing — mirrors the analyze flow with the stored file.
      (async () => {
        const ext = (storagePath.split(".").pop() || "pdf").toLowerCase();
        const mimetype =
          ext === "png" ? "image/png"
          : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
          : ext === "txt" ? "text/plain"
          : "application/pdf";
        const tempPath = `uploads/rerun-${id}-${Date.now()}.${ext}`;
        try {
          fs.writeFileSync(tempPath, Buffer.from(await blob.arrayBuffer()));

          const fileLike = {
            path: tempPath,
            mimetype,
            originalname: client.filename || `policy.${ext}`,
          } as Express.Multer.File;
          const policyText = await extractPolicyText(fileLike);

          if (isDataEntry) {
            const extraction = await extractStructuredData(policyText, insuranceType);
            if (extraction.status === "completed") {
              const shared = deriveSharedColumns(insuranceType, extraction.data);
              await pool.query(
                `UPDATE clients SET
                  status = 'done',
                  extracted_data = $1,
                  insurer = $2,
                  policy_name = $3,
                  expiry_date = $4,
                  sum_insured = $5,
                  policyholder_name = COALESCE(policyholder_name, $6)
                WHERE id = $7`,
                [
                  JSON.stringify(extraction.data),
                  shared.insurer ?? null,
                  shared.policy_name ?? null,
                  shared.expiry_date ?? null,
                  shared.sum_insured ?? null,
                  shared.policyholder_name ?? null,
                  id,
                ]
              );
            } else {
              await pool.query(
                "UPDATE clients SET status = 'error', error_message = $1 WHERE id = $2",
                [extraction.error, id]
              );
            }
            return;
          }

          const result = await runAnalysisPipeline(policyText, insuranceType);

          if (result.status === "completed") {
            await pool.query(
              "UPDATE agent_credits SET balance = GREATEST(balance - 1, 0), total_used = total_used + 1 WHERE agent_id = $1",
              [agentId]
            );

            const reportData = result.result;
            const rawScore = reportData?.audit_score?.score ?? reportData?.final_verdict?.audit_score?.score ?? null;
            // clients.score is integer; the engine emits 12.5-step buckets (e.g. 87.5)
            const score = rawScore == null ? null : Math.round(Number(rawScore));
            const insurer = result.metadata?.insurer || reportData?.identity?.insurer_name || null;
            const policyName = result.metadata?.product || result.metadata?.plan || reportData?.coverage_structure?.policy_name || null;
            const expiryDate = reportData?.policy_timeline?.policy_expiry_date || null;
            const sumInsured = reportData?.coverage_structure?.base_sum_insured || null;
            const flaws = reportData?.final_verdict?.key_failure_points || [];
            const insuredName = reportData?.identity?.insured_names?.[0] || null;

            await pool.query(
              `UPDATE clients SET
                status = 'done',
                report_data = $1,
                score = $2,
                insurer = $3,
                policy_name = $4,
                expiry_date = $5,
                sum_insured = $6,
                flaws = $7,
                policyholder_name = COALESCE(policyholder_name, $8)
              WHERE id = $9`,
              [
                JSON.stringify(reportData),
                score,
                insurer,
                policyName,
                expiryDate,
                sumInsured,
                JSON.stringify(flaws),
                insuredName,
                id,
              ]
            );
          } else {
            await pool.query(
              "UPDATE clients SET status = 'error', error_message = $1 WHERE id = $2",
              [result.error, id]
            );
          }
        } catch (err: any) {
          console.error(`[Rerun ${id}] error:`, err);
          await pool
            .query("UPDATE clients SET status = 'error', error_message = $1 WHERE id = $2", [
              err.message || "Re-run failed",
              id,
            ])
            .catch(() => {});
        } finally {
          try {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          } catch {}
        }
      })();
    } catch (err: any) {
      console.error("Rerun error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ── Agent: Download Original PDF ───────────────────────────────────── */

  app.get("/api/agent/clients/:id/download-pdf", async (req, res) => {
    try {
      const agentId = await verifyJwt(req, res);
      if (!agentId) return;

      const { id } = req.params;

      const clientRes = await pool.query(
        "SELECT id, pdf_url, filename FROM clients WHERE id = $1 AND agent_id = $2",
        [id, agentId]
      );

      if (clientRes.rows.length === 0) {
        return res.status(404).json({ error: "Not found" });
      }

      const { pdf_url, filename } = clientRes.rows[0];

      if (!pdf_url) {
        return res.status(404).json({ error: "No PDF stored for this policy" });
      }

      // Re-sign if it's a Supabase storage signed URL
      let downloadUrl = pdf_url;
      const pathMatch = pdf_url.match(/\/storage\/v1\/object\/(?:sign|public)\/(.+?)(?:\?|$)/);
      if (pathMatch) {
        const [bucket, ...rest] = pathMatch[1].split("/");
        const storagePath = rest.join("/");
        const { data: freshSign, error: signErr } = await supabaseAdmin.storage
          .from(bucket)
          .createSignedUrl(storagePath, 60 * 60);
        if (!signErr && freshSign?.signedUrl) {
          downloadUrl = freshSign.signedUrl;
        }
      }

      res.json({ url: downloadUrl, filename: filename || "policy.pdf" });
    } catch (err: any) {
      console.error("Download PDF error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ── Public: Get Shared Report ───────────────────────────────────────── */

  const publicShareLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 requests per IP per minute
    message: { error: 'rate_limited' }
  });

  app.get("/api/shared/report/:shareToken", publicShareLimit, async (req, res) => {
    try {
      const { shareToken } = req.params;

      // Fetch client record
      const clientRes = await pool.query(
        `SELECT 
          id, report_data, score, insurer, policy_name, policyholder_name, 
          filename, created_at, status, share_enabled
        FROM clients 
        WHERE share_token = $1`,
        [shareToken]
      );

      if (clientRes.rows.length === 0) {
        return res.status(404).json({ error: "invalid_or_revoked" });
      }

      const client = clientRes.rows[0];

      if (!client.share_enabled) {
        return res.status(404).json({ error: "invalid_or_revoked" });
      }

      if (!client.report_data || client.status !== 'done') {
        return res.status(404).json({ error: "report_not_ready" });
      }

      // IP-based view tracking with dedup
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const SALT = process.env.IP_HASH_SALT || 'indsure-salt-2024';
      const ipHash = crypto.createHash('sha256').update(ip + SALT).digest('hex');

      // Check if this IP viewed in last 24 hours
      const recentView = await pool.query(
        `SELECT id FROM report_views 
        WHERE client_id = $1 AND ip_hash = $2 AND viewed_at > NOW() - INTERVAL '24 hours'
        LIMIT 1`,
        [client.id, ipHash]
      );

      if (recentView.rows.length === 0) {
        // New view - insert and increment
        await pool.query(
          "INSERT INTO report_views (client_id, ip_hash) VALUES ($1, $2)",
          [client.id, ipHash]
        );
        await pool.query(
          "UPDATE clients SET views = views + 1 WHERE id = $1",
          [client.id]
        );
      }

      // Return public-safe data
      res.json({
        report_data: client.report_data,
        score: client.score,
        insurer: client.insurer,
        policy_name: client.policy_name,
        policyholder_name: client.policyholder_name,
        filename: client.filename,
        created_at: client.created_at
      });
    } catch (err: any) {
      console.error("Shared report error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ── Public: Lead Collection ─────────────────────────────────────────── */

  app.post("/api/leads", async (req, res) => {
    try {
      const { name, email, phone, city, source } = req.body;

      // Validate required fields
      if (!name || !email || !phone) {
        return res.status(400).json({ 
          error: "Missing required fields: name, email, and phone are required" 
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      // Validate phone format (10 digits)
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ error: "Invalid phone format. Must be 10 digits" });
      }

      // Insert lead into database
      const result = await pool.query(
        `INSERT INTO leads (name, email, phone, city, source, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'new', NOW(), NOW())
         RETURNING id, created_at`,
        [name, email, phone, city || null, source || 'policy_report']
      );

      const lead = result.rows[0];

      console.log(`✅ New lead created: ${name} (${email}) - ID: ${lead.id}`);

      // TODO: Send notification email to admin
      // TODO: Add to CRM system

      res.status(201).json({
        success: true,
        message: "Lead submitted successfully",
        leadId: lead.id,
        createdAt: lead.created_at
      });
    } catch (err: any) {
      console.error("Lead submission error:", err);
      
      // Check for duplicate email
      if (err.code === '23505') {
        return res.status(409).json({ 
          error: "A lead with this email already exists" 
        });
      }

      res.status(500).json({ 
        error: "Failed to submit lead. Please try again later." 
      });
    }
  });

  /* ── Admin: Get Leads ─────────────────────────────────────────── */

  app.get("/api/leads", isAdmin, async (req, res) => {
    try {
      const { status, limit = 50, offset = 0 } = req.query;

      let query = `
        SELECT id, name, email, phone, city, source, status, notes, 
               created_at, updated_at, contacted_at, contacted_by
        FROM leads
      `;
      const params: any[] = [];

      if (status) {
        query += ` WHERE status = $1`;
        params.push(status);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Get total count
      const countQuery = status 
        ? `SELECT COUNT(*) FROM leads WHERE status = $1`
        : `SELECT COUNT(*) FROM leads`;
      const countParams = status ? [status] : [];
      const countResult = await pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      res.json({
        leads: result.rows,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (err: any) {
      console.error("Get leads error:", err);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  console.log("[ROUTES] All routes registered successfully");
  return _httpServer;
}
