import "./loadEnv";
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import cors from "cors";
import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch, { Headers as NodeFetchHeaders, Request as NodeFetchRequest, Response as NodeFetchResponse } from "node-fetch";


globalThis.fetch = fetch as any;
globalThis.Headers = NodeFetchHeaders as any;
globalThis.Request = NodeFetchRequest as any;
globalThis.Response = NodeFetchResponse as any;

import { registerRoutes, analysisJobs, getUserIdFromToken } from "./routes";
import { serveStatic } from "./static";
import { pool } from "./lib/db";
import { log } from "./lib/logger";
import { containsPersonalData } from "./lib/pii";
import { parseIntent, answerFromData } from "./services/sachRetrieval";
import { sendMail } from "./lib/mailer";

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
      } catch (e) {
        console.warn("Failed to remove stale upload:", filePath, (e as any)?.message ?? e);
      }
    });

    if (cleaned > 0) {
      log.info("stale uploads cleaned", { count: cleaned });
    }
  } catch (err) {
    console.error("Failed to cleanup uploads directory:", err);
  }
}

cleanupUploadsDirectory();
setInterval(cleanupUploadsDirectory, 60 * 60 * 1000);

/* ---------------- DPDP RETENTION CLEANUP ---------------- */
async function cleanupDpdpRetention() {
  // Reuses the shared module-level pool; never end it here.
  try {
    // RETENTION POLICY (DPDP storage-limitation, lifecycle-aware).
    // Principle: we keep data as long as the *purpose* exists — i.e. as long as
    // the client/customer record it belongs to still exists. We ONLY purge
    // records that have been orphaned (their client/customer was deleted) and
    // have then aged past the grace window. Data belonging to an existing
    // (active) client is NEVER auto-deleted, no matter how old it is — that
    // would destroy the agent's working history and, for cover calculations,
    // their client's records. Configurable via RETENTION_GRACE_DAYS.
    const graceDays = Number(process.env.RETENTION_GRACE_DAYS) || 90;
    const cutoffMs = Date.now() - graceDays * 24 * 60 * 60 * 1000;
    const interval = `${graceDays} days`;

    // analysis_jobs: keyed to a client via policy_id. Purge only jobs that are
    // orphaned (no policy_id, or the client no longer exists) AND older than the
    // grace window. Jobs for existing clients are kept so the Sach AI chat keeps
    // its policy context. created_at may be bigint(ms) OR timestamptz.
    const orphanedJobWhere = `
      (policy_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM clients c WHERE c.id = analysis_jobs.policy_id))`;
    try {
      await pool.query(
        `DELETE FROM analysis_jobs WHERE ${orphanedJobWhere} AND created_at < $1`,
        [cutoffMs]
      );
    } catch (e) {
      // created_at stored as timestamptz — retry with interval arithmetic.
      try {
        await pool.query(
          `DELETE FROM analysis_jobs WHERE ${orphanedJobWhere} AND created_at < NOW() - interval '${interval}'`
        );
      } catch (e2) {
        console.warn("[dpdp] analysis_jobs cleanup skipped:", (e2 as any)?.message ?? e2);
      }
    }

    // calculator_reports: optionally linked to a customer via customer_id.
    // Keep any report tied to a customer who still exists (active client work).
    // Purge, once past the grace window, only: (a) untethered scratch reports
    // with no customer attached, and (b) reports orphaned by a deleted customer.
    try {
      await pool.query(
        `DELETE FROM calculator_reports
         WHERE created_at < NOW() - interval '${interval}'
           AND (
             customer_id IS NULL
             OR NOT EXISTS (
                  SELECT 1 FROM customers cu WHERE cu.id = calculator_reports.customer_id)
           )`
      );
    } catch (e) {
      // column/table shape mismatch on older DBs — non-fatal.
      console.warn("[dpdp] calculator_reports cleanup skipped:", (e as any)?.message ?? e);
    }
  } catch (err) {
    console.error("Failed to cleanup DPDP retention tables:", err);
  }
}

// Nightly-ish run (every 24h). Replace with real cron in infra if needed.
setInterval(cleanupDpdpRetention, 24 * 60 * 60 * 1000);

