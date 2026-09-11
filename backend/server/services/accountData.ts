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
