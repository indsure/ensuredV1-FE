/* =========================================================
   ADVISOR ENTITLEMENT: who is on the limited Free plan

   Founder decision 2026-11-02. Free = 3 health policy checks + 20 policy scans; everything else
   is paid. Advisors who existed before the change keep today's Free (agents.free_full_access,
   migration 032, backfilled true), and so does anyone who joined with a valid invite code.

   limited = plan is free (case-insensitive, NULL counts as free, the same reading AgentContext
   and payments.ts use) AND free_full_access is not true.

   Fails OPEN: if the column is missing (032 not run yet, or rolled back) or the read errors,
   the advisor is treated as NOT limited, which is exactly today's behaviour. Public surfaces
   (an advisor's page, a QR code on a visiting card) must never go dark because of a migration.
   Plan doc: docs/plans/2026-11-02-free-tier-paywall.md
   ========================================================= */

import { pool } from "./db";
import { log } from "./logger";

let warned = false;

export async function isLimitedFree(agentId: string): Promise<boolean> {
  try {
    const r = await pool.query(
      `SELECT lower(coalesce(plan, 'free')) = 'free' AND coalesce(free_full_access, false) = false AS limited
         FROM agents WHERE id = $1`,
      [agentId]
    );
    return r.rows[0]?.limited === true;
  } catch (e: any) {
    if (!warned) {
      warned = true;
      log.error("entitlement_check_failed_open", { message: e?.message ?? String(e) });
    }
    return false;
  }
}

/** The one 403 body every paid-only route answers with, so the portal can show its upgrade screen. */
export const NEEDS_UPGRADE = {
  error: "NEEDS_UPGRADE",
  message: "This is part of the paid plan. Upgrade to use it.",
} as const;
