/**
 * The advisor's life and term policies, read through the backend so the agent
 * is the one verified from the session, and the life/term type change.
 * Used by the Life section (/agent/life) and the surrender details page.
 */

import { supabase } from "@/lib/supabase";
import { getApiBase } from "@/lib/queryClient";
import type { SourceRow } from "@/lib/policyBook";

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export async function fetchPolicyValueRows(): Promise<SourceRow[]> {
  const res = await fetch(`${getApiBase()}/api/agent/policy-values`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  return Array.isArray(body?.rows) ? body.rows : [];
}

/** Life <-> term only. No re-read, no check used. Throws with the server's message. */
export async function changeLifeType(id: string, to: "life" | "term"): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/agent/clients/${encodeURIComponent(id)}/insurance-type`, {
    method: "PATCH",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ to }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body?.message === "string" ? body.message : `HTTP ${res.status}`);
  }
}
