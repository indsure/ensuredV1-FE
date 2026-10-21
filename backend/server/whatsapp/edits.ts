// ============================================================================
// WhatsApp stage 2: edits from the chat. Plan: docs/plans/2026-10-21-wa-stage2-edits.md
//
// Every limit that protects data is enforced HERE, not in the bot:
//   - each route is scoped to the linked advisor (scopedAgent);
//   - only whitelisted fields, and only the ones present in the request, are written;
//   - every update re-checks, in the same SQL statement, the values the advisor saw
//     (`expect`), and answers 409 CHANGED if anything moved in the meantime;
//   - nothing is ever deleted, except "undo" of a lead or customer the bot itself created
//     in the last 15 minutes with nothing added to it since (founder decision, plan 8);
//   - every write leaves an access_audit_log row marked user_agent = 'whatsapp-bot'.
// The value rules mirror the portal (lib/leads.ts, lib/customers.ts cleanDraft); the pure
// functions below are unit-tested in tests/whatsappEdits.test.ts.
// ============================================================================

import type { Express } from "express";

type Db = { query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount?: number | null }>; connect?: () => Promise<any> };
type Deps = {
  pool: Db & { connect(): Promise<any> };
  log: { error(msg: string, meta?: any): void; warn(msg: string, meta?: any): void };
  scopedAgent: (req: any, res: any) => Promise<string | null>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const LEAD_STATUSES = ["new", "contacted", "interested", "won", "lost"];
/** The portal's interest chips (lib/leads.ts), stored as "Health, Motor" in one text column. */
export const INTERESTS = ["Health", "Motor", "Life", "Term", "Travel", "Property"];
export const LEAD_SOURCES = ["Referral", "WhatsApp", "Phone call", "Walk-in", "Website", "Social media", "Other"];

/* ── Value rules (pure) ─────────────────────────────────────────────────── */

const text = (v: unknown, max: number): string | null => {
  const t = String(v ?? "").trim();
  return t === "" ? null : t.slice(0, max);
};

/** An Indian mobile as its last 10 digits, or an error. Empty clears it. */
function phone(v: unknown): { ok: true; value: string | null } | { ok: false } {
  if (v === null || String(v).trim() === "") return { ok: true, value: null };
  const d = String(v).replace(/\D/g, "");
  const last = d.slice(-10);
  if (d.length > 12 || !/^[6-9]\d{9}$/.test(last)) return { ok: false };
  return { ok: true, value: last };
}

function email(v: unknown): { ok: true; value: string | null } | { ok: false } {
  const t = text(v, 200);
  if (t === null) return { ok: true, value: null };
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? { ok: true, value: t.toLowerCase() } : { ok: false };
}

function isoDate(v: unknown): { ok: true; value: string | null } | { ok: false } {
  if (v === null || String(v).trim() === "") return { ok: true, value: null };
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(new Date(s + "T00:00:00Z").getTime())) return { ok: false };
  return { ok: true, value: s };
}

/** "health, motor" / ["Motor","Health"] -> "Health, Motor" in the portal's chip order. */
export function cleanInterests(v: unknown): string | null {
  const parts = (Array.isArray(v) ? v : String(v ?? "").split(/[,/&+]|\band\b|\baur\b/i))
    .map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  const picked = INTERESTS.filter((i) => parts.includes(i.toLowerCase()));
  return picked.length ? picked.join(", ") : null;
}

/** lib/leads.ts num(): digits and a dot only; "25,000" -> 25000. */
export function money(v: unknown): { ok: true; value: number | null } | { ok: false } {
  if (v === null || v === undefined || String(v).trim() === "") return { ok: true, value: null };
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n >= 0 && n < 1e10 ? { ok: true, value: n } : { ok: false };
}

export type FieldErrors = Record<string, string>;
export type Clean = { set: Record<string, unknown>; errors: FieldErrors };

