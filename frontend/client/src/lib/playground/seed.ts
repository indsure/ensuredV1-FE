/**
 * Demo data for the agent playground.
 *
 * Everything here is fake but shaped exactly like the real Supabase tables the
 * agent portal reads (clients/customers/agent_leads/lead_policies/agents/…), so
 * the existing pages render a believable, fully-populated portal. Built around
 * one demo agent (DEMO_AGENT_ID). Dates are computed relative to "now" so the
 * dashboard's "this week / expiring soon / 8-week chart" always looks alive.
 *
 * The store is created once per page load and held in memory: writes during a
 * session (add a lead, tag a customer) stick until reload, then reseed. Nothing
 * ever leaves the browser.
 */

import { DEMO_AGENT_ID, DEMO_EMAIL } from "./mode";
import { CURRENT_SCORING_VERSION } from "@shared/policy";
import {
  ADD_ON_CATALOG,
  ADD_ON_FINDINGS_KEY,
  type AddOnScan,
  type VehicleClass,
} from "@shared/motorAddOns";

const now = new Date();
const day = 24 * 60 * 60 * 1000;

/** The audit prompt these demo reports are shaped against. Mirrors
 *  PROMPT_VERSION in backend/server/promptTemplate.ts, which the frontend
 *  cannot import; the scoring version comes from @shared/policy directly. */
const DEMO_PROMPT_VERSION = "1.5.0";

/** ISO timestamp `n` days ago (negative = future). */
function ago(days: number): string {
  return new Date(now.getTime() - days * day).toISOString();
}
/** `YYYY-MM-DD`, `n` days ago (negative = future). */
function dateAgo(days: number): string {
  return new Date(now.getTime() - days * day).toISOString().slice(0, 10);
}

/**
 * An add-on scan shaped exactly like the one the detector emits, for the two
 * outcomes worth demonstrating: a car carrying three add-ons, and a two-wheeler
 * carrying none where the arithmetic proves it.
 *
 * Built FROM the live catalog rather than hard-coded, so adding an add-on shows
 * up in the demo instead of leaving it quietly a version behind. The rupee
 * figures are internally consistent: basic plus named add-ons minus the
 * no-claim bonus equals the total, so the "every rupee accounted for" seal in
 * the card is earned here the same way it is earned on a real policy.
 */
function demoAddOnScan(vehicleClass: VehicleClass): AddOnScan {
  const catalog = ADD_ON_CATALOG[vehicleClass];
  const priced =
    vehicleClass === "car"
      ? [
          { id: "zero_depreciation", name: "Depreciation Waiver", uin: "IRDAN000A0001V01202223", amount: 3850 },
          { id: "consumables", name: "Consumables Cover", uin: "IRDAN000A0006V01202324", amount: 620 },
          { id: "roadside_assistance", name: "Roadside Assistance Cover, Plan A", uin: "IRDAN000A0002V01202122", amount: 199 },
        ]
      : [];

  const named = priced.reduce((t, p) => t + p.amount, 0);
  const ncb = vehicleClass === "car" ? -1240 : 0;
  const basicOd = vehicleClass === "car" ? 6200 : 720;
  const totalOd = basicOd + named + ncb;
  const headroom = totalOd - basicOd;

  return {
    version: 1,
    vehicleClass,
    scannedAt: dateAgo(vehicleClass === "car" ? 14 : 9),
    declaredListFound: vehicleClass === "car",
    pricedLines: priced.map(({ name, uin, amount }) => ({ name, uin, amount })),
    arithmetic: { basicOd, totalOd, headroom },
    reconciliation: headroom === 0 ? null : { named, ncb, unexplained: 0 },
    findings: catalog.map((entry) => {
      const hit = priced.find((p) => p.id === entry.id);
      if (hit) {
        return {
          id: entry.id, label: entry.label, state: "present" as const,
          evidence: `${hit.name} (${hit.uin})`, amount: hit.amount,
        };
      }
      return {
        id: entry.id, label: entry.label,
        state: headroom === 0 ? ("absent_proven" as const) : ("not_found" as const),
        evidence: headroom === 0
          ? `Own damage premium is ${totalOd} against a basic of ${basicOd}, so no add-on premium was paid`
          : null,
        amount: null,
      };
    }),
    present: priced.length,
    applicable: catalog.length,
    unrecognisedDeclared: [],
  };
}

/**
 * The insurers the demo book is written against.
 *
 * Split by licence, not by brand. HDFC ERGO and HDFC Life are two different
 * companies and only one of them may sell a term plan; ICICI Lombard is general
 * insurance and cannot carry a life policy at all. The seed used to hang life
 * and term products off the general arms of both, which is the first thing an
 * insurance person notices and the last thing a sales demo can afford.
 */
const INSURERS = {
  star: "Star Health and Allied Insurance Co Ltd",
  hdfc: "HDFC ERGO General Insurance Company Limited",
  care: "Care Health Insurance Limited",
  niva: "Niva Bupa Health Insurance Company Limited",
  abhi: "Aditya Birla Health Insurance Co Limited",
  icici: "ICICI Lombard General Insurance Company Limited",
  tata: "Tata AIG General Insurance Company Limited",
  digit: "Go Digit General Insurance Limited",
  lic: "Life Insurance Corporation of India",
  hdfcLife: "HDFC Life Insurance Company Limited",
  bajajLife: "Bajaj Allianz Life Insurance Company Limited",
  iciciLife: "ICICI Prudential Life Insurance Company Limited",
};

/**
 * What one bad admission costs this insured today — the denominator the score is
 * measured against (RCT).
 *
 * Mirrors lookupRequiredCover in backend/server/services/analysisPipeline.ts,
 * which the frontend cannot import. It is duplicated here rather than invented
 * because the report renderer DIVIDES the cover by this number to print NCAR:
 * the seed used to put an out-of-pocket percentage in the field, so every demo
 * report announced "your cover is 13333.33× the minimum recommended" directly
 * underneath a RISKY verdict.
 */
const WORST_CASE_BY_AGE: { maxAge: number; cost: number }[] = [
  { maxAge: 34, cost: 1400000 },
  { maxAge: 44, cost: 1750000 },
  { maxAge: 54, cost: 2500000 },
  { maxAge: 64, cost: 3500000 },
  { maxAge: 74, cost: 4500000 },
  { maxAge: Infinity, cost: 5000000 },
];
const ZONE_COST_MULTIPLIER: Record<string, number> = { A: 1.15, B: 1.05, C: 1.0, D: 1.05 };

function requiredCover(ages: number[], zone: string): number {
  const eldest = Math.max(...ages);
  const row = WORST_CASE_BY_AGE.find((r) => eldest <= r.maxAge)!;
  const mult = ZONE_COST_MULTIPLIER[zone.toUpperCase()] ?? 1;
  return Math.round((row.cost * mult) / 50000) * 50000;
}

/** The net-cover penalty curve, mirroring netCoverPenaltyFor on the server. */
function netCoverPenaltyFor(ncar: number): number {
  if (ncar >= 1.0) return 0;
  if (ncar >= 0.75) return Math.round((10 * (1.0 - ncar)) / 0.25);
  if (ncar >= 0.5) return Math.round(10 + (15 * (0.75 - ncar)) / 0.25);
  if (ncar >= 0.3) return Math.round(25 + (15 * (0.5 - ncar)) / 0.2);
  return Math.min(60, Math.round(40 + (20 * (0.3 - ncar)) / 0.3));
}

/**
 * A complete, schema-valid ForensicAuditReport for a demo health policy.
 *
 * This has to be the *full* shape, not a summary: PolicyDetail runs
 * validateForensicAuditReport() (lib/policy-types) and drops anything missing
 * identity / policy_timeline / coverage_structure / a numeric audit_score /
 * a known final_verdict label, showing "Analysis data is in an unexpected
 * format" instead of the report. A partial report is the same as no report.
 *
 * Everything a caller doesn't specify defaults to a clean, unremarkable value,
 * so each call site only states what makes that policy interesting.
 */
type DeductionCategory = "NET_COVER" | "CLAIM_REJECTION" | "OOP_EXPOSURE" | "COVERAGE_GAP";

type ReportOpts = {
  insured: string[];
  ages: number[];
  genders?: string[];
  city: string;
  zone?: "A" | "B" | "C" | "D";
  healthFlags?: string[];
  inceptionDays: number;
  expiryDays: number;
  tenureYears?: number;
  baseSI: number;
  restoration?: { exists: boolean; type?: "full" | "partial"; useful?: boolean; remarks?: string; sameIllness?: boolean; unlimited?: boolean };
  ncbCap?: number;
  ncbCurrent?: number;
  riders?: { name: string; coverage_amount: number | null; is_material: boolean; remarks: string | null }[];
  /** Room-rent cap. Omit for "no cap". */
  roomRent?: {
    limit_type: "specific_amount" | "room_category" | "percentage_of_si";
    limit_value: string;
    limit_amount_per_day: number | null;
    /** % of every bill lost to proportionate deduction when the cap is breached. */
    penaltyPct: number;
    risk_level: "low" | "medium" | "high";
    zone_adequacy: "adequate" | "marginal" | "inadequate";
    explanation: string;
  };
  copayPct?: number;
  copayConditions?: string;
  copayAppliesTo?: "all_claims" | "seniors_only" | "specific_treatments";
  subLimits?: { procedure: string; limit: number; typical_cost_in_zone: number; severity: "high" | "medium" | "low" }[];
  pedMonths?: number;
  specificMonths?: number;
  specificDiseases?: string[];
  maternity?: { months: number | null; relevant: boolean; covered: boolean; limit?: number | null };
  opd?: { covered: boolean; limit?: number | null; remarks?: string };
  consumables?: { covered: boolean; coverage_type?: "full" | "partial" | "none"; remarks?: string };
  ambulanceLimit?: number;
  networkCount?: number;
  networkHospitals?: string[];
  /** Scoring + narrative. The score itself is NOT stated here: it is 100 minus
   *  the deductions below, so the headline and the list that explains it cannot
   *  disagree on screen. NCAR is derived from cover ÷ required cover. */
  label: "SAFE" | "BORDERLINE" | "RISKY" | "EXCELLENT";
  bucketLabel?: string;
  summary: string;
  realClaim: string;
  failures: string[];
  /** Category must be one of the four the renderer knows: it groups the
   *  deductions under the matching bar, and an unknown one leaves the bar
   *  reading "No deductions. This category is clean." beside a non-zero score. */
  deductions?: { reason: string; category: DeductionCategory; severity: "high" | "medium" | "low"; points: number }[];
  works?: { benefit: string; why_it_matters_in_claim: string; quantified_value: string | null }[];
  fails?: { issue: string; real_world_claim_impact: string; quantified_oop_risk: string | null }[];
  redFlags?: { flag: string; why_it_is_dangerous: string; severity: "high" | "medium" | "low" }[];
  actions?: {
    action: string;
    reason: string;
    oop_risk_if_ignored?: string | null;
    suggested_riders_or_topups?: string[];
    estimated_cost?: string | null;
  }[];
  mediumPriority?: { action: string; reason: string }[];
  lowPriority?: { action: string; reason: string }[];
  port: "yes" | "consider" | "no";
  portReason: string;
  portLookFor?: string[];
};

/** Three standard bills run through this policy's own room cap and co-pay, so
 *  the numbers on screen always agree with the terms shown above them. */
function simulate(bills: { scenario: string; amount: number }[], penaltyPct: number, copayPct: number, si: number) {
  return bills.map(({ scenario, amount }) => {
    const afterRoom = amount * (1 - penaltyPct / 100);
    const insurerPays = Math.min(Math.round(afterRoom * (1 - copayPct / 100)), si);
    const oop = amount - insurerPays;
    const ratio = Math.round((oop / amount) * 100) / 100;
    return {
      scenario,
      total_bill: amount,
      insurer_pays: insurerPays,
      patient_oop: oop,
      oop_ratio: ratio,
      verdict: ratio <= 0.05 ? "COVERED" : ratio <= 0.25 ? "PARTIAL" : "EXPOSED",
      explanation:
        ratio <= 0.05
          ? "Settled in full apart from non-medical consumables."
          : `Room-rent deduction and co-pay together leave ₹${oop.toLocaleString("en-IN")} with the family.`,
    };
  });
}

