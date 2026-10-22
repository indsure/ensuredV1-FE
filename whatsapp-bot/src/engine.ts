/**
 * engine-client: every call the bot makes into IndSure. HTTP to the backend on the same
 * box, authenticated by WA_BOT_KEY. Checks go through the portal's own
 * POST /api/agent/analyze, so a WhatsApp check and a portal upload are the same code path.
 *
 * `Engine` is an interface so tests run bot-core against a fake with no network.
 */

/** One policy check. `companion` is the same insured's super top-up, read in the same audit. */
export type AnalyzeFile = {
  buffer: Buffer; fileName: string; type: string; policyholderName?: string | null; clientPhone?: string | null;
  companion?: { buffer: Buffer; fileName: string } | null;
};

export type ClientSummary = {
  clientId: string;
  status: string;
  errorMessage: string | null;
  insuranceType: string | null;
  policyholderName: string | null;
  customerId: string | null;
  customerPhone: string | null;
  insurer: string | null;
  policyName: string | null;
  score: number | null;
  shareToken: string | null;
  views: number;
  expiryDate: string | null;
  /** First key failure point: what the portal's "Suggest an upgrade" message names. */
  weakPoint?: string | null;
  /** Data-entry fields with the portal's labels (motor, life, travel...). */
  details?: { label: string; value: string }[];
  /** Raw stored fields for life/term, for the policy-value engine. */
  extracted?: Record<string, unknown> | null;
  /** Other covers read in the same check (a super top-up sent with the base policy), and
   *  whether the engine could actually read each one. Absent on an older backend. */
  companions?: { kind: string; read: boolean }[];
  report: null | {
    verdictLabel: string | null;
    verdictSummary: string | null;
    interpretation: string | null;
    effectiveCover: number | null;
    baseSumInsured: number | null;
    premiumTotal: number | null;
    whereItMayCost: { issue: string | null; impact: string | null; outOfPocket: string | null }[];
    whatWorks: { benefit: string | null; why: string | null; value: string | null }[];
    roomRent: null | { limit: string | null; perDay: number | null; penalty: string | null; explanation: string | null };
    coPay: null | { exists: boolean | null; percentage: number | null; conditions: string | null; outOfPocketOn5L: number | null };
    subLimits: { procedure: string | null; limit: number | null; gap: number | null }[];
    waitingPeriods: unknown;
  };
};

export type RenewalRow = {
  id: string;
  name: string | null;
  phone: string | null;
  insurance_type: string | null;
  insurer: string | null;
  policy_name: string | null;
  premium: number | string | null;
  due_date: string;
  days_left: number;
  spoken_to?: boolean;
};

export type AnalyzeResult =
  | { ok: true; clientId: string; jobId: string }
  | { ok: false; code: "NO_CREDITS" | "NO_OCR_CREDITS" | "UNSUPPORTED" | "ERROR"; message: string };

export type JobStatus =
  | { status: "pending" | "processing"; clientId: string | null }
  | { status: "completed"; clientId: string | null }
  | { status: "error"; clientId: string | null; error: string }
  | { status: "not_found"; clientId: null };

export type Profile = {
  name: string | null;
  partneredCompanies: string[];
  page: null | { slug: string; live: boolean; enabled: boolean; published: boolean };
};

export type CatalogPlan = { plan_key: string; insurer: string | null; plan_name: string | null; variant: string | null };

export type CompareResult = {
  uuid: string;
  names: (string | null)[];
  verdict: null | { winner_index: number; winner_name: string | null; reasons: string[]; counterpoint: string | null };
};

export type PolicyRow = {
  clientId: string; name: string | null; insuranceType: string | null;
  insurer: string | null; policyName: string | null; score: number | null;
};

import type { LeadRow, ClaimRow } from "./core/crm.js";
export type { LeadRow, ClaimRow };
import type { BookData, BookSort, BookViewName, ClaimDetailData, InsightsData, PageStatsData, PortfolioData, QueueData } from "./core/bookReplies.js";
export type { BookData, BookSort, BookViewName, ClaimDetailData, InsightsData, PageStatsData, PortfolioData, QueueData };

