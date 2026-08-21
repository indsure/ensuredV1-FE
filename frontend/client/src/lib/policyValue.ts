/**
 * Deterministic value schedule for the life / term data-entry lanes.
 *
 * Given the flat fields OCR read off the policy document, work out what the
 * customer gets back in each policy year: money paid in, surrender value,
 * maturity benefit and death benefit.
 *
 * There is no model call here and no estimation. Every figure is arithmetic on
 * the extracted fields, so the same document always produces the same numbers
 * and an agent can check any row by hand. Where a figure depends on something
 * the document cannot tell us (a bonus the insurer has not declared, a future
 * fund return) it is marked as an assumption and surfaced in the UI.
 *
 * Field keys must match EXTRACTION_FIELDS in ./insuranceTypes.
 */

export type PlanShape = "pure_term" | "return_of_premium" | "endowment" | "unit_linked";

export const PLAN_SHAPE_LABELS: Record<PlanShape, string> = {
  pure_term: "Term cover only",
  return_of_premium: "Term with return of premium",
  endowment: "Endowment / savings",
  unit_linked: "Unit linked",
};

/** What the agent picks from; the value is stored back into extracted_data.plan_type. */
export const PLAN_SHAPE_OPTIONS = Object.entries(PLAN_SHAPE_LABELS) as [PlanShape, string][];

export interface ValueRow {
  year: number;
  /** Age of the life assured at the end of that policy year, when derivable. */
  age: number | null;
  paid: number;
  back: number;
  cover: number;
  /** null = payable straight away; otherwise the date the money is released. */
  deferredTo: string | null;
  /** false when the document cannot tell us this year's value (a unit linked
   *  statement gives today's fund value, never the history before it). */
  known: boolean;
  note: string;
}

export interface ValueSchedule {
  shape: PlanShape;
  rows: ValueRow[];
  annualPremium: number;
  totalPremiums: number;
  maturity: number;
  term: number;
  ppt: number;
  entryAge: number | null;
  lockInYears: number | null;
  lockInEnds: string | null;
  /** false when any part of the line depends on a non-guaranteed input. */
  guaranteed: boolean;
  /** Plain-language method, shown under the chart. */
  steps: string[];
  /** Assumptions the document did not supply. */
  assumptions: string[];
}

export interface ValueGap {
  missing: string[];
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n !== 0 ? n : null;
};

/** Premium instalments per year, read loosely from the free-text frequency. */
export function frequencyMultiplier(raw: unknown): number {
  const s = String(raw ?? "").toLowerCase();
  if (/month/.test(s)) return 12;
  if (/quarter/.test(s)) return 4;
  if (/half|semi|six/.test(s)) return 2;
  if (/single/.test(s)) return 1;
  return 1; // annual, and the safe default
}

/**
 * Which shape of product this is. The stored plan_type wins; otherwise fall back
 * to the lane and some plan-name wording. The fallback is a starting guess the
 * agent can correct — it is never treated as fact.
 */
export function resolveShape(
  insuranceType: string,
  data: Record<string, any> | null
): { shape: PlanShape; inferred: boolean } {
  const stored = String(data?.plan_type ?? "").toLowerCase().trim();
  if (stored) {
    if (/unit|ulip|linked|market|fund/.test(stored)) return { shape: "unit_linked", inferred: false };
    if (/return of premium|\brop\b/.test(stored)) return { shape: "return_of_premium", inferred: false };
    if (/endow|saving|money.?back|guaranteed/.test(stored)) return { shape: "endowment", inferred: false };
    if (/term|pure|protect/.test(stored)) return { shape: "pure_term", inferred: false };
  }

  const name = String(data?.plan_name ?? "").toLowerCase();
  if (/unit linked|ulip|wealth|invest|market/.test(name)) return { shape: "unit_linked", inferred: true };
  if (/return of premium|\brop\b/.test(name)) return { shape: "return_of_premium", inferred: true };
  if (insuranceType === "term") return { shape: "pure_term", inferred: true };
  if (data?.maturity_date) return { shape: "endowment", inferred: true };
  return { shape: "pure_term", inferred: true };
}

/**
 * Guaranteed surrender value as a share of premiums paid. These are the standard
 * regulatory factors; an insurer's own table can be dropped in here unchanged.
 */
