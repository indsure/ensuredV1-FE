import { test } from "node:test";
import assert from "node:assert/strict";
import { makeBot, text, healthClient } from "./fakes.js";
import { calculateHealthCover } from "../src/shared/health-engine-logic.js";
import { matchPlans, parseCompareNames, parseLeadLine } from "../src/core/tools.js";
import { ruleIntent } from "../src/core/intents.js";

/* ── Website ── */

test("LINK alone sends the advisor's website, tagged as a WhatsApp share", async () => {
  const { bot, transport } = makeBot();
  await bot.handle(text("link"));
  assert.match(transport.last(), /Your website: https:\/\/indsure\.in\/a\/deep-shah\?utm_source=whatsapp&utm_medium=share/);
  await bot.handle(text("my website"));
  assert.match(transport.last(), /\/a\/deep-shah/);
});

test("LINK 123456 is still connecting, never the website", () => {
  assert.equal(ruleIntent("LINK 123456"), "link");
  assert.equal(ruleIntent("link"), "website");
});

test("website not live or not set up: says so and points to the portal", async () => {
  const { bot, transport, engine } = makeBot();
  engine.profileData.page = { slug: "deep-shah", live: false, enabled: true, published: false };
  await bot.handle(text("link"));
  assert.match(transport.last(), /not live yet.*\/agent\/my-page/s);
  engine.profileData.page = null;
  await bot.handle(text("website"));
  assert.match(transport.last(), /haven't set up your website/);
});

/* ── Leads ── */

test("one line: lead name + phone + interest is saved straight away", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("lead Ramesh Kumar 9812345678 health"));
  assert.deepEqual(engine.leads.map((l) => [l.name, l.phone, l.interest]), [["Ramesh Kumar", "9812345678", "Health"]]);
  assert.match(transport.last(), /Saved lead: Ramesh Kumar, 98123 45678, Health\.\nIt's in your Leads: https:\/\/indsure\.in\/agent\/leads\//);
});

test("'enter a lead' asks name, phone, interest in turn", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("enter a lead"));
  assert.match(transport.last(), /What's their name\?/);
  await bot.handle(text("Sunita Rao"));
  assert.match(transport.last(), /phone number\? Or SKIP/);
  await bot.handle(text("98111 22233"));
  assert.match(transport.last(), /interested in\?/);
  await bot.handle(text("2"));
  assert.deepEqual(engine.leads.map((l) => [l.name, l.phone, l.interest]), [["Sunita Rao", "9811122233", "Motor"]]);
});

test("lead: SKIP phone and interest still saves; a bad number is asked again", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("add lead Anil"));
  assert.match(transport.last(), /phone number/);
  await bot.handle(text("12345"));
  assert.match(transport.last(), /doesn't look like a 10-digit/);
  await bot.handle(text("skip"));
  await bot.handle(text("skip"));
  assert.deepEqual(engine.leads.map((l) => [l.name, l.phone, l.interest]), [["Anil", null, null]]);
});

test("lead with a number already in the book is not duplicated", async () => {
  const { bot, transport } = makeBot();
  await bot.handle(text("lead Ramesh 9812345678 health"));
  await bot.handle(text("lead R Kumar 9812345678 motor"));
  assert.match(transport.last(), /already in your leads/);
});

test("lead line parsing", () => {
  assert.deepEqual(parseLeadLine("enter a lead Priya Nair 98765 43210 car"), { name: "Priya Nair", phone: "9876543210", interest: "Motor" });
  assert.deepEqual(parseLeadLine("new lead"), { name: null, phone: null, interest: null });
});

/* ── Calculator ── */

test("calculator: 5 answers, runs the portal engine, saves, links the report", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("calculator"));
  assert.match(transport.last(), /How old is the eldest adult/);
  await bot.handle(text("42"));
  assert.match(transport.last(), /Where do they live\?\n1\) Metro city/);
  await bot.handle(text("1"));
  await bot.handle(text("3"));
  await bot.handle(text("1"));
  await bot.handle(text("2"));
  const saved = engine.calcSaved[0];
  assert.deepEqual(saved.inputs, {
    exactAge: 42, ageBand: "31-45", cityTier: "Metro", familyStructure: "Couple + kids", employerCover: "None", riskPosture: "Balanced",
  });
  // The bot's numbers ARE the engine's numbers for the same inputs.
  const expected = calculateHealthCover(saved.inputs, { partnerCompanies: [] });
  assert.equal(saved.result.totalProtection, expected.totalProtection);
  const r = transport.last();
  assert.ok(r.includes(`Base cover: ${expected.baseCover}`), r);
  assert.ok(r.includes(`Super top-up: ${expected.superTopUp}`), r);
  assert.ok(r.includes(`Total protection: ${expected.totalProtection}`), r);
  assert.match(r, /https:\/\/indsure\.in\/calculator\/report\/calc-uuid-1/);
});

