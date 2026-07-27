import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pkg from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '..', '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });
dotenv.config();

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.join(__dirname, 'catalog_seed');

const REQUIRED = ['uin', 'insurer', 'plan_name', 'product_type'];

async function run() {
  if (!fs.existsSync(SEED_DIR)) {
    console.error('No catalog_seed/ directory.');
    process.exit(1);
  }
  const files = fs.readdirSync(SEED_DIR).filter((f) => f.endsWith('.json'));
  console.log(`Loading ${files.length} seed file(s) from catalog_seed/…\n`);

  let ok = 0, skipped = 0;
  for (const file of files) {
    let seed;
    try {
      seed = JSON.parse(fs.readFileSync(path.join(SEED_DIR, file), 'utf-8'));
    } catch (e) {
      console.error(`  ✗ ${file}: invalid JSON — ${e.message}`);
      skipped++; continue;
    }
    const missing = REQUIRED.filter((k) => !seed[k]);
    if (missing.length) {
      console.error(`  ✗ ${file}: missing ${missing.join(', ')}`);
      skipped++; continue;
    }
    try {
      await pool.query(
        `INSERT INTO policy_catalog
           (uin, insurer, plan_name, product_type, sum_insured_options, profile, source_file, status, confidence, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW())
         ON CONFLICT (uin) DO UPDATE SET
           insurer = EXCLUDED.insurer,
           plan_name = EXCLUDED.plan_name,
           product_type = EXCLUDED.product_type,
           sum_insured_options = EXCLUDED.sum_insured_options,
           profile = EXCLUDED.profile,
           source_file = EXCLUDED.source_file,
           status = EXCLUDED.status,
           confidence = EXCLUDED.confidence,
           updated_at = NOW()`,
        [
          seed.uin, seed.insurer, seed.plan_name, seed.product_type,
          seed.sum_insured_options ?? null, JSON.stringify(seed),
          seed.source_file ?? null, seed.status ?? 'unverified', seed.confidence ?? null,
        ]
      );
      console.log(`  ✓ ${seed.insurer} / ${seed.plan_name}  [${seed.uin}]`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${file}: DB error — ${e.message}`);
      skipped++;
    }
  }

  const { rows } = await pool.query(
    `SELECT product_type, COUNT(*)::int AS n FROM policy_catalog WHERE is_active GROUP BY product_type ORDER BY n DESC`
  );
  console.log(`\nLoaded ${ok}, skipped ${skipped}. Catalog now holds:`);
  rows.forEach((r) => console.log(`  ${r.product_type}: ${r.n}`));
  process.exit(0);
}

run();
