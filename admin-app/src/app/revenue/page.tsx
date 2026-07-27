import { AppShell } from "@/components/AppShell";
import { supabaseAdmin } from "@/lib/supabase";
import { RevenueClient } from "./RevenueClient";

async function getSnapshot() {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

  const [agents, agentsThisMonth, agentsLastMonth, credits] = await Promise.all([
    supabaseAdmin.from("agents").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("agents")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfThisMonth),
    supabaseAdmin
      .from("agents")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfLastMonth)
      .lt("created_at", startOfThisMonth),
    supabaseAdmin.from("agent_credits").select("balance").limit(10000),
  ]);

  const totalAgents = agents.count ?? 0;
  const creditData = credits.data ?? [];
  const totalCredits = creditData.reduce((sum, r) => sum + (r.balance ?? 0), 0);
  const avgCreditsPerAgent = totalAgents === 0 ? 0 : totalCredits / totalAgents;

  return {
    totalAgents,
    totalCredits,
    avgCreditsPerAgent,
    agentsThisMonth: agentsThisMonth.count ?? 0,
    agentsLastMonth: agentsLastMonth.count ?? 0,
  };
}

export default async function RevenuePage() {
  const snapshot = await getSnapshot();
  return (
    <AppShell>
      <RevenueClient snapshot={snapshot} />
    </AppShell>
  );
}
