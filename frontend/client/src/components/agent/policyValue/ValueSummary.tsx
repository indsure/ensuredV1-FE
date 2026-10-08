/**
 * The figures for one policy, each with what it is based on.
 *
 * A tile shows a rupee amount as money the customer can get only for a dated
 * insurer quote or a calculation from checked product terms. A figure printed
 * on the document (a maturity amount, a fund value) is shown with its date and
 * how far it was checked, and never called a guarantee. Missing information is
 * listed in words, never shown as zero.
 */

import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";
import type { PolicyValuation, Reason, ValueResult } from "@/lib/policyValue";
import { formatRupees, type Paise } from "@/lib/exactMath";
import { BASIS_TEXT, REASON_TEXT, VERIFICATION_TEXT, prettyIso, rupees } from "@/lib/policyValueText";

const CASH = new Set(["insurer_quote", "document_calculation"]);

export function useReasonText() {
  const { t } = useLanguage();
  return (r: Reason) => tOr(t, `pvr.${r}`, REASON_TEXT[r]);
}

/** What the policy document panel adds: a GSV from confirmed terms, and whether the plan has no maturity benefit. */
export interface DocSummary {
  gsv: Paise | null;
  termsPending: boolean;
  noMaturity: boolean;
}

function Tile({ label, v, cash, extra, hide, headline }: { label: string; v: ValueResult; cash: boolean; extra?: React.ReactNode; hide?: Reason[]; headline?: string }) {
  const { t } = useLanguage();
  const reasonText = useReasonText();
  const show = v.amount !== null && (!cash || CASH.has(v.basis)) && v.asOf !== null;
  const tone = v.basis === "insurer_quote" ? "text-blue-800" : v.basis === "document_calculation" ? "text-[#0f766e]" : "text-slate-900";
  const reasons = [...v.missing, ...v.conditions.filter((c) => c !== "confirm_with_insurer")].filter((r) => !hide?.includes(r));
  return (
    <div className="space-y-1 rounded-xl border border-slate-200 p-4">
      <div className="text-sm font-bold text-slate-600">{label}</div>
      <div className={"text-2xl font-bold tabular-nums " + (show ? tone : headline ? "text-[#0f766e]" : "text-slate-500")}>
        {show ? rupees(v.amount!) : headline ?? (v.basis === "not_applicable" ? t("pvc.not_applicable") : t("pvc.not_available"))}
      </div>
      {v.basis !== "insufficient" && v.basis !== "not_applicable" && (
        <div className="text-sm font-semibold text-slate-700">
          {tOr(t, `pvb.${v.basis}`, BASIS_TEXT[v.basis])}
          {show && v.verification !== "none" ? ` · ${tOr(t, `pvv.${v.verification}`, VERIFICATION_TEXT[v.verification])}` : ""}
        </div>
      )}
      {show && v.asOf && <div className="text-sm text-slate-600">{t(v.key === "maturity_guaranteed" ? "pvc.due_on" : "pvc.as_of", { date: prettyIso(v.asOf) })}</div>}
      {extra}
      {reasons.length > 0 && (
        <ul className="space-y-0.5 pt-1">
          {reasons.slice(0, 4).map((r) => (
            <li key={r} className="text-sm text-slate-600">· {reasonText(r)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ValueSummary({ v, doc }: { v: PolicyValuation; doc?: DocSummary | null }) {
  const { t } = useLanguage();
  const reasonText = useReasonText();
  const sp = v.values.surrender_payable;
  const gross = v.values.surrender_gross;
  const p = v.payment;
  const c = v.nextAnniversary;

  // The product's checked factor table is not the only source any more: terms
  // read from this policy's own document, once the advisor confirms them, give
  // the guaranteed surrender value. It is a floor, never the amount payable.
  const spShown = sp.amount !== null && CASH.has(sp.basis);
  const docGsv = doc && !spShown && doc.gsv && doc.gsv.paise > 0 ? doc.gsv : null;
  const hideNoRules: Reason[] | undefined = doc ? ["no_verified_rules"] : undefined;
  const docSurrender = doc && !spShown ? (
    docGsv ? (
      <div className="space-y-1 pt-1">
        <div className="text-sm text-slate-700">{t("pvc.doc_gsv_note")}</div>
        {v.loan.state !== "none" && <div className="text-sm text-slate-700">{t("pvc.doc_gsv_before_loan")}</div>}
      </div>
    ) : doc.termsPending ? (
      <div className="pt-1 text-sm text-slate-700">{t("pvc.doc_terms_pending")}</div>
    ) : null
  ) : null;

  const surrenderExtra = (
    <>
      {sp.basis === "document_calculation" && gross.amount !== null && v.loan.state === "outstanding" && (
        <div className="text-sm text-slate-700">
          {t("pvc.k_gross", { amount: rupees(gross.amount) })}
          {" · "}
          {t("pvc.k_loan_taken", {
            principal: rupees(v.loan.principal ?? 0),
            interest: v.loan.interest === null ? t("pvc.interest_unknown") : rupees(v.loan.interest),
          })}
        </div>
      )}
      {sp.upperBound !== null && (
        <div className="text-sm font-semibold text-slate-700">{t("pvc.at_most", { amount: rupees(sp.upperBound) })}</div>
      )}
      {sp.shortfall !== null && <div className="text-sm font-semibold text-rose-800">{t("pvc.k_shortfall", { amount: rupees(sp.shortfall) })}</div>}
      {docSurrender}
    </>
  );

  const statusWord = (s: string | null) => (s ? t(`pvc.status_${s}`) : "");
  const payMsg =
    p.state === "date_passed" ? t("pvc.pay_date_passed", { date: prettyIso(p.lastDuePassed) })
    : p.state === "recorded_gap" ? t("pvc.pay_gap", { date: prettyIso(p.firstUncoveredDue) })
    : p.state === "recorded_up_to_date" ? t("pvc.pay_up_to_date")
    : p.state === "insurer_status" ? t("pvc.pay_insurer", { date: prettyIso(p.statusDate), status: statusWord(p.insurerStatus) })
    : p.state === "schedule_unknown" ? t("pvc.pay_schedule_unknown")
    : t("pvc.pay_needs_checking");
  const payTone = p.upToDate ? "border-[#0D9488]/30 bg-[#0D9488]/5 text-[#0f766e]" : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <div className="space-y-4" data-mp-block>
      <div className={"rounded-xl border p-4 text-sm " + payTone}>
        <div className="font-bold">{t("pvc.pay_title")}</div>
        <div className="mt-1">{payMsg}</div>
        {p.totalInstalments !== null && (
          <div className="mt-1 text-slate-700">
            {t("pvc.pay_counts", { due: p.dueInstalments, covered: p.coveredInstalments })}
            {p.confirmation === "self_reported" ? ` ${reasonText("payments_self_reported")}` : ""}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Tile label={t("pvc.k_surrender")} v={sp} cash extra={surrenderExtra} hide={hideNoRules}
          headline={docGsv ? t("pvc.doc_gsv_at_least", { amount: formatRupees(docGsv) }) : undefined} />
        <Tile label={t("pvc.k_borrow")} v={v.values.loan_remaining} cash hide={hideNoRules}
          extra={doc && !spShown ? <div className="pt-1 text-sm text-slate-700">{t("pvc.doc_loan_needs_quote")}</div> : undefined} />
        {doc?.noMaturity && v.values.maturity_guaranteed.amount === null ? (
          <Tile label={t("pvc.k_maturity")} v={{ ...v.values.maturity_guaranteed, basis: "not_applicable", missing: [], conditions: [] }} cash={false}
            extra={<div className="text-sm text-slate-700">{t("pvc.doc_no_maturity")}</div>} />
        ) : (
          <Tile label={t("pvc.k_maturity")} v={v.values.maturity_guaranteed} cash={false} />
        )}
        {v.shape.value === "unit_linked" ? (
          <Tile label={t("pvc.k_fund")} v={v.values.fund_value} cash={false} />
        ) : v.values.vested_bonus.amount !== null || v.values.vested_bonus.missing.length ? (
          <Tile label={t("pvc.k_vested")} v={v.values.vested_bonus} cash={false} />
        ) : null}
      </div>

      {c.available && c.difference !== null && c.requiredPremiums !== null && c.nextAnniversary && (
        <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-800">
          <div className="font-bold">{t("pvc.next_title", { date: prettyIso(c.nextAnniversary) })}</div>
          <div className="mt-1">
            {t("pvc.next_body", {
              premiums: rupees(c.requiredPremiums),
              diff: (c.difference < 0 ? "−" : "+") + rupees(Math.abs(c.difference)),
            })}
          </div>
          {c.payoutsBetween ? <div className="mt-1 text-slate-600">{t("pvc.next_payouts", { amount: rupees(c.payoutsBetween) })}</div> : null}
        </div>
      )}

      <p className="text-sm font-semibold text-slate-700">{reasonText("confirm_with_insurer")}</p>
    </div>
  );
}
