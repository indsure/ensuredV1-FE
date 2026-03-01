import { GoogleGenerativeAI } from "@google/generative-ai";
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { AI_CONFIG } from '../config';

export class AIService {
    private static readonly MOCK_DIR = path.join(process.cwd(), 'src', 'data', 'mocks');

    public static async generateContent(
        systemPrompt: string,
        userContent: string,
        modelName: string = AI_CONFIG.model
    ): Promise<string> {

        // 1. Calculate Hash (for Replay/Mock identification)
        const fullInput = systemPrompt + "\n\n" + userContent;
        const inputHash = crypto.createHash('sha256').update(fullInput).digest('hex');

        // 2. REPLAY MODE SWITCH
        if (process.env.REPLAY_MODE === "true") {
            console.log(`[AIService] REPLAY_MODE active. Looking for mock: ${inputHash}`);
            return this.loadRecordedOutput(inputHash);
        }

        // 3. AI EXECUTION GUARD
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("INFRA_ERROR: GEMINI_API_KEY_NOT_CONFIGURED - Live AI execution blocked.");
        }

        // 4. Live Execution
        console.log(`[AIService] Live Execution. Model: ${modelName}. Hash: ${inputHash}`);
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    temperature: AI_CONFIG.generation_config.temperature,
                    topP: AI_CONFIG.generation_config.top_p,
                    maxOutputTokens: AI_CONFIG.generation_config.max_output_tokens,
                }
            });

            const result = await model.generateContent({
                contents: [{
                    role: "user",
                    parts: [{ text: fullInput }]
                }]
            });

            const responseText = result.response.text();

            return responseText;

        } catch (error: any) {
            console.error("[AIService] Live Execution Failed:", error.message);
            throw error;
        }
    }

    private static loadRecordedOutput(hash: string): string {
        const mockPath = path.join(this.MOCK_DIR, `${hash}.json`);
        if (fs.existsSync(mockPath)) {
            console.log(`[AIService] Mock found at ${mockPath}`);
            return fs.readFileSync(mockPath, 'utf-8');
        }
        throw new Error(`REPLAY_ERROR: No mock found for hash ${hash}. Please run with LIVE_AI=true to generate.`);
    }

    public static saveRecordedOutput(hash: string, content: string) {
        if (!fs.existsSync(this.MOCK_DIR)) fs.mkdirSync(this.MOCK_DIR, { recursive: true });
        const mockPath = path.join(this.MOCK_DIR, `${hash}.json`);
        fs.writeFileSync(mockPath, content);
        console.log(`[AIService] Saved mock to ${mockPath}`);
    }
}
