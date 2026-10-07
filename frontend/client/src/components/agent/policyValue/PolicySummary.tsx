/**
 * The policy at a glance, straight from the document: premium paid so far,
 * surrender value today and on the next premium date, what is paid at the end,
 * the regular payout, total money received and the life cover.
 *
 * Shown as soon as the document is read; no review needed. The assumptions are
 * printed on the card (lib/policySnapshot explains them).
 *
 * Layout, for a busy advisor: the one number they are asked most (surrender
 * value today) leads on a navy band with life cover and the payout beside it;
 * then premiums as a progress bar, how the value grows to maturity as a
 * three-step line, and the total money back with what it adds over premiums.
 */

import { useMemo } from "react";
import { CalendarClock, Info, ShieldCheck, TrendingUp, Wallet } from "lucide-react";

import { Card } from "@/components/ui/card";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";
import { formatRupees, type Paise } from "@/lib/exactMath";
import { policySnapshot } from "@/lib/policySnapshot";
import { prettyIso } from "@/lib/policyValueText";
import { useDocumentRules } from "./useDocumentRules";

/** Whole rupees for the big figures (paise are noise at this size); exact elsewhere. */
const whole = (p: Paise) => formatRupees({ paise: Math.floor(p.paise / 100) * 100 });

export default function PolicySummary({ clientId }: { clientId: string }) {
  const { t } = useLanguage();
  const { rules } = useDocumentRules(clientId);
  const s = useMemo(() => {
    if (!rules?.parse || rules.parse.status !== "supported") return null;
    const decisions = Object.fromEntries(Object.entries(rules.flagDecisions).map(([k, v]) => [k, v.choice]));
    return policySnapshot(rules.fields, rules.parse.flags, decisions, new Date().toISOString().slice(0, 10));
  }, [rules]);
  const plan = rules?.fields.find((f) => f.field_key === "identity.plan")?.document_field?.value as string | undefined;
  if (!s) return null;

  const p = s.premium;
  const end = s.atEnd;
  const na = <span className="text-base font-semibold opacity-70">{t("psum.na")}</span>;
  const paidPct = p.totalCount ? Math.round((p.paidCount / p.totalCount) * 100) : 0;
  const endAmount = end.maturity ?? (end.maturityNotApplicable ? end.finalPayout : null);
  const payoutLabel = s.regularPayout ? tOr(t, `psum.payout_${s.regularPayout.frequency}`, t("psum.payout_monthly")) : null;

  const steps = [
    { key: "today", label: t("psum.step_today"), sub: t("psum.step_today_sub"), amount: s.gsvToday },
    ...(s.nextDue ? [{ key: "next", label: t("psum.step_next"), sub: prettyIso(s.nextDue.date), amount: s.nextDue.gsv }] : []),
    {
      key: "end", label: t("psum.step_end"), sub: end.date ? prettyIso(end.date) : "",
      amount: endAmount, note: end.maturityNotApplicable && end.finalPayout ? t("psum.no_maturity_final_short") : end.maturityNotApplicable ? t("psum.no_maturity") : undefined,
    },
  ];

  return (
    <Card className="overflow-hidden border border-slate-200 p-0 shadow-sm md:p-0" data-mp-block>
      {/* Navy band: surrender value today, with life cover and the payout. */}
      <div className="bg-[#0B1120] px-5 py-6 text-white sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold uppercase tracking-wider text-[#2DD4BF]">{t("psum.title")}</div>
          {plan && <div className="text-sm text-slate-300">{plan}</div>}
        </div>
        <div className="mt-5 grid gap-6 sm:grid-cols-[1.3fr_1fr] sm:items-end">
          <div>
            <div className="text-base text-slate-300">{t("psum.sv_today")}</div>
            <div className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl">{s.gsvToday ? whole(s.gsvToday) : na}</div>
            <div className="mt-2 text-sm text-slate-400">{t("psum.foot_sv")}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
            <Stat icon={<ShieldCheck className="h-5 w-5" aria-hidden />} label={t("psum.cover")} value={s.lifeCover ? whole(s.lifeCover) : null} />
            {s.regularPayout && payoutLabel && (
              <Stat icon={<Wallet className="h-5 w-5" aria-hidden />} label={payoutLabel} value={formatRupees(s.regularPayout.amount)} />
            )}
          </div>
        </div>
      </div>

      <div className="space-y-7 px-5 py-6 sm:px-7">
        {/* Premiums: how far along the customer is. */}
        <section aria-labelledby="psum-prem">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="psum-prem" className="font-sans text-base font-bold tracking-normal text-slate-900">{t("psum.paid")}</h3>
            <div className="text-2xl font-extrabold tracking-tight tabular-nums text-slate-900">{p.paidSoFar ? whole(p.paidSoFar) : na}</div>
          </div>
          {p.totalCount > 0 && (
            <>
              <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={p.totalCount} aria-valuenow={p.paidCount}>
                <div className="h-full rounded-full bg-[#0D9488]" style={{ width: `${paidPct}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm text-slate-600">
                <span>{t("psum.prem_progress", { paid: p.paidCount, total: p.totalCount })}</span>
                <span>
                  {p.perInstalment ? t("psum.prem_each", { each: formatRupees(p.perInstalment), freq: p.frequency ? t(`psum.freq_${p.frequency}`) : "" }) : ""}
                  {p.excludesTaxes ? ` · ${t("psum.plus_gst")}` : ""}
                </span>
              </div>
            </>
          )}
        </section>

        {/* How the surrender value grows, to the end of the policy. */}
        <section aria-labelledby="psum-grow">
          <h3 id="psum-grow" className="flex items-center gap-2 font-sans text-base font-bold tracking-normal text-slate-900">
            <TrendingUp className="h-5 w-5 text-[#0D9488]" aria-hidden />{t("psum.grow_title")}
          </h3>
          <ol className={"relative mt-4 grid gap-4 " + (steps.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
            {steps.map((st, i) => (
              <li key={st.key} className={"relative rounded-xl border p-4 " + (i === steps.length - 1 ? "border-[#0D9488]/40 bg-[#F0FDFA]" : "border-slate-200 bg-white")}>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <span className={"flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold " + (i === steps.length - 1 ? "bg-[#0D9488] text-white" : "bg-slate-100 text-slate-700")}>{i + 1}</span>
                  {st.label}
                </div>
                <div className="mt-1 text-sm text-slate-500">{st.sub}</div>
                <div className="mt-2 text-2xl font-extrabold tracking-tight tabular-nums text-slate-900">{st.amount ? whole(st.amount) : na}</div>
                {st.key === "next" && <div className="mt-1 text-sm text-slate-500">{t("psum.sv_next_note")}</div>}
                {"note" in st && st.note && <div className="mt-1 text-sm text-slate-500">{st.note}</div>}
              </li>
            ))}
          </ol>
        </section>

        {/* The total money back, and what it is made of. */}
        <section className="rounded-xl border border-slate-200 p-4 sm:p-5" aria-labelledby="psum-total">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="psum-total" className="font-sans text-sm font-semibold tracking-normal text-slate-600">{t("psum.total")}</h3>
              <div className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums text-slate-900">{s.totalReceived ? whole(s.totalReceived) : na}</div>
            </div>
            {s.gainOverPremiums && p.totalPayable && (
              <div className={"rounded-xl px-3 py-2 text-right " + (s.gainOverPremiums.paise >= 0 ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900")}>
                <div className="text-lg font-extrabold tabular-nums">{s.gainOverPremiums.paise >= 0 ? "+" : "−"}{whole({ paise: Math.abs(s.gainOverPremiums.paise) })}</div>
                <div className="text-sm">{t("psum.vs_premiums", { premiums: whole(p.totalPayable) })}</div>
              </div>
            )}
          </div>
          {(s.regularPayout || endAmount) && (
            <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
              {s.regularPayout && payoutLabel && (
                <div className="flex gap-2">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[#0D9488]" aria-hidden />
                  <div>
                    <dt className="font-semibold text-slate-800">{t("psum.part_payouts", { count: s.regularPayout.count, each: formatRupees(s.regularPayout.amount) })}</dt>
                    <dd className="text-slate-600">{whole({ paise: s.regularPayout.amount.paise * s.regularPayout.count })} · {t("psum.range", { from: prettyIso(s.regularPayout.from), to: prettyIso(s.regularPayout.to) })}</dd>
                  </div>
                </div>
              )}
              {endAmount && (
                <div className="flex gap-2">
                  <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-[#0D9488]" aria-hidden />
                  <div>
                    <dt className="font-semibold text-slate-800">{end.maturity ? t("psum.part_maturity") : t("psum.part_final")}</dt>
                    <dd className="text-slate-600">{whole(endAmount)}{end.date ? ` · ${prettyIso(end.date)}` : ""}</dd>
                  </div>
                </div>
              )}
            </dl>
          )}
        </section>

        <div className="flex gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <div className="space-y-1">
            <p>{t("psum.intro")}</p>
            {s.usedIllustrationMethod && <p>{t("psum.foot_method")}</p>}
            <p className="font-semibold text-slate-700">{t("psum.foot_confirm")}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  const { t } = useLanguage();
  return (
    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
      <div className="flex items-center gap-2 text-sm text-slate-300"><span className="text-[#2DD4BF]">{icon}</span>{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value ?? <span className="text-base opacity-70">{t("psum.na")}</span>}</div>
    </div>
  );
}
