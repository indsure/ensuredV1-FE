import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { makeBot, text, pdf, settle, ADVISOR, STRANGER, AGENT, healthClient } from "./fakes.js";

const sha = (s: string) => crypto.createHash("sha256").update(Buffer.from(`%PDF-1.4 ${s}`)).digest("hex");

test("unknown number gets one pointer reply, then silence", async () => {
  const { bot, transport } = makeBot();
  await bot.handle(text("hello", STRANGER));
  await bot.handle(text("hello again", STRANGER));
  assert.equal(transport.sent.length, 1);
  assert.match(transport.last(), /indsure\.in\/agent/);
});

test("a re-delivered message id gets no second reply", async () => {
  const { bot, transport } = makeBot();
  const m = text("help");
  await bot.handle(m);
  await bot.handle(m);
  assert.equal(transport.sent.length, 1);
});

test("LINK with the right code connects and welcomes; a wrong code is refused", async () => {
  const { bot, transport, engine } = makeBot();
  engine.pendingCodes.set(STRANGER, { code: "123456", agentId: AGENT });
  await bot.handle(text("LINK 999999", STRANGER));
  assert.match(transport.last(), /didn't work/);
  await bot.handle(text("link 123 456", STRANGER));
  assert.match(transport.last(), /You're connected to IndSure/);
});

test("photos, non-PDF files and oversized files get the right reply and no check", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle({ ...text(""), kind: "image" });
  assert.match(transport.last(), /only read PDF/);
  await bot.handle({ ...pdf(transport, "x", { name: "policy.docx" }), mimeType: "application/msword" });
  assert.match(transport.last(), /only read PDF/);
  await bot.handle(pdf(transport, "x", { size: 26 * 1024 * 1024 }));
  assert.match(transport.last(), /over 25MB/);
  assert.equal(engine.analyzeCalls.length, 0);
});

test("health PDF: acknowledge, report card from stored fields, report becomes current", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(pdf(transport, "HEALTH", { caption: "Ramesh Kumar" }));
  await settle(bot);
  const all = transport.texts().join("\n---\n");
  assert.match(transport.texts()[0], /Got it\. Checking this policy now/);
  assert.match(all, /Ramesh Kumar's Care Health Care Supreme: 65\/100, Good Core Coverage with Areas to Improve\./);
  assert.match(all, /Watch out for: Room rent capped at 1% of sum insured \(₹40,000 on a ₹3L bill\); Cataract sub-limit\./);
  assert.match(all, /Full report: https:\/\/indsure\.in\/agent\/policies\//);
  assert.equal(engine.analyzeCalls[0].type, "health");
  assert.equal(engine.analyzeCalls[0].policyholderName, "Ramesh Kumar");
  assert.ok(engine.conv.currentClientId);
});

test("no caption: asks whose policy, and files it under the one matching customer", async () => {
  const { bot, transport, engine } = makeBot();
  engine.customers = [{ id: "c1", name: "Sunita Sharma", phone: "9811111111" }];
  await bot.handle(pdf(transport, "HEALTH"));
  await settle(bot);
  assert.match(transport.last(), /Whose policy is this\?/);
  await bot.handle(text("sunita"));
  assert.match(transport.last(), /Saved under Sunita Sharma/);
  assert.equal(engine.attached.length, 1);
});

test("motor PDF goes to data entry with no score", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(pdf(transport, "MOTOR", { caption: "Anil 9876543210" }));
  await settle(bot);
  assert.equal(engine.analyzeCalls[0].type, "motor");
  assert.match(transport.texts().join("\n"), /Saved motor policy for Anil to your book\. Scores are for health policies only/);
  assert.doesNotMatch(transport.texts().join("\n"), /\/100/);
});

test("password-protected and Hindi PDFs are refused before any check", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(pdf(transport, "LOCKED"));
  assert.match(transport.last(), /password-protected.*No policy check was used/s);
  await bot.handle(pdf(transport, "HINDI"));
  assert.match(transport.last(), /written in Hindi/);
  assert.equal(engine.analyzeCalls.length, 0);
});

test("unknown type: numbered pick, then the check runs as the picked type", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(pdf(transport, "UNKNOWN"));
  assert.match(transport.last(), /What kind of policy is this\?/);
  await bot.handle(text("5"));
  await settle(bot);
  assert.equal(engine.analyzeCalls[0].type, "travel");
});

