import { useEffect, useState } from "react";
import { Link } from "wouter";
import { MessageCircle } from "lucide-react";

import { useAgent } from "@/context/AgentContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { fetchLicOverview, inr, monthText, niceName, planLabel, reminderHref, type LicOverview } from "@/lib/lic";

/** Policies > Overview: one line pointing to the LIC page, only when there is a due list. */
export function LicOverviewStrip() {
  const { t } = useLanguage();
  const [data, setData] = useState<LicOverview | null>(null);
  useEffect(() => {
    let live = true;
    fetchLicOverview().then((d) => live && setData(d)).catch(() => {});
    return () => { live = false; };
  }, []);
  if (!data?.dueList || !data.totals) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
      <p className="text-sm text-slate-700">
        {t("lic.strip", { count: data.totals.due.count, notPaid: data.totals.notPaid.count })}
      </p>
      <Link href="/agent/lic" className="inline-flex min-h-[44px] items-center text-sm font-bold text-[#0F766E] underline">
        {t("lic.strip_open")}
      </Link>
    </div>
  );
}

/**
 * Home: LIC premium due. Hidden until the advisor has a Premium Due list, and hidden if the
 * read fails: Home has its own error states, and an LIC card that errors for an advisor who
 * never uploaded a sheet would be noise. The LIC page itself shows the error with a retry.
 */
export function LicDueCard() {
  const { t, locale } = useLanguage();
  const { agent } = useAgent();
  const [data, setData] = useState<LicOverview | null>(null);

  useEffect(() => {
    let live = true;
    fetchLicOverview().then((d) => live && setData(d)).catch(() => {});
    return () => { live = false; };
  }, []);

  if (!data?.dueList || !data.totals) return null;
  const tt = data.totals;
  const top = data.rows.filter((r) => r.status !== "paid").slice(0, 3);
  const graceCount = tt.inGrace.count + tt.notYetDue.count;
  const graceAmount = tt.inGrace.amount + tt.notYetDue.amount;

  return (
    <section aria-labelledby="lic-home-title" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-widest text-amber-700">
        {t("lic.home_eyebrow", { month: monthText(data.dueList.period, locale, true) })}
      </p>
      {tt.notPaid.count === 0 ? (
        <p id="lic-home-title" className="mt-2 text-lg font-bold text-slate-900">{t("lic.home_all_paid")}</p>
      ) : (
        <>
          <h2 id="lic-home-title" className="mt-2 text-2xl font-bold text-slate-900 font-['Playfair_Display']">
            {t("lic.home_title", { count: tt.notPaid.count })}
          </h2>
          <p className="mt-1 text-base text-slate-700">{t("lic.home_amount", { amount: inr(tt.notPaid.amount, locale) })}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link href="/agent/lic" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900">
              {t("lic.home_past", { count: tt.pastGrace.count, amount: inr(tt.pastGrace.amount, locale) })}
            </Link>
            <Link href="/agent/lic" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-950">
              {t("lic.home_grace", { count: graceCount, amount: inr(graceAmount, locale) })}
            </Link>
          </div>

          {top.length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-bold text-slate-800">{t("lic.home_call_first")}</h3>
              <ul className="mt-1 divide-y divide-slate-100">
                {top.map((r) => (
                  <li key={`${r.policyNo}-${r.fup}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-slate-900">{niceName(r.holderName)}</div>
                      <div className="text-sm text-slate-600">
                        {planLabel(r.planNo)} · {t(`lic.mode_${r.mode}`)} · {t("lic.unpaid_since_month", { month: monthText(r.fup, locale) })}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold tabular-nums text-slate-900">{inr(r.stillDue, locale)}</span>
                      <a
                        href={reminderHref(r, locale, agent?.name ?? null)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${t("lic.remind")}: ${niceName(r.holderName)}`}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#0F766E] text-[#0F766E] hover:bg-teal-50"
                      >
                        <MessageCircle className="h-5 w-5" />
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      <Link href="/agent/lic" className="mt-2 inline-flex min-h-[44px] items-center text-sm font-bold text-[#0F766E] underline">
        {t("lic.home_see_all")}
      </Link>
    </section>
  );
}