/** Lead fields the bot may change, cleaned the portal's way. Only keys present are kept. */
export function cleanLeadSet(raw: Record<string, unknown>): Clean {
  const set: Record<string, unknown> = {};
  const errors: FieldErrors = {};
  for (const [k, v] of Object.entries(raw || {})) {
    switch (k) {
      case "name": { const t = text(v, 120); if (!t || t.length < 2) errors.name = "a name is needed"; else set.name = t; break; }
      case "phone": { const p = phone(v); if (!p.ok) errors.phone = "not a 10 digit mobile number"; else set.phone = p.value; break; }
      case "email": { const e = email(v); if (!e.ok) errors.email = "not an email address"; else set.email = e.value; break; }
      case "city": set.city = text(v, 80); break;
      case "source": {
        const t = text(v, 40);
        set.source = t === null ? null : LEAD_SOURCES.find((s) => s.toLowerCase() === t.toLowerCase()) ?? t;
        break;
      }
      case "insurance_interest": {
        const i = cleanInterests(v);
        if (v !== null && String(v).trim() !== "" && !i) errors.insurance_interest = "pick from Health, Motor, Life, Term, Travel, Property";
        else set.insurance_interest = i;
        break;
      }
      case "expected_value": { const m = money(v); if (!m.ok) errors.expected_value = "not an amount"; else set.expected_value = m.value; break; }
      case "status": if (LEAD_STATUSES.includes(String(v))) set.status = v; else errors.status = "unknown status"; break;
      case "next_follow_up": { const d = isoDate(v); if (!d.ok) errors.next_follow_up = "not a date"; else set.next_follow_up = d.value; break; }
      default: errors[k] = "cannot be changed from WhatsApp";
    }
  }
  return { set, errors };
}

/** Customer fields the bot may change (lib/customers.ts cleanDraft, minus notes). */
export function cleanCustomerSet(raw: Record<string, unknown>): Clean {
  const set: Record<string, unknown> = {};
  const errors: FieldErrors = {};
  for (const [k, v] of Object.entries(raw || {})) {
    switch (k) {
      case "name": { const t = text(v, 120); if (!t || t.length < 2) errors.name = "a name is needed"; else set.name = t; break; }
      case "phone": { const p = phone(v); if (!p.ok) errors.phone = "not a 10 digit mobile number"; else set.phone = p.value; break; }
      case "email": { const e = email(v); if (!e.ok) errors.email = "not an email address"; else set.email = e.value; break; }
      case "city": set.city = text(v, 80); break;
      case "dob": { const d = isoDate(v); if (!d.ok) errors.dob = "not a date"; else set.dob = d.value; break; }
      default: errors[k] = "cannot be changed from WhatsApp";
    }
  }
  return { set, errors };
}

/** Normalise a stored or expected value for comparison (dates to YYYY-MM-DD, numbers to text). */
export function norm(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return String(v);
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? s.slice(0, 10) : s;
}

/**
 * UPDATE that writes only `set`, and only if every column in `expect` still holds the
 * expected value (compared as text, null-safe). Column names come from the whitelist
 * above, never from the request, so they are safe to interpolate.
 */
export function guardedUpdate(table: string, cols: string[], set: Record<string, unknown>, expect: Record<string, unknown>, extraSet = "") {
  const params: unknown[] = [];
  const p = (v: unknown) => { params.push(v); return `$${params.length + 2}`; }; // $1 id, $2 agent
  const sets = Object.entries(set).map(([k, v]) => `${k} = ${p(v)}`);
  const checks = Object.entries(expect).map(([k, v]) => `${k}::text IS NOT DISTINCT FROM ${p(norm(v))}::text`);
  for (const k of [...Object.keys(set), ...Object.keys(expect)]) if (!cols.includes(k)) throw new Error(`column ${k} not allowed`);
  const sql = `UPDATE ${table} SET ${[...sets, extraSet].filter(Boolean).join(", ")}
     WHERE id = $1 AND agent_id = $2${checks.length ? " AND " + checks.join(" AND ") : ""}
     RETURNING *`;
  return { sql, params };
}

/* ── Routes ─────────────────────────────────────────────────────────────── */

const LEAD_EDIT_COLS = ["name", "phone", "email", "city", "source", "insurance_interest", "expected_value", "status", "next_follow_up", "customer_id"];
const CUSTOMER_EDIT_COLS = ["name", "phone", "email", "city", "dob"];
const LEAD_OUT = "id, name, phone, email, city, source, insurance_interest, expected_value, status, next_follow_up, notes, customer_id, created_at, updated_at";
const CUSTOMER_OUT = "id, name, phone, email, city, dob, created_at";

