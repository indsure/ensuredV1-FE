/**
 * How many catalogue rows describe more than one product?
 *
 * A plan sold as Classic / Select / Elite shares one UIN, so the catalogue holds one row and one
 * ranked value per axis. Where the variants differ on a ranked axis, that single value is wrong
 * for at least one of them. This measures how far that reaches before anyone designs a fix.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pkg from "pg";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
dotenv.config({ path: path.resolve(REPO_ROOT, ".env.local") });
dotenv.config({ path: path.resolve(REPO_ROOT, ".env") });

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Structural signals, not tier names: "Gold" is a variant in Health Guard and a product name
// elsewhere, so matching tier words alone would over-count badly.
const SIGNALS = [
  /\bvariants?\b/i,
  /\bplan option/i,
  /depending on (the )?(plan|variant)/i,
  /\bPlan [A-C]\b/,
  /(not )?(covered|available|applicable) (only )?(under|on|for) [A-Z][a-z]+ (plan|variant)/,
  /\b(Classic|Select|Elite|Silver|Gold|Platinum|Titanium|Bronze|Diamond)\s*[:&/,]/,
  /\b(Classic|Select|Elite|Silver|Gold|Platinum|Titanium|Bronze|Diamond)\s+(and|&|or)\s+[A-Z]/,
];

// Axes that decide a comparison. Variant drift on these changes the verdict.
const RANKED = ["room_rent", "icu", "copayment", "sub_limits", "deductible", "ped_waiting",
  "specific_waiting", "maternity", "restoration", "cumulative_bonus", "modern_treatments",
  "daycare", "opd", "consumables", "ambulance", "health_checkup", "domiciliary"];

const { rows } = await pool.query(
  "SELECT uin, insurer, plan_name, profile FROM policy_catalog WHERE is_active AND product_type = 'comprehensive_health_indemnity'",
);

let affected = [];
for (const r of rows) {
  const p = typeof r.profile === "string" ? JSON.parse(r.profile) : r.profile;
  const hitAxes = [];
  for (const k of RANKED) {
    const v = p?.[k];
    if (!v || typeof v !== "object") continue;
    const text = `${v.display ?? ""} ${v.note ?? ""}`;
    if (SIGNALS.some((re) => re.test(text))) hitAxes.push(k);
  }
  if (hitAxes.length) affected.push({ ...r, hitAxes });
}

console.log(`comparable plans: ${rows.length}`);
console.log(`plans whose RANKED axes describe more than one variant: ${affected.length}`);
console.log(`  that is ${((affected.length / rows.length) * 100).toFixed(0)}% of the catalogue\n`);

const byCount = {};
affected.forEach((a) => { byCount[a.hitAxes.length] = (byCount[a.hitAxes.length] || 0) + 1; });
console.log("how many ranked axes are affected per plan:");
Object.entries(byCount).sort((a, b) => +b[0] - +a[0]).forEach(([n, c]) =>
  console.log(`  ${String(n).padStart(2)} axes: ${c} plan(s)`));

const axisFreq = {};
affected.forEach((a) => a.hitAxes.forEach((k) => { axisFreq[k] = (axisFreq[k] || 0) + 1; }));
console.log("\nwhich axes drift by variant most often:");
Object.entries(axisFreq).sort((a, b) => b[1] - a[1]).slice(0, 10)
  .forEach(([k, n]) => console.log(`  ${String(n).padStart(3)}  ${k}`));

const byInsurer = {};
affected.forEach((a) => { byInsurer[a.insurer] = (byInsurer[a.insurer] || 0) + 1; });
console.log("\nworst affected insurers:");
Object.entries(byInsurer).sort((a, b) => b[1] - a[1]).slice(0, 8)
  .forEach(([k, n]) => console.log(`  ${String(n).padStart(3)}  ${k}`));

console.log("\nworst individual plans:");
affected.sort((a, b) => b.hitAxes.length - a.hitAxes.length).slice(0, 10)
  .forEach((a) => console.log(`  ${String(a.hitAxes.length).padStart(2)} axes  ${a.plan_name}  (${a.insurer.split(" ")[0]})`));

await pool.end();
