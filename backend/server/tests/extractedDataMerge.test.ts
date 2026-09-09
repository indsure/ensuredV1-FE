/**
 * extracted_data save-merge tests.
 *
 * NO NETWORK, NO DB. Pure function assertions.
 *
 * Why this file exists: PATCH /api/agent/clients/:id/extracted-data wrote the
 * request body over the column wholesale, and the review form
 * (ExtractedDataForm.tsx) builds its body from the non-`json` fields only,
 * because a text input would stringify an object and destroy it. So the first
 * time an agent corrected a typo on a life or term policy, `policy_parameters`
 * was deleted: the policy-value chart reads that blob, so the chart went blank
 * with no error raised anywhere. The form never sent the key, so no code path
 * looked wrong.
 *
 * The endpoint now merges. These tests pin the three properties that fix
 * depends on, so a future "simplify" back to a spread of the patch alone fails
 * here instead of silently eating a customer's policy data again.
 *
 * Run:  npx tsx --test backend/server/tests/extractedDataMerge.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { mergeExtractedData, deriveSharedColumns } from "../services/extractionFields";

describe("mergeExtractedData", () => {
    test("keeps keys the patch does not mention (the life/term data-loss case)", () => {
        const stored = {
            plan_name: "Sampoorn Nivesh",
            sum_assured: 1000000,
            policy_parameters: { allocation_charge_pct: 6, mortality_per_1000: 1.2 },
        };
        // Exactly what ExtractedDataForm posts: every field except the `json` one.
        const patch = { plan_name: "Sampoorn Nivesh Plus", sum_assured: 1000000 };

        const merged = mergeExtractedData(stored, patch);

        assert.deepEqual(
            merged.policy_parameters,
            stored.policy_parameters,
            "the json blob the value chart reads must survive a form save"
        );
        assert.equal(merged.plan_name, "Sampoorn Nivesh Plus");
    });

    test("an explicit null in the patch clears the field", () => {
        // The form sends null for a box the agent emptied. That must still clear,
        // or a merge would make fields uneditable-to-blank.
        const merged = mergeExtractedData({ ncb_percent: 25 }, { ncb_percent: null });
        assert.equal(merged.ncb_percent, null);
        assert.ok("ncb_percent" in merged);
    });

    test("no stored blob yet", () => {
        assert.deepEqual(mergeExtractedData(null, { idv: 450000 }), { idv: 450000 });
        assert.deepEqual(mergeExtractedData(undefined, { idv: 450000 }), { idv: 450000 });
    });

    test("does not mutate either input", () => {
        const stored = { a: 1 };
        const patch = { b: 2 };
        mergeExtractedData(stored, patch);
        assert.deepEqual(stored, { a: 1 });
        assert.deepEqual(patch, { b: 2 });
    });
});

describe("shared columns are derived from the merged blob", () => {
    test("a partial save does not null the columns it omits", () => {
        // The value card posts only value keys. Deriving shared columns from
        // that patch alone would write NULL over insurer / policy_name /
        // expiry_date / sum_insured on a motor row.
        const stored = {
            insurer: "ICICI Lombard",
            plan_name: "Private Car Package",
            policy_expiry_date: "2027-03-14",
            idv: 450000,
        };
        const patch = { premium: 8400 };

        const fromPatchOnly = deriveSharedColumns("motor", patch);
        assert.equal(fromPatchOnly.insurer, undefined, "patch alone carries no insurer");

        const fromMerged = deriveSharedColumns("motor", mergeExtractedData(stored, patch));
        assert.equal(fromMerged.insurer, "ICICI Lombard");
        assert.equal(fromMerged.policy_name, "Private Car Package");
        assert.equal(fromMerged.expiry_date, "2027-03-14");
        assert.equal(fromMerged.sum_insured, 450000);
    });
});
