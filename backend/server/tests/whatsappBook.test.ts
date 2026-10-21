import { test } from "node:test";
import assert from "node:assert/strict";
import {
  claimView, daysUntil, insightsView, pageStatsView, parseAmount, policyView, portfolioView, queueView, PERSONAL_DOCS,
} from "../whatsapp/bookViews";

const NOW = Date.UTC(2026, 9, 21, 6); // 21 Oct 2026
const inDays = (n: number) => new Date(NOW + n * 86_400_000).toISOString().slice(0, 10);

test("daysUntil and parseAmount match the portal helpers", () => {
  assert.equal(daysUntil(null, NOW), null);
  assert.equal(daysUntil("not a date", NOW), null);
  assert.equal(daysUntil(inDays(10), NOW), 10);
  assert.equal(parseAmount("5 lakh"), 500000);
  assert.equal(parseAmount("1.2 crore"), 12000000);
  assert.equal(parseAmount("5,00,000"), 500000);
  assert.equal(parseAmount(null), null);
});

test("queue: failed and running checks, split like My Queue", () => {
  const v = queueView([
    { id: "a", name: "Ramesh", status: "error", error_message: "password protected", created_at: "x" },
    { id: "b", name: "Sunita", status: "processing", error_message: null, created_at: "y" },
    { id: "c", name: null, status: "pending", error_message: null, created_at: "z" },
  ]);
  assert.deepEqual(v.failed.map((r) => [r.name, r.error]), [["Ramesh", "password protected"]]);
  assert.deepEqual(v.processing.map((r) => r.clientId), ["b", "c"]);
});

const row = (o: any) => ({ id: o.id ?? Math.random().toString(36).slice(2), name: o.name ?? "X", insurance_type: o.type ?? "health", insurer: null, policy_name: null, score: o.score ?? null, expiry_date: o.expiry ?? null });

test("policy tabs: should switch and healthy are health only; expiring is 0 to 30 days", () => {
  const rows = [
    row({ name: "A", score: 55, expiry: inDays(5) }),
    row({ name: "B", score: 82, expiry: inDays(60) }),
    row({ name: "C", type: "motor", score: 18, expiry: inDays(20) }),
    row({ name: "D", score: null, expiry: inDays(-3) }),
  ];
  const all = policyView(rows, "all", "expiry", NOW);
  assert.deepEqual(all.counts, { total: 4, expiringSoon: 2, shouldSwitch: 1, healthy: 1 });
  assert.deepEqual(policyView(rows, "switch", "expiry", NOW).rows.map((r) => r.name), ["A"], "a motor 18 is never 'switch'");
  assert.deepEqual(policyView(rows, "expiring", "expiry", NOW).rows.map((r) => r.name), ["A", "C"]);
  assert.deepEqual(policyView(rows, "all", "score", NOW).rows.map((r) => r.name).slice(0, 2), ["A", "B"], "health scores ranked, lowest first; motor 18 never 'worst'");
  assert.equal(policyView(rows, "all", "score", NOW).rows.find((r) => r.name === "C")!.score, null, "motor score not shown as a health score");
  assert.deepEqual(policyView(rows, "all", "name", NOW).rows.map((r) => r.name), ["A", "B", "C", "D"]);
  assert.deepEqual(policyView(rows, "all", "expiry", NOW, "motor").rows.map((r) => r.name), ["C"]);
});

test("portfolio: total cover, health cover gap against the latest calculator, next premium", () => {
  const pols = [
    { id: "p1", name: null, insurance_type: "health", insurer: "Care", policy_name: "Care Supreme", sum_insured: "5 lakh", expiry_date: inDays(40), score: 62, extracted_data: null, coverage: null },
    { id: "p2", name: null, insurance_type: "life", insurer: "LIC", policy_name: "Jeevan Anand", sum_insured: 1000000, expiry_date: null, score: null, extracted_data: { premium: "25,000", next_premium_date: inDays(12) }, coverage: null },
  ];
  const v = portfolioView(pols as any, { result_data: { coverageBreakdown: { finalOptimal: 2500000 } } }, NOW);
  assert.equal(v.policyCount, 2);
  assert.equal(v.totalCover, 1500000);
  assert.equal(v.healthCover, 500000);
  assert.equal(v.recommended, 2500000);
  assert.equal(v.gap, 2000000);
  assert.equal(v.totalPremium, 25000);
  assert.deepEqual(v.nextPremium, { date: inDays(12), name: "Jeevan Anand", clientId: "p2" });
  assert.equal(v.shouldSwitch, 1);
  assert.equal(portfolioView(pols as any, null, NOW).gap, null, "no calculator, no gap claimed");
});

test("claim: stage, open queries and missing checklist documents; none missing once closed", () => {
  const claim = { id: "c1", status: "query_raised", claim_type: "cashless", customer_name: "Sunita", claimed_amount: "185000", settled_amount: null, days_to_purge: 12 };
  const docs = [{ category: "personal", doc_type: PERSONAL_DOCS[0] }, { category: "case", doc_type: "Final bill" }, { category: "case", doc_type: null }];
  const v = claimView(claim, docs, [{ seq: 1, question: "Discharge summary", raised_on: "2026-10-10", resolved_on: null }, { seq: 2, question: "old", raised_on: null, resolved_on: "2026-10-01" }], []);
  assert.equal(v.stage, "Insurer query open");
  assert.equal(v.claimedAmount, 185000);
  assert.ok(!v.missing.includes(PERSONAL_DOCS[0]));
  assert.ok(!v.missing.includes("Final bill"));
  assert.ok(v.missing.includes("Discharge summary"));
  assert.equal(v.missing.length, 4 + 5);
  assert.deepEqual(v.openQueries.map((q) => q.seq), [1]);
  assert.deepEqual(claimView({ ...claim, status: "settled" }, [], [], []).missing, []);
});

test("insights: renewing in 30 days, expired, months ahead, health-only average", () => {
  const v = insightsView([
    { insurance_type: "health", expiry_date: inDays(10), score: 60 },
    { insurance_type: "health", expiry_date: inDays(-5), score: 80 },
    { insurance_type: "motor", expiry_date: inDays(45), score: 20 },
    { insurance_type: "life", expiry_date: null, score: null },
  ], 3, NOW);
  assert.equal(v.total, 4);
  assert.equal(v.renewing30, 1);
  assert.equal(v.expired, 1);
  assert.equal(v.unknownExpiry, 1);
  assert.equal(v.people, 3);
  assert.equal(v.avgHealthScore, 70, "motor 20 is not in the health average");
  assert.equal(v.weakHealth, 1);
  assert.equal(v.renewalsByMonth.reduce((n, m) => n + m.count, 0), 2, "an expired policy is not 'due' this month");
  assert.equal(v.renewalsByMonth[0].label, "Oct 2026");
});

test("page stats: totals, best source, app and device with plain labels", () => {
  const v = pageStatsView([
    { utm_source: "whatsapp", app: "whatsapp", device: "mobile", views: 7 },
    { utm_source: null, app: "browser", device: "desktop", views: 2 },
    { utm_source: "instagram", app: "instagram", device: "mobile", views: 3 },
  ], 4);
  assert.equal(v.totalViews, 12);
  assert.equal(v.leads, 4);
  assert.deepEqual(v.bySource[0], { label: "Whatsapp", views: 7 });
  assert.equal(v.bySource.find((s) => s.label === "Direct link")?.views, 2);
  assert.deepEqual(v.byDevice[0], { label: "Phone", views: 10 });
});
