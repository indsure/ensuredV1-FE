import type { PolicyData } from "@/types/policy";
import { getCityTier } from "@/lib/calculators/optimalCoverageCalculator";
import { THRESHOLDS } from "./risk-thresholds";
import { differenceInMonths } from "date-fns";

export type RiskRating = "strong" | "adequate" | "meaningful_risk" | "high_risk" | "not_suitable";

export interface RiskRatingResult {
  rating: RiskRating;
  label: string;
  color: string;
  bgColor: string;
  reasons: string[];
  internalScore: number; // For animation/fill (85-100, 70-84, 50-69, 30-49, <30)
}

interface EvaluationContext {
  city: string;
  preExistingConditions: string[];
}

/**
 * Determines if a city is metro (Tier 1) or non-metro (Tier 2/3)
 */
function isMetroCity(city: string): boolean {
  const tier = getCityTier(city);
  return tier === "Tier 1";
}

/**
 * Checks if pre-existing disease is still under waiting period
 */
function isPreExistingUnderWaitingPeriod(
  policy: PolicyData,
  preExistingConditions: string[]
): boolean {
  if (preExistingConditions.length === 0 || preExistingConditions.includes("none")) {
    return false;
  }

  const waitingPeriodMonths = policy.waiting_periods?.pre_existing_disease?.months || 0;
  if (waitingPeriodMonths === 0) {
    return false; // No waiting period
  }

  // Check if policy start date + waiting period is in the future
  const policyStartDate = policy.basic_info?.inception_date;
  if (!policyStartDate) {
    // If we don't have start date, assume waiting period is active if it's a recent policy
    // For safety, we'll assume it's active if waiting period > 0
    return waitingPeriodMonths > 0;
  }

  try {
    const startDate = new Date(policyStartDate);
    const today = new Date();
    const monthsSinceStart = differenceInMonths(today, startDate);
    
    return monthsSinceStart < waitingPeriodMonths;
  } catch {
    // If date parsing fails, assume active if waiting period > 0
    return waitingPeriodMonths > 0;
  }
}

/**
 * Checks if co-pay > 20% applies to all claims
 */
function hasHighCopayOnAllClaims(policy: PolicyData): boolean {
  const copay = policy.coverage?.copay;
  if (!copay?.exists || !copay.percent) {
    return false;
  }

  // Check if co-pay applies to all claims (not just specific treatments)
  const appliesToAll = copay.type === "all_claims" || copay.applies_to?.length === 0;
  
  return appliesToAll && copay.percent > THRESHOLDS.COPAY_HIGH_THRESHOLD;
}

/**
 * Checks if room rent is capped (not unlimited)
 */
function isRoomRentCapped(policy: PolicyData): boolean {
  return !policy.coverage?.room_rent?.unlimited;
}

/**
 * Checks if there are major sub-limits on cardiac, cancer, or joint replacement
 */
function hasMajorSublimits(policy: PolicyData): boolean {
  // Check cardiac sub-limit
  const cardiac = policy.sub_limits?.cardiac;
  if (cardiac?.capped && cardiac.limit_amount && cardiac.limit_amount < THRESHOLDS.CARDIAC_SUBLIMIT_MIN) {
    return true;
  }

  // Check cancer sub-limit
  const cancer = policy.sub_limits?.cancer;
  if (cancer?.capped && cancer.limit_amount && cancer.limit_amount < THRESHOLDS.CANCER_SUBLIMIT_MIN) {
    return true;
  }

  // Check joint replacement (orthopedic_implants)
  const orthopedic = policy.sub_limits?.orthopedic_implants;
  if (orthopedic?.capped && orthopedic.limit_amount && orthopedic.limit_amount < THRESHOLDS.ORTHOPEDIC_SUBLIMIT_MIN) {
    return true;
  }

  return false;
}

/**
 * Checks if restoration is present
 */
function hasRestoration(policy: PolicyData): boolean {
  return policy.restoration?.type !== null && policy.restoration?.type !== undefined;
}

/**
 * Checks for minor gaps (non-escalating)
 * These gaps can only downgrade from "Strong" to "Adequate" but never escalate beyond "Meaningful Risk"
 */
