/**
 * Policy terms read from the policy document (no model), for the advisor to
 * review field by field.
 *
 * Nothing here is labelled "verified". Each value says it came from the
 * document and is pending review until the advisor confirms, corrects or
 * rejects that exact revision. Results below only appear once everything
 * they depend on is confirmed, and say plainly why when they are not.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";
import { toast } from "@/hooks/use-toast";
import { describe as describeExpr, formatRupees, isExpr, type Paise } from "@/lib/exactMath";
import { DOC_REASON_TEXT } from "@/lib/documentRules";
import type { FieldKey, ReviewFlag } from "@/lib/policyDocTypes";
import { parseIsoDate, parseRupees, parseWholeNumber } from "@/lib/policyNumbers";
import { prettyIso } from "@/lib/policyValueText";
import { DOC_RULES_CHANGED, docApi as api, docResults, type FactRow, type RulesResponse } from "./useDocumentRules";

const GROUPS: { id: string; prefixes: string[] }[] = [
  { id: "surrender", prefixes: ["surrender.", "discount_rate."] },
  { id: "loans", prefixes: ["loan."] },
  { id: "status", prefixes: ["status.", "revival.", "grace."] },
  { id: "benefits", prefixes: ["benefits.", "schedule.", "identity.", "definitions.", "options."] },
];

/** English labels; Hindi comes from hi.json pdt.f_<key>. */
const FIELD_LABEL: Partial<Record<FieldKey, string>> = {
  "identity.insurer": "Insurer", "identity.plan": "Plan", "identity.uin": "UIN", "identity.option": "Plan option",
  "identity.benefit_choice": "Benefit choice", "identity.linked": "Linked or not", "identity.participating": "Participating or not",
  "schedule.currency": "Currency", "schedule.annualized_premium": "Annualized premium", "schedule.instalment_premium_first_year": "Premium per instalment, first year",
  "schedule.instalment_premium_renewal": "Premium per instalment, later years", "schedule.extra_premium": "Underwriting extra premium",
  "schedule.premium_excludes_taxes": "Premiums exclude taxes", "schedule.policy_term_years": "Policy term (years)", "schedule.premium_paying_term_years": "Premium paying term (years)",
  "schedule.frequency": "Premium frequency", "schedule.commencement_date": "Date of commencement of policy", "schedule.risk_commencement_date": "Date of risk commencement",
  "schedule.premium_due_day_month": "Premium due date each year", "schedule.final_premium_due_date": "Final premium due date", "schedule.policy_end_date": "Policy end date (printed as maturity date)",
  "schedule.grace_days": "Grace period (schedule)", "schedule.sum_assured_on_death": "Sum assured on death", "schedule.juvenile_ci_sum_assured": "Juvenile critical illness cover",
  "schedule.deferral_selected": "Survival benefit deferral chosen", "schedule.premium_offset_selected": "Premium offset chosen",
  "benefits.survival_recurring": "Survival benefit, monthly", "benefits.survival_terminal": "Survival benefit, final", "benefits.maturity": "Maturity benefit", "benefits.income": "Income benefit",
  "definitions.policy_anniversary_anchor": "Policy anniversary is counted from", "definitions.total_premiums_paid_excludes": "Total premiums paid excludes", "definitions.annualized_premium_excludes": "Annualized premium excludes",
  "grace.rule": "Grace period rule", "surrender.selection": "Surrender benefit", "surrender.gsv_acquisition_min_premium_years": "GSV starts after premiums for (years)",
  "surrender.gsv_formula": "GSV formula", "surrender.gsv_factor_bands": "GSV factors by policy year", "surrender.ssv_basis": "SSV basis", "surrender.ssv_reference_tenor": "SSV reference bond",
  "surrender.ssv_discount_rule": "SSV discount rate rule", "surrender.ssv_printed_rate": "SSV rate printed in the document", "discount_rate.general_rule": "Other discount rate rule",
  "status.lapse_without_gsv": "Unpaid premium, no GSV yet", "status.lapse_with_gsv": "Unpaid premium, GSV acquired", "status.paid_up_formula": "Paid-up value formula",
  "revival.window": "Revival window", "revival.conditions": "Revival conditions", "revival.printed_rate": "Revival interest printed in the document", "revival.rate_rule": "Revival interest rule",
  "loan.cap_pct_of_surrender_value": "Loan limit", "loan.deduction_before_benefits": "Loan deducted before benefits", "loan.foreclosure": "Foreclosure condition",
  "loan.foreclosure_exemption": "Foreclosure exemption", "loan.rate_fixed_for_term_clause": "Clause: rate fixed for the term", "loan.rate_revised_until_next_revision_clause": "Clause: revised rate applies until next revision",
  "loan.rate_rule": "Loan interest rule", "loan.printed_rate": "Loan interest printed in the document", "loan.msme_concessions": "MSME interest reductions",
  "surrender.gsv_factor_table": "GSV factor for each policy year", "surrender.payout_deduction": "Payouts GSV takes off",
  "death.min_pct_of_premiums_paid": "Death cover is at least this share of premiums paid",
  "options.deferral_available": "Deferral option exists in the product", "options.premium_offset_available": "Premium offset option exists in the product",
};

