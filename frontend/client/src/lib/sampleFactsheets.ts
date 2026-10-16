import { ADD_ON_FINDINGS_KEY, detectMotorAddOns } from "@shared/motorAddOns";

/**
 * The public samples for life, term and vehicle policies.
 *
 * These lines of business have no audit. Life and term get a summary table of
 * what was read from the document; motor gets the same table plus the add-on
 * checklist and the cover score. The samples used to be full forensic audit
 * reports (mock-data.ts) with a verdict, a score and a claim settlement ratio
 * that no real life or vehicle upload ever produces, naming real insurers. So
 * the samples now show exactly what a real upload shows, on made-up details.
 *
 * Every name here is invented and says so. Dates are counted from today so the
 * sample never shows a policy that has quietly expired.
 *
 * The motor add-on scan is not hand-written: it is the real detector run over a
 * made-up schedule, so the checklist and the score on the sample are what the
 * product would print for that document.
 */

export type SampleType = "life" | "term" | "motor";

/* Local calendar dates, never toISOString(): that converts to UTC, which in
   India before 05:30 is still yesterday. */
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The 15th of the month `months` from now (`dayShift` moves it, e.g. -1 for the 14th). */
function fromToday(months: number, dayShift = 0): string {
  const now = new Date();
  return ymd(new Date(now.getFullYear(), now.getMonth() + months, 15 + dayShift));
}

/** The first yearly due date after today, for a policy that started on `start`. */
function nextYearlyDue(start: string): string {
  const [y, m, day] = start.split("-").map(Number);
  const today = new Date();
  let d = new Date(y, m - 1, day);
  while (d <= today) d = new Date(d.getFullYear() + 1, m - 1, day);
  return ymd(d);
}

const LIFE_START = fromToday(-72);
const TERM_START = fromToday(-24);

const SAMPLE_INSURER_LIFE = "Sample Life Insurance Co. (not a real insurer)";
const SAMPLE_INSURER_MOTOR = "Sample General Insurance Co. (not a real insurer)";

/* A made-up private car schedule, long enough for the detector (200+ chars),
   with the insurer's own opted list ending at the premium section. */
const SAMPLE_MOTOR_SCHEDULE = [
  "SAMPLE GENERAL INSURANCE CO. (NOT A REAL INSURER)",
  "Private Car Package Policy - Schedule",
  "Policy No: SAMPLE-MT-00456",
  "Type of cover: Comprehensive (Package)",
  "Vehicle: Sample hatchback, petrol",
  "Add-on Covers Opted",
  "Zero Depreciation, Consumables, Roadside Assistance, Engine Protection",
  "",
  "",
  "Premium Breakup",
  "This schedule is a made-up example used to show what IndSure reads from a motor policy.",
].join("\n");

const sampleScan = detectMotorAddOns(SAMPLE_MOTOR_SCHEDULE);

export const SAMPLE_FACTSHEETS: Record<SampleType, Record<string, unknown>> = {
  life: {
    policyholder_name: "A. Sharma (sample)",
    life_assured_name: "A. Sharma (sample)",
    insurer: SAMPLE_INSURER_LIFE,
    policy_number: "SAMPLE-LI-00123",
    plan_name: "Sample Endowment Plan",
    sum_assured: 1000000,
    premium: 48500,
    premium_frequency: "Yearly",
    policy_term_years: 20,
    premium_paying_term_years: 15,
    start_date: LIFE_START,
    next_premium_date: nextYearlyDue(LIFE_START),
    maturity_date: fromToday(168),
    plan_type: "Endowment",
    age_at_entry: 38,
    nominee_name: "S. Sharma (sample)",
  },
  term: {
    policyholder_name: "R. Verma (sample)",
    life_assured_name: "R. Verma (sample)",
    insurer: SAMPLE_INSURER_LIFE,
    policy_number: "SAMPLE-TL-00789",
    plan_name: "Sample Term Plan",
    sum_assured: 10000000,
    premium: 14200,
    premium_frequency: "Yearly",
    policy_term_years: 30,
    premium_paying_term_years: 30,
    cover_till_age: 65,
    start_date: TERM_START,
    next_premium_date: nextYearlyDue(TERM_START),
    cover_end_date: fromToday(336),
    plan_type: "Term",
    death_benefit_payout: "Lump sum",
    age_at_entry: 35,
    nominee_name: "P. Verma (sample)",
  },
  motor: {
    policyholder_name: "K. Iyer (sample)",
    insurer: SAMPLE_INSURER_MOTOR,
    policy_number: "SAMPLE-MT-00456",
    plan_name: "Sample Private Car Package Policy",
    vehicle_registration_no: "XX-00-XX-0000 (sample)",
    make_and_model: "Sample hatchback, petrol",
    manufacturing_year: String(new Date().getFullYear() - 4),
    idv: 450000,
    ncb_percent: 25,
    premium: 14800,
    coverage_type: "Comprehensive (Package)",
    policy_start_date: fromToday(-5),
    policy_expiry_date: fromToday(7, -1),
    [ADD_ON_FINDINGS_KEY]: sampleScan,
  },
};

/** `?sample=` values the report page accepts for these samples. */
export function sampleTypeFromParam(v: string | null | undefined): SampleType | null {
  if (v === "life" || v === "sample-life") return "life";
  if (v === "term" || v === "sample-term") return "term";
  if (v === "vehicle" || v === "motor" || v === "sample-vehicle") return "motor";
  return null;
}
