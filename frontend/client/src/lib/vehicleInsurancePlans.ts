/**
 * Vehicle Insurance Plans Data
 * Pre-populated plans for comparison
 */

export interface VehicleInsurancePlan {
  id: string;
  planName: string;
  insurer: string;
  logo?: string;
  
  // Coverage
  coverageType: "Third-Party" | "Comprehensive";
  idvRange: { min: number; max: number };
  
  // Premium (for ₹6L IDV, age 5 years, comprehensive)
  getMonthlyPremium: (idv: number, vehicleAge: number) => number;
  getAnnualPremium: (idv: number, vehicleAge: number) => number;
  
  // Add-ons
  addOns: {
    zeroDepreciation: { available: boolean; cost: number }; // per year
    engineProtection: { available: boolean; cost: number };
    roadsideAssistance: { available: boolean; cost: number };
    ncbProtection: { available: boolean; cost: number };
    personalAccident: { available: boolean; cost: number };
  };
  
  // Claim Settlement
  claimSettlementRatio: number; // percentage
  averageClaimSettlementTime: string; // e.g., "15-25 days"
  claimDenialRate: number; // percentage
  
  // Network
  networkGarages: number; // count
  cashlessGarages: number; // count
  
  // Third-party limits
  thirdPartyPropertyDamage: number; // ₹10L standard
  thirdPartyBodilyInjury: number; // ₹5L minimum, can increase
  
  // Deductibles
  compulsoryDeductible: number; // ₹1k-₹2k
  voluntaryDeductibleOptions: number[]; // [0, 1000, 2000, 5000]
  
  // NCB
  ncbProgression: number[]; // [0, 20, 25, 35, 50] percentages
  
  // Reviews
  policyholderReviews: number; // 1-5 stars
  googleRating: number; // 1-5 stars
  
  // Special features
  features: string[];
}

