// ============================================================================
// Account deletion - the mirror of account export, and the one endpoint in this
// product where a bug is unrecoverable for the customer.
//
// Lives in its own module for the same reason teamRoutes.ts does: there is a
// property here that has to stay obvious to whoever reads it next.
//
//   THE ORDER IS THE SAFETY. Every step is arranged so that a failure at that
//   step leaves a state a RETRY CAN FINISH, never a state the person cannot
//   escape. Read docs/plans/2026-09-11-account-delete-and-export.md, section 6,
//   before moving anything:
//
//     1. Preconditions.      Refuse where other people's data is involved.
//     2. Collect storage.    The bucket keys exist ONLY inside the rows, so
//                            losing the rows first orphans the bytes forever.
//     3. Delete rows.        One transaction, foreign-key-safe order, all or
//                            nothing. A half-deleted account is not a state.
//     4. Delete objects.     Best effort, every failure logged with its key. A
//                            file left behind is recoverable by a later sweep;
//                            a row left behind is a live account.
//     5. Delete the login.   LAST. If this fails the person can still sign in
//                            and press the button again. Doing it first would
//                            lock them out of a half-deleted account with no
//                            way back in.
//
// The table list is NOT written here. It lives in ./accountData, is the same
// list the export reads, and that is the only thing keeping the two honest
// about each other.
//
// WHAT THIS MODULE WILL NOT DO: decide what happens to somebody else's data. A
// team owner with advisors under them is refused with a message naming what to
// do first, not "handled".
// ============================================================================

import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";

import { pool } from "../lib/db";
import { log } from "../lib/logger";
import {
  AGENT_TABLES,
  INDIVIDUAL_TABLES,
  deleteForTable,
  ACCOUNT_DELETE_CONFIRMATION,
  confirmationAccepted,
  isUuid,
  parseStorageUrl,
  ownsStoragePath,
  pendingUploadPathIsSafe,
  teamDeletionBlock,
  liveAnalysisCount,
  chunk,
  type OwnedTable,
  type StorageRef,
  type RunningJobLike,
  type TeamStanding,
} from "./accountData";

/* -- What this module needs from routes.ts -------------------------------- */

type Authenticate = (req: any, res: any) => Promise<string | null>;

export interface AccountDeletionDeps {
  /** Resolves a bearer token to a verified user id, or answers 401 itself. */
  verifyJwt: Authenticate;
  /** The same, for consumer accounts: rejects agents and requires a profile row. */
  requireIndividual: Authenticate;
  /** Service-role Supabase client. Only its storage and auth-admin halves are used. */
  supabaseAdmin: {
    storage: {
      from(bucket: string): {
        remove(paths: string[]): Promise<{ error: { message?: string } | null }>;
      };
    };
    auth: {
      admin: {
        deleteUser(id: string): Promise<{ error: (Error & { status?: number }) | null }>;
      };
    };
  };
  /** The in-memory analysis job cache, so a deletion cannot run under a live job.
   *  Typed as just the iteration it needs: a `Map<string, AnalysisJob>` is not
   *  assignable to `Map<string, RunningJobLike>` (Map is invariant), and nothing
   *  here has any business reaching into that cache by key. */
  analysisJobs: { values(): IterableIterator<RunningJobLike> };
  /** The bucket every uploaded document in this product lives in. */
  pdfBucket: string;
  /** Drop this user's verified tokens from the short-lived token cache, so a
   *  cached entry cannot outlive the account it authenticates. */
  forgetTokens: (userId: string) => void;
}

/* -- Tuning --------------------------------------------------------------- */

/** Keys per storage remove() call. Small enough that one bad batch costs little,
 *  large enough that a 500-policy account is a handful of calls. */
const STORAGE_BATCH = 50;

/** Second half of the advisory lock key. Arbitrary, constant, and namespaces
 *  these locks away from any other advisory lock the app might ever take. */
const LOCK_NAMESPACE = 90_11;

/**
 * Two int4s derived from the account's UUID, for `pg_try_advisory_xact_lock`.
 *
 * Computed here rather than with Postgres' `hashtext()` deliberately:
 * `hashtext` is an undocumented internal, and a deletion endpoint that throws
 * because an internal disappeared is a person who can never delete their
 * account. This needs nothing but arithmetic.
 */
