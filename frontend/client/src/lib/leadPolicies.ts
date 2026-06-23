/**
 * Lead policies — policies an agent collects from a PROSPECT (agent_leads) to
 * keep context and reach out near the renewal/due date. Light + cheap: store
 * the file + a few fields (insurer, type, premium, due date), no forensic
 * analysis. A lead can hold several policies.
 *
 * Architecture mirrors leads.ts: CRUD/queries go straight through supabase-js
 * (RLS = auth.uid() = agent_id). Only the file upload + optional OCR needs the
 * backend (storage-admin + extraction), via uploadLeadPolicy().
 */

import { supabase } from "@/lib/supabase";
import { getApiBase } from "@/lib/queryClient";

export const LEAD_POLICY_TYPES = ["motor", "health", "life", "travel", "property"] as const;
export type LeadPolicyType = (typeof LEAD_POLICY_TYPES)[number];

/** Types that support the cheap OCR autofill (the data-entry lane). Health is
 *  the expensive forensic lane, so it stays manual-entry here. */
export const OCR_SUPPORTED: LeadPolicyType[] = ["motor", "life", "travel", "property"];

export const LEAD_POLICY_TYPE_META: Record<LeadPolicyType, { label: string; emoji: string }> = {
  motor:    { label: "Motor",    emoji: "🚗" },
  health:   { label: "Health",   emoji: "🩺" },
  life:     { label: "Life",     emoji: "🛡️" },
  travel:   { label: "Travel",   emoji: "✈️" },
  property: { label: "Property", emoji: "🏠" },
};

export type LeadPolicy = {
  id: string;
  lead_id: string;
  agent_id: string;
  insurance_type: string | null;
  insurer: string | null;
  policy_name: string | null;
  policyholder_name: string | null;
  premium: number | null;
  due_date: string | null;
  file_url: string | null;
  file_name: string | null;
  extracted_data: any | null;
  spoken_to: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** A lead policy joined with its parent lead's name/phone, for the expiring view. */
export type LeadPolicyWithLead = LeadPolicy & {
  agent_leads: { id: string; name: string; phone: string | null } | null;
};

export type LeadPolicyDraft = {
  insurance_type?: string | null;
  insurer?: string | null;
  policy_name?: string | null;
  policyholder_name?: string | null;
  premium?: number | string | null;
  due_date?: string | null;
  notes?: string | null;
};

/* ── Queries ───────────────────────────────────────────────────────────── */

export async function fetchLeadPolicies(leadId: string): Promise<LeadPolicy[]> {
  const { data, error } = await supabase
    .from("lead_policies")
    .select("*")
    .eq("lead_id", leadId)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LeadPolicy[];
}

/** All of an agent's lead policies that have a due date, joined with the lead,
 *  soonest first — the "who to chase" hit-list. The page buckets by urgency. */
export async function fetchDueLeadPolicies(agentId: string): Promise<LeadPolicyWithLead[]> {
  const { data, error } = await supabase
    .from("lead_policies")
    .select("*, agent_leads ( id, name, phone )")
    .eq("agent_id", agentId)
    .not("due_date", "is", null)
    .order("due_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LeadPolicyWithLead[];
}

/* ── Mutations (manual add + edits go straight through supabase) ────────── */

export async function createLeadPolicy(leadId: string, agentId: string, draft: LeadPolicyDraft): Promise<LeadPolicy> {
  const { data, error } = await supabase
    .from("lead_policies")
    .insert({ lead_id: leadId, agent_id: agentId, ...clean(draft) })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as LeadPolicy;
}

export async function updateLeadPolicy(id: string, draft: LeadPolicyDraft): Promise<void> {
  const { error } = await supabase
    .from("lead_policies")
    .update({ ...clean(draft), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setLeadPolicySpoken(id: string, spoken: boolean): Promise<void> {
  const { error } = await supabase
    .from("lead_policies")
    .update({ spoken_to: spoken, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteLeadPolicy(id: string): Promise<void> {
  const { error } = await supabase.from("lead_policies").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Upload a policy file (+ optional OCR autofill) via the backend. Any typed
 *  `overrides` win over OCR-extracted values on the server. */
export async function uploadLeadPolicy(
  leadId: string,
  params: { file: File; type: LeadPolicyType; ocr: boolean; overrides?: LeadPolicyDraft }
): Promise<LeadPolicy> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in again");
  const fd = new FormData();
  fd.append("file", params.file);
  fd.append("type", params.type);
  fd.append("ocr", String(params.ocr));
  const o = params.overrides ?? {};
  if (o.insurer) fd.append("insurer", String(o.insurer));
  if (o.policy_name) fd.append("policy_name", String(o.policy_name));
  if (o.policyholder_name) fd.append("policyholder_name", String(o.policyholder_name));
  if (o.premium != null && o.premium !== "") fd.append("premium", String(o.premium));
  if (o.due_date) fd.append("due_date", String(o.due_date));
  const res = await fetch(`${getApiBase()}/api/agent/leads/${leadId}/policy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: fd,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || "Could not upload the policy. Please try again.");
  }
  return (await res.json()) as LeadPolicy;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

/** Whole days until the due date (negative = overdue). Null if no date. */
export function daysUntilDue(due: string | null): number | null {
  if (!due) return null;
  const d = new Date(due);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function clean(draft: LeadPolicyDraft) {
  const trim = (v: string | null | undefined) => {
    const t = (v ?? "").trim();
    return t === "" ? null : t;
  };
  const num = (v: number | string | null | undefined): number | null => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const out: Record<string, unknown> = {};
  if (draft.insurance_type !== undefined) out.insurance_type = trim(draft.insurance_type);
  if (draft.insurer !== undefined) out.insurer = trim(draft.insurer);
  if (draft.policy_name !== undefined) out.policy_name = trim(draft.policy_name);
  if (draft.policyholder_name !== undefined) out.policyholder_name = trim(draft.policyholder_name);
  if (draft.premium !== undefined) out.premium = num(draft.premium);
  if (draft.due_date !== undefined) out.due_date = trim(draft.due_date);
  if (draft.notes !== undefined) out.notes = trim(draft.notes);
  return out;
}
