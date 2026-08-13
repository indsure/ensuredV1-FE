/**
 * Apply a migration file to the database named by DATABASE_URL in ../.env.
 *
 *   node backend/apply_migration.mjs migrations/008_advisor_pages.sql --dry-run
 *   node backend/apply_migration.mjs migrations/008_advisor_pages.sql
 *
 * Run it from the backend/ directory (that is where `pg` is installed).
 *
 * --dry-run wraps the whole file in a transaction and ROLLS BACK, so it proves
 * the SQL applies cleanly against the real schema — permissions, constraints,
 * objects that already exist — without persisting anything. Always dry-run first.
 *
 * Unlike the older run_migration.mjs this reads the connection string from .env
 * rather than hardcoding credentials, and takes the migration path as an
 * argument instead of having one file baked in.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const file = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!file) {
  console.error("usage: node apply_migration.mjs <path/to/migration.sql> [--dry-run]");
  process.exit(1);
}
if (!fs.existsSync(file)) {
  console.error(`No such file: ${file}`);
  process.exit(1);
}

const env = Object.fromEntries(
  fs.readFileSync(path.resolve(import.meta.dirname, "..", ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

if (!env.DATABASE_URL) {
  console.error("DATABASE_URL missing from .env");
  process.exit(1);
}

// Supabase's pooler presents a self-signed chain; strip sslmode from the URL and
// let the explicit ssl option govern, matching the app's own pool.
const conn = env.DATABASE_URL.replace(/([?&])sslmode=[^&]*/g, "$1").replace(/[?&]$/, "");
const pool = new pg.Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });

const sql = fs.readFileSync(file, "utf8");
const client = await pool.connect();

try {
  console.log(`${dryRun ? "DRY RUN" : "APPLYING"}: ${file}`);
  console.log(`Target: ${conn.replace(/:[^:@/]+@/, ":****@")}\n`);

  await client.query("BEGIN");
  await client.query(sql);

  if (dryRun) {
    await client.query("ROLLBACK");
    console.log("✅ SQL applied cleanly inside a transaction, then rolled back.");
    console.log("   Nothing was changed. Re-run without --dry-run to commit.");
  } else {
    await client.query("COMMIT");
    console.log("✅ Migration committed.");
  }
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("\n❌ FAILED — nothing was committed.");
  console.error(`   ${err.message}`);
  if (err.position) {
    const upto = sql.slice(0, Number(err.position));
    console.error(`   near line ${upto.split("\n").length}: ${upto.split("\n").pop()?.trim()}`);
  }
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
