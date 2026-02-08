
export interface TermRiderEntry {
    company: string;
    riderName: string;
    description: string;
    uin: string;
    coverageType: "Accidental Death" | "Critical Illness" | "Waiver of Premium" | "Disability" | "Terminal Illness" | "Other";
    waitingPeriod: string;
    survivalPeriod: string;
    maxSumAssured: string;
    keyFeatures: string[];
}

export const TERM_RIDERS_DATABASE: TermRiderEntry[] = [
    {
        company: "ICICI Prudential",
        riderName: "Non-Linked Accidental Death and Disability Rider",
        description: "Provides additional financial protection in case of death or disability due to an accident.",
        uin: "105B042V02",
        coverageType: "Accidental Death",
        waitingPeriod: "N/A (Accident must occur during policy term)",
        survivalPeriod: "N/A",
        maxSumAssured: "₹3 Crore (capped at 3x base sum assured)",
        keyFeatures: [
            "Lump sum payout on accidental death",
            "Covers accidental total permanent disability",
            "Death must occur within 180 days of accident"
        ]
    },
    {
        company: "HDFC Life",
        riderName: "Income Benefit on Accidental Disability Rider",
        description: "Provides monthly income benefit in case of total permanent disability due to accident.",
        uin: "101B041V01",
        coverageType: "Disability",
        waitingPeriod: "N/A",
        survivalPeriod: "N/A",
        maxSumAssured: "Subject to underwriting",
        keyFeatures: [
            "Monthly income payout (not just lump sum)",
            "Income protection continuation",
            "Covers total permanent disability only"
        ]
    },
    {
        company: "Bajaj Allianz",
        riderName: "New Critical Illness Benefit Rider",
        description: "Lump sum benefit on diagnosis of specified critical illnesses.",
        uin: "Not specified",
        coverageType: "Critical Illness",
        waitingPeriod: "90 days from risk commencement",
        survivalPeriod: "30 days from diagnosis",
        maxSumAssured: "As per Board Approved Underwriting Policy",
        keyFeatures: [
            "Three options: 10, 25, or 60 illnesses",
            "Lump sum payout on first diagnosis",
            "Covers cancer, heart attack, stroke, kidney failure"
        ]
    },
    {
        company: "LIC",
        riderName: "New Term Assurance Rider",
        description: "Provides additional term life cover at nominal cost.",
        uin: "512B210V02",
        coverageType: "Other",
        waitingPeriod: "N/A",
        survivalPeriod: "N/A",
        maxSumAssured: "₹25 Lakhs",
        keyFeatures: [
            "Pure protection add-on",
            "Increases death benefit",
            "Cost-effective"
        ]
    },
    {
        company: "SBI Life",
        riderName: "Criti Care 13 Non-Linked Rider",
        description: "Covers 13 critical illnesses with lump sum payout.",
        uin: "111B025V02",
        coverageType: "Critical Illness",
        waitingPeriod: "90 days",
        survivalPeriod: "N/A (Check policy doc)",
        maxSumAssured: "₹20 Lakhs",
        keyFeatures: [
            "Affordable CI cover",
            "13 major illnesses covered",
            "Guaranteed renewal every 5 years"
        ]
    },
    {
        company: "Tata AIA",
        riderName: "Waiver of Premium Rider",
        description: "Waives future premiums if policyholder becomes disabled or critically ill.",
        uin: "Not specified",
        coverageType: "Waiver of Premium",
        waitingPeriod: "N/A",
        survivalPeriod: "N/A",
        maxSumAssured: "N/A",
        keyFeatures: [
            "Ensures policy continues without premium burden",
            "Triggered by disability or CI diagnosis",
            "Covers base policy + rider premiums"
        ]
    }
];

export function findTermRiders(keyword: string): TermRiderEntry[] {
    return TERM_RIDERS_DATABASE.filter(r =>
        r.riderName.toLowerCase().includes(keyword.toLowerCase()) ||
        r.description.toLowerCase().includes(keyword.toLowerCase()) ||
        r.company.toLowerCase().includes(keyword.toLowerCase())
    );
}
