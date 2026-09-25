// Rider directory — real current rider catalogs, sourced company-by-company.
// `mustHave` mirrors the insurer's own "★ Must Have" flag.

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
    | "Premium Benefit"
    | "Second Opinion"
    | "Durable Equipment"
    | "Home Care"
    | "Accident"
    | "Other";

export interface RiderEntry {
    company: string;
    riderType: RiderType;
    riderName: string;
    description: string;
    /** Insurer-flagged "Must Have" rider. */
    mustHave?: boolean;
    // Optional structured metadata (present for some insurers, not all):
    hq?: string;
    network?: string;
    payoutType?: string;
    waitingPeriod?: string;
    survivalPeriod?: string;
    plans?: string;
}

// ─── Full database ────────────────────────────────────────────────────────────

export const RIDERS_DATABASE: RiderEntry[] = [
    // ── Care Health ───────────────────────────────────────────────────────────
    { company: "Care Health", hq: "Bangalore", network: "10,000+", riderType: "Consumables", riderName: "Claim-Shield", description: "Covers non-payable / consumable items (Lists I–IV of Annexure I).", mustHave: true },
    { company: "Care Health", riderType: "Premium Benefit", riderName: "Money Back", description: "Refund of your first year's base premium after every 5 claim-free years.", mustHave: true },
    { company: "Care Health", riderType: "NCB Booster", riderName: "Infinity Bonus", description: "Unlimited 100% increase in Sum Insured every year, even if you make a claim." },
    { company: "Care Health", riderType: "PED Waiver", riderName: "Reduction in PED", description: "Reduce pre-existing disease waiting period to 1 or 2 years (from default 3)." },
    { company: "Care Health", riderType: "PED Waiver", riderName: "Instant Cover", description: "Cover for Diabetes, Thyroid, Heart, Hypertension, Hyperlipidemia & Asthma after a 30-day wait." },
    { company: "Care Health", riderType: "Premium Benefit", riderName: "Grace Period", description: "Policy stays active during the grace period, ensuring continuous protection." },
    { company: "Care Health", riderType: "Wellness", riderName: "Annual Health Check-up", description: "Health check-up once for all insured every policy year." },
    { company: "Care Health", riderType: "OPD", riderName: "Unlimited E-Consultations", description: "Unlimited online consultations with a general physician." },
    { company: "Care Health", riderType: "Wellness", riderName: "Wellness Benefit", description: "Up to 30% discount on renewal premium for hitting 10,000 steps a day." },
    { company: "Care Health", riderType: "Restoration", riderName: "Unlimited Care", description: "Full coverage with no limit on any single claim for the lifetime of the policy." },
    { company: "Care Health", riderType: "Wellness", riderName: "Be-Fit Plus", description: "Unlimited cashless visits to network fitness centres (members aged 12+)." },
    { company: "Care Health", riderType: "OPD", riderName: "Out-Patient Consultations", description: "Up to ₹5,000/yr for GP & specialist consultations per member (₹500 per member per visit)." },
    { company: "Care Health", riderType: "Premium Benefit", riderName: "Premium Freeze", description: "Freeze your premium at entry age and avoid age-based increases until a claim is paid." },

    // ── Niva Bupa ─────────────────────────────────────────────────────────────
    { company: "Niva Bupa", hq: "Mumbai", network: "10,400+", riderType: "Consumables", riderName: "Claims Safeguard Benefit", description: "Covers all non-payable items (Lists I–IV).", mustHave: true },
    { company: "Niva Bupa", riderType: "PED Waiver", riderName: "Day 1 Pre-Existing Disease Coverage", description: "Protection against declared chronic conditions (diabetes, hypertension, etc.) from day one.", mustHave: true },
    { company: "Niva Bupa", riderType: "PED Waiver", riderName: "Specific Disease Wait Time Modification", description: "Modify the specific-disease waiting period to 1 or 3 years." },
    { company: "Niva Bupa", riderType: "PED Waiver", riderName: "Pre-Existing Disease Wait Time Modification", description: "Modify the pre-existing-disease waiting period to 1 or 2 years." },
    { company: "Niva Bupa", riderType: "Wellness", riderName: "Annual Health Check-Up", description: "Day-1 cashless health check-up as per defined packages." },
    { company: "Niva Bupa", riderType: "Wellness", riderName: "NivaBupaOne", description: "Membership with Executive Health Assessment, priority claims & dedicated support." },
    { company: "Niva Bupa", riderType: "Hospital Cash", riderName: "Hospital Daily Cash", description: "₹1,000 per day for hospitalization, up to 30 days a year." },
    { company: "Niva Bupa", riderType: "Premium Benefit", riderName: "Cash-Bag+", description: "Earn 10% of premium for each referral that converts to a Niva Bupa policy." },
    { company: "Niva Bupa", riderType: "International Cover", riderName: "Borderless", description: "Treatment anywhere in the world up to Sum Insured, with co-pay options (not for NRIs)." },
    { company: "Niva Bupa", riderType: "International Cover", riderName: "Borderless for Specified Illnesses", description: "Planned global treatment for listed illnesses (cancer, heart attack, CABG, transplant, stroke, aorta surgery, angioplasty, brain surgery, etc.). [details truncated]" },

    // ── Star Health ───────────────────────────────────────────────────────────
    { company: "Star Health", hq: "Chennai", network: "14,000+", riderType: "Wellness", riderName: "Preventive Health Check-up", description: "Health check-up packages A/B/C (CBC, glucose, lipid profile, thyroid, and more).", mustHave: true },
    { company: "Star Health", riderType: "PED Waiver", riderName: "Quick Shield", description: "Day-31 cover for Hypertension, Diabetes, Heart Disease, Asthma and Hyperlipidemia.", mustHave: true },
    { company: "Star Health", riderType: "Wellness", riderName: "StayFit", description: "Cashless network fitness-centre visits (18+), after a 30-day wait." },
    { company: "Star Health", riderType: "OPD", riderName: "In-Clinic Consultation (up to 4)", description: "Cashless physical OPD consultations within network." },
    { company: "Star Health", riderType: "OPD", riderName: "E-Connect", description: "Digital healthcare services after a 30-day wait." },
    { company: "Star Health", riderType: "Consumables", riderName: "Non-Medical Items (Consumables) Cover", description: "Covers List-I non-medical items for admissible in-patient / day-care claims." },

    // ── Aditya Birla ──────────────────────────────────────────────────────────
    { company: "Aditya Birla", hq: "Mumbai", network: "11,000+", riderType: "PED Waiver", riderName: "Reduction in Pre-Existing Disease Waiting Period", description: "Reduce PED waiting period from 3 years to 1 or 2 years.", mustHave: true },
    { company: "Aditya Birla", riderType: "NCB Booster", riderName: "Super Credit", description: "100% of base SI per year up to 500% (max ₹3 Cr); increases regardless of claims.", mustHave: true },
    { company: "Aditya Birla", riderType: "Wellness", riderName: "Annual Health Check-up", description: "Listed cashless health check-up once every year." },
    { company: "Aditya Birla", riderType: "Durable Equipment", riderName: "Durable Equipment Cover", description: "Covers ventilator, wheelchair, prosthetics, oxygen concentrator, infusion pump and more." },
    { company: "Aditya Birla", riderType: "Wellness", riderName: "HLTH Meter (Wellness & Mental Health Tracking)", description: "Fitness wearable + mental-health tracking, stress detection and unlimited tele support." },
    { company: "Aditya Birla", riderType: "Second Opinion", riderName: "Second Medical Opinion", description: "Second medical opinion for 27 listed major illnesses." },
    { company: "Aditya Birla", riderType: "Consumables", riderName: "Claim Protect", description: "Covers non-payable items (all 4 lists of Annexure I)." },

    // ── HDFC ERGO ─────────────────────────────────────────────────────────────
    { company: "HDFC ERGO", hq: "Mumbai", network: "12,000+", riderType: "OPD", riderName: "Optima Wellbeing", description: "Unlimited GP in-person & tele consults, home sample collection, up to 50% off labs/scans/medicines.", mustHave: true },
    { company: "HDFC ERGO", riderType: "Hospital Cash", riderName: "Hospi Cash", description: "Hospital daily cash of ₹1,000 / ₹2,000 to cover out-of-pocket expenses.", mustHave: true },
    { company: "HDFC ERGO", riderType: "PED Waiver", riderName: "ABCD Chronic Care", description: "Asthma, Blood pressure, Cholesterol and Diabetes covered from the 31st day." },
    { company: "HDFC ERGO", riderType: "Critical Illness", riderName: "Serious Illness Booster", description: "Additional 100% coverage for 9 serious illnesses (cancer, CABG, kidney failure, heart attack, transplant, paralysis, stroke, etc.)." },

    // ── ICICI Lombard ─────────────────────────────────────────────────────────
    { company: "ICICI Lombard", hq: "Mumbai", network: "7,500+", riderType: "OPD", riderName: "OPD+", description: "All insured members can claim up to the opted OPD+ cover after the initial waiting period." },
    { company: "ICICI Lombard", riderType: "Restoration", riderName: "Infinite Care", description: "Full coverage with no limit on any single claim for the lifetime of the policy.", mustHave: true },
    { company: "ICICI Lombard", riderType: "NCB Booster", riderName: "Power Booster", description: "Additional 100% sum insured each year, regardless of claims.", mustHave: true },
    { company: "ICICI Lombard", riderType: "PED Waiver", riderName: "Jump Start", description: "Declared chronic conditions covered from the 31st day." },
    { company: "ICICI Lombard", riderType: "Consumables", riderName: "Claim Protector", description: "Covers non-payable items so there are no out-of-pocket expenses on a claim." },
    { company: "ICICI Lombard", riderType: "PED Waiver", riderName: "PED Waiting Period", description: "Reduce pre-existing disease waiting period to 1 or 2 years from default 3." },
    { company: "ICICI Lombard", riderType: "Other", riderName: "Sum Insured Protect", description: "Each renewal, base sum insured increases by last year's inflation rate." },
    { company: "ICICI Lombard", riderType: "Wellness", riderName: "Annual Health Checkup", description: "Health check-ups worth up to ₹5,000 at network providers anytime during the policy." },
    { company: "ICICI Lombard", riderType: "OPD", riderName: "BeFit C", description: "Up to 4 OPD consults, ₹1,000 diagnostics, ₹1,000 pharmacy, plus physio/e-counsel/diet sessions." },
    { company: "ICICI Lombard", riderType: "PED Waiver", riderName: "Specific Disease Waiting Period", description: "Reduce specific-disease waiting period to 1 year from default 2." },
    { company: "ICICI Lombard", riderType: "Home Care", riderName: "Dependent Accommodation", description: "Up to ₹1,000/day (max 10 days) for a family member's accommodation during hospitalization." },
    { company: "ICICI Lombard", riderType: "Durable Equipment", riderName: "Durable Medical Equipment Cover", description: "Up to ₹5 lakh for listed durable medical equipment prescribed by your doctor." },
    { company: "ICICI Lombard", riderType: "Home Care", riderName: "Compassionate Visit", description: "Reimburses a family member's economy travel (up to ₹20,000) if hospitalized outside home city >5 days." },
    { company: "ICICI Lombard", riderType: "International Cover", riderName: "Worldwide Cover", description: "Global hospitalization incl. USA & Canada up to annual SI (max ₹3 Cr); 2-year wait except accidents." },
    { company: "ICICI Lombard", riderType: "Other", riderName: "Convalescence Benefit", description: "One-time ₹20,000 if hospitalized continuously for 10+ days." },
    { company: "ICICI Lombard", riderType: "Air Ambulance", riderName: "Domestic Air Ambulance Cover", description: "Emergency air ambulance services up to the annual sum insured." },
    { company: "ICICI Lombard", riderType: "OPD", riderName: "Tele Consultation", description: "Unlimited teleconsultations with medical practitioners for routine concerns." },
    { company: "ICICI Lombard", riderType: "Other", riderName: "Inflation Protector", description: "Sum insured linked to CPI; rises cumulatively each renewal by previous year's inflation." },
    { company: "ICICI Lombard", riderType: "International Cover", riderName: "Worldwide Cover Waiting Period Reduction", description: "Reduce worldwide-cover waiting period to 0 or 1 year (requires Worldwide Cover rider). [premium truncated]" },

    // ── Tata AIG ──────────────────────────────────────────────────────────────
    { company: "Tata AIG", riderType: "NCB Booster", riderName: "Supercharge Bonus", description: "Bonus as a % of base SI each renewal regardless of claims (up to 500%).", mustHave: true },
    { company: "Tata AIG", riderType: "Consumables", riderName: "Consumables", description: "Covers non-medical items listed under Annexure I.", mustHave: true },
    { company: "Tata AIG", riderType: "PED Waiver", riderName: "Advanced Cover", description: "30-day waiting period for Diabetes (Type 2), Hypertension, Hyperlipidemia and Asthma." },
    { company: "Tata AIG", riderType: "Wellness", riderName: "Preventive Annual Health Check-up", description: "Cashless medical tests once a policy year." },
    { company: "Tata AIG", riderType: "Accident", riderName: "Additional Sum Insured for Accidental Hospitalization", description: "Additional SI equal to base plan for hospitalization solely due to an accident." },
    { company: "Tata AIG", riderType: "Home Care", riderName: "Home Care Treatment", description: "Covers at-home treatment expenses up to SI; pandemic care up to 25% of SI." },
    { company: "Tata AIG", riderType: "Second Opinion", riderName: "International Second Opinion", description: "Second opinion from worldwide providers for listed illnesses, once per illness per year." },
    { company: "Tata AIG", riderType: "Wellness", riderName: "Health Condition Management Program", description: "Nutrition, weight, chronic condition, cancer care, stress management and health coaching." },
    { company: "Tata AIG", riderType: "Accident", riderName: "Accidental Death Benefit", description: "100% of sum insured on death of the insured due to an accident." },
    { company: "Tata AIG", riderType: "Air Ambulance", riderName: "Emergency Air Ambulance", description: "Covers expenses of shifting patients via air ambulance in an emergency." },
    { company: "Tata AIG", riderType: "Critical Illness", riderName: "Cancer Benefit", description: "Pays the specified sum insured on diagnosis of Cancer of Specified Severity." },
    { company: "Tata AIG", riderType: "Mental Health", riderName: "Mental Wellbeing", description: "Mental-health screening, psychological therapy, vocational rehab, diet & stress/addiction programs." },
    { company: "Tata AIG", riderType: "Restoration", riderName: "Infinite Advantage", description: "One lifetime claim with no limit on base SI for in-patient / day-care treatment." },
    { company: "Tata AIG", riderType: "OPD", riderName: "Pocket Saver 2.0", description: "Out-patient treatment & consultations, dental & vision care, and GP teleconsultation." },
    { company: "Tata AIG", riderType: "Second Opinion", riderName: "Domestic Second Opinion", description: "Second opinion from trusted Indian doctors via phone, video or app." },
    { company: "Tata AIG", riderType: "Premium Benefit", riderName: "Carry Forward of Unutilized Sum Insured", description: "Carry forward unused in-patient SI from the previous year to the next at renewal." },

    // ── Bajaj Allianz ─────────────────────────────────────────────────────────
    { company: "Bajaj Allianz", hq: "Pune", network: "5,000+", riderType: "Consumables", riderName: "Consumables Cover", description: "Covers non-medical / consumable expenses during in-patient hospitalization.", mustHave: true },
    { company: "Bajaj Allianz", riderType: "NCB Booster", riderName: "Super Cumulative Bonus", description: "Up to 100% of cover amount per year, max 500% of SI; does not reduce on a claim.", mustHave: true },
    { company: "Bajaj Allianz", riderType: "OPD", riderName: "Health Prime (OPD Coverage)", description: "Unlimited teleconsults, doctor consults & investigations (₹15k–25k) and preventive check-up vouchers." },
    { company: "Bajaj Allianz", riderType: "Restoration", riderName: "Double Sum Insured Benefit", description: "Doubles your cover once a policy year after base SI is fully used." },
    { company: "Bajaj Allianz", riderType: "Room Rent Waiver", riderName: "Room Rent", description: "Upgrade room category to Single Private Room from default Twin Sharing." },
    { company: "Bajaj Allianz", riderType: "PED Waiver", riderName: "PED Waiting Period", description: "Reduce pre-existing disease waiting period to 1 or 2 years from default 3." },
    { company: "Bajaj Allianz", riderType: "PED Waiver", riderName: "Specific Disease Waiting Period", description: "Reduce specific-disease waiting period to 1 or 3 years from default 2." },
    { company: "Bajaj Allianz", riderType: "Other", riderName: "Pre/Post-Hospitalization Medical Expenses", description: "Extend pre-hospitalization to 90 days and post-hospitalization to 180 days." },
    { company: "Bajaj Allianz", riderType: "Critical Illness", riderName: "Major Illness and Accident Multiplier", description: "Doubles cover for listed serious conditions (cancer, CABG, kidney failure, transplant, paralysis, etc.)." },

    // ── Manipal Cigna ─────────────────────────────────────────────────────────
    { company: "Manipal Cigna", hq: "Mumbai", network: "10,000+", riderType: "Restoration", riderName: "Anant", description: "Unlimited SI for Cancer, Heart, Stroke, transplant or accident (base SI ₹10L+; first year only).", mustHave: true },
    { company: "Manipal Cigna", riderType: "Restoration", riderName: "Surplus Benefit", description: "Additional 100% of SI, available from day one for the first claim each policy year.", mustHave: true },
    { company: "Manipal Cigna", riderType: "NCB Booster", riderName: "Gullak", description: "100% additional SI per year up to 1500% of SI, regardless of claims." },
    { company: "Manipal Cigna", riderType: "Restoration", riderName: "Restoration of Sum Insured", description: "Unlimited restoration of SI from the 2nd claim onward, for related or unrelated illnesses." },
    { company: "Manipal Cigna", riderType: "Consumables", riderName: "Non-Medical Items & Durable Medical Equipment", description: "68 non-medical items up to SI, plus 10 durable equipment up to ₹1 lakh." },
    { company: "Manipal Cigna", riderType: "Wellness", riderName: "Annual Health Checkup", description: "Cashless annual health check-up for adult insured within network." },
    { company: "Manipal Cigna", riderType: "Air Ambulance", riderName: "Air Ambulance", description: "Up to SI or a maximum of ₹10 lakh over and above the sum insured." },
    { company: "Manipal Cigna", riderType: "Maternity", riderName: "Maternity & New Born Hospitalization Expenses", description: "20% of SI or max ₹5L; covers 2 deliveries, newborn & first-year vaccination (3-year wait)." },
    { company: "Manipal Cigna", riderType: "Room Rent Waiver", riderName: "Room Rent Modification", description: "Modify room category to Any Room or Twin Sharing from default Single Private Room." },
    { company: "Manipal Cigna", riderType: "Other", riderName: "Sarathi 2.0", description: "Assistance / concierge benefit." },

    // ── IndusInd (distribution; not a selectable partner insurer) ──────────────
    { company: "IndusInd", riderType: "NCB Booster", riderName: "Enhanced Cover", description: "Protects accumulated No Claim Bonus after a claim; guaranteed cumulative bonus 100%/yr up to 300%.", mustHave: true },
    { company: "IndusInd", riderType: "PED Waiver", riderName: "Reduction in Pre-Existing Waiting Period", description: "Reduce pre-existing illness waiting period by 1 or 2 years from 3.", mustHave: true },
    { company: "IndusInd", riderType: "PED Waiver", riderName: "Chronic Shield", description: "Asthma, Diabetes, Hyperlipidaemia and Hypertension covered from day 31 (max 2 diseases)." },
    { company: "IndusInd", riderType: "Restoration", riderName: "Double Cover", description: "Additional 100% of base SI on the same claim in a single hospitalization after base exhausts." },
    { company: "IndusInd", riderType: "Other", riderName: "Convenience Cover", description: "90/180-day pre/post-hospitalization, air ambulance, radio taxi and a lump sum for 7+ day stays." },
    { company: "IndusInd", riderType: "Other", riderName: "Smart Cover", description: "Higher modern-treatment & vision-correction cover plus a second medical opinion." },
    { company: "IndusInd", riderType: "Hospital Cash", riderName: "Hospital Cash Limit", description: "₹1,000/day up to 30 days (15 days ICU); minimum 72-hour hospitalization." },

    // ── Go Digit ──────────────────────────────────────────────────────────────
    { company: "Go Digit", hq: "Bangalore", network: "9,000+", riderType: "NCB Booster", riderName: "Infinite Bonus", description: "100% extra Sum Insured as a bonus every year, with no upper limit.", mustHave: true },
    { company: "Go Digit", riderType: "Consumables", riderName: "Consumables", description: "Covers non-medical expenses as per Lists I–V.", mustHave: true },
    { company: "Go Digit", riderType: "PED Waiver", riderName: "Fast Track", description: "Early 30-day cover for Asthma, Diabetes, Hypertension, Hyperlipidemia and Thyroid." },
    { company: "Go Digit", riderType: "PED Waiver", riderName: "PED Modification Cover", description: "Reduce pre-existing disease waiting period to 2 years." },
    { company: "Go Digit", riderType: "Other", riderName: "Advance Care", description: "Increase modern-treatment cover from 50% to up to 100% of SI under in-patient hospitalization." },
    { company: "Go Digit", riderType: "Air Ambulance", riderName: "Advance Heart Ambulance", description: "Road transport via advanced cardiac ambulance following a cardiac arrest and hospitalization." },
    { company: "Go Digit", riderType: "Home Care", riderName: "Support Plus", description: "Covers food & lodging for an accompanying adult during ICU hospitalization." },

    // ── Zurich Kotak ──────────────────────────────────────────────────────────
    { company: "Zurich Kotak", riderType: "Restoration", riderName: "Double Cover", description: "Additional 100% of base SI on the same claim in a single hospitalization after base exhausts.", mustHave: true },
    { company: "Zurich Kotak", riderType: "Consumables", riderName: "Consumables Cover", description: "Covers non-medical expenses.", mustHave: true },
    { company: "Zurich Kotak", riderType: "Air Ambulance", riderName: "Air Ambulance", description: "Covers expenses of shifting patients via air ambulance." },
    { company: "Zurich Kotak", riderType: "PED Waiver", riderName: "Specified Disease/Procedure Waiting Period Modification", description: "Reduce specific-disease waiting period to 1 year from default 2." },

    // ── Galaxy Health ─────────────────────────────────────────────────────────
    { company: "Galaxy Health", hq: "Chennai", riderType: "Consumables", riderName: "Consumables", description: "List-I items and hospital charges for valid in-patient / day-care claims.", mustHave: true },
    { company: "Galaxy Health", riderType: "Premium Benefit", riderName: "Wealth for Health", description: "Refund of the first policy year's base premium after 5 consecutive claim-free years.", mustHave: true },
    { company: "Galaxy Health", riderType: "Wellness", riderName: "Health Check-up", description: "Health check-up worth ₹1,500–₹20,000 (varies by SI) every year, irrespective of claims." },
    { company: "Galaxy Health", riderType: "PED Waiver", riderName: "Reduction in Pre-Existing Diseases Waiting Period", description: "Reduce PED waiting period from 3 years to 1 or 2 years (at first purchase only)." },
    { company: "Galaxy Health", riderType: "PED Waiver", riderName: "Insta Care Cover", description: "Early 30-day cover for Asthma, Diabetes, Hypertension and Hyperlipidemia (at issuance only)." },
    { company: "Galaxy Health", riderType: "PED Waiver", riderName: "Reduction in Specific Disease Waiting Period", description: "Reduce specific-disease waiting period from 2 years to 1 year." },
    { company: "Galaxy Health", riderType: "Premium Benefit", riderName: "Premium Promise", description: "Entry premium stays fixed until a claim is made or age 55, whichever comes first." },
    { company: "Galaxy Health", riderType: "Durable Equipment", riderName: "Durable Medical Equipment / CAPD", description: "Renting or buying listed medical devices / CAPD up to ₹50,000 (extendable to ₹1 lakh)." },
    { company: "Galaxy Health", riderType: "Home Care", riderName: "Nursing at Home", description: "Post-hospitalization qualified nurse at the insured's residence, ₹3,000–₹30,000 by SI." },
    { company: "Galaxy Health", riderType: "OPD", riderName: "Outpatient Benefit", description: "Teleconsult, in-clinic consults, prescribed pathology/radiology and pharmacy, ₹5,000–₹16,000." },
    { company: "Galaxy Health", riderType: "Maternity", riderName: "Assisted Reproduction Treatment", description: "Covers ART expenses (limit varies by SI); self & spouse covered 2+ continuous years." },

    // ── Universal Sompo (paste truncated — only first rider captured) ──────────
    { company: "Universal Sompo", riderType: "Consumables", riderName: "Coverage for Non-Medical Items", description: "Coverage for non-medical expenses as per List 1 of Annexure 2 of policy wordings.", mustHave: true },
];

// ─── Lookup functions ─────────────────────────────────────────────────────────

/** Keyword search across riderName + description (backward-compatible) */
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

/** Rider entries of a given type offered by any of the supplied companies.
 *  Used by the agent-only calculator bias to surface a partner's actual riders. */
export function getRiderEntriesByTypeForCompanies(
    type: RiderType,
    companies: string[]
): RiderEntry[] {
    if (!companies.length) return [];
    const set = new Set(companies);
    return RIDERS_DATABASE.filter((r) => r.riderType === type && set.has(r.company));
}
