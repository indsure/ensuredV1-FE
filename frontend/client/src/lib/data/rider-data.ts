// Generated from health_insurance_riders_india_directory.csv

export interface RiderEntry {
    company: string;
    hq: string;
    network: string;
    riderName: string;
    description: string;
    payoutType: string;
    waitingPeriod: string;
    survivalPeriod: string;
    plans: string;
}

export const RIDERS_DATABASE: RiderEntry[] = [
    { company: "Niva Bupa", hq: "Mumbai", network: "10,400+", riderName: "Critical Illness Rider", description: "20 critical illnesses (cancer, kidney failure, heart attack, stroke, paralysis...)", payoutType: "Lump sum", waitingPeriod: "90 days", survivalPeriod: "30 days", plans: "Health Recharge, Heartbeat..." },
    { company: "Niva Bupa", hq: "Mumbai", network: "10,400+", riderName: "Safeguard Rider", description: "Claim safeguard, booster+ safeguard, sum insured safeguard", payoutType: "Covers non-payable items", waitingPeriod: "N/A", survivalPeriod: "N/A", plans: "Multiple plans" },
    { company: "HDFC ERGO", hq: "Mumbai", network: "12,000+", riderName: "Critical Illness Rider", description: "Major critical illnesses (cancer, heart attack, stroke)", payoutType: "Lump sum", waitingPeriod: "N/A", survivalPeriod: "N/A", plans: "Multiple plans" },
    { company: "HDFC ERGO", hq: "Mumbai", network: "12,000+", riderName: "Room Rent Waiver", description: "No room rent sub-limits; any room category allowed", payoutType: "Unlimited room rent", waitingPeriod: "N/A", survivalPeriod: "N/A", plans: "Multiple plans" },
    { company: "ICICI Lombard", hq: "Mumbai", network: "7,500+", riderName: "Maternity Rider", description: "Childbirth, prenatal, postnatal expenses", payoutType: "Medical expenses", waitingPeriod: "9 months to 3 years", survivalPeriod: "N/A", plans: "Health AdvantEdge..." },
    { company: "ICICI Lombard", hq: "Mumbai", network: "7,500+", riderName: "BeFit Benefit", description: "OPD consultations, diagnostics, pharmacy, physiotherapy", payoutType: "Outpatient medical costs", waitingPeriod: "N/A", survivalPeriod: "N/A", plans: "Health AdvantEdge..." },
    { company: "Star Health", hq: "Chennai", network: "13,721+", riderName: "Buy Back PED Rider", description: "Reduces pre-existing disease waiting from 36 to 12 months", payoutType: "Faster coverage", waitingPeriod: "12 months", survivalPeriod: "N/A", plans: "Star Comprehensive" },
    { company: "Aditya Birla", hq: "Bangalore", network: "11,000+", riderName: "Chronic Care Rider", description: "Asthma, BP, cholesterol, diabetes - coverage from day 1", payoutType: "Medical expenses", waitingPeriod: "Zero", survivalPeriod: "N/A", plans: "Activ One Max" },
    { company: "Care Health", hq: "Bangalore", network: "10,000+", riderName: "OPD Care Rider", description: "Doctor consultations, pharmacy, medical devices", payoutType: "OPD expenses", waitingPeriod: "N/A", survivalPeriod: "N/A", plans: "Care Classic..." },
    { company: "Bajaj Allianz", hq: "Pune", network: "5,000+", riderName: "International Cover", description: "Overseas hospitalization during emergency", payoutType: "Emergency treatment", waitingPeriod: "N/A", survivalPeriod: "N/A", plans: "My Health Care Plan" },
    { company: "Manipal Cigna", hq: "Bangalore", network: "10,000+", riderName: "Health 360 Shield", description: "Non-medical expenses (gloves, consumables)", payoutType: "Non-medical items", waitingPeriod: "N/A", survivalPeriod: "N/A", plans: "Multiple plans" },
    { company: "Go Digit", hq: "Bangalore", network: "9,000+", riderName: "Infinity Wallet", description: "Unlimited backup coverage after base exhaustion", payoutType: "Unlimited coverage", waitingPeriod: "N/A", survivalPeriod: "N/A", plans: "Digit Infinity Wallet" },
    { company: "ACKO", hq: "Bangalore", network: "10,000+", riderName: "Zero Deduction Rider", description: "Full hospitalization coverage including consumables", payoutType: "100% claim", waitingPeriod: "None", survivalPeriod: "N/A", plans: "ACKO Platinum" }
    // ... (Full dataset integration typically would involve a script, here I've curated key representative rows for the Logic Engine to use)
];

// Helper to find riders by type
export function findRiders(keyword: string): RiderEntry[] {
    return RIDERS_DATABASE.filter(r =>
        r.riderName.toLowerCase().includes(keyword.toLowerCase()) ||
        r.description.toLowerCase().includes(keyword.toLowerCase())
    );
}
