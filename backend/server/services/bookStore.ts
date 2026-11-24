/**
 * The advisor's own edits to their book: correcting a health policy, adding one
 * by hand, linking a renewal, merging two customers, moving a converted lead's
 * policies across, deleting a claim.
 *
 * Every query carries the agent id verified from the JWT. Nothing here calls a
 * model or spends a check. Functions take a `db`, so they are tested against a
 * fake one with two agents.
 */
import { parseIsoDate, parseRupees } from "../../../shared/policyNumbers";
import { isDataEntryType } from "./extractionFields";
import { validatePatch } from "./policyValueStore";
import type { Db, SaveResult } from "./policyValueStore";

export type RunTx = <T>(fn: (tx: Db) => Promise<T>) => Promise<T>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isId = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
const bad = (error: string, message: string, status = 400): SaveResult => ({ status, body: { error, message } });
const notFound = (what = "Policy") => bad("NOT_FOUND", `${what} not found`, 404);
const text = (v: unknown, max = 160) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const invalid = (fields: { field: string; reason: string }[]): SaveResult =>
  ({ status: 400, body: { error: "INVALID_FIELDS", message: "Some values are not in a format we can read.", fields } });

/* ── Correcting a health policy ─────────────────────────────────────────── */

export const FREQUENCIES = ["yearly", "half-yearly", "quarterly", "monthly", "single"];

type Facts = {
  insurer?: string | null;
  expiry_date?: string | null;
  sum_insured?: number | null;
  premium?: number | null;
  premium_frequency?: string | null;
};

export function readFacts(body: any): { facts: Facts; errors: { field: string; reason: string }[] } {
  const facts: Facts = {};
  const errors: { field: string; reason: string }[] = [];
  if (!body || typeof body !== "object") return { facts, errors };
  if ("insurer" in body) facts.insurer = text(body.insurer);
  if ("expiry_date" in body) {
    if (body.expiry_date === null || body.expiry_date === "") facts.expiry_date = null;
    else {
      const p = parseIsoDate(body.expiry_date);
      if (p.ok) facts.expiry_date = p.value;
      else errors.push({ field: "expiry_date", reason: "bad_date" });
    }
  }
  for (const k of ["sum_insured", "premium"] as const) {
    if (!(k in body)) continue;
    if (body[k] === null || body[k] === "") { facts[k] = null; continue; }
    const p = parseRupees(body[k]);
    if (p.ok && p.value >= 0) facts[k] = p.value;
    else errors.push({ field: k, reason: "bad_number" });
  }
  if ("premium_frequency" in body) {
    const f = text(body.premium_frequency)?.toLowerCase() ?? null;
    if (f === null || FREQUENCIES.includes(f)) facts.premium_frequency = f;
    else errors.push({ field: "premium_frequency", reason: "unknown" });
  }
  return { facts, errors };
}

/**
 * Only health: every other type has its own editable form. The columns and the
 * same facts inside the report move together, so the book and the report the
 * customer opens cannot disagree. The score is not worked out again, and the
 * old values are kept under __internal, which never leaves the server.
 */
