// IndSure Commercial logins: organisations, owners, employees and invites (migration 041).
//
//   Owner      OrgID + password
//   Employee   UserID + OrgID + their own 6-digit PIN
//
// Secrets are kept only as scrypt hashes. A PIN is also mixed with a server secret first, because six digits
// alone could be guessed offline from a stolen hash. Every wrong try is counted on the account in the database
// before the PIN is checked, so many tries at once cannot slip past the limit. Invite links are random,
// single use, expire, and only their hash is stored.
import crypto from "crypto";

export type Db = { query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }> };
export const ROLES = ["ops", "accounts", "admin", "readonly"];
export const MAX_TRIES = 5;
export const LOCK_MINUTES = 15;
export const JOIN_DAYS = 7;
const OWNER_DAYS = 3;
const DEPARTMENTS = ["Fire", "Engineering", "Agriculture", "Marine", "Liability", "Miscellaneous", "Health", "Motor"];

export type Session = { org: number; code: string; orgName: string; kind: "owner" | "member" | "legacy"; uid: string; email: string; name: string; role: string; pv: string; designation?: string; departments?: string[] };

// ---- secrets
const pepper = () => process.env.CORP_PIN_PEPPER || process.env.CORP_SESSION_SECRET || "";
const peppered = (pin: string) => crypto.createHmac("sha256", pepper()).update(`pin:${pin}`).digest("hex");
export function hashSecret(secret: string) { const salt = crypto.randomBytes(16); return `${salt.toString("hex")}:${crypto.scryptSync(secret, salt, 64).toString("hex")}`; }
export function secretMatches(secret: string, stored: string) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const want = Buffer.from(hash, "hex");
  const got = crypto.scryptSync(secret, Buffer.from(salt, "hex"), want.length);
  return crypto.timingSafeEqual(want, got);
}
export const hashPin = (pin: string) => hashSecret(peppered(pin));
const pinMatches = (pin: string, stored: string) => secretMatches(peppered(pin), stored);
// Compared against when there is no such account, so a wrong ID takes as long as a wrong PIN.
const DUMMY = hashSecret(crypto.randomBytes(16).toString("hex"));
const pv = (hash: string) => crypto.createHash("sha256").update(hash).digest("hex").slice(0, 12);

