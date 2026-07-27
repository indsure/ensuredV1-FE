import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

import { getProvidersByType, RiderType } from "./data/rider-data";

const getProviders = (type: RiderType): string => {
    const companies = getProvidersByType(type).slice(0, 3);
    return companies.length ? ` (Available from: ${companies.join(", ")}...)` : "";
};

// ─── Calibration 10: Central config object ───────────────────────────────────
// All magic numbers live here. Change a constant once — it propagates everywhere.

export const CALCULATOR_CONFIG = {
    // Calibration 3
    medicalInflationRate: 0.12,       // 12% conservative blended rate
    medicalInflationHorizon: 5,       // 5-year planning horizon for retail buyers

    // Calibration 4
    multiIncidentBufferWithRestoration: 0.08,    // 8% — modern unlimited-restoration policies
    multiIncidentBufferWithoutRestoration: 0.20, // 20% — no restoration cover

    // Calibration 8
    baseSICap: 2000000,               // ₹20L max base policy
    topUpMinimumThreshold: 1000000,   // ₹10L — don't recommend top-up for smaller gaps

    // Calibration 6
    riskPostureMultipliers: {
        "Minimum but safe": 0.80,
        "Balanced": 1.00,
        "Zero financial shock": 1.20,
    } as Record<string, number>,

    // Calibration 2
    cityMultipliers: {
        "Metro": 1.15,   // Zone A — Mumbai, Delhi, Bangalore, Chennai, Kolkata, Hyderabad, Pune
        "Tier-1": 1.05,  // Zone B/D — Ahmedabad, Jaipur, Chandigarh, Lucknow, Kochi, etc.
        "Tier-2": 1.00,  // Zone C baseline
        "Other": 1.00,   // Same as Tier-2
    } as Record<string, number>,

    // Calibration 7
    conditionMultipliers: {
        diabetes: 0.20,
        hypertension: 0.10,
        cardiac: 0.40,
        cancer: 0.50,
        obesity: 0.15,   // new
        kidney: 0.30,    // new
    } as Record<string, number>,
    conditionMultiplierCap: 1.8,

    // Calibration 5
    incomeAdjustments: {
        "< 5L": 0.75,           // tighter cap for genuinely low income
        "5-10L": 1.00,
        "10-20L": 1.00,
        "20L+": "buffer_500000", // adds ₹5L flat buffer
    } as Record<string, number | string>,

    // Calibration 9 — per ₹10L base SI, annual premium (₹)
    premiumBands: [
        { maxAge: 34, min: 8000, max: 11000 },
        { maxAge: 44, min: 10000, max: 14000 },
        { maxAge: 54, min: 16000, max: 22000 },
        { maxAge: 64, min: 24000, max: 32000 },
        { maxAge: Infinity, min: 35000, max: 50000 },
    ],
    familyFloaterDiscount: 0.15,      // 15% discount on family floater
    pedPremiumLoading: 0.25,          // +25% for pre-existing conditions
    metroPremiumLoading: 0.10,        // +10% for Metro city
};

// Named exports for Calibration 3 (easy access as standalone constants)
export const MEDICAL_INFLATION_RATE = CALCULATOR_CONFIG.medicalInflationRate;
export const MEDICAL_INFLATION_HORIZON = CALCULATOR_CONFIG.medicalInflationHorizon;

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgeBand = "18-30" | "31-45" | "46-60" | "60+";
export type CityTier = "Metro" | "Tier-1" | "Tier-2" | "Other";
export type FamilyStructure = "Individual" | "Couple" | "Couple + kids" | "Parents included";
export type EmployerCover = "None" | "< 5L" | "5-10L" | "> 10L";
export type RiskPosture = "Minimum but safe" | "Balanced" | "Zero financial shock";
export type HospitalPreference =
    | "Any good hospital"
    | "Large private hospitals"
    | "Premium corporate hospitals";
