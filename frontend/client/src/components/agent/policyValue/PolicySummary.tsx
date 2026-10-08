/**
 * The policy at a glance, as one grouped table: premiums, surrender value, what the
 * customer gets, and protection. Straight from the policy document, shown as soon as it
 * is read (no review needed), with the assumptions printed on the card.
 *
 * Two sources (lib/policySnapshot):
 *   - "terms": a product reader worked the figures out from the contract's rules.
 *   - "illustration": the general reader took them off the insurer's year-by-year
 *     benefit illustration, so surrender figures are named by policy year.
 */

import { useMemo } from "react";
import { Info } from "lucide-react";

import { Card } from "@/components/ui/card";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";
import { formatRupees, type Paise } from "@/lib/exactMath";
import { policySnapshot } from "@/lib/policySnapshot";
import { prettyIso } from "@/lib/policyValueText";
import { useDocumentRules } from "./useDocumentRules";

/** Whole rupees for the big figures (paise are noise at this size); exact for the payout. */
const whole = (p: Paise) => formatRupees({ paise: Math.floor(p.paise / 100) * 100 });

function Group({ label }: { label: string }) {
  return (
    <tr>
      <th colSpan={2} scope="colgroup" className="px-4 pb-1.5 pt-5 text-left text-xs font-bold uppercase tracking-[0.09em] text-[#0F766E] sm:px-7">
        {label}
      </th>
    </tr>
  );
}

function Row({ label, sub, amount, exact, first, hero, children }: {
  label: string; sub?: string | null; amount: Paise | null; exact?: boolean; first?: boolean; hero?: boolean; children?: React.ReactNode;
}) {
  const { t } = useLanguage();
  const cell = "px-4 py-3.5 align-top sm:px-7 " + (first ? "" : "border-t border-slate-100 ") + (hero ? "bg-[#ECFBF8]" : "");
  return (
    <tr>
      <td className={cell}>
        <div className={"text-base font-semibold " + (hero ? "text-[#0F766E]" : "text-slate-900")}>{label}</div>
        {sub && <div className="mt-0.5 text-sm text-slate-600">{sub}</div>}
        {children}
      </td>
      <td className={cell + " whitespace-nowrap text-right font-extrabold tabular-nums tracking-tight " + (hero ? "text-2xl text-[#0F766E] sm:text-[1.9rem]" : "text-xl text-slate-900 sm:text-[1.4rem]")}>
        {amount ? (exact ? formatRupees(amount) : whole(amount)) : <span className="text-base font-semibold text-slate-500">{t("psum.na")}</span>}
      </td>
    </tr>
  );
}

