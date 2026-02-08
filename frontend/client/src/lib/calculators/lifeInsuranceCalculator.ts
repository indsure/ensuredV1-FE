/**
 * Life Insurance Calculator
 * Calculates exact sum assured needed based on user's real situation
 */

export interface LifeInsuranceInput {
  // Basic Information
  age: number;
  gender: "Male" | "Female";
  city: string;
  state: string;

  // Financial Profile
  annualIncome: number; // in rupees
  savings: number; // in rupees

  // Dependent Family
  maritalStatus: "Single" | "Married";
  childrenCount: number;
  youngestChildAge: number;
  educationType: "Public" | "Private" | "International";

  // Outstanding Loans
  homeLoan: number;
  carLoan: number;
  otherLoans: number;
  hasExistingInsurance: boolean;
  existingInsuranceAmount: number;

  // Future Goals / Dependents
  spouseAge: number;
  spouseIncome: number;
  desiredRetirementAge: number;
  legacyGoals: number;
}

export interface LifeInsuranceResult {
  recommendedSumAssured: number;
  monthlyPremiumEstimate: number;
  annualPremiumEstimate: number;
  breakdown: {
    immediateDebt: number;
    educationCost: number;
    livingExpenses: number;
    emergencyBuffer: number;
    legacyGoals: number;
    totalNeed: number;
    existingResources: number;
    finalRecommendation: number;
  };
  scenarios: {
    conservative: {
      sumAssured: number;
      monthlyPremium: number;
      annualPremium: number;
      coverage: string;
    };
    recommended: {
      sumAssured: number;
      monthlyPremium: number;
      annualPremium: number;
      coverage: string;
    };
    comprehensive: {
      sumAssured: number;
      monthlyPremium: number;
      annualPremium: number;
      coverage: string;
    };
  };
}

function calculateEducationCost(
  educationType: "Public" | "Private" | "International",
  youngestAge: number,
  inflationRate: number = 0.05
): number {
  // Base costs (in rupees) - per child, total K-12 + university
  const baseCosts = {
    Public: 400000, // ₹3L-5L, use 4L as average
    Private: 2000000, // ₹15L-25L, use 20L as average
    International: 4500000, // ₹30L-60L, use 45L as average
  };

  return baseCosts[educationType];
  // Note: Inflation is applied separately in main calculation based on years to enrollment
}

function estimatePremiumRate(
  age: number,
  gender: "Male" | "Female",
  city: string
): number {
  // Premium per ₹1L per month (in rupees)
  // Standard rates for non-smoker, good health
  if (age >= 30 && age < 35) {
    return 42; // ₹40-45 per ₹1L/month
  } else if (age >= 35 && age < 40) {
    return 50; // ₹45-55 per ₹1L/month
  } else if (age >= 40 && age < 45) {
    return 70; // ₹60-80 per ₹1L/month
  } else if (age >= 45 && age < 50) {
    return 125; // ₹100-150 per ₹1L/month
  } else if (age >= 50 && age < 55) {
    return 180; // ₹150-200 per ₹1L/month
  } else {
    return 250; // Higher for older ages
  }
}

function roundToNearest25L(amount: number): number {
  // Round to nearest ₹25L increment
  const inLakhs = amount / 100000;
  const rounded = Math.ceil(inLakhs / 25) * 25;
  return rounded * 100000;
}

