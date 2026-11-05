// IndSure Commercial (the /corporate portal): logins, records, original files, problem reports, reminders.
//
// Registered ABOVE express.json() in index.ts because the book can be far larger than the app's 2 MB
// body limit. Separate from the rest of the API on purpose: its own logins (passwords exist only as
// scrypt hashes, in the server's .env for the owner and in corp_users for everyone else, never in this
// public repo), its own tables (corp_*, migrations 036 and 037, no browser access through RLS) and a
// private storage bucket.
//
//   CORP_LOGIN_EMAIL     the owner login (always an Admin)
//   CORP_LOGIN_HASH      <salt hex>:<scrypt hex>
//   CORP_SESSION_SECRET  signs session tokens
//   CORP_FEEDBACK_TO     where problem reports are emailed (default tech@indsure.in)
// With any of the first three missing, every route answers 503 and nothing else changes.
//
// The portal saves its records as one book, so the server can refuse a Read-only login's save but cannot
// tell which part of the book an Operations or Accounts login changed. Those limits are on the screens.

import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import { pool } from "./lib/db";
import { log } from "./lib/logger";
import { sendMail } from "./lib/mailer";

const BUCKET = "corporate-files";
const SESSION_HOURS = 12;
const KEEP_VERSIONS = 60;
const MAX_BOOK = "30mb";
const MAX_FILE = 40 * 1024 * 1024;
const TYPES: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg" };
const ROLES = ["ops", "accounts", "admin", "readonly"];
type CorpUser = { email: string; name: string; role: string };

const b64 = (s: string) => Buffer.from(s).toString("base64url");
function secret() { return process.env.CORP_SESSION_SECRET || ""; }
function hmac(body: string) { return crypto.createHmac("sha256", secret()).update(body).digest("base64url"); }
function sign(scope: "session" | "files", exp: number, user?: CorpUser) { const body = b64(JSON.stringify({ scope, exp, user })); return `${body}.${hmac(body)}`; }
function readToken(token: unknown, scope: "session" | "files"): any {
  if (typeof token !== "string") return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const want = Buffer.from(hmac(body)), got = Buffer.from(mac);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try { const p = JSON.parse(Buffer.from(body, "base64url").toString()); return p.scope === scope && typeof p.exp === "number" && p.exp > Date.now() ? p : null; } catch { return null; }
}
function hashPassword(password: string) { const salt = crypto.randomBytes(16); return `${salt.toString("hex")}:${crypto.scryptSync(password, salt, 64).toString("hex")}`; }
function passwordMatches(password: string, stored: string) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const want = Buffer.from(hash, "hex");
  const got = crypto.scryptSync(password, Buffer.from(salt, "hex"), want.length);
  return crypto.timingSafeEqual(want, got);
}
function configured() { return !!(process.env.CORP_LOGIN_EMAIL && process.env.CORP_LOGIN_HASH && secret()); }
const ownerEmail = () => String(process.env.CORP_LOGIN_EMAIL || "").trim().toLowerCase();
function validBook(b: any) {
  return b && typeof b === "object" && b.version === 2 && ["customers", "policies", "terms", "documents", "insurers", "team", "audit"].every((k) => Array.isArray(b[k]));
}
function kindOf(buf: Buffer) {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  return null;
}
const missingTables = (e: any) => e?.code === "42P01";
const showDate = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

