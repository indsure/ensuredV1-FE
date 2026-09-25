/**
 * Every message the bot sends (brief §12). Plain, short, IndSure's voice.
 * House rules: no em dashes, never the words "AI" or "credits" (it is a "policy check").
 * Numbers shown here are ONLY ones the engine stored; this file formats, never computes.
 */

import type { ClientSummary, RenewalRow } from "../engine.js";
import { TYPE_LABEL, type PolicyType } from "./pdfInspect.js";
import { b, dayMonth, firstName, planLabel } from "./format.js";

export type Lang = "english" | "hinglish" | "hindi";

export type Links = {
  origin: string; // https://indsure.in
};

export const portalPolicyUrl = (l: Links, clientId: string) => `${l.origin}/agent/policies/${clientId}`;
export const sharedReportUrl = (l: Links, token: string) => `${l.origin}/shared/report/${token}`;

/** wa.me with the customer's number when we have a usable Indian mobile, else the contact
 *  picker. Same rule as the portal's waHref (lib/leads.ts). */
export function waMeLink(phone: string | null | undefined, text: string): string {
  const d = String(phone || "").replace(/\D/g, "");
  const n = /^[6-9]\d{9}$/.test(d) ? "91" + d : /^91[6-9]\d{9}$/.test(d) ? d : /^0[6-9]\d{9}$/.test(d) ? "91" + d.slice(1) : null;
  const q = `?text=${encodeURIComponent(text)}`;
  return n ? `https://wa.me/${n}${q}` : `https://wa.me/${q}`;
}

/** Indian digit grouping for a stored rupee amount. Formatting only. */
export function inr(n: number | string | null | undefined): string | null {
  const v = typeof n === "string" ? Number(n.replace(/,/g, "")) : n;
  if (v == null || !Number.isFinite(v)) return null;
  return "₹" + Math.round(v).toLocaleString("en-IN");
}

const clean = (s: string) => s.replace(/[—–]/g, ", ").replace(/[ \t]+\n/g, "\n").trim();

/* ── T1 to T14 ── */

