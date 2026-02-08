import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

import { RIDERS_DATABASE, findRiders } from "./data/rider-data";

// Helper to get providers string
const getProviders = (keyword: string) => {
    const riders = findRiders(keyword);
    const companies = Array.from(new Set(riders.map(r => r.company))).slice(0, 3);
    return companies.length ? ` (Available from: ${companies.join(", ")}...)` : "";
};

// --- Types ---

export type AgeBand = "18-30" | "31-45" | "46-60" | "60+";
export type CityTier = "Metro" | "Tier-1" | "Tier-2" | "Other";
export type FamilyStructure = "Individual" | "Couple" | "Couple + kids" | "Parents included";
export type EmployerCover = "None" | "< 5L" | "5-10L" | "> 10L";
export type RiskPosture = "Minimum but safe" | "Balanced" | "Zero financial shock";

export type HospitalPreference = "Any good hospital" | "Large private hospitals" | "Premium corporate hospitals";
export type RecurringExpenses = "None" | "Minor (tests/OPD/meds)" | "Chronic but stable";
export type ParentsAge = "< 60" | "60-70" | "70+";

export interface UserInputs {
    // Level 1
    ageBand: AgeBand;
    cityTier: CityTier;
    familyStructure: FamilyStructure;
    employerCover: EmployerCover;
    riskPosture: RiskPosture;

    // Level 2 (Optional/Conditional)
    hospitalPreference?: HospitalPreference;
    recurringExpenses?: RecurringExpenses;
    parentsAge?: ParentsAge;

    // Level 3 (Optimisation)
    okWithDeductibles?: boolean;
    preferTopUp?: boolean;

    // Level 4 (Granular Details - New)
    exactAge?: number;
    spouseAge?: number;
    childCount?: number;
    annualIncome?: string; // "< 5L", "5-10L", "10-20L", "20L+"

    // Expanded details
    gender?: "Male" | "Female";
    spouseIncome?: string;
    spouseEmployerCover?: EmployerCover;
    fatherAge?: number;
    motherAge?: number;
    childAges?: number[];
}



export interface RiderRecommendation {
    name: string;
    reason: string;
    priority: "High" | "Medium" | "Optional";
}

export interface EngineResult {
    baseCover: string; // e.g., "10 Lakhs"
    superTopUp: string; // e.g., "20 Lakhs"
    totalProtection: string;
    reasoning: string[];
    riders: RiderRecommendation[];
    commonMistakes: string[];
    sensitivityAnalysis: string[]; // "What would change this?"
}

// --- Constants ---

const CITY_COST_ANCHOR = {
    "Metro": { min: 10, max: 15 },
    "Tier-1": { min: 8, max: 12 },
    "Tier-2": { min: 5, max: 8 },
    "Other": { min: 5, max: 8 }, // Treat Other as Tier-2 for safety
};

const FAMILY_RISK_ANCHOR = {
    "Individual": {
        "18-30": { min: 5, max: 8 },
        "31-45": { min: 5, max: 8 }, // Same as <45
        "46-60": { min: 8, max: 12 }, // Increased risk
        "60+": { min: 10, max: 15 },
    },
    "Couple": { min: 10, max: 12 },
    "Couple + kids": { min: 12, max: 15 },
    "Parents included": { min: 15, max: 25 },
};

// --- Logic Core ---

