import { AppShell } from "@/components/AppShell";
import { supabaseAdmin } from "@/lib/supabase";
import LeadsClient from "./LeadsClient";

// Consumer "Talk to an advisor" requests, newest first. Service-role read, so
// this sees every row despite the individuals-own RLS on the table.
async function getLeads() {
  const { data } = await supabaseAdmin
    .from("agent_connect_requests")
    .select(
      "id, name, phone, email, topic, message, consent, status, created_at, assigned_agent_id, assigned_at"
    )
    .order("created_at", { ascending: false });
  return data ?? [];
}

// The agents a lead can be allocated to.
async function getAgents() {
  const { data } = await supabaseAdmin
    .from("agents")
    .select("id, full_name, email, city")
    .order("full_name", { ascending: true });
  return data ?? [];
}

export default async function LeadsPage() {
  const [leads, agents] = await Promise.all([getLeads(), getAgents()]);

  const agentById: Record<string, { name: string; email: string }> = {};
  for (const a of agents) {
    agentById[a.id] = { name: a.full_name || a.email, email: a.email };
  }

  const enriched = leads.map((l) => ({
    ...l,
    assigned_agent_name: l.assigned_agent_id
      ? (agentById[l.assigned_agent_id]?.name ?? "Unknown")
      : null,
    assigned_agent_email: l.assigned_agent_id
      ? (agentById[l.assigned_agent_id]?.email ?? null)
      : null,
  }));

  return (
    <AppShell>
      <LeadsClient leads={enriched} agents={agents} />
    </AppShell>
  );
}
