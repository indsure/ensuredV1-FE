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
import type { Engine, ClaimEditRow, ClientSummary, PolicyFields, RenewalRow } from "../engine.js";
import type { InboundMessage, Transport } from "../transport/types.js";
import { MIN_TEXT, inspectPdf, looksLikePdf, POLICY_TYPES, sameInsured, type Inspection, type PolicyType } from "./pdfInspect.js";
import {
  bookAsk, isAlone, isNo, isReportQuestion, isSkip, isYes, langIn, linkCode, namedPerson, parseCaption, parsePair, pickNumber, portfolioName, ruleIntent, statusName,
} from "./intents.js";
import { parseClaimAsk, claimKeyOf, type ClaimAsk } from "./claimParse.js";
import { CUSTOMER_FIELDS, FIELD_LABEL, LEAD_FIELDS, amountWords, anyDate, clientKeyOf, fieldOf, parseAddCustomer, parseConvert, parseEditAsk, parseFile, parsePolicyFix, parseUnshare, policyValueFor, valueFor, type Field, type FileAsk } from "./editParse.js";
import { CLAIM_FIELDS, CLAIM_LABELS, CLAIM_TERMINAL, cleanClaimSet, cleanClientSet, cleanCustomerSet, cleanFixValue, cleanLeadSet, norm as normValue, policyFieldOf, type FixKind } from "../shared/editRules.js";
import { bookReply, claimDetailLines, insightsReply, pageStatsReply, portfolioReply, queueReply, statusReply, valuesReply } from "./bookReplies.js";
import { SWITCH_TOPIC, isPronounName, oneLetterMissing, nameCandidates, rephrase, suggest, suggestReply, withPerson, type Suggestion } from "./converse.js";
import { basics, ruleAnswer } from "./answers.js";
import {
  MENU, T, failureReasonFix, portalPolicyUrl, renewalsReply, reportCard, shareDraft, shareReply,
  sharedReportUrl, waMeLink, type Lang, type Links,
} from "./templates.js";
import { buildMessage } from "../shared/draftMessage.js";
import type { UserInputs } from "../shared/health-engine-logic.js";
import {
  CALC_AGE_ASK, CALC_QUESTIONS, COMPARE_ASK, INTERESTS, LEAD_ASK, ageBandFor, calcQuestionText, calcReply,
  compareReply, interestIn, leadSavedReply, matchPlans, parseAge, parseCompareNames, parseLeadLine, planLabel, suggestPlans,
  companyOptions, planOptions, matchCompany,
  runCalculator, websiteReply, clientsReply, typeIn, pickCalcOption, cityAnswer, CALC_CITY_ASK, CALC_CITY_AGAIN,
  TIER_LABEL, toolShareDraft, type Shareable,
} from "./tools.js";
import { log, redact } from "../log.js";
import { b, dayMonth, planLabel as nicePlan, prettyEngine } from "./format.js";
import {
  CLIENT_ONLY, VALUE_TYPES, claimsReply, detailsReply, followupsReply, leadUpdatedReply, lookupReply,
  nameMatches, parseDraft, parseLeadUpdate, parseBulkFollowUp, parseBulkUpdate, valueReply, viewsReply, leadsListReply, prettyDate, type LeadRow, type LeadUpdate,
} from "./crm.js";
import type { DraftKind } from "../shared/draftMessage.js";
import {
  answer as calcAnswer, applyChange as calcChange, calcShareText, nextStep as calcNext, prefillFromCustomer,
  prefillFromText, question as calcQuestion, resultReply as calcResultReply, run as calcRun, structureLine,
  type CalcState,
} from "./calcflow.js";
import type { Action, Context as ModelContext, Understanding } from "./understand.js";
import { MORNING, inMorningWindow, istClock, morningBrief, sincePreviousWorkday } from "./morning.js";
import type { CatalogPlan, SachStatus } from "../engine.js";
import { LANG_SET, detectLang, devanagariToLatin, hasDevanagari, langCommand, localise, type ReplyLang } from "./i18n.js";
import { outsideCustomer, polish, stripMarkers } from "./style.js";

export const MAX_BYTES = 25 * 1024 * 1024;
/** How long free-text questions keep going to the last report without naming a topic. */
const REPORT_FRESH_MS = 30 * 60_000;
const LANGS: Lang[] = ["english", "hinglish", "hindi"];
/** The name the advisor sees once they save our contact card. */
const CONTACT_NAME = "IndSure AI Assistant";

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

/** A health PDF waiting on the super top-up question. `existing`: this exact file was
 *  checked before (that report's id). `person`: a caption name or a name read off the PDF. */
type Held = { file: FileRef; topUp: boolean; names: string[]; scanned: boolean; existing: string | null; person: string | null; label: string };

type State =
  | "IDLE" | "REPORT_READY" | "AWAITING_TYPE" | "AWAITING_DUP_CONFIRM" | "AWAITING_CUSTOMER" | "AWAITING_TOPUP"
  | "AWAITING_SHARE_LANG" | "AWAITING_CLIENT_PICK" | "AWAITING_REMIND_PICK"
  | "AWAITING_LEAD" | "AWAITING_CALC" | "AWAITING_COMPARE_PICK" | "AWAITING_LEAD_PICK" | "AWAITING_CONFIRM"
  | "SUGGESTED"
  // Stage 2a: which one / which field / the new value / which policy or customer
  | "AWAITING_EDIT_PICK" | "AWAITING_EDIT_FIELD" | "AWAITING_EDIT_VALUE" | "AWAITING_FILE_PICK";

/** Someone the advisor can edit: a lead or a customer. */
type EditTarget = { kind: "lead" | "customer"; id: string; name: string; label: string };
/** Stage 2b: a policy being edited, and one field of it. "client" = the row's client details. */
type PolicyTarget = { clientId: string; policy: string };
type PField = { group: "fix" | "client"; key: string; label: string; kind: FixKind | "client" };

/** A change waiting for the advisor's YES. Nothing is written until then. */
type Op =
  | { kind: "create"; name: string; phone: string | null; interest: string | null; status: string | null; nextFollowUp: string | null; note: string | null; notFound?: boolean }
  | { kind: "update"; leadId: string; name: string; phone: string | null; status: string | null; nextFollowUp: string | null; note: string | null }
  | { kind: "undo"; change: LastChange }
  /* Stage 2a */
  | { kind: "edit"; target: "lead" | "customer"; id: string; name: string; field: Field; from: unknown; to: unknown }
  | { kind: "convert"; leadId: string; name: string }
  | { kind: "addCustomer"; name: string; phone: string | null; city: string | null; email: string | null }
  | { kind: "file"; clientId: string; policy: string; fromId: string | null; fromName: string | null; toId: string | null; toName: string | null; newCustomer?: { name: string; phone: string | null } }
  /* Stage 2b */
  | { kind: "policyEdit"; clientId: string; policy: string; group: PField["group"]; key: string; label: string; vkind: PField["kind"]; from: unknown; to: unknown; rev: number }
  | { kind: "sharing"; clientId: string; policy: string; enabled: boolean }
  /* Stage 2c */
  | { kind: "claimOpen"; customerId: string; name: string; claimType: "cashless" | "reimbursement" }
  | { kind: "claimEdit"; claimId: string; name: string; key: string; from: unknown; to: unknown }
  | { kind: "claimStage"; claimId: string; name: string; from: string; to: string }
  | { kind: "claimQuery"; claimId: string; name: string; question: string; from: string }
  | { kind: "claimAnswered"; claimId: string; name: string; seq: number; question: string }
  | { kind: "claimExtend"; claimId: string; name: string };

type LeadBits = { status: string | null; next_follow_up: string | null; notes: string | null };
/** What the last saved change was, so UNDO can put things back (15 minutes). */
type LastChange =
  | { kind: "create"; leadId: string; name: string; created?: Record<string, unknown>; at: number }
  | { kind: "update"; leadId: string; name: string; before: LeadBits; after?: LeadBits; at: number }
  | { kind: "bulk"; items: LastChange[]; name: string; at: number }
  /* Stage 2a: every one is undone through a route that first checks nothing moved since */
  | { kind: "edit"; target: "lead" | "customer"; id: string; name: string; field: Field; from: unknown; to: unknown; token?: string; at: number }
  | { kind: "convert"; leadId: string; customerId: string; name: string; status: string; at: number }
  | { kind: "customerCreate"; customerId: string; name: string; created: Record<string, unknown>; at: number }
  | { kind: "file"; clientId: string; name: string; fromId: string | null; toId: string | null; at: number }
  /* Stage 2b: from/to are the server's own values, so the undo token matches */
  | { kind: "policyEdit"; clientId: string; name: string; group: PField["group"]; key: string; label: string; vkind: PField["kind"]; from: unknown; to: unknown; token?: string; rev?: number; at: number }
  | { kind: "sharing"; clientId: string; name: string; enabled: boolean; at: number }
  /* Stage 2c. A logged query and an extension have no undo (plan 5). */
  | { kind: "claimCreate"; claimId: string; name: string; created: Record<string, unknown>; at: number }
  | { kind: "claimEdit"; claimId: string; name: string; key: string; from: unknown; to: unknown; token?: string; at: number }
  | { kind: "claimStage"; claimId: string; name: string; from: string; to: string; token?: string; at: number }
  | { kind: "claimAnswered"; claimId: string; name: string; seq: number; resolvedOn: string; moved: boolean; token?: string; at: number };

const UNDO_WINDOW_MS = 15 * 60_000;
/** Short, unambiguous read-only commands go straight to the rules (no model call). */
/** A hello on its own: answered by name, with what is waiting today. */
const GREETING = /^(?:hi+|hello+|hey+|helo|namaste|namaskar|namaskaar|ram ram|jai shri krishna|good (?:morning|afternoon|evening)|gm)(?:\s+(?:ji|sir|madam|bhai|there|team))?[.!🙏 ]*$|^(?:नमस्ते|नमस्कार|राम राम)(?:\s+जी)?[.!।🙏 ]*$/iu;

/** Read-only views whose rules match a whole question, at any length. The model's form has
 *  no action for them, so sending these to it (paid plans) would lose the answer. */
const ALWAYS_RULE = new Set(["queue", "status", "book", "portfolio", "values", "insights", "pagestats", "edit", "convert", "addcustomer", "file", "policyfix", "unshare", "claimedit"]);

const FAST_RULE = new Set(["help", "howcheck", "howfind", "leadlist", "queue", "status", "book", "portfolio", "values", "insights", "pagestats", "more", "website", "renewals", "followups", "checks", "views", "claims", "clients", "calc", "compare", "share", "remind", "lookup", "draft", "surrender", "balance", "today", "morning_off", "morning_on"]);

type Conv = { state: State; currentClientId: string | null; pending: any; updatedAt: string | null };

/** `companion`: the same insured's super top-up, read in the same check (1 policy check). */
type QueueItem = { agentId: string; to: string; file: FileRef; type: PolicyType; jobRowId: string; companion?: FileRef | null };

type Remindable = RenewalRow & { source: "lead" | "client" };

/** A compare question: pick one of several matches, a name not in the catalogue (with the
 *  closest plans), a name matching too many, or "which other plan?". */
type CompareQ = { q: string; kind: "pick" | "missing" | "many" | "ask" | "company" | "plan"; options: { key: string; label: string }[] };

/** "Policy Kit_PROHLV050040281.pdf" as the caption of a file with that name, or any caption
 *  that is itself a file name. */
export function captionIsFileName(caption: string | null | undefined, fileName: string | null | undefined): boolean {
  const c = String(caption || "").trim().toLowerCase();
  if (!c) return false;
  if (/\.(pdf|docx?|jpe?g|png)$/.test(c)) return true;
  const f = String(fileName || "").trim().toLowerCase();
  return !!f && (c === f || c === f.replace(/\.[a-z0-9]+$/, ""));
}

/** Words that point at the person the chat was last about. */
const PRONOUN = /\b(he|she|him|her|his|hers|them|they|their|uska|uski|uske|unka|unki|unke|usko|unko|use|unhe|isko|iska|iski|inka)\b|उसका|उसकी|उसके|उनका|उनकी|उनके|उसको|उनको|उसे|उन्हें/i;

/** Is any word of `name` (3+ letters) actually in the message, in English or Hindi letters? */
function nameInMessage(name: string, text: string): boolean {
  const msg = (hasDevanagari(text) ? `${text} ${devanagariToLatin(text)}` : text).toLowerCase();
  return name.toLowerCase().split(/\s+/).filter((w) => w.length >= 3).some((w) => new RegExp(`(^|[^a-z])${w.replace(/[^a-z]/g, "")}`).test(msg) || msg.includes(w));
}

const normName = (s: string | null | undefined) => String(s ?? "").toLowerCase().replace(/[^a-z\u0900-\u097F ]/g, " ").replace(/\s+/g, " ").trim();

const sha256 = (b: Buffer | string) => crypto.createHash("sha256").update(b).digest("hex");

export class Bot {
  private readonly t: Timings;
  private readonly queues = new Map<string, { running: boolean; items: QueueItem[] }>();
  /** One advisor's messages are handled one at a time. WhatsApp hands over PDFs sent
   *  together at the same moment, and the conversation row is last-write-wins, so without
   *  this a base policy and its super top-up would race each other's state. */
  private readonly locks = new Map<string, Promise<void>>();
  /** A super top-up question that lapsed unanswered, told once on the next message. */
  private readonly lapsed = new Map<string, string>();
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly replyDelay: () => number;

  private readonly d: BotDeps;
  /** Sach Assistant notices, each said once: free-plan pointer (per day), limit reached (per month). */
  private readonly sachNudged = new Map<string, string>();
  private readonly limitTold = new Map<string, string>();
  private morningDoneDay: string | null = null;
  private morningRunning = false;