// ---- Reminders. They go to the CSC looking after the customer, never to the customer.
export type Reminder = { key: string; to: string; subject: string; text: string };
export function remindersDue(book: any, today: string): Reminder[] {
  const out: Reminder[] = [];
  const threshold = book.settings?.balanceThresholdPct ?? 30;
  for (const t of book.terms || []) {
    if (t.status !== "confirmed" || t.cancelled) continue;
    const p = (book.policies || []).find((x: any) => x.id === t.policyId);
    const c = p && (book.customers || []).find((x: any) => x.id === p.customerId);
    const v = t.values || {};
    if (!p || !c) continue;
    const to = (book.team || []).find((x: any) => x.code === c.cse && x.active !== false)?.email;
    if (!to) continue;
    const label = `${p.type}, policy ${v.policyNo || "without a number"}, ${c.name}`;
    if (v.riskEnd && t.outcome === "Open" && !t.nextTermId && v.renewable !== "No") {
      const days = dayDiff(today, v.riskEnd);
      const tier = days < 0 ? null : days <= 15 ? 15 : days <= 30 ? 30 : days <= 60 ? 60 : null;
      if (tier) out.push({ key: `${t.id}:renew:${tier}`, to, subject: `Renewal due in ${days} days: ${c.name}`, text: `${label} ends on ${showDate(v.riskEnd)}, ${days} days from today.\n\nThis is a reminder from IndSure Commercial. Nothing has been sent to the customer.` });
    }
    if (/open/i.test(p.type || "") && /cargo/i.test(p.type || "") && +v.sumInsured > 0 && v.riskEnd >= today) {
      const used = (t.cargoDecls || []).reduce((a: number, x: any) => a + (+x.siInr || 0), 0);
      const pct = Math.round(((+v.sumInsured - used) / +v.sumInsured) * 1000) / 10;
      if (pct < threshold) out.push({ key: `${t.id}:balance`, to, subject: `Open policy running low: ${c.name}`, text: `${label} has ${pct}% of its sum insured left, below the ${threshold}% reminder level.\n\nThis is a reminder from IndSure Commercial. Nothing has been sent to the customer.` });
    }
  }
  return out;
}
async function sendDueReminders() {
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const { rows } = await pool.query("SELECT data FROM corp_book WHERE id = 1");
  if (!rows.length) return;
  for (const r of remindersDue(rows[0].data, today)) {
    // Claim the reminder first so a restart can never send it twice; give it back if the email fails.
    const claim = await pool.query("INSERT INTO corp_reminders_sent (key, sent_to) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING RETURNING key", [r.key, r.to]);
    if (!claim.rowCount) continue;
    const ok = await sendMail({ to: r.to, subject: r.subject, text: r.text });
    if (!ok) await pool.query("DELETE FROM corp_reminders_sent WHERE key = $1", [r.key]);
  }
}

