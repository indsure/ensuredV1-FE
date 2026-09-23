import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceArea, ReferenceLine,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { isPlaygroundMode } from "@/lib/playground/mode";
import { getApiBase } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";
import {
  computePolicyValue, isValueGap, PLAN_SHAPE_LABELS, PLAN_SHAPE_OPTIONS,
  type PlanShape,
} from "@/lib/policyValue";
import {
  PARAM_LABELS, RELEVANT_PARAMS, assumedCount,
  type ParamSource, type PolicyParams,
} from "@/lib/policyParams";

const PAID = "#B45309";
const BACK = "#0D9488";
const COVER = "#1D4ED8";

const rupee = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const short = (n: number) => {
  if (!n) return "₹0";
  if (n >= 1e7) return "₹" + (n / 1e7).toFixed(2).replace(/\.?0+$/, "") + " Cr";
  if (n >= 1e5) return "₹" + (n / 1e5).toFixed(2).replace(/\.?0+$/, "") + " L";
  if (n >= 1e3) return "₹" + Math.round(n / 1e3) + "k";
  return "₹" + Math.round(n);
};

const pct = (r: number | null) => (r === null ? "—" : (r * 100).toFixed(2) + "%");

const SOURCE_STYLE: Record<ParamSource, string> = {
  document: "bg-[#0D9488]/10 text-[#0f766e] border-[#0D9488]/30",
  entered: "bg-blue-50 text-blue-700 border-blue-200",
  default: "bg-amber-50 text-amber-800 border-amber-200",
};
const SOURCE_KEY: Record<ParamSource, string> = {
  document: "pvc.src_document",
  entered: "pvc.src_entered",
  default: "pvc.src_default",
};

interface Props {
  clientId: string;
  insuranceType: string;
  data: Record<string, any> | null | undefined;
  onSaved?: () => void;
}