export async function saveHealthFacts(db: Db, agentId: string, id: string, body: any, now = new Date()): Promise<SaveResult> {
  if (!isId(id)) return notFound();
  const { facts, errors } = readFacts(body);
  if (errors.length) return invalid(errors);
  if (Object.keys(facts).length === 0) return bad("NOTHING", "Nothing to save.");

  const r = await db.query(
    `SELECT status, insurance_type, report_data, extracted_data FROM clients WHERE id = $1 AND agent_id = $2`,
    [id, agentId]
  );
  const row = r.rows[0];
  if (!row) return notFound();
  if ((row.insurance_type || "health") !== "health") return bad("NOT_HEALTH", "Edit this policy from its details form.", 409);
  if (row.status === "processing" || row.status === "pending") {
    return bad("BUSY", "This policy is still being read. Try again when it is done.", 409);
  }

  let report = row.report_data;
  if (typeof report === "string") { try { report = JSON.parse(report); } catch { report = null; } }
  const extracted: Record<string, any> = { ...(row.extracted_data ?? {}) };
  let nextReport: any = null;

  if (report && typeof report === "object") {
    const was: Record<string, unknown> = {};
    nextReport = { ...report };
    const put = (group: string, key: string, value: unknown) => {
      const g = nextReport[group] && typeof nextReport[group] === "object" ? nextReport[group] : {};
      if ((g[key] ?? null) === (value ?? null)) return;
      was[`${group}.${key}`] = g[key] ?? null;
      nextReport[group] = { ...g, [key]: value };
    };
    if ("insurer" in facts) put("identity", "insurer_name", facts.insurer);
    if ("expiry_date" in facts) put("policy_timeline", "policy_expiry_date", facts.expiry_date);
    if ("sum_insured" in facts) put("coverage_structure", "base_sum_insured", facts.sum_insured);
    if ("premium" in facts) put("premium", "amount", facts.premium);
    if ("premium_frequency" in facts) put("premium", "frequency", facts.premium_frequency);
    if (Object.keys(was).length) {
      const internal = nextReport.__internal && typeof nextReport.__internal === "object" ? nextReport.__internal : {};
      const log = Array.isArray(internal.corrections) ? internal.corrections.slice(-49) : [];
      nextReport.__internal = { ...internal, corrections: [...log, { at: now.toISOString(), was }] };
      nextReport.__corrected_on = now.toISOString().slice(0, 10);
    }
  }
  if ("premium" in facts) extracted.premium = facts.premium;
  if ("premium_frequency" in facts) extracted.premium_frequency = facts.premium_frequency;

  const upd = await db.query(
    `UPDATE clients SET
       insurer     = CASE WHEN $3::boolean THEN $4::text ELSE insurer END,
       expiry_date = CASE WHEN $5::boolean THEN $6 ELSE expiry_date END,
       sum_insured = CASE WHEN $7::boolean THEN $8 ELSE sum_insured END,
       report_data = COALESCE($9, report_data),
       extracted_data = CASE WHEN $10::boolean THEN $11 ELSE extracted_data END
     WHERE id = $1 AND agent_id = $2 AND status NOT IN ('processing', 'pending')`,
    [
      id, agentId,
      "insurer" in facts, facts.insurer ?? null,
      "expiry_date" in facts, facts.expiry_date ?? null,
      "sum_insured" in facts, facts.sum_insured ?? null,
      nextReport ? JSON.stringify(nextReport) : null,
      "premium" in facts || "premium_frequency" in facts, JSON.stringify(extracted),
    ]
  );
  if ((upd.rowCount ?? 0) === 0) return bad("BUSY", "This policy is being read again. Try again when it is done.", 409);
  return { status: 200, body: { ok: true } };
}

/* ── Adding a policy by hand ────────────────────────────────────────────── */

export const ADDED_BY_HAND = "Added by hand";

/** The dates and amounts that go into typed columns must be readable there. */
function checkShared(shared: Record<string, any>) {
  const errors: { field: string; reason: string }[] = [];
  if (shared.expiry_date != null && shared.expiry_date !== "") {
    const p = parseIsoDate(shared.expiry_date);
    if (p.ok) shared.expiry_date = p.value;
    else errors.push({ field: "expiry_date", reason: "bad_date" });
  }
  if (shared.sum_insured != null && shared.sum_insured !== "") {
    const p = parseRupees(shared.sum_insured);
    if (p.ok) shared.sum_insured = p.value;
    else errors.push({ field: "sum_insured", reason: "bad_number" });
  }
  return errors;
}

