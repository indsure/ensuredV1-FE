/**
 * Phase 1b tools: website link, lead entry, cover calculator, catalogue compare.
 * Pure helpers (parsing, matching, the calculator's questions and the replies). The flows
 * that use them live in bot.ts. Every number shown comes from an engine: the calculator is
 * the portal's own health-engine-logic.ts (synced copy in ../shared), compare is the
 * backend's compareMany. Nothing here computes a rupee amount.
 */

import type { CatalogPlan, CompareResult, PolicyRow, Profile } from "../engine.js";
import { calculateHealthCover, type UserInputs, type EngineResult } from "../shared/health-engine-logic.js";
import { resolvePartnerCompanies } from "../shared/data/insurer-aliases.js";
import { getCityTier } from "../shared/city-tier-util.js";
import { CITY_ZONE_MAP } from "../shared/data/zones.js";
import { parseCaption } from "./intents.js";
import type { Links } from "./templates.js";

/* ── Website ─────────────────────────────────────────────────────────── */

/** Same tagging the portal uses for a WhatsApp share (advisorPage.ts SHARE_CHANNELS). */
export const websiteUrl = (l: Links, slug: string) => `${l.origin}/a/${slug}?utm_source=whatsapp&utm_medium=share`;

export function websiteReply(p: Profile, l: Links): string {
  const portal = `${l.origin}/agent/my-page`;
  if (!p.page) return `You haven't set up your website yet. It takes a couple of minutes in the portal: ${portal}`;
  if (!p.page.live) return `Your website is set up but not live yet. Publish it in the portal: ${portal}`;
  return [
    `Your website: ${websiteUrl(l, p.page.slug)}`,
    "",
    "Forward it to customers or put it in your WhatsApp status. Leads from it land in your Leads in the portal.",
  ].join("\n");
}

/* ── Leads ───────────────────────────────────────────────────────────── */

/** The portal's lead interest options (LeadsNew.tsx INTEREST_OPTIONS), stored the same way. */
export const INTERESTS = ["Health", "Motor", "Life", "Term", "Travel", "Property"] as const;

export function interestIn(text: string): string | null {
  const t = text.toLowerCase();
  const hit = INTERESTS.find((i) => new RegExp(`\\b${i.toLowerCase()}\\b`).test(t));
  if (hit) return hit;
  if (/\b(car|bike|vehicle|two wheeler)\b/.test(t)) return "Motor";
  if (/\bmediclaim\b/.test(t)) return "Health";
  return null;
}

