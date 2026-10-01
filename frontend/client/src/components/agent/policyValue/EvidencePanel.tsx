/**
 * Where the advisor records what they know about one policy.
 *
 * Every entry is labelled as theirs. "From an insurer document" is a choice
 * they make, and the screen still says it is their copy. Nothing here is ever
 * edited in place: a removal is a new entry that supersedes the old one, and
 * the history shows both.
 */

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";
import { parseIsoDate, parseRupees, valuationDateIso } from "@/lib/policyNumbers";
import {
  addLoan, addPayment, addQuote, activeRecords, voidRecord,
  type Confirmation, type QuotedStatus, type ShapeChoiceValue, type ValueEvidence,
} from "@/lib/policyEvidence";
import { DECISION_FIELDS, scheduledDueDates, type PolicyValuation } from "@/lib/policyValue";
import { prettyIso, rupees } from "@/lib/policyValueText";

interface Props {
  data: Record<string, any>;
  evidence: ValueEvidence;
  v: PolicyValuation;
  saving: boolean;
  save: (ev: ValueEvidence) => Promise<boolean>;
}

const SHAPES: ShapeChoiceValue[] = ["endowment", "money_back", "return_of_premium", "pure_term", "unit_linked", "other"];

function Field({ id, label, children, error }: { id: string; label: string; children: React.ReactNode; error?: string | null }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700">{label}</label>
      {children}
      {error && <p className="text-sm font-semibold text-rose-700" role="alert">{error}</p>}
    </div>
  );
}

function SourceSelect({ id, value, onChange }: { id: string; value: Confirmation; onChange: (c: Confirmation) => void }) {
  const { t } = useLanguage();
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as Confirmation)}
      className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
      <option value="self_reported">{t("pvc.src_self")}</option>
      <option value="insurer_document">{t("pvc.src_insurer")}</option>
    </select>
  );
}

const inputCls = "h-11 border-slate-200 bg-white text-sm";

