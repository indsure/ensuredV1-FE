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

test("one line: lead name + phone + interest, confirmed with YES, then saved", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("lead Ramesh Kumar 9812345678 health"));
  assert.equal(engine.leads.length, 0);
  assert.match(transport.last(), /^Please confirm:\n• Add lead \*Ramesh Kumar\*: 98123 45678, Health\n\nReply YES to save, or NO\.$/);
  await bot.handle(text("yes"));
  assert.deepEqual(engine.leads.map((l) => [l.name, l.phone, l.interest]), [["Ramesh Kumar", "9812345678", "Health"]]);
  assert.match(transport.last(), /^Saved lead \*Ramesh Kumar\*, 98123 45678, Health\.\nhttps:\/\/indsure\.in\/agent\/leads\/\S+\nNext: follow up Ramesh Friday/);
});

test("'enter a lead' asks name, phone, interest in turn, then YES", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("enter a lead"));
  assert.match(transport.last(), /What's their name\?/);
  await bot.handle(text("Sunita Rao"));
  assert.match(transport.last(), /phone number\? Or SKIP/);
  await bot.handle(text("98111 22233"));
  assert.match(transport.last(), /interested in\?/);
  await bot.handle(text("2"));
  assert.match(transport.last(), /Add lead \*Sunita Rao\*: 98111 22233, Motor/);
  await bot.handle(text("yes"));
  assert.deepEqual(engine.leads.map((l) => [l.name, l.phone, l.interest]), [["Sunita Rao", "9811122233", "Motor"]]);
});

test("lead: SKIP phone and interest still saves (after YES); a bad number is asked again", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("add lead Anil"));
  assert.match(transport.last(), /phone number/);
  await bot.handle(text("12345"));
  assert.match(transport.last(), /doesn't look like a 10-digit/);
  await bot.handle(text("skip"));
  await bot.handle(text("skip"));
  await bot.handle(text("yes"));
  assert.deepEqual(engine.leads.map((l) => [l.name, l.phone, l.interest]), [["Anil", null, null]]);
});

test("lead with a number already in the book is not duplicated", async () => {
  const { bot, transport } = makeBot();
  await bot.handle(text("lead Ramesh 9812345678 health"));
  await bot.handle(text("yes"));
  await bot.handle(text("lead R Kumar 9812345678 motor"));
  await bot.handle(text("yes"));
  assert.match(transport.last(), /already in your leads/);
});

test("lead line parsing", () => {
  assert.deepEqual(parseLeadLine("enter a lead Priya Nair 98765 43210 car"), { name: "Priya Nair", phone: "9876543210", interest: "Motor", status: null });
  assert.deepEqual(parseLeadLine("new lead"), { name: null, phone: null, interest: null, status: null });
  // The original bug: a status word is never part of the name.
  assert.deepEqual(parseLeadLine("lead Ramesh won"), { name: "Ramesh", phone: null, interest: null, status: "won" });
});

/* ── Calculator ── */

/** Walk the portal's calculator: Mumbai, rarely abroad, couple with kids. */
async function portalCalc(bot: any) {
  for (const m of ["calculator", "Mumbai", "1", "3", "42", "12 lakh", "38", "2", "none", "balanced", "2", "1", "yes"]) await bot.handle(text(m));
}

test("calculator: the portal's steps, the portal's engine, saved, report link", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("calculator"));
  assert.match(transport.last(), /Which city do they live in\?/);
  await bot.handle(text("Mumbai"));
  assert.match(transport.last(), /Do they travel outside India\?/);
  await bot.handle(text("1"));
  assert.match(transport.last(), /Who needs to be covered\?/);
  await bot.handle(text("3"));
  assert.match(transport.last(), /How old are they\?/);
  await bot.handle(text("42"));
  assert.match(transport.last(), /annual income\?/);
  await bot.handle(text("12 lakh"));
  assert.match(transport.last(), /Spouse's age\?/);
  await bot.handle(text("38"));
  assert.match(transport.last(), /How many children\?/);
  await bot.handle(text("2"));
  assert.match(transport.last(), /employer\?/);
  await bot.handle(text("none"));
  await bot.handle(text("balanced"));
  assert.match(transport.last(), /Which hospitals do they prefer\?/); // metro, like the portal
  await bot.handle(text("2"));
  assert.match(transport.last(), /regular medical costs\?/); // not "minimum" risk, like the portal
  await bot.handle(text("1"));
  assert.match(transport.last(), /^Please check:/);
  assert.equal(engine.calcSaved.length, 0, "nothing is calculated before YES");
  await bot.handle(text("yes"));
  const saved = engine.calcSaved[0];
  assert.deepEqual(saved.inputs, {
    cityTier: "Metro", city: "Mumbai", globalTravel: "Rarely or never", familyStructure: "Couple + kids",
    exactAge: 42, ageBand: "31-45", annualIncome: "10-20L", spouseAge: 38, childCount: 2,
    employerCover: "None", riskPosture: "Balanced", hospitalPreference: "Large private hospitals", recurringExpenses: "None",
  });
  const expected = calculateHealthCover(saved.inputs, { partnerCompanies: [] });
  const r = transport.lastRaw();
  assert.ok(r.startsWith(`🧮 *${expected.totalProtection}* recommended cover for age 42, Mumbai (metro), a couple with kids.`), r);
  assert.match(r, /https:\/\/indsure\.in\/calculator\/report\/calc-uuid-1/);
  assert.match(transport.last(), /Reply SHARE to send it to the customer/);
});

