import { useCallback, useEffect, useState } from "react";
import { useParams } from "wouter";
import { MessageCircle } from "lucide-react";

import { useAgent } from "@/context/AgentContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { BackLink } from "@/components/agent/BackLink";
import { InlineErrorState } from "@/components/agent/InlineErrorState";
import {
  dayText, fetchLicPolicy, inr, monthText, niceName, payerName, reminderHref, type LicPolicyDetail as Detail,
} from "@/lib/lic";
import { getLicPlan } from "@shared/licPlans";

// One LIC policy, opened from My Policies or Policies > LIC (founder, 2026-11-28). Laid out like
// the policy details form, but read-only: every field comes from LIC's own sheets, so the place
// to change it is the next sheet, not a text box here.

const STATUS_CHIP: Record<string, string> = {
  past_grace: "bg-red-50 text-red-800 border-red-200",
  part_paid: "bg-violet-50 text-violet-800 border-violet-200",
  in_grace: "bg-amber-50 text-amber-900 border-amber-200",
  due: "bg-sky-50 text-sky-900 border-sky-200",
  paid: "bg-teal-50 text-teal-800 border-teal-200",
};

export default function LicPolicyDetail() {
  const { policyNo = "" } = useParams<{ policyNo: string }>();
  const { t, locale } = useLanguage();
  const { agent } = useAgent();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await fetchLicPolicy(policyNo));
    } catch (e: any) {
      setError(e?.message || t("lic.load_failed"));
    }
  }, [policyNo, t]);
  useEffect(() => { void load(); }, [load]);

  const p = data?.policy ?? null;
  const pay = data?.payments ?? [];
  const holder = p?.holderName ?? pay[0]?.holderName ?? "";
  const planNo = p?.planNo ?? pay[0]?.planNo ?? null;
  const plan = planNo != null ? getLicPlan(planNo) : undefined;
  const chosenTerm = p?.chosenTerm ?? pay[0]?.term ?? null;
  const commenced = p?.doc ?? pay[0]?.riskDate ?? null;
  // "(LA)" is the life assured, "(PR)" the proposer who pays: LIC's own markers for a child's policy.
  const la = holder.match(/^(.+?)\s*\(LA\)/i)?.[1];
  const proposer = /\(PR?\)?\s*$/i.test(holder) ? payerName(holder) : niceName(holder.replace(/\((LA|PR?)\)/gi, " "));

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <BackLink to="/agent/policies?type=lic" label={t("lic.back_to_list")} />

      {error ? (
        <InlineErrorState message={error} onRetry={load} />
      ) : !data ? (
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      ) : (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-amber-700">{t("lic.detail_eyebrow")}</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900 font-['Playfair_Display']">{proposer}</h1>
              <p className="mt-1 text-base text-slate-600">
                {t("lic.policy_no", { no: policyNo })}{plan ? ` · ${plan.name}` : ""}
              </p>
            </div>
            {p && p.status !== "paid" && (
              <a
                href={reminderHref(p, locale, agent?.name ?? null)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0F766E] px-5 text-sm font-bold text-white hover:bg-[#0B5F59]"
              >
                <MessageCircle className="h-4 w-4" />
                {t("lic.remind")}
              </a>
            )}
          </header>

          {p && (
            <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold ${STATUS_CHIP[p.status]}`}>
                {t(`lic.status_${p.status}`)}
              </span>
              {p.status !== "paid" && <span className="text-lg font-bold tabular-nums text-slate-900">{inr(p.stillDue, locale)}</span>}
              <span className="text-sm text-slate-700">
                {p.status === "paid" ? t("lic.note_paid")
                  : p.status === "in_grace" ? t("lic.note_in_grace", { date: dayText(p.graceEnds, locale) })
                  : p.status === "due" ? t("lic.note_due", { date: dayText(p.dueDate, locale) })
                  : p.status === "part_paid" ? t("lic.note_part_paid", { paid: inr(p.paidAmount, locale), left: inr(p.stillDue, locale) })
                  : p.flag === "MT" || p.flag === "LP" ? t("lic.note_grace_ended", { date: dayText(p.graceEnds, locale) })
                  : t("lic.note_past_grace", { date: dayText(p.graceEnds, locale) })}
              </span>
              {p.flag === "LP" && <span className="text-sm font-semibold text-violet-800">{t("lic.flag_lp")}</span>}
              {p.flag === "MT" && <span className="text-sm font-semibold text-violet-800">{t("lic.flag_mt")}</span>}
            </section>
          )}

          <section aria-labelledby="lic-details" className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-4">
              <h2 id="lic-details" className="text-lg font-bold text-slate-900">{t("lic.detail_title")}</h2>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{t("lic.detail_source")}</span>
            </div>
            <p className="mt-4 text-sm text-slate-600">{t("lic.detail_note")}</p>
            <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
              <Field label={t("lic.d_proposer")} value={proposer} />
              <Field label={t("lic.d_life_assured")} value={la ? niceName(la) : proposer} />
              <Field label={t("lic.d_insurer")} value="Life Insurance Corporation of India (LIC)" />
              <Field label={t("lic.d_policy_no")} value={policyNo} />
              <Field label={t("lic.d_plan")} value={planNo != null ? (plan ? `${plan.name} (${planNo})` : `LIC plan ${planNo}`) : null} />
              <Field label={t("lic.d_plan_type")} value={plan ? t(`lic_plans.cat.${plan.category}`) : null} />
              <Field label={t("lic.d_premium")} value={p ? inr(p.instPrem, locale) : pay[0] ? inr(pay[0].premium, locale) : null} />
              <Field label={t("lic.d_frequency")} value={p ? t(`lic.mode_${p.mode}`) : null} />
              <Field label={t("lic.d_term")} value={chosenTerm != null ? t("lic.term_years", { count: chosenTerm }) : null} empty={t("lic.d_term_unknown")} />
              <Field label={t("lic.d_commenced")} value={commenced ? dayText(commenced, locale) : null} />
              <Field label={t("lic.d_next_due")} value={p && p.status !== "paid" ? dayText(p.dueDate, locale) : null} />
              <Field label={t("lic.d_unpaid_since")} value={p && p.status !== "paid" ? monthText(p.fup, locale, true) : null} />
              <Field label={t("lic.d_owed")} value={p && p.dueCount > 1 ? t("lic.premiums_owed", { count: p.dueCount }) : p ? "1" : null} />
              <Field label={t("lic.d_est_comm")} value={p ? inr(p.estComm, locale) : null} />
              {plan?.details && <Field label={t("lic.d_maturity")} value={plan.details.maturity} wide />}
            </dl>
          </section>

          <section aria-labelledby="lic-payments" className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 id="lic-payments" className="text-lg font-bold text-slate-900">{t("lic.payments_title")}</h2>
            {pay.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">{t("lic.payments_none")}</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {pay.map((x) => (
                  <li key={`${x.dueDate}-${x.adjDate}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{t("lic.pay_for", { date: dayText(x.dueDate, locale) })}</div>
                      <div className="text-sm text-slate-600">
                        {t("lic.pay_meta", { date: dayText(x.adjDate, locale), batch: x.batch ?? 1, month: monthText(x.period, locale) })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold tabular-nums text-slate-900">{inr(x.premium, locale)}</div>
                      <div className="text-sm text-slate-600">{t("lic.pay_comm", { amount: inr(x.commission, locale) })}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Field({ label, value, empty, wide }: { label: string; value: string | null | undefined; empty?: string; wide?: boolean }) {
  const { t } = useLanguage();
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <dt className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</dt>
      <dd className={`mt-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base ${value ? "text-slate-900" : "text-slate-500"}`}>
        {value || empty || t("lic.d_not_on_sheet")}
      </dd>
    </div>
  );
}
