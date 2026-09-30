/**
 * The advisor's daily CRM over WhatsApp: lead updates, follow-ups, lookup, message drafts,
 * checks left, report views, claims, surrender value and data-entry details.
 * Pure helpers: parsing and replies. Flows live in bot.ts. No model is involved anywhere;
 * surrender value is the portal's own engine (../shared/policyValue.ts, drift-tested).
 */

import type { ClientSummary } from "../engine.js";
import { computePolicyValue, isValueGap, type ValueSchedule } from "../shared/policyValue.js";
import type { DraftKind } from "../shared/draftMessage.js";
import { inr, portalPolicyUrl, type Links } from "./templates.js";
import { b, dayMonth, firstName, planLabel } from "./format.js";
import { devanagariToLatin, hasDevanagari } from "./i18n.js";

export type LeadRow = {
  id: string; name: string; phone: string | null; status: string | null;
  insurance_interest: string | null; next_follow_up: string | null; notes: string | null; days?: number;
};

/* ── Dates ("follow up Ramesh Friday") ───────────────────────────────── */

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Today's date in India, as a UTC-midnight Date for simple day arithmetic. */
function istToday(nowMs: number): Date {
  const ist = new Date(nowMs + 5.5 * 3600_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400_000);

/** A date phrase at the END of the text. Returns the date and the text before it. */
export function parseWhen(textRaw: string, nowMs: number): { date: string; rest: string } | null {
  const t = textRaw.toLowerCase().trim().replace(/[.!?]+$/, "");
  const today = istToday(nowMs);
  const tries: [RegExp, (m: RegExpMatchArray) => Date | null][] = [
    [/\s*(on\s+)?(today|aaj|आज)$/, () => today],
    [/\s*(kal|कल)$/, () => addDays(today, 1)],
    [/\s*(parso|parson|परसों|परसो)$/, () => addDays(today, 2)],
    [/\s*(agle|next)\s+(hafte|week)$|\s*अगले\s+(हफ़्ते|हफ्ते)$/, () => addDays(today, 7)],
    [/\s*(ravivar|itvaar|somvar|mangalvar|budhvar|guruvar|brihaspativar|shukravar|shanivar|रविवार|सोमवार|मंगलवार|बुधवार|गुरुवार|बृहस्पतिवार|शुक्रवार|शनिवार)(\s+(ko|को))?$/, (m) => {
      const w = m[1];
      const want = /ravi|itv|रवि/.test(w) ? 0 : /som|सोम/.test(w) ? 1 : /mangal|मंगल/.test(w) ? 2 : /budh|बुध/.test(w) ? 3
        : /guru|brihas|गुरु|बृहस्पति/.test(w) ? 4 : /shukra|शुक्र/.test(w) ? 5 : 6;
      let diff = (want - today.getUTCDay() + 7) % 7;
      if (diff === 0) diff = 7;
      return addDays(today, diff);
    }],
    [/\s*(on\s+)?(tomorrow|tmrw|tmr)$/, () => addDays(today, 1)],
    [/\s*(on\s+)?day after tomorrow$/, () => addDays(today, 2)],
    [/\s*next week$/, () => addDays(today, 7)],
    [/\s*(in\s+)?(\d{1,2})\s+days?$/, (m) => addDays(today, Number(m[2]))],
    [/\s*(on\s+|next\s+)?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)[a-z]*$/, (m) => {
      const want = DAYS.findIndex((d) => d.startsWith(m[2].slice(0, 3)));
      let diff = (want - today.getUTCDay() + 7) % 7;
      if (diff === 0) diff = 7;
      return addDays(today, diff);
    }],
    [/\s*(on\s+)?(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/, (m) => dmy(Number(m[2]), Number(m[3]), m[4], today)],
    [/\s*(on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*$/, (m) => dmy(Number(m[2]), MONTHS.indexOf(m[3]) + 1, undefined, today)],
    [/\s*(on\s+)?([a-z]{3})[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?$/, (m) => dmy(Number(m[3]), MONTHS.indexOf(m[2]) + 1, undefined, today)],
  ];
  for (const [re, f] of tries) {
    const m = t.match(re);
    if (!m) continue;
    const d = f(m);
    if (d) return { date: iso(d), rest: textRaw.trim().slice(0, m.index).trim() };
  }
  return null;
}

function dmy(day: number, month: number, yearRaw: string | undefined, today: Date): Date | null {
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return null;
  let year = yearRaw ? Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw) : today.getUTCFullYear();
  let d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1) return null;
  if (!yearRaw && d < today) d = new Date(Date.UTC(++year, month - 1, day));
  return d;
}

export function prettyDate(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()].slice(0, 3).replace(/^./, (c) => c.toUpperCase())} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].replace(/^./, (c) => c.toUpperCase())}`;
}

/* ── Lead updates ────────────────────────────────────────────────────── */

export type LeadUpdate = { name: string; status?: string; nextFollowUp?: string; note?: string };

// Hinglish and Hindi phrasings end the same way ("Ramesh ne policy le li", "रमेश ने मना कर
// दिया"); the particle (ne, se, ko) is part of the match, so it never ends up in the name.
// Order matters: "interested nahi hai" is lost, not interested.
const STATUS_WORDS: [RegExp, string][] = [
  [/(?:^|\s)(?:(?:ne|ko)\s+)?(?:mana kar diya|mana kar di|mana kiya|policy nahi li|nahi li|nahi lega|nahi legi|nahi chahiye|interested nahi(?: hai)?)$|(?:^|\s)(?:ने|को)?\s*(?:मना कर दिया|मना किया|पॉलिसी नहीं ली|नहीं ली|नहीं चाहिए|इंटरेस्टेड नहीं है)$/, "lost"],
  [/\b(not interested|no interest|dropped|lost|rejected)$/, "lost"],
  [/(?:^|\s)(?:ne\s+)?(?:policy le li|policy le liya|policy li|policy kharid li|le li|le liya|kharid li)$|(?:^|\s)ने\s+(?:पॉलिसी\s+)?(?:ले ली|ले लिया|ख़रीद ली|खरीद ली)$/, "won"],
  [/\b(won|converted|bought|signed up|signed)$/, "won"],
  [/(?:^|\s)(?:(?:ko\s+)?interest hai|interested hai|ready hai)$|(?:^|\s)(?:को\s+)?(?:इंटरेस्ट है|इंटरेस्टेड है|तैयार है)$/, "interested"],
  [/\b(interested|keen|hot)$/, "interested"],
  [/(?:^|\s)(?:(?:se|ko)\s+)?(?:baat ho gayi|baat hui|baat kar li|call kiya|call kar diya|call kar liya)$|(?:^|\s)(?:से|को)\s+(?:बात हो गई|बात हुई|कॉल किया|कॉल कर दिया)$/, "contacted"],
  [/\b(contacted|called|spoke|spoken to|talked to)$/, "contacted"],
];

/** A typed name as the book stores it: Devanagari converted, words capitalised. */
function bookName(name: string): string {
  return hasDevanagari(name) ? devanagariToLatin(name) : name.replace(/\b\w/g, (c) => c.toUpperCase());
}

const HINDI_WHEN = /^(kal|parso|parson|aaj|agle hafte|कल|परसों|आज|अगले हफ़्ते|अगले हफ्ते)\s+/i;

/** "Ramesh won" / "mark Ramesh interested" / "follow up Ramesh Friday" / "note Ramesh: wants
 *  a family floater". Null when it is none of these. */
export function parseLeadUpdate(textRaw: string, nowMs: number): LeadUpdate | null {
  const t = textRaw.trim();
  const note = t.match(/^(?:add\s+)?note\s+(?:for\s+|on\s+)?(.+?)\s*[:\-]\s*(.+)$/i);
  if (note) return { name: note[1].trim(), note: note[2].trim() };

  const fu = t.match(/^(?:follow[\s-]?up|call|call back|remind me to call)\s+(?:with\s+)?(.+)$/i);
  if (fu) {
    const w = parseWhen(fu[1], nowMs);
    if (w && w.rest.length >= 2) return { name: bookName(w.rest), nextFollowUp: w.date };
    return null;
  }

  // "Aniket ka followup 3rd November", "Deep ki call kal", "रमेश का फॉलो अप शुक्रवार"
  const kaFu = t.replace(/[.!?।]+$/, "").match(/^(.+?)\s+(?:ka|ki|ke|ko|का|की|के|को)\s+(?:follow[\s-]?up|followup|call|reminder|फॉलो[\s-]?अप|कॉल|रिमाइंडर)\s+(?:(?:on|for|ko|को)\s+)?(.+?)(?:\s+(?:karo|kardo|kar do|set karo|rakho|lagao|karna hai|करो|कर दो|रखो))?$/i);
  if (kaFu) {
    const who = kaFu[1].trim();
    const w = parseWhen(kaFu[2], nowMs);
    if (w && !w.rest && who.length >= 2 && who.split(/\s+/).length <= 4) return { name: bookName(who), nextFollowUp: w.date };
  }

  // "Ramesh ko kal call karna hai", "kal Ramesh ko follow up", "रमेश को शुक्रवार फॉलो अप"
  const hfu = t.replace(/[.!?।]+$/, "").match(/^(.+?)\s+(?:ko|को)\s+(.*?)\s*(?:call|phone|follow[\s-]?up|कॉल|फ़ोन|फोन|फॉलो[\s-]?अप)(?:\s+(?:karna|karo|karunga|karungi|karni|kar do|करना|करो|कर दो))?(?:\s+(?:hai|है))?$/i);
  if (hfu) {
    let who = hfu[1].trim();
    let when = hfu[2].trim();
    const lead = who.match(HINDI_WHEN);
    if (lead && !when) { when = lead[1]; who = who.slice(lead[0].length).trim(); }
    const w = when ? parseWhen(when, nowMs) : null;
    if (w && !w.rest && who.length >= 2 && who.split(/\s+/).length <= 4) return { name: bookName(who), nextFollowUp: w.date };
  }

  const lower = t.toLowerCase().replace(/[.!]+$/, "").replace(/^mark\s+/, "").replace(/\s+(?:is|as)\s+(?=[a-z ]+$)/, " ");
  for (const [re, status] of STATUS_WORDS) {
    const m = lower.match(re);
    if (!m || m.index === undefined) continue;
    const name = lower.slice(0, m.index).trim();
    if (name.length >= 2 && name.split(/\s+/).length <= 4 && /^[a-zऀ-ॿ .']+$/.test(name)) {
      return { name: bookName(name), status };
    }
  }
  return null;
}

const ALL = /(?:^|[\s,])(?:all|everyone'?s?|everybody|all of them|sab|sabse|sabko|sabke|sab ke|sabka|sabhi|in sab|inke|in sabko|सब|सबसे|सबको|सबके|सबका|सभी)(?=[\s,]|$)/;
const FU_WORD = /(remind|reminder|follow[\s-]?ups?|followups?|\bcalls?\b|रिमाइंडर|फॉलो[\s-]?अप|कॉल)/;
const DONE_WORD = /(ho ?gayi|ho ?gaya|ho ?gai|baat ho|baat kar li|spoke|talked|called|contacted|हो गई|हो गया|बात हो)/;

/** A change for EVERY lead on the follow-up list: "Sabke reminders 1st November kardo",
 *  "Sabse hogayi, all remind on Nov 3" (spoke to all, remind all on 3 Nov), "move all follow
 *  ups to Monday", "called everyone". Null when the message is not about all of them. */
export function parseBulkUpdate(textRaw: string, nowMs: number): { nextFollowUp?: string; status?: string } | null {
  const t = textRaw.trim().toLowerCase().replace(/[.!?।]+$/, "");
  if (!ALL.test(t)) return null;
  const out: { nextFollowUp?: string; status?: string } = {};
  // The date is whatever follows the follow-up word ("... remind on Nov 3", "... follow up kal").
  const fu = t.match(FU_WORD);
  if (fu && fu.index !== undefined) {
    const tail = t.slice(fu.index + fu[0].length).replace(/^\s*(?:s\b)?\s*(?:on|to|for|ko|को|par)?\s*/, "")
      .replace(/\s+(?:kardo|kar do|karo|set karo|rakho|move karo|shift karo|daal do|करो|कर दो|रखो)$/, "").trim();
    const w = tail ? parseWhen(tail, nowMs) : null;
    if (w && !w.rest) out.nextFollowUp = w.date;
  }
  if (DONE_WORD.test(t)) out.status = "contacted";
  if (!out.nextFollowUp && !out.status) return null;
  // "move all follow ups" with no date it could read is not a change.
  return out;
}

/** "Sabke reminders 1st November kardo", "move all follow ups to Monday": one new date for
 *  every lead on the follow-up list. The date, or null when it is not such a message. */
export function parseBulkFollowUp(textRaw: string, nowMs: number): string | null {
  const t = textRaw.trim().toLowerCase().replace(/[.!?।]+$/, "");
  const hi = t.match(/^(?:sab|sabke|sab ke|sabka|sabko|sabhi|sabhi ke|in sab ke|inke|all|everyone'?s?|सबके|सब के|सबका|सबको|सभी)(?:\s+(?:ka|ke|ki|ko|का|के|की|को))?\s+(?:reminders?|follow[\s-]?ups?|followups?|calls?|रिमाइंडर|फॉलो[\s-]?अप|कॉल)\s+(?:(?:on|to|for|ko|को)\s+)?(.+?)(?:\s+(?:kardo|kar do|karo|set karo|rakho|move karo|shift karo|daal do|करो|कर दो|रखो))?$/);
  const en = t.match(/^(?:move|set|shift|push|change)\s+(?:all|every|everyone'?s?)\s+(?:the\s+|my\s+)?(?:follow[\s-]?ups?|reminders?|calls?)\s+(?:to|for|on)\s+(.+)$/);
  const when = (hi || en)?.[1];
  if (!when) return null;
  const w = parseWhen(when, nowMs);
  return w && !w.rest ? w.date : null;
}

/** Every word typed is the start of a word in the lead's name: "ram" and "ramesh k" match
 *  "Ramesh Kumar"; "ok" does NOT match "Alok". Used wherever a typed name changes data. */
export function nameMatches(typed: string, full: string | null): boolean {
  const words = String(full || "").toLowerCase().split(/[^a-z\u0900-\u097F]+/).filter(Boolean);
  const want = typed.toLowerCase().split(/[^a-z\u0900-\u097F]+/).filter(Boolean);
  return want.length > 0 && want.every((w) => words.some((x) => x.startsWith(w)));
}

export function leadUpdatedReply(l: Links, lead: LeadRow, u: LeadUpdate): string {
  const bits: string[] = [];
  if (u.status) bits.push(`marked ${u.status}`);
  if (u.nextFollowUp) bits.push(`follow-up set for ${prettyDate(u.nextFollowUp)}`);
  if (u.note) bits.push("note added");
  const n = firstName(lead.name);
  const next =
    u.status === "won" ? `Next: thank you message for ${n}` :
    u.status === "lost" ? "" :
    !u.nextFollowUp && !lead.next_follow_up ? `Next: follow up ${n} next week` : "";
  return [`${b(lead.name)}: ${bits.join(", ")}.`, `${l.origin}/agent/leads/${lead.id}`, next].filter(Boolean).join("\n");
}

/* ── Follow-ups ──────────────────────────────────────────────────────── */

export function followupsReply(l: Links, leads: LeadRow[]): string {
  if (!leads.length) return "No follow-ups due today. Set one with: follow up Ramesh Friday";
  const lines = leads.slice(0, 15).map((r, i) => {
    const late = -(r.days ?? 0);
    // Past two months a day count stops meaning anything ("overdue 9423d"): show the date.
    const since = r.next_follow_up ? String(r.next_follow_up).slice(0, 10) : "";
    const when = late <= 0 ? "today" : late <= 60 || !since ? `overdue ${late}d` : `overdue since ${since}`;
    return `${i + 1}) ${[b(r.name), r.phone, when, r.insurance_interest].filter(Boolean).join(" · ")}`;
  });
  const more = leads.length > 15 ? `\n…and ${leads.length - 15} more: ${l.origin}/agent/leads` : "";
  return `📋 ${leads.length} ${leads.length === 1 ? "follow-up" : "follow-ups"} due:\n${lines.join("\n")}${more}\n\nDone with one? Reply for example: ${firstName(leads[0].name)} contacted`;
}

/* ── Message drafts (the portal's own templates) ─────────────────────── */

const DRAFT_WORDS: [RegExp, DraftKind][] = [
  [/\b(upgrade|improve|better plan|switch)\b/, "upgrade_weak"],
  [/\bpremium\b/, "premium_due"],
  [/\brenewal\b/, "renewal"],
  [/\breview\b/, "review"],
  [/\bthank/, "thank_you"],
  [/\b(birthday|bday|b'day|janmdin|janamdin)\b|जन्मदिन/, "birthday"],
  [/\b(anniversary|saalgirah|salgirah)\b|सालगिरह/, "anniversary"],
  [/\b(diwali|holi|eid|festival|christmas|new year|pongal|onam|navratri|dussehra|ganesh|raksha|rakhi|lohri|baisakhi|greeting|wishes)\b/, "festival"],
  [/\bfollow[\s-]?up\b/, "follow_up"],
];

/** "upgrade message for Santosh in hindi" -> kind + name. Null when not a draft request. */
export function parseDraft(textRaw: string): { kind: DraftKind; name: string | null } | null {
  const t = textRaw.toLowerCase();
  if (!/\b(message|msg|wish|wishes|greeting|note to|text to|badhai|shubhkamna)\b|बधाई|शुभकामना/.test(t)) return null;
  // "wish Aniket happy birthday" / "Aniket ko birthday wish bhejo"
  const wish = textRaw.match(/^\s*wish\s+(.+?)\s+(?:a\s+)?(?:very\s+)?(?:happy\s+)?(?:birthday|bday|b'day|anniversary|diwali|holi|eid|new year|christmas)\b/i)
    || textRaw.match(/^\s*(.+?)\s+(?:ko|को)\s+/i);
  const wishKind = DRAFT_WORDS.find(([re]) => re.test(t))?.[1];
  if (wish && wishKind && !/\b(for|to)\s/i.test(textRaw)) {
    const n = wish[1].trim();
    if (n.length >= 2 && n.split(/\s+/).length <= 4) return { kind: wishKind, name: bookName(n) };
  }
  const kind = DRAFT_WORDS.find(([re]) => re.test(t))?.[1];
  if (!kind) return null;
  const m = textRaw.match(/\b(?:for|to)\s+(.+?)(?:\s+in\s+(?:english|hinglish|hindi))?\s*[.!?]*$/i);
  const name = m ? m[1].trim() : null;
  return { kind, name: name && name.length >= 2 ? name : null };
}

/** Kinds that only make sense for a customer with a policy (portal DRAFT_KIND_META clientOnly). */
export const CLIENT_ONLY: DraftKind[] = ["upgrade_weak", "renewal", "premium_due"];

/* ── Lookup ──────────────────────────────────────────────────────────── */

export function lookupReply(l: Links, q: string, policies: ClientSummary[], leads: LeadRow[]): string {
  if (!policies.length && !leads.length) return `Nothing in your book for "${q}". Add them with: lead ${q} 98xxxxxxxx health`;
  const out: string[] = [`📋 ${policies.length} ${policies.length === 1 ? "policy" : "policies"} and ${leads.length} ${leads.length === 1 ? "lead" : "leads"} for "${q}":`];
  policies.forEach((p, i) => {
    const bits = [
      b(p.policyholderName || "Unnamed"), p.insuranceType || "policy", planLabel(p.insurer, p.policyName) || null,
      p.expiryDate ? `expires ${dayMonth(String(p.expiryDate))}` : null,
      p.insuranceType === "health" && p.score != null ? `${p.score}/100` : null,
    ].filter(Boolean);
    out.push(`${i + 1}) ${bits.join(" · ")}`, `   ${portalPolicyUrl(l, p.clientId)}`);
  });
  leads.forEach((r) => {
    const fu = r.next_follow_up ? `follow up ${dayMonth(r.next_follow_up)}` : null;
    out.push(`• Lead: ${[b(r.name), r.phone, r.status || "new", fu].filter(Boolean).join(" · ")}`, `   ${l.origin}/agent/leads/${r.id}`);
  });
  const n = firstName(policies[0]?.policyholderName || leads[0]?.name);
  out.push("", policies.length ? `Ask about it: ${n}'s policy room rent?` : `Next: follow up ${n} Friday`);
  return out.join("\n");
}