export function gsvShare(year: number, term: number): number {
  if (year < 2) return 0;
  if (year <= 3) return 0.3;
  if (year <= 7) return 0.5;
  const last = Math.max(term - 2, 8);
  if (year >= last) return 0.9;
  return 0.5 + (0.4 * (year - 7)) / (last - 7);
}

function addYears(iso: string | null, years: number): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

const UNIT_LINKED_GROSS = 0.08;
const UNIT_LINKED_FMC = 0.0135;
const UNIT_LINKED_LOCK_IN = 5;

/**
 * Build the schedule. Returns a ValueGap listing what to fill in when the
 * document did not give us enough to compute anything honest.
 */
export function computePolicyValue(
  insuranceType: string,
  data: Record<string, any> | null
): ValueSchedule | ValueGap {
  const d = data ?? {};
  const sumAssured = num(d.sum_assured) ?? 0;
  const rawPremium = num(d.premium);
  const term = num(d.policy_term_years);

  const missing: string[] = [];
  if (!rawPremium) missing.push("Premium");
  if (!term) missing.push("Policy term (years)");
  if (!sumAssured) missing.push("Sum assured");
  if (missing.length) return { missing };

  const perYear = frequencyMultiplier(d.premium_frequency);
  const annualPremium = rawPremium! * perYear;
  const ppt = Math.min(num(d.premium_paying_term_years) ?? term!, term!);
  const totalPremiums = annualPremium * ppt;

  const coverTillAge = num(d.cover_till_age);
  const entryAge = coverTillAge ? coverTillAge - term! : null;

  const { shape } = resolveShape(insuranceType, d);
  const start: string | null = d.start_date ?? null;

  const steps: string[] = [];
  const assumptions: string[] = [];
  let guaranteed = true;
  let lockInYears: number | null = null;
  let lockInEnds: string | null = null;

  steps.push(
    `Money paid by year n = premium × instalments per year × the smaller of n and the premium paying term` +
      (perYear > 1 ? ` — ${rawPremium} × ${perYear} × up to ${ppt}.` : ` — ${rawPremium} × up to ${ppt}.`)
  );

  // Unit linked needs the current fund value; without it we cannot project honestly.
  const fundValue = num(d.fund_value);
  // The statement gives the fund value as at today, so anchor it to the policy
  // year the policy is actually in and project forward from there. Earlier years
  // are left blank rather than back-filled with numbers nobody can verify.
  let anchorYear = 1;
  if (shape === "unit_linked" && start) {
    const began = new Date(start);
    if (!Number.isNaN(began.getTime())) {
      const elapsed = (Date.now() - began.getTime()) / (365.2425 * 24 * 3600 * 1000);
      anchorYear = Math.min(Math.max(Math.floor(elapsed) + 1, 1), term!);
    }
  }
  if (shape === "unit_linked") {
    if (!fundValue) return { missing: ["Fund value (from the latest statement)"] };
    lockInYears = UNIT_LINKED_LOCK_IN;
    lockInEnds = addYears(start, UNIT_LINKED_LOCK_IN);
    guaranteed = false;
    assumptions.push(
      `Fund growth of ${(UNIT_LINKED_GROSS * 100).toFixed(0)}% a year before charges, less a ${(UNIT_LINKED_FMC * 100).toFixed(2)}% fund management charge. Not guaranteed — the actual value follows the funds.`
    );
    steps.push(
      `Fund value is carried forward from ${fundValue.toLocaleString("en-IN")} on the statement, adding each premium and growing at the assumed rate net of the fund management charge.`
    );
    steps.push(
      `Surrender inside the ${UNIT_LINKED_LOCK_IN}-year lock-in is held in the discontinued fund and released only ${lockInEnds ? `on ${lockInEnds}` : "at the end of the lock-in"}, earning 4% a year.`
    );
  }

  const bonusPer1000 = num(d.bonus_per_1000);
  if (shape === "endowment") {
    if (bonusPer1000) {
      guaranteed = false;
      assumptions.push(
        `A reversionary bonus of ₹${bonusPer1000} per ₹1,000 of sum assured each year. Bonuses are declared by the insurer and are not guaranteed.`
      );
    } else {
      assumptions.push(
        "No bonus rate was read from the document, so only the guaranteed sum assured is shown. Add the declared bonus rate to include it."
      );
    }
  }

  const rows: ValueRow[] = [];
  let fv = fundValue ?? 0;

  for (let y = 1; y <= term!; y++) {
    const paid = annualPremium * Math.min(y, ppt);
    let back = 0;
    let cover = sumAssured;
    let deferredTo: string | null = null;
    let note = "";

    if (shape === "pure_term") {
      back = 0;
      note = "Term cover pays nothing on surrender or on survival.";
    }

    if (shape === "return_of_premium") {
      back = y === term ? paid : gsvShare(y, term!) * paid;
      note =
        y < 2
          ? "No surrender value in the first year."
          : y === term
          ? "Every premium paid is returned at maturity."
          : `${Math.round(gsvShare(y, term!) * 100)}% of the premiums paid so far.`;
    }

    if (shape === "endowment") {
      const bonus = (bonusPer1000 ?? 0) * (sumAssured / 1000) * y;
      const paidUp = sumAssured * (Math.min(y, ppt) / ppt);
      const ssv = (paidUp + bonus) * (0.3 + 0.65 * Math.pow(y / term!, 1.5));
      back = y === term ? sumAssured + bonus : Math.max(gsvShare(y, term!) * paid, y >= 2 ? ssv : 0);
      cover = Math.max(sumAssured, 1.05 * paid) + bonus;
      note =
        y < 2
          ? "No surrender value in the first year."
          : y === term
          ? "Sum assured plus the bonus accrued."
          : "Higher of the guaranteed value and the paid-up value with bonus.";
    }

    if (shape === "unit_linked") {
      if (y > anchorYear) fv = fv * (1 + UNIT_LINKED_GROSS - UNIT_LINKED_FMC) + (y <= ppt ? annualPremium : 0);
      const inLock = y <= UNIT_LINKED_LOCK_IN;
      back = inLock ? fv * Math.pow(1.04, UNIT_LINKED_LOCK_IN - y) : fv;
      cover = Math.max(sumAssured, fv, 1.05 * paid);
      deferredTo = inLock ? lockInEnds : null;
      note = inLock
        ? `Held in the discontinued fund until ${lockInEnds ?? "the end of the lock-in"}, earning 4% a year.`
        : "Fund value on the day you surrender.";
    }

    const known = shape !== "unit_linked" || y >= anchorYear;
    if (!known) note = "The statement only gives today's fund value, not what it was back then.";
    rows.push({ year: y, age: entryAge === null ? null : entryAge + y, paid, back, cover, deferredTo, known, note });
  }

  // Method notes that depend on the shape.
  if (shape === "pure_term") {
    steps.push("Surrender value = 0 — term cover acquires no surrender value, so there is nothing to schedule.");
    steps.push("Maturity benefit = 0 — nothing is payable if the life assured survives the term.");
    steps.push(`Cover on death = the sum assured, flat for all ${term} years.`);
  }
  if (shape === "return_of_premium") {
    steps.push(
      "Surrender value = the guaranteed factor for that year × premiums paid. Nil in year 1, 30% in years 2–3, 50% in years 4–7, rising to 90% by the last two years."
    );
    steps.push("Maturity benefit = every premium paid, returned at the end of the term.");
  }
  if (shape === "endowment") {
    steps.push("Paid-up value = sum assured × premiums paid ÷ premiums payable, plus any bonus accrued.");
    steps.push("Surrender value = the higher of the guaranteed value and the paid-up value reduced for the years still to run.");
    steps.push("Maturity benefit = the sum assured plus the bonus accrued over the full term.");
  }
  if (shape !== "pure_term") {
    steps.push("Cover on death = the highest of the sum assured, the value built up, and 105% of the premiums paid.");
  }

  return {
    shape,
    rows,
    annualPremium,
    totalPremiums,
    maturity: rows[rows.length - 1]?.back ?? 0,
    term: term!,
    ppt,
    entryAge,
    lockInYears,
    lockInEnds,
    guaranteed,
    steps,
    assumptions,
  };
}

export function isValueGap(v: ValueSchedule | ValueGap): v is ValueGap {
  return (v as ValueGap).missing !== undefined;
}
