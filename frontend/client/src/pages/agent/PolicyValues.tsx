/**
 * Policy values — what every life policy in the book is worth today.
 *
 * The surrender value of a life policy moves every anniversary, so an agent
 * carrying hundreds of them has no way to know who is sitting on money, who
 * would lose by surrendering now, and whose value steps up next month. This is
 * that list, worked out from the extracted data and sorted by what to do about
 * it — maturing first, because that money is about to move.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

import { useAgent } from "@/context/AgentContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";
import { InlineErrorState } from "@/components/agent/InlineErrorState";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ACTION_META, ACTION_ORDER, fetchPolicyValues,
  type PolicyValueSummary, type ValueAction,
} from "@/lib/policyBook";

const rupee = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

const short = (n: number) => {
  if (!n) return "₹0";
  if (n >= 1e7) return "₹" + (n / 1e7).toFixed(2).replace(/\.?0+$/, "") + " Cr";
  if (n >= 1e5) return "₹" + (n / 1e5).toFixed(2).replace(/\.?0+$/, "") + " L";
  return rupee(n);
};

export default function PolicyValues() {
  const [, setLocation] = useLocation();
  const { agent } = useAgent();
  const { t, locale } = useLanguage();
  const actLabel = (a: keyof typeof ACTION_META) => tOr(t, `pv.act_${a}`, ACTION_META[a].label);
  const actBlurb = (a: keyof typeof ACTION_META) => tOr(t, `pv.act_${a}_blurb`, ACTION_META[a].blurb);
  const [rows, setRows] = useState<PolicyValueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ValueAction | "all">("all");

  const load = useCallback(async () => {
    if (!agent?.agentId) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchPolicyValues(agent.agentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("pv.load_failed"));
    } finally {
      setLoading(false);
    }
  }, [agent?.agentId]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.action] = (c[r.action] ?? 0) + 1;
    return c;
  }, [rows]);

  const totals = useMemo(() => {
    const surrenderable = rows.filter((r) => !r.deferredTo && r.action !== "none");
    return {
      liveValue: surrenderable.reduce((s, r) => s + r.valueToday, 0),
      // The number an advisor can actually open a conversation with: what the
      // book will raise for its customers without a single policy being ended.
      borrowable: rows.reduce((s, r) => s + r.canBorrow, 0),
      tracked: rows.filter((r) => r.action !== "none").length,
      maturing: counts.maturing ?? 0,
      reviving: (counts.lapsed ?? 0) + (counts.overdue ?? 0),
    };
  }, [rows, counts]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (filter === "all" ? true : r.action === filter))
      .filter((r) =>
        !q ||
        r.clientName.toLowerCase().includes(q) ||
        (r.planName ?? "").toLowerCase().includes(q) ||
        (r.insurer ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const d = ACTION_ORDER.indexOf(a.action) - ACTION_ORDER.indexOf(b.action);
        return d !== 0 ? d : b.valueToday - a.valueToday;
      });
  }, [rows, filter, query]);

  if (error) return <InlineErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("pv.title")}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {t("pv.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-5">
            <div className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
              {t("pv.c_surrenderable")}
            </div>
            <div className="mt-1 text-2xl font-bold text-[#0D9488]">{short(totals.liveValue)}</div>
            <div className="mt-1 text-sm text-slate-600">{t("pv.c_across", { count: totals.tracked })}</div>
          </CardContent>
        </Card>
        {/* The retention card. Surrendering is what a customer asks for; borrowing
            is usually what they actually need, and it keeps the cover alive. */}
        <Card className="border-[#0D9488]/30 bg-[#0D9488]/5 shadow-sm">
          <CardContent className="p-5">
            <div className="text-sm font-black uppercase tracking-[0.2em] text-[#0f766e]">
              {t("pv.c_borrow")}
            </div>
            <div className="mt-1 text-2xl font-bold text-[#0f766e]">{short(totals.borrowable)}</div>
            <div className="mt-1 text-sm text-slate-600">{t("pv.c_borrow_sub")}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-5">
            <div className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">{t("pv.c_maturing")}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{totals.maturing}</div>
            <div className="mt-1 text-sm text-slate-600">{t("pv.c_maturing_sub")}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-5">
            <div className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">{t("pv.c_reviving")}</div>
            <div className="mt-1 text-2xl font-bold text-rose-700">{totals.reviving}</div>
            <div className="mt-1 text-sm text-slate-600">{t("pv.c_reviving_sub")}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("pv.search")}
          className="h-10 max-w-xs border-slate-200 bg-white"
        />
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={
            "inline-flex min-h-10 items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold " +
            (filter === "all" ? "border-[#0D9488] bg-[#0D9488] text-white" : "border-slate-200 bg-white text-slate-600")
          }
        >
          {t("pv.all", { count: rows.length })}
        </button>
        {ACTION_ORDER.filter((a) => counts[a]).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setFilter(a)}
            className={
              "inline-flex min-h-10 items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold " +
              (filter === a ? "border-[#0D9488] bg-[#0D9488] text-white" : "border-slate-200 bg-white text-slate-600")
            }
          >
            {actLabel(a)} ({counts[a]})
          </button>
        ))}
      </div>

      {filter !== "all" && (
        <p className="text-xs text-slate-500">{actBlurb(filter)}</p>
      )}

      {loading ? (
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-8 text-center text-sm italic text-slate-400">
            {t("pv.working")}
          </CardContent>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-8 text-center text-sm italic text-slate-400">
            {rows.length === 0
              ? t("pv.empty_all")
              : t("pv.empty_group")}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm">
          <table className="table-cards w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                {[t("pv.col_client"), t("pv.col_year"), t("pv.col_paid"), t("pv.col_now"), t("pv.col_next"), t("pv.col_maturity"), t("pv.col_action")].map((h, i) => (
                  <th
                    key={h}
                    className={
                      "px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-400 " +
                      (i >= 2 && i <= 5 ? "text-right" : "")
                    }
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setLocation(`/agent/policies/${r.id}`)}
                  className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3" data-label={t("pv.col_client")} data-cell="title">
                    <div className="font-semibold text-slate-900">{r.clientName}</div>
                    <div className="text-xs text-slate-400">{r.planName || r.insurer || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600" data-label={t("pv.col_year")}>
                    {r.policyYear}/{r.term}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600" data-label={t("pv.col_paid")}>{rupee(r.paidSoFar)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900" data-label={t("pv.col_now")}>
                    {r.action === "none" ? (
                      <span className="text-slate-400">{t("pv.nothing")}</span>
                    ) : r.deferredTo ? (
                      <span className="text-slate-400">{rupee(r.valueToday)}*</span>
                    ) : (
                      rupee(r.valueToday)
                    )}
                    {/* Payouts already banked are money the customer holds. Showing
                        the surrender value alone understates what they have. */}
                    {r.receivedSoFar > 0 && (
                      <div className="text-xs font-normal text-[#0f766e]">
                        {t("pv.received", { amount: rupee(r.receivedSoFar) })}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums" data-label={t("pv.col_next")}>
                    {r.valueNextYear === null || r.action === "none" ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <span className={r.uplift > 0 ? "text-[#0f766e]" : "text-slate-500"}>
                        {rupee(r.valueNextYear)}
                        {r.uplift > 0 && (
                          <span className="ml-1 text-xs">+{Math.round(r.upliftPct)}%</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums" data-label={t("pv.col_maturity")}>
                    {r.action === "none" || r.totalAtMaturity <= 0 ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <>
                        <div className="font-semibold text-slate-900">{rupee(r.totalAtMaturity)}</div>
                        {/* Against what goes in, so the row answers "ahead or behind" */}
                        <div
                          className={
                            "text-xs font-normal " +
                            (r.totalAtMaturity >= r.premiumsPayable ? "text-[#0f766e]" : "text-amber-700")
                          }
                        >
                          {t("pv.vs_paid", { sign: r.totalAtMaturity >= r.premiumsPayable ? "+" : "−", diff: rupee(Math.abs(r.totalAtMaturity - r.premiumsPayable)), paid: rupee(r.premiumsPayable) })}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3" data-label={t("pv.col_action")} data-cell="actions">
                    <span
                      className={
                        "inline-block rounded-full border px-2 py-0.5 text-xs font-semibold " +
                        ACTION_META[r.action].tone
                      }
                    >
                      {actLabel(r.action)}
                    </span>
                    <div className="mt-1 text-xs text-slate-500">{r.headline}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm text-slate-500">
        {t("pv.footnote")}
        {locale === "hi" && <> {t("pv.headline_english")}</>}
      </p>
    </div>
  );
}
