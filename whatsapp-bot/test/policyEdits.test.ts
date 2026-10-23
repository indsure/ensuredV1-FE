/** Stage 2b: policies, end to end through the bot. Client details on any policy, saved details
 *  on a non-health one, and stop sharing. The fake engine applies the backend's own rules
 *  (backend/server/whatsapp/edits.ts, shared editRules). ALL NAMES AND NUMBERS ARE MADE UP. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeBot, text, healthClient } from "./fakes.js";
import { ruleIntent } from "../src/core/intents.js";
import { anyDate } from "../src/core/editParse.js";
import { strictAmount } from "../src/shared/editRules.js";

const CAR = "55555555-5555-4555-8555-555555555555";
const LIFE = "66666666-6666-4666-8666-666666666666";
const HEALTH = "77777777-7777-4777-8777-777777777777";

function setup() {
  const t = makeBot();
  t.engine.clients.set(CAR, healthClient(CAR, { insuranceType: "motor", policyholderName: "Ramesh Kumar", insurer: "Some General", policyName: "Car Plan", score: null }));
  t.engine.policyExtra.set(CAR, { rev: 2, data: { premium: 15400, idv: 500000, policy_expiry_date: "2027-03-01" }, email: null, identifier: null });
  t.engine.clients.set(LIFE, healthClient(LIFE, { insuranceType: "life", policyholderName: "Ramesh Kumar", insurer: "Some Life", policyName: "Life Plan", score: null }));
  t.engine.policyExtra.set(LIFE, { rev: 0, data: { premium: 30000, sum_assured: 1000000 }, email: null, identifier: null });
  t.engine.clients.set(HEALTH, healthClient(HEALTH, { policyholderName: "Sunita Rao", shareToken: "tok-health" }));
  return t;
}

test("the phrasings route to policy edits, and lead/customer edits stay where they were", () => {
  assert.equal(ruleIntent("premium is 14,500 not 15,400"), "policyfix");
  assert.equal(ruleIntent("change Ramesh's car policy premium to 14500"), "policyfix");
  assert.equal(ruleIntent("Ramesh ki policy ka premium 14500 kar do"), "policyfix");
  assert.equal(ruleIntent("edit this policy"), "policyfix");
  assert.equal(ruleIntent("change the phone on this policy to 98123 45678"), "policyfix");
  assert.equal(ruleIntent("stop sharing Sunita's report"), "unshare");
  assert.equal(ruleIntent("change Amit's phone to 98123 45678"), "edit", "a person's phone is still a lead/customer edit");
  assert.equal(ruleIntent("change Amit's expected premium to 25k"), "edit");
  assert.equal(ruleIntent("premium is kya"), null, "a question is never an edit");
  assert.equal(ruleIntent("stop sharing my page"), null);
});

test("one-shot fix on the car policy: old -> new shown, saved only on YES, UNDO puts it back", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("change Ramesh's car policy premium to 14,500 not 15,400"));
  assert.match(transport.last(), /Ramesh Kumar's .*: Premium ₹15,400 → ₹14,500/);
  assert.equal(engine.writes.length, 0, "nothing written before YES");
  await bot.handle(text("yes"));
  assert.match(transport.last(), /Done\. Ramesh Kumar's .*: Premium is now ₹14,500/);
  assert.match(transport.last(), new RegExp(`/agent/policies/${CAR}`));
  assert.equal(engine.policyExtra.get(CAR)!.data.premium, 14500);
  assert.equal(engine.policyExtra.get(CAR)!.rev, 3);
  await bot.handle(text("undo"));
  assert.match(transport.last(), /Undo: Premium of .* back to ₹15,400/);
  await bot.handle(text("yes"));
  assert.equal(engine.policyExtra.get(CAR)!.data.premium, 15400);
});

test("'premium is ...' is about the policy last looked at; 'cover' means that type's cover", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("edit Ramesh's life policy"));
  assert.match(transport.last(), /What should I change on Ramesh Kumar's /);
  assert.match(transport.last(), /Sum assured: ₹10,00,000/);
  await bot.handle(text("cancel"));
  await bot.handle(text("cover is 15 lakh"));
  assert.match(transport.last(), /Sum assured ₹10,00,000 → ₹15,00,000/);
  await bot.handle(text("yes"));
  assert.equal(engine.policyExtra.get(LIFE)!.data.sum_assured, 1500000);
});

test("two policies for one name: asks which, then carries the change through", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("change Ramesh's premium to 14500"));
  assert.match(transport.last(), /1/);
  await bot.handle(text("1"));
  assert.match(transport.last(), /Premium .* → ₹14,500/);
  await bot.handle(text("yes"));
  assert.equal(engine.writes.length, 1);
});

test("a change in the portal between the confirm and YES: not saved, said plainly", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("change Ramesh's car policy idv to 5.2 lakh"));
  engine.policyExtra.get(CAR)!.rev = 9; // saved in the portal meanwhile
  await bot.handle(text("yes"));
  assert.match(transport.last(), /I didn't save it, because someone just changed .* in the portal/);
  assert.equal(engine.policyExtra.get(CAR)!.data.idv, 500000);
});

test("UNDO is refused when the value was changed again after our save", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("change Ramesh's car policy premium to 14500"));
  await bot.handle(text("yes"));
  engine.policyExtra.get(CAR)!.data.premium = 16000;
  await bot.handle(text("undo"));
  await bot.handle(text("yes"));
  assert.match(transport.last(), /can't undo that from here/);
  assert.equal(engine.policyExtra.get(CAR)!.data.premium, 16000, "the later edit is never overwritten");
});

test("guided: field list, then a bad value is asked again, then a date in words", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("edit Ramesh's car policy"));
  const list = transport.last();
  assert.match(list, /1\) Policyholder name: Ramesh Kumar/);
  const n = list.split("\n").find((l) => /Policy expiry date/.test(l))!.match(/^(\d+)\)/)![1];
  await bot.handle(text(n));
  assert.match(transport.last(), /What's the new Policy expiry date for .* Right now it is /);
  await bot.handle(text("someday"));
  assert.match(transport.last(), /seems a little off \(not a date\)/);
  await bot.handle(text("1 April 2027"));
  assert.match(transport.last(), /→/);
  await bot.handle(text("yes"));
  assert.equal(engine.policyExtra.get(CAR)!.data.policy_expiry_date, "2027-04-01");
});

test("health: only client details; a saved detail is refused before any confirm", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("change Sunita's policy premium to 9000"));
  assert.match(transport.last(), /On a health policy, the details come from the policy check/);
  assert.match(transport.last(), /Policyholder name, Phone, Email, Policy number/);
  await bot.handle(text("change Sunita's policy phone to 98111 22233"));
  assert.match(transport.last(), /Phone 98123 45678 → 98111 22233/);
  await bot.handle(text("yes"));
  assert.equal(engine.clients.get(HEALTH)!.customerPhone, "9811122233");
  await bot.handle(text("undo"));
  await bot.handle(text("yes"));
  assert.equal(engine.clients.get(HEALTH)!.customerPhone, "9812345678");
  assert.equal(engine.writes.filter((w) => w.kind === "policyFieldSave").length, 0, "nothing in a health check is changed");
});

test("clearing a saved detail is for the portal", async () => {
  const { bot, transport } = setup();
  await bot.handle(text("edit Ramesh's car policy"));
  const n = transport.last().split("\n").find((l) => /Premium:/.test(l))!.match(/^(\d+)\)/)![1];
  await bot.handle(text(n));
  await bot.handle(text("none"));
  assert.match(transport.last(), /seems a little off/);
});

test("stop sharing: confirm, only the switch moves, UNDO gives the same link back", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("stop sharing Sunita's report"));
  assert.match(transport.last(), /Stop sharing Sunita Rao's .*until you share it again/);
  await bot.handle(text("yes"));
  assert.match(transport.last(), /Sharing stopped for Sunita Rao's .*no longer opens/);
  assert.equal(engine.clients.get(HEALTH)!.shareToken, null);
  await bot.handle(text("undo"));
  assert.match(transport.last(), /Undo: share .* again \(same link\)/);
  await bot.handle(text("yes"));
  assert.equal(engine.clients.get(HEALTH)!.shareToken, "tok-health");
});

test("stop sharing a report that is not shared: nothing to confirm", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("find Ramesh"));
  await bot.handle(text("stop sharing Ramesh's report"));
  assert.match(transport.last(), /couldn't find a shared report/);
  assert.equal(engine.writes.length, 0);
});

test("Hindi: the policy-edit lines are translated", async () => {
  const { bot, transport } = setup();
  await bot.handle(text("hindi"));
  await bot.handle(text("edit Ramesh's car policy"));
  assert.match(transport.last(), /में क्या बदलूँ\?/);
  await bot.handle(text("cancel"));
  await bot.handle(text("stop sharing Sunita's report"));
  assert.match(transport.last(), /की शेयरिंग बंद। जब तक दोबारा शेयर न करें/);
  await bot.handle(text("haan"));
  assert.match(transport.last(), /की शेयरिंग बंद हो गई/);
  assert.match(transport.last(), /लिंक वही रहेगा/);
});

test("an amount or date word needs a number: questions and other requests are never edits", () => {
  assert.notEqual(ruleIntent("cover calculate karna hai"), "policyfix");
  assert.notEqual(ruleIntent("premium is too high"), "policyfix");
  assert.notEqual(ruleIntent("expiry date kya hai"), "policyfix");
  assert.equal(ruleIntent("nominee is Sunita Rao"), "policyfix", "a text detail needs no number");
});

test("critic: questions, other commands and unreadable amounts are never policy edits", () => {
  for (const s of ["premium is 15000?", "premium 15000 hai na", "the premium is 15,400 right", "premium is 15000 kya",
    "mode is hindi", "change mode to hindi", "set the mode to hindi", "cover 1 crore for family of 4 hai", "report band karo"]) {
    assert.ok(!["policyfix", "unshare"].includes(String(ruleIntent(s))), s);
  }
});

test("critic: phrasings advisors will use are understood", () => {
  for (const s of ["Ramesh's premium is 15000", "Sunita ka premium 15000 hai", "premium: 15000", "Ramesh's due date is 5 march 2027"]) {
    assert.equal(ruleIntent(s), "policyfix", s);
  }
  assert.equal(anyDate("1-3-27"), "2027-03-01");
  assert.equal(strictAmount("Rs. 5,00,000/-"), 500000);
});

test("critic: 'expiry' on a motor policy with an own-damage date changes the renewal date", async () => {
  const { bot, transport, engine } = setup();
  engine.policyExtra.get(CAR)!.data.od_expiry_date = "2026-12-01";
  await bot.handle(text("change Ramesh's car policy expiry to 1 Dec 2027"));
  assert.match(transport.last(), /Own-damage expiry \(renewal date\) .* → /);
  await bot.handle(text("yes"));
  assert.equal(engine.policyExtra.get(CAR)!.data.od_expiry_date, "2027-12-01");
  assert.equal(engine.policyExtra.get(CAR)!.data.policy_expiry_date, "2027-03-01");
});
