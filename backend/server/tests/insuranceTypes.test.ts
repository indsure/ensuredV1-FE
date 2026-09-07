/**
 * Insurance-type registry tests.
 *
 * NO NETWORK, NO DB. These are pure list/config assertions.
 *
 * Why this file exists: the upload page drives its type buttons off TYPE_META
 * in the frontend registry, while the API decides what to do with the string
 * it receives from its own list in extractionFields.ts. Nothing tied the two
 * together, so a line of business could exist as a button and not as an
 * accepted value. On the beta backend that gap cost a real upload: an agent
 * picked "Marine", the API did not recognise the string, defaulted it to
 * health, and returned "Document does not appear to be a readable health
 * insurance policy" against a policy-check credit.
 *
 * The first test is the missing wire. It reads the frontend registry as text
 * (the backend cannot import across the app boundary) and asserts the two
 * lists are identical, so adding a type to one file and not the other fails
 * here instead of in front of an agent.
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
    const keys = [...body.matchAll(/^\s{2}([a-z_]+)\s*:/gm)].map((m) => m[1]);
    assert.ok(keys.length > 0, "parsed no keys out of TYPE_META — has its shape changed?");
    return keys;
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

    test("every data-entry type is accepted and stays out of the audit lane", () => {
        // The audit lane is the one that charges a policy-check credit and
        // returns a health verdict. Nothing on this list may fall into it.
        for (const type of DATA_ENTRY_TYPES) {
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
        // This model thinks, and the reasoning trace is billed against the same
        // ceiling as the answer while being reported separately. Sizing this
        // against the largest report ever emitted (4,411 tokens) measures the
        // wrong half: a real successful audit ran ~3,339 visible + ~8,494
        // thinking = ~11,833. Set the ceiling under that and the JSON comes
        // back cut mid-object.
        const LARGEST_KNOWN_GOOD_TOTAL = 11_833;
        assert.ok(
            AI_CONFIG.generation_config.max_output_tokens > LARGEST_KNOWN_GOOD_TOTAL,
            `output ceiling ${AI_CONFIG.generation_config.max_output_tokens} is at or below the ` +
            `largest audit that has actually succeeded (${LARGEST_KNOWN_GOOD_TOTAL} tokens incl. thinking)`,
        );
    });
});
