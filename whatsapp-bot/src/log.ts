/**
 * One-line JSON logs. Phone numbers are masked here, whatever the caller passes, so a
 * number can never reach pm2 logs in clear (brief §10).
 */

const PHONE = /(?<!\d)(?:91)?[6-9]\d{9}(?!\d)/g;

export function redact(text: string): string {
  return String(text)
    .replace(PHONE, (m) => "…" + m.slice(-4))
    // Policy-number-ish tokens: long runs mixing letters, digits and slashes.
    .replace(/\b(?=[A-Za-z0-9\/-]*\d)(?=[A-Za-z0-9\/-]*[A-Za-z])[A-Za-z0-9\/-]{10,}\b/g, "[ref]");
}

function emit(level: string, msg: string, meta?: Record<string, unknown>) {
  const line = redact(JSON.stringify({ t: new Date().toISOString(), level, msg, ...(meta || {}) }));
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};
