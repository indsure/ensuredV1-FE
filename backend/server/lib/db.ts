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

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on("error", (e: unknown) => {
  log.error("db_idle_client_error", { message: (e as any)?.message ?? String(e) });
});
