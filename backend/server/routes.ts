import type { Express } from "express";
import type { Server } from "http";
import multer from "multer";
import fs from "fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MASTER_AUDIT_PROMPT } from "./promptTemplate";
import { LIFE_INSURANCE_PROMPT } from "./lifeInsurancePrompt";
import { VEHICLE_INSURANCE_PROMPT } from "./vehicleInsurancePrompt";
import { POLICY_EXTRACTION_PROMPT } from "./policyExtractionPrompt";
// ARCHIVED: import { runExtractionPipeline, type PolicyReport } from "./utils/pipelineOrchestrator";
// ARCHIVED: import { normalizePolicyForComparison, comparePolicies } from "./utils/comparisonEngine";
import { AIService } from "./services/aiService";
// ARCHIVED: import { filterHospitalNetwork } from "./data/insurance_networks/filter_engine";
// ARCHIVED: import { requireAuth } from "./middleware/auth";


const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});


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
}


export const analysisJobs = new Map<string, AnalysisJob>();


setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  Array.from(analysisJobs.entries()).forEach(([id, job]) => {
    if (job.createdAt < oneHourAgo) {
      analysisJobs.delete(id);
    }
  });
}, 5 * 60 * 1000);


/* ---------- TEXT EXTRACTION HELPERS ---------- */