export type SachStatus = { plan: string; paid: boolean; used: number; limit: number; resetsOn: string };

export type Conversation = { state: string; currentClientId: string | null; pending: any; updatedAt: string | null };

export interface Engine {
  resolve(number: string): Promise<{ agentId: string | null; servable: boolean }>;
  link(number: string, code: string): Promise<{ ok: boolean; reason?: string; agentId?: string; servable?: boolean }>;
  unlink(agentId: string): Promise<void>;
  logMessage(m: { waMessageId?: string | null; agentId?: string | null; direction: "in" | "out"; type: string; bodyRedacted?: string | null; mediaSha256?: string | null; intent?: string | null }): Promise<{ duplicate: boolean }>;
  unknownSeen(numberHash: string): Promise<boolean>;
  getConversation(agentId: string): Promise<Conversation>;
  putConversation(agentId: string, c: { state: string; currentClientId: string | null; pending: any }): Promise<void>;
  checksLeft(agentId: string): Promise<number>;
  jobByHash(agentId: string, sha: string): Promise<string | null>;
  createJob(agentId: string, j: { waMessageId: string; fileSha256: string; insuranceType: string | null }): Promise<string>;
  updateJob(agentId: string, id: string, patch: Record<string, unknown>): Promise<void>;
  openJobs(): Promise<{ id: string; agent_id: string; client_id: string | null; analysis_job_id: string | null; status: string; queued_at: string }[]>;
  analyze(agentId: string, f: AnalyzeFile): Promise<AnalyzeResult>;
  jobStatus(agentId: string, jobId: string): Promise<JobStatus>;
  getClient(agentId: string, clientId: string): Promise<ClientSummary | null>;
  findClients(agentId: string, name: string): Promise<ClientSummary[]>;
  share(agentId: string, clientId: string): Promise<string | null>;
  attachCustomer(agentId: string, clientId: string, customerId: string): Promise<boolean>;
  searchCustomers(agentId: string, q: string): Promise<{ id: string; name: string; phone: string | null; dob?: string | null; city?: string | null }[]>;
  renewals(agentId: string): Promise<{ leads: RenewalRow[]; customers: RenewalRow[] }>;
  llmIntent(agentId: string, text: string, hasReport: boolean): Promise<string>;
  profile(agentId: string): Promise<Profile>;
  createLead(agentId: string, lead: { name: string; phone: string | null; interest: string | null; status?: string | null; nextFollowUp?: string | null; note?: string | null }): Promise<{ id: string; duplicateOf?: string; created?: Record<string, unknown> }>;
  saveCalculator(agentId: string, inputs: unknown, result: unknown, customerId?: string | null): Promise<string>;
  /** The model fills the form (backend, switched off unless WA_LLM_ENABLED=true). */
  understand(agentId: string, text: string, ctx: import("./core/understand.js").Context): Promise<{ enabled: boolean; understanding: import("./core/understand.js").Understanding | null; reason?: string; usage?: SachStatus }>;
  /** Sach Assistant: plan and this month's smart replies (BALANCE). */
  sach(agentId: string): Promise<SachStatus>;
  /** Advisors due a morning brief today (paid, linked, not opted out, not yet sent). */
  morningRecipients(): Promise<{ agentId: string; waNumber: string; name: string | null }[]>;
  morningOn(agentId: string): Promise<boolean>;
  leadsList(agentId: string): Promise<{ total: number; leads: LeadRow[] }>;
  /** `expect` (the values the bot saved): restore only if nobody changed them since. */
  leadRestore(agentId: string, id: string, before: { status: string | null; next_follow_up: string | null; notes: string | null }, expect?: { status: string | null; next_follow_up: string | null; notes: string | null }): Promise<LeadRow | null>;
  /* Stage 2a: edits (backend whatsapp/edits.ts). A refused write is a result, never a throw. */
  leadGet(agentId: string, id: string): Promise<FullLead | null>;
  leadEdit(agentId: string, id: string, set: Record<string, unknown>, expect: Record<string, unknown>, restore?: boolean, token?: string): Promise<WriteResult<{ lead: FullLead; before: FullLead; undoToken?: string }>>;
  leadConvert(agentId: string, id: string): Promise<WriteResult<{ customer: FullCustomer; before: { status: string } }>>;
  leadUnconvert(agentId: string, id: string, customerId: string, status: string): Promise<WriteResult<{ customerRemoved: boolean }>>;
  customerGet(agentId: string, id: string): Promise<FullCustomer | null>;
  customerCreate(agentId: string, c: Record<string, unknown>): Promise<WriteResult<{ customer: FullCustomer; duplicate: boolean }>>;
  customerEdit(agentId: string, id: string, set: Record<string, unknown>, expect: Record<string, unknown>, restore?: boolean, token?: string): Promise<WriteResult<{ customer: FullCustomer; before: FullCustomer; undoToken?: string }>>;
  /** `created`: the values it was created with; it is removed only if it still holds them. */
  customerUndoCreate(agentId: string, id: string, created: Record<string, unknown>): Promise<boolean>;
  fileClient(agentId: string, clientId: string, customerId: string | null, expectCustomerId: string | null): Promise<WriteResult<{ customerId: string | null }>>;
  leadUndoCreate(agentId: string, id: string, created?: Record<string, unknown>): Promise<boolean>;
  /* Stage 2b: policies. Client details on any policy; saved details on a non-health one. */
  policyFields(agentId: string, clientId: string): Promise<PolicyFields | null>;
  policyFieldSave(agentId: string, clientId: string, set: Record<string, unknown>, expectRev: number, undo?: { expect: Record<string, unknown>; token?: string }): Promise<WriteResult<{ before: Record<string, unknown>; after: Record<string, unknown>; rev: number; undoToken?: string }>>;
  clientDetailSave(agentId: string, clientId: string, set: Record<string, unknown>, expect: Record<string, unknown>, restore?: boolean, token?: string): Promise<WriteResult<{ after: Record<string, unknown>; undoToken?: string }>>;
  setSharing(agentId: string, clientId: string, enabled: boolean, expectEnabled: boolean): Promise<WriteResult<{ enabled: boolean }>>;
  /* Stage 2c: claims. Never closed or reopened from here; amounts and dates come back as text. */
  claimRow(agentId: string, id: string): Promise<ClaimEditRow | null>;
  claimOpen(agentId: string, customerId: string, set: Record<string, unknown>): Promise<WriteResult<{ claim: ClaimEditRow["claim"]; created: Record<string, unknown> }>>;
  claimUndoCreate(agentId: string, id: string, created: Record<string, unknown>): Promise<boolean>;
  claimEdit(agentId: string, id: string, set: Record<string, unknown>, expect: Record<string, unknown>, restore?: boolean, token?: string): Promise<WriteResult<{ after: Record<string, unknown>; undoToken?: string }>>;
  claimStage(agentId: string, id: string, to: string, from: string, restore?: boolean, token?: string): Promise<WriteResult<{ status: string; undoToken?: string }>>;
  claimQuery(agentId: string, id: string, question: string, from: string): Promise<WriteResult<{ seq: number }>>;
  claimAnswered(agentId: string, id: string, seq: number): Promise<WriteResult<{ resolvedOn: string; moved: boolean; openLeft: number; undoToken?: string }>>;
  claimReopenQuery(agentId: string, id: string, seq: number, resolvedOn: string, moved: boolean, token?: string): Promise<WriteResult<{}>>;
  claimExtend(agentId: string, id: string): Promise<WriteResult<{ purgeOn: string }>>;
  catalog(agentId: string): Promise<CatalogPlan[]>;
  compare(agentId: string, keys: string[]): Promise<CompareResult>;
  policies(agentId: string, type: string | null): Promise<{ total: number; rows: PolicyRow[] }>;
  leadSearch(agentId: string, q: string): Promise<LeadRow[]>;
  leadUpdate(agentId: string, id: string, u: { status?: string; nextFollowUp?: string; note?: string }): Promise<{ lead: LeadRow; before: LeadRow }>;
  followups(agentId: string): Promise<LeadRow[]>;
  lookup(agentId: string, q: string): Promise<{ policies: ClientSummary[]; leads: LeadRow[] }>;
  views(agentId: string): Promise<{ name: string | null; insurer: string | null; policyName: string | null; views: number; lastViewed: string; clientId: string }[]>;
  claims(agentId: string, q: string | null): Promise<ClaimRow[]>;
  /* Stage 1: read-only views of the book (backend whatsapp/bookViews.ts). */
  queue(agentId: string): Promise<QueueData>;
  book(agentId: string, view: BookViewName, sort: BookSort, type: string | null): Promise<BookData>;
  portfolio(agentId: string, q: string): Promise<PortfolioData>;
  policyValueRows(agentId: string): Promise<any[]>;
  claim(agentId: string, id: string): Promise<ClaimDetailData | null>;
  insights(agentId: string): Promise<InsightsData>;
  pageStats(agentId: string): Promise<PageStatsData>;
  llmPhrase(agentId: string, clientId: string, question: string): Promise<{ answer: string | null; notInReport?: boolean; guardFired?: boolean }>;
}

