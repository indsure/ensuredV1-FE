import type { Express } from "express";
import type { Server } from "http";
import multer from "multer";
import fs from "fs";
import crypto from "crypto";
import dns from "dns";
import rateLimit from "express-rate-limit";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MASTER_AUDIT_PROMPT, PROMPT_VERSION } from "./promptTemplate";
import { LIFE_INSURANCE_PROMPT } from "./lifeInsurancePrompt";
import { VEHICLE_INSURANCE_PROMPT } from "./vehicleInsurancePrompt";
import { POLICY_EXTRACTION_PROMPT } from "./policyExtractionPrompt";
import { AIService } from "./services/aiService";
import { runAnalysisPipeline, type CompanionDoc, type CompanionKind } from "./services/analysisPipeline";
import { extractStructuredData } from "./services/dataExtraction";
import { isDataEntryType, deriveSharedColumns } from "./services/extractionFields";
import { extractWordingProfile, hashText } from "./services/wordingCompare";
import { logGeminiUsage, extractUsage, hashActor } from "./services/geminiUsage";
import { buildComparison, compareMany, type WordingProfile } from "./types/wordingProfile";
import { filterHospitalNetwork, getHospitalSamples } from "./data/insurance_networks/filter_engine";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { pool } from "./lib/db";
import { isPersonalEmail } from "./lib/personalEmail";
import { sendMail } from "./lib/mailer";

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

// A second client on the ANON key, used only to verify a password on behalf of
// someone logging in with their mobile number. The service-role client cannot do
// this: it bypasses auth entirely and has no "is this password correct" call, so
// using it would mean trusting the caller's word about who they are.
//
// No session is persisted and nothing is refreshed — this client exists to
// exchange one password for one session and then forget it.
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const supabaseAuth = SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

/* ---------- DB POOL (shared, see ./lib/db) ---------- */

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

/* ---------- PDF RENDER CONCURRENCY CAP ---------- */

// Headless Chromium is heavy. This unauthenticated endpoint must never be able
// to launch an unbounded number of browsers (memory/CPU DoS). We allow at most
// MAX_CONCURRENT_PDF_RENDERS in flight at once; anything beyond that is rejected
// with 429 BEFORE a browser is launched. The counter is decremented in a
// `finally` on the render path so a thrown/hung render can't leak a slot.
const MAX_CONCURRENT_PDF_RENDERS = 2;
let activePdfRenders = 0;

/* ---------- PER-ROUTE RATE LIMITERS ---------- */

// Strict limiter for the unauthenticated headless-browser PDF endpoint: at most
// 10 renders / 10 minutes / IP, on top of the global limiter.
const pdfRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many PDF requests. Please wait a few minutes and try again." },
});

// Strict limiter for the anonymous Gemini-backed analyzer: 10 analyses / hour /
// IP. Prevents an anonymous caller from running up unbounded AI cost.
const analyzeRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many analysis requests. Please try again in an hour." },
});

// Pre-signup uploads. Tighter than the authenticated limiter because there is
// no account behind the request: this endpoint is a writable bucket exposed to
// anyone who finds it, so the cap is per-IP and low. It costs no Gemini spend,
// only storage, and the hourly sweep reclaims whatever is never claimed.
const pendingUploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many uploads. Please try again in an hour." },
});

// Anonymous uploads are capped well below the authenticated 25MB: a stranger
// should not be able to park 25MB at a time in the bucket.
const PENDING_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const PENDING_UPLOAD_TTL_HOURS = 24;
const PENDING_PREFIX = "pending";

// Most pre-signup uploads are never claimed — that is inherent to a funnel, so
// the majority of what this stores is destined for deletion. It is also the
// least-consented data we hold (see migrations/014), which makes the sweep a
// privacy control, not just housekeeping.
//
// Objects are removed BEFORE their rows: remove() on an already-gone object is
// a no-op, so a crash mid-sweep costs a retry next hour rather than orphaning a
// file that no row points at any more.
async function sweepExpiredPendingUploads() {
  try {
    const { rows } = await pool.query(
      `SELECT id, storage_path FROM pending_uploads
        WHERE claimed_by IS NULL AND expires_at < now()
        LIMIT 500`
    );
    if (rows.length === 0) return;

    const paths = rows.map((r: any) => r.storage_path);
    const { error } = await supabaseAdmin.storage.from(PDF_BUCKET).remove(paths);
    if (error) {
      console.error("[pending uploads] object sweep failed:", error.message);
      return; // leave the rows; next run retries the pair together
    }

    await pool.query("DELETE FROM pending_uploads WHERE id = ANY($1::uuid[])", [
      rows.map((r: any) => r.id),
    ]);
    console.log(`[pending uploads] swept ${paths.length} unclaimed upload(s).`);
  } catch (err: any) {
    console.error("[pending uploads] sweep error:", err?.message || err);
  }
}

void sweepExpiredPendingUploads();
setInterval(sweepExpiredPendingUploads, 60 * 60 * 1000);

// ── CLAIM DOCUMENT INCINERATION ──────────────────────────────────────────────
// The promise the upload screen makes to the customer, kept by a machine.
//
// Claim documents live 30 days from the first upload, extendable once to 60.
// Past purge_at this destroys the bucket objects and the claim_documents rows,
// then stamps claims.documents_purged_at so the UI can say plainly that the
// files are gone. Same ordering as the sweep above and for the same reason:
// objects first, rows second, so a crash costs a retry rather than an orphan.
//
// The CASE RECORD is never touched — insurer, hospital, ailment, amounts,
// dates, the query rounds and the timeline all survive. Once the files are
// gone those columns describe a case, not a person, and they are what the
// advisor's claims track record is built from.
//
// THE ONE EXCEPTION is outcome proof. A settlement letter is what the advisor
// shows future customers, and it also carries a name, a policy number and an
// amount — so it survives only where the customer agreed on the record
// (claims.proof_consent_at). No consent, and it burns with everything else.
async function incinerateExpiredClaimDocuments() {
  try {
    const { rows: claims } = await pool.query(
      // Two kinds of candidate. The ordinary one is a claim past its deadline
      // that has never been purged. The second exists because CLOSING a claim
      // purges its working documents and stamps documents_purged_at while
      // deliberately leaving the insurer's letter — so a claim closed WITHOUT
      // consent still has a letter that must die at purge_at, and keying only
      // on the stamp would let it live forever.
      `SELECT id, proof_consent_at
         FROM claims
        WHERE purge_at IS NOT NULL
          AND purge_at < now()
          AND (
            documents_purged_at IS NULL
            OR (proof_consent_at IS NULL
                AND EXISTS (SELECT 1 FROM claim_documents d WHERE d.claim_id = claims.id))
          )
        LIMIT 200`
    );
    if (claims.length === 0) return;

    for (const claim of claims) {
      // A claim that consented keeps its outcome proof; everything else on it
      // still goes. Without consent the whole set is in scope.
      const { rows: docs } = await pool.query(
        claim.proof_consent_at
          ? `SELECT id, storage_path FROM claim_documents
              WHERE claim_id = $1 AND category IN ('personal','case')`
          : `SELECT id, storage_path FROM claim_documents WHERE claim_id = $1`,
        [claim.id]
      );

      if (docs.length > 0) {
        const paths = docs.map((d: any) => d.storage_path);
        const { error } = await supabaseAdmin.storage.from(PDF_BUCKET).remove(paths);
        if (error) {
          // Leave the rows and the stamp alone; next run retries the pair
          // together. Never stamp purged while files are still standing.
          console.error(`[claims] object purge failed for ${claim.id}:`, error.message);
          continue;
        }
        await pool.query("DELETE FROM claim_documents WHERE id = ANY($1::uuid[])", [
          docs.map((d: any) => d.id),
        ]);
      }

      await pool.query(
        `UPDATE claims
            SET documents_purged_at = COALESCE(documents_purged_at, now()),
                updated_at = now()
          WHERE id = $1`,
        [claim.id]
      );
      await pool.query(
        `INSERT INTO claim_events (claim_id, agent_id, status, note)
         SELECT id, agent_id, 'documents_purged', $2 FROM claims WHERE id = $1`,
        [
          claim.id,
          claim.proof_consent_at
            ? `${docs.length} document(s) deleted. Settlement proof kept with the customer's permission.`
            : `${docs.length} document(s) deleted.`,
        ]
      );
      console.log(`[claims] incinerated ${docs.length} document(s) on claim ${claim.id}.`);
    }
  } catch (err: any) {
    console.error("[claims] incineration sweep error:", err?.message || err);
  }
}

// Daily. The deadline is a date, not a minute, so hourly would buy nothing.
void incinerateExpiredClaimDocuments();
setInterval(incinerateExpiredClaimDocuments, 24 * 60 * 60 * 1000);

// ── D2C consumer ("individual") metering knobs ───────────────────────────
// Free plan holds one policy per line of business, and does not expire. That
// cap is enforced at ONE server-side choke point (checkIndividualQuota) —
// never duplicated per lane.
//
// TRIAL_DAYS no longer gates anything: it is kept because the admin consumer
// view and /api/me endpoints still report a trial window off trial_started_at,
// which doubles as the signup date.
const TRIAL_DAYS = 30;
const FREE_SLOTS_PER_TYPE = 1;

// ── Agent OCR (data-entry) metering ──────────────────────────────────────
// Non-health lanes (motor/life/term/travel/property) run a paid Gemini OCR
// call, so they are metered like credits: a per-agent balance you draw down.
// The balance is refilled monthly by plan + billing cycle in refillOcrAllowance
// (index.ts); here we only lazily seed it on first use and consume on success.
const OCR_MONTHLY_ALLOWANCE: Record<string, number> = { free: 20, agent: 50, agency: 50 };
const OCR_BANK_CAP = 600; // annual-billing carryover ceiling (used by the refill job)

function ocrAllowanceFor(plan: string | null | undefined): number {
  return OCR_MONTHLY_ALLOWANCE[(plan || "free").toLowerCase()] ?? OCR_MONTHLY_ALLOWANCE.free;
}

// Ensure an OCR balance row exists, seeding it from the agent's plan allowance
// on first use, and return the current balance. Free rows are seeded once and
// never refilled ("20 in perpetuity"); paid rows are topped up by the monthly
// job. Lazy seeding avoids backfilling every existing agent.
async function ensureOcrBalance(agentId: string): Promise<number> {
  const existing = await pool.query(
    "SELECT balance FROM agent_ocr_credits WHERE agent_id = $1",
    [agentId]
  );
  if (existing.rows.length > 0) return existing.rows[0].balance ?? 0;

  const planRes = await pool.query("SELECT plan FROM agents WHERE id = $1", [agentId]);
  const seed = ocrAllowanceFor(planRes.rows[0]?.plan);
  const period = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  await pool.query(
    `INSERT INTO agent_ocr_credits (agent_id, balance, total_used, period)
     VALUES ($1, $2, 0, $3)
     ON CONFLICT (agent_id) DO NOTHING`,
    [agentId, seed, period]
  );
  const again = await pool.query(
    "SELECT balance FROM agent_ocr_credits WHERE agent_id = $1",
    [agentId]
  );
  return again.rows[0]?.balance ?? 0;
}

// Draw down one OCR entry on a successful data-entry extraction. GREATEST
// guards against ever going negative on a race.
async function consumeOcr(agentId: string): Promise<void> {
  await pool.query(
    "UPDATE agent_ocr_credits SET balance = GREATEST(balance - 1, 0), total_used = total_used + 1, updated_at = NOW() WHERE agent_id = $1",
    [agentId]
  );
}

const NO_OCR_CREDITS_MSG =
  "You've used all the data-entry policies included in your plan for this period. Upgrade or wait for your monthly refill.";

// Strict limiter for mobile-number login. This endpoint checks a password, so
// it is a brute-force target in a way the rest of /api is not.
//
// 20/15min rather than something tighter because Indian mobile carriers route
// large subscriber pools through a handful of NAT gateways — a strict per-IP cap
// locks out real users who share an exit address with strangers. The generic
// failure response matters more than the ceiling here: an attacker learns
// nothing about whether the NUMBER was wrong or the PASSWORD was.
const consumerLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TOO_MANY_ATTEMPTS",
    message: "Too many login attempts. Please wait a few minutes and try again.",
  },
});

// Password-reset requests: 5 / hour / IP. Tighter than login because each one
// sends a real email to a third party — an unbounded endpoint is a way to spam
// someone else's inbox using our verified domain, which costs us the sending
// reputation SES took weeks to earn.
const forgotPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // Deliberately still shaped like the success response: a distinct 429 body
  // would let someone probe which addresses trigger a send.
  message: { ok: true },
});

// Strict limiter for public lead capture to stop lead-spam: 5 leads / hour / IP.
const leadsRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many submissions. Please try again later." },
});

/* ---------- TYPES ---------- */

interface AnalysisJob {
  id: string;
  // Owning agent. null/undefined = anonymous public-analyzer job (no client
  // ownership). Set for agent uploads so status/AI routes can enforce that one
  // agent can never read another agent's (or a client's) analysis by jobId.
  agentId?: string | null;
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
        ai_started_at, ai_ended_at, prompt_version, agent_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
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
        job.prompt_version || null,
        job.agentId ?? null
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
      agentId: r.agent_id ?? null,
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

/**
 * Why a PDF could not be read.
 *
 * The `message` on this error is written for the person who uploaded the file,
 * not for us. It is stored in individual_policies.error_message /
 * clients.error_message and rendered verbatim in the consumer portfolio, the
 * agent upload list and the admin portal, so it has to name the actual problem
 * ("password-protected", "a scan we couldn't read") and say what to do next.
 * Internal detail — the pdf.js exception — goes to the log and to
 * analysis_jobs.error, never into this message.
 *
 * `reason` is the stable, machine-readable half. Nothing keys off it today; it
 * exists so a caller can branch (or a dashboard can group) without parsing prose.
 */
export type PdfFailureReason =
  | "password_protected"
  | "scanned_unreadable"
  | "corrupt";

export class PdfExtractionError extends Error {
  constructor(readonly reason: PdfFailureReason, message: string) {
    super(message);
    this.name = "PdfExtractionError";
  }
}

const PDF_FAILURE_MESSAGE: Record<PdfFailureReason, string> = {
  password_protected:
    "This PDF is locked with a password, so we could not open it. Please remove the password and upload it again, or send it to our team and we will do it for you.",
  scanned_unreadable:
    "This looks like a scanned or photographed copy, and we could not read any text from it. We need the original PDF from your insurer — the one that came by email, where you can select the text. If you only have this copy, send it to our team and we will read it for you.",
  corrupt:
    "This file is damaged or is not a readable PDF. Please download a fresh copy from your insurer and upload it again, or send it to our team.",
};

/**
 * What to put in front of a person when their analysis dies.
 *
 * A PdfExtractionError already carries a message written for them, so it passes
 * through. Everything else is ours — a Gemini 429, a timeout, a TypeError — and
 * means nothing to someone who just uploaded a policy, so it is replaced. The
 * raw error still goes to the log and to analysis_jobs.error, which is where we
 * look when someone reports a failure.
 *
 * Used on the consumer lane only. The agent lane keeps raw errors in
 * clients.error_message on purpose: agents and the admin portal triage from it,
 * and a PdfExtractionError is already readable there without any mapping.
 */
function readableFailure(err: unknown): string {
  if (err instanceof PdfExtractionError) return err.message;
  const raw = typeof err === "string" ? err : (err as any)?.message ?? "";
  if (/does not appear to be a readable/i.test(raw)) {
    return (
      "We could not find a policy in this file. Please check that you uploaded the policy document " +
      "itself, not a receipt or a renewal notice. If it is the right file, send it to our team and " +
      "we will look at it."
    );
  }
  return (
    "We could not read this policy. Please try uploading it again. If it keeps failing, send it to " +
    "our team and we will check it for you."
  );
}

/**
 * Anything shorter than this is a header or a page number, not a policy.
 * Below it the PDF is treated as a scan and rejected, which also stops us
 * paying to analyse an extraction that was never going to score.
 */
const MIN_USABLE_TEXT_CHARS = 200;

/**
 * Text-layer extraction only. A PDF we cannot read is rejected, never OCR'd.
 *
 * DELIBERATE: no OCR path exists here. Insurer-issued PDFs are machine-readable
 * by definition, so a policy with no text layer is a phone photo or a desk-scan
 * of a printout — and running those through a model costs money on every upload
 * to produce a transcription nobody has verified. We would rather ask for the
 * original PDF, which the person almost always has in their email, and offer to
 * do it by hand when they genuinely do not. If you are about to add an OCR
 * fallback, that is the tradeoff you are reversing.
 */
export async function extractTextFromPDF(filePath: string): Promise<string> {
  const fileData = fs.readFileSync(filePath);
  const data = new Uint8Array(fileData);

  let text = "";
  try {
    const loadingTask = pdfjs.getDocument({ data, disableFontFace: true });
    const pdf = await loadingTask.promise;

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
  } catch (error: any) {
    if (error?.name === "PasswordException") {
      throw new PdfExtractionError("password_protected", PDF_FAILURE_MESSAGE.password_protected);
    }
    if (error?.name === "InvalidPDFException") {
      throw new PdfExtractionError("corrupt", PDF_FAILURE_MESSAGE.corrupt);
    }
    // A file pdf.js cannot open at all, for any other reason, is not something
    // we can read either. Reported as damaged rather than as a scan, because
    // "send us the original" is the wrong advice when the file itself is broken.
    console.warn("[PDF Extraction] pdf.js could not open the file:", error?.message?.substring(0, 150));
    throw new PdfExtractionError("corrupt", PDF_FAILURE_MESSAGE.corrupt);
  }

  if (text.trim().length >= MIN_USABLE_TEXT_CHARS) return text;

  console.warn(
    `[PDF Extraction] text layer yielded ${text.trim().length} chars — treating as a scan, not analysing`
  );
  throw new PdfExtractionError("scanned_unreadable", PDF_FAILURE_MESSAGE.scanned_unreadable);
}

async function extractTextFromPlain(filePath: string): Promise<string> {
  return fs.readFileSync(filePath, "utf-8");
}

// The subset of a multer upload that the extraction path actually uses. The
// deferred flow (upload while anonymous, analyse after signup) rehydrates a
// file from storage and has no multer request to borrow, so these functions
// take the four fields they read rather than a whole Express.Multer.File.
// Express.Multer.File satisfies this structurally, so existing callers are
// unaffected.
type PolicyFile = { path: string; originalname: string; size: number; mimetype: string };

/**
 * Transcribe an uploaded image — a photographed policy. This is the only OCR in
 * the app and it exists because an image has no text layer to read instead;
 * PDFs deliberately have no such fallback (see extractTextFromPDF).
 *
 * Metered like every other call: one gemini_usage_log row per attempt, success
 * or failure. Only ever reached from inside an analysis, which is behind the
 * quota check, so it cannot be spent by an account without slots.
 */
async function ocrWithGemini(
  buffer: Buffer,
  mimeType: string,
  apiKey: string,
  usageMeta?: Partial<import("./services/geminiUsage").GeminiCallMeta>
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const model = genAI.getGenerativeModel({ model: modelName });
  const startedAt = Date.now();

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "Transcribe all readable text from this insurance policy document. " +
                "Return plain text only. No formatting. No summaries.",
            },
            {
              inlineData: {
                data: buffer.toString("base64"),
                mimeType,
              },
            },
          ],
        },
      ],
    });

    const response = result.response;
    void logGeminiUsage(
      { feature: "image_ocr", ...usageMeta },
      { model: modelName, tokens: extractUsage(response), status: "ok", latencyMs: Date.now() - startedAt }
    );
    return response.text();
  } catch (err: any) {
    void logGeminiUsage(
      { feature: "image_ocr", ...usageMeta },
      { model: modelName, status: "error", latencyMs: Date.now() - startedAt, errorMessage: err?.message ?? String(err) }
    );
    throw err;
  }
}

