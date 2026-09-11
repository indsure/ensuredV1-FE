/**
 * The one list of everywhere a person's data lives.
 *
 * Export reads this list. Deletion walks the same list in reverse. That is the
 * entire point of the module: a table added to one is added to the other, and a
 * table nobody remembered is missing from both in a way a test can catch, rather
 * than exported but never deleted (a broken promise) or deleted but never
 * exported (a person losing data they were entitled to take with them).
 *
 * The ordering is foreign-key-safe for deletion: children first, parents last.
 * Do not reorder casually. `claims` must outlive `claim_documents` because the
 * documents reference it; `agents` is last because almost everything references
 * that.
 *
 * WHAT IS NOT HERE
 * Object storage. The bytes of a policy PDF or a claim document are not rows,
 * and their paths are recorded only in the rows that point at them, which is why
 * deletion has to collect the paths BEFORE it deletes anything. Storage is
 * handled explicitly at the call site rather than pretended to be a table.
 */

/** A table holding rows owned by one account, and the column that says so. */
export interface OwnedTable {
  table: string;
  /** The column carrying the account id. */
  key: "agent_id" | "user_id" | "id";
  /** Included in an export. Ledgers and audit rows are deleted but not exported:
   *  they are our records of access, not the customer's data about themselves. */
  exportable: boolean;
  /** Shown as this heading in the export bundle. */
  label: string;
}

/**
 * Advisor-owned tables, in deletion order (children before parents).
 * Verified against information_schema on 2026-09-11: 22 tables carry agent_id.
 */
export const AGENT_TABLES: OwnedTable[] = [
  { table: "claim_documents",     key: "agent_id", exportable: true,  label: "Claim documents" },
  { table: "claim_events",        key: "agent_id", exportable: true,  label: "Claim history" },
  { table: "claim_queries",       key: "agent_id", exportable: true,  label: "Insurer queries" },
  { table: "claims",              key: "agent_id", exportable: true,  label: "Claims" },
  { table: "lead_policies",       key: "agent_id", exportable: true,  label: "Lead policies" },
  { table: "agent_leads",         key: "agent_id", exportable: true,  label: "Leads" },
  { table: "public_reports",      key: "agent_id", exportable: false, label: "Shared report links" },
  { table: "saved_comparisons",   key: "agent_id", exportable: true,  label: "Saved comparisons" },
  { table: "comparison_reports",  key: "agent_id", exportable: true,  label: "Comparisons" },
  { table: "calculator_reports",  key: "agent_id", exportable: true,  label: "Cover calculations" },
  { table: "agent_summaries",     key: "agent_id", exportable: true,  label: "Summaries" },
  { table: "analysis_jobs",       key: "agent_id", exportable: false, label: "Analysis jobs" },
  { table: "batch_uploads",       key: "agent_id", exportable: false, label: "Batch uploads" },
  { table: "clients",             key: "agent_id", exportable: true,  label: "Policies" },
  { table: "customers",           key: "agent_id", exportable: true,  label: "Customers" },
  { table: "empanelments",        key: "agent_id", exportable: true,  label: "Empanelments" },
  { table: "agent_pages",         key: "agent_id", exportable: true,  label: "Advisor page" },
  { table: "notifications",       key: "agent_id", exportable: false, label: "Notifications" },
  { table: "agent_credits",       key: "agent_id", exportable: false, label: "Policy check balance" },
  { table: "agent_ocr_credits",   key: "agent_id", exportable: false, label: "Data entry balance" },
  { table: "team_requests",       key: "agent_id", exportable: false, label: "Team requests" },
  { table: "access_audit_log",    key: "agent_id", exportable: false, label: "Access log" },
];

/** Consumer-owned tables, in deletion order. */
export const INDIVIDUAL_TABLES: OwnedTable[] = [
  { table: "individual_policies",     key: "user_id", exportable: true,  label: "Policies" },
  { table: "agent_connect_requests",  key: "user_id", exportable: false, label: "Advisor requests" },
];

/**
 * Build the parameterised SELECT for one table.
 *
 * Table and column names cannot be bound as parameters, so they are taken only
 * from the constants above and never from a request. The account id IS bound.
 * Anything reaching this function from user input would be a programming error,
 * which is why it accepts an OwnedTable rather than a string.
 */
export function selectForTable(t: OwnedTable): string {
  return `SELECT * FROM ${t.table} WHERE ${t.key} = $1`;
}

/** The same, for deletion. Separate function so the two intents read differently
 *  at the call site and neither can be mistaken for the other in review. */
export function deleteForTable(t: OwnedTable): string {
  return `DELETE FROM ${t.table} WHERE ${t.key} = $1`;
}

