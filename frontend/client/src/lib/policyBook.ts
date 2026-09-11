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
import {
  computePolicyValue, isValueGap, isoDate, policyDate,
  type PlanShape, type PremiumStatus, type ValueRow,
} from "./policyValue";

export type ValueAction =
  | "lapsed"        // gone reduced paid-up — revivable, but only until a date
  | "overdue"       // a premium is late but the policy is still on risk
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
  /** Payouts already handed over — kept regardless of what happens next. */
  receivedSoFar: number;
  valueToday: number;
  valueNextYear: number | null;
  /** Everything the customer ends up with by maturity: the maturity benefit
   *  plus every payout the plan makes along the way. */
  totalAtMaturity: number;
  /** Every premium the policy will ever ask for — the figure the maturity
   *  total has to be judged against, not just what has been paid so far. */
  premiumsPayable: number;
  /** valueNextYear - valueToday. */
  uplift: number;
  upliftPct: number;
  deferredTo: string | null;
  premiumStatus: PremiumStatus;
  premiumStatusNote: string | null;
  /** Annual return (XIRR where dates resolve) if exited today, and if held to the end. */
  irrToday: number | null;
  irrAtMaturity: number | null;
  /**
   * What the customer could raise against this policy without ending it. The
   * question behind almost every surrender is "I need money", and this is the
   * answer that keeps the cover, and the renewal, alive.
   */
  canBorrow: number;
  /** Loan rate, where a reference yield has been set on the policy. */
  loanRatePct: number | null;
  /** Cost to bring a lapsed policy back, and the date after which it cannot be. */
  revivalPayable: number | null;
  revivalDeadline: string | null;
  revivalExpired: boolean;
  /** Share of the benefits still standing. Below 1 once the premiums stopped. */
  paidUpFactor: number;
  action: ValueAction;
  headline: string;
}

/** Which policy year a policy is in on a given date (1-based, in progress). */
export function policyYearOn(startDate: string | null, asOf = new Date()): number | null {
  const start = policyDate(startDate);
  if (!start) return null;
  let years = asOf.getFullYear() - start.getFullYear();
  const anniversaryThisYear = new Date(start);
  anniversaryThisYear.setFullYear(start.getFullYear() + years);
  if (anniversaryThisYear > asOf) years -= 1;
  return years + 1;
}

