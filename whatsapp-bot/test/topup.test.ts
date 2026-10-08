/** Base policy + super top-up: one check for both, and never a check without a reply.
 *  Plan: docs/plans/2026-10-08-wa-super-topup-pairing.md */

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { makeBot, text, pdf, settle } from "./fakes.js";
import { extractNames, looksLikeTopUp, sameInsured } from "../src/core/pdfInspect.js";
import { isAlone, parsePair } from "../src/core/intents.js";

const sha = (s: string) => crypto.createHash("sha256").update(Buffer.from(`%PDF-1.4 ${s}`)).digest("hex");
const body = (f: any) => f.buffer.toString("latin1");

test("base, then NO: one check on its own, no top-up sent", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(pdf(transport, "HEALTH base NAME=Ramesh_Kumar"));
  assert.match(transport.last(), /Does \*?Ramesh Kumar\*? also have a super top-up policy\?/);
  assert.match(transport.last(), /Or reply NO to check this one alone\./);
  assert.equal(engine.analyzeCalls.length, 0);
  await bot.handle(text("no"));
  await settle(bot);
  assert.equal(engine.analyzeCalls.length, 1);
  assert.equal(engine.analyzeCalls[0].companion, null);
  assert.doesNotMatch(transport.texts().join("\n"), /Checked together/);
});

test("base, then its super top-up, then YES: ONE check with the top-up as companion", async () => {
  const { bot, transport, engine } = makeBot();
  engine.checks = 5;
  await bot.handle(pdf(transport, "HEALTH base NAME=Ramesh_Kumar"));
  await bot.handle(pdf(transport, "HEALTH TOPUP NAME=Ramesh_Kumar"));
  const q = transport.last();
  assert.match(q, /Is this the super top-up for \*?Ramesh Kumar\*?\?/);
  assert.match(q, /The base policy names \*?Ramesh Kumar\*?, the super top-up names \*?Ramesh Kumar\*?\./);
  assert.match(q, /Reply YES to check them together as one cover \(1 policy check\), or NO to check them separately \(2 policy checks\)\./);
  assert.equal(engine.analyzeCalls.length, 0);
  await bot.handle(text("yes"));
  await settle(bot);
  assert.equal(engine.analyzeCalls.length, 1);
  const call = engine.analyzeCalls[0];
  assert.match(body(call), /base/);
  assert.match(call.companion.buffer.toString("latin1"), /TOPUP/);
  assert.equal(engine.checks, 4, "one policy check for both");
  const all = transport.texts().join("\n");
  assert.match(all, /Okay, checking them together as one cover\. It uses 1 policy check\./);
  assert.match(all, /Checked together with the super top-up\. Total cover is in the full report\./);
});

test("top-up first, then the base: the base is the policy, the top-up the companion", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(pdf(transport, "HEALTH TOPUP NAME=Sunita_Rao"));
  assert.match(transport.last(), /This looks like a super top-up for \*?Sunita Rao\*?\./);
  assert.match(transport.last(), /Or reply ALONE to check the top-up by itself\./);
  await bot.handle(pdf(transport, "HEALTH base NAME=Sunita_Rao"));
  await bot.handle(text("yes"));
  await settle(bot);
  assert.equal(engine.analyzeCalls.length, 1);
  assert.match(body(engine.analyzeCalls[0]), /base/);
  assert.match(engine.analyzeCalls[0].companion.buffer.toString("latin1"), /TOPUP/);
});

test("different names: says so, and NO checks them separately (2 checks)", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(pdf(transport, "HEALTH base NAME=Ramesh_Kumar"));
  await bot.handle(pdf(transport, "HEALTH TOPUP NAME=Suresh_Rao"));
  assert.match(transport.last(), /These may be different people: the base policy names \*?Ramesh Kumar\*?, the super top-up names \*?Suresh Rao\*?\./);
  await bot.handle(text("no"));
  await settle(bot);
  assert.equal(engine.analyzeCalls.length, 2);
  assert.ok(engine.analyzeCalls.every((c: any) => !c.companion));
});

