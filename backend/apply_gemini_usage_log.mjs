// One-shot migration: create the gemini_usage_log table.
// Usage:  node apply_gemini_usage_log.mjs
// Requires DATABASE_URL in the environment (same one the server uses).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "pg";

const { Pool } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Best-effort .env load so this can be run standalone from the backend dir.
try {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch { /* ignore */ }

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL not set. Aborting.");
  process.exit(1);
}

const sql = fs.readFileSync(path.join(__dirname, "create_gemini_usage_log.sql"), "utf-8");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(sql);
  console.log("✅ gemini_usage_log table + indexes created (or already existed).");
} catch (err) {
  console.error("❌ Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
