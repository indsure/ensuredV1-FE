import { test } from "node:test";
import assert from "node:assert/strict";
import { makeBot, text, healthClient } from "./fakes.js";
import { oneLetterMissing, rephrase, suggest, withPerson } from "../src/core/converse.js";
import { parseLeadUpdate } from "../src/core/crm.js";
import { localise } from "../src/core/i18n.js";

const NOW = Date.UTC(2026, 8, 29, 6); // Tue 29 Sep 2026, IST morning
const lead = (over: any = {}) => ({ id: "l-" + Math.random().toString(36).slice(2), name: "Ramesh Kumar", phone: "9812345678", status: "new", insurance_interest: "Health", next_follow_up: null, notes: null, ...over });

/* ── rephrase: everyday words become the command ── */

test("rephrase: everyday phrasings become commands the rules know", () => {
  const cases: [string, string][] = [
    ["what do we have on Kavita?", "find Kavita"],
    ["Kavita ka number kya hai", "find Kavita"],
    ["send Santosh his report", "share Santosh"],
    ["send it to him", "share"],
    ["send a premium due reminder to Ramesh", "premium due message for Ramesh"],
    ["thank you note for Pooja", "thank you message for Pooja"],
    ["Ramesh ko renewal yaad dilao", "renewal message for Ramesh"],
    ["which is better, HDFC Optima Secure or Star Comprehensive?", "compare HDFC Optima Secure vs Star Comprehensive"],
    ["Care Supreme aur Niva ReAssure compare karo", "compare Care Supreme vs Niva ReAssure"],
    ["how much cover does a 35 year old in Pune need", "calculator"],
    ["did Santosh open the report?", "views"],
    ["how much will Anil get if he surrenders his policy", "surrender value for Anil"],
    ["Ramesh ka surrender value kitna hai", "surrender value for Ramesh"],
    ["add Pooja as a lead, she wants health cover for her parents", "lead Pooja health"],
    ["Rohit Mehra 9876123450 wants term insurance, add him", "lead Rohit Mehra 9876123450 term"],
    ["spoke to Rohit today", "Rohit contacted"],
    ["set Neha's follow-up for friday", "follow up Neha friday"],
    ["call Rohit Monday morning", "call Rohit Monday"],
    ["galti se ho gaya, wapas karo", "undo"],
    ["any queries on Meena's claim", "claims Meena"],
    ["chhodo, meri follow ups batao", "meri follow ups batao"],
  ];
  for (const [said, meant] of cases) assert.equal(rephrase(said), meant, said);
});

test("rephrase never turns a command the rules already know into something else", () => {
  for (const t of ["show me renewals", "renewals", "find Ramesh", "compare Care Supreme vs ReAssure 2.0", "my clients", "share"]) {
    assert.equal(rephrase(t), t, t);
  }
  assert.equal(rephrase("actually show me renewals"), "show me renewals");
});

/* ── he, she, uska ── */

test("withPerson: pronouns become the person we were talking about", () => {
  const P = "Ramesh Kumar";
  assert.equal(withPerson("mark him won", P), "mark Ramesh Kumar won");
  assert.equal(withPerson("what's his room rent limit?", P), "what's Ramesh Kumar's room rent limit?");
  assert.equal(withPerson("call her tomorrow", P), "call Ramesh Kumar tomorrow");
  assert.equal(withPerson("what's her co-pay", P), "what's Ramesh Kumar's co-pay");
  assert.equal(withPerson("she's not interested anymore", P), "Ramesh Kumar is not interested anymore");
  assert.equal(withPerson("uska follow up kal rakh do", P), "Ramesh Kumar ka follow up kal rakh do");
  assert.equal(withPerson("unka lead lost kar do", P), "Ramesh Kumar ka lead lost kar do");
  assert.equal(withPerson("add a note: prefers calls in Hindi", P), "note Ramesh Kumar: prefers calls in Hindi");
  assert.equal(withPerson("renewals", P), null, "no pronoun, nothing to do");
  assert.equal(withPerson("mark him won", null), null, "nobody in mind, nothing guessed");
});

test("status sentences people actually type", () => {
  const cases: [string, string, string][] = [
    ["Neha said no", "Neha", "lost"],
    ["Pooja bought the policy!", "Pooja", "won"],
    ["Ramesh won't buy, mark him lost", "Ramesh", "lost"],
    ["Ramesh ka lead won kar do", "Ramesh", "won"],
    ["Sunita ko interested mark karo", "Sunita", "interested"],
    ["Mr Sharma lost", "Sharma", "lost"],
    ["Sunita Rao is not interested anymore", "Sunita Rao", "lost"],
  ];
  for (const [t, name, status] of cases) assert.deepEqual(parseLeadUpdate(t, NOW), { name, status }, t);
  // Not status changes: nothing parsed, nothing written.
  for (const t of ["Ramesh won't pick up my calls", "did Ramesh win anything?", "I won the bet with Ramesh"]) {
    assert.equal(parseLeadUpdate(t, NOW), null, t);
  }
});