/* ---------------- CONSUMER RENEWAL REMINDERS ---------------- */
// Emails consumers ~30 days before a policy renews, so a 40+ user never lets a
// health/motor cover lapse by accident. Opt-in per account
// (individual_profiles.renewal_reminders_enabled, default on); keyed off the
// user-confirmed individual_policies.renewal_date. reminder_sent_at stops a
// second email for the same upcoming renewal. Mirrors the DPDP job pattern:
// shared pool, never throws, daily interval + a run shortly after boot.
async function sendRenewalReminders() {
  try {
    // Policies renewing within the next 30 days that we haven't reminded on yet,
    // whose owner still has reminders on and a deliverable email.
    const due = await pool.query(
      `SELECT p.id, p.insurance_type, p.insurer, p.policy_name, p.nickname,
              p.renewal_date, pr.email, pr.full_name
         FROM individual_policies p
         JOIN individual_profiles pr ON pr.id = p.user_id
        WHERE p.renewal_date IS NOT NULL
          AND p.renewal_date >= CURRENT_DATE
          AND p.renewal_date <= CURRENT_DATE + INTERVAL '30 days'
          AND p.reminder_sent_at IS NULL
          AND pr.renewal_reminders_enabled = true
          AND pr.email IS NOT NULL
          AND p.status = 'done'`
    );

    if (due.rows.length === 0) return;
    log.info("renewal reminders due", { count: due.rows.length });

    for (const row of due.rows) {
      const label = row.nickname || row.policy_name || row.insurer || `your ${row.insurance_type} policy`;
      const firstName = (row.full_name || "").trim().split(/\s+/)[0] || "there";
      const dateStr = new Date(row.renewal_date).toLocaleDateString("en-IN", {
        day: "numeric", month: "long", year: "numeric",
      });

      const sent = await sendMail({
        to: row.email,
        subject: `Reminder: ${label} renews on ${dateStr}`,
        text: [
          `Hi ${firstName},`,
          "",
          `A quick heads-up from IndSure — ${label} is due to renew on ${dateStr}.`,
          "",
          "Renewing on time keeps your cover continuous (and protects benefits like",
          "no-claim bonus and waiting periods already served).",
          "",
          "Open your portfolio to review it, or reply to this email and an advisor",
          "can help you renew:",
          "https://beta.indsure.in/app",
          "",
          "— Team IndSure",
          "",
          "You're getting this because renewal reminders are on for your account.",
          "You can turn them off any time from your portfolio.",
        ].join("\n"),
      });

      // Only mark as reminded once it actually went out — so reminders start
      // flowing the moment SMTP creds are added, rather than being silently lost.
      if (sent) {
        await pool.query(
          "UPDATE individual_policies SET reminder_sent_at = now() WHERE id = $1",
          [row.id]
        );
      }
    }
  } catch (err) {
    console.error("Failed to send renewal reminders:", err);
  }
}

// Daily run + a run shortly after boot (the interval alone waits 24h).
setInterval(sendRenewalReminders, 24 * 60 * 60 * 1000);

/* ---------------- AGENT OCR ALLOWANCE REFILL ---------------- */

// Monthly top-up of the agent OCR / data-entry allowance, by plan + billing
// cycle. Mirrors the balance model in routes.ts (ensureOcrBalance/consumeOcr):
//   free            → never refilled (flat 20, lifetime — excluded below)
//   agent / monthly → reset to 50 each month (no carryover)
//   agent / annual  → +50 each month, capped at 600 (carryover); the bank is
//                     wiped back to 50 in the agent's signup-anniversary month
//   agency          → treated like agent / annual, per seat
// Idempotent via the `period` marker ('YYYY-MM'): a row is only touched when
// its stored period differs from the current calendar month, so it is safe to
// run on a coarse interval (and to re-run on every boot / restart).
const OCR_MONTHLY = 50;
const OCR_BANK_CAP = 600;

