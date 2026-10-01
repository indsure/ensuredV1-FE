/**
 * A factor table typed in from the policy wording, and the estimate it gives.
 *
 * The table is the advisor's. It is validated (no overlapping or unsorted
 * rows, percentages from 0 to 100) but never "verified": it can only ever
 * produce an estimate, shown here and nowhere else. It never reaches the
 * surrender tile, the book's totals or the WhatsApp reply.
 *
 * A percentage under 1 is legal, but it is also what a decimal typed into a
 * percent box looks like, so it is saved only after the advisor says which
 * they meant. Nothing is converted for them.
 */

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";
import { parsePercent, parseWholeNumber, percentNeedsConfirmation, valuationDateIso } from "@/lib/policyNumbers";
import { validateRuleSet, type FactorBand, type RuleSet } from "@/lib/productRules";
import type { ValueEvidence } from "@/lib/policyEvidence";
import type { PolicyValuation, Shape } from "@/lib/policyValue";
import { REASON_TEXT, prettyIso, rupees } from "@/lib/policyValueText";

type BandDraft = { from: string; to: string; pct: string };

const toDraft = (b: FactorBand[] | undefined): BandDraft[] =>
  (b ?? []).map((x) => ({ from: String(x.fromYear), to: String(x.toYear), pct: String(x.pct) }));

interface Props {
  data: Record<string, any>;
  evidence: ValueEvidence;
  v: PolicyValuation;
  saving: boolean;
  save: (ev: ValueEvidence) => Promise<boolean>;
}

