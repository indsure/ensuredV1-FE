/** Edits to the advisor's own book that go through the server (services/bookRoutes.ts). */
import { apiFetch, apiJson } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/fetchAllRows";

const send = <T = any>(path: string, method: string, body?: unknown) =>
  apiJson<T>(apiFetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));

const enc = encodeURIComponent;

export const saveHealthFacts = (id: string, facts: Record<string, unknown>) => send(`/api/agent/policies/${enc(id)}/facts`, "PATCH", facts);
export const addManualPolicy = (body: Record<string, unknown>) => send<{ id: string }>("/api/agent/policies/manual", "POST", body);
export const linkRenewal = (newId: string, oldId: string) => send<{ linked: boolean }>(`/api/agent/policies/${enc(newId)}/renews`, "POST", { old_id: oldId });
export const mergeCustomers = (keepId: string, fromId: string) => send(`/api/agent/customers/${enc(keepId)}/merge`, "POST", { from_id: fromId });
export const carryLeadPolicies = (leadId: string) => send<{ moved: number }>(`/api/agent/leads/${enc(leadId)}/carry-policies`, "POST", {});

/** Reads the stored document again as another type. `read: false` = nothing to read, type changed at once. */
export const readAsType = (id: string, to: string) =>
  send<{ status: string; read?: boolean }>(`/api/agent/clients/${enc(id)}/rerun`, "POST", { insurance_type: to });

export const setShare = (id: string, enabled: boolean) =>
  send<{ shareToken: string }>(`/api/agent/clients/${enc(id)}/share/toggle`, "POST", { enabled });

export type SavedComparison = {
  id: string; name_a: string | null; name_b: string | null; created_at: string;
  customer_id: string | null; customer_name: string | null; plans: number;
};
export const fetchComparisons = async () => (await send<{ rows?: SavedComparison[] }>("/api/agent/comparisons", "GET")).rows ?? [];
export const setComparisonCustomer = (id: string, customerId: string | null) => send(`/api/agent/comparisons/${enc(id)}`, "PATCH", { customer_id: customerId });
export const deleteComparison = (id: string) => send(`/api/agent/comparisons/${enc(id)}`, "DELETE");

/** The stored document, saved to the device. The route needs the login, so a plain link cannot do it. */
export async function downloadPolicyFile(id: string, filename: string | null | undefined): Promise<void> {
  const res = await apiFetch(`/api/agent/clients/${enc(id)}/download-pdf`);
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.message || b.error || "Download failed");
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "policy.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Policies already replaced by a newer one. Empty until migration 040 has run. */
export async function fetchReplacedIds(agentId: string): Promise<Set<string>> {
  try {
    const rows = await fetchAllRows<any>((from, to) =>
      supabase.from("clients").select("id, renewed_from").eq("agent_id", agentId)
        .not("renewed_from", "is", null).order("id").range(from, to) as any);
    return new Set(rows.map((r) => r.renewed_from).filter(Boolean));
  } catch {
    return new Set();
  }
}
