
// Coverage Ontology Schema V2
// Designed to normalize diverse insurer language into a canonical structure

export interface Evidence {
    page?: number;
    phrase?: string;
}

export interface CoverageFeature {
    available: boolean | "conditional" | "not_mentioned";
    limit?: string; // e.g. "₹5,000" or "No Limit" or "Up to 1% of SI"
    subLimit?: string;
    waitingPeriod?: string; // e.g. "2 years" or "30 days"
    isServed?: boolean; // New: True if waiting period is already over based on inception
    details: string; // The "Nuance" or "Insurer Wording"
    status: "Good" | "Bad" | "Neutral" | "Risk";
    evidence?: Evidence;
}

export interface CoverageOntology {
    // Core Basics
    sumInsured: {
        amount: number;
        text: string; // "₹10 Lakhs"
        restoration: boolean; // Is restoration available?
        details: string;
    };

    // The "Big Four" Domains
    roomRent: CoverageFeature; // Critical risk factor
    inpatient: CoverageFeature; // Base hospitalization
    prePost: CoverageFeature; // Pre/Post hospitalization
    noClaimBonus: CoverageFeature; // Inflation protection

    // High Impact Add-ons/Features
    opd: CoverageFeature;
    maternity: CoverageFeature;
    ped: CoverageFeature; // Pre-Existing Diseases
    restoration: CoverageFeature;
    consumables: CoverageFeature;

    // Hidden Risks/Fine Print
    copay: CoverageFeature;
    subLimits: CoverageFeature; // Specific disease/procedure limits
    exclusions: {
        major: string[]; // List of specific nasty exclusions
        details: string;
    };
}

export interface AnalysisReportV2 {
    meta: {
        refId: string;
        insurer: string;
        planName: string;
        policyNumber: string;
        policyholder: {
            name: string;
            age: string | number;
            city: string;
        };
        policyInceptionYear?: string | number; // New: To calculate served waiting periods
        ocrConfidence: number;
    };

    verdict: {
        tier: "Sufficient" | "Sufficient with Gaps" | "Insufficient";
        score: number; // 0-100
        headline: string;
        summary: string;
    };

    ontology: CoverageOntology;

    // Synthesis for user consumption
    ui: {
        riskTags: string[]; // e.g. ["Room Rent Cap Risk", "No Maternity"]
        goodTags: string[]; // e.g. ["No Co-pay", "High PCB"]
        criticalGaps: string[];
    };

    intro: string;
    conclusion: string;

    // Strategic Recommendations
    recommendations?: {
        topUp?: {
            shouldBuy: boolean;
            reason: string;
            suggestedDeductible?: string;
        };
        riders?: {
            name: string;
            reason: string;
            priority: "High" | "Medium" | "Low";
        }[];
    };

    // Legacy support or Future projections
    projections?: {
        title: string;
        description: string;
        items: { feature: string; impact: string }[];
    };
}
