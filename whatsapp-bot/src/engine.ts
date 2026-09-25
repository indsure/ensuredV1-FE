/**
 * engine-client: every call the bot makes into IndSure. HTTP to the backend on the same
 * box, authenticated by WA_BOT_KEY. Checks go through the portal's own
 * POST /api/agent/analyze, so a WhatsApp check and a portal upload are the same code path.
 *
 * `Engine` is an interface so tests run bot-core against a fake with no network.
 */

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
  analyze(agentId: string, f: { buffer: Buffer; fileName: string; type: string; policyholderName?: string | null; clientPhone?: string | null }): Promise<AnalyzeResult>;
  jobStatus(agentId: string, jobId: string): Promise<JobStatus>;
  getClient(agentId: string, clientId: string): Promise<ClientSummary | null>;
  findClients(agentId: string, name: string): Promise<ClientSummary[]>;
  share(agentId: string, clientId: string): Promise<string | null>;
  attachCustomer(agentId: string, clientId: string, customerId: string): Promise<boolean>;
  searchCustomers(agentId: string, q: string): Promise<{ id: string; name: string; phone: string | null }[]>;
  renewals(agentId: string): Promise<{ leads: RenewalRow[]; customers: RenewalRow[] }>;
  llmIntent(agentId: string, text: string, hasReport: boolean): Promise<string>;
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

  async analyze(agentId: string, f: { buffer: Buffer; fileName: string; type: string; policyholderName?: string | null; clientPhone?: string | null }): Promise<AnalyzeResult> {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(f.buffer)], { type: "application/pdf" }), f.fileName || "policy.pdf");
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
  llmPhrase(agentId: string, clientId: string, question: string) {
    return this.call("/api/internal/wa/llm/phrase", { method: "POST", agentId, body: { clientId, question } });
  }
}
