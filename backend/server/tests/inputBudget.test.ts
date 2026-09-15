/**
 * Input-budget + response-classification tests.
 *
 * NO NETWORK. Nothing here constructs a Gemini client or calls one — the
 * response-quality tests feed hand-built objects shaped like the SDK's
 * GenerateContentResponse straight into the pure classifier.
 *
 * Run:  npx tsx --test backend/server/tests/inputBudget.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
    estimateTokens,
    truncateHeadTail,
    applyPolicyInputBudget,
    assertWithinHardCeiling,
    InputTooLargeError,
    approximatePageCount,
    SOFT_MAX_INPUT_TOKENS,
    HARD_MAX_INPUT_TOKENS,
    PROMPT_OVERHEAD_TOKENS,
    CHARS_PER_TOKEN,
} from "../utils/inputBudget";
import { classifyResponseQuality } from "../services/aiService";
import { validateAuditResponse } from "../services/analysisPipeline";
import { extractUsage } from "../services/geminiUsage";

/** Build a string of exactly `tokens` estimated tokens. */
const textOfTokens = (tokens: number) => "x".repeat(tokens * CHARS_PER_TOKEN);

/** assert.throws does not hand back the error, so capture it ourselves. */
function captureThrow<T extends Error>(fn: () => unknown): T {
    try {
        fn();
    } catch (err) {
        return err as T;
    }
    throw new assert.AssertionError({ message: "expected the call to throw, but it returned" });
}

/** A minimally valid audit report, matching validateParsedReport's contract. */
const VALID_REPORT = JSON.stringify({
    audit_score: { score: 72, ncar: 0.9 },
    final_verdict: { label: "SAFE" },
});

describe("estimateTokens", () => {
    test("empty text costs nothing", () => {
        assert.equal(estimateTokens(""), 0);
    });

    test("approximates 4 chars per token, rounding up", () => {
        assert.equal(estimateTokens("abcd"), 1);
        assert.equal(estimateTokens("abcde"), 2);
    });
});

describe("truncateHeadTail", () => {
    test("leaves text that already fits completely untouched", () => {
        const text = "a short policy";
        assert.equal(truncateHeadTail(text, 1000), text);
    });

    test("keeps BOTH ends — the tail carries the exclusions clauses", () => {
        const head = "SCHEDULE: sum insured 5 lakh";
        const tail = "EXCLUSIONS: PED waiting period 48 months";
        const middleSentinel = "MIDDLE_OF_DOCUMENT_MARKER";
        const filler = "M".repeat(100_000);
        const text = head + filler + middleSentinel + filler + tail;

        const out = truncateHeadTail(text, 1000);

        assert.ok(out.startsWith(head), "head (identity/schedule) must survive");
        assert.ok(out.endsWith(tail), "tail (exclusions) must survive");
        assert.ok(!out.includes(middleSentinel), "the middle should be dropped");
        assert.ok(out.length < text.length, "output must actually be smaller");
    });

    test("marks the omission so the model does not read across the gap", () => {
        const out = truncateHeadTail("z".repeat(100_000), 100);
        assert.match(out, /CHARACTERS OMITTED/);
        assert.match(out, /lower your confidence/i);
    });

    test("result respects the requested budget", () => {
        const budgetTokens = 500;
        const out = truncateHeadTail("q".repeat(400_000), budgetTokens);
        assert.ok(
            estimateTokens(out) <= budgetTokens,
            `truncated output was ${estimateTokens(out)} tokens, budget was ${budgetTokens}`
        );
    });
});

describe("applyPolicyInputBudget — tier 1: within budget", () => {
    test("normal traffic passes through byte-for-byte", () => {
        // 46,500 tokens: a real successful policy_audit from the ledger.
        const evidence = textOfTokens(46_500);
        const wordings = textOfTokens(400);

        const result = applyPolicyInputBudget(evidence, wordings);

        assert.equal(result.truncated, false);
        assert.deepEqual(result.truncatedSections, []);
        assert.equal(result.evidence, evidence, "evidence must not be altered");
        assert.equal(result.wordings, wordings, "wordings must not be altered");
    });

    test("the largest known-good run (93,121 tokens) is not truncated", () => {
        // Regression guard: this is the real ceiling the budget must clear, or
        // enforcement would silently degrade audits that work today.
        const result = applyPolicyInputBudget(textOfTokens(93_121), null);
        assert.equal(result.truncated, false);
        assert.equal(result.evidence.length, 93_121 * CHARS_PER_TOKEN);
    });

    test("handles a missing wordings match", () => {
        const result = applyPolicyInputBudget(textOfTokens(1000), null);
        assert.equal(result.wordings, null);
        assert.equal(result.truncated, false);
    });
});