export function calculateHealthCover(inputs: UserInputs): EngineResult {
    let baseMin = 0;
    let baseMax = 0;

    // 1. City Anchor
    const cityAnchor = CITY_COST_ANCHOR[inputs.cityTier];
    baseMin = cityAnchor.min;
    baseMax = cityAnchor.max;

    // 2. Family Risk Anchor
    let familyMin = 0;
    let familyMax = 0;

    if (inputs.familyStructure === "Individual") {
        let ageKey: AgeBand = inputs.ageBand;
        if (inputs.exactAge) {
            if (inputs.exactAge <= 30) ageKey = "18-30";
            else if (inputs.exactAge <= 45) ageKey = "31-45";
            else if (inputs.exactAge <= 60) ageKey = "46-60";
            else ageKey = "60+";
        }
        const ageParams = FAMILY_RISK_ANCHOR["Individual"][ageKey] || FAMILY_RISK_ANCHOR["Individual"]["31-45"];
        familyMin = ageParams.min;
        familyMax = ageParams.max;
    } else {
        const famParams = FAMILY_RISK_ANCHOR[inputs.familyStructure as keyof typeof FAMILY_RISK_ANCHOR] as { min: number, max: number };
        familyMin = famParams.min;
        familyMax = famParams.max;
    }

    // Take Max of City vs Family
    let recommendedBaseMin = Math.max(baseMin, familyMin);
    let recommendedBaseMax = Math.max(baseMax, familyMax);

    // 3. Employer Gap Rule
    // "Personal base should at least match the employer cover"
    let employerCoverAmount = 0;
    if (inputs.employerCover === "5-10L") employerCoverAmount = 5;
    if (inputs.employerCover === "> 10L") employerCoverAmount = 10;

    if (employerCoverAmount > 0) {
        recommendedBaseMin = Math.max(recommendedBaseMin, employerCoverAmount);
        // Don't necessarily increase max just because of employer, but min should be safe
    }

    // Adjust for Risk Posture
    if (inputs.riskPosture === "Minimum but safe") {
        // Stick to lower bound of the range
        recommendedBaseMax = recommendedBaseMin;
    } else if (inputs.riskPosture === "Zero financial shock") {
        // Push towards upper bound + buffer
        recommendedBaseMin = recommendedBaseMax;
        recommendedBaseMax += 5; // Extra buffer
    }

    // Final Base Calculation
    // We'll output a single robust number or a tight range. Let's pick a solid number.
    // Round to nearest 5 or 10 usually, but here we just need a logical 'X Lakhs'
    let finalBase = recommendedBaseMin;

    // Refine base based on High Cost City + Premium Hospital
    if (inputs.cityTier === "Metro" && inputs.hospitalPreference === "Premium corporate hospitals") {
        finalBase = Math.max(finalBase, 15);
    }

    // B. Top-Up Logic
    let suggestTopUp = false;
    let topUpAmount = 0;

    // "Recommend Super Top-Up when Required cover > 10-15L"
    if (recommendedBaseMax >= 10 || inputs.riskPosture === "Zero financial shock" || inputs.employerCover !== "None") {
        suggestTopUp = true;
    }

    if (suggestTopUp) {
        if (inputs.familyStructure === "Parents included") {
            topUpAmount = 25; // High risk
        } else if (inputs.riskPosture === "Zero financial shock") {
            topUpAmount = 50; // Peace of mind
        } else {
            topUpAmount = 15; // Standard cheap top-up
        }

        // If base is already very high (e.g. 20L), maybe reduce top-up need or adjust structure.
        // But usually Base 10 + STU 90 is better than Base 20.

        // If logic says Base should be > 10, cap Base at 10 and move rest to Top-up for cost efficiency?
        // Prompt says: "Typical structure: Base 5-10L, Super Top-Up 15-50L"
        if (finalBase > 10) {
            finalBase = 10; // Cap base for efficiency
            topUpAmount = Math.max(topUpAmount, 20); // Ensure Top-up is substantial
        }
    }


    // C. Riders
    const riders: RiderRecommendation[] = [];

    // Room Rent Waiver
    if (inputs.hospitalPreference === "Premium corporate hospitals" || inputs.cityTier === "Metro") {
        riders.push({
            name: "Room Rent Waiver / No Capping",
            reason: "Premium hospitals charge >₹10k/day. Limits here cause 50% claim deductions." + getProviders("Room Rent"),
            priority: "High"
        });
    }

    // Restoration
    if (inputs.familyStructure === "Couple" || inputs.familyStructure === "Couple + kids" || inputs.familyStructure === "Parents included") {
        riders.push({
            name: "Restoration Benefit (Unlimited)",
            reason: "Essential for family floaters so one claim doesn't exhaust cover for others." + getProviders("Restoration"),
            priority: "High"
        });
    }

    // NCB Booster
    if (inputs.riskPosture === "Zero financial shock" || inputs.ageBand === "18-30") {
        riders.push({
            name: "No-Claim Bonus Booster",
            reason: "Inflation is 14%. Your cover needs to grow faster than standard NCB.",
            priority: "Medium"
        });
    }

    // OPD
    if (inputs.recurringExpenses === "Chronic but stable" || inputs.recurringExpenses === "Minor (tests/OPD/meds)") {
        riders.push({
            name: "OPD Care",
            reason: "You have recurring costs. Standard policies won't pay for these visits." + getProviders("OPD"),
            priority: inputs.recurringExpenses === "Chronic but stable" ? "High" : "Optional"
        });
    }

    // Critical Illness (New logic based on Age/Risk)
    if (inputs.ageBand !== "18-30" || inputs.riskPosture === "Zero financial shock") {
        riders.push({
            name: "Critical Illness Rider",
            reason: "Lump sum payout for cancer/heart attack. Vital for income replacement." + getProviders("Critical Illness"),
            priority: "Medium"
        });
    }

    // Consumables
    riders.push({
        name: "Consumables Cover",
        reason: "Gloves/PPE/Kits are 10-15% of bills and never covered by main policy.",
        priority: "Medium" // Almost always good to have
    });


    // Reasoning Generation
    const reasoning = [
        `Based on ${inputs.cityTier} medical costs (approx ₹${cityAnchor.min}-${cityAnchor.max}L for serious issues).`,
        inputs.employerCover !== "None" ? `Optimised to supplement your existing employer cover, not duplicate it.` : `Designed as your primary line of defence since you have no employer cover.`,
        inputs.familyStructure === "Parents included" ? `Heavily weighted for senior citizen risks which spike after age 60.` : `Balanced for ${inputs.familyStructure} needs.`,
        inputs.childCount ? `Includes coverage for ${inputs.childCount} children.` : "",
        inputs.annualIncome === "< 5L" && finalBase > 5 ? "Note: High cover recommended due to medical inflation. Use Super Top-up to keep premium affordable." : ""
    ].filter(Boolean); // Remove empty strings

    // Common Mistakes
    const commonMistakes = [
        "Buying a ₹5L policy and thinking it's enough (Inflation halves its value in 5 years).",
        "Relying 100% on employer cover which vanishes if you switch jobs or retire.",
        "Ignoring room rent limits – this single clause can reduce your claim payout by 40-50%."
    ];

    // Sensitivity
    const sensitivityAnalysis = [
        "If you plan to have kids in 2-3 years (Maternity cover needed).",
        "If you get diagnosed with a chronic lifestyle disease (Diabetes/BP).",
        "If you move to a more expensive city (Metro)."
    ];

    return {
        baseCover: `₹${finalBase} Lakhs`,
        superTopUp: topUpAmount > 0 ? `₹${topUpAmount} Lakhs` : "None",
        totalProtection: `₹${finalBase + topUpAmount} Lakhs`,
        reasoning,
        riders,
        commonMistakes,
        sensitivityAnalysis
    };
}
