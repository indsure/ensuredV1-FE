/**
 * Baileys adapter (unofficial WhatsApp Web client). See brief §3 for the ban risk and why
 * this runs on a dedicated SIM that nobody uses as their own WhatsApp.
 *
 * What this adapter owns: the socket, pairing, reconnecting, and turning Baileys message
 * objects into InboundMessage. It makes no decisions about who gets a reply.
 *
 * Staying connected (see reliability.ts for the parts):
 * - Every reconnect gets a fresh socket; events from an older socket are ignored, so a stale
 *   socket can never answer a message twice.
 * - A failed reconnect is retried (with backoff) until it works. It used to give up silently
 *   while pm2 still showed the process as online.
 * - Down longer than `restartAfterMs`: `onStuck` is called (index.ts exits, pm2 restarts us).
 * - Logged out / banned: no retry loop, an ALERT line, a human has to pair again.
 * - All sends go through one paced queue and wait out a short disconnect.
 * - Sent messages are kept for a day so a phone that could not decrypt one gets it resent.
 */

import makeWASocket, {
  BufferJSON,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  initAuthCreds,
  makeCacheableSignalKeyStore,
  proto,
  type WAMessage,
  type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";
import type { InboundMessage, Transport } from "./types.js";
import { SendQueue, SentStore, TtlCache, snapshotAuthDir, useSafeAuthState, withTimeout } from "./reliability.js";
import { log } from "../log.js";

const PN_SUFFIX = "@s.whatsapp.net";

/** Messages older than this at reconnect are not answered (a reply a day late is noise). */
const MAX_BACKLOG_MS = 12 * 60 * 60 * 1000;
/** How long a send waits for the socket to come back before it fails. */
const SEND_WAIT_MS = 90_000;
/** WhatsApp says another client took this session over. Wait longer before trying again. */
const REPLACED_WAIT_MS = 60_000;
/** Taken over this many times in a row: another copy of the bot is running. Stop, do not fight
 *  it (two clients grabbing one session back and forth is a ban-risk pattern). */
const MAX_REPLACED = 3;
/** One send (a big document upload included) may take this long before it fails. */
const SEND_TIMEOUT_MS = 120_000;

export type BaileysOptions = {
  authDir: string;
  /** Called when the socket has been down longer than `downAlertMs`. */
  onDownTooLong?: (downForMs: number) => void;
  downAlertMs?: number;
  /** Called when the socket has been down longer than `restartAfterMs` (default 5 min) and
   *  reconnecting has not fixed it. index.ts exits so pm2 starts a clean process. */
  onStuck?: (downForMs: number) => void;
  restartAfterMs?: number;
  /** Smallest gap between two outgoing messages, plus up to `sendJitterMs` random extra. */
  sendGapMs?: number;
  sendJitterMs?: number;
  /** When set (E.164 digits) and the session is not yet paired, log an 8-character pairing
   *  code instead of relying on the QR. On the phone: Linked devices > Link a device >
   *  "Link with phone number instead". Easier than scanning a QR out of a server log. */
  pairPhone?: string;
};

/** Phone number digits from a JID, or null for LIDs, groups, broadcasts. */
function pnFromJid(jid: string | null | undefined): string | null {
  if (!jid || !jid.endsWith(PN_SUFFIX)) return null;
  const d = jid.slice(0, -PN_SUFFIX.length).split(":")[0];
  return /^\d{8,15}$/.test(d) ? d : null;
}

export class BaileysTransport implements Transport {
  private sock: WASocket | null = null;
  private handler: ((m: InboundMessage) => Promise<void>) | null = null;
  private open = false;
  /** Bumped for every new socket. Events carry the number of the socket they came from. */
  private gen = 0;
  /** Set when WhatsApp logged the session out: nothing reconnects until a human re-pairs. */
  private stopped = false;
  private downSince: number | null = null;
  private downTimer: NodeJS.Timeout | null = null;
  private stuckTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private retry = 0;
  private replaced = 0;
  /** The login is paired. Until it is, nobody may be at the phone yet, so no auto-restart. */
  private registered = false;
  private pairingRequested = false;
  private readyWaiters: Array<() => void> = [];
  private readonly logger = pino({ level: "warn" }) as any;
  private readonly retryCounter = new TtlCache(10 * 60 * 1000);
  private readonly sent = new SentStore<proto.IMessage>();
  private readonly queue: SendQueue;

  constructor(private readonly opts: BaileysOptions) {
    this.queue = new SendQueue({
      minGapMs: opts.sendGapMs ?? 700,
      jitterMs: opts.sendJitterMs ?? 500,
      waitUntilReady: () => this.waitUntilReady(SEND_WAIT_MS),
      sendTimeoutMs: SEND_TIMEOUT_MS,
    });
    // Down from the start until the first "open", so the alert and the restart cover a
    // process that never manages to connect at all.
    this.markDown();
  }

  onMessage(handler: (m: InboundMessage) => Promise<void>): void {
    this.handler = handler;
  }

  async start(): Promise<void> {
    if (this.stopped) return;
    const myGen = ++this.gen;
    this.dropSocket();
    this.pairingRequested = false; // each new socket gets a fresh code; old ones expire

    const { state, saveCreds } = await useSafeAuthState(this.opts.authDir, {
      initAuthCreds,
      BufferJSON,
      fromAppStateSyncKey: (v) => proto.Message.AppStateSyncKeyData.fromObject(v),
    }, (msg) => log.error(`ALERT ${msg}`));
    // The version lookup is a download from GitHub. Without a time limit a hung request
    // stalled the reconnect forever; on timeout Baileys' built-in version is used.
    const latest = await withTimeout(fetchLatestBaileysVersion(), 10_000, { version: undefined } as any);
    if (myGen !== this.gen) return; // a newer start() took over while we waited
    this.registered = !!state.creds.registered;

    const sock = makeWASocket({
      ...(latest?.version ? { version: latest.version } : {}),
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys as any, this.logger) },
      logger: this.logger,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      msgRetryCounterCache: this.retryCounter as any,
      getMessage: async (key) => this.sent.get(key.id),
    });
    this.sock = sock;

    sock.ev.on("creds.update", () => {
      saveCreds().catch((e) => log.error("ALERT saving whatsapp login failed", { error: e?.message }));
    });

    sock.ev.on("connection.update", (u) => {
      if (myGen !== this.gen) return;
      if (u.qr) {
        const pair = (this.opts.pairPhone || "").replace(/\D/g, "");
        if (pair && !state.creds.registered) {
          // The QR event means the socket is ready to pair; ask once for a code instead.
          if (!this.pairingRequested) {
            this.pairingRequested = true;
            sock.requestPairingCode(pair)
              .then((code) => console.log(`PAIRING CODE: ${code}  (bot phone: Linked devices > Link a device > Link with phone number instead)`))
              .catch((e) => { this.pairingRequested = false; log.error("pairing code failed", { error: e?.message }); });
          }
        } else {
          log.info("scan this QR with the bot phone: WhatsApp > Linked devices > Link a device");
          qrcode.generate(u.qr, { small: true });
        }
      }
      if (u.connection === "open") {
        this.retry = 0;
        this.replaced = 0;
        this.registered = true;
        this.markUp();
        log.info("whatsapp connected");
        snapshotAuthDir(this.opts.authDir)
          .then((r) => {
            if ("dir" in r) log.info("whatsapp login backed up", { dir: r.dir });
            else if (r.skipped === "too_big") log.warn("whatsapp login backup skipped: folder too big", { bytes: r.bytes });
          })
          .catch((e) => log.warn("whatsapp login backup failed", { error: e?.message }));
      }
      if (u.connection === "close") {
        const code = (u.lastDisconnect?.error as any)?.output?.statusCode;
        this.markDown();
        if (code === DisconnectReason.loggedOut || code === DisconnectReason.forbidden) {
          // The session was removed from the phone, or the number was banned. Re-pairing
          // needs a human with the phone; do not loop.
          this.stop();
          log.error("ALERT whatsapp logged out: re-pair needed (or the number was banned)", { code });
          return;
        }
        let wait: number;
        if (code === DisconnectReason.connectionReplaced) {
          if (++this.replaced >= MAX_REPLACED) {
            this.stop();
            log.error("ALERT whatsapp session taken over again and again: is a second copy of the bot running? Stopped; restart it once the other copy is off", { code });
            return;
          }
          // These waits are deliberate: they must not count towards the stuck restart.
          this.clearStuckTimer();
          wait = REPLACED_WAIT_MS;
        } else {
          this.replaced = 0;
          if (!this.stuckTimer) this.armStuckTimer(); // re-armed if a takeover wait cleared it
          wait = Math.min(30_000, 1000 * 2 ** this.retry++);
        }
        log.warn("whatsapp disconnected, reconnecting", { code, waitMs: wait });
        this.scheduleReconnect(wait);
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (myGen !== this.gen) return;
      // "notify" = live; "append" = caught up after a reconnect. Both are real inbound
      // messages; the backlog cut-off and the dedupe keep a catch-up from double replying.
      if (type !== "notify" && type !== "append") return;
      const sorted = [...messages].sort((a, b) => Number(a.messageTimestamp ?? 0) - Number(b.messageTimestamp ?? 0));
      for (const m of sorted) {
        const msg = this.toInbound(m);
        if (!msg || !this.handler) continue;
        if (Date.now() - msg.timestampMs > MAX_BACKLOG_MS) continue;
        try {
          await this.handler(msg);
        } catch (e: any) {
          log.error("handler failed", { error: e?.message });
        }
      }
    });
  }

  /** Logged out or taken over: no more reconnects, waiting sends fail now. */
  private stop() {
    this.stopped = true;
    this.clearStuckTimer();
    this.failWaiters();
  }

  /** One reconnect at a time. A failed start() schedules the next try itself. */
  private scheduleReconnect(waitMs: number) {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.start().catch((e) => {
        const next = Math.min(30_000, 1000 * 2 ** this.retry++);
        log.error("reconnect failed, trying again", { error: e?.message, waitMs: next });
        if (!this.stuckTimer) this.armStuckTimer();
        this.scheduleReconnect(next);
      });
    }, waitMs);
  }

  /** Detaches the current socket so its late events and its close are ignored. */
  private dropSocket() {
    const old = this.sock;
    this.sock = null;
    this.open = false;
    if (!old) return;
    for (const ev of ["creds.update", "connection.update", "messages.upsert"] as const) old.ev.removeAllListeners(ev);
    old.end(undefined).catch(() => {});
  }

  private markDown() {
    this.open = false;
    if (this.downSince) return;
    this.downSince = Date.now();
    const alertAfter = this.opts.downAlertMs ?? 120_000;
    this.downTimer = setTimeout(() => {
      if (this.downSince) this.opts.onDownTooLong?.(Date.now() - this.downSince);
    }, alertAfter);
    this.armStuckTimer();
  }

  private armStuckTimer() {
    this.clearStuckTimer();
    this.stuckTimer = setTimeout(() => {
      this.stuckTimer = null;
      if (!this.downSince || this.stopped) return;
      // Not paired yet: someone may be typing the code, a restart would cut them off.
      if (!this.registered) return;
      this.opts.onStuck?.(Date.now() - this.downSince);
    }, this.opts.restartAfterMs ?? 5 * 60_000);
  }

  private markUp() {
    this.open = true;
    this.downSince = null;
    if (this.downTimer) clearTimeout(this.downTimer);
    this.downTimer = null;
    this.clearStuckTimer();
    const waiters = this.readyWaiters;
    this.readyWaiters = [];
    for (const w of waiters) w();
  }

  private clearStuckTimer() {
    if (this.stuckTimer) clearTimeout(this.stuckTimer);
    this.stuckTimer = null;
  }

  private failWaiters() {
    const waiters = this.readyWaiters;
    this.readyWaiters = [];
    for (const w of waiters) w(); // they re-check and throw "not connected"
  }

  /** Resolves when the socket is open, rejects after `maxMs` or once logged out. */
  private waitUntilReady(maxMs: number): Promise<void> {
    if (this.open && this.sock) return Promise.resolve();
    if (this.stopped) return Promise.reject(new Error("whatsapp logged out"));
    return new Promise((resolve, reject) => {
      const done = () => {
        clearTimeout(t);
        if (this.open && this.sock) resolve();
        else reject(new Error("whatsapp not connected"));
      };
      const t = setTimeout(() => {
        this.readyWaiters = this.readyWaiters.filter((w) => w !== done);
        reject(new Error("whatsapp not connected"));
      }, maxMs);
      this.readyWaiters.push(done);
    });
  }

  private toInbound(m: WAMessage): InboundMessage | null {
    const key = m.key;
    if (!key || key.fromMe || !key.remoteJid || !m.message) return null;
    // One-to-one chats only. Groups, status and broadcasts are ignored entirely.
    if (key.remoteJid.endsWith("@g.us") || key.remoteJid === "status@broadcast" || key.remoteJid.endsWith("@broadcast")) return null;

    const from = pnFromJid(key.remoteJid) ?? pnFromJid(key.remoteJidAlt) ?? pnFromJid((key as any).senderPn);
    const c = m.message;
    const doc = c.documentMessage ?? c.documentWithCaptionMessage?.message?.documentMessage ?? null;
    const img = c.imageMessage ?? null;
    const text = c.conversation ?? c.extendedTextMessage?.text ?? doc?.caption ?? img?.caption ?? "";

    let kind: InboundMessage["kind"] = "other";
    if (doc) kind = "document";
    else if (img) kind = "image";
    else if (c.conversation != null || c.extendedTextMessage) kind = "text";

    return {
      id: key.id || "",
      from,
      replyTo: key.remoteJid,
      kind,
      text: String(text || ""),
      fileName: doc?.fileName ?? null,
      mimeType: doc?.mimetype ?? img?.mimetype ?? null,
      // Photos carry their size too, so a huge one is refused before it is downloaded.
      fileSize: doc?.fileLength != null ? Number(doc.fileLength) : img?.fileLength != null ? Number(img.fileLength) : null,
      timestampMs: Number(m.messageTimestamp ?? 0) * 1000 || Date.now(),
      raw: m,
    };
  }

  private need(): WASocket {
    if (!this.sock) throw new Error("whatsapp not started");
    return this.sock;
  }

  /** Queues one outgoing message on whichever socket is live when its turn comes. */
  private send(to: string, content: Parameters<WASocket["sendMessage"]>[1]): Promise<void> {
    return this.queue.push(async () => {
      const out = await this.need().sendMessage(to, content);
      this.sent.remember(out?.key?.id, out?.message);
    });
  }

  async sendText(to: string, text: string): Promise<void> {
    await this.send(to, { text });
  }

  async sendDocument(to: string, file: Buffer, fileName: string, mimeType: string, caption?: string): Promise<void> {
    await this.send(to, { document: file, mimetype: mimeType, fileName, ...(caption ? { caption } : {}) });
  }

  async sendContact(to: string, name: string): Promise<void> {
    await this.waitUntilReady(SEND_WAIT_MS);
    // sock.user.id is "<digits>:<device>@s.whatsapp.net"; the digits are this SIM's number.
    const digits = String(this.need().user?.id || "").split(/[:@]/)[0].replace(/\D/g, "");
    if (!digits) throw new Error("own number unknown");
    const shown = digits.length === 12 && digits.startsWith("91") ? `+91 ${digits.slice(2, 7)} ${digits.slice(7)}` : `+${digits}`;
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${name}`,
      "ORG:IndSure;",
      `TEL;type=CELL;type=VOICE;waid=${digits}:${shown}`,
      "END:VCARD",
    ].join("\n");
    await this.send(to, { contacts: { displayName: name, contacts: [{ vcard }] } });
  }

  async sendTyping(to: string, on: boolean): Promise<void> {
    // Typing dots are cosmetic: skipped while disconnected, never queued behind real messages.
    if (!this.open || !this.sock) return;
    await this.sock.sendPresenceUpdate(on ? "composing" : "paused", to).catch(() => {});
  }

  async downloadMedia(msg: InboundMessage): Promise<Buffer> {
    await this.waitUntilReady(SEND_WAIT_MS);
    const sock = this.need();
    return (await downloadMediaMessage(msg.raw as WAMessage, "buffer", {}, {
      logger: this.logger,
      reuploadRequest: sock.updateMediaMessage,
    })) as Buffer;
  }

  async markRead(msg: InboundMessage): Promise<void> {
    if (!this.open || !this.sock) return;
    const m = msg.raw as WAMessage;
    await this.sock.readMessages([m.key]).catch(() => {});
  }
}