export function registerCorporateRoutes(app: Express) {
  const storage = () => createClient(process.env.SUPABASE_URL || "https://khxbabotbvnyjwvqtumt.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || "").storage;
  let bucketReady = false;
  const ensureBucket = async () => {
    if (bucketReady) return;
    const s = storage();
    const { data } = await s.getBucket(BUCKET);
    if (!data) { const { error } = await s.createBucket(BUCKET, { public: false }); if (error && !/exist/i.test(error.message)) throw error; }
    bucketReady = true;
  };

  const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: "too many tries" } });
  const apiLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 1500, standardHeaders: true, legacyHeaders: false, message: { error: "too many requests" } });
  const reportLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: "too many reports" } });

  const ready = (_req: Request, res: Response, next: NextFunction) => { if (!configured()) return res.status(503).json({ error: "not configured" }); next(); };
  const fail = (res: Response, e: any, where: string) => {
    if (missingTables(e)) return res.status(503).json({ error: "not set up" });
    log.error(`[corp] ${where} failed`, { message: e?.message });
    return res.status(500).json({ error: "server error" });
  };
  // A switched-off login stops working at once, and a changed role applies at once, not at the next sign-in.
  const signedIn = async (req: Request, res: Response, next: NextFunction) => {
    const p = readToken(String(req.headers.authorization || "").replace(/^Bearer\s+/i, ""), "session");
    if (!p) return res.status(401).json({ error: "sign in" });
    const email = String(p.user?.email || ownerEmail());
    if (email === ownerEmail()) { (req as any).corpUser = { email, name: p.user?.name || "Admin", role: "admin" }; return next(); }
    try {
      const { rows } = await pool.query("SELECT email, name, role, active FROM corp_users WHERE email = $1", [email]);
      if (!rows.length || !rows[0].active) return res.status(401).json({ error: "sign in" });
      (req as any).corpUser = { email, name: rows[0].name, role: rows[0].role };
      next();
    } catch (e) { fail(res, e, "check login"); }
  };
  const adminOnly = (req: Request, res: Response, next: NextFunction) => { if ((req as any).corpUser?.role !== "admin") return res.status(403).json({ error: "admin only" }); next(); };

  app.post("/api/corp/login", ready, loginLimit, express.json({ limit: "10kb" }), async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    let user: CorpUser | null = null;
    try {
      if (email === ownerEmail()) {
        if (passwordMatches(password, String(process.env.CORP_LOGIN_HASH))) user = { email, name: "Admin", role: "admin" };
      } else {
        const { rows } = await pool.query("SELECT email, name, role, password_hash, active FROM corp_users WHERE email = $1", [email]).catch((e) => { if (missingTables(e)) return { rows: [] as any[] }; throw e; });
        // Hash even with no such login, so a wrong email takes as long as a wrong password.
        const ok = passwordMatches(password, rows[0]?.password_hash || process.env.CORP_LOGIN_HASH || "");
        if (rows[0] && ok && rows[0].active) { user = { email, name: rows[0].name, role: rows[0].role }; pool.query("UPDATE corp_users SET last_login = now() WHERE email = $1", [email]).catch(() => {}); }
      }
    } catch (e) { return fail(res, e, "login"); }
    if (!user) return res.status(401).json({ error: "wrong email or password" });
    const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
    res.json({ token: sign("session", exp, user), fileKey: sign("files", exp), exp, user });
  });

  // ---- Logins, managed by an Admin inside the portal
  app.get("/api/corp/users", ready, apiLimit, signedIn, adminOnly, async (_req, res) => {
    try {
      const { rows } = await pool.query("SELECT email, name, role, active, last_login FROM corp_users ORDER BY name");
      res.json(rows);
    } catch (e) { fail(res, e, "list logins"); }
  });
  app.post("/api/corp/users", ready, apiLimit, signedIn, adminOnly, express.json({ limit: "10kb" }), async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const name = String(req.body?.name || "").trim().slice(0, 120);
    const role = String(req.body?.role || "");
    const password = String(req.body?.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || !ROLES.includes(role) || password.length < 8) return res.status(400).json({ error: "check the details" });
    if (email === ownerEmail()) return res.status(409).json({ error: "already a login" });
    try {
      const r = await pool.query("INSERT INTO corp_users (email, name, role, password_hash) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING RETURNING email", [email, name, role, hashPassword(password)]);
      if (!r.rowCount) return res.status(409).json({ error: "already a login" });
      res.json({ ok: true });
    } catch (e) { fail(res, e, "add login"); }
  });
  app.patch("/api/corp/users/:email", ready, apiLimit, signedIn, adminOnly, express.json({ limit: "10kb" }), async (req, res) => {
    const email = String(req.params.email).toLowerCase();
    const b = req.body || {};
    if (b.role !== undefined && !ROLES.includes(b.role)) return res.status(400).json({ error: "check the details" });
    if (b.password !== undefined && String(b.password).length < 8) return res.status(400).json({ error: "check the details" });
    try {
      const r = await pool.query(
        "UPDATE corp_users SET role = COALESCE($2, role), active = COALESCE($3, active), password_hash = COALESCE($4, password_hash) WHERE email = $1",
        [email, b.role ?? null, typeof b.active === "boolean" ? b.active : null, b.password ? hashPassword(String(b.password)) : null],
      );
      if (!r.rowCount) return res.status(404).json({ error: "no such login" });
      res.json({ ok: true });
    } catch (e) { fail(res, e, "change login"); }
  });

  // ---- Records
  app.get("/api/corp/book", ready, apiLimit, signedIn, async (_req, res) => {
    try {
      const { rows } = await pool.query("SELECT version, data, saved_at FROM corp_book WHERE id = 1");
      if (!rows.length) return res.status(404).json({ error: "no book yet" });
      res.json({ version: rows[0].version, savedAt: rows[0].saved_at, db: rows[0].data });
    } catch (e) { fail(res, e, "read book"); }
  });

  // baseVersion must match what is stored, so two people cannot silently overwrite each other.
  app.put("/api/corp/book", ready, apiLimit, signedIn, express.json({ limit: MAX_BOOK }), async (req, res) => {
    if ((req as any).corpUser?.role === "readonly") return res.status(403).json({ error: "read only" });
    const body = req.body || {};
    if (!validBook(body.db)) return res.status(400).json({ error: "not a valid book" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const cur = await client.query("SELECT version FROM corp_book WHERE id = 1 FOR UPDATE");
      const current = cur.rows[0]?.version ?? 0;
      if ((body.baseVersion ?? 0) !== current) { await client.query("ROLLBACK"); return res.status(409).json({ error: "changed elsewhere", version: current }); }
      const version = current + 1, at = new Date().toISOString(), data = JSON.stringify(body.db);
      await client.query("INSERT INTO corp_book (id, version, data, saved_at) VALUES (1, $1, $2::jsonb, $3) ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, data = EXCLUDED.data, saved_at = EXCLUDED.saved_at", [version, data, at]);
      await client.query("INSERT INTO corp_book_versions (version, data, saved_at, note) VALUES ($1, $2::jsonb, $3, $4)", [version, data, at, String(body.note || "").slice(0, 200)]);
      await client.query("DELETE FROM corp_book_versions WHERE version <= $1", [version - KEEP_VERSIONS]);
      await client.query("COMMIT");
      res.json({ version, savedAt: at });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      fail(res, e, "save book");
    } finally { client.release(); }
  });

  app.get("/api/corp/versions", ready, apiLimit, signedIn, async (_req, res) => {
    try {
      const { rows } = await pool.query("SELECT version, saved_at, note, pg_column_size(data) AS bytes FROM corp_book_versions ORDER BY version DESC LIMIT 60");
      res.json(rows.map((r) => ({ version: r.version, savedAt: r.saved_at, note: r.note, bytes: r.bytes })));
    } catch (e) { fail(res, e, "list versions"); }
  });
  app.get("/api/corp/versions/:v", ready, apiLimit, signedIn, async (req, res) => {
    if (!/^\d+$/.test(String(req.params.v))) return res.status(404).json({ error: "no such version" });
    try {
      const { rows } = await pool.query("SELECT version, data, saved_at FROM corp_book_versions WHERE version = $1", [Number(req.params.v)]);
      if (!rows.length) return res.status(404).json({ error: "no such version" });
      res.json({ version: rows[0].version, savedAt: rows[0].saved_at, db: rows[0].data });
    } catch (e) { fail(res, e, "read version"); }
  });

  // Original PDFs and photos, stored by content hash: the same file attached twice is kept once.
  app.post("/api/corp/files", ready, apiLimit, signedIn, express.raw({ type: () => true, limit: MAX_FILE }), async (req, res) => {
    try {
      const buf = req.body as Buffer;
      const ext = Buffer.isBuffer(buf) ? kindOf(buf) : null;
      if (!ext) return res.status(400).json({ error: "not a PDF, JPG or PNG" });
      const id = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 32);
      const name = String(req.query.name || "document").replace(/[\\/:*?"<>|\r\n]/g, "_").slice(0, 160);
      await ensureBucket();
      const { error } = await storage().from(BUCKET).upload(`${id}.${ext}`, buf, { contentType: TYPES[ext], upsert: true });
      if (error) throw error;
      await pool.query("INSERT INTO corp_files (id, name, size, ext, saved_at) VALUES ($1, $2, $3, $4, now()) ON CONFLICT (id) DO NOTHING", [id, name, buf.length, ext]);
      res.json({ id, size: buf.length });
    } catch (e) { fail(res, e, "save file"); }
  });
  // Opened by plain links, which cannot send a header, so these take a files-only key in the address.
  app.get("/api/corp/files/:id", ready, apiLimit, async (req, res) => {
    if (!/^[a-f0-9]{32}$/.test(String(req.params.id))) return res.status(404).json({ error: "no such file" });
    if (!readToken(req.query.t, "files")) return res.status(401).json({ error: "sign in" });
    try {
      const { rows } = await pool.query("SELECT name, ext FROM corp_files WHERE id = $1", [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: "no such file" });
      const { data, error } = await storage().from(BUCKET).download(`${req.params.id}.${rows[0].ext}`);
      if (error || !data) return res.status(404).json({ error: "no such file" });
      const how = "download" in req.query ? "attachment" : "inline";
      res.writeHead(200, { "content-type": TYPES[rows[0].ext], "content-disposition": `${how}; filename="${String(rows[0].name).replace(/"/g, "")}"`, "cache-control": "private, no-store", "x-robots-tag": "noindex" });
      res.end(Buffer.from(await data.arrayBuffer()));
    } catch (e) { fail(res, e, "read file"); }
  });

  // ---- Problem reports. Stored first, so a failed email never loses one; then emailed to IndSure.
  app.post("/api/corp/feedback", ready, reportLimit, signedIn, express.json({ limit: "64kb" }), async (req, res) => {
    const b = req.body || {};
    const kind = b.kind === "idea" ? "idea" : "problem";
    const message = String(b.message || "").trim().slice(0, 5000);
    const page = String(b.page || "").slice(0, 200);
    const browser = String(req.headers["user-agent"] || "").slice(0, 300);
    const fileId = /^[a-f0-9]{32}$/.test(String(b.fileId || "")) ? String(b.fileId) : null;
    if (!message) return res.status(400).json({ error: "say what happened" });
    const user: CorpUser = (req as any).corpUser;
    try {
      const { rows } = await pool.query(
        "INSERT INTO corp_feedback (kind, message, page, who_name, who_email, who_role, browser, file_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
        [kind, message, page, user.name, user.email, user.role, browser, fileId],
      );
      const link = fileId ? `\nScreenshot (link works for 30 days): https://${req.headers.host}/api/corp/files/${fileId}?t=${encodeURIComponent(sign("files", Date.now() + 30 * 86400000))}` : "";
      const sent = await sendMail({
        to: process.env.CORP_FEEDBACK_TO || "tech@indsure.in",
        replyTo: user.email,
        subject: `[Commercial portal] ${kind === "idea" ? "Idea" : "Problem"} #${rows[0].id} from ${user.name}: ${message.replace(/\s+/g, " ").slice(0, 60)}`,
        text: `${message}\n\nFrom: ${user.name} (${user.email}), role ${user.role}\nPage: ${page}\nBrowser: ${browser}${link}\n\nReport #${rows[0].id}, kept in the corp_feedback table.`,
      });
      res.json({ id: rows[0].id, emailed: sent });
    } catch (e) { fail(res, e, "save report"); }
  });
  app.get("/api/corp/reminders", ready, apiLimit, signedIn, async (_req, res) => {
    try {
      const { rows } = await pool.query("SELECT key, sent_to, sent_at FROM corp_reminders_sent ORDER BY sent_at DESC LIMIT 500");
      res.json(rows);
    } catch (e) { fail(res, e, "list reminders"); }
  });

  // Checked hourly, sent once a day after 9am India time. Missing tables just mean not set up yet.
  let lastRun = "";
  const tick = async () => {
    if (!configured()) return;
    const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
    const day = ist.toISOString().slice(0, 10);
    if (ist.getUTCHours() < 9 || lastRun === day) return;
    lastRun = day;
    await sendDueReminders().catch((e) => { if (!missingTables(e)) log.error("[corp] reminders failed", { message: e?.message }); });
  };
  setInterval(() => { tick(); }, 3600 * 1000).unref();
  setTimeout(() => { tick(); }, 5 * 60 * 1000).unref();
}
