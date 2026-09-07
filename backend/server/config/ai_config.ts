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
         * NOTE: on this branch nothing passes generation_config to the SDK, so
         * this value is currently inert and the provider default applies. It is
         * corrected here anyway, because the moment it IS wired it becomes a
         * live ceiling, and at 8,192 it took the beta backend's health audit
         * down for a week.
         *
         * The trap: this model thinks, and the reasoning trace is billed
         * against this same ceiling while being reported separately as
         * thoughtsTokenCount. So sizing the ceiling against the largest report
         * ever *emitted* (4,411 tokens) measures the wrong half. A real
         * successful audit ran ~3,339 visible + ~8,494 thinking = ~11,833, i.e.
         * already past 8,192 on its own. Under the cap the JSON came back cut
         * mid-object and the pipeline reported a parse failure.
         *
         * 32,768 sits about 2.5x above that known-good total and still bounds a
         * runaway. Raising a ceiling cannot make a call cost more than the
         * tokens it actually spends.
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
    token_budget: {
        system_rules: 1000,
        schema_definition: 3000,
        user_evidence: 4000,
        official_wordings: 30000, // Large context window for Gemini 1.5 Pro
        audit_task: 500
    }
};
