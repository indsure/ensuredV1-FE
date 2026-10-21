/** Stage 2a: edits to leads, customers and filing, end to end through the bot. The fake engine
 *  applies the backend's own value rules and compare-before (backend/server/whatsapp/edits.ts).
 *  ALL NAMES AND NUMBERS ARE MADE UP. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeBot, text, healthClient } from "./fakes.js";
import { ruleIntent } from "../src/core/intents.js";
import { localise } from "../src/core/i18n.js";

const lead = (over: any = {}) => ({ id: "l-" + Math.random().toString(36).slice(2), name: "Amit Shah", phone: "9800000001", status: "new", insurance_interest: "Health", next_follow_up: null, notes: null, email: null, city: "Mumbai", source: null, expected_value: null, customer_id: null, ...over });
const POLICY = "77777777-7777-4777-8777-777777777777";

test("one-shot edit: old -> new shown, nothing saved before YES, saved on YES, UNDO puts it back", async () => {
  const { bot, transport, engine } = makeBot();
  const l = lead();
  engine.leadRows = [l];
  await bot.handle(text("change Amit's city to Pune"));
  assert.match(transport.last(), /Amit Shah\* \(lead\): City Mumbai → Pune/);
  assert.equal(engine.writes.length, 0, "nothing written before YES");
  await bot.handle(text("yes"));
  assert.match(transport.last(), /Saved\. \*Amit Shah\*: City is now Pune/);
  assert.equal(l.city, "Pune");
  await bot.handle(text("undo"));
  assert.match(transport.last(), /Undo: City of \*Amit Shah\* back to Mumbai/);
  await bot.handle(text("yes"));
  assert.equal(l.city, "Mumbai");
});

test("a change in the portal between the confirm and YES: not saved, said plainly", async () => {
  const { bot, transport, engine } = makeBot();
  const l = lead();
  engine.leadRows = [l];
  await bot.handle(text("change Amit's phone to 98123 45678"));
  l.phone = "9811111111"; // someone edits it in the portal
  await bot.handle(text("yes"));
  assert.match(transport.last(), /Not saved: \*Amit Shah\* was changed in the portal a moment ago/);
  assert.equal(l.phone, "9811111111", "the portal's value is untouched");
  assert.equal(engine.writes.length, 0);
});

test("UNDO is refused when the value was changed again after our save", async () => {
  const { bot, transport, engine } = makeBot();
  const l = lead();
  engine.leadRows = [l];
  await bot.handle(text("Amit ka city Pune kar do"));
  await bot.handle(text("haan"));
  l.city = "Nashik"; // a later portal edit
  await bot.handle(text("undo"));
  await bot.handle(text("haan"));
  assert.match(transport.last(), /undo nahi ho sakta|can't be undone/);
  assert.equal(l.city, "Nashik", "the later edit is never overwritten");
});

test("guided: edit Amit -> numbered fields with current values -> new value -> confirm", async () => {
  const { bot, transport, engine } = makeBot();
  const l = lead();
  engine.leadRows = [l];
  await bot.handle(text("edit Amit"));
  assert.match(transport.last(), /What should I change for \*Amit Shah\* \(lead\)\?/);
  assert.match(transport.last(), /2\) Phone: 98000 00001/);
  await bot.handle(text("2"));
  assert.match(transport.last(), /Type the new Phone for \*Amit Shah\*/);
  await bot.handle(text("12345"));
  assert.match(transport.last(), /doesn't look right \(not a 10 digit mobile number\)/);
  await bot.handle(text("98765 43210"));
  assert.match(transport.last(), /Phone 98000 00001 → 98765 43210/);
  await bot.handle(text("yes"));
  assert.equal(l.phone, "9876543210");
});

test("the same value again: nothing to change", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [lead()];
  await bot.handle(text("Amit's city is Mumbai"));
  assert.match(transport.last(), /already Mumbai\. Nothing to change/);
});

test("a lead and a customer with the same name: asked which one", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [lead()];
  engine.customers = [{ id: "c-1", name: "Amit Shah", phone: "9800000002", city: null }];
  await bot.handle(text("change Amit's email to amit@example.com"));
  assert.match(transport.last(), /Which one\?\n1\) Amit Shah, lead/);
  assert.match(transport.last(), /2\) Amit Shah, customer/);
  await bot.handle(text("2"));
  assert.match(transport.last(), /Amit Shah\* \(customer\): Email \(empty\) → amit@example\.com/);
  await bot.handle(text("yes"));
  assert.equal(engine.customers[0].email, "amit@example.com");
});

test("a field a customer does not have is explained, not guessed", async () => {
  const { bot, transport, engine } = makeBot();
  engine.customers = [{ id: "c-1", name: "Sunita Rao", phone: null, city: null }];
  await bot.handle(text("set Sunita's budget to 25k"));
  assert.match(transport.last(), /Expected premium is not kept for a customer/);
});

