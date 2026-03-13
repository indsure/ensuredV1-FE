// Generated from health_insurance_riders_india_directory.csv — full dataset, 90 entries

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiderType =
    | "Critical Illness"
    | "Room Rent Waiver"
    | "Restoration"
    | "NCB Booster"
    | "OPD"
    | "Maternity"
    | "Consumables"
    | "Hospital Cash"
    | "PED Waiver"
    | "International Cover"
    | "Air Ambulance"
    | "Mental Health"
    | "Disability"
    | "Wellness"
    | "Other";

export interface RiderEntry {
    company: string;
    hq: string;
    network: string;
    riderType: RiderType;
    riderName: string;
    description: string;
    payoutType: string;
    waitingPeriod: string;
    survivalPeriod: string;
    plans: string;
}

// ─── Full database ────────────────────────────────────────────────────────────

export const RIDERS_DATABASE: RiderEntry[] = [
    // ── Niva Bupa (Max Bupa) ──────────────────────────────────────────────────
    {
        company: "Niva Bupa", hq: "Mumbai", network: "10,400+",
        riderType: "Critical Illness",
        riderName: "Critical Illness Rider",
        description: "20 critical illnesses (cancer, kidney failure, heart attack, stroke, paralysis, brain tumour, coma, blindness, etc.)",
        payoutType: "Lump sum equal to rider sum insured",
        waitingPeriod: "90 days", survivalPeriod: "30 days",
        plans: "Health Recharge, Heartbeat, Health Pulse, Health Premia",
    },
    {
        company: "Niva Bupa", hq: "Mumbai", network: "10,400+",
        riderType: "Consumables",
        riderName: "Safeguard Rider",
        description: "Claim safeguard, booster+ safeguard, sum insured safeguard (inflation protection)",
        payoutType: "Covers non-payable items; protects booster if claim below Rs 50,000",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Multiple plans",
    },
    {
        company: "Niva Bupa", hq: "Mumbai", network: "10,400+",
        riderType: "Other",
        riderName: "E-Consultation Rider",
        description: "Medical consultations if diagnosed with illness or before surgery",
        payoutType: "Covered consultation costs",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Heartbeat, Health Pulse",
    },
    {
        company: "Niva Bupa", hq: "Mumbai", network: "10,400+",
        riderType: "International Cover",
        riderName: "International Coverage Rider",
        description: "Coverage in USA, Canada and worldwide for overseas medical treatment",
        payoutType: "Medical expenses incurred abroad",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Heartbeat, Health Premia",
    },
    {
        company: "Niva Bupa", hq: "Mumbai", network: "10,400+",
        riderType: "Wellness",
        riderName: "Health Coach Rider",
        description: "Personalized health coaching, health score calculation, renewal discount",
        payoutType: "Wellness services + premium discount",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "GoActive Health Insurance",
    },
    {
        company: "Niva Bupa", hq: "Mumbai", network: "10,400+",
        riderType: "Other",
        riderName: "Accidental Hospitalization Rider",
        description: "Medical expenses due to accidents",
        payoutType: "Hospitalization costs",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Health Assurance",
    },
    {
        company: "Niva Bupa", hq: "Mumbai", network: "10,400+",
        riderType: "Other",
        riderName: "Premium Waiver Rider",
        description: "Policy validity extended by 1 year if insured dies or is diagnosed with listed illness",
        payoutType: "Premium waiver for next year",
        waitingPeriod: "90 days", survivalPeriod: "N/A",
        plans: "Heartbeat Insurance",
    },
    {
        company: "Niva Bupa", hq: "Mumbai", network: "10,400+",
        riderType: "Disability",
        riderName: "Temporary Total Disability Rider",
        description: "Weekly payment for accidental injury leading to disability (up to 100 weeks)",
        payoutType: "1% of sum insured per week",
        waitingPeriod: "3 days minimum", survivalPeriod: "N/A",
        plans: "Health Assurance",
    },
    {
        company: "Niva Bupa", hq: "Mumbai", network: "10,400+",
        riderType: "NCB Booster",
        riderName: "Enhanced No Claim Bonus Rider",
        description: "Cumulative bonus for claim-free years (20% per year up to 200%)",
        payoutType: "Sum insured increase up to 200%",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Multiple plans",
    },

    // ── HDFC ERGO ─────────────────────────────────────────────────────────────
    {
        company: "HDFC ERGO", hq: "Mumbai", network: "12,000+",
        riderType: "Critical Illness",
        riderName: "Critical Illness Rider",
        description: "Major critical illnesses (cancer, heart attack, stroke, organ transplant)",
        payoutType: "Lump sum on diagnosis",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Multiple plans",
    },
    {
        company: "HDFC ERGO", hq: "Mumbai", network: "12,000+",
        riderType: "PED Waiver",
        riderName: "PED Waiting Period Modification Rider",
        description: "Reduces pre-existing disease waiting from 4 years to 2-3 years",
        payoutType: "Earlier coverage activation",
        waitingPeriod: "Modified period", survivalPeriod: "N/A",
        plans: "my:health Koti Suraksha, Suraksha, Comprehensive Suraksha",
    },
    {
        company: "HDFC ERGO", hq: "Mumbai", network: "12,000+",
        riderType: "Air Ambulance",
        riderName: "Emergency Air Ambulance Rider",
        description: "Air ambulance transportation during medical emergency",
        payoutType: "Transportation cost covered",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "my:health Suraksha, Optima Secure",
    },
    {
        company: "HDFC ERGO", hq: "Mumbai", network: "12,000+",
        riderType: "Other",
        riderName: "E-Opinion for Critical Illness Rider",
        description: "Second medical opinion cost for critical illnesses",
        payoutType: "Consultation fees",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "my:health Suraksha, Optima Secure",
    },
    {
        company: "HDFC ERGO", hq: "Mumbai", network: "12,000+",
        riderType: "Other",
        riderName: "Companion Benefit Rider",
        description: "Attendant expenses during hospitalization",
        payoutType: "Attendant cost coverage",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "my:health Koti Suraksha, Comprehensive Suraksha",
    },
    {
        company: "HDFC ERGO", hq: "Mumbai", network: "12,000+",
        riderType: "Restoration",
        riderName: "Automatic Restore Benefit Rider",
        description: "Annual recharging of sum insured after exhaustion",
        payoutType: "Full sum insured restoration",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Optima Secure, Comprehensive Suraksha",
    },
    {
        company: "HDFC ERGO", hq: "Mumbai", network: "12,000+",
        riderType: "Room Rent Waiver",
        riderName: "Room Rent Waiver Rider",
        description: "No room rent sub-limits; any room category allowed",
        payoutType: "Unlimited room rent coverage",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Multiple plans",
    },
    {
        company: "HDFC ERGO", hq: "Mumbai", network: "12,000+",
        riderType: "International Cover",
        riderName: "Global Health Cover Rider",
        description: "Medical expenses outside India including USA and Canada",
        payoutType: "Overseas treatment costs",
        waitingPeriod: "2 years for planned hospitalizations", survivalPeriod: "N/A",
        plans: "my:health Suraksha, Optima Secure",
    },
    {
        company: "HDFC ERGO", hq: "Mumbai", network: "12,000+",
        riderType: "Hospital Cash",
        riderName: "Hospital Cash Rider",
        description: "Daily allowance during hospitalization",
        payoutType: "Fixed daily amount for each hospitalization day",
        waitingPeriod: "24 hours minimum stay", survivalPeriod: "N/A",
        plans: "my:health Suraksha",
    },

    // ── ICICI Lombard ─────────────────────────────────────────────────────────
    {
        company: "ICICI Lombard", hq: "Mumbai", network: "7,500+",
        riderType: "Critical Illness",
        riderName: "Critical Illness Rider",
        description: "Listed critical illnesses (cancer, heart attack, stroke, kidney failure, etc.)",
        payoutType: "Lump sum on diagnosis",
        waitingPeriod: "90 days", survivalPeriod: "N/A",
        plans: "Health AdvantEdge, Wyn Health, iShield, Complete Health, Smart Super Health, Health Booster, Hospifund",
    },
    {
        company: "ICICI Lombard", hq: "Mumbai", network: "7,500+",
        riderType: "Maternity",
        riderName: "Maternity Rider",
        description: "Childbirth, prenatal, postnatal expenses, newborn baby costs",
        payoutType: "Medical expenses up to rider limit",
        waitingPeriod: "9 months to 3 years", survivalPeriod: "N/A",
        plans: "Health AdvantEdge, Wyn Health, iShield, Health Shield 360, Complete Health, Smart Super Health",
    },
    {
        company: "ICICI Lombard", hq: "Mumbai", network: "7,500+",
        riderType: "Maternity",
        riderName: "Newborn Baby Cover Rider",
        description: "Newborn hospitalization expenses until 90 days old",
        payoutType: "In-patient hospitalization costs",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Multiple plans",
    },
    {
        company: "ICICI Lombard", hq: "Mumbai", network: "7,500+",
        riderType: "Other",
        riderName: "Convalescence Benefit Rider",
        description: "Lump sum on 10+ days hospitalization",
        payoutType: "Fixed amount per hospitalization",
        waitingPeriod: "10 days minimum", survivalPeriod: "N/A",
        plans: "Health Shield 360, Complete Health, Health Booster, Hospifund",
    },
    {
        company: "ICICI Lombard", hq: "Mumbai", network: "7,500+",
        riderType: "International Cover",
        riderName: "Worldwide Cover Rider",
        description: "Hospitalization and daycare outside India (USA, Canada, worldwide)",
        payoutType: "Medical treatment costs abroad",
        waitingPeriod: "2 years", survivalPeriod: "N/A",
        plans: "Health AdvantEdge, iShield, Health Shield 360",
    },
    {
        company: "ICICI Lombard", hq: "Mumbai", network: "7,500+",
        riderType: "OPD",
        riderName: "BeFit Benefit Rider",
        description: "OPD consultations, diagnostics, pharmacy, physiotherapy, diet consultation",
        payoutType: "Outpatient medical costs",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Health AdvantEdge, Complete Health",
    },
    {
        company: "ICICI Lombard", hq: "Mumbai", network: "7,500+",
        riderType: "OPD",
        riderName: "OPD Rider",
        description: "Doctor consultations, medicines, diagnostic tests without hospitalization",
        payoutType: "OPD expenses",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Multiple plans",
    },
    {
        company: "ICICI Lombard", hq: "Mumbai", network: "7,500+",
        riderType: "Other",
        riderName: "Home Care Treatment Rider",
        description: "Domiciliary medical treatment as advised by physician",
        payoutType: "Home treatment costs",
        waitingPeriod: "3 days hospitalization minimum", survivalPeriod: "N/A",
        plans: "Health Shield 360",
    },
    {
        company: "ICICI Lombard", hq: "Mumbai", network: "7,500+",
        riderType: "Other",
        riderName: "Teleconsultation Rider",
        description: "Online doctor consultations for routine health issues",
        payoutType: "Consultation fees",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "iShield, COVID Shield",
    },
    {
        company: "ICICI Lombard", hq: "Mumbai", network: "7,500+",
        riderType: "Room Rent Waiver",
        riderName: "Room Rent Capping Rider",
        description: "Premium discount with room rent cap",
        payoutType: "Premium reduction",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Health AdvantEdge",
    },

    // ── Aditya Birla Health Insurance ─────────────────────────────────────────
    {
        company: "Aditya Birla", hq: "Bangalore", network: "11,000+",
        riderType: "PED Waiver",
        riderName: "Chronic Care Rider (Day 1 PED)",
        description: "Asthma, BP, cholesterol, diabetes - coverage from day 1",
        payoutType: "Medical expenses for chronic conditions",
        waitingPeriod: "Zero waiting period", survivalPeriod: "N/A",
        plans: "Activ One Max",
    },
    {
        company: "Aditya Birla", hq: "Bangalore", network: "11,000+",
        riderType: "Other",
        riderName: "Durable Equipment Cover Rider",
        description: "Wheelchairs, ventilators, crutches, CPAP machines",
        payoutType: "Equipment cost up to limit",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Activ One Max",
    },
    {
        company: "Aditya Birla", hq: "Bangalore", network: "11,000+",
        riderType: "Other",
        riderName: "Vaccine Cover Rider",
        description: "Epidemic and pandemic vaccines",
        payoutType: "Vaccination costs",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Activ One Max",
    },
    {
        company: "Aditya Birla", hq: "Bangalore", network: "11,000+",
        riderType: "PED Waiver",
        riderName: "Disease Management Rider",
        description: "Hypertension, diabetes with zero-day wait",
        payoutType: "Chronic disease management",
        waitingPeriod: "Zero days", survivalPeriod: "N/A",
        plans: "Activ One variants",
    },
    {
        company: "Aditya Birla", hq: "Bangalore", network: "11,000+",
        riderType: "Wellness",
        riderName: "HealthReturns Program",
        description: "Fitness rewards - earn premium cashback up to 30%",
        payoutType: "Annual cashback for fitness activities",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Activ One Prime, Elite, NXT",
    },

    // ── Star Health Insurance ─────────────────────────────────────────────────
    {
        company: "Star Health", hq: "Chennai", network: "13,721+",
        riderType: "PED Waiver",
        riderName: "Buy Back PED Rider",
        description: "Reduces pre-existing disease waiting from 36 to 12 months",
        payoutType: "Faster coverage for pre-existing conditions",
        waitingPeriod: "12 months (reduced from 36)", survivalPeriod: "N/A",
        plans: "Star Comprehensive",
    },
    {
        company: "Star Health", hq: "Chennai", network: "13,721+",
        riderType: "Other",
        riderName: "Lump Sum on Cancer Diagnosis Rider",
        description: "First diagnosis of cancer",
        payoutType: "Lump sum rider amount",
        waitingPeriod: "180 days", survivalPeriod: "N/A",
        plans: "Star Women Care",
    },
    {
        company: "Star Health", hq: "Chennai", network: "13,721+",
        riderType: "Other",
        riderName: "Lump Sum Cancer Recurrence Rider",
        description: "Metastasis, recurrence, second malignancy of cancer",
        payoutType: "Lump sum benefit",
        waitingPeriod: "30 months", survivalPeriod: "N/A",
        plans: "Star Cancer Care",
    },
    {
        company: "Star Health", hq: "Chennai", network: "13,721+",
        riderType: "Other",
        riderName: "Deductible Rider",
        description: "Premium discount with aggregate deductible",
        payoutType: "Up to 50% premium discount",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Star Health Assure",
    },
    {
        company: "Star Health", hq: "Chennai", network: "13,721+",
        riderType: "Other",
        riderName: "Patient Care Rider",
        description: "Attendant charges post-hospitalization",
        payoutType: "Home nursing attendant cost",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Star Medi Classic",
    },
    {
        company: "Star Health", hq: "Chennai", network: "13,721+",
        riderType: "Hospital Cash",
        riderName: "Hospital Cash Rider",
        description: "Daily cash for hospitalization",
        payoutType: "Rs 1000 per day (max 7 days)",
        waitingPeriod: "24 hours hospitalization", survivalPeriod: "N/A",
        plans: "Star Medi Classic",
    },

    // ── Care Health Insurance ─────────────────────────────────────────────────
    {
        company: "Care Health", hq: "Bangalore", network: "10,000+",
        riderType: "Critical Illness",
        riderName: "Critical Illness Rider",
        description: "32 critical illnesses (cancer, stroke, heart attack, kidney failure, paralysis, brain tumor, blindness, etc.)",
        payoutType: "Lump sum on diagnosis",
        waitingPeriod: "Varies by condition", survivalPeriod: "Varies by condition",
        plans: "Care Advantage, Care Supreme, Care Insurance, Care Classic",
    },
    {
        company: "Care Health", hq: "Bangalore", network: "10,000+",
        riderType: "OPD",
        riderName: "OPD Care Rider",
        description: "Doctor consultations, pharmacy, medical devices, COVID-19 vaccinations, diagnostics",
        payoutType: "OPD expenses up to limit",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Care Classic, Care Insurance, Care Heart, Care Senior Advantage",
    },
    {
        company: "Care Health", hq: "Bangalore", network: "10,000+",
        riderType: "Mental Health",
        riderName: "Mental Health Wellbeing Rider",
        description: "Depression, anxiety, PTSD, OCD - outpatient consultations and rehabilitation",
        payoutType: "Mental health counseling costs",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Care Supreme",
    },
    {
        company: "Care Health", hq: "Bangalore", network: "10,000+",
        riderType: "Consumables",
        riderName: "Claim Shield Rider",
        description: "Non-payable items generally excluded from insurance",
        payoutType: "Non-medical expense coverage",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Care Supreme",
    },
    {
        company: "Care Health", hq: "Bangalore", network: "10,000+",
        riderType: "PED Waiver",
        riderName: "Instant Cover Rider",
        description: "Shorter waiting period for select pre-existing diseases",
        payoutType: "PED coverage",
        waitingPeriod: "Reduced period", survivalPeriod: "N/A",
        plans: "Care Supreme",
    },

    // ── Bajaj Allianz ─────────────────────────────────────────────────────────
    {
        company: "Bajaj Allianz", hq: "Pune", network: "5,000+",
        riderType: "OPD",
        riderName: "Health Prime Rider (OPD)",
        description: "Doctor consultations, dental wellness, diet/nutrition, emotional wellness, fitness, pathology/radiology",
        payoutType: "OPD expenses and wellness services",
        waitingPeriod: "30 days", survivalPeriod: "N/A",
        plans: "My Health Care Plan and variants",
    },
    {
        company: "Bajaj Allianz", hq: "Pune", network: "5,000+",
        riderType: "Other",
        riderName: "Respect Rider (Senior Care)",
        description: "SOS alert, doctor-on-call, 24x7 ambulance for senior citizens",
        payoutType: "Emergency assistance services",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "My Health Care Plan",
    },
    {
        company: "Bajaj Allianz", hq: "Pune", network: "5,000+",
        riderType: "International Cover",
        riderName: "International Cover - Emergency Care Rider",
        description: "Overseas hospitalization during emergency (USA, Canada, worldwide)",
        payoutType: "Emergency treatment costs abroad",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "My Health Care Plan",
    },
    {
        company: "Bajaj Allianz", hq: "Pune", network: "5,000+",
        riderType: "Disability",
        riderName: "Loss of Income Rider",
        description: "Weekly payment if hospitalized for 72+ hours",
        payoutType: "Weekly benefit for up to 8 weeks",
        waitingPeriod: "72 hours", survivalPeriod: "N/A",
        plans: "My Health Care Plan",
    },
    {
        company: "Bajaj Allianz", hq: "Pune", network: "5,000+",
        riderType: "Other",
        riderName: "Major Illness and Accident Multiplier Rider",
        description: "Double sum insured for critical illnesses and accidental injuries",
        payoutType: "2x sum insured for specific conditions",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "My Health Care Plan",
    },
    {
        company: "Bajaj Allianz", hq: "Pune", network: "5,000+",
        riderType: "Disability",
        riderName: "Loss of Income from Disability Rider",
        description: "Weekly allowance for accidental disability preventing work",
        payoutType: "Up to Rs 50,000 per week (100 weeks max)",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "My Health Care Plan",
    },

    // ── Manipal Cigna ─────────────────────────────────────────────────────────
    {
        company: "Manipal Cigna", hq: "Bangalore", network: "10,000+",
        riderType: "OPD",
        riderName: "Health 360 OPD Rider",
        description: "Doctor consultation, diagnostics, pharmacy expenses",
        payoutType: "OPD expenses up to limit",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Multiple plans",
    },
    {
        company: "Manipal Cigna", hq: "Bangalore", network: "10,000+",
        riderType: "Consumables",
        riderName: "Health 360 Shield Rider",
        description: "Non-medical expenses (gloves, oxygen, consumables), durable equipment up to Rs 1 lakh",
        payoutType: "Non-medical items coverage",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Multiple plans",
    },
    {
        company: "Manipal Cigna", hq: "Bangalore", network: "10,000+",
        riderType: "Restoration",
        riderName: "Health 360 Advance Rider",
        description: "100% unlimited restoration of sum insured, any room category, air ambulance up to Rs 10 lakh",
        payoutType: "Sum insured restoration + transportation",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Multiple plans",
    },

    // ── Go Digit ──────────────────────────────────────────────────────────────
    {
        company: "Go Digit", hq: "Bangalore", network: "9,000+",
        riderType: "Restoration",
        riderName: "Double Wallet Rider",
        description: "Double backup sum insured available after base exhaustion",
        payoutType: "2x sum insured as backup",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Digit Double Wallet Plan",
    },
    {
        company: "Go Digit", hq: "Bangalore", network: "9,000+",
        riderType: "Restoration",
        riderName: "Infinity Wallet Rider",
        description: "Unlimited backup coverage after base exhaustion",
        payoutType: "Unlimited additional coverage",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Digit Infinity Wallet Plan",
    },
    {
        company: "Go Digit", hq: "Bangalore", network: "9,000+",
        riderType: "International Cover",
        riderName: "Worldwide Treatment Rider",
        description: "Global medical treatment coverage across all countries",
        payoutType: "International treatment costs",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Digit Worldwide Treatment Plan",
    },
    {
        company: "Go Digit", hq: "Bangalore", network: "9,000+",
        riderType: "PED Waiver",
        riderName: "PED Waiting Period Modification",
        description: "Reduces pre-existing disease waiting period",
        payoutType: "Modified waiting period",
        waitingPeriod: "Reduced", survivalPeriod: "N/A",
        plans: "Multiple plans",
    },

    // ── Reliance General ──────────────────────────────────────────────────────
    {
        company: "Reliance General", hq: "Mumbai", network: "8,000+",
        riderType: "Critical Illness",
        riderName: "Critical Illness Rider",
        description: "10-12 listed critical illnesses",
        payoutType: "Lump sum on diagnosis",
        waitingPeriod: "N/A", survivalPeriod: "30 days",
        plans: "Multiple plans",
    },
    {
        company: "Reliance General", hq: "Mumbai", network: "8,000+",
        riderType: "Maternity",
        riderName: "Maternity and Newborn Rider",
        description: "Pregnancy, delivery, newborn expenses",
        payoutType: "Medical expenses",
        waitingPeriod: "Varies", survivalPeriod: "N/A",
        plans: "Multiple plans",
    },
    {
        company: "Reliance General", hq: "Mumbai", network: "8,000+",
        riderType: "Other",
        riderName: "Organ Donor Rider",
        description: "Organ donation expenses",
        payoutType: "Donor treatment costs",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Multiple plans",
    },
    {
        company: "Reliance General", hq: "Mumbai", network: "8,000+",
        riderType: "Air Ambulance",
        riderName: "Super Charger Benefit",
        description: "Air ambulance coverage",
        payoutType: "Emergency transport",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Smart Protector plan",
    },
    {
        company: "Reliance General", hq: "Mumbai", network: "8,000+",
        riderType: "Other",
        riderName: "Double Cover Rider",
        description: "Double sum insured for specific conditions",
        payoutType: "2x coverage",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Multiple plans",
    },

    // ── New India Assurance ───────────────────────────────────────────────────
    {
        company: "New India Assurance", hq: "New Delhi", network: "7,000+",
        riderType: "Critical Illness",
        riderName: "Critical Illness Rider",
        description: "Listed critical illnesses",
        payoutType: "Lump sum benefit",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Multiple base policies",
    },
    {
        company: "New India Assurance", hq: "New Delhi", network: "7,000+",
        riderType: "Consumables",
        riderName: "Non-Medical Expenses Rider",
        description: "Consumables and non-medical items (gloves, scissors, etc.) up to Rs 15,000",
        payoutType: "Non-medical item coverage",
        waitingPeriod: "None", survivalPeriod: "N/A",
        plans: "14 base policies with Rs 5L+ sum insured",
    },
    {
        company: "New India Assurance", hq: "New Delhi", network: "7,000+",
        riderType: "Other",
        riderName: "Pre and Post Hospitalization Rider",
        description: "Pre-hospitalization 90 days, post-hospitalization 180 days",
        payoutType: "Medical expenses before/after hospitalization",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Multiple base policies",
    },
    {
        company: "New India Assurance", hq: "New Delhi", network: "7,000+",
        riderType: "Maternity",
        riderName: "Maternity Rider",
        description: "Childbirth and maternity expenses",
        payoutType: "Medical expenses",
        waitingPeriod: "9 months", survivalPeriod: "N/A",
        plans: "Multiple policies",
    },
    {
        company: "New India Assurance", hq: "New Delhi", network: "7,000+",
        riderType: "Other",
        riderName: "Durable Medical Devices Rider",
        description: "Medical equipment like wheelchairs, ventilators",
        payoutType: "Equipment cost",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Multiple policies",
    },
    {
        company: "New India Assurance", hq: "New Delhi", network: "7,000+",
        riderType: "Other",
        riderName: "Modern Treatment Rider",
        description: "Advanced and modern treatment methods",
        payoutType: "Treatment costs",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Multiple policies",
    },

    // ── Royal Sundaram ────────────────────────────────────────────────────────
    {
        company: "Royal Sundaram", hq: "Chennai", network: "6,000+",
        riderType: "Maternity",
        riderName: "Maternity and Newborn Rider",
        description: "Pregnancy, delivery, newborn care",
        payoutType: "Medical expenses",
        waitingPeriod: "Varies by plan", survivalPeriod: "N/A",
        plans: "Lifeline plans",
    },
    {
        company: "Royal Sundaram", hq: "Chennai", network: "6,000+",
        riderType: "Restoration",
        riderName: "Auto-Recharge Rider",
        description: "Sum insured recharges even after claims",
        payoutType: "Restored coverage amount",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Lifeline plans",
    },
    {
        company: "Royal Sundaram", hq: "Chennai", network: "6,000+",
        riderType: "Other",
        riderName: "Multiplier Rider",
        description: "11x sum insured for emergency complications",
        payoutType: "Up to 11x coverage",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Multiplier Health Plan",
    },
    {
        company: "Royal Sundaram", hq: "Chennai", network: "6,000+",
        riderType: "Maternity",
        riderName: "Surrogacy Rider",
        description: "Surrogate mother and oocyte donor healthcare",
        payoutType: "Surrogacy-related medical costs",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "SurroSafe Plan",
    },

    // ── Liberty General ───────────────────────────────────────────────────────
    {
        company: "Liberty General", hq: "New Delhi", network: "2,906+",
        riderType: "Hospital Cash",
        riderName: "Daily Hospital Cash Rider",
        description: "Daily cash allowance during hospitalization",
        payoutType: "Fixed daily amount",
        waitingPeriod: "24 hours hospitalization", survivalPeriod: "N/A",
        plans: "Multiple plans",
    },
    {
        company: "Liberty General", hq: "New Delhi", network: "2,906+",
        riderType: "Other",
        riderName: "Accidental Death Rider",
        description: "Death due to accident",
        payoutType: "Lump sum to nominee",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Multiple plans",
    },
    {
        company: "Liberty General", hq: "New Delhi", network: "2,906+",
        riderType: "Critical Illness",
        riderName: "Critical Illness Rider",
        description: "59 critical illnesses listed",
        payoutType: "Lump sum benefit",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Multiple plans",
    },
    {
        company: "Liberty General", hq: "New Delhi", network: "2,906+",
        riderType: "Other",
        riderName: "Loan Protector Rider",
        description: "Loan payment assistance on critical illness/accident",
        payoutType: "Loan coverage",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Optional covers",
    },

    // ── Cholamandalam (Chola) ─────────────────────────────────────────────────
    {
        company: "Cholamandalam", hq: "Chennai", network: "10,000+",
        riderType: "Critical Illness",
        riderName: "Critical Illness Rider",
        description: "Up to 50 critical illnesses",
        payoutType: "Lump sum on diagnosis",
        waitingPeriod: "Varies by condition", survivalPeriod: "30 days",
        plans: "Multiple plans",
    },
    {
        company: "Cholamandalam", hq: "Chennai", network: "10,000+",
        riderType: "Maternity",
        riderName: "Maternity Rider",
        description: "Childbirth and pregnancy expenses",
        payoutType: "Medical expenses",
        waitingPeriod: "9-12 months", survivalPeriod: "N/A",
        plans: "Healthline plans",
    },
    {
        company: "Cholamandalam", hq: "Chennai", network: "10,000+",
        riderType: "Restoration",
        riderName: "Unlimited Restoration Rider",
        description: "Unlimited sum insured restoration",
        payoutType: "Full coverage restoration",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Flexi Health Supreme",
    },
    {
        company: "Cholamandalam", hq: "Chennai", network: "10,000+",
        riderType: "Hospital Cash",
        riderName: "Daily Care Benefit Rider",
        description: "Daily allowance during hospitalization",
        payoutType: "Fixed daily amount",
        waitingPeriod: "24 hours hospitalization", survivalPeriod: "N/A",
        plans: "Flexi Health Supreme",
    },
    {
        company: "Cholamandalam", hq: "Chennai", network: "10,000+",
        riderType: "Other",
        riderName: "Medical Second Opinion Rider",
        description: "Cost of seeking second medical opinion",
        payoutType: "Consultation fees",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Flexi Health plans",
    },

    // ── ACKO ──────────────────────────────────────────────────────────────────
    {
        company: "ACKO", hq: "Bangalore", network: "10,000+",
        riderType: "Hospital Cash",
        riderName: "Hospital Cash Rider",
        description: "Daily cash during hospitalization (24+ hours)",
        payoutType: "Rs 500-3000 per day; higher for ICU",
        waitingPeriod: "24 hours", survivalPeriod: "N/A",
        plans: "ACKO health plans",
    },
    {
        company: "ACKO", hq: "Bangalore", network: "10,000+",
        riderType: "Maternity",
        riderName: "Maternity Rider",
        description: "Childbirth, prenatal, postnatal, newborn care",
        payoutType: "Medical expenses for maternity",
        waitingPeriod: "Varies", survivalPeriod: "N/A",
        plans: "ACKO plans with rider option",
    },
    {
        company: "ACKO", hq: "Bangalore", network: "10,000+",
        riderType: "Consumables",
        riderName: "Zero Deduction Rider",
        description: "Full hospitalization coverage including consumables",
        payoutType: "100% claim without deductions",
        waitingPeriod: "None", survivalPeriod: "N/A",
        plans: "ACKO Platinum Plans",
    },
    {
        company: "ACKO", hq: "Bangalore", network: "10,000+",
        riderType: "PED Waiver",
        riderName: "PED Rider",
        description: "Pre-existing disease coverage",
        payoutType: "PED treatment costs",
        waitingPeriod: "Varies", survivalPeriod: "N/A",
        plans: "ACKO plans",
    },

    // ── SBI General ───────────────────────────────────────────────────────────
    {
        company: "SBI General", hq: "New Delhi", network: "6,000+",
        riderType: "Critical Illness",
        riderName: "Critical Illness Rider",
        description: "Listed critical illnesses",
        payoutType: "Lump sum benefit",
        waitingPeriod: "90 days", survivalPeriod: "N/A",
        plans: "Super Health Platinum Infinite and others",
    },
    {
        company: "SBI General", hq: "New Delhi", network: "6,000+",
        riderType: "Maternity",
        riderName: "Maternity Rider",
        description: "Pregnancy and childbirth expenses",
        payoutType: "Medical expenses",
        waitingPeriod: "9-12 months", survivalPeriod: "N/A",
        plans: "Multiple SBI plans",
    },
    {
        company: "SBI General", hq: "New Delhi", network: "6,000+",
        riderType: "OPD",
        riderName: "OPD Rider",
        description: "Outpatient department expenses",
        payoutType: "OPD costs",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "SBI health plans",
    },

    // ── Raheja QBE ────────────────────────────────────────────────────────────
    {
        company: "Raheja QBE", hq: "Mumbai", network: "6,446+",
        riderType: "Critical Illness",
        riderName: "Critical Illness Rider",
        description: "Major critical illnesses",
        payoutType: "Lump sum on diagnosis",
        waitingPeriod: "Varies", survivalPeriod: "N/A",
        plans: "Multiple Raheja plans",
    },
    {
        company: "Raheja QBE", hq: "Mumbai", network: "6,446+",
        riderType: "Disability",
        riderName: "Accidental Disability Rider",
        description: "Total/partial disability from accidents",
        payoutType: "Disability benefit",
        waitingPeriod: "N/A", survivalPeriod: "N/A",
        plans: "Raheja plans",
    },
];

// ─── Lookup functions ─────────────────────────────────────────────────────────

/** Existing — keyword search across riderName + description (backward-compatible) */
export function findRiders(keyword: string): RiderEntry[] {
    return RIDERS_DATABASE.filter(
        (r) =>
            r.riderName.toLowerCase().includes(keyword.toLowerCase()) ||
            r.description.toLowerCase().includes(keyword.toLowerCase())
    );
}

/** Find all entries for a structured rider type */
export function findRidersByType(type: RiderType): RiderEntry[] {
    return RIDERS_DATABASE.filter((r) => r.riderType === type);
}

/** Get unique companies offering a given rider type */
export function getProvidersByType(type: RiderType): string[] {
    return Array.from(new Set(findRidersByType(type).map((r) => r.company)));
}