export function calculateLifeInsuranceNeed(
  input: LifeInsuranceInput
): LifeInsuranceResult {
  // STEP 1: Calculate total family need

  // A. Immediate Debt Repayment
  const immediateDebt = input.homeLoan + input.carLoan + input.otherLoans;

  // B. Children's Education Cost
  const yearsToEnrollment = Math.max(0, 18 - input.youngestChildAge);
  const educationCostPerChild = calculateEducationCost(
    input.educationType,
    input.youngestChildAge,
    0.05 // 5% inflation
  );
  // Apply inflation for years until enrollment
  const educationInflationMultiplier = Math.pow(1.05, yearsToEnrollment);
  const adjustedEducationCost = (educationCostPerChild * input.childrenCount) * educationInflationMultiplier;

  // C. Annual Living Expense
  const annualExpense = input.annualIncome * 0.6; // 60% of income post-death
  const monthlyExpense = annualExpense / 12;

  // D. Dependency Years
  const yearsToSpouseRetirement = Math.max(0, input.desiredRetirementAge - input.spouseAge);
  const yearsUntilChild23 = input.childrenCount > 0 
    ? Math.max(0, 23 - input.youngestChildAge)
    : 0;
  const dependencyYears = Math.max(yearsToSpouseRetirement, yearsUntilChild23);

  // E. Living Corpus
  // Dependency adjustment: 1.0 if children present, 0.85 if no children
  const dependencyAdjustment = input.childrenCount > 0 ? 1.0 : 0.85;
  const livingCorpus = annualExpense * dependencyYears * dependencyAdjustment;
  
  // Apply inflation
  const inflationMultiplier = Math.pow(1.05, dependencyYears / 2);
  const adjustedLivingCorpus = livingCorpus * inflationMultiplier;

  // F. Emergency Buffer
  const sixMonthsExpense = monthlyExpense * 6;
  const emergencyBuffer = Math.max(0, sixMonthsExpense - input.savings);

  // G. Legacy (capped at 20% of Total Need before legacy)
  const totalNeedPreLegacy = immediateDebt + adjustedEducationCost + adjustedLivingCorpus + emergencyBuffer;
  const legacyCap = totalNeedPreLegacy * 0.2;
  const legacy = Math.min(input.legacyGoals, legacyCap);

  // H. Total Need Calculation
  const totalNeed = immediateDebt + adjustedEducationCost + adjustedLivingCorpus + emergencyBuffer + legacy;

  // STEP 2: Adjust for existing savings & insurance
  const existingInsuranceAmount = input.hasExistingInsurance
    ? input.existingInsuranceAmount
    : 0;
  const availableBuffer = input.savings + existingInsuranceAmount;

  const finalNeed = Math.max(0, totalNeed - availableBuffer);

  // STEP 3: Normalize to realistic term life amounts (max +15%)
  const baseSumAssured = roundToNearest25L(finalNeed);
  const maxSumAssured = roundToNearest25L(finalNeed * 1.15);
  const recommendedSumAssured = Math.min(baseSumAssured, maxSumAssured);

  // STEP 4: Estimate Monthly Premium
  const premiumPer1LPerMonth = estimatePremiumRate(input.age, input.gender, input.city);
  const monthlyPremium = (recommendedSumAssured / 100000) * premiumPer1LPerMonth;
  const annualPremium = monthlyPremium * 12;

  // STEP 5: Generate breakdown
  const breakdown = {
    immediateDebt,
    educationCost: adjustedEducationCost,
    livingExpenses: adjustedLivingCorpus,
    emergencyBuffer,
    legacyGoals: legacy,
    totalNeed,
    existingResources: availableBuffer,
    finalRecommendation: recommendedSumAssured,
  };

  // STEP 6: Generate scenarios
  const scenarios = {
    conservative: {
      sumAssured: roundToNearest25L(recommendedSumAssured * 0.8),
      monthlyPremium: monthlyPremium * 0.75,
      annualPremium: (monthlyPremium * 0.75) * 12,
      coverage: "Covers basic needs, higher family burden",
    },
    recommended: {
      sumAssured: recommendedSumAssured,
      monthlyPremium,
      annualPremium,
      coverage: "Covers all major needs, balanced",
    },
    comprehensive: {
      sumAssured: roundToNearest25L(recommendedSumAssured * 1.3),
      monthlyPremium: monthlyPremium * 1.25,
      annualPremium: (monthlyPremium * 1.25) * 12,
      coverage: "Covers all needs + extra security, higher cost",
    },
  };

  return {
    recommendedSumAssured,
    monthlyPremiumEstimate: monthlyPremium,
    annualPremiumEstimate: annualPremium,
    breakdown,
    scenarios,
  };
}
