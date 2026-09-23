import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle2, Circle, Clock, Copy, Download, Eye, Loader2,
  MessageCircle, Pencil, Phone, Plus, RotateCcw, Trash2, Upload, X,
} from "lucide-react";

import { InlineErrorState } from "@/components/agent/InlineErrorState";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";
import { formatAmount } from "@/lib/customers";
import {
  addQuery, CASE_DOCS, CLAIM_SPINE, CLAIM_STATUS_META, deleteClaimDocument, deleteQuery,
  extendRetention, fetchClaim, formatDate, formatDay, openClaimDocument, PERSONAL_DOCS,
  renameClaimDocument, setClaimStatus, spineIndex, telLink, updateClaim, updateQuery,
  uploadClaimDocument, waLink,
  type ClaimDetail as ClaimDetailType, type ClaimDocument, type ClaimQuery, type DocCategory,
} from "@/lib/claims";

const CLOSED = ["settled", "rejected"];

// Checklist labels and letter names are SAVED as English doc_type values, so a
// file stays findable whatever language uploaded it. Only the display changes.
type T = (key: string, vars?: Record<string, string | number>) => string;
const docKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const docLabel = (t: T, s: string) => tOr(t, `claim_docs.${docKey(s)}`, s);
const statusText = (t: T, s: string, fallback: string) => tOr(t, `claims.status_${s}`, fallback);

