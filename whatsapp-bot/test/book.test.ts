/** Stage 1: read-only views of the book, end to end through the bot with the backend's real
 *  rules (bookViews.ts) over made-up rows. ALL NAMES AND NUMBERS ARE MADE UP. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeBot, text, healthClient } from "./fakes.js";
import { ruleIntent } from "../src/core/intents.js";
import { localise } from "../src/core/i18n.js";
import { queueReply, bookReply, portfolioReply, valuesReply, insightsReply, pageStatsReply, claimDetailLines } from "../src/core/bookReplies.js";

const L = { origin: "https://indsure.in" };
const NOW = Date.UTC(2026, 9, 21, 6);
const inDays = (n: number) => new Date(NOW + n * 86_400_000).toISOString().slice(0, 10);

test("routing: each new question finds its answer; old commands are unchanged", () => {
  const cases: [string, string | null][] = [
    ["what failed?", "queue"], ["failed checks", "queue"], ["my queue", "queue"], ["kya fail hua", "queue"],
    ["is Ramesh's policy done?", "status"], ["has Sunita's report finished", "status"], ["Ramesh ki policy ho gayi?", "status"],
    ["which policies should switch?", "book"], ["weak policies", "book"], ["healthy policies", "book"], ["lowest scores", "book"],
    ["Sunita's portfolio", "portfolio"], ["is Sunita covered enough?", "portfolio"], ["cover gap for Sunita", "portfolio"], ["Sunita ka portfolio", "portfolio"],
    ["surrender values", "values"], ["all surrender values", "values"],
    ["how is my book?", "insights"], ["insights", "insights"], ["mera business kaisa hai", "insights"],
    ["how many people saw my page?", "pagestats"], ["page stats", "pagestats"],
    // unchanged
    ["surrender value Ramesh", "surrender"], ["my clients", "clients"], ["my book", "clients"], ["renewals", "renewals"],
    ["claims", "claims"], ["find Ramesh", "lookup"], ["my portfolio", null],
  ];
  for (const [t, want] of cases) assert.equal(ruleIntent(t), want, t);
});

test("what failed: failed checks with the reason, running ones, the queue link", async () => {
  const { bot, transport, engine } = makeBot();
  engine.queueRows = [
    { id: "a", name: "Ramesh Kumar", status: "error", error_message: "the PDF is password-protected", created_at: "x" },
    { id: "b", name: "Sunita Rao", status: "processing", error_message: null, created_at: "y" },
  ];
  await bot.handle(text("what failed?"));
  const r = transport.last();
  assert.match(r, /1 check could not finish/);
  assert.match(r, /Ramesh Kumar\* · the PDF is password-protected/);
  assert.match(r, /Still being checked: Sunita Rao/);
  assert.match(r, /\/agent\/my-queue/);
  engine.queueRows = [];
  await bot.handle(text("failed checks"));
  assert.match(transport.last(), /Nothing failed/);
});

test("is Ramesh's policy done: ready, running or failed, by name", async () => {
  const { bot, transport, engine } = makeBot();
  const id = "11111111-2222-4333-8444-555555555555";
  engine.clients.set(id, healthClient(id, { status: "processing" }));
  await bot.handle(text("is Ramesh's policy done?"));
  assert.match(transport.last(), /still being checked/);
  engine.clients.set(id, healthClient(id, { status: "done" }));
  await bot.handle(text("Ramesh ki policy ho gayi?"));
  assert.match(transport.last(), /ready/i);
  await bot.handle(text("is Zubin's policy done?"));
  assert.match(transport.last(), /"zubin" ki koi policy nahi mili/, "replies in the Hinglish the advisor just used");
});

test("should switch: health under 70 only, lowest first; a motor 18 is never listed", async () => {
  const { bot, transport, engine } = makeBot();
  const row = (o: any) => ({ id: o.name, name: o.name, insurance_type: o.type ?? "health", insurer: "Care", policy_name: "Supreme", score: o.score, expiry_date: o.exp ?? null });
  engine.bookRows = [row({ name: "Asha", score: 61 }), row({ name: "Bina", score: 48, exp: inDays(9) }), row({ name: "Car Co", type: "motor", score: 18 }), row({ name: "Dev", score: 85 })];
  engine.now = NOW;
  await bot.handle(text("which policies should switch?"));
  const r = transport.last();
  assert.match(r, /Should switch \(health score under 70\): 2/);
  assert.ok(r.indexOf("Bina") < r.indexOf("Asha"), "lowest score first");
  assert.match(r, /score 48 · 9d left/);
  assert.doesNotMatch(r, /Car Co/);
  await bot.handle(text("healthy policies"));
  assert.match(transport.last(), /Healthy \(health score 70 or more\): 1/);
  engine.bookRows = [];
  await bot.handle(text("weak policies"));
  assert.match(transport.last(), /none right now/);
});

test("portfolio: cover, next premium and the gap against the saved calculator", async () => {
  const { bot, transport, engine } = makeBot();
  engine.now = NOW;
  engine.customerRows = [{ id: "c1", name: "Sunita Rao", phone: null, city: "Pune" }, { id: "c2", name: "Sunil Mehta", phone: null, city: null }];
  engine.portfolioPolicies.set("c1", [
    { id: "p1", name: null, insurance_type: "health", insurer: "Care", policy_name: "Supreme", sum_insured: "10 lakh", expiry_date: inDays(30), score: 62, extracted_data: null, coverage: null },
  ]);
  engine.calcFor.set("c1", { result_data: { coverageBreakdown: { finalOptimal: 2500000 } } });
  await bot.handle(text("is Sunita covered enough?"));
  const r = transport.last();
  assert.match(r, /Sunita Rao\*: 1 policy/);
  assert.match(r, /Health cover: ₹10,00,000 of ₹25,00,000 recommended/);
  assert.match(r, /Gap: ₹15,00,000 short/);
  assert.match(r, /\/agent\/customers\/c1/);
  await bot.handle(text("Suni portfolio"));
  assert.match(transport.last(), /More than one customer matches/);
  engine.calcFor.clear();
  await bot.handle(text("Sunita Rao portfolio"));
  assert.match(transport.last(), /No calculator saved for this customer, so no gap to show/);
});

test("surrender values across the book: the portal's own book code, totals kept apart", async () => {
  const { bot, transport, engine } = makeBot();
  engine.valueRows = [
    { id: "v1", policyholder_name: "Gupta", insurer: "LIC", policy_name: "Jeevan Anand", insurance_type: "life", status: "done", extracted_data: {} },
    { id: "v2", policyholder_name: "Mehta", insurer: "HDFC Life", policy_name: "Click 2 Protect", insurance_type: "term", status: "done", extracted_data: { plan_type: "term" } },
  ];
  await bot.handle(text("surrender values"));
  const r = transport.last();
  assert.match(r, /Surrender values: 2 life and term policies/);
  assert.match(r, /Insurer quotes you entered: Not available/);
  assert.match(r, /Next: /);
  assert.match(r, /Confirm with the insurer before acting/);
  assert.match(r, /\/agent\/values/);
  engine.valueRows = [];
  await bot.handle(text("surrender values"));
  assert.match(transport.last(), /No life or term policies yet/);
});

test("one claim by name: stage, missing documents with no long dash, document clock, access logged", async () => {
  const { bot, transport, engine } = makeBot();
  engine.claimRows = [{ id: "cl1", status: "query_raised", claim_type: "cashless", insurer: "Care", hospital: "Apollo", ailment: "fracture", claimed_amount: 185000, settled_amount: null, admitted_on: null, customer_name: "Sunita Rao", openQueries: [] }] as any;
  engine.claimDetails.set("cl1", {
    claim: { id: "cl1", status: "query_raised", claim_type: "cashless", customer_name: "Sunita Rao", claimed_amount: 185000, days_to_purge: 12 },
    docs: [{ category: "case", doc_type: "Final bill" }], queries: [], events: [],
  });
  await bot.handle(text("where is Sunita's claim?"));
  const r = transport.lastRaw();
  assert.match(r, /Status: Query \(cashless\)/);
  assert.doesNotMatch(r, /Stage:/, "one status line, not two");
  assert.match(r, /Still missing \(10\):/);
  assert.match(r, /Aadhaar, patient/);
  assert.doesNotMatch(r, /\u2014/);
  assert.doesNotMatch(r, /• Final bill/);
  assert.match(r, /deleted in 12 days/);
  assert.deepEqual(engine.claimViews, ["cl1"]);
  await bot.handle(text("Sunita ka claim kahan tak pahuncha"));
  assert.match(transport.last(), /Status: Query/);
});

test("how is my book: the Insights numbers", async () => {
  const { bot, transport, engine } = makeBot();
  engine.now = NOW;
  engine.people = 2;
  engine.insightRows = [
    { insurance_type: "health", expiry_date: inDays(12), score: 60 },
    { insurance_type: "health", expiry_date: inDays(-4), score: 80 },
    { insurance_type: "motor", expiry_date: inDays(70), score: 20 },
  ];
  await bot.handle(text("how is my book?"));
  const r = transport.last();
  assert.match(r, /Your book: 3 policies · 2 customers/);
  assert.match(r, /Renewing in 30 days: 1/);
  assert.match(r, /Expired: 1/);
  assert.match(r, /Health score average: 70 \(2 policies\), 1 under 70/);
  assert.match(r, /By type: Health 2, Motor 1/);
});

test("page stats: visits, leads, where they came from; no page yet says so", async () => {
  const { bot, transport, engine } = makeBot();
  await bot.handle(text("how many people saw my page?"));
  assert.match(transport.last(), /don't have a page yet/);
  engine.pageRow = { slug: "deep-shah" };
  engine.pageViewRows = [{ utm_source: "whatsapp", app: "whatsapp", device: "mobile", views: 9 }, { utm_source: null, app: "browser", device: "desktop", views: 1 }];
  engine.pageLeads = 3;
  await bot.handle(text("page stats"));
  const r = transport.last();
  assert.match(r, /last 30 days: 10 visits/);
  assert.match(r, /Leads from your page so far: 3/);
  assert.match(r, /Came from: Whatsapp 9, Direct link 1/);
  assert.match(r, /Device: Phone 9, Computer 1/);
});

test("find: a lead with a phone gets a tap-to-chat WhatsApp link", async () => {
  const { bot, transport, engine } = makeBot();
  engine.leadRows = [{ id: "l1", name: "Amit Shah", phone: "9812345678", status: "new", insurance_interest: null, next_follow_up: null, notes: null }];
  await bot.handle(text("Amit's number"));
  assert.match(transport.last(), /WhatsApp: https:\/\/wa\.me\/919812345678/);
});

test("every new fixed line has Hindi and Hinglish", () => {
  const samples = [
    queueReply(L, { failed: [{ clientId: "a", name: "R", error: "x", createdAt: "" }], processing: [{ clientId: "b", name: "S", error: null, createdAt: "" }] }),
    queueReply(L, { failed: [], processing: [] }),
    bookReply(L, "switch", "score", { counts: { total: 1, expiringSoon: 0, shouldSwitch: 0, healthy: 0 }, matched: 0, rows: [] }),
    portfolioReply(L, "x", { matches: [{ id: "c", name: "Sunita", phone: null, city: null }], customer: { id: "c", name: "Sunita" }, portfolio: { policyCount: 1, byType: { health: 1 }, totalCover: 500000, healthCover: 500000, totalPremium: 1000, nextPremium: { date: "2026-11-01", name: "Supreme", clientId: "p" }, shouldSwitch: 1, recommended: 900000, gap: 400000, policies: [] } }),
    valuesReply(L, [{ id: "v", policyholder_name: "G", insurance_type: "life", status: "done", extracted_data: {} }]),
    claimDetailLines({ id: "c", customerName: null, claimType: "cashless", status: "opened", stage: "Claim opened", daysToPurge: 5, purgedOn: null, canExtend: true, documentCount: 0, missing: ["PAN card"], openQueries: [] }).join("\n"),
    insightsReply(L, { total: 2, renewing30: 1, expired: 0, unknownExpiry: 1, people: 1, byType: [{ type: "health", count: 2 }], renewalsByMonth: [{ label: "Oct 2026", count: 1 }], scoredHealth: 1, avgHealthScore: 60, weakHealth: 1 }),
    pageStatsReply(L, { page: { slug: "x" }, stats: { totalViews: 3, leads: 1, bySource: [{ label: "Direct link", views: 3 }], byApp: [{ label: "Web browser", views: 3 }], byDevice: [{ label: "Phone", views: 3 }] } }),
    pageStatsReply(L, { page: null }),
  ];
  // Lines that are data or links, the same in every language.
  const same = (l: string) => !l.trim() || /^https?:\/\//.test(l) || /^\d+\) /.test(l) || /^• /.test(l) || /^…/.test(l) === false && /^[A-Z][a-z]+ [A-Z]?\S* ?·/.test(l);
  const missing: string[] = [];
  for (const lang of ["hindi", "hinglish"] as const) {
    for (const s of samples) {
      const out = localise(s, lang).split("\n");
      s.split("\n").forEach((line, i) => { if (!same(line) && out[i] === line && !/^👤 .*: 1 policy$|^Stage: |^📋 Surrender values: |^Device: /.test(line)) missing.push(`${lang}: ${line}`); });
    }
  }
  assert.deepEqual(missing, []);
});

/* ── The critic's findings: each one must stay fixed ── */

