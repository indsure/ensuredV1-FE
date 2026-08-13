/**
 * Leads (prospect pipeline) data layer for the agent portal.
 *
 * A lead is someone the agent is chasing for a policy but who isn't a customer
 * yet. When the lead closes ("Won"), it can be converted into a `customers`
 * row so it flows into the portfolio. Everything goes straight through
 * supabase-js — the `leads` table carries the same RLS as clients/customers
 * (auth.uid() = agent_id), so the database enforces per-agent isolation.
 *
 * Kept deliberately simple: the agents using this are 40+ and not tech-savvy,
 * so the stages are plain words, not a CRM funnel.
 */

import { supabase } from "@/lib/supabase";
import { createCustomer } from "@/lib/customers";

/**
 * Table name is `agent_leads`, NOT `leads`. `leads` is the pre-existing PUBLIC
 * lead-capture table (POST /api/leads from the policy-report flow); this is the
 * separate per-agent CRM pipeline.
 */
const LEADS_TABLE = "agent_leads";

export const LEAD_STATUSES = ["new", "contacted", "interested", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Plain-language labels (Hindi via i18n keys `leads.status_*`), colours, order. */
export const LEAD_STATUS_META: Record<LeadStatus, { label: string; badge: string; dot: string }> = {
  new:        { label: "New",        badge: "bg-sky-50 text-sky-700 border-sky-200",        dot: "bg-sky-500" },
  contacted:  { label: "Contacted",  badge: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  interested: { label: "Interested", badge: "bg-amber-50 text-amber-700 border-amber-200",   dot: "bg-amber-500" },
  won:        { label: "Won",        badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  lost:       { label: "Lost",       badge: "bg-slate-100 text-slate-500 border-slate-200",   dot: "bg-slate-400" },
};

/** Where the lead came from — used to seed the dropdown; free text also allowed. */
export const LEAD_SOURCES = ["Referral", "WhatsApp", "Phone call", "Walk-in", "Website", "Social media", "Other"] as const;

export type Lead = {
  id: string;
  agent_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  source: string | null;
  insurance_interest: string | null;
  expected_value: number | null;
  status: LeadStatus;
  next_follow_up: string | null;
  notes: string | null;
  customer_id: string | null;
  created_at: string;
  updated_at: string;
  /* Set only on leads that came in through an advisor landing page. Recovered
   * from the browser at submit time, so the advisor knows the context before
   * ringing: which app they were in, on what kind of device. */
  source_app: string | null;
  source_device: string | null;
  source_os: string | null;
  landing_slug: string | null;
  utm_campaign: string | null;
};

/** Plain labels for where a landing-page lead came from. */
const SOURCE_APP_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  linkedin: "LinkedIn",
  browser: "web",
};

const SOURCE_DEVICE_LABELS: Record<string, string> = {
  mobile: "phone",
  tablet: "tablet",
  desktop: "computer",
};

/**
 * One short line for the lead card, e.g. "Instagram · phone". Returns null for
 * leads that didn't come from a landing page, so the card stays unchanged for
 * every lead the agent added by hand.
 */
export function sourceContext(lead: Lead): string | null {
  if (!lead.landing_slug) return null;
  const parts = [
    lead.source_app ? SOURCE_APP_LABELS[lead.source_app] ?? null : null,
    lead.source_device ? SOURCE_DEVICE_LABELS[lead.source_device] ?? null : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export type LeadDraft = {
  name: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  source?: string | null;
  insurance_interest?: string | null;
  expected_value?: number | string | null;
  status?: LeadStatus;
  next_follow_up?: string | null;
  notes?: string | null;
};

/* ── CRUD ──────────────────────────────────────────────────────────────── */

export async function fetchLeads(agentId: string): Promise<Lead[]> {
  const { data, error } = await supabase
    .from(LEADS_TABLE)
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Lead[];
}

export async function fetchLead(agentId: string, id: string): Promise<Lead | null> {
  const { data, error } = await supabase
    .from(LEADS_TABLE)
    .select("*")
    .eq("agent_id", agentId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Lead | null;
}

export async function createLead(agentId: string, draft: LeadDraft): Promise<Lead> {
  const { data, error } = await supabase
    .from(LEADS_TABLE)
    .insert({ agent_id: agentId, status: draft.status ?? "new", ...cleanDraft(draft) })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Lead;
}

export async function updateLead(id: string, draft: LeadDraft): Promise<void> {
  const { error } = await supabase
    .from(LEADS_TABLE)
    .update({ ...cleanDraft(draft), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Quick status change (used by the inline status buttons). */
export async function setLeadStatus(id: string, status: LeadStatus): Promise<void> {
  const { error } = await supabase
    .from(LEADS_TABLE)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from("agent_leads").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Convert a won lead into a customer: create the customer row (prefilled from
 * the lead), then link the lead to it and mark it Won. Returns the new
 * customer id so the caller can jump to the portfolio. Idempotent-ish: if the
 * lead is already linked, returns the existing customer id.
 */
export async function convertLeadToCustomer(agentId: string, lead: Lead): Promise<string> {
  if (lead.customer_id) return lead.customer_id;

  const customer = await createCustomer(agentId, {
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    city: lead.city,
    notes: lead.notes,
  });

  const { error } = await supabase
    .from(LEADS_TABLE)
    .update({ customer_id: customer.id, status: "won", updated_at: new Date().toISOString() })
    .eq("id", lead.id);
  if (error) throw new Error(error.message);

  return customer.id;
}

function cleanDraft(draft: LeadDraft) {
  const trim = (v: string | null | undefined) => {
    const t = (v ?? "").trim();
    return t === "" ? null : t;
  };
  const num = (v: number | string | null | undefined): number | null => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const out: Record<string, unknown> = {
    name: (draft.name ?? "").trim(),
    phone: trim(draft.phone),
    email: trim(draft.email),
    city: trim(draft.city),
    source: trim(draft.source),
    insurance_interest: trim(draft.insurance_interest),
    expected_value: num(draft.expected_value),
    next_follow_up: trim(draft.next_follow_up),
    notes: trim(draft.notes),
  };
  if (draft.status) out.status = draft.status;
  return out;
}

/* ── Follow-up helpers ─────────────────────────────────────────────────── */

/** Open = anything still worth chasing (everything except Won / Lost). */
export function isOpen(lead: Lead): boolean {
  return lead.status !== "won" && lead.status !== "lost";
}

/** YYYY-MM-DD for "today" in local time, for comparing against next_follow_up. */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Due = open lead whose follow-up date is today or in the past. */
export function isFollowUpDue(lead: Lead): boolean {
  if (!isOpen(lead) || !lead.next_follow_up) return false;
  return lead.next_follow_up.slice(0, 10) <= todayKey();
}

/* ── Contact helpers (WhatsApp / Call) ─────────────────────────────────── */

/** Last 10 digits, prefixed +91, for tel:/wa.me links on Indian numbers. */
export function waNumber(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  const last10 = d.slice(-10);
  return `91${last10}`;
}

export function telHref(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length >= 10 ? `tel:+${waNumber(phone)}` : null;
}

export function waHref(phone: string | null | undefined, message?: string): string | null {
  const n = waNumber(phone);
  if (!n) return null;
  return `https://wa.me/${n}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
