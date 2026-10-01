/**
 * Storage and review for document-sourced policy rules (migration 025).
 *
 * Every function takes the JWT-verified agent id and reaches policy rows only
 * through `clients.agent_id = $agent`, so one advisor can never read, write
 * or review another's. The tables have RLS on with no policies (backend
 * only), so this is the access path that matters; it is tested on PGlite
 * with two advisors.
 *
 * Rules kept here:
 *   - A parse of the same file by the same code is recorded once.
 *   - A new reading never inherits approval: if the value or the parser
 *     version changed, the field goes back to pending. If it disagrees with an
 *     advisor's correction, the field is marked conflicting and both are kept.
 *   - Review is per field, against the exact revision the advisor saw
 *     (expected_revision); a stale tab gets a conflict, not an overwrite.
 *   - Every review action is idempotent by key.
 *   - Flag decisions belong to the parse they were made on.
 */

import type { ConfirmedFacts } from "../../../shared/documentRules";
import type { FieldKey, FieldState, ParseOutcome, ReviewFlag } from "../../../shared/policyDocTypes";
import { isExpr } from "../../../shared/exactMath";

export interface Q {
  query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount?: number | null }>;
}
export interface DbTx extends Q {
  transaction<T>(fn: (q: Q) => Promise<T>): Promise<T>;
}

export class StoreError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

const OWN = "SELECT 1 FROM clients WHERE id = $1 AND agent_id = $2";

async function assertOwner(q: Q, agentId: string, clientId: string) {
  const r = await q.query(OWN, [clientId, agentId]);
  if (!r.rows.length) throw new StoreError(404, "not_found", "Policy not found");
}