/* ── Views ───────────────────────────────────────────────────────────── */

export function viewsReply(rows: { name: string | null; insurer: string | null; policyName: string | null; views: number; lastViewed: string }[]): string {
  if (!rows.length) return "None of your shared reports have been opened yet. Share one with SHARE after a check.";
  const fmt = (s: string) => {
    const d = new Date(new Date(s).getTime() + 5.5 * 3600_000);
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].replace(/^./, (c) => c.toUpperCase())} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  };
  return `📋 ${rows.length} ${rows.length === 1 ? "customer has" : "customers have"} opened their report, latest first:\n` + rows.map((r, i) =>
    `${i + 1}) ${b(r.name || "Unnamed")}${r.policyName ? ` · ${r.policyName}` : ""} · ${r.views} ${r.views === 1 ? "view" : "views"} · last ${fmt(r.lastViewed)}`
  ).join("\n") + `\n\nA good moment to call. Their details: FIND ${firstName(rows[0].name)}`;
}

/* ── Claims (the Claims desk) ────────────────────────────────────────── */

/** Labels as the portal's Claims desk shows them (lib/claims.ts CLAIM_STATUS_META). */
const CLAIM_LABEL: Record<string, string> = {
  opened: "Opened", docs_received: "Docs in", submitted: "Submitted", under_process: "In process",
  query_raised: "Query", settled: "Settled", rejected: "Rejected",
};

