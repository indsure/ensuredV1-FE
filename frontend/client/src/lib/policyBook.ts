/**
 * The whole book of life policies, with what can honestly be said about each.
 *
 * Every life and term policy the advisor holds gets a row, including ones
 * still being read, ones that could not be read, ones missing details, plan
 * types this does not handle, and rows whose data is broken. Each row says
 * why it has no figure and what to do next. Nothing drops out silently.
 *
 * Totals only add up figures that are money the customer can get: dated
 * insurer quotes the advisor entered, and calculations from reviewed product
 * rules on checked details. The two are kept apart and never summed into one
 * "cash available today" number. Every total says how many policies it covers
 * and how many it leaves out, and why.
 *
 * Pure. The data comes from the backend (see fetchPolicyValueRows in the page).
 */

import { addMonthsIso, compareIso, valuationDateIso } from "./policyNumbers";
import { DECISION_FIELDS, valuePolicy, type PolicyValuation, type Reason } from "./policyValue";
import type { RuleSet } from "./productRules";

export interface SourceRow {
  id: string;
  name?: string | null;
  policyholder_name?: string | null;
  insurer?: string | null;
  policy_name?: string | null;
  insurance_type?: string | null;
  status?: string | null;
  extracted_data?: Record<string, any> | null;
}

export type RowState =
  | "pending"          // still being read
  | "failed"           // could not be read
  | "error"            // the stored data broke the calculation
  | "unsupported"      // a plan type this does not handle
  | "needs_data"       // details or product terms missing
  | "check_payments"   // premium payments not accounted for
  | "term_cover"       // no surrender value by design
  | "quote_on_file"    // a dated insurer quote the advisor entered
  | "calculated";      // calculated from reviewed rules on checked details

export type NextStep =
  | "wait_for_reading" | "reupload" | "fill_details" | "confirm_plan_type" | "ask_insurer"
  | "check_details" | "record_payments" | "ask_insurer_quote" | "record_loan" | "none" | "review_duplicate" | "confirm_quote";

export type Exclusion =
  | "no_cash_figure" | "duplicate_counted_once" | "duplicate_disputed" | "pending" | "failed" | "error";

export interface BookRow {
  id: string;
  clientName: string;
  insurer: string | null;
  planName: string | null;
  policyNumber: string | null;
  state: RowState;
  valuation: PolicyValuation | null;
  nextStep: NextStep;
  /** The first reason the row has no cash figure, for the row's own message. */
  reason: Reason | null;
  maturingSoon: boolean;
  datePassed: string | null;
  duplicate: { kind: "confirmed" | "disputed"; countedHere: boolean } | null;
  /** Why this row is left out of the cash totals, when it is. */
  excluded: Exclusion | null;
}

export interface Subtotal {
  sum: number;
  count: number;
  /** Oldest as-of date among the figures added, so a stale quote is visible. */
  oldest: string | null;
}

export interface BookTotals {
  rows: number;
  surrender: { calculated: Subtotal; quotes: Subtotal };
  borrow: { calculated: Subtotal; quotes: Subtotal };
  included: number;
  excluded: number;
  excludedBy: Partial<Record<Exclusion, number>>;
  byState: Partial<Record<RowState, number>>;
  maturingSoon: number;
  datePassed: number;
}