export function anniversaryAfter(startDate: string | null, completedYears: number): string | null {
  if (!startDate) return null;
  const d = policyDate(startDate);
  if (!d) return null;
  d.setFullYear(d.getFullYear() + completedYears);
  return isoDate(d);
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
  // The policy year comes off the start date alone, so we can ask for exactly
  // the two returns this row shows in a single pass. Solving all twenty years
  // for a book of a thousand policies is seconds of blocked main thread.
  const year = policyYearOn(data?.start_date ?? null) ?? 1;
  const result = computePolicyValue(row.insurance_type ?? "life", data, {
    returnYears: [year],
  });
  if (isValueGap(result)) return null;
  const clamped = Math.min(Math.max(year, 1), result.term);
  const today: ValueRow = result.rows[clamped - 1];
  const next: ValueRow | null = clamped < result.term ? result.rows[clamped] : null;

  const uplift = next ? next.back - today.back : 0;
  const upliftPct = next && today.back > 0 ? (uplift / today.back) * 100 : 0;

  let action: ValueAction = "steady";
  // A policy that has actually gone paid-up is a different job from one whose
  // premium is a fortnight late: the first needs reviving before a deadline, the
  // second needs a phone call before it becomes the first.
  if (result.premiumStatus === "paid_up") action = "lapsed";
  else if (result.premiumStatus === "overdue") action = "overdue";
  else if (result.shape === "pure_term") action = "none";
  else if (clamped >= result.term - 1) action = "maturing";
  else if (today.deferredTo) action = "locked";
  // Payouts already banked are the customer's money too. Judging the surrender
  // value on its own labels every money-back plan underwater the moment those
  // payouts start, which is exactly when it is doing what it was sold to do.
  else if (today.back + today.received < today.paid && clamped >= result.term / 2) action = "underwater";
  else if (upliftPct >= 15) action = "jumps";

  const nextAnniversary = anniversaryAfter(data?.start_date ?? null, clamped);

  const rev = result.revival;
  /* The borrowing line, appended wherever it is the more useful answer. Almost
     every surrender starts as "I need money", and an advisor who can say what
     the policy will lend has a second answer to give. */
  const borrow =
    result.loan.available > 0 ? ` Can borrow ${rupee(result.loan.available)} without ending it.` : "";

  const headline = (() => {
    switch (action) {
      case "none":
        return "No surrender value — term cover.";
      case "locked":
        return `Locked in. Nothing payable before ${today.deferredTo}.`;
      case "lapsed":
        if (rev?.expired) {
          return `Lapsed and past the revival window that closed ${rev.deadline}. Benefits are down to ${Math.round(result.paidUpFactor * 100)}% for good.`;
        }
        return (
          `Lapsed: benefits are down to ${Math.round(result.paidUpFactor * 100)}%. ` +
          `Revive for ${rupee(rev?.payable ?? 0)}${rev?.interest === null ? " plus interest" : ""}` +
          `${rev?.deadline ? ` by ${rev.deadline}` : ""}.`
        );
      case "overdue":
        return rev && rev.arrears > 0
          ? `${rupee(rev.arrears)} of premium is overdue. Pay it before the policy goes paid-up.`
          : result.premiumStatusNote ?? "Premiums are not up to date.";
      case "underwater":
        return `Still ${rupee(today.paid - today.back - today.received)} below the premiums paid, past halfway through the term.` + borrow;
      case "jumps":
        return `Goes up ${rupee(uplift)} on ${nextAnniversary ?? "the next anniversary"} — worth waiting.` + borrow;
      case "maturing":
        return `Maturing: ${rupee(result.rows[result.term - 1].back)} due.`;
      default:
        return `Worth ${rupee(today.back)} today.` + borrow;
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
    receivedSoFar: today.received,
    valueToday: today.back,
    valueNextYear: next ? next.back : null,
    premiumsPayable: result.totalPremiums,
    totalAtMaturity: (() => {
      const end = result.rows[result.term - 1];
      return end.received + end.back;
    })(),
    uplift,
    upliftPct,
    deferredTo: today.deferredTo,
    premiumStatus: result.premiumStatus,
    premiumStatusNote: result.premiumStatusNote,
    irrToday: today.xirr ?? today.irr,
    irrAtMaturity: result.xirrAtMaturity ?? result.irrAtMaturity,
    canBorrow: result.loan.available,
    loanRatePct: result.loan.ratePct,
    revivalPayable: rev ? rev.payable : null,
    revivalDeadline: rev ? rev.deadline : null,
    revivalExpired: rev ? rev.expired : false,
    paidUpFactor: result.paidUpFactor,
    action,
    headline,
  };
}

/** Order the agent should work the list in. */
export const ACTION_ORDER: ValueAction[] = ["lapsed", "overdue", "maturing", "jumps", "underwater", "steady", "locked", "none"];

export const ACTION_META: Record<ValueAction, { label: string; tone: string; blurb: string }> = {
  lapsed: {
    label: "Lapsed",
    tone: "border-rose-300 bg-rose-100 text-rose-900",
    blurb:
      "The premiums stopped, so the policy is reduced paid-up: the values shown are what is actually " +
      "left, not what it would have been worth. It can be brought back to full benefit by paying the " +
      "arrears, but only until the revival window closes.",
  },
  overdue: {
    label: "Premiums overdue",
    tone: "border-rose-200 bg-rose-50 text-rose-800",
    blurb:
      "The premium is past its grace period but the policy has not gone paid-up yet, so the benefits " +
      "below still stand. Call before it does.",
  },
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
    label: "Below premiums paid",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
    blurb:
      "Past halfway and the surrender value is still under the premiums paid. Normal for these products " +
      "early on, worth a conversation this late.",
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
