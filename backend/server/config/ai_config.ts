export const AI_CONFIG = {
    // Model is env-driven so it can be switched without a code change/redeploy.
    // e.g. set GEMINI_MODEL=gemini-2.5-flash in .env to fall back off a busy model.
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
    generation_config: {
        temperature: 0.0,      // Maximum determinism
        top_p: 1.0,           // No nucleus sampling randomness
        top_k: 1,             // Greedy decoding
        /**
         * Output ceiling, in tokens.
         *
         * 2026-09-07: raised 8192 -> 32768. This model THINKS, and the
         * reasoning trace is billed against this same ceiling while being
         * reported separately (thoughtsTokenCount), so the visible report only
         * ever gets what thinking leaves behind. When 8192 was first wired to
         * the SDK (c4ad8c0, 2026-08-31) it was justified against the largest
         * audit ever *emitted* — 4,411 tokens — but that figure counted
         * candidatesTokenCount alone. It was never the number that mattered.
         *
         * Every health audit since that commit has died on it. From the ledger:
         *   prompt 23,092 + visible 325 + thinking 7,863 = 8,188  -> MAX_TOKENS
         * and the JSON was cut mid-object, which the pipeline then reports as
         * "Invalid AI response format — JSON parse failed".
         *
         * 32,768 sits about 2.5x above the largest known-good total
         * (~4,000 visible + ~8,500 thinking = ~12,500) and still bounds a
         * runaway. Raising a ceiling cannot make a call cost more than the
         * tokens it actually spends: a report that fit inside 8,192 bills
         * exactly the same here.
         */
        max_output_tokens: Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 32768,
        seed: 42              // Fixed seed for reproducibility
    },
    safety_settings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, // We need full analysis of medical terms
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
    ],
    /**
     * Per-section INPUT budget, in tokens. Enforced by utils/inputBudget.ts —
     * see that file for the truncate/reject tiers.
     *
     * HISTORY: these numbers were previously aspirational and enforced nowhere
     * (the only consumer, utils/contextAssembler.ts, was never imported). The
     * declared user_evidence was 4000 tokens, but every SUCCESSFUL policy_audit
     * in the ledger ran 10k-93k input tokens — enforcing 4000 would have
     * truncated the policy PDF to ~16k chars and wrecked every report. The
     * values below are set from measured behaviour, with headroom above the
     * largest known-good run (93,121 tokens), so enforcement is a real ceiling
     * on runaway inputs and NOT a change to traffic that already works.
     */
    token_budget: {
        system_rules: 1000,
        schema_definition: 3000,
        user_evidence: 120000,     // uploaded policy text (largest known-good: 93,121)
        official_wordings: 30000,  // fetched wordings — truncated FIRST, they are regenerable
        audit_task: 500
    },
    /**
     * Hard stop. Above this we refuse to call Gemini at all, rather than
     * truncating: an input this size is a merged bundle or a broken extraction,
     * not a policy, and a truncated forensic audit yields a confident WRONG
     * score (the clauses that drive penalties sit deep in the document).
     * Reference point: the 542,778-token call that cost real money and returned
     * 23 unusable output tokens.
     */
    input_limits: {
        hard_max_input_tokens: Number(process.env.GEMINI_HARD_MAX_INPUT_TOKENS) || 250000
    }
};
