// IndSure Commercial (the /corporate portal): login, records and original files.
//
// Registered ABOVE express.json() in index.ts because the book can be far larger than the app's 2 MB
// body limit. Separate from the rest of the API on purpose: its own login (one shared test login whose
// password exists only as a scrypt hash in the server's .env, never in this public repo), its own
// tables (corp_*, migration 036, no browser access through RLS) and a private storage bucket.
//
//   CORP_LOGIN_EMAIL     the email that may sign in
//   CORP_LOGIN_HASH      <salt hex>:<scrypt hex>
//   CORP_SESSION_SECRET  signs session tokens
// With any of these missing, every route answers 503 and nothing else changes.

import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import { pool } from "./lib/db";
import { log } from "./lib/logger";

const BUCKET = "corporate-files";
const SESSION_HOURS = 12;
const KEEP_VERSIONS = 60;
const MAX_BOOK = "30mb";
const MAX_FILE = 40 * 1024 * 1024;
const TYPES: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg" };

const b64 = (s: string) => Buffer.from(s).toString("base64url");
function secret() { return process.env.CORP_SESSION_SECRET || ""; }
function hmac(body: string) { return crypto.createHmac("sha256", secret()).update(body).digest("base64url"); }
function sign(scope: "session" | "files", exp: number) { const body = b64(JSON.stringify({ scope, exp })); return `${body}.${hmac(body)}`; }
function validToken(token: unknown, scope: "session" | "files") {
  if (typeof token !== "string") return false;
  const [body, mac] = token.split(".");
  if (!body || !mac) return false;
  const want = Buffer.from(hmac(body)), got = Buffer.from(mac);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return false;
  try { const p = JSON.parse(Buffer.from(body, "base64url").toString()); return p.scope === scope && typeof p.exp === "number" && p.exp > Date.now(); } catch { return false; }
}
function passwordMatches(password: string) {
  const [salt, hash] = String(process.env.CORP_LOGIN_HASH || "").split(":");
  if (!salt || !hash) return false;
  const want = Buffer.from(hash, "hex");
  const got = crypto.scryptSync(password, Buffer.from(salt, "hex"), want.length);
  return crypto.timingSafeEqual(want, got);
}
function configured() { return !!(process.env.CORP_LOGIN_EMAIL && process.env.CORP_LOGIN_HASH && secret()); }
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

export function registerCorporateRoutes(app: Express) {
  const storage = () => createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "").storage;
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

  const ready = (_req: Request, res: Response, next: NextFunction) => { if (!configured()) return res.status(503).json({ error: "not configured" }); next(); };
  const signedIn = (req: Request, res: Response, next: NextFunction) => {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!validToken(token, "session")) return res.status(401).json({ error: "sign in" });
    next();
  };
  const fail = (res: Response, e: any, where: string) => {
    if (missingTables(e)) return res.status(503).json({ error: "not set up" });
    log.error(`[corp] ${where} failed`, { message: e?.message });
    return res.status(500).json({ error: "server error" });
  };

  app.post("/api/corp/login", ready, loginLimit, express.json({ limit: "10kb" }), (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const emailOk = email === String(process.env.CORP_LOGIN_EMAIL).trim().toLowerCase();
    const passOk = passwordMatches(password); // always runs, so a wrong email takes as long as a wrong password
    if (!emailOk || !passOk) return res.status(401).json({ error: "wrong email or password" });
    const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
    res.json({ token: sign("session", exp), fileKey: sign("files", exp), exp });
  });

  app.get("/api/corp/book", ready, apiLimit, signedIn, async (_req, res) => {
    try {
      const { rows } = await pool.query("SELECT version, data, saved_at FROM corp_book WHERE id = 1");
      if (!rows.length) return res.status(404).json({ error: "no book yet" });
      res.json({ version: rows[0].version, savedAt: rows[0].saved_at, db: rows[0].data });
    } catch (e) { fail(res, e, "read book"); }
  });

  // baseVersion must match what is stored, so two people cannot silently overwrite each other.
  app.put("/api/corp/book", ready, apiLimit, signedIn, express.json({ limit: MAX_BOOK }), async (req, res) => {
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
      const name = decodeURIComponent(String(req.headers["x-file-name"] || "document")).replace(/[\\/:*?"<>|\r\n]/g, "_").slice(0, 160);
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
    if (!validToken(req.query.t, "files")) return res.status(401).json({ error: "sign in" });
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
}