/* ══════════════════════════════════════════════════════════════════════════
 * DELETION-ONLY CONCERNS
 *
 * Everything above is shared by export and deletion. Everything below exists
 * only because deletion is irreversible, and is kept pure - no database, no
 * network, no clock of its own - so the dangerous decisions can be tested
 * without a live account to destroy.
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * WHAT THE TABLE MAP ABOVE DELIBERATELY DOES NOT COVER, AND WHY.
 *
 * The map is keyed on `agent_id` / `user_id`. Five more tables hold a person's
 * data under a different key, and deletion handles each one explicitly at the
 * call site rather than bending the map's shape around them:
 *
 *   agents              keyed `id`        the advisor's identity row.
 *   individual_profiles keyed `id`        the consumer's identity row. It carries
 *                                         `REFERENCES auth.users(id) ON DELETE
 *                                         CASCADE` (migration 002), so it is
 *                                         deleted BY the auth-user delete and
 *                                         must NOT be deleted before it: a
 *                                         consumer whose auth delete failed needs
 *                                         this row to still exist, or
 *                                         `requireIndividual` answers NO_PROFILE
 *                                         and they can never retry.
 *   teams               keyed `owner_id`  `ON DELETE RESTRICT` on owner_id, so the
 *                                         agents row cannot go until the team has.
 *   team_invites        keyed `invited_by`
 *   team_access_log     keyed `owner_id` / `member_id`
 *
 * And one table keyed on neither: `pending_uploads.claimed_by` holds the account
 * id of whoever claimed a pre-signup upload, alongside the filename and size of
 * an insurance document. The object is removed at claim time but the row is not,
 * so without this it would outlive the account it names.
 */

/**
 * The exact words a caller must send to destroy an account.
 *
 * WHY A TYPED PHRASE AND NOT `{ confirm: true }`: a boolean is what a retried
 * request, a copied curl line or a mis-wired button sends by accident. This
 * cannot be produced by accident - it has to be constructed on purpose, and a
 * UI can only obtain it by making a person type it.
 *
 * WHY NOT THE ACCOUNT'S EMAIL (the GitHub pattern): the email is not a secret,
 * so binding to it buys no security, only the appearance of it. It also forces
 * the server to tell the client what to expect, and turns a typo into a
 * confusing refusal. The phrase says plainly what the act is.
 *
 * WHY NOT A PASSWORD: re-authentication would be a genuine improvement and is
 * NOT implemented here. It would need a password re-check that every
 * phone-login (and any future OAuth) account could pass, which is its own
 * change. Flagged rather than faked.
 *
 * Case-sensitive on purpose: an uppercase phrase is what a confirmation input
 * can demand, and lowering it would let "delete my account" typed in passing
 * into some other field mean the same thing.
 */
export const ACCOUNT_DELETE_CONFIRMATION = "DELETE MY ACCOUNT";

/**
 * Is this request body an explicit instruction to delete?
 *
 * Surrounding whitespace is forgiven because a copy-paste carries it and it
 * changes nothing about intent. Nothing else is.
 */
export function confirmationAccepted(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const value = (body as Record<string, unknown>).confirm;
  if (typeof value !== "string") return false;
  return value.trim() === ACCOUNT_DELETE_CONFIRMATION;
}

/** Account ids come from Supabase Auth and are always UUIDs. Checked because a
 *  non-UUID id would weaken the storage-prefix test below into a wildcard. */
export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

/** A storage object: which bucket, and the key inside it. */
export interface StorageRef {
  bucket: string;
  path: string;
}

/**
 * Recover the storage object behind a stored URL.
 *
 * `clients.pdf_url`, `lead_policies.file_url` and `individual_policies.pdf_url`
 * hold a SIGNED URL, not a path - the path exists nowhere else, which is the
 * reason deletion has to read these rows before it deletes them. The pattern
 * matched here is the same one four read paths in routes.ts already use; it is
 * lifted rather than re-invented, so a URL those can open is a URL this can
 * delete.
 *
 * Returns null for anything unrecognised. Older rows predate file storage, and
 * an external URL is not ours to delete.
 */
export function parseStorageUrl(url: unknown): StorageRef | null {
  if (typeof url !== "string" || url.length === 0) return null;
  const m = url.match(/\/storage\/v1\/object\/(?:sign|public)\/(.+?)(?:\?|$)/);
  if (!m) return null;
  const [bucket, ...rest] = m[1].split("/");
  const path = rest.join("/");
  if (!bucket || !path) return null;
  return { bucket, path };
}

/**
 * Does this object key belong to this account?
 *
 * THE POINT OF THIS FUNCTION: every path deletion acts on is derived from a
 * column, and a column is data. A corrupted, hand-edited or maliciously written
 * `pdf_url` could name any object in the bucket, including another customer's
 * policy. Every upload path in the product is built as `<accountId>/...`
 * (`<agentId>/<clientId>.pdf`, `<agentId>/claims/...`,
 * `<agentId>/lead-policies/...`, `<agentId>/advisor-page/...`,
 * `<userId>/<policyId>.pdf`), so the account-id prefix is a property we can
 * insist on rather than hope for.
 *
 * Anything failing this is logged and left standing. An orphaned file is
 * recoverable by a later sweep; another person's deleted policy is not.
 */
export function ownsStoragePath(path: unknown, accountId: string): boolean {
  if (typeof path !== "string" || path.length === 0) return false;
  if (!isUuid(accountId)) return false;
  if (path.includes("..")) return false;
  if (path.startsWith("/")) return false;
  return path.startsWith(`${accountId}/`) && path.length > accountId.length + 1;
}

