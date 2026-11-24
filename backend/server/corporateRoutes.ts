// IndSure Commercial (the /corporate portal): logins, records, original files, problem reports, reminders.
//
// Registered ABOVE express.json() in index.ts because the book can be far larger than the app's 2 MB
// body limit. Separate from the rest of the API on purpose: its own logins (passwords exist only as
// scrypt hashes, in the server's .env for the owner and in corp_users for everyone else, never in this
// public repo), its own tables (corp_*, migrations 036 to 038, no browser access through RLS) and a
// private storage bucket.
//
//   CORP_LOGIN_EMAIL     the owner login (always an Admin)
//   CORP_LOGIN_HASH      <salt hex>:<scrypt hex>
//   CORP_SESSION_SECRET  signs session tokens
//   CORP_FEEDBACK_TO     where problem reports are emailed (default tech@indsure.in)
//   CORP_PIN_PEPPER      optional, mixed into employee PINs (default: the session secret). Never change it once set.
//   CORP_ADMIN_TOKEN     32+ characters, shared with IndSure's admin portal server only. Without it those routes are off.
//   CORP_PORTAL_URL      where invite links point (default https://beta.indsure.in/corporate)
// With any of the first three missing, every route answers 503 and nothing else changes.
//
// Organisations (migration 041): every record, version, file, document text, reminder and report belongs to one
// organisation, taken from the signed-in session and never from the request. Organisation 1 is everything saved
// before organisations existed; its ids are stored as they were, every other organisation's carry an "o<id>~"
// prefix that no request can spell. The email and password logins are organisation 1 only.
//
// The portal saves its records as one book, so the server can refuse a Read-only login's save but cannot
// tell which part of the book an Operations or Accounts login changed. Those limits are on the screens.

import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import { pool as realPool } from "./lib/db";
import { log } from "./lib/logger";
import { sendMail as realSendMail } from "./lib/mailer";
import * as auth from "./services/corpAuth";

const BUCKET = "corporate-files";
const SESSION_HOURS = 12;
const KEEP_VERSIONS = 60;
const MAX_BOOK = "30mb";
const MAX_FILE = 40 * 1024 * 1024;
const TYPES: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg" };
const ROLES = auth.ROLES;
type CorpUser = { email: string; name: string; role: string; org?: number; kind?: string; uid?: string; [k: string]: any };
type Deps = { pool: any; sendMail: (m: any) => Promise<boolean> };
const key = (org: number, id: string) => (org === 1 ? id : `o${org}~${id}`);

const b64 = (s: string) => Buffer.from(s).toString("base64url");
function secret() { return process.env.CORP_SESSION_SECRET || ""; }
function hmac(body: string) { return crypto.createHmac("sha256", secret()).update(body).digest("base64url"); }
function sign(scope: "session" | "files", exp: number, user?: any, org = 1) { const body = b64(JSON.stringify({ scope, exp, user, org })); return `${body}.${hmac(body)}`; }
function readToken(token: unknown, scope: "session" | "files"): any {
  if (typeof token !== "string") return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const want = Buffer.from(hmac(body)), got = Buffer.from(mac);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try { const p = JSON.parse(Buffer.from(body, "base64url").toString()); return p.scope === scope && typeof p.exp === "number" && p.exp > Date.now() ? p : null; } catch { return null; }
}
const hashPassword = auth.hashSecret;
const passwordMatches = auth.secretMatches;
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
export async function sendDueReminders({ pool, sendMail }: Deps, orgsOn: boolean) {
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const ids: number[] = (await pool.query(orgsOn ? "SELECT b.id FROM corp_book b JOIN corp_orgs o ON o.id = b.id WHERE o.active ORDER BY b.id" : "SELECT id FROM corp_book WHERE id = 1")).rows.map((r: any) => r.id);
  for (const org of ids) {
    const { rows } = await pool.query("SELECT data FROM corp_book WHERE id = $1", [org]);
    for (const r of rows.length ? remindersDue(rows[0].data, today) : []) {
      // Claim the reminder first so a restart can never send it twice; give it back if the email fails.
      const claim = await pool.query("INSERT INTO corp_reminders_sent (key, sent_to) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING RETURNING key", [key(org, r.key), r.to]);
      if (!claim.rowCount) continue;
      const ok = await sendMail({ to: r.to, subject: r.subject, text: r.text });
      if (!ok) await pool.query("DELETE FROM corp_reminders_sent WHERE key = $1", [key(org, r.key)]);
    }
  }
}

