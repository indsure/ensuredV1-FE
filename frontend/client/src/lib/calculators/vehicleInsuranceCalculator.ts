/**
 * Vehicle Insurance Calculator
 * Calculates accident costs, NCB impact, and optimal claim decisions
 */

export interface VehicleInsuranceInput {
  // Vehicle Details
  vehicleMake: string;
  vehicleModel: string;
  yearOfPurchase: number;
  currentIDV: number; // Insured Declared Value
  deductible: number; // Total deductible (compulsory + voluntary)
  
  // Current Policy
  currentNCB: number; // 0, 10, 20, 30, 40, 50 (percentage)
  annualPremium: number;
  coverageType: "Third-Party" | "Comprehensive";
  
  // Accident Scenario
  accidentDamage: number;
  faultStatus: "Your fault (100%)" | "Shared (50%)" | "Not your fault (0%)";
  
  // Add-ons
  hasZeroDepreciation: boolean;
  hasEngineProtection: boolean;
  hasRoadsideAssistance: boolean;
  hasNCBProtection: boolean;
}

export interface VehicleInsuranceResult {
  // Cost Breakdown
  outOfPocketCost: number;
  insurerPays: number;
  depreciationAmount: number;
  
  // NCB Impact
  ncbLoss: number; // Total NCB loss over 5 years if claim is made
  ncbYearlyBreakdown: Array<{ year: number; premium: number; ncb: number; savings: number }>; // 5-year breakdown
  shouldClaim: boolean;
  claimReason: string;
  
  // Decision Matrix
  decisionMatrix: {
    claimOption: {
      outOfPocket: number;
      insurerPays: number;
      ncbLoss: number;
      totalCost: number;
    };
    payYourselfOption: {
      outOfPocket: number;
      ncbProtected: number;
      totalCost: number;
    };
    verdict: string;
    savings: number;
  };
  
  // Scenarios
  scenarios: {
    minor: {
      damage: number;
      outOfPocket: number;
      shouldClaim: boolean;
      reason: string;
    };
    moderate: {
      damage: number;
      outOfPocket: number;
      shouldClaim: boolean;
      reason: string;
    };
    major: {
      damage: number;
      outOfPocket: number;
      shouldClaim: boolean;
      reason: string;
    };
    totaled: {
      damage: number;
      idv: number;
      insurerPays: number;
      replacementCost: number;
      gap: number;
      outOfPocket: number;
      shouldClaim: boolean;
      reason: string;
    };
    theft: {
      carValue: number;
      idv: number;
      insurerPays: number;
      replacementCost: number;
      gap: number;
      outOfPocket: number;
      shouldClaim: boolean;
      reason: string;
    };
  };
  
  // Recommendations
  recommendations: string[];
}

function calculateDepreciation(damageAmount: number, hasZeroDepreciation: boolean): number {
  if (hasZeroDepreciation) return 0;
  
  // Standard depreciation rates
  // Plastic/rubber: 50%, Fiberglass: 30%, Metal: 0-10%, Paint: 0%
  // Average: ~20% for typical damage
  return damageAmount * 0.2;
}