export type RecurringExpenses = "None" | "Minor (tests/OPD/meds)" | "Chronic but stable";
export type ParentsAge = "< 60" | "60-70" | "70+";

export interface UserInputs {
    // Level 1
    ageBand: AgeBand;
    cityTier: CityTier;
    familyStructure: FamilyStructure;
    employerCover: EmployerCover;
    riskPosture: RiskPosture;

    // Level 2 (Optional / Conditional)
    hospitalPreference?: HospitalPreference;
    recurringExpenses?: RecurringExpenses;
    parentsAge?: ParentsAge;

    // Level 3 (Optimisation)
    okWithDeductibles?: boolean;
    preferTopUp?: boolean;

    // Level 4 (Granular)
    exactAge?: number;
    spouseAge?: number;
    childCount?: number;
    annualIncome?: string; // "< 5L" | "5-10L" | "10-20L" | "20L+"

    // Expanded details
    gender?: "Male" | "Female";
    spouseIncome?: string;
    spouseEmployerCover?: EmployerCover;
    fatherAge?: number;
    motherAge?: number;
    childAges?: number[];

    // Calibration 7: new condition strings
    preExistingConditions?: Array<
        "diabetes" | "hypertension" | "cardiac" | "cancer" | "obesity" | "kidney" | "none"
    >;
}

export interface RiderRecommendation {
    name: string;
    reason: string;
    priority: "High" | "Medium" | "Optional";
}

export interface EngineResult {
    // String display fields (backward compatible)
    baseCover: string;
    superTopUp: string;
    totalProtection: string;
    reasoning: string[];
    riders: RiderRecommendation[];
    commonMistakes: string[];
    sensitivityAnalysis: string[];

