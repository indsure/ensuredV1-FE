import { useCallback, useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowRight, Loader2, MessageCircle, Phone, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { format } from "date-fns";

import { useAgent } from "@/context/AgentContext";
import { InlineErrorState } from "@/components/agent/InlineErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { toast } from "@/hooks/use-toast";
import { formatAmount } from "@/lib/customers";
import {
  convertLeadToCustomer,
  deleteLead,
  fetchLead,
  LEAD_SOURCES,
  LEAD_STATUS_META,
  LEAD_STATUSES,
  setLeadStatus,
  telHref,
  updateLead,
  waHref,
  type Lead,
  type LeadStatus,
} from "@/lib/leads";

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30";
const INTEREST_OPTIONS = ["Health", "Motor", "Life", "Term", "Travel", "Property"];

type DraftState = {
  name: string; phone: string; email: string; city: string; source: string;
  insurance_interest: string; expected_value: string; next_follow_up: string; notes: string;
};

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { agent } = useAgent();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draft, setDraft] = useState<DraftState | null>(null);

  const load = useCallback(async () => {
    if (!id || !agent?.agentId) return;
    setLoading(true);
    setError(null);
    try {
      const l = await fetchLead(agent.agentId, id);
      if (!l) throw new Error("Lead not found.");
      setLead(l);
      setDraft({
        name: l.name,
        phone: l.phone ?? "",
        email: l.email ?? "",
        city: l.city ?? "",
        source: l.source ?? "",
        insurance_interest: l.insurance_interest ?? "",
        expected_value: l.expected_value != null ? String(l.expected_value) : "",
        next_follow_up: l.next_follow_up ? l.next_follow_up.slice(0, 10) : "",
        notes: l.notes ?? "",
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [id, agent?.agentId]);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!lead || !draft) return;
    if (!draft.name.trim()) {
      toast({ variant: "destructive", title: "Please enter a name" });
      return;
    }
    setBusy("save");
    try {
      await updateLead(lead.id, draft);
      await load();
      toast({ variant: "success", title: "Saved" });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Save failed", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  async function changeStatus(status: LeadStatus) {
    if (!lead) return;
    setBusy("status");
    try {
      await setLeadStatus(lead.id, status);
      setLead({ ...lead, status });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not update", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  async function convert() {
    if (!lead || !agent?.agentId) return;
    setBusy("convert");
    try {
      const customerId = await convertLeadToCustomer(agent.agentId, lead);
      toast({ variant: "success", title: "Saved as customer", description: "This lead is now in your customer list." });
      setLocation(`/agent/customers/${customerId}`);
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not convert", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!lead) return;
    setBusy("delete");
    try {
      await deleteLead(lead.id);
      toast({ variant: "success", title: "Lead deleted" });
      setLocation("/agent/leads");
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Delete failed", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  if (error) return <InlineErrorState onRetry={load} />;

  const tel = telHref(lead?.phone);
  const wa = lead ? waHref(lead.phone, `Hello ${lead.name.split(" ")[0]}, `) : null;

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="text-slate-600" onClick={() => setLocation("/agent/leads")}>
          Back to leads
        </Button>
        <Button variant="outline" size="sm" className="border-slate-200 bg-white" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {loading && <Card className="border-slate-100 shadow-sm"><CardContent className="p-10 text-center text-slate-400">Loading lead…</CardContent></Card>}

      {!loading && lead && draft && (
        <>
          {/* HEADER */}
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="font-['Playfair_Display'] text-4xl font-bold text-slate-900">{lead.name}</h1>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold ${LEAD_STATUS_META[lead.status].badge}`}>
                      <span className={`h-2 w-2 rounded-full ${LEAD_STATUS_META[lead.status].dot}`} /> {LEAD_STATUS_META[lead.status].label}
                    </span>
                    {lead.customer_id && (
                      <button onClick={() => setLocation(`/agent/customers/${lead.customer_id}`)} className="text-sm font-semibold text-[#0D9488] hover:underline">
                        View customer →
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-base text-slate-500">
                    {[lead.phone, lead.city, lead.insurance_interest].filter(Boolean).join(" · ") || "No details yet"}
                  </p>
                </div>

                {/* BIG CONTACT BUTTONS */}
                <div className="flex gap-3 shrink-0">
                  <a
                    href={wa ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-base font-bold text-white hover:brightness-95 ${!wa ? "opacity-40 pointer-events-none" : ""}`}
                  >
                    <MessageCircle className="h-5 w-5" /> WhatsApp
                  </a>
                  <a
                    href={tel ?? undefined}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-5 py-3 text-base font-bold text-white hover:bg-slate-900 ${!tel ? "opacity-40 pointer-events-none" : ""}`}
                  >
                    <Phone className="h-5 w-5" /> Call
                  </a>
                </div>
              </div>

              {/* STAGE PICKER */}
              <div className="mt-6">
                <p className="text-xs font-bold text-slate-500 mb-2">Stage</p>
                <div className="flex flex-wrap gap-2">
                  {LEAD_STATUSES.map((s) => {
                    const active = lead.status === s;
                    return (
                      <button
                        key={s}
                        onClick={() => !active && changeStatus(s)}
                        disabled={busy === "status"}
                        className={[
                          "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold border transition-colors disabled:opacity-50",
                          active ? "bg-[#0D9488] text-white border-[#0D9488]" : "bg-white text-slate-600 border-slate-200 hover:border-[#0D9488]/40",
                        ].join(" ")}
                      >
                        <span className={`h-2 w-2 rounded-full ${active ? "bg-white" : LEAD_STATUS_META[s].dot}`} /> {LEAD_STATUS_META[s].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CONVERT BANNER */}
              {!lead.customer_id && (
                <div className="mt-6 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <UserPlus className="h-5 w-5 text-emerald-600 shrink-0" />
                    <p className="text-sm text-emerald-800">
                      Got the policy? Save this lead as a <b>customer</b> to start their portfolio.
                    </p>
                  </div>
                  <Button onClick={convert} disabled={busy === "convert"} className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
                    {busy === "convert" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                    Save as customer
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* EDIT DETAILS */}
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-6">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Lead details</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Name *"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputCls} /></Field>
                <Field label="Phone / WhatsApp"><input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} inputMode="tel" className={inputCls} /></Field>
                <Field label="City"><input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} className={inputCls} /></Field>
                <Field label="Email"><input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} inputMode="email" className={inputCls} /></Field>
                <Field label="Interested in">
                  <select value={draft.insurance_interest} onChange={(e) => setDraft({ ...draft, insurance_interest: e.target.value })} className={inputCls}>
                    <option value="">Select…</option>
                    {INTEREST_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="How did they come?">
                  <select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} className={inputCls}>
                    <option value="">Select…</option>
                    {LEAD_SOURCES.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="Expected premium (₹)"><input value={draft.expected_value} onChange={(e) => setDraft({ ...draft, expected_value: e.target.value })} inputMode="numeric" className={inputCls} /></Field>
                <Field label="Call them again on"><input type="date" value={draft.next_follow_up} onChange={(e) => setDraft({ ...draft, next_follow_up: e.target.value })} className={inputCls} /></Field>
                <Field label="Notes" className="sm:col-span-2 lg:col-span-1"><input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className={inputCls} /></Field>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <Button onClick={save} disabled={busy === "save"} className="bg-[#0D9488] hover:bg-[#0f766e]">
                  {busy === "save" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save changes
                </Button>
                <Button variant="destructive" size="sm" className="bg-red-500 text-white hover:bg-red-600" onClick={() => setDeleteOpen(true)} disabled={busy === "delete"}>
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete lead
                </Button>
              </div>
              <p className="mt-4 text-xs text-slate-400">
                Added {format(new Date(lead.created_at), "d MMM yyyy")}
                {lead.expected_value != null && ` · Expected ${formatAmount(lead.expected_value)}`}
              </p>
            </CardContent>
          </Card>
        </>
      )}

      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => void remove()}
        title="Delete this lead?"
        description="This removes the lead. If you already saved them as a customer, that customer is NOT deleted."
        confirmText={busy === "delete" ? "Deleting…" : "Delete lead"}
        variant="destructive"
      />
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-bold text-slate-500">{label}</span>
      {children}
    </label>
  );
}
