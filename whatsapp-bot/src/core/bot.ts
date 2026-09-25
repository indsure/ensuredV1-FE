/**
 * bot-core: dedupe, linking, the conversation state machine, the per-advisor check queue,
 * and the four phase 1 intents (brief §6, §7, §9).
 *
 * Rules this file keeps, and where:
 *   - The bot only ever messages the ADVISOR who wrote to it. There is no code path that
 *     sends to any other number; `say()` takes the advisor's own reply address.
 *   - Numbers come from the engine. Report cards and answers are built from stored fields
 *     (templates.ts, answers.ts); model phrasing is number-guarded server side.
 *   - One check at a time per advisor. The engine checks the balance up front and charges on
 *     success, so running two at once could let both pass on one remaining check.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Engine, ClientSummary, RenewalRow } from "../engine.js";
import type { InboundMessage, Transport } from "../transport/types.js";
import { inspectPdf, looksLikePdf, POLICY_TYPES, type Inspection, type PolicyType } from "./pdfInspect.js";
import {
  isNo, isSkip, isYes, langIn, linkCode, namedPerson, parseCaption, pickNumber, ruleIntent,
} from "./intents.js";
import { ruleAnswer } from "./answers.js";
import {
  T, failureReasonFix, portalPolicyUrl, renewalsReply, reportCard, shareDraft, shareReply,
  sharedReportUrl, waMeLink, type Lang, type Links,
} from "./templates.js";
import { buildMessage } from "../shared/draftMessage.js";
import type { UserInputs } from "../shared/health-engine-logic.js";
import {
  CALC_AGE_ASK, CALC_QUESTIONS, COMPARE_ASK, INTERESTS, LEAD_ASK, ageBandFor, calcQuestionText, calcReply,
  compareReply, interestIn, leadSavedReply, matchPlans, parseAge, parseCompareNames, parseLeadLine, planLabel,
  runCalculator, websiteReply,
} from "./tools.js";
import { log, redact } from "../log.js";

export const MAX_BYTES = 25 * 1024 * 1024;
const LANGS: Lang[] = ["english", "hinglish", "hindi"];

export type Timings = {
  pollMs: number;
  stillWorkingMs: number; // T3
  takingLongMs: number;   // T4
  giveUpMs: number;
  stateTimeoutMs: number; // AWAITING_* expiry
};

export const DEFAULT_TIMINGS: Timings = {
  pollMs: 5_000,
  stillWorkingMs: 90_000,
  takingLongMs: 5 * 60_000,
  giveUpMs: 15 * 60_000,
  stateTimeoutMs: 15 * 60_000,
};

export type BotDeps = {
  transport: Transport;
  engine: Engine;
  links: Links;
  tmpDir: string;
  timings?: Partial<Timings>;
  /** Human-paced pause before each reply, ms. Default 1000-3000 random (ban mitigation). */
  replyDelay?: () => number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Link to reach the IndSure team (T9). */
  teamLink: string;
  /** PDF inspector. Injectable for tests; defaults to the pdfjs one. */
  inspect?: (buf: Buffer) => Promise<Inspection>;
};

type FileRef = { path: string; sha: string; name: string; waMessageId: string; caption: string };

type State =
  | "IDLE" | "REPORT_READY" | "AWAITING_TYPE" | "AWAITING_DUP_CONFIRM" | "AWAITING_CUSTOMER"
  | "AWAITING_SHARE_LANG" | "AWAITING_CLIENT_PICK" | "AWAITING_REMIND_PICK"
  | "AWAITING_LEAD" | "AWAITING_CALC" | "AWAITING_COMPARE_PICK";

type Conv = { state: State; currentClientId: string | null; pending: any; updatedAt: string | null };

type QueueItem = { agentId: string; to: string; file: FileRef; type: PolicyType; jobRowId: string };

type Remindable = RenewalRow & { source: "lead" | "client" };

/** "Policy Kit_PROHLV050040281.pdf" as the caption of a file with that name, or any caption
 *  that is itself a file name. */
export function captionIsFileName(caption: string | null | undefined, fileName: string | null | undefined): boolean {
  const c = String(caption || "").trim().toLowerCase();
  if (!c) return false;
  if (/\.(pdf|docx?|jpe?g|png)$/.test(c)) return true;
  const f = String(fileName || "").trim().toLowerCase();
  return !!f && (c === f || c === f.replace(/\.[a-z0-9]+$/, ""));
}

const sha256 = (b: Buffer | string) => crypto.createHash("sha256").update(b).digest("hex");

export class Bot {
  private readonly t: Timings;
  private readonly queues = new Map<string, { running: boolean; items: QueueItem[] }>();
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly replyDelay: () => number;

  constructor(private readonly d: BotDeps) {
    this.t = { ...DEFAULT_TIMINGS, ...(d.timings || {}) };
    this.sleep = d.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = d.now ?? (() => Date.now());
    this.replyDelay = d.replyDelay ?? (() => 1000 + Math.floor(Math.random() * 2000));
  }

  /** True while any advisor's check queue has work. Used by tests and graceful shutdown. */
  busy(): boolean {
    for (const q of this.queues.values()) if (q.running || q.items.length) return true;
    return false;
  }

  /* ══ Sending ══════════════════════════════════════════════════════════ */

