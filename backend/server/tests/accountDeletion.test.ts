/**
 * Account deletion: the decisions, tested without an account to destroy.
 *
 * Run:
 *   npx tsx --test backend/server/tests/accountDeletion.test.ts
 *
 * NOTHING HERE TOUCHES A DATABASE, AND NOTHING HERE MAY. The live database is
 * shared by beta and prod; a test that "just deletes a throwaway account" is one
 * mistyped id away from deleting a real customer's. So the dangerous decisions
 * were written as pure functions precisely so they could be tested here, and
 * what is left unverified by this file is listed at the bottom of it.
 *
 * The four things this pins down:
 *
 *   1. A stray call cannot delete an account. Only one exact phrase can.
 *   2. Deletion never removes a storage object it cannot prove belongs to the
 *      account whose deletion asked for it. Paths come out of columns, and a
 *      column is data.
 *   3. An advisor who would strand other people is REFUSED, with a message that
 *      names what they must do first, rather than guessed at.
 *   4. `teams` is deleted before `agents`. Migration 017 made that FK
 *      ON DELETE RESTRICT on purpose; getting the order wrong turns every
 *      owner's deletion into a 500.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ACCOUNT_DELETE_CONFIRMATION,
  confirmationAccepted,
  isUuid,
  parseStorageUrl,
  ownsStoragePath,
  pendingUploadPathIsSafe,
  teamDeletionBlock,
  liveAnalysisCount,
  ANALYSIS_STALE_AFTER_MS,
  chunk,
  AGENT_TABLES,
  INDIVIDUAL_TABLES,
} from "../services/accountData";

import {
  advisoryLockKeys,
  AGENT_EXTRA_DELETES,
  SHARED_EXTRA_DELETES,
  DELETED_BY_AUTH_CASCADE,
} from "../services/accountDeletion";

const ACCOUNT = "11111111-2222-3333-4444-555555555555";
const SOMEONE_ELSE = "99999999-8888-7777-6666-555555555555";

/* ────────────────────────────────────────────────────────────────────────── */

describe("a stray call cannot delete an account", () => {
  it("refuses a request with no body at all", () => {
    assert.equal(confirmationAccepted(undefined), false);
    assert.equal(confirmationAccepted(null), false);
    assert.equal(confirmationAccepted({}), false);
  });

  it("refuses the shapes an accident actually takes", () => {
    // A retried request, a copied curl line, a mis-wired button: all of these
    // are what `{ confirm: true }` looks like, which is why it is not enough.
    assert.equal(confirmationAccepted({ confirm: true }), false);
    assert.equal(confirmationAccepted({ confirm: 1 }), false);
    assert.equal(confirmationAccepted({ confirm: "yes" }), false);
    assert.equal(confirmationAccepted({ confirm: "true" }), false);
    assert.equal(confirmationAccepted({ confirm: "delete" }), false);
    assert.equal(confirmationAccepted({ confirmed: ACCOUNT_DELETE_CONFIRMATION }), false);
    assert.equal(confirmationAccepted([ACCOUNT_DELETE_CONFIRMATION]), false);
  });

  it("refuses the phrase in the wrong case, so a passing sentence is not a command", () => {
    assert.equal(confirmationAccepted({ confirm: "delete my account" }), false);
    assert.equal(confirmationAccepted({ confirm: "Delete My Account" }), false);
  });

  it("refuses the phrase with anything else attached", () => {
    assert.equal(confirmationAccepted({ confirm: "DELETE MY ACCOUNT please" }), false);
    assert.equal(confirmationAccepted({ confirm: "DELETE MY ACCOUNTS" }), false);
    assert.equal(confirmationAccepted({ confirm: "DO NOT DELETE MY ACCOUNT" }), false);
  });

  it("accepts exactly the phrase, and forgives only the whitespace a paste carries", () => {
    assert.equal(confirmationAccepted({ confirm: ACCOUNT_DELETE_CONFIRMATION }), true);
    assert.equal(confirmationAccepted({ confirm: `  ${ACCOUNT_DELETE_CONFIRMATION}\n` }), true);
  });

  it("states the phrase in one place, so the API and any UI cannot drift apart", () => {
    assert.equal(ACCOUNT_DELETE_CONFIRMATION, "DELETE MY ACCOUNT");
  });
});