/** Holds the table's place while the terms load, so the page does not jump when it arrives. */
function SummarySkeleton({ title, label }: { title: string; label: string }) {
  const bar = (w: string) => <div className={"h-4 animate-pulse rounded bg-slate-100 motion-reduce:animate-none " + w} />;
  return (
    <Card className="overflow-hidden border border-slate-200 p-0 shadow-sm md:p-0" aria-busy="true" aria-label={label}>
      <div className="grid gap-2.5 border-b border-slate-100 px-4 pb-4 pt-5 sm:px-7">
        <h2 className="font-serif text-2xl font-bold">{title}</h2>
        {bar("w-72 max-w-full")}
      </div>
      <div className="grid gap-5 px-4 py-6 sm:px-7">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="grid flex-1 gap-2">{bar("w-40")}{bar("w-56 max-w-full opacity-70")}</div>
            {bar("w-24")}
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function PolicySummary({ clientId }: { clientId: string }) {
  const { t } = useLanguage();
  const { rules, loading } = useDocumentRules(clientId);
  const s = useMemo(() => {
    if (!rules?.parse || rules.parse.status !== "supported") return null;
    const decisions = Object.fromEntries(Object.entries(rules.flagDecisions).map(([k, v]) => [k, v.choice]));
    return policySnapshot(rules.fields, rules.parse.flags, decisions, new Date().toISOString().slice(0, 10));
  }, [rules]);
  const fieldValue = (k: string) => rules?.fields.find((f) => f.field_key === k)?.document_field?.value as string | undefined;
  if (!s) return loading ? <SummarySkeleton title={t("psum.title")} label={t("psum.loading")} /> : null;

  const ill = s.source === "illustration" ? s.illustration : null;
  const plan = fieldValue("identity.plan") ?? (fieldValue("identity.uin") ? `UIN ${fieldValue("identity.uin")}` : null);
  const variant = [fieldValue("identity.option"), fieldValue("identity.benefit_choice")].filter(Boolean).join(" · ");
  const p = s.premium;
  const end = s.atEnd;
  const endAmount = end.maturity ?? (end.maturityNotApplicable ? end.finalPayout : null);
  const paidPct = p.totalCount ? Math.min(100, Math.round((p.paidCount / p.totalCount) * 100)) : 0;
  const lifePctRule = rules?.fields.some((f) => f.field_key === "death.min_pct_of_premiums_paid" && f.document_field?.state === "found");

  // Premiums.
  const paidSub = ill
    ? (p.perInstalment && ill.yearNow ? t("psum.paid_sub_ill", { n: Math.min(ill.yearNow, p.totalCount), each: formatRupees(p.perInstalment) }) : null)
    : p.perInstalment
      ? t("psum.paid_note", { count: p.paidCount, total: p.totalCount, each: formatRupees(p.perInstalment), freq: p.frequency ? t(`psum.freq_${p.frequency}`) : "" }) + (p.excludesTaxes ? ` ${t("psum.plus_gst")}` : "")
      : null;

  // Payouts.
  let payout: { label: string; sub: string | null; amount: Paise; exact: boolean } | null = null;
  if (s.regularPayout) {
    payout = {
      label: tOr(t, `psum.payout_${s.regularPayout.frequency}`, t("psum.payout_monthly")),
      sub: t("psum.payout_note", { from: prettyIso(s.regularPayout.from), to: prettyIso(s.regularPayout.to), count: s.regularPayout.count }),
      amount: s.regularPayout.amount, exact: true,
    };
  } else if (ill?.payouts) {
    const py = ill.payouts;
    const years = py.years.length > 6 ? `${py.years.slice(0, 6).join(", ")}…` : py.years.join(", ");
    payout = py.perYear
      ? { label: t("psum.payouts"), sub: py.consecutive ? t("psum.pay_range", { a: py.years[0], b: py.years[py.years.length - 1] }) : t("psum.pay_years", { years }), amount: py.perYear, exact: false }
      : { label: t("psum.payouts"), sub: t("psum.pay_total", { years }), amount: py.total, exact: false };
  }

  return (
    <Card className="overflow-hidden border border-slate-200 p-0 shadow-sm md:p-0" data-mp-block>
      <div className="grid gap-2.5 border-b border-slate-100 px-4 pb-4 pt-5 sm:px-7">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-serif text-2xl font-bold">{t("psum.title")}</h2>
          {(plan || variant) && <span className="text-sm text-slate-600">{[plan, variant].filter(Boolean).join(" · ")}</span>}
        </div>
        <span className="inline-flex items-center gap-2 justify-self-start rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
          <Info className="h-4 w-4 shrink-0" aria-hidden />{t("psum.intro")}
        </span>
      </div>

      <table className="w-full border-collapse tabular-nums">
        <tbody>
          <Group label={t("psum.g_premiums")} />
          <Row first label={t("psum.paid")} sub={paidSub} amount={p.paidSoFar}>
            {p.totalCount > 0 && p.paidSoFar && (
              <div className="mt-2.5 h-2 max-w-[300px] overflow-hidden rounded-full bg-slate-100" role="img" aria-label={t("psum.prem_progress", { paid: p.paidCount, total: p.totalCount })}>
                <div className="h-full rounded-full bg-[#0D9488]" style={{ width: `${paidPct}%` }} />
              </div>
            )}
          </Row>
        </tbody>
        <tbody>
          <Group label={t("psum.g_surrender")} />
          {ill ? (
            <>
              <Row first hero label={t("psum.sv_year_row")} amount={s.gsvToday}
                sub={ill.yearNow && ill.yearNowFrom ? t("psum.sv_year_sub", { n: ill.yearNow, date: prettyIso(ill.yearNowFrom) }) : null} />
              {s.nextDue && <Row label={t("psum.sv_nextyear_row")} amount={s.nextDue.gsv} sub={t("psum.sv_nextyear_sub", { date: prettyIso(s.nextDue.date) })} />}
            </>
          ) : (
            <>
              <Row first hero label={t("psum.sv_today_row")} amount={s.gsvToday} />
              {s.nextDue && <Row label={t("psum.next_row")} amount={s.nextDue.gsv} sub={t("psum.next_row_sub", { date: prettyIso(s.nextDue.date) })} />}
            </>
          )}
        </tbody>
        <tbody>
          <Group label={t("psum.g_gets")} />
          {payout && <Row first label={payout.label} sub={payout.sub} amount={payout.amount} exact={payout.exact} />}
          <Row first={!payout} label={t("psum.step_end")} amount={endAmount}
            sub={[end.date ? prettyIso(end.date) : null, end.maturityNotApplicable && end.finalPayout ? t("psum.no_maturity_final_short") : null].filter(Boolean).join(" · ") || null} />
          <Row label={t("psum.total")} sub={t("psum.total_sub")} amount={s.totalReceived}>
            {s.gainOverPremiums && p.totalPayable && (
              <span className={"mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-sm font-bold " + (s.gainOverPremiums.paise >= 0 ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800")}>
                {t(s.gainOverPremiums.paise >= 0 ? "psum.gain_more" : "psum.gain_less", { gain: whole({ paise: Math.abs(s.gainOverPremiums.paise) }), premiums: whole(p.totalPayable) })}
              </span>
            )}
          </Row>
        </tbody>
        <tbody>
          <Group label={t("psum.g_protection")} />
          <Row first label={t("psum.cover")} amount={s.lifeCover}
            sub={ill?.yearNow ? t("psum.cover_ill", { n: ill.yearNow }) : lifePctRule ? t("psum.cover_rule") : null} />
        </tbody>
      </table>

      <div className="grid gap-1 border-t border-slate-100 px-4 pb-5 pt-3.5 text-sm text-slate-600 sm:px-7">
        <span>{ill ? t("psum.foot_ill") : t("psum.foot_sv")}</span>
        {s.usedIllustrationMethod && <span>{t("psum.foot_method")}</span>}
        <strong className="font-semibold text-slate-800">{t("psum.foot_confirm")}</strong>
      </div>
    </Card>
  );
}