export function EvidencePanel({ data, evidence, v, saving, save }: Props) {
  const { t } = useLanguage();
  const today = valuationDateIso();

  /* Plan type */
  const shapeSource = v.shape.source ? t(`pvc.src_${v.shape.source}`) : "";

  /* Details check: the decision fields on file, as they are now. */
  const onFile = DECISION_FIELDS.filter((k) => data[k] !== null && data[k] !== undefined && data[k] !== "");
  const confirmCheck = () => {
    const fields: Record<string, string | number | null> = {};
    for (const k of onFile) fields[k] = data[k];
    void save({ ...evidence, inputCheck: { checkedOn: today, fields } });
  };

  /* Payment form. Due dates offered from the schedule, so a record matches one. */
  const dueOptions = useMemo(() => {
    const ppt = Number(data.premium_paying_term_years || data.policy_term_years);
    const start = parseIsoDate(data.start_date);
    const f = String(data.premium_frequency ?? "").toLowerCase();
    const per = /single/.test(f) ? "single" : /month/.test(f) ? 12 : /quarter/.test(f) ? 4 : /half|semi/.test(f) ? 2 : /annual|year/.test(f) ? 1 : null;
    if (!start.ok || per === null || !Number.isInteger(ppt)) return [];
    return scheduledDueDates(start.value, per as any, ppt).filter((d) => d <= today).reverse();
  }, [data, today]);
  const [pay, setPay] = useState({ due: "", amount: String(data.premium ?? ""), paidOn: today, src: "self_reported" as Confirmation, ref: "" });
  const [payErr, setPayErr] = useState<string | null>(null);
  const savePayment = async () => {
    const amt = parseRupees(pay.amount);
    const due = parseIsoDate(pay.due);
    const on = parseIsoDate(pay.paidOn);
    if (!amt.ok || amt.value <= 0) return setPayErr(t("pvc.err_amount"));
    if (!due.ok || !on.ok) return setPayErr(t("pvc.err_date"));
    setPayErr(null);
    const ok = await save(addPayment(evidence, {
      amount: amt.value, currency: "INR", dueDate: due.value, paidOn: on.value,
      confirmation: pay.src, reference: pay.ref.trim() || null, note: null,
    }, today));
    if (ok) setPay((p) => ({ ...p, due: "", ref: "" }));
  };

  /* Premiums paid up to a date (one entry instead of one per instalment). */
  const [paidTo, setPaidTo] = useState({ to: "", stmt: today, src: "insurer_document" as Confirmation, ref: "" });
  const [paidToErr, setPaidToErr] = useState<string | null>(null);
  const savePaidTo = async () => {
    const to = parseIsoDate(paidTo.to);
    const st = parseIsoDate(paidTo.stmt);
    if (!to.ok || !st.ok || to.value > st.value) return setPaidToErr(t("pvc.err_paid_to"));
    setPaidToErr(null);
    await save(addQuote(evidence, {
      quoteType: "premiums_paid_to", amount: null, status: null, paidTo: to.value, quoteDate: st.value,
      confirmation: paidTo.src, reference: paidTo.ref.trim() || null, note: null,
    }, today));
  };

  /* Loan position. Blank interest means not known, never zero. */
  const [loan, setLoan] = useState({ has: "none" as "none" | "outstanding", principal: "", interest: "", asOf: today, src: "self_reported" as Confirmation, ref: "" });
  const [loanErr, setLoanErr] = useState<string | null>(null);
  const saveLoan = async () => {
    const as = parseIsoDate(loan.asOf);
    if (!as.ok) return setLoanErr(t("pvc.err_date"));
    if (loan.has === "none") {
      setLoanErr(null);
      return void save(addLoan(evidence, { status: "none", principal: 0, interest: 0, asOf: as.value, confirmation: loan.src, reference: loan.ref.trim() || null, note: null }, today));
    }
    const p = parseRupees(loan.principal);
    const i = loan.interest.trim() === "" ? null : parseRupees(loan.interest);
    if (!p.ok || p.value <= 0 || (i !== null && !i.ok)) return setLoanErr(t("pvc.err_amount"));
    setLoanErr(null);
    await save(addLoan(evidence, {
      status: "outstanding", principal: p.value, interest: i && i.ok ? i.value : null, asOf: as.value,
      confirmation: loan.src, reference: loan.ref.trim() || null, note: null,
    }, today));
  };

  /* A figure from the insurer: surrender payable, loan available, or status. */
  const [q, setQ] = useState({ type: "surrender_payable" as "surrender_payable" | "loan_available" | "policy_status", amount: "", status: "in_force" as QuotedStatus, date: today, src: "insurer_document" as Confirmation, ref: "" });
  const [qErr, setQErr] = useState<string | null>(null);
  const saveQuote = async () => {
    const d = parseIsoDate(q.date);
    if (!d.ok || d.value > today) return setQErr(t("pvc.err_date"));
    if (q.type === "policy_status") {
      setQErr(null);
      return void save(addQuote(evidence, { quoteType: "policy_status", amount: null, status: q.status, paidTo: null, quoteDate: d.value, confirmation: q.src, reference: q.ref.trim() || null, note: null }, today));
    }
    const a = parseRupees(q.amount);
    if (!a.ok) return setQErr(t("pvc.err_amount"));
    setQErr(null);
    await save(addQuote(evidence, { quoteType: q.type, amount: a.value, status: null, paidTo: null, quoteDate: d.value, confirmation: q.src, reference: q.ref.trim() || null, note: null }, today));
  };

  /* History: every record, newest first, with what replaced or removed it. */
  const history = useMemo(() => {
    const all = [
      ...evidence.payments.map((r) => ({ key: "payments" as const, r })),
      ...evidence.loans.map((r) => ({ key: "loans" as const, r })),
      ...evidence.quotes.map((r) => ({ key: "quotes" as const, r })),
    ];
    const active = new Set([
      ...activeRecords(evidence.payments), ...activeRecords(evidence.loans), ...activeRecords(evidence.quotes),
    ].map((r) => r.id));
    return all.filter((x) => !x.r.voided).reverse().map((x) => ({ ...x, active: active.has(x.r.id) }));
  }, [evidence]);

  const srcWord = (c: Confirmation) => (c === "insurer_document" ? t("pvc.src_insurer_short") : t("pvc.src_self_short"));
  const describe = (x: (typeof history)[number]) => {
    const r: any = x.r;
    if (x.key === "payments") return t("pvc.rec_payment", { amount: rupees(r.amount), due: prettyIso(r.dueDate), source: srcWord(r.confirmation) });
    if (x.key === "loans") return r.status === "none"
      ? t("pvc.rec_loan_none", { date: prettyIso(r.asOf) })
      : t("pvc.rec_loan", { principal: rupees(r.principal), interest: r.interest === null ? t("pvc.interest_unknown") : rupees(r.interest), date: prettyIso(r.asOf) });
    if (r.quoteType === "premiums_paid_to") return t("pvc.rec_paidto", { date: prettyIso(r.paidTo), stmt: prettyIso(r.quoteDate) });
    if (r.quoteType === "policy_status") return t("pvc.rec_status", { status: t(`pvc.status_${r.status}`), date: prettyIso(r.quoteDate) });
    return t("pvc.rec_quote", { type: t(r.quoteType === "loan_available" ? "pvc.q_loan" : "pvc.q_surrender"), value: rupees(r.amount), date: prettyIso(r.quoteDate) });
  };

  const section = "space-y-3 rounded-xl border border-slate-200 p-4";
  const h = "text-base font-bold text-slate-900";

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{t("pvc.ev_intro")}</p>

      <div className={section}>
        <div className={h}>{t("pvc.plan_title")}</div>
        <p className="text-sm text-slate-600">
          {v.shape.status === "accepted" && v.shape.value ? t("pvc.plan_is", { shape: t(`pvc.shape_${v.shape.value}`), source: shapeSource })
            : v.shape.status === "candidate" && v.shape.candidate ? t("pvc.plan_guess", { shape: t(`pvc.shape_${v.shape.candidate}`), source: shapeSource })
            : v.shape.status === "unsupported" ? t("pvc.plan_unsupported")
            : t("pvc.plan_unknown")}
        </p>
        <div className="flex flex-wrap gap-2">
          {SHAPES.map((s) => (
            <button key={s} type="button" disabled={saving}
              onClick={() => void save({ ...evidence, shape: { value: s, enteredOn: today } })}
              className={"min-h-11 rounded-full border px-4 py-1.5 text-sm font-semibold disabled:opacity-50 " +
                (evidence.shape?.value === s ? "border-[#0D9488] bg-[#0D9488] text-white" : "border-slate-200 bg-white text-slate-700 hover:border-[#0D9488]")}>
              {t(`pvc.shape_${s}`)}
            </button>
          ))}
        </div>
      </div>

      <div className={section}>
        <div className={h}>{t("pvc.check_title")}</div>
        {onFile.length === 0 ? (
          <p className="text-sm text-slate-600">{t("pvc.check_empty")}</p>
        ) : (
          <>
            <p className="text-sm text-slate-600">{t("pvc.check_body")}</p>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2" data-mp-block>
              {onFile.map((k) => (
                <div key={k} className="flex justify-between gap-3 border-b border-slate-100 py-1 text-sm">
                  <dt className="text-slate-600">{t(`pvc.fld_${k}`)}</dt>
                  <dd className="font-semibold text-slate-900">{String(data[k])}</dd>
                </div>
              ))}
            </dl>
            {v.inputsChecked && evidence.inputCheck ? (
              <p className="text-sm font-semibold text-[#0f766e]">{t("pvc.check_done", { date: prettyIso(evidence.inputCheck.checkedOn) })}</p>
            ) : evidence.inputCheck ? (
              <p className="text-sm font-semibold text-amber-800">{t("pvc.check_stale")}</p>
            ) : null}
            <Button type="button" variant="outline" disabled={saving} onClick={confirmCheck} className="min-h-11">
              {t("pvc.check_btn")}
            </Button>
          </>
        )}
      </div>

      <div className={section}>
        <div className={h}>{t("pvc.pay_form_title")}</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="pv-pay-due" label={t("pvc.f_due")}>
            {dueOptions.length ? (
              <select id="pv-pay-due" value={pay.due} onChange={(e) => setPay({ ...pay, due: e.target.value })}
                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="">{t("pvc.f_due_pick")}</option>
                {dueOptions.map((d) => <option key={d} value={d}>{prettyIso(d)}</option>)}
              </select>
            ) : (
              <Input id="pv-pay-due" type="date" value={pay.due} onChange={(e) => setPay({ ...pay, due: e.target.value })} className={inputCls} />
            )}
          </Field>
          <Field id="pv-pay-amount" label={t("pvc.f_amount")}>
            <Input id="pv-pay-amount" inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} className={inputCls} />
          </Field>
          <Field id="pv-pay-on" label={t("pvc.f_paid_on")}>
            <Input id="pv-pay-on" type="date" value={pay.paidOn} max={today} onChange={(e) => setPay({ ...pay, paidOn: e.target.value })} className={inputCls} />
          </Field>
          <Field id="pv-pay-src" label={t("pvc.f_source")}>
            <SourceSelect id="pv-pay-src" value={pay.src} onChange={(c) => setPay({ ...pay, src: c })} />
          </Field>
          <Field id="pv-pay-ref" label={t("pvc.f_reference")}>
            <Input id="pv-pay-ref" value={pay.ref} onChange={(e) => setPay({ ...pay, ref: e.target.value })} className={inputCls} />
          </Field>
        </div>
        {payErr && <p className="text-sm font-semibold text-rose-700" role="alert">{payErr}</p>}
        <Button type="button" disabled={saving} onClick={() => void savePayment()} className="min-h-11 bg-[#0D9488] hover:bg-[#0f766e]">{t("pvc.btn_save")}</Button>

        <div className="border-t border-slate-100 pt-3">
          <div className="text-sm font-bold text-slate-800">{t("pvc.paidto_title")}</div>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="pv-pt-to" label={t("pvc.f_paid_to")}>
              <Input id="pv-pt-to" type="date" value={paidTo.to} max={today} onChange={(e) => setPaidTo({ ...paidTo, to: e.target.value })} className={inputCls} />
            </Field>
            <Field id="pv-pt-stmt" label={t("pvc.f_statement_date")}>
              <Input id="pv-pt-stmt" type="date" value={paidTo.stmt} max={today} onChange={(e) => setPaidTo({ ...paidTo, stmt: e.target.value })} className={inputCls} />
            </Field>
            <Field id="pv-pt-src" label={t("pvc.f_source")}>
              <SourceSelect id="pv-pt-src" value={paidTo.src} onChange={(c) => setPaidTo({ ...paidTo, src: c })} />
            </Field>
            <Field id="pv-pt-ref" label={t("pvc.f_reference")}>
              <Input id="pv-pt-ref" value={paidTo.ref} onChange={(e) => setPaidTo({ ...paidTo, ref: e.target.value })} className={inputCls} />
            </Field>
          </div>
          {paidToErr && <p className="mt-2 text-sm font-semibold text-rose-700" role="alert">{paidToErr}</p>}
          <Button type="button" variant="outline" disabled={saving} onClick={() => void savePaidTo()} className="mt-3 min-h-11">{t("pvc.btn_save")}</Button>
        </div>
      </div>

      <div className={section}>
        <div className={h}>{t("pvc.loan_title")}</div>
        <div className="flex flex-wrap gap-4 text-sm">
          {(["none", "outstanding"] as const).map((k) => (
            <label key={k} className="flex min-h-11 items-center gap-2">
              <input type="radio" name="pv-loan-has" checked={loan.has === k} onChange={() => setLoan({ ...loan, has: k })} className="h-5 w-5" />
              {k === "none" ? t("pvc.loan_none") : t("pvc.loan_has")}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {loan.has === "outstanding" && (
            <>
              <Field id="pv-loan-p" label={t("pvc.f_principal")}>
                <Input id="pv-loan-p" inputMode="decimal" value={loan.principal} onChange={(e) => setLoan({ ...loan, principal: e.target.value })} className={inputCls} />
              </Field>
              <Field id="pv-loan-i" label={t("pvc.f_interest")}>
                <Input id="pv-loan-i" inputMode="decimal" value={loan.interest} onChange={(e) => setLoan({ ...loan, interest: e.target.value })} className={inputCls} />
              </Field>
            </>
          )}
          <Field id="pv-loan-as" label={t("pvc.f_as_of")}>
            <Input id="pv-loan-as" type="date" value={loan.asOf} max={today} onChange={(e) => setLoan({ ...loan, asOf: e.target.value })} className={inputCls} />
          </Field>
          <Field id="pv-loan-src" label={t("pvc.f_source")}>
            <SourceSelect id="pv-loan-src" value={loan.src} onChange={(c) => setLoan({ ...loan, src: c })} />
          </Field>
        </div>
        {loanErr && <p className="text-sm font-semibold text-rose-700" role="alert">{loanErr}</p>}
        <Button type="button" variant="outline" disabled={saving} onClick={() => void saveLoan()} className="min-h-11">{t("pvc.btn_save")}</Button>
      </div>

      <div className={section}>
        <div className={h}>{t("pvc.quote_title")}</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="pv-q-type" label={t("pvc.f_quote_type")}>
            <select id="pv-q-type" value={q.type} onChange={(e) => setQ({ ...q, type: e.target.value as any })}
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
              <option value="surrender_payable">{t("pvc.q_surrender")}</option>
              <option value="loan_available">{t("pvc.q_loan")}</option>
              <option value="policy_status">{t("pvc.q_status")}</option>
            </select>
          </Field>
          {q.type === "policy_status" ? (
            <Field id="pv-q-status" label={t("pvc.q_status")}>
              <select id="pv-q-status" value={q.status} onChange={(e) => setQ({ ...q, status: e.target.value as QuotedStatus })}
                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                {(["in_force", "lapsed", "paid_up", "surrendered", "matured"] as QuotedStatus[]).map((s) => <option key={s} value={s}>{t(`pvc.status_${s}`)}</option>)}
              </select>
            </Field>
          ) : (
            <Field id="pv-q-amount" label={t("pvc.f_amount_quoted")}>
              <Input id="pv-q-amount" inputMode="decimal" value={q.amount} onChange={(e) => setQ({ ...q, amount: e.target.value })} className={inputCls} />
            </Field>
          )}
          <Field id="pv-q-date" label={t("pvc.f_quote_date")}>
            <Input id="pv-q-date" type="date" value={q.date} max={today} onChange={(e) => setQ({ ...q, date: e.target.value })} className={inputCls} />
          </Field>
          <Field id="pv-q-src" label={t("pvc.f_source")}>
            <SourceSelect id="pv-q-src" value={q.src} onChange={(c) => setQ({ ...q, src: c })} />
          </Field>
          <Field id="pv-q-ref" label={t("pvc.f_reference")}>
            <Input id="pv-q-ref" value={q.ref} onChange={(e) => setQ({ ...q, ref: e.target.value })} className={inputCls} />
          </Field>
        </div>
        {qErr && <p className="text-sm font-semibold text-rose-700" role="alert">{qErr}</p>}
        <Button type="button" variant="outline" disabled={saving} onClick={() => void saveQuote()} className="min-h-11">{t("pvc.btn_save")}</Button>
      </div>

      {history.length > 0 && (
        <div className={section}>
          <div className={h}>{t("pvc.records_title")}</div>
          <ul className="space-y-2" data-mp-block>
            {history.map((x) => (
              <li key={x.r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-sm">
                <span className={x.active ? "text-slate-800" : "text-slate-500 line-through"}>
                  {describe(x)}
                  {x.r.reference ? ` · ${x.r.reference}` : ""}
                  <span className="ml-2 text-slate-500 no-underline">{t("pvc.rec_entered", { date: prettyIso(x.r.enteredOn) })}</span>
                </span>
                {x.active ? (
                  <Button type="button" variant="outline" disabled={saving} className="min-h-11"
                    onClick={() => void save(voidRecord(evidence, x.key, x.r.id, today, null))}>
                    {t("pvc.btn_remove")}
                  </Button>
                ) : (
                  <span className="text-sm text-slate-500">{t("pvc.rec_replaced")}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
