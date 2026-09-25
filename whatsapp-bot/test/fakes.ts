/** In-memory fakes for bot-core tests. No network, no WhatsApp, no model. */

import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import type { ClientSummary, Engine, JobStatus, RenewalRow } from "../src/engine.js";
import type { InboundMessage, Transport } from "../src/transport/types.js";
import { Bot } from "../src/core/bot.js";
import type { Inspection } from "../src/core/pdfInspect.js";

export const AGENT = "11111111-1111-4111-8111-111111111111";
export const ADVISOR = "919800000001";
export const ADVISOR_JID = `${ADVISOR}@s.whatsapp.net`;
export const STRANGER = "919800000009";

export class FakeTransport implements Transport {
  sent: { to: string; text: string }[] = [];
  files = new Map<string, Buffer>();
  async start() {}
  onMessage() {}
  async sendText(to: string, text: string) { this.sent.push({ to, text }); }
  async sendTyping() {}
  async downloadMedia(m: InboundMessage) { return this.files.get(m.id) ?? Buffer.from("%PDF-1.4 x"); }
  async markRead() {}
  texts() { return this.sent.map((s) => s.text); }
  last() { return this.sent[this.sent.length - 1]?.text ?? ""; }
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
  customers: { id: string; name: string; phone: string | null }[] = [];
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
    const dup = this.leads.find((x) => x.phone && x.phone === l.phone);
    if (dup) return { id: dup.id, duplicateOf: dup.name };
    const id = crypto.randomUUID(); this.leads.push({ id, ...l }); return { id };
  }
  async saveCalculator(_a: string, inputs: any, result: any) { this.calcSaved.push({ inputs, result }); return "calc-uuid-1"; }
  async catalog() { return this.catalogRows; }
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
      return { kind: "ok", text: s, hindi: false, guess, scores: {} };
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
