/**
 * Book-wide surrender values.
 *
 * One policy at a time is a research task; a thousand of them is the actual job.
 * An agent cannot open a thousand detail pages to find out which clients are
 * sitting on money, which are locked in, and which would lose by surrendering
 * today — and every one of those answers moves on the policy anniversary.
 *
 * This works the whole book out at once, from data already extracted, and sorts
 * it by what the agent should do about it. Same arithmetic as lib/policyValue,
 * just applied across every life and term policy and anchored to today's date.
 */

import { supabase } from "./supabase";
import { computePolicyValue, isValueGap, type PlanShape, type ValueRow } from "./policyValue";

export type ValueAction =
  | "maturing"      // money is about to land — reinvestment conversation
  | "jumps"         // surrender value steps up materially at the next anniversary
  | "underwater"    // surrendering today returns less than has been paid in
  | "locked"        // nothing is payable yet
  | "none"          // pure term: there is no surrender value, ever
  | "steady";

export interface PolicyValueSummary {
  id: string;
  clientName: string;
  insurer: string | null;
  planName: string | null;
  shape: PlanShape;
  policyYear: number;
  term: number;
  /** Anniversary that starts the next policy year. */
  nextAnniversary: string | null;
  paidSoFar: number;
  valueToday: number;
  valueNextYear: number | null;
  /** valueNextYear - valueToday. */
  uplift: number;
  upliftPct: number;
  deferredTo: string | null;
  /** Annual return if exited today, and if held to the end. */
  irrToday: number | null;
  irrAtMaturity: number | null;
  action: ValueAction;
  headline: string;
}

/** Which policy year a policy is in on a given date (1-based, in progress). */
export function policyYearOn(startDate: string | null, asOf = new Date()): number | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return null;
  let years = asOf.getFullYear() - start.getFullYear();
  const anniversaryThisYear = new Date(start);
  anniversaryThisYear.setFullYear(start.getFullYear() + years);
  if (anniversaryThisYear > asOf) years -= 1;
  return years + 1;
}

export function anniversaryAfter(startDate: string | null, completedYears: number): string | null {
  if (!startDate) return null;
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + completedYears);
  return d.toISOString().slice(0, 10);
}

const rupee = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export function summarisePolicy(row: {
  id: string;
  policyholder_name?: string | null;
  name?: string | null;
  insurer?: string | null;
  policy_name?: string | null;
  insurance_type?: string | null;
  extracted_data?: Record<string, any> | null;
}): PolicyValueSummary | null {
  const data = row.extracted_data ?? null;
  const result = computePolicyValue(row.insurance_type ?? "life", data);
  if (isValueGap(result)) return null;

  const year = policyYearOn(data?.start_date ?? null) ?? 1;
  const clamped = Math.min(Math.max(year, 1), result.term);
  const today: ValueRow = result.rows[clamped - 1];
  const next: ValueRow | null = clamped < result.term ? result.rows[clamped] : null;

  const uplift = next ? next.back - today.back : 0;
  const upliftPct = next && today.back > 0 ? (uplift / today.back) * 100 : 0;

  let action: ValueAction = "steady";
  if (result.shape === "pure_term") action = "none";
  else if (clamped >= result.term - 1) action = "maturing";
  else if (today.deferredTo) action = "locked";
  else if (today.back < today.paid) action = "underwater";
  else if (upliftPct >= 15) action = "jumps";

  const nextAnniversary = anniversaryAfter(data?.start_date ?? null, clamped);

  const headline = (() => {
    switch (action) {
      case "none":
        return "No surrender value — term cover.";
      case "locked":
        return `Locked in. Nothing payable before ${today.deferredTo}.`;
      case "underwater":
        return `Surrendering now loses ${rupee(today.paid - today.back)} against premiums paid.`;
      case "jumps":
        return `Goes up ${rupee(uplift)} on ${nextAnniversary ?? "the next anniversary"} — worth waiting.`;
      case "maturing":
        return `Maturing: ${rupee(result.rows[result.term - 1].back)} due.`;
      default:
        return `Worth ${rupee(today.back)} today.`;
    }
  })();

  return {
    id: row.id,
    clientName: row.policyholder_name || row.name || "Unnamed",
    insurer: row.insurer ?? null,
    planName: row.policy_name ?? null,
    shape: result.shape,
    policyYear: clamped,
    term: result.term,
    nextAnniversary,
    paidSoFar: today.paid,
    valueToday: today.back,
    valueNextYear: next ? next.back : null,
    uplift,
    upliftPct,
    deferredTo: today.deferredTo,
    irrToday: today.irr,
    irrAtMaturity: result.irrAtMaturity,
    action,
    headline,
  };
}

/** Order the agent should work the list in. */
export const ACTION_ORDER: ValueAction[] = ["maturing", "jumps", "underwater", "steady", "locked", "none"];

export const ACTION_META: Record<ValueAction, { label: string; tone: string; blurb: string }> = {
  maturing: {
    label: "Maturing",
    tone: "border-[#0D9488]/40 bg-[#0D9488]/5 text-[#0f766e]",
    blurb: "Money is about to reach the customer. Call before someone else does.",
  },
  jumps: {
    label: "Steps up soon",
    tone: "border-blue-200 bg-blue-50 text-blue-800",
    blurb: "The surrender value rises materially at the next anniversary. Tell them to wait.",
  },
  underwater: {
    label: "Would lose money",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
    blurb: "Surrendering today returns less than they have paid in. Worth a retention call.",
  },
  steady: {
    label: "Has value",
    tone: "border-slate-200 bg-slate-50 text-slate-700",
    blurb: "Surrenderable today, above what has been paid in.",
  },
  locked: {
    label: "Locked in",
    tone: "border-slate-200 bg-slate-50 text-slate-500",
    blurb: "Nothing is payable yet. No action available.",
  },
  none: {
    label: "Term cover",
    tone: "border-slate-200 bg-slate-50 text-slate-500",
    blurb: "No surrender value at any point. Nothing to track.",
  },
};

export async function fetchPolicyValues(agentId: string): Promise<PolicyValueSummary[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, policyholder_name, insurer, policy_name, insurance_type, extracted_data, status")
    .eq("agent_id", agentId)
    .in("insurance_type", ["life", "term"]);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((r: any) => r.status === "done")
    .map((r: any) => summarisePolicy(r))
    .filter((s): s is PolicyValueSummary => s !== null);
}
