import { AppShell } from "@/components/AppShell";
import { supabaseAdmin } from "@/lib/supabase";
import AgentsClient from "./AgentsClient";

async function getAgents() {
  const { data: agents } = await supabaseAdmin
    .from("agents")
    .select("id, full_name, email, city, created_at, plan, billing_cycle")
    .order("created_at", { ascending: false });

  if (!agents || agents.length === 0) return [];

  const agentIds = agents.map((a) => a.id);

  const [policiesRes, analysesRes, creditsRes, ocrRes] = await Promise.all([
    // `policy_analyses` (= clients) is where uploaded policies actually live.
    // The old `policies` table has no agent_id column, so this returned nothing
    // and every agent showed 0 policies.
    supabaseAdmin
      .from("policy_analyses")
      .select("agent_id")
      .in("agent_id", agentIds),
    supabaseAdmin
      .from("analysis_jobs")
      .select("agent_id")
      .in("agent_id", agentIds),
    supabaseAdmin
      .from("agent_credits")
      .select("agent_id, balance")
      .in("agent_id", agentIds),
    supabaseAdmin
      .from("agent_ocr_credits")
      .select("agent_id, balance")
      .in("agent_id", agentIds),
  ]);

  const policyCounts: Record<string, number> = {};
  const analysisCounts: Record<string, number> = {};
  const creditsMap: Record<string, number> = {};
  const ocrMap: Record<string, number> = {};

  for (const p of policiesRes.data ?? []) {
    policyCounts[p.agent_id] = (policyCounts[p.agent_id] ?? 0) + 1;
  }
  for (const a of analysesRes.data ?? []) {
    analysisCounts[a.agent_id] = (analysisCounts[a.agent_id] ?? 0) + 1;
  }
  for (const c of creditsRes.data ?? []) {
    creditsMap[c.agent_id] = c.balance;
  }
  for (const o of ocrRes.data ?? []) {
    ocrMap[o.agent_id] = o.balance;
  }

  // OCR allowance the free/paid plans start with — used only for display when
  // an agent has no agent_ocr_credits row yet (it is seeded server-side on
  // their first data-entry upload). Keep in sync with backend OCR_MONTHLY_ALLOWANCE.
  const ocrAllowanceByPlan: Record<string, number> = { free: 20, agent: 50, agency: 50 };

  return agents.map((agent) => {
    const plan = (agent.plan as string) || "free";
    return {
      ...agent,
      plan,
      billing_cycle: (agent.billing_cycle as string) || "monthly",
      policies_count: policyCounts[agent.id] ?? 0,
      analyses_count: analysisCounts[agent.id] ?? 0,
      credits_remaining: creditsMap[agent.id] ?? 0, // mapped from balance column
      // null → no row seeded yet; fall back to the plan's full allowance for display
      ocr_remaining: ocrMap[agent.id] ?? (ocrAllowanceByPlan[plan] ?? 20),
      ocr_seeded: ocrMap[agent.id] !== undefined,
    };
  });
}

// Auth users who are neither an agent nor a D2C consumer. Consumers
// (individual_profiles) are real accounts with their own page — excluding them
// keeps this list to genuinely stuck agent signups.
async function getIncompleteUsers(agentIds: string[]) {
  const [{ data }, { data: consumerRows }] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 200 }),
    supabaseAdmin.from("individual_profiles").select("id"),
  ]);
  const allUsers = data?.users ?? [];
  const consumerIds = new Set((consumerRows ?? []).map((c) => c.id));
  return allUsers
    .filter((u) => !agentIds.includes(u.id) && !consumerIds.has(u.id))
    .map((u) => ({ id: u.id, email: u.email ?? "", created_at: u.created_at }));
}

export default async function AgentsPage() {
  const agents = await getAgents();
  const agentIds = agents.map((a) => a.id);
  const incompleteUsers = await getIncompleteUsers(agentIds);
  return (
    <AppShell>
      <AgentsClient agents={agents} incompleteUsers={incompleteUsers} />
    </AppShell>
  );
}