  /** The ONLY way the bot sends anything. `to` is always the advisor's own chat. */
  private async say(to: string, agentId: string | null, text: string, intent: string | null = null) {
    const tr = this.d.transport;
    try {
      await tr.sendTyping(to, true);
      await this.sleep(this.replyDelay());
      await tr.sendText(to, text);
      await tr.sendTyping(to, false);
    } catch (e: any) {
      log.error("send failed", { error: e?.message });
      return;
    }
    await this.d.engine
      .logMessage({ agentId, direction: "out", type: "text", bodyRedacted: redact(text).slice(0, 2000), intent })
      .catch(() => {});
  }

  /* ══ Entry point ══════════════════════════════════════════════════════ */

  async handle(msg: InboundMessage): Promise<void> {
    if (!msg.id) return;
    const e = this.d.engine;
    const who = msg.from ? await e.resolve(msg.from) : { agentId: null, servable: false };

    const type = msg.kind === "document" ? "document" : msg.kind === "text" ? "text" : "media";
    const { duplicate } = await e.logMessage({
      waMessageId: msg.id,
      agentId: who.agentId,
      direction: "in",
      type,
      bodyRedacted: redact(msg.text || "").slice(0, 500) || (msg.fileName ? `[file] ${redact(msg.fileName)}` : null),
    });
    if (duplicate) return; // re-delivery: already handled, no second reply
    await this.d.transport.markRead(msg);

    const code = msg.kind === "text" ? linkCode(msg.text) : null;
    if (code) return this.doLink(msg, code);

    if (!who.agentId || !who.servable) return this.unknownOnce(msg);

    const agentId = who.agentId;
    try {
      const conv = await this.loadConv(agentId, msg.replyTo);
      if (msg.kind === "document") return await this.pdfIn(agentId, conv, msg);
      if (msg.kind === "image") return await this.say(msg.replyTo, agentId, T.notPdf(), "not_pdf");
      if (msg.kind === "text") return await this.onText(agentId, conv, msg);
      return await this.say(msg.replyTo, agentId, T.help(), "help");
    } catch (err: any) {
      log.error("handle failed", { error: err?.message });
      await this.say(msg.replyTo, agentId, T.genericError(), "error");
    }
  }

  /** Unknown numbers get ONE pointer reply, then silence (protects the number). */
  private async unknownOnce(msg: InboundMessage) {
    const hash = sha256(msg.from || msg.replyTo);
    if (await this.d.engine.unknownSeen(hash)) return;
    await this.say(msg.replyTo, null, T.unknownNumber(), `unknown:${hash}`);
  }

  private async doLink(msg: InboundMessage, code: string) {
    if (!msg.from) return this.unknownOnce(msg);
    const r = await this.d.engine.link(msg.from, code);
    if (r.ok) {
      return this.say(msg.replyTo, r.agentId ?? null, r.servable ? T.welcome() : T.linkNotBeta(), "link");
    }
    const text =
      r.reason === "expired" ? T.linkExpired() : r.reason === "no_pending" ? T.linkWrongNumber() : T.linkBad();
    await this.say(msg.replyTo, null, text, "link_failed");
  }

  /* ══ Conversation state ═══════════════════════════════════════════════ */

  private async loadConv(agentId: string, to: string): Promise<Conv> {
    const c = (await this.d.engine.getConversation(agentId)) as Conv;
    const pending = c.pending && typeof c.pending === "object" ? c.pending : {};
    let conv: Conv = { state: (c.state as State) || "IDLE", currentClientId: c.currentClientId, pending, updatedAt: c.updatedAt };
    // Any AWAITING_* state lapses after 15 minutes. Defaults: nothing is sent, the customer
    // stays unassigned, a held file is dropped.
    if (conv.state.startsWith("AWAITING") && conv.updatedAt && this.now() - new Date(conv.updatedAt).getTime() > this.t.stateTimeoutMs) {
      await this.dropHeldFile(conv);
      conv = { state: conv.currentClientId ? "REPORT_READY" : "IDLE", currentClientId: conv.currentClientId, pending: {}, updatedAt: null };
    }
    if (conv.pending.to !== to) {
      conv.pending = { ...conv.pending, to };
      await this.saveConv(agentId, conv);
    }
    return conv;
  }

  private async saveConv(agentId: string, c: Conv) {
    await this.d.engine.putConversation(agentId, { state: c.state, currentClientId: c.currentClientId, pending: c.pending });
  }

  private async setState(agentId: string, to: string, state: State, currentClientId: string | null, extra: Record<string, unknown> = {}) {
    await this.saveConv(agentId, { state, currentClientId, pending: { to, ...extra }, updatedAt: null });
  }

  private async rest(agentId: string, to: string, currentClientId: string | null) {
    await this.setState(agentId, to, currentClientId ? "REPORT_READY" : "IDLE", currentClientId);
  }

  private async dropHeldFile(conv: Conv) {
    const p = conv.pending?.file?.path;
    if (p) await fs.rm(p, { force: true }).catch(() => {});
  }

  /* ══ PDF in (brief §7) ════════════════════════════════════════════════ */