test("names unreadable: still asks, never pairs on its own", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(pdf(transport, "HEALTH base"));
  await bot.handle(pdf(transport, "HEALTH TOPUP"));
  assert.match(transport.last(), /I couldn't read the names on both, so I can't confirm it's the same person\./);
  await settle(bot);
  assert.equal(engine.analyzeCalls.length, 0);
});

test("base and top-up sent at the same moment: one question, one combined check", async () => {
  const { bot, transport, engine } = makeBot();
  await Promise.all([
    bot.handle(pdf(transport, "HEALTH base NAME=Ramesh_Kumar")),
    bot.handle(pdf(transport, "HEALTH TOPUP NAME=Ramesh_Kumar")),
  ]);
  assert.equal(engine.conv.state, "AWAITING_TOPUP");
  assert.equal(engine.conv.pending.held.length, 2);
  await bot.handle(text("haan"));
  await settle(bot);
  assert.equal(engine.analyzeCalls.length, 1);
  assert.ok(engine.analyzeCalls[0].companion);
});

test("an unrecognised PDF while waiting is turned away; the held policy is kept", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(pdf(transport, "HEALTH base NAME=Ramesh_Kumar"));
  await bot.handle(pdf(transport, "UNKNOWN"));
  assert.match(transport.last(), /Please answer about Ramesh Kumar first, then send this one again\. No policy check was used\./);
  assert.equal(engine.conv.state, "AWAITING_TOPUP");
  assert.equal(engine.conv.pending.held.length, 1);
  await bot.handle(text("no"));
  await settle(bot);
  assert.equal(engine.analyzeCalls.length, 1);
});

test("a scanned super top-up can't be read with the base: says so before any check", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(pdf(transport, "HEALTH base NAME=Ramesh_Kumar"));
  await bot.handle(pdf(transport, "HEALTH TOPUP SCAN"));
  assert.match(transport.last(), /The super top-up is a scanned copy/);
  await bot.handle(text("yes"));
  assert.match(transport.last(), /scanned copy/);
  assert.equal(engine.analyzeCalls.length, 0);
  await bot.handle(text("no"));
  await settle(bot);
  assert.equal(engine.analyzeCalls.length, 2);
});

