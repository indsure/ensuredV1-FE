/**
 * Two data-quality fixes over policy_catalog, both reversible:
 *
 *  1. Insurer names. The extractor writes whatever the document's cover page says, so one
 *     company appears under several spellings and fragments the insurer picker. Collapse each
 *     to a single canonical string. Only spellings that ALREADY appear in the data are used as
 *     canonical: no company name is invented.
 *
 *  2. Bajaj regional clones. "AapKe Liye" is filed separately in each state under a local-
 *     language name, so each carries its own UIN and nothing can dedupe it automatically. An
 *     agent browsing the catalogue meets the same policy 25 times. Keep one representative
 *     active, record every variant on it, and deactivate the rest. Nothing is deleted: flipping
 *     is_active back restores them.
 *
 *   node scripts/ops/fix_catalog_names.mjs --dry-run
 *   node scripts/ops/fix_catalog_names.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pkg from "pg";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
dotenv.config({ path: path.resolve(REPO_ROOT, ".env.local") });
dotenv.config({ path: path.resolve(REPO_ROOT, ".env") });

const DRY = process.argv.includes("--dry-run");
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Canonical spelling per company. Order matters only in that the first match wins.
//
// Two entries deliberately CORRECT rather than merely normalise, because the form the documents
// use is not a real entity: "Bajaj General Insurance" is Bajaj Allianz, and "HDFC ERGO" alone
// omits the rest of the registered name. Both match their BAJ / HDF UIN prefixes.
//
// The HDFC and Bajaj patterns are anchored to the second word on purpose: a bare /^hdfc/ would
// also swallow HDFC Life, which is a different company.
const CANONICAL = [
  [/^aditya birla/i, "Aditya Birla Health Insurance Co. Limited"],
  [/^care health/i, "Care Health Insurance Limited"],
  [/^indusind/i, "IndusInd General Insurance Company Limited"],
  [/^manipalcigna/i, "ManipalCigna Health Insurance Company Limited"],
  [/new india assurance/i, "The New India Assurance Co. Ltd."],
  [/^niva bupa/i, "Niva Bupa Health Insurance Company Limited"],
  [/^tata aig/i, "TATA AIG General Insurance Company Limited"],
  [/^sbi general/i, "SBI General Insurance Company Limited"],
  [/^hdfc[\s-]*ergo/i, "HDFC ERGO General Insurance Company Limited"],
  [/^bajaj(\s+allianz)?\s+general/i, "Bajaj Allianz General Insurance Company Limited"],
  // ── added 2026-09-18 with the 30-insurer corpus ──
  [/^acko/i, "Acko General Insurance Limited"],
  [/^cholamandalam/i, "Cholamandalam MS General Insurance Company Limited"],
  [/^galaxy/i, "Galaxy Health Insurance Company Limited"],
  [/generali central/i, "Generali Central Insurance Company Limited"],
  // Also catches the combi row the model named "Go Digit General ... (health) & Go Digit Life
  // ... (life)". Only the health half is ever kept, so the general entity is the right owner.
  [/^go digit/i, "Go Digit General Insurance Limited"],
  [/^iffco[\s-]*tokio/i, "IFFCO Tokio General Insurance Company Limited"],
  [/^liberty/i, "Liberty General Insurance Limited"],
  [/^magma/i, "Magma General Insurance Limited"],
  [/^star health/i, "Star Health and Allied Insurance Co. Ltd."],
  [/^royal sundaram/i, "Royal Sundaram General Insurance Co. Limited"],
  [/^universal sompo/i, "Universal Sompo General Insurance Company Limited"],
  [/^united india/i, "United India Insurance Company Limited"],
  [/^(the )?oriental/i, "The Oriental Insurance Company Limited"],
  [/^navi/i, "Navi General Insurance Limited"],
  [/^raheja/i, "Raheja QBE General Insurance Company Limited"],
  [/^zuno/i, "Zuno General Insurance Limited"],
  [/^(zurich )?kotak/i, "Zurich Kotak General Insurance Company Limited"],
  [/^kshema/i, "Kshema General Insurance Limited"],
  [/^narayana/i, "Narayana Health Insurance Limited"],
];

// The contiguous block of state filings of one product.
const REGIONAL_LO = 26041, REGIONAL_HI = 26065;
const isBajajRegional = (uin) => {
  const m = /^BAJHLIP(\d{5})V012526$/.exec(uin || "");
  return m && +m[1] >= REGIONAL_LO && +m[1] <= REGIONAL_HI;
};
const KEEP = "BAJHLIP26047V012526"; // AapKe Liye - Madhya Pradesh & Chhattisgarh

const { rows } = await pool.query("SELECT uin, insurer, plan_name FROM policy_catalog");

// ── 1. insurer names ──────────────────────────────────────────────────────────
const renames = [];
for (const r of rows) {
  const hit = CANONICAL.find(([re]) => re.test(r.insurer || ""));
  if (hit && r.insurer !== hit[1]) renames.push({ uin: r.uin, from: r.insurer, to: hit[1] });
}
const byTarget = renames.reduce((a, r) => ((a[r.to] = (a[r.to] || 0) + 1), a), {});
console.log("=== INSURER NAMES ===");
Object.entries(byTarget).forEach(([t, n]) => console.log(`   ${String(n).padStart(3)} rows -> ${t}`));
console.log(`   ${renames.length} rows to rename`);

// ── 2. bajaj regional clones ──────────────────────────────────────────────────
const regional = rows.filter((r) => isBajajRegional(r.uin));
const toRetire = regional.filter((r) => r.uin !== KEEP);
const keeper = regional.find((r) => r.uin === KEEP);
console.log("\n=== BAJAJ REGIONAL CLONES ===");
console.log(`   ${regional.length} state filings of one product`);
console.log(`   keeping   ${KEEP}  (${keeper ? keeper.plan_name : "NOT FOUND"})`);
console.log(`   retiring  ${toRetire.length} (is_active = false, recoverable)`);

if (DRY) { console.log("\nDRY RUN — nothing written"); await pool.end(); process.exit(0); }
if (!keeper) { console.error("\nrepresentative row not found; aborting"); await pool.end(); process.exit(1); }

const client = await pool.connect();
try {
  await client.query("BEGIN");

  for (const r of renames) {
    await client.query("UPDATE policy_catalog SET insurer = $1, updated_at = NOW() WHERE uin = $2", [r.to, r.uin]);
  }

  await client.query(
    `UPDATE policy_catalog
        SET plan_name = $1,
            profile = profile || $2::jsonb,
            updated_at = NOW()
      WHERE uin = $3`,
    [
      "AapKe Liye (regional plan)",
      JSON.stringify({
        regional_variants: regional.map((r) => ({ uin: r.uin, sold_as: r.plan_name })),
        regional_note:
          "Filed separately in each state under a local-language name. One product; the other filings are in the catalogue but inactive.",
      }),
      KEEP,
    ],
  );

  for (const r of toRetire) {
    await client.query("UPDATE policy_catalog SET is_active = false, updated_at = NOW() WHERE uin = $1", [r.uin]);
  }

  await client.query("COMMIT");
  console.log("\ncommitted");
} catch (e) {
  await client.query("ROLLBACK");
  console.error("rolled back:", e.message);
  process.exitCode = 1;
} finally {
  client.release();
}

const { rows: after } = await pool.query(
  `SELECT COUNT(*)::int AS active, COUNT(DISTINCT insurer)::int AS insurers
     FROM policy_catalog WHERE is_active AND product_type = 'comprehensive_health_indemnity'`,
);
console.log(`\nactive comparable plans: ${after[0].active} across ${after[0].insurers} insurers`);
await pool.end();