export const T = {
  welcome: () =>
    "You're connected to IndSure. Send me a customer's health policy PDF and I'll send back the report. You can also type RENEWALS or HELP.",
  received: () => "Got it. Checking this policy now, usually about a minute.",
  stillWorking: () => "Still reading this one. Longer policies take a bit more time.",
  takingLong: (url: string) =>
    `This is taking longer than usual. I'll message you when it's ready. You can also check it in the portal: ${url}`,
  notPdf: () => "I can only read PDF files. Could you send the insurer's original PDF?",
  tooLarge: () => "This file is over 25MB, which is too big to read. The insurer's original PDF is usually much smaller.",
  nonHealth: (type: PolicyType, customer: string | null) =>
    `Saved ${TYPE_LABEL[type]} policy${customer ? ` for ${customer}` : ""} to your book. Scores are for health policies only right now, so this one has its key details filled in, no score. This used data entry, not a policy check.`,
  couldNotRead: (reason: string, fix: string) =>
    `I couldn't read this policy: ${reason}. ${fix}. It's waiting in Needs Attention in the portal.`,
  outOfChecks: (url: string) => `You've used all your policy checks for now. Message the IndSure team to get more: ${url}`,
  outOfDataEntry: (url: string) =>
    `You've used all your data entry for now, so I couldn't save this policy. Message the IndSure team to get more: ${url}`,
  notInReport: (url: string) =>
    `The report doesn't cover that. Here it is in full: ${url}. For exact coverage questions, it's best to check with the insurer.`,
  // Short on purpose: the four things advisors do most. MORE lists everything.
  help: () =>
    [
      "📋 Here's what I do most:",
      "• Send a health policy PDF and I'll check it",
      "• RENEWALS or FOLLOW UPS: who to call",
      "• LEAD Ramesh 98123 45678 health",
      "• CALCULATOR, or COMPARE Care Supreme vs ReAssure 2.0",
      "Or just tell me what you need. Reply MORE for everything else.",
    ].join("\n"),
  more: () =>
    [
      "📋 Everything I can do:",
      "• Send a health policy PDF, then ask: room rent? co-pay?",
      "• SHARE: a message for the customer (report, calculator or comparison)",
      "• RENEWALS · FOLLOW UPS · MY CLIENTS · CLAIMS · VIEWS · CHECKS",
      "• LEAD Ramesh 98123 45678 health · Ramesh won · follow up Ramesh Friday · note Ramesh: wants family floater",
      "• FIND Ramesh: everything on a name or number",
      "• CALCULATOR · COMPARE Care Supreme vs Niva ReAssure 2.0",
      "• SURRENDER VALUE Ramesh (life policies)",
      "• UPGRADE MESSAGE for Santosh · DIWALI MESSAGE for Ramesh in hindi",
      "• LINK: your website",
    ].join("\n"),
  unknownNumber: () => "This number is for IndSure advisors. To get started, visit indsure.in/agent.",

  /* Extras the brief's flows need, in the same voice. */
  linkBad: () => "That code didn't work. Open Connect WhatsApp in the IndSure portal, get a new code, and send LINK followed by the code.",
  linkExpired: () => "That code has expired. Get a new one from Connect WhatsApp in the IndSure portal.",
  linkWrongNumber: () => "That code was made for a different number. Enter this WhatsApp number in the portal and try again.",
  linkNotBeta: () => "Your number is connected, but WhatsApp is only open to a few advisors right now. We'll let you know when it opens up.",
  unlinked: () => "Done. This WhatsApp number is no longer connected to your IndSure account.",
  cancelled: () => "Okay, cancelled. Send a PDF or type HELP any time.",
  locked: () => T.couldNotRead("the PDF is password-protected", "Remove the password and send it again").replace(" It's waiting in Needs Attention in the portal.", " No policy check was used."),
  hindiPolicy: () => "This policy is written in Hindi. I can only read English policies for now, so no policy check was used.",
  pickType: () =>
    "What kind of policy is this? Reply with a number:\n1) Health\n2) Motor\n3) Life\n4) Term\n5) Travel\n6) Property\n7) Fire\n8) Marine\n9) Contractor all risk",
  duplicate: (url: string) =>
    `You've already checked this exact file. Here's the report: ${url}\nRun a fresh check? It uses 1 policy check. Reply YES or NO.`,
  dupNo: () => "Okay, no new check. Ask me anything about it, or reply SHARE.",
  whoseIsIt: () => "Whose policy is this? Reply with the customer's name or phone number, or SKIP to leave it unassigned.",
  pickCustomer: (names: string[]) =>
    `I found more than one customer. Which one?\n${names.map((n, i) => `${i + 1}) ${n}`).join("\n")}\nReply with the number, or SKIP.`,
  filedUnder: (name: string) => `Saved under ${name}.`,
  noCustomerMatch: (q: string) => `I couldn't find a customer called "${q}" in your book, so the policy is saved as unassigned. You can file it in the portal.`,
  leftUnassigned: () => "Okay, left unassigned. You can file it under a customer in the portal.",
  noReport: () => "Which customer's policy? Reply with their name, or send me the policy PDF.",
  whichPolicy: (rows: { name: string; label: string }[]) =>
    `I found a few. Which one?\n${rows.map((r, i) => `${i + 1}) ${r.name}, ${r.label}`).join("\n")}\nReply with the number.`,
  noSuchCustomer: (q: string) => `I couldn't find a checked policy for "${q}". Send me the PDF and I'll check it.`,
  pickLang: () => "Which language for the message?\n1) English\n2) Hinglish\n3) Hindi",
  queued: (n: number) => `Got it. This one is in line behind ${n} other ${n === 1 ? "policy" : "policies"}. I'll send each report as it's ready.`,
  queueStoppedNoChecks: (waiting: number, url: string) =>
    `You've run out of policy checks, so I've stopped here. ${waiting} ${waiting === 1 ? "file is" : "files are"} still waiting and ${waiting === 1 ? "was" : "were"} not checked. Message the IndSure team to get more: ${url}`,
  gaveUp: (url: string) =>
    `I couldn't get a result for this policy. Please check it in the portal: ${url}`,
  didNotCatch: () => `I didn't catch that.\n\n${T.help()}`,
  resendFile: () => "I no longer have that file. Please send the PDF again.",
  genericError: () => "Something went wrong on my side. Please try again in a minute.",
  stillChecking: () => "I'm still checking a policy. I'll send the report as soon as it's ready.",
};

/* ── Failure reasons (T8) from the engine's stored error text ── */

export function failureReasonFix(error: string | null | undefined): { reason: string; fix: string } {
  const e = String(error || "").toLowerCase();
  if (/password|encrypt/.test(e)) return { reason: "the PDF is password-protected", fix: "Remove the password and send it again" };
  if (/scan|blurr|readable|no text|could not find a policy|image/.test(e))
    return { reason: "the scan is too unclear to read", fix: "Ask the customer for the insurer's original PDF" };
  if (/timeout|timed out/.test(e)) return { reason: "it took too long to read", fix: "Try sending it again in a few minutes" };
  return { reason: "something in the file stopped me", fix: "Try the insurer's original PDF, or upload it in the portal" };
}

/* ── T10 report card ── */

const VERDICT_LABEL: Record<string, string> = {
  // Same wording as the portal report (PolicyAuditReport.tsx), minus its em dash.
  SAFE: "Strong Structural Coverage",
  BORDERLINE: "Good Core Coverage with Areas to Improve",
  RISKY: "Limited Structural Protection, Improvement Recommended",
};

