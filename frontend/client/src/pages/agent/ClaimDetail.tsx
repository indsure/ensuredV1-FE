import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle2, Circle, Clock, Loader2, MessageCircle,
  Phone, Plus, Trash2, Upload, X,
} from "lucide-react";

import { InlineErrorState } from "@/components/agent/InlineErrorState";
import { toast } from "@/hooks/use-toast";
import { formatAmount } from "@/lib/customers";
import {
  addQuery, CASE_DOCS, CLAIM_SPINE, CLAIM_STATUS_META, deleteClaimDocument, deleteQuery,
  extendRetention, fetchClaim, formatDate, formatDay, openClaimDocument, PERSONAL_DOCS,
  setClaimStatus, spineIndex, telLink, updateQuery, uploadClaimDocument, waLink,
  type ClaimDetail as ClaimDetailType, type ClaimDocument, type ClaimQuery, type DocCategory,
} from "@/lib/claims";

const CLOSED = ["settled", "rejected"];

export default function ClaimDetail() {
  const [, params] = useRoute("/agent/claims/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ?? "";

  const [claim, setClaim] = useState<ClaimDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"settled" | "rejected" | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setClaim(await fetchClaim(id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load the claim");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-40 rounded-lg bg-slate-100 animate-pulse" />
        {[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-2xl bg-slate-100 animate-pulse" />)}
      </div>
    );
  }
  if (error) return <InlineErrorState message={error} onRetry={load} />;
  if (!claim) return null;

  const meta = CLAIM_STATUS_META[claim.status];
  const closed = CLOSED.includes(claim.status);
  const wa = waLink(claim.customer_phone);
  const tel = telLink(claim.customer_phone);

  return (
    <div className="space-y-5 animate-in fade-in duration-500 max-w-5xl">

      <button
        onClick={() => setLocation("/agent/claims")}
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> Claims
      </button>

      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-['Playfair_Display'] leading-tight">
              {claim.ailment || "Health claim"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {claim.customer_name ?? <span className="italic">Customer removed</span>}
              {claim.hospital ? ` · ${claim.hospital}` : ""}
              {" · "}
              {claim.claim_type === "cashless" ? "Cashless" : "Reimbursement"}
            </p>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${meta.badge}`}>
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} /> {meta.label}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-100 pt-4">
          <Stat label="Claimed" value={claim.claimed_amount != null ? formatAmount(Number(claim.claimed_amount)) : "—"} />
          <Stat
            label="Settled"
            value={claim.settled_amount != null ? formatAmount(Number(claim.settled_amount)) : "—"}
            tone={claim.settled_amount != null ? "text-emerald-700" : undefined}
          />
          <Stat label="Insurer" value={claim.insurer || "—"} />
          <Stat label="TPA" value={claim.tpa || "—"} />
        </div>

        {(wa || tel) && (
          <div className="flex items-center gap-2">
            <a
              href={wa ?? undefined}
              target="_blank"
              rel="noreferrer"
              className={`flex-1 sm:flex-none sm:px-6 h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] text-white font-bold text-sm hover:brightness-95 ${!wa ? "opacity-40 pointer-events-none" : ""}`}
            >
              <MessageCircle className="h-5 w-5" /> WhatsApp
            </a>
            <a
              href={tel ?? undefined}
              className={`flex-1 sm:flex-none sm:px-6 h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-900 ${!tel ? "opacity-40 pointer-events-none" : ""}`}
            >
              <Phone className="h-5 w-5" /> Call
            </a>
          </div>
        )}
      </div>

      <Tracker claim={claim} />

      <Queries claim={claim} onChanged={load} />

      <Retention claim={claim} onChanged={load} />

      {!claim.documents_purged_at && (
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          <Pile
            claim={claim}
            category="personal"
            title="Personal documents"
            subtitle="identity and bank"
            checklist={PERSONAL_DOCS}
            onChanged={load}
          />
          <Pile
            claim={claim}
            category="case"
            title="Case files"
            subtitle="first visit to discharge"
            checklist={CASE_DOCS[claim.claim_type]}
            onChanged={load}
          />
        </div>
      )}

      <Outcome claim={claim} onChanged={load} />

      {!closed && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-3">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Update the claim</p>
          <StatusButtons claim={claim} onChanged={load} onClose={(kind) => setOutcome(kind)} />
        </div>
      )}

      <Timeline claim={claim} />

      {outcome && (
        <OutcomeDialog
          claim={claim}
          kind={outcome}
          onClose={() => setOutcome(null)}
          onDone={() => { setOutcome(null); void load(); }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`text-base font-bold ${tone ?? "text-slate-800"} truncate`}>{value}</span>
    </div>
  );
}

/* ── tracker ──────────────────────────────────────────────────────────────── */

function Tracker({ claim }: { claim: ClaimDetailType }) {
  const at = spineIndex(claim.status);
  const closed = CLOSED.includes(claim.status);
  const openRounds = claim.queries.filter((q) => !q.resolved_on).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Where the claim is</p>
      <ol className="flex flex-col">
        {CLAIM_SPINE.map((step, i) => {
          const done = i < at;
          const current = i === at && !closed;
          return (
            <li key={step.key} className="flex items-start gap-3.5">
              <div className="flex flex-col items-center self-stretch shrink-0">
                <span
                  className={[
                    "h-6 w-6 rounded-full flex items-center justify-center",
                    done ? "bg-[#0D9488]" : current ? "bg-blue-50 ring-[3px] ring-blue-600" : "border-2 border-dashed border-slate-300 bg-white",
                  ].join(" ")}
                >
                  {done && <Check size={13} strokeWidth={3} className="text-white" />}
                </span>
                <span className={`w-0.5 flex-1 min-h-[18px] ${done ? "bg-[#0D9488]" : "bg-slate-200"}`} />
              </div>
              <div className="pb-4">
                <div className={`text-sm font-bold ${current ? "text-blue-700" : done ? "text-slate-800" : "text-slate-400"}`}>
                  {step.label}
                </div>
                {current && step.key === "under_process" && (
                  <div className="text-xs text-slate-500">
                    {openRounds > 0 ? `Paused by round ${claim.queries[claim.queries.length - 1]?.seq}` : "No query yet"}
                  </div>
                )}
                {step.hint && !current && <div className="text-xs text-slate-400">{step.hint}</div>}
              </div>
            </li>
          );
        })}
        <li className="flex items-start gap-3.5">
          <div className="flex flex-col items-center shrink-0">
            <span
              className={[
                "h-6 w-6 rounded-full flex items-center justify-center",
                closed ? (claim.status === "settled" ? "bg-emerald-600" : "bg-red-600") : "border-2 border-dashed border-slate-300 bg-white",
              ].join(" ")}
            >
              {closed && <Check size={13} strokeWidth={3} className="text-white" />}
            </span>
          </div>
          <div>
            <div className={`text-sm font-bold ${closed ? (claim.status === "settled" ? "text-emerald-700" : "text-red-700") : "text-slate-400"}`}>
              {closed ? CLAIM_STATUS_META[claim.status].label : "Settled or rejected"}
            </div>
            <div className="text-xs text-slate-400">
              {closed ? formatDate(claim.closed_at) : "Needs a letter from the insurer"}
            </div>
          </div>
        </li>
      </ol>
    </div>
  );
}

/* ── queries ──────────────────────────────────────────────────────────────── */

function Queries({ claim, onChanged }: { claim: ClaimDetailType; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [question, setQuestion] = useState("");
  const [raisedBy, setRaisedBy] = useState("");
  const [busy, setBusy] = useState(false);

  const rounds = useMemo(() => [...claim.queries].sort((a, b) => b.seq - a.seq), [claim.queries]);
  const openCount = rounds.filter((q) => !q.resolved_on).length;
  const closed = CLOSED.includes(claim.status);

  async function save() {
    if (!question.trim()) {
      toast({ variant: "destructive", title: "Write down what the insurer asked" });
      return;
    }
    setBusy(true);
    try {
      await addQuery(claim.id, { question: question.trim(), raised_by: raisedBy.trim() || undefined });
      setQuestion(""); setRaisedBy(""); setAdding(false);
      onChanged();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not save the query", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-800">Insurer queries</h2>
          <p className="text-xs text-slate-500">
            {rounds.length === 0
              ? "None so far."
              : `${rounds.length} round${rounds.length !== 1 ? "s" : ""} so far · ${openCount} still open`}
          </p>
        </div>
        {openCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
            <span className="h-2 w-2 rounded-full bg-amber-600" /> {openCount} open
          </span>
        )}
      </div>

      {rounds.map((q) => (
        <QueryRound key={q.id} claim={claim} round={q} onChanged={onChanged} />
      ))}

      {!closed && (adding ? (
        <div className="rounded-2xl border border-slate-200 p-4 flex flex-col gap-3">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            placeholder="What did the insurer ask for?"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
          />
          <input
            value={raisedBy}
            onChange={(e) => setRaisedBy(e.target.value)}
            placeholder="Who asked — insurer or TPA (optional)"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0f766e] disabled:opacity-50"
            >
              {busy && <Loader2 size={15} className="animate-spin" />} Save query
            </button>
            <button onClick={() => setAdding(false)} className="text-sm font-bold text-slate-500 hover:underline">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-sm font-bold text-slate-600 hover:bg-slate-50"
        >
          <Plus size={17} /> Insurer raised {rounds.length ? "another" : "a"} query
        </button>
      ))}

      {!closed && (
        <p className="text-xs text-slate-400">
          Add as many rounds as the insurer raises. Each one keeps its own question, dates and papers.
        </p>
      )}
    </div>
  );
}

function QueryRound({
  claim, round, onChanged,
}: { claim: ClaimDetailType; round: ClaimQuery; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const open = !round.resolved_on;
  const replies = claim.documents.filter((d) => d.query_id === round.id);

  async function resolve() {
    setBusy(true);
    try {
      await updateQuery(claim.id, round.id, { resolve: true });
      onChanged();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not resolve", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteQuery(claim.id, round.id);
      onChanged();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not remove", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3.5 flex items-center gap-3">
        <CheckCircle2 size={19} className="text-emerald-600 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-black tracking-wider text-slate-400">ROUND {round.seq}</span>
            <span className="text-sm font-semibold text-slate-700 truncate">{round.question}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            {formatDay(round.raised_on)} to {formatDay(round.resolved_on)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="rounded-lg bg-amber-600 px-2 py-1 text-[11px] font-black tracking-wide text-white">
          ROUND {round.seq}
        </span>
        <span className="text-xs font-semibold text-amber-800">
          Raised {formatDay(round.raised_on)}{round.raised_by ? ` by ${round.raised_by}` : ""}
        </span>
        <button
          onClick={remove}
          disabled={busy}
          title="Remove this query"
          className="ml-auto text-amber-700 hover:text-red-600 disabled:opacity-40"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-white p-3.5">
        <p className="text-sm text-slate-700 leading-relaxed">{round.question}</p>
      </div>

      {replies.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-700">Sent back so far</span>
          {replies.map((d) => (
            <DocRow key={d.id} claim={claim} doc={d} onChanged={onChanged} compact />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <UploadButton
          claim={claim}
          category="case"
          queryId={round.id}
          onChanged={onChanged}
          className="flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-amber-500 bg-white text-sm font-bold text-amber-700 hover:bg-amber-100/50"
          label="Add reply document"
        />
        <button
          onClick={resolve}
          disabled={busy}
          className="flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D9488] text-sm font-bold text-white hover:bg-[#0f766e] disabled:opacity-50"
        >
          {busy && <Loader2 size={15} className="animate-spin" />} Round {round.seq} resolved
        </button>
      </div>
    </div>
  );
}

/* ── retention ────────────────────────────────────────────────────────────── */

function Retention({ claim, onChanged }: { claim: ClaimDetailType; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  if (claim.documents_purged_at) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Trash2 size={19} className="text-slate-500" />
          <div>
            <p className="text-base font-bold text-slate-700">Documents deleted</p>
            <p className="text-xs text-slate-500">on {formatDate(claim.documents_purged_at)}</p>
          </div>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">
          Every file on this claim was destroyed on schedule, as the customer was told when you
          collected them. They cannot be recovered by anyone, including us. The claim record and
          its history below are kept.
        </p>
      </div>
    );
  }

  if (!claim.purge_at) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-start gap-3 shadow-sm">
        <Clock size={18} className="text-slate-400 mt-0.5 shrink-0" />
        <p className="text-sm text-slate-500 leading-relaxed">
          Nothing uploaded yet. <span className="font-semibold text-slate-700">The 30-day clock starts
          on the first document</span> — we keep claim documents for 30 days only, in line with IRDAI
          guidance.
        </p>
      </div>
    );
  }

  const days = claim.days_to_purge ?? 0;
  const total = claim.extension_used ? 60 : 30;
  const elapsed = Math.max(0, total - days);
  const pct = Math.min(100, Math.round((elapsed / total) * 100));
  const urgent = days <= 5;

  async function extend() {
    setBusy(true);
    try {
      await extendRetention(claim.id);
      toast({ title: "Kept for 30 more days" });
      onChanged();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not extend", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`rounded-2xl border bg-white p-6 shadow-sm flex flex-col gap-3 ${urgent ? "border-red-200" : "border-slate-200"}`}>
      <div className="flex items-center gap-2.5 flex-wrap">
        <Trash2 size={18} className={urgent ? "text-red-600" : "text-slate-500"} />
        <span className="text-base font-bold text-slate-800">Documents deleted on {formatDate(claim.purge_at)}</span>
        {claim.extension_used && (
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">EXTENDED</span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full rounded-full ${urgent ? "bg-red-600" : claim.extension_used ? "bg-blue-600" : "bg-[#0D9488]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className={`font-bold ${urgent ? "text-red-700" : "text-slate-600"}`}>Day {elapsed} of {total}</span>
          <span className="text-slate-500">{days} day{days !== 1 ? "s" : ""} left</span>
        </div>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">
        We keep claim documents for 30 days only, in line with IRDAI guidance. From day 25 you can
        add 30 more days if the claim is still open. At 60 days everything is deleted for good.
      </p>

      {claim.can_extend && (
        <button
          onClick={extend}
          disabled={busy}
          className="h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D9488] text-sm font-bold text-white hover:bg-[#0f766e] disabled:opacity-50"
        >
          {busy && <Loader2 size={15} className="animate-spin" />} Keep for 30 more days
        </button>
      )}
      {claim.extension_used && (
        <p className="text-xs text-slate-400">
          This claim has had its one extension. It cannot be extended again.
        </p>
      )}
    </div>
  );
}

/* ── document piles ───────────────────────────────────────────────────────── */

function Pile({
  claim, category, title, subtitle, checklist, onChanged,
}: {
  claim: ClaimDetailType;
  category: DocCategory;
  title: string;
  subtitle: string;
  checklist: string[];
  onChanged: () => void;
}) {
  // Only files filed against the pile itself — query replies live with their round.
  const docs = claim.documents.filter((d) => d.category === category && !d.query_id);
  const done = new Set(docs.map((d) => d.doc_type).filter(Boolean) as string[]);
  const missing = checklist.filter((c) => !done.has(c));

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h2 className="text-base font-bold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-500">{docs.length} of {checklist.length} · {subtitle}</p>
        </div>
        <UploadButton
          claim={claim}
          category={category}
          onChanged={onChanged}
          className="shrink-0 h-11 px-4 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#0D9488]/30 bg-[#0D9488]/5 text-sm font-bold text-[#0D9488] hover:bg-[#0D9488]/10"
          label="Add"
        />
      </div>

      <div className="flex flex-col">
        {docs.map((d) => <DocRow key={d.id} claim={claim} doc={d} onChanged={onChanged} />)}
        {missing.map((label) => (
          <div key={label} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
            <Circle size={18} className="text-slate-300 shrink-0" strokeDasharray="3 3" />
            <span className="text-sm font-medium text-slate-400">{label}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400">This list is a reminder, not a rule.</p>
    </div>
  );
}

function DocRow({
  claim, doc, onChanged, compact,
}: { claim: ClaimDetailType; doc: ClaimDocument; onChanged: () => void; compact?: boolean }) {
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    try {
      const url = await openClaimDocument(claim.id, doc.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not open the file", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteClaimDocument(claim.id, doc.id);
      onChanged();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not delete", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex items-center gap-3 py-2.5 ${compact ? "rounded-xl border border-amber-200 bg-white px-3" : "border-b border-slate-50 last:border-0"}`}>
      <CheckCircle2 size={18} className="text-[#0D9488] shrink-0" />
      <button onClick={open} disabled={busy} className="min-w-0 flex-1 text-left group">
        <div className="text-sm font-semibold text-slate-800 truncate group-hover:text-[#0D9488]">
          {doc.doc_type || doc.filename}
        </div>
        <div className="text-[11px] text-slate-400 truncate">
          {doc.filename}
          {doc.file_size ? ` · ${Math.max(1, Math.round(doc.file_size / 1024))} KB` : ""}
        </div>
      </button>
      {busy ? (
        <Loader2 size={15} className="animate-spin text-slate-300 shrink-0" />
      ) : (
        <button onClick={remove} title="Delete" className="text-slate-300 hover:text-red-600 shrink-0">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

function UploadButton({
  claim, category, queryId, onChanged, className, label,
}: {
  claim: ClaimDetailType;
  category: DocCategory;
  queryId?: string;
  onChanged: () => void;
  className: string;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const res = await uploadClaimDocument(claim.id, file, {
        category,
        // The file name is the advisor's own label for it — no OCR reads it.
        doc_type: file.name.replace(/\.[^.]+$/, "").slice(0, 80),
        query_id: queryId,
      });
      if ((res as any).retention) {
        toast({
          title: "Saved. The 30-day clock has started.",
          description: "These documents are deleted automatically. You can add 30 more days from day 25.",
        });
      }
      onChanged();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Upload failed", description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input ref={ref} type="file" onChange={pick} className="hidden" accept="application/pdf,image/*" />
      <button onClick={() => ref.current?.click()} disabled={busy} className={`${className} disabled:opacity-50`}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {label}
      </button>
    </>
  );
}

/* ── outcome ──────────────────────────────────────────────────────────────── */

function Outcome({ claim, onChanged }: { claim: ClaimDetailType; onChanged: () => void }) {
  const proof = claim.documents.filter((d) => d.category === "outcome");
  if (proof.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400 flex-1">
          {claim.proof_consent_at ? "Kept with permission" : "Proof from the insurer"}
        </p>
      </div>
      {proof.map((d) => (
        <div key={d.id} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3">
          <DocRow claim={claim} doc={d} onChanged={onChanged} />
        </div>
      ))}
      <p className="text-xs text-slate-400">
        {claim.proof_consent_at
          ? `The customer agreed on ${formatDate(claim.proof_consent_at)} that this letter can be kept after the rest is deleted.`
          : "Without the customer's permission this letter is deleted with everything else."}
      </p>
    </div>
  );
}

function StatusButtons({
  claim, onChanged, onClose,
}: { claim: ClaimDetailType; onChanged: () => void; onClose: (kind: "settled" | "rejected") => void }) {
  const [busy, setBusy] = useState(false);
  const at = spineIndex(claim.status);

  const next = CLAIM_SPINE[at + 1];

  async function advance() {
    if (!next) return;
    setBusy(true);
    try {
      await setClaimStatus(claim.id, next.key);
      onChanged();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not update", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {next && claim.status !== "query_raised" && (
        <button
          onClick={advance}
          disabled={busy}
          className="h-13 py-3.5 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-base font-bold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy && <Loader2 size={16} className="animate-spin" />} Move to “{next.label}”
        </button>
      )}
      <div className="flex items-stretch gap-3">
        <button
          onClick={() => onClose("settled")}
          className="flex-1 py-3.5 inline-flex items-center justify-center rounded-xl bg-emerald-600 text-base font-bold text-white hover:bg-emerald-700"
        >
          Settled
        </button>
        <button
          onClick={() => onClose("rejected")}
          className="flex-1 py-3.5 inline-flex items-center justify-center rounded-xl border border-red-200 bg-white text-base font-bold text-red-700 hover:bg-red-50"
        >
          Rejected
        </button>
      </div>
      <p className="text-xs text-slate-400 text-center">
        Settling or rejecting needs the insurer's letter attached.
      </p>
    </div>
  );
}

function OutcomeDialog({
  claim, kind, onClose, onDone,
}: {
  claim: ClaimDetailType;
  kind: "settled" | "rejected";
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<ClaimDocument[]>(claim.documents.filter((d) => d.category === "outcome"));
  const ref = useRef<HTMLInputElement>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const doc = await uploadClaimDocument(claim.id, file, {
        category: "outcome",
        doc_type: kind === "settled" ? "Settlement letter" : "Rejection letter",
      });
      setProof((p) => [...p, doc]);
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Upload failed", description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (proof.length === 0) {
      toast({ variant: "destructive", title: "Attach the insurer's letter first" });
      return;
    }
    setBusy(true);
    try {
      await setClaimStatus(claim.id, kind, {
        settled_amount: kind === "settled" ? amount : undefined,
        proof_consent: consent,
      });
      onDone();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not close the claim", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55 p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 flex flex-col gap-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 ${kind === "settled" ? "bg-emerald-50" : "bg-red-50"}`}>
            {kind === "settled"
              ? <Check size={24} strokeWidth={2.5} className="text-emerald-600" />
              : <AlertTriangle size={22} className="text-red-600" />}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900 font-['Playfair_Display']">
              Claim {kind === "settled" ? "settled" : "rejected"}
            </h2>
            <p className="text-xs text-slate-500">{claim.customer_name} · {claim.insurer || "insurer"}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>

        {kind === "settled" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-slate-600">Amount settled</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
              placeholder={claim.claimed_amount != null ? `of ${Number(claim.claimed_amount)}` : "e.g. 171400"}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base font-bold focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
            />
          </label>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">Proof from the insurer</span>
            <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-black tracking-wide text-red-700">REQUIRED</span>
          </div>
          {proof.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3">
              <CheckCircle2 size={19} className="text-emerald-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-emerald-800 truncate">{d.doc_type}</div>
                <div className="text-[11px] text-emerald-700 truncate">{d.filename}</div>
              </div>
            </div>
          ))}
          <input ref={ref} type="file" onChange={pick} className="hidden" accept="application/pdf,image/*" />
          <button
            onClick={() => ref.current?.click()}
            disabled={busy}
            className="h-12 inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {proof.length ? "Add another" : `Add the ${kind === "settled" ? "settlement" : "rejection"} letter`}
          </button>
        </div>

        {/* the consent carve-out */}
        <button
          onClick={() => setConsent((v) => !v)}
          className="text-left flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-3.5"
        >
          <span className={`h-5 w-5 rounded-md shrink-0 mt-0.5 flex items-center justify-center ${consent ? "bg-[#0D9488]" : "border-2 border-slate-300 bg-white"}`}>
            {consent && <Check size={13} strokeWidth={3.5} className="text-white" />}
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-sm font-bold text-teal-800">
              {claim.customer_name?.split(" ")[0] ?? "The customer"} has agreed I can keep this letter
            </span>
            <span className="text-xs text-teal-800 leading-relaxed">
              Everything else on this claim is still deleted on {formatDate(claim.purge_at)}. Only this
              letter stays, so you can show it to future customers. Leave this unticked and it is
              deleted with the rest.
            </span>
          </span>
        </button>

        <div className="flex flex-col gap-2">
          <button
            onClick={confirm}
            disabled={busy}
            className={`h-14 inline-flex items-center justify-center gap-2 rounded-xl text-base font-bold text-white disabled:opacity-50 ${kind === "settled" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
          >
            {busy && <Loader2 size={17} className="animate-spin" />}
            Mark as {kind}
          </button>
          <button onClick={onClose} className="h-12 text-base font-bold text-slate-500 hover:underline">Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ── timeline ─────────────────────────────────────────────────────────────── */

function Timeline({ claim }: { claim: ClaimDetailType }) {
  if (claim.events.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">What happened</p>
      <div className="flex flex-col gap-2.5">
        {claim.events.map((e) => (
          <div key={e.id} className="flex items-baseline gap-3">
            <span className="w-14 shrink-0 text-xs font-bold text-slate-400">{formatDay(e.occurred_at)}</span>
            <span className="text-sm text-slate-700 leading-snug">
              {e.note || CLAIM_STATUS_META[e.status as keyof typeof CLAIM_STATUS_META]?.label || e.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
