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

/** The two Express methods used here (kept local so the bot, which has no express, can import the pure rules). */
type App = { get(path: string, h: (req: any, res: any) => unknown): unknown; post(path: string, h: (req: any, res: any) => unknown): unknown };

type Db = { query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount?: number | null }>; connect?: () => Promise<any> };
type Deps = {
  pool: Db & { connect(): Promise<any> };
  log: { error(msg: string, meta?: any): void; warn(msg: string, meta?: any): void };
  scopedAgent: (req: any, res: any) => Promise<string | null>;
};

import crypto from "crypto";

/**
 * UNDO may only put back a value the server itself saw before an edit. Each saved edit returns
 * a token signed with the bot key over (table, id, before, after); a restore must bring the
 * matching token. So the restore path, which skips today's format rules, can never be used to
 * write arbitrary text.
 */
export function undoToken(table: string, id: string, before: Record<string, unknown>, after: Record<string, unknown>): string {
  const keys = Object.keys(before).sort();
  const payload = JSON.stringify([table, id, keys.map((k) => [k, norm(before[k])]), keys.map((k) => [k, norm(after[k])])]);
  return crypto.createHmac("sha256", process.env.WA_BOT_KEY || "").update(payload).digest("hex");
}
function tokenOk(given: unknown, want: string): boolean {
  const a = Buffer.from(String(given || "")); const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import { LEAD_STATUSES, INTERESTS, LEAD_SOURCES, cleanInterests, money, cleanLeadSet, cleanCustomerSet, norm, guardedUpdate, restoreSet, missingExpect, POLICY_FIX_FIELDS, cleanFixValue, CLIENT_DETAIL_COLS, cleanClientSet } from "./editRules";
import { saveExtractedData } from "../services/policyValueStore";
import { deriveSharedColumns } from "../services/extractionFields";
import { scoreFromExtractedData } from "../../../shared/motorScore";
import type { FieldErrors, Clean } from "./editRules";
export { LEAD_STATUSES, INTERESTS, LEAD_SOURCES, cleanInterests, money, cleanLeadSet, cleanCustomerSet, norm, guardedUpdate } from "./editRules";
export type { FieldErrors, Clean } from "./editRules";

/* ── Routes ─────────────────────────────────────────────────────────────── */

const LEAD_EDIT_COLS = ["name", "phone", "email", "city", "source", "insurance_interest", "expected_value", "status", "next_follow_up", "customer_id"];
const CUSTOMER_EDIT_COLS = ["name", "phone", "email", "city", "dob"];
// Dates as text: a JS Date would shift by the server timezone and break compare-before.
const LEAD_OUT = "id, name, phone, email, city, source, insurance_interest, expected_value, status, next_follow_up::text AS next_follow_up, notes, customer_id, created_at, updated_at";
const CUSTOMER_OUT = "id, name, phone, email, city, dob::text AS dob, notes, created_at";

export function registerWaEdits(app: App, { pool, log, scopedAgent }: Deps) {
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
      const { set, errors } = req.body?.restore === true ? restoreSet(req.body?.set || {}, LEAD_EDIT_COLS.filter((c) => c !== "customer_id")) : cleanLeadSet(req.body?.set || {});
      if (Object.keys(errors).length) return bad(res, errors);
      if (!Object.keys(set).length) return bad(res, { set: "nothing to change" });
      const expect = req.body?.expect && typeof req.body.expect === "object" ? req.body.expect : {};
      const known = Object.fromEntries(Object.entries(expect).filter(([k]) => LEAD_EDIT_COLS.includes(k)));
      const missing = missingExpect(set, known);
      if (missing.length) return bad(res, Object.fromEntries(missing.map((k) => [k, "the value seen before is required"])));
      if (req.body?.restore === true && !tokenOk(req.body?.token, undoToken("agent_leads", req.params.id, set, known))) return bad(res, { token: "undo is only for a change saved here" });
      const before = await pool.query(`SELECT ${LEAD_OUT} FROM agent_leads WHERE id = $1 AND agent_id = $2`, [req.params.id, agentId]);
      if (!before.rows.length) return res.status(404).json({ error: "Not found" });
      const q = guardedUpdate("agent_leads", LEAD_EDIT_COLS, set, known, "updated_at = now()");
      const r = await pool.query(q.sql, [req.params.id, agentId, ...q.params]);
      if (!r.rowCount) return changed(res);
      void audit(agentId, req.params.id, "wa_lead_edit", "/api/internal/wa/leads/:id/edit");
      const b0 = pick(before.rows[0], LEAD_OUT), a0 = pick(r.rows[0], LEAD_OUT);
      const keys = Object.keys(set);
      const token = undoToken("agent_leads", req.params.id, Object.fromEntries(keys.map((k) => [k, b0[k]])), Object.fromEntries(keys.map((k) => [k, a0[k]])));
      res.json({ lead: a0, before: b0, undoToken: token });
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
          WHERE id = $1 AND agent_id = $2 AND customer_id = $3 AND status = 'won'
          RETURNING name, phone, email, city, notes`,
        [req.params.id, agentId, customerId, status]
      );
      if (!u.rowCount) { await c.query("ROLLBACK"); return changed(res); }
      // The customer the convert made holds the lead's values and no date of birth; any other
      // value means it was edited in the portal since, and it stays.
      const l = u.rows[0];
      const removed = await c.query(freshEmptyCustomerDelete(true), [customerId, agentId, l.name, l.phone, l.email, l.city, null, l.notes]);
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
      const { set, errors } = req.body?.restore === true ? restoreSet(req.body?.set || {}, CUSTOMER_EDIT_COLS) : cleanCustomerSet(req.body?.set || {});
      if (Object.keys(errors).length) return bad(res, errors);
      if (!Object.keys(set).length) return bad(res, { set: "nothing to change" });
      const expect = req.body?.expect && typeof req.body.expect === "object" ? req.body.expect : {};
      const known = Object.fromEntries(Object.entries(expect).filter(([k]) => CUSTOMER_EDIT_COLS.includes(k)));
      const missing = missingExpect(set, known);
      if (missing.length) return bad(res, Object.fromEntries(missing.map((k) => [k, "the value seen before is required"])));
      if (req.body?.restore === true && !tokenOk(req.body?.token, undoToken("customers", req.params.id, set, known))) return bad(res, { token: "undo is only for a change saved here" });
      const before = await pool.query(`SELECT ${CUSTOMER_OUT} FROM customers WHERE id = $1 AND agent_id = $2`, [req.params.id, agentId]);
      if (!before.rows.length) return res.status(404).json({ error: "Not found" });
      const q = guardedUpdate("customers", CUSTOMER_EDIT_COLS, set, known);
      const r = await pool.query(q.sql, [req.params.id, agentId, ...q.params]);
      if (!r.rowCount) return changed(res);
      void audit(agentId, req.params.id, "wa_customer_edit", "/api/internal/wa/customers/:id/edit");
      const b0 = pick(before.rows[0], CUSTOMER_OUT), a0 = pick(r.rows[0], CUSTOMER_OUT);
      const keys = Object.keys(set);
      const token = undoToken("customers", req.params.id, Object.fromEntries(keys.map((k) => [k, b0[k]])), Object.fromEntries(keys.map((k) => [k, a0[k]])));
      res.json({ customer: a0, before: b0, undoToken: token });
    } catch (err) { fail(res, "customer edit", err); }
  });

  /** Undo a customer this chat just created: only if fresh and nothing refers to it (plan 8). */
  app.post("/api/internal/wa/customers/:id/undo-create", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
      // The values the bot created it with (body.expect) must still be there, and no notes:
      // a portal edit since then (a date of birth, notes) keeps the customer.
      const x = req.body?.expect;
      if (!x || typeof x !== "object" || typeof x.name !== "string") return bad(res, { expect: "the values it was created with" });
      const r = await pool.query(freshEmptyCustomerDelete(true),
        [req.params.id, agentId, x.name, x.phone ?? null, x.email ?? null, x.city ?? null, x.dob ?? null, null]);
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
  /* ── Stage 2b: policies (plan 3, 2b) ── */

  const CLIENT_OUT = "id, insurance_type, status, policyholder_name, policy_identifier, client_email, client_phone, share_enabled, insurer, policy_name, extracted_data";

  /** One policy's editable details: client details on any type; for a data-entry type also the
   *  everyday saved fields (POLICY_FIX_FIELDS) with the record's revision. */
  app.get("/api/internal/wa/clients/:id/fields", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
      const r = await pool.query(`SELECT ${CLIENT_OUT} FROM clients WHERE id = $1 AND agent_id = $2`, [req.params.id, agentId]);
      if (!r.rows.length) return res.status(404).json({ error: "Not found" });
      const c = r.rows[0];
      const type = c.insurance_type || "health";
      const data = c.extracted_data && typeof c.extracted_data === "object" ? c.extracted_data : {};
      const fixable = POLICY_FIX_FIELDS[type] || [];
      res.json({
        id: c.id, type, status: c.status, shareEnabled: c.share_enabled !== false,
        client: { policyholder_name: c.policyholder_name, policy_identifier: c.policy_identifier, client_email: c.client_email, client_phone: c.client_phone },
        rev: Number.isInteger(data._rev) ? data._rev : 0,
        fields: fixable.map((f) => ({ key: f.key, label: f.label, kind: f.kind, value: data[f.key] ?? null })),
      });
    } catch (err) { fail(res, "policy fields read", err); }
  });

  /** Client details on a policy (any type, health included). Body: { set, expect, restore?, token? }. */
  app.post("/api/internal/wa/clients/:id/client-details", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
      const { set, errors } = req.body?.restore === true ? restoreSet(req.body?.set || {}, CLIENT_DETAIL_COLS) : cleanClientSet(req.body?.set || {});
      if (Object.keys(errors).length) return bad(res, errors);
      if (!Object.keys(set).length) return bad(res, { set: "nothing to change" });
      const expect = req.body?.expect && typeof req.body.expect === "object" ? req.body.expect : {};
      const known = Object.fromEntries(Object.entries(expect).filter(([k]) => CLIENT_DETAIL_COLS.includes(k)));
      const missing = missingExpect(set, known);
      if (missing.length) return bad(res, Object.fromEntries(missing.map((k) => [k, "the value seen before is required"])));
      if (req.body?.restore === true && !tokenOk(req.body?.token, undoToken("clients", req.params.id, set, known))) return bad(res, { token: "undo is only for a change saved here" });
      const q = guardedUpdate("clients", CLIENT_DETAIL_COLS, set, known);
      const r = await pool.query(q.sql, [req.params.id, agentId, ...q.params]);
      if (!r.rowCount) return changed(res);
      void audit(agentId, req.params.id, "wa_policy_client_details", "/api/internal/wa/clients/:id/client-details");
      const keys = Object.keys(set);
      const after = Object.fromEntries(keys.map((k) => [k, r.rows[0][k] ?? null]));
      res.json({ ok: true, after, undoToken: undoToken("clients", req.params.id, known, after) });
    } catch (err) { fail(res, "policy client details", err); }
  });

  /** Fix saved details on a NON-health policy, through the portal's own save
   *  (policyValueStore.saveExtractedData): same validation, revision check and shared columns.
   *  Body: { set: { key: value }, expectRev, restore?, token? }. Health is refused: there,
   *  deriveSharedColumns returns nothing and the save would blank the insurer, plan, expiry
   *  and sum insured. */
  app.post("/api/internal/wa/clients/:id/fields", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
      const r0 = await pool.query("SELECT insurance_type, extracted_data, insurer, policy_name, expiry_date::text AS expiry_date, sum_insured FROM clients WHERE id = $1 AND agent_id = $2", [req.params.id, agentId]);
      if (!r0.rows.length) return res.status(404).json({ error: "Not found" });
      const type = r0.rows[0].insurance_type || "health";
      const fixable = POLICY_FIX_FIELDS[type];
      if (!fixable) return res.status(400).json({ error: "NOT_EDITABLE", message: "Only motor, life, term, travel, property, fire and marine details can be changed here." });
      const expectRev = req.body?.expectRev;
      if (!Number.isInteger(expectRev)) return bad(res, { expectRev: "the revision seen before is required" });
      const raw = req.body?.set && typeof req.body.set === "object" ? req.body.set : {};
      const set: Record<string, unknown> = {};
      const errors: FieldErrors = {};
      for (const [k, v] of Object.entries(raw)) {
        const f = fixable.find((x) => x.key === k);
        if (!f) { errors[k] = "cannot be changed from WhatsApp"; continue; }
        if (req.body?.restore === true) { set[k] = v ?? null; continue; } // checked by the token below
        const c = cleanFixValue(f.kind, v);
        if (!c.ok) errors[k] = c.error;
        else if (c.value === null) errors[k] = "a value is needed"; // clearing is for the portal
        else set[k] = c.value;
      }
      if (Object.keys(errors).length) return bad(res, errors);
      if (!Object.keys(set).length) return bad(res, { set: "nothing to change" });
      const stored = r0.rows[0].extracted_data && typeof r0.rows[0].extracted_data === "object" ? r0.rows[0].extracted_data : {};
      const before = Object.fromEntries(Object.keys(set).map((k) => [k, stored[k] ?? null]));
      if (req.body?.restore === true) {
        const expectAfter = req.body?.expect && typeof req.body.expect === "object" ? req.body.expect : {};
        if (!tokenOk(req.body?.token, undoToken("clients.extracted_data", req.params.id, set, expectAfter))) return bad(res, { token: "undo is only for a change saved here" });
        if (Object.keys(set).some((k) => norm(stored[k]) !== norm(expectAfter[k]))) return changed(res);
      }
      // The portal's save rewrites insurer, plan, expiry and cover from the saved details. If one
      // of those is only in the column (an older record), the save would blank it: refuse.
      const derived = deriveSharedColumns(type, { ...stored, ...set }) as Record<string, unknown>;
      if (["insurer", "policy_name", "expiry_date", "sum_insured"].some((k) => r0.rows[0][k] != null && derived[k] == null)) {
        return res.status(400).json({ error: "NOT_EDITABLE", message: "This policy has details that are only in the portal. Change it there." });
      }
      const out = await saveExtractedData(pool as any, agentId, req.params.id, { expected_rev: expectRev, extracted_data: set }, { deriveSharedColumns, scoreFromExtractedData });
      if (out.status === 409) return changed(res);
      if (out.status !== 200) return res.status(out.status === 404 ? 404 : 400).json({ error: "INVALID", fields: Object.fromEntries(((out.body as any)?.fields || []).map((e: any) => [e.field, e.reason])), message: (out.body as any)?.message });
      void audit(agentId, req.params.id, "wa_policy_fields", "/api/internal/wa/clients/:id/fields");
      const merged = (out.body as any).extracted_data || {};
      const after = Object.fromEntries(Object.keys(set).map((k) => [k, merged[k] ?? null]));
      res.json({ ok: true, before, after, rev: (out.body as any).rev, undoToken: undoToken("clients.extracted_data", req.params.id, before, after) });
    } catch (err) { fail(res, "policy fields", err); }
  });

  /** Stop or restart sharing a report. Body: { enabled, expectEnabled }. Only the flag moves:
   *  the share link (token) stays, so restarting gives the customer the same link back. */
  app.post("/api/internal/wa/clients/:id/sharing", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
      const enabled = req.body?.enabled;
      const was = req.body?.expectEnabled;
      if (typeof enabled !== "boolean" || typeof was !== "boolean") return bad(res, { enabled: "true or false, with the value seen before" });
      const r = await pool.query(
        `UPDATE clients SET share_enabled = $3
          WHERE id = $1 AND agent_id = $2 AND COALESCE(share_enabled, true) = $4 RETURNING id`,
        [req.params.id, agentId, enabled, was]
      );
      if (!r.rowCount) return changed(res);
      void audit(agentId, req.params.id, enabled ? "wa_share_on" : "wa_share_off", "/api/internal/wa/clients/:id/sharing");
      res.json({ ok: true, enabled });
    } catch (err) { fail(res, "policy sharing", err); }
  });
}

/** Remove a customer only if created in the last 15 minutes and nothing refers to it:
 *  no policy, claim, lead, calculator or comparison (all of which would be silently unfiled
 *  by the foreign keys' ON DELETE SET NULL). $1 customer id, $2 agent id. With `unchanged`,
 *  also only if it still holds exactly the values it was created with ($3 name, $4 phone,
 *  $5 email, $6 city, $7 dob, $8 notes): customers has no updated_at, so the values are the proof. */
export function freshEmptyCustomerDelete(unchanged = false): string {
  const same = unchanged
    ? `
             AND c.name IS NOT DISTINCT FROM $3::text AND c.phone IS NOT DISTINCT FROM $4::text
             AND c.email IS NOT DISTINCT FROM $5::text AND c.city IS NOT DISTINCT FROM $6::text
             AND c.dob::text IS NOT DISTINCT FROM $7::text AND c.notes IS NOT DISTINCT FROM $8::text`
    : "";
  return `DELETE FROM customers c
           WHERE c.id = $1 AND c.agent_id = $2 AND c.created_at > now() - interval '15 minutes'${same}
             AND NOT EXISTS (SELECT 1 FROM clients x WHERE x.customer_id = c.id)
             AND NOT EXISTS (SELECT 1 FROM claims x WHERE x.customer_id = c.id)
             AND NOT EXISTS (SELECT 1 FROM agent_leads x WHERE x.customer_id = c.id)
             AND NOT EXISTS (SELECT 1 FROM calculator_reports x WHERE x.customer_id = c.id)
             AND NOT EXISTS (SELECT 1 FROM comparison_reports x WHERE x.customer_id = c.id)
           RETURNING c.id`;
}

/** The SQL for removing a lead the bot just added: fresh, never changed since, no lead policies
 *  (they would cascade). $1 lead id, $2 agent id. */
export function freshUntouchedLeadDelete(unchanged = false): string {
  // With `unchanged`: $3 name, $4 phone, $5 email, $6 city, $7 source, $8 interest, $9 expected value,
  // $10 status, $11 follow-up, $12 notes must all still be what the bot created.
  const same = unchanged
    ? `
             AND l.name IS NOT DISTINCT FROM $3::text AND l.phone IS NOT DISTINCT FROM $4::text
             AND l.email IS NOT DISTINCT FROM $5::text AND l.city IS NOT DISTINCT FROM $6::text
             AND l.source IS NOT DISTINCT FROM $7::text AND l.insurance_interest IS NOT DISTINCT FROM $8::text
             AND l.expected_value::text IS NOT DISTINCT FROM $9::text AND l.status IS NOT DISTINCT FROM $10::text
             AND l.next_follow_up::text IS NOT DISTINCT FROM $11::text AND l.notes IS NOT DISTINCT FROM $12::text`
    : "";
  return `DELETE FROM agent_leads l
           WHERE l.id = $1 AND l.agent_id = $2 AND l.created_at > now() - interval '15 minutes'
${unchanged ? "" : "             AND l.updated_at <= l.created_at + interval '2 seconds'\n"}             AND l.customer_id IS NULL
             AND NOT EXISTS (SELECT 1 FROM lead_policies x WHERE x.lead_id = l.id)${same}
           RETURNING l.id`;
}

function pick(row: any, cols: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  // "next_follow_up::text AS next_follow_up" -> the key is the alias.
  for (const c of cols.split(",").map((s) => s.trim().split(/\s+AS\s+/i).pop()!.trim())) out[c] = row?.[c] instanceof Date ? norm(row[c]) : row?.[c] ?? null;
  return out;
}
