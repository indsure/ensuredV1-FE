/** The WhatsApp copy of effective cover (bookViews.ts) must give the portal's number
 *  (shared/policy.ts deriveCoverView). Runs in this repo only: the live server's older
 *  shared/policy.ts has no deriveCoverView, which is why bookViews carries a copy. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveCoverView } from "../../../shared/policy";
import { effectiveCoverOf } from "../whatsapp/bookViews";

const cases: any[] = [
  null,
  {},
  { base_sum_insured: 500000 },
  { base_sum_insured: 500000, total_effective_coverage: 700000 },
  { base_sum_insured: 500000, total_effective_coverage: 1000000, restoration: { exists: true } },
  { base_sum_insured: 500000, total_effective_coverage: 1000000, restoration: { exists: false } },
  { base_sum_insured: 500000, no_claim_bonus: { exists: true, current_bonus: 250000, cap_percentage: 100 } },
  { base_sum_insured: 500000, no_claim_bonus: { exists: true, current_bonus: 50, cap_percentage: 100 } },
  { base_sum_insured: 500000, no_claim_bonus: { exists: true, current_bonus: 900000, cap_percentage: 100 } },
  { base_sum_insured: 500000, no_claim_bonus: { exists: true, current_bonus: 200000, cap_percentage: 20 } },
  { base_sum_insured: 500000, super_top_up: { exists: true, deductible_achievable: true, sum_insured: 2000000 } },
  { base_sum_insured: 500000, super_top_up: { exists: true, deductible_achievable: false, sum_insured: 2000000 } },
  { base_sum_insured: 500000, top_up: { exists: true, deductible_achievable: true, sum_insured: 300000 }, total_effective_coverage: 400000 },
  { base_sum_insured: 0, total_effective_coverage: 800000 },
  { base_sum_insured: "500000" },
];

test("WhatsApp effective cover == the portal's deriveCoverView, case by case", () => {
  for (const cs of cases) {
    const want = deriveCoverView({ coverage_structure: cs } as any).effectiveCover;
    assert.equal(effectiveCoverOf(cs), want, JSON.stringify(cs));
  }
});
