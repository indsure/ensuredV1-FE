/**
 * Questions about a checked policy, answered from the stored report WITHOUT the model
 * wherever a rule can find the field (brief §6.2). Every sentence here is a stored field,
 * formatted. When no rule matches, the bot asks the backend to phrase an answer from the
 * same fields (number-guarded), and failing that says the report doesn't cover it.
 */

import type { ClientSummary } from "../engine.js";
import { inr, verdictLabel } from "./templates.js";

type R = NonNullable<ClientSummary["report"]>;

const has = (t: string, re: RegExp) => re.test(t.toLowerCase());

/** Returns the answer text, or null when no rule covers the question. */
export function ruleAnswer(question: string, c: ClientSummary): string | null {
  const r = c.report;
  if (!r) return null;
  const q = question.toLowerCase();

  // The basics the portal's Policies list shows: insurer, plan, next premium date, score, Keep/Switch.
  if (has(q, /next premium|premium (date|due)|renew|expir|due date|valid|kab tak|end date|khatam|kab (hai|tak)|रिन्यूअल|कब तक/)) return renewal(c);
  if (has(q, /keep or switch|switch|should .*(change|port|move)|port\b|badal|बदल/)) return keepSwitch(c);
  if (has(q, /\binsurer\b|which company|kaunsi company|kon si company|company (name|kaunsi)|कंपनी/)) return c.insurer ? `Insurer: ${c.insurer}.` : null;
  if (has(q, /plan name|which plan|kaunsa plan|kon sa plan|प्लान/)) return c.policyName ? `Plan: ${c.policyName}${c.insurer ? ` (${c.insurer})` : ""}.` : null;
  if (has(q, /\b(details?|basic|basics|summary|info|information|overview|jaankari|jankari|batao|bata do|sab kuch)\b|about (this|the|his|her) policy|policy (kya|kaisi) hai|जानकारी|बताओ/)) return basics(c);

  if (has(q, /room rent|room limit|room category|kamra|room\b/)) return roomRent(r);
  if (has(q, /co-?pay|copay|co payment/)) return coPay(r);
  if (has(q, /sub-?limit|cataract|knee|capped|cap on/)) return subLimits(r);
  if (has(q, /\bscore\b|rating|how good|kaisa hai|verdict/)) return score(c, r);
  if (has(q, /effective cover|real cover|how much cover|sum insured|cover amount|kitna cover|cover kitna/)) return cover(r);
  if (has(q, /premium/)) return r.premiumTotal != null ? `Premium on the schedule: ${inr(r.premiumTotal)}, total payable.` : null;
  if (has(q, /what (actually )?works|good (points|things)|strength|positives?/)) return works(r);
  if (has(q, /cost (you|him|her|them)|where.*(fail|cost)|problems?|gaps?|weak|risks?|watch out/)) return costs(r);
  return null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2027-09-21..." -> "21 Sep 2027", as the Policies list shows it. */
export function fullDate(v: string | null | undefined): string | null {
  const m = String(v ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : null;
}

/** The portal's Keep / Switch: a health policy scoring under 70 is Switch (PoliciesNew.tsx). */
export const keepOrSwitch = (score: number | null) => (score == null ? null : score < 70 ? "Switch" : "Keep");

function renewal(c: ClientSummary): string {
  const d = fullDate(c.expiryDate);
  return d ? `Next premium date: ${d}.` : "The policy has no renewal date recorded. Add it on the policy in the portal.";
}

function keepSwitch(c: ClientSummary): string | null {
  const k = keepOrSwitch(c.score);
  if (!k) return null;
  return k === "Keep"
    ? `Keep. It scores ${c.score}/100, so it should hold up at claim time.`
    : `Switch. It scores ${c.score}/100, under 70, so it has gaps worth fixing. Reply UPGRADE MESSAGE for a ready message.`;
}

/** Everything on the Policies list row, plus cover and premium, in one card. */
export function basics(c: ClientSummary): string {
  const r = c.report;
  const k = keepOrSwitch(c.score);
  const lines = [
    `${c.policyholderName ? `*${c.policyholderName.replace(/\*/g, "")}*` : "This policy"}${c.insuranceType ? ` · ${c.insuranceType}` : ""}`,
    c.insurer ? `Insurer: ${c.insurer}` : null,
    c.policyName ? `Plan: ${c.policyName}` : null,
    fullDate(c.expiryDate) ? `Next premium date: ${fullDate(c.expiryDate)}` : null,
    c.score != null ? `Score: ${c.score}/100 · ${k}` : null,
    r?.baseSumInsured != null ? `Sum insured: ${inr(r.baseSumInsured)}` : null,
    r?.premiumTotal != null ? `Premium: ${inr(r.premiumTotal)}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

function roomRent(r: R): string {
  const rr = r.roomRent;
  if (!rr || (!rr.limit && rr.perDay == null && !rr.explanation)) return "The report has no room rent limit recorded for this policy.";
  const lines: string[] = [];
  if (rr.limit) lines.push(`Room rent limit: ${rr.limit}.`);
  else if (rr.perDay != null) lines.push(`Room rent limit: ${inr(rr.perDay)} per day.`);
  if (rr.penalty === "proportional") lines.push("Going above it cuts the whole bill in proportion, not just the room charge.");
  if (rr.explanation) lines.push(rr.explanation.trim());
  return lines.join(" ");
}

function coPay(r: R): string {
  const cp = r.coPay;
  if (!cp || cp.exists == null) return "The report doesn't say whether this policy has a co-pay.";
  if (!cp.exists) return "No co-pay found in this policy.";
  const lines = [`Co-pay: ${cp.percentage != null ? `${cp.percentage}%` : "yes"}${cp.conditions ? `, ${cp.conditions.trim()}` : ""}.`];
  if (cp.outOfPocketOn5L != null) lines.push(`On a ₹5,00,000 claim that is ${inr(cp.outOfPocketOn5L)} out of pocket.`);
  return lines.join(" ");
}

function subLimits(r: R): string {
  const s = r.subLimits.filter((x) => x.procedure);
  if (!s.length) return "The report found no sub-limits on treatments in this policy.";
  return (
    "Sub-limits in this policy:\n" +
    s.slice(0, 6).map((x) => `• ${x.procedure}: ${x.limit != null ? inr(x.limit) : "capped"}${x.gap ? ` (gap ${inr(x.gap)})` : ""}`).join("\n")
  );
}

function score(c: ClientSummary, r: R): string {
  const label = verdictLabel(r.verdictLabel);
  const head = c.score != null ? `Score: ${c.score}/100${label ? `, ${label}` : ""}.` : label ? `${label}.` : "";
  return [head, r.interpretation?.trim() || r.verdictSummary?.trim() || ""].filter(Boolean).join(" ") || "The report has no score for this policy.";
}

function cover(r: R): string {
  const parts: string[] = [];
  if (r.baseSumInsured != null) parts.push(`Sum insured: ${inr(r.baseSumInsured)}.`);
  if (r.effectiveCover != null) parts.push(`Effective cover for one hospital stay: ${inr(r.effectiveCover)}.`);
  return parts.join(" ") || "The report has no cover amount recorded.";
}

function works(r: R): string {
  const w = r.whatWorks.filter((x) => x.benefit);
  if (!w.length) return "The report lists nothing under what actually works.";
  return "What actually works:\n" + w.slice(0, 4).map((x) => `• ${x.benefit}${x.value ? ` (${x.value})` : ""}`).join("\n");
}

function costs(r: R): string {
  const w = r.whereItMayCost.filter((x) => x.issue);
  if (!w.length) return "The report lists nothing under where it may cost you.";
  return "Where it may cost you:\n" + w.slice(0, 4).map((x) => `• ${x.issue}${x.outOfPocket ? ` (${x.outOfPocket})` : ""}`).join("\n");
}
