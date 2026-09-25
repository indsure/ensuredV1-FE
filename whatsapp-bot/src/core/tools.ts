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

type Q = { key: keyof UserInputs; ask: string; options: { label: string; value: string }[] };

/** The five answers the engine needs (UserInputs level 1), in plain words. Values are the
 *  engine's own enum strings, unchanged. */
export const CALC_QUESTIONS: Q[] = [
  {
    key: "cityTier",
    ask: "Where do they live?",
    options: [
      { label: "Metro city", value: "Metro" },
      { label: "Other big city (Tier-1)", value: "Tier-1" },
      { label: "Smaller city (Tier-2)", value: "Tier-2" },
      { label: "Town or village", value: "Other" },
    ],
  },
  {
    key: "familyStructure",
    ask: "Who needs to be covered?",
    options: [
      { label: "Just them", value: "Individual" },
      { label: "Couple", value: "Couple" },
      { label: "Couple with kids", value: "Couple + kids" },
      { label: "Family including parents", value: "Parents included" },
    ],
  },
  {
    key: "employerCover",
    ask: "Health cover from their employer?",
    options: [
      { label: "None", value: "None" },
      { label: "Under ₹5 lakh", value: "< 5L" },
      { label: "₹5 to 10 lakh", value: "5-10L" },
      { label: "Over ₹10 lakh", value: "> 10L" },
    ],
  },
  {
    key: "riskPosture",
    ask: "How much risk are they comfortable with?",
    options: [
      { label: "Minimum cover, but safe", value: "Minimum but safe" },
      { label: "Balanced", value: "Balanced" },
      { label: "No financial shock at all", value: "Zero financial shock" },
    ],
  },
];

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

export function calcQuestionText(i: number): string {
  const q = CALC_QUESTIONS[i];
  return `${q.ask}\n${q.options.map((o, j) => `${j + 1}) ${o.label}`).join("\n")}`;
}

/** Runs the portal's calculator engine on these answers, with the advisor's partner insurers
 *  exactly as AgentCalculator.tsx passes them. */
export function runCalculator(inputs: UserInputs, partnered: string[]): EngineResult {
  return calculateHealthCover(inputs, { partnerCompanies: resolvePartnerCompanies(partnered) });
}

export function calcReply(l: Links, inputs: UserInputs, r: EngineResult, uuid: string): string {
  const label = (key: keyof UserInputs) =>
    CALC_QUESTIONS.find((q) => q.key === key)?.options.find((o) => o.value === inputs[key])?.label ?? String(inputs[key] ?? "");
  return [
    `Cover suggestion for age ${inputs.exactAge}, ${label("cityTier").toLowerCase()}, ${label("familyStructure").toLowerCase()}:`,
    `Base cover: ${r.baseCover}`,
    `Super top-up: ${r.superTopUp}`,
    `Total protection: ${r.totalProtection}`,
    "",
    `Full report with premiums and riders (you can share this link with the customer): ${l.origin}/calculator/report/${uuid}`,
    "Based on 5 answers. For a finer result, use the calculator in the portal.",
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
  out.push("", `Full side-by-side (you can share this link): ${l.origin}/compare/report/${r.uuid}`);
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