test("calculator: answers it can't read are asked again, never guessed", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("calculate cover"));
  await bot.handle(text("somewhere nice"));
  assert.match(transport.last(), /I don't know that city/);
  await bot.handle(text("Pune"));
  await bot.handle(text("maybe"));
  assert.match(transport.last(), /Reply 1 \(rarely or never\) or 2/);
  await bot.handle(text("no"));
  await bot.handle(text("1"));
  await bot.handle(text("90"));
  assert.match(transport.last(), /ages 18 to 75/);
  assert.equal(engine.calcSaved.length, 0);
});

/* ── Compare ── */

test("compare two plans by name: engine verdict and the report link", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("compare Care Supreme vs Niva ReAssure 2.0"));
  assert.deepEqual(engine.compared[0], ["UIN-CARE-SUP", "UIN-NIVA-RA2"]);
  const r = transport.lastRaw();
  assert.match(r, /^⚖️ \*Care Supreme\* is stronger on the wording than Niva Bupa ReAssure 2\.0\./);
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

test("compare: a plan not in the catalogue keeps the comparison going; a new name finishes it", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("compare Star Comprehensive vs Care Supreme"));
  assert.match(transport.last(), /"Star Comprehensive" isn't in the plan catalogue yet/);
  assert.equal(engine.compared.length, 0);
  await bot.handle(text("ReAssure 2.0"));
  assert.deepEqual(engine.compared[0].sort(), ["UIN-CARE-SUP", "UIN-NIVA-RA2"]);
});

test("compare: bare COMPARE lists companies, then that company's plans, twice, then compares", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("compare"));
  assert.match(transport.last(), /^Plan 1 of 2: which company\?\n1\) Care\n2\) HDFC ERGO\n3\) Niva Bupa\nReply with the number, or type the plan name\.$/);
  await bot.handle(text("2"));
  assert.match(transport.last(), /^Which HDFC ERGO plan\?\n1\) Optima Secure \(Gold\)\n2\) Optima Secure \(Silver\)\nReply with the number\.$/);
  await bot.handle(text("1"));
  assert.match(transport.last(), /^Plan 2 of 2: which company\?/);
  await bot.handle(text("niva"), );
  assert.match(transport.last(), /^Which Niva Bupa plan\?\n1\) ReAssure 2\.0/, "a company can be typed by name");
  await bot.handle(text("1"));
  assert.deepEqual(engine.compared[0], ["UIN-HDFC-OPT:Gold", "UIN-NIVA-RA2"]);
  assert.match(transport.last(), /Full side-by-side/);
});

test("compare: typing plan names still works at any step", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("compare"));
  await bot.handle(text("Care Supreme"));
  assert.match(transport.last(), /^Plan 2 of 2: which company\?/);
  await bot.handle(text("ReAssure 2.0"));
  assert.equal(engine.compared.length, 1);
});