test("unanswered for 15 minutes: nothing checked, nothing charged, told on the next message", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(pdf(transport, "HEALTH base NAME=Ramesh_Kumar"));
  const held = engine.conv.pending.held[0].file.path;
  engine.conv.updatedAt = new Date(0).toISOString();
  await bot.handle(text("hi"));
  assert.ok(transport.texts().some((x) => /I didn't hear back about Ramesh Kumar, so I didn't check it and no policy check was used\./.test(x)));
  await settle(bot);
  assert.equal(engine.analyzeCalls.length, 0);
  await assert.rejects(fs.access(held));
  // Told once only.
  await bot.handle(text("hi"));
  assert.equal(transport.texts().filter((x) => /didn't hear back/.test(x)).length, 1);
});

test("the engine could not read the top-up: the card says the report is base only", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(pdf(transport, "HEALTH base NAME=Ramesh_Kumar"));
  await bot.handle(pdf(transport, "HEALTH TOPUP UNREADABLE NAME=Ramesh_Kumar"));
  await bot.handle(text("yes"));
  await settle(bot);
  assert.match(transport.texts().join("\n"), /I couldn't read the super top-up, so this report is for the base policy only\./);
  assert.doesNotMatch(transport.texts().join("\n"), /Checked together/);
});

test("both already checked (the re-send case): the pair runs as one new check", async () => {
  const { bot, transport, engine } = makeBot();
  engine.hashes.set(sha("HEALTH base NAME=Ramesh_Kumar"), "22222222-2222-4222-8222-222222222222");
  engine.hashes.set(sha("HEALTH TOPUP NAME=Ramesh_Kumar"), "33333333-3333-4333-8333-333333333333");
  await bot.handle(pdf(transport, "HEALTH base NAME=Ramesh_Kumar"));
  assert.match(transport.last(), /already checked this exact file/);
  await bot.handle(pdf(transport, "HEALTH TOPUP NAME=Ramesh_Kumar"));
  assert.match(transport.last(), /Is this the super top-up for/);
  // Both were checked before, so "separately" would not re-run either.
  assert.match(transport.last(), /NO to check them separately \(no new policy check\)/);
  await bot.handle(text("yes"));
  await settle(bot);
  assert.equal(engine.analyzeCalls.length, 1);
  assert.ok(engine.analyzeCalls[0].companion);
});

test("three health PDFs: 1+3 pairs those two, the other is checked separately", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(pdf(transport, "HEALTH a", { caption: "Anil Shah" }));
  await bot.handle(pdf(transport, "HEALTH b", { caption: "Meena Iyer" }));
  await bot.handle(pdf(transport, "HEALTH TOPUP c", { caption: "Anil Shah" }));
  assert.match(transport.last(), /3\) Anil Shah \(looks like a super top-up\)/);
  await bot.handle(text("1+3"));
  await settle(bot);
  assert.equal(engine.analyzeCalls.length, 2);
  const pair = engine.analyzeCalls.find((c: any) => c.companion);
  assert.match(body(pair), /HEALTH a/);
  assert.match(pair.companion.buffer.toString("latin1"), /TOPUP c/);
  assert.ok(transport.texts().some((x) => /The other policy will be checked separately\./.test(x)));
});

test("a command mid-question sets the held PDF aside, out loud, with no check", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(pdf(transport, "HEALTH base NAME=Ramesh_Kumar"));
  await bot.handle(text("renewals"));
  assert.ok(transport.texts().some((x) => /I've set aside Ramesh Kumar without checking it\. No policy check was used\./.test(x)));
  await settle(bot);
  assert.equal(engine.analyzeCalls.length, 0);
});

test("a motor PDF while waiting runs on its own; the question stays open", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(pdf(transport, "HEALTH base NAME=Ramesh_Kumar"));
  await bot.handle(pdf(transport, "MOTOR car"));
  await settle(bot);
  assert.equal(engine.analyzeCalls.length, 1);
  assert.equal(engine.analyzeCalls[0].type, "motor");
  assert.equal(engine.conv.state, "AWAITING_TOPUP");
});

test("a held file gone before the check: asks for both again, nothing run", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(pdf(transport, "HEALTH base NAME=Ramesh_Kumar"));
  await bot.handle(pdf(transport, "HEALTH TOPUP NAME=Ramesh_Kumar"));
  await fs.rm(engine.conv.pending.held[1].file.path, { force: true });
  await bot.handle(text("yes"));
  await settle(bot);
  assert.equal(engine.analyzeCalls.length, 0);
  assert.match(transport.last(), /Please send the base policy and the super top-up again\./);
});

test("Hindi: the question is in Hindi and a Hindi NO works", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("HINDI"));
  await bot.handle(pdf(transport, "HEALTH base NAME=Ramesh_Kumar"));
  assert.match(transport.last(), /क्या \*?Ramesh Kumar\*? की सुपर टॉप-अप पॉलिसी भी है\?/);
  assert.match(transport.last(), /या सिर्फ़ इसे चेक करने के लिए NO लिखिए।/);
  await bot.handle(text("नहीं"));
  await settle(bot);
  assert.equal(engine.analyzeCalls.length, 1);
});

test("Hinglish ALONE words check a lone top-up by itself", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(pdf(transport, "HEALTH TOPUP NAME=Ramesh_Kumar"));
  await bot.handle(text("sirf yeh"));
  await settle(bot);
  assert.equal(engine.analyzeCalls.length, 1);
  assert.equal(engine.analyzeCalls[0].companion, null);
});