test("same file again: offers the existing report, re-runs only on YES", async () => {
  const { bot, transport, engine } = makeBot();
  engine.hashes.set(sha("HEALTH dup"), "22222222-2222-4222-8222-222222222222");
  await bot.handle(pdf(transport, "HEALTH dup"));
  assert.match(transport.last(), /already checked this exact file.*uses 1 policy check/s);
  await bot.handle(text("no"));
  assert.equal(engine.analyzeCalls.length, 0);
  await bot.handle(pdf(transport, "HEALTH dup"));
  await bot.handle(text("yes"));
  await settle(bot);
  assert.equal(engine.analyzeCalls.length, 1);
});

test("out of checks: tells the advisor, never uploads", async () => {
  const { bot, transport, engine } = makeBot();
  engine.checks = 0;
  await bot.handle(pdf(transport, "HEALTH"));
  await settle(bot);
  assert.match(transport.last(), /used all your policy checks/);
  assert.equal(engine.analyzeCalls.length, 0);
});

test("three PDFs at once: each acknowledged, run one at a time, each reported", async () => {
  const { bot, transport, engine } = makeBot();
  await Promise.all([
    bot.handle(pdf(transport, "HEALTH a", { caption: "A One" })),
    bot.handle(pdf(transport, "HEALTH b", { caption: "B Two" })),
    bot.handle(pdf(transport, "HEALTH c", { caption: "C Three" })),
  ]);
  await settle(bot);
  const all = transport.texts();
  assert.equal(all.filter((x) => /Got it\. Checking/.test(x)).length, 3);
  assert.equal(all.filter((x) => /\/100/.test(x)).length, 3);
  assert.equal(engine.maxInFlight, 1);
});

test("runs out of checks mid-queue: stops and says how many were not checked", async () => {
  const { bot, transport, engine } = makeBot();
  engine.checks = 1;
  // The up-front check counts files already in line, so only the first is accepted.
  await bot.handle(pdf(transport, "HEALTH a"));
  await bot.handle(pdf(transport, "HEALTH b"));
  await settle(bot);
  assert.equal(engine.analyzeCalls.length, 1);
  assert.ok(transport.texts().some((x) => /used all your policy checks/.test(x)));
});

test("a failed read goes to Needs Attention with a plain reason and fix", async () => {
  const { bot, transport, engine } = makeBot();
  engine.nextOutcome = { end: "error", error: "PDF does not appear to be a readable policy (scan)" };
  await bot.handle(pdf(transport, "HEALTH blurry"));
  await settle(bot);
  assert.match(transport.last(), /couldn't read this policy: the scan is too unclear to read\. Ask the customer for the insurer's original PDF\. It's waiting in Needs Attention/);
});

test("slow check: still-working at 90s, portal hand-off at 5 min, then the result", async () => {
  const { bot, transport, engine } = makeBot();
  engine.nextOutcome = { polls: 70 }; // 70 polls x 5s = 350s
  await bot.handle(pdf(transport, "HEALTH slow"));
  await settle(bot);
  const all = transport.texts();
  const i3 = all.findIndex((x) => /Still reading/.test(x));
  const i4 = all.findIndex((x) => /taking longer than usual/.test(x));
  const i10 = all.findIndex((x) => /\/100/.test(x));
  assert.ok(i3 > 0 && i4 > i3 && i10 > i4, all.join(" | "));
});

test("questions: rules answer from stored fields with no model call", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(pdf(transport, "HEALTH"));
  await settle(bot);
  await bot.handle(text("skip"));
  await bot.handle(text("what's the room rent limit?"));
  assert.match(transport.last(), /Room rent limit: 1% of sum insured per day\./);
  assert.match(transport.last(), /Full report: https:\/\/indsure\.in\/agent\/policies\//);
  await bot.handle(text("any co-pay?"));
  assert.match(transport.last(), /No co-pay found/);
  assert.equal(engine.llmPhraseCalls, 0);
});

test("a question no rule covers: model phrasing, else the not-in-report reply", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(pdf(transport, "HEALTH"));
  await settle(bot);
  await bot.handle(text("skip"));
  await bot.handle(text("does it cover dental implants abroad?"));
  assert.equal(engine.llmPhraseCalls, 1);
  assert.match(transport.last(), /The report doesn't cover that/);
  engine.phraseAnswer = { answer: "Yes, restoration is unlimited." };
  await bot.handle(text("is restoration any good for a second admission?"));
  assert.match(transport.last(), /restoration is unlimited\.\n\nFull report:/);
});

test("SHARE: language pick, tracked share link on indsure.in, wa.me to the customer, nothing sent to the customer", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(pdf(transport, "HEALTH", { caption: "Ramesh Kumar" }));
  await settle(bot);
  await bot.handle(text("share"));
  assert.match(transport.last(), /Which language/);
  await bot.handle(text("2"));
  const reply = transport.last();
  assert.match(reply, /https:\/\/wa\.me\/919812345678\?text=/);
  assert.match(reply, /Namaste Ramesh ji, aapki Care Supreme policy ki report yahan hai: https:\/\/indsure\.in\/shared\/report\/tok-/);
  assert.doesNotMatch(reply, /localhost/);
  assert.equal(engine.shared.length, 1);
  // Every message went to the advisor's own chat.
  assert.ok(transport.sent.every((s) => s.to === `${ADVISOR}@s.whatsapp.net`));
});