async function extractTextFromImage(
  file: PolicyFile,
  apiKey: string,
  usageMeta?: Partial<import("./services/geminiUsage").GeminiCallMeta>
): Promise<string> {
  const buffer = fs.readFileSync(file.path);
  return ocrWithGemini(buffer, file.mimetype || "image/png", apiKey, usageMeta);
}

async function extractPolicyText(
  file: PolicyFile,
  usageMeta?: Partial<import("./services/geminiUsage").GeminiCallMeta>
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  if (file.mimetype.includes("pdf")) return extractTextFromPDF(file.path);
  if (file.mimetype.startsWith("image/")) return extractTextFromImage(file, apiKey, usageMeta);
  if (file.mimetype === "text/plain") return extractTextFromPlain(file.path);

  throw new Error(`Unsupported file type: ${file.mimetype}`);
}

/* ---------- JWT VERIFICATION HELPER ---------- */

// Cache verified tokens for a short window to avoid a Supabase round-trip on
// every request. Kept short (60s) so revoked/expired tokens stop working almost
// immediately rather than lingering for minutes.
// Key = token string, Value = { userId, expiresAt }
const tokenCache = new Map<string, { userId: string; expiresAt: number }>();
const TOKEN_CACHE_TTL_MS = 60_000; // 60 seconds

// Prune expired entries every 10 minutes so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of tokenCache) {
    if (entry.expiresAt <= now) tokenCache.delete(token);
  }
}, 10 * 60 * 1000);

// Resolve a bearer token to a verified user id (or null). Cached briefly
// (TOKEN_CACHE_TTL_MS). Exported so non-route modules (e.g. index.ts / Sach AI)
// can enforce ownership without duplicating Supabase verification.
export async function getUserIdFromToken(token: string): Promise<string | null> {
  if (!token) return null;
  const now = Date.now();

  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > now) {
    return cached.userId;
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  tokenCache.set(token, { userId: user.id, expiresAt: now + TOKEN_CACHE_TTL_MS });
  return user.id;
}

const verifyJwt = async (req: any, res: any): Promise<string | null> => {
  const authHeader = req.headers["authorization"] as string | undefined;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization" });
    return null;
  }

  const userId = await getUserIdFromToken(authHeader.slice(7));
  if (!userId) {
    res.status(401).json({ error: "Invalid or expired token" });
    return null;
  }

  return userId;
};

/* ---------- D2C CONSUMER ("INDIVIDUAL") AUTH + QUOTA ---------- */

// Resolve the caller as an INDIVIDUAL (D2C consumer) account. Verifies the
// Supabase JWT, rejects agent accounts, and requires an individual_profiles
// row. Symmetric to verifyJwt: keeps the consumer (/api/me/*) and agent
// (/api/agent/*) surfaces from bleeding into each other.
const requireIndividual = async (req: any, res: any): Promise<string | null> => {
  const authHeader = req.headers["authorization"] as string | undefined;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization" });
    return null;
  }
  const userId = await getUserIdFromToken(authHeader.slice(7));
  if (!userId) {
    res.status(401).json({ error: "Invalid or expired token" });
    return null;
  }
  const agentRow = await pool.query("SELECT 1 FROM agents WHERE id = $1", [userId]);
  if (agentRow.rows.length > 0) {
    res.status(403).json({ error: "WRONG_ACCOUNT_TYPE", message: "This is an agent account. Use the agent portal." });
    return null;
  }
  const profRow = await pool.query("SELECT 1 FROM individual_profiles WHERE id = $1", [userId]);
  if (profRow.rows.length === 0) {
    res.status(403).json({ error: "NO_PROFILE", message: "Account not initialised. Call /api/me/bootstrap." });
    return null;
  }
  return userId;
};

// THE single quota choke point. Runs BEFORE any Gemini spend on /api/me/analyze.
// Allow if: paid; OR under the per-type free slot cap. The free plan does not
// expire — it is capped by slots, so "trial_expired" is no longer returned.
async function checkIndividualQuota(
  userId: string,
  insuranceType: string
): Promise<{ allowed: boolean; reason?: string }> {
  const prof = await pool.query(
    "SELECT plan, trial_started_at FROM individual_profiles WHERE id = $1",
    [userId]
  );
  const row = prof.rows[0];
  if (!row) return { allowed: false, reason: "no_profile" };
  if (row.plan === "paid") return { allowed: true };

  // Free is forever, not a trial — it is limited by slots, not by time. The
  // trial gate used to sit here and returned "trial_expired" on day 31, which
  // locked a free user out of the one-policy-per-type allowance they still
  // had. Slots are now the only thing that meters the free plan.
  //
  // TRIAL_DAYS and trial_started_at are left in place: other endpoints still
  // read them, and the column records signup date regardless.
  const cnt = await pool.query(
    "SELECT count(*)::int AS c FROM individual_policies WHERE user_id = $1 AND insurance_type = $2 AND status <> 'error'",
    [userId, insuranceType]
  );
  if ((cnt.rows[0]?.c ?? 0) >= FREE_SLOTS_PER_TYPE) {
    return { allowed: false, reason: "slot_full" };
  }
  return { allowed: true };
}