async function extractTextFromPDF(filePath: string): Promise<string> {
  const fileData = fs.readFileSync(filePath);
  const data = new Uint8Array(fileData);

  try {
    const loadingTask = pdfjs.getDocument({ data });
    const pdf = await loadingTask.promise;
    console.log(`[PDF Extraction] PDF loaded. Pages: ${pdf.numPages}`);

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

    console.log(`[PDF Extraction] Total text length: ${text.length}`);
    return text;
  } catch (error: any) {
    console.log("[PDF Extraction] pdfjs error:", error.message?.substring(0, 150));
    console.log("[PDF Extraction] Trying pdf-parse fallback...");
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
  console.log(`[PDF Extraction] pdf-parse extracted ${result.text.length} chars from ${result.numpages} pages`);
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
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro-preview" });

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


/* ---------- ROUTES ---------- */


export async function registerRoutes(
  _httpServer: Server,
  app: Express
): Promise<Server> {
  console.log('[ROUTES] Starting route registration... (v3.0)');

  app.post(
    "/api/analyze",
    (req, res, next) => {
      upload.single("file")(req, res, (err: any) => {
        if (err) {
          console.error("MULTER ERROR:", err);
          return res.status(400).json({
            error: "File upload failed: " + (err.message || "Unknown error")
          });
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

      // ─── BACKGROUND PROCESSING ────────────────────────────────────────────
      (async () => {
        let globalTimeout: NodeJS.Timeout | undefined;

        try {
          globalTimeout = setTimeout(() => {
            if (job && job.status === "processing") {
              console.error(`[Job ${jobId}] GLOBAL TIMEOUT - Force failing job`);
              job.status = "failed";
              job.error = "Analysis timed out (global limit exceeded). Please try again.";
              job.completedAt = Date.now();
            }
          }, 6 * 60 * 1000);

          job!.status = "processing";
          console.log(`[Job ${jobId}] Starting background analysis...`);

          job!.extractionStartedAt = Date.now();
          const uploadedPolicyText = await extractPolicyText(uploadedFile!);
          job!.extractionEndedAt = Date.now();
          fs.unlinkSync(uploadedFile!.path);

          if (!uploadedPolicyText.trim()) {
            job!.status = "failed";
            job!.error = "No text extracted from file";
            job!.completedAt = Date.now();
            return;
          }

          console.log(`[Job ${jobId}] EXTRACTED TEXT LENGTH:`, uploadedPolicyText.length);

          // Step 1: Extract metadata
          console.log(`[Job ${jobId}] Extracting policy metadata...`);
          const { extractPolicyMetadata, fetchPolicyWordings, mergePolicyTexts } = await import("./utils/policyWordingsFetcher");
          const metadata = await extractPolicyMetadata(uploadedPolicyText);
          console.log(`[Job ${jobId}] Metadata extracted:`, metadata);

          // Step 2: Fetch official wordings if available
          let wordingsText: string | null = null;
          if (metadata.insurer && metadata.product) {
            console.log(`[Job ${jobId}] Fetching policy wordings for ${metadata.insurer} - ${metadata.product}...`);
            job!.fetchStartedAt = Date.now();
            wordingsText = await fetchPolicyWordings(
              metadata.insurer,
              metadata.product || "",
              metadata.plan || "",
              metadata.year || ""
            );
            job!.fetchEndedAt = Date.now();
            if (wordingsText) {
              console.log(`[Job ${jobId}] Policy wordings fetched, length:`, wordingsText.length);
            } else {
              console.log(`[Job ${jobId}] Policy wordings not found, proceeding with uploaded document only`);
            }
          } else {
            console.log(`[Job ${jobId}] Insufficient metadata to fetch wordings, proceeding with uploaded document only`);
          }

          // Step 3: Merge texts
          const policyText = mergePolicyTexts(uploadedPolicyText, wordingsText);
          console.log(`[Job ${jobId}] Merged text length:`, policyText.length);

          // Step 4: Select prompt
          let promptToUse = MASTER_AUDIT_PROMPT;
          if (insuranceType === "life") promptToUse = LIFE_INSURANCE_PROMPT;
          else if (insuranceType === "vehicle") promptToUse = VEHICLE_INSURANCE_PROMPT;

          // Step 5: Call AI — prompt is the SINGLE source of scoring truth
          console.log(`[Job ${jobId}] Calling AIService...`);
          let rawText: string;
          try {
            job!.aiStartedAt = Date.now();
            rawText = await AIService.generateContent(
              promptToUse,
              policyText,
              "gemini-3.1-pro-preview"
            );
            job!.aiEndedAt = Date.now();
          } catch (aiError: any) {
            console.error(`[Job ${jobId}] AI Service Error:`, aiError);
            throw aiError;
          }

          console.log(`[Job ${jobId}] AI Response received (length: ${rawText.length})`);

          // Step 6: Parse JSON
          const cleanedText = rawText.replace(/```json|```/g, "").trim();
          let parsed: any;
          try {
            parsed = JSON.parse(cleanedText);
          } catch {
            job!.status = "failed";
            job!.error = "Invalid AI response format";
            job!.completedAt = Date.now();
            return;
          }

          if (parsed.error && parsed.message) {
            job!.status = "failed";
            job!.error = parsed.message;
            job!.completedAt = Date.now();
            return;
          }

          // Step 7: Store result — no scoring override, no second engine
          // The prompt has already computed: NCAR, score, verdict, claim simulations
          job!.status = "completed";
          job!.result = {
            ...parsed,
            __internal: {
              policyText,
            },
          };
          job!.completedAt = Date.now();

          const durationMs = job!.completedAt - job!.createdAt;
          const extractionMs = (job!.extractionEndedAt || 0) - (job!.extractionStartedAt || 0);
          const fetchMs = (job!.fetchEndedAt || 0) - (job!.fetchStartedAt || 0);
          const aiMs = (job!.aiEndedAt || 0) - (job!.aiStartedAt || 0);
          const overheadMs = durationMs - extractionMs - fetchMs - aiMs;

          console.log(`[Timing] Job ${jobId} done in ${durationMs}ms | extract: ${extractionMs}ms | fetch: ${fetchMs}ms | ai: ${aiMs}ms | overhead: ${overheadMs}ms`);

          console.log(`[Job ${jobId}] Analysis completed successfully`);
          console.log("[DEBUG] full parsed:", JSON.stringify(parsed, null, 2));
          console.log(`  -> base_sum_insured:`, parsed?.coverage_structure?.base_sum_insured);
          console.log(`  -> total_effective_coverage:`, parsed?.coverage_structure?.total_effective_coverage);
          if (globalTimeout) clearTimeout(globalTimeout);

        } catch (err: any) {
          console.error(`[Job ${jobId}] Processing error:`, err);
          console.error("Error stack:", err.stack);

          if (uploadedFile && fs.existsSync(uploadedFile.path)) {
            try { fs.unlinkSync(uploadedFile.path); } catch { }
          }

          let errorMessage = err.message || "Unknown error";

          if (errorMessage.includes("404") || errorMessage.includes("not found")) {
            errorMessage = `Model 'gemini-3.1-pro-preview' not found or not available. Check your GEMINI_API_KEY and verify model availability.`;
          } else if (errorMessage.includes("fetch failed") || errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTFOUND")) {
            errorMessage = "Network error: Unable to connect to Gemini API. Please check your internet connection.";
          } else if (errorMessage.includes("API_KEY") || errorMessage.includes("401") || errorMessage.includes("403")) {
            errorMessage = "API authentication failed. Please check your GEMINI_API_KEY in .env.local.";
          } else if (errorMessage.includes("quota") || errorMessage.includes("429")) {
            errorMessage = "API quota exceeded. Please check your Gemini API usage limits.";
          }

          job!.status = "failed";
          job!.error = errorMessage;
          job!.completedAt = Date.now();
          if (globalTimeout) clearTimeout(globalTimeout);
        }
      })();
    }
  );


  // ─── Status endpoint ──────────────────────────────────────────────────────
  app.get("/api/analyze/status/:jobId", (req, res) => {
    const { jobId } = req.params;
    console.log(`[Status Check] Checking status for job: ${jobId}`);

    const job = analysisJobs.get(jobId);

    if (!job) {
      console.log(`[Status Check] Job not found: ${jobId}`);
      return res.status(404).json({
        status: "not_found",
        error: "Job not found. It may have expired or never existed."
      });
    }

    console.log(`[Status Check] Job ${jobId} status: ${job.status}`);

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
        breakdown: {
          extractionMs,
          fetchMs,
          aiMs,
          overheadMs
        },
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


  // ─── Policy extraction for comparison ────────────────────────────────────
  app.post(
    "/api/extract-policy",
    (req, res, next) => {
      upload.single("policy_pdf")(req, res, (err: any) => {
        if (err) {
          console.error("MULTER ERROR:", err);
          return res.status(400).json({
            error: "File upload failed: " + (err.message || "Unknown error")
          });
        }
        next();
      });
    },
    async (req, res) => {
      try {
        console.log("POLICY EXTRACTION - REQUEST RECEIVED");
        console.log("POLICY EXTRACTION - req.file:", req.file ? "EXISTS" : "MISSING");

        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        console.log("POLICY EXTRACTION - FILE RECEIVED:", req.file.originalname);

        let uploadedPolicyText: string;
        try {
          uploadedPolicyText = await extractPolicyText(req.file);
          console.log("POLICY EXTRACTION - Text extraction successful, length:", uploadedPolicyText.length);
        } catch (extractError: any) {
          console.error("POLICY EXTRACTION - Text extraction failed:", extractError);
          fs.unlinkSync(req.file.path);
          return res.status(500).json({
            error: "Failed to extract text from PDF: " + extractError.message
          });
        }

        const fileBuffer = fs.readFileSync(req.file.path);
        fs.unlinkSync(req.file.path);

        if (!uploadedPolicyText.trim()) {
          return res.status(400).json({
            error: "No text extracted from file. (Is this a scanned PDF? Try converting to searchable text PDF first)"
          });
        }

        console.log("POLICY EXTRACTION - TEXT LENGTH:", uploadedPolicyText.length);

        const { extractPolicyMetadata, fetchPolicyWordings, mergePolicyTexts } = await import("./utils/policyWordingsFetcher");
        const metadata = await extractPolicyMetadata(uploadedPolicyText);
        console.log("POLICY EXTRACTION - Metadata:", metadata);

        let wordingsText: string | null = null;
        if (metadata.insurer && metadata.product) {
          wordingsText = await fetchPolicyWordings(
            metadata.insurer,
            metadata.product || "",
            metadata.plan || "",
            metadata.year || ""
          );
          if (wordingsText) {
            console.log("POLICY EXTRACTION - Wordings fetched, length:", wordingsText.length);
          }
        }

        const policyText = mergePolicyTexts(uploadedPolicyText, wordingsText);
        console.log("POLICY EXTRACTION - Merged text length:", policyText.length);

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return res.status(500).json({ error: "GEMINI_API_KEY not set" });
        }

        const pageCount = (policyText.match(/\f/g) || []).length + 1;

        // ARCHIVED: const report: PolicyReport = await runExtractionPipeline({
        // ARCHIVED:   policyText,
        // ARCHIVED:   fileBuffer,
        // ARCHIVED:   pageCount,
        // ARCHIVED:   apiKey,
        // ARCHIVED: });

        // ARCHIVED: return res.json({
        // ARCHIVED:   policy_id: report.analysis_id,
        // ARCHIVED:   extracted_data: report,
        // ARCHIVED:   extraction_metadata: {
        // ARCHIVED:     confidence: report.data_quality.extraction_confidence_score,
        // ARCHIVED:     missing_fields: report.data_quality.missing_fields,
        // ARCHIVED:     needs_verification: report.data_quality.extraction_confidence_score < 0.5,
        // ARCHIVED:   },
        // ARCHIVED: });

        return res.status(501).json({ error: "Extraction pipeline archived." });

      } catch (err: any) {
        console.error("POLICY EXTRACTION ERROR:", err);

        let errorMessage = err.message || "Unknown error occurred";
        let statusCode = 500;

        if (errorMessage.includes("timeout")) {
          errorMessage = "Extraction timed out. The PDF may be too large or complex. Please try again.";
          statusCode = 408;
        } else if (errorMessage.includes("GEMINI_API_KEY")) {
          errorMessage = "API key not configured";
        } else if (errorMessage.includes("quota") || errorMessage.includes("429")) {
          errorMessage = "API quota exceeded. Please check your Gemini API usage limits.";
          statusCode = 429;
        }

        if (req.file && fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch { }
        }

        return res.status(statusCode).json({
          error: "Policy extraction failed: " + errorMessage,
          details: process.env.NODE_ENV === "development" ? err.stack : undefined
        });
      }
    }
  );


  // ─── Deterministic Policy Comparison ─────────────────────────────────────
  // ARCHIVED: app.post("/api/compare-policies", requireAuth, async (req, res) => {
  app.post("/api/compare-policies", async (req, res) => {
    try {
      const { policyA, policyB } = req.body as {
        policyA: any; // ARCHIVED: PolicyReport;
        policyB: any; // ARCHIVED: PolicyReport;
      };

      if (!policyA || !policyB) {
        return res.status(400).json({
          error: "Both policyA and policyB are required in request body",
        });
      }

      console.log("[Compare] Normalizing policies...");
      // ARCHIVED: const normA = normalizePolicyForComparison(policyA);
      // ARCHIVED: const normB = normalizePolicyForComparison(policyB);

      console.log("[Compare] Running deterministic comparison...");
      // ARCHIVED: const result = comparePolicies(normA, normB, policyA, policyB);

      // ARCHIVED: console.log(`[Compare] ✓ Result: large=${result.better_for_large_claims}, small=${result.better_for_small_claims}`);

      return res.json({ archived: true });
    } catch (err: any) {
      console.error("[Compare] Error:", err);
      return res.status(500).json({
        error: "Comparison failed: " + (err.message || "Unknown error"),
      });
    }
  });


  // ─── Hospital Network Filter ──────────────────────────────────────────────
  app.get("/api/hospitals/filter", async (req, res) => {
    try {
      const { state, city, pincode } = req.query;

      // ARCHIVED: const result = filterHospitalNetwork({
      // ARCHIVED:   state: state as string | undefined,
      // ARCHIVED:   city: city as string | undefined,
      // ARCHIVED:   pincode: pincode as string | undefined,
      // ARCHIVED: });

      res.json({ archived: true });
    } catch (error: any) {
      console.error('[Hospital Filter] Error:', error);
      res.status(500).json({
        error: "Failed to filter hospital network data",
        details: error.message,
      });
    }
  });


  // ─── PDF Generation ───────────────────────────────────────────────────────
  console.log('[ROUTES] Registering PDF generation endpoints...');

  app.get("/api/generate-pdf/test", (req, res) => {
    console.log('[PDF] Test endpoint hit');
    res.json({ status: "PDF endpoint is registered and working" });
  });

  app.post("/api/generate-pdf", async (req, res) => {
    console.log('[PDF] POST /api/generate-pdf endpoint hit');
    try {
      let { url } = req.body;

      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        const protocol = req.protocol;
        const host = req.get('host');
        url = `${protocol}://${host}${url}`;
      }

      console.log('[PDF] Generating PDF from URL:', url);

      const { chromium } = await import("playwright");

      let browser;
      try {
        browser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewportSize({ width: 1200, height: 1600 });

        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
          preferCSSPageSize: false,
          scale: 0.8,
          displayHeaderFooter: false
        });

        await browser.close();
        browser = null;

        console.log('[PDF] PDF generated successfully, size:', pdfBuffer.length, 'bytes');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="ensured-report.pdf"`);
        res.send(pdfBuffer);
      } catch (browserError: any) {
        if (browser) await browser.close().catch(() => { });
        throw browserError;
      }

    } catch (error: any) {
      console.error('[PDF] PDF generation error:', error);
      res.status(500).json({
        error: error.message || "PDF generation failed",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      });
    }
  });


  console.log('[ROUTES] All routes registered successfully');
  return _httpServer;
}
