import { test } from "node:test";
import assert from "node:assert/strict";
import { makeBot, text, healthClient } from "./fakes.js";
import { parseLeadUpdate, parseWhen, parseDraft, nameMatches } from "../src/core/crm.js";
import { ruleIntent } from "../src/core/intents.js";

// The fake clock in makeBot starts at 1_000_000 ms = Thu 1 Jan 1970, 00:16 UTC (05:46 IST).
const NOW = 1_000_000;

const lead = (over: any = {}) => ({ id: "l-" + Math.random().toString(36).slice(2), name: "Ramesh Kumar", phone: "9812345678", status: "new", insurance_interest: "Health", next_follow_up: null, notes: null, ...over });

/* ── Parsing ── */

test("dates: today, tomorrow, weekday, in N days, dd/mm, dd Mon", () => {
  assert.equal(parseWhen("Ramesh today", NOW)!.date, "1970-01-01");
  assert.equal(parseWhen("Ramesh tomorrow", NOW)!.date, "1970-01-02");
  assert.equal(parseWhen("Ramesh friday", NOW)!.date, "1970-01-02");
  assert.equal(parseWhen("Ramesh thursday", NOW)!.date, "1970-01-08"); // same weekday = next week
  assert.equal(parseWhen("Ramesh in 3 days", NOW)!.date, "1970-01-04");
  assert.equal(parseWhen("Ramesh next week", NOW)!.date, "1970-01-08");
  assert.equal(parseWhen("Ramesh 15/1", NOW)!.date, "1970-01-15");
  assert.equal(parseWhen("Ramesh 3 feb", NOW)!.date, "1970-02-03");
  assert.equal(parseWhen("Ramesh Kumar friday", NOW)!.rest, "Ramesh Kumar");
  assert.equal(parseWhen("Ramesh", NOW), null);
});

test("lead updates parse; ambiguous words do not", () => {
  assert.deepEqual(parseLeadUpdate("Ramesh won", NOW), { name: "Ramesh", status: "won" });
  assert.deepEqual(parseLeadUpdate("mark Sunita Rao interested", NOW), { name: "Sunita Rao", status: "interested" });
  assert.deepEqual(parseLeadUpdate("Anil is not interested", NOW), { name: "Anil", status: "lost" });
  assert.deepEqual(parseLeadUpdate("follow up Ramesh Friday", NOW), { name: "Ramesh", nextFollowUp: "1970-01-02" });
  assert.deepEqual(parseLeadUpdate("note Ramesh: wants a 10L family floater", NOW), { name: "Ramesh", note: "wants a 10L family floater" });
  assert.equal(parseLeadUpdate("ok done", NOW), null);
  assert.equal(parseLeadUpdate("what's the room rent?", NOW), null);
});

test("a typed name matches word starts only: 'ok' never matches Alok", () => {
  assert.equal(nameMatches("ok", "Alok Verma"), false);
  assert.equal(nameMatches("ram", "Ramesh Kumar"), true);
  assert.equal(nameMatches("ramesh k", "Ramesh Kumar"), true);
  assert.equal(nameMatches("suresh", "Ramesh Kumar"), false);
});

test("draft requests parse to the portal's template kinds", () => {
  assert.deepEqual(parseDraft("upgrade message for Santosh"), { kind: "upgrade_weak", name: "Santosh" });
  assert.deepEqual(parseDraft("Diwali message for Ramesh in hindi"), { kind: "festival", name: "Ramesh" });
  assert.deepEqual(parseDraft("thank you message to Anil"), { kind: "thank_you", name: "Anil" });
  assert.deepEqual(parseDraft("follow up message for Sunita"), { kind: "follow_up", name: "Sunita" });
  assert.equal(parseDraft("upgrade Santosh"), null);
  assert.equal(ruleIntent("follow up message for Sunita"), "draft");
  assert.equal(ruleIntent("follow ups"), "followups");
  assert.equal(ruleIntent("who do I call today?"), "followups");
});

/* ── Flows ── */

test("'Ramesh won' updates the one matching lead", async () => {
  const { bot, transport, engine } = makeBot();
  const r = lead(); engine.leadRows = [r, lead({ name: "Alok Verma", phone: "9800000001" })];
  await bot.handle(text("Ramesh won"));
  assert.deepEqual(engine.leadUpdates, [{ id: r.id, status: "won", nextFollowUp: undefined, note: undefined }]);
  assert.match(transport.last(), /^\*Ramesh Kumar\*: marked won\.\nhttps:\/\/indsure\.in\/agent\/leads\/\S+\nNext: thank you message for Ramesh$/);
});

test("'ok done' and 'alok'-style near misses change nothing", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [lead({ name: "Alok Verma" })];
  await bot.handle(text("ok done"));
  await bot.handle(text("ok won"));
  assert.equal(engine.leadUpdates.length, 0);
  assert.doesNotMatch(transport.texts().join("\n"), /marked/);
});

