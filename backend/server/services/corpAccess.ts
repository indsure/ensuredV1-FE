// IndSure Commercial: what each role may see and do, and teams of people (migration 042).
//
// Admin is always everything and cannot be edited, so an organisation can never lock itself out. The other three
// built-in roles can be changed by the owner, who can also add roles. Teams group people; they hide nothing.
import crypto from "crypto";
import type { Db, Session } from "./corpAuth";
import { cleanLine, logEvent } from "./corpAuth";

export const PAGES = ["home", "customers", "new", "register", "expiry", "business", "brokerage", "renewreport", "snapshots", "masters", "fx", "presets", "reminders"];
export const ACTIONS = ["createCustomer", "editCustomer", "newBusiness", "editDraft", "addBranch", "addDoc", "endorse", "renew", "markLost", "fleet", "declare", "schedule", "receipt", "finalize", "export", "settings", "deletePolicy", "backup"];
// These change no record. A role holding nothing else cannot save.
const READ_ONLY_ACTIONS = ["export", "backup"];
export type Role = { key: string; name: string; pages: string[]; actions: string[]; builtIn: boolean; edited?: boolean };
// Everyone sees everything (founder, 25/11/2026). New business only adds, so it comes with adding policies.
const VIEW = PAGES.filter((p) => p !== "new");
const DEFAULTS: Role[] = [
  { key: "ops", name: "Operations / BD", pages: PAGES, actions: ["createCustomer", "editCustomer", "newBusiness", "editDraft", "endorse", "renew", "markLost", "fleet", "declare", "schedule", "receipt", "addDoc", "addBranch", "backup"], builtIn: true },
  { key: "accounts", name: "Accounts", pages: VIEW, actions: ["receipt", "export", "finalize", "addDoc", "backup"], builtIn: true },
  { key: "admin", name: "Admin", pages: PAGES, actions: ACTIONS, builtIn: true },
  { key: "readonly", name: "Read-only", pages: VIEW, actions: ["backup"], builtIn: true },
];
const BUILT_IN = DEFAULTS.map((r) => r.key);

let on = false;
export async function accessOn(db: Db) { return on || (on = !!(await db.query("SELECT to_regclass('public.corp_roles') AS t")).rows[0]?.t); }

export async function rolesOf(db: Db, org: number): Promise<Role[]> {
  const rows = (await accessOn(db)) ? (await db.query("SELECT key, name, pages, actions FROM corp_roles WHERE org_id = $1 ORDER BY lower(name)", [org])).rows : [];
  const keep = (list: any, all: string[]) => (Array.isArray(list) ? all.filter((x) => list.includes(x)) : []);
  const stored = new Map(rows.map((r: any) => [r.key, { key: r.key, name: r.name, pages: keep(r.pages, PAGES), actions: keep(r.actions, ACTIONS) }]));
  return [...DEFAULTS.map((d) => (d.key !== "admin" && stored.has(d.key) ? { ...d, ...stored.get(d.key)!, builtIn: true, edited: true } : d)), ...[...stored.values()].filter((r) => !BUILT_IN.includes(r.key)).map((r) => ({ ...r, builtIn: false }))];
}
export async function roleOf(db: Db, org: number, key: string) { return (await rolesOf(db, org)).find((r) => r.key === key) || null; }
export async function maySave(db: Db, org: number, key: string) {
  const r = await roleOf(db, org, key);
  return !!r && r.actions.some((a) => !READ_ONLY_ACTIONS.includes(a));
}

function roleProblem(b: any): string | null {
  if (!cleanLine(b?.name, 60)) return "Enter a name for the role.";
  if (!Array.isArray(b?.pages) || b.pages.some((x: any) => !PAGES.includes(x)) || !Array.isArray(b?.actions) || b.actions.some((x: any) => !ACTIONS.includes(x))) return "Check what is ticked.";
  // Records open from these two pages, so a role with neither would be stuck.
  if (!b.pages.includes("customers") && !b.pages.includes("register")) return "Tick Customers or Policy register, so the role can open records.";
  return null;
}
const sameName = (e: any) => e?.code === "23505";
export async function saveRole(db: Db, by: Session, key: string | null, b: any): Promise<{ status: number; error?: string; key?: string }> {
  const problem = roleProblem(b);
  if (problem) return { status: 400, error: problem };
  if (key === "admin") return { status: 403, error: "Admin always has everything and cannot be changed." };
  const roles = await rolesOf(db, by.org), name = cleanLine(b.name, 60);
  if (key && !roles.some((r) => r.key === key)) return { status: 404, error: "No such role." };
  if (!key && roles.length >= 40) return { status: 409, error: "There are already 40 roles." };
  if (roles.some((r) => r.key !== key && r.name.toLowerCase() === name.toLowerCase())) return { status: 409, error: "There is already a role with that name." };
  const k = key || `r${crypto.randomBytes(5).toString("hex")}`;
  try {
    await db.query("INSERT INTO corp_roles (org_id, key, name, pages, actions) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb) ON CONFLICT (org_id, key) DO UPDATE SET name = EXCLUDED.name, pages = EXCLUDED.pages, actions = EXCLUDED.actions, updated_at = now()", [by.org, k, name, JSON.stringify([...new Set(b.pages)]), JSON.stringify([...new Set(b.actions)])]);
  } catch (e) { if (sameName(e)) return { status: 409, error: "There is already a role with that name." }; throw e; }
  await logEvent(db, by.org, by.name, key ? "Role changed" : "Role added", `${name}: ${b.pages.length} pages, ${b.actions.length} actions`);
  return { status: 200, key: k };
}
/** A built-in role goes back to its default. An added role is deleted, unless someone still holds it. */
export async function dropRole(db: Db, by: Session, key: string): Promise<{ status: number; error?: string }> {
  const role = (await rolesOf(db, by.org)).find((r) => r.key === key);
  if (!role || key === "admin") return { status: 404, error: "No such role." };
  if (!role.builtIn) {
    // One statement, so an invite sent at the same moment cannot be left with a role that is gone.
    const r = await db.query("DELETE FROM corp_roles WHERE org_id = $1 AND key = $2 AND NOT EXISTS (SELECT 1 FROM corp_members WHERE org_id = $1 AND role = $2) AND NOT EXISTS (SELECT 1 FROM corp_invites WHERE org_id = $1 AND role = $2 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()) RETURNING key", [by.org, key]);
    if (!r.rows.length) return { status: 409, error: "Someone still has this role, or an invite for it is waiting. Change their role first." };
  } else await db.query("DELETE FROM corp_roles WHERE org_id = $1 AND key = $2", [by.org, key]);
  await logEvent(db, by.org, by.name, role.builtIn ? "Role reset" : "Role deleted", role.name);
  return { status: 200 };
}

