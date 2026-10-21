// ============================================================================
// Read-only views of an advisor's book for the WhatsApp assistant (stage 1).
//
// Each function is the portal page's own rule, moved here so the bot says exactly what the
// portal shows. The page each one mirrors is named on it; if that page's rule changes, change
// this too. Pure: rows in, numbers out, no database and no clock except the `now` passed in.
// ============================================================================

import { deriveCoverView } from "../../../shared/policy";

const DAY = 86_400_000;

/** Days from now to a date, rounded up (PoliciesNew getDays, Insights daysUntil). */
export function daysUntil(date: string | null | undefined, now: number): number | null {
  if (!date) return null;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - now) / DAY);
}

/** "5 lakh", "1.2 crore", "500000", 500000 -> rupees (lib/customers.ts parseAmount). */
export function parseAmount(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const s = String(value).toLowerCase().replace(/,/g, "");
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (/crore|cr\b/.test(s)) n *= 1e7;
  else if (/lakh|lac\b/.test(s)) n *= 1e5;
  else if (/\bk\b/.test(s)) n *= 1e3;
  return Number.isFinite(n) ? n : null;
}

const typeOf = (r: { insurance_type?: string | null }) => r.insurance_type || "health";
const isHealth = (r: { insurance_type?: string | null }) => typeOf(r) === "health";
const DATA_ENTRY = new Set(["motor", "life", "term", "travel", "property", "fire", "marine", "contractor_all_risk"]);

/* ── My Queue (MyQueue.tsx): checks that failed or are still running ───────── */

export type QueueRow = { id: string; name: string | null; status: string; error_message: string | null; created_at: string };

export function queueView(rows: QueueRow[]) {
  const pick = (r: QueueRow) => ({ clientId: r.id, name: r.name, error: r.error_message || null, createdAt: r.created_at });
  return {
    failed: rows.filter((r) => r.status === "error").map(pick),
    processing: rows.filter((r) => r.status === "processing" || r.status === "pending").map(pick),
  };
}

/* ── My Policies tabs and sort (PoliciesNew.tsx) ──────────────────────────── */

export type PolicyView = "all" | "expiring" | "switch" | "healthy";
export type PolicySort = "expiry" | "score" | "name";
export type BookRow = {
  id: string; name: string | null; insurance_type: string | null; insurer: string | null; policy_name: string | null;
  score: number | null; expiry_date: string | null;
};

export function policyView(rows: BookRow[], view: PolicyView, sort: PolicySort, now: number, type: string | null = null) {
  const expiring = (r: BookRow) => { const d = daysUntil(r.expiry_date, now); return d !== null && d >= 0 && d <= 30; };
  // Health only: a motor score measures how completely a vehicle is covered, not wording.
  const toSwitch = (r: BookRow) => isHealth(r) && r.score !== null && r.score < 70;
  const healthy = (r: BookRow) => isHealth(r) && r.score !== null && r.score >= 70;
  const counts = { total: rows.length, expiringSoon: rows.filter(expiring).length, shouldSwitch: rows.filter(toSwitch).length, healthy: rows.filter(healthy).length };
  let list = type ? rows.filter((r) => typeOf(r) === type) : rows;
  if (view === "expiring") list = list.filter(expiring);
  if (view === "switch") list = list.filter(toSwitch);
  if (view === "healthy") list = list.filter(healthy);
  list = [...list].sort((a, b) => {
    if (sort === "expiry") return (daysUntil(a.expiry_date, now) ?? 99999) - (daysUntil(b.expiry_date, now) ?? 99999);
    // Deliberately differs from the portal table: only health scores are ranked ("lowest
    // score" means weakest wording). A motor 18 is a complete-enough vehicle cover, not the
    // worst policy in the book, so motor and data-entry rows go after every health row.
    if (sort === "score") return (isHealth(a) && a.score !== null ? a.score : 999) - (isHealth(b) && b.score !== null ? b.score : 999);
    return (a.name || "").localeCompare(b.name || "");
  });
  return {
    counts,
    matched: list.length,
    rows: list.slice(0, 15).map((r) => ({
      clientId: r.id, name: r.name, insuranceType: typeOf(r), insurer: r.insurer, policyName: r.policy_name,
      score: isHealth(r) ? r.score : null, daysLeft: daysUntil(r.expiry_date, now),
    })),
  };
}