export type ClaimRow = {
  id: string; status: string; claim_type: string; insurer: string | null; hospital: string | null; ailment: string | null;
  claimed_amount: string | number | null; settled_amount: string | number | null; admitted_on: string | null;
  customer_name: string | null; openQueries: { seq: number; question: string; raisedOn: string }[];
};

export function claimsReply(l: Links, rows: ClaimRow[], q: string | null): string {
  if (!rows.length) return q ? `No claims matching "${q}".` : "No open claims. Settled and rejected ones are in the portal.";
  if (rows.length === 1 && q) {
    const c = rows[0];
    const out = [
      `📋 ${b(c.customer_name || "Claim")} · ${[c.hospital, c.ailment].filter(Boolean).join(", ") || c.claim_type}`,
      `Status: ${CLAIM_LABEL[c.status] ?? c.status} (${c.claim_type})`,
    ];
    if (c.insurer) out.push(`Insurer: ${c.insurer}`);
    if (c.admitted_on) out.push(`Admitted: ${String(c.admitted_on).slice(0, 10)}`);
    if (c.claimed_amount != null) out.push(`Claimed: ${inr(c.claimed_amount)}`);
    if (c.settled_amount != null) out.push(`Settled: ${inr(c.settled_amount)}`);
    if (c.openQueries.length) {
      out.push(`Open insurer queries (${c.openQueries.length}):`);
      for (const x of c.openQueries) out.push(`• Q${x.seq} (${String(x.raisedOn).slice(0, 10)}): ${x.question}`);
    }
    out.push(`${l.origin}/agent/claims/${c.id}`);
    return out.join("\n");
  }
  const lines = rows.map((c, i) => {
    const q = c.openQueries.length ? ` (${c.openQueries.length} open ${c.openQueries.length === 1 ? "query" : "queries"})` : "";
    const amt = c.claimed_amount != null ? ` · ${inr(c.claimed_amount)}` : "";
    return `${i + 1}) ${b(c.customer_name || "Unnamed")} · ${[c.hospital, c.ailment].filter(Boolean).join(", ") || c.claim_type} · ${CLAIM_LABEL[c.status] ?? c.status}${q}${amt}`;
  });
  return `📋 ${rows.length} ${q ? `${rows.length === 1 ? "claim" : "claims"} matching "${q}"` : `open ${rows.length === 1 ? "claim" : "claims"}`}:\n${lines.join("\n")}\n\nDetails on one: claim ${firstName(rows[0].customer_name) || "Ramesh"}\n${l.origin}/agent/claims`;
}

