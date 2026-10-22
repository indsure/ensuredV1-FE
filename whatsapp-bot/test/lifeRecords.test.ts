/** Stage 2d: life records, end to end through the bot. Records are only added; undo adds a void
 *  that keeps the record in the history. The fake engine reads records with the portal's own
 *  shared/policyEvidence.ts and schedules dues with shared/policyValue.ts. NAMES AND NUMBERS ARE MADE UP. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeBot, text, healthClient } from "./fakes.js";
import { ruleIntent } from "../src/core/intents.js";
import { parseLifeAsk } from "../src/core/lifeParse.js";

const LIFE = "66666666-6666-4666-8666-666666666666";
const CAR = "55555555-5555-4555-8555-555555555555";

function setup(data: Record<string, unknown> = { premium: 25000, premium_frequency: "Yearly", start_date: "2020-10-01", policy_term_years: 20, premium_paying_term_years: 15 }) {
  const t = makeBot();
  t.engine.clients.set(LIFE, healthClient(LIFE, { insuranceType: "life", policyholderName: "Ramesh Kumar", insurer: "Some Life", policyName: "Life Plan", score: null }));
  t.engine.policyExtra.set(LIFE, { rev: 3, data: { ...data }, email: null, identifier: null });
  t.engine.clients.set(CAR, healthClient(CAR, { insuranceType: "motor", policyholderName: "Sunita Rao", insurer: "Some General", policyName: "Car Plan", score: null }));
  t.engine.policyExtra.set(CAR, { rev: 0, data: {}, email: null, identifier: null });
  t.advance(Date.parse("2026-10-22T06:00:00Z") - t.bot["now"]());
  return t;
}
const ev = (e: any) => e.policyExtra.get(LIFE)!.data.value_evidence;

test("the phrasings route to life records; asking for a figure stays a lookup", () => {
  for (const s of ["Ramesh paid premium 25000 on 5 Oct 2026", "no loan on Ramesh's policy", "Ramesh's surrender value is 1.2 lakh",
    "Ramesh's policy is lapsed", "Ramesh ne 25000 premium bhara", "loan available on Ramesh's policy is 80000"]) assert.equal(ruleIntent(s), "liferecord", s);
  for (const s of ["what is Ramesh's surrender value", "Ramesh's surrender value?", "surrender value Ramesh"]) assert.equal(ruleIntent(s), "surrender", s);
  assert.equal(ruleIntent("premium is 14500"), "policyfix");
  assert.equal(parseLifeAsk("Ramesh paid 25000"), null, "the word premium is needed");
  assert.equal(parseLifeAsk("Ramesh's policy is active"), null, "a loose word is not an insurer status");
  assert.equal(parseLifeAsk("he paid premium 25000")?.who, null, "a pronoun means the policy we are on");
});

test("payment: the due date is picked from the policy's schedule, confirmed honestly, UNDO voids it (kept in history)", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("Ramesh paid premium 25,000 on 5 Oct 2026"));
  const ask = transport.last();
  assert.match(ask, /Which premium does this payment cover\?\n1\) due .*1 Oct/);
  await bot.handle(text("1"));
  assert.match(transport.last(), /premium ₹25,000 paid on .*5 Oct.*, for the premium due .*1 Oct/);
  assert.match(transport.last(), /not checked against an insurer document/);
  assert.equal(engine.writes.length, 0, "nothing written before YES");
  await bot.handle(text("yes"));
  assert.match(transport.last(), /Recorded on Ramesh Kumar's/);
  assert.deepEqual([ev(engine).payments[0].dueDate, ev(engine).payments[0].confirmation], ["2026-10-01", "self_reported"]);
  await bot.handle(text("undo"));
  assert.match(transport.last(), /stays in the policy's history, marked removed/);
  await bot.handle(text("yes"));
  assert.equal(ev(engine).payments.length, 2, "nothing is deleted: a void is added");
  assert.equal(ev(engine).payments[1].voided, true);
});

test("payment: a typed due date off the schedule is refused; the same payment twice is refused; a far-off amount is pointed out", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("Ramesh paid premium 25000 on 5 Oct 2026 for the due on 5 Oct 2026"));
  assert.match(transport.last(), /is not a premium due date on .* Recent due dates: .*1 Oct/);
  await bot.handle(text("Ramesh paid premium 25000 on 5 Oct 2026 for the due on 1 Oct 2026"));
  await bot.handle(text("yes"));
  await bot.handle(text("Ramesh paid premium 25000 on 5 Oct 2026 for the due on 1 Oct 2026"));
  assert.match(transport.last(), /already has a payment of ₹25,000/);
  await bot.handle(text("Ramesh paid premium 2,50,000 on 5 Oct 2025 for the due on 1 Oct 2025"));
  assert.match(transport.last(), /Note: the premium on file is ₹25,000/);
  assert.equal(engine.writes.filter((w) => w.kind === "lifeAdd").length, 1);
});

test("payment on a policy without a known schedule is refused before any confirm", async () => {
  const { bot, transport, engine } = setup({ premium: 25000 });
  await bot.handle(text("Ramesh paid premium 25000 on 5 Oct 2026"));
  assert.match(transport.last(), /premium schedule is not complete/);
  assert.equal(engine.writes.length, 0);
});

test("a payment in the future and a paid-up date in the future are refused", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("Ramesh paid premium 25000 on 5 Dec 2026"));
  assert.match(transport.last(), /payment date doesn't look right/);
  await bot.handle(text("Ramesh's premiums are paid up to 1 Mar 2027"));
  assert.match(transport.last(), /date doesn't look right/);
  assert.equal(engine.writes.length, 0);
});

test("insurer figures carry the statement's date (asked when not said); loans are as of today", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("no loan on Ramesh's policy"));
  assert.match(transport.last(), /no loan on the policy, as of today/);
  await bot.handle(text("yes"));
  await bot.handle(text("Ramesh's surrender value is 1.2 lakh"));
  assert.match(transport.last(), /What date is the insurer's statement/);
  await bot.handle(text("1 Oct 2026"));
  assert.match(transport.last(), /surrender value ₹1,20,000, as quoted by the insurer on .*1 Oct/);
  await bot.handle(text("yes"));
  await bot.handle(text("Ramesh's policy is lapsed as of 15 Sep 2026"));
  assert.match(transport.last(), /policy status: lapsed, as stated by the insurer on .*15 Sep/);
  await bot.handle(text("yes"));
  const e = ev(engine);
  assert.deepEqual([e.loans[0].status, e.loans[0].asOf], ["none", "2026-10-22"]);
  assert.deepEqual([e.quotes[0].quoteType, e.quotes[0].amount, e.quotes[0].quoteDate], ["surrender_payable", 120000, "2026-10-01"]);
  assert.deepEqual([e.quotes[1].status, e.quotes[1].quoteDate], ["lapsed", "2026-09-15"]);
});

test("not a life policy: refused before any confirm; a portal save in between: not saved, said plainly", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("find Sunita"));
  await bot.handle(text("this policy is lapsed on 1 Oct 2026"));
  assert.match(transport.last(), /not a life or term policy/);
  await bot.handle(text("Ramesh's surrender value is 120000 as of 1 Oct 2026"));
  engine.policyExtra.get(LIFE)!.rev = 9; // saved in the portal meanwhile
  await bot.handle(text("yes"));
  assert.match(transport.last(), /Not saved: .* was changed in the portal a moment ago/);
  assert.equal(ev(engine), undefined);
});

test("Hindi and Hinglish: the record itself is translated, not left in English", async () => {
  const { bot, transport } = setup();
  // The reply language follows what the advisor writes, so this is written in Hinglish.
  await bot.handle(text("Ramesh ne 25000 premium bhara 5 Oct 2026 ko"));
  assert.match(transport.last(), /Yeh payment kaunse premium ka hai\?/);
  await bot.handle(text("1"));
  assert.match(transport.last(), /ko ₹25,000 premium bhara, .*1 Oct wale premium ke liye\. Aapke bataye anusaar save hoga/);
  assert.doesNotMatch(transport.last(), /paid on|Saved as told/);
});
