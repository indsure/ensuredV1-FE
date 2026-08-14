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

const now = new Date();
const day = 24 * 60 * 60 * 1000;

/** ISO timestamp `n` days ago (negative = future). */
function ago(days: number): string {
  return new Date(now.getTime() - days * day).toISOString();
}
/** `YYYY-MM-DD`, `n` days ago (negative = future). */
function dateAgo(days: number): string {
  return new Date(now.getTime() - days * day).toISOString().slice(0, 10);
}

const INSURERS = {
  star: "Star Health and Allied Insurance Co Ltd",
  hdfc: "HDFC ERGO General Insurance Company Limited",
  care: "Care Health Insurance Limited",
  niva: "Niva Bupa Health Insurance Company Limited",
  icici: "ICICI Lombard General Insurance Company Limited",
  tata: "Tata AIG General Insurance Company Limited",
  digit: "Go Digit General Insurance Limited",
  lic: "Life Insurance Corporation of India",
};

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
  restoration?: { exists: boolean; type?: "full" | "partial"; useful?: boolean; remarks?: string };
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
  /** Scoring + narrative. */
  score: number;
  ncar: number;
  label: "SAFE" | "BORDERLINE" | "RISKY" | "EXCELLENT";
  bucketLabel?: string;
  summary: string;
  realClaim: string;
  failures: string[];
  deductions?: { reason: string; category: string; severity: "high" | "medium" | "low"; points: number }[];
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

  return {
    identity: {
      insured_names: o.insured,
      ages: o.ages,
      genders: o.genders ?? o.insured.map(() => null),
      city: o.city,
      assumed_zone: o.zone ?? "B",
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
        trigger_conditions: restore.exists ? "After the base sum insured is exhausted in a policy year." : null,
        actually_useful: restore.exists ? restore.useful ?? true : null,
        remarks: restore.remarks ?? null,
      },
      no_claim_bonus: {
        exists: true,
        rate_per_year: 10,
        cap_percentage: o.ncbCap ?? 50,
        current_bonus: o.ncbCurrent ?? 0,
        portability: "yes",
        clarity: "clear",
        remarks: "Accrued bonus is lost if the policy lapses beyond the grace period.",
      },
      riders: o.riders ?? [],
      total_effective_coverage: o.baseSI + Math.round((o.baseSI * (o.ncbCurrent ?? 0)) / 100),
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
      score: o.score,
      raw_score: o.score,
      ncar: o.ncar,
      nec: o.baseSI + Math.round((o.baseSI * (o.ncbCurrent ?? 0)) / 100),
      rct: penaltyPct + copayPct,
      bucket_label: o.bucketLabel ?? null,
      breakdown: {
        net_cover_penalty: Math.max(0, Math.round((1 - Math.min(o.ncar, 1)) * 30)),
        claim_rejection_risk: copayPct > 0 ? 12 : 4,
        oop_exposure: Math.round((penaltyPct + copayPct) / 2),
        coverage_quality_gap: (o.subLimits?.length ?? 0) * 5,
      },
      deductions: o.deductions ?? [],
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
    data_quality: {
      overall: "high",
      missing_critical_fields: [],
      ambiguous_clauses: [],
      policy_document_quality: "clear",
    },
  };
}

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
        score: 58, ncar: 0.42, label: "RISKY", bucketLabel: "Under-covered",
        summary: "The cover amount is only part of the problem. A room-rent cap and a 20% co-pay together mean this family pays a quarter of any large bill themselves.",
        realClaim: "Partly. A ₹4.5L cardiac admission would leave roughly ₹1.9L with the family after the room deduction and co-pay.",
        failures: [
          "Room rent capped at 1% of sum insured, with proportionate deduction on the whole bill",
          "20% co-pay on every claim",
          "₹5L is thin for two adults in their fifties",
          "Restoration does not apply to a repeat claim for the same illness",
        ],
        deductions: [
          { reason: "Room rent capped at 1% of SI", category: "Claim payout", severity: "high", points: 14 },
          { reason: "20% co-pay on all claims", category: "Out of pocket", severity: "high", points: 12 },
          { reason: "Sum insured below the recommended cover for this age and city", category: "Net cover", severity: "medium", points: 10 },
          { reason: "Cataract sub-limit below typical local cost", category: "Sub-limits", severity: "low", points: 6 },
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
            suggested_riders_or_topups: ["No-cap base plan at ₹10L", "Super top-up above a ₹5L deductible"],
            estimated_cost: "₹4,000–₹6,000 more a year",
          },
          {
            action: "Raise total cover to at least ₹10L",
            reason: "₹5L for two adults in their fifties in a tier-1 city is roughly 0.42× of what a single cardiac or cancer episode costs.",
            oop_risk_if_ignored: "Full exposure above ₹5L",
            suggested_riders_or_topups: ["₹15L super top-up"],
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
      sum_insured: 1000000, expiry_date: dateAgo(-120), created_at: ago(9),
      share_token: "demo-share-2", share_enabled: true, pdf_url: "#", error_message: null,
      flaws: [], extracted_data: null,
      report_data: healthReport({
        insured: ["Meena Joshi", "Rohan Joshi"], ages: [45, 47], genders: ["female", "male"],
        city: "Bhopal", zone: "B", healthFlags: ["Type 2 diabetes declared"],
        inceptionDays: 245, expiryDays: -120, baseSI: 1000000, ncbCurrent: 20,
        pedMonths: 36, specificMonths: 24,
        maternity: { months: 36, relevant: false, covered: true, limit: 50000 },
        consumables: { covered: true, coverage_type: "full", remarks: "Consumables are paid in full — unusual and worth keeping." },
        score: 82, ncar: 0.95, label: "SAFE", bucketLabel: "Well covered",
        summary: "A strong base plan. No room-rent cap, no co-pay, and consumables are paid — the gaps left are timing gaps, not structural ones.",
        realClaim: "Yes. A ₹4.5L admission would be settled in full apart from a small non-payable share.",
        failures: ["Diabetes claims wait until the 36-month pre-existing period ends", "No OPD cover for routine consultations and tests"],
        deductions: [
          { reason: "Pre-existing wait still running for the declared diabetes", category: "Waiting periods", severity: "medium", points: 11 },
          { reason: "No OPD cover", category: "Coverage gaps", severity: "low", points: 5 },
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
        score: 49, ncar: 0.21, label: "RISKY", bucketLabel: "Seriously under-covered",
        summary: "A 50% co-pay on a ₹3L cover means this policy pays for roughly a fifth of a serious hospitalisation. It is a discount, not a cover.",
        realClaim: "No. On a ₹4.5L admission the insurer would pay about ₹1.8L and Mr Singh would find ₹2.7L himself.",
        failures: [
          "50% co-pay on every claim",
          "₹3L sum insured against typical senior hospitalisation costs",
          "Cataract and knee replacement capped well below local cost",
          "No restoration once the ₹3L is used",
        ],
        deductions: [
          { reason: "50% co-pay on all claims", category: "Out of pocket", severity: "high", points: 22 },
          { reason: "Sum insured far below recommended cover at 66", category: "Net cover", severity: "high", points: 18 },
          { reason: "Hard sub-limits on the two most likely procedures", category: "Sub-limits", severity: "high", points: 8 },
          { reason: "No restoration benefit", category: "Coverage gaps", severity: "medium", points: 5 },
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
      sum_insured: 1500000, expiry_date: dateAgo(-200), created_at: ago(18),
      share_token: "demo-share-4", share_enabled: true, pdf_url: "#", error_message: null,
      flaws: [], extracted_data: null,
      report_data: healthReport({
        insured: ["Anita Desai", "Kunal Desai", "Ira Desai"], ages: [40, 42, 8], genders: ["female", "male", "female"],
        city: "Indore", zone: "B",
        inceptionDays: 165, expiryDays: -200, baseSI: 1500000, ncbCurrent: 0,
        pedMonths: 36, specificMonths: 24,
        maternity: { months: 48, relevant: false, covered: true, limit: 100000 },
        consumables: { covered: true, coverage_type: "full", remarks: "Consumables paid in full." },
        opd: { covered: true, limit: 10000, remarks: "₹10,000 a year for consultations, tests and pharmacy." },
        riders: [{ name: "Secure Benefit (cover doubles from year one)", coverage_amount: 1500000, is_material: true, remarks: "Effective cover is ₹30L from the first year." }],
        ambulanceLimit: 5000, networkCount: 13000,
        score: 91, ncar: 1.35, label: "EXCELLENT", bucketLabel: "Fully covered",
        summary: "Nothing here needs fixing. No room cap, no co-pay, consumables paid, and the effective cover is well ahead of what this family would need.",
        realClaim: "Yes. A ₹4.5L admission settles in full, and the cover would absorb a ₹12L cancer year without exhausting.",
        failures: [],
        deductions: [{ reason: "Standard 36-month pre-existing wait still running", category: "Waiting periods", severity: "low", points: 6 }],
        works: [
          { benefit: "No room-rent cap and no co-pay", why_it_matters_in_claim: "The bill is settled as presented.", quantified_value: null },
          { benefit: "Cover effectively ₹30L from year one", why_it_matters_in_claim: "Absorbs a full cancer or transplant year without a top-up.", quantified_value: "₹30,00,000" },
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
      sum_insured: 700000, expiry_date: dateAgo(-25), created_at: ago(22),
      share_token: "demo-share-5", share_enabled: true, pdf_url: "#", error_message: null,
      flaws: [], extracted_data: null,
      report_data: healthReport({
        insured: ["Prakash Mehta", "Sunita Mehta"], ages: [50, 46], genders: ["male", "female"],
        city: "Dewas", zone: "C",
        inceptionDays: 340, expiryDays: -25, baseSI: 700000, ncbCurrent: 10,
        subLimits: [{ procedure: "Cataract (per eye)", limit: 30000, typical_cost_in_zone: 55000, severity: "medium" }],
        pedMonths: 36, specificMonths: 24,
        restoration: { exists: false, remarks: "No restoration — once ₹7L is used in a policy year, there is nothing left until renewal." },
        score: 67, ncar: 0.68, label: "BORDERLINE", bucketLabel: "Partly covered",
        summary: "The claim terms are clean — no room cap, no co-pay. The weakness is size: one long year of treatment can empty the cover with nothing to fall back on.",
        realClaim: "Mostly. A single ₹4.5L admission settles well; a second claim in the same year would not.",
        failures: ["No restoration once the sum insured is used", "Cataract capped below local cost", "₹7L is thin for two adults if a serious year runs long"],
        deductions: [
          { reason: "No restoration benefit", category: "Coverage gaps", severity: "high", points: 13 },
          { reason: "Sum insured below recommended cover for this age", category: "Net cover", severity: "medium", points: 12 },
          { reason: "Cataract sub-limit", category: "Sub-limits", severity: "low", points: 5 },
        ],
        works: [
          { benefit: "No room-rent cap and no co-pay", why_it_matters_in_claim: "Bills are settled as presented, which is the expensive part on most plans.", quantified_value: null },
        ],
        fails: [
          { issue: "No restoration", real_world_claim_impact: "A second hospitalisation in the same policy year is entirely out of pocket.", quantified_oop_risk: "Full cost of the second claim" },
        ],
        actions: [
          {
            action: "Add a super top-up above a ₹5L deductible",
            reason: "Cheapest way to turn ₹7L of cover into ₹25L+ without disturbing a plan whose terms are already good.",
            oop_risk_if_ignored: "Everything above ₹7L in a bad year",
            suggested_riders_or_topups: ["₹20L super top-up above ₹5L deductible"],
            estimated_cost: "₹5,000–₹7,000 a year",
          },
        ],
        mediumPriority: [{ action: "Ask the insurer about a restoration add-on at renewal", reason: "Some variants of this plan offer it for a small loading." }],
        port: "consider",
        portReason: "The terms are worth keeping; the size is not. A top-up fixes it more cheaply than porting does.",
        portLookFor: ["Unlimited restoration", "₹15L+ base cover", "No cataract sub-limit"],
      }),
    },
    {
      id: "pol-6", agent_id: DEMO_AGENT_ID, customer_id: "cust-2",
      policy_name: "Activ One MAX", name: "Meena Joshi", policyholder_name: "Meena Joshi",
      insurer: INSURERS.icici, insurance_type: "health", status: "done", score: 74,
      sum_insured: 1000000, expiry_date: dateAgo(-300), created_at: ago(30),
      share_token: null, share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], extracted_data: null,
      report_data: healthReport({
        insured: ["Meena Joshi"], ages: [45], genders: ["female"],
        city: "Bhopal", zone: "B",
        inceptionDays: 430, expiryDays: -300, baseSI: 1000000, ncbCurrent: 20, tenureYears: 2,
        subLimits: [
          { procedure: "Cataract (per eye)", limit: 35000, typical_cost_in_zone: 55000, severity: "medium" },
          { procedure: "Hernia repair", limit: 60000, typical_cost_in_zone: 95000, severity: "low" },
        ],
        pedMonths: 36, specificMonths: 24,
        score: 74, ncar: 0.88, label: "SAFE", bucketLabel: "Adequately covered",
        summary: "A solid second cover for the same person. Clean claim terms; the only friction is disease-wise caps on a few common procedures.",
        realClaim: "Yes, for a normal admission. Named procedures pay only up to their cap.",
        failures: ["Disease-wise caps on cataract and hernia", "Overlaps with the ReAssure policy on the same life"],
        deductions: [
          { reason: "Disease-wise sub-limits on common procedures", category: "Sub-limits", severity: "medium", points: 10 },
          { reason: "Pre-existing wait not fully served", category: "Waiting periods", severity: "low", points: 8 },
        ],
        works: [
          { benefit: "No co-pay and no room-rent cap", why_it_matters_in_claim: "Straightforward settlement on an ordinary admission.", quantified_value: null },
          { benefit: "20% accrued no-claim bonus", why_it_matters_in_claim: "₹2L of extra cover at no cost.", quantified_value: "₹2,00,000" },
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
    // A couple of data-entry (non-health) policies to show multi-LoB
    {
      id: "pol-7", agent_id: DEMO_AGENT_ID, customer_id: "cust-5",
      policy_name: "Private Car Package", name: "Prakash Mehta", policyholder_name: "Prakash Mehta",
      insurer: INSURERS.digit, insurance_type: "motor", status: "done", score: null,
      sum_insured: 650000, expiry_date: dateAgo(-12), created_at: ago(14),
      share_token: null, share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], report_data: null,
      extracted_data: { premium: 18400, vehicle: "Hyundai Creta", reg_no: "MP09 CX 4521" },
    },
    {
      id: "pol-8", agent_id: DEMO_AGENT_ID, customer_id: "cust-1",
      policy_name: "Jeevan Anand", name: "Suresh Agarwal", policyholder_name: "Suresh Agarwal",
      insurer: INSURERS.lic, insurance_type: "life", status: "done", score: null,
      sum_insured: 2000000, expiry_date: dateAgo(-150), created_at: ago(40),
      share_token: null, share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], report_data: null,
      extracted_data: { premium: 48000, term_years: 21, mode: "Yearly" },
    },
    // In-flight + failed, so My Queue and the failures panel have content
    {
      id: "pol-9", agent_id: DEMO_AGENT_ID, customer_id: null,
      policy_name: "Health Companion", name: "Deepak Verma", policyholder_name: "Deepak Verma",
      insurer: INSURERS.niva, insurance_type: "health", status: "processing", score: null,
      sum_insured: null, expiry_date: null, created_at: ago(0.05),
      share_token: null, share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], report_data: null, extracted_data: null,
    },
    {
      id: "pol-10", agent_id: DEMO_AGENT_ID, customer_id: null,
      policy_name: "Young Star", name: "Pooja Nair", policyholder_name: "Pooja Nair",
      insurer: INSURERS.star, insurance_type: "health", status: "pending", score: null,
      sum_insured: null, expiry_date: null, created_at: ago(0.2),
      share_token: null, share_enabled: false, pdf_url: "#", error_message: null,
      flaws: [], report_data: null, extracted_data: null,
    },
    {
      id: "pol-11", agent_id: DEMO_AGENT_ID, customer_id: null,
      policy_name: "Scanned upload", name: "Rohit Sharma", policyholder_name: "Rohit Sharma",
      insurer: INSURERS.hdfc, insurance_type: "health", status: "error", score: null,
      sum_insured: null, expiry_date: null, created_at: ago(2),
      share_token: null, share_enabled: false, pdf_url: "#",
      error_message: "Document was blurry — couldn't read the policy schedule.",
      flaws: [], report_data: null, extracted_data: null,
    },
    {
      id: "pol-12", agent_id: DEMO_AGENT_ID, customer_id: null,
      policy_name: "Old policy", name: "Sunita Rao", policyholder_name: "Sunita Rao",
      insurer: INSURERS.tata, insurance_type: "health", status: "error", score: null,
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
    { id: "lp-1", lead_id: "lead-2", agent_id: DEMO_AGENT_ID, insurance_type: "motor", insurer: INSURERS.digit, policy_name: "Two-wheeler package", policyholder_name: "Manoj Tiwari", premium: 1850, due_date: dateAgo(-8), file_url: "#", file_name: "manoj-bike.pdf", extracted_data: { reg_no: "MP04 AB 1234" }, spoken_to: false, notes: "", created_at: ago(6), updated_at: ago(6) },
    { id: "lp-2", lead_id: "lead-4", agent_id: DEMO_AGENT_ID, insurance_type: "health", insurer: INSURERS.care, policy_name: "Existing senior plan", policyholder_name: "Imran Khan (parents)", premium: 31000, due_date: dateAgo(-22), file_url: "#", file_name: "parents-health.pdf", extracted_data: null, spoken_to: true, notes: "Current cover only ₹3L.", created_at: ago(14), updated_at: ago(5) },
    { id: "lp-3", lead_id: "lead-3", agent_id: DEMO_AGENT_ID, insurance_type: "life", insurer: INSURERS.lic, policy_name: "Old endowment", policyholder_name: "Shilpa Reddy", premium: 22000, due_date: dateAgo(-3), file_url: "#", file_name: "shilpa-lic.pdf", extracted_data: null, spoken_to: false, notes: "", created_at: ago(10), updated_at: ago(10) },
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

  return {
    id: clientId,
    agent_id: DEMO_AGENT_ID,
    customer_id: null,
    policy_name: isHealth ? "Health Guard Plus" : "Uploaded policy",
    name,
    policyholder_name: name,
    filename: opts.filename ?? "policy.pdf",
    insurer: INSURERS.tata,
    insurance_type: type,
    status: "done",
    score: isHealth ? 61 : null,
    sum_insured: 500000,
    expiry_date: dateAgo(-64),
    created_at: new Date().toISOString(),
    share_token: null,
    share_enabled: false,
    pdf_url: "#",
    error_message: null,
    flaws: [],
    extracted_data: isHealth ? null : { premium: 14200 },
    report_data: isHealth
      ? healthReport({
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
          score: 61, ncar: 0.48, label: "RISKY", bucketLabel: "Under-covered",
          summary: "A room-rent cap and a 10% co-pay sit on top of a ₹5L cover. Together they leave close to a third of a large bill with the family.",
          realClaim: "Partly. On a ₹4.5L admission the family would find roughly ₹1.5L themselves.",
          failures: [
            "Room rent capped at ₹4,000 a day with proportionate deduction",
            "10% co-pay on every claim",
            "No restoration once the cover is used",
            "₹5L is thin for two adults in their forties",
          ],
          deductions: [
            { reason: "Room-rent cap with proportionate deduction", category: "Claim payout", severity: "high", points: 15 },
            { reason: "10% co-pay on all claims", category: "Out of pocket", severity: "medium", points: 8 },
            { reason: "Sum insured below recommended cover", category: "Net cover", severity: "medium", points: 10 },
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
        })
      : null,
  };
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
