/**
 * Minimal structured logger. Emits one JSON line per event so logs are
 * greppable/parseable in pm2 and any downstream collector, and gates output by
 * LOG_LEVEL (debug < info < warn < error; default "info").
 *
 * This is the foundation for retiring the scattered console.* calls — hot paths
 * (request log, error handler, pool errors) use it now; the remaining call sites
 * can migrate incrementally without another module.
 */
type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN = LEVELS[(process.env.LOG_LEVEL as Level)] ?? LEVELS.info;

function emit(level: Level, msg: string, meta?: unknown): void {
  if (LEVELS[level] < MIN) return;
  const rec: Record<string, unknown> = { t: new Date().toISOString(), level, msg };
  if (meta !== undefined) rec.meta = meta;
  let line: string;
  try {
    line = JSON.stringify(rec);
  } catch {
    // Circular/unserializable meta — never let logging throw.
    line = JSON.stringify({ t: rec.t, level, msg });
  }
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, meta?: unknown) => emit("debug", msg, meta),
  info: (msg: string, meta?: unknown) => emit("info", msg, meta),
  warn: (msg: string, meta?: unknown) => emit("warn", msg, meta),
  error: (msg: string, meta?: unknown) => emit("error", msg, meta),
};