function healthReport(o: ReportOpts) {
  const penaltyPct = o.roomRent?.penaltyPct ?? 0;
  const copayPct = o.copayPct ?? 0;
  const pedMonths = o.pedMonths ?? 36;
  const specificMonths = o.specificMonths ?? 24;
  const restore = o.restoration ?? { exists: true, type: "full" as const, useful: true, remarks: "Restores the full sum insured once a year." };
  const zone = o.zone ?? "B";

  /* One cover figure, and everything else derived from it. Effective cover is
     the base sum insured plus the accrued bonus in rupees — the same definition
     calculateEffectiveCoverage applies in shared/policy.ts. Stating it once and
     deriving nec / total_effective_coverage / NCAR from it is what stops the
     renderer flagging the report as "restated" and printing a correction notice
     over a demo policy that was never wrong. */
  const bonusRupees = Math.round((o.baseSI * (o.ncbCurrent ?? 0)) / 100);
  const effectiveCover = o.baseSI + bonusRupees;
  const rct = requiredCover(o.ages, zone);
  const ncar = Number((effectiveCover / rct).toFixed(2));

  /* The score IS the deductions. Authoring the two separately is how the demo
     came to show a 58 above a list of clauses that added up to something else. */
  const deductions = o.deductions ?? [];
  const totalDeducted = deductions.reduce((t, d) => t + d.points, 0);
  const score = Math.max(0, Math.min(100, 100 - totalDeducted));
  const pointsIn = (category: DeductionCategory) =>
    deductions.filter((d) => d.category === category).reduce((t, d) => t + d.points, 0);

  return {
    identity: {
      insured_names: o.insured,
      ages: o.ages,
      genders: o.genders ?? o.insured.map(() => null),
      city: o.city,
      assumed_zone: zone,
      health_flags: o.healthFlags ?? [],
      confidence: "high",
    },
    policy_timeline: {
      policy_inception_date: dateAgo(o.inceptionDays),
      policy_expiry_date: dateAgo(o.expiryDays),
      policy_tenure_years: o.tenureYears ?? 1,
      policy_age_days: Math.round(o.inceptionDays),
      analysis_date: dateAgo(0),
      confidence: "high",
    },
    coverage_structure: {
      base_sum_insured: o.baseSI,
      top_up: { exists: false, sum_insured: null, deductible: null, type: null, deductible_achievable: null, remarks: null },
      super_top_up: { exists: false, sum_insured: null, deductible: null, deductible_achievable: null, remarks: null },
      restoration: {
        exists: restore.exists,
        type: restore.exists ? restore.type ?? "full" : null,
        restore_amount: restore.exists ? o.baseSI : null,
        // A demo restore is the common Indian shape: unrelated illnesses only.
        // These drive the restoration line under Effective Cover, which stays
        // silent rather than guessing when they are absent.
        same_illness_covered: restore.exists ? restore.sameIllness ?? false : null,
        unlimited: restore.exists ? restore.unlimited ?? false : null,
        triggers_on_first_claim: null,
        trigger_conditions: restore.exists ? "After the base sum insured is exhausted in a policy year." : null,
        actually_useful: restore.exists ? restore.useful ?? true : null,
        remarks: restore.remarks ?? null,
      },
      no_claim_bonus: {
        exists: true,
        rate_per_year: 10,
        cap_percentage: o.ncbCap ?? 50,
        // Rupees, not the percentage it is authored as: calculateEffectiveCoverage
        // reads this field directly and discards values too small to be rupees.
        current_bonus: bonusRupees,
        portability: "yes",
        clarity: "clear",
        remarks: "Accrued bonus is lost if the policy lapses beyond the grace period.",
      },
      riders: o.riders ?? [],
      total_effective_coverage: effectiveCover,
      confidence: "high",
    },
    waiting_period_analysis: {
      initial_waiting_period: {
        duration_days: 30,
        end_date: dateAgo(o.inceptionDays - 30),
        is_active_today: o.inceptionDays < 30,
        risk_commentary: o.inceptionDays < 30 ? "Only accidents are covered right now." : "Served in full.",
      },
      pre_existing_disease: {
        duration_months: pedMonths,
        start_date: dateAgo(o.inceptionDays),
        end_date: dateAgo(o.inceptionDays - pedMonths * 30),
        is_active_today: o.inceptionDays < pedMonths * 30,
        months_remaining: Math.max(0, Math.ceil((pedMonths * 30 - o.inceptionDays) / 30)),
        risk_commentary:
          o.inceptionDays < pedMonths * 30
            ? "Anything traced back to a pre-existing condition will be declined until this ends."
            : "Pre-existing conditions are now payable.",
      },
      specific_diseases: {
        duration_months: specificMonths,
        diseases_covered: o.specificDiseases ?? ["Cataract", "Hernia", "Piles", "Knee replacement"],
        end_date: dateAgo(o.inceptionDays - specificMonths * 30),
        is_active_today: o.inceptionDays < specificMonths * 30,
        risk_commentary:
          o.inceptionDays < specificMonths * 30
            ? "These named procedures are not payable yet, even without any pre-existing condition."
            : "Named procedures are now payable.",
      },
      personal_waiting_periods: [],
      maternity: {
        duration_months: o.maternity?.months ?? null,
        end_date: o.maternity?.months ? dateAgo(o.inceptionDays - o.maternity.months * 30) : null,
        is_active_today: o.maternity?.months ? o.inceptionDays < o.maternity.months * 30 : null,
        months_remaining: o.maternity?.months ? Math.max(0, Math.ceil((o.maternity.months * 30 - o.inceptionDays) / 30)) : null,
        risk_commentary: o.maternity?.relevant
          ? "Relevant for this family — delivery costs fall on them until the wait ends."
          : "Not relevant for the ages on this policy.",
        relevant: o.maternity?.relevant ?? false,
      },
      policy_fully_active: o.inceptionDays > pedMonths * 30,
    },
    claim_risk_analysis: {
      room_rent: o.roomRent
        ? {
            limit_type: o.roomRent.limit_type,
            limit_value: o.roomRent.limit_value,
            limit_amount_per_day: o.roomRent.limit_amount_per_day,
            penalty_type: "proportional",
            penalty_calculation: `Every line of the bill is scaled down in the same proportion as the room rent overshoot — roughly ${o.roomRent.penaltyPct}% of a typical bill.`,
            risk_level: o.roomRent.risk_level,
            zone_adequacy: o.roomRent.zone_adequacy,
            explanation: o.roomRent.explanation,
          }
        : {
            limit_type: "none",
            limit_value: null,
            limit_amount_per_day: null,
            penalty_type: "none",
            penalty_calculation: null,
            risk_level: "low",
            zone_adequacy: "adequate",
            explanation: "No room-rent cap — any room category is payable, so no proportionate deduction applies.",
          },
      co_payment: {
        exists: copayPct > 0,
        percentage: copayPct || null,
        conditions: o.copayConditions ?? null,
        applies_to: copayPct > 0 ? o.copayAppliesTo ?? "all_claims" : null,
        waiver_conditions: null,
        risk_level: copayPct >= 20 ? "high" : copayPct > 0 ? "medium" : "low",
        oop_on_5L_claim: copayPct > 0 ? Math.round((500000 * copayPct) / 100) : 0,
      },
      sub_limits: {
        exists: (o.subLimits?.length ?? 0) > 0,
        categories: (o.subLimits ?? []).map((s) => ({
          procedure: s.procedure,
          limit: s.limit,
          typical_cost_in_zone: s.typical_cost_in_zone,
          gap: s.typical_cost_in_zone - s.limit,
          severity: s.severity,
        })),
        risk_level: (o.subLimits?.length ?? 0) > 1 ? "high" : o.subLimits?.length ? "medium" : "low",
        remarks: o.subLimits?.length ? "Capped procedures are paid up to the cap only; the rest is out of pocket." : null,
      },
      deductibles: {
        base_deductible: null,
        per_claim_impact: null,
        remarks: "No deductible on the base policy.",
      },
    },
    claim_simulations: simulate(
      [
        { scenario: "Two days in ICU for dengue", amount: 180000 },
        { scenario: "Angioplasty with one stent", amount: 450000 },
        { scenario: "Cancer treatment, first year", amount: 1200000 },
      ],
      penaltyPct,
      copayPct,
      o.baseSI,
    ),
    supplementary_coverage: {
      opd: {
        covered: o.opd?.covered ?? false,
        limit_per_year: o.opd?.limit ?? null,
        conditions: null,
        utility: o.opd?.covered ? "medium" : "none",
        remarks: o.opd?.remarks ?? "Doctor visits, tests and medicines outside hospitalisation are not covered.",
      },
      maternity: {
        covered: o.maternity?.covered ?? false,
        limit_per_delivery: o.maternity?.limit ?? null,
        waiting_period_over: o.maternity?.months ? o.inceptionDays > o.maternity.months * 30 : null,
        conditions: null,
        utility: o.maternity?.relevant ? "high" : "none",
        remarks: o.maternity?.covered ? "Payable once the maternity wait is served." : "Not covered on this plan.",
      },
      consumables: {
        covered: o.consumables?.covered ?? false,
        coverage_type: o.consumables?.coverage_type ?? "none",
        limit: null,
        remarks: o.consumables?.remarks ?? "Gloves, syringes and similar items are deducted from every bill.",
      },
      modern_treatments: {
        covered: true,
        examples: ["Robotic surgery", "Oral chemotherapy", "Deep brain stimulation"],
        conditions: "Usually capped at a percentage of the sum insured.",
        remarks: null,
      },
      ambulance: { covered: true, limit_per_trip: o.ambulanceLimit ?? 2000, remarks: null },
      day_care_procedures: { covered: true, number_of_procedures: 540, remarks: "All listed day-care procedures." },
      preventive_health_checkup: { covered: true, limit_per_year: 5000, remarks: "Once a policy year, after a claim-free year." },
    },
    network_limitations: {
      network_type: "cashless_and_reimbursement",
      hospital_count_in_zone: o.networkCount ?? 6800,
      major_hospitals_included: o.networkHospitals ?? ["Apollo", "Fortis", "CHL Hospitals", "Bombay Hospital Indore"],
      reimbursement_allowed: true,
      risk_level: "low",
      remarks: "Cashless works at network hospitals; anywhere else is reimbursement.",
    },
    benefit_evaluation: {
      what_actually_works: o.works ?? [],
      where_policy_fails: o.fails ?? [],
      structural_red_flags: o.redFlags ?? [],
    },
    audit_score: {
      score,
      raw_score: score,
      ncar,
      nec: effectiveCover,
      // RUPEES. This is the denominator of NCAR, not a percentage — see
      // requiredCover above for what went wrong when it held one.
      rct,
      bucket_label: o.bucketLabel ?? null,
      // Each bar is the sum of the deductions filed under it, so the bar and the
      // clauses the reader can expand underneath it are the same number.
      breakdown: {
        net_cover_penalty: pointsIn("NET_COVER"),
        claim_rejection_risk: pointsIn("CLAIM_REJECTION"),
        oop_exposure: pointsIn("OOP_EXPOSURE"),
        coverage_quality_gap: pointsIn("COVERAGE_GAP"),
      },
      deductions,
      interpretation: o.summary,
    },
    final_verdict: {
      label: o.label,
      summary: o.summary,
      key_failure_points: o.failures,
      will_this_policy_protect_in_real_claim: o.realClaim,
    },
    recommendations: {
      critical_actions: (o.actions ?? []).map((a) => ({
        action: a.action,
        reason: a.reason,
        oop_risk_if_ignored: a.oop_risk_if_ignored ?? null,
        suggested_riders_or_topups: a.suggested_riders_or_topups ?? [],
        estimated_cost: a.estimated_cost ?? null,
      })),
      should_port_to_better_policy: {
        recommendation: o.port,
        reason: o.portReason,
        what_to_look_for: o.portLookFor ?? [],
      },
      medium_priority: o.mediumPriority ?? [],
      low_priority: o.lowPriority ?? [],
    },
    confidence_notes: [
      "Read from the policy schedule and the wording supplied with it.",
      "Hospital costs are typical ranges for the city on the schedule, not quotes.",
    ],
    /* Without this every demo report carried a banner reading "Scored under
       earlier rules … Re-run this policy", because an absent stamp means
       "predates the current rules" (isScoredUnderOldRules). Stamping the live
       version says what is true: this report was produced by today's engine. */
    engine: {
      prompt_version: DEMO_PROMPT_VERSION,
      scoring_version: CURRENT_SCORING_VERSION,
      scored_at: dateAgo(0),
    },
    data_quality: {
      overall: "high",
      missing_critical_fields: [],
      ambiguous_clauses: [],
      policy_document_quality: "clear",
    },
  };
}

/**
 * A finished health policy for the bulk book.
 *
 * Four profiles, picked by index, so the book holds a real spread of outcomes
 * rather than one report repeated ninety-six times. Each profile's structural
 * facts and its deductions describe the same policy: a profile that deducts for
 * a co-pay carries the co-pay, and one that deducts for a room cap carries the
 * cap. The score falls out of the deductions, so nothing can disagree.
 */