export default function ClaimDetail() {
  const [, params] = useRoute("/agent/claims/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ?? "";
  const { t } = useLanguage();

  const [claim, setClaim] = useState<ClaimDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"settled" | "rejected" | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setClaim(await fetchClaim(id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("claim_detail.load_failed"));
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
        <ArrowLeft size={16} /> {t("claim_detail.back")}
      </button>

      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-['Playfair_Display'] leading-tight">
              {claim.ailment || t("claim_detail.health_claim")}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {claim.customer_name ?? <span className="italic">{t("claims.customer_removed")}</span>}
              {claim.hospital ? ` · ${claim.hospital}` : ""}
              {" · "}
              {claim.claim_type === "cashless" ? t("claims.cashless") : t("claims.reimbursement")}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Copy the claim's own address. The route already opens the right
                claim, so nothing new is being published here: the link is
                useless to anyone who cannot log in as this advisor, which is
                the point. It exists because the URL working and the advisor
                knowing it works are two different things, and a tester looked
                for a button, found none, and reported the feature missing. */}
            <button
              onClick={() => {
                const url = `${window.location.origin}/agent/claims/${claim.id}`;
                navigator.clipboard.writeText(url).then(
                  () => toast({ variant: "success", title: t("claim_detail.link_copied"), description: t("claim_detail.link_copied_desc") }),
                  () => toast({ variant: "destructive", title: t("share_popover.copy_failed"), description: t("share_popover.clipboard_blocked") }),
                );
              }}
              className="h-10 px-3.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              <Copy size={14} /> {t("claim_detail.copy_link")}
            </button>
            <button
              onClick={() => setEditing(true)}
              className="h-10 px-3.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              <Pencil size={14} /> {t("claim_detail.edit")}
            </button>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${meta.badge}`}>
              <span className={`h-2 w-2 rounded-full ${meta.dot}`} /> {statusText(t, claim.status, meta.label)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-100 pt-4">
          <Stat label={t("claim_detail.claimed")} value={claim.claimed_amount != null ? formatAmount(Number(claim.claimed_amount)) : "—"} />
          <Stat
            label={t("claim_detail.settled")}
            value={claim.settled_amount != null ? formatAmount(Number(claim.settled_amount)) : "—"}
            tone={claim.settled_amount != null ? "text-emerald-700" : undefined}
          />
          <Stat label={t("claim_detail.insurer")} value={claim.insurer || "—"} />
          <Stat label={t("claim_detail.tpa")} value={claim.tpa || "—"} />
        </div>

        {(wa || tel) && (
          <div className="flex items-center gap-2">
            <a
              href={wa ?? undefined}
              target="_blank"
              rel="noreferrer"
              className={`flex-1 sm:flex-none sm:px-6 h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] text-white font-bold text-sm hover:brightness-95 ${!wa ? "opacity-40 pointer-events-none" : ""}`}
            >
              <MessageCircle className="h-5 w-5" /> {t("leads.whatsapp")}
            </a>
            <a
              href={tel ?? undefined}
              className={`flex-1 sm:flex-none sm:px-6 h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-900 ${!tel ? "opacity-40 pointer-events-none" : ""}`}
            >
              <Phone className="h-5 w-5" /> {t("leads.call")}
            </a>
          </div>
        )}
      </div>

      <Tracker claim={claim} />

      <Queries claim={claim} onChanged={load} />

      <Retention claim={claim} onChanged={load} />

      {!claim.documents_purged_at && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 items-start">
          <Pile
            claim={claim}
            category="personal"
            title={t("claim_detail.personal_docs")}
            subtitle={t("claim_detail.personal_docs_sub")}
            checklist={PERSONAL_DOCS}
            onChanged={load}
          />
          <Pile
            claim={claim}
            category="case"
            title={t("claim_detail.case_files")}
            subtitle={t("claim_detail.case_files_sub")}
            checklist={CASE_DOCS[claim.claim_type]}
            onChanged={load}
          />
        </div>
      )}

      <Outcome claim={claim} onChanged={load} />

      {!closed && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-3">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">{t("claim_detail.update_claim")}</p>
          <StatusButtons claim={claim} onChanged={load} onClose={(kind) => setOutcome(kind)} />
        </div>
      )}

      {closed && <Reopen claim={claim} onChanged={load} />}

      <Timeline claim={claim} />

      {outcome && (
        <OutcomeDialog
          claim={claim}
          kind={outcome}
          onClose={() => setOutcome(null)}
          onDone={() => { setOutcome(null); void load(); }}
        />
      )}

      {editing && (
        <EditDialog
          claim={claim}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); void load(); }}
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
  const { t } = useLanguage();
  const at = spineIndex(claim.status);
  const closed = CLOSED.includes(claim.status);
  const openRounds = claim.queries.filter((q) => !q.resolved_on).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{t("claim_detail.where")}</p>
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
                  {tOr(t, `claim_detail.spine_${step.key}`, step.label)}
                </div>
                {current && step.key === "under_process" && (
                  <div className="text-xs text-slate-500">
                    {openRounds > 0 ? t("claim_detail.paused_by_round", { count: claim.queries[claim.queries.length - 1]?.seq ?? "" }) : t("claim_detail.no_query_yet")}
                  </div>
                )}
                {step.hint && !current && <div className="text-xs text-slate-400">{tOr(t, `claim_detail.spine_${step.key}_hint`, step.hint)}</div>}
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
              {closed ? statusText(t, claim.status, CLAIM_STATUS_META[claim.status].label) : t("claim_detail.settled_or_rejected")}
            </div>
            <div className="text-xs text-slate-400">
              {closed ? formatDate(claim.closed_at) : t("claim_detail.needs_letter")}
            </div>
          </div>
        </li>
      </ol>
    </div>
  );
}

/* ── queries ──────────────────────────────────────────────────────────────── */

function Queries({ claim, onChanged }: { claim: ClaimDetailType; onChanged: () => void }) {
  const { t } = useLanguage();
  const [adding, setAdding] = useState(false);
  const [question, setQuestion] = useState("");
  const [raisedBy, setRaisedBy] = useState("");
  const [busy, setBusy] = useState(false);

  const rounds = useMemo(() => [...claim.queries].sort((a, b) => b.seq - a.seq), [claim.queries]);
  const openCount = rounds.filter((q) => !q.resolved_on).length;
  const closed = CLOSED.includes(claim.status);

  async function save() {
    if (!question.trim()) {
      toast({ variant: "destructive", title: t("claim_detail.write_query") });
      return;
    }
    setBusy(true);
    try {
      await addQuery(claim.id, { question: question.trim(), raised_by: raisedBy.trim() || undefined });
      setQuestion(""); setRaisedBy(""); setAdding(false);
      onChanged();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("claim_detail.query_save_failed"), description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-800">{t("claim_detail.queries_title")}</h2>
          <p className="text-xs text-slate-500">
            {rounds.length === 0
              ? t("claim_detail.none_so_far")
              : t(rounds.length === 1 ? "claim_detail.rounds_one" : "claim_detail.rounds_many", { count: rounds.length, open: openCount })}
          </p>
        </div>
        {openCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
            <span className="h-2 w-2 rounded-full bg-amber-600" /> {t("claim_detail.open_count", { count: openCount })}
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
            placeholder={t("claim_detail.ph_question")}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
          />
          <input
            value={raisedBy}
            onChange={(e) => setRaisedBy(e.target.value)}
            placeholder={t("claim_detail.ph_raised_by")}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0f766e] disabled:opacity-50"
            >
              {busy && <Loader2 size={15} className="animate-spin" />} {t("claim_detail.save_query")}
            </button>
            <button onClick={() => setAdding(false)} className="text-sm font-bold text-slate-500 hover:underline">{t("common.cancel")}</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-sm font-bold text-slate-600 hover:bg-slate-50"
        >
          <Plus size={17} /> {rounds.length ? t("claim_detail.raised_another") : t("claim_detail.raised_first")}
        </button>
      ))}

      {!closed && (
        <p className="text-xs text-slate-400">
          {t("claim_detail.rounds_hint")}
        </p>
      )}
    </div>
  );
}

function QueryRound({
  claim, round, onChanged,
}: { claim: ClaimDetailType; round: ClaimQuery; onChanged: () => void }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const open = !round.resolved_on;
  const replies = claim.documents.filter((d) => d.query_id === round.id);

  async function resolve() {
    setBusy(true);
    try {
      await updateQuery(claim.id, round.id, { resolve: true });
      onChanged();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("claim_detail.resolve_failed"), description: e instanceof Error ? e.message : undefined });
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
      toast({ variant: "destructive", title: t("claim_detail.remove_failed"), description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3.5 flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <CheckCircle2 size={19} className="text-emerald-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-black tracking-wider text-slate-400">{t("claim_detail.round_label", { count: round.seq })}</span>
              <span className="text-sm font-semibold text-slate-700 truncate">{round.question}</span>
            </div>
            <div className="text-[11px] text-slate-400">
              {t("claim_detail.date_range", { from: formatDay(round.raised_on), to: formatDay(round.resolved_on) })}
            </div>
          </div>
        </div>
        {/* A resolved round still holds the papers that answered it. Collapsing
            them out of sight would hide documents the advisor filed, which is
            the one thing this screen exists to prevent. */}
        {replies.length > 0 && (
          <div className="flex flex-col gap-1.5 pl-8">
            {replies.map((d) => (
              <DocRow key={d.id} claim={claim} doc={d} onChanged={onChanged} compact />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="rounded-lg bg-amber-600 px-2 py-1 text-[11px] font-black tracking-wide text-white">
          {t("claim_detail.round_label", { count: round.seq })}
        </span>
        <span className="text-xs font-semibold text-amber-800">
          {round.raised_by ? t("claim_detail.raised_on_by", { date: formatDay(round.raised_on), who: round.raised_by }) : t("claim_detail.raised_on", { date: formatDay(round.raised_on) })}
        </span>
        <button
          onClick={remove}
          disabled={busy}
          title={t("claim_detail.remove_query")}
          aria-label={t("claim_detail.remove_query")}
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
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-700">{t("claim_detail.sent_back")}</span>
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
          label={t("claim_detail.add_reply")}
        />
        <button
          onClick={resolve}
          disabled={busy}
          className="flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D9488] text-sm font-bold text-white hover:bg-[#0f766e] disabled:opacity-50"
        >
          {busy && <Loader2 size={15} className="animate-spin" />} {t("claim_detail.round_resolved", { count: round.seq })}
        </button>
      </div>
    </div>
  );
}

/* ── retention ────────────────────────────────────────────────────────────── */

function Retention({ claim, onChanged }: { claim: ClaimDetailType; onChanged: () => void }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  if (claim.documents_purged_at) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Trash2 size={19} className="text-slate-500" />
          <div>
            <p className="text-base font-bold text-slate-700">{t("claim_detail.docs_deleted")}</p>
            <p className="text-xs text-slate-500">{t("claim_detail.on_date", { date: formatDate(claim.documents_purged_at) })}</p>
          </div>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">
          {t("claim_detail.purged_desc")}
        </p>
      </div>
    );
  }

  if (!claim.purge_at) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-start gap-3 shadow-sm">
        <Clock size={18} className="text-slate-400 mt-0.5 shrink-0" />
        <p className="text-sm text-slate-500 leading-relaxed">
          {t("claim_detail.nothing_uploaded")} <span className="font-semibold text-slate-700">{t("claim_detail.clock_starts")}</span>{" "}
          {t("claim_detail.irdai_30")}
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
      toast({ title: t("claim_detail.kept_30_more") });
      onChanged();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("claim_detail.extend_failed"), description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`rounded-2xl border bg-white p-6 shadow-sm flex flex-col gap-3 ${urgent ? "border-red-200" : "border-slate-200"}`}>
      <div className="flex items-center gap-2.5 flex-wrap">
        <Trash2 size={18} className={urgent ? "text-red-600" : "text-slate-500"} />
        <span className="text-base font-bold text-slate-800">{t("claim_detail.deleted_on", { date: formatDate(claim.purge_at) })}</span>
        {claim.extension_used && (
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">{t("claim_detail.extended")}</span>
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
          <span className={`font-bold ${urgent ? "text-red-700" : "text-slate-600"}`}>{t("claim_detail.day_of", { day: elapsed, total })}</span>
          <span className="text-slate-500">{t(days === 1 ? "claim_detail.days_left_one" : "claim_detail.days_left_many", { count: days })}</span>
        </div>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">
        {t("claim_detail.retention_rule")}
      </p>

      {claim.can_extend && (
        <button
          onClick={extend}
          disabled={busy}
          className="h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D9488] text-sm font-bold text-white hover:bg-[#0f766e] disabled:opacity-50"
        >
          {busy && <Loader2 size={15} className="animate-spin" />} {t("claim_detail.keep_30_more")}
        </button>
      )}
      {claim.extension_used && (
        <p className="text-xs text-slate-400">
          {t("claim_detail.no_more_extension")}
        </p>
      )}
    </div>
  );
}

/* ── document piles ───────────────────────────────────────────────────────────
 * Every row is a SLOT, not a log. The checklist labels are the rows: an empty
 * one offers an upload, a filled one shows what went in with download, rename
 * and delete on it. That is the whole point of the screen — the advisor needs
 * to see at a glance what he has filed where, and to pull a file back out when
 * he is sitting in front of the insurer's portal.
 *
 * Anything whose label is not on the checklist (his own categories, or files
 * from before this screen existed) lands under "Your own" rather than being
 * hidden, and "Write your own" adds a new label on the spot.
 */

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
  const { t } = useLanguage();
  // Query replies live with their round, not in the pile.
  const docs = claim.documents.filter((d) => d.category === category && !d.query_id);

  // One document fills one slot. Anything left over — a second file under the
  // same label, or a label of his own — falls through to "Your own", so every
  // document is on screen exactly once and none can be silently swallowed.
  const byLabel = new Map<string, ClaimDocument>();
  for (const d of docs) {
    if (d.doc_type && checklist.includes(d.doc_type) && !byLabel.has(d.doc_type)) {
      byLabel.set(d.doc_type, d);
    }
  }
  const slottedIds = new Set(Array.from(byLabel.values(), (d) => d.id));
  const extras = docs.filter((d) => !slottedIds.has(d.id));
  const filledFromList = byLabel.size;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
        <p className="text-xs text-slate-500">
          {t("claim_detail.pile_count", { done: filledFromList, total: checklist.length, sub: subtitle })}
          {extras.length > 0 && t("claim_detail.pile_own", { count: extras.length })}
        </p>
      </div>

      <div className="flex flex-col">
        {checklist.map((label) => (
          <Slot
            key={label}
            claim={claim}
            category={category}
            label={label}
            doc={byLabel.get(label) ?? null}
            onChanged={onChanged}
          />
        ))}
      </div>

      {extras.length > 0 && (
        <div className="flex flex-col">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 pb-1">{t("claim_detail.your_own")}</p>
          {extras.map((d) => (
            <Slot
              key={d.id}
              claim={claim}
              category={category}
              label={d.doc_type || d.filename}
              doc={d}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}

      <CustomAdd claim={claim} category={category} onChanged={onChanged} />

      <p className="text-xs text-slate-400">
        {t("claim_detail.list_hint")}
      </p>
    </div>
  );
}

/** One checklist line: empty and awaiting a file, or filled and manageable. */
function Slot({
  claim, category, label, doc, onChanged,
}: {
  claim: ClaimDetailType;
  category: DocCategory;
  label: string;
  doc: ClaimDocument | null;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  if (!doc) {
    return (
      <div className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
        <Circle size={18} className="text-slate-300 shrink-0" strokeDasharray="3 3" />
        <span className="flex-1 min-w-0 text-sm font-medium text-slate-400 truncate">{docLabel(t, label)}</span>
        <UploadButton
          claim={claim}
          category={category}
          docType={label}
          onChanged={onChanged}
          className="shrink-0 h-10 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#0D9488]/30 bg-[#0D9488]/5 text-xs font-bold text-[#0D9488] hover:bg-[#0D9488]/10"
          label={t("claim_detail.upload")}
        />
      </div>
    );
  }
  return <FilledSlot claim={claim} doc={doc} onChanged={onChanged} />;
}

function FilledSlot({
  claim, doc, onChanged,
}: { claim: ClaimDetailType; doc: ClaimDocument; onChanged: () => void }) {
  const { t } = useLanguage();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(doc.doc_type || doc.filename);
  const [busy, setBusy] = useState(false);

  async function saveName() {
    const next = draft.trim();
    if (!next || next === doc.doc_type) { setRenaming(false); return; }
    setBusy(true);
    try {
      await renameClaimDocument(claim.id, doc.id, next);
      setRenaming(false);
      onChanged();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("claim_detail.rename_failed"), description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  if (renaming) {
    return (
      <div className="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
        <CheckCircle2 size={18} className="text-[#0D9488] shrink-0" />
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void saveName();
            if (e.key === "Escape") { setDraft(doc.doc_type || doc.filename); setRenaming(false); }
          }}
          className="flex-1 min-w-0 rounded-lg border border-[#0D9488] px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
        />
        <button
          onClick={saveName}
          disabled={busy}
          className="shrink-0 h-10 px-3 rounded-lg bg-[#0D9488] text-xs font-bold text-white hover:bg-[#0f766e] disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : t("claim_detail.save")}
        </button>
        <button
          onClick={() => { setDraft(doc.doc_type || doc.filename); setRenaming(false); }}
          className="shrink-0 h-10 w-10 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700"
          aria-label={t("claim_detail.cancel_rename")}
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-slate-50 last:border-0">
      <CheckCircle2 size={18} className="text-[#0D9488] shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-800 truncate">{doc.doc_type ? docLabel(t, doc.doc_type) : doc.filename}</div>
        <div className="text-[11px] text-slate-400 truncate">
          {doc.filename}
          {doc.file_size ? ` · ${Math.max(1, Math.round(doc.file_size / 1024))} KB` : ""}
        </div>
      </div>
      <DocControls claim={claim} doc={doc} onRename={() => setRenaming(true)} onChanged={onChanged} />
    </div>
  );
}

/** View, download, rename, delete — the four things an advisor does to a file. */
function DocControls({
  claim, doc, onRename, onChanged,
}: {
  claim: ClaimDetailType;
  doc: ClaimDocument;
  onRename: () => void;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState<null | "view" | "download" | "delete">(null);

  async function view() {
    setBusy("view");
    try {
      const url = await openClaimDocument(claim.id, doc.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("claim_detail.open_failed"), description: e instanceof Error ? e.message : undefined });
    } finally { setBusy(null); }
  }

  async function download() {
    setBusy("download");
    try {
      const url = await openClaimDocument(claim.id, doc.id, { download: true });
      // Storage serves this as an attachment, so a plain navigation saves it
      // under the document's own name instead of its storage uuid.
      window.location.assign(url);
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("claim_detail.download_failed"), description: e instanceof Error ? e.message : undefined });
    } finally { setBusy(null); }
  }

  async function remove() {
    if (!window.confirm(t("claim_detail.delete_confirm", { name: doc.doc_type ? docLabel(t, doc.doc_type) : doc.filename }))) return;
    setBusy("delete");
    try {
      await deleteClaimDocument(claim.id, doc.id);
      onChanged();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("claim_detail.delete_failed"), description: e instanceof Error ? e.message : undefined });
    } finally { setBusy(null); }
  }

  const btn = "h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-lg transition-colors disabled:opacity-40";

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <button onClick={view} disabled={!!busy} className={`${btn} text-slate-400 hover:bg-slate-100 hover:text-slate-700`} title={t("claim_detail.view")} aria-label={t("claim_detail.view")}>
        {busy === "view" ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
      </button>
      <button onClick={download} disabled={!!busy} className={`${btn} text-slate-400 hover:bg-teal-50 hover:text-[#0D9488]`} title={t("claim_detail.download")} aria-label={t("claim_detail.download")}>
        {busy === "download" ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      </button>
      <button onClick={onRename} disabled={!!busy} className={`${btn} text-slate-400 hover:bg-slate-100 hover:text-slate-700`} title={t("claim_detail.rename")} aria-label={t("claim_detail.rename")}>
        <Pencil size={15} />
      </button>
      <button onClick={remove} disabled={!!busy} className={`${btn} text-slate-400 hover:bg-red-50 hover:text-red-600`} title={t("claim_detail.delete")} aria-label={t("claim_detail.delete")}>
        {busy === "delete" ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={15} />}
      </button>
    </div>
  );
}

/** "Write your own" — a label he types, then uploads against. */
function CustomAdd({
  claim, category, onChanged,
}: { claim: ClaimDetailType; category: DocCategory; onChanged: () => void }) {
  const { t } = useLanguage();
  const [label, setLabel] = useState("");
  const typed = label.trim();

  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 p-2">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={t("claim_detail.ph_own")}
        className="flex-1 min-w-0 rounded-lg px-2.5 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
      />
      <UploadButton
        claim={claim}
        category={category}
        docType={typed || undefined}
        disabled={!typed}
        onChanged={() => { setLabel(""); onChanged(); }}
        className="shrink-0 h-11 px-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0D9488] text-sm font-bold text-white hover:bg-[#0f766e]"
        label={t("claim_detail.upload")}
      />
    </div>
  );
}