export function pinProblem(pin: string): string | null {
  if (!/^\d{6}$/.test(pin)) return "The PIN is 6 digits.";
  const steps = [...pin].slice(1).map((d, i) => +d - +pin[i]);
  if (steps.every((s) => s === 0) || steps.every((s) => s === 1) || steps.every((s) => s === -1)) return "That PIN is too easy to guess. Choose another.";
  return null;
}
export const passwordProblem = (p: string): string | null => (p.length < 10 ? "The password needs at least 10 characters." : p.length > 200 ? "That password is too long." : null);
export const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;
export const cleanEmail = (e: unknown) => String(e || "").trim().toLowerCase();
export const cleanCode = (c: unknown) => String(c || "").trim().toUpperCase().replace(/\s+/g, "").slice(0, 40);
const cleanLine = (s: unknown, n: number) => String(s || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

// ---- codes
const digits = (n: number) => String(crypto.randomInt(10 ** (n - 1), 10 ** n));
export const userCodeFor = (name: string) => `${(name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4) || "USER")}${digits(5)}`;

export async function logEvent(db: Db, org: number, who: string, event: string, detail = "", memberId: number | string | null = null) {
  try { await db.query("INSERT INTO corp_auth_events (org_id, member_id, who, event, detail) VALUES ($1, $2, $3, $4, $5)", [org, memberId, who.slice(0, 120), event.slice(0, 60), detail.slice(0, 300)]); } catch { /* the history never blocks a sign-in */ }
}

const ownerSession = (o: any): Session => ({ org: o.id, code: o.code, orgName: o.name, kind: "owner", uid: `owner:${o.id}`, email: o.owner_email || "", name: o.owner_name, role: "admin", pv: pv(o.owner_hash) });
const memberSession = (m: any): Session => ({ org: m.org_id, code: m.code, orgName: m.org_name, kind: "member", uid: String(m.id), email: m.email, name: m.name, role: m.role, pv: pv(m.pin_hash), designation: m.designation, departments: m.departments || [] });
const MEMBER_SQL = "SELECT m.*, o.code, o.name AS org_name, o.active AS org_active FROM corp_members m JOIN corp_orgs o ON o.id = m.org_id";

// Counts this try first. No row back means the account is locked just now.
const claimTry = (table: "corp_orgs" | "corp_members") => `UPDATE ${table} SET
   failed = CASE WHEN locked_until IS NOT NULL THEN 1 ELSE failed + 1 END,
   locked_until = CASE WHEN (CASE WHEN locked_until IS NOT NULL THEN 1 ELSE failed + 1 END) >= $2 THEN now() + ($3 || ' minutes')::interval ELSE NULL END
 WHERE id = $1 AND (locked_until IS NULL OR locked_until < now()) RETURNING id`;

export async function loginOwner(db: Db, orgCode: string, password: string): Promise<Session | null> {
  const { rows } = await db.query("SELECT * FROM corp_orgs WHERE code = $1", [cleanCode(orgCode)]);
  const o = rows[0];
  if (!o || !o.owner_hash || !o.active) { secretMatches(password, DUMMY); return null; }
  const claim = await db.query(claimTry("corp_orgs"), [o.id, MAX_TRIES, String(LOCK_MINUTES)]);
  const ok = secretMatches(password, o.owner_hash);
  if (!claim.rows.length) { await logEvent(db, o.id, o.owner_name, "Owner sign-in refused", "Locked after too many wrong tries"); return null; }
  if (!ok) { await logEvent(db, o.id, o.owner_name, "Owner sign-in failed", "Wrong password"); return null; }
  await db.query("UPDATE corp_orgs SET failed = 0, locked_until = NULL, last_login = now() WHERE id = $1", [o.id]);
  await logEvent(db, o.id, o.owner_name, "Owner signed in");
  return ownerSession(o);
}
export async function loginMember(db: Db, orgCode: string, userCode: string, pin: string): Promise<Session | null> {
  const { rows } = await db.query(`${MEMBER_SQL} WHERE m.user_code = $1 AND o.code = $2`, [cleanCode(userCode), cleanCode(orgCode)]);
  const m = rows[0];
  if (!m || !m.active || !m.org_active) { pinMatches(pin, DUMMY); return null; }
  const claim = await db.query(claimTry("corp_members"), [m.id, MAX_TRIES, String(LOCK_MINUTES)]);
  const ok = pinMatches(pin, m.pin_hash);
  if (!claim.rows.length) { await logEvent(db, m.org_id, m.name, "Sign-in refused", "Locked after too many wrong tries", m.id); return null; }
  if (!ok) { await logEvent(db, m.org_id, m.name, "Sign-in failed", "Wrong PIN", m.id); return null; }
  await db.query("UPDATE corp_members SET failed = 0, locked_until = NULL, last_login = now() WHERE id = $1", [m.id]);
  await logEvent(db, m.org_id, m.name, "Signed in", "", m.id);
  return memberSession(m);
}

// A session is checked again on every request: switched off, or a new PIN or password, ends it at once.
export async function freshSession(db: Db, s: any): Promise<Session | null> {
  if (s?.kind === "owner") {
    const { rows } = await db.query("SELECT * FROM corp_orgs WHERE id = $1", [s.org]);
    const o = rows[0];
    return o && o.active && o.owner_hash && pv(o.owner_hash) === s.pv ? ownerSession(o) : null;
  }
  if (s?.kind === "member" && /^\d+$/.test(String(s.uid))) {
    const { rows } = await db.query(`${MEMBER_SQL} WHERE m.id = $1 AND m.org_id = $2`, [s.uid, s.org]);
    const m = rows[0];
    return m && m.active && m.org_active && pv(m.pin_hash) === s.pv ? memberSession(m) : null;
  }
  return null;
}

// ---- invites
const tokenHash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
export const portalUrl = () => (process.env.CORP_PORTAL_URL || "https://beta.indsure.in/corporate").replace(/[#?].*$/, "");
export const inviteLink = (token: string) => `${portalUrl()}#join=${token}`; // after the #, so it never reaches a server log

async function newInvite(db: Db, v: { org: number; kind: "owner" | "join" | "pin"; email: string; role?: string | null; memberId?: any; days: number }) {
  const token = crypto.randomBytes(32).toString("base64url");
  // A newer link replaces an older unused one for the same person.
  await db.query("UPDATE corp_invites SET revoked_at = now() WHERE org_id = $1 AND email = $2 AND kind = $3 AND used_at IS NULL AND revoked_at IS NULL", [v.org, v.email, v.kind]);
  const { rows } = await db.query("INSERT INTO corp_invites (org_id, kind, email, role, member_id, token_hash, expires_at) VALUES ($1, $2, $3, $4, $5, $6, now() + ($7 || ' days')::interval) RETURNING id, expires_at", [v.org, v.kind, v.email, v.role ?? null, v.memberId ?? null, tokenHash(token), String(v.days)]);
  return { id: rows[0].id, expiresAt: rows[0].expires_at, link: inviteLink(token), token };
}
export const inviteOwner = (db: Db, org: number, email: string) => newInvite(db, { org, kind: "owner", email, days: OWNER_DAYS });

export async function createOrg(db: Db, name: string, email: string) {
  const org = cleanLine(name, 120), mail = cleanEmail(email);
  if (!org || !emailOk(mail)) throw new Error("an organisation name and a valid owner email are needed");
  for (let i = 0; i < 20; i++) {
    const { rows } = await db.query("INSERT INTO corp_orgs (code, name, owner_email) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING RETURNING id, code", [`IC${digits(5)}`, org, mail]);
    if (rows.length) { const { link, token, expiresAt } = await inviteOwner(db, rows[0].id, mail); return { id: rows[0].id as number, code: rows[0].code as string, link, token, expiresAt }; }
  }
  throw new Error("could not find a free OrgID");
}

export async function inviteMember(db: Db, by: Session, emailRaw: unknown, role: unknown) {
  const email = cleanEmail(emailRaw);
  if (!emailOk(email) || !ROLES.includes(String(role))) return { status: 400, error: "Enter a valid email and choose a role." };
  const dup = await db.query("SELECT 1 FROM corp_members WHERE org_id = $1 AND email = $2", [by.org, email]);
  if (dup.rows.length) return { status: 409, error: "That email already belongs to someone in your organisation." };
  const inv = await newInvite(db, { org: by.org, kind: "join", email, role: String(role), days: JOIN_DAYS });
  await logEvent(db, by.org, by.name, "Invited", `${email} as ${role}`);
  return { status: 200, invite: inv, email };
}
export async function invitePin(db: Db, by: Session, memberId: string) {
  const { rows } = await db.query("SELECT id, email, name FROM corp_members WHERE id = $1 AND org_id = $2", [memberId, by.org]);
  if (!rows.length) return { status: 404, error: "No such person." };
  const inv = await newInvite(db, { org: by.org, kind: "pin", email: rows[0].email, memberId: rows[0].id, days: JOIN_DAYS });
  await logEvent(db, by.org, by.name, "New PIN link sent", rows[0].email, rows[0].id);
  return { status: 200, invite: inv, email: rows[0].email as string };
}
const LIVE = "i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now() AND o.active";
export async function lookInvite(db: Db, token: unknown) {
  const { rows } = await db.query(`SELECT i.*, o.code, o.name AS org_name, m.name AS member_name, m.user_code FROM corp_invites i JOIN corp_orgs o ON o.id = i.org_id LEFT JOIN corp_members m ON m.id = i.member_id WHERE i.token_hash = $1 AND ${LIVE}`, [tokenHash(String(token || ""))]);
  return rows[0] || null;
}
export const inviteView = (i: any) => ({ kind: i.kind, email: i.email, orgName: i.org_name, orgCode: i.code, role: i.role, name: i.member_name || "", userCode: i.user_code || "", departments: DEPARTMENTS });

export function profileProblem(b: any): string | null {
  if (!cleanLine(b?.name, 120)) return "Enter your name.";
  if (!cleanLine(b?.designation, 120)) return "Enter your designation.";
  if (!Array.isArray(b?.departments) || !b.departments.length || b.departments.some((d: any) => !DEPARTMENTS.includes(d))) return "Choose at least one department.";
  return null;
}

// The link is claimed and used in one transaction (the caller's), so the same link cannot be used twice.
export async function acceptInvite(tx: Db, token: unknown, b: any): Promise<{ status: number; error?: string; session?: Session; userCode?: string }> {
  const seen = await lookInvite(tx, token);
  if (!seen) return { status: 410, error: "This link has expired or was already used. Ask for a new one." };
  const problem = seen.kind === "owner" ? (!cleanLine(b?.name, 120) ? "Enter your name." : passwordProblem(String(b?.password || ""))) : seen.kind === "join" ? profileProblem(b) || pinProblem(String(b?.pin || "")) : pinProblem(String(b?.pin || ""));
  if (problem) return { status: 400, error: problem };
  const claim = await tx.query("UPDATE corp_invites SET used_at = now() WHERE id = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now() RETURNING id", [seen.id]);
  if (!claim.rows.length) return { status: 410, error: "This link has expired or was already used. Ask for a new one." };
  if (seen.kind === "owner") {
    const { rows } = await tx.query("UPDATE corp_orgs SET owner_hash = $2, owner_name = $3, owner_email = $4, failed = 0, locked_until = NULL, last_login = now() WHERE id = $1 RETURNING *", [seen.org_id, hashSecret(String(b.password)), cleanLine(b.name, 120), seen.email]);
    await logEvent(tx, seen.org_id, rows[0].owner_name, "Owner password set");
    return { status: 200, session: ownerSession(rows[0]) };
  }
  let id = seen.member_id, userCode = seen.user_code;
  if (seen.kind === "pin") {
    const r = await tx.query("UPDATE corp_members SET pin_hash = $2, failed = 0, locked_until = NULL WHERE id = $1 AND active RETURNING id", [id, hashPin(String(b.pin))]);
    if (!r.rows.length) return { status: 410, error: "This login has been switched off. Ask your owner." };
  } else {
    for (let i = 0; i < 20 && !id; i++) {
      userCode = userCodeFor(cleanLine(b.name, 120));
      const taken = await tx.query("SELECT 1 FROM corp_members WHERE user_code = $1", [userCode]);
      if (taken.rows.length) continue;
      const r = await tx.query("INSERT INTO corp_members (org_id, user_code, email, name, designation, departments, role, pin_hash, last_login) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, now()) ON CONFLICT DO NOTHING RETURNING id", [seen.org_id, userCode, seen.email, cleanLine(b.name, 120), cleanLine(b.designation, 120), JSON.stringify([...new Set(b.departments)]), seen.role, hashPin(String(b.pin))]);
      if (r.rows.length) id = r.rows[0].id; else break;
    }
    if (!id) return { status: 409, error: "That email already belongs to someone in this organisation." };
  }
  const { rows } = await tx.query(`${MEMBER_SQL} WHERE m.id = $1`, [id]);
  await logEvent(tx, seen.org_id, rows[0].name, seen.kind === "pin" ? "New PIN set" : "Joined", "", id);
  return { status: 200, session: memberSession(rows[0]), userCode };
}

export async function changeOwnPin(db: Db, s: Session, current: string, next: string): Promise<{ status: number; error?: string; session?: Session }> {
  const problem = pinProblem(next);
  if (problem) return { status: 400, error: problem };
  const claim = await db.query(claimTry("corp_members"), [s.uid, MAX_TRIES, String(LOCK_MINUTES)]);
  const { rows } = await db.query("SELECT pin_hash FROM corp_members WHERE id = $1 AND org_id = $2", [s.uid, s.org]);
  if (!claim.rows.length || !rows.length || !pinMatches(current, rows[0].pin_hash)) return { status: 403, error: "The current PIN is not right." };
  await db.query("UPDATE corp_members SET pin_hash = $2, failed = 0, locked_until = NULL WHERE id = $1", [s.uid, hashPin(next)]);
  await logEvent(db, s.org, s.name, "PIN changed", "", s.uid);
  const f = await db.query(`${MEMBER_SQL} WHERE m.id = $1`, [s.uid]);
  return { status: 200, session: memberSession(f.rows[0]) };
}
export async function changeOwnPassword(db: Db, s: Session, current: string, next: string): Promise<{ status: number; error?: string; session?: Session }> {
  const problem = passwordProblem(next);
  if (problem) return { status: 400, error: problem };
  const claim = await db.query(claimTry("corp_orgs"), [s.org, MAX_TRIES, String(LOCK_MINUTES)]);
  const { rows } = await db.query("SELECT owner_hash FROM corp_orgs WHERE id = $1", [s.org]);
  if (!claim.rows.length || !secretMatches(current, rows[0]?.owner_hash || DUMMY)) return { status: 403, error: "The current password is not right." };
  const r = await db.query("UPDATE corp_orgs SET owner_hash = $2, failed = 0, locked_until = NULL WHERE id = $1 RETURNING *", [s.org, hashSecret(next)]);
  await logEvent(db, s.org, s.name, "Owner password changed");
  return { status: 200, session: ownerSession(r.rows[0]) };
}

export async function changeMember(db: Db, by: Session, id: string, b: any): Promise<{ status: number; error?: string }> {
  if (b.role !== undefined && !ROLES.includes(b.role)) return { status: 400, error: "Choose a role." };
  if (b.departments !== undefined && (!Array.isArray(b.departments) || !b.departments.length || b.departments.some((d: any) => !DEPARTMENTS.includes(d)))) return { status: 400, error: "Choose at least one department." };
  if (b.designation !== undefined && !cleanLine(b.designation, 120)) return { status: 400, error: "Enter a designation." };
  const { rows } = await db.query(
    "UPDATE corp_members SET role = COALESCE($3, role), active = COALESCE($4, active), designation = COALESCE($5, designation), departments = COALESCE($6::jsonb, departments) WHERE id = $1 AND org_id = $2 RETURNING name, email",
    [id, by.org, b.role ?? null, typeof b.active === "boolean" ? b.active : null, b.designation !== undefined ? cleanLine(b.designation, 120) : null, b.departments !== undefined ? JSON.stringify([...new Set(b.departments)]) : null],
  );
  if (!rows.length) return { status: 404, error: "No such person." };
  const what = [b.role !== undefined && `role ${b.role}`, typeof b.active === "boolean" && (b.active ? "switched on" : "switched off"), b.designation !== undefined && "designation", b.departments !== undefined && `departments ${b.departments.join(", ")}`].filter(Boolean).join("; ");
  await logEvent(db, by.org, by.name, "Login changed", `${rows[0].name}: ${what}`, id);
  return { status: 200 };
}
