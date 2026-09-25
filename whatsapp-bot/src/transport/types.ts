/**
 * The one seam between the bot and WhatsApp (brief §11). Baileys implements it today; a
 * WhatsApp Business (Cloud API) adapter replaces it at launch without touching bot-core.
 */

export type InboundKind = "text" | "document" | "image" | "other";

export type InboundMessage = {
  /** WhatsApp's own message id. The dedupe key. */
  id: string;
  /** Sender's phone number as E.164 digits without "+", e.g. "919812345678".
   *  null when the transport could only see an opaque id (Baileys LID with no phone mapping). */
  from: string | null;
  /** Where replies go. Opaque to bot-core, meaningful only to the transport. */
  replyTo: string;
  kind: InboundKind;
  text: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  timestampMs: number;
  /** Transport's own message object, handed back for downloadMedia / markRead. */
  raw: unknown;
};

export interface Transport {
  start(): Promise<void>;
  onMessage(handler: (msg: InboundMessage) => Promise<void>): void;
  sendText(to: string, text: string): Promise<void>;
  sendTyping(to: string, on: boolean): Promise<void>;
  downloadMedia(msg: InboundMessage): Promise<Buffer>;
  markRead(msg: InboundMessage): Promise<void>;
}
