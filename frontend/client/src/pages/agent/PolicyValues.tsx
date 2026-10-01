/**
 * Surrender values: every life policy in the book, and what can honestly be
 * said about each one.
 *
 * Built on lib/policyBook. A rupee amount appears as a surrender or loan
 * figure only when it is a dated insurer quote the advisor entered, or a
 * calculation from reviewed product terms on checked details. Everything else
 * is listed with the reason it has no figure and what to do next, so the page
 * never implies the whole book has been valued when it has not.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

import { useAgent } from "@/context/AgentContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";
import { InlineErrorState } from "@/components/agent/InlineErrorState";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { getApiBase } from "@/lib/queryClient";
import {
  STATE_ORDER, bookTotals, buildBook, type BookRow, type RowState, type SourceRow,
} from "@/lib/policyBook";
import { BASIS_TEXT, REASON_TEXT, prettyIso, rupees } from "@/lib/policyValueText";
import type { Reason } from "@/lib/policyValue";

/** The advisor's life and term policies, read through the backend so the agent is the verified one. */
async function fetchPolicyValueRows(): Promise<SourceRow[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session) headers.Authorization = `Bearer ${session.access_token}`;
  const res = await fetch(`${getApiBase()}/api/agent/policy-values`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  return Array.isArray(body?.rows) ? body.rows : [];
}

const STATE_TONE: Record<RowState, string> = {
  calculated: "border-[#0D9488]/40 bg-[#0D9488]/10 text-[#0f766e]",
  quote_on_file: "border-blue-200 bg-blue-50 text-blue-800",
  check_payments: "border-amber-300 bg-amber-50 text-amber-900",
  needs_data: "border-slate-300 bg-slate-50 text-slate-700",
  failed: "border-rose-200 bg-rose-50 text-rose-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  pending: "border-slate-200 bg-white text-slate-600",
  unsupported: "border-slate-200 bg-white text-slate-600",
  term_cover: "border-slate-200 bg-white text-slate-600",
};

