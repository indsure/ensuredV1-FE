import { supabase } from "@/lib/supabase";
import { getApiBase } from "@/lib/queryClient";

/**
 * Re-run analysis/extraction for a policy from its stored document.
 * Throws with a human-readable message (e.g. when no PDF is stored or
 * credits have run out) so callers can surface it in a toast.
 */
export async function rerunPolicy(clientId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const res = await fetch(`${getApiBase()}/api/agent/clients/${clientId}/rerun`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({} as Record<string, string>));
    throw new Error(body.message || body.error || "Re-run failed");
  }
}