function calculateNCBLoss(
  currentNCB: number,
  annualPremium: number,
  years: number = 5
): { totalLoss: number; yearlyBreakdown: Array<{ year: number; premium: number; ncb: number; savings: number }> } {
  if (currentNCB === 0) {
    return {
      totalLoss: 0,
      yearlyBreakdown: Array.from({ length: years }, (_, i) => ({
        year: i + 1,
        premium: annualPremium,
        ncb: 0,
        savings: 0,
      })),
    };
  }
  
  // If NCB resets, calculate loss over next 5 years
  // Current premium with NCB discount
  const currentPremiumWithNCB = annualPremium * (1 - currentNCB / 100);
  const currentSavings = annualPremium * (currentNCB / 100);
  
  // NCB progression after reset: 0%, 10%, 20%, 30%, 40% (rebuilding)
  const ncbProgression = [0, 0.10, 0.20, 0.30, 0.40]; // Year 1-5 NCB percentages after reset
  
  let totalLoss = 0;
  const yearlyBreakdown: Array<{ year: number; premium: number; ncb: number; savings: number }> = [];
  
  for (let i = 0; i < years; i++) {
    const ncbPercent = ncbProgression[i] || 0.40;
    const premiumWithNCB = annualPremium * (1 - ncbPercent);
    const savingsWithNCB = annualPremium * ncbPercent;
    
    // Loss = what you would have saved with current NCB vs what you save rebuilding
    const lossThisYear = currentSavings - savingsWithNCB;
    totalLoss += lossThisYear;
    
    yearlyBreakdown.push({
      year: i + 1,
      premium: premiumWithNCB,
      ncb: ncbPercent * 100,
      savings: savingsWithNCB,
    });
  }
  
  return { totalLoss, yearlyBreakdown };
}