export default function PolicyValues() {
  const [, setLocation] = useLocation();
  const { agent } = useAgent();
  const { t } = useLanguage();
  const reason = (r: Reason | null) => (r ? tOr(t, `pvr.${r}`, REASON_TEXT[r]) : "");
  const [source, setSource] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RowState | "all">("all");

  const load = useCallback(async () => {
    if (!agent?.agentId) return;
    setLoading(true);
    setError(null);
    try {
      setSource(await fetchPolicyValueRows());
    } catch {
      setError(t("pv.load_failed"));
    } finally {
      setLoading(false);
    }
  }, [agent?.agentId, t]);

  useEffect(() => { void load(); }, [load]);

  const book = useMemo(() => buildBook(source), [source]);
  const totals = useMemo(() => bookTotals(book), [book]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return book
      .filter((r) => (filter === "all" ? true : r.state === filter))
      .filter((r) =>
        !q || r.clientName.toLowerCase().includes(q) ||
        (r.planName ?? "").toLowerCase().includes(q) || (r.insurer ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) || a.clientName.localeCompare(b.clientName));
  }, [book, filter, query]);

  if (error) return <InlineErrorState message={error} onRetry={() => void load()} />;

  const attention = (totals.byState.check_payments ?? 0) + (totals.byState.needs_data ?? 0);
  const amountOrNA = (sum: number, count: number) => (count > 0 ? rupees(sum) : t("pv.not_available"));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("pv.title")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{t("pv.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="space-y-1 p-5">
            <div className="text-sm font-bold text-slate-600">{t("pv.c_quotes")}</div>
            <div className="text-2xl font-bold text-blue-800">{amountOrNA(totals.surrender.quotes.sum, totals.surrender.quotes.count)}</div>
            {totals.surrender.quotes.count > 0 && (
              <div className="text-sm text-slate-600">
                {t("pv.c_count", { count: totals.surrender.quotes.count })} · {t("pv.c_oldest", { date: prettyIso(totals.surrender.quotes.oldest) })}
              </div>
            )}
            {totals.borrow.quotes.count > 0 && (
              <div className="text-sm text-slate-600">
                {t("pv.c_borrow_line", { amount: rupees(totals.borrow.quotes.sum), count: totals.borrow.quotes.count })}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="space-y-1 p-5">
            <div className="text-sm font-bold text-slate-600">{t("pv.c_calc")}</div>
            <div className="text-2xl font-bold text-[#0f766e]">{amountOrNA(totals.surrender.calculated.sum, totals.surrender.calculated.count)}</div>
            <div className="text-sm text-slate-600">
              {totals.surrender.calculated.count > 0
                ? t("pv.c_count", { count: totals.surrender.calculated.count })
                : t("pv.c_calc_none")}
            </div>
            {totals.borrow.calculated.count > 0 && (
              <div className="text-sm text-slate-600">
                {t("pv.c_borrow_line", { amount: rupees(totals.borrow.calculated.sum), count: totals.borrow.calculated.count })}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="space-y-1 p-5">
            <div className="text-sm font-bold text-slate-600">{t("pv.c_attention")}</div>
            <div className="text-2xl font-bold text-amber-800">{attention}</div>
            <div className="text-sm text-slate-600">{t("pv.c_attention_sub", { passed: totals.datePassed })}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="space-y-1 p-5">
            <div className="text-sm font-bold text-slate-600">{t("pv.c_maturing")}</div>
            <div className="text-2xl font-bold text-slate-900">{totals.maturingSoon}</div>
            <div className="text-sm text-slate-600">{t("pv.c_maturing_sub")}</div>
          </CardContent>
        </Card>
      </div>

      {!loading && totals.rows > 0 && (
        <p className="text-sm text-slate-700" role="status">
          {t("pv.recon", { included: totals.included, rows: totals.rows, excluded: totals.excluded })}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("pv.search")}
          aria-label={t("pv.search")}
          className="h-11 max-w-xs border-slate-200 bg-white"
        />
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={"inline-flex min-h-11 items-center rounded-full border px-4 py-1.5 text-sm font-semibold " +
            (filter === "all" ? "border-[#0D9488] bg-[#0D9488] text-white" : "border-slate-200 bg-white text-slate-700")}
        >
          {t("pv.all", { count: book.length })}
        </button>
        {STATE_ORDER.filter((s) => totals.byState[s]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={"inline-flex min-h-11 items-center rounded-full border px-4 py-1.5 text-sm font-semibold " +
              (filter === s ? "border-[#0D9488] bg-[#0D9488] text-white" : "border-slate-200 bg-white text-slate-700")}
          >
            {t(`pv.st_${s}`)} ({totals.byState[s]})
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-8 text-center text-sm text-slate-500">{t("pv.working")}</CardContent>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-8 text-center text-sm text-slate-600">
            {book.length === 0 ? t("pv.empty_all") : t("pv.empty_group")}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm" data-mp-block>
          <table className="table-cards w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                {["col_client", "col_year", "col_surrender", "col_borrow", "col_next", "col_maturity", "col_step"].map((h) => (
                  <th key={h} className="px-4 py-3 text-sm font-bold text-slate-600">{t(`pv.${h}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <BookRowView key={r.id} r={r} onOpen={() => setLocation(`/agent/policies/${r.id}`)} reason={reason} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="max-w-3xl space-y-2 text-sm text-slate-600">
        <p>{t("pv.foot_gross_net")}</p>
        <p>{t("pv.foot_next")}</p>
        <p>{t("pv.foot_totals")}</p>
        <p>{t("pv.foot_dates")}</p>
      </div>
    </div>
  );
}

function BookRowView({ r, onOpen, reason }: { r: BookRow; onOpen: () => void; reason: (x: Reason | null) => string }) {
  const { t } = useLanguage();
  const v = r.valuation;
  const sp = v?.values.surrender_payable;
  const lr = v?.values.loan_remaining;
  const mat = v?.values.maturity_guaranteed;
  const basis = (b: keyof typeof BASIS_TEXT) => tOr(t, `pvb.${b}`, BASIS_TEXT[b]);
  const next = v?.nextAnniversary;

  return (
    <tr onClick={onOpen} className="cursor-pointer border-b border-slate-50 align-top last:border-0 hover:bg-slate-50">
      <td className="px-4 py-3" data-label={t("pv.col_client")} data-cell="title">
        <div className="font-semibold text-slate-900">{r.clientName || t("pv.unnamed")}</div>
        <div className="text-sm text-slate-500">{r.planName || r.insurer || ""}</div>
        {r.duplicate && (
          <div className="text-sm font-semibold text-amber-800">
            {r.duplicate.kind === "confirmed" ? t("pv.dup_confirmed") : t("pv.dup_disputed")}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-slate-700" data-label={t("pv.col_year")}>
        {v?.policyYear && v.term ? `${v.policyYear}/${v.term}` : ""}
      </td>
      <td className="px-4 py-3" data-label={t("pv.col_surrender")}>
        {v && sp && v.cash.surrender && sp.amount !== null ? (
          <>
            <div className="font-semibold tabular-nums text-slate-900">{rupees(sp.amount)}</div>
            <div className="text-sm text-slate-600">
              {basis(sp.basis)}{sp.basis === "insurer_quote" && sp.asOf ? ` · ${t("pv.as_of", { date: prettyIso(sp.asOf) })}` : ""}
            </div>
          </>
        ) : sp?.upperBound !== null && sp?.upperBound !== undefined ? (
          <>
            <div className="font-semibold tabular-nums text-slate-700">{t("pv.at_most", { amount: rupees(sp.upperBound) })}</div>
            <div className="text-sm text-slate-600">{t("pv.at_most_note")}</div>
          </>
        ) : (
          <div className="text-sm text-slate-600">
            {r.state === "term_cover" ? reason("term_no_surrender") : reason(r.reason) || t("pv.not_available")}
          </div>
        )}
      </td>
      <td className="px-4 py-3" data-label={t("pv.col_borrow")}>
        {v && lr && v.cash.borrow && lr.amount !== null ? (
          <>
            <div className="font-semibold tabular-nums text-slate-900">{rupees(lr.amount)}</div>
            <div className="text-sm text-slate-600">{basis(lr.basis)}</div>
          </>
        ) : r.state === "term_cover" ? null : (
          <div className="text-sm text-slate-600">{t("pv.not_confirmed")}</div>
        )}
      </td>
      <td className="px-4 py-3" data-label={t("pv.col_next")}>
        {next?.available && next.difference !== null && next.requiredPremiums !== null ? (
          <div className="text-sm text-slate-800">
            {t("pv.next_diff", {
              premiums: rupees(next.requiredPremiums),
              diff: (next.difference < 0 ? "−" : "+") + rupees(Math.abs(next.difference)),
            })}
            <div className="text-slate-600">{t("pv.next_confirm")}</div>
          </div>
        ) : next?.nextAnniversary ? (
          <div className="text-sm text-slate-600">{t("pv.next_on", { date: prettyIso(next.nextAnniversary) })}</div>
        ) : r.state === "term_cover" || !v ? null : (
          <div className="text-sm text-slate-600">{t("pv.not_compared")}</div>
        )}
      </td>
      <td className="px-4 py-3" data-label={t("pv.col_maturity")}>
        {mat && mat.amount !== null ? (
          <>
            <div className="font-semibold tabular-nums text-slate-900">{rupees(mat.amount)}</div>
            <div className="text-sm text-slate-600">
              {prettyIso(mat.asOf)} · {mat.verification === "agent_checked" ? t("pv.maturity_checked") : t("pv.maturity_as_written")}
            </div>
          </>
        ) : mat?.missing[0] ? (
          <div className="text-sm text-slate-600">{reason(mat.missing[0])}</div>
        ) : null}
      </td>
      <td className="px-4 py-3" data-label={t("pv.col_step")} data-cell="actions">
        <span className={"inline-block rounded-full border px-2.5 py-0.5 text-sm font-semibold " + STATE_TONE[r.state]}>
          {t(`pv.st_${r.state}`)}
        </span>
        {r.datePassed && <div className="mt-1 text-sm text-amber-900">{t("pv.date_passed", { date: prettyIso(r.datePassed) })}</div>}
        <div className="mt-1 text-sm text-slate-700">{t(`pv.step_${r.nextStep}`)}</div>
      </td>
    </tr>
  );
}