const plans: VehicleInsurancePlan[] = [
  {
    id: "hdfc-ergo",
    planName: "HDFC Ergo Comprehensive",
    insurer: "HDFC Ergo",
    coverageType: "Comprehensive",
    idvRange: { min: 100000, max: 50000000 },
    getMonthlyPremium: (idv, vehicleAge) => {
      const baseRate = vehicleAge <= 2 ? 2.5 : vehicleAge <= 5 ? 2.0 : vehicleAge <= 8 ? 1.8 : 1.5;
      return Math.round((idv / 100000) * baseRate * 100);
    },
    getAnnualPremium: (idv, vehicleAge) => {
      return Math.round((idv / 100000) * (vehicleAge <= 2 ? 2.5 : vehicleAge <= 5 ? 2.0 : vehicleAge <= 8 ? 1.8 : 1.5) * 1000);
    },
    addOns: {
      zeroDepreciation: { available: true, cost: 1200 },
      engineProtection: { available: true, cost: 1500 },
      roadsideAssistance: { available: true, cost: 800 },
      ncbProtection: { available: true, cost: 900 },
      personalAccident: { available: true, cost: 500 },
    },
    claimSettlementRatio: 96,
    averageClaimSettlementTime: "15-25 days",
    claimDenialRate: 4,
    networkGarages: 8500,
    cashlessGarages: 7500,
    thirdPartyPropertyDamage: 1000000,
    thirdPartyBodilyInjury: 5000000,
    compulsoryDeductible: 1000,
    voluntaryDeductibleOptions: [0, 1000, 2000, 5000],
    ncbProgression: [0, 20, 25, 35, 50],
    policyholderReviews: 4.5,
    googleRating: 4.4,
    features: ["Fast claim settlement", "Wide network", "24/7 helpline", "Online renewal"],
  },
  {
    id: "icici-lombard",
    planName: "ICICI Lombard Comprehensive",
    insurer: "ICICI Lombard",
    coverageType: "Comprehensive",
    idvRange: { min: 100000, max: 50000000 },
    getMonthlyPremium: (idv, vehicleAge) => {
      const baseRate = vehicleAge <= 2 ? 2.6 : vehicleAge <= 5 ? 2.1 : vehicleAge <= 8 ? 1.9 : 1.6;
      return Math.round((idv / 100000) * baseRate * 100);
    },
    getAnnualPremium: (idv, vehicleAge) => {
      return Math.round((idv / 100000) * (vehicleAge <= 2 ? 2.6 : vehicleAge <= 5 ? 2.1 : vehicleAge <= 8 ? 1.9 : 1.6) * 1000);
    },
    addOns: {
      zeroDepreciation: { available: true, cost: 1100 },
      engineProtection: { available: true, cost: 1400 },
      roadsideAssistance: { available: true, cost: 700 },
      ncbProtection: { available: true, cost: 800 },
      personalAccident: { available: true, cost: 400 },
    },
    claimSettlementRatio: 95,
    averageClaimSettlementTime: "18-28 days",
    claimDenialRate: 5,
    networkGarages: 9200,
    cashlessGarages: 8200,
    thirdPartyPropertyDamage: 1000000,
    thirdPartyBodilyInjury: 10000000,
    compulsoryDeductible: 1000,
    voluntaryDeductibleOptions: [0, 1000, 2000, 5000],
    ncbProgression: [0, 20, 25, 35, 50],
    policyholderReviews: 4.3,
    googleRating: 4.2,
    features: ["Largest network", "Quick claim processing", "Mobile app", "Online services"],
  },
  {
    id: "bajaj-allianz",
    planName: "Bajaj Allianz Comprehensive",
    insurer: "Bajaj Allianz",
    coverageType: "Comprehensive",
    idvRange: { min: 100000, max: 50000000 },
    getMonthlyPremium: (idv, vehicleAge) => {
      const baseRate = vehicleAge <= 2 ? 2.4 : vehicleAge <= 5 ? 1.9 : vehicleAge <= 8 ? 1.7 : 1.4;
      return Math.round((idv / 100000) * baseRate * 100);
    },
    getAnnualPremium: (idv, vehicleAge) => {
      return Math.round((idv / 100000) * (vehicleAge <= 2 ? 2.4 : vehicleAge <= 5 ? 1.9 : vehicleAge <= 8 ? 1.7 : 1.4) * 1000);
    },
    addOns: {
      zeroDepreciation: { available: true, cost: 1300 },
      engineProtection: { available: true, cost: 1600 },
      roadsideAssistance: { available: true, cost: 900 },
      ncbProtection: { available: true, cost: 1000 },
      personalAccident: { available: true, cost: 600 },
    },
    claimSettlementRatio: 94,
    averageClaimSettlementTime: "20-30 days",
    claimDenialRate: 6,
    networkGarages: 7800,
    cashlessGarages: 6800,
    thirdPartyPropertyDamage: 1000000,
    thirdPartyBodilyInjury: 5000000,
    compulsoryDeductible: 1000,
    voluntaryDeductibleOptions: [0, 1000, 2000, 5000],
    ncbProgression: [0, 20, 25, 35, 50],
    policyholderReviews: 4.2,
    googleRating: 4.1,
    features: ["Good customer service", "Easy renewal", "Claim assistance", "Digital services"],
  },
  {
    id: "new-india",
    planName: "New India Assurance Comprehensive",
    insurer: "New India Assurance",
    coverageType: "Comprehensive",
    idvRange: { min: 100000, max: 50000000 },
    getMonthlyPremium: (idv, vehicleAge) => {
      const baseRate = vehicleAge <= 2 ? 2.2 : vehicleAge <= 5 ? 1.8 : vehicleAge <= 8 ? 1.6 : 1.3;
      return Math.round((idv / 100000) * baseRate * 100);
    },
    getAnnualPremium: (idv, vehicleAge) => {
      return Math.round((idv / 100000) * (vehicleAge <= 2 ? 2.2 : vehicleAge <= 5 ? 1.8 : vehicleAge <= 8 ? 1.6 : 1.3) * 1000);
    },
    addOns: {
      zeroDepreciation: { available: true, cost: 1000 },
      engineProtection: { available: true, cost: 1300 },
      roadsideAssistance: { available: true, cost: 600 },
      ncbProtection: { available: false, cost: 0 },
      personalAccident: { available: true, cost: 300 },
    },
    claimSettlementRatio: 92,
    averageClaimSettlementTime: "25-35 days",
    claimDenialRate: 8,
    networkGarages: 6500,
    cashlessGarages: 5500,
    thirdPartyPropertyDamage: 1000000,
    thirdPartyBodilyInjury: 5000000,
    compulsoryDeductible: 2000,
    voluntaryDeductibleOptions: [0, 1000, 2000],
    ncbProgression: [0, 20, 25, 35, 50],
    policyholderReviews: 3.9,
    googleRating: 3.8,
    features: ["Government-backed", "Wide coverage", "Affordable", "Traditional service"],
  },
  {
    id: "reliance-general",
    planName: "Reliance General Comprehensive",
    insurer: "Reliance General",
    coverageType: "Comprehensive",
    idvRange: { min: 100000, max: 50000000 },
    getMonthlyPremium: (idv, vehicleAge) => {
      const baseRate = vehicleAge <= 2 ? 2.3 : vehicleAge <= 5 ? 1.85 : vehicleAge <= 8 ? 1.65 : 1.35;
      return Math.round((idv / 100000) * baseRate * 100);
    },
    getAnnualPremium: (idv, vehicleAge) => {
      return Math.round((idv / 100000) * (vehicleAge <= 2 ? 2.3 : vehicleAge <= 5 ? 1.85 : vehicleAge <= 8 ? 1.65 : 1.35) * 1000);
    },
    addOns: {
      zeroDepreciation: { available: true, cost: 1150 },
      engineProtection: { available: true, cost: 1450 },
      roadsideAssistance: { available: true, cost: 750 },
      ncbProtection: { available: true, cost: 850 },
      personalAccident: { available: true, cost: 450 },
    },
    claimSettlementRatio: 93,
    averageClaimSettlementTime: "22-32 days",
    claimDenialRate: 7,
    networkGarages: 7200,
    cashlessGarages: 6200,
    thirdPartyPropertyDamage: 1000000,
    thirdPartyBodilyInjury: 5000000,
    compulsoryDeductible: 1000,
    voluntaryDeductibleOptions: [0, 1000, 2000, 5000],
    ncbProgression: [0, 20, 25, 35, 50],
    policyholderReviews: 4.0,
    googleRating: 3.9,
    features: ["Competitive pricing", "Good add-ons", "Online services", "Claim support"],
  },
  {
    id: "bharti-axa",
    planName: "Bharti AXA Comprehensive",
    insurer: "Bharti AXA",
    coverageType: "Comprehensive",
    idvRange: { min: 100000, max: 50000000 },
    getMonthlyPremium: (idv, vehicleAge) => {
      const baseRate = vehicleAge <= 2 ? 2.35 : vehicleAge <= 5 ? 1.9 : vehicleAge <= 8 ? 1.7 : 1.4;
      return Math.round((idv / 100000) * baseRate * 100);
    },
    getAnnualPremium: (idv, vehicleAge) => {
      return Math.round((idv / 100000) * (vehicleAge <= 2 ? 2.35 : vehicleAge <= 5 ? 1.9 : vehicleAge <= 8 ? 1.7 : 1.4) * 1000);
    },
    addOns: {
      zeroDepreciation: { available: true, cost: 1250 },
      engineProtection: { available: true, cost: 1550 },
      roadsideAssistance: { available: true, cost: 850 },
      ncbProtection: { available: true, cost: 950 },
      personalAccident: { available: true, cost: 550 },
    },
    claimSettlementRatio: 94,
    averageClaimSettlementTime: "20-30 days",
    claimDenialRate: 6,
    networkGarages: 7000,
    cashlessGarages: 6000,
    thirdPartyPropertyDamage: 1000000,
    thirdPartyBodilyInjury: 5000000,
    compulsoryDeductible: 1000,
    voluntaryDeductibleOptions: [0, 1000, 2000, 5000],
    ncbProgression: [0, 20, 25, 35, 50],
    policyholderReviews: 4.1,
    googleRating: 4.0,
    features: ["Good customer service", "Wide network", "Digital platform", "Quick claims"],
  },
  {
    id: "royal-sundaram",
    planName: "Royal Sundaram Comprehensive",
    insurer: "Royal Sundaram",
    coverageType: "Comprehensive",
    idvRange: { min: 100000, max: 50000000 },
    getMonthlyPremium: (idv, vehicleAge) => {
      const baseRate = vehicleAge <= 2 ? 2.25 : vehicleAge <= 5 ? 1.8 : vehicleAge <= 8 ? 1.6 : 1.3;
      return Math.round((idv / 100000) * baseRate * 100);
    },
    getAnnualPremium: (idv, vehicleAge) => {
      return Math.round((idv / 100000) * (vehicleAge <= 2 ? 2.25 : vehicleAge <= 5 ? 1.8 : vehicleAge <= 8 ? 1.6 : 1.3) * 1000);
    },
    addOns: {
      zeroDepreciation: { available: true, cost: 1100 },
      engineProtection: { available: true, cost: 1400 },
      roadsideAssistance: { available: true, cost: 700 },
      ncbProtection: { available: false, cost: 0 },
      personalAccident: { available: true, cost: 400 },
    },
    claimSettlementRatio: 92,
    averageClaimSettlementTime: "25-35 days",
    claimDenialRate: 8,
    networkGarages: 6000,
    cashlessGarages: 5000,
    thirdPartyPropertyDamage: 1000000,
    thirdPartyBodilyInjury: 5000000,
    compulsoryDeductible: 2000,
    voluntaryDeductibleOptions: [0, 1000, 2000],
    ncbProgression: [0, 20, 25, 35, 50],
    policyholderReviews: 3.8,
    googleRating: 3.7,
    features: ["Affordable premiums", "Basic coverage", "Traditional service", "Wide availability"],
  },
  {
    id: "lic-motor",
    planName: "LIC Motor Insurance",
    insurer: "LIC",
    coverageType: "Comprehensive",
    idvRange: { min: 100000, max: 50000000 },
    getMonthlyPremium: (idv, vehicleAge) => {
      const baseRate = vehicleAge <= 2 ? 2.1 : vehicleAge <= 5 ? 1.7 : vehicleAge <= 8 ? 1.5 : 1.2;
      return Math.round((idv / 100000) * baseRate * 100);
    },
    getAnnualPremium: (idv, vehicleAge) => {
      return Math.round((idv / 100000) * (vehicleAge <= 2 ? 2.1 : vehicleAge <= 5 ? 1.7 : vehicleAge <= 8 ? 1.5 : 1.2) * 1000);
    },
    addOns: {
      zeroDepreciation: { available: true, cost: 1000 },
      engineProtection: { available: false, cost: 0 },
      roadsideAssistance: { available: true, cost: 600 },
      ncbProtection: { available: false, cost: 0 },
      personalAccident: { available: true, cost: 300 },
    },
    claimSettlementRatio: 91,
    averageClaimSettlementTime: "30-40 days",
    claimDenialRate: 9,
    networkGarages: 5500,
    cashlessGarages: 4500,
    thirdPartyPropertyDamage: 1000000,
    thirdPartyBodilyInjury: 5000000,
    compulsoryDeductible: 2000,
    voluntaryDeductibleOptions: [0, 1000],
    ncbProgression: [0, 20, 25, 35, 50],
    policyholderReviews: 3.7,
    googleRating: 3.6,
    features: ["Government-backed", "Lowest premium", "Wide reach", "Traditional approach"],
  },
];