/* ────────────────────────────────────────────────────────────────────────── */

describe("an account id is a UUID, and the storage guard depends on it being one", () => {
  it("accepts a real Supabase user id in either case", () => {
    assert.equal(isUuid(ACCOUNT), true);
    assert.equal(isUuid("AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE"), true);
  });

  it("rejects everything that is not one", () => {
    for (const bad of ["", "abc", 42, null, undefined, {}, `${ACCOUNT}x`, ACCOUNT.slice(0, -1)]) {
      assert.equal(isUuid(bad as unknown), false, `${String(bad)} should not pass as a uuid`);
    }
  });
});

describe("recovering the storage key from a stored URL", () => {
  it("reads a signed URL, which is the only form the uploaders ever write", () => {
    const url =
      `https://khxbabotbvnyjwvqtumt.supabase.co/storage/v1/object/sign/policy-pdfs/` +
      `${ACCOUNT}/abc.pdf?token=eyJhbGciOi.some.signature`;
    assert.deepEqual(parseStorageUrl(url), { bucket: "policy-pdfs", path: `${ACCOUNT}/abc.pdf` });
  });

  it("reads a public URL and a nested key", () => {
    const url =
      `https://x.supabase.co/storage/v1/object/public/policy-pdfs/${ACCOUNT}/claims/c1/case/d1.pdf`;
    assert.deepEqual(parseStorageUrl(url), {
      bucket: "policy-pdfs",
      path: `${ACCOUNT}/claims/c1/case/d1.pdf`,
    });
  });

  it("returns null for a row that predates file storage or points somewhere else", () => {
    assert.equal(parseStorageUrl(null), null);
    assert.equal(parseStorageUrl(undefined), null);
    assert.equal(parseStorageUrl(""), null);
    assert.equal(parseStorageUrl("https://example.com/some/file.pdf"), null);
    assert.equal(parseStorageUrl("/storage/v1/object/sign/policy-pdfs"), null, "bucket with no key");
    assert.equal(parseStorageUrl(12345 as unknown), null);
  });
});

describe("deletion never removes an object it cannot prove is this account's", () => {
  it("accepts every shape the uploaders actually produce", () => {
    for (const path of [
      `${ACCOUNT}/9f0c.pdf`,                               // agent policy PDF
      `${ACCOUNT}/lead-policies/9f0c.pdf`,                  // lead policy
      `${ACCOUNT}/claims/c1/personal/d1.jpg`,               // claim document
      `${ACCOUNT}/advisor-page/l1/p1.pdf`,                  // advisor-page lead upload
    ]) {
      assert.equal(ownsStoragePath(path, ACCOUNT), true, path);
    }
  });

  it("REFUSES another account's object, which is the mistake that ends the product", () => {
    assert.equal(ownsStoragePath(`${SOMEONE_ELSE}/9f0c.pdf`, ACCOUNT), false);
    assert.equal(ownsStoragePath(`${SOMEONE_ELSE}/claims/c1/case/d.pdf`, ACCOUNT), false);
  });

  it("refuses a key that tries to climb out of the account's own prefix", () => {
    assert.equal(ownsStoragePath(`${ACCOUNT}/../${SOMEONE_ELSE}/9f0c.pdf`, ACCOUNT), false);
    assert.equal(ownsStoragePath(`/${ACCOUNT}/9f0c.pdf`, ACCOUNT), false);
  });

  it("refuses a prefix that merely starts with the id", () => {
    // `<id>-backup/...` starts with the id but is not inside the account's folder.
    assert.equal(ownsStoragePath(`${ACCOUNT}-backup/9f0c.pdf`, ACCOUNT), false);
    assert.equal(ownsStoragePath(ACCOUNT, ACCOUNT), false, "the folder itself is not an object");
    assert.equal(ownsStoragePath(`${ACCOUNT}/`, ACCOUNT), false, "an empty key is not an object");
  });

  it("refuses everything when the account id is not a uuid, rather than matching loosely", () => {
    assert.equal(ownsStoragePath("x/file.pdf", "x"), false);
    assert.equal(ownsStoragePath("/file.pdf", ""), false);
  });

  it("rejects non-strings without throwing", () => {
    assert.equal(ownsStoragePath(null, ACCOUNT), false);
    assert.equal(ownsStoragePath(undefined, ACCOUNT), false);
    assert.equal(ownsStoragePath(7 as unknown, ACCOUNT), false);
  });
});

