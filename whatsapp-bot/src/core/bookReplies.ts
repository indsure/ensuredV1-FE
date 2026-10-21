/**
 * Stage 1 replies: read-only answers about the advisor's book. The numbers come from the
 * backend (backend/server/whatsapp/bookViews.ts, which holds each portal page's rule) or,
 * for surrender values, from the portal's own policyBook.ts synced into src/shared. Nothing
 * here is calculated anew; it only puts stored figures into words.
 *
 * Every fixed line is translated in i18n.ts; names, amounts and dates pass through as they are.
 */

import { b } from "./format.js";
import { failureReasonFix, inr } from "./templates.js";
import { bookTotals, buildBook, STATE_ORDER, type BookRow as ValueRow } from "../shared/policyBook.js";

type Links = { origin: string };

/* ── Data shapes (backend bookViews.ts) ──────────────────────────────────── */

export type QueueItem = { clientId: string; name: string | null; error: string | null; createdAt: string };
export type QueueData = { failed: QueueItem[]; processing: QueueItem[] };
export type BookViewName = "all" | "expiring" | "switch" | "healthy";
export type BookSort = "expiry" | "score" | "name";
export type BookItem = { clientId: string; name: string | null; insuranceType: string; insurer: string | null; policyName: string | null; score: number | null; daysLeft: number | null };
export type BookData = { counts: { total: number; expiringSoon: number; shouldSwitch: number; healthy: number }; matched: number; rows: BookItem[] };
export type PortfolioData = {
  matches: { id: string; name: string; phone: string | null; city: string | null }[];
  customer?: { id: string; name: string };
  portfolio?: {
    policyCount: number; byType: Record<string, number>; totalCover: number | null; healthCover: number; totalPremium: number | null;
    nextPremium: { date: string; name: string | null; clientId: string } | null; shouldSwitch: number;
    recommended: number | null; gap: number | null;
    policies: { clientId: string; insuranceType: string; insurer: string | null; policyName: string | null; cover: number | null; score: number | null; daysLeft: number | null }[];
  };
};
export type ClaimDetailData = {
  id: string; customerName: string | null; claimType: string; status: string; stage: string; daysToPurge: number | null;
  documentCount: number; purgedOn: string | null; canExtend: boolean; missing: string[]; openQueries: { seq: number; question: string; raisedOn: string | null }[];
};
export type InsightsData = {
  total: number; renewing30: number; expired: number; unknownExpiry: number; people: number | null;
  byType: { type: string; count: number }[]; renewalsByMonth: { label: string; count: number }[];
  scoredHealth: number; avgHealthScore: number | null; weakHealth: number;
};
export type PageStatsData = {
  page: { slug: string } | null;
  stats?: { totalViews: number; leads: number; bySource: { label: string; views: number }[]; byApp: { label: string; views: number }[]; byDevice: { label: string; views: number }[] };
};

const TYPE: Record<string, string> = {
  health: "Health", motor: "Motor", life: "Life", term: "Term", travel: "Travel", property: "Property",
  fire: "Fire", marine: "Marine", contractor_all_risk: "Contractor all risk",
};
const typeName = (t: string) => TYPE[t] ?? t;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const plan = (insurer: string | null, name: string | null) => [insurer, name].filter(Boolean).join(" ") || null;
const when = (d: number | null) => (d === null ? null : d < 0 ? `expired ${-d}d ago` : d === 0 ? "expires today" : `${d}d left`);

/* ── 1.7 / 1.8 My Queue ──────────────────────────────────────────────────── */

export function queueReply(l: Links, q: QueueData): string {
  if (!q.failed.length && !q.processing.length) return "✅ Nothing failed, and no checks are running right now.";
  const out: string[] = [];
  if (q.failed.length) {
    out.push(`⚠️ ${plural(q.failed.length, "check", "checks")} could not finish:`);
    q.failed.slice(0, 10).forEach((r, i) => out.push(`${i + 1}) ${b(r.name || "Unnamed")}${r.error ? ` · ${failureReasonFix(r.error).reason}` : ""}`));
    out.push("Send the PDF again to retry, or fix it in My Queue:");
  }
  if (q.processing.length) {
    if (out.length) out.push("");
    out.push(`⏳ Still being checked: ${q.processing.slice(0, 10).map((r) => r.name || "Unnamed").join(", ")}`);
  }
  out.push(`${l.origin}/agent/my-queue`);
  return out.join("\n");
}

/** "Is Ramesh's policy done?": the status of each matching policy. */
export function statusReply(l: Links, q: string, rows: { clientId: string; status: string; policyholderName: string | null; policyName: string | null; insurer: string | null; errorMessage: string | null }[]): string {
  if (!rows.length) return `I couldn't find a policy for "${q}". Type CHECKS to see what you have left, or send the PDF.`;
  return rows.slice(0, 5).map((r) => {
    const who = `${b(r.policyholderName || q)}${plan(r.insurer, r.policyName) ? ` · ${plan(r.insurer, r.policyName)}` : ""}`;
    if (r.status === "done") return `✅ ${who}: ready.\n${l.origin}/agent/policies/${r.clientId}`;
    if (r.status === "error") return `⚠️ ${who}: could not finish${r.errorMessage ? ` (${failureReasonFix(r.errorMessage).reason})` : ""}. Send the PDF again to retry.`;
    return `⏳ ${who}: still being checked. It usually takes a minute or two.`;
  }).join("\n\n");
}

