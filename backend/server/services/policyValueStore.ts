/**
 * Reading and saving the policy data the surrender-value screens work from.
 *
 * Two jobs, both scoped to the agent identity verified from the JWT, never to
 * an id the browser sends:
 *
 *  1. loadPolicyValueRows: the advisor's life and term policies, every status,
 *     for the book. Replaces a direct browser read of `clients`, whose row
 *     security is configured in the live database and is not in this repo.
 *
 *  2. saveExtractedData: the body of PATCH /api/agent/clients/:id/extracted-data.
 *     - Only keys whose value actually changed are validated, so a row holding
 *       an old bad value can still be saved by a client that never touched it.
 *     - Numbers and dates use the one strict grammar (shared/policyNumbers).
 *       "Rs. 50,000" is stored as 50000; "approx 50k" is refused.
 *     - `value_evidence` (payments, loans, quotes) is merged record by record.
 *       A stored record is never dropped or rewritten by a save; a client that
 *       does not send `expected_rev` cannot change evidence at all.
 *     - `_rev` counts saves. A client that sends `expected_rev` gets a 409 if
 *       someone saved in between, and the UPDATE itself re-checks the revision,
 *       so two saves racing cannot both win. Clients that send no
 *       `expected_rev` behave as before, except for evidence.
 *
 * Pure apart from the `db` it is given, so it can be tested without Postgres.
 */

import { parseIsoDate, parseRupees } from "../../../shared/policyNumbers";
import { EXTRACTION_FIELDS, isDataEntryType, mergeExtractedData } from "./extractionFields";

export interface Db {
  query(text: string, params: unknown[]): Promise<{ rows: any[]; rowCount?: number | null }>;
}

export const EVIDENCE_KEY = "value_evidence";
const MAX_BODY_BYTES = 512 * 1024;
const MAX_JSON_FIELD_BYTES = 64 * 1024;
const MAX_EVIDENCE_RECORDS = 400;

export async function loadPolicyValueRows(db: Db, agentId: string) {
  const r = await db.query(
    `SELECT id, name, policyholder_name, insurer, policy_name, insurance_type, status, extracted_data
       FROM clients
      WHERE agent_id = $1 AND insurance_type IN ('life', 'term')
      ORDER BY created_at DESC`,
    [agentId]
  );
  return r.rows;
}

export type FieldError = { field: string; reason: string };

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const bytes = (v: unknown) => Buffer.byteLength(JSON.stringify(v ?? null), "utf8");

/**
 * Validate and normalise the keys of a patch that differ from what is stored.
 * Unchanged keys pass through untouched, whatever they hold.
 */
export function validatePatch(
  insuranceType: string, stored: Record<string, any>, patch: Record<string, any>
): { clean: Record<string, any>; errors: FieldError[] } {
  const errors: FieldError[] = [];
  const clean: Record<string, any> = {};
  const fields = isDataEntryType(insuranceType) ? EXTRACTION_FIELDS[insuranceType] : [];
  const typeOf = new Map(fields.map((f) => [f.key, f.type]));
  for (const [key, value] of Object.entries(patch)) {
    if (key === "_rev" || key === EVIDENCE_KEY) continue; // handled by the caller
    if (same(stored[key], value)) { clean[key] = stored[key]; continue; }
    const type = typeOf.get(key);
    if (value === null || value === "") { clean[key] = null; continue; }
    // Strict values for life and term, whose numbers drive surrender values.
    // Other lines keep their previous behaviour; tightening them is a separate change.
    if (insuranceType !== "life" && insuranceType !== "term") {
      if (bytes(value) > MAX_JSON_FIELD_BYTES) { errors.push({ field: key, reason: "too_large" }); continue; }
      clean[key] = value;
      continue;
    }
    if (type === "number") {
      const p = parseRupees(value);
      if (!p.ok) { errors.push({ field: key, reason: p.reason }); continue; }
      clean[key] = p.value;
    } else if (type === "date") {
      const p = parseIsoDate(value);
      if (!p.ok) { errors.push({ field: key, reason: p.reason }); continue; }
      clean[key] = p.value;
    } else if (type === "json" || (value && typeof value === "object")) {
      if (typeof value !== "object" || Array.isArray(value)) { errors.push({ field: key, reason: "not_an_object" }); continue; }
      if (bytes(value) > MAX_JSON_FIELD_BYTES) { errors.push({ field: key, reason: "too_large" }); continue; }
      clean[key] = value;
    } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      if (typeof value === "string" && value.length > 2000) { errors.push({ field: key, reason: "too_large" }); continue; }
      clean[key] = value;
    } else {
      errors.push({ field: key, reason: "unsupported_value" });
    }
  }
  return { clean, errors };
}