describe("a claimed pre-signup upload sits under its own prefix", () => {
  it("allows the pending prefix, because the row's claimed_by is what proves ownership", () => {
    assert.equal(pendingUploadPathIsSafe("pending/abc123.pdf", ACCOUNT), true);
  });

  it("allows a key already under the account's folder", () => {
    assert.equal(pendingUploadPathIsSafe(`${ACCOUNT}/abc.pdf`, ACCOUNT), true);
  });

  it("still refuses traversal and absolute keys", () => {
    assert.equal(pendingUploadPathIsSafe("pending/../" + SOMEONE_ELSE + "/a.pdf", ACCOUNT), false);
    assert.equal(pendingUploadPathIsSafe("/pending/a.pdf", ACCOUNT), false);
  });

  it("refuses another account's folder", () => {
    assert.equal(pendingUploadPathIsSafe(`${SOMEONE_ELSE}/a.pdf`, ACCOUNT), false);
  });
});

/* ────────────────────────────────────────────────────────────────────────── */

describe("an advisor who would strand other people is refused, not guessed at", () => {
  const solo = { ownsTeam: false, teamName: null, otherMembers: 0, pendingInvites: 0 };

  it("lets through an advisor who owns no team", () => {
    assert.equal(teamDeletionBlock(solo), null);
  });

  it("lets through an owner whose team is only themselves", () => {
    // The owner is a member of their own team, so `otherMembers` excludes them.
    // Counting them here would refuse every owner, including one with nobody to
    // strand, and leave them unable to exercise a right we promise in writing.
    assert.equal(
      teamDeletionBlock({ ownsTeam: true, teamName: "Sharma Insurance", otherMembers: 0, pendingInvites: 0 }),
      null,
    );
  });

  it("refuses an owner with advisors under them, and names what to do first", () => {
    const block = teamDeletionBlock({
      ownsTeam: true, teamName: "Sharma Insurance", otherMembers: 3, pendingInvites: 0,
    });
    assert.ok(block, "must refuse");
    assert.equal(block!.error, "TEAM_HAS_MEMBERS");
    assert.match(block!.message, /Sharma Insurance/, "names the team");
    assert.match(block!.message, /3 other advisors/, "says how many");
    assert.match(block!.message, /Remove/, "names the action that unblocks them");
    assert.match(block!.message, /not decide what happens to them for you/,
      "says why we will not do it for them");
  });

  it("reads correctly for exactly one member", () => {
    const block = teamDeletionBlock({
      ownsTeam: true, teamName: "Sharma Insurance", otherMembers: 1, pendingInvites: 0,
    });
    assert.match(block!.message, /1 other advisor is still in it/);
  });

  it("refuses an owner with an invitation still in somebody's inbox", () => {
    const block = teamDeletionBlock({
      ownsTeam: true, teamName: "Sharma Insurance", otherMembers: 0, pendingInvites: 2,
    });
    assert.ok(block);
    assert.equal(block!.error, "TEAM_HAS_INVITES");
    assert.match(block!.message, /Revoke/);
    assert.match(block!.message, /team with no owner/);
  });

  it("reports the members first when both are outstanding", () => {
    const block = teamDeletionBlock({
      ownsTeam: true, teamName: "Sharma Insurance", otherMembers: 2, pendingInvites: 2,
    });
    assert.equal(block!.error, "TEAM_HAS_MEMBERS");
  });

  it("still reads sensibly when the team has no name", () => {
    const block = teamDeletionBlock({
      ownsTeam: true, teamName: null, otherMembers: 1, pendingInvites: 0,
    });
    assert.match(block!.message, /You own your team/);
  });

  it("never refuses a consumer account: the block is agent-side only", () => {
    // A consumer has no standing in a team at all, which is what `ownsTeam:false`
    // means here. This is the only input the consumer endpoint can produce.
    assert.equal(teamDeletionBlock(solo), null);
  });
});

/* ────────────────────────────────────────────────────────────────────────── */

