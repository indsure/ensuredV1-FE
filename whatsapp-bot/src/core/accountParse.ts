/**
 * Stage 4: My Page, profile, team and help. Reading the requests ("add motor to my page",
 * "take my page offline", "I work with Star and Care", "give Ravi 10 checks", "how do I add a
 * claim?"). Pure: text in, request out. The bot shows each change and asks YES; the server checks
 * it again (backend/server/whatsapp/edits.ts, stage 4).
 */

import { PAGE_LANGS, PAGE_LANG_NAMES, PARTNER_INSURERS } from "../shared/editRules.js";

const clean = (s: string) => s.trim().replace(/[.!?।]+$/, "").trim();
const PAGE = "(?:my\\s+)?(?:page|website|site|web\\s*page|mera\\s+page|meri\\s+website)";

export type PageAsk =
  | { kind: "view" }
  | { kind: "publish"; on: boolean }
  | { kind: "set"; field: "display_name" | "city" | "whatsapp_number" | "primary_locale"; value: string }
  | { kind: "lines"; add: string[]; remove: string[] }
  | { kind: "langs"; add: string[]; remove: string[] }
  | { kind: "share"; campaign: string | null };

const LOB_WORDS: [RegExp, string][] = [[/\b(?:term)\b/i, "term"], [/\b(?:health|mediclaim)\b/i, "health"], [/\b(?:life|lic)\b/i, "life"], [/\b(?:motor|vehicle|car|bike|two wheeler)\b/i, "vehicle"]];
const lobOf = (s: string) => LOB_WORDS.filter(([re]) => re.test(s)).map(([, v]) => v);
const langOf = (s: string) => PAGE_LANGS.filter((c) => new RegExp(`\\b${PAGE_LANG_NAMES[c]}\\b`, "i").test(s));