/* ── End to end ── */

test("'mark him won' right after looking Ramesh up: the update to Ramesh, after YES", async () => {
  const { bot, transport, engine } = makeBot();
  const r = lead();
  engine.leadRows = [r];
  await bot.handle(text("find Ramesh"));
  await bot.handle(text("mark him won"));
  assert.match(transport.last(), /Ramesh Kumar\* \(98123 45678\): mark won/);
  assert.equal(engine.leadUpdates.length, 0, "nothing changes before YES");
  await bot.handle(text("yes"));
  assert.equal(engine.leadUpdates[0].id, r.id);
});

test("'call him tomorrow' with nobody in mind: asks who, never looks for a lead called 'Him'", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [lead()];
  await bot.handle(text("call him tomorrow"));
  assert.match(transport.last(), /Who is this for\?/);
  assert.doesNotMatch(transport.last(), /lead called "Him"/);
  assert.equal(engine.leadUpdates.length, 0);
});

test("a typo in a name is found, and still waits for YES", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [lead()];
  await bot.handle(text("Rmesh won"));
  assert.match(transport.last(), /Ramesh Kumar\* \(98123 45678\): mark won/);
  assert.equal(engine.leadUpdates.length, 0);
});

test("after a lookup, 'does it cover maternity?' is about that policy", async () => {
  const { bot, transport, engine } = makeBot();
  const id = "77777777-7777-4777-8777-777777777777";
  engine.clients.set(id, healthClient(id, { policyholderName: "Santosh Vartak" }));
  await bot.handle(text("find Santosh"));
  await bot.handle(text("is there a co-pay?"));
  assert.match(transport.last(), /co-pay/i);
  assert.doesNotMatch(transport.last(), /didn't get that/);
});

test("not understood: a numbered 'did you mean' list, and a number runs the choice", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [lead()];
  await bot.handle(text("pls show the renwals"));
  assert.match(transport.last(), /did you mean:/);
  assert.match(transport.last(), /1\) Renewals due/);
  assert.match(transport.lastRaw(), /\n1\. Renewals due/, "WhatsApp sees a numbered list");
  await bot.handle(text("1"));
  assert.match(transport.last(), /Nothing due|renewals/i);
});

test("a name from the book is offered first: 'Everything on Ramesh Kumar'", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [lead()];
  await bot.handle(text("Ramesh won't pick up my calls"));
  assert.match(transport.last(), /1\) Everything on Ramesh Kumar/);
  assert.equal(engine.leadUpdates.length, 0, "never read as 'won'");
  await bot.handle(text("1"));
  assert.match(transport.last(), /for "Ramesh Kumar"/);
});

test("after a 'did you mean' list, a new message is just a new message", async () => {
  const { bot, transport } = makeBot();
  await bot.handle(text("pls show the renwals"));
  await bot.handle(text("my clients"));
  assert.match(transport.last(), /Your policies|no checked/i);
});

test("off-topic: no list of guesses, nothing changes", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [lead()];
  for (const t of ["tell me a joke", "India won!", "what's the weather in Mumbai"]) {
    await bot.handle(text(t));
    assert.match(transport.last(), /I didn't get that/, t);
  }
  assert.equal(engine.leadUpdates.length, 0);
});

test("delete requests: said plainly that WhatsApp never deletes, with where to do it", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [lead()];
  for (const t of ["delete Ramesh", "Ramesh ko hata do", "remove all my leads"]) {
    await bot.handle(text(t));
    assert.match(transport.last(), /I don't delete anything from WhatsApp/, t);
    assert.match(transport.last(), /\/agent\/leads/);
  }
});

test("hi: a hello by name, with today's follow-ups when there are any", async () => {
  const { bot, transport, engine } = makeBot();
  engine.followupRows = [lead({ days: 0 }), lead({ name: "Sunita Rao", days: -2 })];
  await bot.handle(text("hi"));
  assert.match(transport.lastRaw(), /^👋 Hi Deep!/);
  assert.match(transport.last(), /You have 2 follow-ups due\. Reply \*?FOLLOW UPS\*? to see them\./);
  assert.match(transport.last(), /Reply with a number, or just tell me what you need/);
  engine.followupRows = [];
  await bot.handle(text("good morning sir"));
  assert.match(transport.lastRaw(), /^👋 Good morning Deep!/, "answered in kind");
  assert.doesNotMatch(transport.last(), /follow-ups? due/);
});

