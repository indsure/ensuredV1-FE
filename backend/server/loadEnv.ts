import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load from project root, not from backend/server directory
const rootDir = path.resolve(__dirname, "../..");

console.log('[loadEnv] Loading environment from:', rootDir);

// Load .env.local first (dev), fallback to .env (production)
const localResult = dotenv.config({ path: path.join(rootDir, ".env.local") });
const envResult = dotenv.config({ path: path.join(rootDir, ".env") });

console.log('[loadEnv] .env.local loaded:', localResult.parsed ? Object.keys(localResult.parsed).length + ' vars' : 'not found');
console.log('[loadEnv] .env loaded:', envResult.parsed ? Object.keys(envResult.parsed).length + ' vars' : 'not found');

