/** Run the new "what's wrong" intent over real stored reports. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pkg from "pg";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
dotenv.config({ path: path.resolve(REPO_ROOT, ".env.local") });
dotenv.config({ path: path.resolve(REPO_ROOT, ".env") });

const mod = await import("../../backend/server/services/sachRetrieval.ts");
const R = mod.default ?? mod;

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const QUESTIONS = [
  "In this policy, what is wrong",
  "should they switch",
  "is this any good",
  "what is my room rent limit",   // control: must still route to the clause answer
];

const { rows } = await pool.query(
  "SELECT result FROM analysis_jobs WHERE result IS NOT NULL AND result->'final_verdict' IS NOT NULL ORDER BY created_at DESC LIMIT 2",
);

for (const row of rows) {
  const result = typeof row.result === "string" ? JSON.parse(row.result) : row.result;
  const who = (result?.identity?.insured_names ?? []).join(", ") || "(no name)";
  console.log(`\n${"═".repeat(72)}\n${who}\n${"═".repeat(72)}`);

  for (const q of QUESTIONS) {
    const out = R.answerFromData(q, { ownAnalysis: result, catalogRow: null });
    console.log(`\n  Q: ${q}`);
    console.log(`     intent=${out.intent.kind}`);
    console.log(out.text ? "     " + out.text.replace(/\n/g, "\n     ") : "     (no answer)");
  }
}
await pool.end();