/** Compact row used where a pile's slot layout does not apply: query replies. */
function DocRow({
  claim, doc, onChanged, compact,
}: { claim: ClaimDetailType; doc: ClaimDocument; onChanged: () => void; compact?: boolean }) {
  const { t } = useLanguage();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(doc.doc_type || doc.filename);

  async function saveName() {
    const next = draft.trim();
    if (!next || next === doc.doc_type) { setRenaming(false); return; }
    try {
      await renameClaimDocument(claim.id, doc.id, next);
      setRenaming(false);
      onChanged();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("claim_detail.rename_failed"), description: e instanceof Error ? e.message : undefined });
    }
  }

  return (
    <div className={`flex items-center gap-2.5 py-2 ${compact ? "rounded-xl border border-amber-200 bg-white px-2.5" : "border-b border-slate-50 last:border-0"}`}>
      <CheckCircle2 size={18} className="text-[#0D9488] shrink-0" />
      {renaming ? (
        <>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveName();
              if (e.key === "Escape") { setDraft(doc.doc_type || doc.filename); setRenaming(false); }
            }}
            className="flex-1 min-w-0 rounded-lg border border-[#0D9488] px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
          />
          <button onClick={saveName} className="shrink-0 h-10 px-3 rounded-lg bg-[#0D9488] text-xs font-bold text-white hover:bg-[#0f766e]">{t("claim_detail.save")}</button>
        </>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-800 truncate">{doc.doc_type ? docLabel(t, doc.doc_type) : doc.filename}</div>
            <div className="text-[11px] text-slate-400 truncate">{doc.filename}</div>
          </div>
          <DocControls claim={claim} doc={doc} onRename={() => setRenaming(true)} onChanged={onChanged} />
        </>
      )}
    </div>
  );
}

