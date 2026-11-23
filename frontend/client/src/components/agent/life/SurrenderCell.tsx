/**
 * The surrender figure for one life or term policy, as lib/policyBook values it:
 * a dated insurer quote the advisor entered, or a calculation from reviewed
 * product terms on checked details. Anything else shows why there is no figure.
 * Shared by the Life list and the surrender details page so the two never differ.
 */

import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";
import type { BookRow } from "@/lib/policyBook";
import type { Reason } from "@/lib/policyValue";
import { BASIS_TEXT, REASON_TEXT, prettyIso, rupees } from "@/lib/policyValueText";

export function SurrenderCell({ r }: { r: BookRow }) {
  const { t } = useLanguage();
  const reason = (x: Reason | null) => (x ? tOr(t, `pvr.${x}`, REASON_TEXT[x]) : "");
  const basis = (b: keyof typeof BASIS_TEXT) => tOr(t, `pvb.${b}`, BASIS_TEXT[b]);
  const v = r.valuation;
  const sp = v?.values.surrender_payable;
  if (v && sp && v.cash.surrender && sp.amount !== null) {
    return (
      <div className="min-w-0">
        <div className="font-semibold tabular-nums text-slate-900">{rupees(sp.amount)}</div>
        <div className="text-sm text-slate-600">
          {basis(sp.basis)}{sp.basis === "insurer_quote" && sp.asOf ? ` · ${t("pv.as_of", { date: prettyIso(sp.asOf) })}` : ""}
        </div>
      </div>
    );
  }
  if (sp?.upperBound !== null && sp?.upperBound !== undefined) {
    return (
      <div className="min-w-0">
        <div className="font-semibold tabular-nums text-slate-700">{t("pv.at_most", { amount: rupees(sp.upperBound) })}</div>
        <div className="text-sm text-slate-600">{t("pv.at_most_note")}</div>
      </div>
    );
  }
  return (
    <div className="text-sm text-slate-600">
      {r.state === "term_cover" ? reason("term_no_surrender") : reason(r.reason) || t("pv.not_available")}
    </div>
  );
}