export class HttpEngine implements Engine {
  constructor(private readonly base: string, private readonly key: string) {}

  private async call(path: string, opts: { method?: string; agentId?: string | null; body?: unknown } = {}): Promise<any> {
    const res = await fetch(this.base + path, {
      method: opts.method || "GET",
      headers: {
        "content-type": "application/json",
        "x-wa-bot-key": this.key,
        ...(opts.agentId ? { "x-wa-agent-id": opts.agentId } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(`engine ${opts.method || "GET"} ${path} -> ${res.status}`);
      err.status = res.status;
      err.body = json;
      throw err;
    }
    return json;
  }

  resolve(number: string) { return this.call("/api/internal/wa/resolve", { method: "POST", body: { number } }); }
  link(number: string, code: string) { return this.call("/api/internal/wa/link", { method: "POST", body: { number, code } }); }
  async unlink(agentId: string) { await this.call("/api/internal/wa/unlink", { method: "POST", agentId, body: {} }); }
  logMessage(m: any) { return this.call("/api/internal/wa/messages", { method: "POST", body: m }); }
  async unknownSeen(numberHash: string) { return (await this.call("/api/internal/wa/unknown-seen", { method: "POST", body: { numberHash } })).seen; }
  getConversation(agentId: string) { return this.call("/api/internal/wa/conversation", { agentId }); }
  async putConversation(agentId: string, c: any) { await this.call("/api/internal/wa/conversation", { method: "PUT", agentId, body: c }); }
  async checksLeft(agentId: string) { return (await this.call("/api/internal/wa/allowance", { agentId })).checksLeft; }
  async jobByHash(agentId: string, sha: string) { return (await this.call(`/api/internal/wa/jobs/by-hash/${sha}`, { agentId })).clientId; }
  async createJob(agentId: string, j: any) { return (await this.call("/api/internal/wa/jobs", { method: "POST", agentId, body: j })).id; }
  async updateJob(agentId: string, id: string, patch: any) { await this.call(`/api/internal/wa/jobs/${id}`, { method: "PATCH", agentId, body: patch }); }
  async openJobs() { return (await this.call("/api/internal/wa/jobs/open")).jobs; }

  async analyze(agentId: string, f: AnalyzeFile): Promise<AnalyzeResult> {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(f.buffer)], { type: "application/pdf" }), f.fileName || "policy.pdf");
    // Same field the portal uses: read in the same audit, one policy check for both.
    if (f.companion) {
      form.append("companion_super_topup", new Blob([new Uint8Array(f.companion.buffer)], { type: "application/pdf" }), f.companion.fileName || "super-top-up.pdf");
    }
    form.append("type", f.type);
    if (f.policyholderName) form.append("policyholder_name", f.policyholderName);
    if (f.clientPhone) form.append("client_phone", f.clientPhone);
    const res = await fetch(this.base + "/api/agent/analyze", {
      method: "POST",
      headers: { "x-wa-bot-key": this.key, "x-wa-agent-id": agentId },
      body: form,
    });
    const json: any = await res.json().catch(() => ({}));
    if (res.ok && json.clientId && json.jobId) return { ok: true, clientId: json.clientId, jobId: json.jobId };
    const code = json.error === "NO_CREDITS" || json.error === "NO_OCR_CREDITS" ? json.error
      : json.error === "UNSUPPORTED_INSURANCE_TYPE" ? "UNSUPPORTED" : "ERROR";
    return { ok: false, code, message: String(json.message || json.error || `HTTP ${res.status}`) };
  }

