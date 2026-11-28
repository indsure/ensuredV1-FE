// LIC plan directory: every LIC plan number we know, its name, and whether it is still sold.
//
// Source: the founder's LIC plan list (2026-11-28), cleaned up: "LIC's " dropped from names,
// ALL-CAPS names put in title case, and duplicate rows merged (189, 857, 954). When the
// source gave two different statuses for one number, or said "Current/Withdrawn", the status
// here is "unsure" rather than a guess.
//
// LIC reuses a product name under a new number at each refresh (Jeevan Labh 836, 936, 736),
// so a plan must always be looked up by NUMBER, never by name. The Premium Due list and the
// Commission sheet print it as the first half of "Pln/Tm" (149/77, 149-30).
//
// `details` exists only for plans the founder researched. Everything else shows name and
// status alone: nothing here is filled in from memory.

export type LicPlanStatus = "current" | "withdrawn" | "unsure";

export type LicPlanCategory =
  | "Endowment"
  | "Money Back"
  | "Whole Life"
  | "Term"
  | "Pension"
  | "Child"
  | "Health"
  | "Market linked"
  | "Other";

export interface LicPlanDetails {
  /** Plain type line, e.g. "Endowment, joint life (husband and wife)". */
  type: string;
  /** When it was sold, as researched. */
  sold: string;
  term: string;
  premiumTerm: string;
  bonus: string;
  maturity: string;
}

export interface LicPlan {
  no: number;
  name: string;
  status: LicPlanStatus;
  category: LicPlanCategory;
  details?: LicPlanDetails;
}

