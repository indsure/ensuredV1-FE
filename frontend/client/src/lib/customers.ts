/**
 * Customer (person/portfolio) data layer for the agent portal.
 *
 * A customer is a person an agent manages; policies (`clients` rows) are
 * tagged to a customer via `clients.customer_id`. All reads/writes go
 * straight through supabase-js — the `customers` table carries the same
 * RLS policy as `clients` (auth.uid() = agent_id), so the database enforces
 * per-agent isolation.
 */

import { supabase } from "@/lib/supabase";
import { getNextPremiumDate, isDataEntryType } from "@/lib/insuranceTypes";

export type Customer = {
  id: string;
  agent_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  dob: string | null;
  city: string | null;
  notes: string | null;
  created_at: string;
};

export type CustomerDraft = {
  name: string;
  phone?: string | null;
  email?: string | null;
  dob?: string | null;
  city?: string | null;
  notes?: string | null;
};

/** The slice of a `clients` row the portfolio views need. */
export type PortfolioPolicy = {
  id: string;
  customer_id: string | null;
  insurance_type: string | null;
  policyholder_name: string | null;
  name: string | null;
  insurer: string | null;
  policy_name: string | null;
  policy_identifier: string | null;
  sum_insured: string | number | null;
  expiry_date: string | null;
  score: number | null;
  extracted_data: any | null;
  created_at: string;
};

export const PORTFOLIO_POLICY_COLUMNS =
  "id, customer_id, insurance_type, policyholder_name, name, insurer, policy_name, policy_identifier, sum_insured, expiry_date, score, extracted_data, created_at";

/* ── CRUD ──────────────────────────────────────────────────────────────── */

export async function fetchCustomers(agentId: string): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchCustomer(agentId: string, id: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("agent_id", agentId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createCustomer(agentId: string, draft: CustomerDraft): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .insert({ agent_id: agentId, ...cleanDraft(draft) })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateCustomer(id: string, draft: CustomerDraft): Promise<void> {
  const { error } = await supabase.from("customers").update(cleanDraft(draft)).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Deleting a customer never deletes policies — the FK sets customer_id NULL. */
export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function tagPolicyToCustomer(clientId: string, customerId: string | null): Promise<void> {
  const { error } = await supabase
    .from("clients")
    .update({ customer_id: customerId })
    .eq("id", clientId);
  if (error) throw new Error(error.message);
}

function cleanDraft(draft: CustomerDraft) {
  const trim = (v: string | null | undefined) => {
    const t = (v ?? "").trim();
    return t === "" ? null : t;
  };
  return {
    name: (draft.name ?? "").trim(),
    phone: trim(draft.phone),
    email: trim(draft.email),
    dob: trim(draft.dob),
    city: trim(draft.city),
    notes: trim(draft.notes),
  };
}

/* ── Fuzzy auto-suggest ────────────────────────────────────────────────── */

const HONORIFICS = new Set(["mr", "mrs", "ms", "miss", "shri", "smt", "dr", "kumari", "master"]);

function nameTokens(s: string | null | undefined): string[] {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !HONORIFICS.has(t));
}

/** Last 10 digits — normalizes +91 / 0-prefixed Indian numbers. */
function phoneKey(s: string | null | undefined): string {
  const d = (s ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : d;
}

export type CustomerSuggestion = { customer: Customer; score: number; reason: string };

/**
 * Rank existing customers against a policy's holder name / phone / email.
 * Phone and email are strong identity signals; names match on token overlap
 * so "Mohit Sharma" still matches "Sharma, Mohit K".
 */
export function suggestCustomers(
  customers: Customer[],
  hint: { name?: string | null; phone?: string | null; email?: string | null },
  limit = 5
): CustomerSuggestion[] {
  const hintTokens = nameTokens(hint.name);
  const hintPhone = phoneKey(hint.phone);
  const hintEmail = (hint.email ?? "").trim().toLowerCase();

  const ranked: CustomerSuggestion[] = [];
  for (const c of customers) {
    let score = 0;
    let reason = "";

    if (hintPhone.length === 10 && phoneKey(c.phone) === hintPhone) {
      score = 100;
      reason = "Same phone number";
    } else if (hintEmail && (c.email ?? "").trim().toLowerCase() === hintEmail) {
      score = 90;
      reason = "Same email";
    } else if (hintTokens.length > 0) {
      const cTokens = nameTokens(c.name);
      if (cTokens.length > 0) {
        const overlap = hintTokens.filter((t) => cTokens.includes(t)).length;
        const smaller = Math.min(hintTokens.length, cTokens.length);
        if (overlap > 0 && overlap === smaller) {
          score = 80;
          reason = "Name matches";
        } else if (overlap > 0) {
          score = 40 + Math.round((overlap / smaller) * 20);
          reason = "Similar name";
        }
      }
    }

    if (score > 0) ranked.push({ customer: c, score, reason });
  }

  return ranked.sort((a, b) => b.score - a.score).slice(0, limit);
}

/* ── Portfolio aggregates ──────────────────────────────────────────────── */

/**
 * Parse an Indian rupee amount that may arrive as a number, "5,00,000",
 * "₹ 12.5 Lakh", "1.2 Cr" etc. Returns null when unparseable.
 */
export function parseAmount(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const s = value.toLowerCase().replace(/,/g, "");
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (/crore|cr\b/.test(s)) n *= 1e7;
  else if (/lakh|lac\b/.test(s)) n *= 1e5;
  else if (/\bk\b/.test(s)) n *= 1e3;
  return Number.isFinite(n) ? n : null;
}

/** Compact Indian formatting: 1.2 Cr / 5 L / 50,000. */
export function formatAmount(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e7) return `₹${trimZero((n / 1e7).toFixed(2))} Cr`;
  if (n >= 1e5) return `₹${trimZero((n / 1e5).toFixed(2))} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function trimZero(s: string): string {
  return s.replace(/\.?0+$/, "");
}

export type PortfolioStats = {
  policyCount: number;
  byType: Record<string, number>;
  totalSumInsured: number | null;
  totalPremium: number | null;
  nextPremium: { date: string; policyId: string } | null;
  worstHealthScore: number | null;
};

export function buildPortfolioStats(policies: PortfolioPolicy[]): PortfolioStats {
  const byType: Record<string, number> = {};
  let totalSumInsured: number | null = null;
  let totalPremium: number | null = null;
  let nextPremium: { date: string; policyId: string } | null = null;
  let worstHealthScore: number | null = null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const p of policies) {
    const type = p.insurance_type || "health";
    byType[type] = (byType[type] ?? 0) + 1;

    const si = parseAmount(p.sum_insured);
    if (si != null) totalSumInsured = (totalSumInsured ?? 0) + si;

    if (isDataEntryType(type)) {
      const prem = parseAmount(p.extracted_data?.premium);
      if (prem != null) totalPremium = (totalPremium ?? 0) + prem;
    }

    const np = getNextPremiumDate(p.expiry_date, p.extracted_data);
    if (np) {
      const d = new Date(np);
      if (!isNaN(d.getTime()) && d >= today) {
        if (!nextPremium || d < new Date(nextPremium.date)) {
          nextPremium = { date: np, policyId: p.id };
        }
      }
    }

    if (type === "health" && p.score != null) {
      worstHealthScore = worstHealthScore == null ? p.score : Math.min(worstHealthScore, p.score);
    }
  }

  return { policyCount: policies.length, byType, totalSumInsured, totalPremium, nextPremium, worstHealthScore };
}