  async jobStatus(agentId: string, jobId: string): Promise<JobStatus> {
    const res = await fetch(this.base + `/api/agent/analyze/status/${encodeURIComponent(jobId)}`, {
      headers: { "x-wa-bot-key": this.key, "x-wa-agent-id": agentId },
    });
    const json: any = await res.json().catch(() => ({}));
    if (res.status === 404) return { status: "not_found", clientId: null };
    if (!res.ok) throw new Error(`status ${res.status}`);
    if (json.status === "completed") return { status: "completed", clientId: json.clientId ?? null };
    if (json.status === "error") return { status: "error", clientId: json.clientId ?? null, error: String(json.error || "") };
    return { status: json.status === "processing" ? "processing" : "pending", clientId: json.clientId ?? null };
  }

  async getClient(agentId: string, clientId: string) {
    try { return await this.call(`/api/internal/wa/clients/${clientId}`, { agentId }); }
    catch (e: any) { if (e.status === 404) return null; throw e; }
  }
  async findClients(agentId: string, name: string) {
    return (await this.call(`/api/internal/wa/clients?name=${encodeURIComponent(name)}`, { agentId })).matches;
  }
  async share(agentId: string, clientId: string) {
    return (await this.call(`/api/internal/wa/clients/${clientId}/share`, { method: "POST", agentId, body: {} })).shareToken ?? null;
  }
  async attachCustomer(agentId: string, clientId: string, customerId: string) {
    try { await this.call(`/api/internal/wa/clients/${clientId}/customer`, { method: "POST", agentId, body: { customerId } }); return true; }
    catch { return false; }
  }
  async searchCustomers(agentId: string, q: string) {
    return (await this.call(`/api/internal/wa/customers?q=${encodeURIComponent(q)}`, { agentId })).matches;
  }
  renewals(agentId: string) { return this.call("/api/internal/wa/renewals", { agentId }); }
  async llmIntent(agentId: string, text: string, hasReport: boolean) {
    return (await this.call("/api/internal/wa/llm/intent", { method: "POST", agentId, body: { text, hasReport } })).intent;
  }
  profile(agentId: string) { return this.call("/api/internal/wa/profile", { agentId }); }
  createLead(agentId: string, lead: any) { return this.call("/api/internal/wa/leads", { method: "POST", agentId, body: lead }); }
  async saveCalculator(agentId: string, inputs: unknown, result: unknown, customerId: string | null = null) {
    return (await this.call("/api/internal/wa/calculator", { method: "POST", agentId, body: { inputs, result, customerId } })).uuid;
  }
  async sach(agentId: string) { return this.call("/api/internal/wa/sach", { agentId }); }
  async morningRecipients() { return (await this.call("/api/internal/wa/morning/recipients")).recipients; }
  async morningOn(agentId: string) { return !!(await this.call("/api/internal/wa/morning/pref", { agentId })).on; }
  async understand(agentId: string, text: string, ctx: unknown) {
    return this.call("/api/internal/wa/understand", { method: "POST", agentId, body: { text, ctx } });
  }
  leadsList(agentId: string) { return this.call("/api/internal/wa/leads/list", { agentId }); }
  async leadRestore(agentId: string, id: string, before: unknown, expect?: unknown) {
    try {
      return (await this.call(`/api/internal/wa/leads/${id}/update`, { method: "POST", agentId, body: { restore: before, ...(expect ? { expect } : {}) } })).lead ?? null;
    } catch (e: any) { if (e?.status === 409 || e?.status === 400) return null; throw e; }
  }
  /* Stage 2a: edits to leads, customers and filing (backend whatsapp/edits.ts). */
  private async write<T>(path: string, agentId: string, body: unknown): Promise<WriteResult<T>> {
    try { return { ok: true, ...(await this.call(path, { method: "POST", agentId, body })) }; }
    catch (e: any) {
      if (e?.status === 409 || e?.status === 400 || e?.status === 404) return { ok: false, reason: e.body?.error || "CHANGED", fields: e.body?.fields, customerId: e.body?.customerId };
      throw e;
    }
  }
  async leadGet(agentId: string, id: string) {
    try { return (await this.call(`/api/internal/wa/leads/${id}`, { agentId })).lead; } catch (e: any) { if (e?.status === 404) return null; throw e; }
  }
  leadEdit(agentId: string, id: string, set: Record<string, unknown>, expect: Record<string, unknown>, restore = false, token?: string) { return this.write<{ lead: FullLead; before: FullLead; undoToken?: string }>(`/api/internal/wa/leads/${id}/edit`, agentId, { set, expect, ...(restore ? { restore: true, token } : {}) }); }
  leadConvert(agentId: string, id: string) { return this.write<{ customer: FullCustomer; before: { status: string } }>(`/api/internal/wa/leads/${id}/convert`, agentId, {}); }
  leadUnconvert(agentId: string, id: string, customerId: string, status: string) { return this.write<{ customerRemoved: boolean }>(`/api/internal/wa/leads/${id}/unconvert`, agentId, { customerId, status }); }
  async customerGet(agentId: string, id: string) {
    try { return (await this.call(`/api/internal/wa/customers/${id}`, { agentId })).customer; } catch (e: any) { if (e?.status === 404) return null; throw e; }
  }
  customerCreate(agentId: string, c: Record<string, unknown>) { return this.write<{ customer: FullCustomer; duplicate: boolean }>("/api/internal/wa/customers", agentId, c); }
  customerEdit(agentId: string, id: string, set: Record<string, unknown>, expect: Record<string, unknown>, restore = false, token?: string) { return this.write<{ customer: FullCustomer; before: FullCustomer; undoToken?: string }>(`/api/internal/wa/customers/${id}/edit`, agentId, { set, expect, ...(restore ? { restore: true, token } : {}) }); }
  async customerUndoCreate(agentId: string, id: string, created: Record<string, unknown>) { return (await this.write(`/api/internal/wa/customers/${id}/undo-create`, agentId, { expect: created })).ok; }
  fileClient(agentId: string, clientId: string, customerId: string | null, expectCustomerId: string | null) {
    return this.write<{ customerId: string | null }>(`/api/internal/wa/clients/${clientId}/file`, agentId, { customerId, expectCustomerId });
  }
  async policyFields(agentId: string, clientId: string) {
    try { return await this.call(`/api/internal/wa/clients/${clientId}/fields`, { agentId }) as PolicyFields; } catch (e: any) { if (e?.status === 404) return null; throw e; }
  }
  policyFieldSave(agentId: string, clientId: string, set: Record<string, unknown>, expectRev: number, undo?: { expect: Record<string, unknown>; token?: string }) {
    return this.write<{ before: Record<string, unknown>; after: Record<string, unknown>; rev: number; undoToken?: string }>(
      `/api/internal/wa/clients/${clientId}/fields`, agentId, { set, expectRev, ...(undo ? { restore: true, expect: undo.expect, token: undo.token } : {}) });
  }
  clientDetailSave(agentId: string, clientId: string, set: Record<string, unknown>, expect: Record<string, unknown>, restore = false, token?: string) {
    return this.write<{ after: Record<string, unknown>; undoToken?: string }>(`/api/internal/wa/clients/${clientId}/client-details`, agentId, { set, expect, ...(restore ? { restore: true, token } : {}) });
  }
  setSharing(agentId: string, clientId: string, enabled: boolean, expectEnabled: boolean) {
    return this.write<{ enabled: boolean }>(`/api/internal/wa/clients/${clientId}/sharing`, agentId, { enabled, expectEnabled });
  }
  async claimRow(agentId: string, id: string) {
    try { return await this.call(`/api/internal/wa/claims/${id}/row`, { agentId }) as ClaimEditRow; } catch (e: any) { if (e?.status === 404) return null; throw e; }
  }
  claimOpen(agentId: string, customerId: string, set: Record<string, unknown>) { return this.write<{ claim: ClaimEditRow["claim"]; created: Record<string, unknown> }>("/api/internal/wa/claims", agentId, { customerId, set }); }
  async claimUndoCreate(agentId: string, id: string, created: Record<string, unknown>) { return (await this.write(`/api/internal/wa/claims/${id}/undo-create`, agentId, { expect: created })).ok; }
  claimEdit(agentId: string, id: string, set: Record<string, unknown>, expect: Record<string, unknown>, restore = false, token?: string) {
    return this.write<{ after: Record<string, unknown>; undoToken?: string }>(`/api/internal/wa/claims/${id}/edit`, agentId, { set, expect, ...(restore ? { restore: true, token } : {}) });
  }
  claimStage(agentId: string, id: string, to: string, from: string, restore = false, token?: string) {
    return this.write<{ status: string; undoToken?: string }>(`/api/internal/wa/claims/${id}/stage`, agentId, { to, from, ...(restore ? { restore: true, token } : {}) });
  }
  claimQuery(agentId: string, id: string, question: string, from: string) { return this.write<{ seq: number }>(`/api/internal/wa/claims/${id}/queries`, agentId, { question, from }); }
  claimAnswered(agentId: string, id: string, seq: number) { return this.write<{ resolvedOn: string; moved: boolean; openLeft: number; undoToken?: string }>(`/api/internal/wa/claims/${id}/queries/${seq}/answered`, agentId, {}); }
  claimReopenQuery(agentId: string, id: string, seq: number, resolvedOn: string, moved: boolean, token?: string) { return this.write<{}>(`/api/internal/wa/claims/${id}/queries/${seq}/reopen`, agentId, { resolvedOn, moved, token }); }
  claimExtend(agentId: string, id: string) { return this.write<{ purgeOn: string }>(`/api/internal/wa/claims/${id}/extend`, agentId, {}); }
  async leadUndoCreate(agentId: string, id: string, created?: Record<string, unknown>) {
    try { await this.call(`/api/internal/wa/leads/${id}/undo-create`, { method: "POST", agentId, body: { expect: created } }); return true; }
    catch { return false; }
  }
  private catalogCache: { at: number; rows: CatalogPlan[] } | null = null;
  async catalog(agentId: string) {
    // The catalogue changes rarely; one fetch per 10 minutes is plenty.
    if (this.catalogCache && Date.now() - this.catalogCache.at < 600_000) return this.catalogCache.rows;
    const rows = (await this.call("/api/internal/wa/catalog", { agentId })).policies as CatalogPlan[];
    this.catalogCache = { at: Date.now(), rows };
    return rows;
  }
  compare(agentId: string, keys: string[]) { return this.call("/api/internal/wa/compare", { method: "POST", agentId, body: { keys } }); }
  async leadSearch(agentId: string, q: string) {
    return (await this.call(`/api/internal/wa/leads/search?q=${encodeURIComponent(q)}`, { agentId })).matches;
  }
  leadUpdate(agentId: string, id: string, u: any) {
    return this.call(`/api/internal/wa/leads/${id}/update`, { method: "POST", agentId, body: u });
  }
  async followups(agentId: string) { return (await this.call("/api/internal/wa/followups", { agentId })).leads; }
  lookup(agentId: string, q: string) { return this.call(`/api/internal/wa/lookup?q=${encodeURIComponent(q)}`, { agentId }); }
  async views(agentId: string) { return (await this.call("/api/internal/wa/views", { agentId })).views; }
  async claims(agentId: string, q: string | null) {
    return (await this.call(`/api/internal/wa/claims${q ? `?q=${encodeURIComponent(q)}` : ""}`, { agentId })).claims;
  }
  queue(agentId: string) { return this.call("/api/internal/wa/queue", { agentId }); }
  book(agentId: string, view: BookViewName, sort: BookSort, type: string | null) {
    return this.call(`/api/internal/wa/book?view=${view}&sort=${sort}${type ? `&type=${encodeURIComponent(type)}` : ""}`, { agentId });
  }
  portfolio(agentId: string, q: string) { return this.call(`/api/internal/wa/portfolio?q=${encodeURIComponent(q)}`, { agentId }); }
  async policyValueRows(agentId: string) { return (await this.call("/api/internal/wa/policy-values", { agentId })).rows; }
  async claim(agentId: string, id: string) {
    try { return await this.call(`/api/internal/wa/claims/${encodeURIComponent(id)}`, { agentId }); }
    catch (e: any) { if (e?.status === 404) return null; throw e; }
  }
  insights(agentId: string) { return this.call("/api/internal/wa/insights", { agentId }); }
  pageStats(agentId: string) { return this.call("/api/internal/wa/page-stats", { agentId }); }
  policies(agentId: string, type: string | null) {
    return this.call(`/api/internal/wa/policies${type ? `?type=${encodeURIComponent(type)}` : ""}`, { agentId });
  }
  llmPhrase(agentId: string, clientId: string, question: string) {
    return this.call("/api/internal/wa/llm/phrase", { method: "POST", agentId, body: { clientId, question } });
  }
}