test("compare: an unknown name offers the closest plans (Manipal Lifetime Health case)", async () => {
  const { bot, transport, engine } = makeBot();
  engine.catalogRows.push({ plan_key: "UIN-MC-PRO", insurer: "ManipalCigna Health Insurance", plan_name: "ProHealth Prime", variant: "" });
  await bot.handle(text("compare Manipal Lifetime Health vs Care Supreme"));
  assert.match(transport.last(), /"Manipal Lifetime Health" isn't in the plan catalogue yet\. The closest ones:\n1\) .*ProHealth Prime/);
  await bot.handle(text("Manipal LTH"));
  assert.doesNotMatch(transport.last(), /Nothing in your book/, "still comparing, not a customer search");
  await bot.handle(text("1"));
  assert.equal(engine.compared.length, 1);
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
  assert.ok(transport.last().split("\n").length <= 6, "help stays short");
  assert.match(transport.last(), /Or just tell me what you need\./);
  await bot.handle(text("more"));
  for (const w of ["CALCULATOR", "COMPARE", "LEAD", "LINK", "FOLLOW UPS", "CLAIMS", "VIEWS", "CHECKS", "FIND", "SURRENDER VALUE", "UPGRADE MESSAGE", "MY CLIENTS"]) {
    assert.ok(transport.last().includes(w), w);
  }
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
  assert.match(transport.last(), /Which city do they live in\?/);
  await bot.handle(text("cancel"));
  await bot.handle(text("List of all health clients name"));
  assert.deepEqual(engine.policyType, ["health"]);
  assert.match(transport.last(), /^📋 Your health policies \(1\), newest first:\n1\) \*Santosh Vartak\* · ManipalCigna ProHealth · 75\/100/);
});

test("my clients: all types, and an empty book says so", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("my clients"));
  assert.deepEqual(engine.policyType, [null]);
  assert.match(transport.last(), /no checked policies yet/);
});

/* ── Conversational answers (no model) ── */

test("calculator understands words, and CHANGE at the review goes back", async () => {
  const { bot, transport, engine } = makeBot();
  for (const m of ["calculator", "Bengaluru", "no", "just him", "27", "8 lakh", "company gives 3 lakh", "maximum", "premium", "diabetes"]) await bot.handle(text(m));
  assert.match(transport.last(), /^Please check:/);
  await bot.handle(text("change age"));
  assert.match(transport.last(), /How old are they\?/);
  await bot.handle(text("30"));
  assert.match(transport.last(), /^Please check:[\s\S]*• Age: 30/);
  await bot.handle(text("yes"));
  assert.deepEqual(engine.calcSaved[0].inputs, {
    cityTier: "Tier-1", city: "Bangalore", globalTravel: "Rarely or never", familyStructure: "Individual",
    exactAge: 30, ageBand: "18-30", annualIncome: "5-10L", employerCover: "< 5L", riskPosture: "Zero financial shock",
    hospitalPreference: "Premium corporate hospitals", recurringExpenses: "Chronic but stable",
  });
});