export function registerWaEdits(app: Express, { pool, log, scopedAgent }: Deps) {
  const audit = (agentId: string, targetId: string | null, action: string, route: string) =>
    pool.query(
      `INSERT INTO access_audit_log (agent_id, client_id, action, route, method, ip, user_agent)
       VALUES ($1, $2, $3, $4, 'POST', NULL, 'whatsapp-bot')`,
      [agentId, targetId, action, route]
    ).catch((e: any) => log.warn("wa edit audit failed", { error: e?.message }));

  const fail = (res: any, where: string, err: any) => {
    log.error(`wa ${where} failed`, { error: err?.message });
    res.status(500).json({ error: "Internal server error" });
  };
  const bad = (res: any, errors: FieldErrors) => res.status(400).json({ error: "INVALID", fields: errors });
  const changed = (res: any) => res.status(409).json({ error: "CHANGED" });

  /** One lead with every field the bot may show or change. */
  app.get("/api/internal/wa/leads/:id", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
      const r = await pool.query(`SELECT ${LEAD_OUT} FROM agent_leads WHERE id = $1 AND agent_id = $2`, [req.params.id, agentId]);
      if (!r.rows.length) return res.status(404).json({ error: "Not found" });
      res.json({ lead: r.rows[0] });
    } catch (err) { fail(res, "lead read", err); }
  });

  /** Change a lead's details. Body: { set, expect }. */
  app.post("/api/internal/wa/leads/:id/edit", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
      const { set, errors } = cleanLeadSet(req.body?.set || {});
      if (Object.keys(errors).length) return bad(res, errors);
      if (!Object.keys(set).length) return bad(res, { set: "nothing to change" });
      const expect = req.body?.expect && typeof req.body.expect === "object" ? req.body.expect : {};
      const known = Object.fromEntries(Object.entries(expect).filter(([k]) => LEAD_EDIT_COLS.includes(k)));
      const before = await pool.query(`SELECT ${LEAD_OUT} FROM agent_leads WHERE id = $1 AND agent_id = $2`, [req.params.id, agentId]);
      if (!before.rows.length) return res.status(404).json({ error: "Not found" });
      const q = guardedUpdate("agent_leads", LEAD_EDIT_COLS, set, known, "updated_at = now()");
      const r = await pool.query(q.sql, [req.params.id, agentId, ...q.params]);
      if (!r.rowCount) return changed(res);
      void audit(agentId, req.params.id, "wa_lead_edit", "/api/internal/wa/leads/:id/edit");
      res.json({ lead: pick(r.rows[0], LEAD_OUT), before: pick(before.rows[0], LEAD_OUT) });
    } catch (err) { fail(res, "lead edit", err); }
  });

  /** Lead -> customer (lib/leads.ts convertLeadToCustomer), in one transaction. */
  app.post("/api/internal/wa/leads/:id/convert", async (req, res) => {
    const agentId = await scopedAgent(req, res);
    if (!agentId) return;
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const l = await c.query(`SELECT ${LEAD_OUT}, notes FROM agent_leads WHERE id = $1 AND agent_id = $2 FOR UPDATE`, [req.params.id, agentId]);
      if (!l.rows.length) { await c.query("ROLLBACK"); return res.status(404).json({ error: "Not found" }); }
      const lead = l.rows[0];
      if (lead.customer_id) { await c.query("ROLLBACK"); return res.status(409).json({ error: "ALREADY_CUSTOMER", customerId: lead.customer_id }); }
      const cu = await c.query(
        `INSERT INTO customers (agent_id, name, phone, email, city, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${CUSTOMER_OUT}`,
        [agentId, lead.name, lead.phone, lead.email, lead.city, lead.notes]
      );
      await c.query(
        `UPDATE agent_leads SET customer_id = $3, status = 'won', updated_at = now() WHERE id = $1 AND agent_id = $2`,
        [req.params.id, agentId, cu.rows[0].id]
      );
      await c.query("COMMIT");
      void audit(agentId, req.params.id, "wa_lead_convert", "/api/internal/wa/leads/:id/convert");
      res.json({ customer: cu.rows[0], before: { status: lead.status, customer_id: null } });
    } catch (err) {
      await c.query("ROLLBACK").catch(() => {});
      fail(res, "lead convert", err);
    } finally { c.release(); }
  });

  /** Undo a convert: unlink, status back, and remove the customer it made if it is still
   *  empty and fresh (plan 8). Body: { customerId, status }. */
  app.post("/api/internal/wa/leads/:id/unconvert", async (req, res) => {
    const agentId = await scopedAgent(req, res);
    if (!agentId) return;
    const customerId = String(req.body?.customerId || "");
    const status = String(req.body?.status || "");
    if (!UUID.test(req.params.id) || !UUID.test(customerId) || !LEAD_STATUSES.includes(status)) return bad(res, { body: "customerId and status" });
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const u = await c.query(
        `UPDATE agent_leads SET customer_id = NULL, status = $4, updated_at = now()
          WHERE id = $1 AND agent_id = $2 AND customer_id = $3 AND status = 'won' RETURNING id`,
        [req.params.id, agentId, customerId, status]
      );
      if (!u.rowCount) { await c.query("ROLLBACK"); return changed(res); }
      const removed = await c.query(freshEmptyCustomerDelete(), [customerId, agentId]);
      await c.query("COMMIT");
      void audit(agentId, req.params.id, "wa_lead_unconvert", "/api/internal/wa/leads/:id/unconvert");
      res.json({ ok: true, customerRemoved: !!removed.rowCount });
    } catch (err) {
      await c.query("ROLLBACK").catch(() => {});
      fail(res, "lead unconvert", err);
    } finally { c.release(); }
  });

  /** One customer with every field the bot may show or change. */
  app.get("/api/internal/wa/customers/:id", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
      const r = await pool.query(`SELECT ${CUSTOMER_OUT} FROM customers WHERE id = $1 AND agent_id = $2`, [req.params.id, agentId]);
      if (!r.rows.length) return res.status(404).json({ error: "Not found" });
      res.json({ customer: r.rows[0] });
    } catch (err) { fail(res, "customer read", err); }
  });

  /** Add a customer. Same phone already on a customer: that one is returned, not doubled. */
  app.post("/api/internal/wa/customers", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const { set, errors } = cleanCustomerSet(req.body || {});
      if (!set.name) errors.name = errors.name || "a name is needed";
      if (Object.keys(errors).length) return bad(res, errors);
      if (set.phone) {
        const dup = await pool.query(
          `SELECT ${CUSTOMER_OUT} FROM customers
            WHERE agent_id = $1 AND right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10) = $2 LIMIT 1`,
          [agentId, set.phone]
        );
        if (dup.rows.length) return res.json({ customer: dup.rows[0], duplicate: true });
      }
      const r = await pool.query(
        `INSERT INTO customers (agent_id, name, phone, email, city, dob) VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${CUSTOMER_OUT}`,
        [agentId, set.name, set.phone ?? null, set.email ?? null, set.city ?? null, set.dob ?? null]
      );
      void audit(agentId, r.rows[0].id, "wa_customer_create", "/api/internal/wa/customers");
      res.json({ customer: r.rows[0], duplicate: false });
    } catch (err) { fail(res, "customer create", err); }
  });

  /** Change a customer's details. Body: { set, expect }. */
  app.post("/api/internal/wa/customers/:id/edit", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
      const { set, errors } = cleanCustomerSet(req.body?.set || {});
      if (Object.keys(errors).length) return bad(res, errors);
      if (!Object.keys(set).length) return bad(res, { set: "nothing to change" });
      const expect = req.body?.expect && typeof req.body.expect === "object" ? req.body.expect : {};
      const known = Object.fromEntries(Object.entries(expect).filter(([k]) => CUSTOMER_EDIT_COLS.includes(k)));
      const before = await pool.query(`SELECT ${CUSTOMER_OUT} FROM customers WHERE id = $1 AND agent_id = $2`, [req.params.id, agentId]);
      if (!before.rows.length) return res.status(404).json({ error: "Not found" });
      const q = guardedUpdate("customers", CUSTOMER_EDIT_COLS, set, known);
      const r = await pool.query(q.sql, [req.params.id, agentId, ...q.params]);
      if (!r.rowCount) return changed(res);
      void audit(agentId, req.params.id, "wa_customer_edit", "/api/internal/wa/customers/:id/edit");
      res.json({ customer: pick(r.rows[0], CUSTOMER_OUT), before: pick(before.rows[0], CUSTOMER_OUT) });
    } catch (err) { fail(res, "customer edit", err); }
  });

  /** Undo a customer this chat just created: only if fresh and nothing refers to it (plan 8). */
  app.post("/api/internal/wa/customers/:id/undo-create", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
      const r = await pool.query(freshEmptyCustomerDelete(), [req.params.id, agentId]);
      if (!r.rowCount) return res.status(409).json({ error: "NOT_REMOVABLE" });
      void audit(agentId, req.params.id, "wa_customer_undo_create", "/api/internal/wa/customers/:id/undo-create");
      res.json({ ok: true });
    } catch (err) { fail(res, "customer undo-create", err); }
  });

  /** File a policy under a customer, or unfile it (customerId null). Body: { customerId, expectCustomerId }.
   *  Compare-before on the policy's current customer, so a portal change in between is never overwritten. */
  app.post("/api/internal/wa/clients/:id/file", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const to = req.body?.customerId ?? null;
      const from = req.body?.expectCustomerId ?? null;
      if (!UUID.test(req.params.id) || (to !== null && !UUID.test(String(to))) || (from !== null && !UUID.test(String(from)))) {
        return bad(res, { body: "ids" });
      }
      if (to !== null) {
        const own = await pool.query("SELECT 1 FROM customers WHERE id = $1 AND agent_id = $2", [to, agentId]);
        if (!own.rows.length) return res.status(404).json({ error: "Customer not found" });
      }
      const r = await pool.query(
        `UPDATE clients SET customer_id = $3
          WHERE id = $1 AND agent_id = $2 AND customer_id IS NOT DISTINCT FROM $4::uuid
          RETURNING id, customer_id`,
        [req.params.id, agentId, to, from]
      );
      if (!r.rowCount) return changed(res);
      void audit(agentId, req.params.id, to ? "wa_policy_file" : "wa_policy_unfile", "/api/internal/wa/clients/:id/file");
      res.json({ ok: true, customerId: r.rows[0].customer_id });
    } catch (err) { fail(res, "policy file", err); }
  });
}

