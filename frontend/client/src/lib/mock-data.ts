// @ts-nocheck
import { ForensicAuditReport } from "@/types/master_audit_schema";
import { TERM_RIDERS_DATABASE } from "./data/term-rider-data";
import { VEHICLE_RIDERS_DATABASE } from "./data/vehicle-rider-data";

export function loadSampleReport(data: any): void {
  sessionStorage.setItem("ensured_report", JSON.stringify(data));
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
        name: "Safeguard Rider (Niva Bupa equivalent)",
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
    claim_settlement_ratio: 95.2,
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
      { reason: "Maternity Permanently Excluded", category: "Coverage", severity: "high", points: 15 },
      { reason: "3-Year PED Waiting Period Active", category: "Timing", severity: "high", points: 10 },
      { reason: "Robotic Surgery Sub-Limit", category: "Limits", severity: "low", points: 1 }
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

// --- SAMPLE 2: LIFE ---
export const mockReportLife: ForensicAuditReport = {
  identity: {
    insured_names: ["Rajesh Kumar"],
    ages: [42],
    genders: ["Male"],
    city: "Bangalore",
    assumed_zone: "A",
    health_flags: [],
    confidence: "high"
  },
  policy_timeline: {
    policy_inception_date: "2018-06-20",
    policy_expiry_date: "2058-06-19",
    policy_tenure_years: 40,
    policy_age_days: 2300,
    analysis_date: "2024-10-25",
    confidence: "high"
  },
  coverage_structure: {
    base_sum_insured: 10000000, // 1 Cr
    top_up: { exists: false, sum_insured: null, deductible: null, type: "unclear", deductible_achievable: null, remarks: "" },
    super_top_up: { exists: false, sum_insured: null, deductible: null, deductible_achievable: null, remarks: "" },
    restoration: { exists: false, type: null, restore_amount: null, trigger_conditions: null, actually_useful: null, remarks: "Not applicable for Life." },
    no_claim_bonus: { exists: false, rate_per_year: null, cap_percentage: null, current_bonus: null, portability: "no", clarity: "clear", remarks: "" },
    riders: [
      {
        name: TERM_RIDERS_DATABASE[0].riderName, // ICICI Accidental Death
        coverage_amount: 10000000,
        is_material: true,
        remarks: "Double Sum Assured on Accident. Excellent addition."
      },
      {
        name: "Critical Illness Benefit", // Generic/Mapped to similar
        coverage_amount: 2500000,
        is_material: true,
        remarks: "Lump sum payout for 30+ critical illnesses including Cancer, Heart Attack, Stroke. 90-day waiting period."
      },
      {
        name: "Waiver of Premium Rider",
        coverage_amount: null,
        is_material: true,
        remarks: "Future premiums waived if diagnosed with Critical Illness or Permanent Disability."
      }
    ],
    total_effective_coverage: 10000000,
    confidence: "high"
  },
  waiting_period_analysis: {
    initial_waiting_period: { duration_days: 0, end_date: null, is_active_today: false, risk_commentary: "Immediate cover for Death." },
    pre_existing_disease: { duration_months: 36, start_date: "2018-06-20", end_date: "2021-06-19", is_active_today: false, months_remaining: 0, risk_commentary: "Section 45 protects after 3 years. Safe." },
    specific_diseases: { duration_months: 0, diseases_covered: [], end_date: null, is_active_today: false, risk_commentary: "N/A" },
    maternity: { duration_months: 0, end_date: null, is_active_today: false, months_remaining: 0, risk_commentary: "N/A" },
    other_waiting_periods: [
      { category: "Suicide Exclusion", duration_months: 12, end_date: "2019-06-20", risk_commentary: "Served. Suicide now covered." },
      { category: "Suicide Exclusion", duration_months: 12, end_date: "2019-06-20", risk_commentary: "Served. Suicide now covered." },
      { category: "Critical Illness Wait", duration_months: 3, end_date: "2018-09-20", risk_commentary: "Served. CI covered." }
    ],
    policy_fully_active: true
  },
  claim_risk_analysis: {
    room_rent: { limit_type: "none", limit_value: "N/A", limit_amount_per_day: null, penalty_type: "none", penalty_calculation: null, risk_level: "low", zone_adequacy: "adequate", explanation: "Lump sum payout. No room rent logic." },
    co_payment: { exists: false, percentage: 0, conditions: null, applies_to: "unclear", waiver_conditions: null, risk_level: "low", oop_on_5L_claim: 0 },
    sub_limits: { exists: false, categories: [], risk_level: "low", remarks: "" },
    deductibles: { base_deductible: 0, per_claim_impact: null, remarks: "" }
  },
  supplementary_coverage: {
    opd: { covered: false, limit_per_year: null, conditions: null, utility: "none", remarks: "N/A" },
    maternity: { covered: false, limit_per_delivery: null, waiting_period_over: true, conditions: null, utility: "none", remarks: "N/A" },
    consumables: { covered: false, coverage_type: "none", limit: null, remarks: "N/A" },
    modern_treatments: { covered: false, examples: [], conditions: null, remarks: "N/A" },
    ambulance: { covered: false, limit_per_trip: null, remarks: "N/A" },
    day_care_procedures: { covered: false, number_of_procedures: null, remarks: "N/A" },
    preventive_health_checkup: { covered: false, limit_per_year: null, remarks: "N/A" }
  },
  network_limitations: {
    network_type: "unclear",
    hospital_count_in_zone: null,
    major_hospitals_included: [],
    reimbursement_allowed: true,
    claim_settlement_ratio: 99.2,
    risk_level: "low",
    remarks: "Excellent settlement record. HDFC Life typically settles claims within 30 days."
  },
  benefit_evaluation: {
    what_actually_works: [
      { benefit: "Claim Settlement Ratio (99.2%)", why_it_matters_in_claim: "Extremely high probability of payout reliability.", quantified_value: "High Certainty" },
      { benefit: "Section 45 Protection", why_it_matters_in_claim: "Policy cannot be called into question for non-disclosure after 3 years.", quantified_value: "Absolute Security" },
      { benefit: "Critical Illness Rider", why_it_matters_in_claim: "Provides liquid cash for treatment without eating into savings.", quantified_value: "₹25L Immediate Payout" },
      { benefit: "Waiver of Premium", why_it_matters_in_claim: "Keeps policy active even if you can't earn.", quantified_value: "Saves ~₹5-10L Premiums" }
    ],
    where_policy_fails: [
      { issue: "Inflation Erosion", real_world_claim_impact: "₹1 Cr value will halve in purchasing power over 15 years.", quantified_oop_risk: "Real value drops 50%" }
    ],
    structural_red_flags: []
  },
  audit_score: {
    score: 96,
    breakdown: { claim_rejection_risk: 30, oop_exposure: 30, coverage_adequacy: 28, structural_clarity: 10, supplementary_benefits: 8 },
    deductions: [],
    interpretation: "A rock-solid financial fortress. Comprehensive protection against Death, Accident, and Disease."
  },
  final_verdict: {
    label: "SAFE",
    summary: "Gold Standard Protection. Rider Attachments Perfect.",
    key_failure_points: ["None - Inflation is only long term risk."],
    will_this_policy_protect_in_real_claim: "Yes, 100% payout expected."
  },
  recommendations: {
    critical_actions: [],
    should_port_to_better_policy: { recommendation: "no", reason: "", what_to_look_for: [] },
    medium_priority: [{ action: "Add Critical Illness", reason: "Cover income loss during serious illness." }],
    low_priority: []
  },
  confidence_notes: ["Standard HDFC wording."],
  data_quality: {
    overall: "high",
    missing_critical_fields: [],
    ambiguous_clauses: [],
    policy_document_quality: "clear"
  }
};


// --- SAMPLE 3: VEHICLE ---
export const mockReportVehicle: ForensicAuditReport = {
  identity: {
    insured_names: ["Priya Singh"],
    ages: ["N/A"],
    genders: ["Female"],
    city: "Delhi",
    assumed_zone: "A",
    health_flags: [],
    confidence: "high"
  },
  policy_timeline: {
    policy_inception_date: "2023-03-10",
    policy_expiry_date: "2024-03-09",
    policy_tenure_years: 1,
    policy_age_days: 200,
    analysis_date: "2024-10-25",
    confidence: "high"
  },
  coverage_structure: {
    base_sum_insured: 1250000,
    top_up: { exists: false, sum_insured: null, deductible: null, type: "unclear", deductible_achievable: null, remarks: "" },
    super_top_up: { exists: false, sum_insured: null, deductible: null, deductible_achievable: null, remarks: "" },
    restoration: { exists: false, type: null, restore_amount: null, trigger_conditions: null, actually_useful: null, remarks: "N/A" },
    no_claim_bonus: { exists: true, rate_per_year: 20, cap_percentage: 50, current_bonus: 20, portability: "yes", clarity: "clear", remarks: "NCB active." },
    riders: [
      { name: VEHICLE_RIDERS_DATABASE[0].riderName, coverage_amount: null, is_material: true, remarks: "Key for car insurance - " + VEHICLE_RIDERS_DATABASE[0].description },
      { name: VEHICLE_RIDERS_DATABASE[3].riderName, coverage_amount: null, is_material: true, remarks: "Essential support - " + VEHICLE_RIDERS_DATABASE[3].description }
    ],
    total_effective_coverage: 1250000,
    confidence: "high"
  },
  waiting_period_analysis: {
    initial_waiting_period: { duration_days: 0, end_date: null, is_active_today: false, risk_commentary: "Immediate" },
    pre_existing_disease: { duration_months: 0, start_date: null, end_date: null, is_active_today: false, months_remaining: null, risk_commentary: "N/A" },
    specific_diseases: { duration_months: 0, diseases_covered: [], end_date: null, is_active_today: false, risk_commentary: "N/A" },
    maternity: { duration_months: 0, end_date: null, is_active_today: false, months_remaining: null, risk_commentary: "N/A" },
    other_waiting_periods: [],
    policy_fully_active: true
  },
  claim_risk_analysis: {
    room_rent: { limit_type: "none", limit_value: "N/A", limit_amount_per_day: null, penalty_type: "none", penalty_calculation: null, risk_level: "low", zone_adequacy: "adequate", explanation: "Networks Garages." },
    co_payment: { exists: true, percentage: null, conditions: "Compulsory Deductible: ₹1000", applies_to: "all_claims", waiver_conditions: null, risk_level: "low", oop_on_5L_claim: 1000 },
    sub_limits: { exists: false, categories: [], risk_level: "low", remarks: "" },
    deductibles: { base_deductible: 1000, per_claim_impact: "Low", remarks: "Standard Compulsory Deductible." }
  },
  supplementary_coverage: {
    opd: { covered: false, limit_per_year: null, conditions: null, utility: "none", remarks: "N/A" },
    maternity: { covered: false, limit_per_delivery: null, waiting_period_over: true, conditions: null, utility: "none", remarks: "N/A" },
    consumables: { covered: true, coverage_type: "full", limit: "Included in Zero Dep", remarks: "Consumables covered." },
    modern_treatments: { covered: false, examples: [], conditions: null, remarks: "N/A" },
    ambulance: { covered: true, limit_per_trip: 1500, remarks: "Towing covered up to limit." },
    day_care_procedures: { covered: false, number_of_procedures: null, remarks: "N/A" },
    preventive_health_checkup: { covered: false, limit_per_year: null, remarks: "N/A" }
  },
  network_limitations: {
    network_type: "cashless_only",
    hospital_count_in_zone: "450+",
    major_hospitals_included: ["Maruti Auth", "Hyundai Auth"],
    reimbursement_allowed: true,
    claim_settlement_ratio: 98,
    risk_level: "low",
    remarks: "Strong Garage Network"
  },
  benefit_evaluation: {
    what_actually_works: [
      { benefit: "Zero Depreciation Cover", why_it_matters_in_claim: "100% payout on parts replacement (Plastic/Metal).", quantified_value: "Saves ~30-50% on bill" },
      { benefit: "Roadside Assistance (RSA)", why_it_matters_in_claim: "Free towing and jumpstart anywhere.", quantified_value: "Invaluable in emergency" },
      { benefit: "Consumables Cover", why_it_matters_in_claim: "Pays for nuts, bolts, oil.", quantified_value: "Saves ₹2-5k" }
    ],
    where_policy_fails: [
      { issue: "Engine Protection Missing", real_world_claim_impact: "Hydrostatic lock (flood) not covered.", quantified_oop_risk: "₹2L - ₹3L Risk" }
    ],
    structural_red_flags: [
      { flag: "Missing Engine Protect", why_it_is_dangerous: "If you live in waterlogging area, this is risky.", severity: "low" }
    ]
  },
  audit_score: {
    score: 94,
    breakdown: { claim_rejection_risk: 28, oop_exposure: 28, coverage_adequacy: 28, structural_clarity: 10, supplementary_benefits: 10 },
    deductions: [{ reason: "Engine Protection Missing", category: "Benefits", severity: "low", points: 6 }],
    interpretation: "Excellent comprehensive coverage with key riders (Zero Dep + RSA)."
  },
  final_verdict: {
    label: "EXCELLENT",
    summary: "Top Tier Coverage. You are well protected.",
    key_failure_points: ["Flooding risk (No Engine Cover)"],
    will_this_policy_protect_in_real_claim: "Yes, extremely high protection."
  },
  recommendations: {
    critical_actions: [],
    should_port_to_better_policy: { recommendation: "no", reason: "", what_to_look_for: [] },
    medium_priority: [],
    low_priority: []
  },
  confidence_notes: ["Kotak Car Secure wording."],
  data_quality: {
    overall: "high",
    missing_critical_fields: [],
    ambiguous_clauses: [],
    policy_document_quality: "clear"
  }
};