/* ── Surrender value (life / term) ───────────────────────────────────── */

export const VALUE_TYPES = ["life", "term"];

/** Runs the portal's policy-value engine on the stored fields, as PolicyValueChart does. */
export function valueReply(l: Links, c: ClientSummary, nowMs: number): string {
  const url = portalPolicyUrl(l, c.clientId);
  const v = computePolicyValue(c.insuranceType || "life", c.extracted as any, { asOf: new Date(nowMs) });
  if (isValueGap(v)) {
    return `I can't work out ${c.policyholderName || "this"}'s policy value yet. Missing: ${v.missing.join(", ")}. Fill these in on the policy in the portal: ${url}`;
  }
  const s = v as ValueSchedule;
  const head = `${b(c.policyholderName || "Policy")} · ${planLabel(c.insurer, c.policyName) || c.insuranceType}`;
  if (s.shape === "pure_term") {
    return `${head}\nThis is term cover only, so it has no surrender or maturity value. It pays only on a claim.\n${url}`;
  }
  const row = s.rows.find((r) => r.year === s.currentYear) ?? null;
  const out = [head];
  if (row) {
    out.push(`If surrendered now (policy year ${row.year}): ${inr(row.back)} back, against ${inr(row.paid)} paid so far.`);
    if (row.maxLoan > 0) out.push(`Or borrow up to ${inr(row.maxLoan)} against it and keep the cover.`);
  }
  if (s.maturity) out.push(`At maturity (year ${s.term}): ${inr(s.maturity)}${s.guaranteed ? ", guaranteed" : ", projected"}.`);
  if (s.premiumStatusNote) out.push(s.premiumStatusNote);
  out.push(`Full year-by-year values: ${url}`);
  return out.join("\n");
}

