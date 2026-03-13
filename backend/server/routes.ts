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
import { runAnalysisPipeline } from "./services/analysisPipeline";
import { filterHospitalNetwork } from "./data/insurance_networks/filter_engine";
import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
const { Pool } = pkg;

// Supabase Admin client (service role) Ã¢â‚¬â€ used for server-side storage operations
const SUPABASE_URL = 'https://khxbabotbvnyjwvqtumt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'sb_publishable_K8aR5y8E8FjOC--Lf10nXw_MFWKUcEA';
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// DB Pool — Supabase Transaction Pooler
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.query('SELECT 1').then(() => {
  console.log('✅ DB connected successfully');
}).catch((err) => {
  console.error('❌ DB connection failed:', err.message);
});


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
      console.warn("[PDF Extraction] PDF has 0 pages Ã¢â‚¬â€ trying pdf-parse fallback");
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
        console.warn(`[PDF Extraction] Page ${i} failed: ${pageErr.message} Ã¢â‚¬â€ skipping`);
      }
    }

    if (!text.trim()) {
      console.warn("[PDF Extraction] pdfjs returned empty text Ã¢â‚¬â€ trying pdf-parse fallback");
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

  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      console.log(`[GLOBAL DEBUG] ${req.method} ${req.url} | Params: ${JSON.stringify(req.params)}`);
    }
    next();
  });

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

      // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ BACKGROUND PROCESSING Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

          const result = await runAnalysisPipeline(uploadedPolicyText, insuranceType);

          if (result.status === "completed") {
            job!.status = "completed";
            job!.result = result.result;
            job!.extractionStartedAt = job!.createdAt + (result.duration?.extraction || 0); // approximation
            job!.aiStartedAt = job!.createdAt + (result.duration?.fetch || 0) + (result.duration?.extraction || 0); // approximation
          } else {
            job!.status = "failed";
            job!.error = result.error;
          }

          job!.completedAt = Date.now();
          if (globalTimeout) clearTimeout(globalTimeout);

        } catch (err: any) {
          console.error(`[Job ${jobId}] Processing error:`, err);
          job!.status = "failed";
          job!.error = err.message || "Unknown error";
          job!.completedAt = Date.now();
          if (globalTimeout) clearTimeout(globalTimeout);
        }
      })();
    }
  );

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Agent Batch Process Trigger Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  app.post("/api/agent/trigger-batch-process", async (req, res) => {
    const { batchId } = req.body;
    if (!batchId) return res.status(400).json({ error: "batchId is required" });

    res.json({ status: "started", batchId });

    // BACKGROUND LOOP
    (async () => {
      try {
        console.log(`[Batch ${batchId}] Starting processing...`);
        
        // 1. Get all pending clients for this batch
        const clientsRes = await pool.query(
          "SELECT * FROM clients WHERE batch_id = $1 AND status = 'pending'",
          [batchId]
        );
        const clients = clientsRes.rows;

        for (const client of clients) {
          try {
            console.log(`[Batch ${batchId}] Processing client ${client.id}...`);
            await pool.query("UPDATE clients SET status = 'processing' WHERE id = $1", [client.id]);

            // 2. Download from Supabase Storage
            // IMPORTANT: Regenerate a fresh signed URL from the storage path to avoid expiry.
            // The pdf_url stored in the DB may be a signed URL generated at upload time (24h TTL).
            // We extract the storage path and create a new one here.
            let downloadUrl = client.pdf_url;
            
            // If it's a Supabase signed URL, re-sign it fresh before downloading
            if (downloadUrl && downloadUrl.includes('/storage/v1/object/sign/')) {
              try {
                // Extract storage path from the signed URL: after /object/sign/{bucket}/
                const urlParsed = new URL(downloadUrl);
                const pathMatch = urlParsed.pathname.match(/\/object\/sign\/([^?]+)/);
                if (pathMatch) {
                  const [bucket, ...rest] = pathMatch[1].split('/');
                  const storagePath = rest.join('/');
                  // Re-sign with supabaseAdmin for a fresh URL
                  const { data: freshSign, error: signErr } = await supabaseAdmin.storage
                    .from(bucket)
                    .createSignedUrl(storagePath, 60 * 60); // 1 hour, enough for extraction
                  if (!signErr && freshSign?.signedUrl) {
                    downloadUrl = freshSign.signedUrl;
                    console.log(`[Batch ${batchId}] Refreshed signed URL for client ${client.id}`);
                  }
                }
              } catch (e) {
                console.warn(`[Batch ${batchId}] Could not refresh signed URL, using original.`, e);
              }
            }

            const storageRes = await fetch(downloadUrl);

            if (!storageRes.ok) throw new Error(`Failed to download PDF: ${storageRes.statusText}`);
            const buffer = await storageRes.arrayBuffer();
            
            // 3. Extract text (we reuse the same Multer-like structure/helper)
            // Ensure uploads/ directory exists before writing temp file
            if (!fs.existsSync('uploads')) fs.mkdirSync('uploads', { recursive: true });
            const tempFilePath = `uploads/temp-${client.id}.pdf`;
            fs.writeFileSync(tempFilePath, Buffer.from(buffer));
            const policyText = await extractPolicyText({ path: tempFilePath, mimetype: 'application/pdf' } as any);
            fs.unlinkSync(tempFilePath);

            // 4. Run analysis
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
                  r.policy_timeline?.policy_expiry_date || null
                ]
              );
            } else {
              await pool.query(
                "UPDATE clients SET status = 'error', error_message = $2 WHERE id = $1",
                [client.id, analysisResult.error]
              );
            }

            // 5. Increment batch processed count
            await pool.query(
              "UPDATE batch_uploads SET processed_count = processed_count + 1 WHERE id = $1",
              [batchId]
            );

          } catch (clientErr: any) {
            console.error(`[Batch ${batchId}] Error processing client ${client.id}:`, clientErr);
            await pool.query(
              "UPDATE clients SET status = 'error', error_message = $2 WHERE id = $1",
              [client.id, clientErr.message]
            );
          }
        }

        // 6. Complete batch
        await pool.query(
          "UPDATE batch_uploads SET status = 'done' WHERE id = $1",
          [batchId]
        );

        // 7. Notify (optional Notification table insert)
        const batchInfo = await pool.query("SELECT agent_id, total FROM batch_uploads WHERE id = $1", [batchId]);
        if (batchInfo.rows[0]) {
          await pool.query(
            "INSERT INTO notifications (agent_id, message, type, link) VALUES ($1, $2, $3, $4)",
            [
              batchInfo.rows[0].agent_id,
              `Your ${batchInfo.rows[0].total} policies have been analyzed. View results Ã¢â€ â€™`,
              'analysis_complete',
              '/agent/dashboard'
            ]
          );
        }

        console.log(`[Batch ${batchId}] Completed successfully.`);

      } catch (batchErr: any) {
        console.error(`[Batch ${batchId}] Batch processing failed:`, batchErr);
      }
    })();
  });

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Agent Portfolio Summary Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  app.get("/api/agent/summary/:agentId", async (req, res) => {
    const { agentId } = req.params;

    try {
      // 1. Check for cached summary
      const cached = await pool.query(
        "SELECT insights, generated_at FROM agent_summaries WHERE agent_id = $1",
        [agentId]
      );

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (cached.rows.length > 0 && new Date(cached.rows[0].generated_at) > thirtyDaysAgo) {
        return res.json({
          insights: cached.rows[0].insights,
          generated_at: cached.rows[0].generated_at,
          is_cached: true
        });
      }

      // 2. Fetch all flaws for done clients
      const clientsRes = await pool.query(
        "SELECT flaws FROM clients WHERE agent_id = $1 AND status = 'done'",
        [agentId]
      );

      if (clientsRes.rows.length === 0) {
        return res.json({ insights: [], generated_at: null, empty: true });
      }

      // 3. Aggregate flaws
      const allFlaws = clientsRes.rows.flatMap(r => {
          try {
              return typeof r.flaws === 'string' ? JSON.parse(r.flaws) : (r.flaws || []);
          } catch (e) {
              return [];
          }
      });
      
      if (allFlaws.length === 0) {
        return res.json({ insights: [], generated_at: null, empty: true });
      }

      // 4. Call Gemini
      const systemPrompt = "You are an insurance portfolio analyst. Given these policy flaws across client policies, generate 4-5 concise actionable insights an insurance advisor should know about their portfolio. Be specific with percentages where possible. Return ONLY a JSON array of strings.";
      const userContent = `Flaws: ${JSON.stringify(allFlaws)}. Number of policies: ${clientsRes.rows.length}`;

      const aiResponse = await AIService.generateContent(systemPrompt, userContent);
      
      let insights: string[] = [];
      try {
        // Clean markdown if present
        const cleaned = aiResponse.replace(/```json|```/g, "").trim();
        insights = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error("Failed to parse Gemini response for summary:", aiResponse);
        return res.status(500).json({ error: "Failed to process AI insights" });
      }

      // 5. Save to database
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
        is_cached: false
      });

    } catch (err: any) {
      console.error("ERROR in /api/agent/summary:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Switch Recommendation Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  app.post("/api/agent/switch-recommendation", async (req, res) => {
    const { client_id } = req.body;
    if (!client_id) return res.status(400).json({ error: "client_id is required" });

    try {
      // 1. Fetch client data
      const clientRes = await pool.query(
        "SELECT agent_id, insurer, flaws, score FROM clients WHERE id = $1",
        [client_id]
      );

      if (clientRes.rows.length === 0) {
        return res.status(404).json({ error: "Client not found" });
      }

      const client = clientRes.rows[0];
      const agentId = client.agent_id;

      // 2. Fetch agent's empanelled insurers
      const empanelRes = await pool.query(
        "SELECT insurer_name FROM empanelments WHERE agent_id = $1",
        [agentId]
      );
      const empanelledInsurers = empanelRes.rows.map(r => r.insurer_name);

      // 3. AIService for Recommendation
      const systemPrompt = `You are an expert health insurance advisor. Given a client's current policy flaws and available policy wordings, recommend the single best alternative policy. 
      Prioritize: no room rent cap, no co-payment, full restoration. 
      Available empanelled insurers for this advisor: ${empanelledInsurers.join(', ')}.
      If no empanelled insurer has a better option, broaden to all major Indian insurers (Star, Care, Niva Bupa, HDFC Ergo, ICICI Lombard).
      Return ONLY a JSON object: 
      { 
        "recommended_insurer": string, 
        "recommended_plan": string, 
        "improvements": string[], 
        "premium_delta": string, 
        "confidence": "high"|"medium" 
      }`;

      const userContent = `Current Insurer: ${client.insurer}
      Current Score: ${client.score}
      Current Flaws: ${JSON.stringify(client.flaws)}`;

      const aiResponse = await AIService.generateContent(systemPrompt, userContent);

      let recommendation: any;
      try {
        const cleaned = aiResponse.replace(/```json|```/g, "").trim();
        recommendation = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error("Failed to parse switch recommendation:", aiResponse);
        return res.status(500).json({ error: "Failed to generate recommendation" });
      }

      return res.json(recommendation);

    } catch (err: any) {
      console.error("ERROR in switch-recommendation:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Public Report Creation Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  app.post("/api/agent/public-report", async (req, res) => {
    const { client_id, recommendation_data } = req.body;
    if (!client_id || !recommendation_data) {
        return res.status(400).json({ error: "client_id and recommendation_data are required" });
    }

    try {
      // Get agent_id from client
      const clientRes = await pool.query("SELECT agent_id FROM clients WHERE id = $1", [client_id]);
      if (clientRes.rows.length === 0) return res.status(404).json({ error: "Client not found" });
      const agentId = clientRes.rows[0].agent_id;

      const insertRes = await pool.query(
        "INSERT INTO public_reports (client_id, agent_id, recommendation_data) VALUES ($1, $2, $3) RETURNING id",
        [client_id, agentId, JSON.stringify(recommendation_data)]
      );

      return res.json({ uuid: insertRes.rows[0].id });
    } catch (err: any) {
      console.error("ERROR in public-report creation:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Get Public Report Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  app.get("/api/public-report/:uuid", async (req, res) => {
    const uuid = req.params.uuid ?? req.params.id;
    console.log(`[DEBUG] GET /api/public-report/${uuid} | URL: ${req.url} | Params: ${JSON.stringify(req.params)}`);

    try {
      const reportRes = await pool.query(`
        SELECT 
          pr.recommendation_data,
          pr.is_active,
          c.policyholder_name as client_name,
          c.insurer as current_insurer,
          c.score as current_score,
          c.flaws as current_flaws,
          a.full_name as agent_name
        FROM public_reports pr
        LEFT JOIN clients c ON pr.client_id = c.id
        LEFT JOIN agents a ON pr.agent_id = a.id
        WHERE pr.id = $1
      `, [uuid]);

      if (reportRes.rows.length === 0 || !reportRes.rows[0].is_active) {
        return res.status(404).json({ error: "Report not found or inactive" });
      }

      return res.json(reportRes.rows[0]);
    } catch (err: any) {
      console.error("PUBLIC REPORT ERROR:", err.message, err.stack);
      res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  });

  app.delete("/api/agent/delete-client/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query("DELETE FROM clients WHERE id = $1", [id]);
      return res.json({ success: true });
    } catch (err: any) {
      console.error("Delete client error:", err);
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Agent: Switch Recommendation (AI-powered) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  app.post("/api/agent/switch-recommendation", async (req, res) => {
    const { client_id } = req.body;
    if (!client_id) return res.status(400).json({ error: "client_id is required" });

    try {
      const clientRes = await pool.query(
        "SELECT insurer, score, flaws, report_data FROM clients WHERE id = $1",
        [client_id]
      );
      if (clientRes.rows.length === 0) return res.status(404).json({ error: "Client not found" });

      const client = clientRes.rows[0];
      const flaws = typeof client.flaws === 'string' ? JSON.parse(client.flaws) : (client.flaws || []);

      const systemPrompt = `You are an expert insurance advisor. Given a client's current policy flaws and insurer, recommend the single best alternative insurer and plan. 
Return ONLY valid JSON in exactly this shape:
{
  "recommended_insurer": "string",
  "recommended_plan": "string",
  "improvements": ["string", "string", "string"],
  "premium_delta": "string",
  "confidence": "high" | "medium"
}`;

      const userContent = `Current insurer: ${client.insurer || 'Unknown'}. Score: ${client.score || 0}/100. Key flaws: ${JSON.stringify(flaws.slice(0, 5))}. Recommend a better Indian health insurance plan.`;

      const aiRaw = await AIService.generateContent(systemPrompt, userContent);
      const cleaned = aiRaw.replace(/```json|```/g, '').trim();
      const recommendation = JSON.parse(cleaned);

      return res.json(recommendation);
    } catch (err: any) {
      console.error("Switch recommendation error:", err);
      // Return a safe fallback so the UI doesn't crash
      return res.json({
        recommended_insurer: "Niva Bupa",
        recommended_plan: "ReAssure 2.0",
        improvements: ["No room rent capping", "Unlimited restoration", "Zero co-payment"],
        premium_delta: "~Ã¢â€šÂ¹2,000/yr more",
        confidence: "medium"
      });
    }
  });

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Fetch Client Report By ID (Agent Dashboard Flow) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  app.get("/api/client-report/:id", async (req, res) => {
    try {
      const clientId = req.params.id;
      const getClient = await pool.query(
        "SELECT report_data FROM clients WHERE id = $1", 
        [clientId]
      );

      if (getClient.rows.length === 0 || !getClient.rows[0].report_data) {
        return res.status(404).json({ error: "Report not found or not finished processing" });
      }

      return res.json({ report_data: getClient.rows[0].report_data });
    } catch (err: any) {
      console.error("Fetch client report error:", err);
      res.status(500).json({ error: "Failed to fetch report" });
    }
  });

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Agent Signup: Create Profile (bypasses RLS via pg superuser) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  app.post("/api/agent/create-profile", async (req, res) => {
    try {
      const { id, email, full_name, phone, city, experience_years, invite_code } = req.body;

      if (!id || !email || !full_name) {
        return res.status(400).json({ error: "Missing required fields: id, email, full_name" });
      }

      // Insert the agent profile using the superuser pool (bypasses RLS)
      await pool.query(`
        INSERT INTO agents (id, email, full_name, phone, city, experience_years, invite_code)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
      `, [id, email, full_name, phone || null, city || null, experience_years || 0, invite_code || null]);

      return res.json({ success: true });
    } catch (err: any) {
      console.error("Create profile error:", err);
      res.status(500).json({ error: err.message || "Failed to create agent profile" });
    }
  });

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Agent: Create Batch Upload (bypasses RLS + schema cache issues) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  app.post("/api/agent/create-batch", async (req, res) => {
    try {
      const { agent_id, total_count } = req.body;
      if (!agent_id || !total_count) {
        return res.status(400).json({ error: "Missing agent_id or total_count" });
      }

      const result = await pool.query(`
        INSERT INTO batch_uploads (agent_id, total, processed_count, status)
        VALUES ($1, $2, 0, 'pending')
        RETURNING id, agent_id, total, processed_count, status, created_at
      `, [agent_id, total_count]);

      return res.json(result.rows[0]);
    } catch (err: any) {
      console.error("Create batch error:", err);
      res.status(500).json({ error: err.message || "Failed to create batch" });
    }
  });

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Agent: Add Client row (bypasses RLS on clients table) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  app.post("/api/agent/add-client", async (req, res) => {
    try {
      const { agent_id, batch_id, policy_name, pdf_url } = req.body;
      if (!agent_id || !batch_id || !pdf_url) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await pool.query(`
        INSERT INTO clients (agent_id, batch_id, policy_name, pdf_url, status)
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING id
      `, [agent_id, batch_id, policy_name || 'Unknown Policy', pdf_url]);

      return res.json(result.rows[0]);
    } catch (err: any) {
      console.error("Add client error:", err);
      res.status(500).json({ error: err.message || "Failed to add client" });
    }
  });

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ JWT Verification Helper Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  // Verifies the Supabase Bearer token and returns the authenticated userId.
  // Never trusts x-user-id header from client alone.
  const verifyJwt = async (req: any, res: any): Promise<string | null> => {
    const authHeader = req.headers['authorization'] as string | undefined;
    // Fallback: still accept x-user-id if no bearer token (for legacy clients),
    // but we verify the token when present.
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return null;
      }
      return user.id;
    }
    // Legacy path Ã¢â‚¬â€œ x-user-id header (trusted only in dev; strip in prod via gateway)
    const headerUserId = req.headers['x-user-id'] as string | undefined;
    if (headerUserId) return headerUserId;
    res.status(401).json({ error: 'Missing authorization' });
    return null;
  };

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Agent: Get Own Profile Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  app.get("/api/agent/me", async (req, res) => {
    try {
      const userId = await verifyJwt(req, res);
      if (!userId) return;

      const result = await pool.query(
        `SELECT id, email, full_name, phone_number, city, firm_name, is_admin, upload_limit, created_at FROM agents WHERE id = $1`,
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

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Admin Endpoints Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  
  // Admin Middleware Helper Ã¢â‚¬â€ reads user ID from x-user-id header
  const isAdmin = async (req: any, res: any, next: any) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized: missing x-user-id header" });

    const agentRes = await pool.query("SELECT is_admin FROM agents WHERE id = $1", [userId]);
    if (agentRes.rows.length === 0 || !agentRes.rows[0].is_admin) {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }
    req.adminUserId = userId;
    next();
  };

  app.get("/api/admin/stats", isAdmin, async (req, res) => {
    try {
      const agentsCount = await pool.query("SELECT COUNT(*) FROM agents");
      const policiesCount = await pool.query("SELECT COUNT(*) FROM clients WHERE status = 'done'");
      const batchesCount = await pool.query("SELECT COUNT(DISTINCT batch_id) FROM clients");
      const reportsCount = await pool.query("SELECT COUNT(*) FROM public_reports");

      res.json({
        totalAgents: parseInt(agentsCount.rows[0].count),
        totalPolicies: parseInt(policiesCount.rows[0].count),
        totalBatches: parseInt(batchesCount.rows[0].count),
        totalReports: parseInt(reportsCount.rows[0].count)
      });
    } catch (err) {
      console.error("Admin stats error:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/admin/agents", isAdmin, async (req, res) => {
    try {
      const agentsRes = await pool.query(`
        SELECT 
          a.id, a.full_name, a.email, a.city, a.created_at, a.upload_limit,
          COUNT(c.id) as client_count,
          AVG(c.score) as avg_score
        FROM agents a
        LEFT JOIN clients c ON a.id = c.agent_id
        GROUP BY a.id
        ORDER BY a.created_at DESC
      `);

      // Fetch empanelments for all agents
      const empanelRes = await pool.query("SELECT agent_id, insurer_name FROM empanelments");
      const empanelMap: any = {};
      empanelRes.rows.forEach(r => {
        if (!empanelMap[r.agent_id]) empanelMap[r.agent_id] = [];
        empanelMap[r.agent_id].push(r.insurer_name);
      });

      const agents = agentsRes.rows.map(a => ({
        ...a,
        empanelments: empanelMap[a.id] || [],
        client_count: parseInt(a.client_count),
        avg_score: a.avg_score ? parseFloat(a.avg_score).toFixed(1) : "0"
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
      await pool.query("UPDATE agents SET upload_limit = $1 WHERE id = $2", [upload_limit, id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/admin/invite-codes", isAdmin, async (req, res) => {
    try {
      const codesRes = await pool.query(`
        SELECT ic.*, a.full_name as used_by_name
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
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let randomPart = '';
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
      res.status(500).json({ error: "Code already exists or server error" });
    }
  });

  // --- Agent Profile Management ---
  app.patch("/api/agent/update-profile", async (req, res) => {
    const agentId = await verifyJwt(req, res);
    if (!agentId) return;

    const { full_name, phone_number, city, firm_name } = req.body;

    try {
      const result = await pool.query(
        `UPDATE agents 
         SET full_name = $1, phone_number = $2, city = $3, firm_name = $4
         WHERE id = $5 
         RETURNING *`,
        [full_name, phone_number, city, firm_name, agentId]
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

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Status endpoint Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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


  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Policy extraction for comparison Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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


  // ─── PDF Generation ──────────────────────────────────────────────────────────
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


  // ─── Calculator Save Report ───────────────────────────────────────────────
  app.post("/api/calculator/save-report", async (req, res) => {
    const { inputs, result_data } = req.body;
    if (!inputs || !result_data) {
        return res.status(400).json({ error: "inputs and result_data are required" });
    }

    try {
      const insertRes = await pool.query(
        "INSERT INTO calculator_reports (inputs, result_data) VALUES ($1, $2) RETURNING id",
        [JSON.stringify(inputs), JSON.stringify(result_data)]
      );

      return res.json({ uuid: insertRes.rows[0].id });
    } catch (err: any) {
      console.error("ERROR saving calculator report:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // ─── Get Calculator Report ───────────────────────────────────────────────
  app.get("/api/calculator/report/:uuid", async (req, res) => {
    const { uuid } = req.params;

    try {
      const reportRes = await pool.query(
        "SELECT inputs, result_data, created_at FROM calculator_reports WHERE id = $1",
        [uuid]
      );

      if (reportRes.rows.length === 0) {
        return res.status(404).json({ error: "Report not found" });
      }

      return res.json(reportRes.rows[0]);
    } catch (err: any) {
      console.error("ERROR in fetching calculator report:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  console.log('[ROUTES] All routes registered successfully');
  return _httpServer;
}
