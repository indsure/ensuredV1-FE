/**
 * Life Insurance Plans Data
 * Pre-populated comparison data for popular term life insurance plans in India
 */

export interface LifeInsurancePlan {
  id: string;
  name: string;
  insurer: string;
  logo?: string;
  rating: number; // 1-5 stars
  
  // Premiums (varies by sum assured and age)
  getMonthlyPremium: (sumAssured: number, age: number) => number;
  getAnnualPremium: (sumAssured: number, age: number) => number;
  
  // Features
  sumAssuredRange: { min: number; max: number };
  termLengths: number[]; // Available term lengths in years
  claimSettlementRatio: number; // Percentage
  averageClaimSettlementTime: string; // e.g., "15-20 days"
  riders: {
    adb: { included: boolean; costRange: string };
    ci: { included: boolean; costRange: string };
    wop: { included: boolean; costRange: string };
  };
  nonMedicalLimit: number; // Up to this sum assured, no medical required
  policyholderReviews: number; // 1-5 stars
  claimDenialRate: number; // Percentage
  conversionOption: boolean;
  conversionAgeLimit?: number;
}

// Premium calculation helper
function calculatePremium(
  baseRate: number, // per ₹1L per month
  sumAssured: number,
  age: number
): number {
  const inLakhs = sumAssured / 100000;
  
  // Age multiplier (premiums increase with age)
  let ageMultiplier = 1.0;
  if (age >= 30 && age < 35) ageMultiplier = 1.0;
  else if (age >= 35 && age < 40) ageMultiplier = 1.2;
  else if (age >= 40 && age < 45) ageMultiplier = 1.6;
  else if (age >= 45 && age < 50) ageMultiplier = 2.5;
  else if (age >= 50 && age < 55) ageMultiplier = 3.5;
  else ageMultiplier = 4.5;
  
  return Math.round(baseRate * inLakhs * ageMultiplier);
}

export const LIFE_INSURANCE_PLANS: LifeInsurancePlan[] = [
  {
    id: "hdfc-smartterm",
    name: "HDFC Life SmartTerm",
    insurer: "HDFC Life",
    rating: 4.5,
    getMonthlyPremium: (sumAssured, age) => calculatePremium(42, sumAssured, age),
    getAnnualPremium: (sumAssured, age) => calculatePremium(42, sumAssured, age) * 12,
    sumAssuredRange: { min: 10000000, max: 500000000 }, // ₹1cr to ₹50cr
    termLengths: [10, 20, 30],
    claimSettlementRatio: 99,
    averageClaimSettlementTime: "15-20 days",
    riders: {
      adb: { included: false, costRange: "₹150-300/month" },
      ci: { included: false, costRange: "₹600-1200/month" },
      wop: { included: false, costRange: "₹300-600/month" },
    },
    nonMedicalLimit: 5000000, // ₹50L
    policyholderReviews: 4.5,
    claimDenialRate: 1,
    conversionOption: true,
    conversionAgeLimit: 60,
  },
  {
    id: "icici-term",
    name: "ICICI Prudential Term",
    insurer: "ICICI Prudential",
    rating: 4.3,
    getMonthlyPremium: (sumAssured, age) => calculatePremium(44, sumAssured, age),
    getAnnualPremium: (sumAssured, age) => calculatePremium(44, sumAssured, age) * 12,
    sumAssuredRange: { min: 2500000, max: 100000000 }, // ₹25L to ₹10cr
    termLengths: [10, 15, 20, 25, 30, 35, 40],
    claimSettlementRatio: 98,
    averageClaimSettlementTime: "18-25 days",
    riders: {
      adb: { included: true, costRange: "₹100-200/month" },
      ci: { included: false, costRange: "₹500-1000/month" },
      wop: { included: false, costRange: "₹400-800/month" },
    },
    nonMedicalLimit: 7500000, // ₹75L
    policyholderReviews: 4.3,
    claimDenialRate: 2,
    conversionOption: true,
    conversionAgeLimit: 65,
  },
  {
    id: "religare-term",
    name: "Religare Term Life",
    insurer: "Religare",
    rating: 3.8,
    getMonthlyPremium: (sumAssured, age) => calculatePremium(41, sumAssured, age),
    getAnnualPremium: (sumAssured, age) => calculatePremium(41, sumAssured, age) * 12,
    sumAssuredRange: { min: 5000000, max: 20000000 }, // ₹50L to ₹2cr
    termLengths: [5, 10, 15, 20, 25, 30],
    claimSettlementRatio: 95,
    averageClaimSettlementTime: "20-30 days",
    riders: {
      adb: { included: false, costRange: "₹200-400/month" },
      ci: { included: false, costRange: "₹700-1400/month" },
      wop: { included: false, costRange: "₹500-1000/month" },
    },
    nonMedicalLimit: 2500000, // ₹25L
    policyholderReviews: 3.8,
    claimDenialRate: 5,
    conversionOption: false,
  },
  {
    id: "lic-term",
    name: "LIC Term Plan",
    insurer: "LIC",
    rating: 3.9,
    getMonthlyPremium: (sumAssured, age) => calculatePremium(38, sumAssured, age),
    getAnnualPremium: (sumAssured, age) => calculatePremium(38, sumAssured, age) * 12,
    sumAssuredRange: { min: 2500000, max: 10000000 }, // ₹25L to ₹1cr
    termLengths: [15, 20, 25, 30, 35, 40],
    claimSettlementRatio: 92,
    averageClaimSettlementTime: "30-45 days",
    riders: {
      adb: { included: false, costRange: "₹100-150/month" },
      ci: { included: false, costRange: "₹400-800/month" },
      wop: { included: false, costRange: "₹300-600/month" },
    },
    nonMedicalLimit: 0, // Medical required for ₹50L+
    policyholderReviews: 3.9,
    claimDenialRate: 8,
    conversionOption: false,
  },
  {
    id: "canara-term",
    name: "Canara HSBC Term",
    insurer: "Canara HSBC",
    rating: 4.0,
    getMonthlyPremium: (sumAssured, age) => calculatePremium(40, sumAssured, age),
    getAnnualPremium: (sumAssured, age) => calculatePremium(40, sumAssured, age) * 12,
    sumAssuredRange: { min: 5000000, max: 50000000 }, // ₹50L to ₹5cr
    termLengths: [10, 15, 20, 25, 30],
    claimSettlementRatio: 94,
    averageClaimSettlementTime: "25-35 days",
    riders: {
      adb: { included: false, costRange: "₹150-250/month" },
      ci: { included: false, costRange: "₹550-1100/month" },
      wop: { included: false, costRange: "₹400-800/month" },
    },
    nonMedicalLimit: 3000000, // ₹30L
    policyholderReviews: 4.0,
    claimDenialRate: 6,
    conversionOption: false,
  },
];

