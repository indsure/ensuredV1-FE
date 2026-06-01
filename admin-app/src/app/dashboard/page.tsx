import { AppShell } from "@/components/AppShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { supabaseAdmin } from "@/lib/supabase";
import { Users, FileText, BarChart2, Ticket } from "lucide-react";

async function getStats() {
  const [agents, policies, analyses, inviteCodes] = await Promise.all([
    supabaseAdmin.from("agents").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("policies").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("analysis_jobs").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("invite_codes").select("id, used_by", { count: "exact" }),
  ]);

  const usedCodes = inviteCodes.data?.filter((c) => c.used_by).length ?? 0;
  const totalCodes = inviteCodes.count ?? 0;

  return {
    totalAgents: agents.count ?? 0,
    totalPolicies: policies.count ?? 0,
    totalAnalyses: analyses.count ?? 0,
    usedCodes,
    totalCodes,
  };
}

async function getRecentAgents() {
  const { data } = await supabaseAdmin
    .from("agents")
    .select("id, full_name, email, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  return data ?? [];
}

export default async function DashboardPage() {
  const [stats, recentAgents] = await Promise.all([getStats(), getRecentAgents()]);

  const statCards = [
    { label: "Total Agents", value: stats.totalAgents, icon: Users, color: "text-blue-600" },
    { label: "Policies Uploaded", value: stats.totalPolicies, icon: FileText, color: "text-green-600" },
    { label: "Analyses Run", value: stats.totalAnalyses, icon: BarChart2, color: "text-purple-600" },
    {
      label: "Invite Codes Used",
      value: `${stats.usedCodes} / ${stats.totalCodes}`,
      icon: Ticket,
      color: "text-orange-600",
    },
  ];

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time overview of IndSure platform activity</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-500">{stat.label}</span>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div className="text-3xl font-bold text-slate-900">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
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
                  <tr key={agent.id} className="border-b last:border-0">
                    <td className="px-6 py-4 font-medium text-slate-900">{agent.full_name || "—"}</td>
                    <td className="px-6 py-4 text-slate-500">{agent.email}</td>
                    <td className="px-6 py-4 text-slate-500">
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
      </div>
    </AppShell>
  );
}