/** "lead Ramesh Kumar 9812345678 health" / "enter a lead Ramesh" -> parts found. */
export function parseLeadLine(textRaw: string): { name: string | null; phone: string | null; interest: string | null } {
  const rest = textRaw.replace(/^\s*(please\s+)?((enter|add|new|create|save)\s+(a\s+)?(new\s+)?)?leads?\b[:\-\s]*/i, "");
  const interest = interestIn(rest);
  const { phone } = parseCaption(rest);
  let name = rest
    .replace(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/, " ")
    .replace(new RegExp(`\\b(${[...INTERESTS, "car", "bike", "vehicle", "mediclaim", "insurance", "for", "interested", "in"].join("|")})\\b`, "gi"), " ")
    .replace(/[^A-Za-zऀ-ॿ .']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (name.length < 2) name = "";
  return { name: name ? name.slice(0, 80) : null, phone, interest };
}

export const LEAD_ASK = {
  name: "Adding a lead. What's their name?",
  phone: "Their phone number? Or SKIP.",
  interest: `What are they interested in? Reply with a number, or SKIP:\n${INTERESTS.map((x, i) => `${i + 1}) ${x}`).join("\n")}`,
};

export function leadSavedReply(l: Links, lead: { id: string; duplicateOf?: string }, d: { name: string; phone: string | null; interest: string | null }): string {
  const url = `${l.origin}/agent/leads/${lead.id}`;
  if (lead.duplicateOf) return `${lead.duplicateOf} is already in your leads with this number, so I didn't add it again: ${url}`;
  const phone = d.phone ? `${d.phone.slice(0, 5)} ${d.phone.slice(5)}` : null;
  return `Saved lead: ${[d.name, phone, d.interest].filter(Boolean).join(", ")}.\nIt's in your Leads: ${url}`;
}

/* ── Calculator ──────────────────────────────────────────────────────── */

type Opt = { label: string; value: string; words?: RegExp };
type Q = { key: keyof UserInputs; ask: string; options: Opt[] };

/** The five answers the engine needs (UserInputs level 1), in plain words. Values are the
 *  engine's own enum strings, unchanged. */
// City comes first and is free text (see cityAnswer); these follow it. `words` lets an advisor
// answer in plain words instead of the number. Checked in order, so the more specific
// option comes first where two could match.
export const CALC_QUESTIONS: Q[] = [
  {
    key: "familyStructure",
    ask: "Who needs to be covered?",
    options: [
      { label: "Just them", value: "Individual", words: /\b(just|only|self|single|alone|individual|myself|me|him|her)\b/ },
      { label: "Couple", value: "Couple", words: /\b(couple|wife|husband|spouse|two of (us|them))\b/ },
      { label: "Couple with kids", value: "Couple + kids", words: /\b(kids?|child|children|son|daughter|baby)\b/ },
      { label: "Family including parents", value: "Parents included", words: /\b(parents?|mother|father|mom|dad|in-?laws?)\b/ },
    ],
  },
  {
    key: "employerCover",
    ask: "Health cover from their employer? (A number of lakhs is fine too, like 5 lakh.)",
    options: [
      { label: "None", value: "None", words: /\b(none|no|nil|nothing|zero|not|self.?employed|business)\b/ },
      { label: "Under ₹5 lakh", value: "< 5L" },
      { label: "₹5 to 10 lakh", value: "5-10L" },
      { label: "Over ₹10 lakh", value: "> 10L" },
    ],
  },
  {
    key: "riskPosture",
    ask: "How much risk are they comfortable with?",
    options: [
      { label: "Minimum cover, but safe", value: "Minimum but safe", words: /\b(min|minimum|low|basic|cheap|budget|less)\b/ },
      { label: "Balanced", value: "Balanced", words: /\b(balanced?|medium|normal|moderate|average|mid)\b/ },
      { label: "No financial shock at all", value: "Zero financial shock", words: /\b(zero|max|maximum|full|high|best|no shock|fully)\b/ },
    ],
  },
];

/** "5 lakh", "3L", "12 lakhs", "₹5,00,000" as employer cover. A bare 1-4 is an option
 *  number, not lakhs, so this only reads amounts that say lakh or are in rupees. */
function employerFromAmount(t: string): string | null {
  const lakh = t.match(/(\d+(?:\.\d+)?)\s*(l|lakh|lakhs|lac|lacs)\b/);
  const rupees = t.match(/₹?\s*(\d{1,2},\d{2},\d{3}|\d{6,8})\b/);
  const n = lakh ? Number(lakh[1]) : rupees ? Number(rupees[1].replace(/,/g, "")) / 100000 : NaN;
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return "None";
  if (n < 5) return "< 5L";
  if (n <= 10) return "5-10L";
  return "> 10L";
}

/** The option a reply means: its number, a lakh amount (employer cover), or its words. */
export function pickCalcOption(step: number, textRaw: string): string | null {
  const q = CALC_QUESTIONS[step];
  const t = textRaw.toLowerCase().trim();
  const n = t.match(/^(\d)\)?\.?$/);
  if (n) {
    const i = Number(n[1]);
    return i >= 1 && i <= q.options.length ? q.options[i - 1].value : null;
  }
  if (q.key === "employerCover") {
    const amt = employerFromAmount(t);
    if (amt) return amt;
  }
  // Most specific first: parents over kids over couple over just them.
  const order = q.key === "familyStructure" ? [...q.options].reverse() : q.options;
  for (const o of order) if (o.words && o.words.test(t)) return o.value;
  const byLabel = q.options.find((o) => t === o.label.toLowerCase() || t === o.value.toLowerCase());
  return byLabel ? byLabel.value : null;
}

/* The city. The portal asks for the city and derives the tier with getCityTier (zones.ts):
 * zone A = Metro, B/D = Tier-1, else Tier-2. The bot does exactly that, so the same city
 * gives the same tier. It never produces "Other", because the portal never does. */

const CITY_ALIASES: Record<string, string> = {
  bombay: "Mumbai", bengaluru: "Bangalore", gurugram: "Gurgaon", calcutta: "Kolkata", madras: "Chennai",
  "new delhi": "Delhi", poona: "Pune", trivandrum: "Thiruvananthapuram", cochin: "Kochi", baroda: "Vadodara",
};
const CITY_KEYS = Object.keys(CITY_ZONE_MAP).sort((a, b) => b.length - a.length);

