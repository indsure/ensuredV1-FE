/**
 * Dump every policy_catalog row to a timestamped JSON file before a bulk load.
 *
 * load_catalog.mjs upserts on UIN, so a freshly extracted seed that happens to carry the same
 * product code as an existing hand-made entry will overwrite it. This makes that reversible.
 *
 * The file is written OUTSIDE the repo, because the repo is public.
 *
 *   node scripts/ops/snapshot_catalog.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pkg from "pg";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
dotenv.config({ path: path.resolve(REPO_ROOT, ".env.local") });
dotenv.config({ path: path.resolve(REPO_ROOT, ".env") });

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const OUT_DIR = path.resolve(REPO_ROOT, "..", "_catalog_backups");

const { rows } = await pool.query("SELECT * FROM policy_catalog ORDER BY uin");
fs.mkdirSync(OUT_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const file = path.join(OUT_DIR, `policy_catalog_${stamp}.json`);
fs.writeFileSync(file, JSON.stringify(rows, null, 2) + "\n", "utf-8");

const byType = rows.reduce((a, r) => ((a[r.product_type] = (a[r.product_type] || 0) + 1), a), {});
console.log(`snapshot: ${rows.length} rows`);
Object.entries(byType).forEach(([t, n]) => console.log(`   ${t}: ${n}`));
console.log(`saved to ${file}`);
await pool.end();
