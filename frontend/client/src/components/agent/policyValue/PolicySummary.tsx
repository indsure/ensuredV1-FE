/**
 * The policy at a glance, straight from the document: premium paid so far,
 * surrender value today and on the next premium date, what is paid at the end,
 * the regular payout, total money received and the life cover.
 *
 * Shown as soon as the document is read; no review needed. The assumptions are
 * printed on the card (lib/policySnapshot explains them).
 */

import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";
import { formatRupees, type Paise } from "@/lib/exactMath";
import { policySnapshot } from "@/lib/policySnapshot";
import { prettyIso } from "@/lib/policyValueText";
import { useDocumentRules } from "./useDocumentRules";

function Row({ label, amount, note, text }: { label: string; amount?: Paise | null; note?: string; text?: string }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between">
      <div className="min-w-0">
        <div className="text-base font-semibold text-slate-800">{label}</div>
        {note && <div className="text-sm text-slate-600">{note}</div>}
      </div>
      <div className="text-2xl font-bold tabular-nums text-slate-900 sm:text-right">
        {text ?? (amount ? formatRupees(amount) : <span className="text-lg text-slate-500">{t("psum.na")}</span>)}
      </div>
    </div>
  );
}

export default function PolicySummary({ clientId }: { clientId: string }) {
  const { t } = useLanguage();
  const { rules } = useDocumentRules(clientId);
  const s = useMemo(() => {
    if (!rules?.parse || rules.parse.status !== "supported") return null;
    const decisions = Object.fromEntries(Object.entries(rules.flagDecisions).map(([k, v]) => [k, v.choice]));
    return policySnapshot(rules.fields, rules.parse.flags, decisions, new Date().toISOString().slice(0, 10));
  }, [rules]);
  if (!s) return null;

  const p = s.premium;
  const freqWord = p.frequency ? t(`psum.freq_${p.frequency}`) : "";
  const end = s.atEnd;

  return (
    <Card className="border-[#0D9488]/30 shadow-sm" data-mp-block>
      <CardHeader className="border-b border-slate-50 pb-4">
        <CardTitle>{t("psum.title")}</CardTitle>
        <p className="mt-1 text-sm text-slate-600">{t("psum.intro")}</p>
      </CardHeader>
      <CardContent className="p-6 pt-2">
        <Row label={t("psum.paid")} amount={p.paidSoFar}
          note={p.perInstalment ? t("psum.paid_note", { count: p.paidCount, total: p.totalCount, each: formatRupees(p.perInstalment), freq: freqWord }) + (p.excludesTaxes ? ` ${t("psum.plus_gst")}` : "") : undefined} />
        <Row label={t("psum.sv_today")} amount={s.gsvToday} />
        {s.nextDue && (
          <Row label={t("psum.sv_next", { date: prettyIso(s.nextDue.date) })} amount={s.nextDue.gsv} note={t("psum.sv_next_note")} />
        )}
        {end.maturity ? (
          <Row label={t("psum.maturity", { date: end.date ? prettyIso(end.date) : "" })} amount={end.maturity} />
        ) : end.maturityNotApplicable ? (
          <Row label={t("psum.maturity", { date: end.date ? prettyIso(end.date) : "" })}
            amount={end.finalPayout} note={end.finalPayout ? t("psum.no_maturity_final") : t("psum.no_maturity")} />
        ) : (
          <Row label={t("psum.maturity", { date: end.date ? prettyIso(end.date) : "" })} amount={null} />
        )}
        {s.regularPayout && (
          <Row label={tOr(t, `psum.payout_${s.regularPayout.frequency}`, t("psum.payout_monthly"))} amount={s.regularPayout.amount}
            note={t("psum.payout_note", { from: prettyIso(s.regularPayout.from), to: prettyIso(s.regularPayout.to), count: s.regularPayout.count })} />
        )}
        <Row label={t("psum.total")} amount={s.totalReceived}
          note={s.gainOverPremiums && p.totalPayable
            ? t(s.gainOverPremiums.paise >= 0 ? "psum.total_gain" : "psum.total_loss", { gain: formatRupees({ paise: Math.abs(s.gainOverPremiums.paise) }), premiums: formatRupees(p.totalPayable) })
            : undefined} />
        <Row label={t("psum.cover")} amount={s.lifeCover} />
        <div className="space-y-1 pt-4 text-sm text-slate-600">
          <p>{t("psum.foot_sv")}</p>
          {s.usedIllustrationMethod && <p>{t("psum.foot_method")}</p>}
          <p className="font-semibold text-slate-700">{t("psum.foot_confirm")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