test("follow-up date and a note; two matching leads ask which", async () => {
  const { bot, transport, engine } = makeBot();
  const a = lead(), b = lead({ name: "Ramesh Shah", phone: "9811111111" });
  engine.leadRows = [a, b];
  await bot.handle(text("follow up Ramesh Friday"));
  assert.match(transport.last(), /Which Ramesh\?\n1\) Ramesh Kumar/);
  await bot.handle(text("2"));
  assert.equal(engine.leadUpdates[0].id, b.id);
  assert.equal(engine.leadUpdates[0].nextFollowUp, "1970-01-02");
  assert.match(transport.last(), /follow-up set for Fri 2 Jan/);
  await bot.handle(text("note Ramesh Kumar: wants family floater"));
  assert.equal(engine.leadUpdates[1].note, "wants family floater");
});

test("follow-ups list: overdue and today", async () => {
  const { bot, transport, engine } = makeBot();
  engine.followupRows = [lead({ days: -2 }), lead({ name: "Sunita Rao", phone: null, days: 0 })];
  await bot.handle(text("who do I call today?"));
  assert.match(transport.last(), /^📋 2 follow-ups due:\n1\) \*Ramesh Kumar\* · 9812345678 · overdue 2d · Health\n2\) \*Sunita Rao\* · today · Health/);
  engine.followupRows = [];
  await bot.handle(text("follow ups"));
  assert.match(transport.last(), /No follow-ups due today/);
});

test("upgrade message uses the report's weak point and the advisor's name", async () => {
  const { bot, transport, engine } = makeBot();
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  engine.clients.set(id, { ...healthClient(id, { policyholderName: "Santosh Vartak", customerPhone: "9987148125" }), weakPoint: "Room rent capped at 1% of sum insured" });
  await bot.handle(text("upgrade message for Santosh"));
  const r = transport.last();
  assert.match(r, /https:\/\/wa\.me\/919987148125\?text=/);
  assert.match(r, /Hello Santosh,/);
  assert.match(r, /for example, room rent capped at 1% of sum insured/);
  assert.match(r, /Thanks,\nDeep Shah/);
  assert.match(r, /Add: in hindi/);
});

test("festival message goes to a lead when there is no policy", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [lead({ name: "Priya Nair", phone: "9876543210" })];
  await bot.handle(text("Diwali message for Priya in hinglish"));
  assert.match(transport.last(), /wa\.me\/919876543210/);
  assert.match(transport.last(), /Namaste Priya ji/);
});

test("find: policies and leads on a name; a bare number too", async () => {
  const { bot, transport, engine } = makeBot();
  const id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  engine.clients.set(id, healthClient(id, { policyholderName: "Ramesh Kumar", expiryDate: "2026-12-01" }));
  engine.leadRows = [lead()];
  await bot.handle(text("find Ramesh"));
  assert.match(transport.last(), /^📋 1 policy and 1 lead for "Ramesh":\n1\) \*Ramesh Kumar\* · health · Care Supreme · expires Tue 1 Dec · 65\/100/);
  assert.match(transport.last(), /• Lead: \*Ramesh Kumar\* · 9812345678 · new/);
  await bot.handle(text("98123 45678"));
  assert.match(transport.last(), /1 lead for "98123 45678"/);
});

test("a phone number answering 'whose policy?' is not treated as a lookup", async () => {
  const { bot, transport, engine } = makeBot();
  engine.customers = [{ id: "c9", name: "Meera Iyer", phone: "9822222222" }];
  const { pdf, settle } = await import("./fakes.js");
  await bot.handle(pdf(transport, "HEALTH"));
  await settle(bot);
  assert.match(transport.last(), /Whose policy is this\?/);
  await bot.handle(text("9822222222"));
  assert.match(transport.last(), /Saved under Meera Iyer/);
});

test("checks left, views, claims", async () => {
  const { bot, transport, engine } = makeBot();
  engine.checks = 7;
  await bot.handle(text("how many checks do I have"));
  assert.match(transport.last(), /You have \*7\* policy checks left\.\nNext: send a health policy PDF to use one\./);
  engine.viewRows = [{ clientId: "x", name: "Santosh Vartak", insurer: "ManipalCigna", policyName: "ProHealth", views: 3, lastViewed: "2026-09-25T06:07:00Z" }];
  await bot.handle(text("who opened my reports"));
  assert.match(transport.last(), /1\) \*Santosh Vartak\* · ProHealth · 3 views · last 25 Sep 11:37\n\nA good moment to call\. Their details: FIND Santosh/);
  engine.claimRows = [{ id: "cl1", status: "query_raised", claim_type: "cashless", insurer: "Star Health", hospital: "Apollo", ailment: "Knee replacement", claimed_amount: "240000", settled_amount: null, admitted_on: "2026-09-10", customer_name: "Ramesh Kumar", openQueries: [{ seq: 1, question: "Send discharge summary", raisedOn: "2026-09-20" }] }];
  await bot.handle(text("claims"));
  assert.match(transport.last(), /📋 1 open claim:\n1\) \*Ramesh Kumar\* · Apollo, Knee replacement · Query \(1 open query\) · ₹2,40,000/);
  await bot.handle(text("claim Ramesh"));
  assert.deepEqual(engine.claimQueries, [null, "Ramesh"]);
  assert.match(transport.last(), /Status: Query \(cashless\)/);
  assert.match(transport.last(), /• Q1 \(2026-09-20\): Send discharge summary/);
});