function bulkHealthReport(o: {
  i: number;
  person: string;
  spouse: string;
  city: string;
  zone: "A" | "B" | "C" | "D";
  baseSI: number;
  inceptionDays: number;
  expiryDays: number;
}) {
  const profile = o.i % 4;
  const si = (n: number) => `₹${(n / 100000).toFixed(0)}L`;
  /* Four profiles alone gave the whole book four scores, repeated. Real policies
     of the same shape still differ, so each row moves its largest deduction by a
     few points — deterministic, and the score follows it because the score is
     the deductions. */
  const nudge = (points: number) => Math.max(1, points + ((o.i % 7) - 3));
  const common = {
    city: o.city,
    zone: o.zone,
    inceptionDays: o.inceptionDays,
    expiryDays: o.expiryDays,
    baseSI: o.baseSI,
  };

  if (profile === 0) {
    return healthReport({
      ...common,
      insured: [o.person, o.spouse], ages: [38, 35], genders: ["male", "female"],
      ncbCurrent: 20, pedMonths: 36, specificMonths: 24,
      consumables: { covered: true, coverage_type: "full", remarks: "Consumables are paid in full." },
      label: "SAFE", bucketLabel: "Well covered",
      summary: `Clean claim terms: no room-rent cap and no co-pay, so a bill on this plan is settled close to as presented. What is left is the waiting periods.`,
      realClaim: "Yes. An ordinary admission settles in full apart from a small non-payable share.",
      failures: ["Pre-existing conditions wait until the 36-month period ends", "No OPD cover for routine consultations and tests"],
      deductions: [
        { reason: "Pre-existing wait still running", category: "CLAIM_REJECTION", severity: "medium", points: nudge(8) },
        { reason: "No OPD cover", category: "COVERAGE_GAP", severity: "low", points: 4 },
      ],
      works: [
        { benefit: "No room-rent cap and no co-pay", why_it_matters_in_claim: "The bill is settled as presented, with no proportionate deduction.", quantified_value: null },
        { benefit: "Consumables covered in full", why_it_matters_in_claim: "Removes the item most often deducted from a settled claim.", quantified_value: "₹15,000–₹40,000 per admission" },
      ],
      fails: [
        { issue: "Pre-existing conditions not yet payable", real_world_claim_impact: "Anything traced to a declared condition is declined until the wait ends.", quantified_oop_risk: "Full cost of such an admission" },
      ],
      actions: [],
      mediumPriority: [{ action: "Do not let the policy lapse before the pre-existing wait ends", reason: "A lapse restarts the 36-month clock." }],
      port: "no",
      portReason: "The terms are already good and the waiting period is part-served. Moving would restart it.",
    });
  }

  if (profile === 1) {
    return healthReport({
      ...common,
      insured: [o.person], ages: [46], genders: ["female"],
      ncbCurrent: 10, pedMonths: 36, specificMonths: 24,
      subLimits: [
        { procedure: "Cataract (per eye)", limit: 35000, typical_cost_in_zone: 55000, severity: "medium" },
        { procedure: "Hernia repair", limit: 60000, typical_cost_in_zone: 95000, severity: "low" },
      ],
      restoration: { exists: false, remarks: `No restoration — once ${si(o.baseSI)} is used in a policy year there is nothing left until renewal.` },
      label: "BORDERLINE", bucketLabel: "Partly covered",
      summary: `The claim terms are clean. The weakness is size and shape: named procedures pay only up to their cap, and there is no refill once ${si(o.baseSI)} is used.`,
      realClaim: "Mostly. One ordinary admission settles well; a second in the same year would not.",
      failures: ["Disease-wise caps on two common procedures", "No restoration once the sum insured is used", "Cover is below what one serious admission costs at this age"],
      deductions: [
        { reason: "Disease-wise sub-limits on common procedures", category: "COVERAGE_GAP", severity: "medium", points: 11 },
        { reason: "Sum insured below the recommended cover for this age and city", category: "NET_COVER", severity: "medium", points: nudge(12) },
        { reason: "Pre-existing wait not fully served", category: "CLAIM_REJECTION", severity: "low", points: 6 },
      ],
      works: [
        { benefit: "No co-pay and no room-rent cap", why_it_matters_in_claim: "Straightforward settlement on an ordinary admission.", quantified_value: null },
      ],
      fails: [
        { issue: "Sub-limit on cataract", real_world_claim_impact: "A routine procedure at this age is only two-thirds covered.", quantified_oop_risk: "≈ ₹20,000 per eye" },
        { issue: "No restoration", real_world_claim_impact: "A second hospitalisation in the same policy year is entirely out of pocket.", quantified_oop_risk: "Full cost of the second claim" },
      ],
      actions: [
        {
          action: "Add a super top-up above the current sum insured",
          reason: "Cheapest way to raise the cover without disturbing terms that are already good.",
          oop_risk_if_ignored: `Everything above ${si(o.baseSI)} in a bad year`,
          suggested_riders_or_topups: ["₹20L super top-up"],
          estimated_cost: "₹5,000–₹7,000 a year",
        },
      ],
      port: "consider",
      portReason: "The terms are worth keeping; the size is not. A top-up fixes it more cheaply than porting does.",
      portLookFor: ["No disease-wise sub-limits", "Unlimited restoration", "₹15L+ base cover"],
    });
  }

  if (profile === 2) {
    return healthReport({
      ...common,
      insured: [o.person, o.spouse], ages: [52, 49], genders: ["male", "female"],
      ncbCurrent: 20, pedMonths: 36, specificMonths: 24,
      roomRent: {
        limit_type: "specific_amount", limit_value: "₹5,000 per day",
        limit_amount_per_day: 5000, penaltyPct: 20, risk_level: "high", zone_adequacy: "marginal",
        explanation: `₹5,000 a day buys a shared room in most ${o.city} hospitals. Take a private room and every line of the bill is cut in the same proportion.`,
      },
      copayPct: 10, copayConditions: "Applies to every claim.",
      subLimits: [{ procedure: "Cataract (per eye)", limit: 30000, typical_cost_in_zone: 55000, severity: "medium" }],
      label: "BORDERLINE", bucketLabel: "Under-covered",
      summary: "A room-rent cap and a co-pay apply one after the other, so the family's share of a large bill compounds rather than adding up.",
      realClaim: "Partly. A large admission would leave roughly a quarter of the bill with the family.",
      failures: ["Room rent capped at ₹5,000 a day, with proportionate deduction on the whole bill", "10% co-pay on every claim", "Cataract capped below local cost"],
      deductions: [
        { reason: "Room rent capped at ₹5,000 a day", category: "CLAIM_REJECTION", severity: "high", points: nudge(12) },
        { reason: "10% co-pay on all claims", category: "OOP_EXPOSURE", severity: "high", points: 14 },
        { reason: "Sum insured below the recommended cover for this age and city", category: "NET_COVER", severity: "medium", points: 11 },
        { reason: "Cataract sub-limit below typical local cost", category: "COVERAGE_GAP", severity: "low", points: 6 },
      ],
      works: [
        { benefit: "No-claim bonus already at 20%", why_it_matters_in_claim: "Adds cover at no extra premium.", quantified_value: si(Math.round(o.baseSI * 0.2)) },
      ],
      fails: [
        { issue: "Room-rent cap with proportionate deduction", real_world_claim_impact: "Choosing a private room cuts every line of the bill, not just the room charge.", quantified_oop_risk: "≈ 20% of any admission" },
        { issue: "10% co-pay", real_world_claim_impact: "A tenth of every approved claim stays with the family.", quantified_oop_risk: "₹45,000 on a ₹4.5L claim" },
      ],
      redFlags: [
        { flag: "Cap and co-pay stack on the same claim", why_it_is_dangerous: "The two deductions are applied one after the other, so the family's share compounds.", severity: "high" },
      ],
      actions: [
        {
          action: "Port to a plan with no room-rent cap at renewal",
          reason: "The room cap is the single largest source of out-of-pocket cost on this policy.",
          oop_risk_if_ignored: "₹1L–₹2L on one major hospitalisation",
          suggested_riders_or_topups: ["No-cap base plan", "Super top-up above the current cover"],
          estimated_cost: "₹4,000–₹6,000 more a year",
        },
      ],
      port: "yes",
      portReason: "Plans at a similar premium drop both the cap and the co-pay, which is where this family's money is going.",
      portLookFor: ["No room-rent cap", "No co-pay", "Waiting periods already served, carried over"],
    });
  }

  return healthReport({
    ...common,
    insured: [o.person], ages: [61], genders: ["male"],
    ncbCurrent: 0, pedMonths: 48, specificMonths: 24,
    roomRent: {
      limit_type: "specific_amount", limit_value: "₹4,000 per day",
      limit_amount_per_day: 4000, penaltyPct: 25, risk_level: "high", zone_adequacy: "inadequate",
      explanation: `₹4,000 a day is workable in ${o.city} but not on a referral to a larger city, which is what happens with anything serious.`,
    },
    copayPct: 20, copayAppliesTo: "seniors_only", copayConditions: "20% of every claim, because the policy was bought after age 60.",
    subLimits: [
      { procedure: "Cataract (per eye)", limit: 25000, typical_cost_in_zone: 60000, severity: "high" },
      { procedure: "Knee replacement", limit: 150000, typical_cost_in_zone: 320000, severity: "high" },
    ],
    restoration: { exists: false, remarks: "No restoration on this plan." },
    label: "RISKY", bucketLabel: "Seriously under-covered",
    summary: "A room cap, a 20% co-pay and hard caps on the two most likely procedures. Each one is survivable; together they are why this policy pays for less than half of a serious year.",
    realClaim: "No. On a large admission the family would be finding a substantial share themselves.",
    failures: [
      "20% co-pay on every claim",
      "Room rent capped at ₹4,000 a day, with proportionate deduction",
      "Cataract and knee replacement capped well below local cost",
      "No restoration once the sum insured is used",
    ],
    deductions: [
      { reason: "20% co-pay on all claims", category: "OOP_EXPOSURE", severity: "high", points: 20 },
      { reason: "Sum insured far below the recommended cover at this age", category: "NET_COVER", severity: "high", points: nudge(18) },
      { reason: "Room rent capped with proportionate deduction", category: "CLAIM_REJECTION", severity: "high", points: 10 },
      { reason: "Hard sub-limits on the two most likely procedures", category: "COVERAGE_GAP", severity: "high", points: 6 },
    ],
    works: [
      { benefit: "Guaranteed lifelong renewal", why_it_matters_in_claim: "Renewal cannot be refused at this age, which matters more each year.", quantified_value: null },
    ],
    fails: [
      { issue: "20% co-pay", real_world_claim_impact: "A fifth of every approved claim is the customer's.", quantified_oop_risk: "₹90,000 on a ₹4.5L claim" },
      { issue: "Knee replacement capped at ₹1.5L", real_world_claim_impact: "The single most likely procedure at this age is half covered.", quantified_oop_risk: "≈ ₹1,70,000" },
    ],
    redFlags: [
      { flag: "Cover is smaller than one likely admission", why_it_is_dangerous: "The family will be arranging money in a hospital corridor regardless of this policy.", severity: "high" },
    ],
    actions: [
      {
        action: "Move to a senior plan with a lower co-pay and no room cap",
        reason: "The co-pay and the cap are the reason this policy does not work, and neither improves with time.",
        oop_risk_if_ignored: "₹2L+ on a single serious admission",
        suggested_riders_or_topups: ["₹10L super top-up above the current cover"],
        estimated_cost: "₹9,000–₹14,000 more a year",
      },
    ],
    port: "yes",
    portReason: "The co-pay and the sum insured both need to change, and neither can be fixed inside this plan.",
    portLookFor: ["Co-pay of 10% or lower", "No room-rent cap", "No sub-limit on knee replacement"],
  });
}

/**
 * The extracted fields a finished data-entry policy carries.
 *
 * Keyed strictly to EXTRACTION_FIELDS in lib/insuranceTypes.ts — that registry
 * is what the review form, the Excel export and the shared data-entry view all
 * read. A bulk motor row used to carry a single `reg_no`, which is not a key in
 * it, so every field on every one of these policies rendered blank.
 */
function bulkExtractedData(
  type: string,
  i: number,
  person: string,
  spec: { plan: string; insurer: string },
  sumInsured: number,
  inceptionDays: number,
  expiryDays: number,
  city: string,
) {
  const start = dateAgo(inceptionDays);
  const end = dateAgo(expiryDays);
  const seq = 100000 + i * 1373;
  const base = {
    policyholder_name: person,
    insurer: spec.insurer,
    plan_name: spec.plan,
    policy_number: `${spec.insurer.slice(0, 3).toUpperCase()}/${2000 + (i % 9)}/${seq}`,
  };

  if (type === "motor") {
    const twoWheeler = spec.plan.startsWith("Two Wheeler");
    const commercial = spec.plan.startsWith("Commercial");
    const model = twoWheeler
      ? ["Honda Activa 125", "TVS Jupiter", "Bajaj Pulsar 150"][i % 3]
      : commercial
        ? ["Tata Ace Gold", "Mahindra Bolero Pickup", "Ashok Leyland Dost"][i % 3]
        : ["Maruti Suzuki Baleno", "Hyundai i20", "Tata Nexon"][i % 3];
    const letters = `${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i + 7) % 26))}`;
    return {
      ...base,
      vehicle_registration_no: `MP09 ${letters} ${1000 + i}`,
      make_and_model: model,
      manufacturing_year: String(2018 + (i % 6)),
      engine_number: `EN${seq}${letters}`,
      chassis_number: `MA${letters}${seq}${1000 + i}`,
      idv: sumInsured,
      ncb_percent: [0, 20, 25, 35, 45, 50][i % 6],
      premium: twoWheeler ? 1900 + (i % 5) * 160 : commercial ? 24000 + (i % 5) * 1500 : 12000 + (i % 5) * 900,
      coverage_type: "Package (own damage + third party)",
      policy_start_date: start,
      policy_expiry_date: end,
      // Bundled cover: own damage runs a year, third party longer. The advisor
      // chases the own-damage date, which is why it matches expiry_date.
      od_expiry_date: end,
      tp_expiry_date: dateAgo(expiryDays - (twoWheeler ? 4 * 365 : 2 * 365)),
    };
  }

  if (type === "travel") {
    return {
      ...base,
      traveller_names: person,
      destination: ["Singapore", "Dubai", "Bangkok", "London"][i % 4],
      geographical_scope: i % 2 === 0 ? "Worldwide excluding USA and Canada" : "Asia",
      trip_start_date: dateAgo(expiryDays + 21),
      trip_end_date: end,
      sum_insured: sumInsured,
      premium: 2400 + (i % 5) * 380,
    };
  }

  if (type === "property") {
    const structure = Math.round(sumInsured * 0.7);
    return {
      ...base,
      property_address: `${100 + i}, Scheme ${50 + (i % 20)}, ${city}`,
      coverage_type: "Structure and contents",
      sum_insured: sumInsured,
      structure_sum_insured: structure,
      contents_sum_insured: sumInsured - structure,
      premium: 3200 + (i % 5) * 450,
      policy_start_date: start,
      policy_expiry_date: end,
    };
  }

  if (type === "fire") {
    const building = Math.round(sumInsured * 0.4);
    const plant = Math.round(sumInsured * 0.35);
    return {
      ...base,
      risk_location: `Plot ${20 + (i % 40)}, Sector ${1 + (i % 7)}, Industrial Area, ${city}`,
      occupancy: ["Textile processing unit", "Plastic moulding unit", "Godown — packaged goods"][i % 3],
      building_sum_insured: building,
      plant_machinery_sum_insured: plant,
      stock_sum_insured: sumInsured - building - plant,
      sum_insured: sumInsured,
      valuation_basis: "Reinstatement value",
      add_on_covers: "Earthquake, terrorism",
      premium: 18000 + (i % 5) * 2600,
      policy_start_date: start,
      policy_expiry_date: end,
    };
  }

  if (type === "marine") {
    return {
      ...base,
      cover_clauses: ["ICC (A)", "ICC (B)", "ICC (C)"][i % 3],
      goods_description: ["Cotton yarn in bales", "Pharmaceutical formulations", "Auto components"][i % 3],
      transit_mode: ["Road", "Sea", "Rail"][i % 3],
      transit_from: city,
      transit_to: ["Nhava Sheva", "Chennai Port", "Delhi"][i % 3],
      sum_insured: sumInsured,
      per_sending_limit: Math.round(sumInsured / 4),
      valuation_basis: "Invoice value plus 10%",
      premium: 9500 + (i % 5) * 1200,
      policy_start_date: start,
      policy_expiry_date: end,
    };
  }

  // life and term
  const isTerm = type === "term";
  const entryAge = 30 + (i % 20);
  const termYears = isTerm ? 30 : 20;
  return {
    ...base,
    life_assured_name: person,
    sum_assured: sumInsured,
    // Priced off the cover, not a flat number. A flat premium beside a rotating
    // sum assured put ₹57,000 a year against ₹3L of cover on the value screen,
    // which is a policy nobody has ever been sold.
    premium: isTerm
      // Roughly ₹12,600 a year per ₹1 crore at 30, rising with entry age, which
      // is where the Indian online term market actually sits.
      ? Math.round((sumInsured / 10000000) * (9000 + entryAge * 120) / 100) * 100
      : Math.round((sumInsured / termYears) * 1.05 / 100) * 100,
    premium_frequency: "Annual",
    policy_term_years: termYears,
    premium_paying_term_years: isTerm ? termYears : 12,
    start_date: start,
    next_premium_date: dateAgo(expiryDays),
    ...(isTerm
      ? { cover_till_age: entryAge + termYears, cover_end_date: dateAgo(expiryDays - (termYears - 1) * 365), plan_type: "Term cover only", death_benefit_payout: "Lump sum" }
      : { maturity_date: dateAgo(expiryDays - (termYears - 1) * 365), plan_type: "Endowment / savings", bonus_per_1000: 42 + (i % 6) }),
    age_at_entry: entryAge,
    nominee_name: `${["Smita", "Rajeev", "Nazia", "Suhas", "Lakshmi"][i % 5]} ${person.split(" ").slice(-1)[0]}`,
  };
}

/** Which extracted date owns `clients.expiry_date` for a given type. Mirrors
 *  deriveSharedColumns in backend/server/services/extractionFields.ts. */