const RAW: Array<[number, string, LicPlanStatus]> = [
  [2, "The Whole Life Policy", "withdrawn"],
  [5, "The Whole Life Policy - Limited Payment", "withdrawn"],
  [8, "The Whole Life Policy - Single Payment", "withdrawn"],
  [14, "The Endowment Assurance Policy", "withdrawn"],
  [41, "CDA Endowment Vesting At 21", "withdrawn"],
  [43, "Two Year Temporary Assurance Policy", "withdrawn"],
  [48, "The Endowment Limited Premium / Single Premium", "withdrawn"],
  [50, "CDA Endowment Vesting At 18", "withdrawn"],
  [52, "Mortgage Redemption Assurance", "withdrawn"],
  [75, "The Money Back Policy - 20 Years", "withdrawn"],
  [88, "Jeevan Mitra (Double Cover Endowment Plan)", "withdrawn"],
  [89, "Jeevan Saathi", "withdrawn"],
  [90, "Marriage Endowment / Educational Annuity Plan", "withdrawn"],
  [91, "New Janaraksha Plan", "withdrawn"],
  [93, "The Money Back Policy - 25 Years", "withdrawn"],
  [102, "Jeevan Kishore", "withdrawn"],
  [103, "Jeevan Chhaya", "withdrawn"],
  [106, "Jeevan Surabhi - 15 Years", "withdrawn"],
  [107, "Jeevan Surabhi - 20 Years", "withdrawn"],
  [108, "Jeevan Surabhi - 25 Years", "withdrawn"],
  [114, "Jeevan Aadhar", "withdrawn"],
  [133, "Jeevan Mitra (Triple Cover Endowment Plan)", "withdrawn"],
  [136, "Jeevan Vishwas", "withdrawn"],
  [147, "New Jeevan Suraksha I", "withdrawn"],
  [148, "New Jeevan Dhara I", "withdrawn"],
  [149, "Jeevan Anand", "withdrawn"],
  [159, "Komal Jeevan", "withdrawn"],
  [162, "Jeevan Shree I", "withdrawn"],
  [164, "Anmol Jeevan I", "withdrawn"],
  [165, "Jeevan Saral", "withdrawn"],
  [167, "Jeevan Pramukh Plan", "withdrawn"],
  [168, "Jeevan Anurag", "withdrawn"],
  [169, "Jeevan Nidhi", "withdrawn"],
  [171, "Bima Nivesh 2005", "withdrawn"],
  [175, "Bima Bachat", "withdrawn"],
  [178, "Jeevan Tarang", "withdrawn"],
  [179, "New Bima Gold", "withdrawn"],
  [182, "Jeevan Madhur", "withdrawn"],
  [184, "Child Career Plan", "withdrawn"],
  [185, "Child Future Plan", "withdrawn"],
  [186, "Jeevan Amrit", "withdrawn"],
  [188, "Profit Plus", "withdrawn"],
  [189, "Jeevan Akshay VI", "withdrawn"],
  [190, "Amulya Jeevan I", "withdrawn"],
  [191, "Market Plus I", "withdrawn"],
  [192, "Jeevan Bharati I", "withdrawn"],
  [193, "Money Plus I", "withdrawn"],
  [194, "Child Fortune Plus", "withdrawn"],
  [197, "Jeevan Saathi Plus", "withdrawn"],
  [198, "Jeevan Mangal", "withdrawn"],
  [714, "New Endowment Plan", "current"],
  [715, "New Jeevan Anand", "current"],
  [717, "Single Premium Endowment Plan", "current"],
  [720, "New Money Back Plan - 20 Years", "current"],
  [721, "New Money Back Plan - 25 Years", "current"],
  [732, "New Children's Money Back Plan", "current"],
  [733, "Jeevan Lakshya", "current"],
  [734, "Jeevan Tarun", "current"],
  [735, "New Endowment Plus", "withdrawn"],
  [736, "Jeevan Labh", "current"],
  [745, "Jeevan Umang", "current"],
  [748, "Bima Shree", "current"],
  [749, "Nivesh Plus", "current"],
  [752, "SIIP", "current"],
  [758, "New Jeevan Shanti", "unsure"],
  [760, "Bima Jyoti", "withdrawn"],
  [764, "Bima Ratna", "withdrawn"],
  [768, "Jeevan Azad", "withdrawn"],
  [770, "Bima Platinum", "current"],
  [771, "Jeevan Utsav", "current"],
  [774, "Amritbaal", "current"],
  [802, "Endowment Plus", "withdrawn"],
  [803, "Pension Plus", "withdrawn"],
  [804, "Samridhi Plus", "withdrawn"],
  [805, "Bima Account I", "withdrawn"],
  [806, "Bima Account II", "withdrawn"],
  [807, "Jeevan Ankur", "withdrawn"],
  [808, "Jeevan Vriddhi", "withdrawn"],
  [809, "Jeevan Vaibhav", "withdrawn"],
  [810, "Jeevan Deep", "withdrawn"],
  [811, "Flexi Plus", "withdrawn"],
  [812, "New Jeevan Nidhi", "withdrawn"],
  [813, "Jeevan Sugam", "withdrawn"],
  [814, "New Endowment Plan", "withdrawn"],
  [815, "New Jeevan Anand", "withdrawn"],
  [816, "New Bima Bachat", "withdrawn"],
  [817, "Single Premium Endowment Plan", "withdrawn"],
  [818, "New Jeevan Nidhi", "withdrawn"],
  [819, "New Jeevan Mangal", "withdrawn"],
  [820, "New Money Back Plan - 20 Years", "withdrawn"],
  [821, "New Money Back Plan - 25 Years", "withdrawn"],
  [822, "Anmol Jeevan II", "withdrawn"],
  [823, "Amulya Jeevan II", "withdrawn"],
  [825, "e-Term", "withdrawn"],
  [826, "Jeevan Shagun", "withdrawn"],
  [827, "Jeevan Rakshak", "withdrawn"],
  [828, "Varishtha Pension Bima Yojana", "withdrawn"],
  [829, "Bhagya Lakshmi", "withdrawn"],
  [830, "Limited Premium Endowment Plan", "withdrawn"],
  [831, "Jeevan Sangam", "withdrawn"],
  [832, "New Children's Money Back Plan", "withdrawn"],
  [833, "Jeevan Lakshya", "withdrawn"],
  [834, "Jeevan Tarun", "withdrawn"],
  [835, "New Endowment Plus", "withdrawn"],
  [836, "Jeevan Labh", "withdrawn"],
  [837, "Jeevan Shikhar", "withdrawn"],
  [838, "Jeevan Pragati", "withdrawn"],
  [839, "Bhagya Lakshmi Plan", "withdrawn"],
  [840, "New Jeevan Mangal", "withdrawn"],
  [842, "Pradhan Mantri Vaya Vandana Yojana", "withdrawn"],
  [843, "Aadhaar Stambh", "withdrawn"],
  [844, "Aadhaar Shila", "withdrawn"],
  [845, "Jeevan Umang", "withdrawn"],
  [846, "Jeevan Utkarsh", "withdrawn"],
  [847, "Jeevan Shiromani", "withdrawn"],
  [848, "Bima Shree", "withdrawn"],
  [849, "Nivesh Plus", "withdrawn"],
  [850, "Jeevan Shanti", "withdrawn"],
  [851, "Micro Bachat Plan", "withdrawn"],
  [852, "SIIP", "withdrawn"],
  [853, "Navjeevan", "withdrawn"],
  [854, "Tech Term", "withdrawn"],
  [855, "Jeevan Amar", "withdrawn"],
  [856, "Pradhan Mantri Vaya Vandana Yojana", "withdrawn"],
  [857, "Jeevan Akshay VII", "unsure"],
  [858, "New Jeevan Shanti", "withdrawn"],
  [859, "Saral Jeevan Bima", "current"],
  [860, "Bima Jyoti", "withdrawn"],
  [861, "Bachat Plus", "withdrawn"],
  [862, "Saral Pension", "unsure"],
  [863, "Dhan Rekha", "withdrawn"],
  [864, "Bima Ratna", "withdrawn"],
  [865, "Dhan Sanchay", "withdrawn"],
  [866, "Dhan Varsha", "withdrawn"],
  [867, "New Pension Plus", "unsure"],
  [868, "Jeevan Azad", "withdrawn"],
  [869, "Dhan Vriddhi", "withdrawn"],
  [870, "Jeevan Kiran", "withdrawn"],
  [871, "Jeevan Utsav", "withdrawn"],
  [872, "Jeevan Dhara II", "withdrawn"],
  [873, "Index Plus", "unsure"],
  [875, "Yuva Term", "unsure"],
  [876, "Digi Term", "unsure"],
  [877, "Yuva Credit Life", "current"],
  [878, "Digi Credit Life", "current"],
  [879, "Smart Pension", "current"],
  [881, "Bima Lakshmi", "current"],
  [883, "Jeevan Utsav Single Premium", "current"],
  [886, "Protection Plus", "current"],
  [887, "Bima Kavach", "current"],
  [888, "New Jeevan Sathi - Single Premium", "current"],
  [889, "New Jeevan Sathi - Limited Premium", "current"],
  [890, "New Bima Jyoti", "current"],
  [892, "New Jeevan Dhara II", "current"],
  [902, "Health Protection Plus", "withdrawn"],
  [903, "Jeevan Arogya", "withdrawn"],
  [904, "Jeevan Arogya", "withdrawn"],
  [905, "Cancer Cover", "withdrawn"],
  [906, "Arogya Rakshak", "withdrawn"],
  [907, "Health Shield", "current"],
  [908, "New Cancer Cover", "current"],
  [911, "Nav Jeevan Shree - Single Premium", "withdrawn"],
  [912, "Nav Jeevan Shree", "unsure"],
  [914, "New Endowment Plan", "withdrawn"],
  [915, "New Jeevan Anand", "withdrawn"],
  [916, "New Bima Bachat", "withdrawn"],
  [917, "Single Premium Endowment Plan", "withdrawn"],
  [920, "New Money Back Plan - 20 Years", "withdrawn"],
  [921, "New Money Back Plan - 25 Years", "withdrawn"],
  [932, "New Children's Money Back Plan", "withdrawn"],
  [933, "Jeevan Lakshya", "withdrawn"],
  [934, "Jeevan Tarun", "withdrawn"],
  [935, "New Endowment Plus", "withdrawn"],
  [936, "Jeevan Labh", "withdrawn"],
  [939, "Bhagya Lakshmi", "withdrawn"],
  [940, "New Jeevan Mangal", "withdrawn"],
  [943, "Aadhaar Stambh", "withdrawn"],
  [944, "Aadhaar Shila", "withdrawn"],
  [945, "Jeevan Umang", "withdrawn"],
  [947, "Jeevan Shiromani", "withdrawn"],
  [948, "Bima Shree", "withdrawn"],
  [951, "Micro Bachat Plan", "withdrawn"],
  [954, "New Tech Term", "unsure"],
  [955, "New Jeevan Amar", "withdrawn"],
];

