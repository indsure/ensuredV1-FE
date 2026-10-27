/**
 * The WhatsApp bot's view of IndSure, answered from the playground's in-memory store
 * instead of the backend. Same shapes as backend/server/whatsapp/routes.ts returns, built
 * with the same view rules (bookViews.ts), so the demo bot says what the live bot would.
 *
 * Core commands are backed by the store and write to it: a lead added in the chat is on
 * the Leads page, and the other way round. Edits the demo does not cover are refused the
 * way the server refuses a write (`{ ok: false, reason }`), and the bot says so.
 */

import type {
  ClientSummary, Engine, JobStatus, RenewalRow, LeadRow, ClaimRow, Conversation, AnalyzeFile, AnalyzeResult,
} from "../../../../../whatsapp-bot/src/engine";
import {
  queueView, policyView, portfolioView, claimView, insightsView, pageStatsView, daysUntil,
} from "../../../../../backend/server/whatsapp/bookViews";
import { getStore } from "@/lib/playground/mockClient";
import { buildUploadedPolicy } from "@/lib/playground/seed";
import { playgroundClaims } from "@/lib/playground/claimsSeed";
import { DEMO_AGENT_ID } from "@/lib/playground/mode";

export const DEMO_WA_NUMBER = "919826012345";
const NOPE = { ok: false as const, reason: "Not in the demo" };

const store = () => getStore() as any;
const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;
const digits10 = (s: unknown) => String(s ?? "").replace(/\D/g, "").slice(-10);
const like = (hay: unknown, q: string) => String(hay ?? "").toLowerCase().includes(q.toLowerCase());
const dayStamp = () => new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });

function looksLikeFileName(name: unknown) {
  return /\.(pdf|docx?|jpe?g|png)\s*$/i.test(String(name ?? "").trim());
}
function customerOf(row: any) {
  return row.customer_id ? store().customers.find((c: any) => c.id === row.customer_id) ?? null : null;
}
/** routes.ts displayName: customer, then the row's name, then the insured in the report. */
function displayName(row: any): string | null {
  const reportName = row.report_data?.identity?.insured_names?.[0] ?? null;
  for (const n of [customerOf(row)?.name, row.policyholder_name, reportName]) {
    const v = typeof n === "string" ? n.trim() : "";
    if (v && !looksLikeFileName(v)) return v;
  }
  return null;
}

/** routes.ts reportSummary, on a store row. */
function summary(row: any): ClientSummary {
  const r = row.report_data || {};
  const fv = r.final_verdict || {};
  const be = r.benefit_evaluation || {};
  const crisk = r.claim_risk_analysis || {};
  const pc = r.policy_commercials || {};
  const cu = customerOf(row);
  return {
    clientId: row.id,
    status: row.status,
    errorMessage: row.status === "done" ? null : row.error_message ?? null,
    insuranceType: row.insurance_type,
    policyholderName: displayName(row),
    customerId: row.customer_id ?? null,
    customerPhone: cu?.phone || row.client_phone || null,
    insurer: row.insurer ?? null,
    policyName: row.policy_name ?? null,
    score: row.score ?? null,
    shareToken: row.share_enabled ? row.share_token ?? null : null,
    views: row.views ?? 0,
    expiryDate: row.expiry_date ?? null,
    weakPoint: fv.key_failure_points?.[0] ?? null,
    details: [],
    extracted: row.insurance_type === "life" || row.insurance_type === "term" ? row.extracted_data ?? null : null,
    companions: [],
    report: row.report_data
      ? {
          verdictLabel: fv.label ?? null,
          verdictSummary: fv.summary ?? null,
          interpretation: r.audit_score?.interpretation ?? null,
          effectiveCover: r.audit_score?.nec ?? null,
          baseSumInsured: r.coverage_structure?.base_sum_insured ?? null,
          premiumTotal: pc.premium_total_payable ?? null,
          whereItMayCost: (be.where_policy_fails || []).map((f: any) => ({ issue: f.issue ?? null, impact: f.real_world_claim_impact ?? null, outOfPocket: f.quantified_oop_risk ?? null })),
          whatWorks: (be.what_actually_works || []).map((w: any) => ({ benefit: w.benefit ?? null, why: w.why_it_matters_in_claim ?? null, value: w.quantified_value ?? null })),
          roomRent: crisk.room_rent
            ? { limit: crisk.room_rent.limit_value ?? null, perDay: crisk.room_rent.limit_amount_per_day ?? null, penalty: crisk.room_rent.penalty_type ?? null, explanation: crisk.room_rent.explanation ?? null }
            : null,
          coPay: crisk.co_payment
            ? { exists: crisk.co_payment.exists ?? null, percentage: crisk.co_payment.percentage ?? null, conditions: crisk.co_payment.conditions ?? null, outOfPocketOn5L: crisk.co_payment.oop_on_5L_claim ?? null }
            : null,
          subLimits: crisk.sub_limits?.exists
            ? (crisk.sub_limits.categories || []).map((c: any) => ({ procedure: c.procedure ?? null, limit: c.limit ?? null, gap: c.gap ?? null }))
            : [],
          waitingPeriods: r.waiting_periods ?? null,
        }
      : null,
  };
}