/** The holding area for uploads made before signup. A claimed row is proven to
 *  belong to the account by its own `claimed_by` column, so its object key is
 *  allowed to sit under this prefix instead of under the account's. */
export const PENDING_UPLOAD_PREFIX = "pending/";

/** True if a `pending_uploads.storage_path` is safe to remove for this account.
 *  Ownership is established by the row's `claimed_by`; this only rejects a value
 *  that is not a plausible key at all. */
export function pendingUploadPathIsSafe(path: unknown, accountId: string): boolean {
  if (typeof path !== "string" || path.length === 0) return false;
  if (path.includes("..") || path.startsWith("/")) return false;
  return path.startsWith(PENDING_UPLOAD_PREFIX) || ownsStoragePath(path, accountId);
}

/* -- Preconditions ------------------------------------------------------- */

/** What we know about the caller's standing in a team, read from the database
 *  before anything is deleted. */
export interface TeamStanding {
  /** Do they own a team at all? */
  ownsTeam: boolean;
  teamName: string | null;
  /** Members of that team who are NOT the owner. The owner is a member of their
   *  own team (`agents.team_id` is set for them too), so this count excludes them. */
  otherMembers: number;
  /** Invitations still outstanding in somebody's inbox. */
  pendingInvites: number;
}

export interface DeletionRefusal {
  error: string;
  message: string;
}

/**
 * Refuse, rather than guess, when other people are involved.
 *
 * An owner deleting their account would strand every advisor under them, and
 * what should happen to those advisors' customers and policies is not a
 * decision code gets to make on their behalf. `teams.owner_id` is
 * `ON DELETE RESTRICT` precisely so this fails loudly; this turns that database
 * error into a sentence that names what the owner must do first.
 *
 * Outstanding invitations are refused for the same reason and one more: an
 * invitation is a bearer grant sitting in somebody's inbox, and one redeemed
 * after its team's owner is gone joins a team with no owner.
 *
 * Returns null when there is nobody else to strand.
 */
export function teamDeletionBlock(standing: TeamStanding): DeletionRefusal | null {
  if (!standing.ownsTeam) return null;
  const team = standing.teamName ? `"${standing.teamName}"` : "your team";

  if (standing.otherMembers > 0) {
    const n = standing.otherMembers;
    return {
      error: "TEAM_HAS_MEMBERS",
      message:
        `You own ${team}, and ${n} other advisor${n === 1 ? " is" : "s are"} still in it. ` +
        `Remove ${n === 1 ? "them" : "all of them"} from the team first (Team, then Remove beside each advisor), ` +
        `then delete your account. Their customers and policies are theirs, and we will not decide what happens to them for you.`,
    };
  }

  if (standing.pendingInvites > 0) {
    const n = standing.pendingInvites;
    return {
      error: "TEAM_HAS_INVITES",
      message:
        `You own ${team}, and ${n} invitation${n === 1 ? " is" : "s are"} still outstanding. ` +
        `Revoke ${n === 1 ? "it" : "them"} first (Team, then Revoke beside each invitation), then delete your account. ` +
        `An invitation redeemed after you are gone would join a team with no owner.`,
    };
  }

  return null;
}

/* -- In-flight work ------------------------------------------------------ */

/** A job past this age is treated as abandoned rather than running. Without a
 *  ceiling, one analysis that crashed mid-flight would block a person from ever
 *  deleting their account, and deletion is an obligation, not a feature. */
export const ANALYSIS_STALE_AFTER_MS = 15 * 60 * 1000;

/** The fields of an in-memory analysis job that deletion cares about. */
export interface RunningJobLike {
  agentId?: string | null;
  status: string;
  createdAt: number;
}

/**
 * Count this account's analyses that are still genuinely in flight.
 *
 * A running analysis writes to `clients` / `individual_policies` and upserts an
 * `analysis_jobs` row when it finishes. Deleting underneath it either fails on a
 * foreign key or re-creates a row for an account that no longer exists, which is
 * the one way this code could leave personal data behind after reporting success.
 *
 * `agentId` carries the owning account on both surfaces: the consumer path sets
 * it to the consumer's user id (shared uuid namespace). Anonymous public-analyzer
 * jobs have it null and belong to nobody.
 */
export function liveAnalysisCount(
  jobs: Iterable<RunningJobLike>,
  accountId: string,
  now: number,
  staleAfterMs: number = ANALYSIS_STALE_AFTER_MS,
): number {
  let n = 0;
  for (const job of jobs) {
    if (!job || job.agentId !== accountId) continue;
    if (job.status !== "pending" && job.status !== "processing") continue;
    if (!Number.isFinite(job.createdAt)) continue;
    if (now - job.createdAt > staleAfterMs) continue; // abandoned, not running
    n++;
  }
  return n;
}

/** Split a list of storage keys into batches small enough for one remove() call,
 *  so a 500-policy account does not send one enormous request and a failure
 *  costs one batch rather than the whole account's cleanup. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error("chunk size must be at least 1");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
