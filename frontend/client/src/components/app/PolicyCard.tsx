import { useState } from "react";
import {
  AlertCircle, ArrowRight, CalendarClock, Check, ChevronDown, Download, FileText,
  IndianRupee, Loader2, MessageCircle, Pencil, ShieldCheck, Trash2, X,
} from "lucide-react";
import type { Policy } from "./portfolio-types";
import {
  daysUntil, fmtDate, formatINRShort, labelFor, parseSumInsured, renewalPhrase,
  scoreClasses, scoreVerdict, teamWaLink,
} from "./portfolio-utils";

/**
 * The WhatsApp mark, inline because lucide ships no brand icons and a generic
 * speech bubble does not read as "WhatsApp" to someone deciding whether to tap.
 * Single filled path, currentColor, so it inherits the button's white.
 */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 6.988 2.896 9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

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
  onDelete,
  downloading,
  deleting,
}: {
  policy: Policy;
  expanded: boolean;
  onToggle: () => void;
  onRename: (id: string, nickname: string) => void;
  onSetRenewal: (id: string, date: string) => void;
  onDownload: (p: Policy) => void;
  onOpenReport: (id: string) => void;
  onAskAdvisor: (topic: string) => void;
  onDelete: (p: Policy) => void;
  downloading: boolean;
  deleting: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
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
            /* The backend names the actual problem — locked, scanned, damaged —
               and every message ends by pointing here, so the WhatsApp link is
               the next thing under it rather than a dead end. */
            <div className="space-y-3">
              <p className="text-sm text-red-600 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  {p.error_message ||
                    "We could not read this PDF. It may be locked with a password, or be a scanned copy."}
                </span>
              </p>
              <a
                href={teamWaLink(
                  `Hi, I uploaded "${title}" on IndSure and it could not be read. Can you help me check this policy?`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-teal-600)] text-white text-sm font-bold hover:bg-[var(--color-teal-400)] transition-colors active:scale-[0.98]"
              >
                <WhatsAppIcon className="w-4 h-4" /> Send it to our team
              </a>
            </div>
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

            {/* Deleting is what /start promises, so it has to be reachable, and
                it is irreversible, so it asks first. Inline rather than a modal:
                the confirm replaces the button in place, which keeps the policy
                it refers to on screen while you decide. */}
            {confirmDelete ? (
              <span className="inline-flex items-center gap-2 flex-wrap">
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Delete this policy{p.has_pdf ? " and its file" : ""}?
                </span>
                <button
                  onClick={() => onDelete(p)}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-bold text-white transition-colors disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deleting ? "Deleting…" : "Delete"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--color-border-medium)] bg-white text-sm font-semibold text-[var(--color-text-secondary)] hover:border-red-300 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete
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