function hasMinorGaps(policy: PolicyData): string[] {
  const gaps: string[] = [];
  const c = policy.coverage;
  const coverageDetails = policy.coverage_details;

  // Check consumables exclusion
  const consumablesExcluded =
    coverageDetails?.consumables?.covered === false ||
    policy.exclusions?.major_exclusions?.some((e) => e.toLowerCase().includes("consumable")) ||
    false;

  if (consumablesExcluded) {
    gaps.push("Consumables are excluded, leading to predictable out-of-pocket expenses");
  }

  // Check ambulance cap
  const ambulanceLimit = coverageDetails?.ambulance?.limit_amount || 
                         policy.sub_limits?.icu_charges?.limit_amount; // Some policies list ambulance under ICU
  const ambulanceCapLow = ambulanceLimit !== undefined && ambulanceLimit < THRESHOLDS.AMBULANCE_MIN;

  if (ambulanceCapLow) {
    gaps.push(`Ambulance charges capped at ₹${ambulanceLimit.toLocaleString("en-IN")}, which may be insufficient`);
  }

  // Check diagnostics cap
  const diagnosticsLimit = coverageDetails?.diagnostic_tests?.limit_amount;
  const diagnosticsCapLow = diagnosticsLimit !== undefined && diagnosticsLimit < THRESHOLDS.DIAGNOSTICS_MIN;

  if (diagnosticsCapLow) {
    gaps.push(`Diagnostic tests capped at ₹${diagnosticsLimit.toLocaleString("en-IN")}, which may be insufficient`);
  }

  // Check pharmacy cap
  const pharmacyLimit = coverageDetails?.pharmacy?.limit_amount;
  const pharmacyCapLow = pharmacyLimit !== undefined && pharmacyLimit < THRESHOLDS.PHARMACY_MIN;

  if (pharmacyCapLow) {
    gaps.push(`Pharmacy expenses capped at ₹${pharmacyLimit.toLocaleString("en-IN")}, which may be insufficient`);
  }

  // Check treatment-specific co-pay ≤10% (minor gap, not hard fail)
  const copay = c?.copay;
  const mildCopay =
    copay?.exists &&
    copay.percent !== undefined &&
    copay.percent > 0 &&
    copay.percent <= THRESHOLDS.COPAY_MINOR_THRESHOLD &&
    copay.type === "specific_treatments"; // Only specific treatments, not all claims

  if (mildCopay) {
    gaps.push(`Treatment-specific co-pay of ${copay.percent}% applies to certain procedures`);
  }

  return gaps;
}

/**
 * Main risk meter evaluation function
 * Follows deterministic, ordered logic as specified
 */