  private async pdfIn(agentId: string, conv: Conv, msg: InboundMessage) {
    const to = msg.replyTo;
    if (msg.fileSize != null && msg.fileSize > MAX_BYTES) return this.say(to, agentId, T.tooLarge(), "too_large");
    const named = /\.pdf$/i.test(msg.fileName || "") || /pdf/i.test(msg.mimeType || "");
    if (!named) return this.say(to, agentId, T.notPdf(), "not_pdf");

    // A new PDF always starts a new flow, even mid-question.
    if (conv.state.startsWith("AWAITING")) {
      await this.dropHeldFile(conv);
      await this.rest(agentId, to, conv.currentClientId);
    }

    await this.say(to, agentId, T.received(), "analyze");

    const buf = await this.d.transport.downloadMedia(msg);
    if (!looksLikePdf(buf)) return this.say(to, agentId, T.notPdf(), "not_pdf");
    if (buf.length > MAX_BYTES) return this.say(to, agentId, T.tooLarge(), "too_large");

    const sha = sha256(buf);
    const insp = await (this.d.inspect ?? inspectPdf)(buf);
    if (insp.kind === "locked") return this.say(to, agentId, T.locked(), "locked");
    if (insp.kind === "unreadable") {
      return this.say(to, agentId, "I couldn't open this PDF. Please send the insurer's original PDF. No policy check was used.", "unreadable");
    }
    if (insp.hindi) return this.say(to, agentId, T.hindiPolicy(), "hindi");

    await fs.mkdir(this.d.tmpDir, { recursive: true });
    const file: FileRef = {
      path: path.join(this.d.tmpDir, `${agentId}-${sha.slice(0, 16)}-${msg.id.replace(/\W/g, "").slice(0, 20)}.pdf`),
      sha,
      name: (msg.fileName || "policy.pdf").slice(0, 120),
      waMessageId: msg.id,
      // A forwarded document often carries its own file name as the caption. That is not a
      // customer, so it is ignored rather than filed as the policyholder's name.
      caption: captionIsFileName(msg.text, msg.fileName) ? "" : msg.text || "",
    };
    await fs.writeFile(file.path, buf);

    const existing = await this.d.engine.jobByHash(agentId, sha);
    if (existing) {
      await this.setState(agentId, to, "AWAITING_DUP_CONFIRM", conv.currentClientId, { file, type: insp.guess, existing });
      return this.say(to, agentId, T.duplicate(portalPolicyUrl(this.d.links, existing)), "duplicate");
    }
    if (!insp.guess) {
      await this.setState(agentId, to, "AWAITING_TYPE", conv.currentClientId, { file });
      return this.say(to, agentId, T.pickType(), "pick_type");
    }
    await this.enqueue(agentId, to, file, insp.guess);
  }

  private async enqueue(agentId: string, to: string, file: FileRef, type: PolicyType) {
    if (type === "health") {
      const left = await this.d.engine.checksLeft(agentId);
      const q = this.queues.get(agentId);
      const ahead = (q?.items.filter((i) => i.type === "health").length ?? 0) + (q?.running ? 1 : 0);
      if (left - ahead <= 0) {
        await fs.rm(file.path, { force: true }).catch(() => {});
        return this.say(to, agentId, T.outOfChecks(this.d.teamLink), "no_checks");
      }
    }
    const jobRowId = await this.d.engine.createJob(agentId, { waMessageId: file.waMessageId, fileSha256: file.sha, insuranceType: type });
    const q = this.queues.get(agentId) ?? { running: false, items: [] };
    this.queues.set(agentId, q);
    const waiting = q.items.length + (q.running ? 1 : 0);
    q.items.push({ agentId, to, file, type, jobRowId });
    if (waiting > 0) await this.say(to, agentId, T.queued(waiting), "queued");
    void this.drain(agentId);
  }

  /** Runs one advisor's queue, one check at a time. */
  private async drain(agentId: string) {
    const q = this.queues.get(agentId);
    if (!q || q.running) return;
    q.running = true;
    try {
      while (q.items.length) {
        const item = q.items.shift()!;
        const stop = await this.runItem(item).catch(async (e: any) => {
          log.error("check failed", { error: e?.message });
          await this.d.engine.updateJob(agentId, item.jobRowId, { status: "failed", failureReason: String(e?.message || "error") }).catch(() => {});
          await this.say(item.to, agentId, T.genericError(), "error");
          return false;
        });
        if (stop) {
          // Out of checks: everything still waiting is NOT run, and the advisor is told.
          const left = q.items.splice(0);
          for (const i of left) {
            await fs.rm(i.file.path, { force: true }).catch(() => {});
            await this.d.engine.updateJob(agentId, i.jobRowId, { status: "skipped", failureReason: "no policy checks left" }).catch(() => {});
          }
          if (left.length) await this.say(item.to, agentId, T.queueStoppedNoChecks(left.length, this.d.teamLink), "no_checks");
        }
      }
    } finally {
      q.running = false;
    }
  }

