// ============================================================================
// WhatsApp channel for advisors (beta). Plan: docs/plans/2026-09-25-whatsapp-bot-beta.md. Unplug: whatsapp-bot/UNPLUG.md
//
// Two surfaces live here:
//
//   1. /api/agent/whatsapp/*   the portal side. A signed-in advisor asks for a link code,
//      sees their link, disconnects. Ordinary JWT auth.
//
//   2. /api/internal/wa/*      the bot side. Called ONLY by the whatsapp-bot process on the
//      same box, authenticated by a shared key. The bot holds no database credentials of its
//      own; everything it reads or writes goes through here, scoped to one advisor.
//
// And one hook, `resolveWaBotAgent`, which lets verifyJwt accept the bot acting for an
// advisor on exactly two routes (analyze and its status poll), so a WhatsApp check runs the
// SAME code path, metering and storage as a portal upload. Nothing else accepts bot headers.
//
// What the key guard does NOT rely on: the caller's IP. The server runs with
// `trust proxy 1` (index.ts), and nginx on the same box reaches the backend over loopback,
// so "it came from localhost" proves nothing. The key is the guard. As defence in depth a bot
// request must also arrive on a loopback socket with NO proxy headers, because nginx always
// adds X-Forwarded-For and the bot never does.
// ============================================================================

import type { Express } from "express";
import crypto from "crypto";
import { pool } from "../lib/db";
import { log } from "../lib/logger";
import { AIService } from "../services/aiService";
import { AI_CONFIG } from "../config/ai_config";
import { checkAnswerNumbers, parseIntent } from "./answerGuard";
import { compareMany, type WordingProfile } from "../types/wordingProfile";
import { EXTRACTION_FIELDS } from "../services/extractionFields";

type VerifyJwt = (req: any, res: any) => Promise<string | null>;

const LINK_CODE_TTL_MIN = 10;
const LINK_CODE_MAX_ATTEMPTS = 5;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Routes on which verifyJwt will accept the bot acting for an advisor. Method + Express
 *  route pattern. Adding to this list widens what a leaked bot key can do; don't, without a
 *  plan entry. */
const BOT_ROUTES = new Set([
  "POST /api/agent/analyze",
  "GET /api/agent/analyze/status/:jobId",
]);

/* ── Key guard ──────────────────────────────────────────────────────────── */

/** Exported for the global rate limiter (index.ts): a request carrying the valid bot key
 *  is exempt, because all bot traffic comes from one loopback address and status polling
 *  alone would trip a per-IP limit meant for browsers. */
export function isWaBotRequest(req: any): boolean {
  return botKeyOk(req);
}

