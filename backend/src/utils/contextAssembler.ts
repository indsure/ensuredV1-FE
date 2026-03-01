import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AI_CONFIG } from '../config';

export interface AssembledContext {
    full_prompt_text: string;
    prompt_hash: string;
    truncated_sections: string[];
}

export class ContextAssembler {
    private static readonly PROMPT_PATH = path.join(process.cwd(), 'src', 'prompts', 'MASTER_AUDIT_PROMPT.txt');

    public static async assemble(
        schemaJson: string,
        userEvidenceText: string,
        officialWordingsText: string
    ): Promise<AssembledContext> {

        let masterPrompt = fs.readFileSync(this.PROMPT_PATH, 'utf-8');

        const systemRules = this.extractSection(masterPrompt, '[SYSTEM_RULES]');
        const taskInstructions = this.extractSection(masterPrompt, '[AUDIT_TASK]');

        const truncatedEvidence = this.enforceBudget(userEvidenceText, AI_CONFIG.token_budget.user_evidence);
        const truncatedWordings = this.enforceBudget(officialWordingsText, AI_CONFIG.token_budget.official_wordings);

        const truncatedSections: string[] = [];
        if (truncatedEvidence.length < userEvidenceText.length) truncatedSections.push('USER_EVIDENCE');
        if (truncatedWordings.length < officialWordingsText.length) truncatedSections.push('OFFICIAL_POLICY_WORDINGS');

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

        const hash = crypto.createHash('sha256').update(finalPrompt).update(JSON.stringify(AI_CONFIG)).digest('hex');

        return {
            full_prompt_text: finalPrompt,
            prompt_hash: hash,
            truncated_sections: truncatedSections
        };
    }

    private static extractSection(template: string, sectionHeader: string): string {
        const startIndex = template.indexOf(sectionHeader);
        if (startIndex === -1) return "";

        const followingContent = template.substring(startIndex);
        const nextSectionIndex = followingContent.indexOf('[', sectionHeader.length);

        if (nextSectionIndex === -1) return followingContent.trim();
        return followingContent.substring(0, nextSectionIndex).trim();
    }

    private static enforceBudget(text: string, maxChars: number): string {
        const safeMaxChars = maxChars * 4;
        if (text.length <= safeMaxChars) return text;
        return text.substring(0, safeMaxChars) + "\n...[TRUNCATED_DUE_TO_TOKEN_BUDGET]...";
    }
}