test("calculator for a customer: age and city from their record, saved to them, portal share text", async () => {
  const { bot, transport, engine } = makeBot();
  engine.customers = [{ id: "c1", name: "Ramesh Kumar", phone: "9812345678", dob: "1930-01-01", city: "Pune" }];
  await bot.handle(text("calculator for Ramesh"));
  assert.match(transport.last(), /^Cover calculator for \*Ramesh Kumar\*\.\n\nDo they travel outside India\?/);
  // travel, family, income, employer, risk. City and age come from the record; hospital and
  // regular-costs are skipped for a tier-1 city at minimum risk, exactly as the portal does.
  for (const m of ["1", "1", "8 lakh", "none", "1"]) await bot.handle(text(m));
  assert.match(transport.last(), /• City: Pune, tier-1 city \(from Ramesh's record\)/);
  assert.match(transport.last(), /• Age: 40 \(from Ramesh's record\)/);
  await bot.handle(text("yes"));
  assert.equal(engine.calcSaved[0].customerId, "c1");
  assert.match(transport.last(), /Saved to Ramesh's record\./);
  await bot.handle(text("share in english"));
  assert.match(transport.last(), /wa\.me\/919812345678\?text=/);
  assert.match(transport.last(), /Hi Ramesh, I ran a health-cover needs analysis for you on IndSure\. Recommended protection: /);
});

test("city tier comes from the portal's own zone table", async () => {
  const { cityAnswer } = await import("../src/core/tools.js");
  const { getCityTier } = await import("../src/shared/city-tier-util.js");
  for (const c of ["Mumbai", "Pune", "Indore", "Nagpur", "Guwahati"]) {
    const t = getCityTier(c);
    assert.equal(cityAnswer(`they live in ${c}`)!.tier, t === 1 ? "Metro" : t === 2 ? "Tier-1" : "Tier-2", c);
  }
  assert.equal(cityAnswer("bombay")!.city, "Mumbai");
  assert.equal(cityAnswer("tier 2")!.tier, "Tier-2");
  assert.equal(cityAnswer("xyzabc"), null);
});

test("family with parents wins over kids when both are said", async () => {
  const { pickCalcOption } = await import("../src/core/tools.js");
  assert.equal(pickCalcOption(0, "me, wife, 2 kids and my parents"), "Parents included");
  assert.equal(pickCalcOption(0, "wife and kids"), "Couple + kids");
  assert.equal(pickCalcOption(1, "no"), "None");
  assert.equal(pickCalcOption(1, "12 lakh"), "> 10L");
  assert.equal(pickCalcOption(1, "3"), "5-10L");
  assert.equal(pickCalcOption(2, "maximum"), "Zero financial shock");
});

test("SHARE after the calculator shares the calculator result, not the old policy", async () => {
  const { bot, transport, engine } = makeBot();
  const id = "88888888-8888-4888-8888-888888888888";
  engine.clients.set(id, healthClient(id, { policyholderName: "Santosh Vartak" }));
  engine.conv = { state: "REPORT_READY", currentClientId: id, pending: {}, updatedAt: null };
  for (const m of ["calculator", "Mumbai", "1", "1", "27", "8 lakh", "1", "2", "1", "1", "yes"]) await bot.handle(text(m));
  await bot.handle(text("share it with +919987148125"));
  assert.match(transport.last(), /Which language/);
  await bot.handle(text("3"));
  const r = transport.last();
  assert.match(r, /https:\/\/wa\.me\/919987148125\?text=/);
  assert.match(r, /हेल्थ कवर का विश्लेषण/);
  assert.match(r, /\/calculator\/report\/calc-uuid-1/);
  assert.doesNotMatch(r, /Santosh/);
  assert.doesNotMatch(r, /when they open the report/);
  assert.equal(engine.shared.length, 0);
});

test("SHARE after a compare shares the comparison; asking about a policy switches back", async () => {
  const { bot, transport, engine } = makeBot();
  const id = "99999999-9999-4999-8999-999999999999";
  engine.clients.set(id, healthClient(id, { policyholderName: "Santosh Vartak" }));
  await bot.handle(text("compare Care Supreme vs Niva ReAssure 2.0"));
  await bot.handle(text("share in english"));
  assert.match(transport.last(), /side-by-side comparison of Care Supreme and Niva Bupa ReAssure 2\.0: https:\/\/indsure\.in\/compare\/report\/cmp-uuid-1/);
  await bot.handle(text("Santosh's policy room rent?"));
  await bot.handle(text("share in english"));
  assert.match(transport.last(), /Namaste Santosh, here is the report/);
});

test("THE SCREENSHOT: two companies in one reply, 'NUMBER 6', and a typo never loses the list", async () => {
  const { bot, transport, engine } = makeBot();
  engine.catalogRows.push(
    { plan_key: "UIN-MC-LTH", insurer: "ManipalCigna Health Insurance", plan_name: "Lifetime Health", variant: "" },
    { plan_key: "UIN-MC-PRO", insurer: "ManipalCigna Health Insurance", plan_name: "ProHealth Prime", variant: "" },
    { plan_key: "UIN-HDFC-MY:Lite", insurer: "HDFC ERGO", plan_name: "my: Optima Secure", variant: "Optima Lite" },
  );
  await bot.handle(text("compare"));
  await bot.handle(text("hdfc and manipal cigna"));
  assert.match(transport.last(), /^Which HDFC ERGO plan\?\n1\) Optima Secure \(Gold\)\n2\) Optima Secure \(Optima Lite\)/, "no 'my:' and no 'too many'");
  await bot.handle(text("xyz plan"));
  assert.match(transport.last(), /"xyz plan" isn't a plan I know\. Reply with a number from 1 to 3/);
  await bot.handle(text("NUMBER 2"));
  assert.match(transport.last(), /^Which ManipalCigna plan\?\n1\) Lifetime Health\n2\) ProHealth Prime/);
  await bot.handle(text("1"));
  assert.deepEqual(engine.compared[0], ["UIN-HDFC-MY:Lite", "UIN-MC-LTH"]);
});

test("pickNumber reads the ways people type a choice", async () => {
  const { pickNumber } = await import("../src/core/intents.js");
  for (const t of ["6", "6)", "6.", "number 6", "NUMBER 6", "no. 6", "option 6", "#6", "6th", "6 number", "6 wala", "६"]) assert.equal(pickNumber(t, 7), 6, t);
  assert.equal(pickNumber("8", 7), null);
  assert.equal(pickNumber("Care Supreme 6", 7), null);
});
