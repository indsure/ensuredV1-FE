/**
 * The cover calculator over WhatsApp, step for step the AGENT PORTAL's calculator
 * (AgentCalculator.tsx + CoverCalculator.tsx): same order, same options, same conditional
 * steps, customer pre-fill (age from date of birth, city), a review before calculating,
 * saved against the customer, and the portal's own WhatsApp share message.
 *
 * One deliberate difference: the portal also asks gender, spouse income and spouse employer
 * cover, which the engine (health-engine-logic.ts) never reads. Asking them here would add
 * three WhatsApp messages without changing the answer, so they are skipped.
 *
 * Pure helpers: parsing, questions, review, replies. The flow itself lives in bot.ts.
 */

import type { UserInputs, EngineResult } from "../shared/health-engine-logic.js";
import { cityAnswer, pickCalcOption, runCalculator, TIER_LABEL } from "./tools.js";
import { b, firstName } from "./format.js";
import type { Links } from "./templates.js";

export type CalcStep =
  | "city" | "travel" | "family" | "age" | "income" | "spouseAge" | "kids" | "parents"
  | "employer" | "risk" | "hospital" | "recurring" | "review";

export type CalcState = {
  inputs: Partial<UserInputs>;
  customer: { id: string; name: string; phone: string | null } | null;
  /** Answers that came from the customer's record, so the review can say so. */
  prefilled: string[];
};

/** The portal's order (CoverCalculator ALL_STEPS; member details expanded). */
const ORDER: CalcStep[] = ["city", "travel", "family", "age", "income", "spouseAge", "kids", "parents", "employer", "risk", "hospital", "recurring"];

/** Same conditions as the portal (shouldShowStep and the member-details form). */
function applies(step: CalcStep, i: Partial<UserInputs>): boolean {
  switch (step) {
    case "spouseAge": return i.familyStructure === "Couple" || i.familyStructure === "Couple + kids";
    case "kids": return i.familyStructure === "Couple + kids";
    case "parents": return i.familyStructure === "Parents included";
    case "hospital": return i.riskPosture === "Zero financial shock" || i.cityTier === "Metro";
    case "recurring": return i.familyStructure === "Parents included" || i.riskPosture !== "Minimum but safe";
    default: return true;
  }
}

function answered(step: CalcStep, i: Partial<UserInputs>): boolean {
  switch (step) {
    case "city": return !!i.cityTier;
    case "travel": return !!i.globalTravel;
    case "family": return !!i.familyStructure;
    case "age": return !!i.exactAge;
    case "income": return !!i.annualIncome;
    case "spouseAge": return i.spouseAge !== undefined;
    case "kids": return !!i.childCount;
    case "parents": return i.fatherAge !== undefined || i.motherAge !== undefined;
    case "employer": return !!i.employerCover;
    case "risk": return !!i.riskPosture;
    case "hospital": return !!i.hospitalPreference;
    case "recurring": return !!i.recurringExpenses;
    default: return false;
  }
}

/** The first step still missing an answer, or "review" when all are in. */
export function nextStep(i: Partial<UserInputs>): CalcStep {
  for (const s of ORDER) if (applies(s, i) && !answered(s, i)) return s;
  return "review";
}

const FAMILY_LABEL: Record<string, string> = {
  Individual: "just them", Couple: "a couple", "Couple + kids": "a couple with kids", "Parents included": "a family including parents",
};