const leadRow = (l: any): LeadRow => ({
  id: l.id, name: l.name, phone: l.phone ?? null, status: l.status ?? null,
  insurance_interest: l.insurance_interest ?? null, next_follow_up: l.next_follow_up ?? null, notes: l.notes ?? null,
});
const fullLead = (l: any) => ({
  id: l.id, name: l.name, phone: l.phone ?? null, email: l.email ?? null, city: l.city ?? null, source: l.source ?? null,
  insurance_interest: l.insurance_interest ?? null, expected_value: l.expected_value ?? null, status: l.status ?? "new",
  next_follow_up: l.next_follow_up ?? null, notes: l.notes ?? null, customer_id: l.customer_id ?? null,
  created_at: l.created_at, updated_at: l.updated_at,
});
const fullCustomer = (c: any) => ({
  id: c.id, name: c.name, phone: c.phone ?? null, email: c.email ?? null, city: c.city ?? null, dob: c.dob ?? null, created_at: c.created_at,
});
const byRecent = (a: any, b: any) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""));
const leads = () => store().agent_leads as any[];
const clients = () => store().clients as any[];
const done = () => clients().filter((c) => c.status === "done");

export class DemoEngine implements Engine {
  private conv: Conversation = { state: "IDLE", currentClientId: null, pending: {}, updatedAt: null };
  private jobs = new Map<string, { clientId: string; polls: number }>();
  private seenIds = new Set<string>();

  /* ── Link, log, conversation ── */
  async resolve(n: string) { return n === DEMO_WA_NUMBER ? { agentId: DEMO_AGENT_ID, servable: true } : { agentId: null, servable: false }; }
  async link() { return { ok: false, reason: "no_pending" }; }
  async unlink() {}
  async logMessage(m: any) {
    if (m.direction !== "in" || !m.waMessageId) return { duplicate: false };
    if (this.seenIds.has(m.waMessageId)) return { duplicate: true };
    this.seenIds.add(m.waMessageId);
    return { duplicate: false };
  }
  async unknownSeen() { return false; }
  async getConversation() { return JSON.parse(JSON.stringify(this.conv)); }
  async putConversation(_a: string, c: any) { this.conv = { ...JSON.parse(JSON.stringify(c)), updatedAt: nowIso() }; }

  /* ── Policy checks: the playground's simulated upload ── */
  async checksLeft() { return store().agent_credits?.[0]?.balance ?? 0; }
  async jobByHash() { return null; }
  async createJob() { return uid("wajob"); }
  async updateJob() {}
  async openJobs() { return []; }
  async analyze(_a: string, f: AnalyzeFile): Promise<AnalyzeResult> {
    const credits = store().agent_credits?.[0];
    if (f.type === "health") {
      if (!credits || credits.balance <= 0) return { ok: false, code: "NO_CREDITS", message: "none" };
      credits.balance -= 1;
    }
    const clientId = uid("demo-policy");
    clients().unshift({
      ...buildUploadedPolicy(clientId, { policyholder_name: f.policyholderName ?? undefined, insurance_type: f.type, filename: f.fileName }),
      status: "processing", score: null, report_data: null,
    });
    const jobId = uid("demo-job");
    this.jobs.set(jobId, { clientId, polls: 1 });
    return { ok: true, clientId, jobId };
  }
  async jobStatus(_a: string, jobId: string): Promise<JobStatus> {
    const j = this.jobs.get(jobId);
    if (!j) return { status: "not_found", clientId: null };
    if (j.polls-- > 0) return { status: "processing", clientId: j.clientId };
    const row = clients().find((c) => c.id === j.clientId);
    if (row && row.status !== "done") Object.assign(row, buildUploadedPolicy(j.clientId, row));
    return { status: "completed", clientId: j.clientId };
  }