const NEXT_STEP_BY_REASON: [Reason, NextStep][] = [
  ["shape_unknown", "confirm_plan_type"],
  ["shape_candidate", "confirm_plan_type"],
  ["shape_unsupported", "ask_insurer"],
  ["premium_missing", "fill_details"],
  ["premium_invalid", "fill_details"],
  ["frequency_missing", "fill_details"],
  ["frequency_unclear", "fill_details"],
  ["term_invalid", "fill_details"],
  ["ppt_invalid", "fill_details"],
  ["start_date_missing", "fill_details"],
  ["start_date_invalid", "fill_details"],
  ["dates_conflict", "fill_details"],
  ["schedule_unknown", "fill_details"],
  ["inputs_changed_since_check", "check_details"],
  ["inputs_not_checked", "check_details"],
  ["payment_records_incomplete", "record_payments"],
  ["status_not_in_force", "ask_insurer"],
  ["loan_position_unknown", "record_loan"],
  ["loan_interest_unknown", "record_loan"],
  ["no_verified_rules", "ask_insurer_quote"],
  ["ulip_ask_insurer", "ask_insurer_quote"],
];

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function classify(row: SourceRow, asOf: string, ruleSets?: RuleSet[]): BookRow {
  const data = row.extracted_data ?? null;
  const out: BookRow = {
    id: row.id,
    clientName: row.policyholder_name || row.name || (data?.policyholder_name as string) || "",
    insurer: row.insurer ?? (data?.insurer as string) ?? null,
    planName: row.policy_name ?? (data?.plan_name as string) ?? null,
    policyNumber: typeof data?.policy_number === "string" && data.policy_number.trim() ? data.policy_number.trim() : null,
    state: "needs_data", valuation: null, nextStep: "fill_details", reason: null,
    maturingSoon: false, datePassed: null, duplicate: null, excluded: null,
  };
  const status = String(row.status ?? "");
  if (status && status !== "done") {
    const failed = status === "error" || status === "failed";
    out.state = failed ? "failed" : "pending";
    out.nextStep = failed ? "reupload" : "wait_for_reading";
    out.excluded = failed ? "failed" : "pending";
    return out;
  }
  let v: PolicyValuation;
  try {
    v = valuePolicy(row.insurance_type ?? "life", data, { asOf, ruleSets });
  } catch {
    // One broken row must never take the book down with it.
    out.state = "error";
    out.nextStep = "fill_details";
    out.excluded = "error";
    return out;
  }
  out.valuation = v;
  if (v.maturityDate && compareIso(v.maturityDate, asOf) > 0 && compareIso(v.maturityDate, addMonthsIso(asOf, 12)) <= 0) {
    out.maturingSoon = true;
  }
  // With nothing recorded, the latest date on file is the one to check; with a
  // gap in the records, the first premium that has no record.
  if (v.payment.state === "date_passed") out.datePassed = v.payment.lastDuePassed;
  else if (v.payment.state === "recorded_gap") out.datePassed = v.payment.firstUncoveredDue;

  const sp = v.values.surrender_payable;
  if (v.shape.status === "unsupported") out.state = "unsupported";
  else if (v.shape.value === "pure_term") out.state = "term_cover";
  else if (v.cash.surrender === "calculated") out.state = "calculated";
  else if (v.cash.surrender === "quote") out.state = "quote_on_file";
  else if (v.shape.value && v.shape.value !== "unit_linked" && !v.payment.upToDate && v.payment.state !== "schedule_unknown") out.state = "check_payments";
  else out.state = "needs_data";

  const reasons: Reason[] = [...sp.missing, ...v.inputIssues.map((i) => (i.reason === "invalid" ? "premium_invalid" : i.reason) as Reason)];
  out.reason = reasons[0] ?? null;
  if (out.state === "term_cover") out.nextStep = "none";
  else if (out.state === "calculated" || out.state === "quote_on_file") {
    out.nextStep = v.values.surrender_payable.basis === "insurer_quote" ? "confirm_quote" : "none";
  } else {
    const hit = NEXT_STEP_BY_REASON.find(([r]) => reasons.includes(r));
    out.nextStep = hit ? hit[1] : out.state === "check_payments" ? "record_payments" : "ask_insurer_quote";
  }
  if (!v.cash.surrender && !v.cash.borrow) out.excluded = "no_cash_figure";
  return out;
}

/** Fingerprint of the details that drive a value, to tell real duplicates from disagreeing copies. */
function fingerprint(r: BookRow, rows: Map<string, SourceRow>): string {
  const d = rows.get(r.id)?.extracted_data ?? {};
  return JSON.stringify(DECISION_FIELDS.map((k) => (d[k] === undefined || d[k] === "" ? null : String(d[k]))));
}

