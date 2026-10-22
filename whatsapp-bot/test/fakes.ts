/** In-memory fakes for bot-core tests. No network, no WhatsApp, no model. */

import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import type { ClientSummary, Engine, JobStatus, RenewalRow } from "../src/engine.js";
import type { InboundMessage, Transport } from "../src/transport/types.js";
import { Bot } from "../src/core/bot.js";
import type { Inspection } from "../src/core/pdfInspect.js";
import * as BV from "../../backend/server/whatsapp/bookViews.js";
import * as ED from "../../backend/server/whatsapp/editRules.js";
import * as PE from "../src/shared/policyEvidence.js";

export const AGENT = "11111111-1111-4111-8111-111111111111";
export const ADVISOR = "919800000001";
export const ADVISOR_JID = `${ADVISOR}@s.whatsapp.net`;
export const STRANGER = "919800000009";

const COMMAND_WORDS = /\*(MORNING OFF \/ ON|MORNING OFF|MORNING ON|FOLLOW UPS|MY CLIENTS|SURRENDER VALUE|UPGRADE MESSAGE|DIWALI MESSAGE|TIER 1|TIER 2|RENEWALS|CALCULATOR|COMPARE|BALANCE|HINGLISH|ENGLISH|HINDI|REMIND|CANCEL|CHANGE|CHECKS|CLAIMS|VIEWS|SHARE|TODAY|METRO|UNDO|HELP|MORE|SKIP|NONE|LEAD|FIND|LINK|YES|NO)\*/g;
export function plainText(t: string): string {
  return t
    .replace(/^(📝|✅|👋|🌐|📊|⚠️|🤔|⚖️|🧮|👤|⏳|📤|ℹ️) /u, "")
    .replace(COMMAND_WORDS, "$1")
    .replace(/^(\d{1,2})\. /gm, "$1) ");
}

export class FakeTransport implements Transport {
  sent: { to: string; text: string }[] = [];
  files = new Map<string, Buffer>();
  async start() {}
  onMessage() {}
  async sendText(to: string, text: string) { this.sent.push({ to, text }); }
  async sendTyping() {}
  async downloadMedia(m: InboundMessage) { return this.files.get(m.id) ?? Buffer.from("%PDF-1.4 x"); }
  async markRead() {}
  contacts: { to: string; name: string }[] = [];
  async sendContact(to: string, name: string) { this.contacts.push({ to, name }); }
  /** The words of each message, without the house style (a leading emoji, bold commands,
   *  "1." lists), so tests read content. style.test.ts checks the styling on lastRaw(). */
  texts() { return this.sent.map((s) => plainText(s.text)); }
  last() { return plainText(this.sent[this.sent.length - 1]?.text ?? ""); }
  lastRaw() { return this.sent[this.sent.length - 1]?.text ?? ""; }
}

export function healthClient(id: string, over: Partial<ClientSummary> = {}): ClientSummary {
  return {
    clientId: id, status: "done", errorMessage: null, insuranceType: "health",
    policyholderName: "Ramesh Kumar", customerId: null, customerPhone: "9812345678",
    insurer: "Care Health", policyName: "Care Supreme", score: 65, shareToken: null, views: 0, expiryDate: null,
    report: {
      verdictLabel: "BORDERLINE", verdictSummary: "Decent base cover with a costly room rent cap",
      interpretation: "Good for small claims, weak for long stays.", effectiveCover: 700000, baseSumInsured: 500000,
      premiumTotal: 18450,
      whereItMayCost: [
        { issue: "Room rent capped at 1% of sum insured", impact: "Bills shrink in proportion", outOfPocket: "₹40,000 on a ₹3L bill" },
        { issue: "Cataract sub-limit", impact: "Capped", outOfPocket: null },
      ],
      whatWorks: [{ benefit: "Unlimited restoration", why: "Cover comes back", value: null }],
      roomRent: { limit: "1% of sum insured per day", perDay: 5000, penalty: "proportional", explanation: "Choosing a bigger room cuts every other charge too." },
      coPay: { exists: false, percentage: null, conditions: null, outOfPocketOn5L: null },
      subLimits: [{ procedure: "Cataract", limit: 40000, gap: 20000 }],
      waitingPeriods: null,
    },
    ...over,
  };
}

export class FakeEngine implements Engine {
  links = new Map<string, { agentId: string; servable: boolean }>([[ADVISOR, { agentId: AGENT, servable: true }]]);
  pendingCodes = new Map<string, { code: string; agentId: string }>();
  seenIds = new Set<string>();
  unknownReplied = new Set<string>();
  conv: any = { state: "IDLE", currentClientId: null, pending: {}, updatedAt: null };
  checks = 5;
  hashes = new Map<string, string>();
  jobs = new Map<string, any>();
  analyzeCalls: any[] = [];
  inFlight = 0;
  maxInFlight = 0;
  clients = new Map<string, ClientSummary>();
  /** Per engine job: how many polls before it finishes, and how it finishes. */
  plan = new Map<string, { polls: number; end: "completed" | "error"; error?: string }>();
  nextOutcome: { type?: string; end?: "completed" | "error"; error?: string; polls?: number } = {};
  customers: { id: string; name: string; phone: string | null; dob?: string | null; city?: string | null; email?: string | null; fresh?: boolean }[] = [];
  attached: [string, string][] = [];
  shared: string[] = [];
  renewalData: { leads: RenewalRow[]; customers: RenewalRow[] } = { leads: [], customers: [] };
  llmIntentCalls = 0;
  llmPhraseCalls = 0;
  phraseAnswer: { answer: string | null; guardFired?: boolean } = { answer: null };
  messages: any[] = [];