export function question(step: CalcStep, s: CalcState): string {
  switch (step) {
    case "city": return "Which city do they live in? (Or say metro, tier 1 or tier 2.)";
    case "travel": return "Do they travel outside India?\n1) Rarely or never\n2) Yes, holidays or work trips abroad";
    case "family": return "Who needs to be covered?\n1) Just them\n2) Couple\n3) Couple with kids\n4) Family including parents";
    case "age": return "How old are they? (18 to 75)";
    case "income": return "Their annual income?\n1) Under ₹5 lakh\n2) ₹5 to 10 lakh\n3) ₹10 to 20 lakh\n4) Over ₹20 lakh";
    case "spouseAge": return "Spouse's age? (SKIP if you don't know)";
    case "kids": return "How many children? 1, 2 or 3";
    case "parents": return "Parents' ages, father then mother, for example: 65 and 60. Say 0 for a parent who isn't covered.";
    case "employer": return "Health cover from their employer?\n1) None\n2) Under ₹5 lakh\n3) ₹5 to 10 lakh\n4) Over ₹10 lakh";
    case "risk": return "How much risk are they comfortable with?\n1) Minimum cover, but safe\n2) Balanced\n3) No financial shock at all";
    case "hospital": return "Which hospitals do they prefer?\n1) Any good hospital\n2) Large private hospitals\n3) Premium corporate hospitals";
    case "recurring": return "Any regular medical costs?\n1) None\n2) Minor (tests, OPD, medicines)\n3) A chronic condition, but stable";
    case "review": return review(s);
  }
}

/* ── Parsing an answer ───────────────────────────────────────────────── */

const bare = (t: string, max: number) => {
  const m = t.trim().match(/^(\d)\)?\.?$/);
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= max ? n : null;
};
const ageBand = (a: number): UserInputs["ageBand"] => (a <= 30 ? "18-30" : a <= 45 ? "31-45" : a <= 60 ? "46-60" : "60+");
const lakhs = (t: string): number | null => {
  const l = t.match(/(\d+(?:\.\d+)?)\s*(l|lakh|lakhs|lac|lacs)\b/i);
  if (l) return Number(l[1]);
  const r = t.match(/₹?\s*(\d{1,2},\d{2},\d{3}|\d{6,8})\b/);
  return r ? Number(r[1].replace(/,/g, "")) / 100000 : null;
};
const WORD_NUM: Record<string, number> = { one: 1, ek: 1, two: 2, do: 2, three: 3, teen: 3 };

