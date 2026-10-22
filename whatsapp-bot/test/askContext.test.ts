/** 2026-10-22, founder's screenshot: after looking up Kachru Mhatre (65/100), "Is it a bad
 *  policy?" was answered from an EARLIER policy (95/100). Questions must always be about the
 *  policy last shown. Names and numbers are made up. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeBot, text, healthClient } from "./fakes.js";
import type { Action, Understanding } from "../src/core/understand.js";

const OLD = "2f6ceb6e-129d-424d-becd-2524405996c8";
const NEW = "23b133b2-b3ae-4c63-92e7-270c87fe7b47";
const act = (type: Action["type"], f: Partial<Action> = {}): Action => ({
  type, name: null, phone: null, status: null, follow_up_date: null, note: null, interest: null,
  draft_kind: null, language: null, plans: null, question: null, policy_type: null, ...f,
});
const says = (...actions: Action[]): Understanding => ({ actions, clarify: null });

function setup() {
  const t = makeBot();
  t.engine.clients.set(OLD, healthClient(OLD, { policyholderName: "Older Customer", score: 95 }));
  t.engine.clients.set(NEW, healthClient(NEW, { policyholderName: "Kachru Mhatre", score: 65, insurer: "Star Health", policyName: "Star Plan" }));
  // The conversation still points at the older policy.
  t.engine.conv = { state: "REPORT_READY", currentClientId: OLD, pending: {}, updatedAt: null };
  return t;
}

test("THE SCREENSHOT, paid plan (model path): a lookup by name, then 'is it a bad policy?' is about THAT policy", async () => {
  const { bot, transport, engine } = setup();
  engine.modelOn = true;
  engine.understandMap.set("Kachru Mhatre", says(act("lookup", { name: "Kachru Mhatre" })));
  engine.understandMap.set("Is it a bad policy?", says(act("ask_report", { question: "Is it a bad policy?" })));
  engine.phraseAnswer = { answer: "Weak spots: room rent capped." };
  await bot.handle(text("Kachru Mhatre"));
  assert.match(transport.last(), /65\/100/);
  await bot.handle(text("Is it a bad policy?"));
  const r = transport.last();
  assert.match(r, new RegExp(`/agent/policies/${NEW}`), "the answer links the policy that was looked up");
  assert.doesNotMatch(r, new RegExp(OLD));
  assert.match(r, /^\*?Kachru Mhatre\*? · Star Plan · 65\/100/, "it says which policy, with its score, first");
});

test("free plan (rule path): find X, then a policy question is about X too", async () => {
  const { bot, transport } = setup();
  await bot.handle(text("find Kachru"));
  await bot.handle(text("is there a co-pay?"));
  const r = transport.last();
  assert.match(r, new RegExp(`/agent/policies/${NEW}`));
  assert.match(r, /Kachru Mhatre\* · .*65\/100/);
});

test("with no lookup in between, the stored policy is still the one asked about", async () => {
  const { bot, transport } = setup();
  await bot.handle(text("is there a co-pay?"));
  assert.match(transport.last(), new RegExp(`/agent/policies/${OLD}`));
});