export function advisoryLockKeys(accountId: string): [number, number] {
  const hex = accountId.replace(/-/g, "");
  // `| 0` wraps to a signed 32-bit int, which is what int4 accepts.
  return [parseInt(hex.slice(0, 8), 16) | 0, LOCK_NAMESPACE];
}

/* -- The tables the map does not cover ------------------------------------ */

/** One delete the shared table map cannot express, because its key is not
 *  `agent_id` or `user_id`. The account id is still the only bound parameter. */
export interface ExtraDelete {
  table: string;
  sql: string;
}

/**
 * Run by BOTH kinds of account, after the mapped tables.
 *
 * `pending_uploads.claimed_by` records who claimed a pre-signup upload, next to
 * the filename and size of an insurance document. Nothing else in the product
 * ever removes that row, so without this it outlives the account it names.
 */
export const SHARED_EXTRA_DELETES: ExtraDelete[] = [
  { table: "pending_uploads", sql: "DELETE FROM pending_uploads WHERE claimed_by = $1" },
];

/**
 * Run by advisor accounts only, in this order, and the order is load-bearing.
 *
 * `teams.owner_id` is `REFERENCES agents(id) ON DELETE RESTRICT` (migration 017,
 * deliberately, so that deleting an agent who still owns a team fails loudly
 * instead of orphaning every advisor under them). So `teams` MUST be deleted
 * before `agents`, and `agents` is last because nearly everything references it.
 *
 * The two team tables above it cascade from `agents` anyway; they are written
 * out so the deletion set is readable here rather than inferred from a migration.
 */
export const AGENT_EXTRA_DELETES: ExtraDelete[] = [
  {
    table: "team_access_log",
    sql: "DELETE FROM team_access_log WHERE owner_id = $1 OR member_id = $1",
  },
  { table: "team_invites", sql: "DELETE FROM team_invites WHERE invited_by = $1" },
  { table: "teams", sql: "DELETE FROM teams WHERE owner_id = $1" },
  { table: "agents", sql: "DELETE FROM agents WHERE id = $1" },
];

/* -- The references that BLOCK a delete of the agents row ----------------- */

/**
 * A foreign key pointing at `agents(id)` that will not get out of the way by
 * itself, cleared before the agents row is deleted.
 *
 * WHY THIS LIST EXISTS AT ALL. Most references to `agents(id)` are CASCADE or
 * SET NULL and need nothing from this code. Six are neither. Miss one and the
 * final `DELETE FROM agents` raises a foreign key violation, the whole
 * transaction rolls back, and the person is told "something went wrong" forever
 * while the same endpoint works for everybody else. That is not a hypothetical:
 * a live `pg_constraint` probe on 2026-09-11 found five unhandled, and four of
 * them were held by ONE real advisor's five `policies` rows.
 *
 * THE TRAP THE MAP CANNOT SEE. `analysis_jobs` is in AGENT_TABLES and deletion
 * clears it by `agent_id` - but the blocking constraint is on a DIFFERENT
 * column, `triggered_by_agent_id`. Deleting by one column does nothing about a
 * row that references the account through another. It is 0 rows today, so it is
 * a latent trap rather than a live break: the day anything starts writing that
 * column, account deletion breaks for every advisor at once.
 *
 * TO RE-VERIFY THIS LIST against the live database (read-only):
 *
 *   SELECT c.conrelid::regclass AS tbl,
 *          a.attname            AS col,
 *          c.confdeltype
 *     FROM pg_constraint c
 *     JOIN unnest(c.conkey) WITH ORDINALITY k(attnum, ord) ON true
 *     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
 *    WHERE c.contype = 'f'
 *      AND c.confrelid = 'public.agents'::regclass
 *      AND c.confdeltype IN ('a', 'r')     -- NO ACTION, RESTRICT
 *    ORDER BY 1, 2;
 *
 * Anything it returns that is not in BLOCKING_REFERENCES_PINNED (see
 * tests/accountDeletion.test.ts) is an unhandled blocker.
 */
export interface BlockingReference {
  table: string;
  column: string;
  /** `null` clears the pointer and keeps the row; `delete` removes the row. */
  action: "null" | "delete";
  sql: string;
  /** Why that choice, in one line. The long form is in the constant below. */
  why: string;
}

