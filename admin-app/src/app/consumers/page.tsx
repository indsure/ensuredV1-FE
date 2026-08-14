import { AppShell } from "@/components/AppShell";
import { supabaseAdmin } from "@/lib/supabase";
import ConsumersClient from "./ConsumersClient";

// D2C consumers who sign up / log in at indsure.in/login (NOT agents).
// Identity lives in Supabase Auth (auth.users); the app-level row is
// public.individual_profiles, keyed 1:1 on the auth user id and created by
// POST /api/me/bootstrap right after signup/login. Their uploaded policies are
// public.individual_policies. All reads here are service-role, so they see
// every row despite the individuals-own RLS on those tables.

// Keep in sync with backend routes.ts (TRIAL_DAYS / FREE_SLOTS_PER_TYPE).
const TRIAL_DAYS = 30;

type PolicyRow = {
  id: string;
  user_id: string;
  insurance_type: string | null;
  status: string | null;
  insurer: string | null;
  policy_name: string | null;
  nickname: string | null;
  score: number | null;
  renewal_date: string | null;
  created_at: string;
};

async function getProfiles() {
  const { data, error } = await supabaseAdmin
    .from("individual_profiles")
    .select(
      "id, full_name, email, phone, plan, trial_started_at, marketing_consent, renewal_reminders_enabled, created_at"
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(`individual_profiles: ${error.message}`);
  return data ?? [];
}

async function getPolicies(): Promise<PolicyRow[]> {
  const { data, error } = await supabaseAdmin
    .from("individual_policies")
    .select(
      "id, user_id, insurance_type, status, insurer, policy_name, nickname, score, renewal_date, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(10000);
  if (error) throw new Error(`individual_policies: ${error.message}`);
  return (data ?? []) as PolicyRow[];
}

async function getConnectRequests() {
  const { data } = await supabaseAdmin
    .from("agent_connect_requests")
    .select("user_id, status")
    .limit(10000);
  return data ?? [];
}

// auth.users is not reachable through PostgREST — the Admin API is the only way
// to read last_sign_in_at / email_confirmed_at. Page through so we never
// silently truncate once the base grows past one page.
async function getAuthUsers() {
  const byId = new Map<
    string,
    { last_sign_in_at: string | null; email_confirmed_at: string | null; provider: string }
  >();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users ?? [];
    if (error) break;
    for (const u of users) {
      byId.set(u.id, {
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,
        provider: (u.app_metadata?.provider as string) ?? "email",
      });
    }
    if (users.length < 1000) break;
  }
  return byId;
}

export default async function ConsumersPage() {
  const [profiles, policies, connects, authById] = await Promise.all([
    getProfiles(),
    getPolicies(),
    getConnectRequests(),
    getAuthUsers(),
  ]);

  const policiesByUser: Record<string, PolicyRow[]> = {};
  for (const p of policies) {
    (policiesByUser[p.user_id] ??= []).push(p);
  }

  const connectCounts: Record<string, number> = {};
  for (const c of connects) {
    if (c.user_id) connectCounts[c.user_id] = (connectCounts[c.user_id] ?? 0) + 1;
  }

  const now = Date.now();

  const consumers = profiles.map((p) => {
    const mine = policiesByUser[p.id] ?? [];
    const auth = authById.get(p.id);
    const trialEndsAt = new Date(
      new Date(p.trial_started_at).getTime() + TRIAL_DAYS * 86400_000
    ).toISOString();
    const trialDaysLeft = Math.ceil((new Date(trialEndsAt).getTime() - now) / 86400_000);

    const byType: Record<string, number> = {};
    for (const m of mine) byType[m.insurance_type || "health"] = (byType[m.insurance_type || "health"] ?? 0) + 1;

    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      plan: (p.plan as string) || "free",
      marketing_consent: !!p.marketing_consent,
      renewal_reminders_enabled: p.renewal_reminders_enabled !== false,
      created_at: p.created_at,
      trial_started_at: p.trial_started_at,
      trialEndsAt,
      trialDaysLeft,
      last_sign_in_at: auth?.last_sign_in_at ?? null,
      email_confirmed: !!auth?.email_confirmed_at,
      // A profile row with no matching auth user means the auth account was
      // deleted out from under it — worth seeing rather than hiding.
      auth_missing: !auth,
      policies_count: mine.length,
      policies_done: mine.filter((m) => m.status === "done").length,
      policies_error: mine.filter((m) => m.status === "error").length,
      by_type: byType,
      connect_requests: connectCounts[p.id] ?? 0,
      last_activity_at: mine[0]?.created_at ?? null,
      policies: mine.map((m) => ({
        id: m.id,
        title: m.nickname || m.policy_name || m.insurer || "Untitled policy",
        insurance_type: m.insurance_type || "health",
        status: m.status || "pending",
        insurer: m.insurer,
        score: m.score,
        renewal_date: m.renewal_date,
        created_at: m.created_at,
      })),
    };
  });

  // Auth users that are neither an agent nor a consumer profile: someone who
  // signed up but never completed bootstrap. Surfaced so a stuck signup is
  // visible instead of invisible.
  const { data: agentRows } = await supabaseAdmin.from("agents").select("id");
  const agentIds = new Set((agentRows ?? []).map((a) => a.id));
  const profileIds = new Set(profiles.map((p) => p.id));
  const orphanCount = [...authById.keys()].filter(
    (id) => !agentIds.has(id) && !profileIds.has(id)
  ).length;

  return (
    <AppShell>
      <ConsumersClient consumers={consumers} orphanCount={orphanCount} trialDays={TRIAL_DAYS} />
    </AppShell>
  );
}