function sharedExpiryDate(type: string, data: Record<string, any> | null): string | null {
  if (!data) return null;
  const key =
    type === "motor" ? "od_expiry_date"
      : type === "life" ? "maturity_date"
        : type === "term" ? "cover_end_date"
          : type === "travel" ? "trip_end_date"
            : "policy_expiry_date";
  const v = data[key];
  return typeof v === "string" && v ? v : null;
}

/** The five (now six) people the hand-written policies belong to. */
const CAST_NAMES = [
  "Suresh Agarwal", "Meena Joshi", "Vikram Singh", "Anita Desai", "Prakash Mehta", "Nitin Bhargava",
];

const BULK_NAMES = [
  "Anil Deshpande", "Bhavna Sule", "Farhan Qureshi", "Kavita Bhosale", "Ramesh Iyer",
  "Deepak Mane", "Aarti Joshi", "Nikhil Wagh", "Pooja Shirke", "Sanjay Kulkarni",
  "Rekha Nair", "Vijay Salunkhe", "Asha Pawar", "Mohan Gokhale", "Sneha Patil",
  "Imran Sayyed", "Lata Chavan", "Girish Rane", "Madhuri Kale", "Prashant Jadhav",
  "Nilima Sathe", "Ashok Bhide", "Shalini Karve", "Tushar Phadke", "Vandana Limaye",
  "Yogesh Barve", "Chitra Dixit", "Harish Naik", "Jyoti Ghatge", "Kiran Marathe",
];

/**
 * Every customer in the demo agent's own book, in order.
 *
 * Exported because the Team tab counts an advisor's customers from its own
 * roster (teamSeed) rather than from this store, and the owner's row was
 * therefore telling him he had five customers while his book listed thirty-six.
 */
export const DEMO_BOOK_CUSTOMER_NAMES: string[] = [...CAST_NAMES, ...BULK_NAMES];

export type Store = Record<string, any[]>;