export function RulesEditor({ data, evidence, v, saving, save }: Props) {
  const { t } = useLanguage();
  const r = evidence.rules;
  const [acq, setAcq] = useState(String(r?.surrender?.acquiredAfterYears ?? ""));
  const [gsv, setGsv] = useState<BandDraft[]>(toDraft(r?.surrender?.gsv?.factors));
  const [ssv, setSsv] = useState<BandDraft[]>(toDraft(r?.surrender?.ssv?.factors));
  const [selection, setSelection] = useState<string>(r?.surrender?.selection ?? "gsv_only");
  const [deduct, setDeduct] = useState<boolean>(r?.surrender?.gsv?.deductSurvivalBenefitsPaid ?? false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSmall, setConfirmSmall] = useState<string[]>([]);

  const shape = v.shape.value;
  const supported = shape === "endowment" || shape === "money_back" || shape === "return_of_premium";

  function readBands(rows: BandDraft[], allowSmall: boolean): { bands: FactorBand[]; small: string[] } | null {
    const bands: FactorBand[] = [];
    const small: string[] = [];
    for (const row of rows) {
      const f = parseWholeNumber(row.from, { min: 1, max: 100 });
      const to = parseWholeNumber(row.to, { min: 1, max: 100 });
      const p = parsePercent(row.pct);
      if (!f.ok || !to.ok || !p.ok) return null;
      if (percentNeedsConfirmation(p.value) && !allowSmall) small.push(row.pct);
      bands.push({ fromYear: f.value, toYear: to.value, pct: p.value });
    }
    return { bands, small };
  }

  async function onSave(allowSmall = false) {
    setError(null);
    const a = parseWholeNumber(acq, { min: 0, max: 100 });
    const g = readBands(gsv, allowSmall);
    const s = readBands(ssv, allowSmall);
    if (!a.ok || !g || !s) return setError(t("pvc.r_bad_number"));
    const small = [...g.small, ...s.small];
    if (small.length) return setConfirmSmall(small);
    setConfirmSmall([]);
    const draft = {
      schema: 1,
      id: "entered",
      insurer: String(data.insurer || "not on file"),
      uin: String(data.uin || "not on file"),
      shape,
      surrender: {
        acquiredAfterYears: a.value,
        gsv: g.bands.length ? { base: "premiums_paid_excluding_taxes_riders_extras", factors: g.bands, interpolation: null, deductSurvivalBenefitsPaid: deduct } : null,
        ssv: s.bands.length ? { method: "factor_table", base: "paid_up_basic_sum_assured_plus_vested_bonus", factors: s.bands, interpolation: null } : null,
        selection,
      },
      loan: null,
      citations: [{ supports: "factor table", document: "Policy wording, as typed in by the advisor" }],
      review: { status: "agent_entered", on: valuationDateIso() },
    };
    const checked = validateRuleSet(draft);
    if (!checked.rules) return setError(t("pvc.r_invalid", { issues: checked.issues.map((i) => tOr(t, `pvc.ri_${i}`, i)).join(", ") }));
    await save({ ...evidence, rules: checked.rules as RuleSet });
  }

  const bandEditor = (label: string, rows: BandDraft[], set: (b: BandDraft[]) => void, prefix: string) => (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-slate-800">{label}</legend>
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          {(["from", "to", "pct"] as const).map((k) => (
            <div key={k} className="space-y-1">
              <label htmlFor={`${prefix}-${i}-${k}`} className="block text-sm text-slate-600">{t(`pvc.r_${k}`)}</label>
              <Input id={`${prefix}-${i}-${k}`} inputMode="decimal" value={row[k]}
                onChange={(e) => set(rows.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                className="h-11 w-24 border-slate-200 bg-white text-sm" />
            </div>
          ))}
          <Button type="button" variant="outline" className="min-h-11" onClick={() => set(rows.filter((_, j) => j !== i))}>
            {t("pvc.r_remove_band")}
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" className="min-h-11" onClick={() => set([...rows, { from: "", to: "", pct: "" }])}>
        {t("pvc.r_add_band")}
      </Button>
    </fieldset>
  );

  const est = v.values.surrender_estimate;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{t("pvc.rules_intro")}</p>
      {!supported ? (
        <p className="text-sm font-semibold text-slate-700">{t("pvc.r_needs_shape")}</p>
      ) : (
        <>
          <div className="space-y-1">
            <label htmlFor="pv-r-acq" className="block text-sm font-semibold text-slate-800">{t("pvc.r_acquired")}</label>
            <Input id="pv-r-acq" inputMode="numeric" value={acq} onChange={(e) => setAcq(e.target.value)} className="h-11 w-24 border-slate-200 bg-white text-sm" />
          </div>
          {bandEditor(t("pvc.r_gsv"), gsv, setGsv, "pv-gsv")}
          {bandEditor(t("pvc.r_ssv"), ssv, setSsv, "pv-ssv")}
          <div className="space-y-1">
            <label htmlFor="pv-r-sel" className="block text-sm font-semibold text-slate-800">{t("pvc.r_selection")}</label>
            <select id="pv-r-sel" value={selection} onChange={(e) => setSelection(e.target.value)}
              className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm">
              <option value="higher_of_gsv_ssv">{t("pvc.r_sel_higher")}</option>
              <option value="gsv_only">{t("pvc.r_sel_gsv")}</option>
              <option value="ssv_only">{t("pvc.r_sel_ssv")}</option>
            </select>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm text-slate-800">
            <input type="checkbox" checked={deduct} onChange={(e) => setDeduct(e.target.checked)} className="h-5 w-5" />
            {t("pvc.r_deduct")}
          </label>
          {error && <p className="text-sm font-semibold text-rose-700" role="alert">{error}</p>}
          {confirmSmall.length > 0 && (
            <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
              <p>{t("pvc.r_percent_confirm", { values: confirmSmall.join(", ") })}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="min-h-11" onClick={() => void onSave(true)}>{t("pvc.r_percent_keep")}</Button>
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setConfirmSmall([])}>{t("pvc.r_percent_fix")}</Button>
              </div>
            </div>
          )}
          <Button type="button" disabled={saving} onClick={() => void onSave(false)} className="min-h-11 bg-[#0D9488] hover:bg-[#0f766e]">
            {t("pvc.r_save")}
          </Button>
        </>
      )}

      {r && (
        <div className="space-y-2 rounded-xl border border-dashed border-slate-300 p-4">
          <div className="text-base font-bold text-slate-900">{t("pvc.est_title")}</div>
          <p className="text-sm text-slate-700">{t("pvc.est_note")}</p>
          <div className="text-xl font-bold tabular-nums text-slate-700">
            {est.amount !== null ? rupees(est.amount) : t("pvc.not_available")}
          </div>
          {est.missing.map((m) => <p key={m} className="text-sm text-slate-600">· {tOr(t, `pvr.${m}`, REASON_TEXT[m])}</p>)}
          {v.illustration && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <caption className="sr-only">{t("pvc.est_title")}</caption>
                <thead>
                  <tr className="text-left text-slate-600">
                    <th className="py-1 pr-4 font-semibold">{t("pvc.ill_year")}</th>
                    <th className="py-1 pr-4 font-semibold">{t("pvc.ill_premiums")}</th>
                    <th className="py-1 font-semibold">{t("pvc.ill_estimate")}</th>
                  </tr>
                </thead>
                <tbody>
                  {v.illustration.map((row) => (
                    <tr key={row.year} className={"border-t border-slate-100 " + (row.year === v.policyYear ? "font-bold" : "")}>
                      <td className="py-1 pr-4">{row.year}</td>
                      <td className="py-1 pr-4">{rupees(row.premiumsIfPaid)}</td>
                      <td className="py-1">{row.estimate === null ? "" : rupees(row.estimate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {evidence.rules?.review.on && <p className="text-sm text-slate-500">{t("pvc.est_entered_on", { date: prettyIso(evidence.rules.review.on) })}</p>}
        </div>
      )}
    </div>
  );
}

export type { Shape };
