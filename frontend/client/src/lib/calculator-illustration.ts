/**
 * The worked example shown on the homepage and on the calculator landing page.
 *
 * Both pages used to hardcode "₹1.9 Cr is what you need" for this household. The
 * calculator could not return that figure for this profile or any other, and
 * once the cover ceilings landed it sat above the maximum the engine will ever
 * produce, so the first number a visitor read was one the tool contradicted a
 * click later.
 *
 * Everything the example ASSERTS is now run through the real engine, so it
 * follows any change to a calibration constant instead of drifting away from it.
 * Only the premise is written down here: who this person is, and what they
 * already hold.
 */
import { calculateHealthCover, type EngineResult, type UserInputs } from "./health-engine-logic";

export const ILLUSTRATION_PROFILE: UserInputs = {
    ageBand: "31-45",
    exactAge: 38,
    cityTier: "Metro",
    state: "Maharashtra",
    city: "Pune",
    familyStructure: "Couple + kids",
    spouseAge: 36,
    childCount: 2,
    employerCover: "None",
    riskPosture: "Balanced",
    recurringExpenses: "None",
    preExistingConditions: ["none"],
    globalTravel: "Rarely or never",
};

/** What this household already holds. A premise of the scenario, not a claim. */
export const ILLUSTRATION_EXISTING_COVER = 1000000; // ₹10L, a typical first policy

/** Lakhs and crore, the way the figure is actually said out loud. */
function fmt(n: number): string {
    if (n >= 10000000) {
        const cr = n / 10000000;
        return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)} Cr`;
    }
    return `₹${Math.round(n / 100000)} L`;
}

export interface CalculatorIllustration {
    result: EngineResult;
    /** What the engine says this household needs. */
    needSI: number;
    haveSI: number;
    shortSI: number;
    needLabel: string;
    haveLabel: string;
    shortLabel: string;
    /** Whole percent of the requirement already held, for the progress bar. */
    heldPercent: number;
    /** Monthly premium for the efficient structure, at the lower estimate. */
    monthly: number;
    /** "38, two children, Pune". The home loan this used to mention is not an
     *  input to a health cover calculation and never was. */
    profileLabel: string;
}

let cached: CalculatorIllustration | null = null;

/** Memoised: the engine is pure arithmetic, but there is no reason to run it
 *  once per render on a marketing page. */
export function calculatorIllustration(): CalculatorIllustration {
    if (cached) return cached;

    const result = calculateHealthCover(ILLUSTRATION_PROFILE);
    const needSI = result.plans.optimal.totalSI;
    const haveSI = Math.min(ILLUSTRATION_EXISTING_COVER, needSI);
    const shortSI = Math.max(0, needSI - haveSI);

    cached = {
        result,
        needSI,
        haveSI,
        shortSI,
        needLabel: fmt(needSI),
        haveLabel: fmt(haveSI),
        shortLabel: fmt(shortSI),
        heldPercent: needSI > 0 ? Math.round((haveSI / needSI) * 100) : 0,
        monthly: result.plans.efficient.premiumEstimate.monthly.min,
        profileLabel: `${ILLUSTRATION_PROFILE.exactAge}, two children, ${ILLUSTRATION_PROFILE.city}`,
    };
    return cached;
}