/* ── Data-entry details (motor, life, travel...) ─────────────────────── */

export function detailsReply(l: Links, c: ClientSummary): string {
  const url = portalPolicyUrl(l, c.clientId);
  const d = (c.details || []).slice(0, 14);
  if (!d.length) return `This ${c.insuranceType || ""} policy has no details filled in yet. See it in the portal: ${url}`;
  const extra = VALUE_TYPES.includes(c.insuranceType || "") ? "\nSurrender value: reply SURRENDER VALUE " + (c.policyholderName?.split(" ")[0] || "") : "";
  return `${b(c.policyholderName || "Policy")} · ${planLabel(c.insurer, c.policyName) || c.insuranceType} · ${c.insuranceType} policy (scores are for health only)\n${d.map((x) => `• ${x.label}: ${x.value}`).join("\n")}${extra}\n${url}`;
}

/* ── Lead list ───────────────────────────────────────────────────────── */

export function leadsListReply(l: Links, data: { total: number; leads: LeadRow[] }): string {
  if (!data.total) return "You have no leads yet. Add one with: lead Ramesh 98123 45678 health";
  const lines = data.leads.map((r, i) => {
    const fu = r.next_follow_up ? `follow up ${dayMonth(r.next_follow_up)}` : null;
    return `${i + 1}) ${[b(r.name), r.phone, r.status || "new", r.insurance_interest, fu].filter(Boolean).join(" · ")}`;
  });
  const more = data.total > data.leads.length ? `\n…and ${data.total - data.leads.length} more: ${l.origin}/agent/leads` : "";
  return `📋 Your leads (${data.total}), latest first:\n${lines.join("\n")}${more}\n\nUpdate one, for example: ${firstName(data.leads[0]?.name) || "Ramesh"} interested`;
}
