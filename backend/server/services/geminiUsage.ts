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

const { Pool } = pkg;

// Dedicated pool; logging must never contend with or break the request path.
// Kept separate from the shared app pool (see lib/db) so a burst of
// fire-and-forget usage inserts can't starve the request path of connections.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
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
  sourceType?: "anonymous" | "agent" | "system";
  actorId?: string | null;
  jobId?: string | null;
  clientId?: string | null;
  inputHash?: string | null;
};

export type GeminiUsageTokens = {
  promptTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
};

// USD per 1,000,000 tokens. Left at 0 until you set the real Gemini rates in
// the environment — token counts are always exact regardless, so cost simply
// backfills correctly the moment the rates are configured.
const IN_RATE = Number(process.env.GEMINI_PRICE_INPUT_PER_M) || 0;
const OUT_RATE = Number(process.env.GEMINI_PRICE_OUTPUT_PER_M) || 0;

export function estimateCostUsd(promptTokens?: number | null, outputTokens?: number | null): number {
  const p = promptTokens || 0;
  const o = outputTokens || 0;
  return (p / 1_000_000) * IN_RATE + (o / 1_000_000) * OUT_RATE;
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
  return {
    promptTokens: u.promptTokenCount ?? null,
    outputTokens: u.candidatesTokenCount ?? null,
    totalTokens: u.totalTokenCount ?? null,
  };
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
export async function isOverDailyCeiling(): Promise<boolean> {
  const ceiling = Number(process.env.GEMINI_DAILY_USD_CEILING);
  if (!Number.isFinite(ceiling) || ceiling <= 0) {
    return false; // disabled
  }
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
    status?: "ok" | "error";
    attempt?: number;
    latencyMs?: number;
    errorMessage?: string | null;
  }
): Promise<void> {
  try {
    const tokens = info.tokens || {};
    const cost = estimateCostUsd(tokens.promptTokens, tokens.outputTokens);
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
        info.status ?? "ok",
        info.attempt ?? 1,
        info.latencyMs ?? null,
        info.errorMessage ?? null,
      ]
    );
  } catch (err: any) {
    console.error("[geminiUsage] log insert failed:", err?.message ?? err);
  }
}
