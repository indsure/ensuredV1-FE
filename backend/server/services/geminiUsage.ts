/**
 * Gemini usage / cost ledger helper.
 *
 * Every Gemini call in the app should flow a row into `gemini_usage_log` via
 * logGeminiUsage(). Token counts come from Gemini's own usageMetadata, so the
 * recorded cost is exact once GEMINI_PRICE_INPUT_PER_M / _OUTPUT_PER_M are set.
 *
 * Privacy: we never store policy text or names. Anonymous callers are recorded
 * as a salted, truncated hash of their IP (pseudonymous). Agents by their id.
 */
import crypto from "crypto";
import pkg from "pg";
import { pgPoolConfig } from "../lib/db";

const { Pool } = pkg;

// Dedicated pool; logging must never contend with or break the request path.
// Kept separate from the shared app pool (see lib/db) so a burst of
// fire-and-forget usage inserts can't starve the request path of connections.
// Shares only the SSL-safe connection config (see pgPoolConfig), not the pool.
const pool = new Pool(pgPoolConfig());
pool.on("error", (e: any) => console.error("[geminiUsage] idle client error:", e?.message ?? e));

export type GeminiFeature =
  | "policy_audit"
  | "wording_extract"
  | "data_entry"
  | "image_ocr"
  | "sach_ai"
  | "portfolio_insights"
  | "switch_reco"
  | "ai_generate";

export type GeminiCallMeta = {
  feature: GeminiFeature | string;
  route?: string;
  sourceType?: "anonymous" | "agent" | "individual" | "system";
  actorId?: string | null;
  jobId?: string | null;
  clientId?: string | null;
  inputHash?: string | null;
};

export type GeminiUsageTokens = {
  promptTokens?: number | null;
  /** Visible answer tokens (candidatesTokenCount). */
  outputTokens?: number | null;
  totalTokens?: number | null;
  /**
   * Reasoning tokens (thoughtsTokenCount). BILLED AT THE OUTPUT RATE but not
   * part of candidatesTokenCount, so leaving them out understates every call.
   * Real examples from the ledger: sach_ai row id=10 recorded 205 in / 95 out
   * against a total of 1,387 — 1,087 tokens billed and never counted.
   * No DB column: it is folded into est_cost_usd, which is what the spend
   * ceiling reads.
   */
  thoughtsTokens?: number | null;
};

/**
 * Ledger status. `ok` used to be written for ANY call the SDK did not throw on,
 * which hid a real failure mode: a call that returns successfully but with an
 * unusable response is still billed in full. Row id=1 in the ledger — 542,778
 * input tokens, 23 output tokens, status 'ok' — was one of those.
 *
 *   ok                — billed, response usable
 *   degraded          — BILLED, response unusable (empty / cut short / failed
 *                       the caller's own schema validation). Real money spent
 *                       for nothing; the user saw an error. Must stay visible.
 *   error             — the SDK threw. May or may not have been billed.
 *   rejected_oversize — blocked by the input ceiling BEFORE the call. Zero
 *                       spend. prompt_tokens holds the ESTIMATE of what would
 *                       have been sent, so oversized uploads are visible and
 *                       sortable; est_cost_usd is forced to 0 and admin spend
 *                       totals exclude this status.
 */
export type GeminiCallStatus = "ok" | "degraded" | "error" | "rejected_oversize";

/** Statuses that represent real, billed Gemini spend. */
export const BILLED_STATUSES: GeminiCallStatus[] = ["ok", "degraded"];

// USD per 1,000,000 tokens. Left at 0 until you set the real Gemini rates in
// the environment — token counts are always exact regardless, so cost simply
// backfills correctly the moment the rates are configured.
const IN_RATE = Number(process.env.GEMINI_PRICE_INPUT_PER_M) || 0;
const OUT_RATE = Number(process.env.GEMINI_PRICE_OUTPUT_PER_M) || 0;

/**
 * Cost = prompt @ input rate + (visible answer + reasoning) @ output rate.
 * Thinking tokens bill at the output rate, so omitting them understates spend
 * and makes the daily ceiling trip later than it should.
 */
export function estimateCostUsd(
  promptTokens?: number | null,
  outputTokens?: number | null,
  thoughtsTokens?: number | null
): number {
  const p = promptTokens || 0;
  const o = outputTokens || 0;
  const t = thoughtsTokens || 0;
  return (p / 1_000_000) * IN_RATE + ((o + t) / 1_000_000) * OUT_RATE;
}

// Pseudonymous, DPDP-friendly: store sha256(ip + salt) truncated, never the raw IP.
export function hashActor(ip: string | undefined | null): string | null {
  if (!ip) return null;
  const salt = process.env.USAGE_HASH_SALT || "indsure-usage-salt";
  return crypto.createHash("sha256").update(String(ip) + salt).digest("hex").slice(0, 16);
}