// Researched by the founder (2026-11-28). Plan type here also fixes the category, which
// beats the name-based guess below (90 says "Annuity" but is a child plan).
const DETAILS: Record<number, { category: LicPlanCategory; details: LicPlanDetails }> = {
  89: { category: "Endowment", details: { type: "Endowment, joint life (husband and wife)", sold: "Withdrawn 1 Jan 2014", term: "Chosen, 15 to 30 years", premiumTerm: "Same as term", bonus: "With profit", maturity: "Sum assured plus bonuses if either or both survive. Premiums stop at the first death and the survivor stays covered." } },
  90: { category: "Child", details: { type: "Child plan", sold: "Withdrawn 1 Jan 2014", term: "Chosen, up to about 25 years", premiumTerm: "Same as term", bonus: "With profit", maturity: "Sum assured plus bonuses, as a lump sum or 10 half-yearly instalments. If the parent dies, premiums are waived and the full maturity is still paid." } },
  103: { category: "Child", details: { type: "Child plan, money back style", sold: "Withdrawn 1 Jan 2014", term: "Chosen, 18 to 25 years", premiumTerm: "Same as term", bonus: "With profit", maturity: "25% of sum assured in each of the last 4 years, with bonuses paid on the last one." } },
  133: { category: "Endowment", details: { type: "Endowment", sold: "About 1999 to 29 Dec 2013", term: "Chosen, 15 to 30 years", premiumTerm: "Same as term", bonus: "With profit", maturity: "Sum assured plus bonuses as a lump sum. Death during the term pays 3 times the sum assured." } },
  149: { category: "Endowment", details: { type: "Endowment with lifelong cover", sold: "Feb 2002 to early 2014 (replaced by 815)", term: "Chosen, 5 to 57 years", premiumTerm: "Same as chosen term", bonus: "With profit", maturity: "Sum assured plus bonuses at the end of the term, then the sum assured stays as cover for life." } },
  165: { category: "Endowment", details: { type: "Endowment, flexible premium", sold: "16 Feb 2004 to 1 Jan 2014", term: "Chosen, 10 to 35 years", premiumTerm: "Same as term", bonus: "One-time Loyalty Addition, no yearly bonus", maturity: "Maturity sum assured (from the LIC table) plus the Loyalty Addition." } },
  178: { category: "Whole Life", details: { type: "Whole life with an accumulation period", sold: "7 Mar 2006 to 1 Jan 2014", term: "Whole life to age 100, accumulation period 10, 15 or 20 years", premiumTerm: "Single, 6 years, or same as the accumulation period", bonus: "With profit", maturity: "Bonuses at the end of the accumulation period, then 5.5% of sum assured every year for life, and the sum assured at 100 or on death." } },
  734: { category: "Child", details: { type: "Child plan, money back", sold: "On sale since 18 Nov 2024 (earlier 834, 934)", term: "Fixed: matures at age 25", premiumTerm: "20 minus entry age", bonus: "With profit", maturity: "Payouts at ages 20 to 24, then the rest of the sum assured plus bonuses at 25." } },
  736: { category: "Endowment", details: { type: "Endowment", sold: "On sale since 1 Oct 2024 (earlier 836, 936)", term: "16, 21 or 25 years", premiumTerm: "10, 15 or 16 years (paired with the term)", bonus: "With profit", maturity: "Sum assured plus bonuses as a lump sum." } },
  833: { category: "Endowment", details: { type: "Endowment, family goal", sold: "About Mar 2015 to 1 Feb 2020", term: "Chosen, 13 to 25 years", premiumTerm: "Term minus 3 years", bonus: "With profit", maturity: "Sum assured plus bonuses at maturity. If the life assured dies mid-term, the family gets 10% of sum assured every year until maturity." } },
  845: { category: "Whole Life", details: { type: "Whole life", sold: "2017 to 1 Feb 2020", term: "To age 100 (100 minus entry age)", premiumTerm: "15, 20, 25 or 30 years", bonus: "With profit", maturity: "8% of sum assured every year from the end of the premium term to 99, then sum assured plus bonuses at 100." } },
  914: { category: "Endowment", details: { type: "Endowment", sold: "1 Feb 2020 to 1 Oct 2024", term: "Chosen, 12 to 35 years", premiumTerm: "Same as term", bonus: "With profit", maturity: "Sum assured plus bonuses as a lump sum." } },
  936: { category: "Endowment", details: { type: "Endowment", sold: "1 Feb 2020 to 1 Oct 2024", term: "16, 21 or 25 years", premiumTerm: "10, 15 or 16 years", bonus: "With profit", maturity: "Sum assured plus bonuses as a lump sum." } },
  945: { category: "Whole Life", details: { type: "Whole life", sold: "1 Feb 2020 to 1 Oct 2024", term: "To age 100", premiumTerm: "15, 20, 25 or 30 years", bonus: "With profit", maturity: "8% of sum assured every year to 99, then sum assured plus bonuses at 100." } },
};

