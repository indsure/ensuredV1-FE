/**
 * Evidence an advisor records about one life policy: premiums paid, the loan
 * position, figures quoted by the insurer, a check that the details on file
 * match the policy document, and a factor table typed in from the wording.
 *
 * Stored inside `clients.extracted_data.value_evidence` (versioned JSON, no
 * schema change). Records are never edited in place: a correction is a new
 * record that `supersedes` the old one, and removing a record is a correction
 * marked `voided`. So the history of what changed is always kept.
 *
 * Every record says where it came from. Something the advisor typed is
 * "self reported" unless they mark it as copied from an insurer document, and
 * even then it is the advisor's copy of that document, which the screen says.
 *
 * Imports only ./policyNumbers and ./productRules, so it can be copied to the bot.
 */

import { parseIsoDate, parseRupees } from "./policyNumbers";
import { validateRuleSet, type RuleSet } from "./productRules";

export const EVIDENCE_KEY = "value_evidence";
export const EVIDENCE_SCHEMA = 1;

/** Hard ceiling on records per list, so a runaway client cannot bloat the row. */
export const MAX_RECORDS = 400;

export type Confirmation = "self_reported" | "insurer_document";

interface RecordBase {
  id: string;
  /** Calendar date the advisor entered it. */
  enteredOn: string;
  origin: "agent_entered";
  confirmation: Confirmation;
  /** Receipt number, statement number or similar. Text only, no file. */
  reference: string | null;
  note: string | null;
  /** The record this one corrects. */
  supersedes: string | null;
  /** True when this correction removes the record it supersedes. */
  voided: boolean;
}

export interface PaymentRecord extends RecordBase {
  kind: "payment";
  amount: number;
  currency: "INR";
  /** The instalment due date this payment covers. */
  dueDate: string;
  paidOn: string;
}

export interface LoanRecord extends RecordBase {
  kind: "loan";
  /** "none" is a confirmed absence of any loan, as of the date. */
  status: "none" | "outstanding";
  principal: number | null;
  /** Interest accrued and unpaid. Null means not known. */
  interest: number | null;
  asOf: string;
}

/**
 * What a dated figure from the insurer says.
 * - surrender_payable: the amount the insurer said would be paid on surrender.
 * - loan_available: the amount the insurer said could still be borrowed.
 * - policy_status: in force, lapsed, paid up and so on.
 * - premiums_paid_to: premiums are paid up to `paidTo`. One record covers
 *   every instalment due on or before that date, so a 15-year monthly policy
 *   does not need 180 payment entries.
 */
export type QuoteType = "surrender_payable" | "loan_available" | "policy_status" | "premiums_paid_to";
export type QuotedStatus = "in_force" | "lapsed" | "paid_up" | "surrendered" | "matured";

export interface QuoteRecord extends RecordBase {
  kind: "quote";
  quoteType: QuoteType;
  amount: number | null;
  status: QuotedStatus | null;
  /** For premiums_paid_to: the date premiums are paid up to. */
  paidTo: string | null;
  /** The date of the statement or quote the figure comes from. */
  quoteDate: string;
}

/** Snapshot of the details the advisor confirmed against the document. */
export interface InputCheck {
  checkedOn: string;
  fields: Record<string, string | number | null>;
}

export type ShapeChoiceValue =
  | "pure_term" | "return_of_premium" | "endowment" | "money_back" | "unit_linked" | "other";

export interface ValueEvidence {
  schema: 1;
  payments: PaymentRecord[];
  loans: LoanRecord[];
  quotes: QuoteRecord[];
  inputCheck: InputCheck | null;
  /** A factor table typed in by the advisor. Never "verified", whatever it says. */
  rules: RuleSet | null;
  shape: { value: ShapeChoiceValue; enteredOn: string } | null;
}

export type EvidenceIssue =
  | "evidence_not_an_object"
  | "evidence_schema_unknown"
  | "payment_invalid"
  | "loan_invalid"
  | "quote_invalid"
  | "input_check_invalid"
  | "rules_invalid"
  | "shape_invalid"
  | "too_many_records";

export function emptyEvidence(): ValueEvidence {
  return { schema: 1, payments: [], loans: [], quotes: [], inputCheck: null, rules: null, shape: null };
}