const isPaise = (v: any): v is Paise => v && typeof v === "object" && Number.isSafeInteger(v.paise) && Object.keys(v).length === 1;
const bps = (v: any) => v && typeof v.bps === "number" ? `${(v.bps / 100).toFixed(2).replace(/\.00$/, "")}%` : null;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ENUM_TEXT: Record<string, string> = {
  higher_of_gsv_ssv: "Higher of GSV and SSV",
  non_linked: "Non-linked",
  non_participating: "Non-participating",
  risk_commencement_date: "Date of risk commencement",
  policy_issue_date: "Policy issue date",
  paid_before_surrender_date: "Income already paid before the surrender date",
  lapsed_cover_ceases_no_benefits: "Policy lapses, cover ends, no benefits payable",
  paid_up: "Policy becomes paid-up",
  discounted_outstanding_survival_and_maturity_benefits: "Discounted value of outstanding survival and maturity benefits",
  annual: "Annual", half_yearly: "Half-yearly", quarterly: "Quarterly", monthly: "Monthly", single: "Single",
};

/** A field's value in plain words. Formulas are shown as written, never evaluated here. */
export function formatValue(key: string, v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" && ENUM_TEXT[v]) return ENUM_TEXT[v];
  if (isPaise(v)) return formatRupees(v);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string") return /^\d{4}-\d{2}-\d{2}$/.test(v) ? prettyIso(v) : v.replace(/_/g, " ");
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) {
    if (key === "surrender.gsv_factor_bands") {
      return v.map((b: any) => `${b.from === "term_minus_1" ? "term less 1" : b.from} to ${b.to === "term_minus_2" ? "term less 2" : b.to === "term" ? "term" : b.to}: ${isExpr(b.factor) ? describeExpr(b.factor) : b.raw}`).join("; ");
    }
    if (key === "surrender.gsv_factor_table") {
      // Runs of years with the same factor collapse: "1: 0%; 2: 30%; 4 to 7: 50%; ...".
      const out: string[] = [];
      for (let i = 0; i < v.length; ) {
        let j = i;
        while (j + 1 < v.length && v[j + 1].pct.bps === v[i].pct.bps) j++;
        const pct = `${(v[i].pct.bps / 100).toFixed(2).replace(/\.00$/, "")}%`;
        out.push(`${v[i].year}${j > i ? ` to ${v[j].year}` : ""}: ${pct}`);
        i = j + 1;
      }
      return "Year " + out.join("; ");
    }
    if (key === "loan.msme_concessions") return v.map((c: any) => `${c.who === "female" ? "female" : "other"} policyholders minus ${(c.reductionBps / 100).toFixed(1)}%`).join("; ");
    return v.join(", ");
  }
  if (isExpr(v)) return describeExpr(v);
  if (bps(v)) return bps(v)!;
  if (v.amount && v.from) return `${formatRupees(v.amount)} ${v.frequency ?? ""} from ${prettyIso(v.from)} to ${prettyIso(v.to)}`;
  if (v.amount && v.date) return `${formatRupees(v.amount)} on ${prettyIso(v.date)}`;
  if (typeof v.day === "number" && typeof v.month === "number") return `${v.day} ${MONTHS[v.month - 1]}`;
  if (typeof v.monthlyDays === "number") return `${v.monthlyDays} days for monthly premiums, ${v.otherDays} days for other frequencies`;
  if (v.base && v.spread) {
    const base = v.base === "annualized_yield_reference_gsec" ? "reference G-Sec yield" : "6-month average 10-year G-Sec yield";
    return v.roundBeforeSpread
      ? `${base}, rounded up to ${v.roundUpBps} bps, plus ${v.spread.bps} bps`
      : `${base} plus ${v.spread.bps} bps, rounded up to ${v.roundUpBps} bps`;
  }
  if (v.thresholdPctOfSurrenderValue) return `loan plus interest more than ${bps(v.thresholdPctOfSurrenderValue)} of the surrender value (not for in-force or fully paid-up policies)`;
  if (v.statuses) return `in-force and fully paid-up policies, on loan plus interest exceeding the surrender value`;
  if (typeof v.years === "number" && v.from) return `${v.years} years from the first unpaid premium, before the term ends`;
  if (typeof v.upToTermYears === "number") return `${v.tenorUpTo}-year G-Sec up to a ${v.upToTermYears}-year term, ${v.tenorAbove}-year above`;
  return JSON.stringify(v);
}

