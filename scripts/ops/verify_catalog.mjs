/** Read back what policy_catalog actually holds after a bulk load. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pkg from "pg";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
dotenv.config({ path: path.resolve(REPO_ROOT, ".env.local") });
dotenv.config({ path: path.resolve(REPO_ROOT, ".env") });

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const q = async (label, sql) => {
  const { rows } = await pool.query(sql);
  console.log(`\n${label}`);
  rows.forEach((r) => console.log("   " + Object.values(r).join("  ·  ")));
};

await q("TOTAL", "SELECT COUNT(*)::int AS rows, COUNT(DISTINCT uin)::int AS distinct_uins FROM policy_catalog WHERE is_active");
await q("BY PRODUCT TYPE", "SELECT product_type, COUNT(*)::int FROM policy_catalog WHERE is_active GROUP BY 1 ORDER BY 2 DESC");
await q("BY CONFIDENCE", "SELECT COALESCE(confidence,'(none)') AS c, COUNT(*)::int FROM policy_catalog WHERE is_active GROUP BY 1 ORDER BY 2 DESC");
await q("EXTRACTED BY", "SELECT CASE WHEN profile->>'extracted_by' IS NULL THEN 'hand (earlier work)' ELSE profile->>'extracted_by' END AS src, COUNT(*)::int FROM policy_catalog WHERE is_active GROUP BY 1 ORDER BY 2 DESC");
await q("INSURERS (top 12)", "SELECT insurer, COUNT(*)::int FROM policy_catalog WHERE is_active AND product_type='comprehensive_health_indemnity' GROUP BY 1 ORDER BY 2 DESC LIMIT 12");
await q("COMPARABLE PAIRS AVAILABLE", "SELECT (COUNT(*)*(COUNT(*)-1)/2)::int AS pairs FROM policy_catalog WHERE is_active AND product_type='comprehensive_health_indemnity'");

await pool.end();
