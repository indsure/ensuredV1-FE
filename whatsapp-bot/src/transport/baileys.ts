/**
 * Baileys adapter (unofficial WhatsApp Web client). See brief §3 for the ban risk and why
 * this runs on a dedicated SIM that nobody uses as their own WhatsApp.
 *
 * What this adapter owns: the socket, pairing, reconnecting, and turning Baileys message
 * objects into InboundMessage. It makes no decisions about who gets a reply.
 */

import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WAMessage,
  type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";
import type { InboundMessage, Transport } from "./types.js";
import { log } from "../log.js";

const PN_SUFFIX = "@s.whatsapp.net";

/** Messages older than this at reconnect are not answered (a reply a day late is noise). */
const MAX_BACKLOG_MS = 12 * 60 * 60 * 1000;

export type BaileysOptions = {
  authDir: string;
  /** Called when the socket has been down longer than `downAlertMs`. */
  onDownTooLong?: (downForMs: number) => void;
  downAlertMs?: number;
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
  private downSince: number | null = null;
  private downTimer: NodeJS.Timeout | null = null;
  private retry = 0;

  constructor(private readonly opts: BaileysOptions) {}

  onMessage(handler: (m: InboundMessage) => Promise<void>): void {
    this.handler = handler;
  }

  async start(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(this.opts.authDir);
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "warn" }) as any,
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });
    this.sock = sock;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (u) => {
      if (u.qr) {
        log.info("scan this QR with the bot phone: WhatsApp > Linked devices > Link a device");
        qrcode.generate(u.qr, { small: true });
      }
      if (u.connection === "open") {
        this.retry = 0;
        this.markUp();
        log.info("whatsapp connected");
      }
      if (u.connection === "close") {
        const code = (u.lastDisconnect?.error as any)?.output?.statusCode;
        this.markDown();
        if (code === DisconnectReason.loggedOut) {
          // The session was removed from the phone, or the number was banned. Re-pairing
          // needs a human with the phone; do not loop.
          log.error("whatsapp logged out: re-pair needed (or the number was banned)", { code });
          return;
        }
        const wait = Math.min(30_000, 1000 * 2 ** this.retry++);
        log.warn("whatsapp disconnected, reconnecting", { code, waitMs: wait });
        setTimeout(() => this.start().catch((e) => log.error("reconnect failed", { error: e?.message })), wait);
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
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

  private markDown() {
    if (this.downSince) return;
    this.downSince = Date.now();
    const alertAfter = this.opts.downAlertMs ?? 120_000;
    this.downTimer = setTimeout(() => {
      if (this.downSince) this.opts.onDownTooLong?.(Date.now() - this.downSince);
    }, alertAfter);
  }

  private markUp() {
    this.downSince = null;
    if (this.downTimer) clearTimeout(this.downTimer);
    this.downTimer = null;
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
      fileSize: doc?.fileLength != null ? Number(doc.fileLength) : null,
      timestampMs: Number(m.messageTimestamp ?? 0) * 1000 || Date.now(),
      raw: m,
    };
  }

  private need(): WASocket {
    if (!this.sock) throw new Error("whatsapp not started");
    return this.sock;
  }

  async sendText(to: string, text: string): Promise<void> {
    await this.need().sendMessage(to, { text });
  }

  async sendTyping(to: string, on: boolean): Promise<void> {
    await this.need().sendPresenceUpdate(on ? "composing" : "paused", to).catch(() => {});
  }

  async downloadMedia(msg: InboundMessage): Promise<Buffer> {
    const sock = this.need();
    return (await downloadMediaMessage(msg.raw as WAMessage, "buffer", {}, {
      logger: pino({ level: "warn" }) as any,
      reuploadRequest: sock.updateMediaMessage,
    })) as Buffer;
  }

  async markRead(msg: InboundMessage): Promise<void> {
    const m = msg.raw as WAMessage;
    await this.need().readMessages([m.key]).catch(() => {});
  }
}