export function buildSeed(): Store {
  const agent = {
    id: DEMO_AGENT_ID,
    full_name: "Rajesh Kumar",
    name: "Rajesh Kumar",
    email: DEMO_EMAIL,
    phone: "+91 98765 43210",
    city: "Indore, MP",
    location: "Indore, MP",
    role: "agent",
    plan: "agent",
    billing_cycle: "monthly",
    experience_years: 12,
    invite_code: "DEMO2026",
    is_admin: false,
    partnered_companies: ["Star Health and Allied Insurance Co Ltd", "HDFC ERGO General Insurance Company Limited"],
    created_at: ago(420),
  };

  // ---- Customers (the people behind the portfolio) -------------------------
  const customers = [
    { id: "cust-1", agent_id: DEMO_AGENT_ID, name: "Suresh Agarwal", phone: "+91 98200 11111", email: "suresh@example.com", dob: "1972-04-18", city: "Indore", notes: "Prefers WhatsApp. Family floater renewal due soon.", created_at: ago(300) },
    { id: "cust-2", agent_id: DEMO_AGENT_ID, name: "Meena Joshi", phone: "+91 98200 22222", email: "meena@example.com", dob: "1980-11-02", city: "Bhopal", notes: "Diabetic — needs disease-specific cover.", created_at: ago(220) },
    { id: "cust-3", agent_id: DEMO_AGENT_ID, name: "Vikram Singh", phone: "+91 98200 33333", email: null, dob: "1968-01-25", city: "Ujjain", notes: "Senior citizen plan. Call, don't text.", created_at: ago(180) },
    { id: "cust-4", agent_id: DEMO_AGENT_ID, name: "Anita Desai", phone: "+91 98200 44444", email: "anita@example.com", dob: "1985-07-09", city: "Indore", notes: "Young family, first policy.", created_at: ago(95) },
    { id: "cust-5", agent_id: DEMO_AGENT_ID, name: "Prakash Mehta", phone: "+91 98200 55555", email: "prakash@example.com", dob: "1976-03-30", city: "Dewas", notes: "Has car + health. Cross-sell life.", created_at: ago(60) },
    // Owns the unit linked policy. He used to be missing entirely and it was
    // filed against Meena Joshi, so her portfolio listed a stranger's plan.
    { id: "cust-6", agent_id: DEMO_AGENT_ID, name: "Nitin Bhargava", phone: "+91 98200 66666", email: "nitin@example.com", dob: "1988-06-14", city: "Indore", notes: "Unit linked plan bought in 2023. Wants to know what it will actually pay.", created_at: ago(40) },
  ];

  // ---- Clients (analysed policies = the agent's book) ----------------------
  const clients = [
    {
      id: "pol-1", agent_id: DEMO_AGENT_ID, customer_id: "cust-1",
      policy_name: "Family Health Optima", name: "Suresh Agarwal", policyholder_name: "Suresh Agarwal",
      insurer: INSURERS.star, insurance_type: "health", status: "done", score: 58,
      sum_insured: 500000, expiry_date: dateAgo(-18), created_at: ago(5),
      share_token: "demo-share-1", share_enabled: true, pdf_url: "#", error_message: null,
      flaws: [], extracted_data: null,
      report_data: healthReport({
        insured: ["Suresh Agarwal", "Kavita Agarwal"], ages: [54, 49], genders: ["male", "female"],
        city: "Indore", zone: "B", healthFlags: ["Hypertension declared at proposal"],
        inceptionDays: 347, expiryDays: -18, baseSI: 500000,
        roomRent: {
          limit_type: "percentage_of_si", limit_value: "1% of sum insured per day",
          limit_amount_per_day: 5000, penaltyPct: 25, risk_level: "high", zone_adequacy: "inadequate",
          explanation: "₹5,000 a day buys a shared room in most Indore hospitals. Take a private room and every line of the bill is cut in the same proportion.",
        },
        copayPct: 20, copayConditions: "Applies to every claim, regardless of age or hospital.",
        subLimits: [{ procedure: "Cataract (per eye)", limit: 40000, typical_cost_in_zone: 65000, severity: "medium" }],
        pedMonths: 36, specificMonths: 24, ncbCurrent: 20,
        restoration: { exists: true, type: "partial", useful: false, remarks: "Restores only for an unrelated illness — the common case, a second claim for the same condition, is not covered." },
        label: "RISKY", bucketLabel: "Under-covered",
        summary: "The cover amount is only part of the problem. A room-rent cap and a 20% co-pay together mean this family pays a quarter of any large bill themselves.",
        realClaim: "Partly. A ₹4.5L cardiac admission would leave roughly ₹1.9L with the family after the room deduction and co-pay.",
        failures: [
          "Room rent capped at 1% of sum insured, with proportionate deduction on the whole bill",
          "20% co-pay on every claim",
          "₹5L is thin for two adults in their fifties",
          "Restoration does not apply to a repeat claim for the same illness",
        ],
        deductions: [
          { reason: "Room rent capped at 1% of SI", category: "CLAIM_REJECTION", severity: "high", points: 14 },
          { reason: "20% co-pay on all claims", category: "OOP_EXPOSURE", severity: "high", points: 12 },
          { reason: "Sum insured below the recommended cover for this age and city", category: "NET_COVER", severity: "medium", points: 10 },
          { reason: "Cataract sub-limit below typical local cost", category: "COVERAGE_GAP", severity: "low", points: 6 },
        ],
        works: [
          { benefit: "No-claim bonus already at 20%", why_it_matters_in_claim: "Adds ₹1L of cover at no extra premium.", quantified_value: "₹1,00,000" },
          { benefit: "Wide cashless network in Indore", why_it_matters_in_claim: "The family is unlikely to have to arrange money up front.", quantified_value: null },
        ],
        fails: [
          { issue: "Room-rent cap with proportionate deduction", real_world_claim_impact: "Choosing a private room cuts every line of the bill, not just the room charge.", quantified_oop_risk: "≈ ₹1,12,000 on a ₹4.5L claim" },
          { issue: "20% co-pay", real_world_claim_impact: "One fifth of every approved claim stays with the family.", quantified_oop_risk: "₹90,000 on a ₹4.5L claim" },
        ],
        redFlags: [
          { flag: "Cap and co-pay stack on the same claim", why_it_is_dangerous: "The two deductions are applied one after the other, so the family's share compounds.", severity: "high" },
        ],
        actions: [
          {
            action: "Port to a plan with no room-rent cap before the renewal date",
            reason: "The room cap is the single largest source of out-of-pocket cost on this policy.",
            oop_risk_if_ignored: "₹1.5L–₹2L on one major hospitalisation",
            suggested_riders_or_topups: ["No-cap base plan at ₹15L", "Super top-up above a ₹5L deductible"],
            estimated_cost: "₹4,000–₹6,000 more a year",
          },
          {
            action: "Raise total cover to at least ₹25L",
            reason: "₹6L of effective cover is under a quarter of the ₹26.5L a single cardiac or cancer episode costs at 54 in this city.",
            oop_risk_if_ignored: "Full exposure above ₹5L",
            suggested_riders_or_topups: ["₹25L super top-up above a ₹5L deductible"],
            estimated_cost: "₹6,000–₹9,000 a year",
          },
        ],
        mediumPriority: [{ action: "Declare the hypertension history in writing at porting", reason: "Keeps the continuity of the served waiting periods and protects the claim later." }],
        port: "yes",
        portReason: "Plans at a similar premium drop both the room-rent cap and the co-pay, which is where this family's money is going.",
        portLookFor: ["No room-rent cap", "No co-pay", "Restoration that covers the same illness", "36-month PED wait already served, carried over"],
      }),
    },
    {
      id: "pol-2", agent_id: DEMO_AGENT_ID, customer_id: "cust-2",
      policy_name: "ReAssure 2.0", name: "Meena Joshi", policyholder_name: "Meena Joshi",
      insurer: INSURERS.niva, insurance_type: "health", status: "done", score: 82,
      sum_insured: 2500000, expiry_date: dateAgo(-120), created_at: ago(9),
      share_token: "demo-share-2", share_enabled: true, pdf_url: "#", error_message: null,
      flaws: [], extracted_data: null,
      report_data: healthReport({
        insured: ["Meena Joshi", "Rohan Joshi"], ages: [45, 47], genders: ["female", "male"],
        city: "Bhopal", zone: "B", healthFlags: ["Type 2 diabetes declared"],
        inceptionDays: 245, expiryDays: -120, baseSI: 2500000, ncbCurrent: 20,
        pedMonths: 36, specificMonths: 24,
        maternity: { months: 36, relevant: false, covered: true, limit: 50000 },
        consumables: { covered: true, coverage_type: "full", remarks: "Consumables are paid in full — unusual and worth keeping." },
        label: "SAFE", bucketLabel: "Well covered",
        summary: "A strong base plan. No room-rent cap, no co-pay, and consumables are paid — the gaps left are timing gaps, not structural ones.",
        realClaim: "Yes. A ₹4.5L admission would be settled in full apart from a small non-payable share.",
        failures: ["Diabetes claims wait until the 36-month pre-existing period ends", "No OPD cover for routine consultations and tests"],
        deductions: [
          { reason: "Pre-existing wait still running for the declared diabetes", category: "CLAIM_REJECTION", severity: "medium", points: 13 },
          { reason: "No OPD cover", category: "COVERAGE_GAP", severity: "low", points: 5 },
        ],
        works: [
          { benefit: "No room-rent cap", why_it_matters_in_claim: "Any room category is payable, so no proportionate deduction on the bill.", quantified_value: "Avoids ≈25% deduction" },
          { benefit: "Consumables covered in full", why_it_matters_in_claim: "Removes the item most often deducted from a settled claim.", quantified_value: "₹15,000–₹40,000 per admission" },
        ],
        fails: [
          { issue: "Diabetes-linked claims not yet payable", real_world_claim_impact: "Anything traced to the declared diabetes is declined until the wait ends.", quantified_oop_risk: "Full cost of a diabetes-related admission" },
        ],
        actions: [
          {
            action: "Do not let this policy lapse before the pre-existing wait ends",
            reason: "A lapse restarts the 36-month clock on the declared diabetes.",
            oop_risk_if_ignored: "Full cost of any diabetes-linked claim for another three years",
            suggested_riders_or_topups: [],
            estimated_cost: null,
          },
        ],
        mediumPriority: [{ action: "Add the OPD rider at renewal", reason: "Regular consultations and tests for the diabetes are being paid in cash today." }],
        lowPriority: [{ action: "Use the free annual health check", reason: "Already paid for in the premium." }],
        port: "no",
        portReason: "Porting would restart the pre-existing waiting period that is already two-thirds served. Keep the plan and add riders.",
      }),
    },
    {
      id: "pol-3", agent_id: DEMO_AGENT_ID, customer_id: "cust-3",
      policy_name: "Senior Citizen Red Carpet", name: "Vikram Singh", policyholder_name: "Vikram Singh",
      insurer: INSURERS.star, insurance_type: "health", status: "done", score: 49,
      sum_insured: 300000, expiry_date: dateAgo(-9), created_at: ago(12),
      share_token: "demo-share-3", share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], extracted_data: null,
      report_data: healthReport({
        insured: ["Vikram Singh"], ages: [66], genders: ["male"],
        city: "Ujjain", zone: "C", healthFlags: ["Age above 60 at entry"],
        inceptionDays: 356, expiryDays: -9, baseSI: 300000, ncbCurrent: 0,
        roomRent: {
          limit_type: "specific_amount", limit_value: "₹3,000 per day",
          limit_amount_per_day: 3000, penaltyPct: 20, risk_level: "high", zone_adequacy: "marginal",
          explanation: "₹3,000 a day is workable in Ujjain but not if he is referred to Indore or Bhopal, which is what happens with anything serious.",
        },
        copayPct: 50, copayAppliesTo: "seniors_only", copayConditions: "50% of every claim, because the policy was bought after age 60.",
        subLimits: [
          { procedure: "Cataract (per eye)", limit: 25000, typical_cost_in_zone: 60000, severity: "high" },
          { procedure: "Knee replacement", limit: 150000, typical_cost_in_zone: 320000, severity: "high" },
        ],
        pedMonths: 24, specificMonths: 24,
        restoration: { exists: false, remarks: "No restoration on this plan." },
        label: "RISKY", bucketLabel: "Seriously under-covered",
        summary: "A 50% co-pay on a ₹3L cover means this policy pays for roughly a fifth of a serious hospitalisation. It is a discount, not a cover.",
        realClaim: "No. On a ₹4.5L admission the insurer would pay about ₹1.8L and Mr Singh would find ₹2.7L himself.",
        failures: [
          "50% co-pay on every claim",
          "₹3L sum insured against typical senior hospitalisation costs",
          "Cataract and knee replacement capped well below local cost",
          "No restoration once the ₹3L is used",
        ],
        deductions: [
          { reason: "50% co-pay on all claims", category: "OOP_EXPOSURE", severity: "high", points: 22 },
          { reason: "Sum insured far below recommended cover at 66", category: "NET_COVER", severity: "high", points: 16 },
          { reason: "Hard sub-limits on the two most likely procedures", category: "COVERAGE_GAP", severity: "high", points: 8 },
          { reason: "No restoration benefit", category: "COVERAGE_GAP", severity: "medium", points: 5 },
        ],
        works: [
          { benefit: "Guaranteed lifelong renewal", why_it_matters_in_claim: "He cannot be refused renewal at this age, which matters more each year.", quantified_value: null },
        ],
        fails: [
          { issue: "50% co-pay", real_world_claim_impact: "Half of every approved claim is his.", quantified_oop_risk: "₹2,25,000 on a ₹4.5L claim" },
          { issue: "Knee replacement capped at ₹1.5L", real_world_claim_impact: "The single most likely procedure at his age is half covered.", quantified_oop_risk: "≈ ₹1,70,000" },
        ],
        redFlags: [
          { flag: "Cover is smaller than one likely admission", why_it_is_dangerous: "The family will be arranging money in a hospital corridor regardless of this policy.", severity: "high" },
        ],
        actions: [
          {
            action: "Move to a senior plan with a 10–20% co-pay and at least ₹5L cover",
            reason: "The 50% co-pay is the reason this policy does not work, and it does not improve with time.",
            oop_risk_if_ignored: "₹2.5L+ on a single serious admission",
            suggested_riders_or_topups: ["₹5L senior plan with 20% co-pay", "₹10L super top-up above a ₹3L deductible"],
            estimated_cost: "₹9,000–₹14,000 more a year",
          },
          {
            action: "If porting is refused on health grounds, add a super top-up above this policy",
            reason: "A top-up above a ₹3L deductible is cheap at this age and covers the part this policy cannot reach.",
            oop_risk_if_ignored: "Everything above ₹3L",
            suggested_riders_or_topups: ["₹10L super top-up"],
            estimated_cost: "₹7,000–₹10,000 a year",
          },
        ],
        port: "yes",
        portReason: "The co-pay and the sum insured both need to change, and neither can be fixed inside this plan.",
        portLookFor: ["Co-pay of 20% or lower", "₹5L or more base cover", "No sub-limit on knee replacement", "Entry age and renewal guaranteed past 70"],
      }),
    },
    {
      id: "pol-4", agent_id: DEMO_AGENT_ID, customer_id: "cust-4",
      policy_name: "Optima Secure", name: "Anita Desai", policyholder_name: "Anita Desai",
      insurer: INSURERS.hdfc, insurance_type: "health", status: "done", score: 91,
      sum_insured: 2000000, expiry_date: dateAgo(-200), created_at: ago(18),
      share_token: "demo-share-4", share_enabled: true, pdf_url: "#", error_message: null,
      flaws: [], extracted_data: null,
      report_data: healthReport({
        insured: ["Anita Desai", "Kunal Desai", "Ira Desai"], ages: [40, 42, 8], genders: ["female", "male", "female"],
        city: "Indore", zone: "B",
        inceptionDays: 165, expiryDays: -200, baseSI: 2000000, ncbCurrent: 0,
        pedMonths: 36, specificMonths: 24,
        maternity: { months: 48, relevant: false, covered: true, limit: 100000 },
        consumables: { covered: true, coverage_type: "full", remarks: "Consumables paid in full." },
        opd: { covered: true, limit: 10000, remarks: "₹10,000 a year for consultations, tests and pharmacy." },
        riders: [{ name: "Secure Benefit (cover doubles from year one)", coverage_amount: 2000000, is_material: true, remarks: "Effective cover is ₹40L from the first year." }],
        ambulanceLimit: 5000, networkCount: 13000,
        label: "EXCELLENT", bucketLabel: "Fully covered",
        summary: "Nothing here needs fixing. No room cap, no co-pay, consumables paid, and the effective cover is well ahead of what this family would need.",
        realClaim: "Yes. A ₹4.5L admission settles in full, and the cover would absorb a ₹12L cancer year without exhausting.",
        failures: [],
        deductions: [{ reason: "Standard 36-month pre-existing wait still running", category: "CLAIM_REJECTION", severity: "low", points: 9 }],
        works: [
          { benefit: "No room-rent cap and no co-pay", why_it_matters_in_claim: "The bill is settled as presented.", quantified_value: null },
          { benefit: "Cover effectively ₹40L from year one", why_it_matters_in_claim: "Absorbs a full cancer or transplant year without a top-up.", quantified_value: "₹40,00,000" },
          { benefit: "Consumables and OPD both covered", why_it_matters_in_claim: "Removes the two costs families usually end up paying in cash.", quantified_value: "₹25,000+ a year" },
        ],
        fails: [],
        actions: [],
        mediumPriority: [{ action: "Keep the renewal date in the calendar", reason: "The only real risk to this policy is an accidental lapse." }],
        lowPriority: [{ action: "Use the annual health check for both adults", reason: "Included in the premium." }],
        port: "no",
        portReason: "There is nothing better to move to at this premium. Leave it alone.",
      }),
    },
    {
      id: "pol-5", agent_id: DEMO_AGENT_ID, customer_id: "cust-5",
      policy_name: "Care Supreme", name: "Prakash Mehta", policyholder_name: "Prakash Mehta",
      insurer: INSURERS.care, insurance_type: "health", status: "done", score: 67,
      sum_insured: 1500000, expiry_date: dateAgo(-25), created_at: ago(22),
      share_token: "demo-share-5", share_enabled: true, pdf_url: "#", error_message: null,
      flaws: [], extracted_data: null,
      report_data: healthReport({
        insured: ["Prakash Mehta", "Sunita Mehta"], ages: [50, 46], genders: ["male", "female"],
        city: "Dewas", zone: "C",
        inceptionDays: 340, expiryDays: -25, baseSI: 1500000, ncbCurrent: 10,
        subLimits: [{ procedure: "Cataract (per eye)", limit: 30000, typical_cost_in_zone: 55000, severity: "medium" }],
        pedMonths: 36, specificMonths: 24,
        restoration: { exists: false, remarks: "No restoration — once ₹15L is used in a policy year, there is nothing left until renewal." },
        label: "BORDERLINE", bucketLabel: "Partly covered",
        summary: "The claim terms are clean — no room cap, no co-pay. The weakness is size: one long year of treatment can empty the cover with nothing to fall back on.",
        realClaim: "Mostly. A single ₹4.5L admission settles well; a second claim in the same year would not.",
        failures: ["No restoration once the sum insured is used", "Cataract capped below local cost", "₹15L runs out quickly if a serious year runs long"],
        deductions: [
          { reason: "No restoration benefit", category: "COVERAGE_GAP", severity: "high", points: 13 },
          { reason: "Sum insured below recommended cover for this age", category: "NET_COVER", severity: "medium", points: 15 },
          { reason: "Cataract sub-limit", category: "COVERAGE_GAP", severity: "low", points: 5 },
        ],
        works: [
          { benefit: "No room-rent cap and no co-pay", why_it_matters_in_claim: "Bills are settled as presented, which is the expensive part on most plans.", quantified_value: null },
        ],
        fails: [
          { issue: "No restoration", real_world_claim_impact: "A second hospitalisation in the same policy year is entirely out of pocket.", quantified_oop_risk: "Full cost of the second claim" },
        ],
        actions: [
          {
            action: "Add a super top-up above a ₹15L deductible",
            reason: "Cheapest way to turn ₹15L of cover into ₹40L+ without disturbing a plan whose terms are already good.",
            oop_risk_if_ignored: "Everything above ₹15L in a bad year",
            suggested_riders_or_topups: ["₹25L super top-up above ₹15L deductible"],
            estimated_cost: "₹5,000–₹7,000 a year",
          },
        ],
        mediumPriority: [{ action: "Ask the insurer about a restoration add-on at renewal", reason: "Some variants of this plan offer it for a small loading." }],
        port: "consider",
        portReason: "The terms are worth keeping; the size is not. A top-up fixes it more cheaply than porting does.",
        portLookFor: ["Unlimited restoration", "₹25L+ base cover", "No cataract sub-limit"],
      }),
    },
    {
      id: "pol-6", agent_id: DEMO_AGENT_ID, customer_id: "cust-2",
      // Activ One MAX is an Aditya Birla Health product. It used to sit under
      // ICICI Lombard here, which is a different company selling a different plan.
      policy_name: "Activ One MAX", name: "Meena Joshi", policyholder_name: "Meena Joshi",
      insurer: INSURERS.abhi, insurance_type: "health", status: "done", score: 74,
      sum_insured: 2000000, expiry_date: dateAgo(-300), created_at: ago(30),
      share_token: null, share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], extracted_data: null,
      report_data: healthReport({
        insured: ["Meena Joshi"], ages: [45], genders: ["female"],
        city: "Bhopal", zone: "B",
        inceptionDays: 430, expiryDays: -300, baseSI: 2000000, ncbCurrent: 20, tenureYears: 2,
        subLimits: [
          { procedure: "Cataract (per eye)", limit: 35000, typical_cost_in_zone: 55000, severity: "medium" },
          { procedure: "Hernia repair", limit: 60000, typical_cost_in_zone: 95000, severity: "low" },
        ],
        pedMonths: 36, specificMonths: 24,
        label: "SAFE", bucketLabel: "Adequately covered",
        summary: "A solid second cover for the same person. Clean claim terms; the only friction is disease-wise caps on a few common procedures.",
        realClaim: "Yes, for a normal admission. Named procedures pay only up to their cap.",
        failures: ["Disease-wise caps on cataract and hernia", "Overlaps with the ReAssure policy on the same life"],
        deductions: [
          { reason: "Disease-wise sub-limits on common procedures", category: "COVERAGE_GAP", severity: "medium", points: 16 },
          { reason: "Pre-existing wait not fully served", category: "CLAIM_REJECTION", severity: "low", points: 10 },
        ],
        works: [
          { benefit: "No co-pay and no room-rent cap", why_it_matters_in_claim: "Straightforward settlement on an ordinary admission.", quantified_value: null },
          { benefit: "20% accrued no-claim bonus", why_it_matters_in_claim: "₹4L of extra cover at no cost.", quantified_value: "₹4,00,000" },
        ],
        fails: [
          { issue: "Sub-limit on cataract", real_world_claim_impact: "A routine procedure at her age is only two-thirds covered.", quantified_oop_risk: "≈ ₹20,000 per eye" },
        ],
        actions: [],
        mediumPriority: [
          { action: "Decide which of the two health policies to keep at renewal", reason: "Two overlapping covers on one life is premium spent twice; a single larger plan usually costs less." },
        ],
        port: "no",
        portReason: "Nothing wrong with the plan itself. The question is whether it is needed alongside the ReAssure policy.",
      }),
    },
    // A couple of data-entry (non-health) policies to show multi-LoB.
    //
    // Every key below is a key from EXTRACTION_FIELDS.motor in
    // lib/insuranceTypes.ts. The review form reads that registry and nothing
    // else, so the old ad-hoc `vehicle` / `reg_no` pair rendered as a wall of
    // empty inputs: the fields existed, the data was filed under names the form
    // does not look for.
    {
      id: "pol-7", agent_id: DEMO_AGENT_ID, customer_id: "cust-5",
      policy_name: "Private Car Package", name: "Prakash Mehta", policyholder_name: "Prakash Mehta",
      insurer: INSURERS.digit, insurance_type: "motor", status: "done", score: null,
      // Bundled cover: OD runs a year, TP three. clients.expiry_date tracks the
      // OD date, because that is the renewal the advisor actually sells.
      sum_insured: 650000, expiry_date: dateAgo(-12), created_at: ago(14),
      share_token: null, share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], report_data: null,
      extracted_data: {
        policyholder_name: "Prakash Mehta", insurer: INSURERS.digit,
        policy_number: "D-091-2025-4417820", plan_name: "Private Car Package",
        vehicle_registration_no: "MP09 CX 4521", make_and_model: "Hyundai Creta 1.5 SX",
        manufacturing_year: "2021", engine_number: "G4FGKM821447",
        chassis_number: "MALC381CLMM214470",
        idv: 650000, ncb_percent: 20, premium: 18400,
        coverage_type: "Package (own damage + third party)",
        policy_start_date: dateAgo(353), policy_expiry_date: dateAgo(-12),
        od_expiry_date: dateAgo(-12), tp_expiry_date: dateAgo(-742),
        [ADD_ON_FINDINGS_KEY]: demoAddOnScan("car"),
      },
    },
    // The other half of the motor story: a policy carrying nothing, where the
    // premium arithmetic proves it rather than a search failing to find it.
    // Both states need to be walkable, or a demo only ever shows the happy one.
    {
      id: "pol-7b", agent_id: DEMO_AGENT_ID, customer_id: "cust-2",
      policy_name: "Two Wheeler Package", name: "Rohan Joshi", policyholder_name: "Rohan Joshi",
      insurer: INSURERS.icici, insurance_type: "motor", status: "done", score: null,
      sum_insured: 85000, expiry_date: dateAgo(-40), created_at: ago(9),
      share_token: null, share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], report_data: null,
      extracted_data: {
        policyholder_name: "Rohan Joshi", insurer: INSURERS.icici,
        policy_number: "3005/M-2247180/00/000", plan_name: "Two Wheeler Package",
        vehicle_registration_no: "MP04 DD 7781", make_and_model: "Honda Activa 125",
        manufacturing_year: "2022", engine_number: "JF50E71229104",
        chassis_number: "ME4JF50CKN7229104",
        idv: 85000, ncb_percent: 25, premium: 5200,
        coverage_type: "Package (own damage + third party)",
        policy_start_date: dateAgo(325), policy_expiry_date: dateAgo(-40),
        // Two-wheeler third-party cover is sold for five years at first sale, so
        // the two dates are years apart on a bike in a way they rarely are on a car.
        od_expiry_date: dateAgo(-40), tp_expiry_date: dateAgo(-1500),
        [ADD_ON_FINDINGS_KEY]: demoAddOnScan("bike"),
      },
    },
    // Life/term policies carry the full EXTRACTION_FIELDS shape, because the
    // value schedule on PolicyDetail is computed from exactly these keys.
    // Three shapes, so the demo shows all three outcomes: an endowment that
    // pays out, a term plan that pays nothing, and a unit linked plan whose
    // money is locked in.
    {
      id: "pol-8", agent_id: DEMO_AGENT_ID, customer_id: "cust-1",
      policy_name: "Jeevan Anand", name: "Suresh Agarwal", policyholder_name: "Suresh Agarwal",
      insurer: INSURERS.lic, insurance_type: "life", status: "done", score: null,
      sum_insured: 2000000, expiry_date: dateAgo(-150), created_at: ago(40),
      share_token: null, share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], report_data: null,
      extracted_data: {
        policyholder_name: "Suresh Agarwal", life_assured_name: "Suresh Agarwal",
        insurer: INSURERS.lic, policy_number: "884471209",
        plan_name: "Jeevan Anand", sum_assured: 2000000,
        premium: 96400, premium_frequency: "Annual",
        policy_term_years: 21, premium_paying_term_years: 21,
        start_date: "2018-03-15", next_premium_date: dateAgo(-60),
        maturity_date: "2039-03-15",
        plan_type: "Endowment / savings", bonus_per_1000: 47, fund_value: null,
        // 46 at commencement in 2018, which is the 54 on his health policy.
        age_at_entry: 46,
        nominee_name: "Kavita Agarwal",
      },
    },
    {
      // The specimen unit linked policy: a real anonymised document, and the
      // fixture the value schedule is reconciled against. Its insurer and plan
      // names stay redacted and its figures stay untouched — the charge table
      // below is that document's, so putting another company's name on it would
      // be attributing one insurer's charges to another.
      id: "pol-12", agent_id: DEMO_AGENT_ID, customer_id: "cust-6",
      policy_name: "Sample Smart Wealth Builder", name: "Nitin Bhargava", policyholder_name: "Nitin Bhargava",
      insurer: "Sample Life Insurance Company Limited", insurance_type: "life", status: "done", score: null,
      sum_insured: 1200000, expiry_date: "2043-07-10", created_at: ago(9),
      share_token: null, share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], report_data: null,
      extracted_data: {
        policyholder_name: "Nitin Bhargava", life_assured_name: "Nitin Bhargava",
        insurer: "Sample Life Insurance Company Limited",
        policy_number: "SPEC/UL/2023/0000117",
        plan_name: "Sample Smart Wealth Builder", sum_assured: 1200000,
        premium: 120000, premium_frequency: "Annual",
        policy_term_years: 20, premium_paying_term_years: 10,
        start_date: "2023-07-10", next_premium_date: "2027-07-10",
        maturity_date: "2043-07-10",
        plan_type: "Unit linked", bonus_per_1000: null, fund_value: 493900,
        age_at_entry: 35, fund_value_as_on: "2026-07-31",
        // Straight off Part E of the policy: what the document itself says the
        // fund is worth at maturity. The card reconciles our schedule against it.
        illustrated_maturity_value: 3166138,
        // Part D of the same document, verbatim. With these the schedule
        // reproduces the illustration exactly; without them it cannot.
        policy_parameters: {
          grossReturnPct: { value: 8, source: "document" },
          fundChargePct: { value: 1.215, source: "document" },
          allocationCharges: { value: [
            { fromYear: 1, toYear: 1, pct: 6 }, { fromYear: 2, toYear: 3, pct: 4 },
            { fromYear: 4, toYear: 5, pct: 3 }, { fromYear: 6, toYear: 99, pct: 0 },
          ], source: "document" },
          adminMonthly: { value: 300, source: "document" },
          adminEscalationPct: { value: 5, source: "document" },
          adminCapMonthly: { value: 500, source: "document" },
          entryAge: { value: 35, source: "document" },
          lockInYears: { value: 5, source: "document" },
          discontinuedFundRatePct: { value: 4, source: "document" },
          penalties: { value: [
            { year: 1, pct: 6, cap: 6000 }, { year: 2, pct: 4, cap: 5000 },
            { year: 3, pct: 3, cap: 4000 }, { year: 4, pct: 2, cap: 2000 },
          ], source: "document" },
          loyaltyPct: { value: 0.3, source: "document" },
          loyaltyFromYear: { value: 11, source: "document" },
          deathBenefitFloorPct: { value: 105, source: "document" },
          mortalityPer1000: { value: {
            35:1.05,36:1.14,37:1.24,38:1.36,39:1.50,40:1.66,41:1.85,42:2.07,43:2.32,44:2.61,
            45:2.94,46:3.32,47:3.75,48:4.24,49:4.79,50:5.41,51:6.11,52:6.90,53:7.79,54:8.79,55:9.91,
          }, source: "document" },
        },
        nominee_name: "Shruti Bhargava",
      },
    },
    {
      // Anita's term cover. It used to be a 23-year-old's whole-life plan filed
      // against Vikram Singh, who is 66 on the health policy two rows up — the
      // demo's own screens contradicted each other on the same person's age.
      id: "pol-13", agent_id: DEMO_AGENT_ID, customer_id: "cust-4",
      policy_name: "Smart Protection Goal", name: "Anita Desai", policyholder_name: "Anita Desai",
      insurer: INSURERS.bajajLife, insurance_type: "term", status: "done", score: null,
      sum_insured: 10000000, expiry_date: "2061-06-20", created_at: ago(4),
      share_token: null, share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], report_data: null,
      extracted_data: {
        policyholder_name: "Anita Desai", life_assured_name: "Anita Desai",
        insurer: INSURERS.bajajLife,
        policy_number: "0574118903",
        plan_name: "Bajaj Allianz Life Smart Protection Goal",
        sum_assured: 10000000, premium: 14800, premium_frequency: "Annual",
        policy_term_years: 38, premium_paying_term_years: 38, cover_till_age: 75,
        start_date: "2023-06-21", next_premium_date: "2027-06-21",
        cover_end_date: "2061-06-20",
        // 37 at commencement in 2023, which is the 40 on her health policy.
        plan_type: "Term cover only", age_at_entry: 37,
        death_benefit_payout: "Lump sum", nominee_name: "Kunal Desai",
      },
    },
    {
      id: "pol-14", agent_id: DEMO_AGENT_ID, customer_id: "cust-4",
      policy_name: "New Endowment Plan", name: "Anita Desai", policyholder_name: "Anita Desai",
      insurer: INSURERS.lic, insurance_type: "life", status: "done", score: null,
      sum_insured: 1500000, expiry_date: "2036-02-20", created_at: ago(21),
      share_token: null, share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], report_data: null,
      extracted_data: {
        policyholder_name: "Anita Desai", life_assured_name: "Anita Desai",
        insurer: INSURERS.lic, policy_number: "441907288",
        plan_name: "LIC New Endowment Plan", sum_assured: 1500000,
        premium: 72000, premium_frequency: "Annual",
        policy_term_years: 15, premium_paying_term_years: 15,
        start_date: "2021-02-20",
        // Overdue well past the grace period: every value below assumes the
        // premiums were paid, so the card has to say so before quoting any.
        next_premium_date: "2026-02-20",
        maturity_date: "2036-02-20",
        plan_type: "Endowment / savings", bonus_per_1000: 44,
        // 35 at commencement in 2021, which is the 40 on her health policy.
        age_at_entry: 35,
        nominee_name: "Kunal Desai",
      },
    },
    {
      // The guaranteed-income fixture, taken from a real HDFC Life Click 2
      // Achieve schedule. It was filed under HDFC ERGO, which is the group's
      // GENERAL insurer and cannot issue a life policy at all.
      id: "pol-15", agent_id: DEMO_AGENT_ID, customer_id: "cust-5",
      policy_name: "Click 2 Achieve", name: "Prakash Mehta", policyholder_name: "Prakash Mehta",
      insurer: INSURERS.hdfcLife, insurance_type: "life", status: "done", score: null,
      sum_insured: 2000000, expiry_date: "2039-03-04", created_at: ago(6),
      share_token: null, share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], report_data: null,
      extracted_data: {
        policyholder_name: "Prakash Mehta", life_assured_name: "Prakash Mehta",
        insurer: INSURERS.hdfcLife, policy_number: "27290118",
        plan_name: "HDFC Life Click 2 Achieve",
        // Death cover and maturity amount are DIFFERENT numbers on these plans.
        sum_assured: 2000000, maturity_amount: 1400000,
        premium: 200000, premium_frequency: "Annual",
        policy_term_years: 15, premium_paying_term_years: 7,
        start_date: "2024-03-04", next_premium_date: "2027-03-04",
        // 48 at commencement in 2024, which is the 50 on his health policy.
        maturity_date: "2039-03-04", age_at_entry: 48,
        // Pays the customer monthly for the whole term, on top of maturity.
        payout_amount: 3380, payout_frequency: "Monthly",
        payout_start_date: "2024-04-04", payout_end_date: "2039-03-04",
        plan_type: "Money back / guaranteed income",
        nominee_name: "Sunita Mehta",
      },
    },
    // In-flight + failed, so My Queue and the failures panel have content.
    // These four are fresh uploads, not customers yet, so their names are
    // deliberately outside both the tagged cast above and the bulk book below:
    // a prospect who shares a name with an existing customer is a demo that
    // looks like it has duplicate records.
    {
      id: "pol-9", agent_id: DEMO_AGENT_ID, customer_id: null,
      policy_name: "Health Companion", name: "Sandeep Ahuja", policyholder_name: "Sandeep Ahuja",
      insurer: INSURERS.niva, insurance_type: "health", status: "processing", score: null,
      sum_insured: null, expiry_date: null, created_at: ago(0.05),
      share_token: null, share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], report_data: null, extracted_data: null,
    },
    {
      id: "pol-10", agent_id: DEMO_AGENT_ID, customer_id: null,
      policy_name: "Young Star", name: "Ritu Malhotra", policyholder_name: "Ritu Malhotra",
      insurer: INSURERS.star, insurance_type: "health", status: "pending", score: null,
      sum_insured: null, expiry_date: null, created_at: ago(0.2),
      share_token: null, share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], report_data: null, extracted_data: null,
    },
    {
      // Nothing was read, so nothing is claimed: a failed upload that still
      // names an insurer and a plan is asserting what it just said it could
      // not see. The name is the one thing the advisor typed at upload.
      id: "pol-11", agent_id: DEMO_AGENT_ID, customer_id: null,
      policy_name: null, name: "Basant Chaturvedi", policyholder_name: "Basant Chaturvedi",
      insurer: null, insurance_type: "health", status: "error", score: null,
      sum_insured: null, expiry_date: null, created_at: ago(2),
      share_token: null, share_enabled: false, pdf_url: "#",
      error_message: "Document was blurry — couldn't read the policy schedule.",
      flaws: [], report_data: null, extracted_data: null,
    },
    {
      // Was "pol-12", the same id as the unit linked specimen above. Two rows
      // sharing one id means the detail route serves whichever the filter hits
      // first, so one of the two policies could not be opened at all.
      id: "pol-16", agent_id: DEMO_AGENT_ID, customer_id: null,
      policy_name: null, name: "Leela Mundhra", policyholder_name: "Leela Mundhra",
      insurer: null, insurance_type: "health", status: "error", score: null,
      sum_insured: null, expiry_date: null, created_at: ago(20),
      share_token: null, share_enabled: false, pdf_url: "#",
      error_message: "Password-protected PDF.",
      flaws: [], report_data: null, extracted_data: null,
    },
  ];

  // ---- Leads (prospect pipeline) ------------------------------------------
  const agent_leads = [
    { id: "lead-1", agent_id: DEMO_AGENT_ID, name: "Aarti Kulkarni", phone: "+91 99000 11111", email: "aarti@example.com", city: "Indore", source: "Referral", insurance_interest: "Family health", expected_value: 35000, status: "new", next_follow_up: dateAgo(-1), notes: "Referred by Suresh. Wants ₹10L floater.", customer_id: null, created_at: ago(2), updated_at: ago(2) },
    { id: "lead-2", agent_id: DEMO_AGENT_ID, name: "Manoj Tiwari", phone: "+91 99000 22222", email: null, city: "Bhopal", source: "WhatsApp", insurance_interest: "Car insurance", expected_value: 12000, status: "contacted", next_follow_up: dateAgo(-3), notes: "Renewal coming up next month.", customer_id: null, created_at: ago(6), updated_at: ago(3) },
    { id: "lead-3", agent_id: DEMO_AGENT_ID, name: "Shilpa Reddy", phone: "+91 99000 33333", email: "shilpa@example.com", city: "Indore", source: "Walk-in", insurance_interest: "Term life", expected_value: 60000, status: "interested", next_follow_up: dateAgo(-2), notes: "Comparing 2 term plans. Send comparison.", customer_id: null, created_at: ago(10), updated_at: ago(2) },
    { id: "lead-4", agent_id: DEMO_AGENT_ID, name: "Imran Khan", phone: "+91 99000 44444", email: null, city: "Ujjain", source: "Phone call", insurance_interest: "Senior health", expected_value: 28000, status: "interested", next_follow_up: dateAgo(1), notes: "For his parents.", customer_id: null, created_at: ago(14), updated_at: ago(5) },
    { id: "lead-5", agent_id: DEMO_AGENT_ID, name: "Geeta Bansal", phone: "+91 99000 55555", email: "geeta@example.com", city: "Dewas", source: "My page", insurance_interest: "Health top-up", expected_value: 9000, status: "won", next_follow_up: null, notes: "Closed! Convert to customer.", customer_id: null, created_at: ago(25), updated_at: ago(1), landing_slug: "rajesh-kumar", source_app: "whatsapp", source_device: "mobile", source_os: "Android", utm_campaign: "diwali-offer" },
    { id: "lead-6", agent_id: DEMO_AGENT_ID, name: "Rakesh Yadav", phone: "+91 99000 66666", email: null, city: "Indore", source: "Social media", insurance_interest: "Bike insurance", expected_value: 3500, status: "lost", next_follow_up: null, notes: "Went with online quote. Too cheap to match.", customer_id: null, created_at: ago(30), updated_at: ago(8) },
    // Came in through the advisor page — carries the landing/attribution fields
    // the lead card and the My Page counters read.
    { id: "lead-7", agent_id: DEMO_AGENT_ID, name: "Neha Pandey", phone: "+91 99000 77777", email: null, city: "Indore", source: "My page", insurance_interest: "Health", expected_value: 22000, status: "new", next_follow_up: dateAgo(-1), notes: "Filled the form on the advisor page. Wants cover for her parents.", customer_id: null, created_at: ago(1), updated_at: ago(1), landing_slug: "rajesh-kumar", source_app: "instagram", source_device: "mobile", source_os: "iOS", utm_campaign: "diwali-offer" },
  ];

  // ---- Lead policies (prospect's existing cover → renewal hit-list) --------
  const lead_policies = [
    // extracted_data here is keyed to EXTRACTION_FIELDS too — `reg_no` was not a
    // key in it, so the one field this card had to show was the one it dropped.
    { id: "lp-1", lead_id: "lead-2", agent_id: DEMO_AGENT_ID, insurance_type: "motor", insurer: INSURERS.digit, policy_name: "Two Wheeler Package", policyholder_name: "Manoj Tiwari", premium: 1850, due_date: dateAgo(-8), file_url: "#", file_name: "manoj-bike.pdf", extracted_data: { policyholder_name: "Manoj Tiwari", insurer: INSURERS.digit, plan_name: "Two Wheeler Package", vehicle_registration_no: "MP04 AB 1234", make_and_model: "Hero Splendor Plus", manufacturing_year: "2019", idv: 41000, ncb_percent: 35, premium: 1850, coverage_type: "Package (own damage + third party)", policy_expiry_date: dateAgo(-8), od_expiry_date: dateAgo(-8), tp_expiry_date: dateAgo(-1100) }, spoken_to: false, notes: "", created_at: ago(6), updated_at: ago(6) },
    { id: "lp-2", lead_id: "lead-4", agent_id: DEMO_AGENT_ID, insurance_type: "health", insurer: INSURERS.care, policy_name: "Care Senior", policyholder_name: "Imran Khan (parents)", premium: 31000, due_date: dateAgo(-22), file_url: "#", file_name: "parents-health.pdf", extracted_data: null, spoken_to: true, notes: "Current cover only ₹3L.", created_at: ago(14), updated_at: ago(5) },
    { id: "lp-3", lead_id: "lead-3", agent_id: DEMO_AGENT_ID, insurance_type: "life", insurer: INSURERS.lic, policy_name: "Jeevan Labh", policyholder_name: "Shilpa Reddy", premium: 22000, due_date: dateAgo(-3), file_url: "#", file_name: "shilpa-lic.pdf", extracted_data: { policyholder_name: "Shilpa Reddy", life_assured_name: "Shilpa Reddy", insurer: INSURERS.lic, plan_name: "Jeevan Labh", sum_assured: 800000, premium: 22000, premium_frequency: "Annual", policy_term_years: 16, premium_paying_term_years: 10, start_date: "2019-03-12", next_premium_date: dateAgo(-3), maturity_date: "2035-03-12", plan_type: "Endowment / savings", bonus_per_1000: 47, age_at_entry: 31, nominee_name: "Vinay Reddy" }, spoken_to: false, notes: "", created_at: ago(10), updated_at: ago(10) },
  ];

  // ---- Advisor page (/agent/my-page) --------------------------------------
  // Seeded enabled + published: without a row the page shows its "request my
  // page" waiting-list screen, which is correct in production but a dead end in
  // a demo. The share kit, QR and view stats all hang off this row.
  const agent_pages = [
    {
      id: "page-1", agent_id: DEMO_AGENT_ID, slug: "rajesh-kumar",
      display_name: "Rajesh Kumar", photo_url: null, city: "Indore",
      languages: ["hi", "en", "mr"],
      lines_of_business: ["health", "term", "vehicle"],
      primary_locale: "hi", whatsapp_number: "+91 98765 43210",
      enabled: true, published: true, published_at: ago(38),
      created_at: ago(40), updated_at: ago(38),
    },
  ];

  // Per-day view rows behind the "where your visitors come from" panel.
  const agent_page_views = (() => {
    const rows: any[] = [];
    const mix = [
      { utm_source: "whatsapp", app: "whatsapp", device: "mobile", base: 9 },
      { utm_source: "instagram", app: "instagram", device: "mobile", base: 6 },
      { utm_source: "qr", app: "browser", device: "mobile", base: 3 },
      { utm_source: "direct", app: "browser", device: "desktop", base: 2 },
    ];
    for (let d = 0; d < 30; d++) {
      for (const m of mix) {
        const views = Math.max(0, m.base - (d % 5) + (d % 3));
        if (views > 0) {
          rows.push({
            id: `pv-${d}-${m.utm_source}`, page_id: "page-1", viewed_on: dateAgo(d),
            utm_source: m.utm_source, app: m.app, device: m.device, views,
          });
        }
      }
    }
    return rows;
  })();

  // ---- Misc tables read across the portal (kept light) ---------------------
  // ---- Bulk book ----------------------------------------------------------
  // The hand-written policies above each carry a full forensic report or a full
  // set of extracted fields. They are the *depth* of the demo.
  //
  // They are not its *scale*: with a dozen rows every type filter reads two or
  // three and the portfolio screens have nothing to say. A working agent's book
  // is hundreds. These rows supply that shape — spread across every
  // insurance_type, with expiries either side of today so renewals and lapses
  // are real.
  //
  // A row here is a FINISHED policy: status "done". That means a health row
  // must carry a report and a data-entry row must carry its fields, because
  // that is the only thing "done" can mean on each. The bulk rows used to carry
  // a score with no report behind it, so the first policy in the default list
  // opened on "Analysis data is in an unexpected format. Try re-running
  // analysis." — the demo's own headline feature, broken on the first click.
  //
  // Deterministic on purpose: index-driven, no Math.random. Every count on
  // every screen has to be the same on reload, or the demo contradicts itself.
  /** Spouse first names, so a floater has two lives on it without inventing a
   *  second surname. Paired by index with BULK_NAMES. */
  const BULK_SPOUSES = [
    "Smita", "Rajeev", "Nazia", "Suhas", "Lakshmi", "Manisha", "Vinod", "Shruti", "Amol", "Vaishali",
    "Sandeep", "Pallavi", "Dattatray", "Ujwala", "Abhay", "Ruksana", "Bhaskar", "Manda", "Sachin", "Trupti",
    "Milind", "Suchitra", "Ravindra", "Aparna", "Dilip", "Swati", "Umesh", "Vidya", "Prakash", "Anuja",
  ];

  // Plan and insurer must belong to the same company AND the same licence. A
  // life or term plan cannot sit under a general insurer: HDFC ERGO and ICICI
  // Lombard used to carry "Click 2 Protect Super", "Sanchay Plus" and "Smart
  // Protection Goal" here, all three of which are life products.
  const BULK_TYPES: { type: string; plan: string; insurer: string }[] = [
    { type: "health", plan: "Family Health Optima", insurer: INSURERS.star },
    { type: "health", plan: "ReAssure 2.0", insurer: INSURERS.niva },
    { type: "health", plan: "Care Supreme", insurer: INSURERS.care },
    { type: "health", plan: "Optima Secure", insurer: INSURERS.hdfc },
    { type: "term", plan: "Click 2 Protect Super", insurer: INSURERS.hdfcLife },
    { type: "term", plan: "Smart Protection Goal", insurer: INSURERS.bajajLife },
    { type: "life", plan: "Jeevan Anand", insurer: INSURERS.lic },
    { type: "life", plan: "Sanchay Plus", insurer: INSURERS.hdfcLife },
    { type: "motor", plan: "Private Car Package", insurer: INSURERS.digit },
    { type: "motor", plan: "Two Wheeler Package", insurer: INSURERS.icici },
    { type: "motor", plan: "Commercial Vehicle Package", insurer: INSURERS.tata },
    { type: "travel", plan: "Travel Guard", insurer: INSURERS.tata },
    { type: "property", plan: "Home Shield", insurer: INSURERS.icici },
    { type: "fire", plan: "Standard Fire & Special Perils", insurer: INSURERS.digit },
    { type: "marine", plan: "Marine Cargo Open", insurer: INSURERS.tata },
  ];

  const BULK_CITIES = ["Indore", "Bhopal", "Ujjain", "Dewas", "Gwalior"];
  const BULK_ZONES: ("A" | "B" | "C" | "D")[] = ["B", "B", "C", "C", "C"];

  /** Sum insured by health profile (see bulkHealthReport), so the cover on the
   *  row supports the verdict in the report: a "well covered" profile carries
   *  roughly what one admission costs at its age, a "seriously under-covered"
   *  one carries a fraction of it. */
  const HEALTH_SUMS_BY_PROFILE = [
    [1500000, 2000000, 2500000], // 0 — clean terms, adequate cover
    [1500000, 2000000],          // 1 — clean terms, sub-limits, thin cover
    [1500000, 1250000],          // 2 — cap + co-pay, under-covered
    [500000, 300000],            // 3 — senior, seriously under-covered
  ];

  const bulkCustomers: any[] = [];
  const bulkClients: any[] = [];

  for (let i = 0; i < 96; i++) {
    const nameIdx = i % BULK_NAMES.length;
    const person = BULK_NAMES[nameIdx];
    const surname = person.split(" ").slice(-1)[0];
    const spec = BULK_TYPES[i % BULK_TYPES.length];
    const city = BULK_CITIES[nameIdx % BULK_CITIES.length];
    const zone = BULK_ZONES[nameIdx % BULK_ZONES.length];

    // One customer per distinct person, reused by their other policies.
    const custId = `bulk-cust-${nameIdx}`;
    if (i < BULK_NAMES.length) {
      // Ten digits, which is what an Indian mobile number has. The old formula
      // produced "+91 90100000" — eight — on every row.
      const mobile = String(9810000000 + i * 137137);
      bulkCustomers.push({
        id: custId, agent_id: DEMO_AGENT_ID, name: person,
        phone: `+91 ${mobile.slice(0, 5)} ${mobile.slice(5)}`,
        email: null, dob: null,
        city, notes: "", created_at: ago(360 - i * 3),
      });
    }

    // Expiry walks from 47 days past to ~300 days out, so "expiring in 30 days"
    // and "lapsed" are both genuinely populated rather than asserted.
    const expiryDays = Math.round(47 - i * 3.6);
    const inceptionDays = expiryDays + 365;
    // A health policy's cover has to fit the verdict written about it. Rotating
    // the sum insured independently of the profile is how the book came to hold
    // a "well covered" 38-year-old on ₹3L, whose own report then said the cover
    // was 0.19× of what one admission costs.
    const sumInsured = spec.type === "health"
      ? HEALTH_SUMS_BY_PROFILE[i % 4][Math.floor(i / 4) % HEALTH_SUMS_BY_PROFILE[i % 4].length]
      // Cover is sold in different sizes by line: nobody buys ₹3L of term cover,
      // and the flat rotation was putting exactly that on the value screen.
      : spec.type === "term"
        ? [2500000, 5000000, 10000000][i % 3]
        : spec.type === "life"
          ? [500000, 1000000, 1500000, 2500000][i % 4]
          : [300000, 500000, 1000000, 1500000, 2500000, 5000000][i % 6];

    const report = spec.type === "health"
      ? bulkHealthReport({ i, person, spouse: `${BULK_SPOUSES[nameIdx]} ${surname}`, city, zone, baseSI: sumInsured, inceptionDays, expiryDays })
      : null;
    const extracted = report
      ? null
      : bulkExtractedData(spec.type, i, person, spec, sumInsured, inceptionDays, expiryDays, city);

    bulkClients.push({
      id: `bulk-pol-${i}`, agent_id: DEMO_AGENT_ID, customer_id: custId,
      policy_name: spec.plan, name: person, policyholder_name: person,
      insurer: spec.insurer, insurance_type: spec.type, status: "done",
      // Only health policies get a check and therefore a score. Everything else
      // is data entry, which is exactly how the real product behaves. The score
      // is the report's own, never a second number authored beside it.
      score: report ? report.audit_score.score : null,
      sum_insured: sumInsured,
      // The same rule deriveSharedColumns applies server-side: the date in this
      // column is the one that type actually renews or matures on — own-damage
      // for motor, maturity for life, cover end for term, trip end for travel.
      expiry_date: sharedExpiryDate(spec.type, extracted) ?? dateAgo(expiryDays),
      created_at: ago(300 - i * 2),
      share_token: null, share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], report_data: report,
      extracted_data: extracted,
    });
  }

  customers.push(...bulkCustomers);
  clients.push(...bulkClients);

  /* One number, in one place. The row's `score` column and the report's own
     audit_score.score are the same value on every policy, so the list, the
     dashboard and the report header can never disagree about a policy's mark. */
  for (const row of clients as any[]) {
    const fromReport = row.report_data?.audit_score?.score;
    if (typeof fromReport === "number") row.score = fromReport;
  }

  const agent_credits = [{ id: "cred-1", agent_id: DEMO_AGENT_ID, balance: 25 }];
  // Data-entry (OCR) allowance is metered separately from policy checks.
  const agent_ocr_credits = [{ id: "ocr-1", agent_id: DEMO_AGENT_ID, balance: 38 }];

  const calculator_reports = [
    { id: "calc-1", agent_id: DEMO_AGENT_ID, customer_id: "cust-4", uuid: "demo-calc-1", inputs: { age: 38, members: 4, city_tier: 1 }, recommended_cover: 1500000, created_at: ago(7) },
    { id: "calc-2", agent_id: DEMO_AGENT_ID, customer_id: null, uuid: "demo-calc-2", inputs: { age: 55, members: 2, city_tier: 2 }, recommended_cover: 1000000, created_at: ago(20) },
  ];

  return {
    agents: [agent],
    agent_credits,
    agent_ocr_credits,
    customers,
    clients,
    agent_leads,
    lead_policies,
    calculator_reports,
    agent_pages,
    agent_page_views,
    // Tables some pages query but the demo leaves empty — return [] gracefully.
    report_shares: [],
    invite_codes: [],
    reports: [],
    empanelments: [],
  };
}