/* ── Customer portfolio and cover gap (CustomerDetail.tsx, lib/customers.ts) ── */

export type PortfolioPolicy = {
  id: string; name: string | null; insurance_type: string | null; insurer: string | null; policy_name: string | null;
  sum_insured: string | number | null; expiry_date: string | null; score: number | null;
  extracted_data: any; coverage: any;
};

/** Health: the effective cover (bonus, restoration, top-ups) the portal shows; others: the sum insured. */
export function policyCover(p: Pick<PortfolioPolicy, "insurance_type" | "sum_insured" | "coverage">): number | null {
  const si = parseAmount(p.sum_insured);
  if (!isHealth(p)) return si;
  const cs = p.coverage;
  if (!cs || typeof cs !== "object") return si;
  const effective = deriveCoverView({ coverage_structure: cs } as any).effectiveCover;
  return effective > 0 ? effective : si;
}

export function portfolioView(policies: PortfolioPolicy[], latestCalc: { result_data: any } | null, now: number) {
  const byType: Record<string, number> = {};
  let totalCover: number | null = null;
  let healthCover = 0;
  let totalPremium: number | null = null;
  let nextPremium: { date: string; name: string | null; clientId: string } | null = null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  for (const p of policies) {
    const type = typeOf(p);
    byType[type] = (byType[type] ?? 0) + 1;
    const cover = policyCover(p);
    if (cover != null) totalCover = (totalCover ?? 0) + cover;
    if (type === "health") healthCover += cover ?? 0;
    if (DATA_ENTRY.has(type)) {
      const prem = parseAmount(p.extracted_data?.premium);
      if (prem != null) totalPremium = (totalPremium ?? 0) + prem;
    }
    const np = p.extracted_data?.next_premium_date ? String(p.extracted_data.next_premium_date) : p.expiry_date;
    if (np) {
      const d = new Date(np);
      if (!Number.isNaN(d.getTime()) && d >= today && (!nextPremium || d < new Date(nextPremium.date))) {
        nextPremium = { date: np.slice(0, 10), name: p.policy_name || p.insurer, clientId: p.id };
      }
    }
  }
  const optimal = latestCalc?.result_data?.coverageBreakdown?.finalOptimal;
  const recommended = typeof optimal === "number" ? optimal : null;
  return {
    policyCount: policies.length,
    byType,
    totalCover,
    healthCover,
    totalPremium,
    nextPremium,
    shouldSwitch: policies.filter((p) => isHealth(p) && p.score !== null && p.score < 70).length,
    recommended,
    gap: recommended != null ? recommended - healthCover : null,
    policies: policies.slice(0, 10).map((p) => ({
      clientId: p.id, insuranceType: typeOf(p), insurer: p.insurer, policyName: p.policy_name,
      cover: policyCover(p), score: isHealth(p) ? p.score : null, daysLeft: daysUntil(p.expiry_date, now),
    })),
  };
}

/* ── One claim: stage, open queries, missing documents (lib/claims.ts, ClaimDetail.tsx) ── */

/** The portal's checklist, copied from lib/claims.ts. A reminder, never a gate. */
// "\u2014" is the portal's long dash, kept so labels match uploaded doc_type values exactly.
export const PERSONAL_DOCS = ["Aadhaar \u2014 patient", "PAN card", "Policy copy or e-card", "Cancelled cheque", "NEFT mandate"];
export const CASE_DOCS: Record<string, string[]> = {
  cashless: ["Pre-authorisation form", "TPA or insurer health card", "Doctor's advice for admission", "Hospital cost estimate", "Final bill", "Discharge summary"],
  reimbursement: [
    "Claim form Part A", "Claim form Part B (hospital)", "Discharge summary", "Itemised final bill", "Payment receipts",
    "Diagnostic reports", "Prescriptions and pharmacy bills", "Implant sticker or invoice", "FIR or MLC copy (if accident)",
  ],
};
const STAGE: Record<string, string> = {
  opened: "Claim opened", docs_received: "Documents received", submitted: "Submitted to insurer",
  under_process: "Claim under process", query_raised: "Insurer query open", settled: "Settled", rejected: "Rejected",
};

