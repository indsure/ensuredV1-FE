import { test } from "node:test";
import assert from "node:assert/strict";
import { makeBot, text, healthClient } from "./fakes.js";
import { ruleAnswer, basics, keepOrSwitch } from "../src/core/answers.js";

const palash = () => healthClient("7568d5f5-78f5-4cfa-9700-d2897e2ddf4b", {
  policyholderName: "Palash Baheti", insurer: "ManipalCigna", policyName: "India Plan", expiryDate: "2027-09-21", score: 90,
});

test("Keep / Switch follows the portal: under 70 is Switch", () => {
  assert.equal(keepOrSwitch(90), "Keep");
  assert.equal(keepOrSwitch(70), "Keep");
  assert.equal(keepOrSwitch(69), "Switch");
  assert.equal(keepOrSwitch(null), null);
});

test("the Policies-list basics answer their own questions (English and Hinglish)", () => {
  const c = palash();
  assert.equal(ruleAnswer("when is the renewal?", c), "Next premium date: 21 Sep 2027.");
  assert.equal(ruleAnswer("renewal kab hai", c), "Next premium date: 21 Sep 2027.");
  assert.equal(ruleAnswer("kaunsi company hai", c), "Insurer: ManipalCigna.");
  assert.equal(ruleAnswer("which plan is it", c), "Plan: India Plan (ManipalCigna).");
  assert.match(ruleAnswer("should he switch?", c)!, /^Keep\. It scores 90\/100/);
  assert.equal(ruleAnswer("details batao", c), basics(c));
});

test("the basics card has everything the Policies list row shows", () => {
  assert.equal(basics(palash()), [
    "*Palash Baheti* · health", "Insurer: ManipalCigna", "Plan: India Plan", "Next premium date: 21 Sep 2027",
    "Score: 90/100 · Keep", "Sum insured: ₹5,00,000", "Premium: ₹18,450",
  ].join("\n"));
});

test("THE SCREENSHOT: a question the report can't answer still gets the basics, never a bare 'not in the report'", async () => {
  const { bot, transport, engine } = makeBot();
  const c = palash();
  engine.clients.set(c.clientId, c);
  await bot.handle(text("Palash ki policy mein maternity hai?"));
  const r = transport.lastRaw();
  assert.match(r, /\*Palash Baheti\* · Health/);
  assert.match(r, /Insurance company: ManipalCigna/, "in Hinglish, as the question was");
  assert.match(r, /Agla premium: 21 Sep 2027/);
  assert.match(r, /Score: 90\/100 · Rakhiye \(Keep\)/);
  assert.match(r, /Report mein iski jaankari nahi hai/);
});