export async function addManualPolicy(
  db: Db, agentId: string, body: any,
  deps: { deriveSharedColumns: (t: string, d: Record<string, any>) => Record<string, any> }
): Promise<SaveResult> {
  const type = String(body?.type ?? "");
  if (type !== "health" && !isDataEntryType(type)) return bad("UNSUPPORTED_INSURANCE_TYPE", "Pick the type of policy.");
  const holder = text(body?.policyholder_name);
  if (!holder) return bad("NAME_REQUIRED", "Enter the policyholder's name.");

  let customerId: string | null = null;
  if (body.customer_id) {
    if (!isId(body.customer_id)) return notFound("Customer");
    const own = await db.query("SELECT id FROM customers WHERE id = $1 AND agent_id = $2", [body.customer_id, agentId]);
    if (!own.rows[0]) return notFound("Customer");
    customerId = body.customer_id;
  }

  const raw = body.fields && typeof body.fields === "object" && !Array.isArray(body.fields) ? body.fields : {};
  const number = text(body.policy_number, 80);
  let data: Record<string, any>;
  let shared: Record<string, any>;
  if (type === "health") {
    const { facts, errors } = readFacts(raw);
    if (errors.length) return invalid(errors);
    data = { premium: facts.premium ?? null, premium_frequency: facts.premium_frequency ?? null };
    shared = { insurer: facts.insurer, expiry_date: facts.expiry_date, sum_insured: facts.sum_insured, policy_name: text(raw.policy_name) };
  } else {
    const v = validatePatch(type, {}, raw);
    data = { ...v.clean, policyholder_name: holder };
    if (number && !data.policy_number) data.policy_number = number;
    shared = deps.deriveSharedColumns(type, data);
    const errors = [...v.errors, ...checkShared(shared)];
    if (errors.length) return invalid(errors);
  }
  const ins = await db.query(
    `INSERT INTO clients (agent_id, status, filename, file_size, policyholder_name, client_email, client_phone,
        policy_identifier, insurance_type, extracted_data, insurer, policy_name, expiry_date, sum_insured, customer_id, created_at)
     VALUES ($1, 'done', $2, 0, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()) RETURNING id`,
    [
      agentId, ADDED_BY_HAND, holder, text(body.client_email), text(body.client_phone, 30), number, type, JSON.stringify(data),
      shared.insurer ?? null, shared.policy_name ?? null, shared.expiry_date ?? null, shared.sum_insured ?? null, customerId,
    ]
  );
  return { status: 200, body: { ok: true, id: ins.rows[0].id } };
}

/* ── Renewal link ───────────────────────────────────────────────────────── */

/** The new policy takes the old one's customer and contact where it has none. */
export async function linkRenewal(db: Db, agentId: string, newId: string, oldId: unknown): Promise<SaveResult> {
  if (!isId(newId) || !isId(oldId) || newId === oldId) return notFound();
  const r = await db.query(
    "SELECT id, customer_id, client_phone, client_email FROM clients WHERE id = ANY($1::uuid[]) AND agent_id = $2",
    [[newId, oldId], agentId]
  );
  const old = r.rows.find((x) => x.id === oldId);
  if (!old || r.rows.length !== 2) return notFound();
  await db.query(
    `UPDATE clients SET customer_id = COALESCE(customer_id, $3), client_phone = COALESCE(client_phone, $4),
        client_email = COALESCE(client_email, $5) WHERE id = $1 AND agent_id = $2`,
    [newId, agentId, old.customer_id ?? null, old.client_phone ?? null, old.client_email ?? null]
  );
  let linked = true;
  try {
    await db.query("UPDATE clients SET renewed_from = $3 WHERE id = $1 AND agent_id = $2", [newId, agentId, oldId]);
  } catch (e: any) {
    if (e?.code !== "42703") throw e; // no such column: migration 040 has not run
    linked = false;
  }
  return { status: 200, body: { ok: true, linked } };
}

/* ── Merging two customers ──────────────────────────────────────────────── */

const IDENT = /^[a-z_][a-z0-9_]*$/;

