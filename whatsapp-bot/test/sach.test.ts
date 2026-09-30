import { test } from "node:test";
import assert from "node:assert/strict";
import { makeBot, text, AGENT, ADVISOR } from "./fakes.js";
import { morningBrief, inMorningWindow, sincePreviousWorkday } from "../src/core/morning.js";
import { ruleIntent } from "../src/core/intents.js";

/** Wed 30 Sep 2026, 9:30 AM IST. */
const WED_0930 = Date.parse("2026-09-30T04:00:00Z");
const at = (t: ReturnType<typeof makeBot>, ms: number) => t.advance(ms - t.bot["now"]());

const lead = (name: string, days: number, over: any = {}) => ({ id: "l-" + name, name, phone: null, status: "new", insurance_interest: "Health", next_follow_up: null, notes: null, days, ...over });

/* ── Commands ── */

test("intents: BALANCE, TODAY, MORNING OFF/ON; 'checks' still checks", () => {
  assert.equal(ruleIntent("balance"), "balance");
  assert.equal(ruleIntent("my balance"), "balance");
  assert.equal(ruleIntent("Sach Assistant"), "balance");
  assert.equal(ruleIntent("today"), "today");
  assert.equal(ruleIntent("to-do"), "today");
  assert.equal(ruleIntent("morning off"), "morning_off");
  assert.equal(ruleIntent("MORNING ON"), "morning_on");
  assert.equal(ruleIntent("checks"), "checks");
  assert.equal(ruleIntent("how many checks left"), "checks");
  assert.equal(ruleIntent("today's calls"), "followups");
});

test("BALANCE on a paid plan: replies used, limit, reset date, and checks", async () => {
  const { bot, transport, engine } = makeBot();
  engine.sachData.used = 212;
  await bot.handle(text("balance"));
  assert.match(transport.last(), /\*Sach Assistant:\* 212 of 500 replies used this month\. Resets on Thu 1 Oct\./);
  assert.match(transport.last(), /\*Policy checks left:\* 5/);
  assert.equal(engine.understandCalls.length, 0, "BALANCE never calls the model");
});

test("BALANCE on the free plan: checks, plus where Sach Assistant comes from", async () => {
  const { bot, transport, engine } = makeBot();
  engine.sachData = { ...engine.sachData, plan: "free", paid: false };
  await bot.handle(text("balance"));
  assert.match(transport.last(), /\*Policy checks left:\* 5/);
  assert.match(transport.last(), /comes with the paid plan: https:\/\/indsure\.in\/advisors-pricing/);
  assert.doesNotMatch(transport.last(), /\bAI\b|credits/);
});

/* ── Paid only, and the monthly limit ── */

test("free plan: rules still work; one pointer a day when the rules can't read a message", async () => {
  const { bot, transport, engine } = makeBot();
  engine.sachReason = "free_plan";
  await bot.handle(text("can you tell me something useful please"));
  assert.match(transport.last(), /With Sach Assistant \(paid plan\) you can just type it your way/);
  await bot.handle(text("another thing i cannot say simply"));
  assert.doesNotMatch(transport.last(), /Sach Assistant/, "only once a day");
  await bot.handle(text("renewals"));
  assert.match(transport.last(), /Nothing due|renewal/);
});

