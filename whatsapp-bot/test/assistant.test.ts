import { test } from "node:test";
import assert from "node:assert/strict";
import { makeBot, text } from "./fakes.js";
import type { Action, Understanding } from "../src/core/understand.js";

/** A model answer, as the backend would return it (every field present). */
const act = (type: Action["type"], f: Partial<Action> = {}): Action => ({
  type, name: null, phone: null, status: null, follow_up_date: null, note: null, interest: null,
  draft_kind: null, language: null, plans: null, question: null, policy_type: null, ...f,
});
const says = (...actions: Action[]): Understanding => ({ actions, clarify: null });

const lead = (over: any = {}) => ({ id: "l-" + Math.random().toString(36).slice(2), name: "Ramesh Kumar", phone: "9812345678", status: "new", insurance_interest: "Health", next_follow_up: null, notes: null, ...over });

function withModel() {
  const t = makeBot();
  t.engine.modelOn = true;
  return t;
}

/* ── The original bug ── */

test("THE BUG: 'lead ramesh won' (model on) updates Ramesh, never creates 'Ramesh Won'", async () => {
  const { bot, transport, engine } = withModel();
  const r = lead();
  engine.leadRows = [r];
  engine.understandMap.set("lead ramesh won", says(act("update_lead", { name: "Ramesh", status: "won" })));
  await bot.handle(text("lead ramesh won"));
  assert.match(transport.last(), /• \*Ramesh Kumar\* \(98123 45678\): mark won/);
  assert.doesNotMatch(transport.last(), /Ramesh Won/i);
  await bot.handle(text("yes"));
  assert.equal(engine.leadUpdates[0].id, r.id);
  assert.equal(engine.leads.length, 0, "no new lead created");
});

test("THE BUG, model off: rules read 'lead Ramesh won' as Ramesh + status won too", async () => {
  const { bot, transport, engine } = makeBot();
  const r = lead();
  engine.leadRows = [r];
  await bot.handle(text("lead Ramesh won"));
  assert.match(transport.last(), /• \*Ramesh Kumar\* \(98123 45678\): mark won/);
  await bot.handle(text("yes"));
  assert.equal(engine.leadUpdates[0].id, r.id);
  assert.equal(engine.leads.length, 0);
});

test("'convert ramesh into lead that is won' when no Ramesh exists: says so, adds with status won", async () => {
  const { bot, transport, engine } = withModel();
  engine.understandMap.set("convert ramesh into lead that is won", says(act("update_lead", { name: "Ramesh", status: "won" })));
  await bot.handle(text("convert ramesh into lead that is won"));
  assert.match(transport.last(), /No lead called \*Ramesh\* yet\. Add lead \*Ramesh\*: mark won/);
  await bot.handle(text("yes"));
  assert.deepEqual(engine.leads.map((l) => [l.name, l.status]), [["Ramesh", "won"]]);
});

/* ── YES / NO / changing your mind ── */

test("NO cancels; nothing is written", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [lead()];
  await bot.handle(text("Ramesh won"));
  await bot.handle(text("no"));
  assert.match(transport.last(), /Okay, nothing changed\./);
  assert.equal(engine.leadUpdates.length, 0);
});

test("a different request during a confirmation drops the change (unsaved) and carries on", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [lead()];
  await bot.handle(text("Ramesh won"));
  await bot.handle(text("renewals"));
  const texts = transport.texts();
  assert.ok(texts.some((t) => t === "(That change was not saved.)"));
  assert.match(transport.last(), /Nothing due|renewal/);
  assert.equal(engine.leadUpdates.length, 0);
});

/* ── UNDO ── */

test("UNDO an update: puts the lead back exactly as it was", async () => {
  const { bot, transport, engine } = makeBot();
  const r = lead({ status: "interested", notes: "old note" });
  engine.leadRows = [r];
  await bot.handle(text("Ramesh won"));
  await bot.handle(text("yes"));
  assert.equal(r.status, "won");
  await bot.handle(text("undo"));
  assert.match(transport.last(), /Undo: put \*Ramesh Kumar\* back as it was/);
  await bot.handle(text("yes"));
  assert.equal(engine.restored[0].before.status, "interested");
  assert.equal(r.status, "interested");
  assert.match(transport.last(), /Undone: \*Ramesh Kumar\* is back as it was\./);
});

test("UNDO an add: removes the lead just added", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("lead Sunita Rao 9811122233 health"));
  await bot.handle(text("yes"));
  await bot.handle(text("undo"));
  await bot.handle(text("yes"));
  assert.equal(engine.undoneCreates.length, 1);
  assert.match(transport.last(), /removed the lead \*Sunita Rao\*/);
});

