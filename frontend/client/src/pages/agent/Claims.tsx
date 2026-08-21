import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle, Clock, FileText, Loader2, MessageCircle, Phone, Plus, RefreshCw, Shield, X,
} from "lucide-react";

import { useAgent } from "@/context/AgentContext";
import { InlineErrorState } from "@/components/agent/InlineErrorState";
import { toast } from "@/hooks/use-toast";
import { fetchCustomers, formatAmount, type Customer } from "@/lib/customers";
import {
  CLAIM_STATUS_META,
  createClaim,
  fetchClaims,
  telLink,
  waLink,
  type Claim,
  type ClaimType,
} from "@/lib/claims";

const inputCls =
  "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30";

type Tab = "open" | "attention" | "closed";

const CLOSED: Claim["status"][] = ["settled", "rejected"];

/** Needs the advisor today: an insurer is waiting, or the files are about to go. */
function needsAttention(c: Claim): boolean {
  if (CLOSED.includes(c.status)) return false;
  if ((c.open_queries ?? 0) > 0) return true;
  return c.days_to_purge != null && c.days_to_purge <= 5;
}

export default function Claims() {
  const { agent } = useAgent();
  const [, setLocation] = useLocation();

  const [claims, setClaims] = useState<Claim[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("open");
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setClaims(await fetchClaims());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load claims");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!agent?.agentId) return;
    fetchCustomers(agent.agentId).then(setCustomers).catch(() => { /* picker falls back to a typed name */ });
  }, [agent?.agentId]);

  const attentionCount = useMemo(() => claims.filter(needsAttention).length, [claims]);
  const openCount = useMemo(() => claims.filter((c) => !CLOSED.includes(c.status)).length, [claims]);
  const closedCount = claims.length - openCount;

  // Money is summed from what survives a purge, so these totals keep growing
  // as documents are destroyed — that is the point of the record.
  const totals = useMemo(() => {
    let claimed = 0;
    let settled = 0;
    let settledCount = 0;
    for (const c of claims) {
      if (c.claimed_amount != null) claimed += Number(c.claimed_amount) || 0;
      if (c.settled_amount != null) settled += Number(c.settled_amount) || 0;
      if (c.status === "settled") settledCount += 1;
    }
    return { claimed, settled, settledCount };
  }, [claims]);

  const visible = useMemo(() => {
    if (tab === "attention") return claims.filter(needsAttention);
    if (tab === "closed") return claims.filter((c) => CLOSED.includes(c.status));
    return claims.filter((c) => !CLOSED.includes(c.status));
  }, [claims, tab]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">Claims</h1>
          <p className="text-sm text-slate-500 mt-1">Health claims you are running for your customers.</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCreateOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-3 text-base font-bold text-white hover:bg-[#0f766e] shadow-sm"
          >
            {createOpen ? <X size={18} /> : <Plus size={18} />} {createOpen ? "Cancel" : "New claim"}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm text-[#0D9488] font-semibold hover:underline disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* SUMMARY */}
      {!loading && claims.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Summary label="Claims opened" value={String(claims.length)} hint={`${openCount} still open`} />
          <Summary
            label="Closed"
            value={String(closedCount)}
            hint={closedCount > 0 ? `${totals.settledCount} settled` : "none yet"}
          />
          <Summary label="Amount claimed" value={formatAmount(totals.claimed)} />
          <Summary
            label="Amount settled"
            value={formatAmount(totals.settled)}
            tone="text-emerald-700"
            hint={
              totals.claimed > 0 && totals.settled > 0
                ? `${Math.round((totals.settled / totals.claimed) * 100)}% of what was claimed`
                : undefined
            }
          />
        </div>
      )}

      {/* TABS */}
      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 w-fit">
        {([
          ["open", "Open", openCount],
          ["attention", "Needs you", attentionCount],
          ["closed", "Closed", closedCount],
        ] as const).map(([key, label, count]) => {
          const active = tab === key;
          const urgent = key === "attention" && count > 0;
          return (
            <button
              key={key}
              onClick={() => setTab(key as Tab)}
              className={[
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors",
                active ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800",
              ].join(" ")}
            >
              {label}
              <span
                className={[
                  "inline-flex items-center justify-center rounded-full px-1.5 min-w-[20px] h-5 text-[11px] font-black",
                  urgent
                    ? "bg-amber-500 text-white"
                    : active
                      ? "text-white/60"
                      : "text-slate-400",
                ].join(" ")}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {createOpen && (
        <NewClaimForm
          customers={customers}
          onCancel={() => setCreateOpen(false)}
          onCreated={(claim) => {
            setCreateOpen(false);
            setLocation(`/agent/claims/${claim.id}`);
          }}
        />
      )}

      {error && <InlineErrorState message={error} onRetry={load} />}

      {/* NEEDS-YOU BANNER */}
      {!loading && attentionCount > 0 && tab !== "attention" && (
        <button
          onClick={() => setTab("attention")}
          className="w-full text-left bg-amber-50 border border-amber-200 rounded-2xl p-5 hover:bg-amber-100/60 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-bold text-amber-800">
              {attentionCount} claim{attentionCount !== 1 ? "s" : ""} need{attentionCount === 1 ? "s" : ""} you today
            </h2>
          </div>
          <p className="text-sm text-amber-800">
            An insurer is waiting on you, or documents are about to be deleted.
          </p>
        </button>
      )}

      {/* LIST */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-52 rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center text-slate-400">
          <Shield className="mx-auto mb-3 h-9 w-9 text-slate-200" />
          <span className="italic">
            {tab === "attention"
              ? "Nothing needs you right now."
              : tab === "closed"
                ? "No settled or rejected claims yet."
                : "No open claims. Tap “New claim” to start one."}
          </span>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => (
            <ClaimCard key={c.id} claim={c} onOpen={() => setLocation(`/agent/claims/${c.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Summary({
  label, value, hint, tone,
}: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-1">
      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`text-2xl font-bold ${tone ?? "text-slate-800"} font-['Playfair_Display'] leading-tight`}>
        {value}
      </span>
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </div>
  );
}

/* ── card ─────────────────────────────────────────────────────────────────── */

function ClaimCard({ claim, onOpen }: { claim: Claim; onOpen: () => void }) {
  const meta = CLAIM_STATUS_META[claim.status];
  const wa = waLink(claim.customer_phone);
  const tel = telLink(claim.customer_phone);
  const days = claim.days_to_purge;
  const queried = (claim.open_queries ?? 0) > 0;
  const urgentPurge = days != null && days <= 5 && !CLOSED.includes(claim.status);

  const border = queried
    ? "border-amber-200"
    : urgentPurge
      ? "border-red-200"
      : "border-slate-100";

  return (
    <div className={`bg-white rounded-2xl border ${border} shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow`}>
      <button onClick={onOpen} className="text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-lg font-bold text-slate-800 truncate">
              {claim.customer_name ?? <span className="italic text-slate-400">Customer removed</span>}
            </div>
            <div className="text-sm text-slate-500 truncate">
              {[claim.ailment, claim.hospital].filter(Boolean).join(" · ") || "No details yet"}
            </div>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${meta.badge}`}>
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} /> {meta.label}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {claim.claimed_amount != null && (
            <span className="font-bold text-slate-600">{formatAmount(Number(claim.claimed_amount))}</span>
          )}
          {claim.insurer && <span className="text-slate-500">{claim.insurer}</span>}
          {days != null && (
            <span
              className={[
                "ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 font-bold",
                urgentPurge ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500",
              ].join(" ")}
            >
              <Clock size={13} /> {days} day{days !== 1 ? "s" : ""} left
            </span>
          )}
        </div>
      </button>

      {queried && (
        <div className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          <span className="font-bold">
            Round {claim.total_queries} open.
          </span>{" "}
          The insurer is waiting on you.
        </div>
      )}

      {!queried && claim.documents_purged_at && (
        <div className="rounded-xl bg-slate-50 px-3.5 py-3 text-sm text-slate-500">
          Documents deleted. The claim record is kept.
        </div>
      )}

      {!queried && !claim.documents_purged_at && (
        <div className="flex items-center gap-2 text-xs text-slate-400 border-t border-slate-50 pt-3">
          <FileText size={15} />
          {claim.document_count ?? 0} document{(claim.document_count ?? 0) !== 1 ? "s" : ""}
        </div>
      )}

      {(wa || tel) && (
        <div className="flex items-center gap-2">
          <a
            href={wa ?? undefined}
            target="_blank"
            rel="noreferrer"
            className={`flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] text-white font-bold text-sm hover:brightness-95 ${!wa ? "opacity-40 pointer-events-none" : ""}`}
          >
            <MessageCircle className="h-5 w-5" /> WhatsApp
          </a>
          <a
            href={tel ?? undefined}
            className={`flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-900 ${!tel ? "opacity-40 pointer-events-none" : ""}`}
          >
            <Phone className="h-5 w-5" /> Call
          </a>
        </div>
      )}
    </div>
  );
}

/* ── create ───────────────────────────────────────────────────────────────── */

function NewClaimForm({
  customers,
  onCancel,
  onCreated,
}: {
  customers: Customer[];
  onCancel: () => void;
  onCreated: (claim: Claim) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [useNew, setUseNew] = useState(false);
  const [draft, setDraft] = useState({
    customer_id: "",
    new_customer_name: "",
    new_customer_phone: "",
    claim_type: "cashless" as ClaimType,
    insurer: "",
    hospital: "",
    ailment: "",
    claimed_amount: "",
  });

  const set = (k: keyof typeof draft, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  async function save() {
    if (!useNew && !draft.customer_id) {
      toast({ variant: "destructive", title: "Pick who the claim is for" });
      return;
    }
    if (useNew && !draft.new_customer_name.trim()) {
      toast({ variant: "destructive", title: "Enter the person's name" });
      return;
    }
    setSaving(true);
    try {
      const claim = await createClaim({
        customer_id: useNew ? null : draft.customer_id,
        new_customer_name: useNew ? draft.new_customer_name.trim() : undefined,
        new_customer_phone: useNew ? draft.new_customer_phone.trim() : undefined,
        claim_type: draft.claim_type,
        insurer: draft.insurer,
        hospital: draft.hospital,
        ailment: draft.ailment,
        claimed_amount: draft.claimed_amount,
      });
      onCreated(claim);
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Could not open the claim",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">New claim</p>

      {/* who */}
      <div className="flex flex-col gap-3 mb-5">
        <span className="text-xs font-bold text-slate-500">Who is the claim for</span>
        {!useNew ? (
          <>
            <select value={draft.customer_id} onChange={(e) => set("customer_id", e.target.value)} className={inputCls}>
              <option value="">Choose a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>
              ))}
            </select>
            <button
              onClick={() => setUseNew(true)}
              className="self-start flex items-center gap-1.5 text-sm text-[#0D9488] font-bold hover:underline"
            >
              <Plus size={15} /> Not in my list — add a new person
            </button>
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={draft.new_customer_name}
                onChange={(e) => set("new_customer_name", e.target.value)}
                placeholder="Full name"
                className={inputCls}
              />
              <input
                value={draft.new_customer_phone}
                onChange={(e) => set("new_customer_phone", e.target.value)}
                placeholder="10-digit number"
                inputMode="tel"
                className={inputCls}
              />
            </div>
            <button
              onClick={() => setUseNew(false)}
              className="self-start text-sm text-slate-500 font-bold hover:underline"
            >
              Pick from my customers instead
            </button>
          </>
        )}
      </div>

      {/* type */}
      <div className="flex flex-col gap-2 mb-5">
        <span className="text-xs font-bold text-slate-500">Type of claim</span>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["cashless", "Cashless", "Hospital bills the insurer"],
            ["reimbursement", "Reimbursement", "Customer paid, claims back"],
          ] as const).map(([key, label, hint]) => {
            const active = draft.claim_type === key;
            return (
              <button
                key={key}
                onClick={() => set("claim_type", key)}
                className={[
                  "text-left rounded-xl p-4 transition-colors",
                  active ? "border-2 border-[#0D9488] bg-teal-50" : "border border-slate-200 bg-white hover:bg-slate-50",
                ].join(" ")}
              >
                <div className={`text-base font-bold ${active ? "text-teal-700" : "text-slate-700"}`}>{label}</div>
                <div className={`text-xs ${active ? "text-teal-700" : "text-slate-500"}`}>{hint}</div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400">This decides which documents the claim asks you for.</p>
      </div>

      {/* the claim */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Labeled label="Insurer">
          <input value={draft.insurer} onChange={(e) => set("insurer", e.target.value)} placeholder="e.g. Niva Bupa" className={inputCls} />
        </Labeled>
        <Labeled label="Hospital">
          <input value={draft.hospital} onChange={(e) => set("hospital", e.target.value)} placeholder="Hospital and city" className={inputCls} />
        </Labeled>
        <Labeled label="What happened">
          <input value={draft.ailment} onChange={(e) => set("ailment", e.target.value)} placeholder="e.g. Fracture, left radius" className={inputCls} />
        </Labeled>
        <Labeled label="Amount claimed">
          <input value={draft.claimed_amount} onChange={(e) => set("claimed_amount", e.target.value)} placeholder="e.g. 185000" inputMode="numeric" className={inputCls} />
        </Labeled>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-[#0D9488] px-6 py-3 text-base font-bold text-white hover:bg-[#0f766e] disabled:opacity-50"
        >
          {saving && <Loader2 size={16} className="animate-spin" />} Open the claim
        </button>
        <button onClick={onCancel} className="text-sm font-bold text-slate-500 hover:underline">Cancel</button>
        <p className="text-xs text-slate-400 basis-full sm:basis-auto">
          Nothing is deleted yet. The 30-day clock starts when you upload the first document.
        </p>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      {children}
    </label>
  );
}
