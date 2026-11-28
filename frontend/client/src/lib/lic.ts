// LIC Premium Due + Commission sheets: API calls and the small helpers the LIC page and the Home
// card share. Server: backend/server/licRoutes.ts. Plan: docs/plans/2026-11-28-lic-premium-due.md

import { apiFetch, apiJson, apiOk } from "@/lib/api";
import { isPlaygroundMode } from "@/lib/playground/mode";
import { getLicPlan } from "@shared/licPlans";

export type LicMode = "Y" | "H" | "Q" | "M" | "S";
export type LicStatus = "paid" | "part_paid" | "due" | "in_grace" | "past_grace";
export type LicSheetKind = "due" | "commission";

export interface LicRow {
  policyNo: string;
  holderName: string;
  doc: string;
  planNo: number;
  licTerm: number;
  mode: LicMode;
  fup: string;
  flag: string | null;
  instPrem: number;
  dueCount: number;
  totalPrem: number;
  estComm: number;
  status: LicStatus;
  paidAmount: number;
  stillDue: number;
  dueDate: string;
  graceEnds: string;
  monthsBehind: number;
  chosenTerm: number | null;
}

export interface LicCount { count: number; amount: number }

export interface LicTotals {
  due: LicCount;
  paid: LicCount;
  notPaid: LicCount;
  pastGrace: LicCount;
  inGrace: LicCount;
  notYetDue: LicCount;
}

export interface LicUpload {
  id: number;
  kind: LicSheetKind;
  period: string;
  batch: number | null;
  agentCode: string;
  rowCount: number;
  totals: Record<string, number | string | null>;
  createdAt: string;
}

export interface LicOverview {
  dueList: { id: number; period: string; agentCode: string; rowCount: number; createdAt: string } | null;
  latestCommission: LicUpload | null;
  uploads: LicUpload[];
  rows: LicRow[];
  totals: LicTotals | null;
  today?: string;
}

export interface LicUploadResult {
  upload: LicUpload & { branchCode: string | null };
  totals?: LicTotals;
  dueList?: LicOverview["dueList"];
  thisSheet?: { paidOnList: LicCount; newPolicies: number; newPremium: number; paidBeforeList: number };
}

const EMPTY: LicOverview = { dueList: null, latestCommission: null, uploads: [], rows: [], totals: null };

export async function fetchLicOverview(): Promise<LicOverview> {
  // The demo has no LIC sheets and no backend: an honest empty state, not an error.
  if (isPlaygroundMode()) return EMPTY;
  return apiJson<LicOverview>(apiFetch("/api/lic/overview"));
}

export interface LicPayment {
  policyNo: string;
  planNo: number;
  term: number;
  dueDate: string;
  riskDate: string;
  adjDate: string;
  premium: number;
  commission: number;
  holderName: string;
  cbo: string;
  period: string;
  batch: number | null;
}

export interface LicPolicyDetail {
  policy: LicRow | null;
  dueList: LicOverview["dueList"];
  payments: LicPayment[];
  today: string;
}

export async function fetchLicPolicy(policyNo: string): Promise<LicPolicyDetail> {
  if (isPlaygroundMode()) throw new Error("LIC policies are not part of the demo.");
  return apiJson<LicPolicyDetail>(apiFetch(`/api/lic/policies/${encodeURIComponent(policyNo)}`));
}

export async function uploadLicSheet(kind: LicSheetKind, file: File): Promise<LicUploadResult> {
  if (isPlaygroundMode()) throw new Error("Uploading LIC sheets is not part of the demo.");
  const body = new FormData();
  body.append("kind", kind);
  body.append("file", file);
  return apiJson<LicUploadResult>(apiFetch("/api/lic/uploads", { method: "POST", body }));
}

export async function removeLicUpload(id: number): Promise<void> {
  await apiOk(apiFetch(`/api/lic/uploads/${id}`, { method: "DELETE" }));
}

/* ── list helpers (My Policies sorts and tabs) ───────────────────────── */

/** Today in India, YYYY-MM-DD, for when the server's own date is not at hand. */
export function todayLocalIso(): string {
  return new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
}

/** Days from today to the first unpaid instalment (negative when overdue); paid = far away. */
export function licDays(r: LicRow, today: string): number {
  if (r.status === "paid") return 99999;
  const ms = Date.parse(`${r.dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Not paid and due within 30 days, overdue included: the "Expiring Soon" tab. */
export function licIsDueSoon(r: LicRow, today: string): boolean {
  return r.status !== "paid" && licDays(r, today) <= 30;
}

const PER_YEAR: Record<LicMode, number> = { Y: 1, H: 2, Q: 4, M: 12, S: 0 };
export function licYearlyPremium(r: LicRow): number | null {
  const n = PER_YEAR[r.mode];
  return n ? r.instPrem * n : null;
}

/* ── display helpers ─────────────────────────────────────────────────── */

const intl = (locale: string) => (locale === "hi" ? "hi-IN" : "en-IN");

export function inr(n: number, locale = "en"): string {
  return `₹${Math.round(n).toLocaleString(intl(locale))}`;
}

export function dayText(iso: string, locale = "en"): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString(intl(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function monthText(yyyyMm: string, locale = "en", long = false): string {
  const d = new Date(`${yyyyMm}-01T00:00:00Z`);
  return d.toLocaleDateString(intl(locale), { month: long ? "long" : "short", year: "numeric", timeZone: "UTC" });
}

/** LIC prints names in capitals; show them the way people write them. */
export function niceName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\(la\)/g, " (LA)")
    .replace(/\(pr?\)/g, " (PR)")
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\s+/g, " ")
    .trim();
}

/** Who to address in a reminder: the proposer (PR) pays for a child's (LA) policy. */
export function payerName(raw: string): string {
  const m = raw.match(/\(LA\)\s*(.+?)\s*\(PR?\)?\s*$/i);
  return niceName(m ? m[1] : raw.replace(/\((LA|PR?)\)/gi, " "));
}

export function planLabel(planNo: number): string {
  const p = getLicPlan(planNo);
  return p ? `${p.name} (${planNo})` : `LIC plan ${planNo}`;
}

export function reminderText(row: LicRow, locale: string, advisor?: string | null): string {
  const name = payerName(row.holderName);
  const amt = inr(row.stillDue || row.totalPrem, locale);
  const plan = getLicPlan(row.planNo)?.name ?? `plan ${row.planNo}`;
  const date = dayText(row.dueDate, locale);
  const sign = advisor ? `\n${advisor}` : "";
  if (locale === "hi") {
    return `नमस्ते ${name} जी। आपकी LIC पॉलिसी ${row.policyNo} (${plan}) का ${amt} प्रीमियम ${date} को देय था। पॉलिसी चालू रखने के लिए कृपया जल्द भुगतान करें।${sign}`;
  }
  return `Namaste ${name} ji. Your LIC premium of ${amt} for policy ${row.policyNo} (${plan}) was due on ${date}. Please pay it soon so your policy stays active.${sign}`;
}

/** wa.me with no number: LIC sheets carry no phone numbers, so WhatsApp asks who to send it to. */
export function reminderHref(row: LicRow, locale: string, advisor?: string | null): string {
  return `https://wa.me/?text=${encodeURIComponent(reminderText(row, locale, advisor))}`;
}