test("motor policy question shows its stored details with the portal's labels", async () => {
  const { bot, transport, engine } = makeBot();
  const id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  engine.clients.set(id, { ...healthClient(id, { policyholderName: "Anil Mehta", insuranceType: "motor", report: null, score: null }), details: [{ label: "IDV (sum insured)", value: "640000" }, { label: "No-claim bonus (%)", value: "20" }] });
  await bot.handle(text("Anil's policy IDV?"));
  assert.match(transport.last(), /\*Anil Mehta\* · Care Supreme · motor policy \(scores are for health only\)\n• IDV \(sum insured\): 640000\n• No-claim bonus \(%\): 20/);
});

test("surrender value runs the portal's value engine on the stored life fields", async () => {
  const { bot, transport, engine } = makeBot();
  const { computePolicyValue } = await import("../src/shared/policyValue.js");
  const id = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  // Real life-policy field names (EXTRACTION_FIELDS.life). Started 1965, so policy year 6 at the fake clock.
  const fields = { sum_assured: 1000000, premium: 50000, premium_frequency: "annual", policy_term_years: 20, premium_paying_term_years: 20, start_date: "1964-06-01", plan_type: "Endowment", age_at_entry: 30 };
  engine.clients.set(id, { ...healthClient(id, { policyholderName: "Ramesh Kumar", insuranceType: "life", report: null, insurer: "LIC", policyName: "Jeevan Anand" }), extracted: fields, details: [] });
  await bot.handle(text("surrender value Ramesh"));
  const r = transport.last();
  const v: any = computePolicyValue("life", fields, { asOf: new Date(NOW) });
  assert.ok(!("missing" in v), JSON.stringify(v));
  assert.match(r, /^\*Ramesh Kumar\* · LIC Jeevan Anand/);
  assert.match(r, /At maturity \(year 20\)/);
  const row = v.rows.find((x: any) => x.year === v.currentYear);
  assert.ok(row, "engine placed the policy year");
  assert.ok(r.includes(`If surrendered now (policy year ${row.year})`), r);
  assert.match(r, /Full year-by-year values: https:\/\/indsure\.in\/agent\/policies\//);
});

test("surrender value with missing fields says exactly what to fill in", async () => {
  const { bot, transport, engine } = makeBot();
  const id = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  engine.clients.set(id, { ...healthClient(id, { policyholderName: "Anil Mehta", insuranceType: "life", report: null }), extracted: { sum_assured: 500000 }, details: [] });
  await bot.handle(text("surrender value Anil"));
  assert.match(transport.last(), /Missing: Premium, Policy term \(years\)\./);
});

test("a pure term plan: no surrender value, said plainly (never 'Rs 0 back')", async () => {
  const { bot, transport, engine } = makeBot();
  const id = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  engine.clients.set(id, { ...healthClient(id, { policyholderName: "Vikram Rao", insuranceType: "term", report: null, insurer: "HDFC Life", policyName: "Click 2 Protect" }), extracted: { sum_assured: 10000000, premium: 15000, policy_term_years: 30, plan_type: "Term" }, details: [] });
  await bot.handle(text("surrender value Vikram"));
  assert.match(transport.last(), /term cover only, so it has no surrender or maturity value/);
  assert.doesNotMatch(transport.last(), /₹0/);
});

/* ── Chat polish (advisor feedback, 25 Sep) ── */

test("legal insurer names shortened, ALL-CAPS names title-cased, everywhere", async () => {
  const { bot, transport, engine } = makeBot();
  const id = "12121212-1212-4121-8121-121212121212";
  engine.clients.set(id, healthClient(id, {
    policyholderName: "JIGNESH RAMNIKLAL BHAGAT", insurer: "ManipalCigna Health Insurance Company Limited", policyName: "ProHealth", score: 75,
  }));
  await bot.handle(text("my clients"));
  assert.match(transport.last(), /1\) \*Jignesh Ramniklal Bhagat\* · ManipalCigna ProHealth · 75\/100/);
  assert.doesNotMatch(transport.last(), /Company Limited|JIGNESH/);
});

test("every reply has at most one emoji", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [lead()];
  engine.followupRows = [lead({ days: 0 })];
  for (const m of ["help", "more", "renewals", "follow ups", "find Ramesh", "calculator", "27 mumbai", "1", "1", "2", "compare Care Supreme vs Niva ReAssure 2.0", "my clients", "checks"]) {
    await bot.handle(text(m));
  }
  const emoji = /\p{Extended_Pictographic}/gu;
  for (const s of transport.texts()) assert.ok((s.match(emoji) || []).length <= 1, s);
});