/** Per-policy lock for the transaction: parses and reviews of one policy run one at a time. */
async function lockPolicy(q: Q, clientId: string) {
  await q.query("SELECT pg_advisory_xact_lock(hashtext($1))", [clientId]);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const docValue = (f: FieldState<unknown>) => (f.state === "found" ? f.value : f.state);

export interface RecordParseInput {
  sha256: string;
  byteSize: number;
  pageCount: number;
  storageRef: string | null;
  extractor: { id: string; version: string };
  pageMethods: unknown[];
  outcome: ParseOutcome;
}

export async function recordParse(db: DbTx, agentId: string, clientId: string, input: RecordParseInput) {
  return db.transaction(async (q) => {
    await assertOwner(q, agentId, clientId);
    await lockPolicy(q, clientId);
    const doc = await q.query(
      `INSERT INTO policy_source_documents (client_id, sha256, byte_size, page_count, storage_ref)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (client_id, sha256) DO UPDATE SET storage_ref = COALESCE(policy_source_documents.storage_ref, EXCLUDED.storage_ref)
       RETURNING id`,
      [clientId, input.sha256, input.byteSize, input.pageCount, input.storageRef]
    );
    const documentId = doc.rows[0].id;
    const o = input.outcome;
    const existing = await q.query(
      `SELECT id FROM policy_document_parses
        WHERE document_id = $1 AND extractor_version = $2 AND COALESCE(adapter_id, '') = $3 AND COALESCE(adapter_version, '') = $4`,
      [documentId, input.extractor.version, o.adapterId ?? "", o.adapterVersion ?? ""]
    );
    if (existing.rows.length) return { documentId, parseId: existing.rows[0].id, created: false, revisionsAdded: 0 };

    const parse = await q.query(
      `INSERT INTO policy_document_parses (document_id, client_id, extractor_id, extractor_version, adapter_id, adapter_version, status, reasons, page_methods, flags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [documentId, clientId, input.extractor.id, input.extractor.version, o.adapterId, o.adapterVersion, o.status,
        JSON.stringify(o.reasons), JSON.stringify(input.pageMethods), JSON.stringify(o.flags)]
    );
    const parseId = parse.rows[0].id;
    let added = 0;
    for (const [key, field] of Object.entries(o.fields) as [FieldKey, FieldState<unknown>][]) {
      const cur = await latestRevision(q, clientId, key);
      const parserVersion = o.adapterVersion ?? "none";
      let state: string | null = "document_pending";
      let corrected: unknown = null;
      if (cur) {
        const prevDoc = cur.document_field as FieldState<unknown>;
        const unchanged = same(docValue(prevDoc), docValue(field)) && cur.parser_version === parserVersion;
        if (cur.state === "corrected" || (cur.state === "conflicting" && cur.corrected_value !== null)) {
          // The advisor's value stands unless the document now disagrees with it.
          const agrees = field.state === "found" && same(field.value, cur.corrected_value);
          state = unchanged ? null : agrees ? null : "conflicting";
          corrected = cur.corrected_value;
        } else if (unchanged) {
          state = null; // same reading by the same parser: nothing new to review
        }
      }
      if (!state) continue;
      await q.query(
        `INSERT INTO policy_rule_facts (client_id, parse_id, field_key, revision, state, document_field, corrected_value, parser_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [clientId, parseId, key, (cur?.revision ?? 0) + 1, state, JSON.stringify(field), corrected === null ? null : JSON.stringify(corrected), parserVersion]
      );
      added++;
    }
    return { documentId, parseId, created: true, revisionsAdded: added };
  });
}

async function latestRevision(q: Q, clientId: string, key: string) {
  const r = await q.query(
    `SELECT * FROM policy_rule_facts WHERE client_id = $1 AND field_key = $2 ORDER BY revision DESC LIMIT 1`,
    [clientId, key]
  );
  return r.rows[0] ?? null;
}

export async function getDocumentRules(db: Q, agentId: string, clientId: string) {
  await assertOwner(db, agentId, clientId);
  const parse = (await db.query(
    `SELECT p.id, p.status, p.reasons, p.flags, p.page_methods, p.adapter_id, p.adapter_version, p.created_at, d.page_count, d.sha256
       FROM policy_document_parses p
       JOIN policy_source_documents d ON d.id = p.document_id AND d.client_id = p.client_id
       JOIN clients c ON c.id = p.client_id
      WHERE p.client_id = $1 AND c.agent_id = $2
      ORDER BY p.created_at DESC, p.id DESC LIMIT 1`,
    [clientId, agentId]
  )).rows[0] ?? null;
  const facts = (await db.query(
    `SELECT f.field_key, f.revision, f.state, f.document_field, f.corrected_value, f.parser_version, f.actor_id, f.reason, f.created_at
       FROM policy_rule_facts f JOIN clients c ON c.id = f.client_id
      WHERE f.client_id = $1 AND c.agent_id = $2
      ORDER BY f.field_key, f.revision`,
    [clientId, agentId]
  )).rows;
  const decisions = parse ? (await db.query(
    `SELECT e.flag_id, e.choice, e.reason, e.created_at FROM rule_review_events e JOIN clients c ON c.id = e.client_id
      WHERE e.client_id = $1 AND c.agent_id = $2 AND e.action = 'resolve_flag' AND e.parse_id = $3
      ORDER BY e.created_at`,
    [clientId, agentId, parse.id]
  )).rows : [];
  const latest = new Map<string, any>();
  const history = new Map<string, any[]>();
  for (const f of facts) {
    latest.set(f.field_key, f);
    history.set(f.field_key, [...(history.get(f.field_key) ?? []), f]);
  }
  const flagDecisions: Record<string, { choice: string; reason: string | null }> = {};
  for (const d of decisions) flagDecisions[d.flag_id] = { choice: d.choice, reason: d.reason };
  return { parse, fields: [...latest.values()], history: Object.fromEntries(history), flagDecisions };
}

/** Facts confirmed at their current revision, for the calculation gate. */
export function confirmedFactsFrom(fields: { field_key: string; revision: number; state: string; document_field: any; corrected_value: any }[]): ConfirmedFacts {
  const out: any = {};
  for (const f of fields) {
    if (f.state === "reviewed" && f.document_field?.state === "found") out[f.field_key] = { value: f.document_field.value, revision: f.revision, state: "reviewed" };
    else if (f.state === "corrected") out[f.field_key] = { value: f.corrected_value, revision: f.revision, state: "corrected" };
  }
  return out;
}

/** Shape checks for an advisor's corrected value. Formula fields must be valid trees. */
export function validCorrection(key: string, value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (JSON.stringify(value).length > 20000) return false;
  if (key === "surrender.gsv_formula" || key === "status.paid_up_formula") return isExpr(value);
  if (key === "surrender.gsv_factor_bands") return Array.isArray(value) && value.length > 0 && value.every((b: any) => b && isExpr(b.factor));
  const paise = (x: any) => x && Number.isSafeInteger(x.paise) && x.paise >= 0;
  if (/premium|sum_assured/.test(key) && key.startsWith("schedule.")) return paise(value);
  if (/_date$/.test(key)) return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (/_years$|grace_days$/.test(key)) return Number.isInteger(value) && (value as number) > 0 && (value as number) <= 100;
  return true;
}

export interface ReviewInput {
  fieldKey: string;
  action: "confirm" | "correct" | "reject";
  expectedRevision: number;
  value?: unknown;
  reason?: string;
  idempotencyKey: string;
}

export async function reviewFact(db: DbTx, agentId: string, clientId: string, input: ReviewInput) {
  if (!/^[a-z_]+\.[a-z0-9_]+$/.test(input.fieldKey)) throw new StoreError(400, "bad_field");
  if (!["confirm", "correct", "reject"].includes(input.action)) throw new StoreError(400, "bad_action");
  if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.length < 8 || input.idempotencyKey.length > 100) throw new StoreError(400, "bad_idempotency_key");
  if (input.action !== "confirm" && (!input.reason || input.reason.trim().length < 5)) throw new StoreError(400, "reason_required", "Say why, in a few words.");
  if (input.action === "correct" && !validCorrection(input.fieldKey, input.value)) throw new StoreError(400, "bad_value", "That value is not in a form this field accepts.");

  return db.transaction(async (q) => {
    await assertOwner(q, agentId, clientId);
    await lockPolicy(q, clientId);
    const dup = await q.query(`SELECT to_revision FROM rule_review_events WHERE actor_id = $1 AND idempotency_key = $2`, [agentId, input.idempotencyKey]);
    if (dup.rows.length) return { revision: dup.rows[0].to_revision, repeated: true };
    const cur = await latestRevision(q, clientId, input.fieldKey);
    if (!cur) throw new StoreError(404, "field_not_found");
    if (cur.revision !== input.expectedRevision) throw new StoreError(409, "stale", "This field changed since you opened it. Reload and review it again.");
    const docField = cur.document_field as FieldState<unknown>;
    if (input.action === "confirm") {
      // Only a value the document actually states can be confirmed as read.
      if (docField.state !== "found") throw new StoreError(400, "nothing_to_confirm", "The document did not give a usable value. Correct it instead.");
      if (cur.state === "conflicting") throw new StoreError(400, "conflict_needs_choice", "The document and your earlier correction disagree. Correct the field to the right value.");
    }
    const state = input.action === "confirm" ? "reviewed" : input.action === "correct" ? "corrected" : "rejected";
    const next = cur.revision + 1;
    await q.query(
      `INSERT INTO policy_rule_facts (client_id, parse_id, field_key, revision, state, document_field, corrected_value, parser_version, actor_id, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [clientId, cur.parse_id, input.fieldKey, next, state, JSON.stringify(docField),
        input.action === "correct" ? JSON.stringify(input.value) : null, cur.parser_version, agentId, input.reason?.trim() ?? null]
    );
    await q.query(
      `INSERT INTO rule_review_events (client_id, parse_id, actor_id, action, field_key, from_revision, to_revision, reason, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [clientId, cur.parse_id, agentId, input.action, input.fieldKey, cur.revision, next, input.reason?.trim() ?? null, input.idempotencyKey]
    );
    return { revision: next, repeated: false };
  });
}

export async function resolveFlag(db: DbTx, agentId: string, clientId: string, input: { flagId: string; choice: string; reason: string; idempotencyKey: string }) {
  if (!input.reason || input.reason.trim().length < 5) throw new StoreError(400, "reason_required", "Say why, in a few words (for example, what the insurer confirmed).");
  if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.length < 8) throw new StoreError(400, "bad_idempotency_key");
  return db.transaction(async (q) => {
    await assertOwner(q, agentId, clientId);
    await lockPolicy(q, clientId);
    const dup = await q.query(`SELECT 1 FROM rule_review_events WHERE actor_id = $1 AND idempotency_key = $2`, [agentId, input.idempotencyKey]);
    if (dup.rows.length) return { repeated: true };
    const parse = (await q.query(
      `SELECT id, flags FROM policy_document_parses WHERE client_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`, [clientId]
    )).rows[0];
    if (!parse) throw new StoreError(404, "no_parse");
    const flag = (parse.flags as ReviewFlag[]).find((f) => f.id === input.flagId);
    if (!flag) throw new StoreError(404, "flag_not_found");
    if (!flag.choices.includes(input.choice)) throw new StoreError(400, "bad_choice", "That choice is not offered for this point.");
    await q.query(
      `INSERT INTO rule_review_events (client_id, parse_id, actor_id, action, flag_id, choice, reason, idempotency_key)
       VALUES ($1, $2, $3, 'resolve_flag', $4, $5, $6, $7)`,
      [clientId, parse.id, agentId, input.flagId, input.choice, input.reason.trim(), input.idempotencyKey]
    );
    return { repeated: false };
  });
}