async function refillOcrAllowance() {
  try {
    const now = new Date();
    const period = now.toISOString().slice(0, 7); // 'YYYY-MM'
    const month = now.getUTCMonth() + 1; // 1-12

    // Paid rows whose balance still belongs to an earlier month are due a refill.
    const due = await pool.query(
      `SELECT c.agent_id, c.balance, a.plan, a.billing_cycle,
              EXTRACT(MONTH FROM a.created_at)::int AS anniv_month
         FROM agent_ocr_credits c
         JOIN agents a ON a.id = c.agent_id
        WHERE c.period IS DISTINCT FROM $1
          AND lower(a.plan) <> 'free'`,
      [period]
    );

    for (const r of due.rows) {
      const carryover = String(r.plan).toLowerCase() === "agency" ||
                        String(r.billing_cycle).toLowerCase() === "annual";
      let newBal: number;
      if (!carryover) {
        newBal = OCR_MONTHLY;                              // monthly: reset, drop unused
      } else if (r.anniv_month === month) {
        newBal = OCR_MONTHLY;                              // annual renewal month: wipe the bank
      } else {
        newBal = Math.min((r.balance ?? 0) + OCR_MONTHLY, OCR_BANK_CAP); // accrue up to the cap
      }
      await pool.query(
        "UPDATE agent_ocr_credits SET balance = $1, period = $2, updated_at = NOW() WHERE agent_id = $3",
        [newBal, period, r.agent_id]
      );
    }

    if (due.rows.length > 0) {
      log.info(`[ocr] refilled ${due.rows.length} agent allowance(s) for ${period}`);
    }
  } catch (err) {
    console.error("Failed to refill OCR allowances:", err);
  }
}

// Run on boot + every 6h. The period guard makes both safe/idempotent.
refillOcrAllowance();
setInterval(refillOcrAllowance, 6 * 60 * 60 * 1000);


/* ---------------- SERVER SETUP ---------------- */

const app = express();
// Behind nginx (proxy_pass → localhost:5000 with X-Forwarded-For). Trust the
// first proxy hop so req.ip is the real client IP — required for the per-IP rate
// limiters and IP-hash audit to work (otherwise every request looks like 127.0.0.1).
app.set("trust proxy", 1);
const server = createServer(app);

/* ---------------- CORS ---------------- */

// Built-in production origins, always allowed, plus anything in CORS_ORIGIN.
// Vercel preview deployments (*.vercel.app) and localhost (dev) are matched
// by pattern below so previews and local dev never break.
const DEFAULT_ALLOWED_ORIGINS = [
  "https://indsure.in",
  "https://www.indsure.in",
  "https://beta.indsure.in",
];

app.use(
  cors({
    origin: (origin, callback) => {
      const envOrigins = (process.env.CORS_ORIGIN || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const allowedOrigins = new Set([...DEFAULT_ALLOWED_ORIGINS, ...envOrigins]);

      // Non-browser clients (curl, server-to-server, health checks) send no Origin.
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);

      // Allow our own Vercel preview URLs and localhost during development.
      // Only *.vercel.app hosts that also mention this project ("indsure") pass,
      // so arbitrary third-party Vercel deployments can't hit the API.
      let host = "";
      try { host = new URL(origin).hostname; } catch { /* malformed origin */ }
      const isOwnVercelPreview = host.endsWith(".vercel.app") && host.includes("indsure");
      const isLocalhost = host === "localhost" || host === "127.0.0.1";
      if (isOwnVercelPreview || isLocalhost) return callback(null, true);

      console.warn(`[CORS] Rejected origin: ${origin}`);
      return callback(null, false);
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-user-id", "x-sach-session-id"],
    credentials: true,
  })
);

/* ---------------- BODY PARSING ---------------- */

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));

/* ---------------- RATE LIMITING ---------------- */
// Global IP limiter to stop abuse loops (e.g. hammering the AI/analyze routes,
// which cost Gemini credits). Generous enough for normal portal use. The
// per-route share/Sach AI limiters remain in place on top of this.
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // ~20 req/min/IP sustained
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/api/health",
  message: { error: "rate_limited", message: "Too many requests, please slow down." },
});
app.use("/api", globalApiLimiter);

/* ---------------- PRODUCTION ERROR SANITIZER ---------------- */
// In production, never leak internal error text/stack to clients. Applies to
// every route (and any future one): 5xx responses are genericized, and the
// `details`/`stack` fields are always stripped. Validation (4xx) messages such
// as "email is required" are preserved. Beta runs NODE_ENV=production with
// APP_ENV=staging, so this is active on beta.
if (process.env.NODE_ENV === "production") {
  app.use((_req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (body && typeof body === "object") {
        if (res.statusCode >= 500) {
          body = { error: "Internal Server Error" };
        } else {
          if ("details" in body) delete (body as any).details;
          if ("stack" in body) delete (body as any).stack;
        }
      }
      return originalJson(body);
    };
    next();
  });
}