/** Which simple fields can be corrected in place, and how to read the advisor's text. */
function correctionReader(key: string): ((s: string) => unknown) | null {
  if (/^schedule\.(annualized_premium|instalment_premium_first_year|instalment_premium_renewal|extra_premium|sum_assured_on_death)$/.test(key)) {
    return (s) => { const p = parseRupees(s); return p.ok ? { paise: Math.round(p.value * 100) } : null; };
  }
  if (/_date$/.test(key)) return (s) => { const p = parseIsoDate(s); return p.ok ? p.value : null; };
  if (/_years$|grace_days$/.test(key)) return (s) => { const p = parseWholeNumber(s, { min: 1, max: 100 }); return p.ok ? p.value : null; };
  return null;
}

const key = () => (globalThis.crypto?.randomUUID?.() ?? `k${Date.now()}${Math.random().toString(36).slice(2)}`);

export default function DocumentTerms({ clientId, data }: { clientId: string; data: Record<string, any> }) {
  const { t } = useLanguage();
  const [rules, setRules] = useState<RulesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>("surrender");

  const load = useCallback(async () => {
    try {
      setError(null);
      setRules(await api(`/api/agent/clients/${clientId}/document-rules`));
    } catch {
      setError(t("pdt.load_failed"));
    }
  }, [clientId, t]);
  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      toast({ variant: "success", title: t("pdt.saved") });
    } catch (e: any) {
      toast({ variant: "destructive", title: e?.status === 409 ? t("pdt.stale") : t("pdt.save_failed"), description: e?.message ?? "" });
    } finally {
      setBusy(false);
      await load();
      window.dispatchEvent(new CustomEvent(DOC_RULES_CHANGED, { detail: clientId }));
    }
  };

  const results = useMemo(() => docResults(rules, data?.value_evidence), [rules, data]);

  const reason = (code: string) => {
    const base = code.split(":")[0];
    if (base === "fact_not_confirmed") return t("pdt.r_fact_not_confirmed", { field: tOr(t, `pdt.f_${code.split(":")[1].replace(/\./g, "_")}`, FIELD_LABEL[code.split(":")[1] as FieldKey] ?? code.split(":")[1]) });
    if (base === "flag_unresolved" || base === "flag_needs_insurer") return t(`pdt.r_${base}`);
    return tOr(t, `pdt.r_${base}`, DOC_REASON_TEXT[base] ?? base);
  };

  /** Many "needs review" reasons become one line: a count and the first few fields. */
  const summarise = (codes: string[]): string[] => {
    const need = codes.filter((c) => c.startsWith("fact_not_confirmed:"));
    const rest = codes.filter((c) => !c.startsWith("fact_not_confirmed:"));
    const out = rest.map(reason);
    if (need.length) {
      const names = need.slice(0, 3).map((c) => { const k = c.split(":")[1]; return tOr(t, `pdt.f_${k.replace(/\./g, "_")}`, FIELD_LABEL[k as FieldKey] ?? k); });
      out.unshift(t("pdt.r_needs_review_count", { count: need.length, fields: names.join(", ") + (need.length > 3 ? ", …" : "") }));
    }
    // Two flags can give the same sentence; show it once.
    return Array.from(new Set(out));
  };

  const p = rules?.parse;
  const pending = (rules?.fields ?? []).filter((f) => f.state === "document_pending" && f.document_field?.state === "found").length;

  return (
    <Card className="border-slate-100 shadow-sm" data-mp-block>
      <CardHeader className="border-b border-slate-50 pb-4">
        <CardTitle>{t("pdt.title")}</CardTitle>
        <p className="mt-1 text-sm text-slate-600">{t("pdt.intro")}</p>
      </CardHeader>
      <CardContent className="space-y-5 p-6">
        {error && <p className="text-sm font-semibold text-rose-700" role="alert">{error}</p>}
        {!error && rules && !p && <p className="text-sm text-slate-700">{t("pdt.none_yet")}</p>}
        {p && (
          <div className={"rounded-xl border p-4 text-sm " + (p.status === "supported" ? "border-slate-200 text-slate-800" : "border-amber-200 bg-amber-50 text-amber-900")}>
            <div className="font-bold">{t(`pdt.status_${p.status}`)}</div>
            {p.reasons.map((r, i) => <div key={i} className="mt-1">{r}</div>)}
            {p.page_methods.some((m) => m.method === "ocr") && (
              <div className="mt-1">{(() => {
                const ocr = p.page_methods.filter((m) => m.method === "ocr").map((m) => m.page);
                return t(ocr.length === 1 ? "pdt.ocr_page_one" : "pdt.ocr_pages", { pages: ocr.join(", ") });
              })()}</div>
            )}
            {p.status === "supported" && <div className="mt-1">{t("pdt.pending_count", { count: pending })}</div>}
          </div>
        )}
        <Button type="button" variant="outline" className="min-h-11" disabled={busy}
          onClick={() => void act(() => api(`/api/agent/clients/${clientId}/document-rules/parse`, { method: "POST" }))}>
          {t("pdt.read_again")}
        </Button>

        {p && p.status === "supported" && results && !rules?.fields.some((f) => f.field_key === "surrender.gsv_factor_table") && (
          <section className="space-y-3 rounded-xl border border-slate-200 p-4" aria-labelledby="pdt-results">
            <h3 id="pdt-results" className="text-base font-bold text-slate-900">{t("pdt.results_title")}</h3>
            <ResultLine label={t("pdt.res_gsv")} amount={results.gsv.amount} lines={summarise([...results.gsv.missing, ...results.gsv.conditions])} />
            <ResultLine label={t("pdt.res_surrender")} amount={results.surrender_value.amount} lines={summarise(results.surrender_value.missing)} />
            <ResultLine label={t("pdt.res_loan")} amount={results.loan_limit.amount} lines={summarise(results.loan_limit.missing)} />
            <div className="space-y-1">
              <div className="text-sm font-bold text-slate-700">{t("pdt.res_paid_up")}</div>
              {results.paid_up_payouts.amounts ? (
                <div className="text-sm text-slate-800">
                  {t("pdt.res_paid_up_value", {
                    monthly: results.paid_up_payouts.amounts.recurring ? formatRupees(results.paid_up_payouts.amounts.recurring) : "",
                    final: results.paid_up_payouts.amounts.terminal ? formatRupees(results.paid_up_payouts.amounts.terminal) : "",
                  })}
                </div>
              ) : null}
              {summarise([...results.paid_up_payouts.missing, ...results.paid_up_payouts.conditions]).map((c, i) => <div key={`${i}-${c}`} className="text-sm text-slate-600">· {c}</div>)}
            </div>
            <div className="text-sm text-slate-800">
              <span className="font-bold text-slate-700">{t("pdt.res_grace")}: </span>
              {results.grace.days !== null ? t("pdt.days", { n: results.grace.days }) : summarise(results.grace.missing).join(" ")}
            </div>
            <div className="text-sm text-slate-800">
              <span className="font-bold text-slate-700">{t("pdt.res_revival")}: </span>
              {results.revival.applyBy ? t("pdt.apply_by", { date: prettyIso(results.revival.applyBy) }) : summarise(results.revival.missing).join(" ")}
            </div>
          </section>
        )}

        {p && p.flags.length > 0 && (
          <section className="space-y-3" aria-labelledby="pdt-flags">
            <h3 id="pdt-flags" className="text-base font-bold text-slate-900">{t("pdt.flags_title")}</h3>
            <p className="text-sm text-slate-700">{t("pdt.flags_intro")}</p>
            {p.flags.map((f) => <FlagRow key={f.id} flag={f} decision={rules!.flagDecisions[f.id]} busy={busy}
              onSave={(choice, why) => act(() => api(`/api/agent/clients/${clientId}/document-rules/flags`, { method: "POST", body: JSON.stringify({ flag_id: f.id, choice, reason: why, idempotency_key: key() }) }))} />)}
          </section>
        )}

        {p && p.status === "supported" && GROUPS.map((g) => {
          const rows = (rules!.fields ?? []).filter((f) => g.prefixes.some((pre) => f.field_key.startsWith(pre)));
          if (!rows.length) return null;
          const isOpen = open === g.id;
          return (
            <section key={g.id} className="rounded-xl border border-slate-200">
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : g.id)}
                className="flex min-h-11 w-full items-center justify-between p-4 text-left">
                <span className="text-base font-bold text-slate-900">{t(`pdt.group_${g.id}`)}</span>
                <span className="text-sm text-slate-600">{isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && (() => {
                const ready = rows.filter((f) => f.state === "document_pending" && f.document_field?.state === "found");
                const viaOcr = ready.filter((f) => f.document_field?.source?.method === "ocr");
                const bulk = ready.filter((f) => f.document_field?.source?.method !== "ocr");
                if (!bulk.length && !viaOcr.length) return null;
                return (
                  <div className="space-y-1 border-t border-slate-100 p-4">
                    {bulk.length > 0 && (
                      <Button type="button" className="min-h-11 bg-[#0D9488] hover:bg-[#0f766e]" disabled={busy}
                        onClick={() => void act(() => api(`/api/agent/clients/${clientId}/document-rules/confirm-many`, {
                          method: "POST",
                          body: JSON.stringify({ items: bulk.map((f) => ({ field_key: f.field_key, expected_revision: f.revision })), idempotency_key: key() }),
                        }))}>
                        {t("pdt.confirm_all", { count: bulk.length })}
                      </Button>
                    )}
                    {bulk.length > 0 && <p className="text-sm text-slate-600">{t("pdt.confirm_all_hint")}</p>}
                    {viaOcr.length > 0 && <p className="text-sm text-amber-900">{t("pdt.confirm_all_ocr", { count: viaOcr.length })}</p>}
                  </div>
                );
              })()}
              {isOpen && (
                <ul className="divide-y divide-slate-100 border-t border-slate-100">
                  {rows.map((f) => (
                    <FieldRow key={f.field_key} f={f} history={rules!.history[f.field_key] ?? []} busy={busy}
                      onReview={(action, value, why) => act(() => api(`/api/agent/clients/${clientId}/document-rules/review`, {
                        method: "POST",
                        body: JSON.stringify({ field_key: f.field_key, action, expected_revision: f.revision, value, reason: why, idempotency_key: key() }),
                      }))} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ResultLine({ label, amount, lines }: { label: string; amount: Paise | null; lines: string[] }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-1">
      <div className="text-sm font-bold text-slate-700">{label}</div>
      <div className={"text-xl font-bold tabular-nums " + (amount ? "text-slate-900" : "text-slate-500")}>{amount ? formatRupees(amount) : t("pdt.not_available")}</div>
      {lines.slice(0, 5).map((c, i) => <div key={`${i}-${c}`} className="text-sm text-slate-600">· {c}</div>)}
    </div>
  );
}

function FlagRow({ flag, decision, busy, onSave }: { flag: ReviewFlag; decision?: { choice: string; reason: string | null }; busy: boolean; onSave: (choice: string, reason: string) => void }) {
  const { t } = useLanguage();
  const [choice, setChoice] = useState(decision?.choice ?? "");
  const [why, setWhy] = useState("");
  // A point that only asks to be read needs no reason typed in.
  const readOnly = flag.choices.length === 1 && flag.choices[0] === "noted";
  return (
    <div className={"rounded-xl border p-4 text-sm " + (flag.blocksCalculation && !decision ? "border-amber-200 bg-amber-50" : "border-slate-200")}>
      <div className="font-bold text-slate-900">{tOr(t, `pdt.flag_${flag.id}`, flag.id)}</div>
      <p className="mt-1 text-slate-700">{tOr(t, `pdt.flag_${flag.id}_note`, flag.note)}</p>
      {decision && <p className="mt-1 font-semibold text-slate-800">{t("pdt.flag_decided", { choice: tOr(t, `pdt.choice_${decision.choice}`, decision.choice) })}{decision.reason ? ` (${decision.reason})` : ""}</p>}
      {flag.choices.length === 0 && flag.blocksCalculation && <p className="mt-1 text-slate-700">{t("pdt.flag_ask_insurer")}</p>}
      {readOnly && !decision && (
        <Button type="button" variant="outline" className="mt-2 min-h-11" disabled={busy} onClick={() => onSave("noted", "Read by the advisor")}>
          {t("pdt.choice_noted")}
        </Button>
      )}
      {flag.choices.length > 0 && !readOnly && (
        <div className="mt-2 space-y-2">
          <fieldset className="flex flex-wrap gap-4">
            <legend className="sr-only">{tOr(t, `pdt.flag_${flag.id}`, flag.id)}</legend>
            {flag.choices.map((c) => (
              <label key={c} className="flex min-h-11 items-center gap-2">
                <input type="radio" name={`flag-${flag.id}`} checked={choice === c} onChange={() => setChoice(c)} className="h-5 w-5" />
                {tOr(t, `pdt.choice_${c}`, c)}
              </label>
            ))}
          </fieldset>
          <label htmlFor={`why-${flag.id}`} className="block text-sm font-semibold text-slate-700">{t("pdt.flag_reason")}</label>
          <Input id={`why-${flag.id}`} value={why} onChange={(e) => setWhy(e.target.value)} className="h-11 border-slate-200 bg-white text-sm" />
          <Button type="button" variant="outline" className="min-h-11" disabled={busy || !choice || why.trim().length < 5} onClick={() => onSave(choice, why)}>
            {t("pdt.flag_save")}
          </Button>
        </div>
      )}
    </div>
  );
}

function FieldRow({ f, history, busy, onReview }: { f: FactRow; history: FactRow[]; busy: boolean; onReview: (action: "confirm" | "correct" | "reject", value: unknown, reason: string) => void }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<null | "correct" | "reject">(null);
  const [text, setText] = useState("");
  const [why, setWhy] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const d = f.document_field;
  const label = tOr(t, `pdt.f_${f.field_key.replace(/\./g, "_")}`, FIELD_LABEL[f.field_key] ?? f.field_key);
  const reader = correctionReader(f.field_key);
  const docText = d?.state === "found" ? formatValue(f.field_key, d.value) : d?.state === "not_applicable" ? t("pdt.na") : d?.reason ?? "";
  const tone =
    f.state === "reviewed" ? "border-[#0D9488]/40 bg-[#0D9488]/10 text-[#0f766e]"
    : f.state === "corrected" ? "border-blue-200 bg-blue-50 text-blue-800"
    : f.state === "conflicting" ? "border-rose-200 bg-rose-50 text-rose-800"
    : f.state === "rejected" ? "border-slate-300 bg-slate-100 text-slate-700"
    : "border-amber-200 bg-amber-50 text-amber-900";
  const src = d?.source ?? d?.candidates?.[0]?.source;

  const submit = () => {
    if (mode === "correct") {
      const v = reader?.(text);
      if (v === null || v === undefined) return setErr(t("pdt.bad_value"));
      if (why.trim().length < 5) return setErr(t("pdt.need_reason"));
      onReview("correct", v, why);
    } else if (mode === "reject") {
      if (why.trim().length < 5) return setErr(t("pdt.need_reason"));
      onReview("reject", null, why);
    }
    setMode(null);
  };

  return (
    <li className="space-y-1 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 text-sm font-semibold text-slate-800">{label}</div>
        <span className={"rounded-full border px-2.5 py-0.5 text-sm font-semibold " + tone}>{t(`pdt.state_${f.state}`)}</span>
      </div>
      <div className="text-sm text-slate-900">
        {f.state === "corrected" ? formatValue(f.field_key, f.corrected_value) : docText}
        {d?.state !== "found" && d?.state !== "not_applicable" && <span className="ml-1 text-slate-600">({t(`pdt.doc_${d?.state ?? "missing"}`)})</span>}
      </div>
      {(f.state === "corrected" || f.state === "conflicting") && <div className="text-sm text-slate-600">{t("pdt.document_said", { value: docText })}</div>}
      {src && (
        <div className="text-sm text-slate-600">
          {t("pdt.source", { page: src.pdfPage, printed: src.printedPage ?? "", clause: src.clause ?? "" })}
          {src.method === "ocr" ? ` · ${t("pdt.read_by_ocr")}` : ""}
          {src.excerpt && <div className="mt-0.5 italic text-slate-600">“{src.excerpt}”</div>}
        </div>
      )}
      {history.length > 1 && <div className="text-sm text-slate-500">{t("pdt.revisions", { n: history.length })}</div>}
      <div className="flex flex-wrap gap-2 pt-1">
        {d?.state === "found" && f.state !== "reviewed" && f.state !== "conflicting" && (
          <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => onReview("confirm", undefined, "")}>{t("pdt.confirm")}</Button>
        )}
        {reader && <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => { setMode("correct"); setErr(null); }}>{t("pdt.correct")}</Button>}
        <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => { setMode("reject"); setErr(null); }}>{t("pdt.reject")}</Button>
      </div>
      {mode && (
        <div className="space-y-2 rounded-md border border-slate-200 p-3">
          {mode === "correct" && (
            <>
              <label htmlFor={`v-${f.field_key}`} className="block text-sm font-semibold text-slate-700">{t("pdt.correct_value")}</label>
              <Input id={`v-${f.field_key}`} value={text} onChange={(e) => setText(e.target.value)} className="h-11 border-slate-200 bg-white text-sm" />
            </>
          )}
          <label htmlFor={`w-${f.field_key}`} className="block text-sm font-semibold text-slate-700">{t("pdt.why")}</label>
          <Input id={`w-${f.field_key}`} value={why} onChange={(e) => setWhy(e.target.value)} className="h-11 border-slate-200 bg-white text-sm" />
          {err && <p className="text-sm font-semibold text-rose-700" role="alert">{err}</p>}
          <div className="flex gap-2">
            <Button type="button" className="min-h-11 bg-[#0D9488] hover:bg-[#0f766e]" disabled={busy} onClick={submit}>{t("pdt.save")}</Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setMode(null)}>{t("pdt.cancel")}</Button>
          </div>
        </div>
      )}
    </li>
  );
}