export const TIER_LABEL: Record<string, string> = { Metro: "metro", "Tier-1": "tier-1 city", "Tier-2": "tier-2 city" };

export function cityAnswer(textRaw: string): { city: string | null; tier: UserInputs["cityTier"] } | null {
  const t = ` ${textRaw.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ")} `;
  for (const [alias, city] of Object.entries(CITY_ALIASES)) if (t.includes(` ${alias} `)) return fromCity(city);
  const hit = CITY_KEYS.find((k) => t.includes(` ${k.toLowerCase()} `));
  if (hit) return fromCity(hit);
  if (/\bmetro\b/.test(t)) return { city: null, tier: "Metro" };
  if (/\btier ?1\b|\bbig city\b/.test(t)) return { city: null, tier: "Tier-1" };
  if (/\btier ?[23]\b|\bsmall(er)? (city|town)\b|\btown\b|\bvillage\b/.test(t)) return { city: null, tier: "Tier-2" };
  return null;
}

function fromCity(city: string) {
  const tier = getCityTier(city);
  return { city, tier: (tier === 1 ? "Metro" : tier === 2 ? "Tier-1" : "Tier-2") as UserInputs["cityTier"] };
}

export const CALC_CITY_ASK = "Which city do they live in? (Or just say metro, tier 1 or tier 2.)";
export const CALC_CITY_AGAIN = "I don't know that city. Type the nearest big city, or reply METRO, TIER 1 or TIER 2.";

export const CALC_AGE_ASK = "Cover calculator. How old is the eldest adult to be covered? Reply with the age, e.g. 42.";

export function ageBandFor(age: number): UserInputs["ageBand"] {
  if (age <= 30) return "18-30";
  if (age <= 45) return "31-45";
  if (age <= 60) return "46-60";
  return "60+";
}

export function parseAge(text: string): number | null {
  const m = text.match(/\b(\d{2})\b/);
  const n = m ? Number(m[1]) : NaN;
  return n >= 18 && n <= 99 ? n : null;
}

export function calcQuestionText(i: number, lead = ""): string {
  const q = CALC_QUESTIONS[i];
  return `${lead}${q.ask}\n${q.options.map((o, j) => `${j + 1}) ${o.label}`).join("\n")}`;
}

/** Runs the portal's calculator engine on these answers, with the advisor's partner insurers
 *  exactly as AgentCalculator.tsx passes them. */
export function runCalculator(inputs: UserInputs, partnered: string[]): EngineResult {
  return calculateHealthCover(inputs, { partnerCompanies: resolvePartnerCompanies(partnered) });
}

export function calcReply(l: Links, inputs: UserInputs, r: EngineResult, uuid: string): string {
  const label = (key: keyof UserInputs) =>
    CALC_QUESTIONS.find((q) => q.key === key)?.options.find((o) => o.value === inputs[key])?.label ?? String(inputs[key] ?? "");
  const where = inputs.city ? `${inputs.city} (${TIER_LABEL[inputs.cityTier] ?? inputs.cityTier})` : TIER_LABEL[inputs.cityTier] ?? inputs.cityTier;
  return [
    `Cover suggestion for age ${inputs.exactAge}, ${where}, ${label("familyStructure").toLowerCase()}:`,
    `Base cover: ${r.baseCover}`,
    `Super top-up: ${r.superTopUp}`,
    `Total protection: ${r.totalProtection}`,
    "",
    `Full report with premiums and riders: ${l.origin}/calculator/report/${uuid}`,
    "Reply SHARE to send it to the customer. Based on 5 answers; the portal calculator asks more for a finer result.",
  ].join("\n");
}

/* ── Compare ─────────────────────────────────────────────────────────── */

const STOP = new Set(["health", "insurance", "plan", "policy", "the", "company", "limited", "ltd", "co", "general", "of", "and"]);
const words = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9. ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));

export const planLabel = (p: CatalogPlan) =>
  [p.insurer, p.plan_name].filter(Boolean).join(" ") + (p.variant ? ` (${p.variant})` : "");

/** "compare Care Supreme vs Niva ReAssure 2.0" -> ["Care Supreme", "Niva ReAssure 2.0"]. */
export function parseCompareNames(textRaw: string): string[] {
  const rest = textRaw.replace(/^\s*compare\b[:\s]*/i, "");
  return rest
    .split(/\s+(?:vs\.?|versus|v\/s|and|with|or)\s+|\s*,\s*|\s*\/\s*/i)
    .map((x) => x.trim())
    .filter((x) => words(x).length > 0)
    .slice(0, 4);
}