/* ---------------- HEALTH CHECK ---------------- */

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    env: process.env.NODE_ENV || "development",
    appEnv: process.env.APP_ENV || process.env.DEPLOY_ENV || "unknown",
  });
});

/* ---------------- API LOGGER ---------------- */

app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    if (req.path.startsWith("/api")) {
      const ms = Date.now() - start;
      log.info("api_request", { method: req.method, path: req.path, status: res.statusCode, ms });
    }
  });

  next();
});

/* =========================================================
   SACH: ZERO-AI POLICY ANSWER ENGINE

   This route does not call a model. Not as a cost optimisation that might be
   reverted later: it is the design. Every clause question is answered by looking
   the fact up in data we already hold and already paid for, which is both
   cheaper and more accurate than asking a model to recall it.

     - "am I covered for robotic"  -> the caller's own analysis JSON
     - "does Care Supreme cover X" -> policy_catalog, 69 published wordings
     - "how much cover do I need"  -> the deterministic cover calculator
     - "compare A and B"           -> the deterministic catalog comparison
     - anything else               -> the /learn clause library, resolved on the
                                      client where that content already lives

   What it replaced: a handler that shipped a ~40-line "policy context" block to
   Gemini on every message, built from JSON paths that do not exist in a stored
   analysis (cost_structure.copay_details, coverage_structure.exclusions, and so
   on). It rendered "Not available" seven times over, then instructed the model
   to "be specific and reference their actual policy details". It paid for a
   model call to answer from nothing, and it could not answer the robotic-surgery
   question that the widget itself suggests first.

   Retrieval and rendering live in services/sachRetrieval.ts, which is pure and
   unit-tested. This file does auth, ownership and SQL only.
   ========================================================= */

type SachAiRateState = { count: number; resetAt: number };
const sachAiRateMap = new Map<string, SachAiRateState>();
// Answers cost nothing now, so this is an abuse guard on the DB rather than a
// spend cap. Generous enough that a real conversation never hits it.
const SACH_AI_MAX_MESSAGES_PER_SESSION = 60;
const SACH_AI_MAX_INPUT_CHARS = 500;

// Prune expired rate-limit entries every 10 minutes so the map doesn't grow
// unbounded (one entry accumulates per session/user/IP otherwise).
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of sachAiRateMap) {
    if (state.resetAt <= now) sachAiRateMap.delete(key);
  }
}, 10 * 60 * 1000);

function getSachAiSessionKey(req: Request, sessionId: unknown): string {
  const sid = typeof sessionId === "string" && sessionId.trim() ? sessionId.trim() : "";
  if (sid) return `sid:${sid}`;
  const userId = (req.headers["x-user-id"] as string | undefined) || "";
  return userId ? `user:${userId}` : `ip:${req.ip}`;
}

/**
 * Who is asking, and which policy rows may they read?
 *
 * Agents keep their policies in analysis_jobs (agent_id), consumers in
 * individual_policies (user_id). Both store the SAME analysis JSON, so the
 * retrieval layer is identical; only the ownership predicate differs. Returning
 * null for an unknown caller is what keeps one account type from reading the
 * other's policy PII.
 */
async function resolveSachCaller(
  req: Request
): Promise<{ userId: string; kind: "agent" | "consumer" } | null> {
  const authHeader = req.headers["authorization"] as string | undefined;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;

  const userId = await getUserIdFromToken(token);
  if (!userId) return null;

  const agentRow = await pool.query("SELECT 1 FROM agents WHERE id = $1", [userId]);
  if (agentRow.rows.length > 0) return { userId, kind: "agent" };

  const consumerRow = await pool.query("SELECT 1 FROM individual_profiles WHERE id = $1", [userId]);
  if (consumerRow.rows.length > 0) return { userId, kind: "consumer" };

  return null;
}

/**
 * The caller's own analysis JSON, ownership-checked in the WHERE clause rather
 * than after the fact. `jobId` is a hint from the open report; without one we
 * fall back to their most recent completed analysis, which is what someone means
 * by "my policy" when they have only ever uploaded one.
 */