/* ── 2.2 / 2.3 My Policies tabs ─────────────────────────────────────────── */

const VIEW_TITLE: Record<BookViewName, string> = {
  switch: "Should switch (health score under 70)",
  expiring: "Expiring in the next 30 days",
  healthy: "Healthy (health score 70 or more)",
  all: "Your policies",
};

export function bookReply(l: Links, view: BookViewName, sort: BookSort, d: BookData): string {
  const head = sort === "score" && view === "all" ? "Lowest health scores first" : VIEW_TITLE[view];
  if (!d.matched) {
    return `${head}: none right now.\nIn your book: ${d.counts.total} policies · ${d.counts.expiringSoon} expiring soon · ${d.counts.shouldSwitch} should switch · ${d.counts.healthy} healthy`;
  }
  const lines = d.rows.map((r, i) => {
    const bits = [plan(r.insurer, r.policyName) || typeName(r.insuranceType), r.score !== null ? `score ${r.score}` : null, when(r.daysLeft)].filter(Boolean);
    return `${i + 1}) ${b(r.name || "Unnamed")} · ${bits.join(" · ")}`;
  });
  const more = d.matched > d.rows.length ? `\n…and ${d.matched - d.rows.length} more in the portal.` : "";
  return `📋 ${head}: ${d.matched}\n${lines.join("\n")}${more}\n${l.origin}/agent/policies`;
}

/* ── 4.1 / 4.3 / 4.4 Customer portfolio and cover gap ────────────────────── */

export function portfolioReply(l: Links, q: string, d: PortfolioData): string {
  if (!d.matches.length) return `I couldn't find a customer called "${q}". Customers are added in the portal, or when you file a policy under a name.`;
  if (!d.portfolio || !d.customer) {
    return `More than one customer matches "${q}":\n${d.matches.map((m, i) => `${i + 1}) ${m.name}${m.city ? ` · ${m.city}` : ""}`).join("\n")}\nSay the full name, for example: ${d.matches[0].name} portfolio`;
  }
  const p = d.portfolio;
  const out = [`👤 ${b(d.customer.name)}: ${plural(p.policyCount, "policy", "policies")}`];
  if (!p.policyCount) {
    out.push("No checked policies filed under this customer yet.");
  } else {
    out.push(`Types: ${Object.entries(p.byType).map(([t, n]) => `${typeName(t)} ${n}`).join(", ")}`);
    if (p.totalCover !== null) out.push(`Total cover: ${inr(p.totalCover)}`);
    if (p.totalPremium !== null) out.push(`Yearly premium on file (non-health): ${inr(p.totalPremium)}`);
    if (p.nextPremium) out.push(`Next premium: ${p.nextPremium.date}${p.nextPremium.name ? ` (${p.nextPremium.name})` : ""}`);
    if (p.shouldSwitch) out.push(`Should switch: ${plural(p.shouldSwitch, "health policy", "health policies")} scored under 70`);
  }
  if (p.recommended !== null && p.gap !== null) {
    out.push("", `Health cover: ${inr(p.healthCover)} of ${inr(p.recommended)} recommended (last calculator).`);
    out.push(p.gap > 0 ? `Gap: ${inr(p.gap)} short.` : "Covered enough by that calculation.");
  } else {
    out.push("", `Health cover: ${inr(p.healthCover) ?? "₹0"}. No calculator saved for this customer, so no gap to show. Try: calculator for ${d.customer.name}`);
  }
  out.push(`${l.origin}/agent/customers/${d.customer.id}`);
  return out.join("\n");
}

/* ── 3.1 / 3.2 Surrender values across the book ─────────────────────────── */

/** The portal's next-step lines (pv.step_* in en.json). */
const STEP: Record<string, string> = {
  wait_for_reading: "Still being read. Check back shortly.",
  reupload: "Could not be read. Re-upload the PDF.",
  fill_details: "Fill in the missing details on the policy.",
  confirm_plan_type: "Confirm the plan type on the policy.",
  ask_insurer: "Ask the insurer.",
  check_details: "Check the details against the policy document.",
  record_payments: "Record which premiums were paid.",
  ask_insurer_quote: "Ask the insurer for a surrender quote and enter it.",
  record_loan: "Record whether there is a loan on the policy.",
  none: "Nothing to do.",
  review_duplicate: "Possible duplicate upload. Review both copies.",
  confirm_quote: "Check with the insurer that the quote is still current.",
};
/** The portal's state labels (pv.st_*). */
const STATE: Record<string, string> = {
  pending: "Being read", failed: "Could not read", error: "Data problem", unsupported: "Not covered here",
  needs_data: "Needs details", check_payments: "Check payments", term_cover: "Term cover",
  quote_on_file: "Insurer quote", calculated: "Calculated",
};