test("calculator: a non-number answer re-asks instead of guessing", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("calculate cover"));
  await bot.handle(text("forty"));
  assert.match(transport.last(), /age as a number/);
  await bot.handle(text("35"));
  await bot.handle(text("metro please"));
  assert.match(transport.last(), /Where do they live\?/);
  assert.equal(engine.calcSaved.length, 0);
});

/* ── Compare ── */

test("compare two plans by name: engine verdict and the report link", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("compare Care Supreme vs Niva ReAssure 2.0"));
  assert.deepEqual(engine.compared[0], ["UIN-CARE-SUP", "UIN-NIVA-RA2"]);
  const r = transport.last();
  assert.match(r, /Stronger on the wording: Care Health Insurance Care Supreme\./);
  assert.match(r, /Why: No room rent cap; Shorter PED wait\./);
  assert.match(r, /But: ReAssure 2\.0 has a bigger bonus\./);
  assert.match(r, /https:\/\/indsure\.in\/compare\/report\/cmp-uuid-1/);
});

test("compare: a name with several variants asks which one", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("compare Optima Secure vs Care Supreme"));
  assert.match(transport.last(), /Which "Optima Secure"\?\n1\) HDFC ERGO Optima Secure \(Silver\)\n2\) HDFC ERGO Optima Secure \(Gold\)/);
  await bot.handle(text("2"));
  assert.deepEqual(engine.compared[0].sort(), ["UIN-CARE-SUP", "UIN-HDFC-OPT:Gold"].sort());
});

test("compare: unknown plan or a single name gets a plain reply, no report", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("compare Star Comprehensive vs Care Supreme"));
  assert.match(transport.last(), /couldn't find "Star Comprehensive"/);
  await bot.handle(text("compare"));
  assert.match(transport.last(), /Which plans\?/);
  assert.equal(engine.compared.length, 0);
});

test("compare name parsing and matching", () => {
  assert.deepEqual(parseCompareNames("compare Care Supreme vs Niva ReAssure 2.0"), ["Care Supreme", "Niva ReAssure 2.0"]);
  assert.deepEqual(parseCompareNames("compare A, B and C"), ["A", "B", "C"]);
  const cat = [{ plan_key: "k1", insurer: "Care Health Insurance", plan_name: "Care Supreme", variant: "" }];
  assert.equal(matchPlans("care supreme", cat).length, 1);
  assert.equal(matchPlans("supreme", cat).length, 1);
  assert.equal(matchPlans("optima", cat).length, 0);
});

test("the help menu lists the new tools", async () => {
  const { bot, transport } = makeBot();
  await bot.handle(text("help"));
  assert.match(transport.last(), /CALCULATOR.*COMPARE.*LEAD.*LINK/s);
});

/* ── Context: the last report must not swallow everything ── */

test("with a report open, unrelated text is NOT answered as a report question", async () => {
  const { bot, transport, engine } = makeBot();
  const id = "55555555-5555-4555-8555-555555555555";
  engine.clients.set(id, healthClient(id));
  engine.conv = { state: "REPORT_READY", currentClientId: id, pending: {}, updatedAt: new Date(1_000_000 - 2 * 3600_000).toISOString() };
  await bot.handle(text("what's the weather like"));
  assert.match(transport.last(), /I didn't catch that/);
  assert.doesNotMatch(transport.last(), /report doesn't cover/);
  assert.equal(engine.llmPhraseCalls, 0);
});

test("a policy-topic question still goes to the open report, even hours later", async () => {
  const { bot, transport, engine } = makeBot();
  const id = "66666666-6666-4666-8666-666666666666";
  engine.clients.set(id, healthClient(id));
  engine.conv = { state: "REPORT_READY", currentClientId: id, pending: {}, updatedAt: new Date(1_000_000 - 5 * 3600_000).toISOString() };
  await bot.handle(text("room rent?"));
  assert.match(transport.last(), /Room rent limit/);
});

test("'Calculate' and 'List of all health clients name' route to their tools, not the report", async () => {
  const { bot, transport, engine } = makeBot();
  const id = "77777777-7777-4777-8777-777777777777";
  engine.clients.set(id, healthClient(id, { policyholderName: "Santosh Vartak", insurer: "ManipalCigna", policyName: "ProHealth", score: 75 }));
  engine.conv = { state: "REPORT_READY", currentClientId: id, pending: {}, updatedAt: new Date(1_000_000).toISOString() };
  await bot.handle(text("Calculate"));
  assert.match(transport.last(), /How old is the eldest adult/);
  await bot.handle(text("cancel"));
  await bot.handle(text("List of all health clients name"));
  assert.deepEqual(engine.policyType, ["health"]);
  assert.match(transport.last(), /Your health policies \(1\), newest first:\n1\) Santosh Vartak · ManipalCigna ProHealth · 75\/100/);
});

test("my clients: all types, and an empty book says so", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("my clients"));
  assert.deepEqual(engine.policyType, [null]);
  assert.match(transport.last(), /no checked policies yet/);
});