test("interests and money as advisors type them", async () => {
  const { bot, transport, engine } = makeBot();
  const l = lead();
  engine.leadRows = [l];
  await bot.handle(text("Amit is interested in motor and life"));
  assert.match(transport.last(), /Interested in Health → Motor, Life/);
  await bot.handle(text("yes"));
  await bot.handle(text("set Amit's budget to 1.5 lakh"));
  assert.match(transport.last(), /Expected premium \(empty\) → ₹1,50,000/);
});

test("make Amit a customer: confirm, YES, UNDO makes him a lead again and removes the empty customer", async () => {
  const { bot, transport, engine } = makeBot();
  const l = lead();
  engine.leadRows = [l];
  await bot.handle(text("make Amit a customer"));
  assert.match(transport.last(), /Make \*Amit Shah\* a customer/);
  await bot.handle(text("yes"));
  assert.match(transport.last(), /Amit Shah\* is now a customer/);
  assert.equal(l.status, "won");
  assert.equal(engine.customers.length, 1);
  await bot.handle(text("undo"));
  await bot.handle(text("yes"));
  assert.match(transport.last(), /Amit Shah\* is a lead again/);
  assert.equal(l.status, "new");
  assert.equal(engine.customers.length, 0);
  await bot.handle(text("make Amit a customer"));
  await bot.handle(text("yes"));
  await bot.handle(text("make Amit a customer"));
  assert.match(transport.last(), /already a customer/);
});

test("add customer: confirm, YES, UNDO removes it while it is still empty; the same phone is never doubled", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("add customer Sunita Rao 98123 45678, Pune"));
  assert.match(transport.last(), /Add customer \*Sunita Rao\*, 98123 45678, Pune/);
  await bot.handle(text("yes"));
  assert.match(transport.last(), /Customer \*Sunita Rao\* added/);
  await bot.handle(text("undo"));
  await bot.handle(text("yes"));
  assert.equal(engine.customers.length, 0);
  engine.customers = [{ id: "c-9", name: "Sunita Rao", phone: "9812345678", city: null }];
  await bot.handle(text("add customer Sunita 98123 45678"));
  await bot.handle(text("yes"));
  assert.match(transport.last(), /already your customer, with that phone number/);
  assert.equal(engine.customers.length, 1);
});

test("filing: under a customer by name, UNDO puts it back; unfile", async () => {
  const { bot, transport, engine } = makeBot();
  engine.clients.set(POLICY, healthClient(POLICY, { policyholderName: "Ramesh Kumar" }));
  engine.customers = [{ id: "c-1", name: "Sunita Rao", phone: null, city: null }];
  await bot.handle(text("file Ramesh's policy under Sunita"));
  assert.match(transport.last(), /File Ramesh Kumar's Care Health Care Supreme under \*Sunita Rao\*|File Ramesh Kumar's .+ under \*Sunita Rao\*/);
  await bot.handle(text("yes"));
  assert.equal(engine.clients.get(POLICY)!.customerId, "c-1");
  await bot.handle(text("undo"));
  await bot.handle(text("yes"));
  assert.equal(engine.clients.get(POLICY)!.customerId, null);
  engine.clients.get(POLICY)!.customerId = "c-1";
  await bot.handle(text("find Ramesh"));
  await bot.handle(text("remove this policy from Sunita"));
  assert.doesNotMatch(transport.last(), /can't delete/, "taking a policy out of a customer is not a delete");
  assert.match(transport.last(), /Take .+ out of \*Sunita Rao\*/);
});

test("this is Sunita's: the policy we are talking about; new customer from this policy, undone together", async () => {
  const { bot, transport, engine } = makeBot();
  engine.clients.set(POLICY, healthClient(POLICY, { policyholderName: "Ramesh Kumar", customerPhone: "9812345678" }));
  engine.customers = [{ id: "c-1", name: "Sunita Rao", phone: null, city: null }];
  await bot.handle(text("find Ramesh"));
  await bot.handle(text("this is Sunita's"));
  assert.match(transport.last(), /under \*Sunita Rao\*/);
  await bot.handle(text("no"));
  await bot.handle(text("new customer from this policy"));
  assert.match(transport.last(), /Add customer \*Ramesh Kumar\*, 98123 45678 and file .+ under them/);
  await bot.handle(text("yes"));
  const made = engine.customers.find((c) => c.name === "Ramesh Kumar")!;
  assert.equal(engine.clients.get(POLICY)!.customerId, made.id);
  await bot.handle(text("undo"));
  await bot.handle(text("yes"));
  assert.equal(engine.clients.get(POLICY)!.customerId, null);
  assert.ok(!engine.customers.some((c) => c.name === "Ramesh Kumar"), "the customer made only for this is gone too");
});

test("older commands are unchanged by the edit rules", () => {
  assert.notEqual(ruleIntent("Amit is interested"), "edit", "a status, not an edit");
  assert.notEqual(ruleIntent("Kavita ka number kya hai"), "edit", "a lookup (rephrase.ts), never an edit");
  assert.notEqual(ruleIntent("convert ramesh into lead that is won"), "convert");
  assert.notEqual(ruleIntent("change city"), "edit");
  assert.equal(ruleIntent("remove this policy from Sunita"), "file");
  assert.equal(ruleIntent("delete Ramesh"), null);
});

test("Hinglish edit: the confirm comes in Hinglish", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [lead()];
  await bot.handle(text("Amit ka city Pune kar do"));
  assert.match(transport.last(), /Pakka kijiye/);
});

