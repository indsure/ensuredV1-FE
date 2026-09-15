/**
 * INPUT BUDGET ENFORCEMENT — the cap that stops a runaway document from
 * silently spending money on Gemini.
 *
 * Background: AI_CONFIG.token_budget was declared but enforced nowhere. The
 * only consumer (utils/contextAssembler.ts) is dead code — nothing imports it —
 * so uploaded policy text went straight from the PDF extractor to Gemini with
 * no size check at all. One policy_audit call reached 542,778 input tokens
 * (~2.1M chars, ~850 pages) and returned 23 unusable output tokens.
 *
 * Three tiers:
 *   1. Within budget                → sent untouched (this is all current traffic)
 *   2. Over budget, under ceiling   → truncated + flagged, never silently
 *   3. Over the hard ceiling        → REJECTED before any spend
 *
 * Why reject instead of truncate at the top end: the audit is forensic scoring.
 * Its score depends on finding specific clauses (PED waiting period, room-rent
 * sub-limit, co-pay, exclusions). A truncated document does not produce an
 * obviously-broken report — it produces a confident, plausible report with a
 * WRONG score, because the model never saw the clause that would have penalised
 * the policy. A wrong number the user trusts is worse than an honest error.
 */

import { AI_CONFIG } from "../config/ai_config";

/**
 * Chars-per-token approximation. Deliberately conservative (real English prose
 * averages ~4; dense policy text with tables and IDs tokenises WORSE than that,
 * i.e. more tokens per char), so this UNDER-estimates rather than over-estimates
 * and the true input can exceed the estimate. That is the safe direction for a
 * truncation budget but the unsafe direction for a ceiling, which is why the
 * ceiling sits well below the model's real context limit.
 */
export const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function tokensToChars(tokens: number): number {
    return tokens * CHARS_PER_TOKEN;
}

/** Fixed prompt overhead (system rules + schema + task instructions). */
export const PROMPT_OVERHEAD_TOKENS =
    AI_CONFIG.token_budget.system_rules +
    AI_CONFIG.token_budget.schema_definition +
    AI_CONFIG.token_budget.audit_task;

/** Total input the assembled prompt is allowed to reach before truncation. */
export const SOFT_MAX_INPUT_TOKENS =
    Number(process.env.GEMINI_SOFT_MAX_INPUT_TOKENS) ||
    PROMPT_OVERHEAD_TOKENS +
    AI_CONFIG.token_budget.user_evidence +
    AI_CONFIG.token_budget.official_wordings;

/** Above this we refuse the call outright. Never spend, never truncate. */
export const HARD_MAX_INPUT_TOKENS = AI_CONFIG.input_limits.hard_max_input_tokens;

/**
 * Thrown INSTEAD of calling Gemini. Carries the numbers so the caller can log
 * them and show the user something actionable.
 */
export class InputTooLargeError extends Error {
    public readonly code = "INPUT_TOO_LARGE";
    public readonly estimatedTokens: number;
    public readonly limitTokens: number;
    public readonly approxPages: number;

    constructor(estimatedTokens: number, limitTokens: number) {
        const approxPages = approximatePageCount(estimatedTokens);
        super(
            `Document too large to analyse: ~${estimatedTokens.toLocaleString("en-US")} input tokens ` +
            `(roughly ${approxPages.toLocaleString("en-US")} pages) exceeds the ${limitTokens.toLocaleString("en-US")} limit. ` +
            `Please upload only the policy document and its wordings — not a merged bundle of ` +
            `correspondence, claim forms, or multiple policies.`
        );
        this.name = "InputTooLargeError";
        this.estimatedTokens = estimatedTokens;
        this.limitTokens = limitTokens;
        this.approxPages = approxPages;
    }
}

/** Rough page estimate for human-readable messages (~2,500 chars/page). */
export function approximatePageCount(tokens: number): number {
    return Math.max(1, Math.round((tokens * CHARS_PER_TOKEN) / 2500));
}

/**
 * Truncate keeping BOTH ends of the document and dropping the middle.
 *
 * A naive head-only slice is actively dangerous here: Indian health policies
 * put the schedule (insurer, sum insured, dates) at the front and the
 * exclusions / waiting-period clauses further back. Cutting the tail removes
 * exactly the clauses the audit scores on, while leaving enough front matter
 * for the report to look complete. Keeping head + tail preserves both the
 * identity fields and the clause-bearing sections.
 *
 * Split favours the head (identity/coverage extraction must succeed for the
 * report to validate at all), and the omission is marked inline so the model
 * knows there is a gap rather than reading across it as continuous text.
 */