  /** Returns true when the queue must stop (no checks left). */
  private async runItem(item: QueueItem): Promise<boolean> {
    const { agentId, to, file, type } = item;
    const e = this.d.engine;
    if (type === "health" && (await e.checksLeft(agentId)) <= 0) {
      await fs.rm(file.path, { force: true }).catch(() => {});
      await e.updateJob(agentId, item.jobRowId, { status: "skipped", failureReason: "no policy checks left" });
      await this.say(to, agentId, T.outOfChecks(this.d.teamLink), "no_checks");
      return true;
    }
    await e.updateJob(agentId, item.jobRowId, { status: "processing" });
    const caption = parseCaption(file.caption);
    let buf: Buffer;
    try {
      buf = await fs.readFile(file.path);
    } catch {
      await e.updateJob(agentId, item.jobRowId, { status: "failed", failureReason: "temp file missing" });
      await this.say(to, agentId, T.resendFile(), "resend");
      return false;
    }
    const res = await e.analyze(agentId, { buffer: buf, fileName: file.name, type, policyholderName: caption.name, clientPhone: caption.phone });
    await fs.rm(file.path, { force: true }).catch(() => {});

    if (!res.ok) {
      await e.updateJob(agentId, item.jobRowId, { status: "failed", failureReason: res.code });
      if (res.code === "NO_CREDITS") {
        await this.say(to, agentId, T.outOfChecks(this.d.teamLink), "no_checks");
        return true;
      }
      if (res.code === "NO_OCR_CREDITS") {
        await this.say(to, agentId, T.outOfDataEntry(this.d.teamLink), "no_data_entry");
        return false;
      }
      await this.say(to, agentId, T.genericError(), "error");
      return false;
    }
    await e.updateJob(agentId, item.jobRowId, { clientId: res.clientId, analysisJobId: res.jobId });
    await this.follow(agentId, to, item.jobRowId, res.jobId, res.clientId, this.now(), caption);
    return false;
  }

  /** Poll one engine job to the end and report back (brief §7 steps 11 to 14). */
  private async follow(
    agentId: string, to: string, jobRowId: string, jobId: string, clientId: string, startedAt: number,
    caption: { name: string | null; phone: string | null } = { name: null, phone: null },
  ) {
    const e = this.d.engine;
    let saidStill = this.now() - startedAt >= this.t.stillWorkingMs;
    let saidLong = this.now() - startedAt >= this.t.takingLongMs;
    for (;;) {
      await this.sleep(this.t.pollMs);
      const elapsed = this.now() - startedAt;
      let st;
      try {
        st = await e.jobStatus(agentId, jobId);
      } catch {
        st = null; // backend blip: keep waiting, the clock below still runs
      }
      if (st?.status === "completed") break;
      if (st?.status === "error" || st?.status === "not_found") {
        const c = await e.getClient(agentId, clientId).catch(() => null);
        const { reason, fix } = failureReasonFix(c?.errorMessage || (st.status === "error" ? st.error : ""));
        await e.updateJob(agentId, jobRowId, { status: "needs_attention", failureReason: c?.errorMessage || "error" });
        return this.say(to, agentId, T.couldNotRead(reason, fix), "failed");
      }
      if (!saidStill && elapsed >= this.t.stillWorkingMs) {
        saidStill = true;
        await this.say(to, agentId, T.stillWorking(), "still_working");
      }
      if (!saidLong && elapsed >= this.t.takingLongMs) {
        saidLong = true;
        await this.say(to, agentId, T.takingLong(portalPolicyUrl(this.d.links, clientId)), "taking_long");
      }
      if (elapsed >= this.t.giveUpMs) {
        await e.updateJob(agentId, jobRowId, { status: "failed", failureReason: "no result in time" });
        return this.say(to, agentId, T.gaveUp(portalPolicyUrl(this.d.links, clientId)), "gave_up");
      }
    }

    const c = await e.getClient(agentId, clientId);
    await e.updateJob(agentId, jobRowId, { status: "done" });
    if (!c) return this.say(to, agentId, T.gaveUp(portalPolicyUrl(this.d.links, clientId)), "gave_up");

    if (c.insuranceType === "health") await this.say(to, agentId, reportCard(c, this.d.links), "report");
    else await this.say(to, agentId, T.nonHealth((c.insuranceType as PolicyType) || "motor", c.policyholderName), "data_entry");

    // This report becomes the one follow-up questions and SHARE refer to. An AWAITING_*
    // state from another flow is left as it is; only the current report moves.
    const conv = await this.loadConv(agentId, to);
    const busy = conv.state.startsWith("AWAITING");
    conv.currentClientId = clientId;
    if (!busy) conv.state = "REPORT_READY";
    await this.saveConv(agentId, conv);

    await this.fileUnderCustomer(agentId, to, c, caption, busy);
  }

  /** Brief §7 step 8: file the policy under a customer from the caption, or ask. */
  private async fileUnderCustomer(agentId: string, to: string, c: ClientSummary, caption: { name: string | null; phone: string | null }, busy: boolean) {
    if (c.customerId) return;
    const moreQueued = (this.queues.get(agentId)?.items.length ?? 0) > 0;
    const q = caption.phone || caption.name;
    if (!q) {
      if (busy || moreQueued) return; // don't stack questions while other files are in line
      await this.setState(agentId, to, "AWAITING_CUSTOMER", c.clientId, { clientId: c.clientId });
      return this.say(to, agentId, T.whoseIsIt(), "whose");
    }
    const matches = await this.d.engine.searchCustomers(agentId, q);
    if (matches.length === 1) {
      if (await this.d.engine.attachCustomer(agentId, c.clientId, matches[0].id)) {
        return this.say(to, agentId, T.filedUnder(matches[0].name), "filed");
      }
      return;
    }
    if (matches.length > 1 && !busy && !moreQueued) {
      await this.setState(agentId, to, "AWAITING_CUSTOMER", c.clientId, { clientId: c.clientId, options: matches.map((m) => ({ id: m.id, name: m.name })) });
      return this.say(to, agentId, T.pickCustomer(matches.map((m) => m.name)), "pick_customer");
    }
    if (matches.length === 0 && caption.name) await this.say(to, agentId, T.noCustomerMatch(caption.name), "no_customer");
  }