// Category from words in the plan's own name only. Anything the name does not say is "Other".
function categoryFromName(name: string): LicPlanCategory {
  const n = name.toLowerCase();
  if (/\b(market plus|money plus|profit plus|endowment plus|siip|index plus|nivesh plus|flexi plus)\b/.test(n)) return "Market linked";
  if (/\b(health|arogya|cancer)\b/.test(n)) return "Health";
  if (/\b(child|children'?s|cda)\b/.test(n)) return "Child";
  if (/\b(term|temporary|mortgage|credit life)\b/.test(n)) return "Term";
  if (/\b(pension|vaya vandana)\b/.test(n)) return "Pension";
  if (/\bmoney back\b/.test(n)) return "Money Back";
  if (/\bwhole life\b/.test(n)) return "Whole Life";
  if (/\bendowment\b/.test(n)) return "Endowment";
  return "Other";
}

export const LIC_PLANS: LicPlan[] = RAW.map(([no, name, status]) => {
  const known = DETAILS[no];
  return {
    no,
    name,
    status,
    category: known?.category ?? categoryFromName(name),
    ...(known ? { details: known.details } : {}),
  };
});

const BY_NO = new Map(LIC_PLANS.map((p) => [p.no, p]));

/** Look up a plan by its number, e.g. from "149/77" or "945-15". */
export function getLicPlan(no: number | string): LicPlan | undefined {
  const n = typeof no === "number" ? no : parseInt(String(no).trim(), 10);
  return Number.isFinite(n) ? BY_NO.get(n) : undefined;
}

/** Same product sold under other numbers (Jeevan Labh 736 -> 836, 936). Matched on name. */
const familyKey = (name: string) =>
  name.toLowerCase().replace(/\bplan\b/g, "").replace(/[^a-z0-9]/g, "");

export function licPlanFamily(no: number): LicPlan[] {
  const p = BY_NO.get(no);
  if (!p) return [];
  const key = familyKey(p.name);
  return LIC_PLANS.filter((q) => q.no !== no && familyKey(q.name) === key);
}

export const LIC_PLAN_CATEGORIES: LicPlanCategory[] = [
  "Endowment", "Money Back", "Whole Life", "Term", "Pension", "Child", "Health", "Market linked", "Other",
];
