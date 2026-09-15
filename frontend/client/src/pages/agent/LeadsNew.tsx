import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Bell, Loader2, MessageCircle, Phone, Plus, RefreshCw, Target, X } from "lucide-react";

import { useAgent } from "@/context/AgentContext";
import { InlineErrorState } from "@/components/agent/InlineErrorState";
import { DraftMessageDialog } from "@/components/agent/DraftMessageDialog";
import type { DraftTarget } from "@/lib/draftMessage";
import LeadRenewals from "@/pages/agent/LeadRenewals";
import { fetchDueLeadPolicies, daysUntilDue } from "@/lib/leadPolicies";
import { toast } from "@/hooks/use-toast";
import { formatAmount } from "@/lib/customers";
import {
  createLead,
  fetchLeads,
  isFollowUpDue,
  isOpen,
  LEAD_SOURCES,
  LEAD_STATUS_META,
  LEAD_STATUSES,
  setLeadStatus,
  sourceContext,
  telHref,
  waHref,
  type Lead,
  type LeadStatus,
} from "@/lib/leads";
import { format } from "date-fns";

type DraftState = {
  name: string;
  phone: string;
  city: string;
  source: string;
  insurance_interest: string;
  expected_value: string;
  next_follow_up: string;
  notes: string;
};
const EMPTY_DRAFT: DraftState = {
  name: "", phone: "", city: "", source: "", insurance_interest: "",
  expected_value: "", next_follow_up: "", notes: "",
};

const INTEREST_OPTIONS = ["Health", "Motor", "Life", "Term", "Travel", "Property"];

type Filter = "all" | "open" | LeadStatus;