export function parsePageAsk(textRaw: string): PageAsk | null {
  const t = clean(textRaw);
  if (new RegExp(`^(?:show\\s+)?${PAGE}\\s+(?:details|settings|info)$|^(?:what'?s|what is) on my page$|^show\\s+my\\s+page$|^mera\\s+page\\s+dikhao$|^मेरा\\s+पेज\\s+दिखाओ$`, "i").test(t)) return { kind: "view" };
  if (new RegExp(`^(?:publish|launch|go live with|make live|turn on)\\s+${PAGE}$|^make\\s+${PAGE}\\s+live$|^${PAGE}\\s+(?:live|on|chalu)\\s+(?:karo|kar do)$`, "i").test(t)) return { kind: "publish", on: true };
  if (new RegExp(`^(?:take|put)\\s+${PAGE}\\s+(?:offline|down)$|^(?:unpublish|hide|turn off)\\s+${PAGE}$|^${PAGE}\\s+(?:band|off)\\s+(?:karo|kar do)$`, "i").test(t)) return { kind: "publish", on: false };
  let m = t.match(new RegExp(`^(?:add|remove|drop)\\s+(.+?)\\s+(?:to|from|on)\\s+${PAGE}(?:\\s+languages?)?$`, "i"));
  if (m) {
    const add = /^add/i.test(t);
    const langs = langOf(m[1]);
    const lines = lobOf(m[1]);
    if (/languages?$/i.test(t) || (langs.length && !lines.length)) return langs.length ? { kind: "langs", add: add ? langs : [], remove: add ? [] : langs } : null;
    if (lines.length) return { kind: "lines", add: add ? lines : [], remove: add ? [] : lines };
    return null;
  }
  m = t.match(/^i (?:also )?speak (.+)$/i);
  if (m && langOf(m[1]).length) return { kind: "langs", add: langOf(m[1]), remove: [] };
  m = t.match(new RegExp(`^(?:change\\s+|set\\s+)?${PAGE}(?:'s)?\\s+(name|city|whatsapp(?: number)?|number|language)\\s+(?:to|is|as|=|:)\\s+(.+)$`, "i"))
    || t.match(new RegExp(`^(?:change|set)\\s+(?:the\\s+)?(name|city|whatsapp(?: number)?|number|language)\\s+(?:on|of)\\s+${PAGE}\\s+(?:to|as)\\s+(.+)$`, "i"));
  if (m) {
    const w = m[1].toLowerCase();
    const v = clean(m[2]);
    if (w === "language") {
      const l = /hindi|हिंदी/i.test(v) ? "hi" : /english/i.test(v) ? "en" : null;
      return l ? { kind: "set", field: "primary_locale", value: l } : null;
    }
    return { kind: "set", field: w === "name" ? "display_name" : w === "city" ? "city" : "whatsapp_number", value: v };
  }
  m = new RegExp(`^(?:${PAGE}\\s+in\\s+(hindi|english))$`, "i").exec(t);
  if (m) return { kind: "set", field: "primary_locale", value: /hindi/i.test(m[1]) ? "hi" : "en" };
  m = t.match(new RegExp(`^(?:share|send)\\s+${PAGE}(?:\\s+link)?(?:\\s+for\\s+(.+))?$|^${PAGE}\\s+link\\s+for\\s+(.+)$`, "i"));
  if (m) {
    const c = (m[1] || m[2] || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
    return { kind: "share", campaign: c || null };
  }
  return null;
}

export type ProfileAsk =
  | { kind: "view" }
  | { kind: "set"; field: "name" | "city"; value: string }
  | { kind: "partners"; mode: "set" | "add" | "remove"; names: string[]; unknown: string[] };

/** Partner names as advisors say them ("Star", "Care", "HDFC Ergo", "New India"). */
export function partnersIn(text: string): { names: string[]; unknown: string[] } {
  const parts = text.split(/\s*(?:,|\band\b|\baur\b|&|\/)\s*/i).map((x) => x.trim()).filter(Boolean);
  const names: string[] = [];
  const unknown: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase().replace(/\b(?:health|insurance|general|company|co)\b/g, "").trim();
    const hit = key ? PARTNER_INSURERS.find((n) => n.toLowerCase().startsWith(key) || n.toLowerCase().replace(/\s+/g, "").startsWith(key.replace(/\s+/g, ""))) : null;
    if (hit) { if (!names.includes(hit)) names.push(hit); } else unknown.push(p);
  }
  return { names, unknown };
}

export function parseProfileAsk(textRaw: string): ProfileAsk | null {
  const t = clean(textRaw);
  if (/^(?:my\s+)?(?:profile|account details|my details)$|^(?:mera|meri)\s+(?:profile|details)(?:\s+dikhao)?$|^मेरी\s+प्रोफ़ाइल/i.test(t)) return { kind: "view" };
  let m = t.match(/^(?:change|update|set)\s+my\s+(name|city)\s+(?:to|as)\s+(.+)$/i) || t.match(/^my\s+(name|city)\s+is\s+(.+)$/i);
  if (m) return { kind: "set", field: m[1].toLowerCase() as "name" | "city", value: clean(m[2]) };
  m = t.match(/^i\s+(?:work|am empanelled|am empaneled|sell)\s+with\s+(.+)$/i) || t.match(/^my\s+partners?(?:\s+insurers?)?\s+(?:are|is)\s+(.+)$/i);
  if (m) return { kind: "partners", mode: "set", ...partnersIn(m[1]) };
  m = t.match(/^(add|remove)\s+(.+?)\s+(?:to|from)\s+my\s+partners?(?:\s+insurers?)?$/i);
  if (m) return { kind: "partners", mode: m[1].toLowerCase() as "add" | "remove", ...partnersIn(m[2]) };
  if (/^(?:my\s+)?partners?(?:\s+insurers?)?$/i.test(t)) return { kind: "view" };
  return null;
}

