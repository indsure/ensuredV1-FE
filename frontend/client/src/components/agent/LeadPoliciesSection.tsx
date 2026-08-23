/**
 * "Their policies" block on the lead detail — lets the agent attach a
 * prospect's existing policies (upload + optional cheap OCR, or type by hand),
 * see the renewal due date, and mark whether they've spoken about it. Built so
 * the agent always has the policy context handy to sell near the due date.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ExternalLink, FileText, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { format } from "date-fns";

import { toast } from "@/hooks/use-toast";
import { formatAmount } from "@/lib/customers";
import {
  createLeadPolicy,
  daysUntilDue,
  deleteLeadPolicy,
  fetchLeadPolicies,
  LEAD_POLICY_TYPE_META,
  LEAD_POLICY_TYPES,
  OCR_SUPPORTED,
  setLeadPolicySpoken,
  uploadLeadPolicy,
  type LeadPolicy,
  type LeadPolicyType,
} from "@/lib/leadPolicies";

const ACCENT = "#0D9488";
const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30";

export function LeadPoliciesSection({ leadId, agentId }: { leadId: string; agentId: string }) {
  const [policies, setPolicies] = useState<LeadPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPolicies(await fetchLeadPolicies(leadId));
    } catch (e) {
      toast({ variant: "destructive", title: "Couldn't load policies", description: e instanceof Error ? e.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { void load(); }, [load]);

  async function toggleSpoken(p: LeadPolicy) {
    setBusyId(p.id);
    try {
      await setLeadPolicySpoken(p.id, !p.spoken_to);
      setPolicies((list) => list.map((x) => (x.id === p.id ? { ...x, spoken_to: !x.spoken_to } : x)));
    } catch (e) {
      toast({ variant: "destructive", title: "Couldn't update" });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(p: LeadPolicy) {
    setBusyId(p.id);
    try {
      await deleteLeadPolicy(p.id);
      setPolicies((list) => list.filter((x) => x.id !== p.id));
    } catch (e) {
      toast({ variant: "destructive", title: "Delete failed" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Their policies</p>
          <p className="text-sm text-slate-500 mt-0.5">Keep their existing policies handy. Reach out near the due date.</p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white"
            style={{ backgroundColor: ACCENT }}
          >
            <Plus size={16} /> Add policy
          </button>
        )}
      </div>

      {adding && (
        <AddPolicyForm
          leadId={leadId}
          agentId={agentId}
          onCancel={() => setAdding(false)}
          onAdded={(p) => { setPolicies((list) => [p, ...list]); setAdding(false); }}
        />
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)}</div>
      ) : policies.length === 0 && !adding ? (
        <div className="py-8 text-center text-slate-400 italic text-sm">No policies yet. Tap "Add policy" to upload or enter one.</div>
      ) : (
        <div className="space-y-3">
          {policies.map((p) => (
            <PolicyCard
              key={p.id}
              policy={p}
              busy={busyId === p.id}
              onToggleSpoken={() => toggleSpoken(p)}
              onDelete={() => remove(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Single policy card ─────────────────────────────────────────────────── */

function DueBadge({ due }: { due: string | null }) {
  if (!due) return <span className="text-slate-400 text-xs">No due date</span>;
  const d = new Date(due);
  if (isNaN(d.getTime())) return <span className="text-slate-400 text-xs">No due date</span>;
  const days = daysUntilDue(due);
  const label = format(d, "d MMM yyyy");
  let sub = "", cls = "text-slate-500";
  if (days !== null) {
    if (days < 0) { sub = `overdue ${-days}d`; cls = "text-red-600"; }
    else if (days === 0) { sub = "due today"; cls = "text-red-600"; }
    else if (days <= 30) { sub = `in ${days}d`; cls = "text-amber-600"; }
    else { sub = `in ${days}d`; cls = "text-slate-500"; }
  }
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-sm font-bold text-slate-800">{label}</span>
      {sub && <span className={`text-[11px] font-semibold ${cls}`}>{sub}</span>}
    </div>
  );
}