export default function LeadsNew() {
  const [, setLocation] = useLocation();
  const { agent } = useAgent();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("open");
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draftTarget, setDraftTarget] = useState<DraftTarget | null>(null);
  const [view, setView] = useState<"pipeline" | "renewals">("pipeline");
  const [dueCount, setDueCount] = useState(0);

  const load = useCallback(async () => {
    if (!agent?.agentId) return;
    setLoading(true);
    setError(null);
    try {
      setLeads(await fetchLeads(agent.agentId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [agent?.agentId]);

  useEffect(() => { void load(); }, [load]);

  // Count of lead policies due within 30 days — for the Renewals tab badge.
  useEffect(() => {
    if (!agent?.agentId) return;
    fetchDueLeadPolicies(agent.agentId)
      .then((rows) => setDueCount(rows.filter((r) => { const d = daysUntilDue(r.due_date); return d !== null && d <= 30; }).length))
      .catch(() => {});
  }, [agent?.agentId]);

  const dueToday = useMemo(() => leads.filter(isFollowUpDue), [leads]);
  const openCount = useMemo(() => leads.filter(isOpen).length, [leads]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length, open: openCount };
    for (const s of LEAD_STATUSES) c[s] = 0;
    for (const l of leads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads, openCount]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return leads.filter((l) => {
      if (filter === "open" && !isOpen(l)) return false;
      if (filter !== "all" && filter !== "open" && l.status !== filter) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        (l.phone ?? "").toLowerCase().includes(q) ||
        (l.city ?? "").toLowerCase().includes(q) ||
        (l.insurance_interest ?? "").toLowerCase().includes(q) ||
        (l.source ?? "").toLowerCase().includes(q)
      );
    });
  }, [leads, search, filter]);

  async function handleCreate() {
    if (!agent?.agentId) {
      toast({ variant: "destructive", title: "Still loading your account", description: "Please wait a moment and try again." });
      return;
    }
    if (!draft.name.trim()) {
      toast({ variant: "destructive", title: "Please enter a name" });
      return;
    }
    setSaving(true);
    try {
      const created = await createLead(agent.agentId, draft);
      toast({ variant: "success", title: "Lead added" });
      setDraft(EMPTY_DRAFT);
      setCreateOpen(false);
      setLeads((prev) => [created, ...prev]);
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not add lead", description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function quickStatus(lead: Lead, status: LeadStatus) {
    setBusyId(lead.id);
    try {
      await setLeadStatus(lead.id, status);
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status } : l)));
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not update", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">Leads</h1>
          <p className="text-sm text-slate-500 mt-1">People you're following up with for a new policy.</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setView("pipeline"); setCreateOpen((v) => !v); }}
            className="flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-3 text-base font-bold text-white hover:bg-[#0f766e] shadow-sm"
          >
            {createOpen ? <X size={18} /> : <Plus size={18} />} {createOpen ? "Cancel" : "Add Lead"}
          </button>
          <button onClick={load} disabled={loading} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm text-[#0D9488] font-semibold hover:underline disabled:opacity-50">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* TABS: Pipeline vs Renewals */}
      <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 w-fit">
        {([["pipeline", "Pipeline"], ["renewals", "Renewals"]] as const).map(([key, label]) => {
          const active = view === key;
          return (
            <button
              key={key}
              onClick={() => setView(key)}
              className={[
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors",
                active ? "bg-white text-[#0D9488] shadow-sm" : "text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              {label}
              {key === "renewals" && dueCount > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[11px] font-black px-1.5 min-w-[20px] h-5">{dueCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {view === "renewals" ? (
        <LeadRenewals embedded />
      ) : (
      <>
      {/* CREATE FORM */}
      {createOpen && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">New lead</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Labeled label="Name *">
              <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Full name" className={inputCls} />
            </Labeled>
            <Labeled label="Phone / WhatsApp">
              <input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} placeholder="10-digit number" inputMode="tel" className={inputCls} />
            </Labeled>
            <Labeled label="City">
              <input value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} placeholder="City" className={inputCls} />
            </Labeled>
            <Labeled label="Interested in">
              <select value={draft.insurance_interest} onChange={(e) => setDraft((d) => ({ ...d, insurance_interest: e.target.value }))} className={inputCls}>
                <option value="">Select…</option>
                {INTEREST_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Labeled>
            <Labeled label="How did they come?">
              <select value={draft.source} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))} className={inputCls}>
                <option value="">Select…</option>
                {LEAD_SOURCES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Labeled>
            <Labeled label="Expected premium (₹)">
              <input value={draft.expected_value} onChange={(e) => setDraft((d) => ({ ...d, expected_value: e.target.value }))} placeholder="e.g. 15000" inputMode="numeric" className={inputCls} />
            </Labeled>
            <Labeled label="Call them again on">
              <input type="date" value={draft.next_follow_up} onChange={(e) => setDraft((d) => ({ ...d, next_follow_up: e.target.value }))} className={inputCls} />
            </Labeled>
            <Labeled label="Notes" className="sm:col-span-2">
              <input value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Anything to remember" className={inputCls} />
            </Labeled>
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !draft.name.trim()}
            className="mt-5 flex items-center gap-2 rounded-xl bg-[#0D9488] px-6 py-3 text-base font-bold text-white hover:bg-[#0f766e] disabled:opacity-50"
          >
            {saving && <Loader2 size={16} className="animate-spin" />} Save lead
          </button>
        </div>
      )}

      {error && <InlineErrorState onRetry={load} />}

      {!error && (
        <>
          {/* FOLLOW UP TODAY */}
          {dueToday.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-bold text-amber-800">Call today ({dueToday.length})</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {dueToday.map((l) => (
                  <div key={l.id} className="bg-white rounded-xl border border-amber-200 p-4 flex items-center justify-between gap-3">
                    <button onClick={() => setLocation(`/agent/leads/${l.id}`)} className="text-left min-w-0">
                      <div className="font-bold text-slate-800 truncate">{l.name}</div>
                      <div className="text-xs text-slate-500 truncate">{l.insurance_interest || "Policy"} · {l.city || "—"}</div>
                    </button>
                    <ContactButtons phone={l.phone} name={l.name} compact />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FILTER CHIPS */}
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip active={filter === "open"} onClick={() => setFilter("open")} label="Open" count={counts.open} />
            {LEAD_STATUSES.map((s) => (
              <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)} label={LEAD_STATUS_META[s].label} count={counts[s]} dot={LEAD_STATUS_META[s].dot} />
            ))}
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={counts.all} />
            <input
              type="search"
              placeholder="Search name, phone, city…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ml-auto w-64 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
            />
          </div>

          {/* LEAD CARDS */}
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-44 rounded-2xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center text-slate-400">
              <Target className="mx-auto mb-3 h-9 w-9 text-slate-200" />
              {search
                ? <span className="italic">No leads match "{search}"</span>
                : <span className="italic">No leads here yet. Tap "Add Lead" to add your first one.</span>}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((l) => (
                <LeadCard
                  key={l.id}
                  lead={l}
                  busy={busyId === l.id}
                  onOpen={() => setLocation(`/agent/leads/${l.id}`)}
                  onStatus={(s) => quickStatus(l, s)}
                  onDraft={() => setDraftTarget({ type: "lead", id: l.id, name: l.name, phone: l.phone, interest: l.insurance_interest })}
                />
              ))}
            </div>
          )}
        </>
      )}

      <DraftMessageDialog
        target={draftTarget}
        open={!!draftTarget}
        onClose={() => setDraftTarget(null)}
      />
      </>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30";

