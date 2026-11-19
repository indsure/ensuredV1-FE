/**
 * Renewal outcomes on Home: spoken, renewed or lost, one per policy per due date
 * (table policy_renewals, migration 039).
 *
 * Keyed on the due date, not just the policy: a health policy renews every year
 * and a life policy can fall due every month, so last year's "renewed" must never
 * mark this year's renewal as done.
 *
 * Written by the browser under RLS, like lead_policies. assertCrmWritable() keeps
 * a Free-plan account read-only, as on Customers, Leads and Renewals.
 */

import { supabase } from "@/lib/supabase";
import { assertCrmWritable } from "@/lib/entitlement";
import { isPlaygroundMode } from "@/lib/playground/mode";

export const RENEWAL_STATUSES = ["spoken", "renewed", "lost"] as const;
export type RenewalStatus = (typeof RENEWAL_STATUSES)[number];

type Row = { client_id: string; due_date: string; status: RenewalStatus; updated_at: string | null };

/** YYYY-MM-DD in local time. Due dates are calendar days, never instants. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function renewalKey(clientId: string, dueDate: Date): string {
  return `${clientId}|${ymd(dueDate)}`;
}

/**
 * Outcomes for due dates in [from, to]. Throws when the table is missing (039 not
 * run yet), so the page can hide the column instead of showing buttons that fail.
 */
export async function fetchRenewalStatuses(agentId: string, from: Date, to: Date): Promise<Map<string, RenewalStatus>> {
  const { data, error } = await supabase
    .from("policy_renewals")
    .select("client_id, due_date, status, updated_at")
    .eq("agent_id", agentId)
    .gte("due_date", ymd(from))
    .lte("due_date", ymd(to));
  if (error) throw new Error(error.message);
  // Oldest first, so the newest write for a key wins (the demo store can hold two).
  const rows = ((data ?? []) as Row[]).sort((a, b) => (a.updated_at ?? "").localeCompare(b.updated_at ?? ""));
  const out = new Map<string, RenewalStatus>();
  for (const r of rows) out.set(`${r.client_id}|${String(r.due_date).slice(0, 10)}`, r.status);
  return out;
}

/** Set the outcome for one renewal, or clear it with null. */
export async function setRenewalStatus(
  agentId: string,
  clientId: string,
  dueDate: Date,
  status: RenewalStatus | null,
): Promise<void> {
  assertCrmWritable();
  const due_date = ymd(dueDate);
  if (status === null) {
    const { error } = await supabase
      .from("policy_renewals")
      .delete()
      .eq("agent_id", agentId)
      .eq("client_id", clientId)
      .eq("due_date", due_date);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase
    .from("policy_renewals")
    // updated_at is set by the database trigger (039), never by the device clock.
    // The demo store has no trigger, so it gets a time there for its newest-wins read.
    .upsert(
      { agent_id: agentId, client_id: clientId, due_date, status, ...(isPlaygroundMode() ? { updated_at: new Date().toISOString() } : {}) },
      { onConflict: "agent_id,client_id,due_date" },
    );
  if (error) throw new Error(error.message);
}