/**
 * A product-level rule candidate from one policy's confirmed facts, stripped of
 * everything that belongs to the customer: no schedule values, no benefit
 * amounts, no document hash, no excerpts, no page regions. Only contract rules
 * and the clause names they came from. Always a draft.
 */
export function buildProductRuleCandidate(facts: ConfirmedFacts, sources: Partial<Record<FieldKey, { clause: string | null }>>) {
  const RULE_PREFIXES = ["surrender.", "loan.", "status.", "revival.", "grace.", "discount_rate.", "definitions.", "options."];
  const rules: Record<string, unknown> = {};
  const clauses: Record<string, string | null> = {};
  for (const [k, f] of Object.entries(facts)) {
    if (!f || !RULE_PREFIXES.some((p) => k.startsWith(p))) continue;
    rules[k] = f.value;
    clauses[k] = sources[k as FieldKey]?.clause ?? null;
  }
  const id = (k: FieldKey) => facts[k]?.value as string | undefined;
  return {
    insurer: id("identity.insurer") ?? null,
    uin: id("identity.uin") ?? null,
    plan_option: id("identity.option") ?? null,
    benefit_variant: id("identity.benefit_choice") ?? null,
    rules,
    provenance: { clauses, note: "Built from one policy's advisor-reviewed document rules; customer values removed." },
    review_status: "draft" as const,
  };
}
