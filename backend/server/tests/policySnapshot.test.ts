/**
 * The summary card's numbers, from the synthetic Click 2 Achieve fixture read by
 * the real reader, against hand-worked values:
 *   premiums 2,00,000 a year from 4 Mar 2024 for 7 years; 3,380 a month from
 *   4 Apr 2024 to 4 Mar 2039; final payout 14,00,000; death cover 20,00,000.
 */
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parsePolicyDocument } from "../services/policyDocs/index";
import { policySnapshot, type SnapshotFieldRow } from "../../../shared/policySnapshot";
import type { ReviewFlag } from "../../../shared/policyDocTypes";

const here = path.dirname(fileURLToPath(import.meta.url));
let fields: SnapshotFieldRow[];
let flags: ReviewFlag[];

before(async () => {
  const r = await parsePolicyDocument(fs.readFileSync(path.join(here, "fixtures/policyDocs/c2a-digital.pdf")), {} as any);
  flags = r.outcome.flags;
  fields = Object.entries(r.outcome.fields).map(([k, f]) => ({ field_key: k, revision: 1, state: "document_pending", document_field: f, corrected_value: null }));
});

describe("policy snapshot (all premiums paid on due dates)", () => {
  test("figures as on 1 Oct 2026, before any review, using the illustration method", () => {
    const s = policySnapshot(fields, flags, {}, "2026-10-01");
    assert.equal(s.premium.paidCount, 3);
    assert.deepEqual(s.premium.paidSoFar, { paise: 60000000 });
    assert.deepEqual(s.premium.totalPayable, { paise: 140000000 });
    assert.equal(s.premium.excludesTaxes, true);
    assert.deepEqual(s.gsvToday, { paise: 12888000 });
    assert.deepEqual(s.nextDue, { date: "2027-03-04", gsv: { paise: 27832000 } });
    assert.equal(s.regularPayout?.count, 180);
    assert.deepEqual(s.totalReceived, { paise: 200840000 });
    assert.deepEqual(s.gainOverPremiums, { paise: 60840000 });
    assert.deepEqual(s.lifeCover, { paise: 200000000 });
    assert.equal(s.atEnd.maturityNotApplicable, true);
    assert.deepEqual(s.atEnd.finalPayout, { paise: 140000000 });
    assert.equal(s.usedIllustrationMethod, true);
  });

  test("the advisor's answer replaces the illustration method", () => {
    // Every payout up to the surrender day: 1 Oct 2026 adds Apr to Sep 2026 (6 more).
    const s = policySnapshot(fields, flags, { survival_benefit_deduction_timing: "payouts_made_by_surrender_date", gsv_factor_rounding_not_stated: "exact_as_printed" }, "2026-10-01");
    assert.deepEqual(s.gsvToday, { paise: 12888000 - 6 * 338000 });
    assert.equal(s.usedIllustrationMethod, false);
  });

  test("before two years' premiums there is no GSV yet (zero, not missing)", () => {
    const s = policySnapshot(fields, flags, {}, "2024-09-01");
    assert.equal(s.premium.paidCount, 1);
    assert.deepEqual(s.gsvToday, { paise: 0 });
  });

  test("a correction is used and a rejected value is not", () => {
    const corrected = fields.map((f) => f.field_key === "schedule.sum_assured_on_death" ? { ...f, state: "corrected", corrected_value: { paise: 250000000 } } : f);
    assert.deepEqual(policySnapshot(corrected, flags, {}, "2026-10-01").lifeCover, { paise: 250000000 });
    const rejected = fields.map((f) => f.field_key === "schedule.sum_assured_on_death" ? { ...f, state: "rejected" } : f);
    assert.equal(policySnapshot(rejected, flags, {}, "2026-10-01").lifeCover, null);
  });
});
