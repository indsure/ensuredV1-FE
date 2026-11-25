// IndSure Commercial: the owner's log. Sign-ins and changes to users are written where they happen; changes to the
// records are written here on every save, from the history lines the save adds, under the signed-in person's name.
// All of it sits in corp_auth_events (migration 041). A record line's event starts "Record: " and its detail is JSON:
// { d: what happened, p: policy id, c: customer id }.
import type { Db, Session } from "./corpAuth";

const REC = "Record: ";
const PER_SAVE = 300;
const PAGE = 100;
const SIGN_INS = ["Signed in", "Sign-in failed", "Sign-in refused", "Owner signed in", "Owner sign-in failed", "Owner sign-in refused"];
type Line = { id?: any; at?: any; who?: any; uid?: any; action?: any; detail?: any; policyId?: any; customerId?: any };

const keyOf = (x: Line) => `${x?.id}|${x?.at}`;
const text = (x: any, n: number) => String(x ?? "").replace(/[\r\n\t]+/g, " ").slice(0, n);
const detailOf = (x: Line) => JSON.stringify({ d: text(x.detail, 500), ...(x.policyId ? { p: text(x.policyId, 64) } : {}), ...(x.customerId ? { c: text(x.customerId, 64) } : {}) });
// History lines carry India time without a zone.
function when(at: any): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)/.exec(String(at || ""));
  const t = m ? new Date(`${m[1]}T${m[2]}+05:30`) : null;
  return t && !isNaN(+t) && +t < Date.now() + 86400000 ? t.toISOString() : null;
}
async function insert(tx: Db, org: number, rows: { m: string | null; who: string; event: string; detail: string; at: string }[]) {
  if (!rows.length) return;
  await tx.query("INSERT INTO corp_auth_events (org_id, member_id, who, event, detail, at) SELECT $1, x.m, x.who, x.event, x.detail, x.at FROM unnest($2::bigint[], $3::text[], $4::text[], $5::text[], $6::timestamptz[]) AS x(m, who, event, detail, at)",
    [org, rows.map((r) => r.m), rows.map((r) => r.who), rows.map((r) => r.event), rows.map((r) => r.detail), rows.map((r) => r.at)]);
}

/** Once per organisation: the history already in its records becomes the start of its log. Caller's transaction. */
export async function backfill(tx: Db, org: number, audit?: Line[]) {
  if ((await tx.query("SELECT 1 FROM corp_auth_events WHERE org_id = $1 AND event LIKE 'Record: %' LIMIT 1", [org])).rows.length) return;
  if (!audit) {
    const { rows } = await tx.query("SELECT data->'audit' AS audit FROM corp_book WHERE id = $1 FOR UPDATE", [org]);
    if ((await tx.query("SELECT 1 FROM corp_auth_events WHERE org_id = $1 AND event LIKE 'Record: %' LIMIT 1", [org])).rows.length) return;
    audit = rows[0]?.audit || [];
  }
  if (!Array.isArray(audit) || !audit.length) return;
  const members = new Set((await tx.query("SELECT id FROM corp_members WHERE org_id = $1", [org])).rows.map((r: any) => String(r.id)));
  await insert(tx, org, audit.slice(-20000).filter((x) => when(x?.at)).map((x) => ({ m: members.has(String(x.uid)) ? String(x.uid) : null, who: text(x.who, 120) || "Not known", event: REC + text(x.action, 80), detail: detailOf(x), at: when(x.at)! })));
}

/** The history lines a save adds. Caller's transaction, which holds the book's row. */
export async function recordSave(tx: Db, org: number, by: Session, before: Line[], after: Line[]) {
  await backfill(tx, org, Array.isArray(before) ? before : []);
  const old = new Set((Array.isArray(before) ? before : []).map(keyOf)), now = new Set(after.map(keyOf));
  const added = after.filter((x) => !old.has(keyOf(x)) && x?.who !== "System");
  const gone = [...old].filter((k) => !now.has(k)).length;
  const at = new Date().toISOString(), m = by.kind === "member" ? by.uid : null;
  const line = (action: string, detail: string) => ({ m, who: by.name.slice(0, 120), event: REC + action, detail, at });
  const rows = added.slice(0, PER_SAVE).map((x) => line(text(x.action, 80) || "Changed", detailOf(x)));
  if (added.length > PER_SAVE) rows.push(line("More changes", detailOf({ detail: `${added.length - PER_SAVE} more changes in the same save.` })));
  if (gone) rows.push(line("Earlier records put back", detailOf({ detail: `An earlier save or a backup replaced the records. ${gone === 1 ? "1 history line is" : `${gone} history lines are`} no longer in them.` })));
  await insert(tx, org, rows);
}

