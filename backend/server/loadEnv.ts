import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
console.log("[DEBUG] Env loaded. DATABASE_URL present:", !!process.env.DATABASE_URL);