  /** After a restart: pick up checks that were running. Files for checks that never
   *  started are gone (temp), so those advisors are asked to resend. */
  async resumeOpenJobs() {
    const jobs = await this.d.engine.openJobs().catch(() => []);
    for (const j of jobs) {
      const conv = await this.d.engine.getConversation(j.agent_id).catch(() => null);
      const to = conv?.pending?.to;
      if (!to) continue;
      if (j.analysis_job_id && j.client_id) {
        void this.follow(j.agent_id, to, j.id, j.analysis_job_id, j.client_id, new Date(j.queued_at).getTime())
          .catch((e) => log.error("resume failed", { error: e?.message }));
      } else {
        await this.d.engine.updateJob(j.agent_id, j.id, { status: "failed", failureReason: "bot restarted before the check started" });
        await this.say(to, j.agent_id, T.resendFile(), "resend");
      }
    }
  }

  /* ══ Text ═════════════════════════════════════════════════════════════ */

  private async onText(agentId: string, conv: Conv, msg: InboundMessage) {
    const to = msg.replyTo;
    const text = msg.text.trim();
    const intent = ruleIntent(text);

    if (intent === "cancel") {
      await this.dropHeldFile(conv);
      await this.rest(agentId, to, conv.currentClientId);
      return this.say(to, agentId, T.cancelled(), "cancel");
    }
    if (intent === "unlink") {
      await this.d.engine.unlink(agentId);
      return this.say(to, agentId, T.unlinked(), "unlink");
    }
    if (/^(ok|okay|thanks|thank you|thx|ty|great|done|👍|🙏)[.! ]*$/i.test(text)) {
      if (!conv.state.startsWith("AWAITING")) return this.say(to, agentId, "Happy to help.", "thanks");
    }

    // A pending question gets first go at the reply, unless it is a clear command.
    if (conv.state.startsWith("AWAITING") && !intent) {
      const handled = await this.onAwaiting(agentId, conv, to, text);
      if (handled) return;
    }
    if (intent && conv.state.startsWith("AWAITING")) {
      await this.dropHeldFile(conv);
      await this.rest(agentId, to, conv.currentClientId);
      conv = { ...conv, state: conv.currentClientId ? "REPORT_READY" : "IDLE", pending: { to } };
    }

    switch (intent) {
      case "help":
        return this.say(to, agentId, T.help(), "help");
      case "renewals":
        return this.say(to, agentId, renewalsReply(await this.d.engine.renewals(agentId), this.d.links), "renewals");
      case "remind":
        return this.remind(agentId, to, namedPerson(text), langIn(text) ?? "english");
      case "share":
        return this.shareStart(agentId, conv, to, text);
      case "website":
        return this.say(to, agentId, websiteReply(await this.d.engine.profile(agentId), this.d.links), "website");
      case "lead":
        return this.leadStart(agentId, conv, to, text);
      case "calc":
        await this.setState(agentId, to, "AWAITING_CALC", conv.currentClientId, { step: -1, inputs: {} });
        return this.say(to, agentId, CALC_AGE_ASK, "calc");
      case "compare":
        return this.compareStart(agentId, conv, to, text);
    }

    // No rule matched: a question about the current report, or a named one.
    if (conv.currentClientId || namedPerson(text)) return this.ask(agentId, conv, to, text);

    const guess = await this.d.engine.llmIntent(agentId, text, false).catch(() => "unknown");
    if (guess === "renewals") return this.say(to, agentId, renewalsReply(await this.d.engine.renewals(agentId), this.d.links), "renewals");
    if (guess === "share" || guess === "ask") return this.say(to, agentId, T.noReport(), guess);
    return this.say(to, agentId, T.help(), "unknown");
  }