export function valuesReply(l: Links, source: any[], asOf?: string): string {
  const book = buildBook(source, asOf ? { asOf } : {});
  if (!book.length) return "No life or term policies yet. Send one as a PDF to add it.";
  const t = bookTotals(book);
  const attention = (t.byState.check_payments ?? 0) + (t.byState.needs_data ?? 0);
  const amount = (s: { sum: number; count: number }) => (s.count ? `${inr(s.sum)} (${plural(s.count, "policy", "policies")})` : "Not available");
  const out = [
    `📋 Surrender values: ${plural(book.length, "life or term policy", "life and term policies")}`,
    `Insurer quotes you entered: ${amount(t.surrender.quotes)}`,
    `Calculated from checked policy terms: ${amount(t.surrender.calculated)}`,
    `Need your attention: ${attention}`,
    `Maturing in the next 12 months: ${t.maturingSoon}`,
  ];
  const rows = [...book].sort((a, c) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(c.state) || a.clientName.localeCompare(c.clientName));
  out.push("");
  rows.slice(0, 10).forEach((r: ValueRow, i) => {
    const sp = r.valuation?.values.surrender_payable;
    const fig = sp && sp.amount !== null && r.valuation?.cash.surrender ? ` · ${inr(sp.amount)}` : "";
    out.push(`${i + 1}) ${b(r.clientName || "Unnamed")}${r.planName ? ` · ${r.planName}` : ""} · ${STATE[r.state] ?? r.state}${fig}`);
    out.push(`   Next: ${STEP[r.nextStep] ?? r.nextStep}`);
  });
  if (book.length > 10) out.push(`…and ${book.length - 10} more in the portal.`);
  out.push("", "Totals add only insurer quotes and values calculated from checked terms, kept apart. Confirm with the insurer before acting.");
  out.push(`${l.origin}/agent/values`);
  return out.join("\n");
}

/* ── 7.3 / 7.9 / 7.11 One claim: what is still missing ──────────────────── */

/** Lines added under the existing one-claim reply. The portal label "Aadhaar, patient" (a long dash in the portal) is
 *  shown with a comma: the bot never sends a long dash. */
export function claimDetailLines(d: ClaimDetailData): string[] {
  // The claim reply above already shows its status, so no second "stage" line.
  const out: string[] = [];
  if (d.purgedOn) {
    out.push(`The documents were deleted on ${d.purgedOn}, as planned for closed paperwork.`);
    return out;
  }
  if (d.missing.length) {
    out.push(`Still missing (${d.missing.length}):`);
    for (const m of d.missing.slice(0, 12)) out.push(`• ${m.replace(/\s*\u2014\s*/g, ", ")}`);
  } else if (d.status !== "settled" && d.status !== "rejected") {
    out.push("Every document on the checklist is in.");
  }
  if (d.daysToPurge !== null) {
    out.push(`Documents are deleted in ${plural(d.daysToPurge, "day", "days")}.`);
    if (d.canExtend) out.push("You can extend this once, by 30 days, in the portal.");
  }
  return out;
}

/* ── 11.2 Insights ──────────────────────────────────────────────────────── */

export function insightsReply(l: Links, d: InsightsData): string {
  if (!d.total) return "No checked policies yet. Send a policy PDF to start your book.";
  const out = [
    `📊 Your book: ${plural(d.total, "policy", "policies")}${d.people !== null ? ` · ${plural(d.people, "customer", "customers")}` : ""}`,
    `Renewing in 30 days: ${d.renewing30}`,
    `Expired: ${d.expired}`,
  ];
  if (d.unknownExpiry) out.push(`No expiry date on file: ${d.unknownExpiry}`);
  out.push(`By type: ${d.byType.map((x) => `${typeName(x.type)} ${x.count}`).join(", ")}`);
  if (d.avgHealthScore !== null) out.push(`Health score average: ${d.avgHealthScore} (${plural(d.scoredHealth, "policy", "policies")}), ${d.weakHealth} under 70`);
  const months = d.renewalsByMonth.filter((m) => m.count > 0);
  if (months.length) out.push(`Renewals ahead: ${months.map((m) => `${m.label} ${m.count}`).join(", ")}`);
  out.push(`${l.origin}/agent/insights`);
  return out.join("\n");
}

/* ── 12.6 My Page stats ─────────────────────────────────────────────────── */

export function pageStatsReply(l: Links, d: PageStatsData): string {
  if (!d.page || !d.stats) return `You don't have a page yet. Make one in the portal: ${l.origin}/agent/my-page`;
  const s = d.stats;
  if (!s.totalViews) return `🌐 No visits to your page in the last 30 days. Leads from your page so far: ${s.leads}.\nShare it: type LINK`;
  const top = (rows: { label: string; views: number }[]) => rows.slice(0, 3).map((r) => `${r.label} ${r.views}`).join(", ");
  return [
    `🌐 Your page, last 30 days: ${plural(s.totalViews, "visit", "visits")}`,
    `Leads from your page so far: ${s.leads}`,
    `Came from: ${top(s.bySource)}`,
    `Opened in: ${top(s.byApp)}`,
    `Device: ${top(s.byDevice)}`,
    `${l.origin}/agent/my-page`,
  ].join("\n");
}