async function loadOwnAnalysis(
  caller: { userId: string; kind: "agent" | "consumer" },
  jobId: unknown
): Promise<any | null> {
  const id = typeof jobId === "string" && jobId.trim() ? jobId.trim() : null;

  if (caller.kind === "agent") {
    const q = id
      ? await pool.query(
          "SELECT result FROM analysis_jobs WHERE id = $1 AND agent_id = $2",
          [id, caller.userId]
        )
      : await pool.query(
          `SELECT result FROM analysis_jobs
            WHERE agent_id = $1 AND result IS NOT NULL
            ORDER BY created_at DESC LIMIT 1`,
          [caller.userId]
        );
    return q.rows[0]?.result ?? null;
  }

  // Consumers: report_data carries the same schema as analysis_jobs.result.
  const q = id
    ? await pool.query(
        `SELECT report_data FROM individual_policies
          WHERE (job_id::text = $1 OR id::text = $1) AND user_id = $2`,
        [id, caller.userId]
      )
    : await pool.query(
        `SELECT report_data FROM individual_policies
          WHERE user_id = $1 AND report_data IS NOT NULL
          ORDER BY created_at DESC LIMIT 1`,
        [caller.userId]
      );
  return q.rows[0]?.report_data ?? null;
}

/**
 * Find the catalog row for an insurer the question named. Matches the insurer
 * first and then, only if the question also names the plan, narrows to it.
 * Ambiguity resolves to null rather than to a guess: answering about the wrong
 * product is worse than saying we need the document.
 */
async function loadCatalogRow(question: string, insurerMention: string | null) {
  if (!insurerMention) return null;

  const q = await pool.query(
    `SELECT insurer, plan_name, status, confidence, profile
       FROM policy_catalog
      WHERE is_active = true AND insurer ILIKE $1
      ORDER BY plan_name`,
    [`%${insurerMention}%`]
  );
  if (q.rows.length === 0) return null;
  if (q.rows.length === 1) return q.rows[0];

  const asked = question.toLowerCase();
  const named = q.rows.filter(
    (r: any) => r.plan_name && asked.includes(String(r.plan_name).toLowerCase())
  );
  if (named.length === 1) return named[0];

  // Several plans from the same insurer and no plan named: cannot answer
  // truthfully about "your Care policy" without knowing which one.
  return { __ambiguous: true, insurer: q.rows[0].insurer, plans: q.rows.map((r: any) => r.plan_name) } as any;
}