  /** Returns true when the reply was consumed by the pending question. */
  private async onAwaiting(agentId: string, conv: Conv, to: string, text: string): Promise<boolean> {
    const p = conv.pending || {};
    switch (conv.state) {
      case "AWAITING_TYPE": {
        const n = pickNumber(text, POLICY_TYPES.length);
        if (!n) { await this.say(to, agentId, T.pickType(), "pick_type"); return true; }
        await this.rest(agentId, to, conv.currentClientId);
        await this.enqueue(agentId, to, p.file, POLICY_TYPES[n - 1]);
        return true;
      }
      case "AWAITING_DUP_CONFIRM": {
        if (isYes(text)) {
          await this.rest(agentId, to, conv.currentClientId);
          if (p.type) await this.enqueue(agentId, to, p.file, p.type);
          else {
            await this.setState(agentId, to, "AWAITING_TYPE", conv.currentClientId, { file: p.file });
            await this.say(to, agentId, T.pickType(), "pick_type");
          }
          return true;
        }
        if (isNo(text)) {
          await this.dropHeldFile(conv);
          await this.rest(agentId, to, p.existing);
          await this.say(to, agentId, T.dupNo(), "dup_no");
          return true;
        }
        await this.say(to, agentId, "Reply YES to run a fresh check (it uses 1 policy check), or NO to keep the existing report.", "dup_ask");
        return true;
      }
      case "AWAITING_CUSTOMER": {
        const clientId: string = p.clientId;
        if (isSkip(text)) {
          await this.rest(agentId, to, clientId);
          await this.say(to, agentId, T.leftUnassigned(), "skip");
          return true;
        }
        const options: { id: string; name: string }[] = p.options || [];
        const n = options.length ? pickNumber(text, options.length) : null;
        if (n) {
          const ok = await this.d.engine.attachCustomer(agentId, clientId, options[n - 1].id);
          await this.rest(agentId, to, clientId);
          await this.say(to, agentId, ok ? T.filedUnder(options[n - 1].name) : T.genericError(), "filed");
          return true;
        }
        const cap = parseCaption(text);
        const q = cap.phone || cap.name;
        if (!q) return false;
        const matches = await this.d.engine.searchCustomers(agentId, q);
        if (matches.length === 1) {
          const ok = await this.d.engine.attachCustomer(agentId, clientId, matches[0].id);
          await this.rest(agentId, to, clientId);
          await this.say(to, agentId, ok ? T.filedUnder(matches[0].name) : T.genericError(), "filed");
        } else if (matches.length > 1) {
          await this.setState(agentId, to, "AWAITING_CUSTOMER", clientId, { clientId, options: matches.map((m) => ({ id: m.id, name: m.name })) });
          await this.say(to, agentId, T.pickCustomer(matches.map((m) => m.name)), "pick_customer");
        } else {
          await this.rest(agentId, to, clientId);
          await this.say(to, agentId, T.noCustomerMatch(q), "no_customer");
        }
        return true;
      }
      case "AWAITING_SHARE_LANG": {
        const n = pickNumber(text, 3);
        const lang = n ? LANGS[n - 1] : langIn(text);
        if (!lang) { await this.say(to, agentId, T.pickLang(), "pick_lang"); return true; }
        await this.rest(agentId, to, p.clientId);
        await this.doShare(agentId, to, p.clientId, lang, p.phone ?? null);
        return true;
      }
      case "AWAITING_CLIENT_PICK": {
        const ids: string[] = p.options || [];
        const n = pickNumber(text, ids.length);
        if (!n) return false;
        const clientId = ids[n - 1];
        await this.rest(agentId, to, clientId);
        if (p.purpose === "share") {
          if (p.lang) await this.doShare(agentId, to, clientId, p.lang, p.phone ?? null);
          else {
            await this.setState(agentId, to, "AWAITING_SHARE_LANG", clientId, { clientId, phone: p.phone ?? null });
            await this.say(to, agentId, T.pickLang(), "pick_lang");
          }
        } else {
          await this.answerFor(agentId, to, clientId, p.question || "");
        }
        return true;
      }
      case "AWAITING_LEAD":
        return this.leadStep(agentId, conv, to, text);
      case "AWAITING_CALC":
        return this.calcStep(agentId, conv, to, text);
      case "AWAITING_COMPARE_PICK": {
        const q = (p.queue || [])[0];
        const n = q ? pickNumber(text, q.options.length) : null;
        if (!n) return false;
        const resolved: string[] = [...(p.resolved || []), q.options[n - 1].key];
        await this.compareContinue(agentId, conv, to, resolved, (p.queue || []).slice(1));
        return true;
      }
      case "AWAITING_REMIND_PICK": {
        const rows: Remindable[] = p.rows || [];
        const n = pickNumber(text, rows.length);
        if (!n) return false;
        await this.rest(agentId, to, conv.currentClientId);
        await this.sendReminder(agentId, to, rows[n - 1], p.lang || "english");
        return true;
      }
    }
    return false;
  }

  /* ══ Ask (brief §6.2) ═════════════════════════════════════════════════ */

  private async ask(agentId: string, conv: Conv, to: string, question: string) {
    const name = namedPerson(question);
    if (name) {
      const found = await this.d.engine.findClients(agentId, name);
      if (found.length === 0) return this.say(to, agentId, T.noSuchCustomer(name), "ask");
      if (found.length > 1) return this.pickClient(agentId, to, conv.currentClientId, found, { purpose: "ask", question });
      await this.rest(agentId, to, found[0].clientId);
      return this.answerFor(agentId, to, found[0].clientId, question);
    }
    if (!conv.currentClientId) return this.say(to, agentId, T.noReport(), "ask");
    return this.answerFor(agentId, to, conv.currentClientId, question);
  }

  private async answerFor(agentId: string, to: string, clientId: string, question: string) {
    const c = await this.d.engine.getClient(agentId, clientId);
    const url = portalPolicyUrl(this.d.links, clientId);
    if (!c) return this.say(to, agentId, T.noReport(), "ask");
    if (c.status !== "done") return this.say(to, agentId, T.stillChecking(), "ask");
    if (!c.report) {
      // Data-entry policies have no audit to answer from.
      return this.say(to, agentId, `This is a ${c.insuranceType || "non-health"} policy, so there's no report to answer from. Its details are in the portal: ${url}`, "ask");
    }
    const ruled = question ? ruleAnswer(question, c) : null;
    if (ruled) return this.say(to, agentId, `${ruled}\n\nFull report: ${url}`, "ask");
    const phrased = await this.d.engine.llmPhrase(agentId, clientId, question).catch(() => ({ answer: null }));
    if (phrased.answer) return this.say(to, agentId, `${phrased.answer}\n\nFull report: ${url}`, "ask_phrased");
    return this.say(to, agentId, T.notInReport(url), (phrased as any).guardFired ? "ask_guard_fired" : "ask_not_in_report");
  }