export function evaluateRiskMeter(
  policy: PolicyData,
  context: EvaluationContext
): RiskRatingResult {
  const { city, preExistingConditions } = context;
  const isMetro = isMetroCity(city);
  const baseSI = policy.coverage?.base_si?.amount || 0;
  const reasons: string[] = [];

  // STEP 1: HARD FAIL CHECKS (OVERRIDE EVERYTHING)
  
  // Check 1: Sum Insured too low
  const siThreshold = isMetro ? THRESHOLDS.SI_MIN_METRO : THRESHOLDS.SI_MIN_NON_METRO;
  if (baseSI < siThreshold) {
    return {
      rating: "not_suitable",
      label: "Not Suitable",
      color: "text-gray-900 dark:text-gray-100",
      bgColor: "bg-gray-900 dark:bg-gray-100",
      reasons: [`Sum Insured (₹${(baseSI / 100000).toFixed(1)}L) is below minimum threshold (₹${(siThreshold / 100000).toFixed(1)}L) for ${isMetro ? "metro" : "non-metro"} cities`],
      internalScore: 20,
    };
  }

  // Check 2: Pre-existing disease under waiting period
  if (isPreExistingUnderWaitingPeriod(policy, preExistingConditions)) {
    const waitingMonths = policy.waiting_periods?.pre_existing_disease?.months || 0;
    return {
      rating: "high_risk",
      label: "High Risk",
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-600 dark:bg-red-400",
      reasons: [`Pre-existing diseases are still under waiting period (${waitingMonths} months remaining)`],
      internalScore: 35,
    };
  }

  // Check 3: Co-pay > 20% on all claims
  if (hasHighCopayOnAllClaims(policy)) {
    const copayPercent = policy.coverage?.copay?.percent || 0;
    return {
      rating: "high_risk",
      label: "High Risk",
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-600 dark:bg-red-400",
      reasons: [`Co-pay of ${copayPercent}% applies to all claims, significantly increasing out-of-pocket costs`],
      internalScore: 40,
    };
  }

  // Check 4: Room rent capped AND SI too low
  const roomRentSiThreshold = isMetro ? THRESHOLDS.SI_ADEQUATE_METRO : THRESHOLDS.SI_ADEQUATE_NON_METRO;
  if (isRoomRentCapped(policy) && baseSI < roomRentSiThreshold) {
    return {
      rating: "high_risk",
      label: "High Risk",
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-600 dark:bg-red-400",
      reasons: [`Room rent is capped and Sum Insured (₹${(baseSI / 100000).toFixed(1)}L) is below threshold (₹${(roomRentSiThreshold / 100000).toFixed(1)}L) for ${isMetro ? "metro" : "non-metro"} cities`],
      internalScore: 45,
    };
  }

  // STEP 2: CORE ADEQUACY CHECK
  
  const coreChecks: { name: string; passed: boolean; reason?: string }[] = [];

  // Check 1: SI adequacy
  const siAdequacyThreshold = isMetro ? THRESHOLDS.SI_ADEQUATE_METRO : THRESHOLDS.SI_ADEQUATE_NON_METRO;
  const siAdequate = baseSI >= siAdequacyThreshold;
  coreChecks.push({
    name: "Sum Insured",
    passed: siAdequate,
    reason: siAdequate ? undefined : `SI (₹${(baseSI / 100000).toFixed(1)}L) below recommended threshold (₹${(siAdequacyThreshold / 100000).toFixed(1)}L)`,
  });

  // Check 2: Room rent unlimited
  const roomRentUnlimited = !isRoomRentCapped(policy);
  coreChecks.push({
    name: "Room Rent",
    passed: roomRentUnlimited,
    reason: roomRentUnlimited ? undefined : "Room rent is capped, which can cause proportionate deduction on claims",
  });

  // Check 3: No major sub-limits
  const noMajorSublimits = !hasMajorSublimits(policy);
  coreChecks.push({
    name: "Sub-limits",
    passed: noMajorSublimits,
    reason: noMajorSublimits ? undefined : "Major sub-limits present on cardiac, cancer, or joint replacement procedures",
  });

  // Check 4: Restoration if SI < ₹10L
  const restorationRequired = baseSI < THRESHOLDS.SI_ADEQUATE_METRO;
  const hasRestorationBenefit = hasRestoration(policy);
  coreChecks.push({
    name: "Restoration",
    passed: !restorationRequired || hasRestorationBenefit,
    reason: restorationRequired && !hasRestorationBenefit ? "Restoration benefit recommended when SI < ₹10L" : undefined,
  });

  const failedCoreChecks = coreChecks.filter((c) => !c.passed);
  const allCoreChecksPassed = failedCoreChecks.length === 0;

  // STEP 3: MINOR GAPS (NON-ESCALATING)
  const minorGaps = hasMinorGaps(policy);

  // FINAL BAND ASSIGNMENT
  if (!allCoreChecksPassed) {
    // Fail Step 2 (but no hard fail) → Meaningful Risk
    failedCoreChecks.forEach((check) => {
      if (check.reason) reasons.push(check.reason);
    });
    return {
      rating: "meaningful_risk",
      label: "Meaningful Risk",
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-600 dark:bg-orange-400",
      reasons,
      internalScore: 60,
    };
  }

  // All core checks passed
  if (minorGaps.length === 0) {
    // Pass Step 1 + Pass Step 2 + No minor gaps → Strong Protection
    return {
      rating: "strong",
      label: "Strong Protection",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-600 dark:bg-green-400",
      reasons: ["All core adequacy checks passed with no significant gaps"],
      internalScore: 95,
    };
  } else {
    // Pass Step 1 + Pass Step 2 + Minor gaps → Adequate, Watch Gaps
    minorGaps.forEach((gap) => reasons.push(gap));
    return {
      rating: "adequate",
      label: "Adequate, Watch Gaps",
      color: "text-yellow-600 dark:text-yellow-400",
      bgColor: "bg-yellow-600 dark:bg-yellow-400",
      reasons,
      internalScore: 75,
    };
  }
}

