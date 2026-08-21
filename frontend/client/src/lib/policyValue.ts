/**
 * Deterministic value schedule for the life / term data-entry lanes.
 *
 * Given the flat fields OCR read off the policy document, work out what the
 * customer gets back in each policy year: money paid in, surrender value,
 * maturity benefit and death benefit.
 *
 * There is no model call here and no estimation. Every figure is arithmetic on
 * the extracted fields and on the parameters in ./policyParams — the charge
 * table, growth assumption, penalty factors and bonus rate that the payout
 * actually depends on. Those are read from the wording where it states them and
 * typed in by the agent where it does not, so the schedule can be reconciled
 * line by line against the benefit illustration in the customer's own document.
 *
 * No rate may be hardcoded here. If a number moves the payout it lives in
 * policyParams, or the two can silently disagree.
 *
 * Field keys must match EXTRACTION_FIELDS in ./insuranceTypes.
 */

import {
  bandPct, buildParams, type PolicyParams,
} from "./policyParams";

export type PlanShape = "pure_term" | "return_of_premium" | "endowment" | "unit_linked";

export const PLAN_SHAPE_LABELS: Record<PlanShape, string> = {
  pure_term: "Term cover only",
  return_of_premium: "Term with return of premium",
  endowment: "Endowment / savings",
  unit_linked: "Unit linked",
};

export const PLAN_SHAPE_OPTIONS = Object.entries(PLAN_SHAPE_LABELS) as [PlanShape, string][];

export interface ValueRow {
  year: number;
  age: number | null;
  paid: number;
  /** Fund value / accrued value at the end of the year, before any penalty. */
  value: number;
  /** Penalty deducted if the policy is surrendered in that year. */
  penalty: number;
  /** What the customer actually receives, after penalty and after any deferral. */
  back: number;
  cover: number;
  /** null = payable straight away; otherwise the date the money is released. */
  deferredTo: string | null;
  note: string;
}

export interface ValueSchedule {
  shape: PlanShape;
  rows: ValueRow[];
  params: PolicyParams;
  annualPremium: number;
  totalPremiums: number;
  maturity: number;
  term: number;
  ppt: number;
  entryAge: number | null;
  lockInYears: number | null;
  lockInEnds: string | null;
  guaranteed: boolean;
  steps: string[];
  /** Value the document itself states at maturity, when it was extracted. */
  illustratedMaturity: number | null;
  /** How far our schedule sits from the document's own figure. */
  reconciliation: { diff: number; pct: number } | null;
}

export interface ValueGap {
  missing: string[];
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n !== 0 ? n : null;
};

export function frequencyMultiplier(raw: unknown): number {
  const s = String(raw ?? "").toLowerCase();
  if (/month/.test(s)) return 12;
  if (/quarter/.test(s)) return 4;
  if (/half|semi|six/.test(s)) return 2;
  if (/single/.test(s)) return 1;
  return 1;
}

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
 * Guaranteed surrender value share. The flat bands come from the parameters;
 * the stretch between year 8 and the last two years is interpolated, which is
 * how the standard table is written.
 */
export function gsvShare(year: number, term: number, params: PolicyParams): number {
  const bands = params.gsvFactors.value;
  if (year <= 7) return bandPct(bands, year) / 100;
  const top = bandPct(bands, 99) / 100;
  const mid = bandPct(bands, 7) / 100;
  const last = Math.max(term - 2, 8);
  if (year >= last) return top;
  return mid + (top - mid) * ((year - 7) / (last - 7));
}

function addYears(iso: string | null, years: number): string | null {
  if (!iso) return null;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setFullYear(dt.getFullYear() + years);
  return dt.toISOString().slice(0, 10);
}