  private async pickClient(agentId: string, to: string, current: string | null, found: ClientSummary[], extra: Record<string, unknown>) {
    const rows = found.slice(0, 5);
    await this.setState(agentId, to, "AWAITING_CLIENT_PICK", current, { ...extra, options: rows.map((r) => r.clientId) });
    return this.say(
      to, agentId,
      T.whichPolicy(rows.map((r) => ({ name: r.policyholderName || "Unnamed", label: [r.insurer, r.policyName].filter(Boolean).join(" ") || r.insuranceType || "policy" }))),
      "pick_client",
    );
  }

  /* ══ Share (brief §6.3) ═══════════════════════════════════════════════ */

  private async shareStart(agentId: string, conv: Conv, to: string, text: string) {
    const lang = langIn(text);
    // "share to 98123 45678": a number typed with SHARE is used for this link.
    const phone = parseCaption(text).phone;
    const name = phone ? null : namedPerson(text);
    let clientId = conv.currentClientId;
    if (name) {
      const found = await this.d.engine.findClients(agentId, name);
      if (found.length === 0) return this.say(to, agentId, T.noSuchCustomer(name), "share");
      if (found.length > 1) return this.pickClient(agentId, to, conv.currentClientId, found, { purpose: "share", lang, phone });
      clientId = found[0].clientId;
    }
    if (!clientId) return this.say(to, agentId, T.noReport(), "share");
    if (lang) {
      await this.rest(agentId, to, clientId);
      return this.doShare(agentId, to, clientId, lang, phone);
    }
    await this.setState(agentId, to, "AWAITING_SHARE_LANG", clientId, { clientId, phone });
    return this.say(to, agentId, T.pickLang(), "pick_lang");
  }

  /** `phone`: a number the advisor typed with SHARE. It wins over the one on file, and is
   *  used only for this link; nothing is saved to the customer. */
  private async doShare(agentId: string, to: string, clientId: string, lang: Lang, phone: string | null = null) {
    const c = await this.d.engine.getClient(agentId, clientId);
    if (!c) return this.say(to, agentId, T.noReport(), "share");
    if (c.status !== "done") return this.say(to, agentId, T.stillChecking(), "share");
    const token = await this.d.engine.share(agentId, clientId);
    if (!token) return this.say(to, agentId, T.genericError(), "share");
    const draft = shareDraft(lang, c.policyholderName, c.policyName || c.insurer, sharedReportUrl(this.d.links, token));
    const link = waMeLink(phone || c.customerPhone, draft);
    return this.say(to, agentId, shareReply(c.policyholderName, draft, link, /wa\.me\/\d/.test(link)), "share");
  }

  /* ══ Renewal reminders (brief §6.4) ═══════════════════════════════════ */