/** Remove a customer only if created in the last 15 minutes and nothing refers to it:
 *  no policy, claim, lead, calculator or comparison (all of which would be silently unfiled
 *  by the foreign keys' ON DELETE SET NULL). $1 customer id, $2 agent id. */
export function freshEmptyCustomerDelete(): string {
  return `DELETE FROM customers c
           WHERE c.id = $1 AND c.agent_id = $2 AND c.created_at > now() - interval '15 minutes'
             AND NOT EXISTS (SELECT 1 FROM clients x WHERE x.customer_id = c.id)
             AND NOT EXISTS (SELECT 1 FROM claims x WHERE x.customer_id = c.id)
             AND NOT EXISTS (SELECT 1 FROM agent_leads x WHERE x.customer_id = c.id)
             AND NOT EXISTS (SELECT 1 FROM calculator_reports x WHERE x.customer_id = c.id)
             AND NOT EXISTS (SELECT 1 FROM comparison_reports x WHERE x.customer_id = c.id)
           RETURNING c.id`;
}

/** The SQL for removing a lead the bot just added: fresh, never changed since, no lead policies
 *  (they would cascade). $1 lead id, $2 agent id. */
export function freshUntouchedLeadDelete(): string {
  return `DELETE FROM agent_leads l
           WHERE l.id = $1 AND l.agent_id = $2 AND l.created_at > now() - interval '15 minutes'
             AND l.updated_at <= l.created_at + interval '2 seconds'
             AND l.customer_id IS NULL
             AND NOT EXISTS (SELECT 1 FROM lead_policies x WHERE x.lead_id = l.id)
           RETURNING l.id`;
}

function pick(row: any, cols: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of cols.split(",").map((s) => s.trim())) out[c] = row?.[c] instanceof Date ? norm(row[c]) : row?.[c] ?? null;
  return out;
}