app.post("/api/sach-ai", async (req: Request, res: Response) => {
  try {
    const { messages = [], jobId, sessionId } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "Invalid request: messages must be a non-empty array" });
    }

    // AUTH: agents and logged-in consumers, both reading only their own rows.
    const caller = await resolveSachCaller(req);
    if (!caller) {
      return res.status(401).json({ message: "Authentication required" });
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

    const sessionKey = getSachAiSessionKey(req, sessionId);
    const now = Date.now();
    const existing = sachAiRateMap.get(sessionKey);
    const resetAt = existing?.resetAt && existing.resetAt > now ? existing.resetAt : now + 60 * 60 * 1000;
    const nextCount = existing?.count != null ? existing.count : 0;
    if (nextCount >= SACH_AI_MAX_MESSAGES_PER_SESSION) {
      return res.status(429).json({
        message: "Rate limit exceeded",
        details: `Max ${SACH_AI_MAX_MESSAGES_PER_SESSION} messages per session.`,
      });
    }
    sachAiRateMap.set(sessionKey, { count: nextCount + 1, resetAt });

    const intent = parseIntent(lastText);

    // ── compare ────────────────────────────────────────────────────────────
    if (intent.kind === "compare") {
      return res.json({
        kind: "compare",
        source: "compare",
        content:
          "**Comparing two policies is its own tool.**\n\nThe compare page lays both wordings side by side on 27 clauses and marks a winner on each one, from the same catalog this chat reads. It is free for any two plans in the catalog.",
        links: [{ label: "Open compare", href: "/compare" }],
      });
    }

    // ── how much cover ─────────────────────────────────────────────────────
    if (intent.kind === "cover_need") {
      const own = await loadOwnAnalysis(caller, jobId);
      const currentSI = own?.coverage_structure?.base_sum_insured;
      const lines = [
        "**That depends on your city, your age and who is on the policy.**",
        "The cover calculator asks eight questions and gives you a number you can act on, with the working shown. It runs on your device and costs nothing.",
      ];
      if (typeof currentSI === "number" && currentSI > 0) {
        lines.push(
          `For reference, the policy you have uploaded carries a base sum insured of ${formatSachINR(currentSI)}.\n\nSource: your uploaded policy analysis.`
        );
      }
      return res.json({
        kind: "cover_need",
        source: "calculator",
        content: lines.join("\n\n"),
        links: [{ label: "Open the cover calculator", href: "/calculator" }],
      });
    }

    // ── a clause question: the main path ───────────────────────────────────
    if (intent.kind === "clause") {
      const own = await loadOwnAnalysis(caller, jobId);
      const catalogRow = own ? null : await loadCatalogRow(lastText, intent.namedPlanText);

      if (catalogRow && (catalogRow as any).__ambiguous) {
        const amb = catalogRow as any;
        return res.json({
          kind: "clause",
          source: "none",
          content: `**${amb.insurer} sells several plans, and this clause differs between them.**\n\nI can answer for a specific one: ${amb.plans.filter(Boolean).join(", ")}. Name the plan, or upload your policy and I will read your own schedule instead of the published wording.`,
        });
      }

      const { fact, text } = answerFromData(lastText, {
        ownAnalysis: own,
        catalogRow: catalogRow as any,
      });

      if (text && fact) {
        return res.json({
          kind: "clause",
          source: own && fact.sourceLabel.includes("uploaded") ? "own_policy" : "catalog",
          clause: fact.clauseKey,
          verdict: fact.verdict,
          content: text,
        });
      }

      // We understood the clause but hold no data on it for this caller.
      return res.json({
        kind: "clause",
        source: "none",
        clause: intent.clauseKey,
        content:
          "**I do not have that clause for you yet.**\n\nUpload the policy document and I will read this straight off your own schedule, or name the exact plan and I will check the published wording.",
        links: [{ label: "Check a policy", href: "/policychecker" }],
      });
    }

    // ── general education: answered on the client from the clause library ──
    // The /learn clause library is the single source for these explanations and
    // it is already bundled in the frontend, so it is resolved there rather than
    // duplicated into the backend.
    return res.json({ kind: "general", source: "glossary", content: null, query: lastText });
  } catch (err: any) {
    log.error("Sach AI failed", { message: err?.message });
    if (!res.headersSent) {
      return res.status(500).json({ message: "Sach could not answer that right now." });
    }
    return res.end();
  }
});

/** Local rupee formatter. See services/sachRetrieval.ts on why @shared is unavailable here. */
function formatSachINR(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${Math.round(n / 1000)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

/* ---------------- BOOTSTRAP ---------------- */

async function start() {
  await registerRoutes(server, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    log.error("unhandled_api_error", { message: err?.message, stack: err?.stack });
    const status = err.status || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  // Static serving is decoupled from NODE_ENV so this API-only host can run in
  // production mode without a frontend build present. Enable only when explicitly
  // requested (SERVE_STATIC=true) AND a build exists; never crash the API if not.
  if (process.env.SERVE_STATIC === "true") {
    try {
      serveStatic(app);
      log.info("serving frontend build");
    } catch (e: any) {
      console.error("[static] Static serving disabled (no build found):", e?.message);
    }
  }

  const port = Number(process.env.PORT) || 5000;

  server.listen(port, "0.0.0.0", () => {
    log.info("api server listening", { port });
    // Run DPDP retention once shortly after boot (the interval only fires 24h
    // later otherwise). Guarded so a cleanup failure never crashes the server.
    setTimeout(() => {
      void cleanupDpdpRetention().catch((e) =>
        console.error("[dpdp] initial cleanup failed:", e?.message ?? e)
      );
      void sendRenewalReminders().catch((e) =>
        console.error("[reminders] initial run failed:", e?.message ?? e)
      );
    }, 30 * 1000);
  });
}

start().catch((err) => {
  console.error("FAILED TO START SERVER:", err);
  process.exit(1);
});