test("every new fixed line has Hindi and Hinglish", () => {
  const lines = [
    "What should I change for Amit (lead)?", "1) Phone: 98", "Type the new Phone for Amit. Now: 98",
    "(Or NONE to clear it, CANCEL to stop.)", "Not saved: Amit was changed in the portal a moment ago. Ask again to see the latest.",
    "✅ Saved. Amit: City is now Pune.", "✅ Amit is now a customer.", "✅ Customer Sunita added.",
    "That can't be undone here any more: it was changed since, or something was added to it. Please fix it in the portal.",
    "• Make Amit a customer. Their phone, email, city and notes are copied, and the lead is marked won",
    "• Take X out of Sunita", "Which customer?",
  ];
  const missing: string[] = [];
  for (const lang of ["hindi", "hinglish"] as const) for (const l of lines) if (localise(l, lang) === l) missing.push(`${lang}: ${l}`);
  assert.deepEqual(missing, []);
});

/* ── Critic round (code review of 2a) ── */

test("critic: lead adds that mention an interest are lead adds, never edits", () => {
  for (const t of ["add lead Amit wants health", "new lead Amit 9812345678 wants motor", "lead Amit wants motor", "add lead Kavita interested in term", "new lead: Amit, wants health and motor", "Ramesh 9812345678 wants health"]) {
    assert.notEqual(ruleIntent(t), "edit", t);
  }
  assert.equal(ruleIntent("add lead Amit wants health"), "lead");
});

test("critic: other phrases that are not edits or filings", () => {
  for (const t of ["add this to my renewals", "move this to next week", "file this under review", "edit my page", "edit my website"]) {
    assert.ok(!["edit", "file"].includes(ruleIntent(t) as string), t);
  }
  assert.equal(ruleIntent("file this under Sunita"), "file");
  assert.equal(ruleIntent("move this policy to Sunita"), "file");
});

test("critic: a question mark is never taken as the new value", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [lead()];
  await bot.handle(text("Amit's city is what?"));
  assert.doesNotMatch(transport.last(), /→ what/);
});

test("critic: UNDO restores a value today's rules would reject (old free-text interest)", async () => {
  const { bot, transport, engine } = makeBot();
  const l = lead({ insurance_interest: "health insurance" });
  engine.leadRows = [l];
  await bot.handle(text("Amit is interested in motor"));
  await bot.handle(text("yes"));
  assert.equal(l.insurance_interest, "Motor");
  await bot.handle(text("undo"));
  await bot.handle(text("yes"));
  assert.equal(l.insurance_interest, "health insurance", "the original is back exactly");
  assert.doesNotMatch(transport.last(), /can't be undone/);
});

test("critic: UNDO of a just-added customer is refused once the portal changed it", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("add customer Sunita Rao 98123 45678"));
  await bot.handle(text("yes"));
  engine.customers[0].city = "Pune"; // a portal edit within the 15 minutes
  await bot.handle(text("undo"));
  await bot.handle(text("yes"));
  assert.match(transport.last(), /can't be undone/);
  assert.equal(engine.customers.length, 1, "the edited customer stays");
});

test("critic: while waiting for a value, a word like Website is the value, not a command", async () => {
  const { bot, transport, engine } = makeBot();
  const l = lead();
  engine.leadRows = [l];
  await bot.handle(text("edit Amit"));
  await bot.handle(text("6"));
  await bot.handle(text("website"));
  assert.match(transport.last(), /Source \(empty\) → Website/);
});

test("critic: adding a lead then a status in one go can still be undone together", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("lead Ravi Kumar 98123 45670 health"));
  await bot.handle(text("yes"));
  await bot.handle(text("Ravi won"));
  await bot.handle(text("yes"));
  await bot.handle(text("undo"));
  await bot.handle(text("yes"));
  assert.match(transport.last(), /back as it was|Undone/);
});