describe("deletion will not run underneath a live analysis", () => {
  const now = 1_757_000_000_000;
  const fresh = now - 30_000;

  it("counts this account's pending and processing jobs", () => {
    const jobs = [
      { agentId: ACCOUNT, status: "pending", createdAt: fresh },
      { agentId: ACCOUNT, status: "processing", createdAt: fresh },
    ];
    assert.equal(liveAnalysisCount(jobs, ACCOUNT, now), 2);
  });

  it("ignores jobs belonging to anybody else", () => {
    const jobs = [
      { agentId: SOMEONE_ELSE, status: "processing", createdAt: fresh },
      { agentId: null, status: "processing", createdAt: fresh },      // anonymous analyzer
      { status: "processing", createdAt: fresh },                      // no owner at all
    ];
    assert.equal(liveAnalysisCount(jobs, ACCOUNT, now), 0);
  });

  it("ignores finished work", () => {
    const jobs = [
      { agentId: ACCOUNT, status: "completed", createdAt: fresh },
      { agentId: ACCOUNT, status: "failed", createdAt: fresh },
    ];
    assert.equal(liveAnalysisCount(jobs, ACCOUNT, now), 0);
  });

  it("treats an old job as abandoned, so one crash cannot block deletion forever", () => {
    // Deletion is an obligation under the DPDP Act, not a feature. A job that
    // died mid-flight must not become a permanent refusal.
    const stale = now - ANALYSIS_STALE_AFTER_MS - 1;
    assert.equal(liveAnalysisCount([{ agentId: ACCOUNT, status: "processing", createdAt: stale }], ACCOUNT, now), 0);
    const justInside = now - ANALYSIS_STALE_AFTER_MS + 1;
    assert.equal(liveAnalysisCount([{ agentId: ACCOUNT, status: "processing", createdAt: justInside }], ACCOUNT, now), 1);
  });

  it("ignores a job with no usable timestamp rather than counting it forever", () => {
    const jobs = [{ agentId: ACCOUNT, status: "processing", createdAt: NaN }];
    assert.equal(liveAnalysisCount(jobs, ACCOUNT, now), 0);
  });

  it("says zero for an account with nothing running", () => {
    assert.equal(liveAnalysisCount([], ACCOUNT, now), 0);
  });
});

/* ────────────────────────────────────────────────────────────────────────── */