function UploadButton({
  claim, category, queryId, docType, disabled, onChanged, className, label,
}: {
  claim: ClaimDetailType;
  category: DocCategory;
  queryId?: string;
  /** The advisor's label for the slot. Falls back to the file's own name. */
  docType?: string;
  disabled?: boolean;
  onChanged: () => void;
  className: string;
  label: string;
}) {
  const { t } = useLanguage();
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
        // The slot's label wins, so the file lands where the advisor put it.
        // Nothing reads the file itself — there is no OCR in this lane.
        doc_type: docType || file.name.replace(/\.[^.]+$/, "").slice(0, 80),
        query_id: queryId,
      });
      if ((res as any).retention) {
        toast({
          title: t("claim_detail.clock_started"),
          description: t("claim_detail.clock_started_desc"),
        });
      }
      onChanged();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: t("claim_detail.upload_failed"), description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input ref={ref} type="file" onChange={pick} className="hidden" accept="application/pdf,image/*" />
      <button
        onClick={() => ref.current?.click()}
        disabled={busy || disabled}
        className={`${className} disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {label}
      </button>
    </>
  );
}

/* ── outcome ──────────────────────────────────────────────────────────────── */

function Outcome({ claim, onChanged }: { claim: ClaimDetailType; onChanged: () => void }) {
  const { t } = useLanguage();
  const proof = claim.documents.filter((d) => d.category === "outcome");
  if (proof.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400 flex-1">
          {claim.proof_consent_at ? t("claim_detail.kept_with_permission") : t("claim_detail.proof")}
        </p>
      </div>
      {proof.map((d) => (
        <div key={d.id} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3">
          <DocRow claim={claim} doc={d} onChanged={onChanged} />
        </div>
      ))}
      <p className="text-xs text-slate-400">
        {claim.proof_consent_at
          ? t("claim_detail.consent_on", { date: formatDate(claim.proof_consent_at) })
          : t("claim_detail.no_consent")}
      </p>
    </div>
  );
}

function StatusButtons({
  claim, onChanged, onClose,
}: { claim: ClaimDetailType; onChanged: () => void; onClose: (kind: "settled" | "rejected") => void }) {
  const { t } = useLanguage();
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
      toast({ variant: "destructive", title: t("claim_detail.update_failed"), description: e instanceof Error ? e.message : undefined });
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
          {busy && <Loader2 size={16} className="animate-spin" />} {t("claim_detail.move_to", { step: tOr(t, `claim_detail.spine_${next.key}`, next.label) })}
        </button>
      )}
      <div className="flex items-stretch gap-3">
        <button
          onClick={() => onClose("settled")}
          className="flex-1 py-3.5 inline-flex items-center justify-center rounded-xl bg-emerald-600 text-base font-bold text-white hover:bg-emerald-700"
        >
          {t("claim_detail.btn_settled")}
        </button>
        <button
          onClick={() => onClose("rejected")}
          className="flex-1 py-3.5 inline-flex items-center justify-center rounded-xl border border-red-200 bg-white text-base font-bold text-red-700 hover:bg-red-50"
        >
          {t("claim_detail.btn_rejected")}
        </button>
      </div>
      <p className="text-xs text-slate-400 text-center">
        {t("claim_detail.needs_letter_note")}
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
  const { t } = useLanguage();
  const [amount, setAmount] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<ClaimDocument[]>(claim.documents.filter((d) => d.category === "outcome"));
  const ref = useRef<HTMLInputElement>(null);

  // An insurer cannot pay more than was asked for, so this is a typo guard —
  // and these two figures are what the track record is computed from.
  const claimedNum = claim.claimed_amount != null ? Number(claim.claimed_amount) : null;
  const typed = Number(String(amount).replace(/[₹,\s_]/g, ""));
  const overClaimed =
    kind === "settled" && claimedNum != null && Number.isFinite(typed) && typed > claimedNum;

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
      toast({ variant: "destructive", title: t("claim_detail.upload_failed"), description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (proof.length === 0) {
      toast({ variant: "destructive", title: t("claim_detail.attach_letter_first") });
      return;
    }
    if (overClaimed) {
      toast({
        variant: "destructive",
        title: t("claim_detail.settled_over"),
        description: t("claim_detail.settled_over_desc"),
      });
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
      toast({ variant: "destructive", title: t("claim_detail.close_failed"), description: e instanceof Error ? e.message : undefined });
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
              {kind === "settled" ? t("claim_detail.title_settled") : t("claim_detail.title_rejected")}
            </h2>
            <p className="text-xs text-slate-500">{claim.customer_name} · {claim.insurer || t("claim_detail.insurer_word")}</p>
          </div>
          <button onClick={onClose} aria-label={t("claim_detail.close")} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>

        {kind === "settled" && (
          <label className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-bold text-slate-600">{t("claim_detail.amount_settled")}</span>
              {claimedNum != null && (
                <span className="text-xs text-slate-400">
                  {t("claim_detail.claimed_amt", { amount: formatAmount(claimedNum) })}
                </span>
              )}
            </div>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
              placeholder={claimedNum != null ? t("claim_detail.up_to", { amount: claimedNum }) : t("claim_detail.eg_amount")}
              className={`w-full rounded-xl border px-4 py-3 text-base font-bold focus:outline-none focus:ring-2 ${
                overClaimed
                  ? "border-red-300 focus:ring-red-200"
                  : "border-slate-200 focus:ring-[#0D9488]/30"
              }`}
            />
            {overClaimed && (
              <span className="text-xs font-semibold text-red-600">
                {t("claim_detail.more_than_claimed", { amount: formatAmount(claimedNum as number) })}
              </span>
            )}
          </label>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">{t("claim_detail.proof")}</span>
            <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-xs font-black tracking-wide text-red-700">{t("claim_detail.required")}</span>
          </div>
          {proof.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3">
              <CheckCircle2 size={19} className="text-emerald-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-emerald-800 truncate">{d.doc_type ? docLabel(t, d.doc_type) : d.filename}</div>
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
            {proof.length ? t("claim_detail.add_another") : kind === "settled" ? t("claim_detail.add_settlement") : t("claim_detail.add_rejection")}
          </button>
        </div>

        {/* what closing destroys, said before the button rather than after */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-bold">{t("claim_detail.closing_deletes")}</span>{" "}
            {t("claim_detail.closing_deletes_desc")}
          </p>
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
              {t("claim_detail.consent_label", { name: claim.customer_name?.split(" ")[0] ?? t("claim_detail.the_customer") })}
            </span>
            <span className="text-xs text-teal-800 leading-relaxed">
              {t("claim_detail.consent_desc", { date: formatDate(claim.purge_at) })}
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
            {kind === "settled" ? t("claim_detail.mark_settled") : t("claim_detail.mark_rejected")}
          </button>
          <button onClick={onClose} className="h-12 text-base font-bold text-slate-500 hover:underline">{t("common.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

/* ── edit the typed details ───────────────────────────────────────────────────
 * Every saved change lands in the timeline in words. On a record whose
 * documents are destroyed on a clock, the history of what was asserted and
 * when is the audit trail, so a silent edit is not an option.
 */

function EditDialog({
  claim, onClose, onSaved,
}: { claim: ClaimDetailType; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    ailment: claim.ailment ?? "",
    hospital: claim.hospital ?? "",
    insurer: claim.insurer ?? "",
    tpa: claim.tpa ?? "",
    policy_number: claim.policy_number ?? "",
    claim_type: claim.claim_type,
    claimed_amount: claim.claimed_amount != null ? String(claim.claimed_amount) : "",
    settled_amount: claim.settled_amount != null ? String(claim.settled_amount) : "",
    admitted_on: claim.admitted_on ?? "",
    discharged_on: claim.discharged_on ?? "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Checked as a pair: lowering the claimed amount below an existing settled
  // figure breaks the relationship just as surely as raising the settled one.
  const num = (v: string) => {
    const n = Number(String(v).replace(/[₹,\s_]/g, ""));
    return v.trim() !== "" && Number.isFinite(n) ? n : null;
  };
  const claimedNum = num(form.claimed_amount);
  const settledNum = num(form.settled_amount);
  const overClaimed = claimedNum != null && settledNum != null && settledNum > claimedNum;

  async function save() {
    if (overClaimed) {
      toast({
        variant: "destructive",
        title: t("claim_detail.settled_over"),
        description: t("claim_detail.settled_over_short"),
      });
      return;
    }
    setBusy(true);
    try {
      await updateClaim(claim.id, form);
      onSaved();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("claim_detail.save_failed"), description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55 p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center gap-3">
          <h2 className="flex-1 text-xl font-bold text-slate-900 font-['Playfair_Display']">{t("claim_detail.edit_title")}</h2>
          <button onClick={onClose} aria-label={t("claim_detail.close")} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("claim_detail.f_what")}><input value={form.ailment} onChange={(e) => set("ailment", e.target.value)} className={field} /></Field>
          <Field label={t("claim_detail.f_hospital")}><input value={form.hospital} onChange={(e) => set("hospital", e.target.value)} className={field} /></Field>
          <Field label={t("claim_detail.insurer")}><input value={form.insurer} onChange={(e) => set("insurer", e.target.value)} className={field} /></Field>
          <Field label={t("claim_detail.tpa")}><input value={form.tpa} onChange={(e) => set("tpa", e.target.value)} className={field} /></Field>
          <Field label={t("claim_detail.f_policy_number")}><input value={form.policy_number} onChange={(e) => set("policy_number", e.target.value)} className={field} /></Field>
          <Field label={t("claim_detail.f_type")}>
            <select value={form.claim_type} onChange={(e) => set("claim_type", e.target.value)} className={field}>
              <option value="cashless">{t("claims.cashless")}</option>
              <option value="reimbursement">{t("claims.reimbursement")}</option>
            </select>
          </Field>
          <Field label={t("claim_detail.f_claimed")}>
            <input value={form.claimed_amount} onChange={(e) => set("claimed_amount", e.target.value)} inputMode="numeric" placeholder={t("claims.ph_amount")} className={field} />
          </Field>
          <Field label={t("claim_detail.amount_settled")}>
            <input
              value={form.settled_amount}
              onChange={(e) => set("settled_amount", e.target.value)}
              inputMode="numeric"
              placeholder={claimedNum != null ? t("claim_detail.up_to", { amount: claimedNum }) : t("claim_detail.eg_amount")}
              className={overClaimed ? field.replace("border-slate-200", "border-red-300") : field}
            />
          </Field>
          <Field label={t("claim_detail.f_admitted")}><input type="date" value={form.admitted_on} onChange={(e) => set("admitted_on", e.target.value)} className={field} /></Field>
          <Field label={t("claim_detail.f_discharged")}><input type="date" value={form.discharged_on} onChange={(e) => set("discharged_on", e.target.value)} className={field} /></Field>
        </div>

        {overClaimed ? (
          <p className="text-xs font-semibold text-red-600">
            {t("claim_detail.edit_over")}
          </p>
        ) : (
          <p className="text-xs text-slate-400">
            {t("claim_detail.edit_hint")}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={save}
            disabled={busy}
            className="h-13 py-3.5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D9488] text-base font-bold text-white hover:bg-[#0f766e] disabled:opacity-50"
          >
            {busy && <Loader2 size={17} className="animate-spin" />} {t("claim_detail.save_changes")}
          </button>
          <button onClick={onClose} className="h-12 text-base font-bold text-slate-500 hover:underline">{t("common.cancel")}</button>
        </div>
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

/* ── reopen ───────────────────────────────────────────────────────────────────
 * Closing is a judgement read off a letter, and letters get misread — so it has
 * to be reversible. What cannot be reversed is the purge that closing triggers,
 * which is why the warning is stated plainly before the button rather than in a
 * toast afterwards.
 */

function Reopen({ claim, onChanged }: { claim: ClaimDetailType; onChanged: () => void }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  async function reopen() {
    if (!window.confirm(t("claim_detail.reopen_confirm"))) return;
    setBusy(true);
    try {
      await setClaimStatus(claim.id, "under_process");
      toast({ title: t("claim_detail.reopened") });
      onChanged();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("claim_detail.reopen_failed"), description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-3">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{t("claim_detail.closed_on", { date: formatDate(claim.closed_at) })}</p>
      <p className="text-sm text-slate-500 leading-relaxed">
        {t("claim_detail.reopen_desc")}
      </p>
      <button
        onClick={reopen}
        disabled={busy}
        className="h-12 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />} {t("claim_detail.reopen")}
      </button>
    </div>
  );
}

/* ── timeline ─────────────────────────────────────────────────────────────── */

function Timeline({ claim }: { claim: ClaimDetailType }) {
  const { t } = useLanguage();
  if (claim.events.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{t("claim_detail.history")}</p>
      <div className="flex flex-col gap-2.5">
        {claim.events.map((e) => (
          <div key={e.id} className="flex items-baseline gap-3">
            <span className="w-14 shrink-0 text-xs font-bold text-slate-400">{formatDay(e.occurred_at)}</span>
            <span className="text-sm text-slate-700 leading-snug">
              {e.note || statusText(t, e.status, CLAIM_STATUS_META[e.status as keyof typeof CLAIM_STATUS_META]?.label || e.status)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
