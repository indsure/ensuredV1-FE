/**
 * Plain-English wording for policy values: what each reason means, and what
 * each kind of figure is. The portal uses these as the English text (Hindi
 * lives in hi.json under the same codes); the WhatsApp bot uses them as is.
 *
 * Copied byte for byte to the bot. Imports types only.
 */

import type { Basis, Reason, Verification } from "./policyValue";

export const REASON_TEXT: Record<Reason, string> = {
  premium_missing: "The premium is not on file.",
  premium_invalid: "The premium on file is not a clear amount.",
  frequency_missing: "How often the premium is paid is not on file.",
  frequency_unclear: "How often the premium is paid is not clear.",
  term_missing: "The policy term is not on file.",
  term_invalid: "The policy term on file is not a whole number of years.",
  ppt_invalid: "The premium paying term on file does not fit the policy term.",
  start_date_missing: "The commencement date is not on file.",
  start_date_invalid: "The commencement date on file is not a clear date.",
  dates_conflict: "The maturity date does not match the commencement date plus the term.",
  base_premium_missing: "The premium without taxes and riders is not on file.",
  basic_sum_assured_missing: "The basic sum assured is not on file.",
  vested_bonus_missing: "The bonus already added to the policy is not on file.",
  payout_schedule_missing: "The survival payout schedule is not on file.",
  uin_missing: "The product's UIN is not on file.",
  insurer_missing: "The insurer is not on file.",
  shape_unknown: "The plan type is not known.",
  shape_candidate: "The plan type is only a guess from the plan name. Confirm it.",
  shape_unsupported: "This plan type (pension, annuity, whole life or child plan) is not covered here.",
  term_no_surrender: "Term cover normally has no surrender value. Check the policy wording if unsure.",
  term_no_maturity: "Term cover normally pays nothing at maturity.",
  ulip_ask_insurer: "For a unit linked plan, ask the insurer for the surrender value.",
  ulip_projection_only: "A unit linked plan's maturity value depends on the market and is not shown.",
  no_verified_rules: "We do not have this product's checked surrender factor table.",
  rules_shape_mismatch: "The factor table is for a different plan type.",
  rules_entered_by_agent: "Uses a factor table you entered. Not checked by anyone else.",
  rules_invalid: "The factor table on file has errors.",
  factor_missing_for_year: "The factor table has no factor for this policy year.",
  not_acquired_yet: "No surrender value yet: the product terms need more policy years first.",
  ssv_method_unsupported: "This product's special surrender value method is not supported.",
  inputs_not_checked: "The policy details have not been checked against the policy document.",
  inputs_changed_since_check: "The policy details changed after they were checked. Check them again.",
  schedule_unknown: "The premium schedule is not known.",
  payment_status_unknown: "Payment status needs checking.",
  payment_records_incomplete: "Not every premium due so far has a payment record.",
  date_passed: "The premium date on file has passed. Payment status needs checking.",
  status_not_in_force: "The insurer's latest status is not in force.",
  status_older_than_due: "The insurer's status is older than the last premium due date.",
  first_premium_at_issue: "The first premium is taken as paid because the policy was issued.",
  single_premium_at_issue: "The single premium is taken as paid because the policy was issued.",
  payments_self_reported: "Payments are as you recorded them, not from an insurer document.",
  payment_amounts_differ: "Some recorded payments differ from the premium on file.",
  loan_position_unknown: "Whether there is a loan on this policy is not recorded.",
  loan_interest_unknown: "The interest owed on the loan is not known.",
  loan_rules_missing: "The product's loan terms are not on file.",
  loan_not_eligible_yet: "The product terms do not allow a loan yet.",
  loan_outstanding_comparison_off: "Not compared, because interest on the loan keeps changing the figure.",
  deductions_exceed_value: "The loan is more than the surrender value. Ask the insurer what happens next.",
  quote_dated: "This is the figure on the quote's date. It changes over time.",
  confirm_with_insurer: "Confirm with the insurer before acting.",
  statement_date_missing: "The statement date is not on file, so the figure is not shown.",
  fund_value_not_surrender_value: "A fund value is not the amount paid on surrender.",
  schedule_not_payment: "This is what the schedule says was due, not what was paid.",
  maturity_not_read: "The maturity amount was not read from the policy.",
  bonuses_not_included: "Bonuses are not included.",
  future_bonus_not_guaranteed: "Future bonuses are not guaranteed and are not added.",
  terminal_loyalty_not_included: "Any terminal or loyalty addition is not included.",
  reduced_after_lapse_ask_insurer: "The policy is not in force, so the maturity amount will be lower. Ask the insurer.",
  assumes_scheduled_premiums_paid: "Assumes every scheduled premium was paid.",
  future_bonus_unknown: "Not compared, because next year's bonus is not known yet.",
  comparison_needs_calculation: "Needs a calculated surrender value to compare.",
};

export const BASIS_TEXT: Record<Basis, string> = {
  insurer_quote: "Insurer quote you entered",
  document_calculation: "Calculated from checked policy terms",
  stated_value: "As written on the policy",
  estimate: "Estimate, not for quoting",
  projection: "Projection, not guaranteed",
  not_applicable: "Not applicable",
  unsupported: "Not covered here",
  insufficient: "Not available",
};

export const VERIFICATION_TEXT: Record<Verification, string> = {
  insurer_document: "copied from an insurer document",
  agent_checked: "checked against the policy",
  self_reported: "as you recorded it",
  unchecked: "read from the policy, not checked",
  none: "",
};

/** 2,56,500 style, rupee sign, no paise unless there are some. */
export function rupees(n: number): string {
  const whole = Math.round(n);
  return "₹" + (Math.abs(n - whole) < 0.005 ? whole.toLocaleString("en-IN") : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}

/** 15 Mar 2027 from 2027-03-15. */
export function prettyIso(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return `${d} ${mon} ${y}`;
}