test("UNDO with nothing recent says so", async () => {
  const { bot, transport } = makeBot();
  await bot.handle(text("undo"));
  assert.match(transport.last(), /nothing recent to undo/);
});

/* ── The model's form, carried out ── */

test("two actions: 'mark Ramesh won and send him a thank you message'", async () => {
  const { bot, transport, engine } = withModel();
  engine.leadRows = [lead()];
  engine.understandMap.set("mark Ramesh won and send him a thank you message",
    says(act("update_lead", { name: "Ramesh", status: "won" }), act("draft_message", { name: "Ramesh", draft_kind: "thank_you" })));
  await bot.handle(text("mark Ramesh won and send him a thank you message"));
  const all = transport.texts().join("\n---\n");
  assert.match(all, /Here's a message for Ramesh Kumar/);
  assert.match(transport.last(), /• \*Ramesh Kumar\* \(98123 45678\): mark won/);
  await bot.handle(text("yes"));
  assert.equal(engine.leadUpdates[0].status, "won");
});

test("pronouns: the model is told who the chat is about", async () => {
  const { bot, engine } = withModel();
  engine.leadRows = [lead()];
  await bot.handle(text("find Ramesh"));
  engine.understandMap.set("mark him won", says(act("update_lead", { name: "Ramesh Kumar", status: "won" })));
  await bot.handle(text("mark him won"));
  const last = engine.understandCalls.at(-1)!;
  assert.equal(last.text, "mark him won");
  assert.equal(last.ctx.lastPerson, "Ramesh Kumar");
});

test("the model is unsure: its question is asked, nothing changes", async () => {
  const { bot, transport, engine } = withModel();
  engine.understandMap.set("mark won", { actions: [act("unknown")], clarify: "Who should I mark as won?" });
  await bot.handle(text("mark won"));
  assert.equal(transport.last(), "Who should I mark as won?");
  assert.equal(engine.leadUpdates.length, 0);
});

test("Hinglish: 'Ramesh ne policy le li' becomes an update to Ramesh, after YES", async () => {
  const { bot, transport, engine } = withModel();
  engine.leadRows = [lead()];
  engine.understandMap.set("Ramesh ne policy le li", says(act("update_lead", { name: "Ramesh", status: "won" })));
  await bot.handle(text("Ramesh ne policy le li"));
  assert.match(transport.last(), /mark won/);
  await bot.handle(text("haan"));
  assert.equal(engine.leadUpdates[0].status, "won");
});

test("two Rameshes: asks which, then confirms", async () => {
  const { bot, transport, engine } = withModel();
  const a = lead(), b2 = lead({ name: "Ramesh Shah", phone: "9811111111" });
  engine.leadRows = [a, b2];
  engine.understandMap.set("Ramesh is interested", says(act("update_lead", { name: "Ramesh", status: "interested" })));
  await bot.handle(text("Ramesh is interested"));
  assert.match(transport.last(), /Which Ramesh\?\n1\) Ramesh Kumar/);
  await bot.handle(text("2"));
  assert.match(transport.last(), /\*Ramesh Shah\* \(98111 11111\): mark interested/);
  await bot.handle(text("yes"));
  assert.equal(engine.leadUpdates[0].id, b2.id);
});

test("add of someone already in the book (same name) with a status becomes an update", async () => {
  const { bot, transport, engine } = withModel();
  engine.leadRows = [lead({ name: "Vikram Shah", phone: "9800012345" })];
  engine.understandMap.set("add Vikram Shah as interested", says(act("add_lead", { name: "Vikram Shah", status: "interested" })));
  await bot.handle(text("add Vikram Shah as interested"));
  assert.match(transport.last(), /• \*Vikram Shah\* \(98000 12345\): mark interested/);
});

test("read-only requests from the model run straight away (no YES needed)", async () => {
  const { bot, transport, engine } = withModel();
  engine.understandMap.set("who should I be calling today?", says(act("followups")));
  await bot.handle(text("who should I be calling today?"));
  assert.match(transport.last(), /No follow-ups due today/);
});

test("short clear commands never call the model (no cost)", async () => {
  const { bot, engine } = withModel();
  for (const m of ["renewals", "help", "my clients", "follow ups", "checks", "link", "claims"]) await bot.handle(text(m));
  assert.equal(engine.understandCalls.length, 0);
});

test("model off (production default): free text still works through the rules", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [lead()];
  await bot.handle(text("Ramesh won"));
  assert.match(transport.last(), /Please confirm:/);
  assert.equal(engine.understandCalls.length > 0, true, "it asked, and was told the model is off");
});