export function getRecommendedPlan(
  sumAssured: number,
  age: number
): { plan: LifeInsurancePlan; reason: string } {
  // Filter plans that support the sum assured
  const eligiblePlans = LIFE_INSURANCE_PLANS.filter(
    (plan) =>
      sumAssured >= plan.sumAssuredRange.min && sumAssured <= plan.sumAssuredRange.max
  );

  if (eligiblePlans.length === 0) {
    // Fallback to first plan if none eligible
    return {
      plan: LIFE_INSURANCE_PLANS[0],
      reason: "Default recommendation",
    };
  }

  // Score each plan based on multiple factors
  const scoredPlans = eligiblePlans.map((plan) => {
    let score = 0;

    // Premium (lower is better) - 30% weight
    const premium = plan.getMonthlyPremium(sumAssured, age);
    const minPremium = Math.min(...eligiblePlans.map((p) => p.getMonthlyPremium(sumAssured, age)));
    const maxPremium = Math.max(...eligiblePlans.map((p) => p.getMonthlyPremium(sumAssured, age)));
    const premiumScore = 30 * (1 - (premium - minPremium) / (maxPremium - minPremium || 1));
    score += premiumScore;

    // Claim settlement ratio (higher is better) - 35% weight
    score += 35 * (plan.claimSettlementRatio / 100);

    // Claim denial rate (lower is better) - 20% weight
    score += 20 * (1 - plan.claimDenialRate / 10);

    // Policyholder reviews - 10% weight
    score += 10 * (plan.policyholderReviews / 5);

    // Conversion option - 5% weight
    if (plan.conversionOption) score += 5;

    return { plan, score };
  });

  // Sort by score descending
  scoredPlans.sort((a, b) => b.score - a.score);

  const winner = scoredPlans[0].plan;
  let reason = "Best overall balance of premium, reliability, and features.";

  if (winner.claimSettlementRatio >= 98) {
    reason = "Highest claim settlement ratio with competitive premium.";
  } else if (winner.getMonthlyPremium(sumAssured, age) <= Math.min(...eligiblePlans.map((p) => p.getMonthlyPremium(sumAssured, age)) * 1.1)) {
    reason = "Competitive premium with excellent reliability.";
  }

  return { plan: winner, reason };
}