describe("applyPolicyInputBudget — tier 2: over budget, truncated", () => {
    test("trims wordings FIRST, leaving the user's own document intact", () => {
        // Evidence alone fits; the oversized wordings push the total over.
        const evidence = textOfTokens(60_000);
        const wordings = textOfTokens(120_000);

        const result = applyPolicyInputBudget(evidence, wordings);

        assert.equal(result.truncated, true);
        assert.deepEqual(result.truncatedSections, ["OFFICIAL_POLICY_WORDINGS"]);
        assert.equal(result.evidence, evidence, "user evidence must be preserved");
        assert.ok((result.wordings ?? "").length < wordings.length);
    });

    test("trims evidence only when trimming wordings was not enough", () => {
        const result = applyPolicyInputBudget(textOfTokens(200_000), textOfTokens(40_000));

        assert.equal(result.truncated, true);
        assert.ok(result.truncatedSections.includes("USER_EVIDENCE"));
        assert.ok(result.estimatedTokens <= SOFT_MAX_INPUT_TOKENS);
    });

    test("reports both the original and the sent size", () => {
        const result = applyPolicyInputBudget(textOfTokens(200_000), null);
        assert.ok(result.originalTokens > result.estimatedTokens);
        assert.ok(result.estimatedTokens <= SOFT_MAX_INPUT_TOKENS);
    });
});

describe("applyPolicyInputBudget — tier 3: over the ceiling, rejected", () => {
    test("the real 542,778-token incident is refused outright", () => {
        // The exact call that cost real money and returned 23 unusable tokens.
        const err = captureThrow<InputTooLargeError>(() =>
            applyPolicyInputBudget(textOfTokens(542_778), null)
        );

        assert.ok(err instanceof InputTooLargeError);
        assert.equal(err.code, "INPUT_TOO_LARGE");
        assert.ok(err.estimatedTokens > HARD_MAX_INPUT_TOKENS);
    });

    test("the rejection message is actionable, not just an error", () => {
        const err = captureThrow<InputTooLargeError>(() =>
            applyPolicyInputBudget(textOfTokens(542_778), null)
        );

        assert.match(err.message, /too large/i);
        assert.match(err.message, /pages/, "should translate tokens into something human");
        assert.match(err.message, /upload only the policy document/i, "must tell the user what to do");
    });

    test("the ceiling is judged on RAW input, not post-truncation size", () => {
        // If the check ran after truncation nothing would ever trip it.
        assert.throws(
            () => applyPolicyInputBudget(textOfTokens(HARD_MAX_INPUT_TOKENS + 1), null),
            InputTooLargeError
        );
    });

    test("sits just under the ceiling without throwing", () => {
        const justUnder = HARD_MAX_INPUT_TOKENS - PROMPT_OVERHEAD_TOKENS - 10;
        assert.doesNotThrow(() => applyPolicyInputBudget(textOfTokens(justUnder), null));
    });

    test("wordings count toward the ceiling too", () => {
        const half = Math.ceil(HARD_MAX_INPUT_TOKENS * 0.6);
        assert.throws(
            () => applyPolicyInputBudget(textOfTokens(half), textOfTokens(half)),
            InputTooLargeError
        );
    });
});

describe("assertWithinHardCeiling — the all-features backstop", () => {
    test("passes an ordinary prompt through and returns its size", () => {
        const tokens = assertWithinHardCeiling(textOfTokens(5_000));
        assert.equal(tokens, 5_000);
    });

    test("throws for any feature, not just policy_audit", () => {
        assert.throws(
            () => assertWithinHardCeiling(textOfTokens(HARD_MAX_INPUT_TOKENS + 1)),
            InputTooLargeError
        );
    });
});

describe("approximatePageCount", () => {
    test("turns the incident size into a believable page count", () => {
        // ~2.1M chars. Should read as "hundreds of pages", i.e. not a policy.
        const pages = approximatePageCount(542_778);
        assert.ok(pages > 500 && pages < 1200, `got ${pages} pages`);
    });
});

