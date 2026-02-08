import type { PolicyData } from "@/types/policy";

export interface ComparisonFeature {
  name: string;
  category: string;
  values: Array<{
    policyId: string;
    value: string | number | null;
    isBest?: boolean;
    isAvailable: boolean;
  }>;
  hasDifferences: boolean;
  description?: string;
}

export interface ComparisonCategory {
  name: string;
  features: ComparisonFeature[];
  keyDifferencesCount: number;
}

/**
 * Analyzes policies to identify key differences and best features
 */
export function analyzeComparison(
  policies: Array<{ policy: PolicyData; id: string; score: number }>
): {
  categories: ComparisonCategory[];
  keyDifferencesTotal: number;
} {
  const categories: ComparisonCategory[] = [];

  // Helper to determine if a value is "best"
  // Returns true only if this value is the unique best, or if tied, only for the first occurrence
  const isBestValue = (
    featureName: string,
    value: any,
    allValues: any[],
    higherIsBetter: boolean = true,
    currentIndex: number
  ): boolean => {
    if (value === null || value === undefined || value === false) return false;
    if (typeof value === "string" && (value.includes("Not") || value.includes("None"))) return false;

    // Extract numeric values for comparison
    const comparableValues = allValues
      .map((v) => {
        if (typeof v === "number") return v;
        if (typeof v === "string") {
          // Extract numbers from strings like "₹1 Cr" or "60 days"
          const match = v.match(/[\d.]+/);
          return match ? parseFloat(match[0]) : 0;
        }
        return 0;
      })
      .filter((v) => v > 0);

    if (comparableValues.length === 0) return false;

    const maxValue = Math.max(...comparableValues);
    const minValue = Math.min(...comparableValues);
    const bestValue = higherIsBetter ? maxValue : minValue;

    // Get numeric value for current item
    let currentNumValue = 0;
    if (typeof value === "number") {
      currentNumValue = value;
    } else if (typeof value === "string") {
      const numValue = parseFloat(value.match(/[\d.]+/)?.[0] || "0");
      if (numValue > 0) {
        currentNumValue = numValue;
      } else {
        // For strings like "unlimited", "any category", etc.
        if (value.toLowerCase().includes("unlimited") || value.toLowerCase().includes("any")) {
          // If this is an "unlimited" value, it's always best, but only mark first occurrence
          const unlimitedIndices = allValues
            .map((v, i) => {
              if (typeof v === "string") {
                const lower = v.toLowerCase();
                return (lower.includes("unlimited") || lower.includes("any")) ? i : -1;
              }
              return -1;
            })
            .filter((i) => i >= 0);
          return unlimitedIndices.length > 0 && unlimitedIndices[0] === currentIndex;
        }
        return false;
      }
    }

    // Check if current value equals the best value
    if (currentNumValue !== bestValue) return false;

    // Find all indices with the best value
    const bestIndices: number[] = [];
    allValues.forEach((v, i) => {
      let numValue = 0;
      if (typeof v === "number") {
        numValue = v;
      } else if (typeof v === "string") {
        const match = v.match(/[\d.]+/);
        numValue = match ? parseFloat(match[0]) : 0;
        // Handle unlimited/any strings
        if (numValue === 0 && (v.toLowerCase().includes("unlimited") || v.toLowerCase().includes("any"))) {
          numValue = higherIsBetter ? Infinity : -Infinity;
        }
      }
      if (numValue === bestValue || (higherIsBetter && numValue === Infinity) || (!higherIsBetter && numValue === -Infinity)) {
        bestIndices.push(i);
      }
    });

    // Only mark as best if this is the ONLY policy with this value
    // OR if tied, only mark the first one (to avoid showing "Best" on all tied policies)
    return bestIndices.length === 1 ? bestIndices[0] === currentIndex : bestIndices[0] === currentIndex;
  };

  // Helper to format feature value
  const formatValue = (value: any, featureName: string): string => {
    if (value === null || value === undefined) return "Not specified";
    if (value === false) return "Not available";
    if (value === true) return "Available";
    if (typeof value === "string") return value;
    if (typeof value === "number") {
      if (featureName.includes("premium")) {
        return `₹${value.toLocaleString("en-IN")}/year`;
      }
      if (featureName.includes("days") || featureName.includes("months")) {
        return `${value} ${featureName.includes("days") ? "days" : "months"}`;
      }
      return value.toLocaleString("en-IN");
    }
    return String(value);
  };

  // Coverage Category
  const coverageFeatures: ComparisonFeature[] = [];

  // Room Rent
  const roomRentValues = policies.map((p) => p.policy.coverage?.room_rent?.display || "Not specified");
  const roomRentBest = roomRentValues.map((v, i) =>
    isBestValue("room_rent", v, roomRentValues, true, i)
  );
  coverageFeatures.push({
    name: "Room rent limit",
    category: "Coverage",
    description: "Room rent limit is the maximum allowed room category and cost of room per day.",
    values: policies.map((p, i) => ({
      policyId: p.id,
      value: p.policy.coverage?.room_rent?.display || "Not specified",
      isBest: roomRentBest[i],
      isAvailable: p.policy.coverage?.room_rent?.unlimited || (p.policy.coverage?.room_rent?.amount || 0) > 0,
    })),
    hasDifferences: new Set(roomRentValues).size > 1,
  });

  // Restoration
  const restorationValues = policies.map((p) => {
    if (p.policy.restoration?.type === "unlimited") {
      return `${p.policy.coverage?.base_si?.display || "N/A"} unlimited times in a year`;
    }
    if (p.policy.restoration?.times_per_year) {
      return `${p.policy.coverage?.base_si?.display || "N/A"} ${p.policy.restoration.times_per_year} time(s) in a year`;
    }
    return "Not available";
  });
  const restorationBest = restorationValues.map((v, i) =>
    isBestValue("restoration", v, restorationValues, true, i)
  );
  coverageFeatures.push({
    name: "Restoration of cover",
    category: "Coverage",
    values: policies.map((p, i) => ({
      policyId: p.id,
      value: restorationValues[i],
      isBest: restorationBest[i],
      isAvailable: p.policy.restoration?.type !== null && p.policy.restoration?.type !== undefined,
    })),
    hasDifferences: new Set(restorationValues).size > 1,
  });

  // Co-pay
  const copayValues = policies.map((p) =>
    p.policy.coverage?.copay?.exists
      ? `${p.policy.coverage.copay.percent || 0}% co-pay`
      : "Full claim paid by insurer"
  );
  coverageFeatures.push({
    name: "Co-pay",
    category: "Coverage",
    values: policies.map((p, i) => ({
      policyId: p.id,
      value: copayValues[i],
      isBest: !p.policy.coverage?.copay?.exists,
      isAvailable: true,
    })),
    hasDifferences: new Set(copayValues).size > 1,
  });

  // Waiting Periods Category
  const waitingPeriodFeatures: ComparisonFeature[] = [];

  // Pre-existing waiting period
  const preExistingWaiting = policies.map((p) => p.policy.waiting_periods?.pre_existing_disease?.months || 0);
  const preExistingBest = preExistingWaiting.map((v, i) =>
    isBestValue("waiting_period", v, preExistingWaiting, false, i)
  );
  waitingPeriodFeatures.push({
    name: "Pre-existing Illness cover",
    category: "Waiting periods",
    values: policies.map((p, i) => {
      const months = p.policy.waiting_periods?.pre_existing_disease?.months || 0;
      let displayText = "";
      if (months === 0) {
        displayText = "Covered from day 1";
      } else if (months < 12) {
        displayText = `Covered after ${months} month${months > 1 ? 's' : ''}`;
      } else {
        const years = Math.floor(months / 12);
        const remainingMonths = months % 12;
        if (remainingMonths === 0) {
          displayText = `Covered after ${years} year${years > 1 ? 's' : ''}`;
        } else {
          displayText = `Covered after ${years} year${years > 1 ? 's' : ''} ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
        }
      }
      return {
        policyId: p.id,
        value: displayText,
        isBest: preExistingBest[i],
        isAvailable: true,
      };
    }),
    hasDifferences: new Set(preExistingWaiting).size > 1,
  });

  // Coverage Details Category
  const coverageDetailsFeatures: ComparisonFeature[] = [];

  // Pre-hospitalization
  const preHospDays = policies.map((p) => p.policy.coverage_details.pre_hospitalization?.days_before_admission || 0);
  const preHospBest = preHospDays.map((v, i) => isBestValue("pre_hosp", v, preHospDays, true, i));
  coverageDetailsFeatures.push({
    name: "Pre-hospitalization coverage",
    category: "Coverage Details",
    values: policies.map((p, i) => ({
      policyId: p.id,
      value: `Covered upto ${p.policy.coverage_details.pre_hospitalization?.days_before_admission || 0} days`,
      isBest: preHospBest[i],
      isAvailable: (p.policy.coverage_details.pre_hospitalization?.days_before_admission || 0) > 0,
    })),
    hasDifferences: new Set(preHospDays).size > 1,
  });

  // Post-hospitalization
  const postHospDays = policies.map((p) => p.policy.coverage_details.post_hospitalization?.days_after_discharge || 0);
  const postHospBest = postHospDays.map((v, i) => isBestValue("post_hosp", v, postHospDays, true, i));
  coverageDetailsFeatures.push({
    name: "Post-hospitalization coverage",
    category: "Coverage Details",
    values: policies.map((p, i) => ({
      policyId: p.id,
      value: `Covered upto ${p.policy.coverage_details.post_hospitalization?.days_after_discharge || 0} days`,
      isBest: postHospBest[i],
      isAvailable: (p.policy.coverage_details.post_hospitalization?.days_after_discharge || 0) > 0,
    })),
    hasDifferences: new Set(postHospDays).size > 1,
  });

  // Day care
  const dayCareValues = policies.map((p) =>
    p.policy.coverage_details.daycare_procedures?.covered
      ? "All day-care treatments are covered up to the sum insured"
      : "Not available"
  );
  coverageDetailsFeatures.push({
    name: "Day care treatment",
    category: "Coverage Details",
    values: policies.map((p, i) => ({
      policyId: p.id,
      value: dayCareValues[i],
      isBest: p.policy.coverage_details.daycare_procedures?.covered || false,
      isAvailable: p.policy.coverage_details.daycare_procedures?.covered || false,
    })),
    hasDifferences: new Set(dayCareValues).size > 1,
  });

  // Domiciliary care
  const domiciliaryValues = policies.map((p) => {
    if (p.policy.coverage_details.domiciliary_care?.covered) {
      return `Covered upto ${p.policy.coverage_details.domiciliary_care.display || "SI limit"}`;
    }
    return "Not available";
  });
  coverageDetailsFeatures.push({
    name: "Hospitalization at home",
    category: "Coverage Details",
    values: policies.map((p, i) => ({
      policyId: p.id,
      value: domiciliaryValues[i],
      isBest: p.policy.coverage_details.domiciliary_care?.covered || false,
      isAvailable: p.policy.coverage_details.domiciliary_care?.covered || false,
    })),
    hasDifferences: new Set(domiciliaryValues).size > 1,
  });

  // Sub-limits Category
  const subLimitFeatures: ComparisonFeature[] = [];

  // Cancer coverage
  const cancerValues = policies.map((p) => p.policy.sub_limits?.cancer?.display || "Not specified");
  const cancerBest = cancerValues.map((v, i) => isBestValue("cancer", v, cancerValues, true, i));
  subLimitFeatures.push({
    name: "Cancer Coverage",
    category: "Sub-limits",
    values: policies.map((p, i) => ({
      policyId: p.id,
      value: cancerValues[i],
      isBest: cancerBest[i],
      isAvailable: !p.policy.sub_limits?.cancer?.capped || (p.policy.sub_limits?.cancer?.limit_amount || 0) > 0,
    })),
    hasDifferences: new Set(cancerValues).size > 1,
  });

  // Cardiac coverage
  const cardiacValues = policies.map((p) => p.policy.sub_limits?.cardiac?.display || "Not specified");
  const cardiacBest = cardiacValues.map((v, i) => isBestValue("cardiac", v, cardiacValues, true, i));
  subLimitFeatures.push({
    name: "Cardiac Coverage",
    category: "Sub-limits",
    values: policies.map((p, i) => ({
      policyId: p.id,
      value: cardiacValues[i],
      isBest: cardiacBest[i],
      isAvailable: !p.policy.sub_limits?.cardiac?.capped || (p.policy.sub_limits?.cardiac?.limit_amount || 0) > 0,
    })),
    hasDifferences: new Set(cardiacValues).size > 1,
  });

  // Riders Category
  const riderFeatures: ComparisonFeature[] = [];

  // Critical Illness
  const criticalIllnessValues = policies.map((p) =>
    p.policy.riders?.critical_illness?.available
      ? `${p.policy.riders.critical_illness.coverage_display || "N/A"} (+${p.policy.riders.critical_illness.base_premium_addition_display || "N/A"})`
      : "Not available"
  );
  riderFeatures.push({
    name: "Critical Illness Rider",
    category: "Riders",
    values: policies.map((p, i) => ({
      policyId: p.id,
      value: criticalIllnessValues[i],
      isBest: p.policy.riders?.critical_illness?.available || false,
      isAvailable: p.policy.riders?.critical_illness?.available || false,
    })),
    hasDifferences: new Set(criticalIllnessValues).size > 1,
  });

  // Network Category
  const networkFeatures: ComparisonFeature[] = [];

  // Network hospitals
  const networkCounts = policies.map((p) => p.policy.network?.hospital_network_count?.total || 0);
  const networkBest = networkCounts.map((v, i) => isBestValue("network", v, networkCounts, true, i));
  networkFeatures.push({
    name: "Cashless hospitals",
    category: "Network",
    values: policies.map((p, i) => ({
      policyId: p.id,
      value: networkCounts[i] > 0
        ? `${networkCounts[i].toLocaleString("en-IN")} cashless hospitals in India`
        : "N/A",
      isBest: networkBest[i],
      isAvailable: networkCounts[i] > 0,
    })),
    hasDifferences: new Set(networkCounts).size > 1,
  });

  // Build categories
  const coverageCategory: ComparisonCategory = {
    name: "Coverage",
    features: coverageFeatures,
    keyDifferencesCount: coverageFeatures.filter((f) => f.hasDifferences).length,
  };

  const waitingCategory: ComparisonCategory = {
    name: "Waiting periods",
    features: waitingPeriodFeatures,
    keyDifferencesCount: waitingPeriodFeatures.filter((f) => f.hasDifferences).length,
  };

  const coverageDetailsCategory: ComparisonCategory = {
    name: "Coverage Details",
    features: coverageDetailsFeatures,
    keyDifferencesCount: coverageDetailsFeatures.filter((f) => f.hasDifferences).length,
  };

  const subLimitCategory: ComparisonCategory = {
    name: "Sub-limits",
    features: subLimitFeatures,
    keyDifferencesCount: subLimitFeatures.filter((f) => f.hasDifferences).length,
  };

  const riderCategory: ComparisonCategory = {
    name: "Riders",
    features: riderFeatures,
    keyDifferencesCount: riderFeatures.filter((f) => f.hasDifferences).length,
  };

  const networkCategory: ComparisonCategory = {
    name: "Network",
    features: networkFeatures,
    keyDifferencesCount: networkFeatures.filter((f) => f.hasDifferences).length,
  };

  const allCategories = [
    coverageCategory,
    waitingCategory,
    coverageDetailsCategory,
    subLimitCategory,
    riderCategory,
    networkCategory,
  ].filter((cat) => cat.features.length > 0);

  const keyDifferencesTotal = allCategories.reduce(
    (sum, cat) => sum + cat.keyDifferencesCount,
    0
  );

  return {
    categories: allCategories,
    keyDifferencesTotal,
  };
}

