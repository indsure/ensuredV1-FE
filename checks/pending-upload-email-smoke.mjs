// End-to-end smoke test for claiming a parked upload by confirmed email, run
// inside ONE transaction that is always rolled back.
//
// It exercises the exact SQL the routes issue, against the real schema, so a
// typo in a column name or a wrong predicate fails here rather than the first
// time somebody opens a confirmation email on their phone.
//
//   npm run check:pending-email
//
// Reads DATABASE_URL from .env. Safe against production: the ROLLBACK is
// unconditional and lives in a finally.
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pg = createRequire(path.join(ROOT, "backend", "package.json"))("pg");

let url = process.env.DATABASE_URL;
for (const f of [".env", ".env.local"]) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/);
    if (m) url = m[1].trim();
  }
}
if (!url) { console.error("No DATABASE_URL"); process.exit(1); }

const c = new pg.Client({ connectionString: url.split("?")[0], ssl: { rejectUnauthorized: false } });
let failures = 0;
const ok   = (n, d) => console.log(`  ok   ${n} → ${d}`);
const fail = (n, d) => { failures++; console.log(`  FAIL ${n} → ${d}`); };
const check = (n, cond, d) => (cond ? ok(n, d) : fail(n, d));

await c.connect();
await c.query("BEGIN");
try {
  // A real confirmed user to stand in for someone who just clicked the link.
  const u = (await c.query(
    "SELECT id, email FROM auth.users WHERE email_confirmed_at IS NOT NULL LIMIT 1"
  )).rows[0];
  if (!u) throw new Error("no confirmed user to test with");

  const mk = async (tok, email, opts = {}) => {
    const { claimed = false, expired = false } = opts;
    const r = await c.query(
      `INSERT INTO pending_uploads
         (token, storage_path, filename, file_size, mime_type, insurance_type,
          expires_at, signup_email, claimed_by, claimed_at)
       VALUES ($1,'pending/smoke.pdf','smoke.pdf',1024,'application/pdf','health',
               now() + ($2 || ' hours')::interval, $3, $4, $5)
       RETURNING id`,
      [tok, expired ? "-1" : "24", email, claimed ? u.id : null, claimed ? new Date() : null]
    );
    return r.rows[0].id;
  };

  // The query the claim endpoint runs when no token is presented.
  const byEmail = async (email) => (await c.query(
    `SELECT id FROM pending_uploads
      WHERE lower(signup_email) = lower($1)
        AND claimed_by IS NULL
        AND expires_at > now()
      ORDER BY created_at DESC, id DESC
      LIMIT 1`, [email])).rows[0]?.id ?? null;

  console.log("\nattach:");
  const idA = await mk("smoke-tok-a", null);
  await c.query(
    `UPDATE pending_uploads SET signup_email = $1
      WHERE token = $2 AND claimed_by IS NULL AND expires_at > now() AND signup_email IS NULL`,
    [u.email.toLowerCase(), "smoke-tok-a"]);
  check("attaching the address to a live row",
    (await c.query("SELECT signup_email FROM pending_uploads WHERE id=$1", [idA])).rows[0].signup_email
      === u.email.toLowerCase(), "attached");

  await c.query(
    `UPDATE pending_uploads SET signup_email = $1
      WHERE token = $2 AND claimed_by IS NULL AND expires_at > now() AND signup_email IS NULL`,
    ["attacker@example.com", "smoke-tok-a"]);
  check("a token cannot be re-pointed at another address",
    (await c.query("SELECT signup_email FROM pending_uploads WHERE id=$1", [idA])).rows[0].signup_email
      === u.email.toLowerCase(), "second attach ignored");

  console.log("\nclaim by confirmed email:");
  check("finds the row for that address", await byEmail(u.email) === idA, "found");
  check("matches case-insensitively", await byEmail(u.email.toUpperCase()) === idA, "found");
  check("no match for an unrelated address", await byEmail("nobody@example.invalid") === null, "not found");

  const idNewer = await mk("smoke-tok-newer", u.email.toLowerCase());
  // now() is transaction time in Postgres, so both rows would otherwise share
  // created_at and this would be testing the tiebreaker, not recency.
  await c.query("UPDATE pending_uploads SET created_at = now() + interval '1 minute' WHERE id=$1", [idNewer]);
  check("picks the newest of several", await byEmail(u.email) === idNewer, "newest wins");

  console.log("\nwhat must NOT be claimable:");
  await c.query("DELETE FROM pending_uploads WHERE token LIKE 'smoke-tok-%'");
  await mk("smoke-tok-claimed", u.email.toLowerCase(), { claimed: true });
  check("an already-claimed row", await byEmail(u.email) === null, "excluded");

  await c.query("DELETE FROM pending_uploads WHERE token LIKE 'smoke-tok-%'");
  await mk("smoke-tok-expired", u.email.toLowerCase(), { expired: true });
  check("an expired row", await byEmail(u.email) === null, "excluded");

  await c.query("DELETE FROM pending_uploads WHERE token LIKE 'smoke-tok-%'");
  await mk("smoke-tok-null", null);
  check("a row with no address attached", await byEmail(u.email) === null, "excluded");

  console.log("\non claim:");
  await c.query("DELETE FROM pending_uploads WHERE token LIKE 'smoke-tok-%'");
  const idC = await mk("smoke-tok-clear", u.email.toLowerCase());
  await c.query(
    "UPDATE pending_uploads SET claimed_by=$1, claimed_at=now(), signup_email=NULL WHERE id=$2",
    [u.id, idC]);
  const after = (await c.query("SELECT signup_email, claimed_by FROM pending_uploads WHERE id=$1", [idC])).rows[0];
  check("the address is cleared", after.signup_email === null, "cleared");
  check("the row is marked claimed", after.claimed_by === u.id, "claimed");
  check("and is no longer findable by address", await byEmail(u.email) === null, "excluded");

  console.log("\nindex:");
  check("the partial index exists",
    (await c.query("SELECT 1 FROM pg_indexes WHERE tablename='pending_uploads' AND indexname='pending_uploads_signup_email_idx'")).rowCount === 1,
    "present");
} catch (e) {
  failures++;
  console.log("\nERROR:", e.message);
} finally {
  await c.query("ROLLBACK");
  await c.end();
  console.log(`\nrolled back — production unchanged. ${failures === 0 ? "ALL CHECKS PASSED" : failures + " FAILED"}`);
  process.exit(failures === 0 ? 0 : 1);
}