const recordList = (v: unknown): any[] => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object" && typeof r.id === "string") : []);

/**
 * Merge advisor evidence record by record. Stored records always survive,
 * byte for byte: a record is never edited, only superseded by a new one.
 * New records (ids not seen before) are appended. The single-value parts
 * (the details check, an entered factor table, the plan type choice) take the
 * incoming value; the revision check is what protects those.
 */
export function mergeEvidence(stored: unknown, incoming: unknown): { evidence: Record<string, any> | null; error: string | null } {
  if (incoming === null || incoming === undefined) return { evidence: (stored as any) ?? null, error: null };
  if (typeof incoming !== "object" || Array.isArray(incoming)) return { evidence: null, error: "evidence_not_an_object" };
  const inc = incoming as Record<string, any>;
  if (inc.schema !== 1) return { evidence: null, error: "evidence_schema_unknown" };
  const st = (stored && typeof stored === "object" ? stored : { schema: 1 }) as Record<string, any>;
  const out: Record<string, any> = { ...st, schema: 1 };
  for (const key of ["payments", "loans", "quotes"]) {
    const kept = recordList(st[key]);
    const seen = new Set(kept.map((r) => r.id));
    const added = recordList(inc[key]).filter((r) => !seen.has(r.id));
    if (kept.length + added.length > MAX_EVIDENCE_RECORDS) return { evidence: null, error: "too_many_records" };
    out[key] = [...kept, ...added];
  }
  for (const key of ["inputCheck", "rules", "shape"]) {
    if (key in inc) out[key] = inc[key];
  }
  if (bytes(out) > MAX_BODY_BYTES) return { evidence: null, error: "too_large" };
  return { evidence: out, error: null };
}

export interface SaveDeps {
  deriveSharedColumns: (type: string, data: Record<string, any>) => Record<string, any>;
  scoreFromExtractedData: (type: string, data: Record<string, any>) => number | null;
}

export interface SaveResult {
  status: number;
  body: Record<string, any>;
}

export async function saveExtractedData(
  db: Db, agentId: string, clientId: string, reqBody: unknown, deps: SaveDeps
): Promise<SaveResult> {
  const body = (reqBody && typeof reqBody === "object" ? reqBody : {}) as Record<string, any>;
  const patch = body.extracted_data;
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return { status: 400, body: { error: "extracted_data object required" } };
  }
  if (bytes(patch) > MAX_BODY_BYTES) return { status: 413, body: { error: "Too much data in one save." } };

  const owner = await db.query(
    "SELECT insurance_type, extracted_data FROM clients WHERE id = $1 AND agent_id = $2",
    [clientId, agentId]
  );
  if (owner.rows.length === 0) return { status: 404, body: { error: "Client not found" } };

  const insuranceType = owner.rows[0].insurance_type;
  const stored = (owner.rows[0].extracted_data ?? {}) as Record<string, any>;
  const storedRev = Number.isInteger(stored._rev) ? stored._rev : 0;
  const expectedRev = Number.isInteger(body.expected_rev) ? (body.expected_rev as number) : null;
  if (expectedRev !== null && expectedRev !== storedRev) {
    return { status: 409, body: { error: "STALE", message: "This policy was changed somewhere else. Reload it and try again.", rev: storedRev } };
  }

  const { clean, errors } = validatePatch(insuranceType, stored, patch);
  if (errors.length) {
    return { status: 400, body: { error: "INVALID_FIELDS", message: "Some values are not in a format we can read.", fields: errors } };
  }

  const merged: Record<string, any> = mergeExtractedData(stored, clean);
  if (EVIDENCE_KEY in patch && expectedRev !== null) {
    const m = mergeEvidence(stored[EVIDENCE_KEY], patch[EVIDENCE_KEY]);
    if (m.error) return { status: 400, body: { error: "INVALID_EVIDENCE", message: m.error } };
    merged[EVIDENCE_KEY] = m.evidence;
  } else if (EVIDENCE_KEY in stored) {
    // An older client resending its loaded copy cannot rewrite evidence.
    merged[EVIDENCE_KEY] = stored[EVIDENCE_KEY];
  }
  merged._rev = storedRev + 1;

  const shared = deps.deriveSharedColumns(insuranceType, merged);
  const motorScore = deps.scoreFromExtractedData(insuranceType, merged);
  const upd = await db.query(
    `UPDATE clients SET
      extracted_data = $1,
      insurer = $2,
      policy_name = $3,
      expiry_date = $4,
      sum_insured = $5,
      policyholder_name = COALESCE($6, policyholder_name),
      score = CASE WHEN $9 = 'motor' THEN $10::int ELSE score END
    WHERE id = $7 AND agent_id = $8
      AND COALESCE((extracted_data->>'_rev')::int, 0) = $11`,
    [
      JSON.stringify(merged),
      shared.insurer ?? null,
      shared.policy_name ?? null,
      shared.expiry_date ?? null,
      shared.sum_insured ?? null,
      shared.policyholder_name ?? null,
      clientId,
      agentId,
      insuranceType,
      motorScore,
      storedRev,
    ]
  );
  if ((upd.rowCount ?? 0) === 0) {
    return { status: 409, body: { error: "STALE", message: "This policy was changed somewhere else. Reload it and try again." } };
  }
  return { status: 200, body: { ok: true, extracted_data: merged, rev: merged._rev } };
}

