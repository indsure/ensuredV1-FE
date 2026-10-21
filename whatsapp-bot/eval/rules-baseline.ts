/**
 * How the bot does with the model OFF (every free advisor today): runs each bake-off
 * message through the real Bot with the fake engine and a small made-up book, and sorts
 * the reply into:
 *   dead end  the bot said "I didn't catch that"
 *   right     the reply is the action the case expects (or, for ask-only cases, the bot
 *             changed nothing and asked or declined)
 *   other     the bot did something, just not the expected thing
 *
 *   npx tsx eval/rules-baseline.ts            summary
 *   npx tsx eval/rules-baseline.ts --list     every case with the reply's first line
 *   npx tsx eval/rules-baseline.ts --holdout  the held-out set (holdout-cases.ts), never tuned on
 *
 * No network, no model, no real data: the book below is made up.
 */

import { CASES, type Case } from "./cases.js";
import { HOLDOUT } from "./holdout-cases.js";
import type { ActionType } from "../src/core/understand.js";
import { makeBot, text, healthClient, ADVISOR } from "../test/fakes.js";

const PEOPLE = [
  ["Ramesh Kumar", "9812345678"], ["Santosh Vartak", "9822200011"], ["Sunita Rao", "9811122200"],
  ["Anil Mehta", "9800000101"], ["Kavita Joshi", "9876501200"], ["Priya Nair", "9800000102"],
  ["Vikram Shah", "9800000103"], ["Neha Kulkarni", "9800000104"], ["Pooja Desai", "9800000105"],
  ["Rohit Mehra", "9800000106"], ["Meena Iyer", "9800000107"], ["Nisha Gupta", "9800000108"],
  ["Suresh Patil", "9800000109"], ["Ajay Sharma", "9800000110"],
] as const;
const POLICIES = ["Ramesh Kumar", "Santosh Vartak", "Meena Iyer"];

/** Reply tag -> the action it is. Tags not listed are "other". */
const TAG: Record<string, ActionType> = {
  ask: "ask_report", ask_phrased: "ask_report", ask_not_in_report: "ask_report", answer_first: "ask_report", details: "ask_report", no_report: "ask_report",
  share: "share", share_tool: "share", pick_lang: "share",
  lead: "add_lead", lead_exists: "add_lead", dup_ask: "add_lead",
  lead_update: "update_lead", lead_pick: "update_lead", bulk_none: "update_lead",
  renewals: "renewals", followups: "followups", list_leads: "list_leads", lookup: "lookup",
  clients: "list_clients", draft: "draft_message", draft_done: "draft_message", remind: "draft_message", remind_pick: "draft_message",
  calc: "calculator", calc_done: "calculator", compare: "compare", compare_pick: "compare", compare_done: "compare",
  website: "website", checks: "checks", views: "views", claims: "claims", surrender: "surrender_value",
  help: "help", more: "help", cancel: "cancel", undo_none: "undo", unknown: "unknown",
};
/** Replies that change nothing: what an ask-only case wants. */
const SAFE = new Set(["unknown", "help", "thanks", "cancel", "confirm_no", "undo_none", "clarify", "offtopic", "suggest", "no_delete"]);

type Result = { c: Case; tags: string[]; first: string; verdict: "right" | "dead" | "other"; deadReply: boolean };