const str = (v: unknown, max = 120): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
const date = (v: unknown): string | null => {
  const p = parseIsoDate(v);
  return p.ok ? p.value : null;
};
const money = (v: unknown): number | null => {
  const p = parseRupees(v);
  return p.ok ? p.value : null;
};

function base(r: any): RecordBase | null {
  const id = str(r?.id, 64);
  const enteredOn = date(r?.enteredOn);
  if (!id || !enteredOn) return null;
  return {
    id, enteredOn,
    origin: "agent_entered",
    confirmation: r.confirmation === "insurer_document" ? "insurer_document" : "self_reported",
    reference: str(r.reference),
    note: str(r.note, 280),
    supersedes: str(r.supersedes, 64),
    voided: r.voided === true,
  };
}

function readPayment(r: any): PaymentRecord | null {
  const b = base(r);
  if (!b) return null;
  if (b.voided) {
    return b.supersedes ? { ...b, kind: "payment", amount: 0, currency: "INR", dueDate: b.enteredOn, paidOn: b.enteredOn } : null;
  }
  const amount = money(r.amount);
  const dueDate = date(r.dueDate);
  const paidOn = date(r.paidOn);
  if (amount === null || amount <= 0 || !dueDate || !paidOn) return null;
  return { ...b, kind: "payment", amount, currency: "INR", dueDate, paidOn };
}

function readLoan(r: any): LoanRecord | null {
  const b = base(r);
  if (!b) return null;
  const asOf = date(r.asOf);
  if (!asOf) return null;
  if (r.status === "none") return { ...b, kind: "loan", status: "none", principal: 0, interest: 0, asOf };
  if (r.status !== "outstanding") return null;
  const principal = money(r.principal);
  if (principal === null || principal <= 0) return null;
  const interest = r.interest === null || r.interest === undefined || r.interest === "" ? null : money(r.interest);
  if (interest === null && r.interest !== null && r.interest !== undefined && r.interest !== "") return null;
  return { ...b, kind: "loan", status: "outstanding", principal, interest, asOf };
}

function readQuote(r: any): QuoteRecord | null {
  const b = base(r);
  if (!b) return null;
  const quoteDate = date(r.quoteDate);
  if (!quoteDate) return null;
  if (r.quoteType === "policy_status") {
    const s = r.status;
    if (!["in_force", "lapsed", "paid_up", "surrendered", "matured"].includes(s)) return null;
    return { ...b, kind: "quote", quoteType: "policy_status", amount: null, status: s, paidTo: null, quoteDate };
  }
  if (r.quoteType === "premiums_paid_to") {
    const paidTo = date(r.paidTo);
    if (!paidTo || paidTo > quoteDate) return null;
    return { ...b, kind: "quote", quoteType: "premiums_paid_to", amount: null, status: null, paidTo, quoteDate };
  }
  if (r.quoteType !== "surrender_payable" && r.quoteType !== "loan_available") return null;
  const amount = money(r.amount);
  if (amount === null) return null;
  return { ...b, kind: "quote", quoteType: r.quoteType, amount, status: null, paidTo: null, quoteDate };
}

/**
 * Read the stored evidence. Anything malformed is dropped and reported, never
 * guessed at, and a broken record cannot take the rest of the policy down.
 */
