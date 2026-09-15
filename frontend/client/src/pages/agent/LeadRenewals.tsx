/**
 * Lead renewals — the "who to chase" hit-list. Every policy the agent has
 * collected from a prospect, soonest due date first, grouped by urgency. This
 * is the prospecting screen: the renewal date is the opening to sell.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CalendarClock, Check, MessageCircle, Phone } from "lucide-react";

import { useAgent } from "@/context/AgentContext";
import { InlineErrorState } from "@/components/agent/InlineErrorState";
import { toast } from "@/hooks/use-toast";
import { formatAmount } from "@/lib/customers";
import { telHref, waHref } from "@/lib/leads";
import { DraftMessageDialog } from "@/components/agent/DraftMessageDialog";
import type { DraftTarget } from "@/lib/draftMessage";
import {
  daysUntilDue,
  fetchDueLeadPolicies,
  LEAD_POLICY_TYPE_META,
  setLeadPolicySpoken,
  type LeadPolicyType,
  type LeadPolicyWithLead,
} from "@/lib/leadPolicies";
import { format } from "date-fns";

type Bucket = { key: string; label: string; rows: LeadPolicyWithLead[]; tone: string };

export default function LeadRenewals({ embedded = false }: { embedded?: boolean }) {
  const [, setLocation] = useLocation();
  const { agent } = useAgent();
  const [rows, setRows] = useState<LeadPolicyWithLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draftTarget, setDraftTarget] = useState<DraftTarget | null>(null);

  const load = useCallback(async () => {
    if (!agent?.agentId) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchDueLeadPolicies(agent.agentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [agent?.agentId]);

  useEffect(() => { void load(); }, [load]);

  const buckets = useMemo<Bucket[]>(() => {
    const overdue: LeadPolicyWithLead[] = [];
    const week: LeadPolicyWithLead[] = [];
    const month: LeadPolicyWithLead[] = [];
    const later: LeadPolicyWithLead[] = [];
    for (const r of rows) {
      const d = daysUntilDue(r.due_date);
      if (d === null) continue;
      if (d < 0) overdue.push(r);
      else if (d <= 7) week.push(r);
      else if (d <= 30) month.push(r);
      else later.push(r);
    }
    const base: Bucket[] = [
      { key: "overdue", label: "Overdue", rows: overdue, tone: "text-red-600" },
      { key: "week", label: "This week", rows: week, tone: "text-amber-600" },
      { key: "month", label: "This month", rows: month, tone: "text-slate-700" },
    ];
    if (showAll) base.push({ key: "later", label: "Later", rows: later, tone: "text-slate-500" });
    return base.filter((b) => b.rows.length > 0);
  }, [rows, showAll]);

  const within30 = useMemo(
    () => rows.filter((r) => { const d = daysUntilDue(r.due_date); return d !== null && d <= 30; }).length,
    [rows]
  );
  const laterCount = rows.length - within30;

  async function toggleSpoken(r: LeadPolicyWithLead) {
    setBusyId(r.id);
    try {
      await setLeadPolicySpoken(r.id, !r.spoken_to);
      setRows((list) => list.map((x) => (x.id === r.id ? { ...x, spoken_to: !x.spoken_to } : x)));
    } catch {
      toast({ variant: "destructive", title: "Couldn't update" });
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <InlineErrorState onRetry={load} />;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          {!embedded && (
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
              <CalendarClock className="h-6 w-6" style={{ color: "#0D9488" }} /> Renewals coming up
            </h1>
          )}
          <p className="text-sm text-slate-500 mt-1">
            {within30 > 0
              ? <><b className="text-slate-700">{within30}</b> {within30 === 1 ? "policy" : "policies"} due in the next 30 days. Reach out before they renew.</>
              : "No lead policies due in the next 30 days."}
          </p>
        </div>
        {laterCount > 0 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300"
          >
            {showAll ? "Hide later" : `Show all (${laterCount} later)`}
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />)}</div>
      ) : buckets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center text-slate-400">
          <CalendarClock className="mx-auto mb-3 h-9 w-9 text-slate-200" />
          <span className="italic">No upcoming renewals. Add policies to your leads to see them here.</span>
        </div>
      ) : (
        buckets.map((b) => (
          <div key={b.key}>
            <p className={`text-xs font-black uppercase tracking-widest mb-2 ${b.tone}`}>{b.label} ({b.rows.length})</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {b.rows.map((r) => (
                <RenewalCard
                  key={r.id}
                  row={r}
                  busy={busyId === r.id}
                  onOpen={() => r.agent_leads && setLocation(`/agent/leads/${r.agent_leads.id}`)}
                  onToggleSpoken={() => toggleSpoken(r)}
                  onDraft={() => r.agent_leads && setDraftTarget({ type: "lead", id: r.agent_leads.id, name: r.agent_leads.name, phone: r.agent_leads.phone })}
                />
              ))}
            </div>
          </div>
        ))
      )}

      <DraftMessageDialog target={draftTarget} open={!!draftTarget} onClose={() => setDraftTarget(null)} />
    </div>
  );
}

function RenewalCard({ row: r, busy, onOpen, onToggleSpoken, onDraft }: {
  row: LeadPolicyWithLead; busy: boolean; onOpen: () => void; onToggleSpoken: () => void; onDraft: () => void;
}) {
  const meta = LEAD_POLICY_TYPE_META[(r.insurance_type || "motor") as LeadPolicyType] ?? { label: r.insurance_type || "Policy", emoji: "📄" };
  const name = r.agent_leads?.name || r.policyholder_name || "Lead";
  const phone = r.agent_leads?.phone ?? null;
  const days = daysUntilDue(r.due_date);
  const due = r.due_date ? new Date(r.due_date) : null;
  const dueValid = due && !isNaN(due.getTime());
  const dueCls = days !== null && days < 0 ? "text-red-600" : days !== null && days <= 7 ? "text-red-600" : days !== null && days <= 30 ? "text-amber-600" : "text-slate-600";
  const wa = waHref(phone, `Hello ${name.split(" ")[0]}, `);
  const tel = telHref(phone);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <button onClick={onOpen} className="text-left min-w-0">
          <div className="font-bold text-slate-800 truncate">{name}</div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-bold">{meta.emoji} {meta.label}</span>
            <span className="truncate">{r.insurer || "Unknown insurer"}</span>
          </div>
        </button>
        <div className="text-right shrink-0">
          {dueValid && <div className={`text-sm font-bold ${dueCls}`}>{format(due!, "d MMM")}</div>}
          {days !== null && <div className={`text-[11px] font-semibold ${dueCls}`}>{days < 0 ? `overdue ${-days}d` : days === 0 ? "due today" : `in ${days}d`}</div>}
          {r.premium != null && <div className="text-[11px] text-slate-400 mt-0.5">{formatAmount(r.premium)}</div>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <a href={wa ?? undefined} target="_blank" rel="noopener noreferrer"
          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] py-2 text-sm font-bold text-white hover:brightness-95 ${!wa ? "opacity-40 pointer-events-none" : ""}`}>
          <MessageCircle size={16} /> WhatsApp
        </a>
        <a href={tel ?? undefined}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white hover:bg-slate-900 ${!tel ? "opacity-40 pointer-events-none" : ""}`}>
          <Phone size={16} />
        </a>
        <button onClick={onDraft} className="inline-flex items-center justify-center rounded-lg border border-[#0D9488]/30 bg-[#0D9488]/5 px-3 py-2 text-sm font-bold text-[#0D9488] hover:bg-[#0D9488]/10" title="Draft a message">
          ✍️
        </button>
      </div>

      <button
        onClick={onToggleSpoken}
        disabled={busy}
        className={[
          "inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold border transition-colors disabled:opacity-50",
          r.spoken_to ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
        ].join(" ")}
      >
        {r.spoken_to ? <><Check size={13} /> Spoken to</> : "Mark as spoken to"}
      </button>
    </div>
  );
}