/** Catalogue rows matching a name the advisor typed. Every meaningful word they typed must
 *  appear in the plan's insurer + name + variant. Exact plan-name matches win. */
export function matchPlans(query: string, catalog: CatalogPlan[]): CatalogPlan[] {
  const q = words(query);
  if (!q.length) return [];
  const hits = catalog.filter((p) => {
    const hay = words(`${p.insurer ?? ""} ${p.plan_name ?? ""} ${p.variant ?? ""}`);
    return q.every((w) => hay.some((h) => h === w || h.startsWith(w)));
  });
  const qn = q.join(" ");
  const exact = hits.filter((p) => words(p.plan_name ?? "").join(" ") === qn || words(planLabel(p)).join(" ") === qn);
  return exact.length ? exact : hits;
}

export function compareReply(l: Links, r: CompareResult): string {
  const names = r.names.map((n, i) => n || `Plan ${i + 1}`);
  const v = r.verdict;
  const out = [`Compared: ${names.join(" vs ")}.`];
  if (!v || v.winner_index < 0) {
    out.push("On the policy wordings these are too close to call.");
  } else {
    out.push(`Stronger on the wording: ${names[v.winner_index] ?? v.winner_name}.`);
    if (v.reasons?.length) out.push(`Why: ${v.reasons.slice(0, 2).join("; ")}.`);
    if (v.counterpoint) out.push(`But: ${v.counterpoint}.`);
  }
  out.push("", `Full side-by-side: ${l.origin}/compare/report/${r.uuid}`, "Reply SHARE to send it to the customer.");
  return out.join("\n").replace(/\.\./g, ".");
}

export const COMPARE_ASK = "Which plans? For example: compare Care Supreme vs Niva ReAssure 2.0 (up to 4, separated by vs).";

/* ── Client list ─────────────────────────────────────────────────────── */

const TYPE_WORDS: Record<string, string> = {
  health: "health", mediclaim: "health", motor: "motor", car: "motor", bike: "motor", vehicle: "motor",
  life: "life", term: "term", travel: "travel", property: "property", home: "property", fire: "fire", marine: "marine",
};

export function typeIn(text: string): string | null {
  for (const w of text.toLowerCase().split(/[^a-z]+/)) if (TYPE_WORDS[w]) return TYPE_WORDS[w];
  return null;
}

export function clientsReply(l: Links, type: string | null, data: { total: number; rows: PolicyRow[] }): string {
  const what = type ? `${type} policies` : "policies";
  if (data.total === 0) return `You have no checked ${what} yet. Send me a policy PDF to add one.`;
  const lines = data.rows.map((r, i) => {
    const plan = [r.insurer, r.policyName].filter(Boolean).join(" ");
    return `${i + 1}) ${r.name || "Unnamed"}${plan ? ` · ${plan}` : ""}${r.score != null ? ` · ${r.score}/100` : ""}`;
  });
  const more = data.total > data.rows.length ? `\n…and ${data.total - data.rows.length} more: ${l.origin}/agent/policies` : "";
  return `Your ${what} (${data.total}), newest first:\n${lines.join("\n")}${more}\n\nAsk about one by name, for example: Ramesh's policy room rent?`;
}

/* ── Share drafts for a calculator result or a comparison ────────────────
   Like the policy share (templates.ts), the message only says what the link is. */

export type Shareable =
  | { kind: "policy"; clientId: string }
  | { kind: "calc"; url: string }
  | { kind: "compare"; url: string; names: string };

export function toolShareDraft(lang: "english" | "hinglish" | "hindi", s: Exclude<Shareable, { kind: "policy" }>): string {
  if (s.kind === "calc") {
    if (lang === "hinglish") return `Namaste, maine aapke liye health cover ka hisaab nikala hai. Yahan dekhiye: ${s.url}`;
    if (lang === "hindi") return `नमस्ते, मैंने आपके लिए हेल्थ कवर का हिसाब निकाला है। यहाँ देखिए: ${s.url}`;
    return `Namaste, I have worked out how much health cover makes sense for you. Here it is: ${s.url}`;
  }
  if (lang === "hinglish") return `Namaste, ${s.names} ka side-by-side comparison yahan hai: ${s.url}`;
  if (lang === "hindi") return `नमस्ते, ${s.names} की तुलना यहाँ देखिए: ${s.url}`;
  return `Namaste, here is a side-by-side comparison of ${s.names}: ${s.url}`;
}
