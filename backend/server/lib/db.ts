/**
 * The single shared PG pool for the app's request/query paths.
 *
 * Created once and reused everywhere (routes, server bootstrap). Two reasons this
 * lives in one module: creating a Pool per request leaks connections, and pg
 * emits an 'error' event on idle clients when a connection drops — if unhandled,
 * that event crashes the process. We own exactly one pool and attach the handler.
 *
 * (The Gemini usage ledger keeps its own dedicated pool in services/geminiUsage.ts
 * so a burst of fire-and-forget logging inserts can't starve the request path.)
 */
import pkg from "pg";
import { log } from "./logger";

const { Pool } = pkg;

/**
 * Shared connection config for every runtime PG pool.
 *
 * Supabase's pooler (aws-*.pooler.supabase.com) presents a self-signed cert
 * chain, and newer `pg`/`pg-connection-string` now treat the URL's
 * `sslmode=require` as `verify-full` — which rejects that chain with
 * "self-signed certificate in certificate chain" and the pool never connects.
 * We strip the URL's sslmode and hand pg an explicit relaxed ssl config: TLS is
 * still negotiated, but the (unverifiable-by-us) Supabase chain is accepted.
 * This is the standard Supabase + node-postgres setup.
 */
export function pgPoolConfig() {
  const url = (process.env.DATABASE_URL || "")
    .replace(/([?&])sslmode=[^&]*/gi, "$1")
    .replace(/[?&]+$/, "");
  return { connectionString: url, ssl: { rejectUnauthorized: false } };
}

export const pool = new Pool(pgPoolConfig());

pool.on("error", (e: unknown) => {
  log.error("db_idle_client_error", { message: (e as any)?.message ?? String(e) });
});
