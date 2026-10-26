// Signed admin session cookie: "<expiry ms>.<hex HMAC-SHA256 of the expiry>".
// The middleware used to accept any admin_session cookie at all, so anyone who could reach the
// app could set admin_session=x and use every page and API (all on the service-role key).
// Web Crypto only, so the same code runs in the edge middleware and in the route handlers.
// Key: ADMIN_SESSION_SECRET, or ADMIN_PASSWORD when that is not set (changing the password
// then signs everyone out, which is what you want).

export const SESSION_COOKIE = "admin_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 7;

function secret(): string | null {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || null;
}

async function sign(payload: string, key: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Equal-length strings compared without an early exit. */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export async function createSession(): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  const exp = String(Date.now() + SESSION_MAX_AGE_S * 1000);
  return `${exp}.${await sign(exp, key)}`;
}

export async function verifySession(value: string | undefined): Promise<boolean> {
  const key = secret();
  if (!key || !value) return false;
  const [exp, mac] = value.split(".");
  if (!exp || !mac || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return safeEqual(mac, await sign(exp, key));
}
