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
    [/\s*(on\s+)?today$/, () => today],
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

const STATUS_WORDS: [RegExp, string][] = [
  [/\b(not interested|no interest|dropped|lost|rejected)$/, "lost"],
  [/\b(won|converted|bought|signed up|signed)$/, "won"],
  [/\b(interested|keen|hot)$/, "interested"],
  [/\b(contacted|called|spoke|spoken to|talked to)$/, "contacted"],
];

/** "Ramesh won" / "mark Ramesh interested" / "follow up Ramesh Friday" / "note Ramesh: wants
 *  a family floater". Null when it is none of these. */
export function parseLeadUpdate(textRaw: string, nowMs: number): LeadUpdate | null {
  const t = textRaw.trim();
  const note = t.match(/^(?:add\s+)?note\s+(?:for\s+|on\s+)?(.+?)\s*[:\-]\s*(.+)$/i);
  if (note) return { name: note[1].trim(), note: note[2].trim() };

  const fu = t.match(/^(?:follow[\s-]?up|call|call back|remind me to call)\s+(?:with\s+)?(.+)$/i);
  if (fu) {
    const w = parseWhen(fu[1], nowMs);
    if (w && w.rest.length >= 2) return { name: w.rest, nextFollowUp: w.date };
    return null;
  }

  const lower = t.toLowerCase().replace(/[.!]+$/, "").replace(/^mark\s+/, "").replace(/\s+(?:is|as)\s+(?=[a-z ]+$)/, " ");
  for (const [re, status] of STATUS_WORDS) {
    const m = lower.match(re);
    if (!m || m.index === undefined) continue;
    const name = lower.slice(0, m.index).trim();
    if (name.length >= 2 && name.split(/\s+/).length <= 4 && /^[a-zऀ-ॿ .']+$/.test(name)) {
      return { name: name.replace(/\b\w/g, (c) => c.toUpperCase()), status };
    }
  }
  return null;
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
  return `${lead.name}: ${bits.join(", ")}.\n${l.origin}/agent/leads/${lead.id}`;
}

/* ── Follow-ups ──────────────────────────────────────────────────────── */

export function followupsReply(l: Links, leads: LeadRow[]): string {
  if (!leads.length) return "No follow-ups due today. Set one with: follow up Ramesh Friday";
  const lines = leads.slice(0, 15).map((r, i) => {
    const when = (r.days ?? 0) < 0 ? `overdue ${-(r.days ?? 0)}d` : "today";
    const phone = r.phone ? ` · ${r.phone}` : "";
    return `${i + 1}) ${r.name}${phone} · ${when}${r.insurance_interest ? ` · ${r.insurance_interest}` : ""}`;
  });
  const more = leads.length > 15 ? `\n…and ${leads.length - 15} more: ${l.origin}/agent/leads` : "";
  return `Follow-ups due (${leads.length}):\n${lines.join("\n")}${more}\n\nDone with one? Reply for example: Ramesh contacted, or follow up Ramesh next week`;
}

/* ── Message drafts (the portal's own templates) ─────────────────────── */

const DRAFT_WORDS: [RegExp, DraftKind][] = [
  [/\b(upgrade|improve|better plan|switch)\b/, "upgrade_weak"],
  [/\bpremium\b/, "premium_due"],
  [/\brenewal\b/, "renewal"],
  [/\breview\b/, "review"],
  [/\bthank/, "thank_you"],
  [/\b(diwali|holi|eid|festival|christmas|new year|pongal|onam|navratri|dussehra|ganesh|raksha|rakhi|lohri|baisakhi|greeting|wishes)\b/, "festival"],
  [/\bfollow[\s-]?up\b/, "follow_up"],
];

/** "upgrade message for Santosh in hindi" -> kind + name. Null when not a draft request. */
export function parseDraft(textRaw: string): { kind: DraftKind; name: string | null } | null {
  const t = textRaw.toLowerCase();
  if (!/\b(message|msg|wish|wishes|greeting|note to|text to)\b/.test(t)) return null;
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
  const out: string[] = [];
  if (policies.length) {
    out.push(`Policies (${policies.length}):`);
    policies.forEach((p, i) => {
      const plan = [p.insurer, p.policyName].filter(Boolean).join(" ");
      const score = p.insuranceType === "health" && p.score != null ? ` · ${p.score}/100` : "";
      const exp = p.expiryDate ? ` · expires ${String(p.expiryDate).slice(0, 10)}` : "";
      out.push(`${i + 1}) ${p.policyholderName || "Unnamed"} · ${p.insuranceType || "policy"}${plan ? ` · ${plan}` : ""}${score}${exp}`);
      out.push(`   ${portalPolicyUrl(l, p.clientId)}`);
    });
  }
  if (leads.length) {
    out.push(`${policies.length ? "\n" : ""}Leads (${leads.length}):`);
    leads.forEach((r) => {
      const fu = r.next_follow_up ? ` · follow up ${prettyDate(r.next_follow_up)}` : "";
      out.push(`• ${r.name}${r.phone ? ` · ${r.phone}` : ""} · ${r.status || "new"}${fu}`);
      out.push(`   ${l.origin}/agent/leads/${r.id}`);
    });
  }
  if (policies.length) out.push("", "Ask about one by name, for example: " + (policies[0].policyholderName?.split(" ")[0] || "Ramesh") + "'s policy room rent?");
  return out.join("\n");
}

/* ── Views ───────────────────────────────────────────────────────────── */

export function viewsReply(rows: { name: string | null; insurer: string | null; policyName: string | null; views: number; lastViewed: string }[]): string {
  if (!rows.length) return "None of your shared reports have been opened yet. Share one with SHARE after a check.";
  const fmt = (s: string) => {
    const d = new Date(new Date(s).getTime() + 5.5 * 3600_000);
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].replace(/^./, (c) => c.toUpperCase())} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  };
  return "Reports customers opened, latest first:\n" + rows.map((r, i) =>
    `${i + 1}) ${r.name || "Unnamed"}${r.policyName ? ` · ${r.policyName}` : ""} · ${r.views} ${r.views === 1 ? "view" : "views"} · last ${fmt(r.lastViewed)}`
  ).join("\n") + "\n\nA good moment to call them.";
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
      `${c.customer_name || "Claim"} · ${[c.hospital, c.ailment].filter(Boolean).join(", ") || c.claim_type}`,
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
    return `${i + 1}) ${c.customer_name || "Unnamed"} · ${[c.hospital, c.ailment].filter(Boolean).join(", ") || c.claim_type} · ${CLAIM_LABEL[c.status] ?? c.status}${q}${amt}`;
  });
  return `${q ? `Claims matching "${q}"` : "Open claims"} (${rows.length}):\n${lines.join("\n")}\n\nDetails on one: claim Ramesh\n${l.origin}/agent/claims`;
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
  const head = `${c.policyholderName || "Policy"} · ${[c.insurer, c.policyName].filter(Boolean).join(" ") || c.insuranceType}`;
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
  return `${c.policyholderName || "Policy"} · ${c.insuranceType} policy (no score: scores are for health only)\n${d.map((x) => `• ${x.label}: ${x.value}`).join("\n")}${extra}\n${url}`;
}
