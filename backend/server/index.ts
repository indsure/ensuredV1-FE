import "./loadEnv";
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch, { Headers as NodeFetchHeaders, Request as NodeFetchRequest, Response as NodeFetchResponse } from "node-fetch";
import pkg from "pg";


globalThis.fetch = fetch as any;
globalThis.Headers = NodeFetchHeaders as any;
globalThis.Request = NodeFetchRequest as any;
globalThis.Response = NodeFetchResponse as any;

import { registerRoutes, analysisJobs } from "./routes";
import { serveStatic } from "./static";
import { SACH_AI_SYSTEM_PROMPT } from "./sachAI.prompt";

const { Pool } = pkg;

/* ---------------- UPLOAD DIRECTORY CLEANUP ---------------- */

function cleanupUploadsDirectory() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const uploadsDir = path.resolve(__dirname, "..", "uploads");

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    return;
  }

  try {
    const files = fs.readdirSync(uploadsDir);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000;

    let cleaned = 0;
    files.forEach((file) => {
      const filePath = path.join(uploadsDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      } catch { }
    });

    if (cleaned > 0) {
    }
  } catch (err) {
    console.error("Failed to cleanup uploads directory:", err);
  }
}

cleanupUploadsDirectory();
setInterval(cleanupUploadsDirectory, 60 * 60 * 1000);

/* ---------------- DPDP RETENTION CLEANUP ---------------- */
async function cleanupDpdpRetention() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const cutoffMs = Date.now() - 90 * 24 * 60 * 60 * 1000;

    // analysis_jobs: in this codebase, created_at may be either bigint(ms) or timestamptz.
    try {
      await pool.query("DELETE FROM analysis_jobs WHERE created_at < $1", [cutoffMs]);
    } catch (e) {
      // ignore and try timestamptz-based deletion
    }
    try {
      await pool.query("DELETE FROM analysis_jobs WHERE created_at < NOW() - interval '90 days'");
    } catch (e) {
      // ignore
    }

    // calculator_reports: created_at is created with DEFAULT NOW(), stored as timestamptz.
    try {
      await pool.query("DELETE FROM calculator_reports WHERE created_at < NOW() - interval '90 days'");
    } catch (e) {
      // ignore
    }
  } catch (err) {
    console.error("Failed to cleanup DPDP retention tables:", err);
  } finally {
    await pool.end().catch(() => {});
  }
}

// Nightly-ish run (every 24h). Replace with real cron in infra if needed.
setInterval(cleanupDpdpRetention, 24 * 60 * 60 * 1000);

import { GoogleGenerativeAI } from "@google/generative-ai";

/* ---------------- SERVER SETUP ---------------- */

const app = express();
const server = createServer(app);

/* ---------------- CORS ---------------- */

app.use(
  cors({
    // If no CORS env is provided, allow the request origin to avoid blocking the chat UI.
    origin: (origin, callback) => {
      const corsOriginEnv = process.env.CORS_ORIGIN;
      const allowedOrigins = corsOriginEnv
        ? corsOriginEnv
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : null;

      if (!origin) return callback(null, true);
      if (!allowedOrigins) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-user-id", "x-sach-session-id"],
    credentials: true,
  })
);

/* ---------------- BODY PARSING ---------------- */

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

/* ---------------- RATE LIMITING (DISABLED) ---------------- */
// Rate limiting has been disabled as per user request.
/* ---------------- HEALTH CHECK ---------------- */

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    env: process.env.NODE_ENV || "development",
  });
});

/* ---------------- API LOGGER ---------------- */

app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    if (req.path.startsWith("/api")) {
      const ms = Date.now() - start;
      console.log(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
    }
  });

  next();
});

/* =========================================================
   SACH AI — TRUTH MODE
   ========================================================= */

type SachAiRateState = { count: number; resetAt: number };
const sachAiRateMap = new Map<string, SachAiRateState>();
const SACH_AI_MAX_MESSAGES_PER_SESSION = 20;
const SACH_AI_MAX_INPUT_CHARS = 500;

