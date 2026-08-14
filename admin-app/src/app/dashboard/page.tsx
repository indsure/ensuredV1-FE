import { AppShell } from "@/components/AppShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { supabaseAdmin } from "@/lib/supabase";
import {
  Users,
  FileText,
  BarChart2,
  Ticket,
  TrendingUp,
  Zap,
  UserCheck,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

async function getStats() {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

  const [
    agents,
    policies,
    analyses,
    inviteCodes,
    agentsThisMonth,
    agentsLastMonth,
    policiesThisMonth,
    analysesThisMonth,
    activatedAgents,
    credits,
  ] = await Promise.all([
    supabaseAdmin.from("agents").select("id", { count: "exact", head: true }),
    // Uploaded policies live in `clients` (one row per PDF + its analysis), read
    // here through the correctly-named `policy_analyses` alias. The `policies`
    // table this used to read is abandoned March-2026 test data and has no
    // agent_id column at all, so the activation query below silently errored.
    supabaseAdmin.from("policy_analyses").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("analysis_jobs").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("invite_codes").select("id, used_by", { count: "exact" }),
    supabaseAdmin
      .from("agents")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfThisMonth),
    supabaseAdmin
      .from("agents")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfLastMonth)
      .lt("created_at", startOfThisMonth),
    supabaseAdmin
      .from("policy_analyses")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfThisMonth),
    supabaseAdmin
      .from("analysis_jobs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfThisMonth),
    // agents who have at least 1 policy — distinct agent_ids in policy_analyses
    supabaseAdmin.from("policy_analyses").select("agent_id").limit(10000),
    supabaseAdmin.from("agent_credits").select("balance").limit(10000),
  ]);

  const usedCodes = inviteCodes.data?.filter((c) => c.used_by).length ?? 0;
  const totalCodes = inviteCodes.count ?? 0;
  const totalAgents = agents.count ?? 0;
  const totalPolicies = policies.count ?? 0;
  const totalAnalyses = analyses.count ?? 0;

  const thisMonthAgents = agentsThisMonth.count ?? 0;
  const lastMonthAgents = agentsLastMonth.count ?? 0;
  const momGrowthPct =
    lastMonthAgents === 0
      ? thisMonthAgents > 0
        ? 100
        : 0
      : Math.round(((thisMonthAgents - lastMonthAgents) / lastMonthAgents) * 100);

  const activatedSet = new Set(activatedAgents.data?.map((p) => p.agent_id) ?? []);
  const activatedCount = activatedSet.size;
  const activationRate = totalAgents === 0 ? 0 : Math.round((activatedCount / totalAgents) * 100);

  const avgPoliciesPerAgent = totalAgents === 0 ? 0 : (totalPolicies / totalAgents).toFixed(1);
  const avgAnalysesPerAgent = totalAgents === 0 ? 0 : (totalAnalyses / totalAgents).toFixed(1);

  const totalCredits = (credits.data ?? []).reduce((sum, r) => sum + (r.balance ?? 0), 0);
  const inviteConversion = totalCodes === 0 ? 0 : Math.round((usedCodes / totalCodes) * 100);

  return {
    totalAgents,
    totalPolicies,
    totalAnalyses,
    usedCodes,
    totalCodes,
    thisMonthAgents,
    lastMonthAgents,
    momGrowthPct,
    policiesThisMonth: policiesThisMonth.count ?? 0,
    analysesThisMonth: analysesThisMonth.count ?? 0,
    activatedCount,
    activationRate,
    avgPoliciesPerAgent,
    avgAnalysesPerAgent,
    totalCredits,
    inviteConversion,
  };
}

async function getRecentAgents() {
  const { data } = await supabaseAdmin
    .from("agents")
    .select("id, full_name, email, created_at")
    .order("created_at", { ascending: false })
    .limit(8);
  return data ?? [];
}

function GrowthBadge({ pct }: { pct: number }) {
  if (pct > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
        <ArrowUpRight className="h-3 w-3" />
        {pct}% MoM
      </span>
    );
  if (pct < 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-500">
        <ArrowDownRight className="h-3 w-3" />
        {Math.abs(pct)}% MoM
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-400">
      <Minus className="h-3 w-3" />
      New
    </span>
  );
}

function StatRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between py-3 border-b last:border-0">
      <span className="text-sm text-slate-500 leading-tight max-w-[55%]">{label}</span>
      <div className="text-right">
        <div className="text-sm font-bold text-slate-900">{value}</div>
        {sub && <div className="mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const [stats, recentAgents] = await Promise.all([getStats(), getRecentAgents()]);

  const statCards = [
    {
      label: "Total Agents",
      value: stats.totalAgents,
      sub: `+${stats.thisMonthAgents} this month`,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Policies Uploaded",
      value: stats.totalPolicies,
      sub: `+${stats.policiesThisMonth} this month`,
      icon: FileText,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Analyses Run",
      value: stats.totalAnalyses,
      sub: `+${stats.analysesThisMonth} this month`,
      icon: BarChart2,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Invite Codes Used",
      value: `${stats.usedCodes} / ${stats.totalCodes}`,
      sub: `${stats.inviteConversion}% conversion`,
      icon: Ticket,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time overview of IndSure platform activity</p>
        </div>

        {/* Top stat cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-500">{stat.label}</span>
                    <div className={`p-1.5 rounded-lg ${stat.bg}`}>
                      <Icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-slate-900">{stat.value}</div>
                  <div className="mt-1 text-xs text-slate-400">{stat.sub}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main content: recent agents + stats column */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent agents — takes 2/3 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recently Joined Agents</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-y">
                  <tr className="text-left">
                    <th className="px-6 py-3 font-medium text-slate-500">Name</th>
                    <th className="px-6 py-3 font-medium text-slate-500">Email</th>
                    <th className="px-6 py-3 font-medium text-slate-500">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAgents.map((agent) => (
                    <tr key={agent.id} className="border-b last:border-0 hover:bg-slate-50/50">
                      <td className="px-6 py-3.5 font-medium text-slate-900">{agent.full_name || "—"}</td>
                      <td className="px-6 py-3.5 text-slate-500">{agent.email}</td>
                      <td className="px-6 py-3.5 text-slate-400 whitespace-nowrap">
                        {new Date(agent.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                  {recentAgents.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-slate-400">
                        No agents yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Stats column — takes 1/3 */}
          <div className="space-y-4">
            {/* Growth */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Growth
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <StatRow
                  label="New agents this month"
                  value={stats.thisMonthAgents}
                  sub={<GrowthBadge pct={stats.momGrowthPct} />}
                />
                <StatRow label="Last month" value={stats.lastMonthAgents} />
              </CardContent>
            </Card>

            {/* Activation */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-blue-500" />
                  Activation
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <StatRow
                  label="Activated agents"
                  value={`${stats.activatedCount} / ${stats.totalAgents}`}
                  sub={
                    <span className="text-xs font-semibold text-blue-600">
                      {stats.activationRate}% rate
                    </span>
                  }
                />
                {/* activation bar */}
                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                  <div
                    className="h-1.5 rounded-full bg-blue-500 transition-all"
                    style={{ width: `${stats.activationRate}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Engagement */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-purple-500" />
                  Engagement
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <StatRow label="Avg policies / agent" value={stats.avgPoliciesPerAgent} />
                <StatRow label="Avg analyses / agent" value={stats.avgAnalysesPerAgent} />
                <StatRow
                  label="Invite conversion"
                  value={`${stats.inviteConversion}%`}
                  sub={
                    <span className="text-xs text-slate-400">
                      {stats.usedCodes} of {stats.totalCodes} codes
                    </span>
                  }
                />
              </CardContent>
            </Card>

            {/* Platform */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Coins className="h-4 w-4 text-amber-500" />
                  Platform
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <StatRow
                  label="Total credits in system"
                  value={stats.totalCredits.toLocaleString("en-IN")}
                />
                <StatRow
                  label="Avg credits / agent"
                  value={
                    stats.totalAgents === 0
                      ? "0"
                      : Math.round(stats.totalCredits / stats.totalAgents).toLocaleString("en-IN")
                  }
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
