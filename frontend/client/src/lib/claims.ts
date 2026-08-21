/**
 * Claims data layer for the agent portal.
 *
 * Unlike customers/policies, claims do NOT go through supabase-js. Everything
 * routes through the backend because the rules that make a claim trustworthy
 * live server-side: the retention clock starts on the first upload, closing a
 * claim requires proof attached, query rounds own the claim's status, and
 * document URLs are minted for ten minutes at a time and audited. RLS is on
 * these tables too, but it is defence in depth rather than the control.
 *
 * There is no AI anywhere in this lane — no OCR, no extraction. Every field
 * here was typed by the advisor.
 */

import { apiFetch } from "@/lib/api";

export type ClaimStatus =
  | "opened"
  | "docs_received"
  | "submitted"
  | "under_process"
  | "query_raised"
  | "settled"
  | "rejected";

export type ClaimType = "cashless" | "reimbursement";

export type DocCategory = "personal" | "case" | "outcome";

export type ClaimDocument = {
  id: string;
  claim_id: string;
  query_id: string | null;
  category: DocCategory;
  doc_type: string | null;
  filename: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_at: string;
};

export type ClaimQuery = {
  id: string;
  claim_id: string;
  seq: number;
  question: string;
  raised_on: string;
  raised_by: string | null;
  resolved_on: string | null;
  resolution_note: string | null;
  created_at: string;
};

export type ClaimEvent = {
  id: string;
  claim_id: string;
  status: string;
  note: string | null;
  occurred_at: string;
};

export type Claim = {
  id: string;
  agent_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  claim_type: ClaimType;
  status: ClaimStatus;
  insurer: string | null;
  tpa: string | null;
  policy_number: string | null;
  hospital: string | null;
  ailment: string | null;
  claimed_amount: string | number | null;
  settled_amount: string | number | null;
  admitted_on: string | null;
  discharged_on: string | null;
  retention_started_at: string | null;
  purge_at: string | null;
  extension_used: boolean;
  documents_purged_at: string | null;
  proof_consent_at: string | null;
  closed_at: string | null;
  created_at: string;
  /* derived, list + detail */
  open_queries?: number;
  total_queries?: number;
  document_count?: number;
  days_to_purge?: number | null;
  can_extend?: boolean;
};

export type ClaimDetail = Claim & {
  documents: ClaimDocument[];
  queries: ClaimQuery[];
  events: ClaimEvent[];
};

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as any)?.message || (body as any)?.error || `Request failed (${res.status})`);
  }
  return body as T;
}

export async function fetchClaims(): Promise<Claim[]> {
  return json<Claim[]>(await apiFetch("/api/agent/claims"));
}

export async function fetchClaim(id: string): Promise<ClaimDetail> {
  return json<ClaimDetail>(await apiFetch(`/api/agent/claims/${id}`));
}

export type NewClaimDraft = {
  customer_id?: string | null;
  new_customer_name?: string;
  new_customer_phone?: string;
  claim_type: ClaimType;
  insurer?: string;
  tpa?: string;
  policy_number?: string;
  hospital?: string;
  ailment?: string;
  claimed_amount?: string;
};

export async function createClaim(draft: NewClaimDraft): Promise<Claim> {
  return json<Claim>(
    await apiFetch("/api/agent/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    })
  );
}

export async function updateClaim(id: string, patch: Record<string, unknown>): Promise<Claim> {
  return json<Claim>(
    await apiFetch(`/api/agent/claims/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  );
}

/**
 * Move the claim. Settling or rejecting is refused server-side unless an
 * outcome document is already attached, so upload the letter first.
 * `proof_consent` records that the customer agreed the letter may outlive the
 * retention clock — without it the letter is purged with everything else.
 */
export async function setClaimStatus(
  id: string,
  status: ClaimStatus,
  opts?: { note?: string; settled_amount?: string; proof_consent?: boolean }
): Promise<Claim> {
  return json<Claim>(
    await apiFetch(`/api/agent/claims/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...opts }),
    })
  );
}