export type TeamAsk = { kind: "view" } | { kind: "move"; who: string; count: number } | { kind: "reads" };
export function parseTeamAsk(textRaw: string): TeamAsk | null {
  const t = clean(textRaw);
  if (/^(?:my\s+)?team(?:\s+members)?$|^(?:show|list)\s+(?:my\s+)?team$|^meri\s+team(?:\s+dikhao)?$|^मेरी\s+टीम/i.test(t)) return { kind: "view" };
  if (/^who (?:opened|read|saw|viewed) my book$|^(?:mera|meri) book kisne dekhi$/i.test(t)) return { kind: "reads" };
  const hi = t.match(/^(.+?)\s+ko\s+(\d{1,4})\s+(?:policy\s+)?checks?\s+(?:do|de do|dedo)$/i);
  if (hi && !/^(?:mujhe|me)$/i.test(hi[1].trim())) return { kind: "move", who: clean(hi[1]), count: Number(hi[2]) };
  const m = t.match(/^(?:give|move|send|transfer)\s+(.+?)\s+(\d{1,4})\s+(?:policy\s+)?checks?$/i)
    || t.match(/^(?:give|move|send|transfer)\s+(\d{1,4})\s+(?:policy\s+)?checks?\s+to\s+(.+)$/i);
  if (m) {
    const [who, n] = /^\d/.test(m[1]) ? [m[2], m[1]] : [m[1], m[2]];
    return /^(?:me|my|myself)$/i.test(who.trim()) ? null : { kind: "move", who: clean(who), count: Number(n) };
  }
  return null;
}

/** "how do I add a claim?" -> the help-centre page that answers it (frontend/client/src/docs/content.ts). */
const HELP: [RegExp, string, string][] = [
  [/\bclaims?\b|क्लेम/i, "claims", "Claims"],
  [/\bleads?\b|लीड/i, "leads", "Leads"],
  [/\brenewals?\b/i, "renewals", "Renewals"],
  [/\bcustomers?\b/i, "customers", "Customers"],
  [/\b(?:check|upload|audit)\b.*\bpolic|\bpolicy check/i, "check-a-policy", "Check a policy"],
  [/\breport\b|\bshare\b/i, "share-with-customers", "Share with customers"],
  [/\bcompare\b/i, "compare", "Compare"],
  [/\bcalculator\b|\bhow much cover\b/i, "cover-calculator", "Cover calculator"],
  [/\bsurrender\b/i, "surrender-value", "Surrender value"],
  [/\brider/i, "riders", "Riders"],
  [/\b(?:my page|website)\b/i, "my-website", "My website"],
  [/\bteam\b/i, "team", "Team"],
  [/\bwhatsapp\b/i, "whatsapp-assistant", "WhatsApp assistant"],
  [/\b(?:plan|price|pricing|subscription|credits?)\b/i, "plans", "Plans"],
  [/\b(?:password|account|profile|login|log in)\b/i, "account", "Account"],
  [/\b(?:data|privacy|delete my)\b/i, "your-data", "Your data"],
];
export function parseHowto(textRaw: string): { slug: string; title: string } | null {
  const t = clean(textRaw);
  const feature = /^(?:claims?|leads?|customers?|polic(?:y|ies)|reports?|page|website|team|renewals?|calculator|compare|क्लेम|लीड)\s+(?:kaise|कैसे)\b/i;
  if (!/^(?:how (?:do|can|to|does) (?:i |we )?|how to |where (?:do|can) i |help with )/i.test(t) && !feature.test(t)) return null;
  // Checking a policy and finding someone have their own in-chat answers (menu choices 1 and 5).
  if (/^(?:how (?:do|can) i check (?:a )?polic(?:y|ies)|how to check (?:a )?polic(?:y|ies)|policy kaise check)/i.test(t)) return null;
  const hit = HELP.find(([re]) => re.test(t));
  return hit ? { slug: hit[1], title: hit[2] } : null;
}