async function runCase(c: Case): Promise<Result> {
  const { bot, transport, engine } = makeBot();
  engine.sachReason = "free_plan";
  engine.sachData = { ...engine.sachData, plan: "free", paid: false };
  engine.leadRows = PEOPLE.map(([name, phone], i) => ({ id: `lead-${i}`, name, phone, status: "new", insurance_interest: "Health", next_follow_up: null, notes: null }));
  for (const [i, name] of POLICIES.entries()) {
    const id = `00000000-0000-4000-8000-00000000000${i}`;
    const p = PEOPLE.find((x) => x[0] === name)!;
    engine.clients.set(id, healthClient(id, { policyholderName: name, customerPhone: p[1] }));
  }
  const say = (t: string) => bot.handle(text(t, ADVISOR));

  // Recreate the context the case assumes, the way an advisor would get there.
  const ctx = c.ctx ?? {};
  if (ctx.lastPerson) await say(`find ${ctx.lastPerson}`);
  if (ctx.lastItem === "calculator result" || /^calculator/.test(ctx.pending ?? "")) await say("calculator");
  if (ctx.lastChange) { await say(ctx.lastChange.includes("Anil") ? "Anil lost" : "Ramesh won"); await say("yes"); }
  if (/^confirm/.test(ctx.pending ?? "")) await say("Ramesh won");
  if (/^add lead/.test(ctx.pending ?? "")) await say("add a lead");
  if (/^share/.test(ctx.pending ?? "")) { await say("find Santosh"); await say("share"); }

  const before = engine.messages.length;
  const writesBefore = engine.leads.length + engine.leadUpdates.length;
  await say(c.text);
  const out = engine.messages.slice(before).filter((m: any) => m.direction === "out");
  const tags = out.map((m: any) => String(m.intent || "").split(":")[0]).filter((t: string) => t && t !== "lang");
  const full = transport.sent.slice(-out.length).map((m) => m.text).join("\n");
  const first = full.split("\n")[0].slice(0, 90);
  const wrote = engine.leads.length + engine.leadUpdates.length > writesBefore;

  let verdict: Result["verdict"] = "other";
  if (tags.includes("unknown") || tags.length === 0) verdict = "dead";
  if (c.askOnly) verdict = !wrote && tags.every((t) => SAFE.has(t) || t === "confirm_ask" || t === "lead_update" || t === "lead_pick") && !tags.includes("confirm_saved") ? "right" : verdict;
  else if (c.any) {
    const want = new Set(c.any.flatMap((l) => l.flatMap((a) => (Array.isArray(a.type) ? a.type : [a.type]))));
    const confirmKind = (): ActionType => (/\bundo\b|put back|wapas|pehle jaisa/i.test(full) ? "undo" : /\badd lead\b|nayi lead|नई लीड/i.test(full) ? "add_lead" : "update_lead");
    const got = tags.map((t) => TAG[t] ?? (t === "confirm_ask" ? confirmKind() : null)).filter(Boolean) as ActionType[];
    if (got.some((g) => want.has(g)) && !(want.has("unknown") && got.length === 0)) verdict = "right";
  }
  return { c, tags, first, verdict, deadReply: tags.includes("unknown") || tags.length === 0 };
}

const results: Result[] = [];
const SET = process.argv.includes("--holdout") ? HOLDOUT : CASES;
for (const c of SET) results.push(await runCase(c));

const n = results.length;
const count = (v: Result["verdict"]) => results.filter((r) => r.verdict === v).length;
const pct = (k: number) => `${k}/${n} (${Math.round((100 * k) / n)}%)`;
console.log(`Model OFF, free advisor. ${n} messages.`);
console.log(`  right      ${pct(count("right"))}`);
console.log(`  other      ${pct(count("other"))}`);
console.log(`  dead end   ${pct(count("dead"))}`);
console.log(`  "didn't catch that" replies, any case: ${pct(results.filter((r) => r.deadReply).length)}`);
const cats = [...new Set(results.map((r) => r.c.cat))];
console.log("\nBy category (right / dead end):");
for (const cat of cats) {
  const rs = results.filter((r) => r.c.cat === cat);
  console.log(`  ${cat.padEnd(10)} ${rs.filter((r) => r.verdict === "right").length}/${rs.length} right, ${rs.filter((r) => r.verdict === "dead").length} dead`);
}
if (process.argv.includes("--list")) {
  console.log("");
  for (const r of results) console.log(`${r.verdict.padEnd(5)} ${r.c.id.padEnd(4)} ${JSON.stringify(r.c.text).padEnd(60)} [${r.tags.join(",")}] ${r.first}`);
}
