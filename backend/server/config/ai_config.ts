export const AI_CONFIG = {
    model: "gemini-1.5-pro-preview-0514", // Locked version
    generation_config: {
        temperature: 0.0,      // Maximum determinism
        top_p: 1.0,           // No nucleus sampling randomness
        top_k: 1,             // Greedy decoding
        max_output_tokens: 8192,
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
    },
    timeout_ms: 120000 // 2 minutes hard timeout
};