export function verdictLabel(label: string | null | undefined): string | null {
  return label ? VERDICT_LABEL[label] ?? null : null;
}

export function reportCard(c: ClientSummary, l: Links): string {
  // Answer first: who, which plan, the score. Then why, then the one next action.
  const plan = planLabel(c.insurer, c.policyName) || "Health policy";
  const who = c.policyholderName ? `${b(c.policyholderName)} · ` : "";
  const lines = [`📄 ${who}${plan}${c.score != null ? ` · ${c.score}/100` : ""}`];
  const label = verdictLabel(c.report?.verdictLabel);
  const summary = c.report?.verdictSummary?.trim().replace(/\.?$/, ".");
  if (label || summary) lines.push([label ? `${label}.` : "", summary ?? ""].filter(Boolean).join(" "));
  const watch = (c.report?.whereItMayCost || []).filter((w) => w.issue).slice(0, 2);
  if (watch.length) {
    lines.push("Watch out for: " + watch.map((w) => (w.outOfPocket ? `${w.issue} (${w.outOfPocket})` : `${w.issue}`)).join("; ") + ".");
  }
  lines.push(`Full report: ${portalPolicyUrl(l, c.clientId)}`);
  lines.push(`Reply SHARE to send it to ${firstName(c.policyholderName) || "the customer"}, or ask me anything about it.`);
  return clean(lines.join("\n"));
}

/* ── T11 share draft ── */


/** The customer-facing text. Like the portal's (PolicyDetail.tsx), it asserts only that a
 *  report exists at the link: no score, no gaps, so it is true for every policy type. */
export function shareDraft(lang: Lang, name: string | null, product: string | null, link: string): string {
  const f = firstName(name);
  if (lang === "hinglish") {
    return `${f ? `Namaste ${f} ji,` : "Namaste,"} aapki ${product ? `${product} ` : ""}policy ki report yahan hai: ${link}`;
  }
  if (lang === "hindi") {
    return `${f ? `नमस्ते ${f} जी,` : "नमस्ते,"} आपकी ${product ? `${product} ` : ""}पॉलिसी की रिपोर्ट यहाँ है: ${link}`;
  }
  return `${f ? `Namaste ${f},` : "Namaste,"} here is the report for your ${product ? `${product} ` : ""}policy: ${link}`;
}

/** `tracksViews`: only a shared report link shows up in the portal's Views column. */
export function shareReply(customer: string | null, draft: string, waLink: string, hasPhone: boolean, tracksViews = true): string {
  const lines = [
    `Here's a message for ${customer || "your customer"}. Tap the link to open it in WhatsApp, check it, and press send:`,
    waLink,
  ];
  if (!hasPhone) lines.push("(I don't have their number, so WhatsApp will ask you to pick the chat.)");
  lines.push("", "The message:", draft);
  if (tracksViews) lines.push("", "You'll see in the portal when they open the report.");
  return clean(lines.join("\n"));
}

/* ── Renewals ── */

const RENEWALS_CAP = 10;

function renewalLine(r: RenewalRow): string {
  const d = r.days_left;
  const when = d < 0 ? `overdue ${-d}d` : d === 0 ? "due today" : `${d}d left`;
  const what = [r.insurance_type, planLabel(r.insurer, r.policy_name)].filter(Boolean).join(", ");
  return [b(r.name || "Unnamed"), what || null, `${dayMonth(r.due_date)} (${when})`, inr(r.premium)].filter(Boolean).join(" · ");
}

export function renewalsReply(data: { leads: RenewalRow[]; customers: RenewalRow[] }, l: Links): string {
  const overdue = data.leads.filter((r) => r.days_left < 0);
  const week = data.leads.filter((r) => r.days_left >= 0 && r.days_left <= 7);
  const own = data.customers;
  const total = overdue.length + week.length + own.length;
  if (!total) {
    return "🔄 Nothing due. No lead renewals this week, and none of your customers' policies expire in the next 30 days.";
  }
  const out: string[] = [`🔄 ${total} ${total === 1 ? "renewal" : "renewals"} to handle, soonest first:`];
  let budget = RENEWALS_CAP;
  const section = (title: string, rows: RenewalRow[]) => {
    if (!rows.length || budget <= 0) return;
    out.push("", title);
    for (const r of rows.slice(0, budget)) out.push(renewalLine(r));
    budget -= Math.min(rows.length, budget);
  };
  section("Leads, overdue:", overdue);
  section("Leads, due this week:", week);
  section("Your customers, expiring in 30 days:", own);
  if (total > RENEWALS_CAP) out.push(`…and ${total - RENEWALS_CAP} more: ${l.origin}/agent/renewals`);
  out.push("", "Reply REMIND and a name for a ready-to-send reminder, for example: REMIND Ramesh");
  return clean(out.join("\n"));
}