test("house copy: no em dash, never 'AI' or 'credits' in any top-up message", async () => {
  const { bot, transport } = makeBot();
  await bot.handle(pdf(transport, "HEALTH TOPUP"));
  await bot.handle(pdf(transport, "HEALTH base NAME=Ramesh_Kumar"));
  await bot.handle(pdf(transport, "HEALTH c NAME=Suresh_Rao"));
  await bot.handle(text("1+2"));
  await settle(bot);
  for (const s of transport.texts()) {
    assert.doesNotMatch(s, /—/, s);
    assert.doesNotMatch(s, /\bAI\b/, s);
    assert.doesNotMatch(s, /\bcredits?\b/i, s);
  }
});

/* ── Units ── */

test("looksLikeTopUp: product name near the top, or many mentions; one mention is not enough", () => {
  assert.equal(looksLikeTopUp("Health Recharge Policy Wording. Preamble ..."), true);
  assert.equal(looksLikeTopUp("Super Health Plus Top Up Policy Terms and Conditions"), true);
  assert.equal(looksLikeTopUp("Activ Health Booster Policy Wording"), true);
  const base = "Care Supreme Policy Terms. ".padEnd(2000, "x ") + " you may buy a super top-up separately. Deductible means a cost sharing requirement.";
  assert.equal(looksLikeTopUp(base), false);
  assert.equal(looksLikeTopUp("Optima Secure ".padEnd(2000, "y ") + " top-up ".repeat(6)), true);
});

test("extractNames: a labelled name is read; a label followed by another label is not a name", () => {
  assert.deepEqual(extractNames("Policy Schedule Proposer Name : Mr. RAMESH KUMAR Date of Birth 01/01/1970"), ["Ramesh Kumar"]);
  assert.deepEqual(extractNames("Name of Insured Date of Birth Gender Relationship RAMESH KUMAR 01/01/1970 Male Self"), []);
  assert.deepEqual(extractNames("Name of the Policyholder: Smt. Sunita Devi Sharma Address: 12 MG Road"), ["Sunita Devi Sharma"]);
  assert.deepEqual(extractNames("Insured Person means the person named in the Schedule"), []);
  assert.deepEqual(extractNames("Insured Name R. K. Policy No 123"), []);
});

test("sameInsured: match, mismatch only with no shared word, else unknown", () => {
  assert.equal(sameInsured(["Ramesh Kumar"], ["Ramesh Kumar Sharma"]), "unknown");
  assert.equal(sameInsured(["Ramesh Kumar"], ["Ramesh Kumar"]), "match");
  assert.equal(sameInsured(["Ramesh Kumar"], ["Suresh Rao"]), "mismatch");
  assert.equal(sameInsured(["Ramesh Kumar"], ["R. Kumar"]), "unknown");
  assert.equal(sameInsured(["Kumar Ramesh"], ["Ramesh Kumar"]), "unknown");
  assert.equal(sameInsured([], ["Ramesh Kumar"]), "unknown");
  assert.equal(sameInsured(["Ramesh Kumar", "Sita Kumar"], ["Sita Kumar"]), "match");
});

test("reply words: ALONE forms and number pairs", () => {
  for (const w of ["alone", "only this", "sirf yeh", "akele", "alag alag", "सिर्फ यह", "अकेले", "अलग"]) assert.equal(isAlone(w), true, w);
  assert.equal(isAlone("ramesh"), false);
  assert.deepEqual(parsePair("1+2", 3), [1, 2]);
  assert.deepEqual(parsePair("3 and 1", 3), [3, 1]);
  assert.deepEqual(parsePair("2, 3", 3), [2, 3]);
  assert.equal(parsePair("1+1", 3), null);
  assert.equal(parsePair("1+4", 3), null);
});
