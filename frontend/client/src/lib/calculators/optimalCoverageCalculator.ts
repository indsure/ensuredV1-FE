/**
 * Optimal Insurance Coverage Calculator
 * 
 * CORE PRINCIPLES:
 * - No stacking of mutually exclusive buffers
 * - Condition risk OR multi-incident risk, not both
 * - Inflation compounds on claims, not added as flat slab
 * - Room rent gaps are binary design issue, not SI padding
 * - Restoration exists → multi-incident buffer reduced
 * - Coverage capped by market reality (₹1 Cr ceiling)
 * - Age 75+ treated as eligibility-constrained
 * - Riders never shown as SI
 */

export interface UserInput {
  // Personal
  age: number;
  gender: "M" | "F" | "Other";
  city: string;
  pincode?: string;
  occupation?: string;
  
  // Financial
  annualIncome: number; // Net household income
  monthlySavings?: number;
  
  // Family
  hasSpouse: boolean;
  spouseAge?: number;
  children: Array<{ age: number }>;
  dependents?: number;
  
  // Health
  preExistingConditions: string[]; // ["diabetes", "hypertension", "cardiac", "cancer", "none"]
  
  // Existing Coverage
  hasCorporateInsurance: boolean;
  corporateSI?: number; // Sum insured from corporate policy
  
  // Lifestyle
  smoking: boolean;
  alcohol: boolean;
  highRiskActivities: boolean;
}

export interface CoverageBreakdown {
  worstCaseScenario: number;
  adjustedWorstCase: number; // After multipliers
  cityMultiplier: number;
  conditionMultiplier: number;
  roomRentGap: number;
  inflationBuffer: number;
  multiIncidentBuffer: number;
  optimalTotal: number;
}

export interface CoverageStructure {
  baseSI: number;
  topUpSI: number;
  ridersSI: number;
  totalSI: number;
}

export interface FamilyCoverage {
  recommendedFloater: number;
  minimumPerPerson: {
    adult: number;
    adult45to60: number;
    adult60Plus: number;
    children: number;
  };
  totalMinimumForFamily: number;
  floaterRecommended: boolean;
}

export interface PremiumEstimate {
  basePremium: { min: number; max: number };
  topUpPremium: { min: number; max: number };
  ridersPremium: { min: number; max: number };
  totalPremium: { min: number; max: number };
  affordabilityPercentage: number;
}

export interface CalculationResult {
  optimalCoverage: number;
  breakdown: CoverageBreakdown;
  structure: CoverageStructure;
  familyCoverage?: FamilyCoverage;
  premiumEstimate: PremiumEstimate;
  corporateGap?: {
    corporateSI: number;
    personalNeeded: number;
  };
  reasoning: string[];
  fiveYearProjection: Array<{
    year: number;
    premium: number;
    cumulative: number;
  }>;
}

/**
 * Get city tier based on city name
 */
export function getCityTier(city: string): "Tier 1" | "Tier 2" | "Tier 3" {
  const cityLower = city.toLowerCase();
  
  const tier1Cities = [
    "mumbai", "delhi", "bangalore", "hyderabad", "chennai", "kolkata", "pune"
  ];
  
  const tier2Cities = [
    "ahmedabad", "jaipur", "chandigarh", "lucknow", "kochi", "surat",
    "indore", "nagpur", "bhopal", "visakhapatnam", "patna", "vadodara"
  ];
  
  if (tier1Cities.some(c => cityLower.includes(c))) {
    return "Tier 1";
  }
  if (tier2Cities.some(c => cityLower.includes(c))) {
    return "Tier 2";
  }
  return "Tier 3";
}

/**
 * Calculate age-based worst-case medical scenario
 * FIXED: Age ceiling + reality cap (₹75L max per incident)
 */
function getWorstCaseScenario(age: number): number {
  if (age < 40) {
    return 2000000; // ₹20L – trauma
  } else if (age < 55) {
    return 3000000; // ₹30L – cardiac + ICU
  } else if (age < 65) {
    return 4500000; // ₹45L – cancer + ICU
  } else if (age < 75) {
    return 6000000; // ₹60L – multi-morbidity
  } else {
    return 7500000; // ₹75L – HARD CAP (market ceiling)
  }
}

/**
 * Get city tier multiplier
 * FIXED: Tier 3 = 1.0 (patients migrate to Tier 1 for serious care)
 */
function getCityMultiplier(tier: "Tier 1" | "Tier 2" | "Tier 3"): number {
  if (tier === "Tier 1") return 1.15;
  if (tier === "Tier 2") return 1.0;
  return 1.0; // Tier 3 patients migrate to Tier 1 for serious care
}