  private async remind(agentId: string, to: string, name: string | null, lang: Lang) {
    if (!name) return this.say(to, agentId, "Who should I remind? For example: REMIND Ramesh", "remind");
    const data = await this.d.engine.renewals(agentId);
    const all: Remindable[] = [
      ...data.leads.map((r) => ({ ...r, source: "lead" as const })),
      ...data.customers.map((r) => ({ ...r, source: "client" as const })),
    ];
    const hits = all.filter((r) => (r.name || "").toLowerCase().includes(name.toLowerCase()));
    if (hits.length === 0) return this.say(to, agentId, `I couldn't find "${name}" in your renewals list. Type RENEWALS to see who's due.`, "remind");
    if (hits.length > 1) {
      const rows = hits.slice(0, 6);
      const cur = (await this.d.engine.getConversation(agentId)).currentClientId;
      await this.setState(agentId, to, "AWAITING_REMIND_PICK", cur, { rows, lang });
      return this.say(to, agentId, `Which one?\n${rows.map((r, i) => `${i + 1}) ${r.name}, ${r.insurer || r.insurance_type || "policy"}, due ${r.due_date.slice(0, 10)}`).join("\n")}`, "remind_pick");
    }
    return this.sendReminder(agentId, to, hits[0], lang);
  }

  private async sendReminder(agentId: string, to: string, r: Remindable, lang: Lang) {
    // The portal's own "Renewal reminder" template (DraftMessageDialog), unchanged.
    const draft = buildMessage(
      { type: r.source, id: r.id, name: r.name, phone: r.phone, insurer: r.insurer, renewalDate: r.due_date },
      "renewal",
      lang,
      null,
    );
    const link = waMeLink(r.phone, draft);
    return this.say(to, agentId, shareReply(r.name, draft, link, /wa\.me\/\d/.test(link), false), "remind");
  }

  /* ══ Leads (phase 1b) ═════════════════════════════════════════════════ */

  private async leadStart(agentId: string, conv: Conv, to: string, text: string) {
    const d = parseLeadLine(text);
    if (d.name && d.phone && d.interest) return this.leadSave(agentId, to, { name: d.name, phone: d.phone, interest: d.interest });
    const step = !d.name ? "name" : !d.phone ? "phone" : "interest";
    await this.setState(agentId, to, "AWAITING_LEAD", conv.currentClientId, { step, draft: d });
    return this.say(to, agentId, LEAD_ASK[step], "lead");
  }

  private async leadStep(agentId: string, conv: Conv, to: string, text: string): Promise<boolean> {
    const p = conv.pending || {};
    const d = { name: null, phone: null, interest: null, ...(p.draft || {}) } as { name: string | null; phone: string | null; interest: string | null };
    if (p.step === "name") {
      const got = parseLeadLine(text);
      if (!got.name) { await this.say(to, agentId, LEAD_ASK.name, "lead"); return true; }
      d.name = got.name; d.phone = d.phone || got.phone; d.interest = d.interest || got.interest;
    } else if (p.step === "phone") {
      if (!isSkip(text)) {
        const ph = parseCaption(text).phone;
        if (!ph) { await this.say(to, agentId, "That doesn't look like a 10-digit mobile number. Send it again, or SKIP.", "lead"); return true; }
        d.phone = ph;
      }
      d.interest = d.interest || interestIn(text);
    } else {
      if (!isSkip(text)) {
        const n = pickNumber(text, INTERESTS.length);
        const i = n ? INTERESTS[n - 1] : interestIn(text);
        if (!i) { await this.say(to, agentId, LEAD_ASK.interest, "lead"); return true; }
        d.interest = i;
      }
      await this.rest(agentId, to, conv.currentClientId);
      await this.leadSave(agentId, to, { name: d.name!, phone: d.phone, interest: d.interest });
      return true;
    }
    const next = !d.phone && p.step !== "phone" ? "phone" : !d.interest ? "interest" : null;
    if (!next) {
      await this.rest(agentId, to, conv.currentClientId);
      await this.leadSave(agentId, to, { name: d.name!, phone: d.phone, interest: d.interest });
      return true;
    }
    await this.setState(agentId, to, "AWAITING_LEAD", conv.currentClientId, { step: next, draft: d });
    await this.say(to, agentId, LEAD_ASK[next], "lead");
    return true;
  }

  private async leadSave(agentId: string, to: string, d: { name: string; phone: string | null; interest: string | null }) {
    const r = await this.d.engine.createLead(agentId, d);
    return this.say(to, agentId, leadSavedReply(this.d.links, r, d), "lead_saved");
  }

  /* ══ Cover calculator (phase 1b) ══════════════════════════════════════ */

  private async calcStep(agentId: string, conv: Conv, to: string, text: string): Promise<boolean> {
    const p = conv.pending || {};
    const step: number = typeof p.step === "number" ? p.step : -1;
    const inputs: Partial<UserInputs> = { ...(p.inputs || {}) };
    if (step === -1) {
      const age = parseAge(text);
      if (!age) { await this.say(to, agentId, "Please reply with the age as a number, for example 42.", "calc"); return true; }
      inputs.exactAge = age;
      inputs.ageBand = ageBandFor(age);
    } else {
      const q = CALC_QUESTIONS[step];
      const n = pickNumber(text, q.options.length);
      if (!n) { await this.say(to, agentId, calcQuestionText(step), "calc"); return true; }
      (inputs as any)[q.key] = q.options[n - 1].value;
    }
    const next = step + 1;
    if (next < CALC_QUESTIONS.length) {
      await this.setState(agentId, to, "AWAITING_CALC", conv.currentClientId, { step: next, inputs });
      await this.say(to, agentId, calcQuestionText(next), "calc");
      return true;
    }
    await this.rest(agentId, to, conv.currentClientId);
    const profile = await this.d.engine.profile(agentId);
    const result = runCalculator(inputs as UserInputs, profile.partneredCompanies);
    const uuid = await this.d.engine.saveCalculator(agentId, inputs, result);
    await this.say(to, agentId, calcReply(this.d.links, inputs as UserInputs, result, uuid), "calc_done");
    return true;
  }

  /* ══ Compare (phase 1b, catalogue only: no model cost) ════════════════ */

  private async compareStart(agentId: string, conv: Conv, to: string, text: string) {
    const names = parseCompareNames(text);
    if (names.length < 2) return this.say(to, agentId, COMPARE_ASK, "compare");
    const catalog = await this.d.engine.catalog(agentId);
    const resolved: string[] = [];
    const queue: { q: string; options: { key: string; label: string }[] }[] = [];
    for (const name of names) {
      const hits = matchPlans(name, catalog);
      if (hits.length === 0) {
        return this.say(to, agentId, `I couldn't find "${name}" in the plan catalogue. Try the insurer and plan name, for example: Care Supreme, Niva ReAssure 2.0.`, "compare");
      }
      if (hits.length > 8) {
        return this.say(to, agentId, `"${name}" matches ${hits.length} plans. Add the insurer or the exact plan name.`, "compare");
      }
      if (hits.length === 1) resolved.push(hits[0].plan_key);
      else queue.push({ q: name, options: hits.map((h) => ({ key: h.plan_key, label: planLabel(h) })) });
    }
    return this.compareContinue(agentId, conv, to, resolved, queue);
  }

  private async compareContinue(agentId: string, conv: Conv, to: string, resolved: string[], queue: { q: string; options: { key: string; label: string }[] }[]) {
    if (queue.length) {
      const q = queue[0];
      await this.setState(agentId, to, "AWAITING_COMPARE_PICK", conv.currentClientId, { resolved, queue });
      return this.say(to, agentId, `Which "${q.q}"?\n${q.options.map((o, i) => `${i + 1}) ${o.label}`).join("\n")}`, "compare_pick");
    }
    await this.rest(agentId, to, conv.currentClientId);
    const keys = [...new Set(resolved)];
    if (keys.length < 2) return this.say(to, agentId, "Those are the same plan. Pick two different plans to compare.", "compare");
    const r = await this.d.engine.compare(agentId, keys);
    return this.say(to, agentId, compareReply(this.d.links, r), "compare_done");
  }
}
