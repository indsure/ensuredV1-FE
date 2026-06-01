import { AppShell } from "@/components/AppShell";
import { supabaseAdmin } from "@/lib/supabase";
import AgentsClient from "./AgentsClient";

async function getAgents() {
  const { data: agents } = await supabaseAdmin
    .from("agents")
    .select("id, full_name, email, city, created_at, upload_limit, invite_code")
    .order("created_at", { ascending: false });

  if (!agents || agents.length === 0) return [];

  const agentIds = agents.map((a) => a.id);

  const [policiesRes, analysesRes, creditsRes] = await Promise.all([
    supabaseAdmin
      .from("policies")
      .select("agent_id")
      .in("agent_id", agentIds),
    supabaseAdmin
      .from("analysis_jobs")
      .select("agent_id")
      .in("agent_id", agentIds),
    supabaseAdmin
      .from("agent_credits")
      .select("agent_id, credits_remaining")
      .in("agent_id", agentIds),
  ]);

  const policyCounts: Record<string, number> = {};
  const analysisCounts: Record<string, number> = {};
  const creditsMap: Record<string, number> = {};

  for (const p of policiesRes.data ?? []) {
    policyCounts[p.agent_id] = (policyCounts[p.agent_id] ?? 0) + 1;
  }
  for (const a of analysesRes.data ?? []) {
    analysisCounts[a.agent_id] = (analysisCounts[a.agent_id] ?? 0) + 1;
  }
  for (const c of creditsRes.data ?? []) {
    creditsMap[c.agent_id] = c.credits_remaining;
  }

  return agents.map((agent) => ({
    ...agent,
    policies_count: policyCounts[agent.id] ?? 0,
    analyses_count: analysisCounts[agent.id] ?? 0,
    credits_remaining: creditsMap[agent.id] ?? 0,
  }));
}

export default async function AgentsPage() {
  const agents = await getAgents();
  return (
    <AppShell>
      <AgentsClient agents={agents} />
    </AppShell>
  );
}