/**
 * Same policy uploaded more than once. Matched on the policy number AND the
 * insurer, within this advisor's own rows only. A name match is never used.
 * Copies that agree are counted once; copies that disagree, or that cannot be
 * tied to one insurer, are left out of every total until someone looks.
 */
function markDuplicates(book: BookRow[], source: SourceRow[]): void {
  const byId = new Map(source.map((s) => [s.id, s]));
  const groups = new Map<string, BookRow[]>();
  for (const r of book) {
    if (!r.policyNumber) continue;
    const k = norm(r.policyNumber);
    if (!k) continue;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const rows of Array.from(groups.values())) {
    if (rows.length < 2) continue;
    const insurers = new Set(rows.map((r) => norm(r.insurer)));
    if (insurers.size > 1 && !insurers.has("")) continue; // same number, different insurers: not the same policy
    const sameInsurer = insurers.size === 1 && !insurers.has("");
    const agree = new Set(rows.map((r) => fingerprint(r, byId))).size === 1;
    const confirmed = sameInsurer && agree;
    const keep = [...rows].sort((a, b) => (a.id < b.id ? -1 : 1))[0].id;
    for (const r of rows) {
      r.duplicate = { kind: confirmed ? "confirmed" : "disputed", countedHere: confirmed && r.id === keep };
      if (!confirmed) {
        r.excluded = "duplicate_disputed";
        r.nextStep = "review_duplicate";
      } else if (r.id !== keep) {
        r.excluded = "duplicate_counted_once";
      }
    }
  }
}

export function buildBook(source: SourceRow[], options: { asOf?: string; ruleSets?: RuleSet[] } = {}): BookRow[] {
  const asOf = options.asOf ?? valuationDateIso();
  const life = source.filter((r) => r.insurance_type === "life" || r.insurance_type === "term");
  const book = life.map((r) => classify(r, asOf, options.ruleSets));
  markDuplicates(book, life);
  return book;
}

const sub = (): Subtotal => ({ sum: 0, count: 0, oldest: null });
const add = (s: Subtotal, amount: number, asOf: string) => {
  s.sum += amount;
  s.count += 1;
  if (!s.oldest || compareIso(asOf, s.oldest) < 0) s.oldest = asOf;
};

export function bookTotals(book: BookRow[]): BookTotals {
  const t: BookTotals = {
    rows: book.length,
    surrender: { calculated: sub(), quotes: sub() },
    borrow: { calculated: sub(), quotes: sub() },
    included: 0, excluded: 0, excludedBy: {}, byState: {}, maturingSoon: 0, datePassed: 0,
  };
  for (const r of book) {
    t.byState[r.state] = (t.byState[r.state] ?? 0) + 1;
    if (r.maturingSoon) t.maturingSoon += 1;
    if (r.datePassed) t.datePassed += 1;
    const dupOut = r.excluded === "duplicate_counted_once" || r.excluded === "duplicate_disputed";
    let counted = false;
    if (!dupOut && r.valuation) {
      const v = r.valuation;
      const sp = v.values.surrender_payable;
      if (v.cash.surrender && sp.amount !== null && sp.asOf) {
        add(v.cash.surrender === "calculated" ? t.surrender.calculated : t.surrender.quotes, sp.amount, sp.asOf);
        counted = true;
      }
      const lr = v.values.loan_remaining;
      if (v.cash.borrow && lr.amount !== null && lr.asOf) {
        add(v.cash.borrow === "calculated" ? t.borrow.calculated : t.borrow.quotes, lr.amount, lr.asOf);
        counted = true;
      }
    }
    if (counted) t.included += 1;
    else {
      t.excluded += 1;
      const why: Exclusion = r.excluded ?? "no_cash_figure";
      t.excludedBy[why] = (t.excludedBy[why] ?? 0) + 1;
    }
  }
  return t;
}

/** Work-list order: what needs the advisor first. */
export const STATE_ORDER: RowState[] = [
  "check_payments", "quote_on_file", "calculated", "needs_data", "failed", "error", "pending", "unsupported", "term_cover",
];
