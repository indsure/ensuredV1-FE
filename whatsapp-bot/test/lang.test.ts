import { test } from "node:test";
import assert from "node:assert/strict";
import { makeBot, text, AGENT, ADVISOR } from "./fakes.js";
import { detectLang, langCommand, localise, devanagariToLatin } from "../src/core/i18n.js";
import { T } from "../src/core/templates.js";
import { question } from "../src/core/calcflow.js";
import { parseLeadUpdate, parseDraft } from "../src/core/crm.js";
import { ruleIntent } from "../src/core/intents.js";

const lead = (over: any = {}) => ({ id: "l-" + Math.random().toString(36).slice(2), name: "Ramesh Kumar", phone: "9812345678", status: "new", insurance_interest: "Health", next_follow_up: null, notes: null, ...over });
/** Wed 30 Sep 2026, 11:00 IST. */
const NOW = Date.parse("2026-09-30T05:30:00Z");

/* ── Which language ── */

test("detects Hindi, Hinglish and English; commands and names keep the current language", () => {
  assert.equal(detectLang("रमेश ने पॉलिसी ले ली"), "hindi");
  assert.equal(detectLang("Ramesh ne policy le li"), "hinglish");
  assert.equal(detectLang("aaj kisko call karna hai"), "hinglish");
  assert.equal(detectLang("who should I call today"), "english");
  for (const neutral of ["renewals", "yes", "lead Ramesh 9812345678 health", "Care Supreme", "2"]) assert.equal(detectLang(neutral), null, neutral);
  assert.equal(langCommand("HINDI"), "hindi");
  assert.equal(langCommand("hindi mein baat karo"), "hindi");
  assert.equal(langCommand("हिंदी में"), "hindi");
  assert.equal(langCommand("Hinglish"), "hinglish");
  assert.equal(langCommand("english please"), "english");
  assert.equal(langCommand("diwali message for Ramesh in hindi"), null, "a message's language is not the reply language");
});

test("Devanagari names are found as the book spells them", () => {
  assert.equal(devanagariToLatin("रमेश कुमार"), "Ramesh Kumar");
  assert.equal(devanagariToLatin("नेहा"), "Neha");
  assert.equal(devanagariToLatin("अनिल शर्मा"), "Anil Sharma");
  assert.equal(devanagariToLatin("गुप्ता"), "Gupta");
});

/* ── Understanding Hindi and Hinglish without the model ── */

test("rules: Hinglish and Hindi lead updates", () => {
  assert.deepEqual(parseLeadUpdate("Ramesh ne policy le li", NOW), { name: "Ramesh", status: "won" });
  assert.deepEqual(parseLeadUpdate("Neha ne mana kar diya", NOW), { name: "Neha", status: "lost" });
  assert.deepEqual(parseLeadUpdate("Vikram interested nahi hai", NOW), { name: "Vikram", status: "lost" });
  assert.deepEqual(parseLeadUpdate("Pooja interested hai", NOW), { name: "Pooja", status: "interested" });
  assert.deepEqual(parseLeadUpdate("Rohit se baat ho gayi", NOW), { name: "Rohit", status: "contacted" });
  assert.deepEqual(parseLeadUpdate("रमेश ने पॉलिसी ले ली", NOW), { name: "Ramesh", status: "won" });
  assert.deepEqual(parseLeadUpdate("रमेश से बात हो गई", NOW), { name: "Ramesh", status: "contacted" });
  assert.deepEqual(parseLeadUpdate("Ramesh ko kal call karna hai", NOW), { name: "Ramesh", nextFollowUp: "2026-10-01" });
  assert.deepEqual(parseLeadUpdate("kal Ramesh ko follow up", NOW), { name: "Ramesh", nextFollowUp: "2026-10-01" });
  assert.deepEqual(parseLeadUpdate("Ramesh ko parso call karo", NOW), { name: "Ramesh", nextFollowUp: "2026-10-02" });
  assert.deepEqual(parseLeadUpdate("रमेश को शुक्रवार फॉलो अप", NOW), { name: "Ramesh", nextFollowUp: "2026-10-02" });
  assert.deepEqual(parseLeadUpdate("follow up Ramesh somvar", NOW), { name: "Ramesh", nextFollowUp: "2026-10-05" });
});

test("rules: everyday Hindi and Hinglish commands", () => {
  assert.equal(ruleIntent("aaj kisko call karna hai"), "followups");
  assert.equal(ruleIntent("आज किसे कॉल करना है"), "followups");
  assert.equal(ruleIntent("रिन्यूअल किसके हैं"), "renewals");
  assert.equal(ruleIntent("renewal kiske hai"), "renewals");
  assert.equal(ruleIntent("mere clients dikhao"), "clients");
  assert.equal(ruleIntent("आज का काम"), "today");
  assert.equal(ruleIntent("mera balance kitna hai"), "balance");
  assert.equal(ruleIntent("madad"), "help");
  assert.equal(ruleIntent("kisne report dekhi"), "views");
  assert.equal(ruleIntent("naya lead Suresh 9811122233 health"), "lead");
  assert.equal(ruleIntent("chhodo"), "cancel");
});