  /* ── Reports, customers, renewals ── */
  async getClient(_a: string, id: string) { const r = clients().find((c) => c.id === id); return r ? summary(r) : null; }
  async findClients(_a: string, name: string) {
    if (name.trim().length < 2) return [];
    return clients().filter((c) => like(c.policyholder_name, name) || like(customerOf(c)?.name, name)).sort(byRecent).slice(0, 5).map(summary);
  }
  async share(_a: string, id: string) {
    const r = clients().find((c) => c.id === id);
    if (!r) return null;
    r.share_enabled = true;
    r.share_token = r.share_token || uid("demo-share");
    return r.share_token;
  }
  async attachCustomer(_a: string, clientId: string, customerId: string) {
    const r = clients().find((c) => c.id === clientId);
    if (!r || !store().customers.some((c: any) => c.id === customerId)) return false;
    r.customer_id = customerId;
    return true;
  }
  async searchCustomers(_a: string, q: string) {
    const d = digits10(q);
    return (store().customers as any[])
      .filter((c) => like(c.name, q) || (d.length === 10 && digits10(c.phone) === d))
      .sort((a, b) => a.name.localeCompare(b.name)).slice(0, 6)
      .map((c) => ({ id: c.id, name: c.name, phone: c.phone ?? null, dob: c.dob ?? null, city: c.city ?? null }));
  }
  async renewals() {
    const now = Date.now();
    const leadRows: RenewalRow[] = (store().lead_policies as any[])
      .filter((lp) => lp.due_date && (daysUntil(lp.due_date, now) ?? 999) <= 7)
      .map((lp) => {
        const l = leads().find((x) => x.id === lp.lead_id);
        return { id: lp.id, name: l?.name ?? null, phone: l?.phone ?? null, insurance_type: lp.insurance_type, insurer: lp.insurer, policy_name: lp.policy_name, premium: lp.premium, due_date: lp.due_date, days_left: daysUntil(lp.due_date, now) ?? 0, spoken_to: !!lp.spoken_to };
      })
      .sort((a, b) => a.days_left - b.days_left);
    const own: RenewalRow[] = clients()
      .filter((c) => c.expiry_date)
      .map((c) => ({ c, d: daysUntil(c.expiry_date, now) }))
      .filter(({ d }) => d !== null && d >= 0 && d <= 30)
      .sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
      .map(({ c, d }) => ({
        id: c.id, name: customerOf(c)?.name ?? c.policyholder_name ?? null, phone: customerOf(c)?.phone ?? c.client_phone ?? null,
        insurance_type: c.insurance_type, insurer: c.insurer, policy_name: c.policy_name,
        premium: c.report_data?.policy_commercials?.premium_total_payable ?? null, due_date: c.expiry_date, days_left: d ?? 0,
      }));
    return { leads: leadRows, customers: own };
  }

  /* ── Model: switched off in the demo, exactly as on a server without WA_LLM_ENABLED ── */
  async llmIntent() { return "unknown"; }
  async llmPhrase() { return { answer: null }; }
  async understand() { return { enabled: false, understanding: null, reason: "off" }; }

  /* ── Profile, page, Sach, morning ── */
  async profile() {
    const a = store().agents?.[0] ?? {};
    const p = store().agent_pages?.[0];
    return {
      name: a.full_name || a.name || null,
      partneredCompanies: Array.isArray(a.partnered_companies) ? a.partnered_companies : [],
      page: p ? { slug: p.slug, live: !!(p.enabled && p.published), enabled: !!p.enabled, published: !!p.published } : null,
    };
  }
  async sach() {
    const ist = new Date(Date.now() + 5.5 * 3600_000);
    const next = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
    return { plan: "agent", paid: true, used: 0, limit: 500, resetsOn: next };
  }
  async morningRecipients() { return []; }
  async morningOn() { return true; }
  async saveCalculator() { return uid("demo-calc"); }