  constructor(deps: BotDeps) {
    // Every name the bot shows passes through prettyEngine: short insurer names, no
    // ALL-CAPS customers. Display only; nothing stored changes.
    const d = { ...deps, engine: prettyEngine(deps.engine) };
    this.d = d;
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

  private async withLock<R>(agentId: string, fn: () => Promise<R>): Promise<R> {
    const prev = this.locks.get(agentId) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((r) => (release = r));
    const tail = prev.then(() => mine);
    this.locks.set(agentId, tail);
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.locks.get(agentId) === tail) this.locks.delete(agentId);
    }
  }

  /* ══ Sending ══════════════════════════════════════════════════════════ */

  /** The ONLY way the bot sends anything. `to` is always the advisor's own chat. */
  private async say(to: string, agentId: string | null, textEn: string, intent: string | null = null) {
    const tr = this.d.transport;
    // Written in English; shown in the advisor's language (fixed wording only, see i18n.ts),
    // then in the house style (style.ts). A customer's message inside is left exactly as is.
    const lang = agentId ? this.replyLang.get(agentId) : null;
    const text = stripMarkers(polish(outsideCustomer(textEn, (t) => localise(t, lang)), intent));
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
    return this.withLock(agentId, async () => {
      try {
        const conv = await this.loadConv(agentId, msg.replyTo);
        const lapsed = this.lapsed.get(agentId) ?? conv.pending?.lapsed;
        if (lapsed) {
          this.lapsed.delete(agentId);
          const { lapsed: _gone, ...rest } = conv.pending || {};
          conv.pending = rest;
          await this.saveConv(agentId, conv);
          await this.say(msg.replyTo, agentId, T.lapsed(lapsed), "topup_lapsed");
        }
        if (msg.kind === "document") return await this.pdfIn(agentId, conv, msg);
        if (msg.kind === "image") return await this.say(msg.replyTo, agentId, T.notPdf(), "not_pdf");
        if (msg.kind === "text") return await this.onText(agentId, conv, msg);
        return await this.menu(agentId, msg.replyTo, null, "help");
      } catch (err: any) {
        log.error("handle failed", { error: err?.message });
        await this.say(msg.replyTo, agentId, T.genericError(), "error");
      }
    });
  }

  /** After LINK: our own number as a contact card, so the advisor saves it in one tap and
   *  the chat shows a name. Best effort: a failure here never undoes the link. */
  private async sendContactCard(to: string, agentId: string | null) {
    const tr = this.d.transport;
    if (!tr.sendContact) return;
    await this.say(to, agentId, T.saveContact(), "save_contact");
    try {
      await tr.sendContact(to, CONTACT_NAME);
    } catch (e: any) {
      log.error("contact card failed", { error: e?.message });
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
      await this.say(msg.replyTo, r.agentId ?? null, r.servable ? T.welcome() : T.linkNotBeta(), "link");
      return this.sendContactCard(msg.replyTo, r.agentId ?? null);
    }
    const text =
      r.reason === "expired" ? T.linkExpired() : r.reason === "no_pending" ? T.linkWrongNumber() : T.linkBad();
    await this.say(msg.replyTo, null, text, "link_failed");
  }

  /* ══ Conversation state ═══════════════════════════════════════════════ */

  private async loadConv(agentId: string, to: string): Promise<Conv> {
    const c = (await this.d.engine.getConversation(agentId)) as Conv;
    const pending = c.pending && typeof c.pending === "object" ? c.pending : {};
    if (pending.last && !this.lastShare.has(agentId)) this.lastShare.set(agentId, pending.last);
    if (pending.lastPerson && !this.lastPerson.has(agentId)) this.lastPerson.set(agentId, pending.lastPerson);
    if (pending.lastChange && !this.lastChange.has(agentId)) this.lastChange.set(agentId, pending.lastChange);
    if (pending.replyLang && !this.replyLang.has(agentId)) this.replyLang.set(agentId, pending.replyLang);
    let conv: Conv = { state: (c.state as State) || "IDLE", currentClientId: c.currentClientId, pending, updatedAt: c.updatedAt };
    // Any AWAITING_* state lapses after 15 minutes. Defaults: nothing is sent, the customer
    // stays unassigned, a held file is dropped.
    if (conv.state.startsWith("AWAITING") && conv.updatedAt && this.now() - new Date(conv.updatedAt).getTime() > this.t.stateTimeoutMs) {
      await this.dropHeldFile(conv);
      // Unanswered super top-up question: nothing was checked and nothing charged. Say so
      // on the next message (handle), not silently.
      const held: Held[] | undefined = conv.state === "AWAITING_TOPUP" ? conv.pending?.held : undefined;
      const lapsed = held?.length ? held.map((h) => h.label).join(", ") : null;
      if (lapsed) this.lapsed.set(agentId, lapsed);
      conv = { state: conv.currentClientId ? "REPORT_READY" : "IDLE", currentClientId: conv.currentClientId, pending: lapsed ? { lapsed } : {}, updatedAt: null };
    }
    if (conv.pending.to !== to) {
      conv.pending = { ...conv.pending, to };
      await this.saveConv(agentId, conv);
    }
    return conv;
  }

  private readonly lastPerson = new Map<string, string>();
  private readonly lastChange = new Map<string, LastChange>();
  /** The language the advisor last wrote in (or chose with HINDI / HINGLISH / ENGLISH). */
  private readonly replyLang = new Map<string, ReplyLang>();

  /** Loads the advisor's reply language when nothing has been said yet this run (the 9 AM
   *  brief goes out before they write). */
  private async langOf(agentId: string): Promise<ReplyLang> {
    if (!this.replyLang.has(agentId)) {
      const c = await this.d.engine.getConversation(agentId).catch(() => null);
      const l = c?.pending?.replyLang;
      if (l === "hindi" || l === "hinglish" || l === "english") this.replyLang.set(agentId, l);
    }
    return this.replyLang.get(agentId) ?? "english";
  }

  private async saveConv(agentId: string, c: Conv) {
    const last = this.lastShare.get(agentId);
    const person = this.lastPerson.get(agentId);
    const change = this.lastChange.get(agentId);
    const lang = this.replyLang.get(agentId);
    const lapsed = this.lapsed.get(agentId);
    const pending = { ...(c.pending || {}), ...(last ? { last } : {}), ...(person ? { lastPerson: person } : {}), ...(change ? { lastChange: change } : {}), ...(lang ? { replyLang: lang } : {}), ...(lapsed ? { lapsed } : {}) };
    await this.d.engine.putConversation(agentId, { state: c.state, currentClientId: c.currentClientId, pending });
  }

  /** The last thing SHARE refers to: a policy report, a calculator result or a comparison.
   *  Kept here and written into every conversation save, so it survives state changes and
   *  restarts. */
  private readonly lastShare = new Map<string, Shareable>();

  private setLast(agentId: string, s: Shareable) {
    this.lastShare.set(agentId, s);
  }

  private async setState(agentId: string, to: string, state: State, currentClientId: string | null, extra: Record<string, unknown> = {}) {
    await this.saveConv(agentId, { state, currentClientId, pending: { to, ...extra }, updatedAt: null });
  }

  private async rest(agentId: string, to: string, currentClientId: string | null) {
    await this.setState(agentId, to, currentClientId ? "REPORT_READY" : "IDLE", currentClientId);
  }

  private async dropHeldFile(conv: Conv) {
    const paths = [conv.pending?.file?.path, ...((conv.pending?.held as Held[] | undefined) ?? []).map((h) => h.file?.path)];
    for (const p of paths) if (p) await fs.rm(p, { force: true }).catch(() => {});
  }

  /* ══ PDF in (brief §7) ════════════════════════════════════════════════ */

  /** The health PDFs waiting on the super top-up question, if any. A file waiting on "run a
   *  fresh check?" counts too: a top-up sent then pairs with it. */
  private heldOf(conv: Conv): Held[] | null {
    if (conv.state === "AWAITING_TOPUP") return (conv.pending?.held as Held[]) || [];
    if (conv.state === "AWAITING_DUP_CONFIRM" && conv.pending?.item) return [conv.pending.item as Held];
    return null;
  }

  private heldItem(file: FileRef, insp: Extract<Inspection, { kind: "ok" }>, existing: string | null): Held {
    const names = insp.names ?? [];
    const scanned = insp.text.replace(/\s/g, "").length < MIN_TEXT;
    const person = parseCaption(file.caption).name || names[0] || null;
    const stem = file.name.replace(/\.pdf$/i, "").slice(0, 40);
    return { file, topUp: !!insp.topUp, names, scanned, existing, person, label: person || stem || "this policy" };
  }

  /** Health checks this advisor can still start, after the ones already in line. */
  private async checksFree(agentId: string): Promise<number> {
    const left = await this.d.engine.checksLeft(agentId);
    const q = this.queues.get(agentId);
    return left - ((q?.items.filter((i) => i.type === "health").length ?? 0) + (q?.running ? 1 : 0));
  }

  private async pdfIn(agentId: string, conv: Conv, msg: InboundMessage) {
    const to = msg.replyTo;
    if (msg.fileSize != null && msg.fileSize > MAX_BYTES) return this.say(to, agentId, T.tooLarge(), "too_large");
    const named = /\.pdf$/i.test(msg.fileName || "") || /pdf/i.test(msg.mimeType || "");
    if (!named) return this.say(to, agentId, T.notPdf(), "not_pdf");

    // A new PDF starts a new flow, even mid-question. The exception: health PDFs waiting on
    // the super top-up question, which this PDF may belong with.
    const holding = this.heldOf(conv);
    if (!holding && conv.state.startsWith("AWAITING")) {
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

    const isHealth = insp.guess === "health" || !!insp.topUp;
    const existing = await this.d.engine.jobByHash(agentId, sha);

    if (holding) {
      // Another health PDF: maybe the super top-up, maybe another customer. Ask, never guess.
      if (isHealth) return this.addHeld(agentId, to, conv, holding, this.heldItem(file, insp, existing));
      // A motor or life policy has nothing to pair with: it runs, and the question stays.
      if (insp.guess) {
        if (existing) {
          await fs.rm(file.path, { force: true }).catch(() => {});
          return this.say(to, agentId, T.alreadyChecked(file.name.replace(/\.pdf$/i, ""), portalPolicyUrl(this.d.links, existing)), "duplicate");
        }
        return this.enqueue(agentId, to, file, insp.guess);
      }
      await fs.rm(file.path, { force: true }).catch(() => {});
      return this.say(to, agentId, T.answerFirst(holding[0].label), "answer_first");
    }

    if (isHealth) {
      if ((await this.checksFree(agentId)) <= 0) {
        await fs.rm(file.path, { force: true }).catch(() => {});
        return this.say(to, agentId, T.outOfChecks(this.d.teamLink), "no_checks");
      }
      const item = this.heldItem(file, insp, existing);
      if (existing) {
        await this.setState(agentId, to, "AWAITING_DUP_CONFIRM", conv.currentClientId, { file, type: "health", existing, item });
        return this.say(to, agentId, T.duplicate(portalPolicyUrl(this.d.links, existing)), "duplicate");
      }
      return this.addHeld(agentId, to, conv, [], item);
    }
    if (existing) {
      await this.setState(agentId, to, "AWAITING_DUP_CONFIRM", conv.currentClientId, { file, type: insp.guess, existing });
      return this.say(to, agentId, T.duplicate(portalPolicyUrl(this.d.links, existing)), "duplicate");
    }
    if (!insp.guess) {
      await this.setState(agentId, to, "AWAITING_TYPE", conv.currentClientId, { file, item: this.heldItem(file, insp, null) });
      return this.say(to, agentId, T.pickType(), "pick_type");
    }
    await this.enqueue(agentId, to, file, insp.guess);
  }

  /* ══ Base policy + super top-up (one check for both) ══════════════════ */

  private async addHeld(agentId: string, to: string, conv: Conv, held: Held[], item: Held) {
    const all = [...held, item];
    await this.setState(agentId, to, "AWAITING_TOPUP", conv.currentClientId, { held: all });
    return this.askHeld(agentId, to, all);
  }

  /** Which of two held PDFs is the top-up: the one that looks like it, else the later one
   *  (it was sent in answer to "does X have a super top-up?"). The advisor confirms. */
  private roles(a: Held, b: Held): { base: Held; top: Held } {
    return a.topUp && !b.topUp ? { base: b, top: a } : { base: a, top: b };
  }

  private async askHeld(agentId: string, to: string, held: Held[]) {
    const fresh = held.filter((h) => !h.existing).length;
    if (held.length === 1) {
      const h = held[0];
      return this.say(to, agentId, h.topUp ? T.baseAsk(h.person) : T.topUpAsk(h.person), "topup_ask");
    }
    if (held.length === 2) {
      const { base, top } = this.roles(held[0], held[1]);
      if (top.scanned) return this.say(to, agentId, T.scanTopUp(fresh), "topup_scan");
      const verdict = sameInsured(base.names, top.names);
      const a = base.names[0] ?? null, b = top.names[0] ?? null;
      return this.say(to, agentId, T.pairAsk(base.person, a, b, verdict === "mismatch", fresh), "topup_pair");
    }
    return this.say(to, agentId, T.manyAsk(held.map((h) => h.label + (h.topUp ? " (looks like a super top-up)" : "")), fresh), "topup_many");
  }

  private async runPair(agentId: string, to: string, base: Held, top: Held, others: Held[]) {
    // A combined check is a new check even if the base alone was checked before.
    await this.enqueue(agentId, to, base.file, "health", top.file, T.pairing());
    if (others.length) {
      await this.say(to, agentId, T.restSeparate(others.length), "topup_rest");
      await this.runSeparately(agentId, to, others);
    }
  }

  private async runSeparately(agentId: string, to: string, items: Held[]) {
    for (const h of items) {
      if (h.existing) {
        // Already checked and the advisor did not ask for a fresh one: no second charge.
        await fs.rm(h.file.path, { force: true }).catch(() => {});
        await this.say(to, agentId, T.alreadyChecked(h.label, portalPolicyUrl(this.d.links, h.existing)), "duplicate");
        continue;
      }
      await this.enqueue(agentId, to, h.file, "health");
    }
  }

  /** The reply to the super top-up question. */
  private async onTopUpReply(agentId: string, conv: Conv, to: string, text: string): Promise<boolean> {
    const held: Held[] = conv.pending?.held || [];
    if (!held.length) return false;
    const separately = isNo(text) || isAlone(text);
    if (held.length === 1) {
      if (separately) {
        await this.rest(agentId, to, conv.currentClientId);
        await this.runSeparately(agentId, to, held);
        return true;
      }
      if (isYes(text)) {
        await this.say(to, agentId, held[0].topUp ? T.sendBaseNow() : T.sendTopUpNow(), "topup_send");
        return true;
      }
      await this.askHeld(agentId, to, held);
      return true;
    }
    if (separately) {
      await this.rest(agentId, to, conv.currentClientId);
      await this.runSeparately(agentId, to, held);
      return true;
    }
    let pair: { base: Held; top: Held } | null = null;
    if (held.length === 2 && isYes(text)) pair = this.roles(held[0], held[1]);
    const nums = held.length > 2 ? parsePair(text, held.length) : null;
    if (nums) pair = this.roles(held[nums[0] - 1], held[nums[1] - 1]);
    if (!pair) {
      await this.askHeld(agentId, to, held);
      return true;
    }
    if (pair.top.scanned) {
      await this.say(to, agentId, T.scanTopUp(held.filter((h) => !h.existing).length), "topup_scan");
      return true;
    }
    await this.rest(agentId, to, conv.currentClientId);
    await this.runPair(agentId, to, pair.base, pair.top, held.filter((h) => h !== pair!.base && h !== pair!.top));
    return true;
  }

  private async enqueue(agentId: string, to: string, file: FileRef, type: PolicyType, companion: FileRef | null = null, lead: string | null = null) {
    if (type === "health" && (await this.checksFree(agentId)) <= 0) {
      await fs.rm(file.path, { force: true }).catch(() => {});
      if (companion) await fs.rm(companion.path, { force: true }).catch(() => {});
      return this.say(to, agentId, T.outOfChecks(this.d.teamLink), "no_checks");
    }
    const jobRowId = await this.d.engine.createJob(agentId, { waMessageId: file.waMessageId, fileSha256: file.sha, insuranceType: type });
    const q = this.queues.get(agentId) ?? { running: false, items: [] };
    this.queues.set(agentId, q);
    const waiting = q.items.length + (q.running ? 1 : 0);
    q.items.push({ agentId, to, file, type, jobRowId, companion });
    const line = waiting > 0 ? T.queued(waiting) : T.checkingNow();
    await this.say(to, agentId, lead ? `${lead}\n${line}` : line, waiting > 0 ? "queued" : "checking");
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
            if (i.companion) await fs.rm(i.companion.path, { force: true }).catch(() => {});
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
    const { agentId, to, file, type, companion } = item;
    const e = this.d.engine;
    const dropFiles = async () => {
      await fs.rm(file.path, { force: true }).catch(() => {});
      if (companion) await fs.rm(companion.path, { force: true }).catch(() => {});
    };
    if (type === "health" && (await e.checksLeft(agentId)) <= 0) {
      await dropFiles();
      await e.updateJob(agentId, item.jobRowId, { status: "skipped", failureReason: "no policy checks left" });
      await this.say(to, agentId, T.outOfChecks(this.d.teamLink), "no_checks");
      return true;
    }
    await e.updateJob(agentId, item.jobRowId, { status: "processing" });
    const caption = parseCaption(file.caption);
    let buf: Buffer;
    let companionBuf: Buffer | null = null;
    try {
      buf = await fs.readFile(file.path);
      // Both or neither: the advisor was promised one check covering both documents.
      if (companion) companionBuf = await fs.readFile(companion.path);
    } catch {
      await dropFiles();
      await e.updateJob(agentId, item.jobRowId, { status: "failed", failureReason: "temp file missing" });
      await this.say(to, agentId, companion ? T.resendBoth() : T.resendFile(), "resend");
      return false;
    }
    const res = await e.analyze(agentId, {
      buffer: buf, fileName: file.name, type, policyholderName: caption.name, clientPhone: caption.phone,
      companion: companion && companionBuf ? { buffer: companionBuf, fileName: companion.name } : null,
    });
    await dropFiles();

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
    // The conversation is updated under the advisor's lock, so a report finishing in the
    // background never overwrites a question asked a moment ago.
    return this.withLock(agentId, () => this.reportDone(agentId, to, c, clientId, caption));
  }

  private async reportDone(agentId: string, to: string, c: ClientSummary | null, clientId: string, caption: { name: string | null; phone: string | null }) {
    if (!c) return this.say(to, agentId, T.gaveUp(portalPolicyUrl(this.d.links, clientId)), "gave_up");

    if (c.insuranceType === "health") await this.say(to, agentId, reportCard(c, this.d.links), "report");
    else await this.say(to, agentId, T.nonHealth((c.insuranceType as PolicyType) || "motor", c.policyholderName), "data_entry");

    // This report becomes the one follow-up questions and SHARE refer to. An AWAITING_*
    // state from another flow is left as it is; only the current report moves.
    this.setLast(agentId, { kind: "policy", clientId });
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
    const typed = msg.text.trim();

    // Reply language: HINDI / HINGLISH / ENGLISH set it; otherwise it follows whatever the
    // advisor clearly writes in (a bare command or a name keeps the current one).
    const chosen = conv.state.startsWith("AWAITING") ? null : langCommand(typed);
    if (chosen) {
      this.replyLang.set(agentId, chosen);
      await this.saveConv(agentId, conv);
      return this.say(to, agentId, LANG_SET[chosen], "lang");
    }
    const seen = detectLang(typed);
    if (seen && seen !== (this.replyLang.get(agentId) ?? "english")) {
      this.replyLang.set(agentId, seen);
      await this.saveConv(agentId, conv);
    }

    // "Did you mean" list: a number runs that choice; anything else is a fresh message.
    // SUGGESTED is not a pending question (nothing else waits on it): the next message always
    // clears it, and only a number sent within the usual 15 minutes runs a choice.
    let text = typed;
    if (conv.state === "SUGGESTED") {
      const options = (conv.pending?.options as Suggestion[] | undefined) ?? [];
      const fresh = this.now() - Number(conv.pending?.at ?? 0) <= this.t.stateTimeoutMs;
      const n = fresh ? pickNumber(typed, options.length) : null;
      await this.rest(agentId, to, conv.currentClientId);
      conv = { ...conv, state: conv.currentClientId ? "REPORT_READY" : "IDLE", pending: { to } };
      if (n) text = options[n - 1].command;
    }
    // The model (paid plan) reads the advisor's own words (or the picked command); it is told
    // who "him" is separately, in its context.
    const modelText = text;

    // Everyday phrasings become the command the rules know, and "him" / "uska" become the
    // person we were just talking about. Never while a change waits for YES ("no wait, yes"
    // must stay a no). While another question is pending (a city, a name, a phone), only an
    // explicit change of topic ("chhodo, ...", "actually ...") that ends in a clear command.
    if (text === typed && conv.state !== "AWAITING_CONFIRM") {
      if (!conv.state.startsWith("AWAITING")) {
        const said = rephrase(typed);
        text = withPerson(said, this.lastPerson.get(agentId) ?? null) ?? said;
      } else if (SWITCH_TOPIC.test(typed)) {
        const said = rephrase(typed);
        if (ruleIntent(said)) text = said;
      }
    }

    let intent = ruleIntent(text);
    // While a question is pending, a bare number is an answer to it (a phone number for
    // "whose policy?" or a new lead), never a lookup.
    if (intent === "lookup" && conv.state.startsWith("AWAITING") && /^\+?[\d\s-]+$/.test(text)) intent = null;
    // While the bot waits for a new value, the reply IS the value ("Website" as a lead's source),
    // never a command; only CANCEL gets out.
    if (conv.state === "AWAITING_EDIT_VALUE" && intent !== "cancel") intent = null;

    if (intent === "cancel") {
      await this.dropHeldFile(conv);
      await this.rest(agentId, to, conv.currentClientId);
      return this.say(to, agentId, T.cancelled(), "cancel");
    }
    if (/^(undo|undo that|undo karo|wapas karo|pehle jaisa karo|revert|वापस करो|अनडू|पहले जैसा करो)[.!।]*$/i.test(text)) return this.proposeUndo(agentId, conv, to);
    if (intent === "unlink") {
      await this.d.engine.unlink(agentId);
      return this.say(to, agentId, T.unlinked(), "unlink");
    }
    if (/^(ok|okay|thanks|thank you|thx|ty|great|done|👍|🙏)[.! ]*$/i.test(text)) {
      if (!conv.state.startsWith("AWAITING")) return this.say(to, agentId, "You're welcome. Anything else, just type it.", "thanks");
    }

    // A change waiting for YES gets the first word. Anything else drops it, unsaved.
    if (conv.state === "AWAITING_CONFIRM") {
      if (isYes(text) || /^(yes|haan|confirm|save|kar do|theek hai|ha+n)\b/i.test(text)) return this.confirmYes(agentId, conv, to);
      await this.rest(agentId, to, conv.currentClientId);
      if (isNo(text) || /^(no|nahi|mat|don'?t|wait|stop|never ?mind|leave it|chhodo)\b/i.test(text)) {
        return this.say(to, agentId, "Okay, nothing changed.", "confirm_no");
      }
      await this.say(to, agentId, "(That change was not saved.)", "confirm_dropped");
      conv = { ...conv, state: conv.currentClientId ? "REPORT_READY" : "IDLE", pending: { to } };
      intent = ruleIntent(text);
    }

    // Free-form messages go to the model (when it is switched on): it fills a fixed form and
    // the code below does everything else. Short, clear commands skip it and cost nothing.
    const words = text.split(/\s+/).length;
    const fastRule = !!intent && (ALWAYS_RULE.has(intent) || FAST_RULE.has(intent)) && (ALWAYS_RULE.has(intent) || words <= 4 || /^(compare|find|search|lookup|share|remind|help)\b/i.test(text));
    const answering = conv.state.startsWith("AWAITING") && !intent;
    // A lead change the rules read with certainty ("Aniket ka followup 3rd November",
    // "Ramesh won", "sabke reminders 1st November kardo") goes straight to its confirmation:
    // no model needed, and every change still waits for YES.
    // This runs on the advisor's own words, as before: what the model sees is unchanged for
    // paid advisors. The rewritten text ("mark him won" -> "mark Ramesh Kumar won") is tried
    // further down, only when the model did not take the message.
    if (!intent && !conv.state.startsWith("AWAITING")) {
      const one = parseBulkFollowUp(modelText, this.now());
      const all = one ? { nextFollowUp: one } : parseBulkUpdate(modelText, this.now());
      if (all) return this.bulkFollowUp(agentId, conv, to, all);
      const u = parseLeadUpdate(modelText, this.now());
      if (u && !isPronounName(u.name) && (await this.leadUpdateStart(agentId, conv, to, u))) return;
    }

    let sachReason: string | undefined;
    if (!fastRule && !answering) {
      const r = await this.d.engine.understand(agentId, modelText, this.modelContext(agentId, conv)).catch(() => null);
      sachReason = r?.reason;
      if (r?.reason === "limit" && r.usage) await this.sachLimitNotice(agentId, to, r.usage);
      if (r?.enabled && r.understanding) {
        if (conv.state.startsWith("AWAITING")) {
          await this.dropHeldFile(conv);
          await this.rest(agentId, to, conv.currentClientId);
          conv = { ...conv, state: conv.currentClientId ? "REPORT_READY" : "IDLE", pending: { to } };
        }
        await this.dispatch(agentId, conv, to, modelText, r.understanding);
        const u = r.usage;
        if (u && u.limit > 0 && u.used === Math.ceil(u.limit * 0.8)) {
          await this.say(to, agentId, `Heads up: you've used ${u.used} of ${u.limit} Sach Assistant replies this month. They reset on ${dayMonth(u.resetsOn)}.`, "sach_warn");
        }
        return;
      }
    }

    // No model: the rewritten words get their turn at a lead change ("mark him won" with
    // Ramesh just looked up, "Neha said no" after "spoke to Neha"). Still only after YES.
    if (!intent && !conv.state.startsWith("AWAITING") && text !== modelText) {
      const u = parseLeadUpdate(text, this.now());
      if (u && (await this.leadUpdateStart(agentId, conv, to, u))) return;
    }
    if (!intent && !conv.state.startsWith("AWAITING")) {
      const u = parseLeadUpdate(modelText, this.now());
      if (u && isPronounName(u.name) && (await this.leadUpdateStart(agentId, conv, to, u))) return;
    }

    // "Ramesh won" / "follow up Ramesh Friday" / "note Ramesh: ...": only when no other
    // command matched and no question is pending.
    // A pending question gets first go at the reply, unless it is a clear command.
    if (conv.state.startsWith("AWAITING") && !intent) {
      const handled = await this.onAwaiting(agentId, conv, to, text);
      if (handled) return;
    }
    if (intent && conv.state.startsWith("AWAITING")) {
      if (conv.state === "AWAITING_TOPUP" && conv.pending?.held?.length) {
        await this.say(to, agentId, T.heldDropped((conv.pending.held as Held[]).map((h) => h.label).join(", ")), "topup_dropped");
      }
      await this.dropHeldFile(conv);
      await this.rest(agentId, to, conv.currentClientId);
      conv = { ...conv, state: conv.currentClientId ? "REPORT_READY" : "IDLE", pending: { to } };
    }

    switch (intent) {
      case "help":
        if (GREETING.test(typed)) return this.greet(agentId, to, typed);
        return this.menu(agentId, to, null, "help");
      case "howcheck":
        return this.say(to, agentId, T.howToCheck(), "howcheck");
      case "howfind":
        return this.say(to, agentId, T.howToFind(), "howfind");
      case "leadlist":
        return this.say(to, agentId, leadsListReply(this.d.links, await this.d.engine.leadsList(agentId)), "list_leads");
      case "balance":
        return this.balance(agentId, to);
      case "today":
        return this.today(agentId, to);
      case "morning_off":
      case "morning_on": {
        const s = await this.d.engine.sach(agentId);
        if (!s.paid) return this.say(to, agentId, MORNING.paidOnly(this.d.teamLink), "sach_paid_only");
        return this.say(to, agentId, intent === "morning_off" ? MORNING.off() : MORNING.on(), intent);
      }
      case "more":
        return this.say(to, agentId, T.more(), "more");
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
        return this.calcStart(agentId, conv, to, text, null);
      case "compare":
        return this.compareStart(agentId, conv, to, text);
      case "followups":
        return this.showFollowups(agentId, to);
      case "checks": {
        const n = await this.d.engine.checksLeft(agentId);
        return this.say(to, agentId, `You have ${b(String(n))} policy ${n === 1 ? "check" : "checks"} left.\n${n <= 0 ? `To get more: ${this.d.teamLink}` : "Next: send a health policy PDF to use one."}`, "checks");
      }
      case "views":
        return this.say(to, agentId, viewsReply(await this.d.engine.views(agentId)), "views");
      case "claims": {
        const q = text.replace(/^(show\s+)?(open\s+)?claims?\s*(status)?\s*(of|for)?\s*/i, "").trim() || null;
        const rows = await this.d.engine.claims(agentId, q);
        const reply = claimsReply(this.d.links, rows, q);
        // One claim named: also its stage, the documents still missing and the document clock.
        if (q && rows.length === 1) {
          this.lastClaim.set(agentId, rows[0].id);
          const d = await this.d.engine.claim(agentId, rows[0].id).catch(() => null);
          if (d) {
            const lines = reply.split("\n");
            const link = lines.pop()!;
            return this.say(to, agentId, [...lines, ...claimDetailLines(d), link].join("\n"), "claims");
          }
        }
        return this.say(to, agentId, reply, "claims");
      }
      /* Stage 1: read-only views of the book */
      case "queue":
        return this.say(to, agentId, queueReply(this.d.links, await this.d.engine.queue(agentId)), "queue");
      case "status": {
        const name = statusName(text) ?? "";
        return this.say(to, agentId, statusReply(this.d.links, name, await this.d.engine.findClients(agentId, name)), "status");
      }
      case "book": {
        const ask = bookAsk(text) ?? { view: "all" as const, sort: "score" as const };
        return this.say(to, agentId, bookReply(this.d.links, ask.view, ask.sort, await this.d.engine.book(agentId, ask.view, ask.sort, typeIn(text))), "book");
      }
      case "portfolio": {
        const name = portfolioName(text) ?? "";
        return this.say(to, agentId, portfolioReply(this.d.links, name, await this.d.engine.portfolio(agentId, name)), "portfolio");
      }
      case "values":
        return this.say(to, agentId, valuesReply(this.d.links, await this.d.engine.policyValueRows(agentId)), "values");
      case "insights":
        return this.say(to, agentId, insightsReply(this.d.links, await this.d.engine.insights(agentId)), "insights");
      case "pagestats":
        return this.say(to, agentId, pageStatsReply(this.d.links, await this.d.engine.pageStats(agentId)), "pagestats");
      /* Stage 2a: edits. Each one is shown first and saved only on YES. */
      case "edit":
        return this.editStart(agentId, conv, to, text);
      case "convert":
        return this.convertStart(agentId, conv, to, text);
      case "addcustomer":
        return this.addCustomerStart(agentId, conv, to, text);
      case "file":
        return this.fileStart(agentId, conv, to, text);
      /* Stage 2b: policies */
      case "policyfix":
        return this.policyFixStart(agentId, conv, to, text);
      case "unshare":
        return this.unshareStart(agentId, conv, to, text);
      /* Stage 2c: claims */
      case "claimedit":
        return this.claimStart(agentId, conv, to, text);
      case "lookup": {
        const q = text.replace(/^(find|search|lookup|look up|who is|details (of|for))\s+/i, "").trim();
        const r = await this.d.engine.lookup(agentId, q);
        if (r.policies.length === 1) {
          // One policy found: follow-up questions ("does it cover maternity?") are about it.
          this.setLast(agentId, { kind: "policy", clientId: r.policies[0].clientId });
          await this.rest(agentId, to, r.policies[0].clientId);
        }
        const person = r.policies[0]?.policyholderName || r.leads[0]?.name;
        if (person) this.lastPerson.set(agentId, person);
        return this.say(to, agentId, lookupReply(this.d.links, q, r.policies, r.leads), "lookup");
      }
      case "surrender":
        return this.surrender(agentId, conv, to, text);
      case "draft":
        return this.draft(agentId, conv, to, text);
      case "clients": {
        const type = typeIn(text);
        return this.say(to, agentId, clientsReply(this.d.links, type, await this.d.engine.policies(agentId, type)), "clients");
      }
    }

    // No rule matched. A named policy ("Ramesh's policy") is always a question. The current
    // report only gets free text that is about a policy topic, or a question while the report
    // is fresh; it must not swallow everything else the advisor says.
    const fresh = !!conv.updatedAt && this.now() - new Date(conv.updatedAt).getTime() < REPORT_FRESH_MS;
    if (namedPerson(text) || (this.currentPolicy(agentId, conv) && isReportQuestion(text, fresh))) return this.ask(agentId, conv, to, text);

    const guess = await this.d.engine.llmIntent(agentId, modelText, false).catch(() => "unknown");
    if (guess === "renewals") return this.say(to, agentId, renewalsReply(await this.d.engine.renewals(agentId), this.d.links), "renewals");
    if (guess === "share" || guess === "ask") return this.say(to, agentId, T.noReport(), guess);

    // Deleting is never done from WhatsApp: say so plainly, and where it can be done.
    if (/^(?:please\s+)?(?:delete|remove|erase)\b|\b(?:hata do|hatao|mita do|delete karo|delete kar do)\b|हटा दो|मिटा दो/i.test(text)) {
      return this.say(to, agentId, `I can't delete anything from WhatsApp, so nothing is lost by mistake. You can remove a lead in the portal: ${this.d.links.origin}/agent/leads`, "no_delete");
    }

    // Not a dead end: offer the closest commands, and the person if a name in the message is
    // in the book. A number picks one.
    const options = await this.suggestions(agentId, modelText);
    if (options.length) {
      await this.setState(agentId, to, "SUGGESTED", conv.currentClientId, { options, at: this.now() });
      return this.say(to, agentId, suggestReply(options), "suggest");
    }
    // Free plan: one line a day on what Sach Assistant would add, never more.
    const day = istClock(this.now()).iso;
    if (sachReason === "free_plan" && this.sachNudged.get(agentId) !== day && words > 2) {
      this.sachNudged.set(agentId, day);
      return this.menu(agentId, to, "I didn't catch that.", "unknown", `With Sach Assistant (paid plan) you can just type it your way, in English, Hinglish or Hindi: ${this.d.teamLink}`);
    }
    return this.menu(agentId, to, "I didn't catch that.", "unknown");
  }

  /* ══ Sach Assistant: BALANCE, TODAY and the 9 AM brief ════════════════ */

  private async balance(agentId: string, to: string) {
    const [s, checks] = await Promise.all([this.d.engine.sach(agentId), this.d.engine.checksLeft(agentId)]);
    const lines = [`${b("Policy checks left:")} ${checks}`];
    if (s.paid) {
      lines.unshift(`${b("Sach Assistant:")} ${s.used} of ${s.limit} replies used this month. Resets on ${dayMonth(s.resetsOn)}.`);
      lines.push("", "Short commands like RENEWALS, HELP and YES never count.");
    } else {
      lines.push("", `Sach Assistant (type it your way, plus a 9 AM to-do Monday to Friday) comes with the paid plan: ${this.d.teamLink}`);
    }
    return this.say(to, agentId, lines.join("\n"), "balance");
  }

  /** "hi" / "namaste": a hello by name, what's waiting today if anything, then the menu. */
  private async greet(agentId: string, to: string, typed = "") {
    const [profile, due] = await Promise.all([
      this.d.engine.profile(agentId).catch(() => null),
      this.d.engine.followups(agentId).catch(() => []),
    ]);
    const first = String(profile?.name || "").trim().split(/\s+/)[0];
    // Answer in kind: "good morning" gets a good morning back.
    const hello = /good morning|^gm\b/i.test(typed) ? "Good morning" : /good afternoon/i.test(typed) ? "Good afternoon" : /good evening/i.test(typed) ? "Good evening" : "Hi";
    const lines = [first ? `👋 ${hello} ${first}!` : `👋 ${hello}!`];
    if (due.length) lines.push(`You have ${due.length} ${due.length === 1 ? "follow-up" : "follow-ups"} due. Reply FOLLOW UPS to see them.`);
    return this.menu(agentId, to, lines.join("\n"), "help");
  }

  /** The help menu. Its numbers are remembered (state SUGGESTED, like "did you mean"), so a
   *  reply "4" runs "add a lead". Never while another question is waiting: a number then
   *  answers that question, as before. */
  private async menu(agentId: string | null, to: string, before: string | null, tag: string, after: string | null = null) {
    if (agentId) {
      const conv = await this.loadConv(agentId, to);
      if (!conv.state.startsWith("AWAITING")) {
        await this.setState(agentId, to, "SUGGESTED", conv.currentClientId, { options: MENU.map((m) => ({ label: m.label, command: m.command })), at: this.now() });
      }
    }
    return this.say(to, agentId, [before, T.help(), after].filter(Boolean).join("\n\n"), tag);
  }

  /** Up to three likely commands for a message no rule understood. A word that is a name in
   *  the advisor's book comes first as "Everything on <name>". */
  private async suggestions(agentId: string, text: string): Promise<Suggestion[]> {
    const out = suggest(text);
    for (const w of nameCandidates(text)) {
      const r = await this.d.engine.lookup(agentId, w).catch(() => null);
      const names = [...new Set([...(r?.policies ?? []).map((p) => p.policyholderName), ...(r?.leads ?? []).map((l) => l.name)].filter(Boolean) as string[])]
        .filter((n) => nameMatches(w, n));
      if (names.length === 1) {
        out.unshift({ label: `Everything on ${names[0]}`, command: `find ${names[0]}` });
        break;
      }
    }
    return out.slice(0, 3);
  }

  private async sachLimitNotice(agentId: string, to: string, u: SachStatus) {
    const month = istClock(this.now()).iso.slice(0, 7);
    if (this.limitTold.get(agentId) === month) return;
    this.limitTold.set(agentId, month);
    await this.say(to, agentId,
      `You've used all ${u.limit} Sach Assistant replies this month. Until ${dayMonth(u.resetsOn)} I'll work on short commands (reply HELP to see them).`,
      "sach_limit");
  }

  private async buildBrief(agentId: string, name: string | null): Promise<string | null> {
    const e = this.d.engine;
    const [followups, renewals, views, claims] = await Promise.all([e.followups(agentId), e.renewals(agentId), e.views(agentId), e.claims(agentId, null)]);
    return morningBrief({ name, followups, renewals, views, claims, sinceMs: sincePreviousWorkday(this.now()) });
  }

  private async today(agentId: string, to: string) {
    const s = await this.d.engine.sach(agentId);
    if (!s.paid) return this.say(to, agentId, MORNING.paidOnly(this.d.teamLink), "sach_paid_only");
    const profile = await this.d.engine.profile(agentId);
    return this.say(to, agentId, (await this.buildBrief(agentId, profile.name)) ?? MORNING.empty(), "today");
  }

  /**
   * Called every minute by index.ts. On weekdays from 9 AM IST, sends each paid advisor
   * their to-do, 20-40 seconds apart (a personal number must not burst). The backend only
   * lists advisors not yet sent one today, so a restart never double-sends. An empty list
   * is not sent.
   */
  async morningTick(): Promise<number> {
    if (!inMorningWindow(this.now()) || this.morningRunning) return 0;
    const day = istClock(this.now()).iso;
    if (this.morningDoneDay === day) return 0;
    this.morningRunning = true;
    let sent = 0;
    try {
      const list = await this.d.engine.morningRecipients();
      for (const r of list) {
        const brief = await this.buildBrief(r.agentId, r.name).catch((e) => {
          log.error("morning brief failed", { error: e?.message });
          return null;
        });
        if (!brief) continue;
        await this.langOf(r.agentId);
        if (sent > 0) await this.sleep(20_000 + Math.floor(Math.random() * 20_000));
        await this.say(`${r.waNumber}@s.whatsapp.net`, r.agentId, brief, "morning_brief");
        sent++;
      }
      this.morningDoneDay = day;
    } catch (e: any) {
      log.error("morning run failed", { error: e?.message });
    } finally {
      this.morningRunning = false;
    }
    return sent;
  }

  /** Returns true when the reply was consumed by the pending question. */
  private async onAwaiting(agentId: string, conv: Conv, to: string, text: string): Promise<boolean> {
    if (conv.state.startsWith("AWAITING_EDIT") || conv.state === "AWAITING_FILE_PICK") return this.onEditAwaiting(agentId, conv, to, text);
    const p = conv.pending || {};
    switch (conv.state) {
      case "AWAITING_TOPUP":
        return this.onTopUpReply(agentId, conv, to, text);
      case "AWAITING_TYPE": {
        const n = pickNumber(text, POLICY_TYPES.length);
        if (!n) { await this.say(to, agentId, T.pickType(), "pick_type"); return true; }
        // Health goes through the super top-up question like any other health PDF.
        if (POLICY_TYPES[n - 1] === "health" && p.item) {
          if ((await this.checksFree(agentId)) <= 0) {
            await this.dropHeldFile(conv);
            await this.rest(agentId, to, conv.currentClientId);
            await this.say(to, agentId, T.outOfChecks(this.d.teamLink), "no_checks");
            return true;
          }
          await this.addHeld(agentId, to, conv, [], p.item);
          return true;
        }
        await this.rest(agentId, to, conv.currentClientId);
        await this.enqueue(agentId, to, p.file, POLICY_TYPES[n - 1]);
        return true;
      }
      case "AWAITING_DUP_CONFIRM": {
        if (isYes(text)) {
          if (p.type === "health" && p.item) {
            // A fresh check was asked for: no longer a duplicate. Still ask about a top-up.
            await this.addHeld(agentId, to, conv, [], { ...p.item, existing: null });
            return true;
          }
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
        await this.rest(agentId, to, p.tool ? conv.currentClientId : p.clientId);
        if (p.tool) await this.shareTool(agentId, to, p.tool, lang, p.phone ?? null);
        else await this.doShare(agentId, to, p.clientId, lang, p.phone ?? null);
        return true;
      }
      case "AWAITING_CLIENT_PICK": {
        const ids: string[] = p.options || [];
        const n = pickNumber(text, ids.length);
        if (!n) return false;
        const clientId = ids[n - 1];
        await this.rest(agentId, to, clientId);
        if (p.purpose === "draft") {
          await this.draftForClient(agentId, to, clientId, p.draftKind, p.lang || "english");
        } else if (p.purpose === "share") {
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
        const queue: CompareQ[] = p.queue || [];
        const q = queue[0];
        const n = q && q.options.length ? pickNumber(text, q.options.length) : null;
        if (n && q.kind === "company") {
          const plans = planOptions(await this.d.engine.catalog(agentId), q.options[n - 1].key);
          await this.compareContinue(agentId, conv, to, p.resolved || [], [{ q: q.options[n - 1].label, kind: "plan", options: plans }, ...queue.slice(1)]);
          return true;
        }
        if (n) {
          await this.compareContinue(agentId, conv, to, [...(p.resolved || []), q.options[n - 1].key], queue.slice(1));
          return true;
        }
        const catalog = await this.d.engine.catalog(agentId);
        // Anything else is plan or company names ("hdfc and manipal cigna") in place of the
        // one being asked about. A company gives its plan list (see comparePlan).
        const names = parseCompareNames(text);
        if (!names.length) return false;
        const tried = names.map((name) => this.comparePlan(name, catalog));
        // Nothing usable ("number six", a typo): keep the question on screen, don't lose it.
        if (q?.options.length && tried.every((r) => typeof r !== "string" && (r.kind === "many" || (r.kind === "missing" && !r.options.length)))) {
          await this.say(to, agentId, `"${text}" isn't a plan I know. Reply with a number from 1 to ${q.options.length}, or type another plan name.`, "compare_pick");
          return true;
        }
        const resolved: string[] = [...(p.resolved || [])];
        const fresh: CompareQ[] = [];
        for (const r of tried) {
          if (typeof r === "string") resolved.push(r); else fresh.push(r);
        }
        const rest = queue.slice(1).filter((x) => x.kind !== "ask" && x.kind !== "company");
        const next = [...fresh, ...rest];
        if (resolved.length + next.length < 2) next.push({ q: "", kind: "ask", options: [] });
        await this.compareContinue(agentId, conv, to, resolved, next);
        return true;
      }
      case "AWAITING_LEAD_PICK": {
        const rows: LeadRow[] = p.rows || [];
        const n = pickNumber(text, rows.length);
        if (!n) return false;
        await this.rest(agentId, to, conv.currentClientId);
        if (p.pendingAction) {
          const r = rows[n - 1];
          const a: Action = p.pendingAction;
          const op: Op = { kind: "update", leadId: r.id, name: r.name, phone: r.phone, status: a.status, nextFollowUp: a.follow_up_date, note: a.note };
          await this.proposeWrites(agentId, conv, to, p.restActions || [], [...(p.resolvedOps || []), op]);
          return true;
        }
        if (p.update) await this.leadApply(agentId, to, rows[n - 1], p.update);
        else if (p.draftKind) await this.sendDraft(agentId, to, { type: "lead", id: rows[n - 1].id, name: rows[n - 1].name, phone: rows[n - 1].phone }, p.draftKind, p.lang);
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

  private async ask(agentId: string, conv: Conv, to: string, question: string, nameOver?: string | null) {
    const name = nameOver !== undefined ? nameOver : namedPerson(question);
    if (name) {
      const found = await this.d.engine.findClients(agentId, name);
      if (found.length === 0) return this.say(to, agentId, T.noSuchCustomer(name), "ask");
      if (found.length > 1) return this.pickClient(agentId, to, conv.currentClientId, found, { purpose: "ask", question });
      await this.rest(agentId, to, found[0].clientId);
      return this.answerFor(agentId, to, found[0].clientId, question);
    }
    const current = this.currentPolicy(agentId, conv);
    if (!current) return this.say(to, agentId, T.noReport(), "ask");
    return this.answerFor(agentId, to, current, question);
  }

  /**
   * The policy we are talking about: the one last shown (a lookup, a report, a share), and only
   * then the conversation's stored one. Answering from the stored one after a newer lookup is
   * how "is it a bad policy?" got another customer's 95 instead of this one's 65 (2026-10-22).
   */
  private currentPolicy(agentId: string, conv: Conv): string | null {
    const last = this.lastShare.get(agentId);
    return last?.kind === "policy" ? last.clientId : conv.currentClientId;
  }

  private async answerFor(agentId: string, to: string, clientId: string, question: string) {
    const c = await this.d.engine.getClient(agentId, clientId);
    const url = portalPolicyUrl(this.d.links, clientId);
    if (!c) return this.say(to, agentId, T.noReport(), "ask");
    if (c.status !== "done") return this.say(to, agentId, T.stillChecking(), "ask");
    if (!c.report) {
      // Data-entry policies have no audit, but their stored fields answer most questions.
      this.setLast(agentId, { kind: "policy", clientId });
      if (VALUE_TYPES.includes(c.insuranceType || "") && /\b(surrender|loan|value|maturity)\b/i.test(question)) {
        return this.say(to, agentId, valueReply(this.d.links, c, this.now()), "surrender");
      }
      return this.say(to, agentId, detailsReply(this.d.links, c), "details");
    }
    this.setLast(agentId, { kind: "policy", clientId });
    if (c.policyholderName) this.lastPerson.set(agentId, c.policyholderName);
    // Every answer says first which policy it is about, with its stored score, so the advisor
    // can always see that the answer and the policy they asked about are the same one.
    const who = `${b(c.policyholderName || "This policy")} · ${nicePlan(c.insurer, c.policyName) || "Health policy"}${c.score != null ? ` · ${c.score}/100` : ""}`;
    const ruled = question ? ruleAnswer(question, c) : null;
    if (ruled) return this.say(to, agentId, `${who}\n${ruled}\n\nFull report: ${url}`, "ask");
    const phrased = await this.d.engine.llmPhrase(agentId, clientId, question).catch(() => ({ answer: null }));
    if (phrased.answer) return this.say(to, agentId, `${who}\n${phrased.answer}\n\nFull report: ${url}`, "ask_phrased");
    // Never a bare "not in the report": show what the Policies list shows about it too.
    return this.say(to, agentId, `${basics(c)}\n\n${T.notInReport(url)}`, (phrased as any).guardFired ? "ask_guard_fired" : "ask_not_in_report");
  }

  private async pickClient(agentId: string, to: string, current: string | null, found: ClientSummary[], extra: Record<string, unknown>) {
    const rows = found.slice(0, 5);
    await this.setState(agentId, to, "AWAITING_CLIENT_PICK", current, { ...extra, options: rows.map((r) => r.clientId) });
    return this.say(
      to, agentId,
      T.whichPolicy(rows.map((r) => ({ name: r.policyholderName || "Unnamed", label: nicePlan(r.insurer, r.policyName) || r.insuranceType || "policy" }))),
      "pick_client",
    );
  }

  /* ══ Share (brief §6.3) ═══════════════════════════════════════════════ */

  private async shareStart(agentId: string, conv: Conv, to: string, text: string, over?: { name: string | null; phone: string | null; lang: Lang | null }) {
    const lang = over ? over.lang : langIn(text);
    // "share to 98123 45678": a number typed with SHARE is used for this link.
    const phone = over ? over.phone : parseCaption(text).phone;
    const name = over ? over.name : phone ? null : namedPerson(text);
    let clientId = conv.currentClientId;
    const last = this.lastShare.get(agentId);
    if (!name && last && last.kind !== "policy") {
      if (lang) return this.shareTool(agentId, to, last, lang, phone);
      await this.setState(agentId, to, "AWAITING_SHARE_LANG", conv.currentClientId, { tool: last, phone });
      return this.say(to, agentId, T.pickLang(), "pick_lang");
    }
    if (!name && last?.kind === "policy") clientId = last.clientId;
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

  /** Share a calculator result or a comparison. No view tracking exists for these links, so
   *  the reply does not promise any. */
  private async shareTool(agentId: string, to: string, s: Shareable, lang: Lang, phone: string | null) {
    if (s.kind === "policy") return this.doShare(agentId, to, s.clientId, lang, phone);
    const calc = s as any;
    const draft = s.kind === "calc" && calc.total
      ? calcShareText(lang, { name: calc.name ?? null, total: calc.total, structure: calc.structure ?? "", url: calc.url })
      : toolShareDraft(lang, s);
    phone = phone || calc.phone || null;
    const link = waMeLink(phone, draft);
    return this.say(to, agentId, shareReply(null, draft, link, /wa\.me\/\d/.test(link), false), "share_tool");
  }

  /** `phone`: a number the advisor typed with SHARE. It wins over the one on file, and is
   *  used only for this link; nothing is saved to the customer. */
  private async doShare(agentId: string, to: string, clientId: string, lang: Lang, phone: string | null = null) {
    const c = await this.d.engine.getClient(agentId, clientId);
    if (!c) return this.say(to, agentId, T.noReport(), "share");
    if (c.status !== "done") return this.say(to, agentId, T.stillChecking(), "share");
    this.setLast(agentId, { kind: "policy", clientId });
    if (c.policyholderName) this.lastPerson.set(agentId, c.policyholderName);
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
    // A name plus a status ("lead Ramesh won") or a complete line goes straight to YES/NO.
    if (d.name && (d.status || (d.phone && d.interest))) return this.leadSave(agentId, to, { name: d.name, phone: d.phone, interest: d.interest, status: d.status });
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
      await this.leadSave(agentId, to, { name: d.name!, phone: d.phone, interest: d.interest, status: (d as any).status ?? null });
      return true;
    }
    const next = !d.phone && p.step !== "phone" ? "phone" : !d.interest ? "interest" : null;
    if (!next) {
      await this.rest(agentId, to, conv.currentClientId);
      await this.leadSave(agentId, to, { name: d.name!, phone: d.phone, interest: d.interest, status: (d as any).status ?? null });
      return true;
    }
    await this.setState(agentId, to, "AWAITING_LEAD", conv.currentClientId, { step: next, draft: d });
    await this.say(to, agentId, LEAD_ASK[next], "lead");
    return true;
  }

  private async leadSave(agentId: string, to: string, d: { name: string; phone: string | null; interest: string | null; status?: string | null; nextFollowUp?: string | null; note?: string | null }) {
    const conv = await this.loadConv(agentId, to);
    return this.proposeWrites(agentId, conv, to, [{
      type: "add_lead", name: d.name, phone: d.phone, interest: (d.interest as any) ?? null, status: (d.status as any) ?? null,
      follow_up_date: d.nextFollowUp ?? null, note: d.note ?? null, draft_kind: null, language: null, plans: null, question: null, policy_type: null,
    }]);
  }

  /* ══ Cover calculator (phase 1b) ══════════════════════════════════════ */

  private async calcStep(agentId: string, conv: Conv, to: string, text: string): Promise<boolean> {
    const p = conv.pending || {};
    const cs: CalcState = p.calc ?? { inputs: {}, customer: null, prefilled: [] };
    if (p.pickCustomer) {
      const opts: { id: string; name: string; phone: string | null; dob?: string | null; city?: string | null }[] = p.pickCustomer;
      const n = pickNumber(text, opts.length);
      if (!n) return false;
      const c = opts[n - 1];
      cs.customer = { id: c.id, name: c.name, phone: c.phone };
      prefillFromCustomer(cs, c, this.now());
      return this.calcAsk(agentId, conv, to, cs), true;
    }
    const step = calcNext(cs.inputs);
    if (step === "review") {
      if (isYes(text) || /^(yes|haan|calculate|go|ok|done|theek)\b/i.test(text)) { await this.calcFinish(agentId, conv, to, cs); return true; }
      const changed = calcChange(text, cs);
      if (changed) { await this.calcAsk(agentId, conv, to, cs); return true; }
      await this.say(to, agentId, "Reply YES to calculate, or CHANGE and what to fix, for example: change age", "calc");
      return true;
    }
    const err = calcAnswer(step, text, cs);
    if (err) { await this.say(to, agentId, err, "calc"); return true; }
    await this.calcAsk(agentId, conv, to, cs);
    return true;
  }

  /** Start the calculator, optionally for a named customer (pre-fills age and city, and the
   *  result is saved to them), taking anything the message already says. */
  private async calcStart(agentId: string, conv: Conv, to: string, text: string, customerName: string | null) {
    const cs: CalcState = { inputs: {}, customer: null, prefilled: [] };
    const name = customerName ?? (/\bfor\s+([A-Za-z][A-Za-z .]{1,40}?)(?:'s|\s+family|\s*$)/i.exec(text)?.[1] ?? null);
    if (name) {
      const matches = (await this.d.engine.searchCustomers(agentId, name)).filter((c) => nameMatches(name, c.name));
      if (matches.length > 1) {
        await this.setState(agentId, to, "AWAITING_CALC", conv.currentClientId, { calc: cs, pickCustomer: matches.slice(0, 6) });
        return this.say(to, agentId, `Which ${name}?\n${matches.slice(0, 6).map((m, i) => `${i + 1}) ${m.name}${m.phone ? ` · ${m.phone}` : ""}`).join("\n")}`, "calc");
      }
      if (matches.length === 1) {
        cs.customer = { id: matches[0].id, name: matches[0].name, phone: matches[0].phone };
        prefillFromCustomer(cs, matches[0] as any, this.now());
      } else {
        await this.say(to, agentId, `No customer called "${name}" in your book, so this won't be saved to a customer.`, "calc");
      }
    }
    prefillFromText(cs, text);
    const intro = cs.customer ? `Cover calculator for ${b(cs.customer.name)}.` : "Cover calculator.";
    return this.calcAsk(agentId, conv, to, cs, intro);
  }

  private async calcAsk(agentId: string, conv: Conv, to: string, cs: CalcState, intro = "") {
    const step = calcNext(cs.inputs);
    await this.setState(agentId, to, "AWAITING_CALC", conv.currentClientId, { calc: cs });
    return this.say(to, agentId, `${intro ? intro + "\n\n" : ""}${calcQuestion(step, cs)}`, "calc");
  }

  private async calcFinish(agentId: string, conv: Conv, to: string, cs: CalcState) {
    await this.rest(agentId, to, conv.currentClientId);
    const profile = await this.d.engine.profile(agentId);
    const result = calcRun(cs, profile.partneredCompanies);
    const uuid = await this.d.engine.saveCalculator(agentId, cs.inputs, result, cs.customer?.id ?? null);
    const url = `${this.d.links.origin}/calculator/report/${uuid}`;
    this.setLast(agentId, { kind: "calc", url, name: cs.customer?.name ?? null, phone: cs.customer?.phone ?? null, total: result.totalProtection, structure: structureLine(result) } as any);
    if (cs.customer) this.lastPerson.set(agentId, cs.customer.name);
    await this.rest(agentId, to, conv.currentClientId);
    return this.say(to, agentId, calcResultReply(this.d.links, cs, result, uuid), "calc_done");
  }

  /* ══ Compare (phase 1b, catalogue only: no model cost) ════════════════ */

  /** One typed plan name against the catalogue: a plan key, or a question to ask. */
  private comparePlan(name: string, catalog: CatalogPlan[]): string | CompareQ {
    const company = matchCompany(name, catalog);
    if (company) {
      const label = companyOptions(catalog).find((c) => c.key === company)?.label ?? company;
      return { q: label, kind: "plan", options: planOptions(catalog, company) };
    }
    const hits = matchPlans(name, catalog);
    if (hits.length === 1) return hits[0].plan_key;
    const opt = (h: CatalogPlan) => ({ key: h.plan_key, label: planLabel(h) });
    if (hits.length === 0) return { q: name, kind: "missing", options: suggestPlans(name, catalog).map(opt) };
    if (hits.length > 8) return { q: name, kind: "many", options: [] };
    return { q: name, kind: "pick", options: hits.map(opt) };
  }

  /** COMPARE, with or without plan names. Asks until there are two plans, and never drops
   *  the comparison because one name was not in the catalogue. */
  private async compareStart(agentId: string, conv: Conv, to: string, text: string, namesOver?: string[]) {
    const names = namesOver && namesOver.length ? namesOver : parseCompareNames(text);
    const catalog = names.length ? await this.d.engine.catalog(agentId) : [];
    const resolved: string[] = [];
    const queue: CompareQ[] = [];
    for (const name of names) {
      const r = this.comparePlan(name, catalog);
      if (typeof r === "string") resolved.push(r); else queue.push(r);
    }
    if (resolved.length + queue.length < 2) queue.push({ q: "", kind: "ask", options: [] });
    return this.compareContinue(agentId, conv, to, resolved, queue);
  }

  private async compareContinue(agentId: string, conv: Conv, to: string, resolved: string[], queue: CompareQ[]) {
    // Two different plans are needed; the same plan twice asks again.
    if (!queue.length && new Set(resolved).size < 2) {
      if (resolved.length >= 2) await this.say(to, agentId, "Those are the same plan. Pick a different one to compare.", "compare");
      resolved = [...new Set(resolved)];
      queue = [{ q: "", kind: "ask", options: [] }];
    }
    if (queue.length) {
      // "Which other plan?" is asked as a list: the company first, then its plans.
      if (queue[0].kind === "ask") {
        const companies = companyOptions(await this.d.engine.catalog(agentId));
        if (companies.length) queue = [{ q: "", kind: "company", options: companies }, ...queue.slice(1)];
      }
      const q = queue[0];
      await this.setState(agentId, to, "AWAITING_COMPARE_PICK", conv.currentClientId, { resolved, queue });
      const list = q.options.map((o, i) => `${i + 1}) ${o.label}`).join("\n");
      const msg =
        q.kind === "company" ? `Plan ${Math.min(resolved.length + 1, 2)} of 2: which company?\n${list}\nReply with the number, or type the plan name.`
        : q.kind === "plan" ? `Which ${q.q} plan?\n${list}\nReply with the number.`
        : q.kind === "ask" ? (resolved.length ? "Which plan should I compare it with? Type the plan name, for example: Care Supreme." : COMPARE_ASK)
        : q.kind === "many" ? `"${q.q}" matches too many plans. Type the insurer and plan name, for example: HDFC Optima Secure.`
        : q.kind === "missing" && q.options.length ? `"${q.q}" isn't in the plan catalogue yet. The closest ones:\n${list}\nReply with a number, or type another plan name.`
        : q.kind === "missing" ? `"${q.q}" isn't in the plan catalogue yet. Type another plan name, or CANCEL.`
        : `Which "${q.q}"?\n${list}\nReply with the number, or type another plan name.`;
      return this.say(to, agentId, msg, "compare_pick");
    }
    await this.rest(agentId, to, conv.currentClientId);
    const keys = [...new Set(resolved)];
    const r = await this.d.engine.compare(agentId, keys);
    this.setLast(agentId, { kind: "compare", url: `${this.d.links.origin}/compare/report/${r.uuid}`, names: r.names.filter(Boolean).join(" and ") });
    await this.rest(agentId, to, conv.currentClientId);
    return this.say(to, agentId, compareReply(this.d.links, r), "compare_done");
  }

  /* ══ CRM: lead updates ════════════════════════════════════════════════ */

  /** Returns false when the name matches no lead, so the text falls through to normal
   *  handling ("ok done" must not become "no lead called Ok"). */
  private async leadUpdateStart(agentId: string, conv: Conv, to: string, u: LeadUpdate): Promise<boolean> {
    // The search is a loose substring match; a typed name that changes data must match
    // word starts, so "ok done" can never touch "Alok".
    if (isPronounName(u.name)) {
      await this.say(to, agentId, "Who do you mean? Say it with the name, for example: Ramesh won", "clarify");
      return true;
    }
    let rows = (await this.d.engine.leadSearch(agentId, u.name)).filter((r) => nameMatches(u.name, r.name));
    // "Ramesh K." or "Sharma Ramesh": search on one word, then every typed word must fit.
    const first = u.name.split(/\s+/).find((w) => w.replace(/\W/g, "").length >= 3);
    if (!rows.length && first && first !== u.name) rows = (await this.d.engine.leadSearch(agentId, first)).filter((r) => nameMatches(u.name, r.name));
    // A dropped or doubled letter ("Rmesh won", "Rameesh won"): never a different letter, so
    // Rakesh is never read as Ramesh, Rohit never as Mohit, India never as Indra. Same first
    // letter, one name only, and the confirmation still shows the real name before YES.
    if (!rows.length && /^[a-z]{4,}$/i.test(u.name)) {
      const typed = u.name.toLowerCase();
      const pieces = [...new Set([typed.slice(0, 2), typed.slice(-3)])];
      const seen = new Map<string, LeadRow>();
      for (const p of pieces) for (const r of await this.d.engine.leadSearch(agentId, p).catch(() => [])) seen.set(r.id, r);
      const near = [...seen.values()].filter((r) => String(r.name || "").toLowerCase().split(/\s+/).some((w) => w[0] === typed[0] && oneLetterMissing(typed, w)));
      if (near.length === 1) {
        // The search above returns only a few rows: look the found first name up on its own,
        // so two people called Ramesh get the usual "Which Ramesh?" instead of a guess.
        const firstName = String(near[0].name || "").split(/\s+/)[0];
        const same = (await this.d.engine.leadSearch(agentId, firstName).catch(() => [])).filter((r) => nameMatches(firstName, r.name));
        rows = same.length > 1 ? same : near;
      } else if (near.length > 1) {
        rows = near; // several close names: always "Which one?", never a guess
      }
    }
    if (!rows.length) {
      // A follow-up or a note is clearly about a lead; a bare status word may not be.
      if (!u.nextFollowUp && !u.note) return false;
      await this.say(to, agentId, `I couldn't find a lead called "${u.name}". Add them with: lead ${u.name} 98xxxxxxxx health`, "lead_update");
      return true;
    }
    if (rows.length > 1) {
      await this.setState(agentId, to, "AWAITING_LEAD_PICK", conv.currentClientId, { rows, update: u });
      await this.say(to, agentId, `Which ${u.name}?\n${rows.map((r, i) => `${i + 1}) ${r.name}${r.phone ? ` · ${r.phone}` : ""} · ${r.status || "new"}`).join("\n")}`, "lead_pick");
      return true;
    }
    await this.leadApply(agentId, to, rows[0], u);
    return true;
  }

  private async leadApply(agentId: string, to: string, lead: LeadRow, u: LeadUpdate) {
    const conv = await this.loadConv(agentId, to);
    return this.confirm(agentId, conv, to, [{ kind: "update", leadId: lead.id, name: lead.name, phone: lead.phone, status: u.status ?? null, nextFollowUp: u.nextFollowUp ?? null, note: u.note ?? null }]);
  }

  /* ══ CRM: message drafts (portal templates) ═══════════════════════════ */

  private async draft(agentId: string, conv: Conv, to: string, text: string, over?: { kind: DraftKind | null; name: string | null; lang: Lang | null }) {
    const d = over ? (over.kind ? { kind: over.kind, name: over.name } : null) : parseDraft(text);
    if (!d) return this.say(to, agentId, "Which message, and for whom? For example: upgrade message for Santosh, or Diwali message for Ramesh.", "draft");
    const lang = over?.lang ?? langIn(text) ?? "english";
    const name = d.name;
    if (!name) {
      const last = this.lastShare.get(agentId);
      const clientId = last?.kind === "policy" ? last.clientId : conv.currentClientId;
      if (!clientId) return this.say(to, agentId, "Who is it for? For example: upgrade message for Santosh.", "draft");
      return this.draftForClient(agentId, to, clientId, d.kind, lang);
    }
    // Policy-based messages need a customer with a policy; the rest can go to a lead too.
    const clients = await this.d.engine.findClients(agentId, name);
    if (CLIENT_ONLY.includes(d.kind) || !clients.length) {
      if (clients.length === 1) return this.draftForClient(agentId, to, clients[0].clientId, d.kind, lang);
      if (clients.length > 1) return this.pickClient(agentId, to, conv.currentClientId, clients, { purpose: "draft", draftKind: d.kind, lang });
      if (CLIENT_ONLY.includes(d.kind)) return this.say(to, agentId, T.noSuchCustomer(name), "draft");
    } else if (clients.length === 1) {
      return this.draftForClient(agentId, to, clients[0].clientId, d.kind, lang);
    }
    const leads = (await this.d.engine.leadSearch(agentId, name)).filter((r) => nameMatches(name, r.name));
    if (!leads.length) return this.say(to, agentId, `I couldn't find "${name}" in your policies or leads.`, "draft");
    if (leads.length > 1) {
      await this.setState(agentId, to, "AWAITING_LEAD_PICK", conv.currentClientId, { rows: leads, draftKind: d.kind, lang });
      return this.say(to, agentId, `Which ${name}?\n${leads.map((r, i) => `${i + 1}) ${r.name}${r.phone ? ` · ${r.phone}` : ""}`).join("\n")}`, "lead_pick");
    }
    return this.sendDraft(agentId, to, { type: "lead", id: leads[0].id, name: leads[0].name, phone: leads[0].phone, interest: leads[0].insurance_interest }, d.kind, lang);
  }

  private async draftForClient(agentId: string, to: string, clientId: string, kind: DraftKind, lang: Lang) {
    const c = await this.d.engine.getClient(agentId, clientId);
    if (!c) return this.say(to, agentId, T.noReport(), "draft");
    this.setLast(agentId, { kind: "policy", clientId });
    return this.sendDraft(agentId, to, {
      type: "client", id: c.clientId, name: c.policyholderName, phone: c.customerPhone,
      insurer: c.insurer, renewalDate: c.expiryDate, weakPoint: c.weakPoint ?? null,
    }, kind, lang);
  }

  private async sendDraft(agentId: string, to: string, target: any, kind: DraftKind, lang: Lang) {
    if (target?.name) this.lastPerson.set(agentId, target.name);
    const profile = await this.d.engine.profile(agentId).catch(() => null);
    const draft = buildMessage(target, kind, lang, profile?.name ?? null);
    const link = waMeLink(target.phone, draft);
    const hint = lang === "english" ? "\n\nWant it in Hinglish or Hindi? Add: in hindi" : "";
    return this.say(to, agentId, shareReply(target.name, draft, link, /wa\.me\/\d/.test(link), false) + hint, "draft_done");
  }

  /* ══ CRM: surrender value ═════════════════════════════════════════════ */

  private async surrender(agentId: string, conv: Conv, to: string, text: string, nameOver?: string | null) {
    const name = nameOver !== undefined ? nameOver ?? "" : text.replace(/^.*?\b(surrender value|surrender|loan value|policy value|paid[\s-]?up value)\b\s*(of|for)?\s*/i, "").replace(/'s.*$/, "").trim();
    let candidates: ClientSummary[] = [];
    if (name.length >= 2) {
      candidates = (await this.d.engine.findClients(agentId, name)).filter((c) => VALUE_TYPES.includes(c.insuranceType || ""));
      if (!candidates.length) return this.say(to, agentId, `I couldn't find a life or term policy for "${name}". Surrender value is for life policies.`, "surrender");
    } else {
      const last = this.lastShare.get(agentId);
      const id = last?.kind === "policy" ? last.clientId : conv.currentClientId;
      const c = id ? await this.d.engine.getClient(agentId, id) : null;
      if (c && VALUE_TYPES.includes(c.insuranceType || "")) candidates = [c];
      else return this.say(to, agentId, "Whose policy? For example: surrender value Ramesh", "surrender");
    }
    if (candidates.length > 1) return this.pickClient(agentId, to, conv.currentClientId, candidates, { purpose: "ask", question: "surrender value" });
    const c = candidates[0];
    const full = c.extracted !== undefined ? c : await this.d.engine.getClient(agentId, c.clientId);
    if (!full) return this.say(to, agentId, T.noReport(), "surrender");
    this.setLast(agentId, { kind: "policy", clientId: full.clientId });
    return this.say(to, agentId, valueReply(this.d.links, full, this.now()), "surrender");
  }

  /* ══ The assistant: the model's form, carried out by code ═════════════ */

  private modelContext(agentId: string, conv: Conv): ModelContext {
    const last = this.lastShare.get(agentId);
    const change = this.lastChange.get(agentId);
    const PENDING: Partial<Record<State, string>> = {
      AWAITING_CALC: "calculator question", AWAITING_LEAD: "adding a lead", AWAITING_SHARE_LANG: "share: which language",
      AWAITING_CUSTOMER: "whose policy is this", AWAITING_CONFIRM: "confirm a change",
    };
    return {
      lastPerson: this.lastPerson.get(agentId) ?? null,
      lastItem: last ? (last.kind === "policy" ? "policy report" : last.kind === "calc" ? "calculator result" : "comparison") : null,
      pending: PENDING[conv.state] ?? null,
      lastChange: change && this.now() - change.at < UNDO_WINDOW_MS
        ? change.kind === "create" ? `added lead ${change.name}` : `updated lead ${change.name}`
        : null,
    };
  }

  private async dispatch(agentId: string, conv: Conv, to: string, text: string, u: Understanding) {
    const writes: Action[] = [];
    for (const a of u.actions) {
      // A name the model filled in that the advisor never typed (and no he/she/uska to point
      // at the last person) is dropped: a change is never aimed at someone by guesswork.
      if (a.name && !nameInMessage(a.name, text) && !PRONOUN.test(text)) a.name = null;
      if (a.type === "add_lead" || a.type === "update_lead") { writes.push(a); continue; }
      await this.runAction(agentId, conv, to, text, a, u.clarify);
    }
    if (writes.length) await this.proposeWrites(agentId, conv, to, writes);
  }

  private async runAction(agentId: string, conv: Conv, to: string, text: string, a: Action, clarify: string | null) {
    const e = this.d.engine;
    const lang = (a.language as Lang | null) ?? null;
    switch (a.type) {
      case "help": return this.menu(agentId, to, null, "help");
      case "cancel":
        await this.rest(agentId, to, conv.currentClientId);
        return this.say(to, agentId, T.cancelled(), "cancel");
      case "undo": return this.proposeUndo(agentId, conv, to);
      case "unknown": return clarify ? this.say(to, agentId, clarify, "unknown") : this.menu(agentId, to, "I didn't catch that.", "unknown");
      case "ask_report": return this.ask(agentId, conv, to, text, a.name);
      case "share": return this.shareStart(agentId, conv, to, text, { name: a.name, phone: a.phone, lang });
      case "renewals": return this.say(to, agentId, renewalsReply(await e.renewals(agentId), this.d.links), "renewals");
      case "followups": return this.showFollowups(agentId, to);
      case "list_leads": return this.say(to, agentId, leadsListReply(this.d.links, await e.leadsList(agentId)), "list_leads");
      case "checks": {
        const n = await e.checksLeft(agentId);
        return this.say(to, agentId, `You have ${b(String(n))} policy ${n === 1 ? "check" : "checks"} left.\n${n <= 0 ? `To get more: ${this.d.teamLink}` : "Next: send a health policy PDF to use one."}`, "checks");
      }
      case "views": {
        const rows = await e.views(agentId);
        const mine = a.name ? rows.filter((r) => nameMatches(a.name!, r.name)) : rows;
        if (a.name && !mine.length) return this.say(to, agentId, `${a.name} hasn't opened a shared report yet.`, "views");
        return this.say(to, agentId, viewsReply(mine), "views");
      }
      case "claims": return this.say(to, agentId, claimsReply(this.d.links, await e.claims(agentId, a.name), a.name), "claims");
      case "lookup": {
        const q = a.name || a.phone || "";
        if (!q) return this.say(to, agentId, "Who should I look up? For example: find Ramesh", "lookup");
        const r = await e.lookup(agentId, q);
        if (r.policies.length === 1) {
          // Same as the rule path: one policy found is now the one questions are about.
          this.setLast(agentId, { kind: "policy", clientId: r.policies[0].clientId });
          await this.rest(agentId, to, r.policies[0].clientId);
        }
        const person = r.policies[0]?.policyholderName || r.leads[0]?.name;
        if (person) this.lastPerson.set(agentId, person);
        return this.say(to, agentId, lookupReply(this.d.links, q, r.policies, r.leads), "lookup");
      }
      case "list_clients": {
        const type = typeIn(a.policy_type || text);
        return this.say(to, agentId, clientsReply(this.d.links, type, await e.policies(agentId, type)), "clients");
      }
      case "draft_message": return this.draft(agentId, conv, to, text, { kind: (a.draft_kind as DraftKind) ?? null, name: a.name, lang });
      case "calculator": return this.calcStart(agentId, conv, to, text, a.name);
      case "compare": return this.compareStart(agentId, conv, to, text, a.plans ?? []);
      case "surrender_value": return this.surrender(agentId, conv, to, text, a.name);
      case "website": return this.say(to, agentId, websiteReply(await e.profile(agentId), this.d.links), "website");
    }
  }

  /** Turn lead actions into concrete changes against the real book, then ask for YES.
   *  add of someone who already exists becomes an update; update of someone unknown
   *  becomes an add (said plainly); two matches get a numbered pick. */
  private async proposeWrites(agentId: string, conv: Conv, to: string, actions: Action[], pre: Op[] = []) {
    const ops = [...pre];
    for (let k = 0; k < actions.length; k++) {
      const a = actions[k];
      if (!a.name && !a.phone) {
        if (a.type === "add_lead") {
          await this.setState(agentId, to, "AWAITING_LEAD", conv.currentClientId, { step: "name", draft: { name: null, phone: a.phone, interest: a.interest } });
          return this.say(to, agentId, LEAD_ASK.name, "lead");
        }
        return this.say(to, agentId, "Which lead? For example: Ramesh won, or follow up Ramesh Friday.", "lead_update");
      }
      const found = await this.d.engine.leadSearch(agentId, a.name || a.phone!);
      const rows = found.filter((r) => (a.name ? nameMatches(a.name, r.name) : (r.phone || "").endsWith(a.phone!)));
      const changes = !!(a.status || a.follow_up_date || a.note);
      if (a.type === "add_lead") {
        const same = rows.filter((r) => (a.phone && (r.phone || "").endsWith(a.phone)) || normName(r.name) === normName(a.name));
        // "lead Ramesh won" with exactly one Ramesh in the book and no new number: that is
        // Ramesh, not a second Ramesh. (The YES step still shows exactly who.)
        if (!same.length && !a.phone && changes && rows.length === 1) same.push(rows[0]);
        if (same.length === 1 && changes) {
          ops.push({ kind: "update", leadId: same[0].id, name: same[0].name, phone: same[0].phone, status: a.status, nextFollowUp: a.follow_up_date, note: a.note });
          continue;
        }
        if (same.length >= 1 && !changes) {
          await this.say(to, agentId, `${b(same[0].name)} is already in your leads.\n${this.d.links.origin}/agent/leads/${same[0].id}`, "lead_exists");
          continue;
        }
        ops.push({ kind: "create", name: a.name || "Unnamed", phone: a.phone, interest: a.interest, status: a.status, nextFollowUp: a.follow_up_date, note: a.note });
        continue;
      }
      // update_lead
      if (!rows.length) {
        ops.push({ kind: "create", name: a.name!, phone: a.phone, interest: a.interest, status: a.status, nextFollowUp: a.follow_up_date, note: a.note, notFound: true });
        continue;
      }
      if (rows.length > 1) {
        await this.setState(agentId, to, "AWAITING_LEAD_PICK", conv.currentClientId, { rows, pendingAction: a, resolvedOps: ops, restActions: actions.slice(k + 1) });
        return this.say(to, agentId, `Which ${a.name}?\n${rows.map((r, i) => `${i + 1}) ${r.name}${r.phone ? ` · ${r.phone}` : ""} · ${r.status || "new"}`).join("\n")}`, "lead_pick");
      }
      ops.push({ kind: "update", leadId: rows[0].id, name: rows[0].name, phone: rows[0].phone, status: a.status, nextFollowUp: a.follow_up_date, note: a.note });
    }
    if (ops.length) return this.confirm(agentId, conv, to, ops);
  }

  private describe(op: Op): string {
    const ph = (p: string | null) => (p ? `${p.slice(0, 5)} ${p.slice(5)}` : null);
    if (op.kind === "undo") {
      const c = op.change;
      if (c.kind === "bulk") return `Undo: put ${c.items.length} ${allLeads(c) ? "leads" : "changes"} back as they were`;
      if (c.kind === "create") return `Undo: remove the lead ${b(c.name)} you just added`;
      if (c.kind === "customerCreate") return `Undo: remove the customer ${b(c.name)} you just added`;
      if (c.kind === "convert") return `Undo: make ${b(c.name)} a lead again`;
      if (c.kind === "edit") return `Undo: ${FIELD_LABEL[c.field]} of ${b(c.name)} back to ${showValue(c.field, c.from)}`;
      if (c.kind === "file") return `Undo: put ${c.name} back where it was filed`;
      if (c.kind === "policyEdit") return `Undo: ${c.label} of ${c.name} back to ${showPolicyValue(c.vkind, c.from)}`;
      if (c.kind === "sharing") return `Undo: share ${c.name} again (same link)`;
      if (c.kind === "claimCreate") return `Undo: remove the claim you just opened for ${b(c.name)}`;
      if (c.kind === "claimEdit") return `Undo: ${CLAIM_LABELS[c.key]} of ${c.name} back to ${showClaimValue(c.key, c.from)}`;
      if (c.kind === "claimStage") return `Undo: ${c.name} back to "${CLAIM_STAGE[c.from]}"`;
      if (c.kind === "claimAnswered") return `Undo: query round ${c.seq} on ${c.name} open again`;
      return `Undo: put ${b(c.name)} back as it was`;
    }
    if (op.kind === "edit") return `${b(op.name)} (${op.target}): ${FIELD_LABEL[op.field]} ${showValue(op.field, op.from)} → ${showValue(op.field, op.to)}`;
    if (op.kind === "policyEdit") return `${op.policy}: ${op.label} ${showPolicyValue(op.vkind, op.from)} → ${showPolicyValue(op.vkind, op.to)}`;
    if (op.kind === "claimOpen") return `Open a ${op.claimType} claim for ${b(op.name)}`;
    if (op.kind === "claimEdit") return `${op.name}: ${CLAIM_LABELS[op.key]} ${showClaimValue(op.key, op.from)} → ${showClaimValue(op.key, op.to)}`;
    if (op.kind === "claimStage") return `${op.name}: "${CLAIM_STAGE[op.from]}" → "${CLAIM_STAGE[op.to]}"`;
    if (op.kind === "claimQuery") return `${op.name}: log the insurer's query "${op.question}". The claim moves to "Insurer query open". There is no undo for this; remove it in the portal if needed`;
    if (op.kind === "claimAnswered") return `${op.name}: query round ${op.seq} ("${op.question}") answered`;
    if (op.kind === "claimExtend") return `${op.name}: keep the documents 30 more days. This is the one extension and can't be undone`;
    if (op.kind === "sharing") return `Stop sharing ${op.policy}. The customer's link stops opening until you share it again`;
    if (op.kind === "convert") return `Make ${b(op.name)} a customer. Their phone, email, city and notes are copied, and the lead is marked won`;
    if (op.kind === "addCustomer") return `Add customer ${b(op.name)}${[op.phone ? ph(op.phone) : null, op.city, op.email].filter(Boolean).map((x) => `, ${x}`).join("")}`;
    if (op.kind === "file") {
      if (op.newCustomer) return `Add customer ${b(op.newCustomer.name)}${op.newCustomer.phone ? `, ${ph(op.newCustomer.phone)}` : ""} and file ${op.policy} under them`;
      if (!op.toId) return `Take ${op.policy} out of ${b(op.fromName || "its customer")}`;
      return `File ${op.policy} under ${b(op.toName)}${op.fromName ? ` (now under ${op.fromName})` : ""}`;
    }
    const bits = [
      op.status && !(op.kind === "create" && op.status === "new") ? `mark ${op.status}` : null,
      op.nextFollowUp ? `follow-up ${prettyDate(op.nextFollowUp)}` : null,
      op.note ? `note "${op.note}"` : null,
    ].filter(Boolean);
    if (op.kind === "create") {
      const extra = [ph(op.phone), op.interest, ...bits].filter(Boolean).join(", ");
      return `${op.notFound ? `No lead called ${b(op.name)} yet. ` : ""}Add lead ${b(op.name)}${extra ? `: ${extra}` : ""}`;
    }
    return `${b(op.name)}${op.phone ? ` (${ph(op.phone)})` : ""}: ${bits.join(", ")}`;
  }

  private async confirm(agentId: string, conv: Conv, to: string, ops: Op[]) {
    await this.setState(agentId, to, "AWAITING_CONFIRM", conv.currentClientId, { ops });
    const lines = ops.map((o) => `• ${this.describe(o)}`);
    return this.say(to, agentId, `Please confirm:\n${lines.join("\n")}\n\nReply YES to save, or NO.`, "confirm_ask");
  }

  private async confirmYes(agentId: string, conv: Conv, to: string) {
    const ops: Op[] = conv.pending?.ops || [];
    await this.rest(agentId, to, conv.currentClientId);
    const out: string[] = [];
    const changes: LastChange[] = [];
    for (const op of ops) {
      if (op.kind === "create") {
        const r = await this.d.engine.createLead(agentId, { name: op.name, phone: op.phone, interest: op.interest, status: op.status, nextFollowUp: op.nextFollowUp, note: op.note });
        if (!r.duplicateOf) changes.push({ kind: "create", leadId: r.id, name: op.name, created: r.created, at: this.now() });
        this.lastPerson.set(agentId, r.duplicateOf ?? op.name);
        out.push(leadSavedReply(this.d.links, r, { name: op.name, phone: op.phone, interest: op.interest }));
      } else if (op.kind === "update") {
        const r = await this.d.engine.leadUpdate(agentId, op.leadId, { status: op.status ?? undefined, nextFollowUp: op.nextFollowUp ?? undefined, note: op.note ?? undefined });
        changes.push({
          kind: "update", leadId: op.leadId, name: r.lead.name,
          before: { status: r.before.status, next_follow_up: r.before.next_follow_up, notes: r.before.notes },
          after: { status: r.lead.status, next_follow_up: r.lead.next_follow_up, notes: r.lead.notes }, at: this.now(),
        });
        this.lastPerson.set(agentId, r.lead.name);
        out.push(leadUpdatedReply(this.d.links, r.lead, { name: op.name, status: op.status ?? undefined, nextFollowUp: op.nextFollowUp ?? undefined, note: op.note ?? undefined }));
      } else if (op.kind === "undo") {
        const c = op.change;
        const ok = await this.undoOne(agentId, c);
        this.lastChange.delete(agentId);
        out.push(!ok ? "That can't be undone here any more: it was changed since, or something was added to it. Please fix it in the portal."
          : c.kind === "bulk" ? `Undone: ${c.items.length} ${allLeads(c) ? "leads" : "changes"} are back as they were.`
          : c.kind === "create" ? `Undone: removed the lead ${b(c.name)}.`
          : c.kind === "customerCreate" ? `Undone: removed the customer ${b(c.name)}.`
          : c.kind === "claimCreate" ? `Undone: removed the claim for ${b(c.name)}.`
          : c.kind === "convert" ? `Undone: ${b(c.name)} is a lead again.${this.takeUndoNote(agentId)}`
          : `Undone: ${b(c.name)} is back as it was.`);
      } else {
        const r = await this.applyEdit(agentId, op);
        out.push(r.text);
        if (r.change) changes.push(r.change);
      }
    }
    if (changes.length === 1) this.lastChange.set(agentId, changes[0]);
    else if (changes.length > 1) this.lastChange.set(agentId, { kind: "bulk", items: changes, name: `${changes.length} leads`, at: this.now() });
    await this.saveConv(agentId, { state: conv.currentClientId ? "REPORT_READY" : "IDLE", currentClientId: conv.currentClientId, pending: { to }, updatedAt: null });
    return this.say(to, agentId, out.join("\n\n") + (ops.some((o) => !["undo", "claimQuery", "claimExtend"].includes(o.kind)) ? "\n\n(Wrong? Reply UNDO within 15 minutes.)" : ""), "confirm_saved");
  }

  /** The follow-up list, remembered so "sabke reminders 1st November" means these leads. */
  private readonly lastFollowups = new Map<string, LeadRow[]>();

  private async showFollowups(agentId: string, to: string) {
    const rows = await this.d.engine.followups(agentId);
    this.lastFollowups.set(agentId, rows);
    return this.say(to, agentId, followupsReply(this.d.links, rows), "followups");
  }

  /** One new follow-up date for every lead on the follow-up list, after one YES. */
  private async bulkFollowUp(agentId: string, conv: Conv, to: string, u: { nextFollowUp?: string; status?: string }) {
    const rows = this.lastFollowups.get(agentId) ?? (await this.d.engine.followups(agentId));
    if (!rows.length) return this.say(to, agentId, "There are no follow-ups due to move. Set one with: follow up Ramesh Friday", "bulk_none");
    return this.confirm(agentId, conv, to, rows.slice(0, 30).map((r) => ({
      kind: "update" as const, leadId: r.id, name: r.name, phone: r.phone, status: u.status ?? null, nextFollowUp: u.nextFollowUp ?? null, note: null,
    })));
  }

  /* ══ Stage 2a: edits to leads, customers and filing ══════════════════ */

  /** A plain extra line for the undo reply ("the customer stays"), said once. */
  private readonly undoNote = new Map<string, string>();
  private takeUndoNote(agentId: string): string {
    const n = this.undoNote.get(agentId);
    this.undoNote.delete(agentId);
    return n ? `\n${n}` : "";
  }

  /** Put one saved change back. Every route checks first that nothing moved since. A batch is
   *  undone newest first, one at a time, so a later step never blocks an earlier one. */
  private async undoOne(agentId: string, x: LastChange): Promise<boolean> {
    const e = this.d.engine;
    switch (x.kind) {
      case "create": return e.leadUndoCreate(agentId, x.leadId, x.created);
      case "update": return !!(await e.leadRestore(agentId, x.leadId, x.before, x.after));
      case "bulk": {
        let all = true;
        for (const item of [...x.items].reverse()) all = (await this.undoOne(agentId, item)) && all;
        return all;
      }
      case "edit": {
        const r = x.target === "lead"
          ? await e.leadEdit(agentId, x.id, { [x.field]: x.from }, { [x.field]: x.to }, true, x.token)
          : await e.customerEdit(agentId, x.id, { [x.field]: x.from }, { [x.field]: x.to }, true, x.token);
        return r.ok;
      }
      case "convert": {
        const r = await e.leadUnconvert(agentId, x.leadId, x.customerId, x.status);
        if (r.ok && !r.customerRemoved) this.undoNote.set(agentId, `The customer ${b(x.name)} stays: something was added to it or it was changed. Remove it in the portal if needed.`);
        return r.ok;
      }
      case "customerCreate": return e.customerUndoCreate(agentId, x.customerId, x.created);
      case "file": return (await e.fileClient(agentId, x.clientId, x.fromId, x.toId)).ok;
      case "policyEdit":
        return x.group === "fix"
          ? (await e.policyFieldSave(agentId, x.clientId, { [x.key]: x.from }, x.rev ?? -1, { expect: { [x.key]: x.to }, token: x.token })).ok
          : (await e.clientDetailSave(agentId, x.clientId, { [x.key]: x.from }, { [x.key]: x.to }, true, x.token)).ok;
      case "sharing": return (await e.setSharing(agentId, x.clientId, !x.enabled, x.enabled)).ok;
      case "claimCreate": return e.claimUndoCreate(agentId, x.claimId, x.created);
      case "claimEdit": return (await e.claimEdit(agentId, x.claimId, { [x.key]: x.from }, { [x.key]: x.to }, true, x.token)).ok;
      case "claimStage": return (await e.claimStage(agentId, x.claimId, x.from, x.to, true, x.token)).ok;
      case "claimAnswered": return (await e.claimReopenQuery(agentId, x.claimId, x.seq, x.resolvedOn, x.moved, x.token)).ok;
    }
  }

  /** Save one confirmed stage 2a change. A refusal is said plainly; never "saved" unless it was. */
  private async applyEdit(agentId: string, op: Op): Promise<{ text: string; change?: LastChange }> {
    const e = this.d.engine;
    const o = this.d.links.origin;
    const refused = (name: string, r: { reason: string; fields?: Record<string, string> }) =>
      r.reason === "CHANGED" ? `Not saved: ${b(name)} was changed in the portal a moment ago. Ask again to see the latest.`
      : r.reason === "INVALID" ? `Not saved: ${Object.values(r.fields || {}).join(", ") || "that value"}.`
      : r.reason === "ALREADY_CUSTOMER" ? `${b(name)} is already a customer.`
      : `Not saved: I couldn't find ${b(name)} any more.`;
    const at = this.now();
    if (op.kind === "edit") {
      const set = { [op.field]: op.to };
      const expect = { [op.field]: op.from };
      const r = op.target === "lead" ? await e.leadEdit(agentId, op.id, set, expect) : await e.customerEdit(agentId, op.id, set, expect);
      if (!r.ok) return { text: refused(op.name, r) };
      this.lastPerson.set(agentId, op.name);
      const link = `${o}/agent/${op.target === "lead" ? "leads" : "customers"}/${op.id}`;
      return {
        text: `✅ Saved. ${b(op.name)}: ${FIELD_LABEL[op.field]} is now ${showValue(op.field, op.to)}.\n${link}`,
        change: { kind: "edit", target: op.target, id: op.id, name: op.name, field: op.field, from: op.from, to: op.to, token: r.undoToken, at },
      };
    }
    if (op.kind === "convert") {
      const r = await e.leadConvert(agentId, op.leadId);
      if (!r.ok) return { text: refused(op.name, r) };
      this.lastPerson.set(agentId, op.name);
      return {
        text: `✅ ${b(op.name)} is now a customer.\n${o}/agent/customers/${r.customer.id}`,
        change: { kind: "convert", leadId: op.leadId, customerId: r.customer.id, name: op.name, status: r.before.status, at },
      };
    }
    if (op.kind === "addCustomer") {
      const r = await e.customerCreate(agentId, { name: op.name, phone: op.phone, city: op.city, email: op.email });
      if (!r.ok) return { text: refused(op.name, r) };
      this.lastPerson.set(agentId, r.customer.name);
      if (r.duplicate) return { text: `${b(r.customer.name)} is already your customer, with that phone number.\n${o}/agent/customers/${r.customer.id}` };
      return {
        text: `✅ Customer ${b(r.customer.name)} added.\n${o}/agent/customers/${r.customer.id}`,
        change: { kind: "customerCreate", customerId: r.customer.id, name: r.customer.name, created: createdOf(r.customer), at },
      };
    }
    if (op.kind === "file") {
      let toId = op.toId;
      let toName = op.toName;
      let created: LastChange | null = null;
      if (op.newCustomer) {
        const c = await e.customerCreate(agentId, { name: op.newCustomer.name, phone: op.newCustomer.phone });
        if (!c.ok) return { text: refused(op.newCustomer.name, c) };
        toId = c.customer.id;
        toName = c.customer.name;
        if (!c.duplicate) created = { kind: "customerCreate", customerId: c.customer.id, name: c.customer.name, created: createdOf(c.customer), at };
      }
      const r = await e.fileClient(agentId, op.clientId, toId, op.fromId);
      if (!r.ok) {
        if (created) await this.undoOne(agentId, created); // the customer was only for this filing
        return { text: refused(op.policy, r) };
      }
      const filed: LastChange = { kind: "file", clientId: op.clientId, name: op.policy, fromId: op.fromId, toId, at };
      return {
        text: toId ? `✅ Filed: ${op.policy} is now under ${b(toName)}.\n${o}/agent/customers/${toId}` : `✅ ${op.policy} is no longer filed under ${b(op.fromName || "that customer")}.`,
        change: created ? { kind: "bulk", items: [created, filed], name: op.policy, at } : filed,
      };
    }
    if (op.kind === "policyEdit") {
      const link = `${o}/agent/policies/${op.clientId}`;
      const no = (r: { reason: string; fields?: Record<string, string> }) =>
        ({ text: r.reason === "NOT_EDITABLE" ? `Not saved: ${op.policy} has details that are only in the portal. Please change it there.
${link}` : refused(op.policy, r) });
      let before: unknown = op.from;
      let after: unknown;
      let token: string | undefined;
      let rev: number | undefined;
      if (op.group === "fix") {
        const r = await e.policyFieldSave(agentId, op.clientId, { [op.key]: op.to }, op.rev);
        if (!r.ok) return no(r);
        [before, after, token, rev] = [r.before[op.key] ?? null, r.after[op.key] ?? null, r.undoToken, r.rev];
      } else {
        const r = await e.clientDetailSave(agentId, op.clientId, { [op.key]: op.to }, { [op.key]: op.from });
        if (!r.ok) return no(r);
        [after, token] = [r.after[op.key] ?? null, r.undoToken];
      }
      return {
        text: `✅ Saved. ${op.policy}: ${op.label} is now ${showPolicyValue(op.vkind, after)}.\n${link}`,
        change: { kind: "policyEdit", clientId: op.clientId, name: op.policy, group: op.group, key: op.key, label: op.label, vkind: op.vkind, from: before, to: after, token, rev, at },
      };
    }
    if (op.kind.startsWith("claim")) return this.applyClaim(agentId, op, refused, at);
    if (op.kind === "sharing") {
      const r = await e.setSharing(agentId, op.clientId, op.enabled, !op.enabled);
      if (!r.ok) return { text: refused(op.policy, r) };
      return {
        text: `✅ Sharing stopped for ${op.policy}. The customer's link no longer opens.\nTo share it again, ask me to share it. The link stays the same.`,
        change: { kind: "sharing", clientId: op.clientId, name: op.policy, enabled: op.enabled, at },
      };
    }
    return { text: "" };
  }

  /** Leads and customers whose name fits, for "which one?". */
  private async editTargets(agentId: string, who: string, kinds: ("lead" | "customer")[] = ["lead", "customer"]): Promise<EditTarget[]> {
    const out: EditTarget[] = [];
    if (kinds.includes("lead")) {
      for (const l of (await this.d.engine.leadSearch(agentId, who)).filter((r) => nameMatches(who, r.name))) {
        out.push({ kind: "lead", id: l.id, name: l.name, label: `${l.name}, lead${l.phone ? ` · ${l.phone}` : ""}` });
      }
    }
    if (kinds.includes("customer")) {
      for (const c of (await this.d.engine.searchCustomers(agentId, who)).filter((r) => nameMatches(who, r.name))) {
        out.push({ kind: "customer", id: c.id, name: c.name, label: `${c.name}, customer${c.phone ? ` · ${c.phone}` : ""}` });
      }
    }
    return out.slice(0, 6);
  }

  private async pickTarget(agentId: string, conv: Conv, to: string, targets: EditTarget[], extra: Record<string, unknown>) {
    await this.setState(agentId, to, "AWAITING_EDIT_PICK", conv.currentClientId, { targets, ...extra });
    return this.say(to, agentId, `Which one?\n${targets.map((t, i) => `${i + 1}) ${t.label}`).join("\n")}\nReply with the number.`, "edit_pick");
  }

  /** "change Amit's phone to ...", "edit Amit", "Amit ka city Pune kar do". */
  private async editStart(agentId: string, conv: Conv, to: string, text: string) {
    const ask = parseEditAsk(text);
    if (!ask) return this.say(to, agentId, "Type it like: change Amit's phone to 98123 45678, or: edit Amit", "edit");
    const targets = await this.editTargets(agentId, ask.who);
    if (!targets.length) return this.say(to, agentId, `I couldn't find a lead or customer called "${ask.who}".`, "edit");
    if (targets.length > 1) return this.pickTarget(agentId, conv, to, targets, { mode: "edit", field: ask.field, value: ask.value });
    return this.editWith(agentId, conv, to, targets[0], ask.field, ask.value);
  }

  private async editRow(agentId: string, t: EditTarget): Promise<Record<string, any> | null> {
    return t.kind === "lead" ? this.d.engine.leadGet(agentId, t.id) : this.d.engine.customerGet(agentId, t.id);
  }

  private async editWith(agentId: string, conv: Conv, to: string, t: EditTarget, field: Field | null, value: string | null) {
    const row = await this.editRow(agentId, t);
    if (!row) return this.say(to, agentId, `I couldn't find ${b(t.name)} any more.`, "edit");
    const fields = t.kind === "lead" ? LEAD_FIELDS : CUSTOMER_FIELDS;
    if (field && !fields.includes(field)) {
      return this.say(to, agentId, `${FIELD_LABEL[field]} is not kept for a ${t.kind}. For ${b(t.name)} you can change: ${fields.map((f) => FIELD_LABEL[f]).join(", ")}.`, "edit");
    }
    if (!field) {
      await this.setState(agentId, to, "AWAITING_EDIT_FIELD", conv.currentClientId, { target: t });
      return this.say(to, agentId,
        `What should I change for ${b(t.name)} (${t.kind})?\n${fields.map((f, i) => `${i + 1}) ${FIELD_LABEL[f]}: ${showValue(f, row[f])}`).join("\n")}\nReply with the number.`,
        "edit_field");
    }
    if (value === null) {
      await this.setState(agentId, to, "AWAITING_EDIT_VALUE", conv.currentClientId, { target: t, field });
      return this.say(to, agentId, `Type the new ${FIELD_LABEL[field]} for ${b(t.name)}. Now: ${showValue(field, row[field])}\n(Or NONE to clear it, CANCEL to stop.)`, "edit_value");
    }
    return this.proposeEdit(agentId, conv, to, t, row, field, value);
  }

  private async proposeEdit(agentId: string, conv: Conv, to: string, t: EditTarget, row: Record<string, any>, field: Field, raw: string) {
    const v = valueFor(field, raw);
    const clean = (t.kind === "lead" ? cleanLeadSet : cleanCustomerSet)({ [field]: v });
    if (clean.errors[field]) {
      await this.setState(agentId, to, "AWAITING_EDIT_VALUE", conv.currentClientId, { target: t, field });
      return this.say(to, agentId, `That ${FIELD_LABEL[field]} doesn't look right (${clean.errors[field]}). Type it again, or CANCEL.`, "edit_value");
    }
    const next = clean.set[field] ?? null;
    if (normValue(next) === normValue(row[field])) {
      await this.rest(agentId, to, conv.currentClientId);
      return this.say(to, agentId, `${b(t.name)}'s ${FIELD_LABEL[field]} is already ${showValue(field, next)}. Nothing to change.`, "edit");
    }
    return this.confirm(agentId, conv, to, [{ kind: "edit", target: t.kind, id: t.id, name: t.name, field, from: row[field] ?? null, to: next }]);
  }

  /** "make Amit a customer". */
  private async convertStart(agentId: string, conv: Conv, to: string, text: string) {
    const who = parseConvert(text);
    if (!who) return this.say(to, agentId, "Type it like: make Amit a customer", "convert");
    const targets = await this.editTargets(agentId, who, ["lead"]);
    if (!targets.length) return this.say(to, agentId, `I couldn't find a lead called "${who}".`, "convert");
    if (targets.length > 1) return this.pickTarget(agentId, conv, to, targets, { mode: "convert" });
    return this.convertWith(agentId, conv, to, targets[0]);
  }

  private async convertWith(agentId: string, conv: Conv, to: string, t: EditTarget) {
    const lead = await this.d.engine.leadGet(agentId, t.id);
    if (!lead) return this.say(to, agentId, `I couldn't find ${b(t.name)} any more.`, "convert");
    if (lead.customer_id) return this.say(to, agentId, `${b(lead.name)} is already a customer.\n${this.d.links.origin}/agent/customers/${lead.customer_id}`, "convert");
    return this.confirm(agentId, conv, to, [{ kind: "convert", leadId: lead.id, name: lead.name }]);
  }

  /** "add customer Sunita Rao 98123 45678, Pune". */
  private async addCustomerStart(agentId: string, conv: Conv, to: string, text: string) {
    const a = parseAddCustomer(text);
    if (!a?.name) return this.say(to, agentId, "Type it like: add customer Sunita Rao 98123 45678, Pune", "addcustomer");
    const clean = cleanCustomerSet({ name: a.name, ...(a.phone ? { phone: a.phone } : {}), ...(a.email ? { email: a.email } : {}), ...(a.city ? { city: a.city } : {}) });
    const errs = Object.values(clean.errors);
    if (errs.length) return this.say(to, agentId, `That doesn't look right (${errs.join(", ")}). Type it like: add customer Sunita Rao 98123 45678, Pune`, "addcustomer");
    return this.confirm(agentId, conv, to, [{ kind: "addCustomer", name: String(clean.set.name), phone: (clean.set.phone as string) ?? null, city: (clean.set.city as string) ?? null, email: (clean.set.email as string) ?? null }]);
  }

  /** "file Ramesh's policy under Sunita", "this is Sunita's", "new customer from this policy", "unfile this policy". */
  private async fileStart(agentId: string, conv: Conv, to: string, text: string) {
    const ask = parseFile(text);
    if (!ask) return this.say(to, agentId, "Type it like: file Ramesh's policy under Sunita", "file");
    const policyOf = ask.kind === "newCustomer" ? null : ask.policyOf;
    if (policyOf) {
      const found = await this.d.engine.findClients(agentId, policyOf);
      if (!found.length) return this.say(to, agentId, T.noSuchCustomer(policyOf), "file");
      if (found.length > 1) {
        await this.setState(agentId, to, "AWAITING_FILE_PICK", conv.currentClientId, { ask, step: "policy", options: found.slice(0, 5).map((c) => c.clientId) });
        return this.say(to, agentId, T.whichPolicy(found.slice(0, 5).map((r) => ({ name: r.policyholderName || "Unnamed", label: nicePlan(r.insurer, r.policyName) || r.insuranceType || "policy" }))), "file_pick");
      }
      return this.fileWith(agentId, conv, to, ask, found[0].clientId, null);
    }
    const last = this.lastShare.get(agentId);
    const current = last?.kind === "policy" ? last.clientId : conv.currentClientId;
    if (!current) return this.say(to, agentId, "Which policy? For example: file Ramesh's policy under Sunita", "file");
    return this.fileWith(agentId, conv, to, ask, current, null);
  }

  private async fileWith(agentId: string, conv: Conv, to: string, ask: FileAsk, clientId: string, customerId: string | null) {
    const c = await this.d.engine.getClient(agentId, clientId);
    if (!c) return this.say(to, agentId, T.noReport(), "file");
    const policy = `${c.policyholderName ? `${c.policyholderName}'s ` : ""}${nicePlan(c.insurer, c.policyName) || "policy"}`;
    const from = c.customerId ? await this.d.engine.customerGet(agentId, c.customerId) : null;
    if (ask.kind === "unfile") {
      if (!c.customerId) return this.say(to, agentId, `${policy} is not filed under any customer.`, "file");
      return this.confirm(agentId, conv, to, [{ kind: "file", clientId, policy, fromId: c.customerId, fromName: from?.name ?? null, toId: null, toName: null }]);
    }
    if (ask.kind === "newCustomer") {
      if (!c.policyholderName) return this.say(to, agentId, "This policy has no policyholder name to make a customer from. Type it like: add customer Sunita Rao 98123 45678", "file");
      return this.confirm(agentId, conv, to, [{
        kind: "file", clientId, policy, fromId: c.customerId, fromName: from?.name ?? null, toId: null, toName: c.policyholderName,
        newCustomer: { name: c.policyholderName, phone: c.customerPhone ?? null },
      }]);
    }
    let target = customerId ? await this.d.engine.customerGet(agentId, customerId) : null;
    if (!target) {
      const matches = (await this.d.engine.searchCustomers(agentId, ask.customer)).filter((m) => nameMatches(ask.customer, m.name));
      if (!matches.length) return this.say(to, agentId, `No customer called "${ask.customer}" yet. Add them first: add customer ${ask.customer}`, "file");
      if (matches.length > 1) {
        await this.setState(agentId, to, "AWAITING_FILE_PICK", conv.currentClientId, { ask, step: "customer", clientId, options: matches.slice(0, 6).map((m) => m.id) });
        return this.say(to, agentId, `Which customer?\n${matches.slice(0, 6).map((m, i) => `${i + 1}) ${m.name}${m.phone ? ` · ${m.phone}` : ""}`).join("\n")}\nReply with the number.`, "file_pick");
      }
      target = await this.d.engine.customerGet(agentId, matches[0].id);
      if (!target) return this.say(to, agentId, `I couldn't find "${ask.customer}" any more.`, "file");
    }
    if (c.customerId === target.id) return this.say(to, agentId, `${policy} is already filed under ${b(target.name)}.`, "file");
    return this.confirm(agentId, conv, to, [{ kind: "file", clientId, policy, fromId: c.customerId, fromName: from?.name ?? null, toId: target.id, toName: target.name }]);
  }

  /** The stage 2a questions: which one, which field, the new value, which policy or customer. */
  private async onEditAwaiting(agentId: string, conv: Conv, to: string, text: string): Promise<boolean> {
    const p = conv.pending || {};
    if (p.mode === "policy" || p.mode === "unshare") return this.onPolicyAwaiting(agentId, conv, to, text);
    if (["claim", "claimcust", "claimtype", "claimquery"].includes(p.mode)) return this.onClaimAwaiting(agentId, conv, to, text);
    if (conv.state === "AWAITING_EDIT_PICK") {
      const targets: EditTarget[] = p.targets || [];
      const n = pickNumber(text, targets.length);
      if (!n) return false;
      if (p.mode === "convert") await this.convertWith(agentId, conv, to, targets[n - 1]);
      else await this.editWith(agentId, conv, to, targets[n - 1], p.field ?? null, p.value ?? null);
      return true;
    }
    if (conv.state === "AWAITING_EDIT_FIELD") {
      const t: EditTarget = p.target;
      const fields = t.kind === "lead" ? LEAD_FIELDS : CUSTOMER_FIELDS;
      const n = pickNumber(text, fields.length);
      const f = n ? fields[n - 1] : fieldOf(text);
      if (!f || !fields.includes(f)) { await this.say(to, agentId, `Reply with a number from 1 to ${fields.length}, or CANCEL.`, "edit_field"); return true; }
      await this.editWith(agentId, conv, to, t, f, null);
      return true;
    }
    if (conv.state === "AWAITING_EDIT_VALUE") {
      const t: EditTarget = p.target;
      const row = await this.editRow(agentId, t);
      if (!row) { await this.rest(agentId, to, conv.currentClientId); await this.say(to, agentId, `I couldn't find ${b(t.name)} any more.`, "edit"); return true; }
      await this.proposeEdit(agentId, conv, to, t, row, p.field, text);
      return true;
    }
    if (conv.state === "AWAITING_FILE_PICK") {
      const options: string[] = p.options || [];
      const n = pickNumber(text, options.length);
      if (!n) return false;
      if (p.step === "policy") await this.fileWith(agentId, conv, to, p.ask, options[n - 1], null);
      else await this.fileWith(agentId, conv, to, p.ask, p.clientId, options[n - 1]);
      return true;
    }
    return false;
  }

  /* ══ Stage 2b: policies ═══════════════════════════════════════════════ */

  /** The policies a name (and an optional "car", "life" ...) points at. */
  private async policiesOf(agentId: string, who: string, typeWord: string | null): Promise<ClientSummary[]> {
    const ty = typeOfWord(typeWord);
    const found = await this.d.engine.findClients(agentId, who);
    return ty ? found.filter((c) => policyKind(c.insuranceType) === ty) : found;
  }

  /** "premium is 14,500 not 15,400", "change Ramesh's car policy premium to 14500", "edit this policy". */
  private async policyFixStart(agentId: string, conv: Conv, to: string, text: string) {
    const ask = parsePolicyFix(text);
    if (!ask) return this.say(to, agentId, "Type it like: premium is 14,500, or: edit this policy", "policyfix");
    if (ask.policyOf) {
      const found = await this.policiesOf(agentId, ask.policyOf, ask.typeWord);
      if (!found.length) return this.say(to, agentId, T.noSuchCustomer(ask.policyOf), "policyfix");
      if (found.length > 1) return this.pickPolicy(agentId, conv, to, found, { mode: "policy", word: ask.word, value: ask.value });
      return this.policyFixWith(agentId, conv, to, found[0].clientId, ask.word, ask.value);
    }
    const current = this.currentPolicy(agentId, conv);
    if (!current) return this.say(to, agentId, "Which policy? For example: change Ramesh's car policy premium to 14500", "policyfix");
    return this.policyFixWith(agentId, conv, to, current, ask.word, ask.value);
  }

  private async pickPolicy(agentId: string, conv: Conv, to: string, found: ClientSummary[], extra: Record<string, unknown>) {
    const rows = found.slice(0, 5);
    await this.setState(agentId, to, "AWAITING_EDIT_PICK", conv.currentClientId, { ...extra, options: rows.map((c) => c.clientId) });
    return this.say(to, agentId, T.whichPolicy(rows.map((r) => ({ name: r.policyholderName || "Unnamed", label: nicePlan(r.insurer, r.policyName) || r.insuranceType || "policy" }))), "policy_pick");
  }

  /** The policy, its editable fields and what it is called in replies. */
  private async policyEditable(agentId: string, clientId: string): Promise<{ f: PolicyFields; t: PolicyTarget; list: PField[] } | null> {
    const [f, c] = await Promise.all([this.d.engine.policyFields(agentId, clientId), this.d.engine.getClient(agentId, clientId)]);
    if (!f || !c) return null;
    return { f, t: { clientId, policy: policyLabel(c) }, list: policyFieldList(f) };
  }

  private async policyFixWith(agentId: string, conv: Conv, to: string, clientId: string, word: string | null, value: string | null) {
    const p = await this.policyEditable(agentId, clientId);
    if (!p) return this.say(to, agentId, T.noReport(), "policyfix");
    this.setLast(agentId, { kind: "policy", clientId });
    const { f, t, list } = p;
    if (!word) {
      await this.setState(agentId, to, "AWAITING_EDIT_FIELD", conv.currentClientId, { mode: "policy", ptarget: t });
      return this.say(to, agentId,
        `What should I change on ${t.policy}?\n${list.map((x, i) => `${i + 1}) ${x.label}: ${showPolicyValue(x.kind, currentOf(f, x))}`).join("\n")}\nReply with the number.`,
        "policy_field");
    }
    const pf = policyFieldFor(f, list, word);
    if (!pf) {
      const labels = list.map((x) => x.label).join(", ");
      return this.say(to, agentId, f.fields.length
        ? `${capital(word)} can't be changed from WhatsApp. On ${t.policy} you can change: ${labels}.`
        : `On a health policy, the details come from the policy check and can't be changed here. You can change: ${labels}.`, "policyfix");
    }
    return this.policyFieldChosen(agentId, conv, to, t, f, pf, value);
  }

  private async policyFieldChosen(agentId: string, conv: Conv, to: string, t: PolicyTarget, f: PolicyFields, pf: PField, value: string | null) {
    if (value === null) {
      await this.setState(agentId, to, "AWAITING_EDIT_VALUE", conv.currentClientId, { mode: "policy", ptarget: t, pkey: pf.key });
      return this.say(to, agentId, `Type the new ${pf.label} for ${t.policy}. Now: ${showPolicyValue(pf.kind, currentOf(f, pf))}\n(CANCEL to stop.)`, "policy_value");
    }
    const raw = policyValueFor(pf.kind, value);
    let next: unknown = null;
    let err: string | undefined;
    if (pf.group === "client") {
      const c = cleanClientSet({ [pf.key]: raw });
      err = c.errors[pf.key];
      next = c.set[pf.key] ?? null;
    } else {
      const c = cleanFixValue(pf.kind as FixKind, raw);
      if (!c.ok) err = c.error;
      else if (c.value === null) err = "a value is needed";
      else next = c.value;
    }
    if (err) {
      await this.setState(agentId, to, "AWAITING_EDIT_VALUE", conv.currentClientId, { mode: "policy", ptarget: t, pkey: pf.key });
      return this.say(to, agentId, `That ${pf.label} doesn't look right (${err}). Type it again, or CANCEL.`, "policy_value");
    }
    const from = currentOf(f, pf);
    if (normValue(next) === normValue(from)) {
      await this.rest(agentId, to, conv.currentClientId);
      return this.say(to, agentId, `${t.policy}: ${pf.label} is already ${showPolicyValue(pf.kind, next)}. Nothing to change.`, "policyfix");
    }
    return this.confirm(agentId, conv, to, [{ kind: "policyEdit", clientId: t.clientId, policy: t.policy, group: pf.group, key: pf.key, label: pf.label, vkind: pf.kind, from, to: next, rev: f.rev }]);
  }

  /** "stop sharing Ramesh's report", "unshare this". Only the switch moves; the link stays. */
  private async unshareStart(agentId: string, conv: Conv, to: string, text: string) {
    const ask = parseUnshare(text);
    if (ask?.policyOf) {
      const found = (await this.policiesOf(agentId, ask.policyOf, null)).filter((c) => c.shareToken);
      if (!found.length) return this.say(to, agentId, `I couldn't find a shared report for "${ask.policyOf}".`, "unshare");
      if (found.length > 1) return this.pickPolicy(agentId, conv, to, found, { mode: "unshare" });
      return this.unshareWith(agentId, conv, to, found[0].clientId);
    }
    const current = this.currentPolicy(agentId, conv);
    if (!current) return this.say(to, agentId, "Which report should I stop sharing? For example: stop sharing Ramesh's report", "unshare");
    return this.unshareWith(agentId, conv, to, current);
  }

  private async unshareWith(agentId: string, conv: Conv, to: string, clientId: string) {
    const c = await this.d.engine.getClient(agentId, clientId);
    if (!c) return this.say(to, agentId, T.noReport(), "unshare");
    const policy = policyLabel(c);
    if (!c.shareToken) return this.say(to, agentId, `${policy} is not being shared. Nothing to stop.`, "unshare");
    return this.confirm(agentId, conv, to, [{ kind: "sharing", clientId, policy, enabled: false }]);
  }

  /** The stage 2b questions: which policy, which field, the new value. */
  private async onPolicyAwaiting(agentId: string, conv: Conv, to: string, text: string): Promise<boolean> {
    const p = conv.pending || {};
    if (conv.state === "AWAITING_EDIT_PICK") {
      const options: string[] = p.options || [];
      const n = pickNumber(text, options.length);
      if (!n) return false;
      if (p.mode === "unshare") await this.unshareWith(agentId, conv, to, options[n - 1]);
      else await this.policyFixWith(agentId, conv, to, options[n - 1], p.word ?? null, p.value ?? null);
      return true;
    }
    const t: PolicyTarget = p.ptarget;
    const ed = await this.policyEditable(agentId, t.clientId);
    if (!ed) { await this.rest(agentId, to, conv.currentClientId); await this.say(to, agentId, T.noReport(), "policyfix"); return true; }
    if (conv.state === "AWAITING_EDIT_FIELD") {
      const n = pickNumber(text, ed.list.length);
      const pf = n ? ed.list[n - 1] : policyFieldFor(ed.f, ed.list, text.trim().toLowerCase());
      if (!pf) { await this.say(to, agentId, `Reply with a number from 1 to ${ed.list.length}, or CANCEL.`, "policy_field"); return true; }
      await this.policyFieldChosen(agentId, conv, to, ed.t, ed.f, pf, null);
      return true;
    }
    if (conv.state === "AWAITING_EDIT_VALUE") {
      const pf = ed.list.find((x) => x.key === p.pkey);
      if (!pf) { await this.rest(agentId, to, conv.currentClientId); await this.say(to, agentId, T.noReport(), "policyfix"); return true; }
      await this.policyFieldChosen(agentId, conv, to, ed.t, ed.f, pf, text);
      return true;
    }
    return false;
  }

  /* ══ Stage 2c: claims ═════════════════════════════════════════════════ */

  /** The claim last worked on, so "query answered" right after means that claim. */
  private readonly lastClaim = new Map<string, string>();

  /** "open a claim for Sunita", "Sunita's claim submitted", "insurer wants X for Sunita's claim". */
  private async claimStart(agentId: string, conv: Conv, to: string, text: string) {
    const ask = parseClaimAsk(text);
    if (!ask) return this.say(to, agentId, "Type it like: open a claim for Sunita, or: Sunita's claim submitted", "claimedit");
    if (ask.kind === "open") return this.claimOpenStart(agentId, conv, to, ask.who, ask.claimType);
    if (ask.kind === "close") {
      return this.say(to, agentId, `Settling or rejecting a claim is done in the portal, where you attach the insurer's letter.\n${this.d.links.origin}/agent/claims`, "claimedit");
    }
    if (ask.who) {
      const rows = (await this.d.engine.claims(agentId, ask.who)).filter((r) => r.customer_name && nameMatches(ask.who!, r.customer_name));
      const open = rows.filter((r) => !CLAIM_TERMINAL.includes(r.status));
      if (!rows.length) return this.say(to, agentId, `I couldn't find a claim for "${ask.who}".`, "claimedit");
      if (!open.length) return this.say(to, agentId, `${rows[0].customer_name}'s claim is closed. Change it in the portal.\n${this.d.links.origin}/agent/claims/${rows[0].id}`, "claimedit");
      if (open.length > 1) {
        const opts = open.slice(0, 6);
        await this.setState(agentId, to, "AWAITING_EDIT_PICK", conv.currentClientId, { mode: "claim", ask, options: opts.map((r) => r.id) });
        return this.say(to, agentId,
          `Which claim?\n${opts.map((r, i) => `${i + 1}) ${r.customer_name}${r.hospital ? ` · ${r.hospital}` : ""} · ${CLAIM_STAGE[r.status] ?? r.status}`).join("\n")}\nReply with the number.`,
          "claim_pick");
      }
      return this.claimWith(agentId, conv, to, open[0].id, ask);
    }
    const last = this.lastClaim.get(agentId);
    if (!last) return this.say(to, agentId, "Which claim? For example: Sunita's claim submitted", "claimedit");
    return this.claimWith(agentId, conv, to, last, ask);
  }

  private async claimWith(agentId: string, conv: Conv, to: string, id: string, ask: ClaimAsk) {
    const row = await this.d.engine.claimRow(agentId, id);
    if (!row) return this.say(to, agentId, "I couldn't find that claim any more.", "claimedit");
    this.lastClaim.set(agentId, id);
    const c = row.claim;
    const name = claimName(c);
    if (CLAIM_TERMINAL.includes(c.status)) return this.say(to, agentId, `${name} is closed. Change it in the portal.\n${this.d.links.origin}/agent/claims/${id}`, "claimedit");
    if (ask.kind === "stage") {
      if (c.status === ask.to) return this.say(to, agentId, `${name} is already at "${CLAIM_STAGE[ask.to]}". Nothing to change.`, "claimedit");
      return this.confirm(agentId, conv, to, [{ kind: "claimStage", claimId: id, name, from: c.status, to: ask.to }]);
    }
    if (ask.kind === "query") return this.confirm(agentId, conv, to, [{ kind: "claimQuery", claimId: id, name, question: ask.question, from: c.status }]);
    if (ask.kind === "answered") {
      const open = row.openQueries;
      if (!open.length) return this.say(to, agentId, `${name} has no open insurer query.`, "claimedit");
      if (open.length > 1) {
        await this.setState(agentId, to, "AWAITING_EDIT_PICK", conv.currentClientId, { mode: "claimquery", claimId: id, name, options: open.map((q) => ({ seq: q.seq, question: q.question })) });
        return this.say(to, agentId, `Which query was answered?\n${open.map((q, i) => `${i + 1}) Round ${q.seq}: ${q.question}`).join("\n")}\nReply with the number.`, "claim_pick");
      }
      return this.confirm(agentId, conv, to, [{ kind: "claimAnswered", claimId: id, name, seq: open[0].seq, question: open[0].question }]);
    }
    if (ask.kind === "extend") {
      const d = await this.d.engine.claim(agentId, id).catch(() => null);
      if (!d?.canExtend) return this.say(to, agentId, "Documents can be kept 30 more days only once, in the last 5 days before they are deleted, while the claim is open.", "claimedit");
      return this.confirm(agentId, conv, to, [{ kind: "claimExtend", claimId: id, name }]);
    }
    if (ask.kind === "edit") {
      if (!ask.word) {
        await this.setState(agentId, to, "AWAITING_EDIT_FIELD", conv.currentClientId, { mode: "claim", ctarget: { id, name } });
        return this.say(to, agentId,
          `What should I change on ${name}?\n${CLAIM_FIELDS.map((k, i) => `${i + 1}) ${CLAIM_LABELS[k]}: ${showClaimValue(k, (c as Record<string, unknown>)[k])}`).join("\n")}\nReply with the number.`,
          "claim_field");
      }
      const key = claimKeyOf(ask.word);
      if (!key) return this.say(to, agentId, `${capital(ask.word)} can't be changed from WhatsApp.`, "claimedit");
      return this.claimFieldChosen(agentId, conv, to, { id, name }, row, key, ask.value);
    }
    return this.say(to, agentId, "Type it like: Sunita's claim submitted", "claimedit");
  }

  private async claimFieldChosen(agentId: string, conv: Conv, to: string, t: { id: string; name: string }, row: ClaimEditRow, key: string, value: string | null) {
    const from = (row.claim as Record<string, unknown>)[key] ?? null;
    if (value === null) {
      await this.setState(agentId, to, "AWAITING_EDIT_VALUE", conv.currentClientId, { mode: "claim", ctarget: t, ckey: key });
      return this.say(to, agentId, `Type the new ${CLAIM_LABELS[key]} for ${t.name}. Now: ${showClaimValue(key, from)}\n(CANCEL to stop.)`, "claim_value");
    }
    const c = cleanClaimSet({ [key]: claimValueFor(key, value) });
    if (c.errors[key]) {
      await this.setState(agentId, to, "AWAITING_EDIT_VALUE", conv.currentClientId, { mode: "claim", ctarget: t, ckey: key });
      return this.say(to, agentId, `That ${CLAIM_LABELS[key]} doesn't look right (${c.errors[key]}). Type it again, or CANCEL.`, "claim_value");
    }
    const next = c.set[key];
    const same = key === "claimed_amount" ? from !== null && Number(from) === Number(next) : normValue(from) === normValue(next);
    if (same) {
      await this.rest(agentId, to, conv.currentClientId);
      return this.say(to, agentId, `${t.name}: ${CLAIM_LABELS[key]} is already ${showClaimValue(key, next)}. Nothing to change.`, "claimedit");
    }
    return this.confirm(agentId, conv, to, [{ kind: "claimEdit", claimId: t.id, name: t.name, key, from, to: next }]);
  }

  /** A claim needs an existing customer: a new person is added first ("add customer X"), so it shows and can be undone. */
  private async claimOpenStart(agentId: string, conv: Conv, to: string, who: string, claimType: "cashless" | "reimbursement" | null) {
    const custs = (await this.d.engine.searchCustomers(agentId, who)).filter((c) => nameMatches(who, c.name));
    if (!custs.length) return this.say(to, agentId, `No customer called "${who}" yet. Add them first: add customer ${who}`, "claimedit");
    if (custs.length > 1) {
      const opts = custs.slice(0, 6);
      await this.setState(agentId, to, "AWAITING_EDIT_PICK", conv.currentClientId, { mode: "claimcust", claimType, options: opts.map((c) => ({ id: c.id, name: c.name })) });
      return this.say(to, agentId, `Which customer?\n${opts.map((c, i) => `${i + 1}) ${c.name}${c.phone ? ` · ${c.phone}` : ""}`).join("\n")}\nReply with the number.`, "claim_pick");
    }
    return this.claimOpenFor(agentId, conv, to, custs[0].id, custs[0].name, claimType);
  }

  private async claimOpenFor(agentId: string, conv: Conv, to: string, customerId: string, name: string, claimType: "cashless" | "reimbursement" | null) {
    if (!claimType) {
      await this.setState(agentId, to, "AWAITING_EDIT_PICK", conv.currentClientId, { mode: "claimtype", customerId, name, options: ["cashless", "reimbursement"] });
      return this.say(to, agentId, `Is ${name}'s claim cashless or reimbursement?\n1) Cashless\n2) Reimbursement\nReply with the number.`, "claim_type");
    }
    return this.confirm(agentId, conv, to, [{ kind: "claimOpen", customerId, name, claimType }]);
  }

  /** The stage 2c questions: which claim, customer, type or query; which field; the new value. */
  private async onClaimAwaiting(agentId: string, conv: Conv, to: string, text: string): Promise<boolean> {
    const p = conv.pending || {};
    if (conv.state === "AWAITING_EDIT_PICK") {
      if (p.mode === "claimtype") {
        const w = text.trim().toLowerCase();
        const n = pickNumber(text, 2) ?? (/^cash/.test(w) ? 1 : /^reimb|^refund/.test(w) ? 2 : null);
        if (!n) return false;
        await this.claimOpenFor(agentId, conv, to, p.customerId, p.name, n === 1 ? "cashless" : "reimbursement");
        return true;
      }
      const options: any[] = p.options || [];
      const n = pickNumber(text, options.length);
      if (!n) return false;
      if (p.mode === "claimcust") await this.claimOpenFor(agentId, conv, to, options[n - 1].id, options[n - 1].name, p.claimType ?? null);
      else if (p.mode === "claimquery") await this.confirm(agentId, conv, to, [{ kind: "claimAnswered", claimId: p.claimId, name: p.name, seq: options[n - 1].seq, question: options[n - 1].question }]);
      else await this.claimWith(agentId, conv, to, options[n - 1], p.ask);
      return true;
    }
    const t: { id: string; name: string } = p.ctarget;
    const row = await this.d.engine.claimRow(agentId, t.id);
    if (!row) { await this.rest(agentId, to, conv.currentClientId); await this.say(to, agentId, "I couldn't find that claim any more.", "claimedit"); return true; }
    if (conv.state === "AWAITING_EDIT_FIELD") {
      const n = pickNumber(text, CLAIM_FIELDS.length);
      const key = n ? CLAIM_FIELDS[n - 1] : claimKeyOf(text);
      if (!key) { await this.say(to, agentId, `Reply with a number from 1 to ${CLAIM_FIELDS.length}, or CANCEL.`, "claim_field"); return true; }
      await this.claimFieldChosen(agentId, conv, to, t, row, key, null);
      return true;
    }
    if (conv.state === "AWAITING_EDIT_VALUE") {
      await this.claimFieldChosen(agentId, conv, to, t, row, p.ckey, text);
      return true;
    }
    return false;
  }

  /** Save one confirmed claim change. A refusal is said plainly; never "saved" unless it was. */
  private async applyClaim(agentId: string, op: Op, refused: (name: string, r: { reason: string; fields?: Record<string, string> }) => string, at: number): Promise<{ text: string; change?: LastChange }> {
    const e = this.d.engine;
    const o = this.d.links.origin;
    const no = (name: string, r: { reason: string; fields?: Record<string, string> }, link: string) =>
      r.reason === "CLOSED" ? `Not saved: ${name} is closed. Change it in the portal.\n${link}`
      : r.reason === "CANNOT_EXTEND" ? `Not saved: ${name}'s documents can't be kept longer now. It has had its one extension, or it is not yet in the last 5 days.\n${link}`
      : refused(name, r);
    if (op.kind === "claimOpen") {
      const r = await e.claimOpen(agentId, op.customerId, { claim_type: op.claimType });
      if (!r.ok) return { text: refused(op.name, r) };
      this.lastClaim.set(agentId, r.claim.id);
      this.lastPerson.set(agentId, op.name);
      return {
        text: `✅ Claim opened for ${b(op.name)} (${op.claimType}).\nAdd its details like: ${op.name}'s claim hospital is Apollo\n${o}/agent/claims/${r.claim.id}`,
        change: { kind: "claimCreate", claimId: r.claim.id, name: op.name, created: r.created, at },
      };
    }
    if (!("claimId" in op)) return { text: "" };
    const link = `${o}/agent/claims/${op.claimId}`;
    this.lastClaim.set(agentId, op.claimId);
    if (op.kind === "claimEdit") {
      const r = await e.claimEdit(agentId, op.claimId, { [op.key]: op.to }, { [op.key]: op.from });
      if (!r.ok) return { text: no(op.name, r, link) };
      const after = r.after[op.key] ?? op.to;
      return {
        text: `✅ Saved. ${op.name}: ${CLAIM_LABELS[op.key]} is now ${showClaimValue(op.key, after)}.\n${link}`,
        change: { kind: "claimEdit", claimId: op.claimId, name: op.name, key: op.key, from: op.from, to: after, token: r.undoToken, at },
      };
    }
    if (op.kind === "claimStage") {
      const r = await e.claimStage(agentId, op.claimId, op.to, op.from);
      if (!r.ok) return { text: no(op.name, r, link) };
      return {
        text: `✅ ${op.name} is now at "${CLAIM_STAGE[op.to]}".\n${link}`,
        change: { kind: "claimStage", claimId: op.claimId, name: op.name, from: op.from, to: op.to, token: r.undoToken, at },
      };
    }
    if (op.kind === "claimQuery") {
      const r = await e.claimQuery(agentId, op.claimId, op.question, op.from);
      if (!r.ok) return { text: no(op.name, r, link) };
      return { text: `✅ Query round ${r.seq} logged on ${op.name}. When you have replied to the insurer, type: ${op.name} query answered\n${link}` };
    }
    if (op.kind === "claimAnswered") {
      const r = await e.claimAnswered(agentId, op.claimId, op.seq);
      if (!r.ok) return { text: no(op.name, r, link) };
      const after = r.moved ? ` It is back at "${CLAIM_STAGE.under_process}".` : r.openLeft ? ` ${r.openLeft} more query still open.` : "";
      return {
        text: `✅ Query round ${op.seq} on ${op.name} is answered.${after}\n${link}`,
        change: { kind: "claimAnswered", claimId: op.claimId, name: op.name, seq: op.seq, resolvedOn: r.resolvedOn, moved: r.moved, token: r.undoToken, at },
      };
    }
    if (op.kind === "claimExtend") {
      const r = await e.claimExtend(agentId, op.claimId);
      if (!r.ok) return { text: no(op.name, r, link) };
      return { text: `✅ ${op.name}: documents kept 30 more days, until ${prettyDate(r.purgeOn)}. That was its one extension.\n${link}` };
    }
    return { text: "" };
  }

  private async proposeUndo(agentId: string, conv: Conv, to: string) {
    const c = this.lastChange.get(agentId);
    if (!c || this.now() - c.at > UNDO_WINDOW_MS) {
      return this.say(to, agentId, "There's nothing recent to undo. I can undo a change for 15 minutes after it's saved.", "undo_none");
    }
    return this.confirm(agentId, conv, to, [{ kind: "undo", change: c }]);
  }
}