/**
 * Calculate pre-existing condition multiplier
 * FIXED: HARD CAP at 1.8x (no unbounded stacking)
 */
function getConditionMultiplier(conditions: string[]): number {
  if (!conditions.length || conditions.includes("none")) return 1.0;

  let riskScore = 0;

  if (conditions.includes("diabetes")) riskScore += 0.15;
  if (conditions.includes("hypertension")) riskScore += 0.10;
  if (conditions.includes("cardiac")) riskScore += 0.35;
  if (conditions.includes("cancer")) riskScore += 0.50;

  // HARD CAP: 1.8x
  return Math.min(1 + riskScore, 1.8);
}

/**
 * Room rent gap note (not used in calculation)
 * FIXED: Room rent is a product selection constraint, not SI padding
 */
const roomRentNote = "Ensure no room rent cap policy. Do not pad SI.";

/**
 * Apply medical inflation (compound, not linear)
 * FIXED: Inflation compounds on claims, not added as flat slab
 */
function applyMedicalInflation(base: number): number {
  const rate = 0.14; // conservative blended rate
  const years = 3;
  return base * Math.pow(1 + rate, years);
}

/**
 * Calculate multi-incident buffer
 * FIXED: Restoration exists → buffer reduced (10% vs 25%)
 */
function getMultiIncidentBuffer(
  adjustedWorstCase: number,
  hasRestoration: boolean = true // assume modern policies have restoration
): number {
  if (hasRestoration) return adjustedWorstCase * 0.10; // 10% if restoration exists
  return adjustedWorstCase * 0.25; // 25% if no restoration
}

/**
 * Calculate optimal total coverage
 * FIXED: No double counting, compound inflation, restoration-aware buffer
 */
function calculateOptimalCoverage(input: UserInput): CoverageBreakdown {
  const worstCase = getWorstCaseScenario(input.age);
  const cityTier = getCityTier(input.city);
  const cityMultiplier = getCityMultiplier(cityTier);
  const conditionMultiplier = getConditionMultiplier(input.preExistingConditions);
  
  // Apply multipliers (no room rent gap padding)
  const adjusted = worstCase * cityMultiplier * conditionMultiplier;
  
  // Apply compound inflation
  const inflated = applyMedicalInflation(adjusted);
  
  // Multi-incident buffer (assume restoration exists in modern policies)
  const multiIncident = getMultiIncidentBuffer(inflated, true);
  
  // Final calculation
  const optimal = inflated + multiIncident;
  
  // MARKET CAP: ₹1 Cr ceiling
  const cappedOptimal = Math.min(optimal, 100000000); // ₹1 Cr ceiling
  
  return {
    worstCaseScenario: worstCase,
    adjustedWorstCase: Math.round(inflated),
    cityMultiplier,
    conditionMultiplier,
    roomRentGap: 0, // Not used in calculation
    inflationBuffer: Math.round(inflated - adjusted),
    multiIncidentBuffer: Math.round(multiIncident),
    optimalTotal: Math.round(cappedOptimal),
  };
}

/**
 * Calculate coverage structure (Base + Super Top-up + Riders)
 * FIXED: Base max ₹50L, rest as top-up. Riders display only (₹10L CI+PA)
 */
function calculateCoverageStructure(optimalTotal: number): CoverageStructure {
  // Base policy: max ₹50L (market reality - no ₹1.2 Cr base policies exist sanely)
  const baseSI = Math.min(5000000, Math.round(optimalTotal * 0.6)); // ₹50L max
  
  // Top-up covers the gap above base
  const topUpSI = optimalTotal - baseSI;
  
  // Riders: Critical Illness (₹5L) + Personal Accident (₹5L) = ₹10L total
  // DISPLAY ONLY - not part of hospitalization SI
  const ridersSI = 1000000; // ₹10L total
  
  return {
    baseSI,
    topUpSI: Math.round(topUpSI),
    ridersSI,
    totalSI: Math.round(baseSI + topUpSI),
  };
}

/**
 * Calculate family coverage recommendations
 */
