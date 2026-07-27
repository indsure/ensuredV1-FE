"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Activity, Coins, AlertTriangle, Copy, Info } from "lucide-react";

export type UsageRow = {
  created_at: string;
  feature: string;
  model: string;
  source_type: string | null;
  actor_id: string | null;
  input_hash: string | null;
  prompt_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  est_cost_usd: number | null;
  status: string;
};

function fmtInt(n: number) {
  return n.toLocaleString("en-US");
}
function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}
function fmtUsd(n: number) {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

const FEATURE_LABELS: Record<string, string> = {
  policy_audit: "Health audit",
  wording_extract: "Compare (wording)",
  data_entry: "Data-entry OCR",
  image_ocr: "Image OCR",
  sach_ai: "Sach AI chat",
  portfolio_insights: "Portfolio insights",
  switch_reco: "Switch recommendation",
  ai_generate: "Other AI call",
};

export function UsageClient({ rows, rangeDays }: { rows: UsageRow[]; rangeDays: number }) {
  // Live cost override: token counts are exact, so you can plug in Gemini's
  // current rate here to see spend immediately without a redeploy.
  const [inRate, setInRate] = useState<number>(0);
  const [outRate, setOutRate] = useState<number>(0);
  const usePlugged = inRate > 0 || outRate > 0;

  const costOf = (r: UsageRow) =>
    usePlugged
      ? ((r.prompt_tokens ?? 0) / 1e6) * inRate + ((r.output_tokens ?? 0) / 1e6) * outRate
      : r.est_cost_usd ?? 0;

  const agg = useMemo(() => {
    let calls = 0, errors = 0, promptTok = 0, outputTok = 0, totalTok = 0, cost = 0;
    const byFeature = new Map<string, { calls: number; tokens: number; cost: number }>();
    const byDay = new Map<string, { calls: number; tokens: number; cost: number }>();
    const byActor = new Map<string, { source: string; calls: number; cost: number }>();
    const byHash = new Map<string, { feature: string; times: number; cost: number }>();

    for (const r of rows) {
      calls++;
      if (r.status === "error") errors++;
      const p = r.prompt_tokens ?? 0, o = r.output_tokens ?? 0, t = r.total_tokens ?? p + o;
      promptTok += p; outputTok += o; totalTok += t;
      const c = costOf(r); cost += c;

      const f = byFeature.get(r.feature) ?? { calls: 0, tokens: 0, cost: 0 };
      f.calls++; f.tokens += t; f.cost += c; byFeature.set(r.feature, f);

      const day = r.created_at.slice(0, 10);
      const d = byDay.get(day) ?? { calls: 0, tokens: 0, cost: 0 };
      d.calls++; d.tokens += t; d.cost += c; byDay.set(day, d);

      const actorKey = `${r.source_type ?? "unknown"}::${r.actor_id ?? "(none)"}`;
      const a = byActor.get(actorKey) ?? { source: r.source_type ?? "unknown", calls: 0, cost: 0 };
      a.calls++; a.cost += c; byActor.set(actorKey, a);

      if (r.input_hash && r.status === "ok") {
        const h = byHash.get(r.input_hash) ?? { feature: r.feature, times: 0, cost: 0 };
        h.times++; h.cost += c; byHash.set(r.input_hash, h);
      }
    }

    const duplicates = Array.from(byHash.entries())
      .filter(([, v]) => v.times > 1)
      .map(([hash, v]) => ({ hash, ...v, wasted: (v.cost / v.times) * (v.times - 1) }))
      .sort((a, b) => b.times - a.times)
      .slice(0, 25);

    const wastedTotal = duplicates.reduce((s, d) => s + d.wasted, 0);

    return {
      calls, errors, promptTok, outputTok, totalTok, cost,
      byFeature: Array.from(byFeature.entries()).map(([k, v]) => ({ feature: k, ...v })).sort((a, b) => b.cost - a.cost || b.calls - a.calls),
      byDay: Array.from(byDay.entries()).map(([k, v]) => ({ day: k, ...v })).sort((a, b) => (a.day < b.day ? 1 : -1)),
      topActors: Array.from(byActor.entries()).map(([k, v]) => ({ key: k, actor: k.split("::")[1], ...v })).sort((a, b) => b.calls - a.calls).slice(0, 15),
      duplicates,
      wastedTotal,
    };
  }, [rows, inRate, outRate]);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" /> Gemini Usage &amp; Cost
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Every Gemini call, last {rangeDays} days · token counts are exact from Gemini
          </p>
        </div>
        {/* Live rate plug-in */}
        <div className="flex items-end gap-3 bg-white border rounded-xl px-4 py-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Input $/1M</label>
            <input type="number" step="0.01" min={0} value={inRate || ""}
              onChange={(e) => setInRate(Number(e.target.value) || 0)}
              placeholder="0.00" className="mt-1 w-24 rounded-md border p-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Output $/1M</label>
            <input type="number" step="0.01" min={0} value={outRate || ""}
              onChange={(e) => setOutRate(Number(e.target.value) || 0)}
              placeholder="0.00" className="mt-1 w-24 rounded-md border p-1.5 text-sm" />
          </div>
        </div>
      </div>

      {!usePlugged && agg.cost === 0 && agg.calls > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          Cost shows $0 because no Gemini rate is configured. Set <code className="font-mono">GEMINI_PRICE_INPUT_PER_M</code> /{" "}
          <code className="font-mono">GEMINI_PRICE_OUTPUT_PER_M</code> on the backend, or type the current rate above to compute spend live from the exact token counts.
        </div>
      )}

      {/* Headline cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Total calls", value: fmtInt(agg.calls), sub: `${agg.errors} errors`, icon: Activity, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Total tokens", value: fmtTokens(agg.totalTok), sub: `${fmtTokens(agg.promptTok)} in / ${fmtTokens(agg.outputTok)} out`, icon: Coins, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Est. cost", value: fmtUsd(agg.cost), sub: usePlugged ? "at your rate" : "at configured rate", icon: Coins, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Duplicate calls", value: fmtInt(agg.duplicates.reduce((s, d) => s + (d.times - 1), 0)), sub: "same input re-sent", icon: Copy, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Wasted on dupes", value: fmtUsd(agg.wastedTotal), sub: "avoidable spend", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">{s.label}</span>
                  <div className={`p-1.5 rounded-lg ${s.bg}`}><Icon className={`h-4 w-4 ${s.color}`} /></div>
                </div>
                <div className="text-2xl font-bold text-slate-900">{s.value}</div>
                <div className="mt-1 text-xs text-slate-400">{s.sub}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* By feature */}
        <Card>
          <CardHeader><CardTitle className="text-base">Spend by feature</CardTitle></CardHeader>
          <CardContent className="p-0">
            <SimpleTable
              head={["Feature", "Calls", "Tokens", "Cost"]}
              rows={agg.byFeature.map((f) => [FEATURE_LABELS[f.feature] ?? f.feature, fmtInt(f.calls), fmtTokens(f.tokens), fmtUsd(f.cost)])}
              empty="No calls in range."
            />
          </CardContent>
        </Card>

        {/* By day */}
        <Card>
          <CardHeader><CardTitle className="text-base">By day</CardTitle></CardHeader>
          <CardContent className="p-0">
            <SimpleTable
              head={["Day", "Calls", "Tokens", "Cost"]}
              rows={agg.byDay.map((d) => [d.day, fmtInt(d.calls), fmtTokens(d.tokens), fmtUsd(d.cost)])}
              empty="No calls in range."
            />
          </CardContent>
        </Card>
      </div>

      {/* Top actors — spot one IP / agent driving spend */}
      <Card>
        <CardHeader><CardTitle className="text-base">Top callers (anonymous = hashed IP)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <SimpleTable
            head={["Source", "Actor", "Calls", "Cost"]}
            rows={agg.topActors.map((a) => [a.source, a.actor, fmtInt(a.calls), fmtUsd(a.cost)])}
            empty="No callers in range."
          />
        </CardContent>
      </Card>

      {/* Duplicates — the double-processing money leak */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Copy className="h-4 w-4 text-orange-500" /> Duplicate spend (identical input billed more than once)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <SimpleTable
            head={["Input hash", "Feature", "Times", "Avoidable"]}
            rows={agg.duplicates.map((d) => [
              d.hash.slice(0, 12) + "…",
              FEATURE_LABELS[d.feature] ?? d.feature,
              `${d.times}×`,
              fmtUsd(d.wasted),
            ])}
            empty="No duplicate inputs 🎉"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SimpleTable({ head, rows, empty }: { head: string[]; rows: (string | number)[][]; empty: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-y">
          <tr className="text-left">
            {head.map((h, i) => (
              <th key={h} className={`px-5 py-3 font-medium text-slate-500 ${i === 0 ? "" : "text-right"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={head.length} className="px-5 py-8 text-center text-slate-400 italic">{empty}</td></tr>
          ) : (
            rows.map((r, ri) => (
              <tr key={ri} className="border-b last:border-0 hover:bg-slate-50/50">
                {r.map((cell, ci) => (
                  <td key={ci} className={`px-5 py-3 ${ci === 0 ? "text-slate-700 font-medium" : "text-right text-slate-600 font-mono text-xs"}`}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
