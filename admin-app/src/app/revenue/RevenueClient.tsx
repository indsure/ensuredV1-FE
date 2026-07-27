"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { TrendingUp, IndianRupee, Users, Zap, Info } from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const CREDIT_PRICE_INR = 100;

type Snapshot = {
  totalAgents: number;
  totalCredits: number;
  avgCreditsPerAgent: number;
  agentsThisMonth: number;
  agentsLastMonth: number;
};

function fmtRupee(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)} L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtAxis(n: number) {
  if (n >= 100_000) return `${(n / 100_000).toFixed(0)}L`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

function fmtCredits(n: number) {
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl space-y-1 min-w-[160px]">
      <p className="font-semibold text-sm">{label}</p>
      <p>Revenue: <span className="font-bold text-emerald-400">{fmtRupee(d.revenue)}</span></p>
      <p>Agents: <span className="font-medium">{d.agents?.toLocaleString("en-IN")}</span></p>
      <p>Credits: <span className="font-medium">{fmtCredits(d.credits)}</span></p>
    </div>
  );
}

export function RevenueClient({ snapshot }: { snapshot: Snapshot }) {
  const defaultGrowth =
    snapshot.agentsLastMonth === 0
      ? 15
      : Math.max(5, Math.min(50, Math.round(
          ((snapshot.agentsThisMonth - snapshot.agentsLastMonth) / Math.max(1, snapshot.agentsLastMonth)) * 100
        )));

  const [monthlyGrowthRate, setMonthlyGrowthRate] = useState(defaultGrowth);
  const [creditsPerAgent, setCreditsPerAgent] = useState(
    Math.max(1, Math.round(snapshot.avgCreditsPerAgent || 10))
  );

  const currentMRR = snapshot.totalCredits * CREDIT_PRICE_INR;
  const currentARR = currentMRR * 12;

  const projection = useMemo(() => {
    const now = new Date();
    const rows = [];
    let agents = snapshot.totalAgents;
    let cumulativeCredits = snapshot.totalCredits;

    for (let i = 1; i <= 12; i++) {
      const monthIdx = (now.getMonth() + i) % 12;
      const year = now.getFullYear() + Math.floor((now.getMonth() + i) / 12);
      const newAgents = Math.round(agents * (monthlyGrowthRate / 100));
      agents = agents + newAgents;
      const monthlyCredits = agents * creditsPerAgent;
      cumulativeCredits += monthlyCredits;
      const revenue = monthlyCredits * CREDIT_PRICE_INR;
      rows.push({
        label: `${MONTHS[monthIdx]} '${String(year).slice(2)}`,
        agents,
        newAgents,
        credits: monthlyCredits,
        revenue,
        cumulative: cumulativeCredits * CREDIT_PRICE_INR,
        isLast: i === 12,
      });
    }
    return rows;
  }, [snapshot.totalAgents, snapshot.totalCredits, monthlyGrowthRate, creditsPerAgent]);

  const chartData = [
    { label: "Now", revenue: currentMRR, agents: snapshot.totalAgents, credits: snapshot.totalCredits, isNow: true },
    ...projection.map((r) => ({ ...r, isNow: false })),
  ];

  const month12 = projection[11];
  const projectedARR = (month12?.revenue ?? 0) * 12;
  const totalRevenue = month12?.cumulative ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Revenue Projector</h1>
        <p className="text-sm text-slate-500 mt-1">
          Forward-looking revenue model · ₹{CREDIT_PRICE_INR} per credit
        </p>
      </div>

      {/* Snapshot cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Credits in System", value: fmtCredits(snapshot.totalCredits), sub: "today", icon: Zap, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Current MRR", value: fmtRupee(currentMRR), sub: "credits × ₹100", icon: IndianRupee, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Current ARR", value: fmtRupee(currentARR), sub: "annualised", icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Active Agents", value: snapshot.totalAgents, sub: `+${snapshot.agentsThisMonth} this month`, icon: Users, color: "text-orange-600", bg: "bg-orange-50" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-500">{s.label}</span>
                  <div className={`p-1.5 rounded-lg ${s.bg}`}>
                    <Icon className={`h-4 w-4 ${s.color}`} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-slate-900">{s.value}</div>
                <div className="mt-1 text-xs text-slate-400">{s.sub}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Assumptions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Projection Assumptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-slate-700">Monthly Agent Growth Rate</label>
                <span className="text-2xl font-bold text-blue-600">{monthlyGrowthRate}%</span>
              </div>
              <input
                type="range" min={1} max={100} value={monthlyGrowthRate}
                onChange={(e) => setMonthlyGrowthRate(Number(e.target.value))}
                className="w-full accent-blue-600 h-2 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1.5">
                <span>1% flat</span><span>50% aggressive</span><span>100% hypergrowth</span>
              </div>
              <p className="text-xs text-slate-400 mt-2.5 flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-400" />
                Pre-filled from your actual last 2 months: {defaultGrowth}% MoM
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-slate-700">Avg Credits / Agent / Month</label>
                <span className="text-2xl font-bold text-purple-600">{creditsPerAgent}</span>
              </div>
              <input
                type="range" min={1} max={200} value={creditsPerAgent}
                onChange={(e) => setCreditsPerAgent(Number(e.target.value))}
                className="w-full accent-purple-600 h-2 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1.5">
                <span>1</span><span>100</span><span>200 credits</span>
              </div>
              <p className="text-xs text-slate-400 mt-2.5 flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-purple-400" />
                Current platform avg: {Math.round(snapshot.avgCreditsPerAgent || 0)} credits/agent
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Headline projections */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-emerald-400">
          <CardContent className="p-6">
            <div className="text-xs font-semibold uppercase tracking-widest text-emerald-600 mb-2">Month 12 MRR</div>
            <div className="text-3xl font-bold text-slate-900">{fmtRupee(month12?.revenue ?? 0)}</div>
            <div className="text-xs text-slate-400 mt-1.5">
              {month12?.agents.toLocaleString("en-IN")} agents × {creditsPerAgent} credits × ₹100
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="p-6">
            <div className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-2">Projected ARR</div>
            <div className="text-3xl font-bold text-slate-900">{fmtRupee(projectedARR)}</div>
            <div className="text-xs text-slate-400 mt-1.5">Month 12 MRR × 12</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-400">
          <CardContent className="p-6">
            <div className="text-xs font-semibold uppercase tracking-widest text-purple-600 mb-2">Total 12-Month Revenue</div>
            <div className="text-3xl font-bold text-slate-900">{fmtRupee(totalRevenue)}</div>
            <div className="text-xs text-slate-400 mt-1.5">Cumulative over all 12 months</div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">12-Month Revenue Forecast</CardTitle>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-300 inline-block" /> Today</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-400 inline-block" /> Projected</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Month 12</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={fmtAxis}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]} isAnimationActive={true}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={
                      entry.isNow
                        ? "#cbd5e1"
                        : entry.isLast
                        ? "#10b981"
                        : "#60a5fa"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Month-by-Month Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y">
                <tr className="text-left">
                  <th className="px-5 py-3 font-medium text-slate-500">Month</th>
                  <th className="px-5 py-3 font-medium text-slate-500 text-right">Agents</th>
                  <th className="px-5 py-3 font-medium text-slate-500 text-right">New</th>
                  <th className="px-5 py-3 font-medium text-slate-500 text-right">Credits Used</th>
                  <th className="px-5 py-3 font-medium text-slate-500 text-right">Monthly Revenue</th>
                  <th className="px-5 py-3 font-medium text-slate-500 text-right">Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {projection.map((row, i) => (
                  <tr
                    key={row.label}
                    className={`border-b last:border-0 ${
                      i === 11
                        ? "bg-emerald-50 font-semibold"
                        : "hover:bg-slate-50/50"
                    }`}
                  >
                    <td className="px-5 py-3 text-slate-700">{row.label}</td>
                    <td className="px-5 py-3 text-right text-slate-700">{row.agents.toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3 text-right text-emerald-600 font-medium">+{row.newAgents}</td>
                    <td className="px-5 py-3 text-right text-slate-500">{fmtCredits(row.credits)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-900">{fmtRupee(row.revenue)}</td>
                    <td className="px-5 py-3 text-right text-slate-400">{fmtRupee(row.cumulative)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400 text-center pb-2">
        Projections are model estimates based on current platform data and selected assumptions · ₹100/credit fixed
      </p>
    </div>
  );
}
