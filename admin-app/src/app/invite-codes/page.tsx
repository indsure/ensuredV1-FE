import { AppShell } from "@/components/AppShell";
import { supabaseAdmin } from "@/lib/supabase";
import InviteCodesClient from "./InviteCodesClient";

async function getInviteCodes() {
  const { data } = await supabaseAdmin
    .from("invite_codes")
    .select("code, created_at, used_by, used_at")
    .order("created_at", { ascending: false });
  return data ?? [];
}

async function getAgentNames(userIds: string[]) {
  if (userIds.length === 0) return {};
  const { data } = await supabaseAdmin
    .from("agents")
    .select("id, full_name, email")
    .in("id", userIds);
  const map: Record<string, string> = {};
  for (const a of data ?? []) {
    map[a.id] = a.full_name || a.email;
  }
  return map;
}

export default async function InviteCodesPage() {
  const codes = await getInviteCodes();
  const usedByIds = codes.filter((c) => c.used_by).map((c) => c.used_by as string);
  const agentNames = await getAgentNames(usedByIds);

  const enriched = codes.map((c) => ({
    ...c,
    used_by_name: c.used_by ? (agentNames[c.used_by] ?? "Unknown") : null,
  }));

  return (
    <AppShell>
      <InviteCodesClient codes={enriched} />
    </AppShell>
  );
}