test("namaste in Hindi gets a Hindi hello", async () => {
  const { bot, transport } = makeBot();
  await bot.handle(text("नमस्ते"));
  assert.match(transport.lastRaw(), /^👋 नमस्ते Deep जी!/);
});

test("show my leads lists leads", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [lead()];
  await bot.handle(text("show my leads"));
  assert.match(transport.last(), /Ramesh Kumar/);
});

test("while the calculator waits for a city, 'chhodo, meri follow ups batao' switches over", async () => {
  const { bot, transport } = makeBot();
  await bot.handle(text("calculator"));
  await bot.handle(text("chhodo, meri follow ups batao"));
  assert.match(transport.last(), /follow-up/i);
  assert.doesNotMatch(transport.last(), /shehar|city/i);
});

test("a city typed for the calculator is never rephrased", async () => {
  const { bot, transport } = makeBot();
  await bot.handle(text("calculator"));
  const before = transport.sent.length;
  await bot.handle(text("Pune"));
  assert.ok(transport.sent.length > before);
  assert.doesNotMatch(transport.last(), /did you mean|didn't get that/);
});

test("the new replies have Hindi and Hinglish", () => {
  const lines = [
    "You're welcome. Anything else, just type it.", "👋 Hi Deep!", "👋 Hi!",
    "You have 3 follow-ups due. Reply FOLLOW UPS to see them.", "You have 1 follow-up due. Reply FOLLOW UPS to see them.",
    "Just to be sure, did you mean:", "Reply with the number, or type HELP to see everything.",
    "1) Everything on Ramesh Kumar", "Who is this for? Just add the name, for example: Ramesh won",
    "To keep your records safe, I don't delete anything from WhatsApp. You can remove a lead in the portal: https://indsure.in/agent/leads",
    ...["renewals", "follow up", "leads", "calculator", "compare", "claims", "clients", "website", "checks", "share", "message", "surrender", "views"]
      .map((w) => `1) ${suggest(w)[0].label}`),
  ];
  const missing: string[] = [];
  for (const lang of ["hindi", "hinglish"] as const) {
    for (const l of lines) if (localise(l, lang) === l) missing.push(`${lang}: ${l}`);
  }
  assert.deepEqual(missing, []);
});

/* ── The critic's cases: each one must stay fixed ── */

test("critic: a typo never lands on a different person (Rohit/Mohit, Rakesh/Ramesh, India/Indra)", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [lead({ name: "Mohit Jain" }), lead({ name: "Ramesh Kumar", phone: "9812345670" }), lead({ name: "Indra Shah", phone: "9812345671" })];
  for (const t of ["Rohit won", "Rakesh won", "India won"]) {
    await bot.handle(text(t));
    assert.doesNotMatch(transport.last(), /Shall I go ahead/, t);
  }
  assert.equal(engine.leadUpdates.length, 0);
});

test("critic: chit-chat before a comma never sets a status", () => {
  for (const t of ["Haan bhai, India won", "acha, ramesh lost", "sorry, rakesh won", "nobody bought it", "doctor said no", "the hospital won", "usne policy le li"]) {
    assert.equal(parseLeadUpdate(t, NOW), null, t);
  }
  assert.deepEqual(parseLeadUpdate("Ramesh, not interested", NOW), { name: "Ramesh", status: "lost" });
});

test("critic: a pronoun next to a typed name is about that name", () => {
  const P = "Ramesh Kumar";
  assert.equal(withPerson("Sunita, she said no", P), null);
  assert.equal(withPerson("Rohit ko lead mein jodo, unhe health chahiye", P), null);
  assert.equal(withPerson("use this plan", P), null, "English 'use' is a verb");
  assert.equal(withPerson("usne policy le li", P), "Ramesh Kumar ne policy le li");
});

test("critic: Hindi add-lead keeps only the name, phone and cover", () => {
  assert.equal(rephrase("Rohit ko lead mein jodo 9876543210 health ke liye"), "lead Rohit 9876543210 health");
});

test("critic: a calculator answer is never rewritten into a new calculator", async () => {
  const { bot, transport } = makeBot();
  await bot.handle(text("calculator"));
  await bot.handle(text("Pune"));
  const asked = transport.last();
  await bot.handle(text("kitna cover hai abhi 5 lakh"));
  assert.doesNotMatch(transport.last(), /^Cover calculator\.$/m);
  assert.notEqual(transport.last(), asked.replace(/^.*\n/, ""), "the calculator did not restart");
});

test("critic: 'no wait, yes' while a change waits is a no", async () => {
  const { bot, engine } = makeBot();
  engine.leadRows = [lead()];
  await bot.handle(text("Ramesh won"));
  await bot.handle(text("no wait, yes"));
  assert.equal(engine.leadUpdates.length, 0);
});