/**
 * DELETE OR NULL, DECIDED PER TABLE.
 *
 * The rule applied: NULL when the row is not this account's to destroy and the
 * agent id is only a pointer at them; DELETE when the row is a thing this
 * account created that is meaningless - or dangerous - without them.
 *
 * Nulling is the conservative half of that rule and is chosen four times out of
 * five on purpose. None of these four tables is in the account-data map, which
 * means nobody has decided their rows are this person's data: they are not
 * exported, so deleting them would destroy records the person was never given a
 * copy of, on a guess about ownership. A wrong NULL is a follow-up ticket; a
 * wrong DELETE is unrecoverable. On a T2 change that asymmetry decides it.
 *
 * The precedent is in the schema. `agent_connect_requests.assigned_agent_id`,
 * the one comparable "which agent is this pointed at" column whose intent is
 * written down, was deliberately made `ON DELETE SET NULL` in migration 006. An
 * assignment is a pointer to a person, not the person's data.
 *
 * `policies`, `reports` and `report_shares` are legacy. Migration 010 left them
 * standing as "empty, but still queried by live code"; the queries have since
 * been fixed (the admin dashboard reads the `policy_analyses` view now) and a
 * search of this repo finds no read or write of any of the three. They are dead
 * to the application - but "almost certainly dead" is not a licence to destroy
 * five rows whose contents nobody has looked at.
 */
export const AGENT_BLOCKING_REFERENCES: BlockingReference[] = [
  {
    table: "analysis_jobs",
    column: "triggered_by_agent_id",
    action: "null",
    why: "the job belongs to whoever owns it by agent_id, not to whoever triggered it",
    // Deleting here would destroy ANOTHER agent's job row because a third party
    // set it running. Only the pointer at the departing account is ours to clear.
    sql: "UPDATE analysis_jobs SET triggered_by_agent_id = NULL WHERE triggered_by_agent_id = $1",
  },
  {
    table: "policies",
    column: "created_by_agent_id",
    action: "null",
    why: "provenance on a legacy row whose ownership nobody has established",
    // Not in the account-data map, so not exported. Deleting would destroy a row
    // the person never received a copy of, on a guess. See the escalation note
    // in the deletion report: whether these five rows are personal data that
    // must also go is a founder decision, not this code's.
    sql: "UPDATE policies SET created_by_agent_id = NULL WHERE created_by_agent_id = $1",
  },
  {
    table: "policies",
    column: "assigned_agent_id",
    action: "null",
    why: "an assignment points AT a person; it is not their data",
    // Exactly the shape migration 006 made ON DELETE SET NULL for
    // agent_connect_requests.assigned_agent_id. Same intent, same treatment.
    sql: "UPDATE policies SET assigned_agent_id = NULL WHERE assigned_agent_id = $1",
  },
  {
    table: "reports",
    column: "reviewed_by_agent_id",
    action: "null",
    why: "audit provenance recording an action, on a row belonging to someone else",
    // A report does not stop existing because its reviewer closed their account,
    // and deleting one would destroy another party's record.
    sql: "UPDATE reports SET reviewed_by_agent_id = NULL WHERE reviewed_by_agent_id = $1",
  },
  {
    table: "report_shares",
    column: "created_by_agent_id",
    action: "delete",
    why: "it IS a share link this account created, and a share link must not outlive it",
    // THE ONE DELETE, and the plan singles out the reason: "A share link that
    // survives a deleted account is the worst single outcome here." Nulling the
    // creator would leave a live bearer capability minted by an account we just
    // told the person was gone. The row is meaningless without its creator and
    // dangerous with them removed, which is precisely when deleting is right.
    sql: "DELETE FROM report_shares WHERE created_by_agent_id = $1",
  },
];

/**
 * Legacy tables that are expected to disappear, and must not take account
 * deletion down with them when they do.
 *
 * Migration 010 left `policies`, `reports` and `report_shares` standing only
 * because live code still queried them, and says the intention is to drop them
 * once that is fixed. It has been fixed: nothing in this repo reads or writes
 * any of the three any more. So the drop is a matter of when, not whether.
 *
 * On the day it happens, an unguarded `UPDATE policies ...` here would raise
 * `42P01 undefined_table`, abort the transaction, and break account deletion for
 * every advisor - a cleanup turning into an outage on a statutory right. Each
 * blocking-reference statement therefore runs inside a SAVEPOINT, and a missing
 * table or column is logged and stepped over.
 */
export const BLOCKING_REFERENCE_TABLES_MAY_BE_ABSENT = ["policies", "reports", "report_shares"] as const;

