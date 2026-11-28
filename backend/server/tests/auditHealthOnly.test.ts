/**
 * The audit pipeline runs for health policies only.
 *
 * NO NETWORK, NO DB, NO GEMINI. AIService.generateContent is replaced with a
 * spy that fails the test if it is ever reached.
 *
 * Why this file exists: until 2026-10-16 runAnalysisPipeline picked a "life" or
 * "vehicle" prompt for those types, and both prompts opened with "SYSTEM MODE:
 * MOCK DATA ONLY" and asked the model for "BELIEVABLE but FAKE scores". From
 * February to July 2026 the public analyzer sent life and vehicle uploads
 * there. Motor, life and term now go to the data-entry lane, and the prompts
 * are deleted. This holds the door shut: any type other than health is refused
 * before a single paid call.
 *
 * Run:  npx tsx --test backend/server/tests/auditHealthOnly.test.ts
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

import { runAnalysisPipeline } from "../services/analysisPipeline";
import { AIService } from "../services/aiService";

const POLICY_TEXT = "Policy Schedule. Sum Assured Rs 1,00,00,000. Policy term 30 years.";

describe("runAnalysisPipeline refuses every type but health", () => {
  const original = AIService.generateContent;
  let calls = 0;

  before(() => {
    (AIService as any).generateContent = async () => {
      calls++;
      throw new Error("Gemini must not be called for a non-health audit");
    };
  });

  after(() => {
    (AIService as any).generateContent = original;
  });

  for (const type of ["life", "term", "motor", "vehicle", "travel", "", "Health"]) {
    test(`"${type}" fails before any AI call`, async () => {
      const before = calls;
      const result = await runAnalysisPipeline(POLICY_TEXT, type);
      assert.equal(result.status, "failed");
      assert.match(String((result as any).error), /Only health policies are audited/);
      assert.equal(calls, before, "no Gemini call may be made");
    });
  }

  test("health still passes the guard (reaches the empty-text check)", async () => {
    const result = await runAnalysisPipeline("   ", "health");
    assert.equal(result.status, "failed");
    assert.equal((result as any).error, "No text extracted from file");
    assert.equal(calls, 0);
  });
});
