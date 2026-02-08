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
import { transformRawExtraction } from "./utils/policyTransformer";
import type { RawPolicyExtraction } from "./types/policy";
import { AIService } from "./services/aiService";


const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
});

// Background job tracking
interface AnalysisJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  result?: any;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export const analysisJobs = new Map<string, AnalysisJob>();

// Clean up old jobs (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  Array.from(analysisJobs.entries()).forEach(([id, job]) => {
    if (job.createdAt < oneHourAgo) {
      analysisJobs.delete(id);
    }
  });
}, 5 * 60 * 1000); // Run every 5 minutes

/* ---------- TEXT EXTRACTION HELPERS ---------- */

async function extractTextFromPDF(filePath: string): Promise<string> {
  const data = new Uint8Array(fs.readFileSync(filePath));

  try {
    const loadingTask = pdfjs.getDocument({
      data,
    });

    const pdf = await loadingTask.promise;

    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it: any) => it.str).join(" ") + "\n";
    }

    return text;
  } catch (error: any) {
    // Log error for debugging
    console.log("[PDF Extraction] Error:", error.message?.substring(0, 100));
    throw error;
  }
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
  // UPDATED: Reverted to gemini-3-pro-preview as requested
  const model = genAI.getGenerativeModel({
    model: "gemini-3-pro-preview",
  });

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

async function extractPolicyText(
  file: Express.Multer.File
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  if (file.mimetype.includes("pdf")) {
    return extractTextFromPDF(file.path);
  }

  if (file.mimetype.startsWith("image/")) {
    return extractTextFromImage(file, apiKey);
  }

  if (file.mimetype === "text/plain") {
    return extractTextFromPlain(file.path);
  }

  throw new Error(`Unsupported file type: ${file.mimetype}`);
}

/* ---------- ROUTES ---------- */