    // Numeric extension fields
    premiumEstimate: {
        monthly: { min: number; max: number };
        annual: { min: number; max: number };
    };
    coverageBreakdown: {
        worstCase: number;
        inflationBuffer: number;
        multiIncidentBuffer: number;
        finalOptimal: number;
    };
    corporateGap?: {
        corporateSI: number;
        personalNeeded: number;
    };
    fiveYearProjection: Array<{ year: number; premium: number; cumulative: number }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLakhs(amount: number): string {
    const inLakhs = amount / 100000;
    const rounded = Math.round(inLakhs * 2) / 2;
    return `₹${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} Lakhs`;
}

function resolveAge(inputs: UserInputs): number {
    if (inputs.exactAge && inputs.exactAge > 0) return inputs.exactAge;
    const midpoints: Record<AgeBand, number> = {
        "18-30": 25,
        "31-45": 38,
        "46-60": 53,
        "60+": 65,
    };
    return midpoints[inputs.ageBand];
}

// ─── Calibration 1: Age-based worst-case cost anchors ────────────────────────
// Source: IRDAI claims data + insurer guidance for serious hospitalisation events

function getWorstCaseScenario(age: number): number {
    if (age < 35) return 2000000;  // ₹20L — trauma, accident (young adults)
    if (age < 45) return 2500000;  // ₹25L — early cardiac, cancer detection
    if (age < 55) return 3500000;  // ₹35L — cardiac surgery + ICU
    if (age < 65) return 5000000;  // ₹50L — cancer treatment + multi-day ICU
    if (age < 75) return 6500000;  // ₹65L — multi-morbidity, joint/renal
    return 7500000;                // ₹75L — hard market cap (eligibility-constrained)
}

// ─── Calibration 2: City multipliers ─────────────────────────────────────────

function getCityMultiplier(tier: CityTier): number {
    return CALCULATOR_CONFIG.cityMultipliers[tier] ?? 1.0;
}

// ─── Calibration 7: Pre-existing condition multiplier ────────────────────────
// Combines explicit conditions array (if provided) + recurringExpenses signal

function getConditionMultiplier(inputs: UserInputs): number {
    let riskScore = 0;
    const cfg = CALCULATOR_CONFIG.conditionMultipliers;

    // Explicit conditions array
    if (inputs.preExistingConditions && !inputs.preExistingConditions.includes("none")) {
        if (inputs.preExistingConditions.includes("diabetes")) riskScore += cfg.diabetes;
        if (inputs.preExistingConditions.includes("hypertension")) riskScore += cfg.hypertension;
        if (inputs.preExistingConditions.includes("cardiac")) riskScore += cfg.cardiac;
        if (inputs.preExistingConditions.includes("cancer")) riskScore += cfg.cancer;
        if (inputs.preExistingConditions.includes("obesity")) riskScore += cfg.obesity;
        if (inputs.preExistingConditions.includes("kidney")) riskScore += cfg.kidney;
    }

    // recurringExpenses: "Chronic but stable" adds a baseline risk signal
    if (inputs.recurringExpenses === "Chronic but stable" && riskScore === 0) {
        riskScore += cfg.diabetes; // proxy: treat as diabetes-equivalent risk tier
    }

    return Math.min(1 + riskScore, CALCULATOR_CONFIG.conditionMultiplierCap);
}

// ─── Calibration 3: Medical inflation ────────────────────────────────────────

function applyMedicalInflation(base: number): number {
    return base * Math.pow(1 + MEDICAL_INFLATION_RATE, MEDICAL_INFLATION_HORIZON);
}

// ─── Calibration 4: Multi-incident buffer ────────────────────────────────────

function getMultiIncidentBuffer(inflated: number, hasRestoration = true): number {
    const rate = hasRestoration
        ? CALCULATOR_CONFIG.multiIncidentBufferWithRestoration
        : CALCULATOR_CONFIG.multiIncidentBufferWithoutRestoration;
    return inflated * rate;
}

// ─── Calibration 6: Risk posture multiplier ──────────────────────────────────

function getRiskPostureMultiplier(riskPosture: RiskPosture): number {
    return CALCULATOR_CONFIG.riskPostureMultipliers[riskPosture] ?? 1.0;
}

// ─── Calibration 5: Income-based adjustment ──────────────────────────────────

function applyIncomeAdjustment(optimal: number, annualIncome?: string): number {
    if (!annualIncome) return Math.round(optimal);
    const adj = CALCULATOR_CONFIG.incomeAdjustments[annualIncome];
    if (typeof adj === "number") return Math.round(optimal * adj);
    if (adj === "buffer_500000") return Math.round(optimal + 500000); // +₹5L
    return Math.round(optimal);
}

function corporateSIFromEmployerCover(cover: EmployerCover): number {
    if (cover === "< 5L") return 300000;
    if (cover === "5-10L") return 750000;
    if (cover === "> 10L") return 1500000;
    return 0;
}

// ─── Calibration 8: Base + Top-Up structure ──────────────────────────────────

function calculateStructure(finalOptimal: number): { baseSI: number; topUpSI: number } {
    // Base: 50% of optimal, capped at ₹20L
    const baseSI = Math.min(
        CALCULATOR_CONFIG.baseSICap,
        Math.round(finalOptimal * 0.50)
    );
    const rawTopUp = finalOptimal - baseSI;

    // Don't recommend top-up if gap is below minimum threshold — not worth the complexity
    const topUpSI = rawTopUp >= CALCULATOR_CONFIG.topUpMinimumThreshold ? rawTopUp : 0;

    return { baseSI, topUpSI };
}

// ─── Calibration 9: Premium estimate ─────────────────────────────────────────

function estimatePremium(
    age: number,
    baseSI: number,
    inputs: UserInputs
): EngineResult["premiumEstimate"] {
    // Find the right age band
    const band = CALCULATOR_CONFIG.premiumBands.find((b) => age <= b.maxAge)!;
    const baseMultiplier = baseSI / 1000000; // per ₹10L

    let bMin = Math.round(band.min * baseMultiplier);
    let bMax = Math.round(band.max * baseMultiplier);

    // Adjustments
    const isFamily =
        inputs.familyStructure === "Couple" ||
        inputs.familyStructure === "Couple + kids" ||
        inputs.familyStructure === "Parents included";

    if (isFamily) {
        const disc = 1 - CALCULATOR_CONFIG.familyFloaterDiscount;
        bMin = Math.round(bMin * disc);
        bMax = Math.round(bMax * disc);
    }

    const hasPED =
        (inputs.preExistingConditions?.length ?? 0) > 0 &&
        !inputs.preExistingConditions?.includes("none");
    const hasChronicExpenses = inputs.recurringExpenses === "Chronic but stable";

    if (hasPED || hasChronicExpenses) {
        const load = 1 + CALCULATOR_CONFIG.pedPremiumLoading;
        bMin = Math.round(bMin * load);
        bMax = Math.round(bMax * load);
    }

    if (inputs.cityTier === "Metro") {
        const load = 1 + CALCULATOR_CONFIG.metroPremiumLoading;
        bMin = Math.round(bMin * load);
        bMax = Math.round(bMax * load);
    }

    // Top-up premium ≈ 55% of base equivalent (cheaper than base)
    const tMin = Math.round(bMin * 0.55);
    const tMax = Math.round(bMax * 0.55);

    const annualMin = bMin + tMin;
    const annualMax = bMax + tMax;

    return {
        annual: { min: annualMin, max: annualMax },
        monthly: {
            min: Math.round(annualMin / 12),
            max: Math.round(annualMax / 12),
        },
    };
}

function fiveYearProjection(
    annualPremiumMax: number
): Array<{ year: number; premium: number; cumulative: number }> {
    const result: Array<{ year: number; premium: number; cumulative: number }> = [];
    let cumulative = 0;
    for (let year = 1; year <= 5; year++) {
        const premium = Math.round(annualPremiumMax * Math.pow(1.10, year - 1));
        cumulative += premium;
        result.push({ year, premium, cumulative });
    }
    return result;
}

// ─── Rider logic ──────────────────────────────────────────────────────────────

function buildRiders(inputs: UserInputs, age: number): RiderRecommendation[] {
    const riders: RiderRecommendation[] = [];

    if (inputs.hospitalPreference === "Premium corporate hospitals" || inputs.cityTier === "Metro") {
        riders.push({
            name: "Room Rent Waiver / No Capping",
            reason: `Premium hospitals in ${inputs.cityTier === "Metro" ? "metros" : "large cities"} charge ₹10k+/day. A room rent cap clause silently cuts your total claim payout by 40–50%.${getProviders("Room Rent Waiver")}`,
            priority: "High",
        });
    }

    const isFamily =
        inputs.familyStructure === "Couple" ||
        inputs.familyStructure === "Couple + kids" ||
        inputs.familyStructure === "Parents included";

    if (isFamily) {
        riders.push({
            name: "Restoration Benefit (Unlimited)",
            reason: `Critical for family floaters — one member's claim shouldn't leave the rest of your family unprotected for the year.${getProviders("Restoration")}`,
            priority: "High",
        });
    }

    if (
        inputs.recurringExpenses === "Chronic but stable" ||
        inputs.recurringExpenses === "Minor (tests/OPD/meds)"
    ) {
        riders.push({
            name: "OPD Care",
            reason: `Your recurring ${inputs.recurringExpenses === "Chronic but stable" ? "chronic condition costs" : "OPD/test expenses"} aren't covered by standard hospitalisation policies. OPD cover stops these from draining your savings.${getProviders("OPD")}`,
            priority: inputs.recurringExpenses === "Chronic but stable" ? "High" : "Optional",
        });
    }

    if (inputs.riskPosture === "Zero financial shock" || inputs.ageBand === "18-30") {
        riders.push({
            name: "No-Claim Bonus (NCB) Super Booster",
            reason: `Medical inflation is running at ${(MEDICAL_INFLATION_RATE * 100).toFixed(0)}%/year. A standard NCB grows too slowly — your cover needs to compound faster to stay adequate.`,
            priority: "Medium",
        });
    }

    if (inputs.ageBand !== "18-30" || inputs.riskPosture === "Zero financial shock") {
        riders.push({
            name: "Critical Illness Rider",
            reason: `Hospitalisation cover pays bills. Critical Illness pays a lump sum for income replacement during recovery — the most underrated gap in Indian health policies.${getProviders("Critical Illness")}`,
            priority: age >= 45 ? "High" : "Medium",
        });
    }

    // Obesity / kidney — new condition-specific rider
    const hasMetabolicRisk =
        inputs.preExistingConditions?.includes("obesity") ||
        inputs.preExistingConditions?.includes("kidney");

    if (hasMetabolicRisk) {
        riders.push({
            name: "Chronic Disease Management Add-on",
            reason: `Your profile includes metabolic or renal risk factors. A chronic disease management rider covers specialist consultations, diagnostics, and structured care programmes not covered under standard hospitalisation.`,
            priority: "High",
        });
    }

    riders.push({
        name: "Consumables Cover",
        reason: `Gloves, PPE kits, syringes — typically 10–15% of hospital bills. No standard policy covers them. This rider closes that silent gap.${getProviders("Consumables")}`,
        priority: "Medium",
    });

    if (inputs.familyStructure === "Parents included") {
        riders.push({
            name: "Annual Health Check-up Add-on",
            reason: `Senior citizens need regular screening. Early detection is the real cost-saver — many policies reward a claim-free year with this benefit.`,
            priority: "Medium",
        });
    }

    return riders;
}

// ─── Reasoning ────────────────────────────────────────────────────────────────

function buildReasoning(
    inputs: UserInputs,
    age: number,
    breakdown: EngineResult["coverageBreakdown"],
    structure: { baseSI: number; topUpSI: number },
    corporateGap?: EngineResult["corporateGap"]
): string[] {
    const cityLabel =
        inputs.cityTier === "Metro"
            ? "a metro city"
            : inputs.cityTier === "Tier-1"
                ? "a Tier-1 city"
                : "a Tier-2 city";

    const ageScenario =
        age < 35
            ? "accident and trauma scenarios"
            : age < 45
                ? "early cardiac events and cancer detection"
                : age < 55
                    ? "cardiac surgery and ICU care"
                    : age < 65
                        ? "cancer treatment and extended ICU stays"
                        : "multi-morbidity and complex senior care";

    const inflationRate = (MEDICAL_INFLATION_RATE * 100).toFixed(0);
    const horizon = MEDICAL_INFLATION_HORIZON;

    const lines: string[] = [
        `At ${age}, the realistic worst-case hospitalisation in ${cityLabel} — ${ageScenario} — benchmarks to ${formatLakhs(breakdown.worstCase)} at today's costs.`,
        `${inflationRate}% medical inflation compounded over ${horizon} years adds ${formatLakhs(breakdown.inflationBuffer)}. This is built into the recommendation so your cover doesn't erode before you need it.`,
        `An 8% multi-incident buffer (${formatLakhs(breakdown.multiIncidentBuffer)}) accounts for repeat-claim overlap risk. Modern policies with unlimited restoration handle unrelated claims, but not repeat claims on the same illness within a policy year.`,
    ];

    if (inputs.riskPosture === "Zero financial shock") {
        lines.push(
            `You want zero financial shock — coverage is pushed to 1.20x the base estimate. This eliminates scenarios where you face out-of-pocket bills above ₹10–15k.`
        );
    } else if (inputs.riskPosture === "Minimum but safe") {
        lines.push(
            `You prefer lean coverage — the recommendation is trimmed to 0.80x the base estimate. This covers catastrophic events while leaving routine costs to your savings.`
        );
    }

    if (corporateGap && corporateGap.corporateSI > 0) {
        lines.push(
            `Your employer cover (${formatLakhs(corporateGap.corporateSI)}) is factored in. You need ${formatLakhs(corporateGap.personalNeeded)} in personal cover to fill the gap — employer policies end the day you switch jobs, retire, or are laid off.`
        );
    } else if (inputs.employerCover === "None") {
        lines.push(
            `You have no employer cover. This is your sole safety net — the recommendation doesn't cut corners.`
        );
    }

    if (inputs.familyStructure === "Parents included") {
        lines.push(
            `With parents on the floater, senior citizen risk significantly increases this number. Post-60 claim frequency is 3–4× higher than working-age adults, and claim severity is greater.`
        );
    } else if (inputs.familyStructure === "Couple + kids" && inputs.childCount) {
        lines.push(
            `Coverage is structured as a family floater across ${2 + inputs.childCount} members. The super top-up activates when any single claim crosses the base threshold.`
        );
    }

    if (structure.topUpSI > 0) {
        lines.push(
            `Structure: ${formatLakhs(structure.baseSI)} base policy handles routine hospitalisation. The ${formatLakhs(structure.topUpSI)} super top-up covers catastrophic events at ~55% lower premium per lakh than expanding the base. Buying a single large base policy for the same total would cost significantly more.`
        );
    } else {
        lines.push(
            `A ${formatLakhs(structure.baseSI)} base policy covers your profile without needing a super top-up — the gap between base and optimal is below the complexity threshold worth adding a separate policy for.`
        );
    }

    if (inputs.annualIncome === "< 5L") {
        lines.push(
            `With an income below ₹5L, the estimate is trimmed to 75% of the standard optimal for affordability. Prioritise maintaining the super top-up — it provides the largest coverage per rupee of premium.`
        );
    }

    return lines;
}

// ─── Dynamic mistakes & sensitivity ──────────────────────────────────────────

function buildCommonMistakes(inputs: UserInputs, age: number): string[] {
    const mistakes: string[] = [];

    if (inputs.ageBand === "18-30" || age < 35) {
        mistakes.push(
            `Thinking you're young and healthy so ₹5L is enough. At ${(MEDICAL_INFLATION_RATE * 100).toFixed(0)}%/year medical inflation, that cover halves in real value before you turn 40.`
        );
        mistakes.push(
            `Treating employer cover as personal health insurance. It terminates the day you resign, get laid off, or retire — with no continuity of pre-existing condition waivers on your personal policy.`
        );
    }

    if (inputs.familyStructure === "Parents included") {
        mistakes.push(
            `Adding parents to a standard floater without checking senior citizen exclusion clauses. After 60, many policies exclude specific ailments for the first 2–4 years.`
        );
        mistakes.push(
            `Ignoring the room rent limit. A ₹2,000/day cap at a hospital charging ₹8,000/day means your insurer proportionately deducts 75% of every line item — not just the room.`
        );
    } else {
        mistakes.push(
            `Ignoring room rent caps — this single clause can slash total claim payout by 40–50% at premium hospitals. Most people only discover it at claim time.`
        );
    }

    if (inputs.employerCover !== "None") {
        mistakes.push(
            `Stacking a personal policy on top of employer cover without structuring it as a top-up. You end up paying double for the same ₹5–10L band instead of adding a super top-up to cover ₹10L–₹50L cheaply.`
        );
    }

    mistakes.push(
        `Waiting until a health event to buy. Any diagnosed condition before purchase becomes a pre-existing condition with a 2–4 year waiting period — you pay premiums for years without full cover.`
    );

    return mistakes.slice(0, 4);
}

function buildSensitivity(inputs: UserInputs, age: number): string[] {
    const sensitivity: string[] = [];

    if (inputs.riskPosture === "Zero financial shock") {
        sensitivity.push(
            `If premium inflation exceeds 12%/year — review whether this coverage level stays within 3–5% of annual income.`
        );
    }

    if (inputs.annualIncome === "< 5L") {
        sensitivity.push(
            `If your super top-up has a ₹3–5L deductible — ensure your savings can fund that gap. Otherwise the top-up won't activate when you most need it.`
        );
    }

    if (inputs.familyStructure !== "Parents included" && age < 40) {
        sensitivity.push(
            `If you plan to have children in the next 2–3 years — add a maternity rider now. Waiting periods are 9–24 months on most policies.`
        );
    }

    if (inputs.recurringExpenses !== "Chronic but stable") {
        sensitivity.push(
            `If you're diagnosed with a chronic condition (diabetes, hypertension) — premiums will load by 20–50% at renewal, and some conditions trigger waiting periods.`
        );
    }

    sensitivity.push(
        `If you relocate to a Metro — costs increase by 10–15%. Reassess base cover and whether your room rent clause still works for metro hospital rates.`
    );

    if (inputs.employerCover !== "None") {
        sensitivity.push(
            `If you change jobs and your new employer offers no health cover — immediately activate a higher personal base. The coverage gap window is the most dangerous period.`
        );
    }

    return sensitivity.slice(0, 4);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function calculateHealthCover(inputs: UserInputs): EngineResult {
    const age = resolveAge(inputs);

    // Step 1: Worst-case scenario (Calibration 1)
    const worstCase = getWorstCaseScenario(age);

    // Step 2: City + condition multipliers (Calibrations 2 & 7)
    const cityMult = getCityMultiplier(inputs.cityTier);
    const condMult = getConditionMultiplier(inputs);
    const adjusted = worstCase * cityMult * condMult;

    // Step 3: Compound inflation (Calibration 3)
    const inflated = applyMedicalInflation(adjusted);
    const inflationBuffer = inflated - adjusted;

    // Step 4: Multi-incident buffer (Calibration 4)
    const multiIncidentBuffer = getMultiIncidentBuffer(inflated, true);

    // Step 5: Raw optimal — ₹1 Cr ceiling
    const rawOptimal = Math.min(inflated + multiIncidentBuffer, 100000000);

    // Step 6: Risk posture (Calibration 6)
    const riskMult = getRiskPostureMultiplier(inputs.riskPosture);
    const riskAdjusted = Math.round(rawOptimal * riskMult);

    // Step 7: Income adjustment (Calibration 5)
    const finalOptimal = applyIncomeAdjustment(riskAdjusted, inputs.annualIncome);

    // Step 8: Structure (Calibration 8)
    const { baseSI, topUpSI } = calculateStructure(finalOptimal);

    // Step 9: Corporate gap
    const corporateSI = corporateSIFromEmployerCover(inputs.employerCover);
    const corporateGap =
        corporateSI > 0
            ? { corporateSI, personalNeeded: Math.max(0, finalOptimal - corporateSI) }
            : undefined;

    // Step 10: Premium estimate (Calibration 9)
    const premiumEstimate = estimatePremium(age, baseSI, inputs);

    // Step 11: 5-year projection
    const projection = fiveYearProjection(premiumEstimate.annual.max);

    // Step 12: Coverage breakdown
    const coverageBreakdown = {
        worstCase,
        inflationBuffer: Math.round(inflationBuffer),
        multiIncidentBuffer: Math.round(multiIncidentBuffer),
        finalOptimal,
    };

    const structure = { baseSI, topUpSI };

    // Step 13: Narrative
    const reasoning = buildReasoning(inputs, age, coverageBreakdown, structure, corporateGap);
    const riders = buildRiders(inputs, age);
    const commonMistakes = buildCommonMistakes(inputs, age);
    const sensitivityAnalysis = buildSensitivity(inputs, age);

    return {
        // Backward-compatible string fields
        baseCover: formatLakhs(baseSI),
        superTopUp: topUpSI > 0 ? formatLakhs(topUpSI) : "None",
        totalProtection: formatLakhs(finalOptimal),

        reasoning,
        riders,
        commonMistakes,
        sensitivityAnalysis,

        // Numeric extension fields
        premiumEstimate,
        coverageBreakdown,
        corporateGap,
        fiveYearProjection: projection,
    };
}
