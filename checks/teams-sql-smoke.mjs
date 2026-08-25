// End-to-end smoke test for the agency-team SQL, run inside ONE transaction
// that is always rolled back. It applies migration 017, builds a throwaway
// team out of two real agent rows, and exercises every statement the team
// routes issue — so a typo in a column name or an ambiguous ORDER BY fails here
// rather than in an owner's face.
//
// Reads and writes are confined to the transaction; nothing is committed.
//
//   npm run check:teams        (from the repo root)
//
// Needs DATABASE_URL in .env. Safe to run against production: the ROLLBACK is
// unconditional and lives in a finally.
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// `pg` lives in backend/node_modules, not the repo root, and this file sits in
// checks/. Resolve both the package and the paths from this file's own location
// so the script runs the same from anywhere.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pg = createRequire(path.join(ROOT, "backend", "package.json"))("pg");

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^["']|["']$/g, "")])
);
const pool = new pg.Pool({
  connectionString: (env.DATABASE_URL || "").replace(/([?&])sslmode=[^&]*/gi, "$1").replace(/[?&]+$/, ""),
  ssl: { rejectUnauthorized: false },
});

const CHECKS_PER_SEAT = 10;
const c = await pool.connect();
let failures = 0;

// Each step gets its own SAVEPOINT. Several checks deliberately provoke a
// constraint violation, and in Postgres a failed statement poisons the whole
// transaction — without this, the first expected failure silently skips every
// check after it and the run looks like a disaster.
let stepNo = 0;
async function step(label, fn) {
  const sp = `sp_${++stepNo}`;
  await c.query(`SAVEPOINT ${sp}`);
  try {
    const r = await fn();
    await c.query(`RELEASE SAVEPOINT ${sp}`);
    console.log(`  ok   ${label}${r === undefined ? "" : ` → ${r}`}`);
  } catch (e) {
    await c.query(`ROLLBACK TO SAVEPOINT ${sp}`).catch(() => {});
    failures++;
    console.log(`  FAIL ${label}: ${e.message}`);
  }
}

/** For checks that EXPECT a constraint to fire: the violation must not count as
 *  a failure, and the transaction must survive it. */
async function expectViolation(label, code, fn) {
  const sp = `sp_${++stepNo}`;
  await c.query(`SAVEPOINT ${sp}`);
  try {
    await fn();
    await c.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    failures++;
    console.log(`  FAIL ${label}: it was ALLOWED`);
  } catch (e) {
    await c.query(`ROLLBACK TO SAVEPOINT ${sp}`).catch(() => {});
    if (e.code === code) {
      console.log(`  ok   ${label} → blocked (${code})`);
    } else {
      failures++;
      console.log(`  FAIL ${label}: wrong error ${e.code} — ${e.message}`);
    }
  }
}