function containsPersonalData(text: string): boolean {
  // Minimal guardrails: block common personal identifiers.
  // (We reject rather than attempt to redact because mixed/partial identifiers
  // frequently slip through and can cause model prompt leakage.)
  const t = text;
  const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const phone = /\b(?:\+?91[\s-]?)?\d{10}\b/;
  const aadhaar = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/; // xxxx-xxxx-xxxx
  const aadhaarPlain = /\b\d{12}\b/;
  const policyLike = /\b(?:POLICY|POL|POL-\s*)?[A-Z0-9]{0,10}?\d{3,}\b/i;

  return email.test(t) || phone.test(t) || aadhaar.test(t) || aadhaarPlain.test(t) || policyLike.test(t);
}

function getSachAiSessionKey(req: Request, sessionId: unknown): string {
  const sid = typeof sessionId === "string" && sessionId.trim() ? sessionId.trim() : "";
  if (sid) return `sid:${sid}`;
  const userId = (req.headers["x-user-id"] as string | undefined) || "";
  return userId ? `user:${userId}` : `ip:${req.ip}`;
}

app.post("/api/sach-ai", async (req: Request, res: Response) => {
  try {
    const { messages = [], jobId, sessionId, language, stream } = req.body || {};
    // Disable streaming by default due to Node.js Web Streams API compatibility issues
    // with @google/generative-ai SDK (pipeThrough not available in all environments)
    const streamEnabled = stream === true;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "Invalid request: messages must be a non-empty array" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        message: "Sach AI misconfigured",
        details: "GEMINI_API_KEY is not defined in environment variables",
      });
    }

    // Fetch policy context if jobId is provided
    let policyContext = "";
    if (jobId && typeof jobId === "string") {
      try {
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        const jobRes = await pool.query(
          "SELECT result FROM analysis_jobs WHERE id = $1",
          [jobId]
        );
        await pool.end();

        if (jobRes.rows.length > 0 && jobRes.rows[0].result) {
          const analysisData = jobRes.rows[0].result;
          
          // Extract key policy information for context
          const policyName = analysisData?.coverage_structure?.policy_name || "Unknown Policy";
          const insurerName = analysisData?.identity?.insurer_name || "Unknown Insurer";
          const sumInsured = analysisData?.coverage_structure?.base_sum_insured || "Not specified";
          const coverageDetails = analysisData?.coverage_structure?.coverage_details || [];
          const exclusions = analysisData?.coverage_structure?.exclusions || [];
          const waitingPeriods = analysisData?.policy_timeline?.waiting_periods || [];
          const copayDetails = analysisData?.cost_structure?.copay_details || [];
          const roomRentCapping = analysisData?.cost_structure?.room_rent_capping || {};
          
          // Build context string with relevant policy details
          policyContext = `\n\n=== USER'S POLICY CONTEXT ===
Policy Name: ${policyName}
Insurer: ${insurerName}
Sum Insured: ${sumInsured}

Coverage Details:
${coverageDetails.map((c: any) => `- ${c.coverage_type || c.name}: ${c.description || c.details || 'Covered'}`).join('\n') || 'Not available'}

Exclusions:
${exclusions.map((e: any) => `- ${typeof e === 'string' ? e : e.exclusion || e.description}`).join('\n') || 'Not available'}

Waiting Periods:
${waitingPeriods.map((w: any) => `- ${w.condition || w.type}: ${w.period || w.duration}`).join('\n') || 'Not available'}

Copay Details:
${copayDetails.map((c: any) => `- ${c.condition || c.type}: ${c.percentage || c.amount}`).join('\n') || 'Not available'}

Room Rent Capping:
${roomRentCapping.limit ? `Limit: ${roomRentCapping.limit}` : 'No capping information available'}

=== END POLICY CONTEXT ===

IMPORTANT: The user has uploaded their policy document. Use the above policy context to answer their specific questions about THEIR policy. Be specific and reference their actual policy details when answering.`;
        }
      } catch (dbErr: any) {
        console.error("Failed to fetch policy context:", dbErr);
        // Continue without policy context rather than failing the request
      }
    }

    const lastMessage = messages[messages.length - 1] as any;
    if (!lastMessage || typeof lastMessage.content !== "string") {
      return res.status(400).json({ message: "Invalid request: last message is missing content" });
    }

    const lastText = lastMessage.content.trim();
    if (!lastText) {
      return res.status(400).json({ message: "Invalid request: message content cannot be empty" });
    }

    if (lastText.length > SACH_AI_MAX_INPUT_CHARS) {
      return res.status(400).json({ message: `Message too long (max ${SACH_AI_MAX_INPUT_CHARS} characters)` });
    }

    const userTexts = messages
      .filter((m: any) => m?.role === "user" && typeof m?.content === "string")
      .map((m: any) => m.content)
      .join("\n");
    if (containsPersonalData(userTexts)) {
      return res.status(400).json({
        message: "Personal data detected",
        details: "Please remove personal identifiers like Aadhaar numbers, phone numbers, email addresses, and policy numbers.",
      });
    }

    // Rate limit per session.
    const sessionKey = getSachAiSessionKey(req, sessionId);
    const now = Date.now();
    const existing = sachAiRateMap.get(sessionKey);
    const resetAt = existing?.resetAt && existing.resetAt > now ? existing.resetAt : now + 60 * 60 * 1000; // 1 hour
    const nextCount = existing?.count != null ? existing.count : 0;
    if (nextCount >= SACH_AI_MAX_MESSAGES_PER_SESSION) {
      return res.status(429).json({
        message: "Rate limit exceeded",
        details: `Max ${SACH_AI_MAX_MESSAGES_PER_SESSION} messages per session.`,
      });
    }
    sachAiRateMap.set(sessionKey, { count: nextCount + 1, resetAt });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const history = messages.slice(0, -1).map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const { HarmCategory, HarmBlockThreshold } = await import("@google/generative-ai");

    const userTextForModel =
      typeof language === "string" && language.trim() && language !== "auto"
        ? `Respond entirely in ${language.trim()}. Do not mix languages. Write only in ${language.trim()}. User message: ${lastText}`
        : `Detect the language of this message and respond entirely in that language: ${lastText}. If unsure, respond in English. Do not mix languages. Write only in the detected language.`;

    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: SACH_AI_SYSTEM_PROMPT + policyContext }]
        },
        ...history
      ],
      generationConfig: {
        maxOutputTokens: 8192,
      },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
    });

    // Non-stream mode for stable fallback.
    if (!streamEnabled) {
      const result = await chat.sendMessage(userTextForModel);
      const content = result?.response?.text?.() ?? "";
      return res.json({ content });
    }

    const result = await chat.sendMessageStream(userTextForModel);

    // Only set streaming headers after the model request has succeeded.
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let sentAny = false;
    try {
      for await (const chunk of result.stream) {
        const chunkText = chunk?.text?.() ?? "";
        if (!chunkText) continue;
        sentAny = true;
        res.write(chunkText);
      }
    } catch (streamError: any) {
      const logMsg = `[STREAM ERROR] ${streamError?.message || streamError}\n`;
      fs.appendFileSync(path.join(process.cwd(), "sach_debug.log"), logMsg);

      // If streaming fails before we sent anything, return a full response.
      if (!sentAny) {
        const fallback = await chat.sendMessage(userTextForModel);
        res.write(fallback?.response?.text?.() ?? "");
      } else {
        res.write("\n\n(Temporary streaming interruption. Please resend your question for the full answer.)");
      }
    } finally {
      res.end();
    }
  } catch (err: any) {
    const errorMsg = `[${new Date().toISOString()}] Sach AI Error: ${err.message}\nStack: ${err.stack}\n\n`;
    console.error(errorMsg);

    try {
      fs.appendFileSync(path.join(process.cwd(), "sach_debug.log"), errorMsg);
    } catch (fsErr) {
      console.error("Failed to write to log file", fsErr);
    }

    if (!res.headersSent) {
      res.status(500).json({
        message: "Sach AI service failed",
        details: err.message,
        hint: "Check sach_debug.log"
      });
    } else {
      res.end();
    }
  }
});

/* ---------------- BOOTSTRAP ---------------- */

async function start() {
  await registerRoutes(server, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("API ERROR:", err);
    const status = err.status || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  }

  const port = Number(process.env.PORT) || 5000;

  server.listen(port, "0.0.0.0", () => {
    console.log(`API server running on http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error("FAILED TO START SERVER:", err);
  process.exit(1);
});
