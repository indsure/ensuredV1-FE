import { Link } from "wouter";
import { ExternalLink, MessageCircle } from "lucide-react";

import { useLanguage } from "@/i18n/LanguageContext";
import { dayText, inr, niceName, planLabel, reminderHref, type LicRow } from "@/lib/lic";

// LIC policies inside the My Policies list (founder, 2026-11-28). They come from LIC's own
// sheets, not from a policy check, so they have no score, report, views or delete: the actions
// are a WhatsApp reminder and the LIC page, where the sheets themselves are managed.

const CHIP: Record<LicRow["status"], string> = {
  past_grace: "bg-red-50 text-red-800 border-red-200",
  part_paid: "bg-violet-50 text-violet-800 border-violet-200",
  in_grace: "bg-amber-50 text-amber-900 border-amber-200",
  due: "bg-sky-50 text-sky-900 border-sky-200",
  paid: "bg-teal-50 text-teal-800 border-teal-200",
};

function useDueText() {
  const { t, locale } = useLanguage();
  return (r: LicRow) => {
    if (r.status === "paid") return t("lic.note_paid");
    if (r.status === "in_grace") return t("lic.note_in_grace", { date: dayText(r.graceEnds, locale) });
    if (r.status === "due") return t("lic.note_due", { date: dayText(r.dueDate, locale) });
    if (r.status === "part_paid") return t("lic.note_part_paid", { paid: inr(r.paidAmount, locale), left: inr(r.stillDue, locale) });
    return t("lic.note_grace_ended", { date: dayText(r.graceEnds, locale) });
  };
}

export function LicTableRow({ r, showScore, showRecommendation, advisor, onOpen }: {
  r: LicRow;
  showScore: boolean;
  showRecommendation: boolean;
  advisor: string | null;
  onOpen: () => void;
}) {
  const { t, locale } = useLanguage();
  const dueText = useDueText();
  return (
        <tr className="hover:bg-slate-50/60 transition-colors cursor-pointer" onClick={onOpen}>
          <td className="px-6 py-4" data-label={t("policies.col_customer")} data-cell="title">
            <div className="font-semibold text-slate-800">{niceName(r.holderName)}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">{t("lic.policy_no", { no: r.policyNo })}</div>
          </td>
          <td className="px-6 py-4" data-label={t("policies.col_type")}>
            <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider">
              {t("layout.type_lic")}
            </span>
          </td>
          <td className="px-6 py-4 text-slate-600" data-label={t("policies.col_insurer")}>
            <div>LIC</div>
            <div className="text-xs text-slate-500">{planLabel(r.planNo)} · {t(`lic.mode_${r.mode}`)}</div>
          </td>
          <td className="px-6 py-4" data-label={t("policies.col_next_premium")}>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${CHIP[r.status]}`}>
              {t(`lic.status_${r.status}`)}
            </span>
            {r.status !== "paid" && (
              <div className="mt-1 text-sm font-semibold tabular-nums text-slate-800">{inr(r.stillDue, locale)}</div>
            )}
            <div className="text-xs text-slate-500">{dueText(r)}</div>
          </td>
          {showScore && <td className="px-6 py-4" data-label={t("policies.col_score")}><span className="text-slate-300 text-sm">—</span></td>}
          {showRecommendation && <td className="px-6 py-4" data-label={t("policies.col_recommendation")}><span className="text-slate-300 text-sm">—</span></td>}
          <td className="px-6 py-4" data-label={t("policies.col_views")}><span className="text-slate-300 text-sm">—</span></td>
          <td className="px-6 py-4" data-label={t("policies.col_actions")} data-cell="actions" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-end gap-1 max-md:w-full max-md:justify-start">
              {r.status !== "paid" && (
                <a
                  href={reminderHref(r, locale, advisor)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t("lic.remind")}
                  aria-label={`${t("lic.remind")}: ${niceName(r.holderName)}`}
                  className="inline-flex h-10 w-10 md:h-9 md:w-9 items-center justify-center rounded text-slate-500 hover:text-[#0D9488] hover:bg-teal-50"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              )}
              <Link
                href={`/agent/lic/policy/${r.policyNo}`}
                title={t("lic.open_details")}
                aria-label={t("lic.open_details")}
                className="inline-flex h-10 w-10 md:h-9 md:w-9 items-center justify-center rounded text-slate-500 hover:text-[#0D9488] hover:bg-teal-50"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </td>
        </tr>
  );
}

export function LicMobileCards({ rows, advisor, onOpen }: { rows: LicRow[]; advisor: string | null; onOpen: (policyNo: string) => void }) {
  const { t, locale } = useLanguage();
  const dueText = useDueText();
  if (rows.length === 0) return null;
  return (
    <ul className="mt-3 space-y-3">
      {rows.map((r) => (
        <li key={`lic-${r.policyNo}-${r.fup}`} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-bold text-slate-900">{niceName(r.holderName)}</div>
              <div className="text-sm text-slate-600">{planLabel(r.planNo)} · {t(`lic.mode_${r.mode}`)}</div>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold uppercase text-slate-600">{t("layout.type_lic")}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-bold ${CHIP[r.status]}`}>{t(`lic.status_${r.status}`)}</span>
            {r.status !== "paid" && <span className="text-sm font-bold tabular-nums text-slate-900">{inr(r.stillDue, locale)}</span>}
            <span className="text-sm text-slate-600">{dueText(r)}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {r.status !== "paid" && (
              <a href={reminderHref(r, locale, advisor)} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#0F766E] px-4 text-sm font-bold text-[#0F766E]">
                <MessageCircle className="h-4 w-4" />{t("lic.remind")}
              </a>
            )}
            <button type="button" onClick={() => onOpen(r.policyNo)} className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700">
              {t("lic.open_details")}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