export function calculateVehicleInsuranceCost(
  input: VehicleInsuranceInput
): VehicleInsuranceResult {
  // Calculate fault percentage
  const faultPercentage = 
    input.faultStatus === "Your fault (100%)" ? 1.0 :
    input.faultStatus === "Shared (50%)" ? 0.5 : 0.0;
  
  // Calculate depreciation
  const depreciation = calculateDepreciation(
    input.accidentDamage,
    input.hasZeroDepreciation
  );
  
  // Calculate insurer's share (after deductible and depreciation)
  const claimableAmount = input.accidentDamage - depreciation;
  const insurerPays = Math.max(0, claimableAmount - input.deductible);
  const outOfPocketCost = input.deductible + depreciation;
  
  // Calculate NCB loss if claim is made
  const ncbImpact = input.hasNCBProtection 
    ? { totalLoss: 0, yearlyBreakdown: Array.from({ length: 5 }, (_, i) => ({
        year: i + 1,
        premium: input.annualPremium * (1 - input.currentNCB / 100),
        ncb: input.currentNCB,
        savings: input.annualPremium * (input.currentNCB / 100),
      })) }
    : calculateNCBLoss(input.currentNCB, input.annualPremium, 5);
  
  // Determine if should claim
  const netBenefit = insurerPays - ncbImpact.totalLoss;
  const shouldClaim = netBenefit > 0 || input.accidentDamage > 100000; // Always claim if > ₹1L
  
  let claimReason = "";
  if (shouldClaim) {
    if (input.accidentDamage > 100000) {
      claimReason = "Major damage—always claim. Repair cost far exceeds NCB loss.";
    } else {
      claimReason = `Claim it. Insurer pays ₹${insurerPays.toLocaleString()} vs NCB loss of ₹${ncbImpact.totalLoss.toLocaleString()}.`;
    }
  } else {
    claimReason = `Don't claim. Pay ₹${input.accidentDamage.toLocaleString()} yourself. NCB loss (₹${ncbImpact.totalLoss.toLocaleString()}) exceeds claim benefit.`;
  }
  
  // Calculate decision matrix
  const claimTotalCost = outOfPocketCost + ncbImpact.totalLoss;
  const payYourselfTotalCost = input.accidentDamage;
  const savings = payYourselfTotalCost - claimTotalCost;
  
  const decisionMatrix = {
    claimOption: {
      outOfPocket: outOfPocketCost,
      insurerPays: insurerPays,
      ncbLoss: ncbImpact.totalLoss,
      totalCost: claimTotalCost,
    },
    payYourselfOption: {
      outOfPocket: input.accidentDamage,
      ncbProtected: ncbImpact.totalLoss,
      totalCost: payYourselfTotalCost,
    },
    verdict: shouldClaim 
      ? `Claim it. Option A (insure + NCB loss) = ₹${claimTotalCost.toLocaleString()} total. Option B (pay yourself) = ₹${payYourselfTotalCost.toLocaleString()} upfront. You save ₹${savings.toLocaleString()} by claiming.`
      : `Don't claim. Option A (insure + NCB loss) = ₹${claimTotalCost.toLocaleString()} total. Option B (pay yourself) = ₹${payYourselfTotalCost.toLocaleString()} upfront. You save ₹${Math.abs(savings).toLocaleString()} by paying yourself.`,
    savings: savings,
  };

  // Generate scenarios
  const scenarios = {
    minor: {
      damage: 25000,
      outOfPocket: input.deductible + calculateDepreciation(25000, input.hasZeroDepreciation),
      shouldClaim: false,
      reason: "Small damage. Usually don't claim—NCB loss exceeds repair cost.",
    },
    moderate: {
      damage: 80000,
      outOfPocket: input.deductible + calculateDepreciation(80000, input.hasZeroDepreciation),
      shouldClaim: true,
      reason: "Moderate damage. Claim it—repair cost exceeds NCB loss.",
    },
    major: {
      damage: 200000,
      outOfPocket: input.deductible + calculateDepreciation(200000, input.hasZeroDepreciation),
      shouldClaim: true,
      reason: "Major damage. Always claim—catastrophic loss.",
    },
    totaled: {
      damage: input.currentIDV,
      idv: input.currentIDV,
      insurerPays: Math.max(0, input.currentIDV - input.deductible),
      replacementCost: input.currentIDV * 1.25, // Assume 25% higher replacement cost
      gap: (input.currentIDV * 1.25) - Math.max(0, input.currentIDV - input.deductible),
      outOfPocket: input.deductible + ((input.currentIDV * 1.25) - Math.max(0, input.currentIDV - input.deductible)),
      shouldClaim: true,
      reason: "Car is totaled. Insurance purpose is total loss. Claim ₹" + Math.max(0, input.currentIDV - input.deductible).toLocaleString() + ", pay gap from savings. Without insurance, you pay ₹" + (input.currentIDV * 1.25).toLocaleString() + " + insurance cost = worse.",
    },
    theft: {
      carValue: input.currentIDV * 1.25, // Current market value
      idv: input.currentIDV,
      insurerPays: Math.max(0, input.currentIDV - input.deductible),
      replacementCost: input.currentIDV * 1.25,
      gap: (input.currentIDV * 1.25) - Math.max(0, input.currentIDV - input.deductible),
      outOfPocket: input.deductible + ((input.currentIDV * 1.25) - Math.max(0, input.currentIDV - input.deductible)),
      shouldClaim: true,
      reason: "Even with ₹" + ((input.currentIDV * 1.25) - Math.max(0, input.currentIDV - input.deductible)).toLocaleString() + " gap, insurer covers majority. Without insurance, you lose ₹" + (input.currentIDV * 1.25).toLocaleString() + " entire car value. Claim protects you.",
    },
  };
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (!input.hasZeroDepreciation && input.accidentDamage > 50000) {
    recommendations.push("Consider adding Zero Depreciation add-on (₹1k–₹2k/year) to avoid depreciation deductions.");
  }
  
  if (!input.hasEngineProtection) {
    recommendations.push("Add Engine Protection add-on (₹1k–₹1.5k/year) for flood/water damage protection.");
  }
  
  if (input.currentIDV < input.currentIDV * 0.9) {
    recommendations.push("Consider increasing IDV to match current market value for better coverage.");
  }
  
  if (input.currentNCB >= 30 && !input.hasNCBProtection) {
    recommendations.push("Add NCB Protection add-on (₹500–₹1k/year) to protect your discount.");
  }
  
  return {
    outOfPocketCost,
    insurerPays,
    depreciationAmount: depreciation,
    ncbLoss: ncbImpact.totalLoss,
    ncbYearlyBreakdown: ncbImpact.yearlyBreakdown,
    shouldClaim,
    claimReason,
    decisionMatrix,
    scenarios,
    recommendations,
  };
}