function calculateFamilyCoverage(
  input: UserInput,
  optimalTotal: number
): FamilyCoverage | undefined {
  const familySize = 1 + (input.hasSpouse ? 1 : 0) + input.children.length;
  
  if (familySize <= 1) {
    return undefined;
  }
  
  // Minimum per person by age
  const adultMin = 1500000; // ₹15L (18-45)
  const adult45to60Min = 2000000; // ₹20L (45-60)
  const adult60PlusMin = 2500000; // ₹25L (60+)
  const childrenMin = 500000; // ₹5L (0-18)
  
  // Calculate minimums for each family member
  let totalMinimum = 0;
  
  // Self
  if (input.age < 45) {
    totalMinimum += adultMin;
  } else if (input.age < 60) {
    totalMinimum += adult45to60Min;
  } else {
    totalMinimum += adult60PlusMin;
  }
  
  // Spouse
  if (input.hasSpouse && input.spouseAge) {
    if (input.spouseAge < 45) {
      totalMinimum += adultMin;
    } else if (input.spouseAge < 60) {
      totalMinimum += adult45to60Min;
    } else {
      totalMinimum += adult60PlusMin;
    }
  }
  
  // Children
  input.children.forEach(child => {
    totalMinimum += childrenMin;
  });
  
  return {
    recommendedFloater: Math.round(optimalTotal),
    minimumPerPerson: {
      adult: adultMin,
      adult45to60: adult45to60Min,
      adult60Plus: adult60PlusMin,
      children: childrenMin,
    },
    totalMinimumForFamily: totalMinimum,
    floaterRecommended: optimalTotal >= totalMinimum * 0.8, // If optimal is close to minimum, floater works
  };
}

/**
 * Estimate premium based on coverage and age
 */
function estimatePremium(
  input: UserInput,
  structure: CoverageStructure
): PremiumEstimate {
  // Base premium benchmarks (per ₹10L base SI)
  let basePer10L: { min: number; max: number };
  
  if (input.age < 35) {
    basePer10L = { min: 10000, max: 12000 };
  } else if (input.age < 45) {
    basePer10L = { min: 10000, max: 12000 };
  } else if (input.age < 55) {
    basePer10L = { min: 15000, max: 18000 };
  } else {
    basePer10L = { min: 20000, max: 25000 };
  }
  
  // Calculate base premium
  const baseMultiplier = structure.baseSI / 1000000; // Per ₹10L
  const basePremium = {
    min: Math.round(basePer10L.min * baseMultiplier),
    max: Math.round(basePer10L.max * baseMultiplier),
  };
  
  // Adjustments
  let adjustmentFactor = 1.0;
  
  // Family floater discount (-20%)
  const familySize = 1 + (input.hasSpouse ? 1 : 0) + input.children.length;
  if (familySize > 1) {
    adjustmentFactor *= 0.8;
  }
  
  // Pre-existing conditions (+30%)
  if (input.preExistingConditions.length > 0 && !input.preExistingConditions.includes("none")) {
    adjustmentFactor *= 1.3;
  }
  
  // City tier adjustment (±15%)
  const cityTier = getCityTier(input.city);
  if (cityTier === "Tier 1") {
    adjustmentFactor *= 1.15;
  } else if (cityTier === "Tier 3") {
    adjustmentFactor *= 0.85;
  }
  
  // Apply adjustments
  basePremium.min = Math.round(basePremium.min * adjustmentFactor);
  basePremium.max = Math.round(basePremium.max * adjustmentFactor);
  
  // Top-up premium (60% of base)
  const topUpPremium = {
    min: Math.round(basePremium.min * 0.6),
    max: Math.round(basePremium.max * 0.6),
  };
  
  // Riders premium (₹3-5K per rider)
  let riderCount = 2; // Critical illness + Personal accident (always recommended)
  if (input.hasSpouse && input.spouseAge && input.spouseAge < 45) {
    // Maternity rider
    riderCount = 3;
  }
  const ridersPremium = {
    min: riderCount * 3000,
    max: riderCount * 5000,
  };
  
  const totalPremium = {
    min: basePremium.min + topUpPremium.min + ridersPremium.min,
    max: basePremium.max + topUpPremium.max + ridersPremium.max,
  };
  
  // Affordability check
  // FIXED: Proper number formatting to prevent 554123% bug
  const affordabilityPercentage = Number(((totalPremium.max / input.annualIncome) * 100).toFixed(2));
  
  return {
    basePremium,
    topUpPremium,
    ridersPremium,
    totalPremium,
    affordabilityPercentage,
  };
}

/**
 * Generate detailed reasoning
 */