export function hashInput(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

// Pull token counts out of a @google/generative-ai response object.
export function extractUsage(response: any): GeminiUsageTokens {
  const u = response?.usageMetadata || {};
  const promptTokens = u.promptTokenCount ?? null;
  const outputTokens = u.candidatesTokenCount ?? null;
  const totalTokens = u.totalTokenCount ?? null;

  // Prefer the explicit field; fall back to whatever the total cannot account
  // for. Older/!thinking models omit thoughtsTokenCount entirely, in which case
  // the remainder is 0 and this is a no-op.
  let thoughtsTokens: number | null = u.thoughtsTokenCount ?? null;
  if (thoughtsTokens === null && totalTokens !== null && promptTokens !== null) {
    const remainder = totalTokens - promptTokens - (outputTokens ?? 0);
    thoughtsTokens = remainder > 0 ? remainder : null;
  }

  return { promptTokens, outputTokens, totalTokens, thoughtsTokens };
}

/**
 * Sum est_cost_usd over the last 24h and compare to GEMINI_DAILY_USD_CEILING.
 *
 * Returns true only when the ceiling is configured (a positive number) AND the
 * trailing-24h spend has reached/exceeded it. If the env var is unset/0/NaN the
 * ceiling is disabled and this returns false.
 *
 * FAIL-OPEN: if the DB query throws (logging DB down, table missing, etc.) this
 * returns false so a logging-infrastructure problem can never block real calls.
 */
/**
 * A spend ceiling computed from rates that are not configured is a ceiling that
 * can never trip: est_cost_usd is 0 on every row, the trailing-24h sum is 0, and
 * the guard reports "under budget" forever. That is a silent failure of a safety
 * control, so say so loudly — once, at startup — rather than looking protected.
 */
let warnedAboutInertCeiling = false;
function warnIfCeilingIsInert(ceiling: number): void {
  if (warnedAboutInertCeiling) return;
  if (IN_RATE > 0 || OUT_RATE > 0) return;
  warnedAboutInertCeiling = true;
  console.warn(
    `[geminiUsage] ⚠️  GEMINI_DAILY_USD_CEILING is set to $${ceiling} but neither ` +
    `GEMINI_PRICE_INPUT_PER_M nor GEMINI_PRICE_OUTPUT_PER_M is configured. ` +
    `Every call is costed at $0, so this ceiling CANNOT trip and provides no ` +
    `protection. Set the price rates to activate it.`
  );
}

export async function isOverDailyCeiling(): Promise<boolean> {
  const ceiling = Number(process.env.GEMINI_DAILY_USD_CEILING);
  if (!Number.isFinite(ceiling) || ceiling <= 0) {
    return false; // disabled
  }
  warnIfCeilingIsInert(ceiling);
  try {
    const res = await pool.query(
      `SELECT COALESCE(SUM(est_cost_usd), 0) AS total
         FROM gemini_usage_log
        WHERE created_at >= NOW() - INTERVAL '24 hours'`
    );
    const total = Number(res.rows?.[0]?.total) || 0;
    return total >= ceiling;
  } catch (err: any) {
    console.error("[geminiUsage] isOverDailyCeiling query failed (fail-open):", err?.message ?? err);
    return false;
  }
}

// Fire-and-forget. NEVER throws into the caller — logging must not break a request.
export async function logGeminiUsage(
  meta: GeminiCallMeta,
  info: {
    model: string;
    tokens?: GeminiUsageTokens;
    status?: GeminiCallStatus;
    attempt?: number;
    latencyMs?: number;
    errorMessage?: string | null;
  }
): Promise<void> {
  try {
    const tokens = info.tokens || {};
    const status = info.status ?? "ok";
    // A rejected call never reached Gemini, so it costs nothing — its
    // prompt_tokens is an estimate of the input we refused to send, kept only
    // so oversized uploads are visible on the usage page.
    const cost =
      status === "rejected_oversize"
        ? 0
        : estimateCostUsd(tokens.promptTokens, tokens.outputTokens, tokens.thoughtsTokens);
    await pool.query(
      `INSERT INTO gemini_usage_log
        (feature, route, model, source_type, actor_id, job_id, client_id,
         input_hash, prompt_tokens, output_tokens, total_tokens, est_cost_usd,
         status, attempt, latency_ms, error_message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        meta.feature,
        meta.route ?? null,
        info.model,
        meta.sourceType ?? null,
        meta.actorId ?? null,
        meta.jobId ?? null,
        meta.clientId ?? null,
        meta.inputHash ?? null,
        tokens.promptTokens ?? null,
        tokens.outputTokens ?? null,
        tokens.totalTokens ?? null,
        cost,
        status,
        info.attempt ?? 1,
        info.latencyMs ?? null,
        info.errorMessage ?? null,
      ]
    );
  } catch (err: any) {
    console.error("[geminiUsage] log insert failed:", err?.message ?? err);
  }
}
