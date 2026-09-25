/**
 * IndSure WhatsApp bot (beta). Plan: ../docs/plans/2026-09-25-whatsapp-bot-beta.md
 * Runs as its own pm2 process on the backend box. Needs the backend on BACKEND_URL with the
 * same WA_BOT_KEY set on both sides.
 */
import "dotenv/config";
import fs from "node:fs";
import { BaileysTransport } from "./transport/baileys.js";
import { HttpEngine } from "./engine.js";
import { Bot } from "./core/bot.js";
import { log } from "./log.js";

function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    log.error(`missing env ${name}`);
    process.exit(1);
  }
  return v;
}

if (process.env.WA_BOT_ENABLED !== "true") {
  log.warn("WA_BOT_ENABLED is not true: bot is switched off, exiting");
  process.exit(0);
}

const key = need("WA_BOT_KEY");
if (key.length < 32) {
  log.error("WA_BOT_KEY must be at least 32 characters");
  process.exit(1);
}
const authDir = need("WA_AUTH_DIR");
// Session files are the bot's WhatsApp login. Owner-only, and never inside the repo.
fs.mkdirSync(authDir, { recursive: true, mode: 0o700 });
if (/[\/]IndSure[\/]/i.test(fs.realpathSync(authDir))) {
  log.error("WA_AUTH_DIR must be outside the repository (the repo is public)");
  process.exit(1);
}

const transport = new BaileysTransport({
  authDir,
  onDownTooLong: (ms) => log.error("ALERT whatsapp down", { downForMs: ms }),
  pairPhone: process.env.WA_PAIR_PHONE,
});
const engine = new HttpEngine(process.env.BACKEND_URL || "http://127.0.0.1:5000", key);
const bot = new Bot({
  transport,
  engine,
  links: { origin: process.env.WA_PUBLIC_ORIGIN || "https://indsure.in" },
  tmpDir: process.env.WA_TMP_DIR || "/tmp/indsure-wa",
  teamLink: process.env.WA_TEAM_LINK || "https://indsure.in/advisors-pricing",
});

transport.onMessage((m) => bot.handle(m));
await transport.start();
await bot.resumeOpenJobs();
// Written by the deploy script, so the log says exactly which commit is running.
let version = "dev";
try { version = fs.readFileSync(new URL("../DEPLOYED_VERSION", import.meta.url), "utf8").trim(); } catch {}
log.info("bot started", { version });