test("birthday and anniversary wishes are their own messages, not a festival greeting", () => {
  assert.deepEqual(parseDraft("Wish Aniket Happy Birthday"), { kind: "birthday", name: "Aniket" });
  assert.deepEqual(parseDraft("birthday message for Aniket Bang"), { kind: "birthday", name: "Aniket Bang" });
  assert.deepEqual(parseDraft("anniversary wishes for Ramesh"), { kind: "anniversary", name: "Ramesh" });
  assert.deepEqual(parseDraft("Diwali message for Ramesh"), { kind: "festival", name: "Ramesh" });
  assert.equal(ruleIntent("Wish Aniket Happy Birthday"), "draft");
});

test("THE SCREENSHOT: 'Wish Aniket Happy Birthday' sends birthday wishes, not a festival greeting", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [lead({ name: "Aniket Bang", phone: "9284142611" })];
  await bot.handle(text("Wish Aniket Happy Birthday"));
  assert.match(transport.last(), /Here's a message for Aniket Bang/);
  assert.match(transport.last(), /Wishing you a very happy birthday!/);
  assert.doesNotMatch(transport.last(), /festival/);
});

/* ── Replying in the advisor's language ── */

test("a Hindi message gets Hindi replies, YES can be हाँ, and the change is saved", async () => {
  const { bot, transport, engine } = makeBot();
  const r = lead();
  engine.leadRows = [r];
  await bot.handle(text("रमेश ने पॉलिसी ले ली"));
  assert.match(transport.last(), /^पक्का कीजिए:\n• \*Ramesh Kumar\* \(98123 45678\): स्टेटस won\n\nसेव करने के लिए YES या हाँ लिखिए, नहीं तो NO।$/);
  await bot.handle(text("हाँ"));
  assert.equal(engine.leadUpdates[0].id, r.id);
  assert.equal(engine.leadUpdates[0].status, "won");
  assert.match(transport.last(), /15 मिनट के अंदर UNDO/);
});

test("Hinglish: 'aaj kisko call karna hai' lists follow-ups in Hinglish", async () => {
  const { bot, transport, engine } = makeBot();
  engine.followupRows = [lead({ days: 0 })];
  await bot.handle(text("aaj kisko call karna hai"));
  assert.match(transport.last(), /^📋 1 follow-up baaki:/);
  assert.match(transport.last(), /Kisi se baat ho gayi\? Aise likhiye: Ramesh se baat ho gayi/);
});

test("HINDI / ENGLISH switch the language, and it is remembered", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("HINDI"));
  assert.match(transport.last(), /अब जवाब हिंदी में आएँगे/);
  assert.equal(engine.conv.pending.replyLang, "hindi", "saved with the conversation");
  await bot.handle(text("help"));
  assert.match(transport.last(), /आप मुझसे ये सब करवा सकते हैं/);
  await bot.handle(text("renewals"));
  assert.match(transport.last(), /कुछ बाकी नहीं/, "a bare command keeps Hindi");
  await bot.handle(text("ENGLISH"));
  await bot.handle(text("help"));
  assert.match(transport.last(), /Here's what I do most/);
});

test("the customer's message is never translated; only the bot's own wording is", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [lead({ name: "Aniket Bang", phone: "9284142611" })];
  await bot.handle(text("HINDI"));
  await bot.handle(text("Wish Aniket Happy Birthday"));
  assert.match(transport.last(), /Aniket Bang के लिए मैसेज तैयार है/);
  assert.match(transport.last(), /Wishing you a very happy birthday!/, "the English message they asked for stays English");
});

test("the morning brief goes out in the advisor's saved language", async () => {
  const t = makeBot();
  t.advance(Date.parse("2026-09-30T04:00:00Z") - t.bot["now"]());
  t.engine.conv = { state: "IDLE", currentClientId: null, pending: { replyLang: "hindi" }, updatedAt: null };
  t.engine.followupRows = [lead({ days: 0 })];
  t.engine.morningList = [{ agentId: AGENT, waNumber: ADVISOR, name: "Deep Shah" }];
  await t.bot.morningTick();
  assert.match(t.transport.last(), /^☀️ सुप्रभात Deep। आज का काम:/);
  assert.match(t.transport.last(), /\*आज के फॉलो-अप:\* 1 \(Ramesh Kumar\)/);
});

/* ── Coverage: every fixed line an advisor commonly sees is translated ── */