/** The values a customer was created with: UNDO removes it only if it still holds exactly these. */
function createdOf(c: { name: string; phone: string | null; email: string | null; city: string | null; dob: string | null }) {
  return { name: c.name, phone: c.phone ?? null, email: c.email ?? null, city: c.city ?? null, dob: c.dob ?? null };
}

/** A field's value as the advisor reads it in a confirm. */
function showValue(field: Field, v: unknown): string {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (field === "expected_value") { const n = Number(v); return Number.isFinite(n) ? `₹${n.toLocaleString("en-IN")}` : String(v); }
  if (field === "dob") return normValue(v) ?? String(v);
  return String(v);
}

/** A batch made only of lead changes keeps the older wording ("3 leads"), which is translated. */
function allLeads(c: { items: { kind: string }[] }): boolean {
  return c.items.every((x) => x.kind === "create" || x.kind === "update");
}

/* ── Stage 2b helpers ── */

/** A policy as the bot names it in replies: "Ramesh Kumar's Care Supreme". */
function policyLabel(c: ClientSummary): string {
  return `${c.policyholderName ? `${c.policyholderName}'s ` : ""}${nicePlan(c.insurer, c.policyName) || c.insuranceType || "policy"}`;
}

/** "car" -> motor, "home" -> property ... (null = any type). */
function typeOfWord(w: string | null): string | null {
  if (!w) return null;
  if (/^(?:car|bike|two wheeler|motor|vehicle)$/.test(w)) return "motor";
  if (/^(?:home|house|property)$/.test(w)) return "property";
  if (/^(?:health|mediclaim)$/.test(w)) return "health";
  return w;
}
function policyKind(t: string | null | undefined): string {
  const k = t || "health";
  return k === "fire" ? "property" : k;
}