export function readEvidence(raw: unknown): { evidence: ValueEvidence; issues: EvidenceIssue[] } {
  const issues = new Set<EvidenceIssue>();
  const ev = emptyEvidence();
  if (raw === null || raw === undefined) return { evidence: ev, issues: [] };
  if (typeof raw !== "object" || Array.isArray(raw)) return { evidence: ev, issues: ["evidence_not_an_object"] };
  const r = raw as any;
  if (r.schema !== EVIDENCE_SCHEMA) return { evidence: ev, issues: ["evidence_schema_unknown"] };

  const list = <T,>(v: unknown, read: (x: any) => T | null, issue: EvidenceIssue): T[] => {
    if (!Array.isArray(v)) return [];
    if (v.length > MAX_RECORDS) issues.add("too_many_records");
    const out: T[] = [];
    for (const x of v.slice(0, MAX_RECORDS)) {
      const ok = read(x);
      if (ok) out.push(ok);
      else issues.add(issue);
    }
    return out;
  };
  ev.payments = list(r.payments, readPayment, "payment_invalid");
  ev.loans = list(r.loans, readLoan, "loan_invalid");
  ev.quotes = list(r.quotes, readQuote, "quote_invalid");

  if (r.inputCheck) {
    const checkedOn = date(r.inputCheck.checkedOn);
    const fields = r.inputCheck.fields;
    if (checkedOn && fields && typeof fields === "object" && !Array.isArray(fields)) {
      const clean: Record<string, string | number | null> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (v === null || typeof v === "string" || (typeof v === "number" && Number.isFinite(v))) clean[k] = v as any;
      }
      ev.inputCheck = { checkedOn, fields: clean };
    } else issues.add("input_check_invalid");
  }

  if (r.rules) {
    const v = validateRuleSet(r.rules);
    // Whatever the stored status says, a table typed in here is the advisor's.
    if (v.rules) ev.rules = { ...v.rules, review: { status: "agent_entered", by: null, on: v.rules.review.on ?? null } };
    else issues.add("rules_invalid");
  }

  if (r.shape) {
    const value = r.shape.value;
    const enteredOn = date(r.shape.enteredOn);
    if (["pure_term", "return_of_premium", "endowment", "money_back", "unit_linked", "other"].includes(value) && enteredOn) {
      ev.shape = { value, enteredOn };
    } else issues.add("shape_invalid");
  }
  return { evidence: ev, issues: Array.from(issues) };
}

/** Records still in force: not superseded by a later record, and not voids themselves. */
export function activeRecords<T extends RecordBase>(records: T[]): T[] {
  const superseded = new Set(records.map((r) => r.supersedes).filter(Boolean) as string[]);
  return records.filter((r) => !superseded.has(r.id) && !r.voided);
}

/** The most recent active record by its own date, then by entry order. */
function latest<T extends RecordBase>(records: T[], dateOf: (r: T) => string): T | null {
  const active = activeRecords(records);
  let best: T | null = null;
  for (const r of active) if (!best || dateOf(r) >= dateOf(best)) best = r;
  return best;
}

export const currentLoan = (ev: ValueEvidence) => latest(ev.loans, (r) => r.asOf);
export const latestQuote = (ev: ValueEvidence, type: QuoteType) =>
  latest(ev.quotes.filter((q) => q.quoteType === type), (r) => r.quoteDate);
export const activePayments = (ev: ValueEvidence) => activeRecords(ev.payments);

export function newRecordId(): string {
  const c: any = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

type NewInput<T> = Omit<T, "id" | "kind" | "enteredOn" | "origin" | "supersedes" | "voided">;

function append<K extends "payments" | "loans" | "quotes">(
  ev: ValueEvidence, key: K, rec: ValueEvidence[K][number]
): ValueEvidence {
  const list = ev[key] as any[];
  if (list.length >= MAX_RECORDS) throw new Error("too_many_records");
  return { ...ev, [key]: [...list, rec] };
}

/** Add a record, or correct one by superseding it. Returns a new store; the input is untouched. */
export function addPayment(ev: ValueEvidence, input: NewInput<PaymentRecord>, today: string, supersedes: string | null = null): ValueEvidence {
  return append(ev, "payments", { ...input, kind: "payment", id: newRecordId(), enteredOn: today, origin: "agent_entered", supersedes, voided: false });
}
export function addLoan(ev: ValueEvidence, input: NewInput<LoanRecord>, today: string, supersedes: string | null = null): ValueEvidence {
  return append(ev, "loans", { ...input, kind: "loan", id: newRecordId(), enteredOn: today, origin: "agent_entered", supersedes, voided: false });
}
export function addQuote(ev: ValueEvidence, input: NewInput<QuoteRecord>, today: string, supersedes: string | null = null): ValueEvidence {
  return append(ev, "quotes", { ...input, kind: "quote", id: newRecordId(), enteredOn: today, origin: "agent_entered", supersedes, voided: false });
}

/** Remove a record without losing it: a void that supersedes it. */
export function voidRecord(ev: ValueEvidence, key: "payments" | "loans" | "quotes", id: string, today: string, note: string | null): ValueEvidence {
  const target = (ev[key] as RecordBase[]).find((r) => r.id === id);
  if (!target) return ev;
  const v: any = { ...target, id: newRecordId(), enteredOn: today, supersedes: id, voided: true, note };
  return append(ev, key, v);
}