export default function PolicyValueChart({ clientId, insuranceType, data, onSaved }: Props) {
  const { t, locale } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [showParams, setShowParams] = useState(false);
  // Applied locally first so the chart redraws immediately, and so the controls
  // still work in playground, which has no backend to PATCH.
  const [patch, setPatch] = useState<Record<string, any>>({});

  const effective = useMemo(() => ({ ...(data ?? {}), ...patch }), [data, patch]);
  const result = useMemo(
    () => computePolicyValue(insuranceType, effective, { allYearReturns: true }),
    [insuranceType, effective]
  );

  const term = !isValueGap(result) ? result.term : 1;

  /**
   * Open on the policy year the customer is actually in.
   *
   * The card used to start at year 1 for a policy in its ninth, which is the one
   * year where a savings plan is worth nothing: the surrender value reads
   * "Nothing" and the borrowing panel below it does not appear at all. The
   * agent had to know to drag a slider before the screen answered the question
   * they opened it to ask.
   *
   * Done as an effect rather than an initial value because the policy data
   * arrives after the first render, so there is no current year to open on yet.
   * It moves once, and never again after the agent has taken hold of the slider.
   */
  const openAt = !isValueGap(result) ? result.currentYear : null;
  const [year, setYear] = useState(1);
  const [scrubbed, setScrubbed] = useState(false);
  useEffect(() => {
    if (!scrubbed && openAt !== null) setYear(openAt);
  }, [openAt, scrubbed]);
  const yr = Math.min(year, term);

  async function persist(next: Record<string, any>) {
    setPatch((p) => ({ ...p, ...next }));
    if (isPlaygroundMode()) return; // demo mode: nothing is persisted anywhere
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(t("common.not_signed_in"));
      // The endpoint merges, so a partial would be enough. Still sent whole:
      // `patch` holds edits made in this session that were never posted on
      // their own, and dropping them here would lose them.
      const payload = { ...(data ?? {}), ...patch, ...next };
      const res = await fetch(`${getApiBase()}/api/agent/clients/${clientId}/extracted-data`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ extracted_data: payload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || t("pvc.save_failed"));
      }
      toast({ variant: "success", title: t("pvc.saved") });
      onSaved?.();
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: t("pvc.save_failed"),
        description: e instanceof Error ? e.message : t("pvc.save_failed_desc"),
      });
    } finally {
      setSaving(false);
    }
  }

  const setPlanType = (shape: PlanShape) => void persist({ plan_type: PLAN_SHAPE_LABELS[shape] });

  const setParam = (key: keyof PolicyParams, raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const existing = (effective.policy_parameters ?? {}) as Record<string, any>;
    void persist({
      policy_parameters: { ...existing, [key]: { value: n, source: "entered" } },
    });
  };

  if (isValueGap(result)) {
    return (
      <Card className="border-slate-100 shadow-sm">
        <CardHeader className="border-b border-slate-50 pb-4">
          <CardTitle>{t("pvc.title")}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-sm text-slate-600">
            {t(result.missing.length === 1 ? "pvc.need_one" : "pvc.need_many")}
          </p>
          <ul className="mt-3 space-y-1">
            {result.missing.map((m) => (
              <li key={m} className="text-sm font-semibold text-slate-900">· {m}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-400">
            {t("pvc.nothing_guessed")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const {
    shape, rows, params, totalPremiums, maturity, lockInYears, lockInEnds,
    steps, illustratedMaturity, reconciliation, irrAtMaturity, xirrAtMaturity,
    premiumStatus, premiumStatusNote, anchorYear, anchorValue,
  } = result;
  const row = rows[yr - 1];
  // XIRR wherever the dates resolve: it is the same measure, discounted by real
  // dates rather than whole years, so monthly premiums and a payout deferred to
  // a lock-in date come out right.
  const returnHere = row.xirr ?? row.irr;
  const returnAtMaturity = xirrAtMaturity ?? irrAtMaturity;
  const relevant = RELEVANT_PARAMS[shape] ?? [];
  const assumed = assumedCount(params, shape);

  const chartData = rows.map((r) => ({
    year: r.year,
    paid: Math.round(r.paid),
    back: Math.round(r.back),
    received: Math.round(r.received),
    inHand: Math.round(r.received + r.back),
    locked: r.deferredTo ? Math.round(r.back) : null,
    cover: Math.round(r.cover),
  }));

  // A money-back plan hands money over during the term, so the question is not
  // "what would I get" but "how much do I have, and is it past what I put in".
  // Stacking what is banked under what surrender would add answers both at once,
  // and the premium line becomes the bar the stack has to clear.
  const paysDuringTerm = rows.some((r) => r.received > 0);

  const returnAtMaturityTop = xirrAtMaturity ?? irrAtMaturity;
  const verdict = (() => {
    if (shape === "pure_term")
      return {
        title: t("pvc.v_term_title"),
        body: t("pvc.v_term_body", { cover: short(rows[0].cover), total: rupee(totalPremiums) }),
      };
    if (shape === "return_of_premium")
      return {
        title: returnAtMaturityTop !== null
          ? t("pvc.v_rop_title_ret", { total: rupee(totalPremiums), ret: pct(returnAtMaturityTop) })
          : t("pvc.v_rop_title", { total: rupee(totalPremiums) }),
        body: t("pvc.v_rop_body"),
      };
    if (shape === "money_back") {
      const payouts = rows[rows.length - 1].value - maturity;
      return {
        title: returnAtMaturityTop !== null
          ? t("pvc.v_mb_title_ret", { payouts: short(payouts), maturity: short(maturity), ret: pct(returnAtMaturityTop) })
          : t("pvc.v_mb_title", { payouts: short(payouts), maturity: short(maturity) }),
        body: t("pvc.v_mb_body", { total: rupee(totalPremiums), received: short(payouts + maturity) }),
      };
    }
    if (shape === "endowment")
      return {
        title: returnAtMaturityTop !== null
          ? t("pvc.v_end_title_ret", { maturity: short(maturity), total: rupee(totalPremiums), ret: pct(returnAtMaturityTop) })
          : t("pvc.v_end_title", { maturity: short(maturity), total: rupee(totalPremiums) }),
        body: t("pvc.v_end_body"),
      };
    return {
      title: lockInEnds ? t("pvc.v_ulip_title_until", { date: lockInEnds }) : t("pvc.v_ulip_title"),
      body: t("pvc.v_ulip_body", { years: lockInYears ?? "", rate: params.discontinuedFundRatePct.value }),
    };
  })();

  return (
    <Card className="border-slate-100 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 pb-4">
        <CardTitle>{t("pvc.title")}</CardTitle>
        <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
          {t("pvc.calculated")}
        </span>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        {/* Nothing below is true if the premiums are not up to date, so it leads. */}
        {(premiumStatus === "overdue" || premiumStatus === "paid_up" || premiumStatus === "grace") && (
          <div
            className={
              "rounded-xl border p-3 text-xs " +
              (premiumStatus === "grace"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-rose-200 bg-rose-50 text-rose-800")
            }
          >
            <span className="font-bold">
              {premiumStatus === "grace" ? t("pvc.premium_due") : t("pvc.not_up_to_date")}
            </span>{" "}
            {premiumStatusNote}
          </div>
        )}

        {/* Whether the fund figure is the customer's or our reconstruction. */}
        {shape === "unit_linked" && (
          <div
            className={
              "rounded-xl border p-3 text-xs " +
              (anchorYear !== null
                ? "border-[#0D9488]/30 bg-[#0D9488]/5 text-[#0f766e]"
                : "border-amber-200 bg-amber-50 text-amber-900")
            }
          >
            {anchorYear !== null ? (
              <>
                {t("pvc.anchored", { value: rupee(anchorValue!), year: anchorYear })}
              </>
            ) : (
              <>
                {t("pvc.modelled")}
              </>
            )}
          </div>
        )}

        {/* Reconciliation against the document's own illustration, when it stated one. */}
        {reconciliation && (
          <div
            className={
              "rounded-xl border p-3 text-xs " +
              (Math.abs(reconciliation.pct) < 1
                ? "border-[#0D9488]/30 bg-[#0D9488]/5 text-[#0f766e]"
                : "border-amber-200 bg-amber-50 text-amber-900")
            }
          >
            {Math.abs(reconciliation.pct) < 1 ? (
              <>{t("pvc.matches", { amount: rupee(illustratedMaturity!) })}</>
            ) : (
              <>
                {t("pvc.differs", { doc: rupee(illustratedMaturity!), ours: rupee(maturity), diff: `${reconciliation.pct > 0 ? "+" : ""}${reconciliation.pct.toFixed(1)}` })}
              </>
            )}
          </div>
        )}

        {/* Plan type drives the whole calculation, so it is the first thing to confirm. */}
        <div>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t("pvc.plan_type")}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLAN_SHAPE_OPTIONS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                disabled={saving}
                onClick={() => setPlanType(key)}
                className={
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 " +
                  (key === shape
                    ? "border-[#0D9488] bg-[#0D9488] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-[#0D9488]")
                }
              >
                {tOr(t, `pvc.shape_${key}`, label)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {t("pvc.plan_type_hint")}
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-base font-bold text-slate-900">{verdict.title}</div>
            {relevant.length > 0 && (
              <span
                className={
                  "rounded-full border px-2 py-0.5 text-xs font-semibold " +
                  (assumed === 0 ? SOURCE_STYLE.document : SOURCE_STYLE.default)
                }
              >
                {assumed === 0 ? t("pvc.all_from_doc") : t(assumed > 1 ? "pvc.assumed_many" : "pvc.assumed_one", { count: assumed })}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600">{verdict.body}</p>
        </div>

        {/* Money in vs money back. Cover sits in its own strip below: at crore
            scale it would flatten the premium line to nothing. */}
        <div>
          <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-2">
              <span className="h-[3px] w-5 rounded" style={{ background: PAID }} />{t("pvc.legend_paid")}
            </span>
            {paysDuringTerm && (
              <span className="flex items-center gap-2">
                <span className="h-3 w-5 rounded-sm" style={{ background: BACK }} />{t("pvc.legend_received")}
              </span>
            )}
            <span className="flex items-center gap-2">
              {paysDuringTerm ? (
                <span className="h-3 w-5 rounded-sm" style={{ background: BACK, opacity: 0.32 }} />
              ) : (
                <span className="h-[3px] w-5 rounded" style={{ background: BACK }} />
              )}
              {paysDuringTerm ? t("pvc.legend_sv_top") : t("pvc.legend_sv")}
            </span>
            {lockInYears ? (
              <span className="flex items-center gap-2">
                <span className="w-5 border-t-[3px] border-dashed" style={{ borderColor: BACK }} />
                {t("pvc.legend_locked")}
              </span>
            ) : null}
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="year" axisLine={false} tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }} dy={6} />
                <YAxis axisLine={false} tickLine={false} width={64}
                  tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={short} />
                <Tooltip
                  formatter={(v: any, n: any) => [
                    rupee(Number(v)),
                    n === "paid" ? t("pvc.tip_paid")
                      : n === "received" ? t("pvc.tip_received")
                      : n === "inHand" ? t("pvc.tip_in_hand")
                      : t("pvc.tip_surrender"),
                  ]}
                  labelFormatter={(l) => t("pvc.tip_year", { year: String(l) })}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                {lockInYears ? (
                  <ReferenceArea x1={1} x2={lockInYears} fill="#0f172a" fillOpacity={0.04} />
                ) : null}
                <ReferenceLine x={yr} stroke="#94a3b8" strokeWidth={1} />
                {paysDuringTerm ? (
                  <>
                    {/* Banked money at the bottom because it is already theirs; what
                        surrender would add sits on top. The top edge is the total. */}
                    <Area type="monotone" dataKey="received" stackId="hand" stroke="none"
                      fill={BACK} fillOpacity={0.85} isAnimationActive={false} />
                    <Area type="monotone" dataKey="back" stackId="hand" stroke="none"
                      fill={BACK} fillOpacity={0.28} isAnimationActive={false} />
                    <Line type="monotone" dataKey="inHand" stroke={BACK} strokeWidth={2}
                      dot={false} isAnimationActive={false} />
                  </>
                ) : (
                  <Line type="monotone" dataKey="back" stroke={BACK} strokeWidth={2} dot={false} />
                )}
                {/* Premiums paid drawn last so it reads as the bar to clear. */}
                <Line type="monotone" dataKey="paid" stroke={PAID} strokeWidth={2} dot={false} />
                {lockInYears ? (
                  // isAnimationActive must stay off: recharts drives its line-draw
                  // animation through stroke-dasharray and would overwrite ours.
                  <Line type="monotone" dataKey="locked" stroke={BACK} strokeWidth={2}
                    strokeDasharray="5 5" dot={false} connectNulls={false}
                    isAnimationActive={false} />
                ) : null}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mb-1 mt-4 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            {t("pvc.cover_family")}
          </div>
          <div className="h-[92px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 16, left: -12, bottom: 0 }}>
                <XAxis dataKey="year" hide />
                <YAxis hide domain={[0, "dataMax"]} width={64} />
                <Tooltip
                  formatter={(v: any) => [rupee(Number(v)), t("pvc.tip_cover")]}
                  labelFormatter={(l) => t("pvc.tip_year", { year: String(l) })}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                <ReferenceLine x={yr} stroke="#94a3b8" strokeWidth={1} />
                <Line type="monotone" dataKey="cover" stroke={COVER} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Scrubber: one control moves both charts and all three figures. */}
        <div>
          <label htmlFor="policy-year" className="block text-xs text-slate-500">
            {row.age !== null
              ? t("pvc.scrub_age", { year: row.year, term, age: row.age })
              : t("pvc.scrub", { year: row.year, term })}
          </label>
          <input
            id="policy-year"
            type="range"
            min={1}
            max={term}
            value={yr}
            onChange={(e) => { setScrubbed(true); setYear(Number(e.target.value)); }}
            className="mt-2 w-full accent-[#0D9488]"
          />
        </div>

        <div className={"grid grid-cols-1 gap-4 sm:grid-cols-2 " + (row.received > 0 ? "xl:grid-cols-5" : "xl:grid-cols-4")}>
          <div className="rounded-xl border border-slate-100 p-4">
            <div className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">{t("pvc.k_paid")}</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: PAID }}>{rupee(row.paid)}</div>
            <div className="mt-1 text-sm text-slate-500">
              {row.year >= result.ppt ? t("pvc.all_paid", { count: result.ppt }) : t("pvc.some_paid", { year: row.year, count: result.ppt })}
            </div>
          </div>
          {row.received > 0 && (
            <div className="rounded-xl border border-slate-100 p-4">
              <div className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">{t("pvc.k_received")}</div>
              <div className="mt-1 text-2xl font-bold text-[#0f766e]">{rupee(row.received)}</div>
              <div className="mt-1 text-sm text-slate-500">
                {t("pvc.k_received_desc")}
              </div>
            </div>
          )}
          <div className="rounded-xl border border-slate-100 p-4">
            <div className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">{t("pvc.k_sv")}</div>
            <div className={"mt-1 text-2xl font-bold " + (row.back > 0 ? "" : "text-slate-400")}
              style={row.back > 0 ? { color: BACK } : undefined}>
              {row.back > 0 ? rupee(row.back) : t("pvc.nothing")}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {row.received > 0 && (
                <span className="font-semibold text-slate-700">
                  {t("pvc.in_hand", { amount: rupee(row.back + row.received) })}{" "}
                </span>
              )}
              {row.penalty > 0 ? `${t("pvc.after_charge", { amount: rupee(row.penalty) })} ` : ""}{row.note}
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 p-4">
            <div className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">{t("pvc.k_return")}</div>
            <div className={"mt-1 text-2xl font-bold " + (returnHere === null ? "text-slate-400" : returnHere < 0 ? "text-amber-700" : "text-slate-900")}>
              {returnHere === null ? t("pvc.no_return") : pct(returnHere)}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {returnHere === null && `${t("pvc.nothing_this_year")} `}
              {returnAtMaturity !== null
                ? t("pvc.held_to_maturity", { ret: pct(returnAtMaturity) })
                : returnHere !== null
                ? t("pvc.a_year_paid")
                : ""}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              {returnAtMaturity === null
                ? ""
                : row.xirr !== null || xirrAtMaturity !== null
                ? t("pvc.xirr_note")
                : t("pvc.annual_note")}
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 p-4">
            <div className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">{t("pvc.k_death")}</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: COVER }}>{rupee(row.cover)}</div>
            <div className="mt-1 text-sm text-slate-500">
              {row.deferredTo ? t("pvc.cover_stops") : t("pvc.cover_while")}
            </div>
          </div>
        </div>

        {/* Reduced paid-up. The values above are already cut down to this, so it
            has to be said plainly rather than left for the reader to infer. */}
        {result.paidUpFactor < 1 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="text-sm font-black uppercase tracking-[0.2em] text-rose-800">
              {t("pvc.rpu")}
            </div>
            <div className="mt-1 text-sm text-rose-900">
              {t("pvc.rpu_desc", { paid: result.paidThrough ?? "", ppt: result.ppt, pct: Math.round(result.paidUpFactor * 100) })}
            </div>
          </div>
        )}

        {/* The two answers an advisor almost never has to hand: what the policy
            will lend instead of being surrendered, and what a lapsed one costs
            to bring back. Both are arithmetic on figures already on this page. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {row.maxLoan > 0 && (
            <div className="rounded-xl border border-[#0D9488]/30 bg-[#0D9488]/5 p-4">
              <div className="text-sm font-black uppercase tracking-[0.2em] text-[#0f766e]">
                {t("pvc.borrow")}
              </div>
              <div className="mt-1 text-2xl font-bold text-[#0f766e]">{rupee(row.maxLoan)}</div>
              <div className="mt-1 text-sm text-slate-700">
                {t("pvc.borrow_desc", { pct: result.loan.sharePct })}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {result.loan.ratePct !== null
                  ? t("pvc.loan_rate", { rate: result.loan.ratePct })
                  : result.loan.rateNote}
              </div>
              {result.loan.outstanding > 0 && (
                <div className="mt-1 text-sm font-semibold text-slate-800">
                  {t("pvc.loan_drawn", { drawn: rupee(result.loan.outstanding), left: rupee(result.loan.available) })}
                </div>
              )}
              {result.loan.forecloses && (
                <div className="mt-1 text-sm font-semibold text-rose-800">
                  {t("pvc.forecloses", { pct: result.params.foreclosureAtPct.value })}
                </div>
              )}
            </div>
          )}

          {result.revival && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-black uppercase tracking-[0.2em] text-amber-900">
                {result.revival.expired ? t("pvc.revival_closed") : t("pvc.bring_back")}
              </div>
              <div className="mt-1 text-2xl font-bold text-amber-900">
                {rupee(result.revival.payable)}
                {result.revival.interest === null && (
                  <span className="ml-1 text-sm font-semibold">{t("pvc.plus_interest")}</span>
                )}
              </div>
              <div className="mt-1 text-sm text-slate-700">
                {t(result.revival.missedInstalments === 1 ? "pvc.missed_one" : "pvc.missed_many", { count: result.revival.missedInstalments, amount: rupee(result.revival.arrears) })}
                {result.revival.interest !== null && t("pvc.plus_interest_amt", { amount: rupee(result.revival.interest) })}.
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {result.revival.interest === null
                  ? result.revival.rateNote
                  : t("pvc.revival_rate", { rate: result.revival.ratePct ?? "" })}
              </div>
              <div
                className={
                  "mt-1 text-sm font-semibold " +
                  (result.revival.expired ? "text-rose-800" : "text-amber-900")
                }
              >
                {result.revival.expired
                  ? t("pvc.window_closed_on", { date: result.revival.deadline ?? "" })
                  : t("pvc.revive_by", { date: result.revival.deadline ?? t("pvc.window_end") })}
              </div>
            </div>
          )}
        </div>

        {/* The charge table and assumptions the whole schedule rests on. */}
        {relevant.length > 0 && (
          <div className="rounded-xl border border-slate-100">
            <button
              type="button"
              onClick={() => setShowParams((s) => !s)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <span className="text-sm font-bold text-slate-900">{t("pvc.charges")}</span>
              <span className="text-xs text-slate-500">
                {assumed === 0 ? t("pvc.all_read") : t("pvc.still_assumed", { count: assumed })}
                <span className="ml-2 text-slate-400">{showParams ? "▲" : "▼"}</span>
              </span>
            </button>
            {showParams && (
              <div className="space-y-3 border-t border-slate-100 p-4">
                <p className="text-xs text-slate-500">
                  {t("pvc.charges_desc")}
                </p>
                {relevant.map((key) => {
                  const p = params[key];
                  const scalar = typeof p.value === "number";
                  return (
                    <div key={String(key)} className="flex flex-wrap items-center gap-3">
                      <div className="min-w-[220px] flex-1 text-xs text-slate-600">
                        {tOr(t, `pvc.p_${String(key)}`, PARAM_LABELS[key] ?? String(key))}
                      </div>
                      {scalar ? (
                        <Input
                          type="number"
                          step="any"
                          defaultValue={String(p.value)}
                          onBlur={(e) => setParam(key, e.target.value)}
                          className="h-9 w-32 border-slate-200 bg-slate-50 text-sm"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">
                          {Array.isArray(p.value) ? t("pvc.rows", { count: p.value.length }) : t("pvc.table")}
                        </span>
                      )}
                      <span className={"rounded-full border px-2 py-0.5 text-xs font-semibold " + SOURCE_STYLE[p.source]}>
                        {t(SOURCE_KEY[p.source])}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-slate-100 pt-4">
          <div className="text-sm font-bold text-slate-900">{t("pvc.how")}</div>
          <p className="mt-1 text-xs text-slate-500">
            {t("pvc.how_desc")}
            {locale === "hi" && <> {t("pvc.steps_english")}</>}
          </p>
          <ul className="mt-3 space-y-1.5">
            {returnAtMaturity !== null && (
              <li className="text-xs text-slate-600">
                {t("pvc.how_return")}
              </li>
            )}
            {steps.map((s, i) => (
              <li key={i} className="text-xs text-slate-600">· {s}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
