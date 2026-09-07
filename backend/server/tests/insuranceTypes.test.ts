/**
 * Insurance-type registry tests.
 *
 * NO NETWORK, NO DB. These are pure list/config assertions.
 *
 * Why this file exists: on 2026-09-07 an agent uploaded Marinepolicy.pdf, chose
 * the "Marine" button the upload page offered, and got back "Document does not
 * appear to be a readable health insurance policy" against a policy-check
 * credit. The upload page drove its buttons off TYPE_META (nine types) while
 * /api/agent/analyze validated against a hand-written set of four and silently
 * fell back to "health" for everything else. Two lists, no wire between them.
 *
 * The first test is that wire. It reads the frontend registry as text (the
 * backend cannot import across the app boundary) and asserts the two lists are
 * identical, so adding a line of business to one file and not the other fails
 * here instead of in production.
 *
 * Run:  npx tsx --test backend/server/tests/insuranceTypes.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
    DATA_ENTRY_TYPES,
    SUPPORTED_INSURANCE_TYPES,
    isSupportedInsuranceType,
    isDataEntryType,
    EXTRACTION_FIELDS,
} from "../services/extractionFields";
import { AI_CONFIG } from "../config/ai_config";

/* tsx runs this file through its CJS transform, where import.meta.dirname is
   undefined but __dirname is real. Take whichever the runtime actually has. */
const HERE: string =
    typeof __dirname !== "undefined" ? __dirname : (import.meta as any).dirname;

const FRONTEND_REGISTRY = join(
    HERE,
    "..", "..", "..",
    "frontend", "client", "src", "lib", "insuranceTypes.ts",
);

/** Pull the keys of the TYPE_META object literal out of the frontend source. */
function frontendTypeMetaKeys(): string[] {
    const src = readFileSync(FRONTEND_REGISTRY, "utf8");
    const start = src.indexOf("export const TYPE_META");
    assert.notEqual(start, -1, "TYPE_META not found in the frontend registry");
    const open = src.indexOf("{", start);
    const close = src.indexOf("\n};", open);
    assert.ok(close > open, "could not find the end of the TYPE_META literal");
    const body = src.slice(open, close);
    return [...body.matchAll(/^\s{2}([a-z_]+)\s*:/gm)].map((m) => m[1]);
}

describe("the backend and frontend type registries agree", () => {
    test("TYPE_META offers exactly what the API accepts", () => {
        // If this fails, someone added a line of business to one side only.
        // The upload button would exist and the upload would be refused.
        assert.deepEqual(
            frontendTypeMetaKeys().slice().sort(),
            [...SUPPORTED_INSURANCE_TYPES].slice().sort(),
        );
    });
});

describe("SUPPORTED_INSURANCE_TYPES", () => {
    test("is health plus every data-entry lane, and nothing else", () => {
        assert.deepEqual(
            [...SUPPORTED_INSURANCE_TYPES],
            ["health", ...DATA_ENTRY_TYPES],
        );
    });

    test("accepts the five types the old four-item whitelist dropped", () => {
        // These are the ones that silently became "health" and got billed as a
        // forensic audit. Named explicitly so a future edit has to mean it.
        for (const type of ["travel", "property", "fire", "marine", "contractor_all_risk"]) {
            assert.ok(isSupportedInsuranceType(type), `${type} must be accepted`);
            assert.ok(isDataEntryType(type), `${type} must route to data entry, not the audit`);
        }
    });

    test("health is supported but is NOT a data-entry lane", () => {
        assert.ok(isSupportedInsuranceType("health"));
        assert.equal(isDataEntryType("health"), false);
    });

    test("rejects unknown and legacy type strings", () => {
        // "vehicle" is the legacy name an older client sent for "motor". It must
        // be refused, not silently mapped, so the caller learns it is stale.
        for (const type of ["vehicle", "", "HEALTH", "pet", "__proto__"]) {
            assert.equal(isSupportedInsuranceType(type), false, `${type} must be rejected`);
        }
    });

    test("every data-entry type has fields to extract into", () => {
        for (const type of DATA_ENTRY_TYPES) {
            assert.ok(EXTRACTION_FIELDS[type]?.length > 0, `${type} has no extraction fields`);
        }
    });
});

describe("the Gemini output ceiling leaves room to think", () => {
    test("is above the largest known-good visible+thinking total", () => {
        // 2026-08-31 set this to 8,192 by comparing against visible output
        // alone (4,411 tokens). On a thinking model the ceiling covers the
        // reasoning trace too, and a real successful audit measured
        // ~3,339 visible + ~8,494 thinking = ~11,833. Every audit after that
        // commit died at MAX_TOKENS with the JSON cut mid-object.
        const LARGEST_KNOWN_GOOD_TOTAL = 11_833;
        assert.ok(
            AI_CONFIG.generation_config.max_output_tokens > LARGEST_KNOWN_GOOD_TOTAL,
            `output ceiling ${AI_CONFIG.generation_config.max_output_tokens} is at or below the ` +
            `largest audit that has actually succeeded (${LARGEST_KNOWN_GOOD_TOTAL} tokens incl. thinking)`,
        );
    });
});