  /* ── Leads ── */
  async createLead(_a: string, b: any) {
    const name = String(b.name || "").trim().slice(0, 120);
    const phone = /^[6-9]\d{9}$/.test(digits10(b.phone)) ? digits10(b.phone) : null;
    if (phone) {
      const dup = leads().find((l) => digits10(l.phone) === phone);
      if (dup) return { id: dup.id, duplicateOf: dup.name };
    }
    const row = {
      id: uid("pg"), agent_id: DEMO_AGENT_ID, name, phone, email: null, city: null, source: "WhatsApp",
      insurance_interest: b.interest || null, expected_value: null,
      status: ["new", "contacted", "interested", "won", "lost"].includes(b.status) ? b.status : "new",
      next_follow_up: b.nextFollowUp || null, notes: b.note ? `${dayStamp()}: ${b.note}` : null,
      customer_id: null, created_at: nowIso(), updated_at: nowIso(),
    };
    leads().unshift(row);
    return { id: row.id, created: fullLead(row) };
  }
  async leadUndoCreate(_a: string, id: string) {
    const i = leads().findIndex((l) => l.id === id);
    if (i < 0) return false;
    leads().splice(i, 1);
    return true;
  }
  async leadsList() {
    return { total: leads().length, leads: [...leads()].sort(byRecent).slice(0, 15).map(leadRow) };
  }
  async leadSearch(_a: string, q: string) {
    const d = digits10(q);
    return leads().filter((l) => like(l.name, q) || (d.length === 10 && digits10(l.phone) === d)).sort(byRecent).slice(0, 6).map(leadRow);
  }
  async leadUpdate(_a: string, id: string, u: any) {
    const l = leads().find((x) => x.id === id);
    if (!l) throw new Error("Not found");
    const before = leadRow(l);
    if (u.status) l.status = u.status;
    if (u.nextFollowUp) l.next_follow_up = u.nextFollowUp;
    if (u.note) l.notes = [l.notes, `${dayStamp()}: ${u.note}`].filter(Boolean).join("\n");
    l.updated_at = nowIso();
    return { lead: leadRow(l), before };
  }
  async leadRestore(_a: string, id: string, before: any) {
    const l = leads().find((x) => x.id === id);
    if (!l) return null;
    Object.assign(l, { status: before.status, next_follow_up: before.next_follow_up, notes: before.notes, updated_at: nowIso() });
    return leadRow(l);
  }
  async followups() {
    const t = today();
    return leads()
      .filter((l) => l.next_follow_up && String(l.next_follow_up).slice(0, 10) <= t && !["won", "lost"].includes(l.status ?? "new"))
      .sort((a, b) => String(a.next_follow_up).localeCompare(String(b.next_follow_up)))
      .slice(0, 30)
      .map((l) => ({ ...leadRow(l), days: daysUntil(l.next_follow_up, Date.now()) ?? 0 }));
  }
  async leadGet(_a: string, id: string) { const l = leads().find((x) => x.id === id); return l ? fullLead(l) : null; }
  async leadEdit(_a: string, id: string, set: Record<string, unknown>) {
    const l = leads().find((x) => x.id === id);
    if (!l) return { ok: false as const, reason: "Not found" };
    Object.assign(l, set, { updated_at: nowIso() });
    return { ok: true as const, lead: fullLead(l) } as any;
  }
  async leadConvert(_a: string, id: string) {
    const l = leads().find((x) => x.id === id);
    if (!l) return { ok: false as const, reason: "Not found" };
    if (l.customer_id) return { ok: false as const, reason: "ALREADY_CUSTOMER", customerId: l.customer_id };
    const c = { id: uid("pg"), agent_id: DEMO_AGENT_ID, name: l.name, phone: l.phone, email: l.email ?? null, dob: null, city: l.city ?? null, notes: null, created_at: nowIso() };
    store().customers.unshift(c);
    const before = { status: l.status };
    Object.assign(l, { customer_id: c.id, status: "won", updated_at: nowIso() });
    return { ok: true as const, customer: fullCustomer(c), before } as any;
  }
  async leadUnconvert(_a: string, id: string, customerId: string, status: string) {
    const l = leads().find((x) => x.id === id);
    if (!l) return { ok: false as const, reason: "Not found" };
    Object.assign(l, { customer_id: null, status, updated_at: nowIso() });
    const i = store().customers.findIndex((c: any) => c.id === customerId);
    if (i >= 0) store().customers.splice(i, 1);
    return { ok: true as const, customerRemoved: i >= 0 } as any;
  }