export function truncateHeadTail(text: string, maxTokens: number): string {
    const maxChars = tokensToChars(maxTokens);
    if (text.length <= maxChars) return text;

    const marker = (omittedChars: number) =>
        `\n\n...[${omittedChars.toLocaleString("en-US")} CHARACTERS OMITTED — DOCUMENT EXCEEDED INPUT BUDGET. ` +
        `THE MIDDLE OF THIS DOCUMENT WAS NOT PROVIDED. Do not assume the omitted region is empty; ` +
        `lower your confidence for any field you cannot find in the text you were given.]...\n\n`;

    // Reserve room for the marker itself so the result still fits the budget.
    const markerBudget = marker(text.length).length;

    // Budget too small to fit even the marker: fall back to a plain head slice
    // rather than returning a marker that overruns the budget it enforces.
    if (maxChars <= markerBudget) return text.slice(0, maxChars);

    const usableChars = maxChars - markerBudget;

    const headChars = Math.floor(usableChars * 0.6);
    const tailChars = usableChars - headChars;

    const head = text.slice(0, headChars);
    const tail = tailChars > 0 ? text.slice(text.length - tailChars) : "";
    const omitted = text.length - head.length - tail.length;

    return head + marker(omitted) + tail;
}

export interface PolicyInputBudget {
    /** Uploaded policy text, post-enforcement. */
    evidence: string;
    /** Fetched official wordings, post-enforcement (null when none). */
    wordings: string | null;
    /** Estimated input tokens BEFORE enforcement, incl. prompt overhead. */
    originalTokens: number;
    /** Estimated input tokens AFTER enforcement, incl. prompt overhead. */
    estimatedTokens: number;
    /** Section names that lost content, e.g. ["OFFICIAL_POLICY_WORDINGS"]. */
    truncatedSections: string[];
    truncated: boolean;
}

/**
 * Apply the declared budget to a policy audit's two variable inputs.
 *
 * Order matters:
 *   1. Measure the RAW total. The ceiling must be judged on what the user
 *      actually uploaded — checking after truncation would mean nothing ever
 *      trips it.
 *   2. Over the ceiling → throw. No spend.
 *   3. Otherwise truncate per-section, WORDINGS FIRST: they are refetchable
 *      from the knowledge base and are the lower-value half of the context,
 *      whereas the user's own document is the thing being audited.
 *
 * @throws {InputTooLargeError} when the raw input exceeds the hard ceiling.
 */
export function applyPolicyInputBudget(
    evidenceText: string,
    wordingsText: string | null
): PolicyInputBudget {
    const rawEvidenceTokens = estimateTokens(evidenceText);
    const rawWordingsTokens = estimateTokens(wordingsText ?? "");
    const originalTokens = PROMPT_OVERHEAD_TOKENS + rawEvidenceTokens + rawWordingsTokens;

    // Tier 3 — refuse outright.
    if (originalTokens > HARD_MAX_INPUT_TOKENS) {
        throw new InputTooLargeError(originalTokens, HARD_MAX_INPUT_TOKENS);
    }

    const truncatedSections: string[] = [];
    let evidence = evidenceText;
    let wordings = wordingsText;

    // Tier 1 — within budget, send untouched.
    if (originalTokens <= SOFT_MAX_INPUT_TOKENS) {
        return {
            evidence,
            wordings,
            originalTokens,
            estimatedTokens: originalTokens,
            truncatedSections,
            truncated: false,
        };
    }

    // Tier 2 — over budget. Trim wordings first, then evidence if still over.
    if (wordings && rawWordingsTokens > AI_CONFIG.token_budget.official_wordings) {
        wordings = truncateHeadTail(wordings, AI_CONFIG.token_budget.official_wordings);
        truncatedSections.push("OFFICIAL_POLICY_WORDINGS");
    }

    let workingTotal =
        PROMPT_OVERHEAD_TOKENS + estimateTokens(evidence) + estimateTokens(wordings ?? "");

    if (workingTotal > SOFT_MAX_INPUT_TOKENS) {
        // Give the evidence whatever the budget has left after fixed overhead
        // and the (already trimmed) wordings, capped at its declared share.
        const remaining =
            SOFT_MAX_INPUT_TOKENS - PROMPT_OVERHEAD_TOKENS - estimateTokens(wordings ?? "");
        const evidenceAllowance = Math.max(
            0,
            Math.min(AI_CONFIG.token_budget.user_evidence, remaining)
        );
        evidence = truncateHeadTail(evidence, evidenceAllowance);
        truncatedSections.push("USER_EVIDENCE");
        workingTotal =
            PROMPT_OVERHEAD_TOKENS + estimateTokens(evidence) + estimateTokens(wordings ?? "");
    }

    return {
        evidence,
        wordings,
        originalTokens,
        estimatedTokens: workingTotal,
        truncatedSections,
        truncated: truncatedSections.length > 0,
    };
}

/**
 * Backstop for every OTHER feature (data_entry, wording_extract, sach_ai...)
 * that assembles its own prompt and never goes through applyPolicyInputBudget.
 * Called from AIService so no call site can bypass the ceiling.
 *
 * @throws {InputTooLargeError}
 */
export function assertWithinHardCeiling(fullInput: string): number {
    const estimated = estimateTokens(fullInput);
    if (estimated > HARD_MAX_INPUT_TOKENS) {
        throw new InputTooLargeError(estimated, HARD_MAX_INPUT_TOKENS);
    }
    return estimated;
}
