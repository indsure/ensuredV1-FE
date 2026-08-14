import { useState } from "react";
import {
  AlertCircle, ArrowRight, CalendarClock, Check, ChevronDown, Download, FileText,
  IndianRupee, Loader2, MessageCircle, Pencil, ShieldCheck, X,
} from "lucide-react";
import type { Policy } from "./portfolio-types";
import {
  daysUntil, fmtDate, formatINRShort, labelFor, parseSumInsured, renewalPhrase,
  scoreClasses, scoreVerdict,
} from "./portfolio-utils";

/**
 * One policy, expandable in place.
 *
 * The old card was a dead end for every line except health (only health has a
 * full report page). Expanding in place gives term / life / vehicle somewhere
 * to go too: cover amount, insurer, renewal, and the flaws we found.
 */
export function PolicyCard({
  policy: p,
  expanded,
  onToggle,
  onRename,
  onSetRenewal,
  onDownload,
  onOpenReport,
  onAskAdvisor,
  downloading,
}: {
  policy: Policy;
  expanded: boolean;
  onToggle: () => void;
  onRename: (id: string, nickname: string) => void;
  onSetRenewal: (id: string, date: string) => void;
  onDownload: (p: Policy) => void;
  onOpenReport: (id: string) => void;
  onAskAdvisor: (topic: string) => void;
  downloading: boolean;
}) {
  const [nickDraft, setNickDraft] = useState<string | null>(null);
  const [dateDraft, setDateDraft] = useState<string | null>(null);

  const hasReport = p.status === "done" && p.insurance_type === "health";
  const title = p.nickname || p.insurer || p.policy_name || p.filename || "Policy";
  const subtitle = p.nickname
    ? [p.insurer, p.policy_name].filter(Boolean).join(" · ")
    : p.policy_name && p.insurer
      ? p.policy_name
      : null;
  const days = daysUntil(p.renewal_date);
  const cover = parseSumInsured(p.sum_insured);
  const flaws = (Array.isArray(p.flaws) ? p.flaws : []).filter((f) => typeof f === "string" && f.trim());
  const busy = p.status === "processing" || p.status === "pending";

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm transition-all ${
        expanded
          ? "border-[var(--color-teal-600)]/40 shadow-md"
          : "border-[var(--color-border-light)] hover:border-[var(--color-teal-600)]/40 hover:shadow-md"
      }`}
    >
      {/* Header — the whole row toggles, so it works on touch without hover. */}
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full text-left p-4 sm:p-5 flex gap-4 items-start rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal-600)]"
      >
        {p.score != null ? (
          <div
            className={`shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl border flex flex-col items-center justify-center ${scoreClasses(p.score).tile}`}
          >
            <span className={`text-xl sm:text-2xl font-serif font-bold leading-none ${scoreClasses(p.score).text}`}>
              {p.score}
            </span>
            <span className="text-[8px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mt-0.5">
              score
            </span>
          </div>
        ) : (
          <div className="shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-[var(--color-cream-dark)] border border-[var(--color-border-light)] flex items-center justify-center">
            {busy ? (
              <Loader2 className="w-5 h-5 text-[var(--color-teal-600)] animate-spin" />
            ) : (
              <FileText className="w-5 h-5 text-[var(--color-text-muted)]" />
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--color-teal-600)]">
              {labelFor(p.insurance_type)}
            </span>
            <StatusPill status={p.status} />
          </div>

          <p className="mt-1 font-semibold text-[var(--color-navy-900)] truncate">{title}</p>
          {subtitle && <p className="text-xs text-[var(--color-text-muted)] truncate">{subtitle}</p>}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
            {cover != null && (
              <span className="inline-flex items-center gap-1">
                <IndianRupee className="w-3 h-3" /> {formatINRShort(cover)} cover
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="w-3 h-3" />
              {days != null && days >= 0 && days <= 30 ? (
                <span className="font-semibold text-amber-700">{renewalPhrase(days)}</span>
              ) : p.renewal_date ? (
                `Renews ${fmtDate(p.renewal_date)}`
              ) : (
                <span className="italic">Renewal date not set</span>
              )}
            </span>
          </div>
        </div>

        <ChevronDown
          className={`shrink-0 w-5 h-5 mt-1 text-[var(--color-text-muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-4 sm:px-5 pb-5 -mt-1 space-y-4 border-t border-[var(--color-border-light)] pt-4">
          {p.status === "error" ? (
            <p className="text-sm text-red-600 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              We couldn't read this PDF. It may be password-protected or a scan. Try re-uploading a
              clearer copy.
            </p>
          ) : busy ? (
            <p className="text-sm text-[var(--color-text-secondary)] flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--color-teal-600)]" />
              Still reading this policy — usually about a minute.
            </p>
          ) : (
            <>
              {p.score != null && (
                <div className="rounded-xl bg-[var(--color-cream-main)] border border-[var(--color-border-light)] p-3.5">
                  <p className={`text-sm font-semibold ${scoreClasses(p.score).text}`}>
                    {scoreVerdict(p.score)}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Scored on what actually pays out: waiting periods, sub-limits, exclusions and
                    claim conditions.
                  </p>
                </div>
              )}

              {flaws.length > 0 ? (
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                    What could cost you
                  </p>
                  <ul className="mt-2 space-y-2">
                    {flaws.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-gold-500)]" />
                        <span className="leading-snug">{f.trim()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                p.score != null && (
                  <p className="text-sm text-[var(--color-text-muted)] flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-teal-600)]" />
                    Nothing major flagged on this one.
                  </p>
                )
              )}
            </>
          )}

          {/* Inline editors — always reachable, no hover required. */}
          <div className="grid sm:grid-cols-2 gap-3">
            <InlineField
              icon={<Pencil className="w-3.5 h-3.5" />}
              label="Nickname"
              value={p.nickname}
              placeholder="e.g. Papa's health plan"
              draft={nickDraft}
              setDraft={setNickDraft}
              onSave={(v) => onRename(p.id, v)}
              emptyLabel="Give it a name"
            />
            <InlineField
              icon={<CalendarClock className="w-3.5 h-3.5" />}
              label="Renewal date"
              type="date"
              value={p.renewal_date}
              display={p.renewal_date ? fmtDate(p.renewal_date) : null}
              draft={dateDraft}
              setDraft={setDateDraft}
              onSave={(v) => onSetRenewal(p.id, v)}
              emptyLabel="Set the date"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {hasReport && (
              <button
                onClick={() => onOpenReport(p.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-teal-600)] text-white text-sm font-bold hover:bg-[var(--color-teal-400)] transition-colors active:scale-[0.98]"
              >
                View full report <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => onAskAdvisor(days != null && days <= 30 ? "renew" : "review")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--color-border-medium)] bg-white text-sm font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-teal-600)] hover:text-[var(--color-teal-600)] transition-colors"
            >
              <MessageCircle className="w-4 h-4" /> Ask about this
            </button>
            {p.has_pdf && (
              <button
                onClick={() => onDownload(p)}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--color-border-medium)] bg-white text-sm font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-teal-600)] hover:text-[var(--color-teal-600)] transition-colors disabled:opacity-50"
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Label + value that turns into an input on tap, saves on Enter/blur. */
function InlineField({
  icon, label, value, display, placeholder, type = "text", draft, setDraft, onSave, emptyLabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  display?: string | null;
  placeholder?: string;
  type?: "text" | "date";
  draft: string | null;
  setDraft: (v: string | null) => void;
  onSave: (v: string) => void;
  emptyLabel: string;
}) {
  const editing = draft !== null;
  const save = () => {
    if (draft === null) return;
    onSave(draft.trim());
    setDraft(null);
  };

  return (
    <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-cream-main)] px-3 py-2">
      <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">{label}</p>
      {editing ? (
        <div className="mt-1 flex items-center gap-1.5">
          <input
            autoFocus
            type={type}
            value={draft}
            placeholder={placeholder}
            maxLength={type === "text" ? 60 : undefined}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setDraft(null);
            }}
            onBlur={save}
            className="flex-1 min-w-0 h-8 px-2 rounded-lg border border-[var(--color-border-medium)] bg-white text-sm font-medium focus:border-[var(--color-teal-600)] outline-none"
          />
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={save}
            aria-label={`Save ${label}`}
            className="shrink-0 p-1.5 rounded-lg bg-[var(--color-teal-600)] text-white"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setDraft(null)}
            aria-label={`Cancel editing ${label}`}
            className="shrink-0 p-1.5 rounded-lg border border-[var(--color-border-medium)] text-[var(--color-text-muted)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setDraft(value ?? "")}
          className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-navy-900)] hover:text-[var(--color-teal-600)] transition-colors"
        >
          <span className="text-[var(--color-text-muted)]">{icon}</span>
          {display ?? value ?? <span className="italic font-normal text-[var(--color-text-muted)]">{emptyLabel}</span>}
        </button>
      )}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    done: "bg-emerald-50 text-emerald-700 border-emerald-200",
    processing: "bg-sky-50 text-sky-700 border-sky-200",
    pending: "bg-[var(--color-cream-dark)] text-[var(--color-text-muted)] border-[var(--color-border-light)]",
    error: "bg-red-50 text-red-700 border-red-200",
  };
  const label =
    status === "done" ? "Ready" : status === "error" ? "Couldn't read" : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${map[status] ?? map.pending}`}>
      {label}
    </span>
  );
}