function Labeled({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-bold text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function FilterChip({ active, onClick, label, count, dot }: { active: boolean; onClick: () => void; label: string; count: number; dot?: string }) {
  return (
    <button
      onClick={onClick}
      className={[
        "inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold border transition-colors",
        active ? "bg-[#0D9488] text-white border-[#0D9488]" : "bg-white text-slate-600 border-slate-200 hover:border-[#0D9488]/40",
      ].join(" ")}
    >
      {dot && <span className={`h-2 w-2 rounded-full ${active ? "bg-white" : dot}`} />}
      {label}
      <span className={`text-xs font-bold ${active ? "text-white/80" : "text-slate-400"}`}>{count}</span>
    </button>
  );
}

function ContactButtons({ phone, name, compact = false }: { phone: string | null; name: string; compact?: boolean }) {
  const tel = telHref(phone);
  const wa = waHref(phone, `Hello ${name.split(" ")[0]}, `);
  const size = compact ? "h-10 w-10" : "h-11 flex-1";
  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "w-full"}`} onClick={(e) => e.stopPropagation()}>
      <a
        href={wa ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!wa}
        className={`${size} inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] text-white font-bold text-sm hover:brightness-95 ${!wa ? "opacity-40 pointer-events-none" : ""}`}
        title="WhatsApp"
      >
        <MessageCircle className="h-5 w-5" /> {!compact && "WhatsApp"}
      </a>
      <a
        href={tel ?? undefined}
        aria-disabled={!tel}
        className={`${size} inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-900 ${!tel ? "opacity-40 pointer-events-none" : ""}`}
        title="Call"
      >
        <Phone className="h-5 w-5" /> {!compact && "Call"}
      </a>
    </div>
  );
}

function LeadCard({ lead, busy, onOpen, onStatus, onDraft }: { lead: Lead; busy: boolean; onOpen: () => void; onStatus: (s: LeadStatus) => void; onDraft: () => void }) {
  const meta = LEAD_STATUS_META[lead.status];
  const due = isFollowUpDue(lead);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      <button onClick={onOpen} className="text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-lg font-bold text-slate-800 truncate">{lead.name}</div>
            <div className="text-sm text-slate-500 truncate">
              {[lead.insurance_interest, lead.city].filter(Boolean).join(" · ") || "No details yet"}
            </div>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${meta.badge}`}>
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} /> {meta.label}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          {lead.expected_value != null && <span className="font-semibold text-slate-500">≈ {formatAmount(lead.expected_value)}</span>}
          {lead.source && <span>via {lead.source}</span>}
          {sourceContext(lead) && <span className="text-slate-500">{sourceContext(lead)}</span>}
          {lead.utm_campaign && <span className="text-slate-500">“{lead.utm_campaign}”</span>}
          {lead.next_follow_up && (
            <span className={due ? "font-bold text-amber-600" : ""}>
              {due ? "⏰ Call " : "Next: "}{format(new Date(lead.next_follow_up), "d MMM")}
            </span>
          )}
        </div>
      </button>

      <ContactButtons phone={lead.phone} name={lead.name} />

      <button
        onClick={onDraft}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#0D9488]/30 bg-[#0D9488]/5 py-2.5 text-sm font-bold text-[#0D9488] hover:bg-[#0D9488]/10"
      >
        <MessageCircle className="h-4 w-4" /> Draft message
      </button>

      {/* QUICK STAGE MOVE */}
      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-50">
        {busy && <Loader2 className="h-4 w-4 animate-spin text-slate-300" />}
        {LEAD_STATUSES.filter((s) => s !== lead.status).map((s) => (
          <button
            key={s}
            onClick={() => onStatus(s)}
            disabled={busy}
            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            title={`Move to ${LEAD_STATUS_META[s].label}`}
          >
            → {LEAD_STATUS_META[s].label}
          </button>
        ))}
      </div>
    </div>
  );
}