try {
  await c.query("BEGIN");
  await c.query(fs.readFileSync(path.join(ROOT, "migrations", "017_agency_teams.sql"), "utf8"));
  await c.query(fs.readFileSync(path.join(ROOT, "migrations", "018_enterprise_signup.sql"), "utf8"));
  console.log("migrations 017 + 018 applied (in transaction)");

  const agents = await c.query("SELECT id, email FROM agents ORDER BY created_at LIMIT 2");
  if (agents.rows.length < 2) throw new Error("need 2 agents to simulate a team");
  const [owner, member] = agents.rows;

  const team = await c.query(
    "INSERT INTO teams (name, owner_id, seats) VALUES ($1, $2, 6) RETURNING id, name, owner_id, seats",
    ["Smoke Test Agency", owner.id]
  );
  const teamId = team.rows[0].id;
  await c.query("UPDATE agents SET team_id = $1 WHERE id IN ($2, $3)", [teamId, owner.id, member.id]);

  console.log("\nteam read:");
  await step("GET /api/team — member list + usage", async () => {
    const r = await c.query(
      `SELECT a.id, COALESCE(a.full_name, a.name, '') AS name, a.email, a.created_at,
              (a.id = $2) AS is_owner,
              COALESCE(cr.balance, 0) AS checks_left,
              COALESCE(ocr.balance, 0) AS entry_left,
              (SELECT count(*) FROM customers c WHERE c.agent_id = a.id) AS customers,
              (SELECT count(*) FROM clients p WHERE p.agent_id = a.id) AS policies,
              GREATEST(
                COALESCE((SELECT max(created_at) FROM clients     WHERE agent_id = a.id), a.created_at),
                COALESCE((SELECT max(created_at) FROM customers   WHERE agent_id = a.id), a.created_at),
                COALESCE((SELECT max(created_at) FROM agent_leads WHERE agent_id = a.id), a.created_at)
              ) AS last_activity_at
         FROM agents a
         LEFT JOIN agent_credits     cr  ON cr.agent_id  = a.id
         LEFT JOIN agent_ocr_credits ocr ON ocr.agent_id = a.id
        WHERE a.team_id = $1
        ORDER BY (a.id = $2) DESC, name ASC`,
      [teamId, owner.id]
    );
    return `${r.rows.length} members`;
  });

  await step("GET /api/team — pending invites", async () => {
    const r = await c.query(
      `SELECT id, email, invited_name, expires_at, created_at FROM team_invites
        WHERE team_id = $1 AND status = 'pending' AND expires_at > now() ORDER BY created_at DESC`,
      [teamId]
    );
    return `${r.rows.length} invites`;
  });

  await step("member guard (agent must be on the team)", async () => {
    const r = await c.query(
      `SELECT id, COALESCE(full_name, name, '') AS name, email FROM agents WHERE id = $1 AND team_id = $2`,
      [member.id, teamId]
    );
    if (r.rows.length !== 1) throw new Error("member not resolved");
    return "resolves";
  });

  await step("member detail", async () => {
    const r = await c.query(
      `SELECT a.id, COALESCE(a.full_name, a.name, '') AS name, a.email, a.phone, a.city, a.created_at,
              COALESCE(cr.balance, 0) AS checks_left, COALESCE(ocr.balance, 0) AS entry_left,
              (SELECT count(*) FROM customers   WHERE agent_id = a.id) AS customers,
              (SELECT count(*) FROM clients     WHERE agent_id = a.id) AS policies,
              (SELECT count(*) FROM agent_leads WHERE agent_id = a.id) AS leads,
              (SELECT count(*) FROM claims      WHERE agent_id = a.id) AS claims
         FROM agents a
         LEFT JOIN agent_credits     cr  ON cr.agent_id  = a.id
         LEFT JOIN agent_ocr_credits ocr ON ocr.agent_id = a.id
        WHERE a.id = $1`,
      [member.id]
    );
    return `${r.rows.length} row`;
  });

  console.log("\nthe book (owner reads):");
  await step("policies — and NO pdf_url in the result", async () => {
    const r = await c.query(
      `SELECT id, name, policyholder_name, insurer, insurance_type, policy_name,
              sum_insured, expiry_date, score, status, created_at
         FROM clients WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 500`,
      [member.id]
    );
    const cols = r.fields.map((f) => f.name);
    if (cols.includes("pdf_url") || cols.includes("share_token")) throw new Error("leaked the raw document column");
    return `${r.rows.length} rows, ${cols.length} cols, no pdf_url`;
  });

  await step("customers", async () => {
    const r = await c.query(
      `SELECT c.id, c.name, c.phone, c.email, c.city, c.created_at,
              (SELECT count(*) FROM clients p WHERE p.customer_id = c.id) AS policies
         FROM customers c WHERE c.agent_id = $1 ORDER BY c.created_at DESC LIMIT 500`,
      [member.id]
    );
    return `${r.rows.length} rows`;
  });

  await step("leads", async () => {
    const r = await c.query(
      `SELECT id, name, phone, city, source, insurance_interest, expected_value,
              status, next_follow_up, created_at
         FROM agent_leads WHERE agent_id = $1 AND COALESCE(is_spam, false) = false
        ORDER BY created_at DESC LIMIT 500`,
      [member.id]
    );
    return `${r.rows.length} rows`;
  });

  await step("claims — record only, no document columns", async () => {
    const r = await c.query(
      `SELECT cl.id, cl.claim_type, cl.status, cl.insurer, cl.tpa, cl.hospital,
              cl.ailment, cl.claimed_amount, cl.settled_amount, cl.created_at,
              cu.name AS customer_name,
              (SELECT count(*) FROM claim_queries q WHERE q.claim_id = cl.id) AS query_rounds
         FROM claims cl LEFT JOIN customers cu ON cu.id = cl.customer_id
        WHERE cl.agent_id = $1 ORDER BY cl.created_at DESC LIMIT 500`,
      [member.id]
    );
    const cols = r.fields.map((f) => f.name);
    if (cols.some((x) => /storage_path|filename/.test(x))) throw new Error("leaked a document column");
    return `${r.rows.length} rows, no document columns`;
  });

  console.log("\ninvites:");
  let inviteId;
  await step("create (with signup code)", async () => {
    await c.query(
      `INSERT INTO invite_codes (code, is_active, max_uses, current_uses, expires_at)
       VALUES ($1, true, 1, 0, now() + interval '7 days')`,
      ["TEAMSMOKE1"]
    );
    const r = await c.query(
      `INSERT INTO team_invites (team_id, email, invited_name, token_hash, invited_by, expires_at, signup_code)
       VALUES ($1, $2, $3, $4, $5, now() + interval '7 days', $6) RETURNING id`,
      [teamId, "Smoke.Tester@Example.com", "Smoke Tester", "hash-abc", owner.id, "TEAMSMOKE1"]
    );
    inviteId = r.rows[0].id;
    return "created";
  });

  await expectViolation("one live invite per address (partial unique index bites)", "23505", () =>
    c.query(
      `INSERT INTO team_invites (team_id, email, token_hash, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, now() + interval '7 days')`,
      [teamId, "smoke.tester@example.com", "hash-def", owner.id]
    )
  );

  await step("revoke frees the address for a fresh invite", async () => {
    await c.query("UPDATE team_invites SET status = 'revoked' WHERE id = $1", [inviteId]);
    await c.query(
      `INSERT INTO team_invites (team_id, email, token_hash, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, now() + interval '7 days')`,
      [teamId, "SMOKE.TESTER@example.com", "hash-ghi", owner.id]
    );
    return "re-invite accepted after revoke";
  });

  await step("token lookup is by hash", async () => {
    const r = await c.query(
      `SELECT i.id, i.email, i.status, i.expires_at, i.signup_code, t.name AS team_name,
              COALESCE(o.full_name, o.name, o.email) AS owner_name
         FROM team_invites i JOIN teams t ON t.id = i.team_id JOIN agents o ON o.id = i.invited_by
        WHERE i.token_hash = $1`,
      ["hash-ghi"]
    );
    if (r.rows.length !== 1) throw new Error("hash lookup failed");
    return "resolves to one invite";
  });

  console.log("\nallowances:");
  await step("seed checks on join (ON CONFLICT keeps an existing balance)", async () => {
    await c.query(
      `INSERT INTO agent_credits (agent_id, balance) VALUES ($1, $2) ON CONFLICT (agent_id) DO NOTHING`,
      [member.id, CHECKS_PER_SEAT]
    );
    return "no overwrite";
  });

  await step("move checks between advisors", async () => {
    await c.query(
      `INSERT INTO agent_credits (agent_id, balance) VALUES ($1, 8)
       ON CONFLICT (agent_id) DO UPDATE SET balance = 8`,
      [owner.id]
    );
    await c.query("UPDATE agent_credits SET balance = balance - $1 WHERE agent_id = $2", [4, owner.id]);
    await c.query(
      `INSERT INTO agent_credits (agent_id, balance) VALUES ($1, $2)
       ON CONFLICT (agent_id) DO UPDATE SET balance = agent_credits.balance + $2`,
      [member.id, 4]
    );
    const r = await c.query("SELECT agent_id, balance FROM agent_credits WHERE agent_id IN ($1,$2)", [owner.id, member.id]);
    const from = r.rows.find((x) => x.agent_id === owner.id).balance;
    if (from !== 4) throw new Error(`source should hold 4, holds ${from}`);
    return "4 moved, source left with 4";
  });

  await expectViolation("balance can never go negative (CHECK holds)", "23514", () =>
    c.query("UPDATE agent_credits SET balance = -1 WHERE agent_id = $1", [owner.id])
  );

  console.log("\naudit:");
  await step("access log write + the advisor's own read", async () => {
    await c.query(
      `INSERT INTO team_access_log (team_id, owner_id, member_id, surface) VALUES ($1,$2,$3,'policies')`,
      [teamId, owner.id, member.id]
    );
    const r = await c.query(
      `SELECT l.id, l.surface, l.created_at, COALESCE(o.full_name, o.name, o.email) AS owner_name
         FROM team_access_log l JOIN agents o ON o.id = l.owner_id
        WHERE l.member_id = $1 ORDER BY l.created_at DESC LIMIT 100`,
      [member.id]
    );
    if (r.rows.length !== 1) throw new Error("advisor cannot see the read");
    return "advisor sees 1 read";
  });

  console.log("\nremoval:");
  await step("removing a member clears membership, deletes nothing", async () => {
    const before = await c.query("SELECT count(*)::int n FROM clients WHERE agent_id = $1", [member.id]);
    await c.query("UPDATE agents SET team_id = NULL, plan = 'free' WHERE id = $1", [member.id]);
    const after = await c.query("SELECT count(*)::int n FROM clients WHERE agent_id = $1", [member.id]);
    if (before.rows[0].n !== after.rows[0].n) throw new Error("removal destroyed policies");
    const still = await c.query("SELECT team_id FROM agents WHERE id = $1", [member.id]);
    if (still.rows[0].team_id !== null) throw new Error("membership not cleared");
    return `${after.rows[0].n} policies survive, membership cleared`;
  });

  await expectViolation("an agent who owns a team cannot be deleted out from under it", "23503", () =>
    c.query("DELETE FROM agents WHERE id = $1", [owner.id])
  );

  console.log("\nenterprise signup requests:");
  let requestId;
  await step("signup records the ask (the exact ON CONFLICT the route uses)", async () => {
    // Byte-for-byte the statement in routes.ts create-profile. A partial unique
    // index needs its predicate repeated in the conflict target, and getting
    // that wrong is a runtime error no typecheck would catch.
    const r = await c.query(
      `INSERT INTO team_requests (agent_id, agency_name, seats_wanted, contact_phone)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (agent_id) WHERE status = 'pending' DO NOTHING
       RETURNING id`,
      [member.id, "Smoke Agency", 8, "9876543210"]
    );
    requestId = r.rows[0].id;
    return "inserted";
  });

  await step("asking twice does not create a second live request", async () => {
    const again = await c.query(
      `INSERT INTO team_requests (agent_id, agency_name, seats_wanted, contact_phone)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (agent_id) WHERE status = 'pending' DO NOTHING
       RETURNING id`,
      [member.id, "Smoke Agency Again", 20, null]
    );
    if (again.rowCount !== 0) throw new Error("a second pending request was created");
    const n = await c.query("SELECT count(*)::int n FROM team_requests WHERE agent_id = $1", [member.id]);
    return `still ${n.rows[0].n} request`;
  });

  await step("the advisor's portal can see their pending ask", async () => {
    const r = await c.query(
      `SELECT agency_name, seats_wanted, status, created_at FROM team_requests
        WHERE agent_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
      [member.id]
    );
    if (r.rows.length !== 1) throw new Error("pending request not visible");
    return `${r.rows[0].agency_name}, ${r.rows[0].seats_wanted} seats wanted`;
  });

  await expectViolation("seats_wanted cannot be zero or negative", "23514", () =>
    c.query("UPDATE team_requests SET seats_wanted = 0 WHERE id = $1", [requestId])
  );

  await step("provisioning turns the ask into a real team", async () => {
    // The member was removed from the team above, so they are free to own one.
    const t = await c.query(
      "INSERT INTO teams (name, owner_id, seats) VALUES ($1, $2, $3) RETURNING id, seats",
      ["Smoke Agency", member.id, 6]
    );
    await c.query("UPDATE agents SET team_id = $1, plan = 'agency' WHERE id = $2", [t.rows[0].id, member.id]);
    await c.query(
      `UPDATE team_requests SET status = 'provisioned', team_id = $1, handled_at = now() WHERE id = $2`,
      [t.rows[0].id, requestId]
    );
    const check = await c.query(
      `SELECT r.status, r.team_id, a.plan FROM team_requests r JOIN agents a ON a.id = r.agent_id WHERE r.id = $1`,
      [requestId]
    );
    if (check.rows[0].status !== "provisioned" || !check.rows[0].team_id) throw new Error("request not marked provisioned");
    if (check.rows[0].plan !== "agency") throw new Error("owner not moved onto the agency plan");
    return `team created, owner on ${check.rows[0].plan}`;
  });

  await step("a provisioned request frees the advisor to ask again later", async () => {
    const r = await c.query(
      `INSERT INTO team_requests (agent_id, agency_name)
       VALUES ($1, $2)
       ON CONFLICT (agent_id) WHERE status = 'pending' DO NOTHING
       RETURNING id`,
      [member.id, "Second Agency"]
    );
    if (r.rowCount !== 1) throw new Error("partial index blocked a new ask after provisioning");
    return "new request accepted";
  });

  await step("team_requests is readable only by its own advisor", async () => {
    const r = await c.query(
      `SELECT policyname, cmd, qual FROM pg_policies
        WHERE schemaname='public' AND tablename='team_requests'`
    );
    if (r.rows.length !== 1) throw new Error(`expected 1 policy, found ${r.rows.length}`);
    if (r.rows[0].cmd !== "SELECT") throw new Error(`policy is ${r.rows[0].cmd}, not SELECT`);
    if (!/agent_id = auth\.uid\(\)/.test(r.rows[0].qual)) throw new Error(`unexpected qual: ${r.rows[0].qual}`);
    return "one SELECT policy, own rows only";
  });

  await step("018 still adds no second reader to any existing table", async () => {
    const r = await c.query(
      `SELECT tablename FROM pg_policies
        WHERE schemaname='public' AND qual ILIKE '%team%'
          AND tablename NOT IN ('teams','team_invites','team_access_log','team_requests')`
    );
    if (r.rows.length !== 0) throw new Error(`widened: ${r.rows.map((x) => x.tablename).join(", ")}`);
    return "no existing table mentions teams";
  });

} catch (e) {
  failures++;
  console.log("\nABORTED:", e.message);
} finally {
  await c.query("ROLLBACK").catch(() => {});
  c.release();
  await pool.end();
  console.log(`\nrolled back — production unchanged. ${failures === 0 ? "ALL CHECKS PASSED" : failures + " FAILURE(S)"}`);
  process.exit(failures === 0 ? 0 : 1);
}
