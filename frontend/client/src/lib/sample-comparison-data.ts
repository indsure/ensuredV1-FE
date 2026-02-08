import type { PolicyData } from "@/types/policy";
import type { UploadedPolicy } from "@/hooks/use-comparison";
import type { ComparisonProfile } from "@/hooks/use-comparison";

const subLimit = (capped: boolean, limit: number | null, display: string) => ({
  capped,
  limit_amount: limit,
  display,
  unlimited: !capped,
});

function createSamplePolicyData(opts: {
  policyId: string;
  fileName: string;
  insurer: string;
  planName: string;
  baseSI: number;
  baseSIDisplay: string;
  annualPremium: number;
  roomRentType: "daily_limit" | "percentage" | "unlimited";
  roomRentAmount: number | null;
  roomRentDisplay: string;
  roomRentUnlimited: boolean;
  copayExists: boolean;
  copayPercent: number | null;
}): PolicyData {
  return {
    policy_id: opts.policyId,
    upload_date: new Date().toISOString().split("T")[0],
    file_name: opts.fileName,
    extraction_metadata: {
      extracted_by: "sample",
      extraction_confidence: 1,
      extraction_timestamp: new Date().toISOString(),
      missing_fields: [],
      manual_verification_needed: false,
      extraction_notes: "Sample data for demo",
    },
    basic_info: {
      insurer: opts.insurer,
      plan_name: opts.planName,
      policy_type: "health",
      inception_date: "2024-01-01",
      expiry_date: "2025-12-31",
    },
    coverage: {
      base_si: { amount: opts.baseSI, currency: "INR", display: opts.baseSIDisplay },
      annual_premium: {
        amount: opts.annualPremium,
        currency: "INR",
        display: `₹${opts.annualPremium.toLocaleString("en-IN")}/year`,
        premium_per_month: Math.round(opts.annualPremium / 12),
      },
      room_rent: {
        type: opts.roomRentType,
        amount: opts.roomRentAmount,
        currency: "INR",
        percent_of_si: null,
        display: opts.roomRentDisplay,
        unlimited: opts.roomRentUnlimited,
      },
      copay: {
        exists: opts.copayExists,
        type: opts.copayExists ? "all_claims" : null,
        percent: opts.copayPercent,
        flat_amount: null,
        note: opts.copayExists ? `${opts.copayPercent}% co-pay` : "No co-pay",
        applies_to: [],
      },
      deductible: { exists: false, amount: null, note: "No deductible" },
    },
    sub_limits: {
      cancer: subLimit(false, null, "Within base SI"),
      cardiac: subLimit(false, null, "Within base SI"),
      organ_transplant: subLimit(true, 500000, "₹5L"),
    },
    waiting_periods: {
      general_waiting_period: { days: 30, months: 1, note: "30 days" },
      specific_diseases: { other_major_diseases: [] },
      pre_existing_disease: { days: 0, months: 24, note: "2 years", can_be_waived: false },
    },
    coverage_details: {
      hospitalization: { covered: true },
      pre_hospitalization: { covered: true, days_before_admission: 60, display: "60 days" },
      post_hospitalization: { covered: true, days_after_discharge: 180, display: "180 days" },
      domiciliary_care: {
        covered: true,
        limit_type: "percentage_of_si",
        limit_amount: 100000,
        limit_percent: 10,
        display: "10% of SI",
      },
      daycare_procedures: { covered: true },
      opd: { covered: false, limit: null, note: "Not covered" },
    },
    riders: {
      critical_illness: { available: true, note: "Optional" },
      personal_accident: { available: true, note: "Optional" },
      maternity: { available: true, coverage_amount: 100000, note: "₹1L, 24-month WP" },
    },
    exclusions: {
      major_exclusions: ["Cosmetic surgery", "HIV/AIDS"],
      pre_existing_exclusion: { applies: true, waiting_period_months: 24, note: "2 years" },
    },
    restoration: {
      type: "unlimited",
      note: "100% restoration",
      times_per_year: 1,
      automatic: true,
    },
    network: { cashless_available: true, hospital_network_count: { total: 10000 } },
  };
}

export function getSampleHealthPoliciesForCompare(): UploadedPolicy[] {
  const policyA = createSamplePolicyData({
    policyId: "sample-a",
    fileName: "HDFC ERGO Optima Restore.pdf",
    insurer: "HDFC ERGO",
    planName: "Optima Restore",
    baseSI: 1000000,
    baseSIDisplay: "₹10 Lakh",
    annualPremium: 18500,
    roomRentType: "daily_limit",
    roomRentAmount: 5000,
    roomRentDisplay: "₹5,000/day",
    roomRentUnlimited: false,
    copayExists: false,
    copayPercent: null,
  });

  const policyB = createSamplePolicyData({
    policyId: "sample-b",
    fileName: "ICICI Lombard Health AdvantEdge.pdf",
    insurer: "ICICI Lombard",
    planName: "Health AdvantEdge",
    baseSI: 500000,
    baseSIDisplay: "₹5 Lakh",
    annualPremium: 11400,
    roomRentType: "daily_limit",
    roomRentAmount: 2500,
    roomRentDisplay: "₹2,500/day",
    roomRentUnlimited: false,
    copayExists: true,
    copayPercent: 20,
  });

  return [
    {
      id: "sample-1",
      file: new File([], "HDFC ERGO Optima Restore.pdf", { type: "application/pdf" }),
      status: "success",
      policyData: policyA,
    },
    {
      id: "sample-2",
      file: new File([], "ICICI Lombard Health AdvantEdge.pdf", { type: "application/pdf" }),
      status: "success",
      policyData: policyB,
    },
  ];
}

export function getSampleProfile(): ComparisonProfile {
  return {
    age: 35,
    city: "Mumbai",
    state: "Maharashtra",
    preExistingConditions: [],
    householdIncome: 1500000,
    familySize: 4,
  };
}