export function registerCorporateRoutes(app: Express, deps: Partial<Deps> & { storage?: () => any } = {}) {
  const pool = deps.pool || realPool, sendMail = deps.sendMail || realSendMail;
  // Until migration 041 has been run there is only organisation 1 and the email logins.
  let orgTables = false;
  const orgsOn = async () => orgTables || (orgTables = !!(await pool.query("SELECT to_regclass('public.corp_orgs') AS t")).rows[0]?.t);
  const orgOf = (req: Request): number => (req as any).corpUser.org;
  const storage = deps.storage || (() => createClient(process.env.SUPABASE_URL || "https://khxbabotbvnyjwvqtumt.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || "").storage);
  let bucketReady = false;
  const ensureBucket = async () => {
    if (bucketReady) return;
    const s = storage();
    const { data } = await s.getBucket(BUCKET);
    if (!data) { const { error } = await s.createBucket(BUCKET, { public: false }); if (error && !/exist/i.test(error.message)) throw error; }
    bucketReady = true;
  };

  // Wrong tries only, so a whole office signing in from one address is not locked out. Each account has its own limit too.
  const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false, message: { error: "too many tries" } });
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
    if (p.user?.kind === "owner" || p.user?.kind === "member") {
      try {
        const s = await auth.freshSession(pool, p.user);
        if (!s) return res.status(401).json({ error: "sign in" });
        (req as any).corpUser = s;
        return next();
      } catch (e) { return fail(res, e, "check sign-in"); }
    }
    const email = String(p.user?.email || ownerEmail());
    const legacy = { org: 1, kind: "legacy", uid: `email:${email}`, email };
    if (email === ownerEmail()) { (req as any).corpUser = { ...legacy, name: p.user?.name || "Admin", role: "admin", owner: true }; return next(); }
    try {
      const { rows } = await pool.query("SELECT email, name, role, active FROM corp_users WHERE email = $1", [email]);
      if (!rows.length || !rows[0].active) return res.status(401).json({ error: "sign in" });
      (req as any).corpUser = { ...legacy, name: rows[0].name, role: rows[0].role };
      next();
    } catch (e) { fail(res, e, "check login"); }
  };
  // The organisation's owner. The first email login counts as organisation 1's owner.
  const ownerOnly = (req: Request, res: Response, next: NextFunction) => { const u = (req as any).corpUser; if (u?.kind !== "owner" && !u?.owner) return res.status(403).json({ error: "owner only" }); next(); };
  // The email logins belong to organisation 1 and are managed only there.
  const orgOneOnly = (req: Request, res: Response, next: NextFunction) => { if (orgOf(req) !== 1) return res.status(403).json({ error: "not available" }); next(); };
  const needOrgs = async (_req: Request, res: Response, next: NextFunction) => { try { if (await orgsOn()) return next(); res.status(503).json({ error: "not set up" }); } catch (e) { fail(res, e, "check setup"); } };
  const open = (s: auth.Session) => { const exp = Date.now() + SESSION_HOURS * 3600 * 1000; return { token: sign("session", exp, { kind: s.kind, org: s.org, uid: s.uid, pv: s.pv }, s.org), fileKey: sign("files", exp, { kind: s.kind, org: s.org, uid: s.uid, pv: s.pv }, s.org), exp, user: { email: s.email, name: s.name, role: s.role, kind: s.kind, uid: s.uid, org: s.org, code: s.code, orgName: s.orgName, designation: s.designation || "", departments: s.departments || [] } }; };
  const adminOnly = (req: Request, res: Response, next: NextFunction) => { if ((req as any).corpUser?.role !== "admin") return res.status(403).json({ error: "admin only" }); next(); };

  app.post("/api/corp/login", ready, loginLimit, express.json({ limit: "10kb" }), async (req, res) => {
    // OrgID + password is the owner, UserID + OrgID + PIN an employee. The same answer for every kind of wrong.
    if (req.body?.org !== undefined) {
      try {
        if (!(await orgsOn())) return res.status(401).json({ error: "wrong details" });
        const s = req.body.user !== undefined ? await auth.loginMember(pool, req.body.org, req.body.user, String(req.body.pin || "").slice(0, 40)) : await auth.loginOwner(pool, req.body.org, String(req.body.password || "").slice(0, 300));
        return s ? res.json(open(s)) : res.status(401).json({ error: "wrong details" });
      } catch (e) { return fail(res, e, "sign in"); }
    }
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
    res.json({ token: sign("session", exp, user), fileKey: sign("files", exp, { email: user.email }), exp, user: { ...user, kind: "legacy", org: 1, uid: `email:${user.email}`, owner: user.email === ownerEmail() } });
  });

  // ---- Invite links. The token is posted, never in an address, so it stays out of server logs.
  app.post("/api/corp/join/look", ready, loginLimit, needOrgs, express.json({ limit: "10kb" }), async (req, res) => {
    try {
      const i = await auth.lookInvite(pool, req.body?.token);
      if (!i) return res.status(410).json({ error: "This link has expired or was already used. Ask for a new one." });
      res.json(auth.inviteView(i));
    } catch (e) { fail(res, e, "read invite"); }
  });
  app.post("/api/corp/join", ready, loginLimit, needOrgs, express.json({ limit: "20kb" }), async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const r = await auth.acceptInvite(client, req.body?.token, req.body || {});
      await client.query(r.session ? "COMMIT" : "ROLLBACK");
      if (!r.session) return res.status(r.status).json({ error: r.error });
      const s = r.session;
      const ids = s.kind === "owner" ? `OrgID: ${s.code}\nSign in as Owner with this OrgID and your password.` : `UserID: ${r.userCode}\nOrgID: ${s.code}\nSign in as Employee with these and your 6-digit PIN.`;
      sendMail({ to: s.email, subject: `Your IndSure Commercial sign-in: ${s.orgName}`, text: `Hello ${s.name},\n\n${ids}\n\n${auth.portalUrl()}\n\nKeep this email. IndSure will never ask for your PIN or password.` }).catch(() => {});
      res.json({ ...open(s), userCode: r.userCode || null });
    } catch (e) { await client.query("ROLLBACK").catch(() => {}); fail(res, e, "accept invite"); } finally { client.release(); }
  });

  // ---- Organisations, managed by IndSure's admin portal. Its server sends the token; a browser never holds it.
  const adminLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false, message: { error: "Too many refused tries. Wait 15 minutes." } });
  const indsureAdmin = (req: Request, res: Response, next: NextFunction) => {
    const want = String(process.env.CORP_ADMIN_TOKEN || ""), got = String(req.headers["x-corp-admin"] || "");
    if (want.length < 32) return res.status(503).json({ error: "The server's admin key is not set. Run the deploy kit." });
    const h = (s: string) => crypto.createHash("sha256").update(s).digest();
    if (!crypto.timingSafeEqual(h(want), h(got))) return res.status(401).json({ error: "The admin key was not accepted." });
    next();
  };
  const ADMIN = "IndSure admin";
  const ownerMail = (to: string, org: string, code: string, link: string) => sendMail({ to, subject: `Set up ${org} on IndSure Commercial`, text: `Your organisation, ${org}, is on IndSure Commercial. Its OrgID is ${code}.\n\nOpen this link to set your owner password:\n\n${link}\n\nThe link works once and for 3 days. If you were not expecting it, ignore this email.` }).catch(() => false);
  app.get("/api/corp/admin/orgs", ready, adminLimit, indsureAdmin, needOrgs, async (_req, res) => {
    try { res.json(await auth.listOrgs(pool)); } catch (e) { fail(res, e, "list organisations"); }
  });
  app.post("/api/corp/admin/orgs", ready, adminLimit, indsureAdmin, needOrgs, express.json({ limit: "10kb" }), async (req, res) => {
    const name = auth.cleanLine(req.body?.name, 120), email = auth.cleanEmail(req.body?.email);
    if (!name || !auth.emailOk(email)) return res.status(400).json({ error: "Enter the organisation's name and a valid owner email." });
    try {
      if ((await pool.query("SELECT 1 FROM corp_orgs WHERE lower(name) = lower($1)", [name])).rows.length) return res.status(409).json({ error: "An organisation with this name already exists." });
      const o = await auth.createOrg(pool, name, email);
      await auth.logEvent(pool, o.id, ADMIN, "Organisation created", `${name}, owner ${email}`);
      res.json({ code: o.code, name, email, link: o.link, expiresAt: o.expiresAt, emailed: await ownerMail(email, name, o.code, o.link) });
    } catch (e) { fail(res, e, "create organisation"); }
  });
  app.post("/api/corp/admin/orgs/:code/:action", ready, adminLimit, indsureAdmin, needOrgs, express.json({ limit: "10kb" }), async (req, res) => {
    const action = String(req.params.action);
    try {
      const o = (await pool.query("SELECT id, code, name, active FROM corp_orgs WHERE code = $1", [auth.cleanCode(req.params.code)])).rows[0];
      if (!o) return res.status(404).json({ error: "No such organisation." });
      if (action === "owner") {
        const email = auth.cleanEmail(req.body?.email);
        if (!auth.emailOk(email)) return res.status(400).json({ error: "Enter a valid owner email." });
        if (!o.active) return res.status(409).json({ error: "Switch the organisation on first. Its links do not work while it is off." });
        const i = await auth.inviteOwner(pool, o.id, email);
        await auth.logEvent(pool, o.id, ADMIN, "Organisation owner link", email);
        return res.json({ code: o.code, name: o.name, email, link: i.link, expiresAt: i.expiresAt, emailed: await ownerMail(email, o.name, o.code, i.link) });
      }
      if (action === "rename") {
        const name = auth.cleanLine(req.body?.name, 120);
        if (!name) return res.status(400).json({ error: "Enter a name." });
        if ((await pool.query("SELECT 1 FROM corp_orgs WHERE lower(name) = lower($1) AND id <> $2", [name, o.id])).rows.length) return res.status(409).json({ error: "An organisation with this name already exists." });
        await pool.query("UPDATE corp_orgs SET name = $2 WHERE id = $1", [o.id, name]);
        await auth.logEvent(pool, o.id, ADMIN, "Organisation renamed", `${o.name} to ${name}`);
      } else if (action === "on" || action === "off") {
        // Its email logins have no switch here, so "off" would look like more than it does.
        if (action === "off" && o.id === 1) return res.status(409).json({ error: "This organisation also has email logins, which this switch does not stop, so it cannot be switched off here." });
        await pool.query("UPDATE corp_orgs SET active = $2 WHERE id = $1", [o.id, action === "on"]);
        await auth.logEvent(pool, o.id, ADMIN, `Organisation switched ${action}`);
      } else if (action === "unlock") {
        await pool.query("UPDATE corp_orgs SET failed = 0, locked_until = NULL WHERE id = $1", [o.id]);
        await auth.logEvent(pool, o.id, ADMIN, "Organisation owner unlocked");
      } else return res.status(404).json({ error: "No such action." });
      res.json({ ok: true });
    } catch (e) { fail(res, e, "change organisation"); }
  });

  // ---- The team of one organisation, managed by its owner
  const me = (req: Request) => (req as any).corpUser as auth.Session;
  const inviteMail = async (to: string, org: string, link: string, kind: "join" | "pin") => sendMail({ to, subject: kind === "pin" ? "Set a new PIN for IndSure Commercial" : `${org} has invited you to IndSure Commercial`, text: `${kind === "pin" ? "Your owner sent you a link to set a new PIN." : `${org} has added you to IndSure Commercial. Open this link to set up your profile and choose your PIN.`}\n\n${link}\n\nThe link works once and for ${auth.JOIN_DAYS} days. If you were not expecting it, ignore this email.` }).catch(() => false);
  const orgName = async (org: number) => (await pool.query("SELECT name FROM corp_orgs WHERE id = $1", [org])).rows[0]?.name || "Your organisation";
  app.get("/api/corp/team", ready, apiLimit, signedIn, needOrgs, ownerOnly, async (req, res) => {
    try {
      const m = await pool.query("SELECT id, user_code, email, name, designation, departments, role, active, last_login, created_at FROM corp_members WHERE org_id = $1 ORDER BY name", [orgOf(req)]);
      const i = await pool.query("SELECT id, email, role, expires_at, created_at FROM corp_invites WHERE org_id = $1 AND kind = 'join' AND used_at IS NULL AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 200", [orgOf(req)]);
      const o = await pool.query("SELECT code, name FROM corp_orgs WHERE id = $1", [orgOf(req)]);
      res.json({ org: o.rows[0], members: m.rows, invites: i.rows });
    } catch (e) { fail(res, e, "list team"); }
  });
  app.post("/api/corp/team/invite", ready, apiLimit, signedIn, needOrgs, ownerOnly, express.json({ limit: "10kb" }), async (req, res) => {
    try {
      const r = await auth.inviteMember(pool, me(req), req.body?.email, req.body?.role);
      if (!r.invite) return res.status(r.status).json({ error: r.error });
      const emailed = await inviteMail(r.email!, await orgName(orgOf(req)), r.invite.link, "join");
      res.json({ id: r.invite.id, link: r.invite.link, expiresAt: r.invite.expiresAt, emailed });
    } catch (e) { fail(res, e, "invite"); }
  });
  app.post("/api/corp/team/invite/:id/cancel", ready, apiLimit, signedIn, needOrgs, ownerOnly, async (req, res) => {
    if (!/^\d{1,15}$/.test(String(req.params.id))) return res.status(404).json({ error: "No such invite." });
    try {
      const r = await pool.query("UPDATE corp_invites SET revoked_at = now() WHERE id = $1 AND org_id = $2 AND used_at IS NULL AND revoked_at IS NULL RETURNING email", [req.params.id, orgOf(req)]);
      if (!r.rows.length) return res.status(404).json({ error: "No such invite." });
      await auth.logEvent(pool, orgOf(req), me(req).name, "Invite cancelled", r.rows[0].email);
      res.json({ ok: true });
    } catch (e) { fail(res, e, "cancel invite"); }
  });
  app.patch("/api/corp/team/:id", ready, apiLimit, signedIn, needOrgs, ownerOnly, express.json({ limit: "10kb" }), async (req, res) => {
    if (!/^\d{1,15}$/.test(String(req.params.id))) return res.status(404).json({ error: "No such person." });
    try { const r = await auth.changeMember(pool, me(req), String(req.params.id), req.body || {}); res.status(r.status).json(r.error ? { error: r.error } : { ok: true }); } catch (e) { fail(res, e, "change person"); }
  });
  app.post("/api/corp/team/:id/new-pin", ready, apiLimit, signedIn, needOrgs, ownerOnly, async (req, res) => {
    if (!/^\d{1,15}$/.test(String(req.params.id))) return res.status(404).json({ error: "No such person." });
    try {
      const r = await auth.invitePin(pool, me(req), String(req.params.id));
      if (!r.invite) return res.status(r.status).json({ error: r.error });
      res.json({ link: r.invite.link, expiresAt: r.invite.expiresAt, emailed: await inviteMail(r.email!, "", r.invite.link, "pin") });
    } catch (e) { fail(res, e, "new PIN link"); }
  });
  app.post("/api/corp/me/secret", ready, loginLimit, signedIn, needOrgs, express.json({ limit: "10kb" }), async (req, res) => {
    const u = me(req), cur = String(req.body?.current || "").slice(0, 300), next = String(req.body?.next || "").slice(0, 300);
    try {
      const r = u.kind === "member" ? await auth.changeOwnPin(pool, u, cur, next) : u.kind === "owner" ? await auth.changeOwnPassword(pool, u, cur, next) : { status: 400, error: "Ask your Admin to change this password." };
      if (!(r as any).session) return res.status(r.status).json({ error: r.error });
      res.json(open((r as any).session));
    } catch (e) { fail(res, e, "change PIN or password"); }
  });

  // ---- Logins, managed by an Admin inside the portal
  app.get("/api/corp/users", ready, apiLimit, signedIn, orgOneOnly, adminOnly, async (_req, res) => {
    try {
      const { rows } = await pool.query("SELECT email, name, role, active, last_login FROM corp_users ORDER BY name");
      res.json(rows);
    } catch (e) { fail(res, e, "list logins"); }
  });
  app.post("/api/corp/users", ready, apiLimit, signedIn, orgOneOnly, adminOnly, express.json({ limit: "10kb" }), async (req, res) => {
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
  app.patch("/api/corp/users/:email", ready, apiLimit, signedIn, orgOneOnly, adminOnly, express.json({ limit: "10kb" }), async (req, res) => {
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
  app.get("/api/corp/book", ready, apiLimit, signedIn, async (req, res) => {
    try {
      const { rows } = await pool.query("SELECT version, data, saved_at FROM corp_book WHERE id = $1", [orgOf(req)]);
      if (!rows.length) return res.status(404).json({ error: "no book yet" });
      res.json({ version: rows[0].version, savedAt: rows[0].saved_at, db: rows[0].data });
    } catch (e) { fail(res, e, "read book"); }
  });

  // Each document's text, kept out of the book so a save stays small.
  app.get("/api/corp/doctext", ready, apiLimit, signedIn, async (req, res) => {
    const ids = String(req.query.ids || "").split(",").filter((x) => /^[\w-]{1,64}$/.test(x)).slice(0, 100);
    if (!ids.length) { try { await pool.query("SELECT 1 FROM corp_doc_text LIMIT 1"); return res.json({}); } catch (e) { return fail(res, e, "check text"); } }
    try {
      const org = orgOf(req), cut = key(org, "").length;
      const { rows } = await pool.query("SELECT id, lines FROM corp_doc_text WHERE id = ANY($1)", [ids.map((x) => key(org, x))]);
      res.json(Object.fromEntries(rows.map((r: any) => [String(r.id).slice(cut), r.lines])));
    } catch (e) { fail(res, e, "read text"); }
  });
  app.post("/api/corp/doctext", ready, apiLimit, signedIn, express.json({ limit: MAX_BOOK }), async (req, res) => {
    if ((req as any).corpUser?.role === "readonly") return res.status(403).json({ error: "read only" });
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.some((x: any) => !/^[\w-]{1,64}$/.test(String(x?.id)) || !Array.isArray(x?.lines))) return res.status(400).json({ error: "check the details" });
    try {
      for (const it of items) await pool.query("INSERT INTO corp_doc_text (id, lines) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO UPDATE SET lines = EXCLUDED.lines", [key(orgOf(req), it.id), JSON.stringify(it.lines)]);
      res.json({ ok: true });
    } catch (e) { fail(res, e, "save text"); }
  });

  // baseVersion must match what is stored, so two people cannot silently overwrite each other.
  app.put("/api/corp/book", ready, apiLimit, signedIn, express.json({ limit: MAX_BOOK }), async (req, res) => {
    if ((req as any).corpUser?.role === "readonly") return res.status(403).json({ error: "read only" });
    const body = req.body || {}, org = orgOf(req);
    // A window still holding another organisation's records can never save them here.
    if (body.org !== undefined && body.org !== org) return res.status(403).json({ error: "another organisation" });
    if (!validBook(body.db)) return res.status(400).json({ error: "not a valid book" });
    try { await orgsOn(); } catch (e) { return fail(res, e, "check setup"); }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const cur = await client.query("SELECT version FROM corp_book WHERE id = $1 FOR UPDATE", [org]);
      const current = cur.rows[0]?.version ?? 0;
      if ((body.baseVersion ?? 0) !== current) { await client.query("ROLLBACK"); return res.status(409).json({ error: "changed elsewhere", version: current }); }
      const version = current + 1, at = new Date().toISOString(), data = JSON.stringify(body.db);
      await client.query("INSERT INTO corp_book (id, version, data, saved_at) VALUES ($4, $1, $2::jsonb, $3) ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, data = EXCLUDED.data, saved_at = EXCLUDED.saved_at", [version, data, at, org]);
      const note = String(body.note || "").slice(0, 200);
      if (orgTables) {
        await client.query("INSERT INTO corp_book_versions (org_id, version, data, saved_at, note) VALUES ($5, $1, $2::jsonb, $3, $4)", [version, data, at, note, org]);
        await client.query("DELETE FROM corp_book_versions WHERE org_id = $2 AND version <= $1", [version - KEEP_VERSIONS, org]);
      } else {
        await client.query("INSERT INTO corp_book_versions (version, data, saved_at, note) VALUES ($1, $2::jsonb, $3, $4)", [version, data, at, note]);
        await client.query("DELETE FROM corp_book_versions WHERE version <= $1", [version - KEEP_VERSIONS]);
      }
      await client.query("COMMIT");
      res.json({ version, savedAt: at });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      fail(res, e, "save book");
    } finally { client.release(); }
  });

  app.get("/api/corp/versions", ready, apiLimit, signedIn, async (req, res) => {
    try {
      const on = await orgsOn();
      const { rows } = await pool.query(`SELECT version, saved_at, note, pg_column_size(data) AS bytes FROM corp_book_versions ${on ? "WHERE org_id = $1" : ""} ORDER BY version DESC LIMIT 60`, on ? [orgOf(req)] : []);
      res.json(rows.map((r: any) => ({ version: r.version, savedAt: r.saved_at, note: r.note, bytes: r.bytes })));
    } catch (e) { fail(res, e, "list versions"); }
  });
  app.get("/api/corp/versions/:v", ready, apiLimit, signedIn, async (req, res) => {
    if (!/^\d+$/.test(String(req.params.v))) return res.status(404).json({ error: "no such version" });
    try {
      const on = await orgsOn();
      const { rows } = await pool.query(`SELECT version, data, saved_at FROM corp_book_versions WHERE version = $1 ${on ? "AND org_id = $2" : ""}`, on ? [Number(req.params.v), orgOf(req)] : [Number(req.params.v)]);
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
      const org = orgOf(req);
      const { error } = await storage().from(BUCKET).upload(`${org === 1 ? "" : `o${org}/`}${id}.${ext}`, buf, { contentType: TYPES[ext], upsert: true });
      if (error) throw error;
      await pool.query("INSERT INTO corp_files (id, name, size, ext, saved_at) VALUES ($1, $2, $3, $4, now()) ON CONFLICT (id) DO NOTHING", [key(org, id), name, buf.length, ext]);
      res.json({ id, size: buf.length });
    } catch (e) { fail(res, e, "save file"); }
  });
  // Opened by plain links, which cannot send a header, so these take a files-only key in the address.
  app.get("/api/corp/files/:id", ready, apiLimit, async (req, res) => {
    if (!/^[a-f0-9]{32}$/.test(String(req.params.id))) return res.status(404).json({ error: "no such file" });
    const t = readToken(req.query.t, "files");
    if (!t) return res.status(401).json({ error: "sign in" });
    const org = Number(t.org || 1);
    // A person's key stops when their login does. A report's screenshot link carries no person.
    try {
      if (t.user?.kind) { if (!(await auth.freshSession(pool, t.user))) return res.status(401).json({ error: "sign in" }); }
      else if (t.user?.email && t.user.email !== ownerEmail()) { const { rows } = await pool.query("SELECT active FROM corp_users WHERE email = $1", [t.user.email]); if (!rows[0]?.active) return res.status(401).json({ error: "sign in" }); }
    } catch (e) { return fail(res, e, "check file key"); }
    try {
      const { rows } = await pool.query("SELECT name, ext FROM corp_files WHERE id = $1", [key(org, String(req.params.id))]);
      if (!rows.length) return res.status(404).json({ error: "no such file" });
      const { data, error } = await storage().from(BUCKET).download(`${org === 1 ? "" : `o${org}/`}${req.params.id}.${rows[0].ext}`);
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
      if (await orgsOn()) await pool.query("UPDATE corp_feedback SET org_id = $2 WHERE id = $1", [rows[0].id, orgOf(req)]);
      const link = fileId ? `\nScreenshot (link works for 30 days): https://${req.headers.host}/api/corp/files/${fileId}?t=${encodeURIComponent(sign("files", Date.now() + 30 * 86400000, undefined, orgOf(req)))}` : "";
      const sent = await sendMail({
        to: process.env.CORP_FEEDBACK_TO || "tech@indsure.in",
        replyTo: user.email,
        subject: `[Commercial portal] ${kind === "idea" ? "Idea" : "Problem"} #${rows[0].id} from ${user.name}: ${message.replace(/\s+/g, " ").slice(0, 60)}`,
        text: `${message}\n\nFrom: ${user.name} (${user.email}), role ${user.role}\nPage: ${page}\nBrowser: ${browser}${link}\n\nReport #${rows[0].id}, kept in the corp_feedback table.`,
      });
      res.json({ id: rows[0].id, emailed: sent });
    } catch (e) { fail(res, e, "save report"); }
  });
  app.get("/api/corp/reminders", ready, apiLimit, signedIn, async (req, res) => {
    try {
      const org = orgOf(req), pre = key(org, "");
      const { rows } = await pool.query(org === 1 ? "SELECT key, sent_to, sent_at FROM corp_reminders_sent WHERE strpos(key, '~') = 0 ORDER BY sent_at DESC LIMIT 500" : "SELECT key, sent_to, sent_at FROM corp_reminders_sent WHERE starts_with(key, $1) ORDER BY sent_at DESC LIMIT 500", org === 1 ? [] : [pre]);
      res.json(rows.map((r: any) => ({ ...r, key: String(r.key).slice(pre.length) })));
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
    await orgsOn().then((on) => sendDueReminders({ pool, sendMail }, on)).catch((e) => { if (!missingTables(e)) log.error("[corp] reminders failed", { message: e?.message }); });
  };
  setInterval(() => { tick(); }, 3600 * 1000).unref();
  setTimeout(() => { tick(); }, 5 * 60 * 1000).unref();
}