const CLIENT_LABEL: Record<string, string> = { policyholder_name: "Policyholder name", client_phone: "Phone", client_email: "Email", policy_identifier: "Policy number" };

/** Every field the advisor may change on this policy, in the order shown: client details
 *  first (any type), then the saved details of a non-health policy. On health the policy
 *  number is the row's own column; elsewhere it is a saved detail. */
function policyFieldList(f: PolicyFields): PField[] {
  const keys = ["policyholder_name", "client_phone", "client_email", ...(f.fields.length ? [] : ["policy_identifier"])];
  return [
    ...keys.map((k): PField => ({ group: "client", key: k, label: CLIENT_LABEL[k], kind: "client" })),
    ...f.fields.map((x): PField => ({ group: "fix", key: x.key, label: x.label, kind: x.kind })),
  ];
}

function policyFieldFor(f: PolicyFields, list: PField[], word: string): PField | null {
  const ck = clientKeyOf(word);
  if (ck) return list.find((x) => x.key === ck) ?? null;
  if (!f.fields.length && /^policy (?:number|no\.?|num)$/.test(word)) return list.find((x) => x.key === "policy_identifier") ?? null;
  const fx = policyFieldOf(f.type, word);
  if (!fx) return null;
  // A motor policy with an own-damage date offers that date in place of the plain expiry.
  return list.find((x) => x.group === "fix" && x.key === fx.key)
    ?? (fx.key === "policy_expiry_date" ? list.find((x) => x.key === "od_expiry_date") ?? null : null);
}