/* ── Stage 2a shapes ─────────────────────────────────────────────────── */

export type FullLead = {
  id: string; name: string; phone: string | null; email: string | null; city: string | null; source: string | null;
  insurance_interest: string | null; expected_value: string | number | null; status: string; next_follow_up: string | null;
  notes: string | null; customer_id: string | null; created_at?: string; updated_at?: string;
};
/** One policy's editable details (GET /api/internal/wa/clients/:id/fields). `fields` is empty for health. */
export type PolicyFields = {
  id: string; type: string; status: string; shareEnabled: boolean; rev: number;
  client: { policyholder_name: string | null; policy_identifier: string | null; client_email: string | null; client_phone: string | null };
  fields: { key: string; label: string; kind: "money" | "percent" | "date" | "text"; value: unknown }[];
};
/** One claim as the edit routes see it (GET /api/internal/wa/claims/:id/row). */
export type ClaimEditRow = {
  claim: {
    id: string; status: string; claim_type: string; insurer: string | null; tpa: string | null; policy_number: string | null;
    hospital: string | null; ailment: string | null; claimed_amount: string | null; settled_amount: string | null;
    admitted_on: string | null; discharged_on: string | null; customer_id: string | null; customer_name: string | null;
  };
  openQueries: { seq: number; question: string; raised_on: string }[];
};
export type FullCustomer = { id: string; name: string; phone: string | null; email: string | null; city: string | null; dob: string | null; created_at?: string };
/** A write the server refused is a plain result: CHANGED (edited meanwhile), INVALID (with
 *  the field messages), ALREADY_CUSTOMER, NOT_REMOVABLE, Not found. */
export type WriteResult<T> = ({ ok: true } & T) | { ok: false; reason: string; fields?: Record<string, string>; customerId?: string };