/* ── Simulated upload ───────────────────────────────────────────────────── */

/**
 * The client row a playground "upload" turns into.
 *
 * The upload flow is the first thing anyone tries in the demo, and it is a real
 * two-step flow: POST /api/agent/analyze, then poll .../analyze/status/:jobId
 * until the status reads `completed`. Answering those with a bare `{ok:true}`
 * leaves the card spinning until it times out, so the mock has to hand back a
 * genuine client row and then finish it.
 *
 * The finished policy deliberately has something wrong with it — a room-rent
 * cap and a co-pay — because a demo where the answer is "all fine" shows the
 * agent nothing.
 */
export function buildUploadedPolicy(
  clientId: string,
  opts: { policyholder_name?: string; insurance_type?: string; filename?: string },
) {
  const name = opts.policyholder_name || "Ramesh Chauhan";
  const type = opts.insurance_type || "health";
  const isHealth = type === "health";
  const UPLOAD_PLAN: Record<string, string> = {
    health: "Medicare Premier",
    motor: "Private Car Package",
    life: "Sanchay Plus",
    term: "Click 2 Protect Super",
    travel: "Travel Guard",
    property: "Home Shield",
    fire: "Standard Fire & Special Perils",
    marine: "Marine Cargo Open",
    contractor_all_risk: "Contractor's All Risk",
  };
  const plan = UPLOAD_PLAN[type] ?? "Uploaded policy";
  // Life and term are written by life companies; everything else here is general.
  const insurer = type === "life" || type === "term" ? INSURERS.hdfcLife : INSURERS.tata;

  const report = isHealth
    ? uploadedHealthReport(name)
    : null;
  // A finished data-entry upload arrives with its fields read, not with a lone
  // premium: an empty review form is what a FAILED read looks like.
  const extracted = isHealth
    ? null
    : bulkExtractedData(type, 7, name, { plan, insurer }, 500000, 365, -64, "Indore");

  return {
    id: clientId,
    agent_id: DEMO_AGENT_ID,
    customer_id: null,
    policy_name: plan,
    name,
    policyholder_name: name,
    filename: opts.filename ?? "policy.pdf",
    insurer,
    insurance_type: type,
    status: "done",
    score: report ? report.audit_score.score : null,
    sum_insured: 500000,
    expiry_date: sharedExpiryDate(type, extracted) ?? dateAgo(-64),
    created_at: new Date().toISOString(),
    share_token: null,
    share_enabled: false,
    pdf_url: "#",
    error_message: null,
    flaws: [],
    extracted_data: extracted,
    report_data: report,
  };
}