// Best-effort parse of the free-form OCR expiry text into a real YYYY-MM-DD.
// Handles the common Indian-policy formats: ISO (2026-08-15), DD/MM/YYYY,
// DD-MM-YYYY, and "15 Aug 2026". Returns null when it can't be sure — the user
// then confirms/sets the renewal date themselves in the portfolio.
function parseExpiryToDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;

  const MONTHS: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const pad = (n: number) => String(n).padStart(2, "0");
  const valid = (y: number, m: number, d: number) =>
    y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;

  // ISO: 2026-08-15 (optionally with time)
  let m = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    if (valid(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  // DD/MM/YYYY or DD-MM-YYYY (Indian day-first convention)
  m = s.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (m) {
    let [d, mo, y] = [+m[1], +m[2], +m[3]];
    if (y < 100) y += 2000;
    if (valid(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  // "15 Aug 2026" / "15 August 2026" / "Aug 15, 2026"
  m = s.match(/\b(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})\b/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    const [d, y] = [+m[1], +m[3]];
    if (mo && valid(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  m = s.match(/\b([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    const [d, y] = [+m[2], +m[3]];
    if (mo && valid(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  return null;
}

/* ---------- CLIENT-DATA ACCESS AUDIT LOG ---------- */
// Append-only, best-effort record of who viewed/modified which client, when,
// and from where. Fire-and-forget: never throws, never blocks the response.
async function recordAccess(
  req: any,
  agentId: string | null,
  clientId: string | null,
  action: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO access_audit_log
         (agent_id, client_id, action, route, method, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        agentId ?? null,
        clientId ?? null,
        action,
        req.path,
        req.method,
        req.ip ?? null,
        req.headers["user-agent"] ?? null,
      ]
    );
  } catch (err: any) {
    console.error("recordAccess audit insert failed:", err?.message ?? err);
  }
}

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

  /* ── Public analyze: RETIRED — HARD WALL ─────────────────────────────────
     The anonymous analyzer was a Gemini cost leak: any stranger could upload a
     PDF, burn two AI calls (OCR + pipeline), see a verdict, and leave — we paid,
     captured nothing. D2C analysis now REQUIRES an account and goes through the
     metered /api/me/analyze. This route is kept only to hand old clients an
     explicit signal instead of silently 404-ing. */
  app.post("/api/analyze", (_req, res) => {
    return res.status(401).json({
      error: "AUTH_REQUIRED",
      message: "Please sign in to analyze a policy.",
    });
  });

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

    // This is the PUBLIC (unauthenticated) status endpoint for the anonymous
    // one-off analyzer. It must NEVER serve agent-owned jobs — those carry a
    // client's policy analysis and are only reachable via the authenticated
    // agent route. 404 (don't reveal existence) if the job belongs to an agent.
    if (job.agentId) {
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
      // This extraction pipeline is archived. It previously ran a full (billed)
      // OCR pass before returning an error — pure wasted spend. Return 410 Gone
      // immediately without running any extraction. The multer middleware above
      // still consumes the upload; clean up any temp file it wrote.
      try {
        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (cleanupErr: any) {
        console.warn("[extract-policy] temp file cleanup failed:", cleanupErr?.message);
      }
      return res.status(410).json({ error: "gone" });
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

  app.post("/api/generate-pdf", pdfRateLimiter, async (req, res) => {
    // Bound total concurrent headless-browser renders. Reject early (before we
    // ever launch Chromium) so a burst of requests can't exhaust memory/CPU.
    if (activePdfRenders >= MAX_CONCURRENT_PDF_RENDERS) {
      return res.status(429).json({
        error: "PDF service is busy. Please try again in a moment.",
      });
    }

    try {
      let { url } = req.body;

      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        // Relative URL: expand against the request host purely to form an
        // absolute URL. The Host header is attacker-controlled, so this does NOT
        // grant trust — the resulting host must still pass the static allowlist
        // below, which is built only from env/hardcoded values.
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

      // Allowlist is built ONLY from static/env sources. The client-supplied
      // Host header is deliberately NOT trusted here: trusting it would let any
      // caller set Host to an arbitrary value and defeat the allowlist entirely.
      const allowedHosts = new Set<string>();
      [process.env.PUBLIC_URL, ...(process.env.CORS_ORIGIN || "").split(",")]
        .filter(Boolean)
        .forEach((u) => { try { allowedHosts.add(new URL(u!.trim()).host); } catch { /* ignore */ } });
      ["indsure.in", "www.indsure.in", "beta.indsure.in"].forEach((h) => {
        allowedHosts.add(h);
        allowedHosts.add(`https://${h}`.replace("https://", ""));
      });

      // Reusable private-range test, applied to both the literal hostname and
      // (below) the DNS-resolved IP to defeat DNS rebinding.
      // Cloud metadata, link-local, loopback and RFC1918 ranges are ALWAYS
      // blocked — never depend on NODE_ENV here (this box runs as "development").
      const isPrivateHost = (h: string): boolean => {
        const host = h.toLowerCase();
        return (
          /^(127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0)/.test(host) ||
          /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
          /^(::1|fc00:|fd00:|fe80:)/.test(host) ||
          host === "localhost" ||
          host === "metadata.google.internal"
        );
      };

      const hostname = parsedUrl.hostname.toLowerCase();

      if (isPrivateHost(hostname)) {
        return res.status(400).json({ error: "Target host not allowed" });
      }
      // Only render pages on our own / explicitly-allowed hosts.
      if (!allowedHosts.has(parsedUrl.host)) {
        return res.status(400).json({ error: "Target host not allowed" });
      }

      // Anti-rebinding: resolve the hostname and re-check the actual IP against
      // the private ranges. An allowlisted name that resolves to an internal IP
      // is rejected. Best-effort — DNS failures fall through to the launch (the
      // navigation itself will then simply fail), so the happy path is intact.
      try {
        const resolved = await dns.promises.lookup(hostname, { all: true });
        if (resolved.some((r) => isPrivateHost(r.address))) {
          return res.status(400).json({ error: "Target host not allowed" });
        }
      } catch {
        /* DNS lookup failed — do not block the happy path on resolver hiccups */
      }

      const { chromium } = await import("playwright");

      activePdfRenders++;
      let browser: import("playwright").Browser | null = null;
      try {
        browser = await chromium.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const page = await browser.newPage();
        await page.setViewportSize({ width: 1200, height: 1600 });
        // Hard navigation timeout: never wait indefinitely on a hung/slow page.
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(1000);

        const pdfBuffer = await page.pdf({
          format: "A4",
          printBackground: true,
          margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" },
          preferCSSPageSize: false,
          scale: 0.8,
          displayHeaderFooter: false,
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="IndSure-report.pdf"`
        );
        res.send(pdfBuffer);
      } finally {
        // Bulletproof cleanup: the browser is ALWAYS closed and the concurrency
        // slot ALWAYS released, even if navigation hung/threw above.
        if (browser) await browser.close().catch(() => { });
        activePdfRenders--;
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
      const { id, email, full_name, phone, city, experience_years, invite_code, marketing_consent } =
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
        `INSERT INTO agents (id, email, full_name, name, phone, city, location, experience_years, invite_code, consent_given_at, marketing_consent)
         VALUES ($1, $2, $3, $3, $4, $5, $5, $6, $7, NOW(), $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          id,
          email,
          full_name,
          phone || null,
          city || null,
          experience_years || 0,
          invite_code || null,
          marketing_consent ?? false,
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
    const agentId = await verifyJwt(req, res);
    if (!agentId) return;

    const { batchId } = req.body;
    if (!batchId) return res.status(400).json({ error: "batchId is required" });

    res.json({ status: "started", batchId });

    (async () => {
      try {

        // ATOMIC CLAIM: flip pending -> processing in a single statement and take
        // only the rows THIS call actually claimed. If trigger-batch-process is
        // fired twice for the same batch (double-submit, client retry on the
        // fire-and-forget request, remount), the second run's UPDATE matches no
        // 'pending' rows and returns [], so nothing is audited twice. Scoped to
        // the caller's agent_id so a batch id can't be processed cross-agent.
        const clientsRes = await pool.query(
          `UPDATE clients SET status = 'processing'
             WHERE batch_id = $1 AND agent_id = $2 AND status = 'pending'
           RETURNING *`,
          [batchId, agentId]
        );
        const clients = clientsRes.rows;

        for (const client of clients) {
          try {
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

            const analysisResult = await runAnalysisPipeline(policyText, "health", {
              route: "/api/agent/trigger-batch-process",
              sourceType: "agent",
              actorId: agentId,
              clientId: client.id,
            });

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

      recordAccess(req, agentId, client_id, "view_client");
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
        userContent,
        undefined,
        { feature: "switch_reco", route: "/api/agent/switch-recommendation", sourceType: "agent", actorId: agentId }
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

  /* ── Agent: Upload a policy onto a LEAD (light, OCR-optional) ─────────────
   * Stores a prospect's existing policy file against an agent_leads row and,
   * if asked, runs the cheap OCR-only data-entry extraction (motor/life/
   * travel/property) to prefill insurer / policy name / holder / premium /
   * due date. No forensic analysis, no credits. Manual add + all edits go
   * straight through supabase-js (RLS); this endpoint is only for the file +
   * OCR step, which needs storage-admin and the extraction pipeline.
   */
  app.post(
    "/api/agent/leads/:leadId/policy",
    (req, res, next) => {
      upload.single("file")(req, res, (err: any) => {
        if (err) {
          console.error("LEAD POLICY MULTER ERROR:", err);
          return res.status(400).json({ error: "File upload failed: " + (err.message || "Unknown error") });
        }
        next();
      });
    },
    async (req, res) => {
      const agentId = await verifyJwt(req, res);
      if (!agentId) return;

      const { leadId } = req.params;
      try {
        const leadRes = await pool.query(
          "SELECT id FROM agent_leads WHERE id = $1 AND agent_id = $2",
          [leadId, agentId]
        );
        if (leadRes.rows.length === 0) return res.status(404).json({ error: "Lead not found" });

        const type = String(req.body.type || "motor").toLowerCase();
        const wantOcr = String(req.body.ocr) === "true";

        // Manual fields (overrides; win over OCR when provided).
        const manual = {
          insurer: req.body.insurer || null,
          policy_name: req.body.policy_name || null,
          policyholder_name: req.body.policyholder_name || null,
          premium: req.body.premium ? Number(req.body.premium) : null,
          due_date: req.body.due_date || null,
        };

        const policyId = crypto.randomUUID();
        let fileUrl: string | null = null;
        let fileName: string | null = null;
        let extracted: any = null;
        let ocrSkipped = false; // OCR asked for but no allowance left
        const ocr: Record<string, any> = {};

        if (req.file) {
          const file = req.file;
          fileName = file.originalname;

          if (wantOcr && isDataEntryType(type)) {
            // OCR here is the same paid Gemini call as the upload lane, so it
            // draws from the agent's OCR allowance. If the balance is spent we
            // skip OCR (rather than 403) so the file + manual fields still save.
            const ocrBalance = await ensureOcrBalance(agentId);
            if (ocrBalance <= 0) {
              ocrSkipped = true;
            } else {
              try {
                const text = await extractPolicyText(file, {
                  feature: "image_ocr",
                  route: "/api/agent/data-entry",
                  sourceType: "agent",
                  actorId: agentId,
                });
                const extraction = await extractStructuredData(text, type, {
                  route: "/api/agent/data-entry",
                  sourceType: "agent",
                  actorId: agentId,
                });
                if (extraction.status === "completed") {
                  await consumeOcr(agentId);
                  extracted = extraction.data;
                  const shared = deriveSharedColumns(type, extraction.data);
                  ocr.insurer = shared.insurer ?? null;
                  ocr.policy_name = shared.policy_name ?? null;
                  ocr.policyholder_name = shared.policyholder_name ?? null;
                  ocr.premium = extraction.data?.premium != null ? Number(extraction.data.premium) : null;
                  ocr.due_date = shared.expiry_date ?? null;
                }
              } catch (ocrErr: any) {
                console.warn(`[lead-policy ${policyId}] OCR failed:`, ocrErr?.message);
              }
            }
          }

          try {
            const fileBuffer = fs.readFileSync(file.path);
            const ext = file.originalname.includes(".") ? file.originalname.split(".").pop() : "pdf";
            const storagePath = `${agentId}/lead-policies/${policyId}.${ext}`;
            const { error: upErr } = await supabaseAdmin.storage
              .from(PDF_BUCKET)
              .upload(storagePath, fileBuffer, { contentType: file.mimetype || "application/pdf", upsert: true });
            if (upErr) {
              console.error(`[lead-policy ${policyId}] storage upload failed:`, upErr.message);
            } else {
              const { data: signed } = await supabaseAdmin.storage
                .from(PDF_BUCKET)
                .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
              fileUrl = signed?.signedUrl ?? null;
            }
          } catch (storeErr: any) {
            console.error(`[lead-policy ${policyId}] storage error:`, storeErr?.message);
          } finally {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          }
        }

        // OCR fills blanks; an explicitly typed manual value always wins.
        const pick = (k: string) => (manual as any)[k] ?? ocr[k] ?? null;
        const ins = await pool.query(
          `INSERT INTO lead_policies (
             id, lead_id, agent_id, insurance_type, insurer, policy_name,
             policyholder_name, premium, due_date, file_url, file_name, extracted_data
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
          [
            policyId, leadId, agentId, type,
            pick("insurer"), pick("policy_name"), pick("policyholder_name"),
            pick("premium"), pick("due_date"), fileUrl, fileName,
            extracted ? JSON.stringify(extracted) : null,
          ]
        );
        return res.json({ ...ins.rows[0], ocr_skipped: ocrSkipped });
      } catch (err: any) {
        console.error("create lead policy error:", err);
        return res.status(500).json({ error: "Could not save the policy" });
      }
    }
  );

  /* ═══════════════════════════════════════════════════════════════════════
   * CLAIMS DESK
   *
   * An advisor tracks a customer's health claim from first consultation to
   * settlement letter. ZERO AI in this lane: no OCR, no extraction, no scoring.
   * Every field is typed. Note that the extraction pipeline is deliberately NOT
   * referenced anywhere below — adding a model call here should require a
   * visible new import, not a quiet flag flip.
   *
   * Retention: documents live 30 days from the FIRST upload, extendable once by
   * 30 more while the claim is open, hard ceiling 60. The daily sweep that
   * actually destroys them lives in index.ts next to the other lifecycle jobs.
   * ═══════════════════════════════════════════════════════════════════════ */

  const CLAIM_RETENTION_DAYS = 30;
  const CLAIM_EXTENSION_DAYS = 30;
  // Extend unlocks this many days before purge_at — i.e. day 25 of the first 30.
  const CLAIM_EXTEND_UNLOCK_DAYS = 5;

  const CLAIM_TERMINAL = ["settled", "rejected"];
  const CLAIM_STATUSES = [
    "opened", "docs_received", "submitted", "under_process",
    "query_raised", "settled", "rejected",
  ];

  // Ownership check. Every claim route starts here, so a claim id from another
  // agent is a 404 rather than a 403 — we do not confirm the row exists.
  async function claimForAgent(claimId: string, agentId: string) {
    const r = await pool.query(
      "SELECT * FROM claims WHERE id = $1 AND agent_id = $2",
      [claimId, agentId]
    );
    return r.rows[0] ?? null;
  }

  async function logClaimEvent(
    claimId: string, agentId: string, status: string, note?: string | null
  ) {
    try {
      await pool.query(
        `INSERT INTO claim_events (claim_id, agent_id, status, note)
         VALUES ($1, $2, $3, $4)`,
        [claimId, agentId, status, note ?? null]
      );
    } catch (e: any) {
      // The timeline is a record, not a gate — never fail the caller for it.
      console.error(`[claims ${claimId}] event log failed:`, e?.message ?? e);
    }
  }

  // Amounts arrive as free text from a phone keyboard: "1,85,000", "₹185000",
  // "185000 ". Number() returns NaN for the first two, and anything wider than
  // the column used to reach Postgres and come back as "numeric field
  // overflow" — which the advisor saw as a bare 500 mid-way through closing a
  // claim. Parse defensively here and let the caller answer 400 in words.
  const CLAIM_AMOUNT_MAX = 999999999999.99; // numeric(14,2)
  function parseMoney(
    raw: unknown
  ): { ok: true; value: number | null } | { ok: false; message: string } {
    if (raw == null || raw === "") return { ok: true, value: null };
    const cleaned = String(raw).replace(/[₹,\s_]/g, "");
    if (cleaned === "") return { ok: true, value: null };
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return { ok: false, message: "Enter the amount in numbers only." };
    if (n < 0) return { ok: false, message: "Amount cannot be negative." };
    if (n > CLAIM_AMOUNT_MAX) return { ok: false, message: "That amount is too large. Check the figure." };
    return { ok: true, value: Math.round(n * 100) / 100 };
  }

  // An insurer cannot pay out more than was asked for, so a settled figure
  // above the claimed one is a typo — usually a digit too many, which is
  // exactly the mistake that matters here because these two numbers are what
  // the advisor's track record is computed from.
  //
  // Checked as a PAIR, not per field: editing the CLAIMED amount downward
  // breaks the relationship just as surely as raising the settled one, so both
  // write paths compare the values the row will actually end up holding.
  function checkAmountPair(
    claimed: unknown,
    settled: unknown
  ): { ok: true } | { ok: false; message: string } {
    if (claimed == null || settled == null) return { ok: true };
    const c = Number(claimed);
    const s = Number(settled);
    if (!Number.isFinite(c) || !Number.isFinite(s)) return { ok: true };
    if (s > c) {
      return {
        ok: false,
        message: `The settled amount cannot be more than the amount claimed (₹${c.toLocaleString("en-IN")}).`,
      };
    }
    return { ok: true };
  }

  // Closing a claim destroys its personal and case documents immediately —
  // the purpose they were collected for has ended, so holding them to the
  // 30-day mark would be keeping identity documents for no reason. The outcome
  // letter is what survives; it is the proof the advisor closes claims.
  //
  // Same ordering as the sweeps: objects first, rows second.
  async function purgeClaimWorkingDocuments(claimId: string, agentId: string) {
    const { rows: docs } = await pool.query(
      `SELECT id, storage_path FROM claim_documents
        WHERE claim_id = $1 AND category IN ('personal','case')`,
      [claimId]
    );
    if (docs.length > 0) {
      const { error } = await supabaseAdmin.storage
        .from(PDF_BUCKET)
        .remove(docs.map((d: any) => d.storage_path));
      if (error) {
        console.error(`[claims ${claimId}] close-purge objects failed:`, error.message);
        return 0; // leave the rows; the daily sweep retries the pair together
      }
      await pool.query("DELETE FROM claim_documents WHERE id = ANY($1::uuid[])", [
        docs.map((d: any) => d.id),
      ]);
    }
    // Only stamp when something was actually destroyed. Stamping a claim that
    // never held a working document would make the UI announce a deletion that
    // never happened, and would hide the piles on a claim that may be reopened.
    if (docs.length > 0) {
      await pool.query(
        "UPDATE claims SET documents_purged_at = COALESCE(documents_purged_at, now()) WHERE id = $1",
        [claimId]
      );
      await logClaimEvent(
        claimId, agentId, "documents_purged",
        `${docs.length} document(s) deleted on closing. The insurer's letter is kept.`
      );
    }
    return docs.length;
  }

  // A claim ends one way or the other. If a settlement letter was uploaded and
  // the claim is then rejected (or the advisor changes his mind mid-dialog),
  // the losing letter is removed rather than left sitting alongside the winner
  // — two contradictory outcomes on one claim is not a record anyone can show.
  async function dropContradictingOutcomeDocs(claimId: string, keepKind: "settled" | "rejected") {
    const losing = keepKind === "settled" ? "Rejection letter" : "Settlement letter";
    const { rows } = await pool.query(
      `SELECT id, storage_path FROM claim_documents
        WHERE claim_id = $1 AND category = 'outcome' AND doc_type = $2`,
      [claimId, losing]
    );
    if (rows.length === 0) return;
    const { error } = await supabaseAdmin.storage
      .from(PDF_BUCKET)
      .remove(rows.map((r: any) => r.storage_path));
    if (error) {
      console.error(`[claims ${claimId}] contradicting outcome remove failed:`, error.message);
      return;
    }
    await pool.query("DELETE FROM claim_documents WHERE id = ANY($1::uuid[])", [
      rows.map((r: any) => r.id),
    ]);
  }

  async function openQueryCount(claimId: string): Promise<number> {
    const r = await pool.query(
      "SELECT count(*)::int AS c FROM claim_queries WHERE claim_id = $1 AND resolved_on IS NULL",
      [claimId]
    );
    return r.rows[0]?.c ?? 0;
  }

  /* ── Agent: list claims ───────────────────────────────────────────────── */
  app.get("/api/agent/claims", async (req, res) => {
    const agentId = await verifyJwt(req, res);
    if (!agentId) return;
    try {
      const result = await pool.query(
        `SELECT c.*,
                cu.name  AS customer_name,
                cu.phone AS customer_phone,
                (SELECT count(*)::int FROM claim_queries q
                   WHERE q.claim_id = c.id AND q.resolved_on IS NULL) AS open_queries,
                (SELECT count(*)::int FROM claim_queries q
                   WHERE q.claim_id = c.id)                            AS total_queries,
                (SELECT count(*)::int FROM claim_documents d
                   WHERE d.claim_id = c.id)                            AS document_count,
                CASE WHEN c.purge_at IS NULL THEN NULL
                     ELSE GREATEST(0, EXTRACT(DAY FROM (c.purge_at - now()))::int)
                END AS days_to_purge
           FROM claims c
           LEFT JOIN customers cu ON cu.id = c.customer_id
          WHERE c.agent_id = $1
          ORDER BY
            -- Needs-attention first: open queries, then nearest purge, then new.
            (SELECT count(*) FROM claim_queries q
               WHERE q.claim_id = c.id AND q.resolved_on IS NULL) DESC,
            c.purge_at ASC NULLS LAST,
            c.created_at DESC`,
        [agentId]
      );
      return res.json(result.rows);
    } catch (err: any) {
      console.error("list claims error:", err);
      return res.status(500).json({ error: "Could not load claims" });
    }
  });

  /* ── Agent: open a claim ──────────────────────────────────────────────── */
  app.post("/api/agent/claims", async (req, res) => {
    const agentId = await verifyJwt(req, res);
    if (!agentId) return;

    const {
      customer_id, new_customer_name, new_customer_phone,
      claim_type, insurer, tpa, policy_number, hospital, ailment,
      claimed_amount, admitted_on, discharged_on,
    } = req.body ?? {};

    const type = String(claim_type || "reimbursement").toLowerCase();
    if (type !== "cashless" && type !== "reimbursement") {
      return res.status(400).json({ error: "claim_type must be cashless or reimbursement" });
    }

    try {
      // Resolve the customer: an existing one this agent owns, or create it
      // inline so a walk-in claim never forces a detour through Customers.
      let resolvedCustomerId: string | null = null;
      if (customer_id) {
        const own = await pool.query(
          "SELECT id FROM customers WHERE id = $1 AND agent_id = $2",
          [customer_id, agentId]
        );
        if (own.rows.length === 0) return res.status(404).json({ error: "Customer not found" });
        resolvedCustomerId = customer_id;
      } else if (new_customer_name) {
        const created = await pool.query(
          `INSERT INTO customers (agent_id, name, phone) VALUES ($1, $2, $3) RETURNING id`,
          [agentId, String(new_customer_name).trim(), new_customer_phone || null]
        );
        resolvedCustomerId = created.rows[0].id;
      } else {
        return res.status(400).json({ error: "Pick a customer, or give a name for a new one" });
      }

      const money = parseMoney(claimed_amount);
      if (!money.ok) return res.status(400).json({ error: "BAD_AMOUNT", message: money.message });

      const ins = await pool.query(
        `INSERT INTO claims
           (agent_id, customer_id, claim_type, insurer, tpa, policy_number,
            hospital, ailment, claimed_amount, admitted_on, discharged_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          agentId, resolvedCustomerId, type,
          insurer || null, tpa || null, policy_number || null,
          hospital || null, ailment || null,
          money.value,
          admitted_on || null, discharged_on || null,
        ]
      );
      const claim = ins.rows[0];
      await logClaimEvent(claim.id, agentId, "opened", "Claim opened");
      void recordAccess(req, agentId, claim.id, "claim_open");
      return res.json(claim);
    } catch (err: any) {
      console.error("create claim error:", err);
      return res.status(500).json({ error: "Could not open the claim" });
    }
  });

  /* ── Agent: one claim, with documents, queries and timeline ───────────── */
  app.get("/api/agent/claims/:id", async (req, res) => {
    const agentId = await verifyJwt(req, res);
    if (!agentId) return;
    try {
      const c = await pool.query(
        `SELECT c.*, cu.name AS customer_name, cu.phone AS customer_phone,
                CASE WHEN c.purge_at IS NULL THEN NULL
                     ELSE GREATEST(0, EXTRACT(DAY FROM (c.purge_at - now()))::int)
                END AS days_to_purge,
                (c.purge_at IS NOT NULL
                   AND NOT c.extension_used
                   AND c.status NOT IN ('settled','rejected')
                   AND now() >= c.purge_at - make_interval(days => $3)) AS can_extend
           FROM claims c
           LEFT JOIN customers cu ON cu.id = c.customer_id
          WHERE c.id = $1 AND c.agent_id = $2`,
        [req.params.id, agentId, CLAIM_EXTEND_UNLOCK_DAYS]
      );
      if (c.rows.length === 0) return res.status(404).json({ error: "Claim not found" });

      const [docs, queries, events] = await Promise.all([
        pool.query(
          `SELECT id, claim_id, query_id, category, doc_type, filename,
                  file_size, mime_type, uploaded_at
             FROM claim_documents WHERE claim_id = $1
            ORDER BY uploaded_at ASC`,
          [req.params.id]
        ),
        pool.query(
          "SELECT * FROM claim_queries WHERE claim_id = $1 ORDER BY seq ASC",
          [req.params.id]
        ),
        pool.query(
          "SELECT * FROM claim_events WHERE claim_id = $1 ORDER BY occurred_at ASC",
          [req.params.id]
        ),
      ]);

      void recordAccess(req, agentId, req.params.id, "claim_view");
      // storage_path is deliberately not returned — the browser never needs it,
      // and a URL is minted per document through the route below.
      return res.json({
        ...c.rows[0],
        documents: docs.rows,
        queries: queries.rows,
        events: events.rows,
      });
    } catch (err: any) {
      console.error("get claim error:", err);
      return res.status(500).json({ error: "Could not load the claim" });
    }
  });

  /* ── Agent: edit the typed fields ─────────────────────────────────────────
   * Every accepted change is written to the timeline in words — "Insurer: Tata
   * → Tata AIG" — because on a record whose documents are destroyed on a clock,
   * the history of what the advisor asserted and when IS the audit trail. A
   * silent edit would leave the timeline claiming things the row no longer says.
   */
  app.patch("/api/agent/claims/:id", async (req, res) => {
    const agentId = await verifyJwt(req, res);
    if (!agentId) return;

    const LABELS: Record<string, string> = {
      insurer: "Insurer", tpa: "TPA", policy_number: "Policy number",
      hospital: "Hospital", ailment: "What happened",
      claimed_amount: "Amount claimed", settled_amount: "Amount settled",
      admitted_on: "Admitted on", discharged_on: "Discharged on",
      claim_type: "Type of claim",
    };
    const MONEY = new Set(["claimed_amount", "settled_amount"]);

    const sets: string[] = [];
    const vals: any[] = [];
    const wanted: Record<string, any> = {};

    for (const key of Object.keys(LABELS)) {
      if (req.body?.[key] === undefined) continue;
      let value: any = req.body[key] === "" ? null : req.body[key];
      if (MONEY.has(key)) {
        const parsed = parseMoney(req.body[key]);
        if (!parsed.ok) return res.status(400).json({ error: "BAD_AMOUNT", message: parsed.message });
        value = parsed.value;
      }
      if (key === "claim_type" && value && !["cashless", "reimbursement"].includes(String(value))) {
        return res.status(400).json({ error: "claim_type must be cashless or reimbursement" });
      }
      wanted[key] = value;
      vals.push(value);
      sets.push(`${key} = $${vals.length}`);
    }
    if (sets.length === 0) return res.status(400).json({ error: "Nothing to update" });

    try {
      const before = await claimForAgent(req.params.id, agentId);
      if (!before) return res.status(404).json({ error: "Claim not found" });

      // Compare what the row will HOLD after this edit, so lowering the claimed
      // amount under an existing settled figure is caught too.
      //
      // Only when the edit actually TOUCHES an amount, though. Rows written
      // before this rule existed can already violate it, and refusing to let
      // the advisor correct the hospital name on such a claim — with an error
      // about amounts he did not touch — would trap the row permanently, with
      // no way to reach the very fields that would fix it.
      const touchesMoney = "claimed_amount" in wanted || "settled_amount" in wanted;
      if (touchesMoney) {
        const nextClaimed = "claimed_amount" in wanted ? wanted.claimed_amount : before.claimed_amount;
        const nextSettled = "settled_amount" in wanted ? wanted.settled_amount : before.settled_amount;
        const pair = checkAmountPair(nextClaimed, nextSettled);
        if (!pair.ok) return res.status(400).json({ error: "BAD_AMOUNT", message: pair.message });
      }

      vals.push(req.params.id, agentId);
      const upd = await pool.query(
        `UPDATE claims SET ${sets.join(", ")}, updated_at = now()
          WHERE id = $${vals.length - 1} AND agent_id = $${vals.length}
          RETURNING *`,
        vals
      );
      if (upd.rows.length === 0) return res.status(404).json({ error: "Claim not found" });

      // Compare loosely: numerics come back from pg as strings, and an
      // unchanged field resubmitted by the form must not fake a change.
      const show = (v: any) => (v == null || v === "" ? "—" : String(v));
      const changes = Object.entries(wanted)
        .filter(([k, v]) => show((before as any)[k]) !== show(v) && Number((before as any)[k]) !== Number(v as any))
        .map(([k, v]) => `${LABELS[k]}: ${show((before as any)[k])} → ${show(v)}`);

      if (changes.length > 0) {
        await logClaimEvent(req.params.id, agentId, "details_edited", changes.join(" · "));
      }
      return res.json(upd.rows[0]);
    } catch (err: any) {
      console.error("update claim error:", err);
      return res.status(500).json({ error: "Could not save the change" });
    }
  });

  /* ── Agent: move the claim ────────────────────────────────────────────────
   * Deliberately permissive about ORDER. A 40+ advisor logging a claim after
   * the fact should not be told he cannot record what already happened, so any
   * of the non-terminal states can be set at any time. Two hard rules remain:
   * settling or rejecting needs proof attached, and query_raised is owned by
   * the queries routes rather than settable by hand.
   */
  app.post("/api/agent/claims/:id/status", async (req, res) => {
    const agentId = await verifyJwt(req, res);
    if (!agentId) return;

    const next = String(req.body?.status || "").toLowerCase();
    const note = req.body?.note || null;
    const settledAmount = req.body?.settled_amount;
    const proofConsent = req.body?.proof_consent === true;

    if (!CLAIM_STATUSES.includes(next)) {
      return res.status(400).json({ error: "Unknown status" });
    }
    if (next === "query_raised") {
      return res.status(400).json({
        error: "Log the query itself so it keeps its own question and dates.",
        use: "POST /api/agent/claims/:id/queries",
      });
    }

    try {
      const claim = await claimForAgent(req.params.id, agentId);
      if (!claim) return res.status(404).json({ error: "Claim not found" });

      const closing = CLAIM_TERMINAL.includes(next);
      const reopening = CLAIM_TERMINAL.includes(claim.status) && !closing;

      const money = parseMoney(settledAmount);
      if (!money.ok) return res.status(400).json({ error: "BAD_AMOUNT", message: money.message });

      if (money.value != null) {
        const pair = checkAmountPair(claim.claimed_amount, money.value);
        if (!pair.ok) return res.status(400).json({ error: "BAD_AMOUNT", message: pair.message });
      }

      if (closing) {
        // Count only proof that will still be here afterwards. Counting every
        // outcome document would let a settlement letter satisfy a REJECTION
        // and then be deleted as contradicting, closing the claim on nothing.
        const losing = next === "settled" ? "Rejection letter" : "Settlement letter";
        const proof = await pool.query(
          `SELECT count(*)::int AS c FROM claim_documents
            WHERE claim_id = $1 AND category = 'outcome' AND doc_type IS DISTINCT FROM $2`,
          [claim.id, losing]
        );
        if ((proof.rows[0]?.c ?? 0) === 0) {
          return res.status(400).json({
            error: "NEEDS_PROOF",
            message: "Attach the insurer's letter before closing the claim.",
          });
        }
        await dropContradictingOutcomeDocs(claim.id, next as "settled" | "rejected");
      }

      const upd = await pool.query(
        `UPDATE claims
            SET status = $1,
                settled_amount = CASE WHEN $7 THEN NULL
                                      ELSE COALESCE($2, settled_amount) END,
                closed_at = CASE WHEN $3 THEN now() ELSE NULL END,
                proof_consent_at = CASE WHEN $4 THEN COALESCE(proof_consent_at, now())
                                        ELSE proof_consent_at END,
                updated_at = now()
          WHERE id = $5 AND agent_id = $6
          RETURNING *`,
        [next, money.value, closing, proofConsent, claim.id, agentId, reopening]
      );

      if (reopening) {
        await logClaimEvent(
          claim.id, agentId, "reopened",
          `Reopened from ${claim.status}. Working documents were already deleted and cannot be recovered.`
        );
      } else {
        await logClaimEvent(claim.id, agentId, next, note);
      }

      // Closing ends the purpose the identity and case documents were collected
      // for, so they go now rather than waiting out the 30-day clock. The
      // insurer's letter is deliberately left standing.
      let purged = 0;
      if (closing) purged = await purgeClaimWorkingDocuments(claim.id, agentId);

      void recordAccess(req, agentId, claim.id, `claim_status_${next}`);
      const fresh = await claimForAgent(claim.id, agentId);
      return res.json({ ...(fresh ?? upd.rows[0]), purged_on_close: purged });
    } catch (err: any) {
      console.error("claim status error:", err);
      return res.status(500).json({ error: "Could not update the claim" });
    }
  });

  /* ── Agent: log an insurer query round ────────────────────────────────────
   * No cap. Insurers routinely raise two or three rounds and a messy claim can
   * run to five; each gets its own row, question, dates and reply papers.
   */
  app.post("/api/agent/claims/:id/queries", async (req, res) => {
    const agentId = await verifyJwt(req, res);
    if (!agentId) return;

    const question = String(req.body?.question || "").trim();
    if (!question) return res.status(400).json({ error: "Write down what the insurer asked" });

    try {
      const claim = await claimForAgent(req.params.id, agentId);
      if (!claim) return res.status(404).json({ error: "Claim not found" });

      // seq is max+1 and never reused, so deleting a mis-logged round leaves a
      // gap rather than renumbering history under the advisor's feet.
      const seqRow = await pool.query(
        "SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM claim_queries WHERE claim_id = $1",
        [claim.id]
      );
      const seq = seqRow.rows[0].next;

      const ins = await pool.query(
        `INSERT INTO claim_queries (claim_id, agent_id, seq, question, raised_on, raised_by)
         VALUES ($1,$2,$3,$4,COALESCE($5::date, CURRENT_DATE),$6)
         RETURNING *`,
        [claim.id, agentId, seq, question, req.body?.raised_on || null, req.body?.raised_by || null]
      );

      await pool.query(
        `UPDATE claims SET status = 'query_raised', updated_at = now()
          WHERE id = $1 AND agent_id = $2 AND status NOT IN ('settled','rejected')`,
        [claim.id, agentId]
      );
      await logClaimEvent(claim.id, agentId, "query_raised", `Round ${seq}: ${question}`);
      return res.json(ins.rows[0]);
    } catch (err: any) {
      console.error("create claim query error:", err);
      return res.status(500).json({ error: "Could not save the query" });
    }
  });

  /* ── Agent: edit or resolve a query round ─────────────────────────────── */
  app.patch("/api/agent/claims/:id/queries/:queryId", async (req, res) => {
    const agentId = await verifyJwt(req, res);
    if (!agentId) return;
    try {
      const claim = await claimForAgent(req.params.id, agentId);
      if (!claim) return res.status(404).json({ error: "Claim not found" });

      const sets: string[] = [];
      const vals: any[] = [];
      for (const key of ["question", "raised_on", "raised_by", "resolution_note"]) {
        if (req.body?.[key] !== undefined) {
          vals.push(req.body[key] === "" ? null : req.body[key]);
          sets.push(`${key} = $${vals.length}`);
        }
      }
      // resolve: true stamps today; passing an explicit resolved_on wins.
      if (req.body?.resolved_on !== undefined) {
        vals.push(req.body.resolved_on || null);
        sets.push(`resolved_on = $${vals.length}`);
      } else if (req.body?.resolve === true) {
        sets.push("resolved_on = CURRENT_DATE");
      } else if (req.body?.resolve === false) {
        sets.push("resolved_on = NULL");
      }
      if (sets.length === 0) return res.status(400).json({ error: "Nothing to update" });

      vals.push(req.params.queryId, claim.id);
      const upd = await pool.query(
        `UPDATE claim_queries SET ${sets.join(", ")}
          WHERE id = $${vals.length - 1} AND claim_id = $${vals.length}
          RETURNING *`,
        vals
      );
      if (upd.rows.length === 0) return res.status(404).json({ error: "Query not found" });
      const row = upd.rows[0];

      // The claim leaves query_raised only when the LAST open round closes.
      const stillOpen = await openQueryCount(claim.id);
      if (stillOpen === 0 && !CLAIM_TERMINAL.includes(claim.status)) {
        await pool.query(
          `UPDATE claims SET status = 'under_process', updated_at = now() WHERE id = $1`,
          [claim.id]
        );
      }
      if (row.resolved_on) {
        await logClaimEvent(claim.id, agentId, "query_resolved", `Round ${row.seq} resolved`);
      }
      return res.json({ ...row, open_queries: stillOpen });
    } catch (err: any) {
      console.error("update claim query error:", err);
      return res.status(500).json({ error: "Could not update the query" });
    }
  });

  /* ── Agent: remove a query logged by mistake ──────────────────────────── */
  app.delete("/api/agent/claims/:id/queries/:queryId", async (req, res) => {
    const agentId = await verifyJwt(req, res);
    if (!agentId) return;
    try {
      const claim = await claimForAgent(req.params.id, agentId);
      if (!claim) return res.status(404).json({ error: "Claim not found" });
      await pool.query(
        "DELETE FROM claim_queries WHERE id = $1 AND claim_id = $2",
        [req.params.queryId, claim.id]
      );
      const stillOpen = await openQueryCount(claim.id);
      if (stillOpen === 0 && !CLAIM_TERMINAL.includes(claim.status)) {
        await pool.query(
          `UPDATE claims SET status = 'under_process', updated_at = now() WHERE id = $1`,
          [claim.id]
        );
      }
      return res.json({ ok: true, open_queries: stillOpen });
    } catch (err: any) {
      console.error("delete claim query error:", err);
      return res.status(500).json({ error: "Could not remove the query" });
    }
  });

  /* ── Agent: upload a document ─────────────────────────────────────────────
   * The retention clock starts HERE, on the first file, not at ticket creation:
   * an empty ticket holds nothing worth counting down.
   */
  app.post(
    "/api/agent/claims/:id/documents",
    (req, res, next) => {
      upload.single("file")(req, res, (err: any) => {
        if (err) {
          console.error("CLAIM DOC MULTER ERROR:", err);
          return res.status(400).json({ error: "File upload failed: " + (err.message || "Unknown error") });
        }
        next();
      });
    },
    async (req, res) => {
      const agentId = await verifyJwt(req, res);
      if (!agentId) return;
      if (!req.file) return res.status(400).json({ error: "No file received" });

      const category = String(req.body?.category || "").toLowerCase();
      if (!["personal", "case", "outcome"].includes(category)) {
        return res.status(400).json({ error: "category must be personal, case or outcome" });
      }

      const file = req.file;
      try {
        const claim = await claimForAgent(req.params.id, agentId);
        if (!claim) return res.status(404).json({ error: "Claim not found" });
        // A purged claim still accepts OUTCOME proof — closing the claim is what
        // triggered the purge, and the letter is the thing being kept. Only the
        // working documents are refused, since re-collecting identity papers
        // onto a finished claim is exactly what the purge exists to prevent.
        if (claim.documents_purged_at && category !== "outcome") {
          return res.status(409).json({
            error: "PURGED",
            message: "This claim's documents were deleted. Only the insurer's letter can be added now.",
          });
        }

        const docId = crypto.randomUUID();
        const ext = file.originalname.includes(".") ? file.originalname.split(".").pop() : "pdf";
        const storagePath = `${agentId}/claims/${claim.id}/${category}/${docId}.${ext}`;

        const fileBuffer = fs.readFileSync(file.path);
        const { error: upErr } = await supabaseAdmin.storage
          .from(PDF_BUCKET)
          .upload(storagePath, fileBuffer, {
            contentType: file.mimetype || "application/pdf",
            upsert: true,
          });
        if (upErr) {
          console.error(`[claim-doc ${docId}] storage upload failed:`, upErr.message);
          return res.status(502).json({ error: "Could not store the file. Try again." });
        }

        const ins = await pool.query(
          `INSERT INTO claim_documents
             (id, claim_id, agent_id, query_id, category, doc_type,
              storage_path, filename, file_size, mime_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING id, claim_id, query_id, category, doc_type, filename,
                     file_size, mime_type, uploaded_at`,
          [
            docId, claim.id, agentId, req.body?.query_id || null, category,
            req.body?.doc_type || null, storagePath, file.originalname,
            file.size ?? null, file.mimetype ?? null,
          ]
        );

        // Start the clock, once, on the first file that lands.
        let clock = null;
        if (!claim.retention_started_at) {
          const started = await pool.query(
            `UPDATE claims
                SET retention_started_at = now(),
                    purge_at = now() + make_interval(days => $2),
                    updated_at = now()
              WHERE id = $1 AND retention_started_at IS NULL
              RETURNING retention_started_at, purge_at`,
            [claim.id, CLAIM_RETENTION_DAYS]
          );
          clock = started.rows[0] ?? null;
        }

        void recordAccess(req, agentId, claim.id, `claim_doc_upload_${category}`);
        return res.json({ ...ins.rows[0], retention: clock });
      } catch (err: any) {
        console.error("claim document upload error:", err);
        return res.status(500).json({ error: "Could not save the document" });
      } finally {
        if (file?.path && fs.existsSync(file.path)) {
          try { fs.unlinkSync(file.path); } catch { /* best effort */ }
        }
      }
    }
  );

  /* ── Agent: open or download a document ──────────────────────────────────
   * Ten minutes, minted on demand, audited every time. The lead-policy route
   * writes a ONE-YEAR url into its row; that is tolerable for a prospect's own
   * policy PDF and not for an Aadhaar scan, and it would outlive the
   * incineration it is supposed to be subject to.
   *
   * ?download=1 asks storage to serve it as an attachment named after the
   * document's label rather than its storage uuid — the advisor is usually
   * pulling these back out to attach to an insurer's portal, and a folder of
   * uuid.pdf files is useless to him at that moment.
   */
  app.get("/api/agent/claims/:id/documents/:docId/url", async (req, res) => {
    const agentId = await verifyJwt(req, res);
    if (!agentId) return;
    try {
      const doc = await pool.query(
        `SELECT d.storage_path, d.filename, d.doc_type
           FROM claim_documents d
           JOIN claims c ON c.id = d.claim_id
          WHERE d.id = $1 AND d.claim_id = $2 AND c.agent_id = $3`,
        [req.params.docId, req.params.id, agentId]
      );
      if (doc.rows.length === 0) return res.status(404).json({ error: "Document not found" });
      const row = doc.rows[0];

      const wantsDownload = String(req.query.download ?? "") === "1";
      // Name the download after the advisor's own label, keeping the real
      // extension so the file still opens in the right app.
      const ext = row.filename?.includes(".") ? `.${row.filename.split(".").pop()}` : "";
      const safeLabel = String(row.doc_type || row.filename || "document")
        .replace(/[\\/:*?"<>|]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
      const downloadName = safeLabel.toLowerCase().endsWith(ext.toLowerCase())
        ? safeLabel
        : `${safeLabel}${ext}`;

      const { data: signed, error } = await supabaseAdmin.storage
        .from(PDF_BUCKET)
        .createSignedUrl(row.storage_path, 600, wantsDownload ? { download: downloadName } : undefined);
      if (error || !signed?.signedUrl) {
        return res.status(502).json({ error: "Could not open the file" });
      }
      void recordAccess(req, agentId, req.params.id, wantsDownload ? "claim_doc_download" : "claim_doc_view");
      return res.json({ url: signed.signedUrl, filename: row.filename, expires_in: 600 });
    } catch (err: any) {
      console.error("claim document url error:", err);
      return res.status(500).json({ error: "Could not open the file" });
    }
  });

  /* ── Agent: rename a document ─────────────────────────────────────────────
   * Only the LABEL changes. filename and storage_path are provenance — what
   * the advisor actually received and where it sits — and renaming must never
   * rewrite either, or the record stops matching the file.
   */
  app.patch("/api/agent/claims/:id/documents/:docId", async (req, res) => {
    const agentId = await verifyJwt(req, res);
    if (!agentId) return;

    const label = String(req.body?.doc_type ?? "").trim().slice(0, 120);
    if (!label) return res.status(400).json({ error: "Give the document a name" });

    try {
      const upd = await pool.query(
        `UPDATE claim_documents d
            SET doc_type = $1
           FROM claims c
          WHERE d.id = $2 AND d.claim_id = $3
            AND c.id = d.claim_id AND c.agent_id = $4
          RETURNING d.id, d.claim_id, d.query_id, d.category, d.doc_type,
                    d.filename, d.file_size, d.mime_type, d.uploaded_at`,
        [label, req.params.docId, req.params.id, agentId]
      );
      if (upd.rows.length === 0) return res.status(404).json({ error: "Document not found" });
      return res.json(upd.rows[0]);
    } catch (err: any) {
      console.error("claim document rename error:", err);
      return res.status(500).json({ error: "Could not rename the document" });
    }
  });

  /* ── Agent: delete a document ─────────────────────────────────────────── */
  app.delete("/api/agent/claims/:id/documents/:docId", async (req, res) => {
    const agentId = await verifyJwt(req, res);
    if (!agentId) return;
    try {
      const doc = await pool.query(
        `SELECT d.id, d.storage_path
           FROM claim_documents d
           JOIN claims c ON c.id = d.claim_id
          WHERE d.id = $1 AND d.claim_id = $2 AND c.agent_id = $3`,
        [req.params.docId, req.params.id, agentId]
      );
      if (doc.rows.length === 0) return res.status(404).json({ error: "Document not found" });

      // Object first, row second: a crash between the two costs an orphaned
      // row the sweep will retry, never a file nothing can reach.
      const { error } = await supabaseAdmin.storage
        .from(PDF_BUCKET)
        .remove([doc.rows[0].storage_path]);
      if (error) console.error("claim doc object remove failed:", error.message);

      await pool.query("DELETE FROM claim_documents WHERE id = $1", [doc.rows[0].id]);
      void recordAccess(req, agentId, req.params.id, "claim_doc_delete");
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("claim document delete error:", err);
      return res.status(500).json({ error: "Could not delete the document" });
    }
  });

  /* ── Agent: extend retention by 30 days ───────────────────────────────────
   * Triple-guarded so 60 days is a structural ceiling rather than a policy
   * someone has to remember: inside the unlock window, claim still open, and
   * no extension used yet. All three are checked in the UPDATE's WHERE so two
   * taps in quick succession cannot both win.
   */
  app.post("/api/agent/claims/:id/extend", async (req, res) => {
    const agentId = await verifyJwt(req, res);
    if (!agentId) return;
    try {
      const upd = await pool.query(
        `UPDATE claims
            SET purge_at = purge_at + make_interval(days => $3),
                extension_used = true,
                extension_granted_at = now(),
                updated_at = now()
          WHERE id = $1 AND agent_id = $2
            AND purge_at IS NOT NULL
            AND extension_used = false
            AND documents_purged_at IS NULL
            AND status NOT IN ('settled','rejected')
            AND now() >= purge_at - make_interval(days => $4)
          RETURNING purge_at, extension_used`,
        [req.params.id, agentId, CLAIM_EXTENSION_DAYS, CLAIM_EXTEND_UNLOCK_DAYS]
      );
      if (upd.rows.length === 0) {
        const claim = await claimForAgent(req.params.id, agentId);
        if (!claim) return res.status(404).json({ error: "Claim not found" });
        return res.status(409).json({
          error: "CANNOT_EXTEND",
          message: claim.extension_used
            ? "This claim has already had its one extension."
            : "Extending opens in the last 5 days, and only while the claim is open.",
        });
      }
      await logClaimEvent(req.params.id, agentId, "retention_extended", "Kept 30 more days");
      return res.json(upd.rows[0]);
    } catch (err: any) {
      console.error("claim extend error:", err);
      return res.status(500).json({ error: "Could not extend" });
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
      recordAccess(req, agentId, id, "delete_client");
      return res.json({ success: true });
    } catch (err: any) {
      console.error("Delete client error:", err);
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  /* ── Agent: Fetch Client Report ──────────────────────────────────────── */

  app.get("/api/client-report/:id", async (req, res) => {
    try {
      const agentId = await verifyJwt(req, res);
      if (!agentId) return;

      const clientId = req.params.id;
      const getClient = await pool.query(
        "SELECT report_data FROM clients WHERE id = $1 AND agent_id = $2",
        [clientId, agentId]
      );

      if (getClient.rows.length === 0 || !getClient.rows[0].report_data) {
        return res
          .status(404)
          .json({ error: "Report not found or not finished processing" });
      }

      recordAccess(req, agentId, clientId, "view_report");
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
        userContent,
        undefined,
        { feature: "portfolio_insights", route: "/api/agent/portfolio-insights", sourceType: "agent", actorId: agentId }
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

  /* ── Admin: Gemini usage / cost ledger ──────────────────────────────────
     Aggregated spend so you can account for every Gemini call. Token counts
     are exact (from Gemini usageMetadata); est_cost_usd is exact once the
     GEMINI_PRICE_*_PER_M env rates are set. Duplicates surface calls billed
     more than once for identical input (e.g. a double-processed batch). */
  app.get("/api/admin/gemini-usage", isAdmin, async (req, res) => {
    try {
      const days = Math.min(Math.max(parseInt(String(req.query.days ?? "7"), 10) || 7, 1), 90);
      const since = `NOW() - interval '${days} days'`;

      const [totals, byFeature, byDay, topActors, duplicates] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int AS calls,
                  COUNT(*) FILTER (WHERE status='error')::int AS errors,
                  COALESCE(SUM(prompt_tokens),0)::bigint AS prompt_tokens,
                  COALESCE(SUM(output_tokens),0)::bigint AS output_tokens,
                  COALESCE(SUM(total_tokens),0)::bigint AS total_tokens,
                  COALESCE(SUM(est_cost_usd),0)::numeric AS est_cost_usd
             FROM gemini_usage_log WHERE created_at >= ${since}`
        ),
        pool.query(
          `SELECT feature,
                  COUNT(*)::int AS calls,
                  COALESCE(SUM(total_tokens),0)::bigint AS total_tokens,
                  COALESCE(SUM(est_cost_usd),0)::numeric AS est_cost_usd
             FROM gemini_usage_log WHERE created_at >= ${since}
            GROUP BY feature ORDER BY est_cost_usd DESC, calls DESC`
        ),
        pool.query(
          `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                  COUNT(*)::int AS calls,
                  COALESCE(SUM(total_tokens),0)::bigint AS total_tokens,
                  COALESCE(SUM(est_cost_usd),0)::numeric AS est_cost_usd
             FROM gemini_usage_log WHERE created_at >= ${since}
            GROUP BY 1 ORDER BY 1 DESC`
        ),
        pool.query(
          `SELECT COALESCE(source_type,'unknown') AS source_type,
                  COALESCE(actor_id,'(none)') AS actor_id,
                  COUNT(*)::int AS calls,
                  COALESCE(SUM(est_cost_usd),0)::numeric AS est_cost_usd
             FROM gemini_usage_log WHERE created_at >= ${since}
            GROUP BY 1,2 ORDER BY calls DESC LIMIT 20`
        ),
        pool.query(
          `SELECT input_hash, feature,
                  COUNT(*)::int AS times,
                  COALESCE(SUM(est_cost_usd),0)::numeric AS wasted_cost_usd
             FROM gemini_usage_log
            WHERE created_at >= ${since} AND input_hash IS NOT NULL AND status='ok'
            GROUP BY input_hash, feature
           HAVING COUNT(*) > 1
            ORDER BY times DESC LIMIT 50`
        ),
      ]);

      res.json({
        rangeDays: days,
        pricingConfigured: !!(process.env.GEMINI_PRICE_INPUT_PER_M || process.env.GEMINI_PRICE_OUTPUT_PER_M),
        totals: totals.rows[0],
        byFeature: byFeature.rows,
        byDay: byDay.rows,
        topActors: topActors.rows,
        duplicates: duplicates.rows,
      });
    } catch (err: any) {
      console.error("Gemini usage summary error:", err?.message);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/admin/gemini-usage/rows", isAdmin, async (req, res) => {
    try {
      const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "100"), 10) || 100, 1), 500);
      const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);
      const conditions: string[] = [];
      const params: any[] = [];
      if (req.query.feature) { params.push(req.query.feature); conditions.push(`feature = $${params.length}`); }
      if (req.query.status) { params.push(req.query.status); conditions.push(`status = $${params.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      params.push(limit); const limIdx = params.length;
      params.push(offset); const offIdx = params.length;

      const rows = await pool.query(
        `SELECT id, created_at, feature, route, model, source_type, actor_id,
                job_id, client_id, input_hash, prompt_tokens, output_tokens,
                total_tokens, est_cost_usd, status, attempt, latency_ms, error_message
           FROM gemini_usage_log ${where}
          ORDER BY created_at DESC
          LIMIT $${limIdx} OFFSET $${offIdx}`,
        params
      );
      res.json({ rows: rows.rows, limit, offset });
    } catch (err: any) {
      console.error("Gemini usage rows error:", err?.message);
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

  /* ── Agent: Compare two policy WORDINGS (wording vs wording) ──────────────
     Upload two product policy-wording PDFs. Text is extracted deterministically
     (free), each wording is normalized into a WordingProfile via one cached
     Gemini call, then a deterministic engine builds the side-by-side + verdict.
     This does NOT touch the per-customer forensic audit pipeline. */

  app.post(
    "/api/agent/compare",
    (req, res, next) => {
      upload.fields([
        { name: "wording_a", maxCount: 1 },
        { name: "wording_b", maxCount: 1 },
      ])(req, res, (err: any) => {
        if (err) {
          console.error("COMPARE MULTER ERROR:", err);
          return res
            .status(400)
            .json({ error: "File upload failed: " + (err.message || "Unknown error") });
        }
        next();
      });
    },
    async (req, res) => {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const fileA = files?.wording_a?.[0];
      const fileB = files?.wording_b?.[0];
      const cleanup = () => {
        for (const f of [fileA, fileB]) {
          if (f?.path) { try { fs.unlinkSync(f.path); } catch { /* ignore */ } }
        }
      };

      try {
        const agentId = await verifyJwt(req, res);
        if (!agentId) { cleanup(); return; }

        if (!fileA || !fileB) {
          cleanup();
          return res.status(400).json({ error: "Two wording PDFs are required (wording_a and wording_b)." });
        }

        // 1. Extract raw text from both (deterministic, no AI cost).
        let textA: string, textB: string;
        try {
          [textA, textB] = await Promise.all([
            extractPolicyText(fileA),
            extractPolicyText(fileB),
          ]);
        } catch (e: any) {
          cleanup();
          return res.status(422).json({ error: "Could not read PDF text: " + (e?.message || "unknown") });
        }

        // 2. Normalize each wording into a comparable profile (1 cached Gemini call each).
        let profileA: WordingProfile, profileB: WordingProfile;
        try {
          const compareMeta = {
            route: "/api/agent/compare",
            sourceType: "agent" as const,
            actorId: agentId,
          };
          [profileA, profileB] = await Promise.all([
            extractWordingProfile(textA, compareMeta),
            extractWordingProfile(textB, compareMeta),
          ]);
        } catch (e: any) {
          cleanup();
          console.error("COMPARE EXTRACTION ERROR:", e?.message);
          return res.status(502).json({ error: "Policy analysis failed. Please try again." });
        }

        // 3. Deterministic side-by-side + verdict.
        const result = buildComparison(profileA, profileB);
        cleanup();

        return res.json({
          result,
          profiles: { a: profileA, b: profileB },
          hashes: { a: hashText(textA), b: hashText(textB) },
        });
      } catch (err: any) {
        cleanup();
        console.error("COMPARE ERROR:", err?.message, err?.stack);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    }
  );

  /* ── Compare: Save & Get shared comparison report ─────────────────────────
     Same share model as the calculator: the agent portal POSTs with its Supabase
     token so the report is stamped to the agent (and optionally a customer after
     an ownership check); the public GET-by-uuid renders the customer-facing share. */

  app.post("/api/compare/save-report", async (req, res) => {
    const { result, profiles, customer_id } = req.body ?? {};
    if (!result || typeof result !== "object" || !result.verdict) {
      return res.status(400).json({ error: "A valid comparison result is required" });
    }

    // Optional agent/customer stamping; auth failure degrades to anonymous save.
    let agentId: string | null = null;
    let customerId: string | null = null;
    const authHeader = req.headers["authorization"] as string | undefined;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
        if (!error && user) agentId = user.id;
      } catch { /* anonymous save */ }
    }
    if (agentId && customer_id) {
      const owned = await pool.query(
        "SELECT id FROM customers WHERE id = $1 AND agent_id = $2",
        [customer_id, agentId]
      );
      if (owned.rows.length > 0) customerId = customer_id;
    }

    const sides = Array.isArray(result?.sides) ? result.sides : [];
    const nameA = sides[0]?.plan_name || sides[0]?.insurer || null;
    const nameB = sides[1]?.plan_name || sides[1]?.insurer || null;

    try {
      const insertRes = await pool.query(
        `INSERT INTO comparison_reports (result, profiles, name_a, name_b, agent_id, customer_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          JSON.stringify(result),
          profiles ? JSON.stringify(profiles) : null,
          nameA, nameB, agentId, customerId,
        ]
      );
      return res.json({ uuid: insertRes.rows[0].id, success: true });
    } catch (err: any) {
      console.error("ERROR saving comparison report:", err);
      return res.status(500).json({ error: "Failed to save comparison. Please try again.", retryable: true });
    }
  });

  app.get("/api/compare/report/:uuid", async (req, res) => {
    const { uuid } = req.params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      return res.status(400).json({ error: "Invalid report ID format" });
    }
    try {
      const reportRes = await pool.query(
        "SELECT result, created_at FROM comparison_reports WHERE id = $1",
        [uuid]
      );
      if (reportRes.rows.length === 0) {
        return res.status(404).json({ error: "Comparison not found", code: "REPORT_NOT_FOUND" });
      }
      return res.json(reportRes.rows[0]);
    } catch (err: any) {
      console.error("ERROR fetching comparison report:", err);
      return res.status(500).json({ error: "Failed to load comparison.", retryable: true });
    }
  });

  /* ── Compare: Catalog (pre-extracted wordings, zero-AI compare) ───────────
     The catalog is the scale answer: each wording is extracted ONCE into a
     stored profile, so comparing any two is pure deterministic math (no AI,
     no per-compare cost). Public read — product data, not user data. */

  app.get("/api/compare/catalog", async (req, res) => {
    // PUBLIC: product data only (no user data), deterministic, ZERO AI cost.
    // Powers the public /compare catalog experience (lead-gen funnel). The
    // global IP rate limiter still applies.
    try {
      const { rows } = await pool.query(
        `SELECT uin, insurer, plan_name, product_type, sum_insured_options, confidence, status
           FROM policy_catalog
          WHERE is_active = true
            AND product_type = 'comprehensive_health_indemnity'
          ORDER BY insurer, plan_name`
      );
      return res.json({ policies: rows });
    } catch (err: any) {
      console.error("ERROR listing catalog:", err);
      return res.status(500).json({ error: "Failed to load catalog." });
    }
  });

  app.post("/api/compare/from-catalog", async (req, res) => {
    // PUBLIC: deterministic compare of pre-extracted catalog profiles. No AI
    // call, no user data. Bounded to 2..4 plans; global rate limiter applies.
    const body = req.body ?? {};
    // Accept { uins: [...] } (2..4) or legacy { uin_a, uin_b }.
    const raw: any[] = Array.isArray(body.uins) ? body.uins : [body.uin_a, body.uin_b];
    const uins = [...new Set(raw.filter((u: any) => typeof u === "string" && u.length > 0))];
    if (uins.length < 2) return res.status(400).json({ error: "Pick at least two different policies" });
    if (uins.length > 4) return res.status(400).json({ error: "Compare up to 4 policies at a time" });
    try {
      const { rows } = await pool.query(
        `SELECT uin, profile FROM policy_catalog WHERE uin = ANY($1::text[]) AND is_active = true`,
        [uins]
      );
      const byUin: Record<string, WordingProfile> = {};
      for (const r of rows) byUin[r.uin] = r.profile as WordingProfile;
      const profiles: WordingProfile[] = [];
      for (const u of uins) {
        if (!byUin[u]) return res.status(404).json({ error: "A selected policy was not found in the catalog" });
        profiles.push(byUin[u]);
      }
      const result = compareMany(profiles);
      return res.json({ result });
    } catch (err: any) {
      console.error("ERROR comparing from catalog:", err);
      return res.status(500).json({ error: "Failed to compare." });
    }
  });

  /* ── Agent: Upload & Analyze ─────────────────────────────────────────── */

  app.post(
    "/api/agent/analyze",
    (req, res, next) => {
      // "file" is the policy under audit. The companion fields are OTHER health
      // covers the same insured already holds (health lane only) — read in the
      // same audit so the report reflects their real total protection.
      const analyzeUpload = upload.fields([
        { name: "file", maxCount: 1 },
        { name: "companion_super_topup", maxCount: 1 },
        { name: "companion_corporate", maxCount: 1 },
        { name: "companion_ayushman", maxCount: 1 },
      ]);
      analyzeUpload(req, res, (err: any) => {
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
      // Every file multer wrote to disk for this request, collected up front so
      // the early returns below (bad account, no credits) clean up too instead
      // of leaving temp uploads behind.
      const uploadedFiles = (req.files || {}) as Record<string, Express.Multer.File[]>;
      const tempFiles = Object.values(uploadedFiles).flat();
      const dropTempFiles = () => {
        for (const tmp of tempFiles) {
          try {
            if (tmp?.path && fs.existsSync(tmp.path)) fs.unlinkSync(tmp.path);
          } catch { /* best-effort */ }
        }
      };

      try {
        // Verify agent auth
        const agentId = await verifyJwt(req, res);
        if (!agentId) { dropTempFiles(); return; }

        // Must be a real agent account. Without this, a D2C consumer (who has a
        // valid Supabase token) could reach the free OCR/data-entry lane below
        // and burn Gemini outside their own metered /api/me/analyze quota.
        const agentRow = await pool.query("SELECT 1 FROM agents WHERE id = $1", [agentId]);
        if (agentRow.rows.length === 0) {
          dropTempFiles();
          return res.status(403).json({ error: "WRONG_ACCOUNT_TYPE", message: "This endpoint is for agent accounts." });
        }

        const insuranceType = (req.body.type || "health").toLowerCase();
        const isDataEntry = isDataEntryType(insuranceType);

        // Metering. Health forensic analysis draws from credits; the OCR /
        // data-entry lanes (motor/life/term/travel/property) draw from the
        // separate per-plan OCR allowance. Both are checked up front and
        // decremented only on success.
        if (!isDataEntry) {
          const creditRes = await pool.query(
            "SELECT balance FROM agent_credits WHERE agent_id = $1",
            [agentId]
          );
          const credits = creditRes.rows[0]?.balance ?? 0;
          if (credits <= 0) {
            dropTempFiles();
            return res.status(403).json({ error: "NO_CREDITS", message: "You have no credits remaining. Contact your admin to top up." });
          }
        } else {
          const ocrBalance = await ensureOcrBalance(agentId);
          if (ocrBalance <= 0) {
            dropTempFiles();
            return res.status(403).json({ error: "NO_OCR_CREDITS", message: NO_OCR_CREDITS_MSG });
          }
        }

        const file = uploadedFiles.file?.[0];
        if (!file) {
          dropTempFiles();
          return res.status(400).json({ error: "No file uploaded" });
        }

        // Companion covers — health lane only. On a data-entry type the extra
        // files are ignored (and still cleaned up), so a cheap OCR upload can
        // never smuggle in additional Gemini work.
        const ayushmanDeclared = !isDataEntry && String(req.body.has_ayushman || "") === "true";
        const companionSpecs: { kind: CompanionKind; field: string }[] = [
          { kind: "super_topup", field: "companion_super_topup" },
          { kind: "corporate", field: "companion_corporate" },
          { kind: "ayushman", field: "companion_ayushman" },
        ];
        const companionUploads: { kind: CompanionKind; file: Express.Multer.File }[] = [];
        if (!isDataEntry) {
          for (const spec of companionSpecs) {
            const f = uploadedFiles[spec.field]?.[0];
            if (f) companionUploads.push({ kind: spec.kind, file: f });
          }
        }

        // Parse optional client detail fields
        const policyholder_name = req.body.policyholder_name || null;
        const client_email = req.body.client_email || null;
        const client_phone = req.body.client_phone || null;
        const policy_identifier = req.body.policy_identifier || null;

        // Create job
        const jobId = crypto.randomUUID();
        const job: AnalysisJob = {
          id: jobId,
          agentId,
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

            const uploadedPolicyText = await extractPolicyText(file, {
              feature: "image_ocr",
              route: "/api/agent/analyze",
              sourceType: "agent",
              actorId: agentId,
              jobId,
              clientId,
            });
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
              const extraction = await extractStructuredData(uploadedPolicyText, insuranceType, {
                route: "/api/agent/analyze",
                sourceType: "agent",
                actorId: agentId,
                jobId,
                clientId,
              });

              if (extraction.status === "completed") {
                job.status = "completed";
                job.result = extraction.data;

                // Draw down one OCR entry — only on a successful extraction.
                await consumeOcr(agentId);

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

            // ── Companion covers (health lane) ──────────────────────────────
            // Read each attached cover and keep a record of what was supplied.
            // A companion that fails to read must never fail the audit — the
            // base policy is still analysable on its own.
            const companions: CompanionDoc[] = [];
            const companionRecords: {
              kind: CompanionKind;
              filename: string | null;
              declaredOnly: boolean;
              read: boolean;
              pdf_url?: string | null;
            }[] = [];

            for (const { kind, file: cFile } of companionUploads) {
              let text = "";
              try {
                text = await extractPolicyText(cFile, {
                  feature: "image_ocr",
                  route: "/api/agent/analyze",
                  sourceType: "agent",
                  actorId: agentId,
                  jobId,
                  clientId,
                });
              } catch (cErr: any) {
                console.warn(`[Job ${jobId}] companion ${kind} extraction failed:`, cErr?.message);
              }

              // Keep the original document alongside the base policy's PDF.
              let companionUrl: string | null = null;
              try {
                const cBuffer = fs.readFileSync(cFile.path);
                const cExt = cFile.originalname.includes(".") ? cFile.originalname.split(".").pop() : "pdf";
                const cPath = `${agentId}/${clientId}-${kind}.${cExt}`;
                const { error: cUpErr } = await supabaseAdmin.storage
                  .from(PDF_BUCKET)
                  .upload(cPath, cBuffer, {
                    contentType: cFile.mimetype || "application/pdf",
                    upsert: true,
                  });
                if (!cUpErr) {
                  const { data: cSigned } = await supabaseAdmin.storage
                    .from(PDF_BUCKET)
                    .createSignedUrl(cPath, 60 * 60);
                  companionUrl = cSigned?.signedUrl ?? null;
                }
              } catch (cStoreErr: any) {
                console.warn(`[Job ${jobId}] companion ${kind} storage failed:`, cStoreErr?.message);
              }

              if (text.trim()) companions.push({ kind, text });
              companionRecords.push({
                kind,
                filename: cFile.originalname,
                declaredOnly: false,
                read: !!text.trim(),
                pdf_url: companionUrl,
              });
            }

            // Ayushman Bharat is usually a card, not a policy document — the
            // agent can simply declare it. Only add the declaration if no
            // Ayushman document was attached above.
            if (ayushmanDeclared && !companionUploads.some((c) => c.kind === "ayushman")) {
              companions.push({ kind: "ayushman", declaredOnly: true });
              companionRecords.push({ kind: "ayushman", filename: null, declaredOnly: true, read: false });
            }

            const result = await runAnalysisPipeline(
              uploadedPolicyText,
              insuranceType,
              {
                route: "/api/agent/analyze",
                sourceType: "agent",
                actorId: agentId,
                jobId,
                clientId,
              },
              companions
            );

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
              // Travels with the report (like __internal) so the policy page can
              // show which extra covers were fed into this audit — no schema change.
              if (companionRecords.length > 0) {
                reportData.__companions = companionRecords;
              }
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
          } finally {
            // Guarantee the temp upload is removed even if extraction/storage
            // threw before the success-path unlink above. Guarded by existsSync
            // so the normal-path unlink isn't double-freed.
            dropTempFiles();
          }
        })();
      } catch (err: any) {
        console.error("Agent analyze error:", err);
        // The background worker never started, so its finally-block cleanup
        // will not run — drop the temp uploads here instead.
        dropTempFiles();
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

      // OWNERSHIP: this job must belong to the calling agent. Anonymous jobs
      // (agentId null) are not reachable here; another agent's job 404s (we do
      // not reveal existence). This closes the IDOR where any authenticated
      // agent could read another agent's analysis result by jobId.
      if (!job.agentId || job.agentId !== agentId) {
        return res.status(404).json({ status: "not_found", error: "Job not found" });
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

  /* ══════════════════════════════════════════════════════════════════════
     D2C CONSUMER PORTFOLIO  (/api/me/*)
     Individuals (not agents) sign up, analyze their own policies, and keep a
     personal portfolio. Auth via requireIndividual; spend gated by
     checkIndividualQuota. Data lives in individual_profiles / individual_policies.
     ══════════════════════════════════════════════════════════════════════ */

  /* ── Password reset, sent through OUR mail, not Supabase's ────────────────
     Supabase Auth will happily send the recovery email itself, and that is what
     this used to do. The problem is deliverability: the built-in sender is
     rate-limited to a handful of messages an hour and lands in spam often
     enough that "I never got the email" becomes the support burden. We already
     run SES for ap-south-1 with indsure.in DKIM-verified, and every other
     transactional mail we send goes through it.

     So: mint the recovery link with the service role, then deliver it ourselves.
     The link is the ordinary Supabase action link, so /reset-password (which
     just waits for the PASSWORD_RECOVERY event) needs no change.

     Serves agents and consumers from one route — the account type only decides
     where the link lands and how the mail reads. Always answers 200 whether or
     not the address exists; the response must never reveal who has an account. */
  app.post("/api/auth/forgot-password", forgotPasswordRateLimiter, async (req, res) => {
    // Answered before any lookup so every path takes the same shape.
    const ok = () => res.json({ ok: true });
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) return ok();

      const origin = (process.env.PUBLIC_APP_ORIGIN || "https://indsure.in").replace(/\/+$/, "");
      const agentRow = await pool.query("SELECT 1 FROM agents WHERE lower(email) = $1", [email]);
      const isAgent = agentRow.rows.length > 0;
      const resetPath = isAgent ? "/agent/reset-password" : "/reset-password";

      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${origin}${resetPath}` },
      });
      // No such user is the common case for a typo — indistinguishable from success.
      if (error || !data?.properties?.hashed_token) return ok();

      // Deliberately NOT data.properties.action_link. That link points at
      // Supabase's /auth/v1/verify, which honours `redirect_to` only if the URL
      // is on the project's allowlist — and it is not. Supabase substitutes the
      // Site URL instead, silently and with a 303, so every reset link landed on
      // the beta homepage with tokens in the fragment and no reset screen. That
      // was true of the old client-side resetPasswordForEmail call too, which is
      // why "forgot password" has never actually worked.
      //
      // Sending the token hash to our own domain removes Supabase's redirect
      // from the path entirely: /reset-password calls verifyOtp() with it and
      // establishes the recovery session itself. Nothing to allowlist, and the
      // link cannot be re-pointed by a dashboard setting changing under us.
      const link = `${origin}${resetPath}?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`;
      const sent = await sendMail({
        to: email,
        subject: "Reset your IndSure password",
        text: [
          "Hello,",
          "",
          "Someone asked to reset the password on this IndSure account. Open the link below to choose a new one:",
          "",
          link,
          "",
          "The link can be used once and expires in about an hour.",
          "",
          "If this wasn't you, ignore this email — nothing has changed and your current password still works.",
          "",
          "— Team IndSure",
        ].join("\n"),
        html: `
          <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f2233;max-width:520px">
            <p>Hello,</p>
            <p>Someone asked to reset the password on this IndSure account. Choose a new one here:</p>
            <p style="margin:26px 0">
              <a href="${link}" style="background:#0e7c6b;color:#fff;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:600;display:inline-block">Set a new password</a>
            </p>
            <p style="color:#5b6b7a;font-size:13px">The link can be used once and expires in about an hour.</p>
            <p style="color:#5b6b7a;font-size:13px">If this wasn't you, ignore this email — nothing has changed and your current password still works.</p>
            <p style="margin-top:26px">— Team IndSure</p>
          </div>`.trim(),
      });
      if (!sent) console.warn("forgot-password: SMTP not configured or send failed");
      return ok();
    } catch (err: any) {
      console.error("forgot-password error:", err?.message);
      return ok();
    }
  });

  /* ── Consumer: log in with a mobile number ────────────────────────────────
     Supabase Auth is email+password, so a mobile login resolves the number to
     the account's email and then performs an ordinary password grant.

     That resolution happens HERE, inside the sign-in, and is deliberately not
     exposed as its own "which account owns this number" endpoint — that would
     be an oracle anyone could use to test whether a given mobile is registered,
     against a user base who never consented to being enumerated.

     Every failure returns the same 401 with the same wording. An unrecognised
     number still runs a password grant against a throwaway address, so a wrong
     number and a wrong password take a similar amount of time to answer rather
     than the unknown-number case returning noticeably faster. */
  app.post("/api/auth/consumer-login", consumerLoginRateLimiter, async (req, res) => {
    try {
      if (!supabaseAuth) {
        console.error("consumer-login: SUPABASE_ANON_KEY is not set on this server");
        return res.status(500).json({ error: "Internal server error" });
      }

      const password = typeof req.body?.password === "string" ? req.body.password : "";
      const raw = typeof req.body?.phone === "string" ? req.body.phone : "";
      // Same normalisation as everywhere else we store a phone: last 10 digits.
      const digits = raw.replace(/\D/g, "").slice(-10);

      const fail = () =>
        res.status(401).json({
          error: "INVALID_CREDENTIALS",
          message: "That mobile number and password don't match an account.",
        });

      if (!password || !/^[6-9][0-9]{9}$/.test(digits)) return fail();

      const row = await pool.query(
        "SELECT email FROM individual_profiles WHERE phone = $1 LIMIT 1",
        [digits]
      );
      const email = (row.rows[0]?.email as string | undefined) || null;

      const { data, error } = await supabaseAuth.auth.signInWithPassword({
        email: email ?? `unknown-${crypto.randomUUID()}@indsure.invalid`,
        password,
      });
      if (error || !data?.session) return fail();

      // The client puts these straight into supabase.auth.setSession(), so the
      // resulting session is indistinguishable from an email login.
      return res.json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      });
    } catch (err: any) {
      console.error("consumer-login error:", err?.message);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ── Consumer: bootstrap profile (idempotent, called after signup/login) ── */
  app.post("/api/me/bootstrap", async (req, res) => {
    try {
      const authHeader = req.headers["authorization"] as string | undefined;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing authorization" });
      }
      const userId = await getUserIdFromToken(authHeader.slice(7));
      if (!userId) return res.status(401).json({ error: "Invalid or expired token" });

      // Agent accounts must not become consumer accounts.
      const agentRow = await pool.query("SELECT 1 FROM agents WHERE id = $1", [userId]);
      if (agentRow.rows.length > 0) {
        return res.status(403).json({ error: "WRONG_ACCOUNT_TYPE", message: "This is an agent account." });
      }

      let email: string | null = null;
      let fullName: string | null = null;
      let phone: string | null = null;
      try {
        const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
        email = data?.user?.email ?? null;
        fullName = (data?.user?.user_metadata?.full_name as string) ?? null;
        phone = (data?.user?.user_metadata?.phone as string) ?? null;
      } catch { /* best-effort; profile row still created */ }

      // The signup form also posts name + mobile directly (demographics — there
      // is no OTP and nothing is verified). Body wins over user_metadata; the
      // metadata copy is what covers the confirm-your-email path, where signup
      // has no session and never reaches this endpoint.
      const bodyName = typeof req.body?.full_name === "string" ? req.body.full_name : null;
      if (bodyName) fullName = bodyName;
      if (typeof req.body?.phone === "string") phone = req.body.phone;

      // Same sanitising as PATCH /api/me/profile: strip control chars, cap length.
      fullName = fullName
        ? (fullName.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 80) || null)
        : null;
      // Store the last 10 digits, matching every other phone we keep. Anything
      // that isn't a plausible Indian mobile is dropped rather than stored dirty.
      const phoneDigits = (phone ?? "").replace(/\D/g, "").slice(-10);
      phone = /^[6-9][0-9]{9}$/.test(phoneDigits) ? phoneDigits : null;

      // Personal providers only — reject business/Workspace/custom domains.
      // The signup form blocks this pre-signup; this is the server-side backstop
      // for any client bypass. (Fail-open only if we couldn't read the email.)
      if (email && !isPersonalEmail(email)) {
        return res.status(403).json({
          error: "NON_PERSONAL_EMAIL",
          message: "Please use a personal email. Business/work accounts belong on the agent portal.",
        });
      }

      const marketing = req.body?.marketing_consent === true;

      // Server-side backstop for the two fields the signup form marks required.
      // The form already blocks both; this catches a client bypass, since
      // supabase.auth.signUp runs in the browser and an account can be created
      // without ever touching this API.
      //
      // Applied ONLY when the profile row does not exist yet. This endpoint also
      // runs on every login and on entry to /app, and the accounts created before
      // mobile capture shipped (2026-08-14) have no number — rejecting them here
      // would lock existing users out of their own portfolio for a rule that did
      // not exist when they signed up.
      const existing = await pool.query(
        "SELECT 1 FROM individual_profiles WHERE id = $1",
        [userId]
      );
      const isFirstTime = existing.rows.length === 0;
      if (isFirstTime && (!fullName || !phone)) {
        return res.status(400).json({
          error: "PROFILE_INCOMPLETE",
          message: "A name and a valid 10-digit Indian mobile number are required to create an account.",
        });
      }

      try {
        await pool.query(
          `INSERT INTO individual_profiles (id, email, full_name, phone, marketing_consent)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET
             email = COALESCE(individual_profiles.email, EXCLUDED.email),
             full_name = COALESCE(individual_profiles.full_name, EXCLUDED.full_name),
             phone = COALESCE(individual_profiles.phone, EXCLUDED.phone),
             updated_at = now()`,
          [userId, email, fullName, phone, marketing]
        );
      } catch (err: any) {
        // Migration 013 makes phone unique so mobile login can resolve to exactly
        // one account. Say so plainly rather than surfacing a 500 — the person
        // typing it almost certainly has an older account on that number.
        if (err?.code === "23505") {
          return res.status(409).json({
            error: "PHONE_IN_USE",
            message: "That mobile number is already on an IndSure account. Log in with it instead, or use a different number.",
          });
        }
        throw err;
      }

      const prof = await pool.query(
        "SELECT plan, trial_started_at FROM individual_profiles WHERE id = $1",
        [userId]
      );
      const p = prof.rows[0];
      const trialEndsAt = new Date(new Date(p.trial_started_at).getTime() + TRIAL_DAYS * 86400_000).toISOString();
      return res.json({ plan: p.plan, trialStartedAt: p.trial_started_at, trialEndsAt });
    } catch (err: any) {
      console.error("Consumer bootstrap error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ── Consumer: portfolio list + quota state ──────────────────────────── */
  app.get("/api/me/portfolio", async (req, res) => {
    try {
      const userId = await requireIndividual(req, res);
      if (!userId) return;

      const prof = await pool.query(
        "SELECT plan, trial_started_at, full_name, phone, renewal_reminders_enabled FROM individual_profiles WHERE id = $1",
        [userId]
      );
      const p = prof.rows[0];
      const policies = await pool.query(
        `SELECT id, insurance_type, status, filename, insurer, policy_name, nickname, score,
                expiry_date, renewal_date, sum_insured, flaws, created_at, error_message,
                (pdf_url IS NOT NULL) AS has_pdf
           FROM individual_policies
          WHERE user_id = $1
          ORDER BY created_at DESC`,
        [userId]
      );

      // Does the consumer have an advisor request still being worked, and has it
      // been assigned to an agent yet? Drives the /app advisor card: once assigned,
      // we surface that agent's name + contact so the consumer can reach them.
      // Joins agents server-side because the consumer can't read the agents table
      // directly (its RLS restricts rows to the agent themselves).
      const openReq = await pool.query(
        `SELECT r.assigned_agent_id,
                a.full_name AS advisor_name, a.phone AS advisor_phone, a.city AS advisor_city
           FROM agent_connect_requests r
           LEFT JOIN agents a ON a.id = r.assigned_agent_id
          WHERE r.user_id = $1 AND r.status <> 'closed'
          ORDER BY r.created_at DESC
          LIMIT 1`,
        [userId]
      );
      const reqRow = openReq.rows[0];
      const advisor = reqRow && reqRow.assigned_agent_id && reqRow.advisor_name
        ? { name: reqRow.advisor_name, phone: reqRow.advisor_phone ?? null, city: reqRow.advisor_city ?? null }
        : null;

      const slotsUsedByType: Record<string, number> = {};
      for (const row of policies.rows) {
        if (row.status !== "error") {
          slotsUsedByType[row.insurance_type] = (slotsUsedByType[row.insurance_type] ?? 0) + 1;
        }
      }
      const trialEndsAt = new Date(new Date(p.trial_started_at).getTime() + TRIAL_DAYS * 86400_000).toISOString();

      return res.json({
        plan: p.plan,
        trialEndsAt,
        fullName: p.full_name ?? null,
        phone: p.phone ?? null,
        renewalRemindersEnabled: p.renewal_reminders_enabled ?? true,
        hasOpenAgentRequest: openReq.rows.length > 0,
        advisor,
        freeSlotsPerType: FREE_SLOTS_PER_TYPE,
        slotsUsedByType,
        policies: policies.rows,
      });
    } catch (err: any) {
      console.error("Consumer portfolio error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ── Consumer: update profile (display name) ─────────────────────────── */
  app.patch("/api/me/profile", async (req, res) => {
    try {
      const userId = await requireIndividual(req, res);
      if (!userId) return;
      // Trim, strip control chars, cap length. Empty clears the name.
      const raw = typeof req.body?.full_name === "string" ? req.body.full_name : "";
      const fullName = raw.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 80) || null;
      // Partial update: only the fields the client actually sent, so PATCHing
      // just the reminder toggle never clobbers the name or phone. `fullName` is
      // computed above and only used when full_name was actually in the body.
      const sets: string[] = [];
      const vals: any[] = [];
      const out: Record<string, any> = {};

      if (typeof req.body?.full_name === "string") {
        sets.push(`full_name = $${sets.length + 1}`);
        vals.push(fullName);
        out.fullName = fullName;
      }
      if (typeof req.body?.phone === "string") {
        const phone = req.body.phone.replace(/[^\d+\-() ]/g, "").trim().slice(0, 20) || null;
        sets.push(`phone = $${sets.length + 1}`);
        vals.push(phone);
        out.phone = phone;
      }
      if (typeof req.body?.renewal_reminders_enabled === "boolean") {
        sets.push(`renewal_reminders_enabled = $${sets.length + 1}`);
        vals.push(req.body.renewal_reminders_enabled);
        out.renewalRemindersEnabled = req.body.renewal_reminders_enabled;
      }

      if (sets.length === 0) return res.status(400).json({ error: "No updatable fields provided" });

      vals.push(userId);
      await pool.query(
        `UPDATE individual_profiles SET ${sets.join(", ")}, updated_at = now() WHERE id = $${vals.length}`,
        vals
      );
      return res.json(out);
    } catch (err: any) {
      console.error("Consumer profile update error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ── Consumer: nickname a policy ("Papa's health plan") ──────────────── */
  app.patch("/api/me/policy/:id", async (req, res) => {
    try {
      const userId = await requireIndividual(req, res);
      if (!userId) return;
      const raw = typeof req.body?.nickname === "string" ? req.body.nickname : "";
      const nickname = raw.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 60) || null;
      // Partial update: nickname (only when sent) and/or a user-confirmed
      // renewal date. renewal_date accepts "YYYY-MM-DD" or "" / null to clear.
      const sets: string[] = [];
      const vals: any[] = [];
      const out: Record<string, any> = {};

      if (typeof req.body?.nickname === "string") {
        sets.push(`nickname = $${sets.length + 1}`);
        vals.push(nickname);
        out.nickname = nickname;
      }
      if ("renewal_date" in (req.body ?? {})) {
        const rd = req.body.renewal_date;
        let renewalDate: string | null = null;
        if (typeof rd === "string" && rd.trim()) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(rd.trim())) {
            return res.status(400).json({ error: "renewal_date must be YYYY-MM-DD" });
          }
          renewalDate = rd.trim();
        }
        sets.push(`renewal_date = $${sets.length + 1}`);
        vals.push(renewalDate);
        out.renewalDate = renewalDate;
        // Let a re-set of the date re-arm the reminder for this cycle.
        sets.push(`reminder_sent_at = NULL`);
      }

      if (sets.length === 0) return res.status(400).json({ error: "No updatable fields provided" });

      vals.push(req.params.id, userId);
      const r = await pool.query(
        `UPDATE individual_policies SET ${sets.join(", ")}, updated_at = now()
          WHERE id = $${vals.length - 1} AND user_id = $${vals.length} RETURNING id`,
        vals
      );
      if (!r.rows[0]) return res.status(404).json({ error: "Not found" });
      return res.json({ id: r.rows[0].id, ...out });
    } catch (err: any) {
      console.error("Consumer policy rename error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ── Consumer: single policy (ownership-scoped) ──────────────────────── */
  app.get("/api/me/policy/:id", async (req, res) => {
    try {
      const userId = await requireIndividual(req, res);
      if (!userId) return;
      const r = await pool.query(
        "SELECT * FROM individual_policies WHERE id = $1 AND user_id = $2",
        [req.params.id, userId]
      );
      if (!r.rows[0]) return res.status(404).json({ error: "Not found" });
      return res.json(r.rows[0]);
    } catch (err: any) {
      console.error("Consumer policy detail error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ── Consumer: download the original stored policy file ──────────────────
     Ownership-scoped. Resolves the storage object behind pdf_url and streams
     it back as an attachment. Mirrors the agent rerun storage-resolution. */
  app.get("/api/me/policy/:id/download", async (req, res) => {
    try {
      const userId = await requireIndividual(req, res);
      if (!userId) return;
      const r = await pool.query(
        "SELECT pdf_url, filename FROM individual_policies WHERE id = $1 AND user_id = $2",
        [req.params.id, userId]
      );
      const row = r.rows[0];
      if (!row) return res.status(404).json({ error: "Not found" });
      if (!row.pdf_url) {
        return res.status(409).json({
          error: "NO_PDF",
          message: "The original document isn't stored for this policy.",
        });
      }

      const pathMatch = row.pdf_url.match(/\/storage\/v1\/object\/(?:sign|public)\/(.+?)(?:\?|$)/);
      if (!pathMatch) {
        return res.status(409).json({ error: "NO_PDF", message: "Stored document URL is not recognized." });
      }
      const [bucket, ...restPath] = pathMatch[1].split("/");
      const storagePath = restPath.join("/");

      const { data: blob, error: dlErr } = await supabaseAdmin.storage.from(bucket).download(storagePath);
      if (dlErr || !blob) {
        return res.status(409).json({ error: "NO_PDF", message: "Could not fetch the stored document." });
      }

      const ext = (storagePath.split(".").pop() || "pdf").toLowerCase();
      const contentType =
        ext === "png" ? "image/png"
        : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
        : ext === "txt" ? "text/plain"
        : "application/pdf";
      // Sanitize the download name; fall back to a stable default.
      const safeName = (row.filename || `policy.${ext}`).replace(/[^\w.\-() ]/g, "_").slice(0, 120);

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
      const buf = Buffer.from(await blob.arrayBuffer());
      return res.send(buf);
    } catch (err: any) {
      console.error("Consumer policy download error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ── Consumer: connect me to an agent (consented lead) ───────────────────
     The ONLY place a signed-in consumer is lead-captured, and only with an
     explicit consent checkbox they tick. Stores the request, then best-effort
     notifies the team; the request survives even if email isn't configured. */
  app.post("/api/me/connect-agent", async (req, res) => {
    try {
      const userId = await requireIndividual(req, res);
      if (!userId) return;

      const clean = (v: unknown, max: number) =>
        (typeof v === "string" ? v.replace(/[\p{Cc}]/gu, "").trim().slice(0, max) : "");

      const name = clean(req.body?.name, 80);
      const phone = clean(req.body?.phone, 20);
      const topic = clean(req.body?.topic, 40) || null;
      const message = clean(req.body?.message, 1000) || null;
      const consent = req.body?.consent === true;

      if (!name) return res.status(400).json({ error: "Please share your name." });
      if (!/\d{7,}/.test(phone.replace(/\D/g, ""))) {
        return res.status(400).json({ error: "Please share a valid phone number." });
      }
      if (!consent) return res.status(400).json({ error: "Please tick the consent box to be contacted." });

      // Account email for the record (best-effort).
      const prof = await pool.query("SELECT email FROM individual_profiles WHERE id = $1", [userId]);
      const email = prof.rows[0]?.email ?? null;

      const ins = await pool.query(
        `INSERT INTO agent_connect_requests (user_id, name, phone, email, topic, message, consent)
         VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
        [userId, name, phone, email, topic, message]
      );
      const id = ins.rows[0].id;

      // Best-effort team notification — never blocks the response.
      const notifyTo = process.env.AGENT_CONNECT_NOTIFY_EMAIL;
      if (notifyTo) {
        void sendMail({
          to: notifyTo,
          subject: `New advisor request: ${name}${topic ? ` (${topic})` : ""}`,
          replyTo: email ?? undefined,
          text: [
            "A consumer asked to be connected with an advisor.",
            "",
            `Request ID: ${id}`,
            `Name: ${name}`,
            `Phone: ${phone}`,
            `Email: ${email ?? "-"}`,
            `Topic: ${topic ?? "-"}`,
            "",
            "Message:",
            message ?? "-",
          ].join("\n"),
        });
      }

      return res.json({ ok: true, id });
    } catch (err: any) {
      console.error("Consumer connect-agent error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ── Consumer: analysis status (reads individual_policies, not job map) ── */
  app.get("/api/me/analyze/status/:jobId", async (req, res) => {
    try {
      const userId = await requireIndividual(req, res);
      if (!userId) return;
      const r = await pool.query(
        `SELECT id, status, report_data, extracted_data, error_message
           FROM individual_policies WHERE job_id = $1 AND user_id = $2`,
        [req.params.jobId, userId]
      );
      const row = r.rows[0];
      if (!row) return res.status(404).json({ status: "not_found", error: "Job not found" });
      if (row.status === "done") {
        return res.json({ status: "completed", policyId: row.id, result: row.report_data ?? row.extracted_data });
      }
      if (row.status === "error") {
        return res.json({ status: "error", policyId: row.id, error: row.error_message });
      }
      return res.json({ status: row.status, policyId: row.id });
    } catch (err: any) {
      console.error("Consumer analyze status error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ── Consumer: upload & analyze OWN policy (clone of /api/agent/analyze) ── */
  // Starts a consumer analysis for an already-authorised, already-quota-checked
  // user. Split out of POST /api/me/analyze so the deferred flow (upload while
  // anonymous, claim after signup) runs the identical path instead of a copy —
  // the two must never drift, because this is where Gemini spend happens.
  //
  // `file` is multer-shaped: a temp path on disk plus the original metadata.
  // Callers own the quota check; this function does not re-check it.
  async function startIndividualAnalysis(
    userId: string,
    file: PolicyFile,
    insuranceType: string
  ): Promise<{ policyId: string; jobId: string }> {
        const isDataEntry = isDataEntryType(insuranceType);

        const jobId = crypto.randomUUID();
        const job: AnalysisJob = {
          id: jobId,
          agentId: userId, // owner uid (shared uuid namespace); status uses individual_policies
          status: "pending",
          createdAt: Date.now(),
          prompt_version: PROMPT_VERSION,
        };
        analysisJobs.set(jobId, job);
        await persistJob(job);

        const policyResult = await pool.query(
          `INSERT INTO individual_policies (user_id, job_id, status, filename, file_size, insurance_type)
           VALUES ($1, $2, 'pending', $3, $4, $5) RETURNING id`,
          [userId, jobId, file.originalname, file.size, insuranceType]
        );
        const policyId = policyResult.rows[0].id;


        // ── background processing ──
        (async () => {
          try {
            job.status = "processing";
            job.extractionStartedAt = Date.now();
            await persistJob(job);
            await pool.query("UPDATE individual_policies SET status = 'processing', updated_at = now() WHERE id = $1", [policyId]);

            const uploadedPolicyText = await extractPolicyText(file, {
              feature: "image_ocr",
              route: "/api/me/analyze",
              sourceType: "individual",
              actorId: userId,
              jobId,
              clientId: policyId,
            });
            job.extractionEndedAt = Date.now();

            // Persist original PDF to storage (best-effort; never blocks analysis).
            try {
              const fileBuffer = fs.readFileSync(file.path);
              const ext = file.originalname.includes(".") ? file.originalname.split(".").pop() : "pdf";
              const storagePath = `${userId}/${policyId}.${ext}`;
              const { error: upErr } = await supabaseAdmin.storage
                .from(PDF_BUCKET)
                .upload(storagePath, fileBuffer, { contentType: file.mimetype || "application/pdf", upsert: true });
              if (upErr) {
                console.error(`[Job ${jobId}] PDF storage upload failed:`, upErr.message);
              } else {
                const { data: signed } = await supabaseAdmin.storage.from(PDF_BUCKET).createSignedUrl(storagePath, 60 * 60);
                if (signed?.signedUrl) {
                  await pool.query("UPDATE individual_policies SET pdf_url = $1 WHERE id = $2", [signed.signedUrl, policyId]);
                }
              }
            } catch (storeErr: any) {
              console.error(`[Job ${jobId}] PDF storage error:`, storeErr.message);
            }

            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

            // ── OCR / data-entry lane (motor/life/travel/property): no scoring ──
            if (isDataEntry) {
              const extraction = await extractStructuredData(uploadedPolicyText, insuranceType, {
                route: "/api/me/analyze",
                sourceType: "individual",
                actorId: userId,
                jobId,
                clientId: policyId,
              });
              if (extraction.status === "completed") {
                job.status = "completed";
                job.result = extraction.data;
                const shared = deriveSharedColumns(insuranceType, extraction.data);
                await pool.query(
                  `UPDATE individual_policies SET
                     status = 'done', insurance_type = $1, extracted_data = $2,
                     insurer = $3, policy_name = $4, expiry_date = $5, sum_insured = $6,
                     policyholder_name = COALESCE(policyholder_name, $7),
                     renewal_date = COALESCE(renewal_date, $8::date), updated_at = now()
                   WHERE id = $9`,
                  [
                    insuranceType,
                    JSON.stringify(extraction.data),
                    shared.insurer ?? null,
                    shared.policy_name ?? null,
                    shared.expiry_date ?? null,
                    shared.sum_insured ?? null,
                    shared.policyholder_name ?? null,
                    parseExpiryToDate(shared.expiry_date),
                    policyId,
                  ]
                );
              } else {
                job.status = "failed";
                job.error = extraction.error;
                await pool.query("UPDATE individual_policies SET status = 'error', error_message = $1, updated_at = now() WHERE id = $2", [readableFailure(extraction.error), policyId]);
              }
              job.completedAt = Date.now();
              await persistJob(job);
              return;
            }

            // ── Health forensic-scoring lane ──
            const result = await runAnalysisPipeline(uploadedPolicyText, insuranceType, {
              route: "/api/me/analyze",
              sourceType: "individual",
              actorId: userId,
              jobId,
              clientId: policyId,
            });

            if (result.status === "completed") {
              job.status = "completed";
              job.result = result.result;
              const reportData = result.result;
              const rawScore = reportData?.audit_score?.score ?? reportData?.final_verdict?.audit_score?.score ?? null;
              const score = rawScore == null ? null : Math.round(Number(rawScore));
              const insurer = result.metadata?.insurer || reportData?.identity?.insurer_name || null;
              const policyName = result.metadata?.product || result.metadata?.plan || reportData?.coverage_structure?.policy_name || null;
              const expiryDate = reportData?.policy_timeline?.policy_expiry_date || null;
              const sumInsured = reportData?.coverage_structure?.base_sum_insured || null;
              const flaws = reportData?.final_verdict?.key_failure_points || [];
              const insuredName = reportData?.identity?.insured_names?.[0] || null;

              await pool.query(
                `UPDATE individual_policies SET
                   status = 'done', report_data = $1, score = $2, insurer = $3,
                   policy_name = $4, expiry_date = $5, sum_insured = $6, flaws = $7,
                   policyholder_name = COALESCE(policyholder_name, $8),
                   renewal_date = COALESCE(renewal_date, $9::date), updated_at = now()
                 WHERE id = $10`,
                [JSON.stringify(reportData), score, insurer, policyName, expiryDate, sumInsured, JSON.stringify(flaws), insuredName, parseExpiryToDate(expiryDate), policyId]
              );
            } else {
              job.status = "failed";
              job.error = result.error;
              await pool.query("UPDATE individual_policies SET status = 'error', error_message = $1, updated_at = now() WHERE id = $2", [readableFailure(result.error), policyId]);
            }
            job.completedAt = Date.now();
            await persistJob(job);
          } catch (err: any) {
            console.error(`[Job ${jobId}] Processing error:`, err);
            job.status = "failed";
            // job.error keeps the raw message — analysis_jobs is our ledger, and
            // it is what we read when someone reports a failure. Only the
            // consumer-facing column gets the plain-language version.
            job.error = err.message || "Unknown error";
            await persistJob(job);
            await pool.query("UPDATE individual_policies SET status = 'error', error_message = $1, updated_at = now() WHERE id = $2", [readableFailure(err), policyId]);
          } finally {
            try {
              if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
            } catch (cleanupErr: any) {
              console.warn(`[Job ${jobId}] temp file cleanup failed:`, cleanupErr?.message);
            }
          }
        })();
    return { policyId, jobId };
  }

  app.post(
    "/api/me/analyze",
    analyzeRateLimiter,
    (req, res, next) => {
      upload.single("file")(req, res, (err: any) => {
        if (err) {
          console.error("MULTER ERROR:", err);
          return res.status(400).json({ error: "File upload failed: " + (err.message || "Unknown error") });
        }
        next();
      });
    },
    async (req, res) => {
      try {
        const userId = await requireIndividual(req, res);
        if (!userId) return;

        const insuranceType = (req.body.type || "health").toLowerCase();

        // ── THE quota choke point — before any Gemini spend ──
        const quota = await checkIndividualQuota(userId, insuranceType);
        if (!quota.allowed) {
          return res.status(403).json({ error: "NEEDS_UPGRADE", reason: quota.reason });
        }

        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const file = req.file;
        const { policyId, jobId } = await startIndividualAnalysis(userId, file, insuranceType);
        res.json({ policyId, jobId, status: "pending" });
      } catch (err: any) {
        console.error("Consumer analyze error:", err);
        res.status(500).json({ error: err.message || "Failed to create analysis job" });
      }
    }
  );

  /* ── Consumer: upload BEFORE signup, claim after ─────────────────────── */
  //
  // Two halves of one flow. A visitor with no account uploads a policy, we park
  // it, and they see a "sign up to view your results" screen. Nothing has been
  // read yet. When they come back authenticated they present the token and the
  // normal metered path runs.
  //
  // The split exists so the wall lands after the effort instead of before it —
  // the old funnel asked strangers to create an account before showing them
  // anything at all.
  //
  // INVARIANT: no Gemini call is reachable from the anonymous half. The quota
  // check lives in the claim handler, on the authenticated side, and
  // startIndividualAnalysis is only ever called from there.

  const pendingUpload = multer({
    dest: "uploads/",
    limits: { fileSize: PENDING_UPLOAD_MAX_BYTES },
  });

  // Only the types extractPolicyText can actually read. Validated before the
  // object is stored, so the bucket never accumulates files nothing can open.
  const PENDING_ALLOWED_MIME = (m: string) =>
    m.includes("pdf") || m.startsWith("image/") || m === "text/plain";

  app.post(
    "/api/upload/pending",
    pendingUploadRateLimiter,
    (req, res, next) => {
      pendingUpload.single("file")(req, res, (err: any) => {
        if (err) {
          const tooBig = err?.code === "LIMIT_FILE_SIZE";
          return res.status(400).json({
            error: tooBig ? "FILE_TOO_LARGE" : "UPLOAD_FAILED",
            message: tooBig
              ? "That file is larger than 10 MB. Try a smaller PDF."
              : "We could not read that file. Try uploading it again.",
          });
        }
        next();
      });
    },
    async (req, res) => {
      const file = req.file;
      try {
        if (!file) return res.status(400).json({ error: "NO_FILE", message: "No file uploaded." });

        const mime = file.mimetype || "";
        if (!PENDING_ALLOWED_MIME(mime)) {
          return res.status(400).json({
            error: "UNSUPPORTED_TYPE",
            message: "Upload a PDF, an image, or a text file.",
          });
        }

        const insuranceType = (req.body.type || "health").toLowerCase();
        const token = crypto.randomBytes(32).toString("base64url");
        const ext = file.originalname.includes(".")
          ? file.originalname.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")
          : "pdf";
        const storagePath = `${PENDING_PREFIX}/${token}.${ext || "pdf"}`;

        const buffer = fs.readFileSync(file.path);
        const { error: upErr } = await supabaseAdmin.storage
          .from(PDF_BUCKET)
          .upload(storagePath, buffer, { contentType: mime || "application/pdf", upsert: false });
        if (upErr) {
          console.error("[pending upload] storage failed:", upErr.message);
          return res.status(500).json({
            error: "STORAGE_FAILED",
            message: "We could not save that file. Please try again.",
          });
        }

        // Hashed, never stored raw — abuse triage only.
        const ipHash = crypto
          .createHash("sha256")
          .update(String(req.ip || ""))
          .digest("hex")
          .slice(0, 32);

        await pool.query(
          `INSERT INTO pending_uploads
             (token, storage_path, filename, file_size, mime_type, insurance_type, ip_hash, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, now() + ($8 || ' hours')::interval)`,
          [token, storagePath, file.originalname, file.size, mime, insuranceType, ipHash, String(PENDING_UPLOAD_TTL_HOURS)]
        );

        res.json({
          token,
          filename: file.originalname,
          insuranceType,
          expiresInHours: PENDING_UPLOAD_TTL_HOURS,
        });
      } catch (err: any) {
        console.error("[pending upload] error:", err);
        res.status(500).json({ error: "UPLOAD_FAILED", message: "Something went wrong. Please try again." });
      } finally {
        try {
          if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        } catch {
          /* temp file cleanup is best-effort; the hourly sweep catches strays */
        }
      }
    }
  );

  // Claim: the authenticated half. This is where the account, the quota and the
  // spend all enter. A token can only be claimed once — claimed_by is set at the
  // end and checked at the start.
  app.post("/api/me/claim-upload", analyzeRateLimiter, async (req, res) => {
    let tempPath: string | null = null;
    try {
      const userId = await requireIndividual(req, res);
      if (!userId) return;

      const token = String(req.body?.token || "");
      if (!token) return res.status(400).json({ error: "NO_TOKEN", message: "No upload to claim." });

      const found = await pool.query(
        `SELECT id, storage_path, filename, file_size, mime_type, insurance_type, claimed_by, expires_at
           FROM pending_uploads WHERE token = $1`,
        [token]
      );
      const row = found.rows[0];
      if (!row) {
        return res.status(404).json({ error: "UPLOAD_NOT_FOUND", message: "That upload is no longer available. Please upload your policy again." });
      }
      if (row.claimed_by) {
        return res.status(409).json({ error: "ALREADY_CLAIMED", message: "That upload has already been used." });
      }
      if (new Date(row.expires_at).getTime() < Date.now()) {
        return res.status(410).json({ error: "UPLOAD_EXPIRED", message: "That upload expired. Please upload your policy again." });
      }

      // ── THE quota choke point — same guard as /api/me/analyze, before spend ──
      // Deliberately BEFORE the file is rehydrated: someone out of slots gets the
      // paywall while their upload stays parked, so upgrading and retrying works
      // without a re-upload.
      const quota = await checkIndividualQuota(userId, row.insurance_type);
      if (!quota.allowed) {
        return res.status(403).json({ error: "NEEDS_UPGRADE", reason: quota.reason, token });
      }

      const { data: blob, error: dlErr } = await supabaseAdmin.storage
        .from(PDF_BUCKET)
        .download(row.storage_path);
      if (dlErr || !blob) {
        console.error("[claim upload] download failed:", dlErr?.message);
        return res.status(500).json({ error: "DOWNLOAD_FAILED", message: "We could not open your file. Please upload it again." });
      }

      // startIndividualAnalysis takes a file on disk, so rehydrate to the same
      // uploads/ dir multer uses. Its finally block unlinks this path.
      const ext = row.storage_path.split(".").pop() || "pdf";
      tempPath = `uploads/claim-${crypto.randomUUID()}.${ext}`;
      fs.writeFileSync(tempPath, Buffer.from(await blob.arrayBuffer()));

      const { policyId, jobId } = await startIndividualAnalysis(
        userId,
        {
          path: tempPath,
          originalname: row.filename,
          size: row.file_size,
          mimetype: row.mime_type,
        },
        row.insurance_type
      );
      tempPath = null; // ownership passed to startIndividualAnalysis

      await pool.query(
        "UPDATE pending_uploads SET claimed_by = $1, claimed_at = now() WHERE id = $2",
        [userId, row.id]
      );

      // The holding copy has served its purpose — startIndividualAnalysis writes
      // its own copy under the user's path. Best-effort: the sweep is the backstop.
      supabaseAdmin.storage
        .from(PDF_BUCKET)
        .remove([row.storage_path])
        .catch((e: any) => console.warn("[claim upload] pending object cleanup failed:", e?.message));

      res.json({ policyId, jobId, status: "pending" });
    } catch (err: any) {
      console.error("[claim upload] error:", err);
      res.status(500).json({ error: "CLAIM_FAILED", message: err.message || "Could not start your analysis." });
    } finally {
      try {
        if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {
        /* best-effort */
      }
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

      recordAccess(req, agentId, id, "update_client");
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

      recordAccess(req, agentId, id, "rerun_client");
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
      } else {
        // A re-run re-does the paid OCR call, so it draws an OCR entry too.
        const ocrBalance = await ensureOcrBalance(agentId);
        if (ocrBalance <= 0) {
          return res.status(403).json({ error: "NO_OCR_CREDITS", message: NO_OCR_CREDITS_MSG });
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
          const policyText = await extractPolicyText(fileLike, {
            feature: "image_ocr",
            route: "/api/agent/clients/:id/rerun",
            sourceType: "agent",
            actorId: agentId,
            clientId: id,
          });

          if (isDataEntry) {
            const extraction = await extractStructuredData(policyText, insuranceType, {
              route: "/api/agent/clients/:id/rerun",
              sourceType: "agent",
              actorId: agentId,
              clientId: id,
            });
            if (extraction.status === "completed") {
              // Draw down one OCR entry — only on a successful re-extraction.
              await consumeOcr(agentId);

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

          const result = await runAnalysisPipeline(policyText, insuranceType, {
            route: "/api/agent/clients/:id/rerun",
            sourceType: "agent",
            actorId: agentId,
            clientId: id,
          });

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

      recordAccess(req, agentId, id, "download_pdf");
      const { pdf_url, filename } = clientRes.rows[0];

      if (!pdf_url) {
        return res.status(404).json({ error: "No PDF stored for this policy" });
      }

      // Stream the bytes through us. We never hand the browser a storage URL —
      // that would leak the Supabase project/bucket and stay openable for the
      // life of the signature.
      const pathMatch = pdf_url.match(/\/storage\/v1\/object\/(?:sign|public)\/(.+?)(?:\?|$)/);
      if (!pathMatch) {
        return res.status(409).json({ error: "Stored document URL is not recognized" });
      }
      const [bucket, ...rest] = pathMatch[1].split("/");
      const storagePath = rest.join("/");

      const { data: blob, error: dlErr } = await supabaseAdmin.storage.from(bucket).download(storagePath);
      if (dlErr || !blob) {
        return res.status(409).json({ error: "Could not fetch the stored document" });
      }

      const ext = (storagePath.split(".").pop() || "pdf").toLowerCase();
      const contentType =
        ext === "png" ? "image/png"
        : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
        : ext === "txt" ? "text/plain"
        : "application/pdf";
      const safeName = (filename || `policy.${ext}`).replace(/[^\w.\-() ]/g, "_").slice(0, 120);

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
      return res.send(Buffer.from(await blob.arrayBuffer()));
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

  app.post("/api/leads", leadsRateLimiter, async (req, res) => {
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
        `INSERT INTO marketing_leads (name, email, phone, city, source, status, created_at, updated_at)
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

  /* ── Public: Advisor landing pages (indsure.in/a/:slug) ──────────────────
   * A per-agent public page an advisor shares on WhatsApp, in an Instagram bio,
   * or as a printed QR code. Everything submitted lands in that agent's
   * existing agent_leads pipeline.
   *
   * Three rules hold this path together:
   *  1. NO Gemini, ever. This is an unauthenticated URL that accepts file
   *     uploads from strangers; running extraction here would be an unbounded
   *     spend hole. The advisor reads the uploaded policy himself.
   *  2. Reads never touch the `agents` table — only the marketing subset in
   *     agent_pages, which holds nothing private.
   *  3. A page is live only when WE enabled it and the AGENT published it.
   */

  // Deliberately loose. Indian mobile carriers put thousands of subscribers
  // behind one NAT egress IP, so a tight per-IP cap blocks real prospects
  // (several genuine visitors can share an IP) while barely inconveniencing a
  // scripted abuser. There is no phone verification by design — the agent calls
  // every lead anyway — so this limiter is a brake on floods, not a spam filter.
  const advisorLeadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many submissions. Please try again later." },
  });

  const advisorViewLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests." },
  });

  // Separate from the global `upload`: a prospect photographing a paper policy
  // sends several images, not one PDF, so this takes up to 8 files at 8MB each
  // rather than a single 25MB file.
  const advisorUpload = multer({
    dest: "uploads/",
    limits: { fileSize: 8 * 1024 * 1024, files: 8 },
  });

  const ADVISOR_ALLOWED_MIME = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    // iPhones hand over HEIC/HEIF by default. We never decode these — the file
    // is stored and handed to the advisor as-is — so accepting them is safe and
    // avoids rejecting a large share of real uploads.
    "image/heic",
    "image/heif",
  ]);

  // agent_pages.lines_of_business uses the four public marketing lines; the
  // lead_policies table predates it and uses its own set. Map, don't guess.
  const LOB_TO_POLICY_TYPE: Record<string, string> = {
    vehicle: "motor",
    health: "health",
    life: "life",
    term: "life",
  };

  const isLiveSlug = (s: string) => /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(s);

  /**
   * Which app the link was opened in, and on what.
   *
   * This exists because advisors paste bare, untagged links — so UTM parameters
   * alone would leave most traffic as "direct". In-app browsers identify
   * themselves in the User-Agent, which recovers the channel with no cooperation
   * from the advisor and nothing visible to the visitor.
   *
   * Returns coarse buckets only. The raw User-Agent is deliberately NOT stored
   * anywhere: a full UA string is high-entropy enough to help fingerprint an
   * individual, and none of these callers need that.
   */
  function readClient(req: any): { app: string; device: string; os: string } {
    const ua = String(req.headers?.["user-agent"] || "");

    // Order matters. Instagram's and Facebook's webviews also carry FBAV/FBAN
    // tokens, so the more specific app has to be tested first.
    const app =
      /Instagram/i.test(ua) ? "instagram"
      : /FBAN|FBAV|FB_IAB/i.test(ua) ? "facebook"
      : /WhatsApp/i.test(ua) ? "whatsapp"
      : /Telegram/i.test(ua) ? "telegram"
      : /LinkedInApp/i.test(ua) ? "linkedin"
      : ua ? "browser"
      : "other";

    const isTablet = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua);
    const isMobile = /Mobi|Android|iPhone|iPod|IEMobile|BlackBerry|Opera Mini/i.test(ua);
    const device = isTablet ? "tablet" : isMobile ? "mobile" : ua ? "desktop" : "unknown";

    const os =
      /iPhone|iPad|iPod|iOS/i.test(ua) ? "ios"
      : /Android/i.test(ua) ? "android"
      : /Windows/i.test(ua) ? "windows"
      : /Mac OS X|Macintosh/i.test(ua) ? "macos"
      : /Linux/i.test(ua) ? "linux"
      : "unknown";

    return { app, device, os };
  }

  /** Public page data. 404 = no such advisor; { live:false } = page pulled.
   *  The distinction matters: QR codes outlive subscriptions, so a page that
   *  was real yesterday must say so rather than showing a bare 404. */
  app.get("/api/p/:slug", async (req, res) => {
    const slug = String(req.params.slug || "").toLowerCase();
    if (!isLiveSlug(slug)) return res.status(404).json({ error: "Not found" });

    try {
      const { rows } = await pool.query(
        `SELECT id, slug, display_name, photo_url, city, languages,
                lines_of_business, primary_locale, whatsapp_number,
                (enabled AND published) AS live
           FROM agent_pages
          WHERE slug = $1`,
        [slug]
      );
      if (rows.length === 0) return res.status(404).json({ error: "Not found" });

      const page = rows[0];
      if (!page.live) return res.json({ live: false, display_name: page.display_name });

      return res.json({
        live: true,
        slug: page.slug,
        display_name: page.display_name,
        photo_url: page.photo_url,
        city: page.city,
        languages: page.languages ?? [],
        lines_of_business: page.lines_of_business ?? [],
        primary_locale: page.primary_locale,
        // The advisor's own business number is the point of the page; the login
        // phone on their profile is not exposed here.
        whatsapp_number: page.whatsapp_number,
      });
    } catch (err: any) {
      console.error("advisor page fetch error:", err?.message);
      return res.status(500).json({ error: "Could not load this page" });
    }
  });

  /** Anonymous view counter. Rolled up per page/day/source — no IP, no user
   *  agent, nothing identifying. Without this, lead counts have no denominator
   *  and "which ad worked" is unanswerable. */
  app.post("/api/p/:slug/view", advisorViewLimiter, async (req, res) => {
    const slug = String(req.params.slug || "").toLowerCase();
    if (!isLiveSlug(slug)) return res.status(204).end();

    const source = String(req.body?.utm_source || "direct").slice(0, 40).toLowerCase() || "direct";
    const { app, device } = readClient(req);
    try {
      await pool.query(
        `INSERT INTO agent_page_views (page_id, viewed_on, utm_source, app, device, views)
         SELECT id, CURRENT_DATE, $2, $3, $4, 1 FROM agent_pages
          WHERE slug = $1 AND enabled AND published
         ON CONFLICT (page_id, viewed_on, utm_source, app, device)
         DO UPDATE SET views = agent_page_views.views + 1`,
        [slug, source, app, device]
      );
    } catch (err: any) {
      // A analytics write must never break the page for a visitor.
      console.warn("advisor view count failed:", err?.message);
    }
    return res.status(204).end();
  });

  /** Lead capture. Writes agent_leads (+ lead_policies for any uploaded file)
   *  stamped with the advisor, the campaign, and the exact consent sentence the
   *  visitor ticked. */
  app.post(
    "/api/p/:slug/lead",
    advisorLeadLimiter,
    (req, res, next) => {
      advisorUpload.array("files", 8)(req, res, (err: any) => {
        if (err) {
          console.error("ADVISOR LEAD MULTER ERROR:", err?.message);
          return res.status(400).json({
            error:
              err?.code === "LIMIT_FILE_SIZE"
                ? "Each file must be under 8MB."
                : "Could not read those files. Please try again.",
          });
        }
        next();
      });
    },
    async (req, res) => {
      const slug = String(req.params.slug || "").toLowerCase();
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      const cleanup = () => {
        for (const f of files) {
          try {
            if (f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path);
          } catch { /* best effort */ }
        }
      };

      try {
        // Hidden field no human ever sees. A bot that fills every input gets a
        // 200 and goes away none the wiser; nothing is written.
        if (String(req.body?.company || "").trim() !== "") {
          cleanup();
          return res.json({ ok: true });
        }

        const name = String(req.body?.name || "").trim();
        const phoneRaw = String(req.body?.phone || "").replace(/\D/g, "");
        const phone = phoneRaw.length > 10 ? phoneRaw.slice(-10) : phoneRaw;
        const intent = String(req.body?.intent || "talk"); // 'talk' | 'policy'
        const lob = String(req.body?.lob || "").toLowerCase();
        const message = String(req.body?.message || "").trim().slice(0, 1000);
        const consentText = String(req.body?.consent_text || "").trim().slice(0, 500);

        if (!name || name.length > 120) {
          cleanup();
          return res.status(400).json({ error: "Please enter your name." });
        }
        if (!/^[6-9][0-9]{9}$/.test(phone)) {
          cleanup();
          return res.status(400).json({ error: "Please enter a valid 10-digit mobile number." });
        }
        if (!consentText) {
          cleanup();
          return res.status(400).json({ error: "Please tick the consent box to continue." });
        }
        if (lob && !LOB_TO_POLICY_TYPE[lob]) {
          cleanup();
          return res.status(400).json({ error: "Unknown insurance type." });
        }
        for (const f of files) {
          if (!ADVISOR_ALLOWED_MIME.has(f.mimetype)) {
            cleanup();
            return res.status(400).json({ error: "Please upload a PDF or a photo." });
          }
        }

        const pageRes = await pool.query(
          `SELECT p.id, p.agent_id, p.display_name,
                  a.email AS agent_email,
                  coalesce(a.full_name, a.name) AS agent_name
             FROM agent_pages p
             JOIN agents a ON a.id = p.agent_id
            WHERE p.slug = $1 AND p.enabled AND p.published`,
          [slug]
        );
        if (pageRes.rows.length === 0) {
          cleanup();
          return res.status(404).json({ error: "This advisor's page is no longer active." });
        }
        const page = pageRes.rows[0];
        const agentId: string = page.agent_id;

        const utm = {
          source: String(req.body?.utm_source || "").slice(0, 60) || null,
          medium: String(req.body?.utm_medium || "").slice(0, 60) || null,
          campaign: String(req.body?.utm_campaign || "").slice(0, 80) || null,
        };
        const ip = (req.ip || "").slice(0, 45) || null;

        // Context the advisor sees on the card before ringing them. Unlike the
        // anonymous view counter this is attached to a person who gave their
        // name, their number and explicit consent.
        const client = readClient(req);
        const referrer = String(req.headers?.referer || req.headers?.referrer || "").slice(0, 300) || null;

        // Someone who taps "talk" and then comes back to send a policy is one
        // prospect, not two. Inside 24h we append to the existing lead instead
        // of splitting the advisor's follow-up across duplicate cards.
        const dupe = await pool.query(
          `SELECT id, notes FROM agent_leads
            WHERE agent_id = $1 AND regexp_replace(coalesce(phone,''), '\\D', '', 'g') LIKE $2
              AND created_at > now() - interval '24 hours'
            ORDER BY created_at DESC LIMIT 1`,
          [agentId, `%${phone}`]
        );

        let leadId: string;
        const isFollowUp = dupe.rows.length > 0;
        const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
        const noteLine = [
          `[${stamp}] via ${slug} page`,
          intent === "policy" ? "sent a policy for review" : "asked to talk",
          lob ? `(${lob})` : "",
          message ? `— "${message}"` : "",
        ].filter(Boolean).join(" ");

        if (isFollowUp) {
          leadId = dupe.rows[0].id;
          await pool.query(
            `UPDATE agent_leads
                SET notes = coalesce(notes || E'\\n', '') || $2,
                    status = CASE WHEN status IN ('won','lost') THEN status ELSE 'new' END,
                    updated_at = now()
              WHERE id = $1`,
            [leadId, noteLine]
          );
        } else {
          const ins = await pool.query(
            `INSERT INTO agent_leads (
               agent_id, name, phone, source, insurance_interest, status, notes,
               utm_source, utm_medium, utm_campaign, landing_slug,
               consent_text, consent_at, consent_ip,
               source_app, source_device, source_os, referrer
             ) VALUES ($1,$2,$3,$4,$5,'new',$6,$7,$8,$9,$10,$11,now(),$12,$13,$14,$15,$16)
             RETURNING id`,
            [
              agentId, name, phone, "Advisor page", lob || null, noteLine,
              utm.source, utm.medium, utm.campaign, slug,
              consentText, ip,
              client.app, client.device, client.os, referrer,
            ]
          );
          leadId = ins.rows[0].id;
        }

        // Files go to the private policy bucket under the owning agent, exactly
        // like an agent-uploaded lead policy. No extraction is run on them.
        let stored = 0;
        for (const f of files) {
          const policyId = crypto.randomUUID();
          try {
            const buf = fs.readFileSync(f.path);
            const ext = f.originalname.includes(".")
              ? f.originalname.split(".").pop()!.toLowerCase().slice(0, 5)
              : "pdf";
            const storagePath = `${agentId}/advisor-page/${leadId}/${policyId}.${ext}`;
            const { error: upErr } = await supabaseAdmin.storage
              .from(PDF_BUCKET)
              .upload(storagePath, buf, { contentType: f.mimetype, upsert: true });
            if (upErr) {
              console.error(`[advisor-lead ${leadId}] storage upload failed:`, upErr.message);
              continue;
            }
            const { data: signed } = await supabaseAdmin.storage
              .from(PDF_BUCKET)
              .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

            await pool.query(
              `INSERT INTO lead_policies (
                 id, lead_id, agent_id, insurance_type, file_url, file_name, notes
               ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
              [
                policyId, leadId, agentId,
                LOB_TO_POLICY_TYPE[lob] || "motor",
                signed?.signedUrl ?? null,
                String(f.originalname || "policy").slice(0, 160),
                "Uploaded by the prospect on the advisor page. Not analysed.",
              ]
            );
            stored += 1;
          } catch (storeErr: any) {
            console.error(`[advisor-lead ${leadId}] file error:`, storeErr?.message);
          }
        }

        cleanup();

        // Tell the advisor straight away. The in-portal badge only works if they
        // happen to be logged in, and a lead that sits unread for a day is a lead
        // lost — these prospects are ringing three agents, not one. Best-effort:
        // the lead is already committed above, so a mail failure costs nothing.
        const advisorEmail = String(page.agent_email || "").trim();
        if (advisorEmail) {
          const waLink = `https://wa.me/91${phone}`;
          const portalLink = `${(process.env.PUBLIC_APP_ORIGIN || "https://indsure.in").replace(/\/+$/, "")}/agent/leads`;
          const wants = intent === "policy" ? "sent you a policy to check" : "asked you to call them";
          const lobLabel = lob ? ` (${lob})` : "";
          const esc = (s: string) =>
            s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

          void sendMail({
            to: advisorEmail,
            subject: isFollowUp
              ? `${name} sent you something else — ${phone}`
              : `New lead: ${name} — ${phone}`,
            text: [
              isFollowUp
                ? `${name} came back to your IndSure page and ${wants}${lobLabel}.`
                : `${name} filled your IndSure page and ${wants}${lobLabel}.`,
              "",
              `Phone: ${phone}`,
              `WhatsApp: ${waLink}`,
              stored > 0 ? `Files: ${stored} attached to the lead in your portal` : "",
              message ? `\nWhat they wrote:\n"${message}"` : "",
              "",
              `Open the lead: ${portalLink}`,
              "",
              "Call them today if you can — they are usually asking more than one advisor.",
            ].filter(Boolean).join("\n"),
            html: [
              `<p>${esc(name)} ${isFollowUp ? "came back to" : "filled"} your IndSure page and ${wants}${esc(lobLabel)}.</p>`,
              `<p style="font-size:20px;margin:16px 0"><b><a href="tel:+91${phone}">${phone}</a></b>`,
              ` &nbsp; <a href="${waLink}">WhatsApp</a></p>`,
              stored > 0 ? `<p>${stored} file(s) attached to the lead in your portal.</p>` : "",
              message ? `<p>What they wrote:<br><i>"${esc(message)}"</i></p>` : "",
              `<p><a href="${portalLink}">Open the lead</a></p>`,
              `<p style="color:#666">Call them today if you can — they are usually asking more than one advisor.</p>`,
            ].filter(Boolean).join(""),
          });
        } else {
          console.warn(`[advisor-lead ${leadId}] no email on agent ${agentId} — portal badge only`);
        }

        console.log(`✅ Advisor-page lead for ${slug}: ${name} (${stored} file(s))`);

        return res.status(201).json({ ok: true, files_saved: stored });
      } catch (err: any) {
        cleanup();
        console.error("advisor lead error:", err?.message);
        return res.status(500).json({ error: "Could not send that. Please try again." });
      }
    }
  );

  /* ── Admin: Get Leads ─────────────────────────────────────────── */

  app.get("/api/leads", isAdmin, async (req, res) => {
    try {
      const { status, limit = 50, offset = 0 } = req.query;

      let query = `
        SELECT id, name, email, phone, city, source, status, notes, 
               created_at, updated_at, contacted_at, contacted_by
        FROM marketing_leads
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
        ? `SELECT COUNT(*) FROM marketing_leads WHERE status = $1`
        : `SELECT COUNT(*) FROM marketing_leads`;
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
