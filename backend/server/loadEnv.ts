import dotenv from "dotenv";
import path from "path";

// Load .env.local first (dev), fallback to .env (production)
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