/** The audit a simulated upload lands on. Deliberately a policy with something
 *  wrong with it: a demo where the answer is "all fine" shows the agent nothing. */
function uploadedHealthReport(name: string) {
  return healthReport({
    insured: [name, "Sarita Chauhan"], ages: [47, 44], genders: ["male", "female"],
    city: "Indore", zone: "B",
    inceptionDays: 301, expiryDays: -64, baseSI: 500000, ncbCurrent: 10,
    roomRent: {
      limit_type: "specific_amount", limit_value: "₹4,000 per day",
      limit_amount_per_day: 4000, penaltyPct: 20, risk_level: "high", zone_adequacy: "marginal",
      explanation: "₹4,000 a day covers a shared room locally. A private room triggers a proportionate cut across the whole bill.",
    },
    copayPct: 10, copayConditions: "10% of every claim.",
    subLimits: [{ procedure: "Cataract (per eye)", limit: 30000, typical_cost_in_zone: 55000, severity: "medium" }],
    pedMonths: 36, specificMonths: 24,
    restoration: { exists: false, remarks: "No restoration on this plan." },
    label: "RISKY", bucketLabel: "Under-covered",
    summary: "A room-rent cap and a 10% co-pay sit on top of a ₹5L cover. Together they leave close to a third of a large bill with the family.",
    realClaim: "Partly. On a ₹4.5L admission the family would find roughly ₹1.5L themselves.",
    failures: [
      "Room rent capped at ₹4,000 a day with proportionate deduction",
      "10% co-pay on every claim",
      "No restoration once the cover is used",
      "₹5L is thin for two adults in their forties",
    ],
    deductions: [
      { reason: "Room-rent cap with proportionate deduction", category: "CLAIM_REJECTION", severity: "high", points: 15 },
      { reason: "10% co-pay on all claims", category: "OOP_EXPOSURE", severity: "medium", points: 8 },
      { reason: "Sum insured below recommended cover", category: "NET_COVER", severity: "medium", points: 10 },
      { reason: "No restoration once the cover is used", category: "COVERAGE_GAP", severity: "medium", points: 6 },
    ],
    works: [
      { benefit: "Wide cashless network", why_it_matters_in_claim: "Money is unlikely to be needed up front.", quantified_value: null },
    ],
    fails: [
      { issue: "Room-rent cap", real_world_claim_impact: "A private room cuts every line of the bill, not just the room charge.", quantified_oop_risk: "≈ ₹90,000 on a ₹4.5L claim" },
    ],
    actions: [
      {
        action: "Move to a plan with no room-rent cap at renewal",
        reason: "The cap is the largest single source of out-of-pocket cost here.",
        oop_risk_if_ignored: "₹1.5L on one major hospitalisation",
        suggested_riders_or_topups: ["₹10L no-cap base plan"],
        estimated_cost: "₹3,500–₹5,500 more a year",
      },
    ],
    port: "yes",
    portReason: "The cap and the co-pay both need to go, and neither can be removed inside this plan.",
    portLookFor: ["No room-rent cap", "No co-pay", "Restoration included"],
  });
}

