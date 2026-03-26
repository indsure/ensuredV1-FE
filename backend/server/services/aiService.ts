import { GoogleGenerativeAI } from "@google/generative-ai";
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export class AIService {
    private static readonly MOCK_DIR = path.join(process.cwd(), 'server', 'data', 'mocks');

    public static async generateContent(
        systemPrompt: string,
        userContent: string,
        modelName: string = "gemini-1.5-pro"
    ): Promise<string> {

        // 1. Calculate Hash (for Replay/Mock identification)
        const fullInput = systemPrompt + "\n\n" + userContent;
        const inputHash = crypto.createHash('sha256').update(fullInput).digest('hex');

        // 2. REPLAY MODE SWITCH
        if (process.env.REPLAY_MODE === "true") {
            return this.loadRecordedOutput(inputHash);
        }

        // 3. AI EXECUTION GUARD
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("INFRA_ERROR: GEMINI_API_KEY_NOT_CONFIGURED - Live AI execution blocked.");
        }

        // 4. Live Execution
        const MAX_RETRIES = 3;
        const RETRY_DELAY_MS = 2000;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: {
                        temperature: 0, // Deterministic
                        topP: 1.0,      // Deterministic
                    }
                });

                const result = await model.generateContent({
                    contents: [{
                        role: "user",
                        parts: [{ text: fullInput }]
                    }]
                });

                const responseText = result.response.text();

                // (Optional) Auto-record for future replays?
                // this.saveRecordedOutput(inputHash, responseText);

                return responseText;

            } catch (error: any) {
                console.error(`[AIService] Live Execution Failed (Attempt ${attempt}/${MAX_RETRIES}):`, error.message);
                if (attempt === MAX_RETRIES) {
                    throw error;
                }
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
            }
        }

        throw new Error("INFRA_ERROR: Live Execution failed after retries.");
    }

    private static loadRecordedOutput(hash: string): string {
        const mockPath = path.join(this.MOCK_DIR, `${hash}.json`);
        if (fs.existsSync(mockPath)) {
            return fs.readFileSync(mockPath, 'utf-8');
        }
        // Fallback? Or strictly fail?
        // User said: "Golden tests must not depend on live network." -> Strict Fail if mock missing in replay mode.
        throw new Error(`REPLAY_ERROR: No mock found for hash ${hash}. Please run with LIVE_AI=true to generate.`);
    }

    // Utility to seed mocks
    public static saveRecordedOutput(hash: string, content: string) {
        if (!fs.existsSync(this.MOCK_DIR)) fs.mkdirSync(this.MOCK_DIR, { recursive: true });
        const mockPath = path.join(this.MOCK_DIR, `${hash}.json`);
        fs.writeFileSync(mockPath, content);
    }
}