test("limit reached: told once a month, then the rules carry on", async () => {
  const { bot, transport, engine } = makeBot();
  engine.sachReason = "limit";
  engine.sachData.used = 500;
  engine.leadRows = [lead("Ramesh Kumar", 0, { phone: "9812345678" })];
  await bot.handle(text("can you mark the guy from pune as done"));
  const all = transport.texts();
  assert.ok(all.some((t) => /You've used all 500 Sach Assistant replies this month\. Until Thu 1 Oct/.test(t)));
  await bot.handle(text("Ramesh won"));
  assert.match(transport.last(), /Please confirm:/, "the rules still work");
  const before = transport.sent.length;
  await bot.handle(text("and the other one from delhi too please"));
  assert.equal(transport.texts().slice(before).filter((t) => /used all 500/.test(t)).length, 0, "not repeated");
});

test("80% warning, once, after the reply", async () => {
  const { bot, transport, engine } = makeBot();
  engine.modelOn = true;
  engine.sachData.used = 399; // this message is the 400th
  engine.understandMap.set("who should I be calling today?", { actions: [{ type: "followups", name: null }], clarify: null });
  await bot.handle(text("who should I be calling today?"));
  assert.match(transport.last(), /Heads up: you've used 400 of 500 Sach Assistant replies this month/);
  await bot.handle(text("who should I be calling today?"));
  assert.doesNotMatch(transport.last(), /Heads up/);
});

/* ── The brief ── */

test("brief: follow-ups, overdue, renewals this week, opened reports, open claims", () => {
  const since = sincePreviousWorkday(WED_0930);
  const brief = morningBrief({
    name: "DEEP SHAH",
    followups: [lead("Ramesh Kumar", 0), lead("Sunita Rao", 0), lead("Amit Jain", 0), lead("Neha Gupta", 0), lead("Old One", -3)],
    renewals: {
      leads: [{ id: "r1", name: "Vikram Shah", phone: null, insurance_type: "health", insurer: null, policy_name: null, premium: null, due_date: "2026-10-02", days_left: 2 }],
      customers: [{ id: "r2", name: "Far Away", phone: null, insurance_type: "health", insurer: null, policy_name: null, premium: null, due_date: "2026-10-25", days_left: 25 }],
    },
    views: [{ name: "Neha Jain", lastViewed: "2026-09-29T12:00:00Z" }, { name: "Last Month", lastViewed: "2026-08-01T12:00:00Z" }],
    claims: [{ id: "c1", status: "query", claim_type: "cashless", insurer: null, hospital: null, ailment: null, claimed_amount: null, settled_amount: null, admitted_on: null, customer_name: "X", openQueries: [{ seq: 1, question: "q", raisedOn: "2026-09-29" }] }],
    sinceMs: since,
  })!;
  assert.match(brief, /^☀️ Good morning Deep\. Here's your to-do:/);
  assert.match(brief, /\*Follow-ups today:\* 4 \(Ramesh Kumar, Sunita Rao, Amit Jain, \+1\)/);
  assert.match(brief, /\*Overdue follow-ups:\* 1 \(Old One\)/);
  assert.match(brief, /\*Renewals this week:\* 1 \(Vikram Shah Fri 2 Oct\)/);
  assert.doesNotMatch(brief, /Far Away/, "25 days out is not this week");
  assert.match(brief, /\*Opened their report:\* Neha Jain/);
  assert.doesNotMatch(brief, /Last Month/);
  assert.match(brief, /\*Open claims:\* 1 \(1 insurer query waiting\)/);
  assert.match(brief, /Reply FOLLOW UPS, RENEWALS, CLAIMS for the full list\./);
  assert.doesNotMatch(brief, /—/);
});

test("brief: nothing on the list means no message at all", () => {
  assert.equal(morningBrief({ name: "Deep", followups: [], renewals: { leads: [], customers: [] }, views: [], claims: [], sinceMs: 0 }), null);
});

test("window: weekdays 9:00 to 12:00 IST only; Monday looks back to Friday", () => {
  assert.equal(inMorningWindow(WED_0930), true);
  assert.equal(inMorningWindow(Date.parse("2026-09-30T03:29:00Z")), false, "8:59 IST");
  assert.equal(inMorningWindow(Date.parse("2026-09-30T06:30:00Z")), false, "12:00 IST");
  assert.equal(inMorningWindow(Date.parse("2026-10-03T04:00:00Z")), false, "Saturday");
  assert.equal(inMorningWindow(Date.parse("2026-10-04T04:00:00Z")), false, "Sunday");
  const mon = Date.parse("2026-10-05T04:00:00Z");
  assert.equal(new Date(sincePreviousWorkday(mon)).toISOString(), "2026-10-01T18:30:00.000Z", "Friday 00:00 IST");
});

test("9 AM run: each advisor once, to their own number, spaced out; never twice a day", async () => {
  const t = makeBot();
  at(t, WED_0930);
  t.engine.followupRows = [lead("Ramesh Kumar", 0)];
  t.engine.morningList = [
    { agentId: AGENT, waNumber: ADVISOR, name: "Deep Shah" },
    { agentId: AGENT, waNumber: "919800000002", name: "Second Advisor" },
  ];
  const start = t.bot["now"]();
  assert.equal(await t.bot.morningTick(), 2);
  assert.deepEqual(t.transport.sent.map((s) => s.to), [`${ADVISOR}@s.whatsapp.net`, "919800000002@s.whatsapp.net"]);
  assert.match(t.transport.sent[0].text, /Good morning Deep/);
  const gap = t.bot["now"]() - start;
  assert.ok(gap >= 20_000 && gap < 40_000, `spaced ${gap}ms`);
  assert.ok(t.engine.messages.filter((m: any) => m.intent === "morning_brief").length === 2, "logged, so a restart skips them");
  assert.equal(await t.bot.morningTick(), 0, "not twice");
});

test("9 AM run: outside the window nothing happens; an empty list is not sent", async () => {
  const t = makeBot();
  t.engine.morningList = [{ agentId: AGENT, waNumber: ADVISOR, name: "Deep" }];
  t.engine.followupRows = [lead("Ramesh Kumar", 0)];
  at(t, Date.parse("2026-10-03T04:00:00Z")); // Saturday
  assert.equal(await t.bot.morningTick(), 0);
  const u = makeBot();
  at(u, WED_0930);
  u.engine.morningList = [{ agentId: AGENT, waNumber: ADVISOR, name: "Deep" }];
  assert.equal(await u.bot.morningTick(), 0);
  assert.equal(u.transport.sent.length, 0);
});

test("TODAY on demand (paid); free plan is pointed to the paid plan", async () => {
  const t = makeBot();
  at(t, WED_0930);
  t.engine.followupRows = [lead("Ramesh Kumar", 0)];
  await t.bot.handle(text("today"));
  assert.match(t.transport.last(), /Good morning Deep\. Here's your to-do:\n\n\*Follow-ups today:\* 1 \(Ramesh Kumar\)/);
  t.engine.sachData = { ...t.engine.sachData, plan: "free", paid: false };
  await t.bot.handle(text("today"));
  assert.match(t.transport.last(), /morning brief is part of Sach Assistant, which comes with the paid plan/);
});

test("MORNING OFF / ON are logged, which is what the backend reads", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("morning off"));
  assert.match(transport.last(), /no more morning briefs/);
  await bot.handle(text("morning on"));
  assert.match(transport.last(), /9 AM, Monday to Friday/);
  assert.deepEqual(engine.messages.filter((m: any) => /^morning_/.test(m.intent || "")).map((m: any) => m.intent), ["morning_off", "morning_on"]);
});
