// Paywall SQL (docs/plans/2026-11-02-free-tier-paywall.md) on PGlite: migration 032 grandfathering,
// the limited-Free check from lib/entitlement.ts, the 3-check seed, and the create-profile savepoint.
// Run from backend/: npx tsx --test server/tests/freeTierSql.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const LIMITED = `SELECT lower(coalesce(plan, 'free')) = 'free' AND coalesce(free_full_access, false) = false AS limited
                   FROM agents WHERE id = $1`;

test("migration 032 grandfathers existing rows, limits new ones", async () => {
  const db = new PGlite();
  await db.exec(`CREATE TABLE agents (id text primary key, plan text DEFAULT 'free', invite_code text);
                 CREATE TABLE agent_credits (agent_id text primary key, balance int not null default 0, total_used int not null default 0);
                 INSERT INTO agents (id, plan) VALUES ('old-free','free'), ('old-paid','agent'), ('old-null', NULL);`);
  // before 032: the limited query errors (column missing) -> backend fails open
  await assert.rejects(db.query(LIMITED, ["old-free"]));
  const mig = fs.readFileSync(path.resolve("../migrations/032_free_full_access.sql"), "utf8");
  await db.exec(mig);
  for (const id of ["old-free", "old-paid", "old-null"]) {
    assert.equal((await db.query<any>(LIMITED, [id])).rows[0].limited, false, id);
  }
  await db.query(`INSERT INTO agents (id) VALUES ('new-free')`);
  assert.equal((await db.query<any>(LIMITED, ["new-free"])).rows[0].limited, true);
  await db.query(`UPDATE agents SET plan = 'Agent' WHERE id = 'new-free'`);
  assert.equal((await db.query<any>(LIMITED, ["new-free"])).rows[0].limited, false, "case-insensitive paid");

  // create-profile seed: DO NOTHING keeps an existing balance
  await db.query(`INSERT INTO agent_credits (agent_id, balance) VALUES ('x', 7)`);
  await db.query(`INSERT INTO agent_credits (agent_id, balance) VALUES ($1, 3) ON CONFLICT (agent_id) DO NOTHING`, ["x"]);
  await db.query(`INSERT INTO agent_credits (agent_id, balance) VALUES ($1, 3) ON CONFLICT (agent_id) DO NOTHING`, ["y"]);
  const bal = (await db.query<any>(`SELECT agent_id, balance FROM agent_credits ORDER BY agent_id`)).rows;
  assert.deepEqual(bal.map((r: any) => [r.agent_id, r.balance]), [["x", 7], ["y", 3]]);
});

test("savepoint keeps the signup when free_full_access is missing", async () => {
  const db = new PGlite();
  await db.exec(`CREATE TABLE agents (id text primary key, plan text DEFAULT 'free');`);
  await db.exec("BEGIN");
  await db.query(`INSERT INTO agents (id) VALUES ('a1')`);
  await db.exec("SAVEPOINT free_access");
  await assert.rejects(db.query(`UPDATE agents SET free_full_access = true WHERE id = 'a1'`));
  await db.exec("ROLLBACK TO SAVEPOINT free_access");
  await db.exec("COMMIT");
  assert.equal((await db.query<any>(`SELECT count(*)::int AS n FROM agents`)).rows[0].n, 1);
});