export function claimView(
  claim: any,
  docs: { category: string; doc_type: string | null }[],
  queries: { seq: number; question: string; raised_on: string | null; resolved_on: string | null }[],
  events: { status: string; note: string | null; occurred_at: string }[],
) {
  const have = (category: string) => new Set(docs.filter((d) => d.category === category && d.doc_type).map((d) => d.doc_type as string));
  const closed = claim.status === "settled" || claim.status === "rejected";
  const personal = have("personal");
  const caseDocs = have("case");
  return {
    id: claim.id,
    customerName: claim.customer_name ?? null,
    claimType: claim.claim_type,
    status: claim.status,
    stage: STAGE[claim.status] ?? claim.status,
    insurer: claim.insurer ?? null,
    hospital: claim.hospital ?? null,
    ailment: claim.ailment ?? null,
    claimedAmount: parseAmount(claim.claimed_amount),
    settledAmount: parseAmount(claim.settled_amount),
    daysToPurge: claim.days_to_purge ?? null,
    documentCount: docs.length,
    // Once closed, the paperwork is gone by design: nothing is "missing".
    missing: closed ? [] : [
      ...PERSONAL_DOCS.filter((d) => !personal.has(d)),
      ...(CASE_DOCS[claim.claim_type] ?? []).filter((d) => !caseDocs.has(d)),
    ],
    openQueries: queries.filter((q) => !q.resolved_on).map((q) => ({ seq: q.seq, question: q.question, raisedOn: q.raised_on })),
    lastEvents: events.slice(-3).map((e) => ({ status: STAGE[e.status] ?? e.status, note: e.note, at: e.occurred_at })),
  };
}

/* ── Insights (Insights.tsx) ─────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function insightsView(
  rows: { insurance_type: string | null; expiry_date: string | null; score: number | null }[],
  customerCount: number | null,
  now: number,
) {
  let renewing30 = 0, expired = 0, unknownExpiry = 0;
  for (const r of rows) {
    const d = daysUntil(r.expiry_date, now);
    if (d === null) { unknownExpiry++; continue; }
    if (d < 0) expired++;
    else if (d <= 30) renewing30++;
  }
  const byTypeMap = new Map<string, number>();
  for (const r of rows) byTypeMap.set(typeOf(r), (byTypeMap.get(typeOf(r)) ?? 0) + 1);
  const n = new Date(now);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(n.getFullYear(), n.getMonth() + i, 1);
    return { label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, count: 0 };
  });
  for (const r of rows) {
    if (!r.expiry_date) continue;
    const e = new Date(r.expiry_date);
    if (Number.isNaN(e.getTime()) || (daysUntil(r.expiry_date, now) ?? -1) < 0) continue;
    const m = (e.getFullYear() - n.getFullYear()) * 12 + (e.getMonth() - n.getMonth());
    if (m >= 0 && m < 6) months[m].count++;
  }
  const scored = rows.filter((r) => isHealth(r) && typeof r.score === "number");
  return {
    total: rows.length, renewing30, expired, unknownExpiry, people: customerCount,
    byType: [...byTypeMap.entries()].sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count })),
    renewalsByMonth: months,
    scoredHealth: scored.length,
    avgHealthScore: scored.length ? Math.round(scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length) : null,
    weakHealth: scored.filter((r) => (r.score ?? 100) < 70).length,
  };
}

/* ── My Page stats, last 30 days (MyPage.tsx, lib/advisorPage.ts) ───────── */

const APP_LABELS: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", whatsapp: "WhatsApp", telegram: "Telegram",
  linkedin: "LinkedIn", browser: "Web browser", other: "Other",
};
const DEVICE_LABELS: Record<string, string> = { mobile: "Phone", tablet: "Tablet", desktop: "Computer", unknown: "Unknown" };

export function pageStatsView(views: { utm_source: string | null; app: string | null; device: string | null; views: number }[], leads: number) {
  const sum = (key: "utm_source" | "app" | "device", label: (k: string) => string) => {
    const m = new Map<string, number>();
    for (const v of views) {
      const k = String(v[key] || (key === "utm_source" ? "direct" : key === "device" ? "unknown" : "other"));
      m.set(k, (m.get(k) ?? 0) + (Number(v.views) || 0));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ label: label(k), views: n }));
  };
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    totalViews: views.reduce((n, v) => n + (Number(v.views) || 0), 0),
    leads,
    bySource: sum("utm_source", (k) => (k === "direct" ? "Direct link" : cap(k))),
    byApp: sum("app", (k) => APP_LABELS[k] ?? cap(k)),
    byDevice: sum("device", (k) => DEVICE_LABELS[k] ?? cap(k)),
  };
}