export async function mergeCustomers(runTx: RunTx, agentId: string, keepId: string, dropId: unknown): Promise<SaveResult> {
  if (!isId(keepId) || !isId(dropId) || keepId === dropId) return notFound("Customer");
  try {
    return await runTx<SaveResult>(async (tx) => {
      // Fixed order, so two merges at once cannot lock each other out.
      const own = await tx.query(
        "SELECT id FROM customers WHERE id = ANY($1::uuid[]) AND agent_id = $2 ORDER BY id FOR UPDATE",
        [[keepId, dropId], agentId]
      );
      if (own.rows.length !== 2) return notFound("Customer");
      // Asked of the database, not listed here, so a table added later is included.
      const cols = await tx.query(
        `SELECT c.relname::text AS tbl, a.attname::text AS col
           FROM pg_constraint k
           JOIN pg_class c ON c.oid = k.conrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
           JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ANY (k.conkey)
          WHERE k.contype = 'f' AND k.confrelid = 'public.customers'::regclass
          UNION
         SELECT c.table_name::text, c.column_name::text
           FROM information_schema.columns c
           JOIN information_schema.tables t
             ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
          WHERE c.table_schema = 'public' AND c.column_name = 'customer_id' AND c.data_type = 'uuid'`,
        []
      );
      const moved: Record<string, number> = {};
      for (const { tbl, col } of cols.rows) {
        if (!IDENT.test(tbl) || !IDENT.test(col)) throw new Error(`unexpected name ${tbl}.${col}`);
        const u = await tx.query(`UPDATE public.${tbl} SET ${col} = $1 WHERE ${col} = $2`, [keepId, dropId]);
        if (u.rowCount) moved[tbl] = u.rowCount;
      }
      for (const { tbl, col } of cols.rows) {
        const left = await tx.query(`SELECT count(*)::int AS n FROM public.${tbl} WHERE ${col} = $1`, [dropId]);
        if (left.rows[0]?.n) throw new Error(`rows left on ${tbl}`);
      }
      await tx.query(
        `UPDATE customers k SET phone = COALESCE(k.phone, d.phone), email = COALESCE(k.email, d.email),
            dob = COALESCE(k.dob, d.dob), city = COALESCE(k.city, d.city),
            notes = NULLIF(concat_ws(chr(10), NULLIF(k.notes, ''), NULLIF(d.notes, '')), '')
           FROM customers d WHERE k.id = $1 AND d.id = $2 AND k.agent_id = $3 AND d.agent_id = $3`,
        [keepId, dropId, agentId]
      );
      await tx.query("DELETE FROM customers WHERE id = $1 AND agent_id = $2", [dropId, agentId]);
      return { status: 200, body: { ok: true, moved } };
    });
  } catch (e: any) {
    if (e?.code === "23505") return bad("CONFLICT", "These two customers hold records that cannot be joined. Nothing was changed.", 409);
    throw e;
  }
}

/* ── A converted lead's policies ────────────────────────────────────────── */

export interface CarryFiles {
  newId(): string;
  /** Copies the stored file to the policy's own path. Null when it cannot. */
  copy(fromUrl: string, clientId: string): Promise<{ url: string; path: string } | null>;
  undo(path: string): Promise<unknown>;
  drop(fromUrl: string): Promise<unknown>;
}

const dayOf = (v: any): string | null => {
  if (!v) return null;
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  return String(v).slice(0, 10);
};

