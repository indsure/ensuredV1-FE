/**
 * Insurer detection from policy text.
 *
 * NO NETWORK, NO DB, NO GEMINI. Pure string matching over sample text.
 *
 * Why this file exists: a real Future Generali policy came back attributed to
 * Go Digit, whose name appears nowhere in the document. Two faults compounded
 * in extractPolicyMetadata:
 *
 *   1. Matching was a bare substring test, so the key `digit` matched inside
 *      "digitally signed", which sits in the signature block of nearly every
 *      policy PDF issued in India.
 *   2. The loop took the FIRST entry in object key order and broke. `digit` was
 *      the last key, so it only fired when nothing else had, which quietly made
 *      Go Digit the catch-all for every insurer missing from the map. Six of the
 *      first thirty stored reports sat in that bucket.
 *
 * A third fault made it certain rather than likely: there was no Generali entry
 * at all, and the insurer has since been renamed, so the document says
 * "Generali Central Insurance Company Limited (Formerly known as Future
 * Generali India Insurance Company Limited)".
 *
 * The `navi` key had the same shape and would have claimed any policy whose
 * holder lives in Navi Mumbai.
 *
 * Run:  npx tsx --test backend/server/tests/insurerDetection.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { extractPolicyMetadata } from "../utils/policyWordingsFetcher";

const insurerOf = async (text: string) => (await extractPolicyMetadata(text)).insurer;

describe("insurer detection: words, not substrings", () => {
    test("a digitally signed policy from an unlisted insurer is not attributed to Go Digit", async () => {
        const text =
            "Acme Assurance Company. Policy Schedule. " +
            "Note: This document is digitally signed by Mr. Vaibhav Risbud, Authorised Signatory.";
        assert.equal(await insurerOf(text), null);
    });

    test("living in Navi Mumbai does not make it a Navi General policy", async () => {
        const text = "Policyholder address: Plot 7, Sector 15, Navi Mumbai, Maharashtra 400703.";
        assert.equal(await insurerOf(text), null);
    });

    test("the real document that reported this bug", async () => {
        // The line as it appears on the schedule page.
        const text =
            "For Generali Central Insurance Company Limited (Authorized Signatory). " +
            "Generali Central Insurance Company Limited (Formerly known as Future Generali " +
            "India Insurance Company Limited) | Registered Office: Unit No. 801. " +
            "Note: This document is digitally signed.";
        assert.equal(await insurerOf(text), "Generali Central Insurance Company Limited");
    });
});

describe("insurer detection: the genuine cases still resolve", () => {
    const cases: Array<[string, string]> = [
        ["Go Digit General Insurance Limited, Policy Schedule", "Go Digit General Insurance Limited"],
        ["Navi General Insurance Limited, Policy Schedule", "Navi General Insurance Limited"],
        ["Star Health and Allied Insurance Co Ltd", "Star Health and Allied Insurance Co Ltd"],
        ["HDFC ERGO General Insurance Company Limited", "HDFC ERGO General Insurance Company Limited"],
        ["ManipalCigna Health Insurance Company Limited", "ManipalCigna Health Insurance Company Limited"],
    ];
    for (const [text, want] of cases) {
        test(want, async () => {
            assert.equal(await insurerOf(text), want);
        });
    }

    test("renamed insurers resolve to the entity that exists today", async () => {
        // Precedent already in the map: max_bupa -> Niva Bupa, religare -> Care Health.
        assert.equal(await insurerOf("Future Generali India Insurance Company Limited"),
            "Generali Central Insurance Company Limited");
        assert.equal(await insurerOf("Max Bupa Health Insurance"),
            "Niva Bupa Health Insurance Company Limited");
    });
});

describe("insurer detection: the issuer is named first", () => {
    test("a ported policy resolves to the issuer, not the insurer it came from", async () => {
        // The shape of a real ported policy: the welcome letter names the issuer
        // in the first line, and the company it was ported FROM appears much
        // later, in the cumulative-bonus carry-forward table. In the document
        // that reported this bug the gap was character 213 on page 1 against
        // character 11,258 on page 7.
        const text =
            "Dear Palash, Welcome to ManipalCigna Health Insurance family! " +
            "Thank you for purchasing ManipalCigna Lifetime Health. " +
            "x".repeat(4000) +
            " Cumulative Bonus from Previous Policy: Care Health Insurance 59018198 MEDICLAIM";
        assert.equal(await insurerOf(text), "ManipalCigna Health Insurance Company Limited");
    });

    test("the same two insurers the other way round resolve the other way", async () => {
        const text =
            "Care Health Insurance Limited. Policy Schedule. " +
            "x".repeat(4000) +
            " Ported from ManipalCigna Health Insurance Company Limited.";
        assert.equal(await insurerOf(text), "Care Health Insurance Limited");
    });

    test("at the same position the fuller name wins", async () => {
        assert.equal(
            await insurerOf("Care Health Insurance Limited, formerly Religare Health Insurance"),
            "Care Health Insurance Limited",
        );
    });

    test("no insurer named at all returns null rather than a guess", async () => {
        assert.equal(await insurerOf("Policy Schedule. Sum Insured: Rs 5,00,000. Room rent: 1% of SI."), null);
    });
});
