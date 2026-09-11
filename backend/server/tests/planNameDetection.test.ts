/**
 * Plan name extraction from policy text.
 *
 * NO NETWORK, NO DB, NO GEMINI. Pure string matching over sample text.
 *
 * Why this file exists: a real ManipalCigna policy stored its plan as
 * "India Plan Tenure". The plan is "India Plan". "Tenure" is the heading of the
 * next column.
 *
 * A policy schedule is a key/value table, and PDF extraction flattens it onto
 * one line. The line in the document that reported this read:
 *
 *   "Plan Name : India Plan  Tenure : 1 Year  Portability : YES"
 *
 * The capture group allows spaces, so it ran past the value it wanted and took
 * the next field's label with it. Nothing stopped it: the value and the label
 * are separated by the same character the value's own words are.
 *
 * Two things do mark the boundary. The column gap, which survives extraction as
 * a run of two or more spaces, and the colon, which proves the last word taken
 * was a label rather than part of the name.
 *
 * Run:  npx tsx --test backend/server/tests/planNameDetection.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { extractPolicyMetadata } from "../utils/policyWordingsFetcher";

const planOf = async (text: string) => (await extractPolicyMetadata(text)).plan;

describe("plan name: the value stops where the next field starts", () => {
    test("the real document that reported this bug", async () => {
        // Verbatim from E:\Policiestotest\Palash Jiju.pdf, character 388,004.
        // The double spaces are the column gaps, preserved by extraction.
        const text =
            "Plan Type : Individual Floater Type(if opted) : Adult : Child : " +
            "Plan Name : India Plan  Tenure : 1 Year  Portability : YES";
        assert.equal(await planOf(text), "India Plan");
    });

    test("a column gap ends the value even when the next label has no colon", async () => {
        assert.equal(await planOf("Plan Name: Optima Restore  Sum Insured 500000"), "Optima Restore");
    });

    test("when the gap did not survive, the colon after the last word ends the value", async () => {
        assert.equal(await planOf("Plan Name: Lifetime Health Tenure : 1 Year"), "Lifetime Health");
    });

    test("a one-word plan name followed by a label is not emptied out", async () => {
        // The colon rule drops the last word. With only one word there is
        // nothing to drop, and the name itself must survive.
        assert.equal(await planOf("Plan Name: Freedom : 1 Year"), "Freedom");
    });

    test("a value that ends at a line break is left alone", async () => {
        // The capture cannot cross a newline, so there is no label to remove
        // and the full name must come through.
        assert.equal(await planOf("Plan Name: Optima Restore\nTenure: 1 Year"), "Optima Restore");
    });

    test("Product name is read the same way", async () => {
        assert.equal(await planOf("Product name : Health Companion  Policy Type : Floater"), "Health Companion");
    });
});

describe("plan name: normalization is unchanged", () => {
    test("underscores and the boilerplate suffixes still come off", async () => {
        assert.equal(await planOf("Plan Name: Care_Freedom New\nSum Insured: 500000"), "Care Freedom");
    });

    test("stripping a suffix from the middle does not leave a double space behind", async () => {
        // " Individual" is removed from between two words. Before the collapse
        // this produced "Care  Plus", which reads as a column gap everywhere else.
        assert.equal(await planOf("Plan Name: Care Individual Plus\nSum Insured: 500000"), "Care Plus");
    });
});
