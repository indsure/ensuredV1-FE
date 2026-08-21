import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceArea, ReferenceLine,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { isPlaygroundMode } from "@/lib/playground/mode";
import { getApiBase } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
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
const SOURCE_LABEL: Record<ParamSource, string> = {
  document: "From the document",
  entered: "You entered",
  default: "Assumed",
};

interface Props {
  clientId: string;
  insuranceType: string;
  data: Record<string, any> | null | undefined;
  onSaved?: () => void;
}

export default function PolicyValueChart({ clientId, insuranceType, data, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [showParams, setShowParams] = useState(false);
  // Applied locally first so the chart redraws immediately, and so the controls
  // still work in playground, which has no backend to PATCH.
  const [patch, setPatch] = useState<Record<string, any>>({});

  const effective = useMemo(() => ({ ...(data ?? {}), ...patch }), [data, patch]);
  const result = useMemo(() => computePolicyValue(insuranceType, effective), [insuranceType, effective]);

  const term = !isValueGap(result) ? result.term : 1;
  const [year, setYear] = useState(1);
  const yr = Math.min(year, term);

  async function persist(next: Record<string, any>) {
    setPatch((p) => ({ ...p, ...next }));
    if (isPlaygroundMode()) return; // demo mode: nothing is persisted anywhere
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      // The endpoint replaces extracted_data, so send the whole object back.
      const payload = { ...(data ?? {}), ...patch, ...next };
      const res = await fetch(`${getApiBase()}/api/agent/clients/${clientId}/extracted-data`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ extracted_data: payload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Save failed");
      }
      toast({ variant: "success", title: "Saved" });
      onSaved?.();
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: e instanceof Error ? e.message : "Could not save.",
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
          <CardTitle>What the customer gets back</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-sm text-slate-600">
            To work out the surrender value and maturity benefit we still need
            {result.missing.length === 1 ? " this field" : " these fields"} filled in above:
          </p>
          <ul className="mt-3 space-y-1">
            {result.missing.map((m) => (
              <li key={m} className="text-sm font-semibold text-slate-900">· {m}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-400">
            Nothing is guessed here — without these the numbers would be made up, so we show nothing instead.
          </p>
        </CardContent>
      </Card>
    );
  }

  const {
    shape, rows, params, totalPremiums, maturity, lockInYears, lockInEnds,
    steps, illustratedMaturity, reconciliation, irrAtMaturity,
  } = result;
  const row = rows[yr - 1];
  const relevant = RELEVANT_PARAMS[shape] ?? [];
  const assumed = assumedCount(params, shape);

  const chartData = rows.map((r) => ({
    year: r.year,
    paid: Math.round(r.paid),
    back: Math.round(r.back),
    locked: r.deferredTo ? Math.round(r.back) : null,
    cover: Math.round(r.cover),
  }));

  const verdict = (() => {
    if (shape === "pure_term")
      return {
        title: "Nothing comes back. That is what this policy is.",
        body: `This is term cover. There is no surrender value at any point and no maturity benefit, so if the ` +
          `customer stops paying or outlives the policy they receive nothing. What they are buying is ` +
          `${short(rows[0].cover)} of cover, for ${rupee(totalPremiums)} of premiums in total.`,
      };
    if (shape === "return_of_premium")
      return {
        title: `All ${rupee(totalPremiums)} of the premiums come back at the end` +
          (irrAtMaturity !== null ? `, a return of ${pct(irrAtMaturity)} a year.` : "."),
        body: `Stop earlier and only the guaranteed surrender value is paid, which stays below the premiums ` +
          `paid until close to the end of the term.`,
      };
    if (shape === "endowment")
      return {
        title: `About ${short(maturity)} at maturity, on ${rupee(totalPremiums)} of premiums` +
          (irrAtMaturity !== null ? ` — a return of ${pct(irrAtMaturity)} a year.` : "."),
        body: `Surrender before the end pays the higher of the guaranteed value and the paid-up value, both ` +
          `well below the premiums paid for most of the term.`,
      };
    return {
      title: lockInEnds ? `The money is locked until ${lockInEnds}.` : "The money is locked in.",
      body: `For the first ${lockInYears} policy years nothing can be paid out. On surrender the fund moves to ` +
        `the discontinued fund, earns ${params.discontinuedFundRatePct.value}% a year and reaches the customer only after that date.`,
    };
  })();

  return (
    <Card className="border-slate-100 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 pb-4">
        <CardTitle>What the customer gets back</CardTitle>
        <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
          Calculated from the document
        </span>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
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
              <>Matches the illustration in the policy document ({rupee(illustratedMaturity!)} at maturity).</>
            ) : (
              <>
                The document's own illustration says {rupee(illustratedMaturity!)} at maturity — this works out
                to {rupee(maturity)}, a difference of {reconciliation.pct > 0 ? "+" : ""}
                {reconciliation.pct.toFixed(1)}%. Check the charges below against the policy wording.
              </>
            )}
          </div>
        )}

        {/* Plan type drives the whole calculation, so it is the first thing to confirm. */}
        <div>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Plan type</div>
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
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            This decides the whole calculation. If it is wrong, correct it here and everything below updates.
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
          <div className="text-base font-bold text-slate-900">{verdict.title}</div>
          <p className="mt-1 text-sm text-slate-600">{verdict.body}</p>
        </div>

        {/* Money in vs money back. Cover sits in its own strip below: at crore
            scale it would flatten the premium line to nothing. */}
        <div>
          <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-2">
              <span className="h-[3px] w-5 rounded" style={{ background: PAID }} />Money paid
            </span>
            <span className="flex items-center gap-2">
              <span className="h-[3px] w-5 rounded" style={{ background: BACK }} />Money back if they stop
            </span>
            {lockInYears ? (
              <span className="flex items-center gap-2">
                <span className="w-5 border-t-[3px] border-dashed" style={{ borderColor: BACK }} />
                Not payable yet
              </span>
            ) : null}
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="year" axisLine={false} tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }} dy={6} />
                <YAxis axisLine={false} tickLine={false} width={64}
                  tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={short} />
                <Tooltip
                  formatter={(v: any, n: any) => [rupee(Number(v)), n === "paid" ? "Money paid" : "Money back"]}
                  labelFormatter={(l) => `Policy year ${l}`}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                {lockInYears ? (
                  <ReferenceArea x1={1} x2={lockInYears} fill="#0f172a" fillOpacity={0.04} />
                ) : null}
                <ReferenceLine x={yr} stroke="#94a3b8" strokeWidth={1} />
                <Line type="monotone" dataKey="paid" stroke={PAID} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="back" stroke={BACK} strokeWidth={2} dot={false} />
                {lockInYears ? (
                  // isAnimationActive must stay off: recharts drives its line-draw
                  // animation through stroke-dasharray and would overwrite ours.
                  <Line type="monotone" dataKey="locked" stroke={BACK} strokeWidth={2}
                    strokeDasharray="5 5" dot={false} connectNulls={false}
                    isAnimationActive={false} />
                ) : null}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mb-1 mt-4 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Cover for the family, same years
          </div>
          <div className="h-[92px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 16, left: -12, bottom: 0 }}>
                <XAxis dataKey="year" hide />
                <YAxis hide domain={[0, "dataMax"]} width={64} />
                <Tooltip
                  formatter={(v: any) => [rupee(Number(v)), "Cover"]}
                  labelFormatter={(l) => `Policy year ${l}`}
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
            Policy year {row.year} of {term}
            {row.age !== null ? ` — age ${row.age}` : ""}. Drag to move through the policy.
          </label>
          <input
            id="policy-year"
            type="range"
            min={1}
            max={term}
            value={yr}
            onChange={(e) => setYear(Number(e.target.value))}
            className="mt-2 w-full accent-[#0D9488]"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-100 p-4">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Paid by then</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: PAID }}>{rupee(row.paid)}</div>
            <div className="mt-1 text-xs text-slate-500">
              {row.year >= result.ppt ? `All ${result.ppt} premiums paid.` : `${row.year} of ${result.ppt} premiums paid.`}
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 p-4">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Gets back if they stop</div>
            <div className={"mt-1 text-2xl font-bold " + (row.back > 0 ? "" : "text-slate-400")}
              style={row.back > 0 ? { color: BACK } : undefined}>
              {row.back > 0 ? rupee(row.back) : "Nothing"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {row.penalty > 0 ? `After a ${rupee(row.penalty)} discontinuance charge. ` : ""}{row.note}
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 p-4">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Return if they stop here</div>
            <div className={"mt-1 text-2xl font-bold " + (row.irr === null ? "text-slate-400" : row.irr < 0 ? "text-amber-700" : "text-slate-900")}>
              {row.irr === null ? "No return" : pct(row.irr)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {row.irr === null
                ? "Nothing comes back, so there is no return to measure."
                : row.irr < 0
                ? "A loss. They get back less than they put in."
                : "A year, on the money actually paid in. Compare it with a fixed deposit."}
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 p-4">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Family gets on death</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: COVER }}>{rupee(row.cover)}</div>
            <div className="mt-1 text-xs text-slate-500">
              {row.deferredTo ? "Cover stops if the policy is surrendered." : "Cover while the policy is in force."}
            </div>
          </div>
        </div>

        {/* The charge table and assumptions the whole schedule rests on. */}
        {relevant.length > 0 && (
          <div className="rounded-xl border border-slate-100">
            <button
              type="button"
              onClick={() => setShowParams((s) => !s)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <span className="text-sm font-bold text-slate-900">Charges and assumptions</span>
              <span className="text-xs text-slate-500">
                {assumed === 0 ? "All read from the document" : `${assumed} still assumed — tap to set`}
                <span className="ml-2 text-slate-400">{showParams ? "▲" : "▼"}</span>
              </span>
            </button>
            {showParams && (
              <div className="space-y-3 border-t border-slate-100 p-4">
                <p className="text-xs text-slate-500">
                  These come from the policy wording where it states them. Anything marked "assumed" is a
                  standard value we applied so the schedule could be drawn — set it from the customer's
                  document and the numbers become exact.
                </p>
                {relevant.map((key) => {
                  const p = params[key];
                  const scalar = typeof p.value === "number";
                  return (
                    <div key={String(key)} className="flex flex-wrap items-center gap-3">
                      <div className="min-w-[220px] flex-1 text-xs text-slate-600">
                        {PARAM_LABELS[key] ?? String(key)}
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
                          {Array.isArray(p.value) ? `${p.value.length} rows` : "table"}
                        </span>
                      )}
                      <span className={"rounded-full border px-2 py-0.5 text-[10px] font-semibold " + SOURCE_STYLE[p.source]}>
                        {SOURCE_LABEL[p.source]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-slate-100 pt-4">
          <div className="text-sm font-bold text-slate-900">How this was worked out</div>
          <p className="mt-1 text-xs text-slate-500">
            Every figure is arithmetic on the fields read from the document and the charges above. Nothing is
            estimated, and the same document always gives the same numbers.
          </p>
          <ul className="mt-3 space-y-1.5">
            {irrAtMaturity !== null && (
              <li className="text-xs text-slate-600">
                · Return = the rate at which the premiums actually paid, year by year, grow into the payout
                (internal rate of return). A plain average over total premiums would overstate it, because a
                premium paid late has not been invested for the whole term.
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
