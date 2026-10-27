/**
 * One-line JSON logs. Phone numbers are masked here, whatever the caller passes, so a
 * number can never reach pm2 logs in clear (brief §10).
 */

// Also catches the ways people write one: "+91 98123 45678", "98123-45678".
const PHONE = /(?<![\d+])(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g;

export function redact(text: string): string {
  return String(text)
    .replace(PHONE, (m) => "…" + m.replace(/\D/g, "").slice(-4))
    // Aadhaar-like 12-digit numbers (an advisor may type one into a document caption).
    .replace(/(?<!\d)\d{4}[\s-]?\d{4}[\s-]?\d{4}(?!\d)/g, "[id]")
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