  /* ── Customers ── */
  async customerGet(_a: string, id: string) { const c = store().customers.find((x: any) => x.id === id); return c ? fullCustomer(c) : null; }
  async customerCreate(_a: string, b: Record<string, unknown>) {
    const phone = /^[6-9]\d{9}$/.test(digits10(b.phone)) ? digits10(b.phone) : null;
    const dup = phone ? store().customers.find((c: any) => digits10(c.phone) === phone) : null;
    if (dup) return { ok: true as const, customer: fullCustomer(dup), duplicate: true } as any;
    const c = { id: uid("pg"), agent_id: DEMO_AGENT_ID, name: String(b.name || "").trim(), phone, email: (b.email as string) ?? null, dob: (b.dob as string) ?? null, city: (b.city as string) ?? null, notes: null, created_at: nowIso() };
    store().customers.unshift(c);
    return { ok: true as const, customer: fullCustomer(c), duplicate: false } as any;
  }
  async customerEdit(_a: string, id: string, set: Record<string, unknown>) {
    const c = store().customers.find((x: any) => x.id === id);
    if (!c) return { ok: false as const, reason: "Not found" };
    Object.assign(c, set);
    return { ok: true as const, customer: fullCustomer(c) } as any;
  }
  async customerUndoCreate(_a: string, id: string) {
    const i = store().customers.findIndex((c: any) => c.id === id);
    if (i < 0) return false;
    store().customers.splice(i, 1);
    return true;
  }
  async fileClient(_a: string, clientId: string, customerId: string | null) {
    const r = clients().find((c) => c.id === clientId);
    if (!r) return { ok: false as const, reason: "Not found" };
    r.customer_id = customerId;
    return { ok: true as const, customerId } as any;
  }

  /* ── Book views (bookViews.ts, as the live bot) ── */
  async policies(_a: string, type: string | null) {
    const rows = done().filter((c) => !type || c.insurance_type === type).sort(byRecent);
    return {
      total: rows.length,
      rows: rows.slice(0, 15).map((r) => ({ clientId: r.id, name: displayName(r), insuranceType: r.insurance_type, insurer: r.insurer, policyName: r.policy_name, score: r.insurance_type === "health" ? r.score : null })),
    };
  }
  async lookup(_a: string, q: string) {
    const d = digits10(q);
    const pols = clients()
      .filter((c) => like(c.policyholder_name, q) || like(customerOf(c)?.name, q) || (d.length === 10 && (digits10(c.client_phone) === d || digits10(customerOf(c)?.phone) === d)))
      .sort(byRecent).slice(0, 10).map(summary);
    return { policies: pols, leads: await this.leadSearch(_a, q) };
  }
  async views() {
    return clients()
      .filter((c) => (c.views ?? 0) > 0)
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .slice(0, 10)
      .map((c) => ({ clientId: c.id, name: displayName(c), insurer: c.insurer, policyName: c.policy_name, views: c.views ?? 0, lastViewed: c.last_shared_at || c.created_at }));
  }
  async claims(_a: string, q: string | null) {
    const list = playgroundClaims.list() as any[];
    const rows = list.filter((c) =>
      q ? like(c.customer_name, q) || like(c.hospital, q) || like(c.ailment, q) || like(c.insurer, q) : !["settled", "rejected"].includes(c.status),
    );
    return rows.slice(0, 10).map((c): ClaimRow => {
      const detail = playgroundClaims.get(c.id) as any;
      return {
        id: c.id, status: c.status, claim_type: c.claim_type, insurer: c.insurer ?? null, hospital: c.hospital ?? null, ailment: c.ailment ?? null,
        claimed_amount: c.claimed_amount ?? null, settled_amount: c.settled_amount ?? null, admitted_on: c.admitted_on ?? null,
        customer_name: c.customer_name ?? null,
        openQueries: (detail.queries || []).filter((x: any) => !x.resolved_on).map((x: any) => ({ seq: x.seq, question: x.question, raisedOn: x.raised_on })),
      };
    });
  }
  async claim(_a: string, id: string) {
    let c: any;
    try { c = playgroundClaims.get(id); } catch { return null; }
    return claimView(
      { ...c, days_to_purge: c.days_to_purge ?? null, documents_purged_at: c.documents_purged_at ?? null, can_extend: !!c.can_extend },
      (c.documents || []).map((d: any) => ({ category: d.category, doc_type: d.doc_type })),
      (c.queries || []).map((x: any) => ({ seq: x.seq, question: x.question, raised_on: x.raised_on, resolved_on: x.resolved_on })),
      (c.events || []).map((e: any) => ({ status: e.status, note: e.note ?? null, occurred_at: e.occurred_at })),
    ) as any;
  }
  async queue() {
    return queueView(
      clients()
        .filter((c) => ["error", "processing", "pending"].includes(c.status))
        .sort(byRecent)
        .slice(0, 30)
        .map((c) => ({ id: c.id, status: c.status, error_message: c.error_message ?? null, created_at: c.created_at, name: displayName(c) ?? c.name ?? c.filename ?? null })),
    ) as any;
  }
  async book(_a: string, view: any, sort: any, type: string | null) {
    const rows = done().map((c) => ({ id: c.id, name: displayName(c), insurance_type: c.insurance_type, insurer: c.insurer, policy_name: c.policy_name, score: c.score ?? null, expiry_date: c.expiry_date ?? null }));
    return policyView(rows, view, sort, Date.now(), type) as any;
  }
  async portfolio(_a: string, q: string) {
    if (q.trim().length < 2) return { matches: [] } as any;
    const found = (store().customers as any[]).filter((c) => like(c.name, q)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 6);
    const exact = found.filter((c) => c.name.trim().toLowerCase() === q.trim().toLowerCase());
    const one = found.length === 1 ? found[0] : exact.length === 1 ? exact[0] : null;
    const pick = (c: any) => ({ id: c.id, name: c.name, phone: c.phone ?? null, city: c.city ?? null });
    if (!one) return { matches: found.map(pick) } as any;
    const pols = done().filter((c) => c.customer_id === one.id).sort(byRecent).map((c) => ({
      id: c.id, name: null, insurance_type: c.insurance_type, insurer: c.insurer, policy_name: c.policy_name, sum_insured: c.sum_insured ?? null,
      expiry_date: c.expiry_date ?? null, score: c.score ?? null, extracted_data: c.extracted_data ?? null, coverage: c.report_data?.coverage_structure ?? null,
    }));
    const calc = (store().calculator_reports as any[]).find((r) => r.customer_id === one.id) ?? null;
    return { matches: [pick(one)], customer: pick(one), portfolio: portfolioView(pols, calc ? { result_data: calc.result_data ?? null } : null, Date.now()) } as any;
  }
  async policyValueRows() { return []; }
  async insights() {
    return insightsView(done().map((c) => ({ insurance_type: c.insurance_type, expiry_date: c.expiry_date, score: c.score ?? null })), store().customers.length, Date.now()) as any;
  }
  async pageStats() {
    const p = store().agent_pages?.[0];
    if (!p) return { page: null } as any;
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const views = (store().agent_page_views as any[]).filter((v) => v.page_id === p.id && String(v.viewed_on ?? "") >= since);
    const n = leads().filter((l) => l.landing_slug === p.slug).length;
    return { page: { slug: p.slug }, stats: pageStatsView(views, n) } as any;
  }