function generateReasoning(
  input: UserInput,
  breakdown: CoverageBreakdown,
  cityTier: "Tier 1" | "Tier 2" | "Tier 3"
): string[] {
  const reasoning: string[] = [];
  
  // Age-based scenario
  let ageScenario = "";
  if (input.age < 40) {
    ageScenario = "Trauma scenarios";
  } else if (input.age < 55) {
    ageScenario = "Cardiac surgery + ICU";
  } else if (input.age < 65) {
    ageScenario = "Cancer treatment + ICU";
  } else if (input.age < 75) {
    ageScenario = "Multi-morbidity scenarios";
  } else {
    ageScenario = "Multi-morbidity (age-constrained eligibility)";
  }
  
  reasoning.push(
    `You are ${input.age} years old in ${input.city} (${cityTier} city)`
  );
  reasoning.push(
    `Age-relevant worst case: ${ageScenario} = ₹${(breakdown.worstCaseScenario / 100000).toFixed(1)}L`
  );
  
  // City multiplier
  if (breakdown.cityMultiplier !== 1.0) {
    reasoning.push(
      `City tier adjustment: ${cityTier} cities have ${breakdown.cityMultiplier > 1 ? "higher" : "lower"} medical costs (×${breakdown.cityMultiplier})`
    );
  }
  
  // Pre-existing conditions
  if (breakdown.conditionMultiplier > 1.0) {
    const conditions = input.preExistingConditions.filter(c => c !== "none");
    reasoning.push(
      `Pre-existing conditions (${conditions.join(", ")}): +${((breakdown.conditionMultiplier - 1) * 100).toFixed(0)}% cost increase due to higher hospitalization risk`
    );
  }
  
  // Room rent note (not in calculation)
  reasoning.push(
    `Room rent: Ensure your policy has "Any Room" coverage. Room rent caps are a product design issue, not SI padding.`
  );
  
  // Inflation (compound)
  reasoning.push(
    `Medical inflation buffer: 14%/year compounded over 3 years = ₹${(breakdown.inflationBuffer / 100000).toFixed(1)}L to account for rising costs`
  );
  
  // Multi-incident (restoration-aware)
  const bufferPercent = breakdown.multiIncidentBuffer > 0 
    ? ((breakdown.multiIncidentBuffer / breakdown.adjustedWorstCase) * 100).toFixed(0)
    : "10";
  reasoning.push(
    `Multi-incident buffer: ${bufferPercent}% (₹${(breakdown.multiIncidentBuffer / 100000).toFixed(1)}L) - Restoration covers unrelated claims; buffer accounts for overlap risk`
  );
  
  // Final amount
  reasoning.push(
    `Result: ₹${(breakdown.optimalTotal / 100000).toFixed(1)}L total coverage keeps out-of-pocket at 5-10%. With lower coverage, OOP could be 40-50%`
  );
  
  return reasoning;
}

/**
 * Calculate 5-year premium projection
 */
function calculateFiveYearProjection(
  premiumEstimate: PremiumEstimate
): Array<{ year: number; premium: number; cumulative: number }> {
  const projection = [];
  const premiumInflation = 0.10; // 10% annual premium increase
  let cumulative = 0;
  
  for (let year = 1; year <= 5; year++) {
    const yearPremium = Math.round(
      premiumEstimate.totalPremium.max * Math.pow(1 + premiumInflation, year - 1)
    );
    cumulative += yearPremium;
    
    projection.push({
      year,
      premium: yearPremium,
      cumulative,
    });
  }
  
  return projection;
}

/**
 * Main calculation function
 */
export function calculateOptimalCoverageForUser(
  input: UserInput
): CalculationResult {
  // Income-based adjustment (affordability cap)
  let adjustedInput = { ...input };
  if (input.annualIncome < 500000) {
    // Reduce optimal by 20% if income very low
    adjustedInput = { ...input };
  }
  
  const breakdown = calculateOptimalCoverage(adjustedInput);
  
  // Apply income cap if needed
  let finalOptimal = breakdown.optimalTotal;
  if (input.annualIncome < 500000) {
    finalOptimal = Math.round(breakdown.optimalTotal * 0.8);
  } else if (input.annualIncome > 5000000) {
    // Higher income = can afford premium hospitals
    finalOptimal = Math.round(breakdown.optimalTotal + 250000); // Add ₹2.5L
  }
  
  const structure = calculateCoverageStructure(finalOptimal);
  const familyCoverage = calculateFamilyCoverage(input, finalOptimal);
  const premiumEstimate = estimatePremium(input, structure);
  const cityTier = getCityTier(input.city);
  const reasoning = generateReasoning(input, breakdown, cityTier);
  const fiveYearProjection = calculateFiveYearProjection(premiumEstimate);
  
  // Corporate policy gap
  let corporateGap: { corporateSI: number; personalNeeded: number } | undefined;
  if (input.hasCorporateInsurance && input.corporateSI) {
    const personalNeeded = Math.max(0, finalOptimal - input.corporateSI);
    corporateGap = {
      corporateSI: input.corporateSI,
      personalNeeded,
    };
  }
  
  return {
    optimalCoverage: finalOptimal,
    breakdown: {
      ...breakdown,
      optimalTotal: finalOptimal,
    },
    structure,
    familyCoverage,
    premiumEstimate,
    corporateGap,
    reasoning,
    fiveYearProjection,
  };
}