export async function registerRoutes(
  _httpServer: Server,
  app: Express
): Promise<Server> {
  console.log('[ROUTES] Starting route registration... (v2.1)');

  // Handle multer errors
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
        // Find the file field and assign to req.file for compatibility
        const files = (req as any).files || [];
        const fileField = files.find((f: any) => f.fieldname === "file");
        if (fileField) {
          req.file = fileField;
        }
        next();
      });
    },
    async (req, res) => {
      // 🔧 FIX: Declare these OUTSIDE the try block so they're accessible in the async IIFE
      let job: AnalysisJob | undefined;
      let jobId: string | undefined;
      let insuranceType: string | undefined;
      let uploadedFile: Express.Multer.File | undefined;

      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        // Store file reference for background processing
        uploadedFile = req.file;

        // Get type from request body if provided
        insuranceType = req.body.type || "health"; // Default to health for backward compatibility

        // Create job ID
        jobId = `job-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Create job entry
        job = {
          id: jobId,
          status: "pending",
          createdAt: Date.now(),
        };
        analysisJobs.set(jobId, job);

        // Return job ID immediately
        res.json({ jobId, status: "pending" });
      } catch (err: any) {
        console.error("Job creation error:", err);
        return res.status(500).json({ error: "Failed to create analysis job" });
      }

      // 🔧 FIX: Check that job was created successfully before processing
      if (!job || !jobId || !uploadedFile) {
        console.error("Job creation failed - missing required data");
        return;
      }

      // Process in background (don't await)
      (async () => {
        // Declare timeout variable outside try/catch for access in both
        let globalTimeout: NodeJS.Timeout | undefined;

        try {
          // GLOBAL SAFETY TIMEOUT: Ensure the entire process doesn't run longer than 6 minutes
          // The Gemini call has its own 5-minute timeout, but we want to catch other hangs too
          globalTimeout = setTimeout(() => {
            if (job && job.status === "processing") {
              console.error(`[Job ${jobId}] GLOBAL TIMEOUT - Force failing job`);
              job.status = "failed";
              job.error = "Analysis timed out (global limit exceeded). Please try again.";
              job.completedAt = Date.now();
            }
          }, 6 * 60 * 1000); // 6 minutes

          job!.status = "processing";
          console.log(`[Job ${jobId}] Starting background analysis...`);

          const uploadedPolicyText = await extractPolicyText(uploadedFile!);
          fs.unlinkSync(uploadedFile!.path);

          if (!uploadedPolicyText.trim()) {
            job!.status = "failed";
            job!.error = "No text extracted from file";
            job!.completedAt = Date.now();
            return;
          }

          console.log(`[Job ${jobId}] EXTRACTED TEXT LENGTH:`, uploadedPolicyText.length);

          // Step 1: Extract policy metadata (insurer, product, plan, year)
          console.log(`[Job ${jobId}] Extracting policy metadata...`);
          const { extractPolicyMetadata, fetchPolicyWordings, mergePolicyTexts } = await import("./utils/policyWordingsFetcher");
          const metadata = await extractPolicyMetadata(uploadedPolicyText);
          console.log(`[Job ${jobId}] Metadata extracted:`, metadata);

          // Step 2: Fetch official policy wordings if metadata available
          let wordingsText: string | null = null;
          if (metadata.insurer && metadata.product) {
            console.log(`[Job ${jobId}] Fetching policy wordings for ${metadata.insurer} - ${metadata.product}...`);
            wordingsText = await fetchPolicyWordings(
              metadata.insurer,
              metadata.product || "",
              metadata.plan || "",
              metadata.year || ""
            );
            if (wordingsText) {
              console.log(`[Job ${jobId}] Policy wordings fetched, length:`, wordingsText.length);
            } else {
              console.log(`[Job ${jobId}] Policy wordings not found, proceeding with uploaded document only`);
            }
          } else {
            console.log(`[Job ${jobId}] Insufficient metadata to fetch wordings, proceeding with uploaded document only`);
          }

          // Step 3: Merge uploaded text with wordings
          const policyText = mergePolicyTexts(uploadedPolicyText, wordingsText);
          console.log(`[Job ${jobId}] Merged text length:`, policyText.length);

          // Select prompt based on insurance type
          let promptToUse = MASTER_AUDIT_PROMPT; // Default to health insurance

          if (insuranceType === "life") {
            promptToUse = LIFE_INSURANCE_PROMPT;
          } else if (insuranceType === "vehicle") {
            promptToUse = VEHICLE_INSURANCE_PROMPT;
          }

          // REFACTORED: Use AIService for Guarded/Replay execution
          console.log(`[Job ${jobId}] Calling AIService...`);

          let rawText: string;
          try {
            // Using mergePolicyTexts result (policyText) which contains wordings + user evidence
            // And passing the prompt separately
            rawText = await AIService.generateContent(
              promptToUse,
              policyText,
              "gemini-3-pro-preview"
            );
          } catch (aiError: any) {
            console.error(`[Job ${jobId}] AI Service Error:`, aiError);
            throw aiError; // Handled by outer catch
          }

          console.log(`[Job ${jobId}] AI Response received (length: ${rawText.length})`);

          const cleanedText = rawText.replace(/```json|```/g, "").trim();
          let parsed;
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

          // Legacy logic removed. We rely on the Prompt ("Sach AI" Persona) to generate the correct schema and verdict.

          // 🔍 STRUCTURAL SUITABILITY CHECK
          const { SuitabilityEngine } = await import("./utils/suitabilityEngine");

          // Heuristic Profile Extraction (Refine later)
          const userProfile = {
            age: parsed.identity?.ages?.[0] ? parseInt(parsed.identity.ages[0]) : 35,
            cityTier: parsed.identity?.assumed_zone === 'A' ? 'Tier 1' : 'Tier 2' as any,
            hasPED: parsed.identity?.health_flags?.length > 0
          };

          const suitability = SuitabilityEngine.evaluate(
            parsed.coverage_structure?.base_sum_insured || 500000,
            userProfile,
            parsed.claim_risk_analysis
          );

          // ⚠️ HARD OVERRIDE
          if (suitability.structural_verdict === 'RISKY') {
            console.log(`[Job ${jobId}] STRUCTURAL FAILURE: BCAR ${suitability.bcar_ratio}. Forcing RISKY.`);
            parsed.final_verdict.label = 'RISKY';
            parsed.final_verdict.summary = `STRUCTURAL FAILURE (BCAR < 0.4). ${parsed.final_verdict.summary}`;
            if (parsed.audit_ledger?.final_score > 50) {
              parsed.audit_ledger.final_score = 50; // Cap score
            }
          }

          // Store result (ADD policyText for Sach AI)
          job!.status = "completed";
          job!.result = {
            ...parsed,
            suitability_analysis: suitability, // Inject analysis
            __internal: {
              policyText, // merged + authoritative policy text
            },
          };
          job!.completedAt = Date.now();
          console.log(`[Job ${jobId}] Analysis completed successfully`);
          if (globalTimeout) clearTimeout(globalTimeout);

        } catch (err: any) {
          console.error(`[Job ${jobId}] Processing error:`, err);
          console.error("Error stack:", err.stack);

          // Clean up uploaded file if it exists
          if (uploadedFile && fs.existsSync(uploadedFile.path)) {
            try {
              fs.unlinkSync(uploadedFile.path);
            } catch (unlinkErr) {
              console.error("Failed to delete uploaded file:", unlinkErr);
            }
          }

          // Provide more helpful error messages
          let errorMessage = err.message || "Unknown error";

          if (errorMessage.includes("404") || errorMessage.includes("not found")) {
            errorMessage = `Model 'gemini-3-pro-preview' not found or not available. This could mean: 1) The model name is incorrect, 2) Your API key doesn't have access to this model, 3) The model is not available in your region. Please check your GEMINI_API_KEY and verify model availability.`;
          } else if (errorMessage.includes("fetch failed") || errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTFOUND")) {
            errorMessage = "Network error: Unable to connect to Gemini API. Please check your internet connection and try again.";
          } else if (errorMessage.includes("API_KEY") || errorMessage.includes("401") || errorMessage.includes("403")) {
            errorMessage = "API authentication failed. Please check your GEMINI_API_KEY in the .env.local file.";
          } else if (errorMessage.includes("quota") || errorMessage.includes("429")) {
            errorMessage = "API quota exceeded. Please check your Gemini API usage limits.";
          }

          job!.status = "failed";
          job!.error = errorMessage;
          job!.completedAt = Date.now();
          if (globalTimeout) clearTimeout(globalTimeout);
        }
      })(); // Execute the async IIFE
    }
  );

  // Status endpoint for background jobs
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

    res.json({
      id: job.id,
      status: job.status,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    });
  });

  // Policy extraction endpoint for comparison feature (client sends field "policy_pdf")
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
        console.log("POLICY EXTRACTION - req.body:", Object.keys(req.body));

        if (!req.file) {
          console.error("POLICY EXTRACTION - No file in request!");
          return res.status(400).json({ error: "No file uploaded" });
        }

        console.log("POLICY EXTRACTION - FILE RECEIVED:", req.file.originalname);
        console.log("POLICY EXTRACTION - File size:", req.file.size, "bytes");
        console.log("POLICY EXTRACTION - File mimetype:", req.file.mimetype);
        console.log("POLICY EXTRACTION - File path:", req.file.path);

        // Step 1: Extract text from PDF using existing parser
        console.log("POLICY EXTRACTION - Starting text extraction...");
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

        fs.unlinkSync(req.file.path);

        if (!uploadedPolicyText.trim()) {
          console.error("POLICY EXTRACTION - Extracted text is empty!");
          return res
            .status(400)
            .json({ error: "No text extracted from file" });
        }

        console.log("POLICY EXTRACTION - TEXT LENGTH:", uploadedPolicyText.length);

        // Step 2: Extract policy metadata and fetch wordings
        console.log("POLICY EXTRACTION - Extracting metadata and fetching wordings...");
        const { extractPolicyMetadata, fetchPolicyWordings, mergePolicyTexts } = await import("./utils/policyWordingsFetcher");
        const metadata = await extractPolicyMetadata(uploadedPolicyText);
        console.log("POLICY EXTRACTION - Metadata:", metadata);

        let wordingsText: string | null = null;
        if (metadata.insurer && metadata.product) {
          console.log(`POLICY EXTRACTION - Fetching wordings for ${metadata.insurer} - ${metadata.product}...`);
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

        // Step 3: Merge texts
        const policyText = mergePolicyTexts(uploadedPolicyText, wordingsText);
        console.log("POLICY EXTRACTION - Merged text length:", policyText.length);

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return res
            .status(500)
            .json({ error: "GEMINI_API_KEY not set" });
        }

        console.log("POLICY EXTRACTION - CALLING GEMINI...");

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: "gemini-3-pro-preview",
          generationConfig: {
            temperature: 0,
            topP: 0.95,
          },
        });

        // Step 2: Send to Gemini with extraction prompt
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Request timeout: Gemini API took too long to respond (5 minutes)")), 5 * 60 * 1000);
        });

        const generatePromise = model.generateContent({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: POLICY_EXTRACTION_PROMPT + "\n\n" + policyText,
                },
              ],
            },
          ],
        });

        const result = await Promise.race([generatePromise, timeoutPromise]) as any;
        const responseText = result.response.text();

        console.log("POLICY EXTRACTION - GEMINI RESPONSE RECEIVED");

        // Step 3: Parse JSON response
        let rawExtraction: RawPolicyExtraction;
        try {
          // Try to extract JSON from markdown code blocks if present
          const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) ||
            responseText.match(/(\{[\s\S]*\})/);
          const jsonText = jsonMatch ? jsonMatch[1] : responseText;
          rawExtraction = JSON.parse(jsonText);
        } catch (parseError: any) {
          console.error("POLICY EXTRACTION - JSON PARSE ERROR:", parseError);
          return res.status(500).json({
            error: "Failed to parse extraction response",
            details: "Gemini returned invalid JSON. Please try again or verify the PDF is readable.",
            raw_response_preview: responseText.substring(0, 500),
          });
        }

        // Step 4: Validate critical fields
        const missingFields: string[] = [];
        if (!rawExtraction.policy_metadata?.insurer) missingFields.push("insurer");
        if (!rawExtraction.policy_metadata?.policy_name) missingFields.push("plan_name");
        if (!rawExtraction.coverage?.sum_insured) missingFields.push("sum_insured");
        if (!rawExtraction.coverage?.annual_premium) missingFields.push("annual_premium");

        if (missingFields.length > 0) {
          console.warn("POLICY EXTRACTION - Missing critical fields:", missingFields);
        }

        // Step 5: Transform to full policy structure
        const policyData = transformRawExtraction(rawExtraction, req.file.originalname);

        // Step 6: Return extracted policy
        return res.json({
          policy_id: policyData.policy_id,
          extracted_data: policyData,
          extraction_metadata: {
            confidence: policyData.extraction_metadata.extraction_confidence,
            missing_fields: policyData.extraction_metadata.missing_fields,
            needs_verification: policyData.extraction_metadata.manual_verification_needed,
          },
        });

      } catch (err: any) {
        console.error("POLICY EXTRACTION ERROR:", err);
        console.error("POLICY EXTRACTION ERROR STACK:", err.stack);

        let errorMessage = err.message || "Unknown error occurred";
        let statusCode = 500;

        if (errorMessage.includes("timeout")) {
          errorMessage = "Extraction timed out. The PDF may be too large or complex. Please try again.";
          statusCode = 408;
        } else if (errorMessage.includes("GEMINI_API_KEY")) {
          errorMessage = "API key not configured";
          statusCode = 500;
        } else if (errorMessage.includes("quota") || errorMessage.includes("429")) {
          errorMessage = "API quota exceeded. Please check your Gemini API usage limits.";
          statusCode = 429;
        }

        // Clean up file if it still exists
        if (req.file && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkErr) {
            console.error("Failed to clean up file:", unlinkErr);
          }
        }

        return res
          .status(statusCode)
          .json({
            error: "Policy extraction failed: " + errorMessage,
            details: process.env.NODE_ENV === "development" ? err.stack : undefined
          });
      }
    }
  );

  // Hospital Network Filter Endpoint
  app.get("/api/hospitals/filter", async (req, res) => {
    try {
      const { state, city, pincode } = req.query;

      // Load filter engine
      const filterEnginePath = "./data/insurance_networks/filter_engine";
      const { filterHospitalNetwork } = await import(filterEnginePath);

      // Apply filters
      const result = filterHospitalNetwork({
        state: state as string | undefined,
        city: city as string | undefined,
        pincode: pincode as string | undefined
      });

      res.json(result);
    } catch (error: any) {
      console.error('[Hospital Filter] Error:', error);
      res.status(500).json({
        error: "Failed to filter hospital network data",
        details: error.message
      });
    }
  });

  // PDF Generation Endpoint (Headless Browser)
  console.log('[ROUTES] Registering PDF generation endpoints...');

  // Test endpoint to verify route registration
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

      // Ensure URL is absolute - if relative, construct from request
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        const protocol = req.protocol;
        const host = req.get('host');
        url = `${protocol}://${host}${url}`;
      }

      console.log('[PDF] Generating PDF from URL:', url);

      // Dynamic import of playwright (only load when needed)
      const { chromium } = await import("playwright");

      let browser;
      try {
        browser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // Set viewport to match typical desktop size
        await page.setViewportSize({ width: 1200, height: 1600 });

        console.log('[PDF] Navigating to URL...');
        // Navigate to the URL
        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: 30000
        });

        console.log('[PDF] Waiting for fonts...');
        // Wait for fonts to load
        await page.evaluate(() => {
          return document.fonts.ready;
        });

        console.log('[PDF] Waiting for DOM content...');
        // Wait for any dynamic content to load
        await page.waitForLoadState('domcontentloaded');

        console.log('[PDF] Waiting for layout to stabilize...');
        // Wait for layout to stabilize (especially for React hydration)
        await page.waitForTimeout(2000);

        console.log('[PDF] Generating PDF...');
        // Generate PDF with exact visual preservation
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true, // Preserve colors and backgrounds
          margin: {
            top: '1cm',
            right: '1cm',
            bottom: '1cm',
            left: '1cm'
          },
          preferCSSPageSize: false,
          scale: 0.8, // Adjust scale for readability while preserving layout
          displayHeaderFooter: false
        });

        await browser.close();
        browser = null;

        console.log('[PDF] PDF generated successfully, size:', pdfBuffer.length, 'bytes');

        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="ensured-report.pdf"`);
        res.send(pdfBuffer);
      } catch (browserError: any) {
        if (browser) {
          await browser.close().catch(() => { });
        }
        throw browserError;
      }

    } catch (error: any) {
      console.error('[PDF] PDF generation error:', error);
      console.error('[PDF] Error stack:', error.stack);
      res.status(500).json({
        error: error.message || "PDF generation failed",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      });
    }
  });

  console.log('[ROUTES] All routes registered successfully');
  return _httpServer;
}