  /* ── Catalogue compare: not in the demo chat (the portal's Compare page has it) ── */
  async catalog() { return []; }
  async compare(): Promise<any> { throw new Error("Not in the demo"); }

  /* ── Edits the demo chat does not cover: refused like a server refusal ── */
  async policyFields() { return null; }
  async policyFieldSave(): Promise<any> { return NOPE; }
  async clientDetailSave(): Promise<any> { return NOPE; }
  async setSharing(): Promise<any> { return NOPE; }
  async claimRow() { return null; }
  async claimOpen(): Promise<any> { return NOPE; }
  async claimUndoCreate() { return false; }
  async claimEdit(): Promise<any> { return NOPE; }
  async claimStage(): Promise<any> { return NOPE; }
  async claimQuery(): Promise<any> { return NOPE; }
  async claimAnswered(): Promise<any> { return NOPE; }
  async claimReopenQuery(): Promise<any> { return NOPE; }
  async claimExtend(): Promise<any> { return NOPE; }
  async lifeGet() { return null; }
  async lifeAdd(): Promise<any> { return NOPE; }
  async lifeVoid(): Promise<any> { return NOPE; }
  async claimDocs() { return null; }
  async claimDocUpload(): Promise<any> { return NOPE; }
  async claimDocUndo() { return false; }
  async claimDocFile() { return null; }
  async policyPdf(): Promise<any> { return { error: "Not in the demo" }; }
  async pageGet() { return null; }
  async pageEdit(): Promise<any> { return NOPE; }
  async profileGet() { return null; }
  async profileEdit(): Promise<any> { return NOPE; }
  async team(): Promise<any> { return { role: "none" }; }
  async teamMove(): Promise<any> { return NOPE; }
}