test("critic: a Postgres date (a JS Date) in a portfolio never crashes it", async () => {
  const { bot, transport, engine } = makeBot();
  engine.now = NOW;
  engine.customerRows = [{ id: "c1", name: "Sunita Rao", phone: null, city: null }];
  engine.portfolioPolicies.set("c1", [
    { id: "p1", name: null, insurance_type: "health", insurer: "Care", policy_name: "Supreme", sum_insured: 500000, expiry_date: new Date(2026, 11, 5), score: 75, extracted_data: null, coverage: null },
  ]);
  await bot.handle(text("Sunita portfolio"));
  assert.match(transport.last(), /Next premium: 5 Dec 2026 \(Supreme\)/);
});

test("critic: raw pipeline errors never reach the advisor, only a plain reason", async () => {
  const { bot, transport, engine } = makeBot();
  engine.queueRows = [{ id: "a", name: "Ramesh", status: "error", error_message: "[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/x gemini-3.1-pro-preview [429]", created_at: "x" }];
  await bot.handle(text("what failed?"));
  const r = transport.last();
  assert.doesNotMatch(r, /Google|gemini|googleapis|\bAI\b|429/);
  assert.match(r, /something in the file stopped me/);
});

test("critic: the extension is offered only when the portal allows it; purged paperwork is said plainly", () => {
  const base = { id: "c", customerName: null, claimType: "cashless", status: "submitted", stage: "", daysToPurge: 20, purgedOn: null, canExtend: false, documentCount: 0, missing: [], openQueries: [] };
  assert.doesNotMatch(claimDetailLines(base).join("\n"), /extend/);
  assert.match(claimDetailLines({ ...base, daysToPurge: 3, canExtend: true }).join("\n"), /extend this once, by 30 days/);
  const gone = claimDetailLines({ ...base, daysToPurge: null, purgedOn: "2026-09-30", missing: [] }).join("\n");
  assert.match(gone, /deleted on 2026-09-30/);
  assert.doesNotMatch(gone, /missing|deleted in/i);
});

