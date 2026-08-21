import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceArea, ReferenceLine,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { getApiBase } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import {
  computePolicyValue, isValueGap, PLAN_SHAPE_LABELS, PLAN_SHAPE_OPTIONS,
  type PlanShape,
} from "@/lib/policyValue";

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

interface Props {
  clientId: string;
  insuranceType: string;
  data: Record<string, any> | null | undefined;
  onSaved?: () => void;
}

export default function PolicyValueChart({ clientId, insuranceType, data, onSaved }: Props) {
  const result = useMemo(() => computePolicyValue(insuranceType, data ?? null), [insuranceType, data]);
  const [saving, setSaving] = useState(false);

  const term = !isValueGap(result) ? result.term : 1;
  const [year, setYear] = useState(1);
  const yr = Math.min(year, term);

  async function setPlanType(shape: PlanShape) {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      // The endpoint replaces extracted_data, so send the whole object back.
      const payload = { ...(data ?? {}), plan_type: PLAN_SHAPE_LABELS[shape] };
      const res = await fetch(`${getApiBase()}/api/agent/clients/${clientId}/extracted-data`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ extracted_data: payload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Save failed");
      }
      toast({ variant: "success", title: "Plan type saved" });
      onSaved?.();
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: e instanceof Error ? e.message : "Could not save the plan type.",
      });
    } finally {
      setSaving(false);
    }
  }

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

  const { shape, rows, totalPremiums, maturity, lockInYears, lockInEnds, guaranteed, steps, assumptions } = result;
  const row = rows[yr - 1];

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
        title: `All ${rupee(totalPremiums)} of the premiums come back at the end.`,
        body: `Stop earlier and only the guaranteed surrender value is paid, which stays below the premiums ` +
          `paid until close to the end of the term.`,
      };
    if (shape === "endowment")
      return {
        title: `About ${short(maturity)} at maturity, on ${rupee(totalPremiums)} of premiums.`,
        body: `Surrender before the end pays the higher of the guaranteed value and the paid-up value, both ` +
          `well below the premiums paid for most of the term.`,
      };
    return {
      title: lockInEnds ? `The money is locked until ${lockInEnds}.` : "The money is locked in.",
      body: `For the first ${lockInYears} policy years nothing can be paid out. On surrender the fund moves to ` +
        `the discontinued fund, earns 4% a year and reaches the customer only after that date.`,
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
        {/* Plan type drives the whole calculation, so it is the first thing to confirm. */}
        <div>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Plan type</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLAN_SHAPE_OPTIONS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                disabled={saving}
                onClick={() => void setPlanType(key)}
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
            {lockInYears && (
              <span className="flex items-center gap-2">
                <span className="w-5 border-t-[3px] border-dashed" style={{ borderColor: BACK }} />
                Not payable yet
              </span>
            )}
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
                {lockInYears && (
                  <ReferenceArea x1={1} x2={lockInYears} fill="#0f172a" fillOpacity={0.04} />
                )}
                <ReferenceLine x={yr} stroke="#94a3b8" strokeWidth={1} />
                <Line type="monotone" dataKey="paid" stroke={PAID} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="back" stroke={BACK} strokeWidth={2} dot={false} />
                {lockInYears && (
                  <Line type="monotone" dataKey="locked" stroke={BACK} strokeWidth={2}
                    strokeDasharray="5 5" dot={false} connectNulls={false} />
                )}
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

        <div className="grid gap-4 md:grid-cols-3">
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
            <div className="mt-1 text-xs text-slate-500">{row.note}</div>
          </div>
          <div className="rounded-xl border border-slate-100 p-4">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Family gets on death</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: COVER }}>{rupee(row.cover)}</div>
            <div className="mt-1 text-xs text-slate-500">
              {row.deferredTo ? `Cover stops if the policy is surrendered.` : `Cover while the policy is in force.`}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="text-sm font-bold text-slate-900">How this was worked out</div>
          <p className="mt-1 text-xs text-slate-500">
            Every figure is arithmetic on the fields read from the document. Nothing is estimated, and the same
            document always gives the same numbers.
          </p>
          <ul className="mt-3 space-y-1.5">
            {steps.map((s, i) => (
              <li key={i} className="text-xs text-slate-600">· {s}</li>
            ))}
          </ul>

          {!guaranteed && assumptions.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-3">
              <div className="text-xs font-bold text-amber-900">Not guaranteed</div>
              <ul className="mt-1 space-y-1">
                {assumptions.map((a, i) => (
                  <li key={i} className="text-xs text-amber-800">· {a}</li>
                ))}
              </ul>
            </div>
          )}
          {guaranteed && assumptions.length > 0 && (
            <ul className="mt-3 space-y-1">
              {assumptions.map((a, i) => (
                <li key={i} className="text-xs text-slate-400">· {a}</li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