export function getRecommendedVehiclePlan(
  idv: number,
  vehicleAge: number,
  priority: "premium" | "settlement" | "affordable" = "premium"
): { plan: VehicleInsurancePlan; reason: string } {
  let scored = plans.map((plan) => {
    let score = 0;
    
    // Premium score (lower is better)
    const premium = plan.getAnnualPremium(idv, vehicleAge);
    const minPremium = Math.min(...plans.map((p) => p.getAnnualPremium(idv, vehicleAge)));
    const premiumScore = (minPremium / premium) * 30;
    score += premiumScore;
    
    // Settlement ratio (higher is better)
    score += (plan.claimSettlementRatio / 100) * 30;
    
    // Network garages (more is better)
    score += (plan.networkGarages / 10000) * 15;
    
    // Reviews (higher is better)
    score += (plan.policyholderReviews / 5) * 15;
    
    // Claim time (faster is better)
    const avgDays = parseInt(plan.averageClaimSettlementTime.split("-")[0]);
    score += ((60 - avgDays) / 60) * 10;
    
    return { plan, score };
  });
  
  // Adjust based on priority
  if (priority === "settlement") {
    scored = scored.map((s) => ({
      ...s,
      score: s.score * 0.7 + (s.plan.claimSettlementRatio / 100) * 30,
    }));
  } else if (priority === "affordable") {
    scored = scored.map((s) => {
      const premium = s.plan.getAnnualPremium(idv, vehicleAge);
      const minPremium = Math.min(...plans.map((p) => p.getAnnualPremium(idv, vehicleAge)));
      return {
        ...s,
        score: s.score * 0.7 + (minPremium / premium) * 30,
      };
    });
  }
  
  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];
  
  let reason = "";
  if (priority === "settlement") {
    reason = `Highest claim settlement ratio (${winner.plan.claimSettlementRatio}%) and fastest processing (${winner.plan.averageClaimSettlementTime}).`;
  } else if (priority === "affordable") {
    reason = `Most affordable premium (₹${winner.plan.getAnnualPremium(idv, vehicleAge).toLocaleString()}/year) with good coverage.`;
  } else {
    reason = `Best overall balance: competitive premium, ${winner.plan.claimSettlementRatio}% settlement ratio, ${winner.plan.networkGarages.toLocaleString()} network garages, ${winner.plan.policyholderReviews}/5 reviews.`;
  }
  
  return { plan: winner.plan, reason };
}

export function getAllVehiclePlans(): VehicleInsurancePlan[] {
  return plans;
}