test("critic: names are read right, and 'my' is never a customer", () => {
  assert.equal(ruleIntent("Ramesh ka portfolio"), "portfolio");
  assert.equal(ruleIntent("how is my portfolio"), "insights");
  assert.equal(ruleIntent("is my policy done?"), null);
  assert.equal(ruleIntent("has the report ready"), null);
});

test("critic: 'wants to switch' about a lead is never the should-switch list", () => {
  for (const t of ["Ramesh wants to switch to Niva", "Neha has bad policies, wants to switch", "Ramesh is looking for good policies, call friday"]) {
    assert.notEqual(ruleIntent(t), "book", t);
  }
  for (const t of ["which policies should switch?", "policies to switch", "show my weak policies", "konsi policy switch karni hai"]) {
    assert.equal(ruleIntent(t), "book", t);
  }
});

test("critic: 'what's pending for today' is not a claim search", async () => {
  const { bot, transport } = makeBot();
  await bot.handle(text("what's pending for today"));
  assert.doesNotMatch(transport.last(), /No claims matching/);
});

test("critic: paid advisors get the view for a long question too, without spending a smart reply", async () => {
  const { bot, transport, engine } = makeBot();
  engine.modelOn = true;
  engine.pageRow = { slug: "deep-shah" };
  engine.pageViewRows = [{ utm_source: "whatsapp", app: "whatsapp", device: "mobile", views: 2 }];
  const before = engine.understandCalls.length;
  await bot.handle(text("how many people visited my website"));
  assert.equal(engine.understandCalls.length, before);
  assert.match(transport.last(), /last 30 days: 2 visits/);
});

test("critic: an exact customer name wins over a longer one ('Ram' next to 'Ramesh')", async () => {
  const { bot, transport, engine } = makeBot();
  engine.customerRows = [{ id: "c1", name: "Ram", phone: null, city: null }, { id: "c2", name: "Ramesh", phone: null, city: null }];
  await bot.handle(text("Ram portfolio"));
  assert.match(transport.last(), /\*Ram\*: 0 policies/);
});

test("critic: 'lowest health scores' counts only scored health policies", async () => {
  const { bot, transport, engine } = makeBot();
  engine.bookRows = [
    { id: "a", name: "A", insurance_type: "health", insurer: null, policy_name: null, score: 50, expiry_date: null },
    { id: "b", name: "B", insurance_type: "motor", insurer: null, policy_name: null, score: 18, expiry_date: null },
    { id: "c", name: "C", insurance_type: "health", insurer: null, policy_name: null, score: null, expiry_date: null },
  ];
  await bot.handle(text("lowest scores"));
  assert.match(transport.last(), /Lowest health scores first: 1/);
});
