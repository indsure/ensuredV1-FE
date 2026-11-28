import { ForensicAuditReport } from "@shared/policy";

export function loadSampleReport(data: any): void {
  sessionStorage.setItem("IndSure_report", JSON.stringify(data));
}

// --- SAMPLE 1: HEALTH (Care Supreme - "Perfectly Flawed") ---
export const mockReportCareSupreme: ForensicAuditReport = {
  identity: {
    insured_names: ["Aditi Sharma"],
    ages: [35],
    genders: ["Female"],
    city: "Mumbai",
    assumed_zone: "A",
    health_flags: ["Thyroid History", "Pre-diabetic"],
    confidence: "high"
  },
  policy_timeline: {
    policy_inception_date: "2024-01-15",
    policy_expiry_date: "2025-01-14",
    policy_tenure_years: 1,
    policy_age_days: 285,
    analysis_date: "2024-10-25",
    confidence: "high"
  },
  coverage_structure: {
    base_sum_insured: 1000000,
    top_up: {
      exists: false,
      sum_insured: null,
      deductible: null,
      type: "unclear",
      deductible_achievable: null,
      remarks: "No top-up detected."
    },
    super_top_up: {
      exists: false,
      sum_insured: null,
      deductible: null,
      deductible_achievable: null,
      remarks: ""
    },
    restoration: {
      exists: true,
      type: "full",
      restore_amount: 1000000,
      // Read off trigger_conditions below: unlimited, but unrelated illnesses only.
      same_illness_covered: false,
      unlimited: true,
      triggers_on_first_claim: null,
      trigger_conditions: "Unlimited times for unrelated illnesses. Partial for related.",
      actually_useful: true,
      remarks: "Unlimited automatic recharge is a strong feature."
    },
    no_claim_bonus: {
      exists: true,
      rate_per_year: 50,
      cap_percentage: 100,
      current_bonus: 500000,
      portability: "yes",
      clarity: "clear",
      remarks: "Super Bonus scales incredibly fast (50% per year)."
    },
    riders: [
      {
        name: "Annual Health Check-up",
        coverage_amount: 5000,
        is_material: true,
        remarks: "Comprehensive check-up including Lipid Profile, Echo, TMT."
      },
      {
        name: "Safeguard Rider",
        coverage_amount: null,
        is_material: true,
        remarks: "Covers non-payable items (gloves, masks) + Inflation protection."
      }
    ],
    total_effective_coverage: 2500000,
    confidence: "high"
  },
  waiting_period_analysis: {
    initial_waiting_period: {
      duration_days: 30,
      end_date: "2024-02-14",
      is_active_today: false,
      risk_commentary: "Initial wait served."
    },
    pre_existing_disease: {
      duration_months: 36,
      start_date: "2024-01-15",
      end_date: "2027-01-14",
      is_active_today: true,
      months_remaining: 26,
      risk_commentary: "3-year wait for PEDs like Thyroid/Diabetes is active. Major risk."
    },
    specific_diseases: {
      duration_months: 24,
      diseases_covered: ["Hernia", "Cataract", "Joint Replacement", "Stones"],
      end_date: "2026-01-15",
      is_active_today: true,
      risk_commentary: "Standard 2-year exclusions apply."
    },
    maternity: {
      duration_months: 0,
      end_date: null,
      is_active_today: false,
      months_remaining: null,
      risk_commentary: "Maternity is PERMANENTLY EXCLUDED in this plan."
    },
    other_waiting_periods: [],
    policy_fully_active: false
  },
  claim_risk_analysis: {
    room_rent: {
      limit_type: "none",
      limit_value: "No Limit",
      limit_amount_per_day: null,
      penalty_type: "none",
      penalty_calculation: null,
      risk_level: "low",
      zone_adequacy: "adequate",
      explanation: "You have No Room Rent Capping. You can choose any room category (Suite/Deluxe) without penalty."
    },
    co_payment: {
      exists: false,
      percentage: 0,
      conditions: null,
      applies_to: "unclear",
      waiver_conditions: null,
      risk_level: "low",
      oop_on_5L_claim: 0
    },
    sub_limits: {
      exists: true,
      categories: [
        { procedure: "Robotic Surgery", limit: 500000, typical_cost_in_zone: 600000, gap: 100000, severity: "medium" },
        { procedure: "Ayush Treatment", limit: 100000, typical_cost_in_zone: 50000, gap: 0, severity: "low" }
      ],
      risk_level: "medium",
      remarks: "Robotic surgery cap is the main concern for cancer treatments."
    },
    deductibles: {
      base_deductible: 0,
      per_claim_impact: "None",
      remarks: "No deductible."
    }
  },
  supplementary_coverage: {
    opd: {
      covered: false,
      limit_per_year: null,
      conditions: null,
      utility: "none",
      remarks: "OPD not covered. Only hospitalization expenses."
    },
    maternity: {
      covered: false,
      limit_per_delivery: null,
      waiting_period_over: false,
      conditions: "Excluded",
      utility: "none",
      remarks: "Not available."
    },
    consumables: {
      covered: true,
      coverage_type: "full",
      limit: "Claim Amount",
      remarks: "Care Shield rider covers consumables fully."
    },
    modern_treatments: {
      covered: true,
      examples: ["Robotic", "Stem Cell", "Oral Chemo"],
      conditions: "Sub-limits apply",
      remarks: "Covered but capped."
    },
    ambulance: {
      covered: true,
      limit_per_trip: null,
      remarks: "No specific limit found."
    },
    day_care_procedures: {
      covered: true,
      number_of_procedures: 500,
      remarks: "All day care covered."
    },
    preventive_health_checkup: {
      covered: true,
      limit_per_year: null,
      remarks: "Annual checkup included."
    }
  },
  network_limitations: {
    network_type: "cashless_and_reimbursement",
    hospital_count_in_zone: "200+",
    major_hospitals_included: ["Nanavati", "Kokilaben", "Lilavati"],
    reimbursement_allowed: true,
    risk_level: "low",
    remarks: "Good network in Mumbai."
  },
  benefit_evaluation: {
    what_actually_works: [
      { benefit: "Unlimited Automatic Recharge", why_it_matters_in_claim: "Sum Insured refills instantly for unrelated illnesses.", quantified_value: "+₹10L Coverage" },
      { benefit: "50% No Claim Bonus", why_it_matters_in_claim: "Bonus compounds faster than standard policies (usually 10%).", quantified_value: "Reach 2x SI in 2 years" },
      { benefit: "No Room Rent Cap", why_it_matters_in_claim: "Essential for Mumbai hospitals where rates differ by 40-50%.", quantified_value: "Saves ₹2-3L on large claims" }
    ],
    where_policy_fails: [
      { issue: "Maternity Excluded", real_world_claim_impact: "Will pay ₹0 for delivery costs.", quantified_oop_risk: "₹1.5L - ₹2.5L OOP" },
      { issue: "Robotic Surgery Limit", real_world_claim_impact: "Cap of ₹5L applies on expensive surgeries.", quantified_oop_risk: "₹1L - ₹2L OOP possible" }
    ],
    structural_red_flags: [
      { flag: "Zone-Based Pricing", why_it_is_dangerous: "Verify premium adjustment if moving cities.", severity: "low" }
    ]
  },
  audit_score: {
    score: 74,
    breakdown: {
      claim_rejection_risk: 15,
      oop_exposure: 22,
      coverage_adequacy: 18,
      structural_clarity: 9,
      supplementary_benefits: 5
    },
    deductions: [
      { reason: "Maternity Permanently Excluded", category: "COVERAGE_GAP", severity: "high", points: 15 },
      { reason: "3-Year PED Waiting Period Active", category: "CLAIM_REJECTION", severity: "high", points: 10 },
      { reason: "Robotic Surgery Sub-Limit", category: "OOP_EXPOSURE", severity: "low", points: 1 }
    ],
    interpretation: "A strong policy for hospitalization but fails completely on Maternity. Good for singles, risky for family planning."
  },
  final_verdict: {
    label: "BORDERLINE",
    summary: "Solid for critical illness, but Major Gaps in Maternity & PED.",
    key_failure_points: ["Maternity Excluded", "3-Year PED Wait", "Robotic Cap"],
    will_this_policy_protect_in_real_claim: "Yes, for standard hospitalization. No, for childbirth or pre-existing thyroid issues until 2027."
  },
  recommendations: {
    critical_actions: [
      { action: "Buy Separate Maternity Cover", reason: "This policy will never cover childbirth.", oop_risk_if_ignored: "₹2-3 Lakhs", suggested_riders_or_topups: [], estimated_cost: "₹8k/year" },
      { action: "Declare PEDs Immediately", reason: "Ensure all past history is noted.", oop_risk_if_ignored: "Claim Rejection", suggested_riders_or_topups: [], estimated_cost: "None" }
    ],
    should_port_to_better_policy: {
      recommendation: "consider",
      reason: "If planning a family soon.",
      what_to_look_for: ["Maternity Cover >50k", "PED Wait < 2 Years"]
    },
    medium_priority: [
      { action: "Check Robotic Limit", reason: "₹5L cap might be low." }
    ],
    low_priority: []
  },
  confidence_notes: ["High confidence based on standard Care Supreme wording."],
  data_quality: {
    overall: "high",
    missing_critical_fields: [],
    ambiguous_clauses: [],
    policy_document_quality: "clear"
  }
};

export const mockReportHealth = { ...mockReportCareSupreme };
export const mockReport = mockReportHealth;

// Life, term and vehicle have no audit, so they have no audit sample here.
// Their public samples are summary tables: see lib/sampleFactsheets.ts.