export async function addQuery(
  claimId: string,
  q: { question: string; raised_on?: string; raised_by?: string }
): Promise<ClaimQuery> {
  return json<ClaimQuery>(
    await apiFetch(`/api/agent/claims/${claimId}/queries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(q),
    })
  );
}

export async function updateQuery(
  claimId: string,
  queryId: string,
  patch: Record<string, unknown>
): Promise<ClaimQuery> {
  return json<ClaimQuery>(
    await apiFetch(`/api/agent/claims/${claimId}/queries/${queryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  );
}

export async function deleteQuery(claimId: string, queryId: string): Promise<void> {
  await json(await apiFetch(`/api/agent/claims/${claimId}/queries/${queryId}`, { method: "DELETE" }));
}

export async function uploadClaimDocument(
  claimId: string,
  file: File,
  meta: { category: DocCategory; doc_type?: string; query_id?: string }
): Promise<ClaimDocument> {
  const form = new FormData();
  form.append("file", file);
  form.append("category", meta.category);
  if (meta.doc_type) form.append("doc_type", meta.doc_type);
  if (meta.query_id) form.append("query_id", meta.query_id);
  // No Content-Type header: the browser sets the multipart boundary itself.
  return json<ClaimDocument>(
    await apiFetch(`/api/agent/claims/${claimId}/documents`, { method: "POST", body: form })
  );
}

export async function deleteClaimDocument(claimId: string, docId: string): Promise<void> {
  await json(
    await apiFetch(`/api/agent/claims/${claimId}/documents/${docId}`, { method: "DELETE" })
  );
}

/** Ten-minute signed URL, minted per view and audited server-side. */
export async function openClaimDocument(claimId: string, docId: string): Promise<string> {
  const { url } = await json<{ url: string }>(
    await apiFetch(`/api/agent/claims/${claimId}/documents/${docId}/url`)
  );
  return url;
}

export async function extendRetention(claimId: string): Promise<{ purge_at: string }> {
  return json<{ purge_at: string }>(
    await apiFetch(`/api/agent/claims/${claimId}/extend`, { method: "POST" })
  );
}

/* ── Presentation helpers ─────────────────────────────────────────────────── */

export const CLAIM_STATUS_META: Record<
  ClaimStatus,
  { label: string; badge: string; dot: string }
> = {
  opened:        { label: "Opened",     badge: "bg-slate-50 border-slate-200 text-slate-700",  dot: "bg-slate-400" },
  docs_received: { label: "Docs in",    badge: "bg-slate-50 border-slate-200 text-slate-700",  dot: "bg-slate-500" },
  submitted:     { label: "Submitted",  badge: "bg-teal-50 border-teal-200 text-teal-700",     dot: "bg-[#0D9488]" },
  under_process: { label: "In process", badge: "bg-blue-50 border-blue-200 text-blue-700",     dot: "bg-blue-600" },
  query_raised:  { label: "Query",      badge: "bg-amber-50 border-amber-200 text-amber-800",  dot: "bg-amber-600" },
  settled:       { label: "Settled",    badge: "bg-emerald-50 border-emerald-200 text-emerald-700", dot: "bg-emerald-600" },
  rejected:      { label: "Rejected",   badge: "bg-red-50 border-red-200 text-red-700",        dot: "bg-red-600" },
};

/** The advisor-facing spine. Query rounds hang off "under_process". */
export const CLAIM_SPINE: { key: ClaimStatus; label: string; hint: string }[] = [
  { key: "opened",        label: "Claim opened",        hint: "" },
  { key: "docs_received", label: "Documents received",  hint: "from the customer" },
  { key: "submitted",     label: "Submitted to insurer", hint: "" },
  { key: "under_process", label: "Claim under process", hint: "" },
];

export function spineIndex(status: ClaimStatus): number {
  // A queried claim is still "under process" as far as the spine is concerned.
  if (status === "query_raised") return 3;
  if (status === "settled" || status === "rejected") return 4;
  return CLAIM_SPINE.findIndex((s) => s.key === status);
}

/** The checklist is a reminder, never a gate — the advisor can add anything. */
export const PERSONAL_DOCS = [
  "Aadhaar — patient",
  "PAN card",
  "Policy copy or e-card",
  "Cancelled cheque",
  "NEFT mandate",
];

export const CASE_DOCS: Record<ClaimType, string[]> = {
  cashless: [
    "Pre-authorisation form",
    "TPA or insurer health card",
    "Doctor's advice for admission",
    "Hospital cost estimate",
    "Final bill",
    "Discharge summary",
  ],
  reimbursement: [
    "Claim form Part A",
    "Claim form Part B (hospital)",
    "Discharge summary",
    "Itemised final bill",
    "Payment receipts",
    "Diagnostic reports",
    "Prescriptions and pharmacy bills",
    "Implant sticker or invoice",
    "FIR or MLC copy (if accident)",
  ],
};

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDay(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function waLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.length === 10 ? "91" + digits : digits}`;
}

export function telLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  return digits.length >= 10 ? `tel:+${digits.length === 10 ? "91" + digits : digits}` : null;
}