function PolicyCard({ policy: p, busy, onToggleSpoken, onDelete }: {
  policy: LeadPolicy; busy: boolean; onToggleSpoken: () => void; onDelete: () => void;
}) {
  const meta = LEAD_POLICY_TYPE_META[(p.insurance_type || "motor") as LeadPolicyType] ?? { label: p.insurance_type || "Policy", emoji: "📄" };
  return (
    <div className="rounded-xl border border-slate-150 bg-slate-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
              {meta.emoji} {meta.label}
            </span>
            <span className="font-bold text-slate-800 truncate">{p.insurer || "Unknown insurer"}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            {p.premium != null && <span>Premium <b className="text-slate-700">{formatAmount(p.premium)}</b></span>}
            {p.policyholder_name && <span className="truncate">{p.policyholder_name}</span>}
            {p.file_url && (
              <a href={p.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#0D9488] font-semibold hover:underline">
                <FileText size={13} /> View file <ExternalLink size={11} />
              </a>
            )}
          </div>
        </div>
        <DueBadge due={p.due_date} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-150 pt-3">
        <button
          onClick={onToggleSpoken}
          disabled={busy}
          className={[
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold border transition-colors disabled:opacity-50",
            p.spoken_to ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
          ].join(" ")}
        >
          {p.spoken_to ? <><Check size={13} /> Spoken to</> : "Not spoken yet"}
        </button>
        <button
          onClick={onDelete}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      </div>
    </div>
  );
}

/* ── Add policy form (upload + optional OCR, or manual) ─────────────────── */

function AddPolicyForm({ leadId, agentId, onCancel, onAdded }: {
  leadId: string; agentId: string; onCancel: () => void; onAdded: (p: LeadPolicy) => void;
}) {
  const [type, setType] = useState<LeadPolicyType>("motor");
  const [file, setFile] = useState<File | null>(null);
  const [ocr, setOcr] = useState(true);
  const [insurer, setInsurer] = useState("");
  const [premium, setPremium] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [holder, setHolder] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ocrAvailable = OCR_SUPPORTED.includes(type);

  async function save() {
    const overrides = { insurer, premium, due_date: dueDate, policyholder_name: holder };
    if (!file && !insurer.trim() && !premium.trim() && !dueDate.trim() && !holder.trim()) {
      toast({ variant: "destructive", title: "Add a file or some details first" });
      return;
    }
    setSaving(true);
    try {
      const row = file
        ? await uploadLeadPolicy(leadId, { file, type, ocr: ocr && ocrAvailable, overrides })
        : await createLeadPolicy(leadId, agentId, { insurance_type: type, ...overrides });
      toast({ variant: "success", title: "Policy saved" });
      onAdded(row);
    } catch (e) {
      toast({ variant: "destructive", title: "Couldn't save", description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-[#0D9488]/30 bg-[#0D9488]/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-slate-700">Add a policy</p>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-slate-500">Policy type</span>
          <select value={type} onChange={(e) => setType(e.target.value as LeadPolicyType)} className={inputCls}>
            {LEAD_POLICY_TYPES.map((t) => <option key={t} value={t}>{LEAD_POLICY_TYPE_META[t].label}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-slate-500">Policy file (optional)</span>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 hover:border-slate-300 truncate"
          >
            <Upload size={15} /> {file ? file.name : "Choose PDF or photo"}
          </button>
        </label>
      </div>

      {file && (
        <label className={`mt-3 flex items-center gap-2 text-sm ${ocrAvailable ? "text-slate-600" : "text-slate-400"}`}>
          <input type="checkbox" checked={ocr && ocrAvailable} disabled={!ocrAvailable} onChange={(e) => setOcr(e.target.checked)} className="h-4 w-4 accent-[#0D9488]" />
          Auto-fill details from the file
          {!ocrAvailable && <span className="text-[11px] text-slate-400">(not available for {LEAD_POLICY_TYPE_META[type].label} — type details below)</span>}
        </label>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Insurer"><input value={insurer} onChange={(e) => setInsurer(e.target.value)} placeholder="e.g. Go Digit" className={inputCls} /></Field>
        <Field label="Premium (₹)"><input value={premium} onChange={(e) => setPremium(e.target.value)} inputMode="numeric" placeholder="e.g. 12000" className={inputCls} /></Field>
        <Field label="Due / renewal date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} /></Field>
        <Field label="Policyholder name"><input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Optional" className={inputCls} /></Field>
      </div>

      {file && ocr && ocrAvailable && (
        <p className="mt-2 text-[11px] text-slate-400">Leave fields blank to fill them from the file. Anything you type wins.</p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: ACCENT }}>
          {saving && <Loader2 size={15} className="animate-spin" />} {file ? "Upload & save" : "Save policy"}
        </button>
        <button onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100">Cancel</button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      {children}
    </label>
  );
}
