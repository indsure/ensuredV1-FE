/** Stage 2c: claims, end to end through the bot. Open (existing customer), details, open stages,
 *  insurer queries, the one extension; never close or reopen. The fake engine applies the
 *  backend's rules (whatsapp/edits.ts, shared editRules). ALL NAMES AND NUMBERS ARE MADE UP. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeBot, text } from "./fakes.js";
import { ruleIntent } from "../src/core/intents.js";

const CUST = "33333333-3333-4333-8333-333333333333";
const CLM = "88888888-8888-4888-8888-888888888888";

function setup(status = "submitted") {
  const t = makeBot();
  t.engine.customers.push({ id: CUST, name: "Sunita Rao", phone: "9800000002" } as any);
  t.engine.claimStore.set(CLM, {
    id: CLM, status, claim_type: "reimbursement", insurer: "Some Health", tpa: null, policy_number: null, hospital: "City Hospital",
    ailment: null, claimed_amount: "150000.00", settled_amount: null, admitted_on: "2026-10-01", discharged_on: null, customer_id: CUST,
  });
  return t;
}

test("the phrasings route to claims, and lookups and lead edits stay where they were", () => {
  for (const s of ["open a claim for Sunita", "Sunita ka claim kholo", "Sunita's claim submitted", "edit Sunita's claim",
    "insurer wants discharge summary for Sunita's claim", "Sunita's claim query answered", "extend Sunita's claim",
    "Sunita's claim hospital is Apollo", "Sunita's claim settled"]) assert.equal(ruleIntent(s), "claimedit", s);
  for (const s of ["claims", "Sunita's claim status?", "Sunita ka claim kya hua"]) assert.equal(ruleIntent(s), "claims", s);
  assert.equal(ruleIntent("change Amit's phone to 98123 45678"), "edit");
});

test("open: needs an existing customer, asks cashless or reimbursement, saved on YES, UNDO removes it", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("open a claim for Ramesh"));
  assert.match(transport.last(), /No customer called "Ramesh" yet\. Add them first: add customer Ramesh/);
  await bot.handle(text("open a claim for Sunita"));
  assert.match(transport.last(), /cashless or reimbursement\?/);
  await bot.handle(text("1"));
  assert.match(transport.last(), /Open a cashless claim for \*Sunita Rao\*/);
  assert.equal(engine.writes.length, 0, "nothing written before YES");
  await bot.handle(text("yes"));
  assert.match(transport.last(), /Claim opened for \*Sunita Rao\* \(cashless\)/);
  assert.match(transport.last(), /Sunita Rao's claim hospital is Apollo/);
  assert.equal(engine.claimStore.size, 2);
  await bot.handle(text("undo"));
  assert.match(transport.last(), /Undo: remove the claim you just opened for \*Sunita Rao\*/);
  await bot.handle(text("yes"));
  assert.match(transport.last(), /Undone: removed the claim for \*Sunita Rao\*/);
  assert.equal(engine.claimStore.size, 1);
});

test("stage: old -> new shown, saved on YES, UNDO puts it back; closing goes to the portal", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("Sunita's claim is under process"));
  assert.match(transport.last(), /Sunita Rao's claim: "Submitted to insurer" → "Claim under process"/);
  await bot.handle(text("yes"));
  assert.equal(engine.claimStore.get(CLM).status, "under_process");
  await bot.handle(text("undo"));
  await bot.handle(text("yes"));
  assert.equal(engine.claimStore.get(CLM).status, "submitted");
  await bot.handle(text("Sunita's claim settled"));
  assert.match(transport.last(), /done in the portal, where you attach the insurer's letter/);
  assert.equal(engine.claimStore.get(CLM).status, "submitted");
});

test("a closed claim is never changed from WhatsApp", async () => {
  const { bot, transport, engine } = setup("settled");
  await bot.handle(text("Sunita's claim hospital is Apollo"));
  assert.match(transport.last(), /claim is closed\. Change it in the portal/);
  assert.equal(engine.writes.length, 0);
});

test("details: strict amount, compare-before, UNDO refused after a later portal change", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("change Sunita's claim amount to 2 lakh 50 hazar"));
  assert.match(transport.last(), /doesn't look right \(not an amount\)/);
  await bot.handle(text("cancel"));
  await bot.handle(text("change Sunita's claim amount to 1.8 lakh"));
  assert.match(transport.last(), /Amount claimed ₹1,50,000 → ₹1,80,000/);
  await bot.handle(text("yes"));
  assert.equal(engine.claimStore.get(CLM).claimed_amount, "180000.00");
  engine.claimStore.get(CLM).claimed_amount = "190000.00"; // edited in the portal after
  await bot.handle(text("undo"));
  await bot.handle(text("yes"));
  assert.match(transport.last(), /can't be undone/);
  assert.equal(engine.claimStore.get(CLM).claimed_amount, "190000.00");
});

test("guided: edit Sunita's claim -> field list -> value -> confirm", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("edit Sunita's claim"));
  const list = transport.last();
  assert.match(list, /What should I change on Sunita Rao's claim\?/);
  const n = list.split("\n").find((l) => /Hospital:/.test(l))!.match(/^(\d+)\)/)![1];
  await bot.handle(text(n));
  await bot.handle(text("Apollo Hospital"));
  assert.match(transport.last(), /Hospital City Hospital → Apollo Hospital/);
  await bot.handle(text("yes"));
  assert.equal(engine.claimStore.get(CLM).hospital, "Apollo Hospital");
});

test("query: logged on YES with no undo offered; answered later moves the claim back to under process; UNDO reopens", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("insurer wants discharge summary for Sunita's claim"));
  assert.match(transport.last(), /log the insurer's query "discharge summary"/);
  assert.match(transport.last(), /no undo for this/);
  await bot.handle(text("yes"));
  assert.match(transport.last(), /Query round 1 logged/);
  assert.doesNotMatch(transport.last(), /Reply UNDO/);
  assert.equal(engine.claimStore.get(CLM).status, "query_raised");
  await bot.handle(text("Sunita Rao's claim query answered"));
  assert.match(transport.last(), /query round 1 \("discharge summary"\) answered/);
  await bot.handle(text("yes"));
  assert.match(transport.last(), /back at "Claim under process"/);
  assert.equal(engine.claimStore.get(CLM).status, "under_process");
  await bot.handle(text("undo"));
  await bot.handle(text("yes"));
  assert.equal(engine.claimStore.get(CLM).status, "query_raised");
  assert.equal(engine.queryStore[0].resolved_on, null);
});

test("extend: only when the portal's rule allows; no undo offered", async () => {
  const { bot, transport, engine } = setup();
  await bot.handle(text("extend Sunita's claim"));
  assert.match(transport.last(), /only once, in the last 5 days/);
  engine.canExtend.add(CLM);
  await bot.handle(text("extend Sunita's claim"));
  assert.match(transport.last(), /one extension and can't be undone/);
  await bot.handle(text("yes"));
  assert.match(transport.last(), /documents kept 30 more days/);
  assert.doesNotMatch(transport.last(), /Reply UNDO/);
});

test("Hindi: the claim lines are translated", async () => {
  const { bot, transport } = setup();
  await bot.handle(text("hindi"));
  await bot.handle(text("Sunita's claim is under process"));
  assert.match(transport.last(), /पक्का कीजिए|Pakka/);
  await bot.handle(text("haan"));
  assert.match(transport.last(), /अब .* पर है|अब "/);
  await bot.handle(text("Sunita's claim settled"));
  assert.match(transport.last(), /पोर्टल/);
});