/** One page, newest first. Times and days are India's. */
export async function read(db: Db, org: number, q: any) {
  const a: any[] = [org], where = ["e.org_id = $1"], add = (sql: string, v: any) => { a.push(v); where.push(sql.replace(/\?/g, `$${a.length}`)); };
  const person = String(q.person || "");
  if (/^m:\d{1,15}$/.test(person)) add("(e.member_id = ? AND e.event NOT IN ('Login changed', 'New PIN link sent'))", person.slice(2));
  else if (person.startsWith("n:")) add("(e.who = ? AND (e.member_id IS NULL OR e.event IN ('Login changed', 'New PIN link sent')))", person.slice(2, 130));
  if (q.kind === "records") where.push("e.event LIKE 'Record: %'");
  else if (q.kind === "signins") add("e.event = ANY(?::text[])", SIGN_INS);
  else if (q.kind === "users") { where.push("e.event NOT LIKE 'Record: %'"); add("NOT (e.event = ANY(?::text[]))", SIGN_INS); }
  const day = (x: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(x)) && !isNaN(Date.parse(String(x))) ? String(x) : null);
  if (day(q.from)) add("e.at >= (?::date)::timestamp AT TIME ZONE 'Asia/Kolkata'", day(q.from));
  if (day(q.to)) add("e.at < (?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'", day(q.to));
  const s = String(q.q || "").trim().slice(0, 80);
  if (s) add("(e.who || ' ' || e.event || ' ' || e.detail) ILIKE ?", `%${s.replace(/[\\%_]/g, "\\$&")}%`);
  const c = /^(\d{4}-[\dT:.Z-]+)_(\d{1,15})$/.exec(String(q.after || ""));
  if (c && !isNaN(Date.parse(c[1]))) { a.push(c[1], c[2]); where.push(`(date_trunc('milliseconds', e.at), e.id) < ($${a.length - 1}::timestamptz, $${a.length}::bigint)`); }
  const { rows } = await db.query(`SELECT e.id, e.at, e.member_id, e.who, e.event, e.detail FROM corp_auth_events e WHERE ${where.join(" AND ")} ORDER BY date_trunc('milliseconds', e.at) DESC, e.id DESC LIMIT ${PAGE + 1}`, a);
  const page = rows.slice(0, PAGE), last = page[page.length - 1];
  const people = (await db.query("SELECT id, name FROM corp_members WHERE org_id = $1 ORDER BY name", [org])).rows.map((r: any) => ({ key: `m:${r.id}`, name: r.name }));
  const others = (await db.query("SELECT DISTINCT who FROM corp_auth_events WHERE org_id = $1 AND member_id IS NULL ORDER BY who LIMIT 100", [org])).rows.map((r: any) => ({ key: `n:${r.who}`, name: r.who }));
  return {
    rows: page.map((r: any) => {
      const rec = r.event.startsWith(REC);
      let x: any = {}; if (rec) { try { x = JSON.parse(r.detail); } catch { x = { d: r.detail }; } }
      return { id: String(r.id), at: r.at, who: r.who, kind: rec ? "records" : SIGN_INS.includes(r.event) ? "signins" : "users", what: rec ? r.event.slice(REC.length) : r.event, detail: rec ? x.d || "" : r.detail, policyId: x.p || null, customerId: x.c || null };
    }),
    next: rows.length > PAGE ? `${new Date(last.at).toISOString()}_${last.id}` : null,
    people: [...people, ...others],
  };
}
