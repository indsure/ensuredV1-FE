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
import { LEAD_STATUSES, INTERESTS, LEAD_SOURCES, cleanInterests, money, cleanLeadSet, cleanCustomerSet, norm, guardedUpdate, restoreSet, missingExpect, POLICY_FIX_FIELDS, fixFieldsFor, cleanFixValue, CLIENT_DETAIL_COLS, cleanClientSet, CLAIM_FIELDS, CLAIM_LABELS, CLAIM_OPEN_STAGES, CLAIM_TERMINAL, cleanClaimSet } from "./editRules";
import { saveExtractedData, EVIDENCE_KEY } from "../services/policyValueStore";
import { readEvidence, activeRecords } from "../../../shared/policyEvidence";
import { deriveSharedColumns, EXTRACTION_FIELDS } from "../services/extractionFields";
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

  const CLIENT_OUT = "id, insurance_type, status, policyholder_name, policy_identifier, client_email, client_phone, share_enabled, insurer, policy_name, expiry_date::text AS expiry_date, sum_insured, extracted_data";

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
      const fixable = fixFieldsFor(type, data);
      res.json({
        id: c.id, type, status: c.status, shareEnabled: c.share_enabled === true,
        client: { policyholder_name: c.policyholder_name, policy_identifier: c.policy_identifier, client_email: c.client_email, client_phone: c.client_phone },
        rev: Number.isInteger(data._rev) ? data._rev : 0,
        // A saved detail kept only in the row's column (older records) is shown as the portal shows it.
        fields: fixable.map((f) => {
          const col = sharedColumnOf(type, f.key);
          const v = data[f.key] ?? null;
          return { key: f.key, label: f.label, kind: f.kind, value: empty(v) && col ? c[col] ?? null : v };
        }),
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
      // On a non-health policy the portal's detail save re-derives the name from extracted_data
      // (policyValueStore: COALESCE(derived, column)). Keep both in step, and move the revision
      // so a form opened before this change cannot save the old name back.
      const keys0 = Object.keys(set);
      const ni = keys0.indexOf("policyholder_name");
      const syncName = ni < 0 ? "" : `extracted_data = CASE WHEN COALESCE(insurance_type, 'health') <> 'health' AND jsonb_typeof(extracted_data) = 'object'
           THEN jsonb_set(jsonb_set(extracted_data, '{policyholder_name}', to_jsonb($${ni + 3}::text)), '{_rev}', to_jsonb(COALESCE((extracted_data->>'_rev')::int, 0) + 1))
           ELSE extracted_data END`;
      const q = guardedUpdate("clients", CLIENT_DETAIL_COLS, set, known, syncName);
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
      const r0 = await pool.query("SELECT insurance_type, status, extracted_data, insurer, policy_name, policyholder_name, expiry_date::text AS expiry_date, sum_insured FROM clients WHERE id = $1 AND agent_id = $2", [req.params.id, agentId]);
      if (!r0.rows.length) return res.status(404).json({ error: "Not found" });
      const row = r0.rows[0];
      const type = row.insurance_type || "health";
      if (!POLICY_FIX_FIELDS[type]) return res.status(400).json({ error: "NOT_EDITABLE", message: "Only motor, life, term, travel, property, fire and marine details can be changed here." });
      // A policy still being read would have this save overwritten by the reader.
      if (row.status !== "done") return res.status(400).json({ error: "NOT_EDITABLE", message: "This policy is still being read. Try again when it is done." });
      const fixable = fixFieldsFor(type, row.extracted_data && typeof row.extracted_data === "object" ? row.extracted_data : {});
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
      const stored = row.extracted_data && typeof row.extracted_data === "object" ? row.extracted_data : {};
      const before = Object.fromEntries(Object.keys(set).map((k) => [k, stored[k] ?? null]));
      const restore = req.body?.restore === true;
      if (restore) {
        const expectAfter = req.body?.expect && typeof req.body.expect === "object" ? req.body.expect : {};
        if (!tokenOk(req.body?.token, undoToken("clients.extracted_data", req.params.id, set, expectAfter))) return bad(res, { token: "undo is only for a change saved here" });
        if (Object.keys(set).some((k) => norm(stored[k]) !== norm(expectAfter[k]))) return changed(res);
      }
      // The portal's save rewrites insurer, plan, expiry, cover and name from the saved details.
      // A column that does not match them (an older record, or fixed elsewhere) would be silently
      // overwritten or blanked by a premium fix: refuse, the portal shows both. The columns the
      // edited fields themselves feed are expected to move.
      const moving = new Set(Object.keys(set).map((k) => sharedColumnOf(type, k)).filter(Boolean));
      const notOurs = (k: string) => !restore && empty(stored[k]) && !!sharedColumnOf(type, k) && !empty(row[sharedColumnOf(type, k)!]);
      if (columnsDrift(type, row, { ...stored, ...set }, moving) || Object.keys(set).some(notOurs)) {
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

  /* ── Stage 2c: claims (plan 3, 2c). Same rules as routes.ts /api/agent/claims, minus closing,
   *  reopening and the settled amount, plus compare-before on every write. ── */

  const CLAIM_EXTENSION_DAYS = 30;     // routes.ts CLAIM_EXTENSION_DAYS
  const CLAIM_EXTEND_UNLOCK_DAYS = 5;  // routes.ts CLAIM_EXTEND_UNLOCK_DAYS
  // Amounts and dates as text: compare-before and the undo token see exactly what the row holds.
  const CLAIM_OUT = `c.id, c.status, c.claim_type, c.insurer, c.tpa, c.policy_number, c.hospital, c.ailment,
    c.claimed_amount::text AS claimed_amount, c.settled_amount::text AS settled_amount,
    c.admitted_on::text AS admitted_on, c.discharged_on::text AS discharged_on, c.customer_id, cu.name AS customer_name`;
  const claimEvent = (claimId: string, agentId: string, status: string, note: string | null) =>
    pool.query("INSERT INTO claim_events (claim_id, agent_id, status, note) VALUES ($1, $2, $3, $4)", [claimId, agentId, status, note])
      .catch((e: any) => log.warn("wa claim event failed", { error: e?.message })); // the timeline never fails the write
  const claimRow = async (id: string, agentId: string) =>
    (await pool.query(`SELECT ${CLAIM_OUT} FROM claims c LEFT JOIN customers cu ON cu.id = c.customer_id AND cu.agent_id = c.agent_id WHERE c.id = $1 AND c.agent_id = $2`, [id, agentId])).rows[0] ?? null;
  const closed = (res: any) => res.status(400).json({ error: "CLOSED", message: "This claim is closed. Change it in the portal." });

  /** One claim with every detail the bot may show or change, and its open insurer queries. */
  app.get("/api/internal/wa/claims/:id/row", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
      const c = await claimRow(req.params.id, agentId);
      if (!c) return res.status(404).json({ error: "Not found" });
      const q = await pool.query("SELECT seq, question, raised_on::text AS raised_on FROM claim_queries WHERE claim_id = $1 AND agent_id = $2 AND resolved_on IS NULL ORDER BY seq", [req.params.id, agentId]);
      res.json({ claim: c, openQueries: q.rows });
    } catch (err) { fail(res, "claim read", err); }
  });

  /** Open a claim for an existing customer (a new person is added as a customer first, so it
   *  shows and can be undone). Body: { customerId, set: { claim_type, hospital, ... } }. */
  app.post("/api/internal/wa/claims", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      const customerId = String(req.body?.customerId || "");
      if (!UUID.test(customerId)) return bad(res, { customerId: "an existing customer is required" });
      const own = await pool.query("SELECT id FROM customers WHERE id = $1 AND agent_id = $2", [customerId, agentId]);
      if (!own.rows.length) return res.status(404).json({ error: "Customer not found" });
      const { set, errors } = cleanClaimSet(req.body?.set || {});
      if (Object.keys(errors).length) return bad(res, errors);
      if (set.admitted_on && set.discharged_on && String(set.discharged_on) < String(set.admitted_on)) return bad(res, { discharged_on: "before the admission date" });
      const cols = Object.keys(set);
      const ins = await pool.query(
        `INSERT INTO claims (agent_id, customer_id${cols.map((k) => `, ${k}`).join("")})
         VALUES ($1, $2${cols.map((_, i) => `, $${i + 3}`).join("")}) RETURNING id`,
        [agentId, customerId, ...cols.map((k) => set[k])]
      );
      const id = ins.rows[0].id;
      await claimEvent(id, agentId, "opened", "Claim opened");
      void audit(agentId, id, "wa_claim_open", "/api/internal/wa/claims");
      const c = await claimRow(id, agentId);
      res.json({ claim: c, created: Object.fromEntries(["customer_id", ...CLAIM_FIELDS].map((k) => [k, c?.[k] ?? null])) });
    } catch (err) { fail(res, "claim open", err); }
  });

  /** Undo of a claim this chat just opened: only within 15 minutes, still "opened", with no
   *  query, document, event or field change since, and every value as created (plan 8). */
  app.post("/api/internal/wa/claims/:id/undo-create", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
      const expect = req.body?.expect && typeof req.body.expect === "object" ? req.body.expect : null;
      const keys = ["customer_id", ...CLAIM_FIELDS];
      if (!expect || keys.some((k) => !(k in expect))) return bad(res, { expect: "the values it was created with are required" });
      const params: unknown[] = [req.params.id, agentId];
      const same = keys.map((k) => { params.push(norm(expect[k])); return `c.${k}::text IS NOT DISTINCT FROM $${params.length}::text`; });
      const r = await pool.query(
        `DELETE FROM claims c
          WHERE c.id = $1 AND c.agent_id = $2
            AND c.created_at > now() - interval '15 minutes'
            AND c.status = 'opened' AND c.updated_at <= c.created_at + interval '2 seconds'
            AND NOT EXISTS (SELECT 1 FROM claim_queries x WHERE x.claim_id = c.id)
            AND NOT EXISTS (SELECT 1 FROM claim_documents x WHERE x.claim_id = c.id)
            AND NOT EXISTS (SELECT 1 FROM claim_events x WHERE x.claim_id = c.id AND x.status <> 'opened')
            AND ${same.join(" AND ")}
          RETURNING c.id`,
        params
      );
      if (!r.rowCount) return changed(res);
      void audit(agentId, req.params.id, "wa_claim_undo_create", "/api/internal/wa/claims/:id/undo-create");
      res.json({ ok: true });
    } catch (err) { fail(res, "claim undo create", err); }
  });

  /** Change a claim's details. Body: { set, expect, restore?, token? }. Never on a closed claim,
   *  never the settled amount; the claim's stage is compared too, so a close in between is CHANGED. */
  app.post("/api/internal/wa/claims/:id/edit", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
      const restore = req.body?.restore === true;
      const { set, errors } = restore ? restoreSet(req.body?.set || {}, CLAIM_FIELDS) : cleanClaimSet(req.body?.set || {});
      if (Object.keys(errors).length) return bad(res, errors);
      if (!Object.keys(set).length) return bad(res, { set: "nothing to change" });
      const expect = req.body?.expect && typeof req.body.expect === "object" ? req.body.expect : {};
      const known = Object.fromEntries(Object.entries(expect).filter(([k]) => CLAIM_FIELDS.includes(k)));
      const missing = missingExpect(set, known);
      if (missing.length) return bad(res, Object.fromEntries(missing.map((k) => [k, "the value seen before is required"])));
      if (restore && !tokenOk(req.body?.token, undoToken("claims", req.params.id, set, known))) return bad(res, { token: "undo is only for a change saved here" });
      const c = await claimRow(req.params.id, agentId);
      if (!c) return res.status(404).json({ error: "Not found" });
      if (CLAIM_TERMINAL.includes(c.status)) return closed(res);
      if (!restore) {
        // The portal's pair rule: a claimed amount below the settled one is a typo.
        if ("claimed_amount" in set && c.settled_amount != null && Number(set.claimed_amount) < Number(c.settled_amount)) return bad(res, { claimed_amount: "below the amount already settled" });
        const adm = String("admitted_on" in set ? set.admitted_on : c.admitted_on ?? "");
        const dis = String("discharged_on" in set ? set.discharged_on : c.discharged_on ?? "");
        if (adm && dis && dis < adm) return bad(res, { discharged_on: "before the admission date" });
      }
      const q = guardedUpdate("claims", [...CLAIM_FIELDS, "status"], set, { ...known, status: c.status }, "updated_at = now()");
      const r = await pool.query(q.sql, [req.params.id, agentId, ...q.params]);
      if (!r.rowCount) return changed(res);
      const now = await claimRow(req.params.id, agentId);
      const keys = Object.keys(set);
      const after = Object.fromEntries(keys.map((k) => [k, now?.[k] ?? null]));
      const show = (v: unknown) => (v === null || v === undefined || v === "" ? "(empty)" : String(v));
      await claimEvent(req.params.id, agentId, "details_edited", keys.map((k) => `${CLAIM_LABELS[k]}: ${show(known[k])} → ${show(after[k])}`).join(" · ") + " (WhatsApp)");
      void audit(agentId, req.params.id, "wa_claim_edit", "/api/internal/wa/claims/:id/edit");
      res.json({ ok: true, claim: now, after, undoToken: undoToken("claims", req.params.id, known, after) });
    } catch (err) { fail(res, "claim edit", err); }
  });

  /** Move a claim between open stages. Body: { to, from, restore?, token? }. Never into or out of
   *  settled/rejected; query_raised only as the undo of a move made here (token). */
  app.post("/api/internal/wa/claims/:id/stage", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
      const to = String(req.body?.to || ""), from = String(req.body?.from || "");
      const restore = req.body?.restore === true;
      const okFrom = [...CLAIM_OPEN_STAGES, "query_raised"];
      if (!okFrom.includes(from) || to === from) return bad(res, { from: "the stage seen before is required" });
      if (!(restore ? okFrom : CLAIM_OPEN_STAGES).includes(to)) return bad(res, { to: "close or reopen a claim in the portal" });
      if (restore && !tokenOk(req.body?.token, undoToken("claims.status", req.params.id, { status: to }, { status: from }))) return bad(res, { token: "undo is only for a change saved here" });
      // A claim stays at query_raised while any round is open (migration 015): answer it first.
      if (!restore && from === "query_raised") {
        const open = await pool.query("SELECT 1 FROM claim_queries WHERE claim_id = $1 AND agent_id = $2 AND resolved_on IS NULL LIMIT 1", [req.params.id, agentId]);
        if (open.rowCount) return res.status(400).json({ error: "OPEN_QUERY" });
      }
      const r = await pool.query(
        `UPDATE claims SET status = $3, updated_at = now()
          WHERE id = $1 AND agent_id = $2 AND status = $4 AND status NOT IN ('settled', 'rejected') RETURNING id`,
        [req.params.id, agentId, to, from]
      );
      if (!r.rowCount) return changed(res);
      await claimEvent(req.params.id, agentId, to, restore ? "Undone from WhatsApp" : "From WhatsApp");
      void audit(agentId, req.params.id, `claim_status_${to}`, "/api/internal/wa/claims/:id/stage");
      res.json({ ok: true, status: to, undoToken: undoToken("claims.status", req.params.id, { status: from }, { status: to }) });
    } catch (err) { fail(res, "claim stage", err); }
  });

  /** Log an insurer query round (routes.ts POST claims/:id/queries). Body: { question, from }.
   *  No undo: removing it is for the portal. */
  app.post("/api/internal/wa/claims/:id/queries", async (req, res) => {
    const agentId = await scopedAgent(req, res);
    if (!agentId) return;
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
    const question = String(req.body?.question || "").trim();
    if (question.length < 3 || question.length > 500) return bad(res, { question: "write what the insurer asked" });
    const from = String(req.body?.from || "");
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      // Locks the claim, so two rounds logged at once still get different numbers.
      const c = await db.query("SELECT status FROM claims WHERE id = $1 AND agent_id = $2 FOR UPDATE", [req.params.id, agentId]);
      if (!c.rows.length) { await db.query("ROLLBACK"); return res.status(404).json({ error: "Not found" }); }
      if (CLAIM_TERMINAL.includes(c.rows[0].status)) { await db.query("ROLLBACK"); return closed(res); }
      if (c.rows[0].status !== from) { await db.query("ROLLBACK"); return changed(res); }
      const seq = (await db.query("SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM claim_queries WHERE claim_id = $1", [req.params.id])).rows[0].next;
      await db.query("INSERT INTO claim_queries (claim_id, agent_id, seq, question) VALUES ($1, $2, $3, $4)", [req.params.id, agentId, seq, question]);
      await db.query("UPDATE claims SET status = 'query_raised', updated_at = now() WHERE id = $1 AND agent_id = $2", [req.params.id, agentId]);
      await db.query("INSERT INTO claim_events (claim_id, agent_id, status, note) VALUES ($1, $2, 'query_raised', $3)", [req.params.id, agentId, `Round ${seq}: ${question}`]);
      await db.query("COMMIT");
      void audit(agentId, req.params.id, "wa_claim_query", "/api/internal/wa/claims/:id/queries");
      res.json({ ok: true, seq });
    } catch (err) {
      await db.query("ROLLBACK").catch(() => {});
      fail(res, "claim query", err);
    } finally { db.release(); }
  });

  /** Mark a query round answered. When it was the last open one and the claim is at query_raised,
   *  the claim moves to under_process, as in the portal. Returns what undo needs. */
  app.post("/api/internal/wa/claims/:id/queries/:seq/answered", async (req, res) => {
    const agentId = await scopedAgent(req, res);
    if (!agentId) return;
    const seq = Number(req.params.seq);
    if (!UUID.test(req.params.id) || !Number.isInteger(seq) || seq < 1) return res.status(404).json({ error: "Not found" });
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const c = await db.query("SELECT status FROM claims WHERE id = $1 AND agent_id = $2 FOR UPDATE", [req.params.id, agentId]);
      if (!c.rows.length) { await db.query("ROLLBACK"); return res.status(404).json({ error: "Not found" }); }
      if (CLAIM_TERMINAL.includes(c.rows[0].status)) { await db.query("ROLLBACK"); return closed(res); }
      const q = await db.query(
        `UPDATE claim_queries SET resolved_on = GREATEST(CURRENT_DATE, raised_on)
          WHERE claim_id = $1 AND agent_id = $2 AND seq = $3 AND resolved_on IS NULL RETURNING resolved_on::text AS resolved_on`,
        [req.params.id, agentId, seq]
      );
      if (!q.rowCount) { await db.query("ROLLBACK"); return changed(res); }
      const open = (await db.query("SELECT count(*)::int AS n FROM claim_queries WHERE claim_id = $1 AND resolved_on IS NULL", [req.params.id])).rows[0].n;
      const moved = open === 0 && c.rows[0].status === "query_raised";
      if (moved) await db.query("UPDATE claims SET status = 'under_process', updated_at = now() WHERE id = $1", [req.params.id]);
      await db.query("INSERT INTO claim_events (claim_id, agent_id, status, note) VALUES ($1, $2, 'query_resolved', $3)", [req.params.id, agentId, `Round ${seq} resolved`]);
      await db.query("COMMIT");
      void audit(agentId, req.params.id, "wa_claim_query_answered", "/api/internal/wa/claims/:id/queries/:seq/answered");
      const resolvedOn = q.rows[0].resolved_on;
      // The stage after answering is signed too: undo puts the round back only on a claim still there.
      const status = moved ? "under_process" : c.rows[0].status;
      res.json({ ok: true, resolvedOn, moved, status, openLeft: open, undoToken: undoToken("claim_queries", `${req.params.id}:${seq}`, { resolved_on: null, moved: false, status: null }, { resolved_on: resolvedOn, moved, status }) });
    } catch (err) {
      await db.query("ROLLBACK").catch(() => {});
      fail(res, "claim query answered", err);
    } finally { db.release(); }
  });

  /** Undo of "answered": the round is open again and, if answering moved the claim, it is back at
   *  query_raised. Both only if nothing changed since. Body: { resolvedOn, moved, token }. */
  app.post("/api/internal/wa/claims/:id/queries/:seq/reopen", async (req, res) => {
    const agentId = await scopedAgent(req, res);
    if (!agentId) return;
    const seq = Number(req.params.seq);
    if (!UUID.test(req.params.id) || !Number.isInteger(seq) || seq < 1) return res.status(404).json({ error: "Not found" });
    const resolvedOn = String(req.body?.resolvedOn || ""), moved = req.body?.moved === true, status = String(req.body?.status || "");
    if (!tokenOk(req.body?.token, undoToken("claim_queries", `${req.params.id}:${seq}`, { resolved_on: null, moved: false, status: null }, { resolved_on: resolvedOn, moved, status }))) return bad(res, { token: "undo is only for a change saved here" });
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const q = await db.query(
        "UPDATE claim_queries SET resolved_on = NULL WHERE claim_id = $1 AND agent_id = $2 AND seq = $3 AND resolved_on::text = $4 RETURNING id",
        [req.params.id, agentId, seq, resolvedOn]
      );
      // Only on a claim still at the stage answering left it in; else a newer change would be contradicted.
      const c = moved
        ? await db.query("UPDATE claims SET status = 'query_raised', updated_at = now() WHERE id = $1 AND agent_id = $2 AND status = 'under_process' RETURNING id", [req.params.id, agentId])
        : await db.query("SELECT id FROM claims WHERE id = $1 AND agent_id = $2 AND status = $3 AND status NOT IN ('settled', 'rejected') FOR UPDATE", [req.params.id, agentId, status]);
      if (!q.rowCount || !c.rowCount) { await db.query("ROLLBACK"); return changed(res); }
      await db.query("INSERT INTO claim_events (claim_id, agent_id, status, note) VALUES ($1, $2, 'query_raised', $3)", [req.params.id, agentId, `Round ${seq} open again (undone from WhatsApp)`]);
      await db.query("COMMIT");
      void audit(agentId, req.params.id, "wa_claim_query_reopen", "/api/internal/wa/claims/:id/queries/:seq/reopen");
      res.json({ ok: true });
    } catch (err) {
      await db.query("ROLLBACK").catch(() => {});
      fail(res, "claim query reopen", err);
    } finally { db.release(); }
  });

  /** Keep a claim's documents 30 more days: the portal's own triple guard, in the UPDATE. No undo. */
  app.post("/api/internal/wa/claims/:id/extend", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
      const r = await pool.query(
        `UPDATE claims
            SET purge_at = purge_at + make_interval(days => $3), extension_used = true, extension_granted_at = now(), updated_at = now()
          WHERE id = $1 AND agent_id = $2
            AND purge_at IS NOT NULL AND extension_used = false AND documents_purged_at IS NULL
            AND status NOT IN ('settled', 'rejected')
            AND now() >= purge_at - make_interval(days => $4)
          RETURNING purge_at::date::text AS purge_on`,
        [req.params.id, agentId, CLAIM_EXTENSION_DAYS, CLAIM_EXTEND_UNLOCK_DAYS]
      );
      if (!r.rowCount) return res.status(409).json({ error: "CANNOT_EXTEND" });
      await claimEvent(req.params.id, agentId, "retention_extended", "Kept 30 more days");
      void audit(agentId, req.params.id, "wa_claim_extend", "/api/internal/wa/claims/:id/extend");
      res.json({ ok: true, purgeOn: r.rows[0].purge_on });
    } catch (err) { fail(res, "claim extend", err); }
  });

  /* ── Stage 2d: life records (plan 3, 2d). Records the advisor's evidence on a life or term
   *  policy through the portal's own save. Records are only ever ADDED (the save merges by id and
   *  keeps every stored record); undo adds a "void" that supersedes the record, so the history
   *  keeps it, as the portal's voidRecord does. ── */

  const LIFE_TYPES = ["life", "term"];
  const LIFE_LISTS = { payment: "payments", loan: "loans", quote: "quotes" } as const;
  /** India's calendar date: records carry the day the advisor entered them. */
  const todayIst = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
  const lifeRow = async (id: string, agentId: string) =>
    (await pool.query(
      "SELECT insurance_type, status, extracted_data, insurer, policy_name, policyholder_name, expiry_date::text AS expiry_date, sum_insured FROM clients WHERE id = $1 AND agent_id = $2",
      [id, agentId]
    )).rows[0] ?? null;
  const notLife = (res: any) => res.status(400).json({ error: "NOT_LIFE", message: "Only life and term policies keep these records." });

  /** One life or term policy's records still in force (not voided or superseded), with its revision. */
  app.get("/api/internal/wa/clients/:id/life", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
      const row = await lifeRow(req.params.id, agentId);
      if (!row) return res.status(404).json({ error: "Not found" });
      const data = row.extracted_data && typeof row.extracted_data === "object" ? row.extracted_data : {};
      const { evidence } = readEvidence(data[EVIDENCE_KEY]);
      res.json({
        type: row.insurance_type || "health", status: row.status, rev: Number.isInteger(data._rev) ? data._rev : 0,
        active: { payments: activeRecords(evidence.payments), loans: activeRecords(evidence.loans), quotes: activeRecords(evidence.quotes) },
      });
    } catch (err) { fail(res, "life records read", err); }
  });

  /** Add one record. Body: { kind: payment|loan|quote, input, expectRev }. The server builds the
   *  record (id, date entered, "self reported", note) and checks it with the portal's own reader. */
  app.post("/api/internal/wa/clients/:id/life-record", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
      const kind = String(req.body?.kind || "") as keyof typeof LIFE_LISTS;
      const list = LIFE_LISTS[kind];
      if (!list) return bad(res, { kind: "payment, loan or quote" });
      const expectRev = req.body?.expectRev;
      if (!Number.isInteger(expectRev)) return bad(res, { expectRev: "the revision seen before is required" });
      const row = await lifeRow(req.params.id, agentId);
      if (!row) return res.status(404).json({ error: "Not found" });
      if (!LIFE_TYPES.includes(row.insurance_type)) return notLife(res);
      if (row.status !== "done") return res.status(400).json({ error: "NOT_EDITABLE", message: "This policy is still being read. Try again when it is done." });
      const today = todayIst();
      const input = req.body?.input && typeof req.body.input === "object" ? req.body.input : {};
      const built = buildLifeRecord(kind, input, today);
      if ("error" in built) return bad(res, { input: built.error });
      const data = row.extracted_data && typeof row.extracted_data === "object" ? row.extracted_data : {};
      const { evidence } = readEvidence(data[EVIDENCE_KEY]);
      // A resend of the same payment must not count the premium twice.
      if (kind === "payment" && activeRecords(evidence.payments).some((p) => p.dueDate === (built.record as any).dueDate && p.amount === (built.record as any).amount)) {
        return res.status(409).json({ error: "DUPLICATE" });
      }
      if (columnsDrift(row.insurance_type, row, data, new Set())) return res.status(400).json({ error: "NOT_EDITABLE", message: "This policy has details that are only in the portal. Change it there." });
      const out = await saveExtractedData(pool as any, agentId, req.params.id,
        { expected_rev: expectRev, extracted_data: { [EVIDENCE_KEY]: { schema: 1, [list]: [built.record] } } }, { deriveSharedColumns, scoreFromExtractedData });
      if (out.status === 409) return changed(res);
      if (out.status !== 200) return res.status(400).json({ error: "INVALID", message: (out.body as any)?.message || (out.body as any)?.error });
      void audit(agentId, req.params.id, `wa_life_${kind}`, "/api/internal/wa/clients/:id/life-record");
      res.json({ ok: true, rev: (out.body as any).rev, list, record: built.record, undoToken: undoToken("value_evidence", req.params.id, { record: null }, { record: built.record.id }) });
    } catch (err) { fail(res, "life record", err); }
  });

  /** Undo of a record added here: a void that supersedes it (kept in the history as removed).
   *  Body: { list, recordId, expectRev, token }. Only while the record is still in force. */
  app.post("/api/internal/wa/clients/:id/life-record/void", async (req, res) => {
    try {
      const agentId = await scopedAgent(req, res);
      if (!agentId) return;
      if (!UUID.test(req.params.id)) return res.status(404).json({ error: "Not found" });
      const list = String(req.body?.list || "") as "payments" | "loans" | "quotes";
      const recordId = String(req.body?.recordId || "");
      if (!["payments", "loans", "quotes"].includes(list) || !recordId) return bad(res, { list: "payments, loans or quotes, with the record" });
      if (!tokenOk(req.body?.token, undoToken("value_evidence", req.params.id, { record: null }, { record: recordId }))) return bad(res, { token: "undo is only for a record added here" });
      const expectRev = req.body?.expectRev;
      if (!Number.isInteger(expectRev)) return bad(res, { expectRev: "the revision seen before is required" });
      const row = await lifeRow(req.params.id, agentId);
      if (!row) return res.status(404).json({ error: "Not found" });
      if (!LIFE_TYPES.includes(row.insurance_type)) return notLife(res);
      const data = row.extracted_data && typeof row.extracted_data === "object" ? row.extracted_data : {};
      const { evidence } = readEvidence(data[EVIDENCE_KEY]);
      const target = activeRecords(evidence[list] as any[]).find((r: any) => r.id === recordId);
      if (!target) return changed(res);
      if (columnsDrift(row.insurance_type, row, data, new Set())) return res.status(400).json({ error: "NOT_EDITABLE", message: "This policy has details that are only in the portal. Change it there." });
      const voided = { ...target, id: crypto.randomUUID(), enteredOn: todayIst(), supersedes: recordId, voided: true, note: "Removed: undone on WhatsApp" };
      const out = await saveExtractedData(pool as any, agentId, req.params.id,
        { expected_rev: expectRev, extracted_data: { [EVIDENCE_KEY]: { schema: 1, [list]: [voided] } } }, { deriveSharedColumns, scoreFromExtractedData });
      if (out.status === 409) return changed(res);
      if (out.status !== 200) return res.status(400).json({ error: "INVALID", message: (out.body as any)?.message || (out.body as any)?.error });
      void audit(agentId, req.params.id, "wa_life_void", "/api/internal/wa/clients/:id/life-record/void");
      res.json({ ok: true, rev: (out.body as any).rev });
    } catch (err) { fail(res, "life record void", err); }
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

/* ── Stage 2b helpers ── */

const empty = (v: unknown) => v === null || v === undefined || v === "";

/** The clients column a saved detail feeds (extractionFields `shared`; motor's OD date feeds expiry). */
export function sharedColumnOf(type: string, key: string): string | null {
  if (type === "motor" && key === "od_expiry_date") return "expiry_date";
  const f = ((EXTRACTION_FIELDS as Record<string, { key: string; shared?: string }[]>)[type] || []).find((x) => x.key === key);
  return f?.shared ?? null;
}

/**
 * The portal's detail save re-derives insurer, plan, expiry, cover and name from extracted_data
 * (extractionFields.deriveSharedColumns). True when that would change a filled column that this
 * save is not meant to move (an older record, or a column fixed elsewhere): such a save is refused.
 */
export function columnsDrift(type: string, row: Record<string, any>, data: Record<string, any>, moving: Set<string | null>): boolean {
  const derived = deriveSharedColumns(type, data) as Record<string, unknown>;
  return ["insurer", "policy_name", "expiry_date", "sum_insured", "policyholder_name"]
    .some((col) => !moving.has(col) && !empty(row[col]) && !sameColumn(col, derived[col], row[col]) && !(col === "policyholder_name" && empty(derived[col])));
}

/** Whether a derived value and the stored column say the same thing (numbers as numbers, dates as days). */
export function sameColumn(col: string, derived: unknown, column: unknown): boolean {
  if (empty(derived) && empty(column)) return true;
  if (empty(derived) || empty(column)) return false;
  if (col === "sum_insured") return Number(derived) === Number(column);
  if (col === "expiry_date") return norm(derived) === norm(column);
  return String(derived).trim() === String(column).trim();
}

/* ── Stage 2d helpers ── */

/**
 * Build one life record from what the advisor said, the portal's way (shared/policyEvidence.ts),
 * then check it with the portal's own reader: anything it would drop is refused here instead.
 * Always "self reported": an advisor typing a figure on WhatsApp is not an insurer document.
 * Dates the advisor reports cannot be in the future (a payment made, a statement dated).
 */
export function buildLifeRecord(kind: "payment" | "loan" | "quote", input: Record<string, any>, today: string):
  { record: Record<string, any> } | { error: string } {
  const base = { id: crypto.randomUUID(), enteredOn: today, origin: "agent_entered", confirmation: "self_reported", reference: null, note: "From WhatsApp", supersedes: null, voided: false };
  const future = (d: unknown) => typeof d === "string" && d > today;
  let record: Record<string, any>;
  if (kind === "payment") {
    if (future(input.paidOn)) return { error: "the payment date is in the future" };
    record = { ...base, kind: "payment", amount: input.amount, currency: "INR", dueDate: input.dueDate, paidOn: input.paidOn };
  } else if (kind === "loan") {
    const asOf = input.asOf ?? today;
    if (future(asOf)) return { error: "the date is in the future" };
    record = input.status === "none"
      ? { ...base, kind: "loan", status: "none", principal: 0, interest: 0, asOf }
      : { ...base, kind: "loan", status: "outstanding", principal: input.principal, interest: input.interest ?? null, asOf };
  } else {
    const quoteDate = input.quoteDate ?? today;
    if (future(quoteDate)) return { error: "the date is in the future" };
    record = { ...base, kind: "quote", quoteType: input.quoteType, amount: input.amount ?? null, status: input.status ?? null, paidTo: input.paidTo ?? null, quoteDate };
  }
  const list = kind === "payment" ? "payments" : kind === "loan" ? "loans" : "quotes";
  const { evidence, issues } = readEvidence({ schema: 1, [list]: [record] });
  const read = (evidence as any)[list][0];
  if (issues.length || !read) return { error: "not a record the portal can read (check the amount and dates)" };
  // Store exactly what the portal's reader understood (numbers as numbers, dates as days).
  return { record: read };
}