test("coverage: menus, PDF replies and every calculator question have Hindi and Hinglish", () => {
  // Lines that are commands or examples to type, the same in every language.
  const same = new Set(["• LEAD Ramesh 98123 45678 health", "• RENEWALS · FOLLOW UPS · MY CLIENTS · CLAIMS · VIEWS · CHECKS",
    "• CALCULATOR · COMPARE Care Supreme vs Niva ReAssure 2.0", "• UPGRADE MESSAGE for Santosh · DIWALI MESSAGE for Ramesh in hindi", "",
    "1) English", "2) Hinglish", "3) Hindi"]);
  const texts = [
    T.help(), T.more(), T.welcome(), T.received(), T.stillWorking(), T.notPdf(), T.tooLarge(), T.cancelled(), T.whoseIsIt(),
    T.leftUnassigned(), T.noReport(), T.dupNo(), T.genericError(), T.stillChecking(), T.resendFile(), T.hindiPolicy(), T.locked(),
    T.pickLang(), T.didNotCatch(), T.filedUnder("Ramesh"), T.outOfChecks("https://x"), T.takingLong("https://x"),
    ...(["city", "travel", "family", "age", "income", "spouseAge", "kids", "parents", "employer", "risk", "hospital", "recurring"] as const)
      .map((s) => question(s, { inputs: {}, customer: null, prefilled: [] } as any)),
  ];
  const missing: string[] = [];
  for (const lang of ["hindi", "hinglish"] as const) {
    for (const t of texts) {
      const out = localise(t, lang).split("\n");
      t.split("\n").forEach((line, i) => { if (!same.has(line) && out[i] === line) missing.push(`${lang}: ${line}`); });
    }
  }
  assert.deepEqual(missing, []);
});

/* ── The follow-up screenshot ── */

test("'Aniket ka followup 3rd November' and 'Deep ki call kal' are follow-ups, without the model", () => {
  assert.deepEqual(parseLeadUpdate("Aniket ka followup 3rd November", NOW), { name: "Aniket", nextFollowUp: "2026-11-03" });
  assert.deepEqual(parseLeadUpdate("Deep ka followup 1st november", NOW), { name: "Deep", nextFollowUp: "2026-11-01" });
  assert.deepEqual(parseLeadUpdate("Deep ki call kal", NOW), { name: "Deep", nextFollowUp: "2026-10-01" });
  assert.deepEqual(parseLeadUpdate("Aniket ka reminder 5 nov set karo", NOW), { name: "Aniket", nextFollowUp: "2026-11-05" });
});

test("THE SCREENSHOT: 'Sabke reminders 1st November kardo' moves every listed follow-up, after one YES, and UNDO puts them all back", async () => {
  const { bot, transport, engine, advance } = makeBot();
  advance(NOW - bot["now"]());
  const a = lead({ name: "Deep Shah", phone: "7021585537", days: -40, next_follow_up: "2026-08-21" });
  const b = lead({ name: "Aniket Bang", phone: "9284142611", days: -31, next_follow_up: "2026-08-30" });
  const c = lead({ name: "Tester Sharma", phone: "7021585524", days: 0, next_follow_up: "2026-09-30" });
  engine.leadRows = [a, b, c];
  engine.followupRows = [a, b, c];
  await bot.handle(text("Followups"));
  await bot.handle(text("Sabke reminders 1st November kardo"));
  const ask = transport.last();
  assert.match(ask, /^Pakka kijiye:/);
  for (const n of ["Deep Shah", "Aniket Bang", "Tester Sharma"]) assert.match(ask, new RegExp(`\\*${n}\\* \\(\\d{5} \\d{5}\\): follow-up Sun 1 Nov`));
  assert.equal(engine.understandCalls.length, 0, "no model needed");
  await bot.handle(text("haan"));
  assert.deepEqual(engine.leadUpdates.map((u: any) => [u.id, u.nextFollowUp]), [[a.id, "2026-11-01"], [b.id, "2026-11-01"], [c.id, "2026-11-01"]]);
  await bot.handle(text("undo"));
  assert.match(transport.last(), /Undo: 3 leads pehle jaisi karein/);
  await bot.handle(text("yes"));
  assert.equal(engine.restored.length, 3);
  assert.match(transport.last(), /Undo ho gaya: 3 leads pehle jaisi hain/);
});

test("a follow-up years overdue shows its date, not '9423d'; Hinglish lists say aaj / din se pending", async () => {
  const { followupsReply } = await import("../src/core/crm.js");
  const r = followupsReply({ origin: "https://indsure.in" }, [
    lead({ name: "Old Lead", days: -9423, next_follow_up: "2001-01-15" }),
    lead({ name: "Aniket Bang", days: -31 }),
    lead({ name: "Tester Sharma", days: 0 }),
  ] as any);
  assert.match(r, /\*Old Lead\* · 98123 45678|\*Old Lead\* · 9812345678/);
  assert.match(r, /overdue since 2001-01-15/);
  assert.doesNotMatch(r, /9423d/);
  const hl = localise(r, "hinglish");
  assert.match(hl, / · 31 din se pending · /);
  assert.match(hl, /\*Tester Sharma\* · 9812345678 · aaj · Health/);
});