describe("the deletion order the foreign keys demand", () => {
  const order = [
    ...AGENT_TABLES.map((t) => t.table),
    ...SHARED_EXTRA_DELETES.map((d) => d.table),
    ...AGENT_EXTRA_DELETES.map((d) => d.table),
  ];

  it("deletes teams BEFORE agents", () => {
    // teams.owner_id is REFERENCES agents(id) ON DELETE RESTRICT (migration 017),
    // written that way on purpose so deleting an agent who still owns a team
    // fails loudly rather than orphaning everyone under them. Reverse these two
    // and every team owner's deletion becomes a 500.
    assert.ok(order.indexOf("teams") < order.indexOf("agents"), "teams must precede agents");
  });

  it("deletes agents absolutely last", () => {
    assert.equal(order[order.length - 1], "agents");
  });

  it("clears the team audit trail and invites before the team itself", () => {
    assert.ok(order.indexOf("team_access_log") < order.indexOf("teams"));
    assert.ok(order.indexOf("team_invites") < order.indexOf("teams"));
  });

  it("names no table twice across the mapped and unmapped sets", () => {
    assert.equal(new Set(order).size, order.length);
  });

  it("binds the account id and never interpolates it", () => {
    for (const d of [...SHARED_EXTRA_DELETES, ...AGENT_EXTRA_DELETES]) {
      assert.match(d.sql, /^DELETE FROM [a-z_]+ WHERE /, `${d.table}: must be a plain DELETE`);
      assert.match(d.sql, /\$1/, `${d.table}: must bind the account id`);
      assert.ok(!/'/.test(d.sql), `${d.table}: no literal in the predicate`);
      assert.ok(d.sql.includes(` ${d.table} `), `${d.table}: sql must name its own table`);
    }
  });
});

describe("what the rows do not cover, and the share links that must die with them", () => {
  it("leaves individual_profiles to the auth-user cascade, and says so out loud", () => {
    // It is REFERENCES auth.users(id) ON DELETE CASCADE (migration 002). Deleting
    // it before the auth user would make requireIndividual answer NO_PROFILE to a
    // consumer whose auth delete failed, and they could never retry.
    assert.deepEqual([...DELETED_BY_AUTH_CASCADE], ["individual_profiles"]);
    const named = [
      ...INDIVIDUAL_TABLES.map((t) => t.table),
      ...SHARED_EXTRA_DELETES.map((d) => d.table),
      ...AGENT_EXTRA_DELETES.map((d) => d.table),
    ];
    assert.ok(!named.includes("individual_profiles"), "must not be deleted before the auth user");
  });

  it("kills every share surface with the account", () => {
    // A share link outliving a deleted account is the worst single outcome here.
    // public_reports is its own table; the policy share token is a column on
    // `clients`, and the calculator and comparison shares are rows in
    // calculator_reports / comparison_reports, so all four die with their rows.
    const agentTables = AGENT_TABLES.map((t) => t.table);
    for (const t of ["public_reports", "clients", "calculator_reports", "comparison_reports", "saved_comparisons"]) {
      assert.ok(agentTables.includes(t), `${t} must be in the deletion set`);
    }
  });

  it("removes the claimed pre-signup upload row, which nothing else ever does", () => {
    assert.ok(SHARED_EXTRA_DELETES.some((d) => d.table === "pending_uploads"));
  });
});

/* ────────────────────────────────────────────────────────────────────────── */

describe("two deletions of the same account cannot both walk the tables", () => {
  it("derives a stable lock key from the account id", () => {
    assert.deepEqual(advisoryLockKeys(ACCOUNT), advisoryLockKeys(ACCOUNT));
  });

  it("gives different accounts different keys", () => {
    assert.notDeepEqual(advisoryLockKeys(ACCOUNT), advisoryLockKeys(SOMEONE_ELSE));
  });

  it("stays inside int4, which is what pg_try_advisory_xact_lock accepts", () => {
    for (const id of [ACCOUNT, SOMEONE_ELSE, "ffffffff-ffff-ffff-ffff-ffffffffffff", "00000000-0000-0000-0000-000000000000"]) {
      for (const k of advisoryLockKeys(id)) {
        assert.ok(Number.isInteger(k), `${id}: ${k} is not an integer`);
        assert.ok(k >= -2147483648 && k <= 2147483647, `${id}: ${k} is outside int4`);
      }
    }
  });

  it("namespaces the lock with a constant second key", () => {
    assert.equal(advisoryLockKeys(ACCOUNT)[1], advisoryLockKeys(SOMEONE_ELSE)[1]);
  });
});

/* ────────────────────────────────────────────────────────────────────────── */

describe("storage keys are removed in batches", () => {
  it("splits a large account's files into whole batches", () => {
    const items = Array.from({ length: 125 }, (_, i) => i);
    const batches = chunk(items, 50);
    assert.equal(batches.length, 3);
    assert.deepEqual(batches.map((b) => b.length), [50, 50, 25]);
    assert.deepEqual(batches.flat(), items, "no key is dropped or duplicated");
  });

  it("returns nothing for an account with no files", () => {
    assert.deepEqual(chunk([], 50), []);
  });

  it("refuses a batch size that would loop forever", () => {
    assert.throws(() => chunk([1, 2], 0));
  });
});

/* ──────────────────────────────────────────────────────────────────────────
 * WHAT THIS FILE DOES NOT VERIFY, AND WHY
 *
 * Deliberately untested here, because testing it means writing to the live
 * database that beta and prod share:
 *
 *   - that the transaction really is all-or-nothing;
 *   - that the 22 mapped tables plus the five unmapped ones really are every
 *     table holding an account's rows (the map is pinned against an
 *     information_schema probe in accountData.test.ts, not against today's
 *     schema);
 *   - that no OTHER foreign key referencing agents(id) is RESTRICT, which would
 *     make the final delete throw. It would roll the whole transaction back and
 *     delete nothing, which is the safe failure, but it would also mean no
 *     advisor can ever delete their account;
 *   - that supabaseAdmin.auth.admin.deleteUser really cascades
 *     individual_profiles;
 *   - that a storage object is actually gone afterwards.
 *
 * Those five belong in a rehearsal on a throwaway account, with the bucket and
 * the auth user checked by hand afterwards. Until that rehearsal happens, this
 * code has been reasoned about but not proven.
 * ────────────────────────────────────────────────────────────────────────── */