/** Moves each one to the customer, file included. Safe to call twice: a moved row has left the lead. */
export async function carryLeadPolicies(runTx: RunTx, agentId: string, leadId: string, files: CarryFiles): Promise<SaveResult> {
  if (!isId(leadId)) return notFound("Lead");
  const made: string[] = [];
  const old: string[] = [];
  try {
    const out = await runTx<SaveResult>(async (tx) => {
      const lead = (await tx.query(
        `SELECT l.id, l.phone, l.email, l.name, l.customer_id FROM agent_leads l
           JOIN customers c ON c.id = l.customer_id AND c.agent_id = l.agent_id
          WHERE l.id = $1 AND l.agent_id = $2 FOR UPDATE OF l`,
        [leadId, agentId]
      )).rows[0];
      if (!lead) return bad("NOT_CONVERTED", "Make this lead a customer first.", 409);
      const rows = (await tx.query(
        "SELECT * FROM lead_policies WHERE lead_id = $1 AND agent_id = $2 FOR UPDATE", [leadId, agentId]
      )).rows;
      for (const p of rows) {
        const type: string = p.insurance_type === "health" || isDataEntryType(p.insurance_type) ? p.insurance_type : "other";
        const life = type === "life" || type === "term";
        const due = dayOf(p.due_date);
        const data: Record<string, any> = { ...(p.extracted_data ?? {}) };
        if (p.premium != null) data.premium = Number(p.premium);
        if (p.insurer) data.insurer = p.insurer;
        if (p.policy_name) data.plan_name = p.policy_name;
        if (p.policyholder_name) data.policyholder_name = p.policyholder_name;
        if (due) {
          if (life) data.next_premium_date = due;
          else if (type === "motor" && data.od_expiry_date) data.od_expiry_date = due;
          else if (type === "travel") data.trip_end_date = due;
          else data.policy_expiry_date = due;
        }
        const id = files.newId();
        let url: string | null = null;
        if (p.file_url) {
          const c = await files.copy(p.file_url, id);
          if (!c) throw Object.assign(new Error("file"), { carry: true });
          url = c.url;
          made.push(c.path);
          old.push(p.file_url);
        }
        const cover = parseRupees(data.sum_insured ?? data.sum_assured ?? data.idv ?? "");
        const lifeEnd = parseIsoDate(data.maturity_date ?? data.cover_end_date ?? "");
        await tx.query(
          `INSERT INTO clients (id, agent_id, status, filename, file_size, policyholder_name, client_email, client_phone, insurance_type,
              extracted_data, insurer, policy_name, expiry_date, sum_insured, customer_id, agent_notes, pdf_url, created_at)
           VALUES ($1, $2, 'done', $3, 0, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())`,
          [
            id, agentId, p.file_name || ADDED_BY_HAND, p.policyholder_name || lead.name, lead.email ?? null, lead.phone ?? null, type,
            JSON.stringify(data), p.insurer ?? null, p.policy_name ?? null,
            life ? (lifeEnd.ok ? lifeEnd.value : null) : due, cover.ok ? cover.value : null,
            lead.customer_id, p.notes ?? null, url,
          ]
        );
        await tx.query("DELETE FROM lead_policies WHERE id = $1 AND agent_id = $2", [p.id, agentId]);
      }
      return { status: 200, body: { ok: true, moved: rows.length } };
    });
    for (const u of old) await Promise.resolve(files.drop(u)).catch(() => {});
    return out;
  } catch (e: any) {
    for (const m of made) await Promise.resolve(files.undo(m)).catch(() => {});
    if (e?.carry) return bad("FILE", "A policy file could not be moved. The policies are still on the lead.", 502);
    throw e;
  }
}

/* ── Deleting a claim ───────────────────────────────────────────────────── */

/** Files first. If they cannot be removed the claim stays, so nothing is orphaned unseen. */
export async function deleteClaim(
  db: Db, agentId: string, id: string, removeFiles: (paths: string[]) => Promise<boolean>
): Promise<SaveResult> {
  if (!isId(id)) return notFound("Claim");
  const own = await db.query("SELECT id FROM claims WHERE id = $1 AND agent_id = $2", [id, agentId]);
  if (!own.rows[0]) return notFound("Claim");
  const docs = await db.query("SELECT storage_path FROM claim_documents WHERE claim_id = $1", [id]);
  const paths = docs.rows.map((r) => r.storage_path).filter((p) => typeof p === "string" && p.startsWith(`${agentId}/`));
  if (paths.length && !(await removeFiles(paths))) {
    return bad("FILES", "The documents could not be deleted, so the claim was kept. Try again.", 502);
  }
  await db.query("DELETE FROM claims WHERE id = $1 AND agent_id = $2", [id, agentId]);
  return { status: 200, body: { ok: true, filesRemoved: paths.length } };
}