  async resolve(n: string) { const l = this.links.get(n); return l ? { agentId: l.agentId, servable: l.servable } : { agentId: null, servable: false }; }
  async link(n: string, code: string) {
    const p = this.pendingCodes.get(n);
    if (!p) return { ok: false, reason: "no_pending" };
    if (p.code !== code) return { ok: false, reason: "bad_code" };
    this.links.set(n, { agentId: p.agentId, servable: true });
    return { ok: true, agentId: p.agentId, servable: true };
  }
  async unlink() { this.links.delete(ADVISOR); }
  async logMessage(m: any) {
    this.messages.push(m);
    if (m.direction === "out" && String(m.intent || "").startsWith("unknown:")) this.unknownReplied.add(m.intent.slice(8));
    if (m.direction !== "in" || !m.waMessageId) return { duplicate: false };
    if (this.seenIds.has(m.waMessageId)) return { duplicate: true };
    this.seenIds.add(m.waMessageId);
    return { duplicate: false };
  }
  async unknownSeen(h: string) { return this.unknownReplied.has(h); }
  async getConversation() { return JSON.parse(JSON.stringify(this.conv)); }
  async putConversation(_a: string, c: any) { this.conv = { ...JSON.parse(JSON.stringify(c)), updatedAt: new Date(0).toISOString() }; this.conv.updatedAt = null; }
  async checksLeft() { return this.checks; }
  async jobByHash(_a: string, sha: string) { return this.hashes.get(sha) ?? null; }
  async createJob(_a: string, j: any) { const id = crypto.randomUUID(); this.jobs.set(id, { ...j, status: "queued" }); return id; }
  async updateJob(_a: string, id: string, patch: any) { Object.assign(this.jobs.get(id) ?? {}, patch); }
  async openJobs() { return []; }
  async analyze(_a: string, f: any) {
    this.analyzeCalls.push(f);
    this.inFlight++;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    if (f.type === "health" && this.checks <= 0) { this.inFlight--; return { ok: false as const, code: "NO_CREDITS" as const, message: "none" }; }
    const clientId = crypto.randomUUID();
    const jobId = crypto.randomUUID();
    const o = this.nextOutcome;
    this.plan.set(jobId, { polls: o.polls ?? 2, end: o.end ?? "completed", error: o.error });
    const base = healthClient(clientId, { insuranceType: f.type, policyholderName: f.policyholderName ?? null });
    if (f.type !== "health") base.report = null;
    if (f.companion) base.companions = [{ kind: "super_topup", read: !f.companion.buffer.toString("latin1").includes("UNREADABLE") }];
    if (o.end === "error") { base.status = "failed"; base.errorMessage = o.error ?? "error"; }
    this.clients.set(clientId, base);
    (this as any)._jobClient = { ...(this as any)._jobClient, [jobId]: { clientId, type: f.type, sha: f.sha } };
    return { ok: true as const, clientId, jobId };
  }
  async jobStatus(_a: string, jobId: string): Promise<JobStatus> {
    const p = this.plan.get(jobId)!;
    const clientId = (this as any)._jobClient[jobId].clientId;
    if (p.polls-- > 0) return { status: "processing", clientId };
    this.inFlight--;
    if (p.end === "error") return { status: "error", clientId, error: p.error ?? "" };
    if ((this as any)._jobClient[jobId].type === "health") this.checks--;
    return { status: "completed", clientId };
  }
  async getClient(_a: string, id: string) { return this.clients.get(id) ?? null; }
  async findClients(_a: string, name: string) { return [...this.clients.values()].filter((c) => (c.policyholderName || "").toLowerCase().includes(name.toLowerCase())); }
  async share(_a: string, id: string) { this.shared.push(id); return "tok-" + id.slice(0, 8); }
  async attachCustomer(_a: string, clientId: string, customerId: string) { this.attached.push([clientId, customerId]); return true; }
  async searchCustomers(_a: string, q: string) { return this.customers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || (c.phone || "").endsWith(q)); }
  async renewals() { return this.renewalData; }
  async llmIntent() { this.llmIntentCalls++; return "unknown"; }
  profileData: any = { name: "Deep Shah", partneredCompanies: [], page: { slug: "deep-shah", live: true, enabled: true, published: true } };
  leads: any[] = [];
  calcSaved: any[] = [];
  compared: string[][] = [];
  catalogRows = [
    { plan_key: "UIN-CARE-SUP", insurer: "Care Health Insurance", plan_name: "Care Supreme", variant: "" },
    { plan_key: "UIN-NIVA-RA2", insurer: "Niva Bupa Health Insurance", plan_name: "ReAssure 2.0", variant: "" },
    { plan_key: "UIN-HDFC-OPT:Silver", insurer: "HDFC ERGO", plan_name: "Optima Secure", variant: "Silver" },
    { plan_key: "UIN-HDFC-OPT:Gold", insurer: "HDFC ERGO", plan_name: "Optima Secure", variant: "Gold" },
  ];
  async profile() { return this.profileData; }
  async createLead(_a: string, l: any) {
    const dup = [...this.leads, ...this.leadRows].find((x) => x.phone && x.phone === l.phone);
    if (dup) return { id: dup.id, duplicateOf: dup.name };
    const id = crypto.randomUUID();
    this.leads.push({ id, ...l });
    // Created leads are findable afterwards, like the real table.
    const row = { id, name: l.name, phone: l.phone ?? null, email: null, city: l.city ?? null, source: l.source ?? null, insurance_interest: l.interest ?? null, expected_value: l.expected_value ?? null, status: l.status ?? "new", next_follow_up: l.nextFollowUp ?? null, notes: l.note ?? null };
    this.leadRows.push(row);
    const { id: _id, ...created } = row;
    return { id, created };
  }
  async saveCalculator(_a: string, inputs: any, result: any, customerId: string | null = null) { this.calcSaved.push({ inputs, result, customerId }); return "calc-uuid-1"; }
  /** Model stand-in: tests script what the model would return for a message. Off by default,
   *  exactly like production until WA_LLM_ENABLED=true. */
  understandMap = new Map<string, any>();
  understandCalls: { text: string; ctx: any }[] = [];
  modelOn = false;
  /** Sach Assistant: the plan and this month's count, as the backend reports them. */
  sachData = { plan: "agent", paid: true, used: 0, limit: 500, resetsOn: "2026-10-01" };
  /** Why the backend would not call the model (free_plan, limit...), when it would not. */
  sachReason: string | null = null;
  async sach() { return { ...this.sachData }; }
  morningList: { agentId: string; waNumber: string; name: string | null }[] = [];
  async morningRecipients() { return this.morningList; }
  async morningOn() { return true; }
  async understand(_a: string, text: string, ctx: any) {
    this.understandCalls.push({ text, ctx });
    if (this.sachReason) return { enabled: false, understanding: null, reason: this.sachReason, usage: { ...this.sachData } };
    if (!this.modelOn) return { enabled: false, understanding: null };
    const u = this.understandMap.get(text);
    this.sachData.used++;
    return { enabled: true, understanding: u ?? { actions: [{ type: "unknown" }], clarify: null }, usage: { ...this.sachData } };
  }
  async leadsList() { return { total: this.leadRows.length, leads: this.leadRows.slice(0, 15) }; }
  restored: any[] = [];
  async leadRestore(_a: string, id: string, before: any, expect?: any) {
    const r = this.leadRows.find((x) => x.id === id);
    // Same rule as the backend: with `expect`, only if nobody changed those fields since.
    if (r && expect && (["status", "next_follow_up", "notes"] as const).some((k) => ED.norm(r[k]) !== ED.norm(expect[k]))) return null;
    this.restored.push({ id, before });
    if (r) Object.assign(r, { status: before.status, next_follow_up: before.next_follow_up, notes: before.notes });
    return r ?? null;
  }

  /* Stage 2a: the backend's own value rules (edits.ts) and compare-before, in memory. */
  writes: { kind: string; id: string | null; body: any }[] = [];
  private guarded<T extends Record<string, any>>(row: T | undefined, clean: { set: Record<string, unknown>; errors: Record<string, string> }, expect: Record<string, unknown>) {
    if (!row) return { ok: false as const, reason: "Not found" };
    if (Object.keys(clean.errors).length) return { ok: false as const, reason: "INVALID", fields: clean.errors };
    if (Object.entries(expect || {}).some(([k, v]) => ED.norm(row[k]) !== ED.norm(v))) return { ok: false as const, reason: "CHANGED" };
    const before = { ...row };
    Object.assign(row, clean.set);
    return { ok: true as const, before, after: row };
  }
  async leadGet(_a: string, id: string) {
    const r = this.leadRows.find((x) => x.id === id);
    return r ? { email: null, city: null, source: null, expected_value: null, customer_id: null, ...r } : null;
  }
  async leadEdit(_a: string, id: string, set: Record<string, unknown>, expect: Record<string, unknown>, restore = false) {
    const row = this.leadRows.find((x) => x.id === id);
    if (row) for (const k of ["email", "city", "source", "expected_value", "customer_id"]) if (!(k in row)) row[k] = null;
    if (ED.missingExpect(set, expect).length) return { ok: false as const, reason: "INVALID", fields: { expect: "required" } };
    const g = this.guarded(row, restore ? ED.restoreSet(set, ["name", "phone", "email", "city", "source", "insurance_interest", "expected_value", "status", "next_follow_up"]) : ED.cleanLeadSet(set), expect);
    if (!g.ok) return g;
    this.writes.push({ kind: "leadEdit", id, body: set });
    return { ok: true as const, lead: { ...g.after }, before: g.before, undoToken: "fake-token" };
  }
  async leadConvert(_a: string, id: string) {
    const lead = this.leadRows.find((x) => x.id === id);
    if (!lead) return { ok: false as const, reason: "Not found" };
    if (lead.customer_id) return { ok: false as const, reason: "ALREADY_CUSTOMER", customerId: lead.customer_id };
    const customer = { id: crypto.randomUUID(), name: lead.name, phone: lead.phone ?? null, email: lead.email ?? null, city: lead.city ?? null, dob: null, fresh: true };
    this.customers.push(customer);
    const before = { status: lead.status };
    Object.assign(lead, { customer_id: customer.id, status: "won" });
    this.writes.push({ kind: "leadConvert", id, body: {} });
    return { ok: true as const, customer, before };
  }
  async leadUnconvert(_a: string, id: string, customerId: string, status: string) {
    const lead = this.leadRows.find((x) => x.id === id);
    if (!lead || lead.customer_id !== customerId || lead.status !== "won") return { ok: false as const, reason: "CHANGED" };
    Object.assign(lead, { customer_id: null, status });
    const removed = this.removeIfFreshAndEmpty(customerId);
    this.writes.push({ kind: "leadUnconvert", id, body: { customerId, status } });
    return { ok: true as const, customerRemoved: removed };
  }
  async customerGet(_a: string, id: string) {
    const c = this.customers.find((x) => x.id === id);
    return c ? { email: null, city: null, dob: null, ...c } : null;
  }
  async customerCreate(_a: string, c: Record<string, unknown>) {
    const clean = ED.cleanCustomerSet(c);
    if (!clean.set.name) clean.errors.name = clean.errors.name || "a name is needed";
    if (Object.keys(clean.errors).length) return { ok: false as const, reason: "INVALID", fields: clean.errors };
    const dup = clean.set.phone ? this.customers.find((x) => x.phone === clean.set.phone) : undefined;
    if (dup) return { ok: true as const, customer: { email: null, city: null, dob: null, ...dup }, duplicate: true };
    const customer: any = { id: crypto.randomUUID(), name: clean.set.name, phone: clean.set.phone ?? null, email: clean.set.email ?? null, city: clean.set.city ?? null, dob: clean.set.dob ?? null, fresh: true };
    this.customers.push(customer);
    this.writes.push({ kind: "customerCreate", id: customer.id, body: c });
    return { ok: true as const, customer, duplicate: false };
  }
  async customerEdit(_a: string, id: string, set: Record<string, unknown>, expect: Record<string, unknown>, restore = false) {
    const row: any = this.customers.find((x) => x.id === id);
    if (row) for (const k of ["email", "city", "dob"]) if (!(k in row)) row[k] = null;
    if (ED.missingExpect(set, expect).length) return { ok: false as const, reason: "INVALID", fields: { expect: "required" } };
    const g = this.guarded(row, restore ? ED.restoreSet(set, ["name", "phone", "email", "city", "dob"]) : ED.cleanCustomerSet(set), expect);
    if (!g.ok) return g;
    this.writes.push({ kind: "customerEdit", id, body: set });
    return { ok: true as const, customer: { ...g.after }, before: g.before, undoToken: "fake-token" };
  }
  private removeIfFreshAndEmpty(customerId: string): boolean {
    const c: any = this.customers.find((x) => x.id === customerId);
    const used = [...this.clients.values()].some((x) => x.customerId === customerId) || this.leadRows.some((l) => l.customer_id === customerId);
    if (!c || !c.fresh || used) return false;
    this.customers = this.customers.filter((x) => x.id !== customerId);
    return true;
  }
  async customerUndoCreate(_a: string, id: string, created: Record<string, unknown>) {
    const c: any = this.customers.find((x) => x.id === id);
    if (!c || Object.entries(created || {}).some(([k, v]) => ED.norm(c[k]) !== ED.norm(v))) return false;
    const ok = this.removeIfFreshAndEmpty(id);
    if (ok) this.writes.push({ kind: "customerUndoCreate", id, body: {} });
    return ok;
  }
  async fileClient(_a: string, clientId: string, customerId: string | null, expectCustomerId: string | null) {
    const c = this.clients.get(clientId);
    if (!c) return { ok: false as const, reason: "Not found" };
    if (customerId && !this.customers.some((x) => x.id === customerId)) return { ok: false as const, reason: "Customer not found" };
    if ((c.customerId ?? null) !== (expectCustomerId ?? null)) return { ok: false as const, reason: "CHANGED" };
    c.customerId = customerId;
    this.writes.push({ kind: "fileClient", id: clientId, body: { customerId } });
    return { ok: true as const, customerId };
  }
  /* Stage 2b: the same rules as backend whatsapp/edits.ts, through the shared editRules. */
  policyExtra = new Map<string, { rev: number; data: Record<string, unknown>; email: string | null; identifier: string | null; token?: string }>();
  private pol(id: string) {
    const c = this.clients.get(id);
    if (!c) return null;
    let x = this.policyExtra.get(id);
    if (!x) { x = { rev: 0, data: {}, email: null, identifier: null }; this.policyExtra.set(id, x); }
    return { c, x };
  }
  async policyFields(_a: string, id: string) {
    const p = this.pol(id);
    if (!p) return null;
    const type = p.c.insuranceType || "health";
    return {
      id, type, status: p.c.status, shareEnabled: !!p.c.shareToken, rev: p.x.rev,
      client: { policyholder_name: p.c.policyholderName, policy_identifier: p.x.identifier, client_email: p.x.email, client_phone: p.c.customerPhone },
      fields: ED.fixFieldsFor(type, p.x.data).map((f) => ({ key: f.key, label: f.label, kind: f.kind, value: p.x.data[f.key] ?? null })),
    };
  }
  async policyFieldSave(_a: string, id: string, set: Record<string, unknown>, expectRev: number, undo?: { expect: Record<string, unknown>; token?: string }) {
    const p = this.pol(id);
    if (!p) return { ok: false as const, reason: "Not found" };
    if (!ED.POLICY_FIX_FIELDS[p.c.insuranceType || "health"]) return { ok: false as const, reason: "NOT_EDITABLE" };
    const fix = ED.fixFieldsFor(p.c.insuranceType || "health", p.x.data);
    if (expectRev !== p.x.rev) return { ok: false as const, reason: "CHANGED" };
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(set)) {
      const f = fix.find((x) => x.key === k);
      if (!f) return { ok: false as const, reason: "INVALID", fields: { [k]: "cannot be changed from WhatsApp" } };
      if (undo) { clean[k] = v ?? null; continue; }
      const c = ED.cleanFixValue(f.kind, v);
      if (!c.ok || c.value === null) return { ok: false as const, reason: "INVALID", fields: { [k]: c.ok ? "a value is needed" : c.error } };
      clean[k] = c.value;
    }
    if (undo) {
      if (undo.token !== "fake-token") return { ok: false as const, reason: "INVALID", fields: { token: "undo is only for a change saved here" } };
      if (Object.keys(clean).some((k) => ED.norm(p.x.data[k]) !== ED.norm(undo.expect[k]))) return { ok: false as const, reason: "CHANGED" };
    }
    const before = Object.fromEntries(Object.keys(clean).map((k) => [k, p.x.data[k] ?? null]));
    Object.assign(p.x.data, clean);
    p.x.rev += 1;
    this.writes.push({ kind: "policyFieldSave", id, body: clean });
    return { ok: true as const, before, after: { ...clean }, rev: p.x.rev, undoToken: "fake-token" };
  }
  async clientDetailSave(_a: string, id: string, set: Record<string, unknown>, expect: Record<string, unknown>, restore = false, token?: string) {
    const p = this.pol(id);
    if (!p) return { ok: false as const, reason: "Not found" };
    if (ED.missingExpect(set, expect).length) return { ok: false as const, reason: "INVALID", fields: { expect: "required" } };
    const cl = restore ? ED.restoreSet(set, ED.CLIENT_DETAIL_COLS) : ED.cleanClientSet(set);
    if (Object.keys(cl.errors).length) return { ok: false as const, reason: "INVALID", fields: cl.errors };
    if (restore && token !== "fake-token") return { ok: false as const, reason: "INVALID", fields: { token: "undo is only for a change saved here" } };
    const now: Record<string, unknown> = { policyholder_name: p.c.policyholderName, client_phone: p.c.customerPhone, client_email: p.x.email, policy_identifier: p.x.identifier };
    if (Object.keys(expect).some((k) => ED.norm(now[k]) !== ED.norm(expect[k]))) return { ok: false as const, reason: "CHANGED" };
    for (const [k, v] of Object.entries(cl.set)) {
      if (k === "policyholder_name") p.c.policyholderName = v as string;
      else if (k === "client_phone") p.c.customerPhone = (v as string) ?? null;
      else if (k === "client_email") p.x.email = (v as string) ?? null;
      else if (k === "policy_identifier") p.x.identifier = (v as string) ?? null;
    }
    this.writes.push({ kind: "clientDetailSave", id, body: cl.set });
    return { ok: true as const, after: { ...cl.set }, undoToken: "fake-token" };
  }
  async setSharing(_a: string, id: string, enabled: boolean, expectEnabled: boolean) {
    const p = this.pol(id);
    if (!p) return { ok: false as const, reason: "Not found" };
    if (!!p.c.shareToken !== expectEnabled) return { ok: false as const, reason: "CHANGED" };
    // Only the switch moves: the same link comes back.
    if (p.c.shareToken) p.x.token = p.c.shareToken;
    p.c.shareToken = enabled ? (p.x.token ?? "tok-" + id.slice(0, 8)) : null;
    this.writes.push({ kind: "setSharing", id, body: { enabled } });
    return { ok: true as const, enabled };
  }
  /* Stage 2c: claims, with the backend's rules (whatsapp/edits.ts) through the shared editRules. */
  claimStore = new Map<string, any>();
  queryStore: { claim_id: string; seq: number; question: string; resolved_on: string | null }[] = [];
  canExtend = new Set<string>();
  private claimOut(id: string) {
    const c = this.claimStore.get(id);
    return c ? { ...c, customer_name: this.customers.find((x) => x.id === c.customer_id)?.name ?? null } : null;
  }
  async claimRow(_a: string, id: string) {
    const claim = this.claimOut(id);
    if (!claim) return null;
    return { claim, openQueries: this.queryStore.filter((q) => q.claim_id === id && !q.resolved_on).map((q) => ({ seq: q.seq, question: q.question, raised_on: "2026-10-20" })) };
  }
  async claimOpen(_a: string, customerId: string, set: Record<string, unknown>) {
    if (!this.customers.some((x) => x.id === customerId)) return { ok: false as const, reason: "Customer not found" };
    const cl = ED.cleanClaimSet(set);
    if (Object.keys(cl.errors).length) return { ok: false as const, reason: "INVALID", fields: cl.errors };
    const id = crypto.randomUUID();
    const row: any = { id, status: "opened", claim_type: "reimbursement", insurer: null, tpa: null, policy_number: null, hospital: null, ailment: null, claimed_amount: null, settled_amount: null, admitted_on: null, discharged_on: null, customer_id: customerId, fresh: true };
    for (const [k, v] of Object.entries(cl.set)) row[k] = k === "claimed_amount" ? Number(v).toFixed(2) : v;
    this.claimStore.set(id, row);
    this.writes.push({ kind: "claimOpen", id, body: set });
    const claim = this.claimOut(id)!;
    return { ok: true as const, claim, created: Object.fromEntries(["customer_id", ...ED.CLAIM_FIELDS].map((k) => [k, claim[k] ?? null])) };
  }
  async claimUndoCreate(_a: string, id: string, created: Record<string, unknown>) {
    const c = this.claimStore.get(id);
    if (!c || !c.fresh || c.status !== "opened" || this.queryStore.some((q) => q.claim_id === id)) return false;
    if (Object.entries(created).some(([k, v]) => ED.norm(c[k]) !== ED.norm(v))) return false;
    this.claimStore.delete(id);
    this.writes.push({ kind: "claimUndoCreate", id, body: {} });
    return true;
  }
  async claimEdit(_a: string, id: string, set: Record<string, unknown>, expect: Record<string, unknown>, restore = false, token?: string) {
    const c = this.claimStore.get(id);
    if (!c) return { ok: false as const, reason: "Not found" };
    if (ED.CLAIM_TERMINAL.includes(c.status)) return { ok: false as const, reason: "CLOSED" };
    if (ED.missingExpect(set, expect).length) return { ok: false as const, reason: "INVALID", fields: { expect: "required" } };
    const cl = restore ? ED.restoreSet(set, ED.CLAIM_FIELDS) : ED.cleanClaimSet(set);
    if (Object.keys(cl.errors).length) return { ok: false as const, reason: "INVALID", fields: cl.errors };
    if (restore && token !== "fake-token") return { ok: false as const, reason: "INVALID", fields: { token: "undo is only for a change saved here" } };
    if (Object.keys(expect).some((k) => ED.norm(c[k]) !== ED.norm(expect[k]))) return { ok: false as const, reason: "CHANGED" };
    for (const [k, v] of Object.entries(cl.set)) c[k] = k === "claimed_amount" && v !== null ? Number(v).toFixed(2) : v;
    c.fresh = false;
    this.writes.push({ kind: "claimEdit", id, body: cl.set });
    return { ok: true as const, after: Object.fromEntries(Object.keys(cl.set).map((k) => [k, c[k]])), undoToken: "fake-token" };
  }
  async claimStage(_a: string, id: string, to: string, from: string, restore = false, token?: string) {
    const c = this.claimStore.get(id);
    if (!c) return { ok: false as const, reason: "Not found" };
    const allowed = restore ? [...ED.CLAIM_OPEN_STAGES, "query_raised"] : ED.CLAIM_OPEN_STAGES;
    if (!allowed.includes(to) || (restore && token !== "fake-token")) return { ok: false as const, reason: "INVALID" };
    if (c.status !== from || ED.CLAIM_TERMINAL.includes(c.status)) return { ok: false as const, reason: "CHANGED" };
    if (!restore && from === "query_raised" && this.queryStore.some((q) => q.claim_id === id && !q.resolved_on)) return { ok: false as const, reason: "OPEN_QUERY" };
    c.status = to;
    c.fresh = false;
    this.writes.push({ kind: "claimStage", id, body: { to } });
    return { ok: true as const, status: to, undoToken: "fake-token" };
  }
  async claimQuery(_a: string, id: string, question: string, from: string) {
    const c = this.claimStore.get(id);
    if (!c) return { ok: false as const, reason: "Not found" };
    if (ED.CLAIM_TERMINAL.includes(c.status)) return { ok: false as const, reason: "CLOSED" };
    if (c.status !== from) return { ok: false as const, reason: "CHANGED" };
    const seq = Math.max(0, ...this.queryStore.filter((q) => q.claim_id === id).map((q) => q.seq)) + 1;
    this.queryStore.push({ claim_id: id, seq, question, resolved_on: null });
    c.status = "query_raised";
    this.writes.push({ kind: "claimQuery", id, body: { question } });
    return { ok: true as const, seq };
  }
  async claimAnswered(_a: string, id: string, seq: number) {
    const c = this.claimStore.get(id);
    const q = this.queryStore.find((x) => x.claim_id === id && x.seq === seq && !x.resolved_on);
    if (!c) return { ok: false as const, reason: "Not found" };
    if (!q) return { ok: false as const, reason: "CHANGED" };
    q.resolved_on = "2026-10-22";
    const openLeft = this.queryStore.filter((x) => x.claim_id === id && !x.resolved_on).length;
    const moved = openLeft === 0 && c.status === "query_raised";
    if (moved) c.status = "under_process";
    this.writes.push({ kind: "claimAnswered", id, body: { seq } });
    return { ok: true as const, resolvedOn: q.resolved_on, moved, status: c.status as string, openLeft, undoToken: "fake-token" };
  }
  async claimReopenQuery(_a: string, id: string, seq: number, resolvedOn: string, moved: boolean, status: string, token?: string) {
    const c = this.claimStore.get(id);
    const q = this.queryStore.find((x) => x.claim_id === id && x.seq === seq && x.resolved_on === resolvedOn);
    if (token !== "fake-token") return { ok: false as const, reason: "INVALID" };
    if (!c || !q || c.status !== status) return { ok: false as const, reason: "CHANGED" };
    q.resolved_on = null;
    if (moved) c.status = "query_raised";
    return { ok: true as const };
  }
  async claimExtend(_a: string, id: string) {
    if (!this.canExtend.has(id)) return { ok: false as const, reason: "CANNOT_EXTEND" };
    this.canExtend.delete(id);
    this.writes.push({ kind: "claimExtend", id, body: {} });
    return { ok: true as const, purgeOn: "2026-12-01" };
  }
  /* Stage 2d: life records, read the portal's way (shared/policyEvidence.ts). Only ever appended. */
  async lifeGet(_a: string, clientId: string) {
    const p = this.pol(clientId);
    if (!p) return null;
    const { evidence } = PE.readEvidence(p.x.data.value_evidence);
    return { type: p.c.insuranceType || "health", status: p.c.status, rev: p.x.rev, active: { payments: PE.activeRecords(evidence.payments), loans: PE.activeRecords(evidence.loans), quotes: PE.activeRecords(evidence.quotes) } };
  }
  async lifeAdd(_a: string, clientId: string, kind: "payment" | "loan" | "quote", input: Record<string, unknown>, expectRev: number) {
    const p = this.pol(clientId);
    if (!p) return { ok: false as const, reason: "Not found" };
    if (!["life", "term"].includes(p.c.insuranceType || "")) return { ok: false as const, reason: "NOT_LIFE" };
    if (expectRev !== p.x.rev) return { ok: false as const, reason: "CHANGED" };
    const list = kind === "payment" ? "payments" : kind === "loan" ? "loans" : "quotes";
    const rec: any = { id: crypto.randomUUID(), enteredOn: "2026-10-22", origin: "agent_entered", confirmation: "self_reported", reference: null, note: "From WhatsApp", supersedes: null, voided: false, kind, currency: "INR", ...input };
    if (kind === "loan" && input.status === "none") Object.assign(rec, { principal: 0, interest: 0 });
    const read = (PE.readEvidence({ schema: 1, [list]: [rec] }).evidence as any)[list][0];
    if (!read) return { ok: false as const, reason: "INVALID", fields: { input: "not readable" } };
    const ev: any = p.x.data.value_evidence ?? { schema: 1, payments: [], loans: [], quotes: [] };
    if (kind === "payment" && PE.activeRecords(ev.payments as any[]).some((x: any) => x.dueDate === read.dueDate && x.amount === read.amount)) return { ok: false as const, reason: "DUPLICATE" };
    p.x.data.value_evidence = { ...ev, [list]: [...(ev[list] ?? []), read] };
    p.x.rev += 1;
    this.writes.push({ kind: "lifeAdd", id: clientId, body: read });
    return { ok: true as const, rev: p.x.rev, list, record: read, undoToken: "fake-token" };
  }
  async lifeVoid(_a: string, clientId: string, list: string, recordId: string, expectRev: number, token?: string) {
    const p = this.pol(clientId);
    if (!p || token !== "fake-token") return { ok: false as const, reason: "INVALID" };
    if (expectRev !== p.x.rev) return { ok: false as const, reason: "CHANGED" };
    const ev: any = p.x.data.value_evidence;
    const target = ev && PE.activeRecords((ev[list] ?? []) as any[]).find((r: any) => r.id === recordId);
    if (!target) return { ok: false as const, reason: "CHANGED" };
    ev[list] = [...ev[list], { ...target, id: crypto.randomUUID(), supersedes: recordId, voided: true }];
    p.x.rev += 1;
    this.writes.push({ kind: "lifeVoid", id: clientId, body: { recordId } });
    return { ok: true as const, rev: p.x.rev };
  }
  undoneCreates: string[] = [];
  async leadUndoCreate(_a: string, id: string, created?: Record<string, unknown>) {
    // Same as the backend: only if it still holds exactly what was created.
    const row = this.leadRows.find((x) => x.id === id);
    if (!row || !created || Object.entries(created).some(([k, v]) => ED.norm(row[k]) !== ED.norm(v))) return false;
    this.undoneCreates.push(id);
    this.leadRows = this.leadRows.filter((x) => x.id !== id);
    return true;
  }
  async catalog() { return this.catalogRows; }
  leadRows: any[] = [];
  leadUpdates: any[] = [];
  followupRows: any[] = [];
  viewRows: any[] = [];
  claimRows: any[] = [];
  claimQueries: (string | null)[] = [];
  async leadSearch(_a: string, q: string) {
    const d = q.replace(/\D/g, "");
    return this.leadRows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()) || (d.length >= 10 && (r.phone || "").endsWith(d.slice(-10))));
  }
  async leadUpdate(_a: string, id: string, u: any) {
    this.leadUpdates.push({ id, ...u });
    const r = this.leadRows.find((x) => x.id === id);
    const before = { ...r };
    if (u.status) r.status = u.status;
    if (u.nextFollowUp) r.next_follow_up = u.nextFollowUp;
    if (u.note) r.notes = [r.notes, u.note].filter(Boolean).join("\n");
    return { lead: r, before };
  }
  async followups() { return this.followupRows; }
  async lookup(_a: string, q: string) {
    return { policies: [...this.clients.values()].filter((c) => (c.policyholderName || "").toLowerCase().includes(q.toLowerCase())), leads: await this.leadSearch(_a, q) };
  }
  async views() { return this.viewRows; }
  async claims(_a: string, q: string | null) {
    this.claimQueries.push(q);
    if (!this.claimStore.size) return this.claimRows;
    return [...this.claimStore.keys()].map((id) => ({ ...this.claimOut(id)!, openQueries: [] as any[] })) as any[];
  }
  policyType: (string | null)[] = [];
  async policies(_a: string, type: string | null) {
    this.policyType.push(type);
    const rows = [...this.clients.values()].filter((c) => !type || c.insuranceType === type)
      .map((c) => ({ clientId: c.clientId, name: c.policyholderName, insuranceType: c.insuranceType, insurer: c.insurer, policyName: c.policyName, score: c.score }));
    return { total: rows.length, rows };
  }
  async compare(_a: string, keys: string[]) {
    this.compared.push(keys);
    return { uuid: "cmp-uuid-1", names: ["Care Health Insurance Care Supreme", "Niva Bupa Health Insurance ReAssure 2.0"], verdict: { winner_index: 0, winner_name: "Care Supreme", reasons: ["No room rent cap", "Shorter PED wait"], counterpoint: "ReAssure 2.0 has a bigger bonus" } };
  }
  async llmPhrase() { this.llmPhraseCalls++; return this.phraseAnswer; }

  /* Stage 1: the backend's real rules (bookViews.ts) over made-up rows. */
  queueRows: any[] = [];
  bookRows: any[] = [];
  customerRows: { id: string; name: string; phone: string | null; city: string | null }[] = [];
  portfolioPolicies = new Map<string, any[]>();
  calcFor = new Map<string, any>();
  valueRows: any[] = [];
  claimDetails = new Map<string, { claim: any; docs: any[]; queries: any[]; events: any[] }>();
  claimViews: string[] = [];
  insightRows: any[] = [];
  people: number | null = 0;
  pageRow: { slug: string } | null = null;
  pageViewRows: any[] = [];
  pageLeads = 0;
  now = Date.UTC(2026, 9, 21, 6);
  async queue() { return BV.queueView(this.queueRows); }
  async book(_a: string, view: any, sort: any, type: string | null) { return BV.policyView(this.bookRows, view, sort, this.now, type); }
  async portfolio(_a: string, q: string) {
    const matches = this.customerRows.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
    const exact = matches.filter((c) => c.name.trim().toLowerCase() === q.toLowerCase());
    const c = matches.length === 1 ? matches[0] : exact.length === 1 ? exact[0] : null;
    if (!c) return { matches };
    return { matches, customer: c, portfolio: BV.portfolioView(this.portfolioPolicies.get(c.id) ?? [], this.calcFor.get(c.id) ?? null, this.now) };
  }
  async policyValueRows() { return this.valueRows; }
  async claim(_a: string, id: string) {
    if (this.claimStore.has(id)) return { canExtend: this.canExtend.has(id) } as any;
    const d = this.claimDetails.get(id);
    if (!d) return null;
    this.claimViews.push(id);
    return BV.claimView(d.claim, d.docs, d.queries, d.events);
  }
  async insights() { return BV.insightsView(this.insightRows, this.people, this.now); }
  async pageStats() { return this.pageRow ? { page: this.pageRow, stats: BV.pageStatsView(this.pageViewRows, this.pageLeads) } : { page: null }; }
}

