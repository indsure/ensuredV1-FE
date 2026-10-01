/**
 * The one-glance answer an advisor wants from a policy document, worked out
 * straight from what the reader found, without waiting for review:
 *
 *   premiums paid so far, the guaranteed surrender value today and at the next
 *   premium due date, what is paid at the end, the regular payout, the total the
 *   customer receives over the policy, and the life cover.
 *
 * Stated assumptions, shown on the card:
 *   - every premium due so far was paid on its due date;
 *   - where the document leaves the GSV method open, the insurer's own benefit
 *     illustration method is used, unless the advisor recorded another answer;
 *   - surrender figures are the GUARANTEED surrender value. The insurer pays the
 *     higher of this and the special surrender value, which needs today's rates.
 *
 * An advisor's correction replaces the document's value; a rejected value is
 * not used. Imports sibling pure modules only.
 */

import { documentValues, type ConfirmedFacts } from "./documentRules";
import { addMonthsIso, compareIso } from "./policyNumbers";
import type { Paise } from "./exactMath";
import type { FieldKey, ReviewFlag } from "./policyDocTypes";

export interface SnapshotFieldRow {
  field_key: string;
  revision: number;
  state: string;
  document_field: any;
  corrected_value: any;
}

/** What the insurer's own illustration does, used until the advisor answers. */
export const ILLUSTRATION_DEFAULTS: Record<string, string> = {
  gsv_factor_rounding_not_stated: "whole_percent_as_in_illustration",
  survival_benefit_deduction_timing: "payouts_for_completed_policy_years",
};

const PER_YEAR: Record<string, number> = { annual: 1, half_yearly: 2, quarterly: 4, monthly: 12 };
const paise = (n: number): Paise => ({ paise: n });

export interface PolicySnapshot {
  asOf: string;
  premium: { perInstalment: Paise | null; frequency: string | null; excludesTaxes: boolean; paidCount: number; paidSoFar: Paise | null; totalCount: number; totalPayable: Paise | null; lastDue: string | null };
  gsvToday: Paise | null;
  nextDue: { date: string; gsv: Paise | null } | null;
  atEnd: { date: string | null; maturity: Paise | null; maturityNotApplicable: boolean; finalPayout: Paise | null };
  regularPayout: { amount: Paise; frequency: string; from: string; to: string; count: number } | null;
  totalReceived: Paise | null;
  gainOverPremiums: Paise | null;
  lifeCover: Paise | null;
  usedIllustrationMethod: boolean;
  missing: string[];
}

