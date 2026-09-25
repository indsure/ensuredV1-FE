// ============================================================================
// WhatsApp plug-in (beta). The ONLY file the rest of the backend imports from this folder.
//
// Unplugging: delete this folder, then remove the lines marked WHATSAPP-PLUGIN
// (`grep -rn WHATSAPP-PLUGIN backend frontend`). Full checklist: whatsapp-bot/UNPLUG.md.
//
// Switching off without touching code: unset WA_BOT_KEY. Then no route is registered, the
// verifyJwt hook steps aside for every request, and the rate-limit exemption never applies.
// The backend behaves exactly as if this folder did not exist.
// ============================================================================

import type { Express } from "express";
import { log } from "../lib/logger";
import { registerWhatsappRoutes, resolveWaBotAgent, isWaBotRequest as keyedBotRequest } from "./routes";

type VerifyJwt = (req: any, res: any) => Promise<string | null>;

export function whatsappEnabled(): boolean {
  return (process.env.WA_BOT_KEY || "").length >= 32;
}

/** Registers the portal link routes and the bot-only /api/internal/wa surface. */
export function mountWhatsapp(app: Express, verifyJwt: VerifyJwt): void {
  if (!whatsappEnabled()) {
    log.info("whatsapp plug-in off (WA_BOT_KEY not set)");
    return;
  }
  registerWhatsappRoutes(app, verifyJwt);
}

/** First thing in verifyJwt. undefined = not a bot request (or plug-in off): normal JWT auth. */
export async function whatsappBotAuth(req: any): Promise<string | null | undefined> {
  if (!whatsappEnabled()) return undefined;
  return resolveWaBotAgent(req);
}

/** For the global rate limiter's skip(). Always false when the plug-in is off. */
export function isWaBotRequest(req: any): boolean {
  return whatsappEnabled() && keyedBotRequest(req);
}