/* ── Changing a policy between life and term ─────────────────────────────
   Body of PATCH /api/agent/clients/:id/insurance-type, { to: "life" | "term" }.
   Only between life and term: the same read lane and the same document, so
   nothing is re-read, no check is used and no model is called. Health or motor
   to life would need a different read, and is refused.

   The stored read is kept exactly as it is. The two field lists differ (the
   term read never asks for maturity amount, payouts, bonus or fund value), so
   life to term keeps those keys and the term form simply does not show them;
   term to life shows them as not read. expiry_date is re-derived from the new
   type's own date (maturity date for life, cover end date for term), falling
   back to the other one, so the list's date column never goes blank. */

export const LIFE_LANE_TYPES = ["life", "term"] as const;
export type LifeLaneType = (typeof LIFE_LANE_TYPES)[number];

const filled = (v: unknown) => v !== null && v !== undefined && v !== "";

/** The date `clients.expiry_date` should hold for this type. */
export function lifeLaneExpiry(to: LifeLaneType, data: Record<string, any>, current: unknown): unknown {
  const own = to === "life" ? data.maturity_date : data.cover_end_date;
  const other = to === "life" ? data.cover_end_date : data.maturity_date;
  if (filled(own)) return own;
  if (filled(other)) return other;
  return current ?? null;
}

export async function changeInsuranceType(
  db: Db, agentId: string, clientId: string, reqBody: unknown,
  deps: Pick<SaveDeps, "deriveSharedColumns">
): Promise<SaveResult> {
  const body = (reqBody && typeof reqBody === "object" ? reqBody : {}) as Record<string, any>;
  const to = body.to;
  if (to !== "life" && to !== "term") {
    return { status: 400, body: { error: "INVALID_TYPE", message: "A policy can only be changed to life or term." } };
  }
  const owner = await db.query(
    "SELECT insurance_type, extracted_data, expiry_date FROM clients WHERE id = $1 AND agent_id = $2",
    [clientId, agentId]
  );
  if (owner.rows.length === 0) return { status: 404, body: { error: "Client not found" } };
  const from = String(owner.rows[0].insurance_type ?? "");
  if (from !== "life" && from !== "term") {
    return {
      status: 409,
      body: { error: "NOT_LIFE_LANE", message: "Only a life or term policy can be changed between life and term. Upload the document again with the right type." },
    };
  }
  const stored = (owner.rows[0].extracted_data ?? {}) as Record<string, any>;
  if (from === to) return { status: 200, body: { ok: true, insurance_type: to, changed: false } };

  const storedRev = Number.isInteger(stored._rev) ? stored._rev : 0;
  const next: Record<string, any> = { ...stored, _rev: storedRev + 1 };
  const shared = deps.deriveSharedColumns(to, next);
  const expiry = lifeLaneExpiry(to, next, owner.rows[0].expiry_date);
  const upd = await db.query(
    `UPDATE clients SET
      insurance_type = $1,
      extracted_data = $2,
      expiry_date = $3,
      insurer = COALESCE($4, insurer),
      policy_name = COALESCE($5, policy_name),
      sum_insured = COALESCE($6, sum_insured)
    WHERE id = $7 AND agent_id = $8 AND insurance_type = $9
      AND COALESCE((extracted_data->>'_rev')::int, 0) = $10`,
    [to, JSON.stringify(next), expiry ?? null, shared.insurer ?? null, shared.policy_name ?? null,
     shared.sum_insured ?? null, clientId, agentId, from, storedRev]
  );
  if ((upd.rowCount ?? 0) === 0) {
    return { status: 409, body: { error: "STALE", message: "This policy was changed somewhere else. Reload it and try again." } };
  }
  return { status: 200, body: { ok: true, insurance_type: to, changed: true, rev: next._rev } };
}