test("share with the language in the message skips the question", async () => {
  const { bot, transport, engine } = makeBot();
  const id = "33333333-3333-4333-8333-333333333333";
  engine.clients.set(id, healthClient(id, { policyholderName: "Meena Iyer", customerPhone: null }));
  await bot.handle(text("share Meena's report in hindi"));
  assert.match(transport.last(), /नमस्ते Meena जी/);
  assert.match(transport.last(), /https:\/\/wa\.me\/\?text=/);
  assert.match(transport.last(), /pick the chat/);
});

test("RENEWALS: both lists, soonest first, capped at 10 with a portal link; REMIND drafts the portal template", async () => {
  const { bot, transport, engine } = makeBot();
  const row = (i: number, d: number) => ({ id: `r${i}`, name: `Lead ${i}`, phone: "9800011111", insurance_type: "health", insurer: "Niva Bupa", policy_name: null, premium: 12000, due_date: "2026-10-01", days_left: d });
  engine.renewalData = {
    leads: [row(1, -2), ...Array.from({ length: 8 }, (_, i) => row(i + 2, i))],
    customers: [{ ...row(20, 12), name: "Kavita Rao" }, { ...row(21, 20), name: "Suresh Nair" }],
  };
  await bot.handle(text("renewals this week"));
  const r = transport.last();
  assert.match(r, /\*Leads: overdue\*\nLead 1 · health, Niva Bupa · 2026-10-01 \(overdue 2d\) · ₹12,000/);
  assert.match(r, /and 1 more: https:\/\/indsure\.in\/agent\/renewals/);
  await bot.handle(text("remind kavita"));
  assert.match(transport.last(), /Here's a message for Kavita Rao/);
  assert.match(transport.last(), /https:\/\/wa\.me\/919800011111\?text=/);
});

test("cancel from a pending question returns to idle", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(pdf(transport, "UNKNOWN"));
  await bot.handle(text("cancel"));
  assert.match(transport.last(), /cancelled/);
  assert.equal(engine.conv.state, "IDLE");
});

test("a pending question lapses after 15 minutes", async () => {
  const { bot, transport, engine } = makeBot();
  engine.conv = { state: "AWAITING_TYPE", currentClientId: null, pending: { to: `${ADVISOR}@s.whatsapp.net` }, updatedAt: new Date(0).toISOString() };
  await bot.handle(text("5"));
  // "5" is no longer a type pick; with no report and no rule it falls to the help menu.
  assert.match(transport.last(), /I can:/);
});

test("unrecognised text with no report: help menu", async () => {
  const { bot, transport } = makeBot();
  await bot.handle(text("what's up with the market"));
  assert.match(transport.last(), /I can:/);
});

test("house copy rules: no em dash, never 'AI' or 'credits' in anything sent", async () => {
  const { bot, transport, engine } = makeBot();
  engine.renewalData.leads = [{ id: "x", name: "Lead", phone: null, insurance_type: "health", insurer: null, policy_name: null, premium: null, due_date: "2026-10-01", days_left: 1 }];
  for (const m of [text("hi"), text("renewals"), text("remind lead")]) await bot.handle(m);
  await bot.handle(pdf(transport, "HEALTH", { caption: "Ramesh" }));
  await settle(bot);
  await bot.handle(text("skip"));
  await bot.handle(text("share in english"));
  await bot.handle(pdf(transport, "LOCKED"));
  await bot.handle(text("UNKNOWN thing?"));
  for (const s of transport.texts()) {
    assert.doesNotMatch(s, /—/, s);
    assert.doesNotMatch(s, /\bAI\b/, s);
    assert.doesNotMatch(s, /\bcredits?\b/i, s);
  }
});