export function policySnapshot(fields: SnapshotFieldRow[], flags: ReviewFlag[], decisions: Record<string, string>, asOf: string): PolicySnapshot {
  // Every usable value: the advisor's correction, else what the document says.
  const facts: any = {};
  let naMaturity = false;
  for (const f of fields) {
    if (f.state === "rejected") continue;
    if (f.state === "corrected") facts[f.field_key] = { value: f.corrected_value, revision: f.revision, state: "corrected" };
    else if (f.document_field?.state === "found") facts[f.field_key] = { value: f.document_field.value, revision: f.revision, state: "reviewed" };
    if (f.field_key === "benefits.maturity" && f.document_field?.state === "not_applicable" && f.state !== "corrected") naMaturity = true;
  }
  const val = <T,>(k: FieldKey) => facts[k]?.value as T | undefined;
  const flagDecisions: Record<string, string> = {};
  let usedIllustrationMethod = false;
  for (const fl of flags) {
    if (decisions[fl.id]) flagDecisions[fl.id] = decisions[fl.id];
    else if (ILLUSTRATION_DEFAULTS[fl.id] && fl.choices.includes(ILLUSTRATION_DEFAULTS[fl.id])) {
      flagDecisions[fl.id] = ILLUSTRATION_DEFAULTS[fl.id];
      usedIllustrationMethod = true;
    }
  }
  // Points that need the insurer (no choices) do not stop a GSV worked out on stated assumptions.
  const gsvFlags = flags.filter((fl) => fl.id === "gsv_factor_rounding_not_stated" || fl.id === "survival_benefit_deduction_timing");
  const missing: string[] = [];
  const run = (on: string) => documentValues({ facts: facts as ConfirmedFacts, flags: gsvFlags, flagDecisions: flagDecisions as any, evidence: null, asOf: on, assumePremiumsPaidOnDueDates: true });

  // Premium schedule.
  const start = val<string>("schedule.risk_commencement_date") ?? val<string>("schedule.commencement_date") ?? null;
  const ppt = val<number>("schedule.premium_paying_term_years") ?? null;
  const freq = val<string>("schedule.frequency") ?? null;
  const perYear = freq ? PER_YEAR[freq] : undefined;
  const first = val<Paise>("schedule.instalment_premium_first_year") ?? null;
  const renew = val<Paise>("schedule.instalment_premium_renewal") ?? first;
  const dues: string[] = [];
  if (start && ppt && perYear) for (let k = 0; k < ppt * perYear; k++) dues.push(addMonthsIso(start, (k * 12) / perYear));
  else missing.push("premium_schedule");
  const amountFor = (i: number) => (i < (perYear ?? 1) ? first : renew);
  const sum = (n: number) => {
    let t = 0;
    for (let i = 0; i < n; i++) { const a = amountFor(i); if (!a) return null; t += a.paise; }
    return paise(t);
  };
  const paidCount = dues.filter((d) => compareIso(d, asOf) <= 0).length;

  // GSV today and at the next premium due date (that premium paid on the day).
  const today = run(asOf).gsv;
  const nextDate = dues.find((d) => compareIso(d, asOf) > 0) ?? null;
  const next = nextDate ? run(nextDate).gsv : null;
  if (today.amount === null) missing.push(...today.missing);

  // Payouts.
  const rec = val<{ amount: Paise; frequency?: string; from: string; to: string }>("benefits.survival_recurring");
  const ter = val<{ amount: Paise; date: string }>("benefits.survival_terminal");
  const mat = val<any>("benefits.maturity");
  let regularPayout: PolicySnapshot["regularPayout"] = null;
  if (rec?.amount && rec.from && rec.to) {
    let count = 0;
    for (let k = 0; k < 1200 && compareIso(addMonthsIso(rec.from, k), rec.to) <= 0; k++) count++;
    regularPayout = { amount: rec.amount, frequency: rec.frequency ?? "monthly", from: rec.from, to: rec.to, count };
  }
  const maturity: Paise | null = mat?.paise !== undefined ? mat : mat?.amount?.paise !== undefined ? mat.amount : null;
  const received =
    (regularPayout ? regularPayout.amount.paise * regularPayout.count : 0) + (ter?.amount?.paise ?? 0) + (maturity?.paise ?? 0);
  const anyPayout = !!regularPayout || !!ter?.amount || !!maturity;
  const totalPayable = dues.length ? sum(dues.length) : null;

  return {
    asOf,
    premium: {
      perInstalment: renew ?? null, frequency: freq, excludesTaxes: val<boolean>("schedule.premium_excludes_taxes") === true,
      paidCount, paidSoFar: dues.length ? sum(paidCount) : null, totalCount: dues.length, totalPayable, lastDue: dues[dues.length - 1] ?? null,
    },
    gsvToday: today.amount,
    nextDue: nextDate ? { date: nextDate, gsv: next?.amount ?? null } : null,
    atEnd: { date: val<string>("schedule.policy_end_date") ?? ter?.date ?? null, maturity, maturityNotApplicable: naMaturity && !maturity, finalPayout: ter?.amount ?? null },
    regularPayout,
    totalReceived: anyPayout ? paise(received) : null,
    gainOverPremiums: anyPayout && totalPayable ? paise(received - totalPayable.paise) : null,
    lifeCover: val<Paise>("schedule.sum_assured_on_death") ?? null,
    usedIllustrationMethod,
    missing: Array.from(new Set(missing)),
  };
}
