/**
 * Smoke-test Sach against REAL stored reports, not fixtures.
 *
 * The bug that made Sach useless was that its grounding block read JSON paths which do not
 * exist in a stored analysis. Fixtures would never have caught that, so this runs the live
 * retrieval over actual analysis_jobs.result rows and prints what a user would be told.
 *
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/ops/smoke_sach.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pkg from "pg";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
dotenv.config({ path: path.resolve(REPO_ROOT, ".env.local") });
dotenv.config({ path: path.resolve(REPO_ROOT, ".env") });

const mod = await import("../../backend/server/services/sachRetrieval.ts");
const R = mod.default ?? mod;
const { parseIntent, resolveFromAudit, renderClauseAnswer } = R;

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const QUESTIONS = [
  "does this policy cover robotic surgery?",       // the one the UI advertised and could not answer
  "what is the waiting period for pre-existing diseases?",
  "is there any co-payment?",
  "what is the room rent limit?",
];

const { rows } = await pool.query(
  "SELECT id, result FROM analysis_jobs WHERE result IS NOT NULL ORDER BY created_at DESC LIMIT 3",
);

let asked = 0, answered = 0;
for (const row of rows) {
  const result = typeof row.result === "string" ? JSON.parse(row.result) : row.result;
  const plan = result?.identity?.plan_name ?? result?.coverage_structure?.policy_name ?? "(plan name not stored)";
  console.log(`\n${"═".repeat(70)}`);
  console.log(`REPORT ${String(row.id).slice(0, 8)}…   ${plan}`);
  console.log("═".repeat(70));

  for (const q of QUESTIONS) {
    asked++;
    console.log(`\n  Q: ${q}`);
    try {
      const intent = parseIntent(q);
      if (!intent?.clauseKey) { console.log("     (no clause matched this question)"); continue; }
      const fact = resolveFromAudit(result, intent.clauseKey);
      if (!fact) { console.log(`     (clause "${intent.clauseKey}" not present in this report)`); continue; }
      const answer = renderClauseAnswer(fact);
      answered++;
      console.log(`     A: ${String(answer).replace(/\n/g, "\n        ")}`);
    } catch (e) {
      console.log(`     ERROR: ${e.message}`);
    }
  }
}

console.log(`\n${"─".repeat(70)}`);
console.log(`${answered} of ${asked} questions answered from stored data, zero model calls.`);
await pool.end();