// ---- Teams
export async function teamsOf(db: Db, org: number) {
  if (!(await accessOn(db))) return [];
  return (await db.query(`SELECT t.id, t.name, t.lead_id, l.name AS lead_name,
    COALESCE(json_agg(json_build_object('id', m.id, 'name', m.name, 'active', m.active, 'staff_code', m.staff_code) ORDER BY m.name) FILTER (WHERE m.id IS NOT NULL), '[]') AS members
    FROM corp_teams t LEFT JOIN corp_members l ON l.id = t.lead_id LEFT JOIN corp_team_members tm ON tm.team_id = t.id LEFT JOIN corp_members m ON m.id = tm.member_id
    WHERE t.org_id = $1 GROUP BY t.id, t.name, t.lead_id, l.name ORDER BY lower(t.name)`, [org])).rows;
}
const idList = (x: any): string[] | null => (Array.isArray(x) && x.length <= 500 && x.every((i) => /^\d{1,15}$/.test(String(i))) ? [...new Set(x.map(String))] : null);
/** The given teams that are this organisation's. Null when any is not. */
export async function ownTeams(db: Db, org: number, ids: any): Promise<string[] | null> {
  const list = idList(ids ?? []);
  if (!list) return null;
  if (!list.length) return [];
  if (!(await accessOn(db))) return null;
  const { rows } = await db.query("SELECT id FROM corp_teams WHERE org_id = $1 AND id = ANY($2::bigint[])", [org, list]);
  return rows.length === list.length ? list : null;
}
/** In the caller's transaction. */
export async function saveTeam(tx: Db, by: Session, id: string | null, b: any): Promise<{ status: number; error?: string; id?: string }> {
  const name = cleanLine(b?.name, 60), members = idList(b?.members), lead = b?.lead ? String(b.lead) : null;
  if (!name) return { status: 400, error: "Enter a name for the team." };
  if (!members || (lead && !members.includes(lead))) return { status: 400, error: "The lead must be one of the team." };
  if (members.length && (await tx.query("SELECT id FROM corp_members WHERE org_id = $1 AND id = ANY($2::bigint[])", [by.org, members])).rows.length !== members.length) return { status: 400, error: "Someone in the list is not in your organisation." };
  let row: any;
  try {
    row = id ? (await tx.query("UPDATE corp_teams SET name = $3, lead_id = $4 WHERE id = $1 AND org_id = $2 RETURNING id", [id, by.org, name, lead])).rows[0]
      : (await tx.query("INSERT INTO corp_teams (org_id, name, lead_id) VALUES ($1, $2, $3) RETURNING id", [by.org, name, lead])).rows[0];
  } catch (e) { if (sameName(e)) return { status: 409, error: "There is already a team with that name." }; throw e; }
  if (!row) return { status: 404, error: "No such team." };
  await tx.query("DELETE FROM corp_team_members WHERE team_id = $1", [row.id]);
  if (members.length) await tx.query("INSERT INTO corp_team_members (team_id, member_id) SELECT $1, unnest($2::bigint[])", [row.id, members]);
  await logEvent(tx, by.org, by.name, id ? "Team changed" : "Team added", `${name}: ${members.length} people`);
  return { status: 200, id: String(row.id) };
}
export async function dropTeam(db: Db, by: Session, id: string): Promise<{ status: number; error?: string }> {
  const { rows } = await db.query("DELETE FROM corp_teams WHERE id = $1 AND org_id = $2 RETURNING name", [id, by.org]);
  if (!rows.length) return { status: 404, error: "No such team." };
  await logEvent(db, by.org, by.name, "Team deleted", rows[0].name);
  return { status: 200 };
}
/** Puts a person in exactly these teams. A lead who leaves a team stops being its lead. In the caller's transaction. */
export async function setTeams(tx: Db, org: number, memberId: string, teams: string[]) {
  await tx.query("DELETE FROM corp_team_members tm USING corp_teams t WHERE tm.team_id = t.id AND t.org_id = $1 AND tm.member_id = $2 AND NOT (tm.team_id = ANY($3::bigint[]))", [org, memberId, teams]);
  await tx.query("UPDATE corp_teams SET lead_id = NULL WHERE org_id = $1 AND lead_id = $2 AND NOT (id = ANY($3::bigint[]))", [org, memberId, teams]);
  if (teams.length) await tx.query("INSERT INTO corp_team_members (team_id, member_id) SELECT id, $2 FROM corp_teams WHERE org_id = $1 AND id = ANY($3::bigint[]) ON CONFLICT DO NOTHING", [org, memberId, teams]);
}