/* ── Compare catalog ────────────────────────────────────────────────────── */

/**
 * The pre-analysed plan catalog behind /agent/compare/catalog, and the engine
 * that produces a head-to-head from any 2–4 of them.
 *
 * Built rather than canned because the real comparison is N-way: the page lets
 * an agent pick up to four plans, and a fixed two-column answer would only ever
 * be right for the first two. Each plan carries a display string and a quality
 * rank per row; the winner of a row is simply the best rank in it, so verdicts,
 * scores and win counts stay consistent whatever the agent selects.
 */
const COMPARE_ROWS: { key: string; label: string; group: string }[] = [
  { key: "room_rent",     label: "Room rent limit",          group: "money_at_claim" },
  { key: "copay",         label: "Co-payment",               group: "money_at_claim" },
  { key: "deductible",    label: "Deductible",               group: "money_at_claim" },
  { key: "ped",           label: "Pre-existing diseases",    group: "waiting" },
  { key: "specific",      label: "Specific illnesses",       group: "waiting" },
  { key: "initial",       label: "Initial waiting",          group: "waiting" },
  { key: "ncb",           label: "No-claim bonus",           group: "bonus_reset" },
  { key: "restore",       label: "Restore benefit",          group: "bonus_reset" },
  { key: "prepost",       label: "Pre/post hospitalisation", group: "coverages" },
  { key: "daycare",       label: "Day-care procedures",      group: "coverages" },
  { key: "maternity",     label: "Maternity",                group: "coverages" },
  { key: "opd",           label: "OPD",                      group: "coverages" },
  { key: "proportionate", label: "Proportionate deduction",  group: "fine_print" },
  { key: "sublimits",     label: "Disease sub-limits",       group: "fine_print" },
  { key: "consumables",   label: "Consumables",              group: "fine_print" },
];

const GROUP_LABELS: Record<string, string> = {
  money_at_claim: "Money at claim time",
  waiting: "Waiting periods",
  bonus_reset: "Bonus & restore",
  coverages: "What is covered",
  fine_print: "The fine print",
};

/** `[display, quality]` per row, in COMPARE_ROWS order. Higher quality wins. */
type PlanCells = [string, number][];

type CatalogPlan = {
  uin: string;
  insurer: string;
  plan_name: string;
  product_type: string;
  sum_insured_options: string | null;
  confidence: string;
  status: string;
  cells: PlanCells;
};

const plan = (
  uin: string, insurer: string, plan_name: string, sum_insured_options: string, cells: PlanCells,
): CatalogPlan => ({
  uin, insurer, plan_name, product_type: "health", sum_insured_options,
  confidence: "high", status: "active", cells,
});

export const DEMO_CATALOG: CatalogPlan[] = [
  plan("HDFHLIP21024V042021", INSURERS.hdfc, "Optima Secure", "₹5L – ₹2Cr", [
    ["No room-rent cap", 3], ["No co-pay", 3], ["Nil", 3],
    ["36 months", 1], ["24 months", 1], ["30 days", 1],
    ["Up to 100%", 2], ["Unlimited (related + unrelated)", 3],
    ["60 / 180 days", 3], ["All day-care", 2], ["Optional add-on", 2], ["Not covered", 0],
    ["Not applicable", 3], ["No disease-wise sub-limits", 3], ["Covered in full", 3],
  ]),
  plan("SHAHLIP21211V032021", INSURERS.star, "Family Health Optima", "₹3L – ₹25L", [
    ["Single private A/C room (capped)", 1], ["20% zone-based co-pay", 0], ["Nil", 3],
    ["36 months", 1], ["24 months", 1], ["30 days", 1],
    ["Up to 100%", 2], ["Once a year (unrelated illness only)", 1],
    ["60 / 90 days", 1], ["All day-care", 2], ["Not covered", 0], ["Not covered", 0],
    ["Applies if room category exceeded", 0], ["Cataract and a few others capped", 1], ["Not covered", 0],
  ]),
  plan("NBHHLIP22024V032122", INSURERS.niva, "ReAssure 2.0", "₹5L – ₹1Cr", [
    ["No room-rent cap", 3], ["No co-pay", 3], ["Nil", 3],
    ["36 months", 1], ["24 months", 1], ["30 days", 1],
    ["Unlimited carry-forward", 3], ["Unlimited (unrelated illness)", 2],
    ["60 / 180 days", 3], ["All day-care", 2], ["Covered after 36 months", 3], ["Optional add-on", 2],
    ["Not applicable", 3], ["No disease-wise sub-limits", 3], ["Covered in full", 3],
  ]),
  plan("CHIHLIP23139V072223", INSURERS.care, "Care Supreme", "₹5L – ₹1Cr", [
    ["No room-rent cap", 3], ["No co-pay (optional 20% for lower premium)", 2], ["Nil", 3],
    ["36 months", 1], ["24 months", 1], ["30 days", 1],
    ["Up to 500% over 5 years", 3], ["Once a year (unrelated illness)", 1],
    ["30 / 60 days", 0], ["All day-care", 2], ["Optional add-on", 2], ["Optional add-on", 2],
    ["Not applicable", 3], ["Cataract capped", 1], ["Optional rider", 1],
  ]),
  plan("ICIHLIP22052V032122", INSURERS.icici, "Activ One MAX", "₹5L – ₹2Cr", [
    ["No room-rent cap", 3], ["No co-pay", 3], ["Nil", 3],
    ["36 months", 1], ["24 months", 1], ["30 days", 1],
    ["Up to 100%", 2], ["Unlimited (related + unrelated)", 3],
    ["60 / 180 days", 3], ["All day-care", 2], ["Covered after 24 months", 3], ["Covered up to ₹10,000", 3],
    ["Not applicable", 3], ["Disease-wise sub-limits apply", 0], ["Covered in full", 3],
  ]),
  plan("TATHLIP23063V032223", INSURERS.tata, "Medicare Premier", "₹5L – ₹50L", [
    ["No room-rent cap", 3], ["No co-pay", 3], ["Nil", 3],
    ["36 months", 1], ["24 months", 1], ["30 days", 1],
    ["Up to 100%", 2], ["Once a year (unrelated illness)", 1],
    ["60 / 90 days", 1], ["All day-care", 2], ["Covered after 36 months", 3], ["Covered up to ₹5,000", 2],
    ["Not applicable", 3], ["No disease-wise sub-limits", 3], ["Covered in full", 3],
  ]),
  plan("GODHLIP23012V012223", INSURERS.digit, "Health Care Plus", "₹5L – ₹50L", [
    ["No room-rent cap", 3], ["No co-pay", 3], ["Nil", 3],
    ["24 months", 3], ["24 months", 1], ["30 days", 1],
    ["Up to 100%", 2], ["Once a year (unrelated illness)", 1],
    ["30 / 60 days", 0], ["All day-care", 2], ["Not covered", 0], ["Not covered", 0],
    ["Not applicable", 3], ["No disease-wise sub-limits", 3], ["Not covered", 0],
  ]),
  plan("SHAHLIP22192V072122", INSURERS.star, "Senior Citizens Red Carpet", "₹1L – ₹25L", [
    ["₹3,000 per day", 0], ["50% on every claim", 0], ["Nil", 3],
    ["12 months", 3], ["24 months", 1], ["30 days", 1],
    ["Up to 50%", 1], ["Not available", 0],
    ["30 / 60 days", 0], ["All day-care", 2], ["Not covered", 0], ["Not covered", 0],
    ["Applies if room rent exceeded", 0], ["Cataract and knee capped", 0], ["Not covered", 0],
  ]),
];

/** Build an N-way ComparisonResult (see lib/wordingProfile) for the given UINs. */
export function buildCatalogComparison(uins: string[]) {
  const picked = uins
    .map((u) => DEMO_CATALOG.find((p) => p.uin === u))
    .filter((p): p is CatalogPlan => !!p);

  const wins = picked.map(() => 0);
  const scores = picked.map(() => 0);
  const wonRows: { index: number; label: string; display: string }[] = [];

  const groups = Object.keys(GROUP_LABELS).map((g) => ({
    group: g,
    label: GROUP_LABELS[g],
    rows: COMPARE_ROWS.map((r, ri) => ({ r, ri }))
      .filter(({ r }) => r.group === g)
      .map(({ r, ri }) => {
        const quals = picked.map((p) => p.cells[ri][1]);
        const best = Math.max(...quals);
        const allSame = quals.every((q) => q === best);
        quals.forEach((q, i) => {
          scores[i] += q;
          if (!allSame && q === best) {
            wins[i] += 1;
            wonRows.push({ index: i, label: r.label, display: picked[i].cells[ri][0] });
          }
        });
        return {
          key: r.key,
          label: r.label,
          group: r.group,
          cells: picked.map((p, i) => ({
            display: p.cells[ri][0],
            note: null,
            winner: !allSame && quals[i] === best,
          })),
        };
      }),
  }));

  const maxScore = COMPARE_ROWS.length * 3;
  const pct = scores.map((s) => Math.round((s / maxScore) * 100));
  const winnerIndex = pct.indexOf(Math.max(...pct));

  return {
    sides: picked.map((p) => ({
      insurer: p.insurer,
      plan_name: p.plan_name,
      uin: p.uin,
      sum_insured_options: p.sum_insured_options,
      confidence: p.confidence,
    })),
    groups,
    verdict: {
      winner_index: winnerIndex,
      winner_name: picked[winnerIndex]?.plan_name ?? null,
      scores: pct,
      wins,
      reasons: wonRows
        .filter((w) => w.index === winnerIndex)
        .slice(0, 3)
        .map((w) => `${w.label}: ${w.display}.`),
      counterpoint:
        "Premium is not compared here. The cheaper plan in a pair is often the one carrying the cap or the co-pay, so put the two premiums beside this before advising a switch.",
    },
  };
}

/**
 * The head-to-head behind the "see a sample comparison" shortcut on
 * /agent/compare and the simulated POST /api/agent/compare. Star Family Health
 * Optima against HDFC Optima Secure — the second wins clearly, so the
 * side-by-side reads convincingly in a demo.
 */
export const DEMO_COMPARE_RESPONSE = {
  result: buildCatalogComparison(["SHAHLIP21211V032021", "HDFHLIP21024V042021"]),
  profiles: null,
};
