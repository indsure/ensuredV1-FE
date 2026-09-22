/** Inspect insurer-name variants and repeated plan families before normalising them. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pkg from "pg";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
dotenv.config({ path: path.resolve(REPO_ROOT, ".env.local") });
dotenv.config({ path: path.resolve(REPO_ROOT, ".env") });

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const { rows } = await pool.query(
  "SELECT uin, insurer, plan_name, product_type FROM policy_catalog WHERE is_active ORDER BY insurer, plan_name",
);

// Group insurer names by a loose key, to reveal variants of the same company.
const key = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(company|companies|limited|ltd|co|insurance|general|health|india|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const groups = {};
for (const r of rows) (groups[key(r.insurer)] ||= []).push(r);

console.log("=== INSURER NAME VARIANTS ===");
for (const [k, rs] of Object.entries(groups)) {
  const names = [...new Set(rs.map((r) => r.insurer))];
  if (names.length > 1) {
    console.log(`\n  [${k}]  ${rs.length} rows, ${names.length} spellings:`);
    names.forEach((n) => console.log(`      ${rs.filter((r) => r.insurer === n).length.toString().padStart(3)}  ${n}`));
  }
}
console.log(`\n  total distinct insurer strings: ${new Set(rows.map((r) => r.insurer)).size}`);
console.log(`  total distinct companies (loose key): ${Object.keys(groups).length}`);

console.log("\n=== BAJAJ PLANS ===");
rows.filter((r) => /bajaj/i.test(r.insurer)).forEach((r) => console.log(`   ${r.uin}  ${r.plan_name}`));

await pool.end();
