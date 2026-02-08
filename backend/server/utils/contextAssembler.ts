import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AI_CONFIG } from '../config/ai_config';

export interface AssembledContext {
    full_prompt_text: string;
    prompt_hash: string;
    truncated_sections: string[];
}

export class ContextAssembler {
    private static readonly PROMPT_PATH = path.join(process.cwd(), 'server', 'prompts', 'MASTER_AUDIT_PROMPT.txt');

    public static async assemble(
        schemaJson: string,
        userEvidenceText: string,
        officialWordingsText: string
    ): Promise<AssembledContext> {

        // 1. Read System Prompt Template
        let masterPrompt = fs.readFileSync(this.PROMPT_PATH, 'utf-8');

        // 2. Split logic (The prompt file currently has placeholders, but we enforce strict block assembly)
        // We will restructure the raw inputs into the block format defined in AI_CONFIG budget.

        const systemRules = this.extractSection(masterPrompt, '[SYSTEM_RULES]');
        const taskInstructions = this.extractSection(masterPrompt, '[AUDIT_TASK]');

        // 3. Truncation Logic (Priority Enforcement)

        // User Evidence (High Priority - Do not truncate if possible)
        const truncatedEvidence = this.enforceBudget(userEvidenceText, AI_CONFIG.token_budget.user_evidence);

        // Official Wordings (Largest Block - Truncate Marketing/Intro first if we had smart logic, but here strict length)
        // In a real implementation, we would strip "Welcome" messages here.
        const truncatedWordings = this.enforceBudget(officialWordingsText, AI_CONFIG.token_budget.official_wordings);

        const truncatedSections: string[] = [];
        if (truncatedEvidence.length < userEvidenceText.length) truncatedSections.push('USER_EVIDENCE');
        if (truncatedWordings.length < officialWordingsText.length) truncatedSections.push('OFFICIAL_POLICY_WORDINGS');

        // 4. Assembly Order (Strict)
        // [SYSTEM_RULES]
        // [SCHEMA_DEFINITION]
        // [USER_EVIDENCE]
        // [OFFICIAL_POLICY_WORDINGS]
        // [AUDIT_TASK]

        const finalPrompt = `
${systemRules}

[SCHEMA_DEFINITION]
${schemaJson}

[USER_EVIDENCE]
${truncatedEvidence}

[OFFICIAL_POLICY_WORDINGS]
${truncatedWordings}

${taskInstructions}
    `.trim();

        // 5. Hashing
        const hash = crypto.createHash('sha256').update(finalPrompt).update(JSON.stringify(AI_CONFIG)).digest('hex');

        return {
            full_prompt_text: finalPrompt,
            prompt_hash: hash,
            truncated_sections: truncatedSections
        };
    }

    // --- Helpers ---

    private static extractSection(template: string, sectionHeader: string): string {
        // Simple extraction for the predefined template structure
        // Assumes sections are separated by double newlines or clear headers
        // For specific implementation, we assume the template provided is the source of truth for Rules and Task.
        // However, the provided template in Prompt 4 has [SYSTEM_RULES]... [AUDIT_TASK] blocks.
        // We can regex for them.

        // This is a simplified parser given the rigid structure of MASTER_AUDIT_PROMPT.txt
        const startIndex = template.indexOf(sectionHeader);
        if (startIndex === -1) return ""; // Should throw error in strict mode

        // Find next section `[` or end of string
        const followingContent = template.substring(startIndex);
        const nextSectionIndex = followingContent.indexOf('[', sectionHeader.length);

        if (nextSectionIndex === -1) return followingContent.trim();
        return followingContent.substring(0, nextSectionIndex).trim();
    }

    private static enforceBudget(text: string, maxChars: number): string {
        // Rough character approximation for tokens (1 token approx 4 chars)
        // AI_CONFIG uses 'token_budget', but here we are string slicing.
        // Ideally use a tokenizer. For this spec, we strictly slice chars.
        const safeMaxChars = maxChars * 4;
        if (text.length <= safeMaxChars) return text;
        return text.substring(0, safeMaxChars) + "\n...[TRUNCATED_DUE_TO_TOKEN_BUDGET]...";
    }
}