/** Apply an answer to the current step. Returns an error message to show, or null if taken. */
export function answer(step: CalcStep, textRaw: string, s: CalcState): string | null {
  const t = textRaw.toLowerCase().trim();
  const i = s.inputs;
  switch (step) {
    case "city": {
      const c = cityAnswer(textRaw);
      if (!c) return "I don't know that city. Type the nearest big city, or reply METRO, TIER 1 or TIER 2.";
      i.cityTier = c.tier;
      if (c.city) i.city = c.city; else delete i.city;
      return null;
    }
    case "travel": {
      const n = bare(t, 2);
      if (n === 1 || /\b(no|nahi|rarely|never|india only|not really)\b/.test(t)) { i.globalTravel = "Rarely or never"; return null; }
      if (n === 2 || /\b(yes|haan|abroad|foreign|videsh|international|travel)\b/.test(t)) { i.globalTravel = "Yes, I travel abroad"; return null; }
      return "Reply 1 (rarely or never) or 2 (yes, they travel abroad).";
    }
    case "family": {
      const v = pickCalcOption(0, textRaw);
      if (!v) return "Reply 1 to 4, or say who: just them, couple, with kids, or with parents.";
      i.familyStructure = v as UserInputs["familyStructure"];
      return null;
    }
    case "age": {
      const m = t.match(/\b(\d{1,3})\b/);
      const a = m ? Number(m[1]) : NaN;
      if (!(a >= 18 && a <= 75)) return "The calculator covers ages 18 to 75, as in the portal. Reply with the age, for example 42.";
      i.exactAge = a;
      i.ageBand = ageBand(a);
      return null;
    }
    case "income": {
      const n = bare(t, 4);
      const opts: UserInputs["annualIncome"][] = ["< 5L", "5-10L", "10-20L", "20L+"];
      if (n) { i.annualIncome = opts[n - 1]; return null; }
      const l = lakhs(t);
      if (l !== null) { i.annualIncome = l < 5 ? "< 5L" : l <= 10 ? "5-10L" : l <= 20 ? "10-20L" : "20L+"; return null; }
      return "Reply 1 to 4, or the income in lakhs, for example 12 lakh.";
    }
    case "spouseAge": {
      if (/^(skip|don'?t know|dont know|pata nahi|na|no)\b/.test(t)) { i.spouseAge = 0; return null; }
      const m = t.match(/\b(\d{2})\b/);
      const a = m ? Number(m[1]) : NaN;
      if (!(a >= 18 && a <= 99)) return "Reply with the spouse's age, for example 38, or SKIP.";
      i.spouseAge = a;
      return null;
    }
    case "kids": {
      const w = Object.keys(WORD_NUM).find((k) => new RegExp(`\\b${k}\\b`).test(t));
      const m = t.match(/\b(\d+)\b/);
      const n = m ? Number(m[1]) : w ? WORD_NUM[w] : NaN;
      if (n > 3) { i.childCount = 3; return null; }
      if (!(n >= 1)) return "Reply 1, 2 or 3.";
      i.childCount = n;
      return null;
    }
    case "parents": {
      const f = t.match(/\b(?:father|papa|dad|pitaji)\D{0,6}(\d{1,3})/);
      const mo = t.match(/\b(?:mother|mummy|mom|maa|mataji)\D{0,6}(\d{1,3})/);
      const nums = [...t.matchAll(/\b(\d{1,3})\b/g)].map((x) => Number(x[1]));
      let fa: number | null = f ? Number(f[1]) : null;
      let ma: number | null = mo ? Number(mo[1]) : null;
      if (fa === null && ma === null) {
        if (nums.length < 2) return "Reply with both ages, father then mother, for example: 65 and 60 (0 for one who isn't covered).";
        [fa, ma] = nums;
      }
      const ok = (x: number | null) => x === null || x === 0 || (x >= 35 && x <= 100);
      if (!ok(fa) || !ok(ma)) return "Those ages look off. Reply father then mother, for example: 65 and 60.";
      i.fatherAge = fa || 0;
      i.motherAge = ma || 0;
      return null;
    }
    case "employer": {
      const v = pickCalcOption(1, textRaw);
      if (!v) return "Reply 1 to 4, or an amount like 5 lakh, or NONE.";
      i.employerCover = v as UserInputs["employerCover"];
      return null;
    }
    case "risk": {
      const v = pickCalcOption(2, textRaw);
      if (!v) return "Reply 1, 2 or 3: minimum, balanced, or no financial shock.";
      i.riskPosture = v as UserInputs["riskPosture"];
      return null;
    }
    case "hospital": {
      const n = bare(t, 3);
      const v = n ? (["Any good hospital", "Large private hospitals", "Premium corporate hospitals"] as const)[n - 1]
        : /\b(premium|corporate|best|top|5 star)\b/.test(t) ? "Premium corporate hospitals"
        : /\b(large|big|private|bade)\b/.test(t) ? "Large private hospitals"
        : /\b(any|good|normal|regular|local)\b/.test(t) ? "Any good hospital" : null;
      if (!v) return "Reply 1, 2 or 3.";
      i.hospitalPreference = v;
      return null;
    }
    case "recurring": {
      const n = bare(t, 3);
      const v = n ? (["None", "Minor (tests/OPD/meds)", "Chronic but stable"] as const)[n - 1]
        : /\b(chronic|diabetes|sugar|bp|pressure|thyroid|regular|ongoing|long term)\b/.test(t) ? "Chronic but stable"
        : /\b(minor|tests?|opd|medicines?|meds|checkups?)\b/.test(t) ? "Minor (tests/OPD/meds)"
        : /\b(none|no|nothing|nahi)\b/.test(t) ? "None" : null;
      if (!v) return "Reply 1, 2 or 3.";
      i.recurringExpenses = v;
      return null;
    }
    case "review": return null;
  }
}

/* ── Review and changes ──────────────────────────────────────────────── */

const CHANGE: [RegExp, CalcStep, (keyof UserInputs)[]][] = [
  [/\b(city|location|shehar)\b/, "city", ["cityTier", "city", "hospitalPreference"]],
  [/\b(travel|abroad)\b/, "travel", ["globalTravel"]],
  [/\b(family|members|who)\b/, "family", ["familyStructure", "spouseAge", "childCount", "fatherAge", "motherAge", "recurringExpenses"]],
  [/\b(spouse|wife|husband)\b/, "spouseAge", ["spouseAge"]],
  [/\bage\b/, "age", ["exactAge", "ageBand"]],
  [/\b(income|salary)\b/, "income", ["annualIncome"]],
  [/\b(kids|children|child)\b/, "kids", ["childCount"]],
  [/\b(parents?|father|mother)\b/, "parents", ["fatherAge", "motherAge"]],
  [/\b(employer|company|office)\b/, "employer", ["employerCover"]],
  [/\b(risk)\b/, "risk", ["riskPosture", "hospitalPreference", "recurringExpenses"]],
  [/\b(hospital)\b/, "hospital", ["hospitalPreference"]],
  [/\b(medical|recurring|costs?|chronic)\b/, "recurring", ["recurringExpenses"]],
];

/** "change age" / "change city": clear that answer (and any that depend on it). */
export function applyChange(textRaw: string, s: CalcState): CalcStep | null {
  const t = textRaw.toLowerCase();
  if (!/\b(change|edit|fix|galat|wrong|badlo)\b/.test(t)) return null;
  const hit = CHANGE.find(([re]) => re.test(t));
  if (!hit) return null;
  for (const k of hit[2]) delete (s.inputs as any)[k];
  s.prefilled = s.prefilled.filter((p) => !hit[2].includes(p as keyof UserInputs));
  return hit[1];
}

export function review(s: CalcState): string {
  const i = s.inputs;
  const from = (k: string) => (s.prefilled.includes(k) ? ` (from ${firstName(s.customer?.name)}'s record)` : "");
  const lines = [
    `Please check${s.customer ? ` (for ${b(s.customer.name)})` : ""}:`,
    `• City: ${i.city ? `${i.city}, ` : ""}${TIER_LABEL[i.cityTier ?? ""] ?? i.cityTier}${from("city")}`,
    `• Travel abroad: ${i.globalTravel === "Yes, I travel abroad" ? "yes" : "rarely or never"}`,
    `• Covering: ${FAMILY_LABEL[i.familyStructure ?? ""] ?? i.familyStructure}`,
    `• Age: ${i.exactAge}${from("exactAge")}`,
    `• Income: ${i.annualIncome}`,
  ];
  if (applies("spouseAge", i)) lines.push(`• Spouse's age: ${i.spouseAge || "not given"}`);
  if (applies("kids", i)) lines.push(`• Children: ${i.childCount}`);
  if (applies("parents", i)) lines.push(`• Parents' ages: ${[i.fatherAge || "-", i.motherAge || "-"].join(" and ")}`);
  lines.push(`• Employer cover: ${i.employerCover}`, `• Risk: ${String(i.riskPosture).toLowerCase()}`);
  if (applies("hospital", i)) lines.push(`• Hospitals: ${String(i.hospitalPreference).toLowerCase()}`);
  if (applies("recurring", i)) lines.push(`• Regular medical costs: ${String(i.recurringExpenses).toLowerCase()}`);
  lines.push("", "Reply YES to calculate, or CHANGE and what to fix, for example: change age");
  return lines.join("\n");
}

/* ── Pre-fill from a customer (AgentCalculator prefill) ──────────────── */

export function prefillFromCustomer(s: CalcState, c: { dob?: string | null; city?: string | null }, nowMs: number) {
  if (c.dob) {
    const d = new Date(c.dob);
    const now = new Date(nowMs);
    let age = now.getUTCFullYear() - d.getUTCFullYear();
    if (now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) age--;
    if (age >= 18 && age <= 75) { s.inputs.exactAge = age; s.inputs.ageBand = ageBand(age); s.prefilled.push("exactAge"); }
  }
  if (c.city) {
    const ca = cityAnswer(c.city);
    if (ca) { s.inputs.cityTier = ca.tier; if (ca.city) s.inputs.city = ca.city; s.prefilled.push("city"); }
  }
}

/** "how much cover does a 35 year old in Pune need": take what the message already says. */
export function prefillFromText(s: CalcState, textRaw: string) {
  if (!s.inputs.exactAge) {
    const m = textRaw.match(/\b(\d{2})\s*(?:year|yr|sal|saal|y\/o|yo)\b/i);
    const a = m ? Number(m[1]) : NaN;
    if (a >= 18 && a <= 75) { s.inputs.exactAge = a; s.inputs.ageBand = ageBand(a); }
  }
  if (!s.inputs.cityTier) {
    const c = cityAnswer(textRaw);
    if (c?.city) { s.inputs.cityTier = c.tier; s.inputs.city = c.city; }
  }
}

/* ── Result and share (AgentCalculator's own wording) ────────────────── */

export function run(s: CalcState, partnered: string[]): EngineResult {
  return runCalculator(s.inputs as UserInputs, partnered);
}

/** The portal's structure sentence (AgentCalculator whatsAppShare). */
export function structureLine(r: EngineResult): string {
  const plans = (r as any).plans;
  const saving = plans?.efficientSavingPct ?? 0;
  return plans?.hasSplit
    ? `You can take it as one ${r.totalProtection} policy, or as ${r.baseCover} base plus ${r.superTopUp} super top-up` +
      (saving > 0 ? `, which is about ${saving}% less premium for the same cover.` : ".")
    : `A single ${r.totalProtection} policy covers it.`;
}

export function resultReply(l: Links, s: CalcState, r: EngineResult, uuid: string): string {
  const i = s.inputs;
  const who = s.customer ? firstName(s.customer.name) : `age ${i.exactAge}`;
  const where = i.city ? `${i.city} (${TIER_LABEL[i.cityTier ?? ""] ?? i.cityTier})` : TIER_LABEL[i.cityTier ?? ""] ?? i.cityTier;
  return [
    `🧮 ${b(r.totalProtection)} recommended cover for ${who}, ${where}, ${FAMILY_LABEL[i.familyStructure ?? ""] ?? ""}.`,
    structureLine(r),
    `Full report with premiums and riders: ${l.origin}/calculator/report/${uuid}`,
    s.customer ? `Saved to ${firstName(s.customer.name)}'s record.` : "",
    `Reply SHARE to send it to ${s.customer ? firstName(s.customer.name) : "the customer"}.`,
  ].filter(Boolean).join("\n");
}

/** The customer message. English is the portal's exact text; Hinglish and Hindi say the same. */
export function calcShareText(lang: "english" | "hinglish" | "hindi", x: { name: string | null; total: string; structure: string; url: string }): string {
  const f = firstName(x.name);
  if (lang === "hinglish") return `Namaste${f ? ` ${f} ji` : ""}, maine IndSure par aapke liye health cover ka analysis kiya hai. Sujhaya gaya cover: ${x.total}. Poori report: ${x.url}`;
  if (lang === "hindi") return `नमस्ते${f ? ` ${f} जी` : ""}, मैंने IndSure पर आपके लिए हेल्थ कवर का विश्लेषण किया है। सुझाया गया कवर: ${x.total}। पूरी रिपोर्ट: ${x.url}`;
  return `Hi${f ? ` ${f}` : ""}, I ran a health-cover needs analysis for you on IndSure. Recommended protection: ${x.total}. ${x.structure} Full report: ${x.url}`;
}