/** A fake clock: sleeping advances time instantly. */
export function makeBot(over: { inspect?: (b: Buffer) => Promise<Inspection> } = {}) {
  const transport = new FakeTransport();
  const engine = new FakeEngine();
  let t = 1_000_000;
  const bot = new Bot({
    transport, engine,
    links: { origin: "https://indsure.in" },
    tmpDir: path.join(os.tmpdir(), "indsure-wa-test-" + crypto.randomUUID()),
    teamLink: "https://indsure.in/advisors-pricing",
    replyDelay: () => 0,
    sleep: async (ms) => { t += ms; },
    now: () => t,
    inspect: over.inspect ?? (async (buf) => {
      const s = buf.toString("latin1");
      if (s.includes("LOCKED")) return { kind: "locked" };
      if (s.includes("HINDI")) return { kind: "ok", text: "", hindi: true, guess: null, scores: {} };
      const guess = s.includes("MOTOR") ? "motor" : s.includes("UNKNOWN") ? null : "health";
      // TOPUP: a super top-up. NAME=Ramesh_Kumar: a name read off the policy. SCAN: no text.
      const names = [...s.matchAll(/NAME=([A-Za-z_]+)/g)].map((m) => m[1].replace(/_/g, " "));
      const text = s.includes("SCAN") ? "" : s.padEnd(400, ".");
      return { kind: "ok", text, hindi: false, guess, scores: {}, topUp: s.includes("TOPUP"), names };
    }),
  });
  return { bot, transport, engine, advance: (ms: number) => { t += ms; } };
}

let seq = 0;
export function text(body: string, from: string = ADVISOR): InboundMessage {
  return { id: `m${++seq}`, from, replyTo: `${from}@s.whatsapp.net`, kind: "text", text: body, fileName: null, mimeType: null, fileSize: null, timestampMs: Date.now(), raw: null };
}

export function pdf(t: FakeTransport, content: string, opts: { caption?: string; name?: string; size?: number; from?: string } = {}): InboundMessage {
  const id = `m${++seq}`;
  t.files.set(id, Buffer.from(`%PDF-1.4 ${content}`));
  const from = opts.from ?? ADVISOR;
  return { id, from, replyTo: `${from}@s.whatsapp.net`, kind: "document", text: opts.caption ?? "", fileName: opts.name ?? "policy.pdf", mimeType: "application/pdf", fileSize: opts.size ?? 1000, timestampMs: Date.now(), raw: null };
}

/** Let fire-and-forget queue work finish (it does real temp-file I/O). */
export async function settle(bot?: { busy(): boolean }) {
  for (let i = 0; i < 400; i++) {
    await new Promise((r) => setTimeout(r, 5));
    if (bot && !bot.busy() && i > 3) return;
  }
}