describe("classifyResponseQuality — billed-but-unusable detection", () => {
    /** Shape a fake SDK response. No network, no client. */
    const fakeResponse = (finishReason?: string, blockReason?: string) => ({
        candidates: finishReason ? [{ finishReason }] : undefined,
        promptFeedback: blockReason ? { blockReason } : undefined,
    });

    test("a normal completion is ok", () => {
        const q = classifyResponseQuality(fakeResponse("STOP"), VALID_REPORT);
        assert.equal(q.degraded, false);
    });

    test("a response cut short by MAX_TOKENS is degraded", () => {
        const q = classifyResponseQuality(fakeResponse("MAX_TOKENS"), '{"partial":');
        assert.equal(q.degraded, true);
        assert.match(q.reason!, /MAX_TOKENS/);
    });

    test("a safety-blocked response is degraded", () => {
        const q = classifyResponseQuality(fakeResponse("SAFETY"), "");
        assert.equal(q.degraded, true);
    });

    test("a blocked prompt is degraded", () => {
        const q = classifyResponseQuality(fakeResponse(undefined, "OTHER"), "");
        assert.equal(q.degraded, true);
        assert.match(q.reason!, /blocked/i);
    });

    test("an empty billed response is degraded", () => {
        const q = classifyResponseQuality(fakeResponse("STOP"), "   \n  ");
        assert.equal(q.degraded, true);
        assert.match(q.reason!, /empty/i);
    });

    test("REGRESSION: the 23-token unparseable reply is no longer filed as ok", () => {
        // What row id=1 actually looked like: the SDK returned cleanly, so the
        // old code recorded status='ok' while the user got an error.
        const twentyThreeTokenJunk = '{"error":"unable to analyze document"}';
        const q = classifyResponseQuality(
            fakeResponse("STOP"),
            twentyThreeTokenJunk,
            validateAuditResponse
        );
        assert.equal(q.degraded, true, "a billed, unusable audit reply must not be recorded as ok");
    });

    test("does NOT punish legitimately short replies", () => {
        // A data_entry extraction returns ~240 tokens and a chat reply fewer —
        // output length alone must never be the signal.
        const shortButFine = '{"insurer":"Acme","sum_insured":500000}';
        const q = classifyResponseQuality(fakeResponse("STOP"), shortButFine);
        assert.equal(q.degraded, false);
    });

    test("no finishReason at all is treated as fine when text is usable", () => {
        const q = classifyResponseQuality({}, VALID_REPORT);
        assert.equal(q.degraded, false);
    });
});

describe("validateAuditResponse — the caller's usability contract", () => {
    test("accepts a well-formed report", () => {
        assert.equal(validateAuditResponse(VALID_REPORT), null);
    });

    test("accepts a report wrapped in markdown fences", () => {
        assert.equal(validateAuditResponse("```json\n" + VALID_REPORT + "\n```"), null);
    });

    test("rejects unparseable text", () => {
        assert.match(validateAuditResponse("not json at all")!, /parse/i);
    });

    test("rejects valid JSON that is missing the score contract", () => {
        assert.ok(validateAuditResponse('{"something_else":true}'));
    });
});

describe("extractUsage — thinking tokens must not go uncounted", () => {
    test("uses thoughtsTokenCount when the SDK reports it", () => {
        const u = extractUsage({
            usageMetadata: {
                promptTokenCount: 1000,
                candidatesTokenCount: 200,
                thoughtsTokenCount: 500,
                totalTokenCount: 1700,
            },
        });
        assert.equal(u.thoughtsTokens, 500);
        assert.equal(u.outputTokens, 200, "visible answer tokens stay separate");
    });

    test("REGRESSION: recovers the tokens the ledger was silently dropping", () => {
        // sach_ai row id=10 as actually recorded: 205 in, 95 out, total 1,387.
        // 1,087 tokens were billed at the output rate and never counted.
        const u = extractUsage({
            usageMetadata: {
                promptTokenCount: 205,
                candidatesTokenCount: 95,
                totalTokenCount: 1387,
            },
        });
        assert.equal(u.thoughtsTokens, 1087);
    });

    test("REGRESSION: recovers them for the 542k incident too", () => {
        // Row id=1: 542,778 + 23 = 542,801 against a total of 543,394.
        const u = extractUsage({
            usageMetadata: {
                promptTokenCount: 542778,
                candidatesTokenCount: 23,
                totalTokenCount: 543394,
            },
        });
        assert.equal(u.thoughtsTokens, 593);
    });

    test("is a no-op for models that do not think", () => {
        const u = extractUsage({
            usageMetadata: {
                promptTokenCount: 100,
                candidatesTokenCount: 50,
                totalTokenCount: 150,
            },
        });
        assert.equal(u.thoughtsTokens, null, "no phantom tokens when the total adds up");
    });

    test("survives a response with no usageMetadata at all", () => {
        const u = extractUsage({});
        assert.deepEqual(u, {
            promptTokens: null,
            outputTokens: null,
            totalTokens: null,
            thoughtsTokens: null,
        });
    });
});

describe("budget constants are internally coherent", () => {
    test("the soft budget leaves room above every known-good run", () => {
        assert.ok(
            SOFT_MAX_INPUT_TOKENS > 93_121,
            "budget must clear the largest successful audit or it degrades working traffic"
        );
    });

    test("the ceiling sits above the soft budget", () => {
        assert.ok(HARD_MAX_INPUT_TOKENS > SOFT_MAX_INPUT_TOKENS);
    });

    test("the ceiling sits below the incident that motivated it", () => {
        assert.ok(HARD_MAX_INPUT_TOKENS < 542_778);
    });
});