test("critic: HINDI right after a 'did you mean' list switches the language", async () => {
  const { bot, transport } = makeBot();
  await bot.handle(text("pls show the renwals"));
  await bot.handle(text("hindi"));
  assert.doesNotMatch(transport.last(), /Did you mean/);
  await bot.handle(text("renewals"));
  assert.match(transport.last(), /[ऀ-ॿ]/);
});

test("critic: a stale 'did you mean' list does not run on a late number", async () => {
  const { bot, transport, advance } = makeBot();
  await bot.handle(text("pls show the renwals"));
  advance(60 * 60_000);
  await bot.handle(text("1"));
  assert.doesNotMatch(transport.last(), /Nothing due/);
});

test("critic: 'call her back friday' is a follow-up for the person, no 'Back' in the name", () => {
  assert.equal(withPerson("call her back friday", "Priya Nair"), "call Priya Nair back friday");
  assert.equal(parseLeadUpdate("call Priya Nair back friday", NOW)?.name, "Priya Nair");
});

test("critic round 2: no final-letter typos (Ankit/Ankita); two Rameshes get a pick list", async () => {
  const { bot, transport, engine } = makeBot();
  // The typo matcher never adds a final letter (Ankit/Ankita, Harsh/Harsha). Plain prefix
  // matching ("Ram" finds Ramesh) is older behaviour and is not changed here.
  assert.equal(oneLetterMissing("ankit", "ankita"), false);
  assert.equal(oneLetterMissing("harsha", "harsh"), false);
  assert.equal(oneLetterMissing("rmesh", "ramesh"), true);
  engine.leadRows = [lead({ name: "Ramesh Shah", phone: "9800000202" }), lead({ name: "Ramesh Kumar", phone: "9800000203" })];
  await bot.handle(text("Rmesh won"));
  assert.match(transport.last(), /Which Rmesh\?/);
  assert.equal(engine.leadUpdates.length, 0);
});

test("critic round 2: a capitalised first word still lets the pronoun work", () => {
  const P = "Ramesh Kumar";
  assert.equal(withPerson("Abhi usko call karo", P), "Abhi Ramesh Kumar ko call karo");
  assert.equal(withPerson("Next week call him", P), "Next week call Ramesh Kumar");
  assert.equal(withPerson("uska premium ka kya", P), "Ramesh Kumar ka premium ka kya");
});

test("critic round 2: 'Sunita, she said no' is about Sunita; 'Thanks, he bought it' changes nothing", () => {
  assert.deepEqual(parseLeadUpdate("Sunita, she said no", NOW), { name: "Sunita", status: "lost" });
  assert.equal(parseLeadUpdate("Thanks, he bought it", NOW), null);
});

/* ── The help menu: numbers run the choice ── */

test("menu: hi, help, services and 'what can you do' all show the numbered menu", async () => {
  const { bot, transport } = makeBot();
  for (const t of ["hi", "help", "services", "what services do you offer?", "what can you do?", "menu"]) {
    await bot.handle(text(t));
    assert.match(transport.last(), /tell me what you need:\n1\) Check a customer's policy/, t);
    assert.match(transport.lastRaw(), /\n9\. Compare two plans/, t);
  }
  await bot.handle(text("kya kya hai"));
  assert.match(transport.last(), /kya chahiye:\n1\) Customer ki policy check karein/, "asked in Hinglish, menu in Hinglish");
});

test("menu: a number runs that choice, exactly as if typed", async () => {
  const { bot, transport } = makeBot();
  await bot.handle(text("help"));
  await bot.handle(text("4"));
  assert.match(transport.last(), /Adding a lead\. What's their name\?/);
  await bot.handle(text("cancel"));
  await bot.handle(text("help"));
  await bot.handle(text("1"));
  assert.match(transport.last(), /Send me the customer's policy PDF right here/);
  await bot.handle(text("hi"));
  await bot.handle(text("5"));
  assert.match(transport.last(), /find Ramesh, or find 98123 45678/);
  await bot.handle(text("help"));
  await bot.handle(text("3"));
  assert.match(transport.last(), /Nothing due|renewal/i);
});

test("menu: HELP during a pending question ends that question, so the menu numbers work", async () => {
  const { bot, transport } = makeBot();
  await bot.handle(text("calculator"));
  await bot.handle(text("help"));
  await bot.handle(text("4"));
  assert.match(transport.last(), /Adding a lead/);
});

test("menu: in Hindi the choices are in Hindi, and a number still works", async () => {
  const { bot, transport } = makeBot();
  await bot.handle(text("HINDI"));
  await bot.handle(text("मदद"));
  assert.match(transport.last(), /क्या चाहिए:\n1\) कस्टमर की पॉलिसी चेक करें/);
  await bot.handle(text("2"));
  assert.match(transport.last(), /फॉलो-अप|follow/i);
});
