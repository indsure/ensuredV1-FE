/** Stage 2d: life records, end to end through the bot. Records are only added; undo adds a void
 *  that keeps the record in the history. The fake engine reads records with the portal's own
 *  shared/policyEvidence.ts. ALL NAMES AND NUMBERS ARE MADE UP. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeBot, text, healthClient } from "./fakes.js";
import { ruleIntent } from "../src/core/intents.js";

const LIFE = "66666666-6666-4666-8666-666666666666";
const CAR = "55555555-5555-4555-8555-555555555555";

function setup() {
  const t = makeBot();
  t.engine.clients.set(LIFE, healthClient(LIFE, { insuranceType: "life", policyholderName: "Ramesh Kumar", insurer: "Some Life", policyName: "Life Plan", score: null }));
  t.engine.policyExtra.set(LIFE, { rev: 3, data: { premium: 25000 }, email: null, identifier: null });
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
});

test("payment: asks which premium it covers, confirms honestly, saved on YES, UNDO voids it (kept in history)", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("Ramesh paid premium 25,000 on 5 Oct 2026"));
  assert.match(transport.last(), /Which premium does this payment cover\?/);
  await bot.handle(text("1 Oct 2026"));
  assert.match(transport.last(), /premium ₹25,000 paid on .*5 Oct.*, for the premium due .*1 Oct/);
  assert.match(transport.last(), /not checked against an insurer document/);
  assert.equal(engine.writes.length, 0, "nothing written before YES");
  await bot.handle(text("yes"));
  assert.match(transport.last(), /Recorded on Ramesh Kumar's/);
  assert.equal(ev(engine).payments.length, 1);
  assert.equal(ev(engine).payments[0].confirmation, "self_reported");
  await bot.handle(text("undo"));
  assert.match(transport.last(), /stays in the policy's history, marked removed/);
  await bot.handle(text("yes"));
  assert.equal(ev(engine).payments.length, 2, "nothing is deleted: a void is added");
  assert.equal(ev(engine).payments[1].voided, true);
});

test("payment: SAME uses the paid date; the same payment twice is refused before any confirm", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("Ramesh paid premium 25000 on 5 Oct 2026"));
  await bot.handle(text("same"));
  await bot.handle(text("yes"));
  assert.equal(ev(engine).payments[0].dueDate, "2026-10-05");
  await bot.handle(text("Ramesh paid premium 25000 on 5 Oct 2026 for the due on 5 Oct 2026"));
  assert.match(transport.last(), /already has a payment of ₹25,000/);
  assert.equal(engine.writes.filter((w) => w.kind === "lifeAdd").length, 1);
});

test("a payment in the future and a paid-up date in the future are refused", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("Ramesh paid premium 25000 on 5 Dec 2026"));
  assert.match(transport.last(), /payment date doesn't look right/);
  await bot.handle(text("Ramesh's premiums are paid up to 1 Mar 2027"));
  assert.match(transport.last(), /date doesn't look right/);
  assert.equal(engine.writes.length, 0);
});

test("loan, insurer figures and status are recorded as of today", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("no loan on Ramesh's policy"));
  assert.match(transport.last(), /no loan on the policy, as of today/);
  await bot.handle(text("yes"));
  await bot.handle(text("Ramesh's surrender value is 1.2 lakh"));
  assert.match(transport.last(), /surrender value is ₹1,20,000/);
  await bot.handle(text("yes"));
  await bot.handle(text("Ramesh's policy is lapsed"));
  await bot.handle(text("yes"));
  const e = ev(engine);
  assert.deepEqual([e.loans[0].status, e.loans[0].asOf], ["none", "2026-10-22"]);
  assert.deepEqual([e.quotes[0].quoteType, e.quotes[0].amount], ["surrender_payable", 120000]);
  assert.equal(e.quotes[1].status, "lapsed");
});

test("not a life policy: refused before any confirm; a portal save in between: not saved, said plainly", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("find Sunita"));
  await bot.handle(text("this policy is lapsed"));
  assert.match(transport.last(), /not a life or term policy/);
  await bot.handle(text("Ramesh's surrender value is 120000"));
  engine.policyExtra.get(LIFE)!.rev = 9; // saved in the portal meanwhile
  await bot.handle(text("yes"));
  assert.match(transport.last(), /Not saved: .* was changed in the portal a moment ago/);
  assert.equal(ev(engine), undefined);
});

test("Hindi: the life-record lines are translated", async () => {
  const { bot, transport } = setup();
  await bot.handle(text("hindi"));
  await bot.handle(text("Ramesh paid premium 25000 on 5 Oct 2026"));
  assert.match(transport.last(), /यह भुगतान किस premium का है\?/);
});