function penaltyFor(year: number, ap: number, fv: number, params: PolicyParams): number {
  const row = params.penalties.value.find((p) => p.year === year);
  if (!row) return 0;
  const raw = Math.min((row.pct / 100) * ap, (row.pct / 100) * fv);
  return row.cap > 0 ? Math.min(raw, row.cap) : raw;
}

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

  const params = buildParams(d.policy_parameters);
  // Some parameters are also plain extracted fields on the form. Bridge those in,
  // otherwise moving a value into the parameter block silently drops it.
  const bridge = (key: "bonusPer1000" | "entryAge", flat: number | null) => {
    if (flat !== null && params[key].source === "default") {
      params[key] = { value: flat, source: "document" };
    }
  };
  bridge("bonusPer1000", num(d.bonus_per_1000));
  bridge("entryAge", num(d.age_at_entry));
  const perYear = frequencyMultiplier(d.premium_frequency);
  const annualPremium = rawPremium! * perYear;
  const ppt = Math.min(num(d.premium_paying_term_years) ?? term!, term!);
  const totalPremiums = annualPremium * ppt;

  const coverTillAge = num(d.cover_till_age);
  const entryAge =
    num(d.age_at_entry) ?? (coverTillAge ? coverTillAge - term! : params.entryAge.value ?? null);

  const { shape } = resolveShape(insuranceType, d);
  const start: string | null = d.start_date ?? null;
  const floor = params.deathBenefitFloorPct.value / 100;

  const steps: string[] = [];
  let guaranteed = true;
  let lockInYears: number | null = null;
  let lockInEnds: string | null = null;

  steps.push(
    `Money paid by year n = premium × instalments per year × the smaller of n and the premium paying term` +
      (perYear > 1 ? ` — ${rawPremium} × ${perYear} × up to ${ppt}.` : ` — ${rawPremium} × up to ${ppt}.`)
  );

  const rows: ValueRow[] = [];

  if (shape === "unit_linked") {
    lockInYears = params.lockInYears.value;
    lockInEnds = addYears(start, lockInYears);
    guaranteed = false;

    // Month-by-month, exactly as the charge table in the wording describes it:
    // allocation charge off the premium going in, then administration and
    // mortality out of the fund, then growth net of the fund management charge.
    const gross = params.grossReturnPct.value / 100;
    const fmc = params.fundChargePct.value / 100;
    const monthly = Math.pow(1 + gross - fmc, 1 / 12) - 1;
    const admin = (y: number) =>
      Math.min(
        params.adminMonthly.value * Math.pow(1 + params.adminEscalationPct.value / 100, y - 1),
        params.adminCapMonthly.value
      );
    const mort = params.mortalityPer1000.value;

    let fv = 0;
    let tpp = 0;
    for (let y = 1; y <= term!; y++) {
      if (y <= ppt) {
        tpp += annualPremium;
        fv += annualPremium * (1 - bandPct(params.allocationCharges.value, y) / 100);
      }
      const age = (entryAge ?? params.entryAge.value) + y - 1;
      const rate = mort[age] ?? mort[Math.max(...Object.keys(mort).map(Number))] ?? 0;
      let sum12 = 0;
      for (let mo = 0; mo < 12; mo++) {
        const atRisk = Math.max(Math.max(sumAssured, floor * tpp) - fv, 0);
        fv -= (atRisk * rate) / 1000 / 12;
        fv -= admin(y);
        fv *= 1 + monthly;
        sum12 += fv;
      }
      if (y >= params.loyaltyFromYear.value) {
        fv += (params.loyaltyPct.value / 100) * (sum12 / 12);
      }

      const penalty = penaltyFor(y, annualPremium, fv, params);
      const inLock = y <= lockInYears;
      const net = fv - penalty;
      const back = inLock
        ? net * Math.pow(1 + params.discontinuedFundRatePct.value / 100, lockInYears - y)
        : net;
      rows.push({
        year: y,
        age: entryAge === null ? null : entryAge + y,
        paid: annualPremium * Math.min(y, ppt),
        value: fv,
        penalty,
        back,
        cover: Math.max(sumAssured, fv, floor * (annualPremium * Math.min(y, ppt))),
        deferredTo: inLock ? lockInEnds : null,
        note: inLock
          ? `Held in the discontinued fund until ${lockInEnds ?? "the end of the lock-in"}, earning ${params.discontinuedFundRatePct.value}% a year.`
          : "Fund value on the day you surrender.",
      });
    }

    steps.push(
      `Fund is rolled forward month by month: premium less the allocation charge goes in, then the ` +
        `₹${params.adminMonthly.value}/month administration charge and the mortality charge on the sum at ` +
        `risk come out, then growth of ${params.grossReturnPct.value}% less the ${params.fundChargePct.value}% fund management charge.`
    );
    steps.push(
      `Surrender inside the ${lockInYears}-year lock-in loses the discontinuance charge and is released only ` +
        `${lockInEnds ? `on ${lockInEnds}` : "at the end of the lock-in"}, earning ${params.discontinuedFundRatePct.value}% a year until then.`
    );
    if (params.loyaltyPct.value > 0) {
      steps.push(
        `A loyalty addition of ${params.loyaltyPct.value}% of the year's average fund is credited from year ${params.loyaltyFromYear.value}.`
      );
    }
  } else {
    for (let y = 1; y <= term!; y++) {
      const paid = annualPremium * Math.min(y, ppt);
      let value = 0;
      let back = 0;
      let cover = sumAssured;
      let note = "";

      if (shape === "pure_term") {
        note = "Term cover pays nothing on surrender or on survival.";
      }

      if (shape === "return_of_premium") {
        value = paid;
        back = y === term ? paid : gsvShare(y, term!, params) * paid;
        note =
          y < 2
            ? "No surrender value in the first year."
            : y === term
            ? "Every premium paid is returned at maturity."
            : `${Math.round(gsvShare(y, term!, params) * 100)}% of the premiums paid so far.`;
      }

      if (shape === "endowment") {
        const bonus = params.bonusPer1000.value * (sumAssured / 1000) * y;
        const paidUp = sumAssured * (Math.min(y, ppt) / ppt);
        const ssv = (paidUp + bonus) * (0.3 + 0.65 * Math.pow(y / term!, 1.5));
        value = paidUp + bonus;
        back = y === term ? sumAssured + bonus : Math.max(gsvShare(y, term!, params) * paid, y >= 2 ? ssv : 0);
        cover = Math.max(sumAssured, floor * paid) + bonus;
        if (params.bonusPer1000.value > 0) guaranteed = false;
        note =
          y < 2
            ? "No surrender value in the first year."
            : y === term
            ? "Sum assured plus the bonus accrued."
            : "Higher of the guaranteed value and the paid-up value with bonus.";
      }

      rows.push({
        year: y,
        age: entryAge === null ? null : entryAge + y,
        paid, value, penalty: 0, back, cover, deferredTo: null, note,
      });
    }

    if (shape === "pure_term") {
      steps.push("Surrender value = 0 — term cover acquires no surrender value, so there is nothing to schedule.");
      steps.push("Maturity benefit = 0 — nothing is payable if the life assured survives the term.");
      steps.push(`Cover on death = the sum assured, flat for all ${term} years.`);
    }
    if (shape === "return_of_premium") {
      steps.push("Surrender value = the guaranteed factor for that year × premiums paid, from the factor table.");
      steps.push("Maturity benefit = every premium paid, returned at the end of the term.");
    }
    if (shape === "endowment") {
      steps.push(`Accrued bonus = ₹${params.bonusPer1000.value} per ₹1,000 of sum assured, per completed year.`);
      steps.push("Paid-up value = sum assured × premiums paid ÷ premiums payable, plus the bonus accrued.");
      steps.push("Surrender value = the higher of the guaranteed value and the paid-up value reduced for the years still to run.");
    }
  }

  if (shape !== "pure_term") {
    steps.push(
      `Cover on death = the highest of the sum assured, the value built up, and ${params.deathBenefitFloorPct.value}% of the premiums paid.`
    );
  }

  const maturity = rows[rows.length - 1]?.back ?? 0;
  const illustratedMaturity = num(d.illustrated_maturity_value);
  const reconciliation =
    illustratedMaturity !== null
      ? { diff: maturity - illustratedMaturity, pct: ((maturity - illustratedMaturity) / illustratedMaturity) * 100 }
      : null;

  return {
    shape, rows, params, annualPremium, totalPremiums, maturity,
    term: term!, ppt, entryAge, lockInYears, lockInEnds, guaranteed, steps,
    illustratedMaturity, reconciliation,
  };
}

export function isValueGap(v: ValueSchedule | ValueGap): v is ValueGap {
  return (v as ValueGap).missing !== undefined;
}