function currentOf(f: PolicyFields, pf: PField): unknown {
  return pf.group === "client" ? (f.client as Record<string, unknown>)[pf.key] ?? null : f.fields.find((x) => x.key === pf.key)?.value ?? null;
}

function showPolicyValue(kind: PField["kind"], v: unknown): string {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (kind === "money") { const n = Number(v); return Number.isFinite(n) ? `₹${n.toLocaleString("en-IN")}` : String(v); }
  if (kind === "percent") return `${v}%`;
  if (kind === "date") { const s = normValue(v); return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? prettyDate(s) : String(v); }
  return String(v);
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ── Stage 2c helpers ── */

/** Claim stages as the portal's spine names them (lib/claims.ts CLAIM_SPINE). */
const CLAIM_STAGE: Record<string, string> = {
  opened: "Claim opened", docs_received: "Documents received", submitted: "Submitted to insurer",
  under_process: "Claim under process", query_raised: "Insurer query open", settled: "Settled", rejected: "Rejected",
};

function claimName(c: { customer_name: string | null }): string {
  return c.customer_name ? `${c.customer_name}'s claim` : "This claim";
}

function showClaimValue(key: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (key === "claimed_amount") { const n = Number(v); return Number.isFinite(n) ? `₹${n.toLocaleString("en-IN")}` : String(v); }
  if (key === "admitted_on" || key === "discharged_on") { const s = normValue(v); return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? prettyDate(s) : String(v); }
  if (key === "claim_type") return String(v) === "cashless" ? "Cashless" : String(v) === "reimbursement" ? "Reimbursement" : String(v);
  return String(v);
}

/** A claim value as typed -> as the server stores it (it checks again). */
function claimValueFor(key: string, raw: string): unknown {
  const v = raw.trim();
  if (key === "claimed_amount") return amountWords(v) ?? v;
  if (key === "admitted_on" || key === "discharged_on") return anyDate(v) ?? v;
  if (key === "claim_type") return /^cash/i.test(v) ? "cashless" : /^reimb|^refund/i.test(v) ? "reimbursement" : v;
  return v;
}