function botKeyOk(req: any): boolean {
  const expected = process.env.WA_BOT_KEY || "";
  // Unset or short key = the whole bot surface is off.
  if (expected.length < 32) return false;
  const given = String(req.headers["x-wa-bot-key"] || "");
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  if (req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.headers["forwarded"]) return false;
  const addr = String(req.socket?.remoteAddress || "");
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

/** Linked AND allow-listed. The only two things that make an advisor servable. */
async function agentServable(agentId: string): Promise<boolean> {
  if (!UUID_RE.test(agentId)) return false;
  const r = await pool.query(
    `SELECT 1 FROM whatsapp_link l
       JOIN wa_allowlist w ON w.agent_id = l.agent_id
      WHERE l.agent_id = $1 AND l.status = 'active'`,
    [agentId]
  );
  return r.rows.length > 0;
}

/**
 * Called first thing in verifyJwt.
 *   undefined  no bot headers at all: carry on with normal JWT auth.
 *   null       bot headers present but not acceptable: reject.
 *   string     the advisor the bot is acting for.
 */
export async function resolveWaBotAgent(req: any): Promise<string | null | undefined> {
  if (!req.headers["x-wa-bot-key"] && !req.headers["x-wa-agent-id"]) return undefined;
  const routeKey = `${req.method} ${req.route?.path ?? ""}`;
  if (!BOT_ROUTES.has(routeKey)) return null;
  if (!botKeyOk(req)) return null;
  const agentId = String(req.headers["x-wa-agent-id"] || "");
  if (!(await agentServable(agentId))) return null;
  return agentId;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

/** Indian mobile to E.164 digits (no plus). Accepts 10 digits, 0-prefixed, or 91-prefixed. */
export function normaliseWaNumber(raw: unknown): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(d)) return "91" + d;
  if (/^0[6-9]\d{9}$/.test(d)) return "91" + d.slice(1);
  if (/^91[6-9]\d{9}$/.test(d)) return d;
  return null;
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** Last 4 digits only, for logs. */
const maskNumber = (n: string) => (n.length > 4 ? "…" + n.slice(-4) : "…");

/** A saved "name" that is really a file name ("Policy Kit_PROHLV050040281.pdf"): an early bot
 *  build filed forwarded PDFs under their caption, which WhatsApp fills with the file name. */
export function looksLikeFileName(name: unknown): boolean {
  return /\.(pdf|docx?|jpe?g|png)\s*$/i.test(String(name ?? "").trim());
}

/** Who the policy is for, in the order the advisor would expect: the customer it is filed
 *  under, the name on the row, then the insured named in the report itself. A name that is
 *  really a file name is skipped, never shown or put in a customer message. Read-only. */
export function displayName(row: any): string | null {
  const reportName = row.report_data?.identity?.insured_names?.[0] ?? null;
  for (const n of [row.customer_name, row.policyholder_name, reportName]) {
    const v = typeof n === "string" ? n.trim() : "";
    if (v && !looksLikeFileName(v)) return v;
  }
  return null;
}

/** Pull the fields the bot is allowed to talk about out of a stored report. Everything the
 *  advisor is told comes from this object and nothing else. */
function reportSummary(row: any) {
  const r = row.report_data || {};
  const fv = r.final_verdict || {};
  const be = r.benefit_evaluation || {};
  const crisk = r.claim_risk_analysis || {};
  const pc = r.policy_commercials || {};
  return {
    clientId: row.id,
    status: row.status,
    errorMessage: row.status === "done" ? null : row.error_message ?? null,
    insuranceType: row.insurance_type,
    policyholderName: displayName(row),
    customerId: row.customer_id ?? null,
    customerPhone: row.customer_phone || row.client_phone || null,
    insurer: row.insurer ?? null,
    policyName: row.policy_name ?? null,
    score: row.score ?? null,
    shareToken: row.share_enabled ? row.share_token : null,
    views: row.views ?? 0,
    expiryDate: row.expiry_date ?? null,
    weakPoint: row.report_data?.final_verdict?.key_failure_points?.[0] ?? null,
    details: dataEntryDetails(row.insurance_type, row.extracted_data),
    extracted: row.insurance_type === "life" || row.insurance_type === "term" ? row.extracted_data ?? null : null,
    report: row.report_data
      ? {
          verdictLabel: fv.label ?? null,
          verdictSummary: fv.summary ?? null,
          interpretation: r.audit_score?.interpretation ?? null,
          effectiveCover: r.audit_score?.nec ?? null,
          baseSumInsured: r.coverage_structure?.base_sum_insured ?? null,
          premiumTotal: pc.premium_total_payable ?? null,
          whereItMayCost: (be.where_policy_fails || []).map((f: any) => ({
            issue: f.issue ?? null,
            impact: f.real_world_claim_impact ?? null,
            outOfPocket: f.quantified_oop_risk ?? null,
          })),
          whatWorks: (be.what_actually_works || []).map((w: any) => ({
            benefit: w.benefit ?? null,
            why: w.why_it_matters_in_claim ?? null,
            value: w.quantified_value ?? null,
          })),
          roomRent: crisk.room_rent
            ? {
                limit: crisk.room_rent.limit_value ?? null,
                perDay: crisk.room_rent.limit_amount_per_day ?? null,
                penalty: crisk.room_rent.penalty_type ?? null,
                explanation: crisk.room_rent.explanation ?? null,
              }
            : null,
          coPay: crisk.co_payment
            ? {
                exists: crisk.co_payment.exists ?? null,
                percentage: crisk.co_payment.percentage ?? null,
                conditions: crisk.co_payment.conditions ?? null,
                outOfPocketOn5L: crisk.co_payment.oop_on_5L_claim ?? null,
              }
            : null,
          subLimits: crisk.sub_limits?.exists
            ? (crisk.sub_limits.categories || []).map((c: any) => ({
                procedure: c.procedure ?? null,
                limit: c.limit ?? null,
                gap: c.gap ?? null,
              }))
            : [],
          waitingPeriods: r.waiting_periods ?? null,
        }
      : null,
  };
}

/** A data-entry policy's fields with the portal's own labels (EXTRACTION_FIELDS), empty ones
 *  left out. Displayed as stored; nothing is calculated. */
function dataEntryDetails(type: string, data: any): { label: string; value: string }[] {
  const fields = (EXTRACTION_FIELDS as any)[type] as { key: string; label: string; type: string }[] | undefined;
  if (!fields || !data || typeof data !== "object") return [];
  const out: { label: string; value: string }[] = [];
  for (const f of fields) {
    const v = data[f.key];
    if (v === null || v === undefined || v === "" || f.type === "json" || typeof v === "object") continue;
    out.push({ label: f.label, value: String(v) });
  }
  return out;
}

const CLIENT_SELECT = `
  SELECT c.id, c.status, c.error_message, c.insurance_type, c.policyholder_name, c.client_phone,
         c.insurer, c.policy_name, c.score, c.share_token, c.share_enabled, c.views,
         c.expiry_date, c.report_data, c.extracted_data, c.customer_id,
         cu.name AS customer_name, cu.phone AS customer_phone
    FROM clients c
    LEFT JOIN customers cu ON cu.id = c.customer_id AND cu.agent_id = c.agent_id`;

/* ── Routes ─────────────────────────────────────────────────────────────── */

export function registerWhatsappRoutes(app: Express, verifyJwt: VerifyJwt): void {

  /* ── Portal: link status. `eligible` hides the whole card for non-beta accounts. ── */
  app.get("/api/agent/whatsapp", async (req, res) => {
    try {
      const agentId = await verifyJwt(req, res);
      if (!agentId) return;
      const allow = await pool.query("SELECT 1 FROM wa_allowlist WHERE agent_id = $1", [agentId]);
      if (allow.rows.length === 0) return res.json({ eligible: false });
      const link = await pool.query(
        `SELECT wa_number, status, linked_at, code_expires_at FROM whatsapp_link
          WHERE agent_id = $1 AND status IN ('active', 'pending')
          ORDER BY (status = 'active') DESC, created_at DESC LIMIT 1`,
        [agentId]
      );
      const row = link.rows[0];
      res.json({
        eligible: true,
        botNumber: process.env.WA_BOT_DISPLAY_NUMBER || null,
        status: row?.status ?? "none",
        number: row?.wa_number ?? null,
        linkedAt: row?.linked_at ?? null,
        codeExpiresAt: row?.status === "pending" ? row.code_expires_at : null,
      });
    } catch (err: any) {
      log.error("whatsapp status failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ── Portal: issue a 6-digit code for a number. Replaces any earlier pending code. ── */
  app.post("/api/agent/whatsapp/link-code", async (req, res) => {
    try {
      const agentId = await verifyJwt(req, res);
      if (!agentId) return;
      const allow = await pool.query("SELECT 1 FROM wa_allowlist WHERE agent_id = $1", [agentId]);
      if (allow.rows.length === 0) return res.status(403).json({ error: "NOT_IN_BETA" });
      const number = normaliseWaNumber(req.body?.number);
      if (!number) return res.status(400).json({ error: "BAD_NUMBER", message: "Enter a 10-digit Indian mobile number." });

      const taken = await pool.query(
        "SELECT agent_id FROM whatsapp_link WHERE wa_number = $1 AND status = 'active' AND agent_id <> $2",
        [number, agentId]
      );
      if (taken.rows.length > 0) {
        return res.status(409).json({ error: "NUMBER_IN_USE", message: "This number is already connected to another IndSure account." });
      }

      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
      await pool.query("DELETE FROM whatsapp_link WHERE agent_id = $1 AND status = 'pending'", [agentId]);
      const ins = await pool.query(
        `INSERT INTO whatsapp_link (agent_id, wa_number, status, link_code_hash, code_expires_at)
         VALUES ($1, $2, 'pending', $3, now() + ($4 || ' minutes')::interval)
         RETURNING code_expires_at`,
        [agentId, number, sha256(`${number}:${code}`), String(LINK_CODE_TTL_MIN)]
      );
      res.json({ code, number, expiresAt: ins.rows[0].code_expires_at, botNumber: process.env.WA_BOT_DISPLAY_NUMBER || null });
    } catch (err: any) {
      log.error("whatsapp link-code failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ── Portal: disconnect. Revokes, never deletes (kept for the audit trail). ── */
  app.post("/api/agent/whatsapp/disconnect", async (req, res) => {
    try {
      const agentId = await verifyJwt(req, res);
      if (!agentId) return;
      const r = await pool.query(
        `UPDATE whatsapp_link SET status = 'revoked', revoked_at = now()
          WHERE agent_id = $1 AND status IN ('active', 'pending')`,
        [agentId]
      );
      res.json({ ok: true, revoked: r.rowCount ?? 0 });
    } catch (err: any) {
      log.error("whatsapp disconnect failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ══ Bot-only surface ═══════════════════════════════════════════════════ */

  // Every /api/internal/wa route: key guard, then (for advisor-scoped routes) the advisor
  // must be linked and allow-listed. 404 on a bad key so the surface does not announce itself.
  app.use("/api/internal/wa", (req: any, res: any, next: any) => {
    if (!botKeyOk(req)) return res.status(404).json({ error: "Not found" });
    next();
  });

  async function scopedAgent(req: any, res: any): Promise<string | null> {
    const agentId = String(req.headers["x-wa-agent-id"] || "");
    if (!(await agentServable(agentId))) {
      res.status(403).json({ error: "NOT_LINKED" });
      return null;
    }
    return agentId;
  }

  /** Who is this number? */
  app.post("/api/internal/wa/resolve", async (req, res) => {
    try {
      const number = normaliseWaNumber(req.body?.number);
      if (!number) return res.json({ agentId: null, servable: false });
      const r = await pool.query(
        `SELECT l.agent_id, (w.agent_id IS NOT NULL) AS allowlisted
           FROM whatsapp_link l LEFT JOIN wa_allowlist w ON w.agent_id = l.agent_id
          WHERE l.wa_number = $1 AND l.status = 'active' LIMIT 1`,
        [number]
      );
      const row = r.rows[0];
      res.json({ agentId: row?.agent_id ?? null, servable: !!row?.allowlisted });
    } catch (err: any) {
      log.error("wa resolve failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** LINK <code> from a number. The code must match THAT number and be unexpired. */
  app.post("/api/internal/wa/link", async (req, res) => {
    try {
      const number = normaliseWaNumber(req.body?.number);
      const code = String(req.body?.code || "").replace(/\D/g, "");
      if (!number || code.length !== 6) return res.json({ ok: false, reason: "bad_code" });

      const pending = await pool.query(
        `SELECT id, agent_id, link_code_hash, code_expires_at, code_attempts FROM whatsapp_link
          WHERE wa_number = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
        [number]
      );
      const row = pending.rows[0];
      if (!row) return res.json({ ok: false, reason: "no_pending" });
      if (row.code_attempts >= LINK_CODE_MAX_ATTEMPTS) return res.json({ ok: false, reason: "too_many" });
      if (new Date(row.code_expires_at).getTime() < Date.now()) return res.json({ ok: false, reason: "expired" });

      const a = Buffer.from(sha256(`${number}:${code}`));
      const b = Buffer.from(String(row.link_code_hash || ""));
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        await pool.query("UPDATE whatsapp_link SET code_attempts = code_attempts + 1 WHERE id = $1", [row.id]);
        return res.json({ ok: false, reason: "bad_code" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // A number moves with its owner: any older active link for this advisor or this
        // number is revoked in the same transaction, so the unique indexes never trip.
        await client.query(
          `UPDATE whatsapp_link SET status = 'revoked', revoked_at = now()
            WHERE status = 'active' AND (agent_id = $1 OR wa_number = $2)`,
          [row.agent_id, number]
        );
        await client.query(
          `UPDATE whatsapp_link SET status = 'active', linked_at = now(), link_code_hash = NULL
            WHERE id = $1`,
          [row.id]
        );
        await client.query(
          `INSERT INTO wa_conversation (agent_id, state) VALUES ($1, 'IDLE')
           ON CONFLICT (agent_id) DO UPDATE SET state = 'IDLE', pending_context = '{}'::jsonb, updated_at = now()`,
          [row.agent_id]
        );
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
      const allow = await pool.query("SELECT 1 FROM wa_allowlist WHERE agent_id = $1", [row.agent_id]);
      log.info("wa linked", { number: maskNumber(number) });
      res.json({ ok: true, agentId: row.agent_id, servable: allow.rows.length > 0 });
    } catch (err: any) {
      log.error("wa link failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/internal/wa/unlink", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      await pool.query(
        "UPDATE whatsapp_link SET status = 'revoked', revoked_at = now() WHERE agent_id = $1 AND status = 'active'",
        [agentId]
      );
      res.json({ ok: true });
    } catch (err: any) {
      log.error("wa unlink failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Log one message. Inbound inserts are the dedupe: `duplicate: true` means we have
   *  already seen this WhatsApp message id and the bot must not reply again. */
  app.post("/api/internal/wa/messages", async (req, res) => {
    try {
      const b = req.body || {};
      const agentId = b.agentId && UUID_RE.test(String(b.agentId)) ? String(b.agentId) : null;
      const r = await pool.query(
        `INSERT INTO wa_message (wa_message_id, agent_id, direction, type, body_redacted, media_sha256, intent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (wa_message_id) DO NOTHING
         RETURNING id`,
        [
          b.waMessageId || null,
          agentId,
          b.direction === "out" ? "out" : "in",
          ["text", "document", "media", "system"].includes(b.type) ? b.type : "text",
          typeof b.bodyRedacted === "string" ? b.bodyRedacted.slice(0, 2000) : null,
          b.mediaSha256 || null,
          b.intent || null,
        ]
      );
      res.json({ duplicate: r.rows.length === 0 });
    } catch (err: any) {
      log.error("wa message log failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** An unknown number gets ONE pointer reply, ever. True if we have replied before. */
  app.post("/api/internal/wa/unknown-seen", async (req, res) => {
    try {
      const hash = String(req.body?.numberHash || "");
      if (!/^[0-9a-f]{64}$/.test(hash)) return res.status(400).json({ error: "bad hash" });
      const r = await pool.query(
        `SELECT 1 FROM wa_message WHERE agent_id IS NULL AND direction = 'out' AND intent = $1 LIMIT 1`,
        [`unknown:${hash}`]
      );
      res.json({ seen: r.rows.length > 0 });
    } catch (err: any) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/internal/wa/conversation", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const r = await pool.query(
        "SELECT state, current_client_id, pending_context, updated_at FROM wa_conversation WHERE agent_id = $1",
        [agentId]
      );
      const row = r.rows[0];
      res.json(
        row
          ? { state: row.state, currentClientId: row.current_client_id, pending: row.pending_context, updatedAt: row.updated_at }
          : { state: "IDLE", currentClientId: null, pending: {}, updatedAt: null }
      );
    } catch (err: any) {
      log.error("wa conversation read failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/internal/wa/conversation", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const b = req.body || {};
      const currentClientId = b.currentClientId && UUID_RE.test(String(b.currentClientId)) ? String(b.currentClientId) : null;
      await pool.query(
        `INSERT INTO wa_conversation (agent_id, state, current_client_id, pending_context, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (agent_id) DO UPDATE
           SET state = EXCLUDED.state, current_client_id = EXCLUDED.current_client_id,
               pending_context = EXCLUDED.pending_context, updated_at = now()`,
        [agentId, String(b.state || "IDLE").slice(0, 40), currentClientId, JSON.stringify(b.pending || {})]
      );
      res.json({ ok: true });
    } catch (err: any) {
      log.error("wa conversation write failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Checks left and data-entry left, read the same way the analyze route reads them. */
  app.get("/api/internal/wa/allowance", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const r = await pool.query("SELECT balance FROM agent_credits WHERE agent_id = $1", [agentId]);
      res.json({ checksLeft: r.rows[0]?.balance ?? 0 });
    } catch (err: any) {
      log.error("wa allowance failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ── Jobs ── */

  /** Has this advisor already had this exact file checked over WhatsApp? */
  app.get("/api/internal/wa/jobs/by-hash/:sha", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const sha = String(req.params.sha || "");
      if (!/^[0-9a-f]{64}$/.test(sha)) return res.status(400).json({ error: "bad hash" });
      const r = await pool.query(
        `SELECT j.client_id FROM wa_job j JOIN clients c ON c.id = j.client_id AND c.agent_id = j.agent_id
          WHERE j.agent_id = $1 AND j.file_sha256 = $2 AND j.status = 'done'
          ORDER BY j.finished_at DESC NULLS LAST LIMIT 1`,
        [agentId, sha]
      );
      res.json({ clientId: r.rows[0]?.client_id ?? null });
    } catch (err: any) {
      log.error("wa job hash lookup failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/internal/wa/jobs", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const b = req.body || {};
      if (!/^[0-9a-f]{64}$/.test(String(b.fileSha256 || ""))) return res.status(400).json({ error: "bad hash" });
      const r = await pool.query(
        `INSERT INTO wa_job (agent_id, wa_message_id, file_sha256, insurance_type, status)
         VALUES ($1, $2, $3, $4, 'queued') RETURNING id`,
        [agentId, b.waMessageId || null, b.fileSha256, b.insuranceType || null]
      );
      res.json({ id: r.rows[0].id });
    } catch (err: any) {
      log.error("wa job create failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/internal/wa/jobs/:id", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "bad id" });
      const b = req.body || {};
      const status = ["queued", "processing", "done", "failed", "needs_attention", "skipped"].includes(b.status) ? b.status : null;
      const clientId = b.clientId && UUID_RE.test(String(b.clientId)) ? String(b.clientId) : null;
      await pool.query(
        `UPDATE wa_job SET
           status          = COALESCE($3, status),
           client_id       = COALESCE($4, client_id),
           analysis_job_id = COALESCE($5, analysis_job_id),
           insurance_type  = COALESCE($6, insurance_type),
           failure_reason  = COALESCE($7, failure_reason),
           started_at      = CASE WHEN $3 = 'processing' AND started_at IS NULL THEN now() ELSE started_at END,
           finished_at     = CASE WHEN $3 IN ('done', 'failed', 'needs_attention', 'skipped') THEN now() ELSE finished_at END
         WHERE id = $1 AND agent_id = $2`,
        [req.params.id, agentId, status, clientId, b.analysisJobId || null, b.insuranceType || null,
         typeof b.failureReason === "string" ? b.failureReason.slice(0, 500) : null]
      );
      res.json({ ok: true });
    } catch (err: any) {
      log.error("wa job update failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Jobs a restart left behind, all advisors, oldest first. The bot re-polls them. */
  app.get("/api/internal/wa/jobs/open", async (_req, res) => {
    try {
      const r = await pool.query(
        `SELECT j.id, j.agent_id, j.client_id, j.analysis_job_id, j.status, j.queued_at, j.started_at
           FROM wa_job j JOIN wa_allowlist w ON w.agent_id = j.agent_id
          WHERE j.status IN ('queued', 'processing') ORDER BY j.queued_at ASC LIMIT 100`
      );
      res.json({ jobs: r.rows });
    } catch (err: any) {
      log.error("wa open jobs failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ── Reports, share, customers, renewals ── */

  app.get("/api/internal/wa/clients/:id", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "bad id" });
      const r = await pool.query(`${CLIENT_SELECT} WHERE c.id = $1 AND c.agent_id = $2`, [req.params.id, agentId]);
      if (r.rows.length === 0) return res.status(404).json({ error: "Not found" });
      res.json(reportSummary(r.rows[0]));
    } catch (err: any) {
      log.error("wa client read failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Latest checked policy for a named person, for "Ramesh's policy". */
  app.get("/api/internal/wa/clients", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const name = String(req.query.name || "").trim();
      if (name.length < 2) return res.json({ matches: [] });
      const like = `%${name.replace(/[%_\\]/g, "\\$&")}%`;
      const r = await pool.query(
        `${CLIENT_SELECT}
          WHERE c.agent_id = $1 AND (c.policyholder_name ILIKE $2 OR cu.name ILIKE $2)
          ORDER BY c.created_at DESC LIMIT 5`,
        [agentId, like]
      );
      res.json({ matches: r.rows.map(reportSummary) });
    } catch (err: any) {
      log.error("wa client search failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Turn sharing on and return the token. Same effect as the portal's share toggle with
   *  enabled=true (routes.ts share/toggle); the bot builds the public URL itself from
   *  WA_PUBLIC_ORIGIN, never from this request's host (which is localhost). */
  app.post("/api/internal/wa/clients/:id/share", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "bad id" });
      const r = await pool.query(
        `UPDATE clients SET share_enabled = true, last_shared_at = NOW()
          WHERE id = $1 AND agent_id = $2 RETURNING share_token`,
        [req.params.id, agentId]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: "Not found" });
      res.json({ shareToken: r.rows[0].share_token });
    } catch (err: any) {
      log.error("wa share failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** File a policy under a customer. Both rows must belong to this advisor. */
  app.post("/api/internal/wa/clients/:id/customer", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const customerId = String(req.body?.customerId || "");
      if (!UUID_RE.test(req.params.id) || !UUID_RE.test(customerId)) return res.status(400).json({ error: "bad id" });
      const r = await pool.query(
        `UPDATE clients c SET customer_id = cu.id
           FROM customers cu
          WHERE c.id = $1 AND c.agent_id = $2 AND cu.id = $3 AND cu.agent_id = $2
          RETURNING c.id`,
        [req.params.id, agentId, customerId]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: "Not found" });
      res.json({ ok: true });
    } catch (err: any) {
      log.error("wa attach customer failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/internal/wa/customers", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const q = String(req.query.q || "").trim();
      const digits = q.replace(/\D/g, "");
      if (q.length < 2) return res.json({ matches: [] });
      const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
      const r = await pool.query(
        `SELECT id, name, phone FROM customers
          WHERE agent_id = $1
            AND (name ILIKE $2 OR ($3 <> '' AND regexp_replace(coalesce(phone, ''), '\\D', '', 'g') LIKE '%' || $3))
          ORDER BY name ASC LIMIT 6`,
        [agentId, like, digits.length >= 10 ? digits.slice(-10) : ""]
      );
      res.json({ matches: r.rows });
    } catch (err: any) {
      log.error("wa customer search failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** The two portal lists, with the portal's own windows:
   *   leads     Renewals screen: overdue + due within 7 days (LeadRenewals.tsx)
   *   customers Policies > Expiring Soon: 0 to 30 days (PoliciesNew.tsx) */
  app.get("/api/internal/wa/renewals", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const leads = await pool.query(
        `SELECT lp.id, l.name, l.phone, lp.insurance_type, lp.insurer, lp.policy_name, lp.premium,
                lp.due_date, lp.spoken_to, (lp.due_date::date - CURRENT_DATE) AS days_left
           FROM lead_policies lp JOIN agent_leads l ON l.id = lp.lead_id
          WHERE lp.agent_id = $1 AND lp.due_date IS NOT NULL AND lp.due_date::date <= CURRENT_DATE + 7
          ORDER BY lp.due_date::date ASC LIMIT 50`,
        [agentId]
      );
      const own = await pool.query(
        `SELECT c.id, COALESCE(cu.name, c.policyholder_name) AS name, COALESCE(cu.phone, c.client_phone) AS phone,
                c.insurance_type, c.insurer, c.policy_name, c.expiry_date AS due_date,
                (c.report_data->'policy_commercials'->>'premium_total_payable') AS premium,
                (c.expiry_date::date - CURRENT_DATE) AS days_left
           FROM clients c LEFT JOIN customers cu ON cu.id = c.customer_id AND cu.agent_id = c.agent_id
          WHERE c.agent_id = $1 AND c.expiry_date IS NOT NULL
            AND c.expiry_date::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
          ORDER BY c.expiry_date ASC LIMIT 50`,
        [agentId]
      );
      res.json({ leads: leads.rows, customers: own.rows });
    } catch (err: any) {
      log.error("wa renewals failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });
  /* ── Language model, two narrow uses only (plan §4) ──────────────────────
     The model lives HERE, behind the backend's existing AIService and usage ledger, so the
     bot never holds a model key and every call shows up on the admin usage page under its
     own feature tag. Both routes are OFF unless WA_LLM_ENABLED=true: with it off, intent
     fallback answers "unknown" (the bot shows the help menu) and phrasing answers null (the
     bot uses its plain template). Nothing is spent until someone turns it on. */

  const llmOn = () => process.env.WA_LLM_ENABLED === "true";

  app.post("/api/internal/wa/llm/intent", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const text = String(req.body?.text || "").slice(0, 300);
      if (!llmOn() || !text.trim()) return res.json({ intent: "unknown", used: false });
      const system =
        "You route messages sent by an insurance advisor to a WhatsApp assistant. " +
        "Reply with exactly ONE word from this list and nothing else: " +
        "ask (a question about a policy report), share (wants to send a report to their customer), " +
        "renewals (wants upcoming renewals or who is due), help (greeting or asking what you can do), " +
        "unknown (anything else). " +
        (req.body?.hasReport ? "A policy report is currently open in this chat." : "No policy report is open in this chat.");
      const raw = await AIService.generateContent(system, text, AI_CONFIG.model, {
        feature: "wa_intent",
        route: "/api/internal/wa/llm/intent",
        sourceType: "agent",
        actorId: agentId,
      });
      res.json({ intent: parseIntent(raw), used: true });
    } catch (err: any) {
      log.warn("wa llm intent failed", { error: err?.message });
      res.json({ intent: "unknown", used: false });
    }
  });

  /** Phrase an answer to a question from ONE stored report. The facts are loaded here from
   *  the database, never taken from the bot, and the reply must pass the number guard. */
  app.post("/api/internal/wa/llm/phrase", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const clientId = String(req.body?.clientId || "");
      const question = String(req.body?.question || "").slice(0, 300);
      if (!UUID_RE.test(clientId) || !question.trim()) return res.status(400).json({ error: "bad input" });
      if (!llmOn()) return res.json({ answer: null, used: false });

      const r = await pool.query(`${CLIENT_SELECT} WHERE c.id = $1 AND c.agent_id = $2`, [clientId, agentId]);
      if (r.rows.length === 0) return res.status(404).json({ error: "Not found" });
      const s = reportSummary(r.rows[0]);
      if (!s.report) return res.json({ answer: null, used: false });
      // Facts only: no names, phones or tokens go to the model.
      const facts = { insurer: s.insurer, plan: s.policyName, score: s.score, ...s.report };

      const system =
        "You answer an insurance advisor's question using ONLY the JSON facts given as data. " +
        "Rules: 1) Use only what is in the facts. If the facts do not answer the question, reply exactly NOT_IN_REPORT. " +
        "2) Copy every number exactly as it is written in the facts. Never calculate, convert, round or estimate a number, " +
        "and never write lakh or crore. 3) At most 3 short sentences, plain simple English. " +
        "4) Never use the words AI or credits, and never use dashes as punctuation.";
      const raw = await AIService.generateContent(
        system,
        `QUESTION: ${question}
FACTS: ${JSON.stringify(facts)}`,
        AI_CONFIG.model,
        { feature: "wa_phrase", route: "/api/internal/wa/llm/phrase", sourceType: "agent", actorId: agentId, clientId }
      );
      const answer = String(raw || "").trim();
      if (!answer || /NOT_IN_REPORT/.test(answer)) return res.json({ answer: null, notInReport: true, used: true });

      const guard = checkAnswerNumbers(answer, facts);
      if (!guard.ok) {
        // Should be near zero. Logged so the rate is visible (brief §14).
        log.warn("wa number guard fired", { clientId, stray: guard.stray });
        return res.json({ answer: null, guardFired: true, used: true });
      }
      res.json({ answer: answer.replace(/[—–]/g, ","), used: true });
    } catch (err: any) {
      log.warn("wa llm phrase failed", { error: err?.message });
      res.json({ answer: null, used: false });
    }
  });

  /* ── Phase 1b: website link, lead entry, calculator report, catalogue compare ──
     Same tables and the same deterministic engines the portal uses. No model calls. */

  /** The advisor's name, partner insurers (calculator rider bias) and website page. */
  app.get("/api/internal/wa/profile", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const a = await pool.query("SELECT full_name, name, partnered_companies FROM agents WHERE id = $1", [agentId]);
      const p = await pool.query("SELECT slug, enabled, published FROM agent_pages WHERE agent_id = $1", [agentId]);
      const row = a.rows[0] || {};
      const page = p.rows[0];
      res.json({
        name: row.full_name || row.name || null,
        partneredCompanies: Array.isArray(row.partnered_companies) ? row.partnered_companies : [],
        page: page ? { slug: page.slug, live: !!(page.enabled && page.published), enabled: !!page.enabled, published: !!page.published } : null,
      });
    } catch (err: any) {
      log.error("wa profile failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Add a lead, as the portal's Leads page does (lib/leads.ts createLead). A lead with the
   *  same phone number already in this advisor's book is returned instead of duplicated. */
  app.post("/api/internal/wa/leads", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const b = req.body || {};
      const name = String(b.name || "").trim().slice(0, 120);
      if (name.length < 2) return res.status(400).json({ error: "name required" });
      const digits = String(b.phone || "").replace(/\D/g, "").slice(-10);
      const phone = /^[6-9]\d{9}$/.test(digits) ? digits : null;
      const interest = typeof b.interest === "string" && b.interest.trim() ? b.interest.trim().slice(0, 40) : null;
      if (phone) {
        const dup = await pool.query(
          `SELECT id, name FROM agent_leads
            WHERE agent_id = $1 AND right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10) = $2
            LIMIT 1`,
          [agentId, phone]
        );
        if (dup.rows.length) return res.json({ id: dup.rows[0].id, duplicateOf: dup.rows[0].name });
      }
      const r = await pool.query(
        `INSERT INTO agent_leads (agent_id, name, phone, insurance_interest, status)
         VALUES ($1, $2, $3, $4, 'new') RETURNING id`,
        [agentId, name, phone, interest]
      );
      res.json({ id: r.rows[0].id });
    } catch (err: any) {
      log.error("wa lead create failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Save a calculator result the bot computed with the portal's own engine
   *  (health-engine-logic.ts), stamped to this advisor, exactly like /api/calculator/save-report. */
  app.post("/api/internal/wa/calculator", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const { inputs, result } = req.body || {};
      if (!inputs || typeof inputs !== "object" || !result || typeof result !== "object") {
        return res.status(400).json({ error: "inputs and result required" });
      }
      const r = await pool.query(
        "INSERT INTO calculator_reports (inputs, result_data, agent_id) VALUES ($1, $2, $3) RETURNING id",
        [JSON.stringify(inputs), JSON.stringify(result), agentId]
      );
      res.json({ uuid: r.rows[0].id });
    } catch (err: any) {
      log.error("wa calculator save failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** The health catalogue the portal's compare page lists (same query as /api/compare/catalog). */
  app.get("/api/internal/wa/catalog", async (req, res) => {
    try {
      if (!(await scopedAgent(req, res))) return;
      const { rows } = await pool.query(
        `SELECT plan_key, insurer, plan_name, variant FROM policy_catalog
          WHERE is_active = true AND product_type = 'comprehensive_health_indemnity'
          ORDER BY insurer, plan_name, variant`
      );
      res.json({ policies: rows });
    } catch (err: any) {
      log.error("wa catalog failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Compare 2 to 4 catalogue plans with the portal's deterministic engine (compareMany, as in
   *  /api/compare/from-catalog) and save the report stamped to this advisor (as
   *  /api/compare/save-report). No model call. */
  app.post("/api/internal/wa/compare", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const keys = [...new Set((Array.isArray(req.body?.keys) ? req.body.keys : []).filter((k: any) => typeof k === "string" && k))] as string[];
      if (keys.length < 2 || keys.length > 4) return res.status(400).json({ error: "2 to 4 plans" });
      const { rows } = await pool.query(
        `SELECT plan_key, profile FROM policy_catalog WHERE is_active = true AND plan_key = ANY($1::text[])`,
        [keys]
      );
      const byKey: Record<string, WordingProfile> = {};
      for (const r of rows) byKey[r.plan_key] = r.profile as WordingProfile;
      if (keys.some((k) => !byKey[k])) return res.status(404).json({ error: "plan not found" });
      const result: any = compareMany(keys.map((k) => byKey[k]));
      const sides = Array.isArray(result?.sides) ? result.sides : [];
      const ins = await pool.query(
        `INSERT INTO comparison_reports (result, profiles, name_a, name_b, agent_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [JSON.stringify(result), null, sides[0]?.plan_name || sides[0]?.insurer || null, sides[1]?.plan_name || sides[1]?.insurer || null, agentId]
      );
      res.json({
        uuid: ins.rows[0].id,
        names: sides.map((x: any) => [x?.insurer, x?.plan_name].filter(Boolean).join(" ") || null),
        verdict: result?.verdict ?? null,
      });
    } catch (err: any) {
      log.error("wa compare failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** The advisor's policies for "my clients" / "list health clients": newest first, one
   *  optional type filter. Read-only; the name shown follows displayName(). */
  app.get("/api/internal/wa/policies", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const type = String(req.query.type || "").toLowerCase();
      const typed = /^[a-z_]{3,30}$/.test(type) ? type : null;
      const where = `c.agent_id = $1 AND c.status = 'done'${typed ? " AND c.insurance_type = $2" : ""}`;
      const params = typed ? [agentId, typed] : [agentId];
      const total = await pool.query(`SELECT count(*)::int AS n FROM clients c WHERE ${where}`, params);
      const r = await pool.query(
        `${CLIENT_SELECT} WHERE ${where} ORDER BY c.created_at DESC LIMIT 15`,
        params
      );
      res.json({
        total: total.rows[0].n,
        rows: r.rows.map((row: any) => ({
          clientId: row.id,
          name: displayName(row),
          insuranceType: row.insurance_type,
          insurer: row.insurer,
          policyName: row.policy_name,
          score: row.insurance_type === "health" ? row.score : null,
        })),
      });
    } catch (err: any) {
      log.error("wa policies list failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /* ── CRM over WhatsApp: leads, follow-ups, lookup, views, claims. No model calls. ── */

  const LEAD_COLS = "id, name, phone, status, insurance_interest, next_follow_up, notes, updated_at";

  /** Leads by name or phone, for "Ramesh won" / "follow up Ramesh Friday". */
  app.get("/api/internal/wa/leads/search", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const q = String(req.query.q || "").trim();
      const digits = q.replace(/\D/g, "");
      if (q.length < 2) return res.json({ matches: [] });
      const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
      const r = await pool.query(
        `SELECT ${LEAD_COLS} FROM agent_leads
          WHERE agent_id = $1
            AND (name ILIKE $2 OR ($3 <> '' AND right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10) = $3))
          ORDER BY updated_at DESC NULLS LAST LIMIT 6`,
        [agentId, like, digits.length >= 10 ? digits.slice(-10) : ""]
      );
      res.json({ matches: r.rows });
    } catch (err: any) {
      log.error("wa lead search failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Status, follow-up date and a dated note, the same fields the Leads page edits.
   *  A note is appended to the existing notes, never replaces them. */
  app.post("/api/internal/wa/leads/:id/update", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "bad id" });
      const b = req.body || {};
      const status = ["new", "contacted", "interested", "won", "lost"].includes(b.status) ? b.status : null;
      const follow = typeof b.nextFollowUp === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.nextFollowUp) ? b.nextFollowUp : null;
      const note = typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 1000) : null;
      if (!status && !follow && !note) return res.status(400).json({ error: "nothing to update" });
      const r = await pool.query(
        `UPDATE agent_leads SET
           status = COALESCE($3, status),
           next_follow_up = COALESCE($4::date, next_follow_up),
           notes = CASE WHEN $5::text IS NULL THEN notes
                        ELSE concat_ws(E'\n', nullif(notes, ''), to_char(now() AT TIME ZONE 'Asia/Kolkata', 'DD Mon') || ': ' || $5::text) END,
           updated_at = now()
         WHERE id = $1 AND agent_id = $2
         RETURNING ${LEAD_COLS}`,
        [req.params.id, agentId, status, follow, note]
      );
      if (!r.rows.length) return res.status(404).json({ error: "Not found" });
      res.json({ lead: r.rows[0] });
    } catch (err: any) {
      log.error("wa lead update failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Leads to call: follow-up date today or earlier, not yet won or lost. */
  app.get("/api/internal/wa/followups", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const r = await pool.query(
        `SELECT ${LEAD_COLS}, (next_follow_up - (now() AT TIME ZONE 'Asia/Kolkata')::date) AS days
           FROM agent_leads
          WHERE agent_id = $1 AND next_follow_up IS NOT NULL
            AND next_follow_up <= (now() AT TIME ZONE 'Asia/Kolkata')::date
            AND coalesce(status, 'new') NOT IN ('won', 'lost')
          ORDER BY next_follow_up ASC LIMIT 30`,
        [agentId]
      );
      res.json({ leads: r.rows });
    } catch (err: any) {
      log.error("wa followups failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Everything filed under a name or number: policies (with the customer they are filed
   *  under) and leads. */
  app.get("/api/internal/wa/lookup", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const q = String(req.query.q || "").trim();
      const digits = q.replace(/\D/g, "");
      if (q.length < 2) return res.json({ policies: [], leads: [] });
      const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
      const phone = digits.length >= 10 ? digits.slice(-10) : "";
      const p = await pool.query(
        `${CLIENT_SELECT}
          WHERE c.agent_id = $1
            AND (c.policyholder_name ILIKE $2 OR cu.name ILIKE $2
                 OR ($3 <> '' AND (right(regexp_replace(coalesce(c.client_phone, ''), '\\D', '', 'g'), 10) = $3
                                OR right(regexp_replace(coalesce(cu.phone, ''), '\\D', '', 'g'), 10) = $3)))
          ORDER BY c.created_at DESC LIMIT 10`,
        [agentId, like, phone]
      );
      const l = await pool.query(
        `SELECT ${LEAD_COLS} FROM agent_leads
          WHERE agent_id = $1
            AND (name ILIKE $2 OR ($3 <> '' AND right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10) = $3))
          ORDER BY updated_at DESC NULLS LAST LIMIT 5`,
        [agentId, like, phone]
      );
      res.json({ policies: p.rows.map(reportSummary), leads: l.rows });
    } catch (err: any) {
      log.error("wa lookup failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Shared reports customers have opened, most recently opened first (report_views, the
   *  source of the portal's Views column). */
  app.get("/api/internal/wa/views", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const r = await pool.query(
        `SELECT c.id, c.policyholder_name, c.insurer, c.policy_name, c.views, cu.name AS customer_name,
                c.report_data, max(v.viewed_at) AS last_viewed
           FROM clients c
           JOIN report_views v ON v.client_id = c.id
           LEFT JOIN customers cu ON cu.id = c.customer_id AND cu.agent_id = c.agent_id
          WHERE c.agent_id = $1
          GROUP BY c.id, cu.name
          ORDER BY last_viewed DESC LIMIT 10`,
        [agentId]
      );
      res.json({
        views: r.rows.map((row: any) => ({
          clientId: row.id, name: displayName(row), insurer: row.insurer, policyName: row.policy_name,
          views: row.views ?? 0, lastViewed: row.last_viewed,
        })),
      });
    } catch (err: any) {
      log.error("wa views failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /** Claims from the Claims desk. Open ones by default; with q, any matching the customer
   *  name, hospital or ailment, each with its open insurer queries. */
  app.get("/api/internal/wa/claims", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const q = String(req.query.q || "").trim();
      const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
      const r = await pool.query(
        `SELECT cl.id, cl.status, cl.claim_type, cl.insurer, cl.hospital, cl.ailment,
                cl.claimed_amount, cl.settled_amount, cl.admitted_on, cl.updated_at, cu.name AS customer_name
           FROM claims cl
           LEFT JOIN customers cu ON cu.id = cl.customer_id AND cu.agent_id = cl.agent_id
          WHERE cl.agent_id = $1
            AND ${q ? "(cu.name ILIKE $2 OR cl.hospital ILIKE $2 OR cl.ailment ILIKE $2 OR cl.insurer ILIKE $2)" : "cl.status NOT IN ('settled', 'rejected')"}
          ORDER BY cl.updated_at DESC LIMIT 10`,
        q ? [agentId, like] : [agentId]
      );
      const ids = r.rows.map((x: any) => x.id);
      const qs = ids.length
        ? await pool.query(
            `SELECT claim_id, seq, question, raised_on FROM claim_queries
              WHERE agent_id = $1 AND claim_id = ANY($2::uuid[]) AND resolved_on IS NULL
              ORDER BY seq`,
            [agentId, ids]
          )
        : { rows: [] as any[] };
      res.json({
        claims: r.rows.map((c: any) => ({
          ...c,
          openQueries: qs.rows.filter((x: any) => x.claim_id === c.id).map((x: any) => ({ seq: x.seq, question: x.question, raisedOn: x.raised_on })),
        })),
      });
    } catch (err: any) {
      log.error("wa claims failed", { error: err?.message });
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
