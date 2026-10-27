/**
 * The real WhatsApp bot (whatsapp-bot/src/core/bot.ts) running in the browser for the
 * playground. Only the two seams are swapped: the transport is this page's phone screen
 * instead of WhatsApp, and the engine answers from the playground store (demoEngine.ts).
 * No model is called: the demo engine reports the model as switched off, so every reply
 * comes from the bot's own rules, exactly as on a server without WA_LLM_ENABLED.
 */

import { Bot } from "../../../../../whatsapp-bot/src/core/bot";
import type { InboundMessage, Transport } from "../../../../../whatsapp-bot/src/transport/types";
import { DemoEngine, DEMO_WA_NUMBER } from "./demoEngine";

/** Bytes that answer `.toString("latin1")` like a Node Buffer, which is all the bot asks of
 *  a received file before handing it to the (injected) inspector. */
class LatinBytes extends Uint8Array {
  override toString(enc?: string): string {
    if (enc === "latin1" || enc === "binary") {
      let s = "";
      for (let i = 0; i < this.length; i++) s += String.fromCharCode(this[i]);
      return s;
    }
    return super.toString();
  }
}

export type PhoneEvent =
  | { kind: "reply"; text: string; at: number }
  | { kind: "typing"; on: boolean };

class PhoneTransport implements Transport {
  private handler: ((m: InboundMessage) => Promise<void>) | null = null;
  readonly files = new Map<string, LatinBytes>();
  constructor(private readonly emit: (e: PhoneEvent) => void) {}
  async start() {}
  onMessage(h: (m: InboundMessage) => Promise<void>) { this.handler = h; }
  async sendText(_to: string, text: string) { this.emit({ kind: "reply", text, at: Date.now() }); }
  async sendTyping(_to: string, on: boolean) { this.emit({ kind: "typing", on }); }
  async downloadMedia(m: InboundMessage) { return (this.files.get(m.id) ?? new LatinBytes()) as any; }
  async markRead() {}
  async deliver(m: InboundMessage) { if (this.handler) await this.handler(m); }
}

let seq = 0;
const nextId = () => `demo-wa-${Date.now()}-${++seq}`;

/** Guess the policy type from the file name, the way the real inspector guesses it from the text. */
function guessFromName(name: string): "health" | "motor" | "life" | "term" | null {
  // Words, not substrings: "policy" contains "lic", which once made a health PDF a life one.
  const words = name.toLowerCase().split(/[^a-z]+/);
  const has = (...w: string[]) => w.some((x) => words.includes(x));
  if (has("health", "mediclaim", "optima", "care", "floater")) return "health";
  if (has("motor", "car", "bike", "vehicle")) return "motor";
  if (has("term")) return "term";
  if (has("life", "lic", "endowment")) return "life";
  return null;
}

export type PhoneMsg = { id: number; from: "me" | "bot"; text: string; at: number; file?: string }

/**
 * One chat per demo visit. The phone page can be left and opened again (to look at Leads,
 * say) and the conversation, including a question the bot is waiting on, is still there.
 */
type Session = { msgs: PhoneMsg[]; typing: boolean; send: (t: string) => void; sendPdf: (f: string) => void; subscribe: (fn: () => void) => () => void };
let session: Session | null = null;

export function getDemoSession(): Session {
  if (session) return session;
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((fn) => fn());
  let id = 0;
  const s: Session = {
    msgs: [],
    typing: false,
    send: (text) => {
      const body = text.trim();
      if (!body) return;
      s.msgs = [...s.msgs, { id: ++id, from: "me", text: body, at: Date.now() }];
      changed();
      void bot.sendText(body);
    },
    sendPdf: (fileName) => {
      s.msgs = [...s.msgs, { id: ++id, from: "me", text: "", file: fileName, at: Date.now() }];
      changed();
      void bot.sendPdf(fileName);
    },
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  };
  const bot = createDemoBot((e) => {
    if (e.kind === "typing") s.typing = e.on;
    else s.msgs = [...s.msgs, { id: ++id, from: "bot", text: e.text, at: e.at }];
    changed();
  });
  session = s;
  return s;
}

export function createDemoBot(emit: (e: PhoneEvent) => void) {
  const transport = new PhoneTransport(emit);
  const engine = new DemoEngine();
  const fileNames = new Map<string, string>();
  const bot = new Bot({
    transport,
    engine,
    links: { origin: window.location.origin },
    tmpDir: "/demo-wa",
    teamLink: `${window.location.origin}/advisors/pricing`,
    // A short, human-looking pause, so a reply does not appear the instant you press send.
    replyDelay: () => 500 + Math.floor(Math.random() * 500),
    timings: { pollMs: 1200 } as any,
    inspect: async (buf: any) => {
      const name = fileNames.get(String(buf?.__msgId ?? "")) ?? "";
      return { kind: "ok", text: "Demo policy schedule ".padEnd(400, "."), hindi: false, guess: guessFromName(name), scores: {}, topUp: false, names: [] };
    },
  });
  transport.onMessage((m) => bot.handle(m));

  const base = (text: string): InboundMessage => ({
    id: nextId(), from: DEMO_WA_NUMBER, replyTo: `${DEMO_WA_NUMBER}@s.whatsapp.net`, kind: "text",
    text, fileName: null, mimeType: null, fileSize: null, timestampMs: Date.now(), raw: null,
  });

  return {
    /** A message typed in the phone. */
    sendText(text: string) { return transport.deliver(base(text)); },
    /** A PDF "sent" from the phone. The demo makes a pretend PDF; the check is the playground's. */
    sendPdf(fileName: string, caption = "") {
      const m = { ...base(caption), kind: "document" as const, fileName, mimeType: "application/pdf", fileSize: 180_000 };
      const bytes = new LatinBytes(new TextEncoder().encode(`%PDF-1.4 demo ${fileName}`)) as any;
      bytes.__msgId = m.id;
      fileNames.set(m.id, fileName);
      transport.files.set(m.id, bytes);
      return transport.deliver(m);
    },
  };
}
