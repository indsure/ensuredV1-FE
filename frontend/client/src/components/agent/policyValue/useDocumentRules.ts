/**
 * The document-rules reply for one policy, shared by the review panel and the
 * value card. The panel announces each saved review with DOC_RULES_CHANGED so
 * the value card reloads and both always show the same confirmed terms.
 */

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import { getApiBase } from "@/lib/queryClient";
import { documentValues, type ConfirmedFacts } from "@/lib/documentRules";
import type { FieldKey, ReviewFlag } from "@/lib/policyDocTypes";

export interface FactRow {
  field_key: FieldKey;
  revision: number;
  state: "document_pending" | "reviewed" | "corrected" | "rejected" | "conflicting";
  document_field: any;
  corrected_value: any;
  reason: string | null;
  created_at: string;
}
export interface RulesResponse {
  parse: null | { id: string; status: string; reasons: string[]; flags: ReviewFlag[]; page_methods: { page: number; method: string; usable: boolean }[]; adapter_id: string | null; page_count: number };
  fields: FactRow[];
  history: Record<string, FactRow[]>;
  flagDecisions: Record<string, { choice: string; reason: string | null }>;
}

export const DOC_RULES_CHANGED = "indsure:doc-rules-changed";

export async function docApi(path: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session) headers.Authorization = `Bearer ${session.access_token}`;
  const res = await fetch(`${getApiBase()}${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body?.message || body?.error || `HTTP ${res.status}`), { status: res.status });
  return body;
}

/** Facts confirmed at their current revision (same rule as the server's confirmedFactsFrom). */
export function confirmedFrom(rules: RulesResponse | null): ConfirmedFacts {
  const out: any = {};
  for (const f of rules?.fields ?? []) {
    if (f.state === "reviewed" && f.document_field?.state === "found") out[f.field_key] = { value: f.document_field.value, revision: f.revision, state: "reviewed" };
    else if (f.state === "corrected") out[f.field_key] = { value: f.corrected_value, revision: f.revision, state: "corrected" };
  }
  return out;
}

export function docResults(rules: RulesResponse | null, evidence: unknown) {
  if (!rules?.parse || rules.parse.status !== "supported") return null;
  return documentValues({
    facts: confirmedFrom(rules), flags: rules.parse.flags,
    flagDecisions: Object.fromEntries(Object.entries(rules.flagDecisions).map(([k, v]) => [k, v.choice])) as any,
    evidence: evidence as any, asOf: new Date().toISOString().slice(0, 10),
  });
}

export function useDocumentRules(clientId: string) {
  const [rules, setRules] = useState<RulesResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    try {
      setFailed(false);
      setRules(await docApi(`/api/agent/clients/${clientId}/document-rules`));
    } catch {
      setFailed(true);
    }
  }, [clientId]);
  useEffect(() => {
    void load();
    const on = (e: Event) => { if ((e as CustomEvent).detail === clientId) void load(); };
    window.addEventListener(DOC_RULES_CHANGED, on);
    return () => window.removeEventListener(DOC_RULES_CHANGED, on);
  }, [load, clientId]);
  return { rules, failed, load };
}