/**
 * Deliberately absent from every list above: `individual_profiles`.
 *
 * It cascades from `auth.users` (migration 002), so the auth-user delete in step
 * 5 removes it atomically. Until that succeeds the row has to survive, or
 * `requireIndividual` answers NO_PROFILE and a consumer whose auth delete failed
 * can never retry. A post-delete sweep confirms the cascade actually fired.
 */
export const DELETED_BY_AUTH_CASCADE = ["individual_profiles"] as const;

/* -- Result shapes -------------------------------------------------------- */

interface DeletionOutcome {
  rowsDeleted: Record<string, number>;
  totalRows: number;
  storageFound: number;
  storageDeleted: number;
  /** Things that went wrong but did not stop the deletion. Shown to the person,
   *  because "your account is gone" should not quietly mean "mostly". */
  warnings: string[];
}

/* ========================================================================== */

export function registerAccountDeletionRoutes(app: Express, deps: AccountDeletionDeps): void {
  const {
    verifyJwt,
    requireIndividual,
    supabaseAdmin,
    analysisJobs,
    pdfBucket,
    forgetTokens,
  } = deps;

  /**
   * Deliberately tight. A deletion is a once-in-an-account-lifetime act, so a
   * caller making more than a handful an hour is either a bug or an attacker
   * holding a stolen token, and neither should get to keep trying.
   */
  const deleteLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "TOO_MANY_ATTEMPTS",
      message: "Too many account deletion attempts. Please wait an hour and try again.",
    },
  });

  /* -- Step 1: preconditions ---------------------------------------------- */

  /** Read the caller's standing in a team without changing anything. */
  async function readTeamStanding(agentId: string): Promise<TeamStanding> {
    const owned = await pool.query(
      "SELECT id, name FROM teams WHERE owner_id = $1",
      [agentId],
    );
    if (owned.rows.length === 0) {
      return { ownsTeam: false, teamName: null, otherMembers: 0, pendingInvites: 0 };
    }
    const team = owned.rows[0];

    // The owner is a member of their own team (`agents.team_id` is set for them
    // by createTeamForAgent), so they are excluded from the count. Counting them
    // would refuse every owner, including a solo one with nobody to strand.
    const members = await pool.query(
      "SELECT count(*)::int AS n FROM agents WHERE team_id = $1 AND id <> $2",
      [team.id, agentId],
    );
    const invites = await pool.query(
      `SELECT count(*)::int AS n FROM team_invites
        WHERE team_id = $1 AND status = 'pending' AND expires_at > now()`,
      [team.id],
    );

    return {
      ownsTeam: true,
      teamName: team.name ?? null,
      otherMembers: members.rows[0]?.n ?? 0,
      pendingInvites: invites.rows[0]?.n ?? 0,
    };
  }

  /* -- Step 2: collect storage keys, while the rows still exist ------------ */

  /**
   * Every bucket object this account owns.
   *
   * Three of the four sources hold a SIGNED URL rather than a key, so the key
   * has to be parsed back out; the key is recorded nowhere else, which is the
   * entire reason this runs before any row is deleted.
   *
   * Anything that does not parse, sits in another bucket, or does not carry this
   * account's id as its prefix is REPORTED AND LEFT ALONE. Deleting an object we
   * cannot prove belongs to this account is the one mistake in here that would
   * destroy a different customer's policy.
   */
  async function collectStorage(
    client: { query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }> },
    accountId: string,
    kind: "agent" | "individual",
    warnings: string[],
  ): Promise<StorageRef[]> {
    const refs: StorageRef[] = [];
    const seen = new Set<string>();

    const takeUrl = (url: unknown, source: string) => {
      const ref = parseStorageUrl(url);
      if (!ref) return; // predates file storage, or is not one of ours
      if (ref.bucket !== pdfBucket) {
        log.warn("account_delete_foreign_bucket", { accountId, source, bucket: ref.bucket });
        warnings.push(`A stored file in an unexpected bucket was left in place (${source}).`);
        return;
      }
      if (!ownsStoragePath(ref.path, accountId)) {
        log.warn("account_delete_unowned_path", { accountId, source, path: ref.path });
        warnings.push(`A stored file whose location we could not verify was left in place (${source}).`);
        return;
      }
      const key = `${ref.bucket}/${ref.path}`;
      if (seen.has(key)) return;
      seen.add(key);
      refs.push(ref);
    };

    const takePath = (path: unknown, source: string, allowPendingPrefix = false) => {
      const ok = allowPendingPrefix
        ? pendingUploadPathIsSafe(path, accountId)
        : ownsStoragePath(path, accountId);
      if (!ok) {
        log.warn("account_delete_unowned_path", { accountId, source, path: String(path) });
        warnings.push(`A stored file whose location we could not verify was left in place (${source}).`);
        return;
      }
      const key = `${pdfBucket}/${path as string}`;
      if (seen.has(key)) return;
      seen.add(key);
      refs.push({ bucket: pdfBucket, path: path as string });
    };

    if (kind === "agent") {
      const clients = await client.query(
        "SELECT pdf_url FROM clients WHERE agent_id = $1 AND pdf_url IS NOT NULL",
        [accountId],
      );
      for (const r of clients.rows) takeUrl(r.pdf_url, "clients.pdf_url");

      const leadPolicies = await client.query(
        "SELECT file_url FROM lead_policies WHERE agent_id = $1 AND file_url IS NOT NULL",
        [accountId],
      );
      for (const r of leadPolicies.rows) takeUrl(r.file_url, "lead_policies.file_url");

      const claimDocs = await client.query(
        "SELECT storage_path FROM claim_documents WHERE agent_id = $1 AND storage_path IS NOT NULL",
        [accountId],
      );
      for (const r of claimDocs.rows) takePath(r.storage_path, "claim_documents.storage_path");
    } else {
      const policies = await client.query(
        "SELECT pdf_url FROM individual_policies WHERE user_id = $1 AND pdf_url IS NOT NULL",
        [accountId],
      );
      for (const r of policies.rows) takeUrl(r.pdf_url, "individual_policies.pdf_url");
    }

    // Both kinds. A claimed pre-signup upload normally has its object removed at
    // claim time, so this is usually a no-op; remove() on an absent key is one
    // too, and the alternative is trusting that the best-effort cleanup ran.
    const pending = await client.query(
      "SELECT storage_path FROM pending_uploads WHERE claimed_by = $1 AND storage_path IS NOT NULL",
      [accountId],
    );
    for (const r of pending.rows) takePath(r.storage_path, "pending_uploads.storage_path", true);

    return refs;
  }

  /* -- Step 3: the rows, in one transaction -------------------------------- */

  /**
   * Delete every row this account owns, or none of them.
   *
   * The map's order is children-before-parents and is not re-derived here. What
   * IS here is everything the map deliberately does not cover, in the only order
   * the foreign keys allow:
   *
   *   ... the 22 mapped agent tables ...
   *   pending_uploads     (claimed_by)
   *   team_access_log     (owner_id / member_id)
   *   team_invites        (invited_by)
   *   teams               (owner_id)  <- MUST precede `agents`: ON DELETE RESTRICT
   *   agents              (id)
   *
   * The consumer side stops one short on purpose: `individual_profiles` is NOT
   * deleted here. It cascades from `auth.users`, so the auth-user delete in step
   * 5 removes it atomically - and until that succeeds the row has to survive, or
   * `requireIndividual` answers NO_PROFILE and a person whose auth delete failed
   * can never retry.
   */
  /**
   * Clear one blocking reference, tolerating the table having been dropped.
   *
   * `policies`, `reports` and `report_shares` are legacy and migration 010 says
   * out loud that the intention is to drop them once the last queries are fixed.
   * The day that happens, an un-guarded `UPDATE policies ...` raises
   * `42P01 undefined_table`, aborts the transaction, and account deletion breaks
   * for every advisor - turning a cleanup into an outage on a statutory right.
   *
   * So each statement runs inside a SAVEPOINT. A missing table or column is
   * rolled back to that savepoint and logged; the deletion carries on. Anything
   * else propagates and takes the whole transaction down, which is what we want
   * for a real failure.
   */
  async function clearBlockingReference(
    client: { query: (text: string, values?: unknown[]) => Promise<{ rowCount: number | null }> },
    accountId: string,
    ref: BlockingReference,
    counts: Record<string, number>,
  ): Promise<void> {
    // A savepoint name cannot be a bound parameter. It is built from the
    // constants above and never from a request, and stripped anyway so that a
    // future edit to that table cannot turn this line into an injection.
    const savepoint = `blocking_${ref.table}_${ref.column}`.replace(/[^a-z0-9_]/gi, "");
    await client.query(`SAVEPOINT ${savepoint}`);
    try {
      const r = await client.query(ref.sql, [accountId]);
      await client.query(`RELEASE SAVEPOINT ${savepoint}`);
      if (r.rowCount) {
        const label = `${ref.table}.${ref.column}`;
        counts[label] = (counts[label] ?? 0) + r.rowCount;
        // Loud on purpose. These four tables are believed dead; the first time
        // one of them actually holds rows for a departing account, somebody
        // should see it rather than find it in an audit a year later.
        log.warn("account_delete_blocking_reference_hit", {
          accountId,
          table: ref.table,
          column: ref.column,
          action: ref.action,
          rows: r.rowCount,
        });
      }
    } catch (err: any) {
      await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      if (err?.code === "42P01" || err?.code === "42703") {
        // The legacy table or column is gone. It cannot block anything now.
        log.info("account_delete_blocking_reference_absent", {
          table: ref.table,
          column: ref.column,
          code: err.code,
        });
        return;
      }
      throw err;
    }
  }

  async function deleteRows(
    client: { query: (text: string, values?: unknown[]) => Promise<{ rowCount: number | null }> },
    accountId: string,
    kind: "agent" | "individual",
  ): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};

    const run = async (label: string, sql: string) => {
      const r = await client.query(sql, [accountId]);
      if (r.rowCount) counts[label] = (counts[label] ?? 0) + r.rowCount;
    };

    const mapped: OwnedTable[] = kind === "agent" ? AGENT_TABLES : INDIVIDUAL_TABLES;
    for (const t of mapped) await run(t.table, deleteForTable(t));

    for (const d of SHARED_EXTRA_DELETES) await run(d.table, d.sql);

    if (kind === "agent") {
      // Clear every reference that would otherwise block the agents row, BEFORE
      // teams and agents go. See AGENT_BLOCKING_REFERENCES for the delete-or-null
      // reasoning on each one.
      for (const ref of AGENT_BLOCKING_REFERENCES) {
        await clearBlockingReference(client, accountId, ref, counts);
      }

      // `teams` before `agents` (ON DELETE RESTRICT), and any surviving invite or
      // access row for that team cascades with it. `agents.team_id` is ON DELETE
      // SET NULL, so this agent's own row survives its team disappearing, for the
      // moment it has left.
      for (const d of AGENT_EXTRA_DELETES) await run(d.table, d.sql);
    }

    return counts;
  }

  /* -- Step 4: the objects ------------------------------------------------- */

  /** Best effort, and loud about it. Never throws: the rows are already gone by
   *  the time this runs, so failing here must not turn a completed deletion into
   *  a 500 that reads as "nothing happened". */
  async function deleteObjects(
    accountId: string,
    refs: StorageRef[],
    warnings: string[],
  ): Promise<number> {
    let deleted = 0;
    for (const batch of chunk(refs, STORAGE_BATCH)) {
      const paths = batch.map((r) => r.path);
      try {
        const { error } = await supabaseAdmin.storage.from(batch[0].bucket).remove(paths);
        if (error) {
          log.error("account_delete_storage_failed", {
            accountId,
            bucket: batch[0].bucket,
            paths,
            message: error.message ?? String(error),
          });
          warnings.push(`${paths.length} stored file(s) could not be deleted and were logged for cleanup.`);
          continue;
        }
        deleted += paths.length;
      } catch (err: any) {
        log.error("account_delete_storage_threw", {
          accountId,
          bucket: batch[0].bucket,
          paths,
          message: err?.message ?? String(err),
        });
        warnings.push(`${paths.length} stored file(s) could not be deleted and were logged for cleanup.`);
      }
    }
    return deleted;
  }

  /* -- The whole act ------------------------------------------------------- */

  async function destroyAccount(
    accountId: string,
    kind: "agent" | "individual",
    res: Response,
  ): Promise<void> {
    const warnings: string[] = [];
    let refs: StorageRef[] = [];
    let counts: Record<string, number> = {};

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Two requests for the same account, arriving together, must not both walk
      // the tables. The loser is told to wait rather than racing the winner into
      // a half-collected storage list. Transaction-scoped, so it releases on
      // COMMIT or ROLLBACK with no unlock to forget.
      const [keyA, keyB] = advisoryLockKeys(accountId);
      const lock = await client.query(
        "SELECT pg_try_advisory_xact_lock($1::int, $2::int) AS got",
        [keyA, keyB],
      );
      if (!lock.rows[0]?.got) {
        await client.query("ROLLBACK");
        res.status(409).json({
          error: "DELETE_IN_PROGRESS",
          message: "This account is already being deleted. Give it a moment, then refresh.",
        });
        return;
      }

      // Collected INSIDE the transaction and BEFORE any delete. If anything here
      // throws we roll back and delete nothing: rows whose files we cannot find
      // are better than files nothing points at.
      refs = await collectStorage(client as any, accountId, kind, warnings);

      counts = await deleteRows(client as any, accountId, kind);

      await client.query("COMMIT");
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => {});
      log.error("account_delete_rows_failed", {
        accountId,
        kind,
        message: err?.message ?? String(err),
        code: err?.code,
      });
      res.status(500).json({
        error: "DELETE_FAILED",
        message: "Something went wrong and nothing was deleted. Please try again.",
      });
      return;
    } finally {
      client.release();
    }

    const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);
    log.info("account_rows_deleted", { accountId, kind, totalRows, tables: counts, storageFound: refs.length });

    // Step 4. Past this point the account's data is gone and the request has
    // succeeded; nothing below may turn that into a failure the user reads as
    // "nothing happened".
    const storageDeleted = await deleteObjects(accountId, refs, warnings);

    // Step 5. Last, on purpose.
    let authDeleted = false;
    try {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(accountId);
      if (error) {
        // Already gone is not a failure: a retry of a deletion whose auth half
        // succeeded should finish cleanly rather than report an error.
        const msg = (error.message ?? "").toLowerCase();
        if (error.status === 404 || msg.includes("not found") || msg.includes("user_not_found")) {
          authDeleted = true;
        } else {
          throw error;
        }
      } else {
        authDeleted = true;
      }
    } catch (err: any) {
      log.error("account_delete_auth_user_failed", {
        accountId,
        kind,
        message: err?.message ?? String(err),
      });
      forgetTokens(accountId);
      res.status(500).json({
        error: "AUTH_DELETE_FAILED",
        dataDeleted: true,
        message:
          "Your data has been deleted, but we could not remove your login. You can still sign in - " +
          "please press Delete account once more. If it keeps failing, contact us and we will finish it.",
        deleted: { rows: totalRows, files: storageDeleted },
        warnings,
      });
      return;
    }

    // Belt and braces. `individual_profiles` should have gone with the auth user
    // (ON DELETE CASCADE, migration 002). If that constraint is ever dropped,
    // this catches it and says so rather than leaving a named row behind.
    if (kind === "individual") {
      try {
        const left = await pool.query("DELETE FROM individual_profiles WHERE id = $1", [accountId]);
        if (left.rowCount) {
          log.warn("account_delete_profile_cascade_missing", { accountId, rows: left.rowCount });
        }
      } catch (err: any) {
        log.error("account_delete_profile_sweep_failed", { accountId, message: err?.message ?? String(err) });
        warnings.push("A profile record may have been left behind and has been logged for cleanup.");
      }
    }

    // A verified token stays cached for up to a minute. Without this, a deleted
    // account can still authenticate for that minute.
    forgetTokens(accountId);

    log.info("account_deleted", {
      accountId,
      kind,
      rows: totalRows,
      storageFound: refs.length,
      storageDeleted,
      authDeleted,
      warnings: warnings.length,
    });

    const outcome: DeletionOutcome = {
      rowsDeleted: counts,
      totalRows,
      storageFound: refs.length,
      storageDeleted,
      warnings,
    };

    res.json({
      deleted: true,
      message: "Your account and everything in it have been deleted. Any link you shared has stopped working.",
      ...outcome,
    });
  }

  /* -- The two endpoints --------------------------------------------------- */

  /**
   * Consumer account deletion.
   *
   * `requireIndividual` is the gate: it rejects agent accounts outright, so this
   * endpoint can never act on an advisor's id, and it requires the profile row -
   * which is exactly the row left standing when an auth delete fails, so a retry
   * gets back in here.
   */
  app.delete("/api/me/account", deleteLimiter, async (req: Request, res: Response) => {
    const userId = await requireIndividual(req, res);
    if (!userId) return;

    if (!isUuid(userId)) {
      log.error("account_delete_bad_account_id", { kind: "individual" });
      return res.status(500).json({ error: "DELETE_FAILED", message: "Something went wrong. Nothing was deleted." });
    }

    if (!confirmationAccepted(req.body)) {
      return res.status(400).json({
        error: "CONFIRMATION_REQUIRED",
        message: `To delete your account, send confirm: "${ACCOUNT_DELETE_CONFIRMATION}". Nothing has been deleted.`,
        expected: ACCOUNT_DELETE_CONFIRMATION,
      });
    }

    const running = liveAnalysisCount(analysisJobs.values(), userId, Date.now());
    if (running > 0) {
      return res.status(409).json({
        error: "ANALYSIS_RUNNING",
        message:
          `${running === 1 ? "A policy check is" : `${running} policy checks are`} still running on your account. ` +
          "Wait for it to finish (usually a minute or two), then try again. Nothing has been deleted.",
      });
    }

    try {
      await destroyAccount(userId, "individual", res);
    } catch (err: any) {
      log.error("me_account_delete_unhandled", { message: err?.message ?? String(err) });
      if (!res.headersSent) {
        res.status(500).json({ error: "DELETE_FAILED", message: "Something went wrong. Please try again." });
      }
    }
  });

  /**
   * Advisor account deletion.
   *
   * `verifyJwt` proves who the caller is but says nothing about what kind of
   * account it is, so the check below does. Without it a CONSUMER's token would
   * pass, delete nothing from the agent tables, and then delete their auth user -
   * taking their policies with it by cascade and orphaning their files. That is a
   * real hazard, not a hypothetical: the two surfaces share one uuid namespace.
   *
   * The third case is the retry path. An account whose rows are gone but whose
   * auth user survived (step 5 failed) has neither an `agents` row nor an
   * `individual_profiles` row. It is allowed through so the person can finish
   * what they started; it can only ever delete the caller's own login.
   */
  app.delete("/api/agent/account", deleteLimiter, async (req: Request, res: Response) => {
    const agentId = await verifyJwt(req, res);
    if (!agentId) return;

    if (!isUuid(agentId)) {
      log.error("account_delete_bad_account_id", { kind: "agent" });
      return res.status(500).json({ error: "DELETE_FAILED", message: "Something went wrong. Nothing was deleted." });
    }

    if (!confirmationAccepted(req.body)) {
      return res.status(400).json({
        error: "CONFIRMATION_REQUIRED",
        message: `To delete your account, send confirm: "${ACCOUNT_DELETE_CONFIRMATION}". Nothing has been deleted.`,
        expected: ACCOUNT_DELETE_CONFIRMATION,
      });
    }

    try {
      const isAgent = await pool.query("SELECT 1 FROM agents WHERE id = $1", [agentId]);
      if (isAgent.rows.length === 0) {
        const isConsumer = await pool.query("SELECT 1 FROM individual_profiles WHERE id = $1", [agentId]);
        if (isConsumer.rows.length > 0) {
          return res.status(403).json({
            error: "WRONG_ACCOUNT_TYPE",
            message: "This is a personal account. Delete it from your own account settings. Nothing has been deleted.",
          });
        }
        // Neither: an account with nothing left but a login. Fall through so the
        // interrupted deletion can be finished.
        log.warn("account_delete_orphan_login", { accountId: agentId });
      }

      const standing = await readTeamStanding(agentId);
      const blocked = teamDeletionBlock(standing);
      if (blocked) {
        log.info("account_delete_refused_team", {
          accountId: agentId,
          reason: blocked.error,
          otherMembers: standing.otherMembers,
          pendingInvites: standing.pendingInvites,
        });
        return res.status(409).json({ ...blocked, deleted: false });
      }

      const running = liveAnalysisCount(analysisJobs.values(), agentId, Date.now());
      if (running > 0) {
        return res.status(409).json({
          error: "ANALYSIS_RUNNING",
          message:
            `${running === 1 ? "A policy check is" : `${running} policy checks are`} still running on your account. ` +
            "Wait for it to finish (usually a minute or two), then try again. Nothing has been deleted.",
        });
      }

      await destroyAccount(agentId, "agent", res);
    } catch (err: any) {
      log.error("agent_account_delete_unhandled", { message: err?.message ?? String(err) });
      if (!res.headersSent) {
        res.status(500).json({ error: "DELETE_FAILED", message: "Something went wrong. Please try again." });
      }
    }
  });
}
