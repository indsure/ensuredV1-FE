/** Stage 4: My Page, profile, team and help pages, end to end through the bot. The fake engine
 *  applies the server's rules (shared editRules). ALL NAMES AND NUMBERS ARE MADE UP. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { makeBot, text } from "./fakes.js";
import { ruleIntent } from "../src/core/intents.js";
import { PARTNER_INSURERS, PAGE_LANGS } from "../src/shared/editRules.js";

test("the partner list and page languages are the portal's own", () => {
  const prof = fs.readFileSync(new URL("../../frontend/client/src/pages/agent/MyProfile.tsx", import.meta.url), "utf8");
  const names = [...prof.split("HEALTH_INSURANCE_COMPANIES: InsuranceCompany[] = [")[1].split("];")[0].matchAll(/name: "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(PARTNER_INSURERS, names);
  const page = fs.readFileSync(new URL("../../frontend/client/src/lib/advisorPage.ts", import.meta.url), "utf8");
  assert.deepEqual(PAGE_LANGS, [...page.split("SPOKEN_LANGUAGES = [")[1].split("] as const")[0].matchAll(/code: "([a-z]+)"/g)].map((m) => m[1]));
});

test("routing: help, page, profile and team; old phrasings keep their meaning", () => {
  for (const s of ["how do I add a claim?", "how to share a report", "my page details", "add motor to my page", "publish my page",
    "my profile", "I work with Star and Care", "my team", "give Ravi 10 checks", "who opened my book"]) assert.equal(ruleIntent(s), "account", s);
  assert.equal(ruleIntent("how do i check a policy"), "howcheck");
  assert.equal(ruleIntent("my page"), "website");
  assert.equal(ruleIntent("share my page"), "website");
  assert.equal(ruleIntent("page stats"), "pagestats");
});

test("help pages: the right page from the help centre", async () => {
  const { bot, transport } = makeBot();
  await bot.handle(text("how do I add a claim?"));
  assert.match(transport.last(), /"Claims" in the help pages: .*\/docs\/claims/);
});

test("My Page: details, an insurance line added on YES, UNDO puts it back", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("my page details"));
  assert.match(transport.last(), /Status: Offline/);
  assert.match(transport.last(), /Insurance: Health/);
  await bot.handle(text("add motor to my page"));
  assert.match(transport.last(), /Your page: insurance Health → Health, Vehicle/);
  assert.equal(engine.writes.length, 0);
  await bot.handle(text("yes"));
  assert.deepEqual(engine.myPage.lines_of_business, ["health", "vehicle"]);
  await bot.handle(text("undo"));
  await bot.handle(text("yes"));
  assert.deepEqual(engine.myPage.lines_of_business, ["health"]);
});

test("My Page: publish needs IndSure to have switched it on; a campaign link", async () => {
  const { bot, transport, engine } = makeBot();
  engine.myPage.enabled = false;
  await bot.handle(text("publish my page"));
  assert.match(transport.last(), /IndSure switches pages on/);
  engine.myPage.enabled = true;
  await bot.handle(text("publish my page"));
  assert.match(transport.last(), /Make your page live/);
  await bot.handle(text("yes"));
  assert.equal(engine.myPage.published, true);
  await bot.handle(text("my page link for instagram"));
  assert.match(transport.last(), /\/a\/deep-shah\?utm_source=instagram/);
});

test("My Page: no page yet points to the portal; removing the last line is refused", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("remove health from my page"));
  assert.match(transport.last(), /needs at least one kind of insurance/);
  engine.myPage = null;
  await bot.handle(text("my page details"));
  assert.match(transport.last(), /don't have a page yet/);
});

test("profile: partners from the portal's list, unknown names refused, UNDO restores", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("I work with Acme"));
  assert.match(transport.last(), /I don't know "Acme"/);
  await bot.handle(text("add Niva to my partners"));
  assert.match(transport.last(), /partner insurers Care Health Insurance → Niva Bupa Health Insurance, Care Health Insurance/);
  await bot.handle(text("yes"));
  assert.deepEqual(engine.myProfile.partnered_companies, ["Niva Bupa Health Insurance", "Care Health Insurance"]);
  await bot.handle(text("undo"));
  await bot.handle(text("yes"));
  assert.deepEqual(engine.myProfile.partnered_companies, ["Care Health Insurance"]);
  await bot.handle(text("my profile"));
  assert.match(transport.last(), /change it in the portal: it is your login/);
});

test("team: an owner moves checks with one YES and can undo; never more than they have; members can't", async () => {
  const { bot, transport, engine } = makeBot();
  engine.teamData = { role: "owner", team: "Shah Advisors", members: [
    { id: "o1", name: "Deep Shah", is_owner: true, checks_left: 20, entry_left: 5 },
    { id: "m1", name: "Ravi Kumar", is_owner: false, checks_left: 2, entry_left: 1 },
  ] };
  await bot.handle(text("my team"));
  assert.match(transport.last(), /Ravi Kumar: 2 checks, 1 data entry left/);
  await bot.handle(text("give Ravi 50 checks"));
  assert.match(transport.last(), /You have only 20 checks left/);
  await bot.handle(text("give Ravi 10 checks"));
  assert.match(transport.last(), /Move 10 policy checks from you to \*Ravi Kumar\*\. You will have 10 left/);
  await bot.handle(text("yes"));
  assert.equal(engine.teamData.members[1].checks_left, 12);
  await bot.handle(text("undo"));
  await bot.handle(text("yes"));
  assert.equal(engine.teamData.members[1].checks_left, 2);
  engine.teamData = { role: "member", team: "Shah Advisors", owner: "Deep Shah", reads: { n: 3, last: "2026-10-20" } };
  await bot.handle(text("give Ravi 10 checks"));
  assert.match(transport.last(), /Only the team owner can move checks/);
  await bot.handle(text("who opened my book"));
  assert.match(transport.last(), /Deep Shah opened your book 3 times/);
});
