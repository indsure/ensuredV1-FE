// Agency team API client.
//
// Everything here goes through the backend rather than supabase-js, and that is
// deliberate: an owner reading a member's book must leave an audit row, and the
// only place that row gets written is the server. Migration 017 grants the
// browser no cross-agent read at all, so a supabase-js query for another
// agent's rows returns nothing — by design. If you need a new team read, add an
// endpoint; do not reach for `supabase.from(...)` here.

import { apiFetch } from "@/lib/api";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  created_at: string;
  is_owner: boolean;
  checks_left: number;
  entry_left: number;
  customers: string | number;
  policies: string | number;
  last_activity_at: string;
};

export type TeamInvite = {
  id: string;
  email: string;
  invited_name: string | null;
  expires_at: string;
  created_at: string;
};

export type TeamOwnerView = {
  inTeam: true;
  role: "owner";
  team: { id: string; name: string; seats: number };
  seats: { total: number; members: number; pending: number; free: number };
  checksPerSeat: number;
  members: TeamMember[];
  invites: TeamInvite[];
};

export type TeamMemberView = {
  inTeam: true;
  role: "member";
  team: { id: string; name: string; ownerName: string };
};

/** Someone said "agency" at signup and we have not provisioned their team yet.
 *  It is a record of the ask, never a promise of seats. */
export type TeamRequest = {
  agencyName: string;
  seatsWanted: number | null;
  requestedAt: string;
};

export type TeamView =
  | TeamOwnerView
  | TeamMemberView
  | { inTeam: false; request?: TeamRequest | null };

/** Admin-side view of an enterprise signup request. */
export type AdminTeamRequest = {
  id: string;
  agency_name: string;
  seats_wanted: number | null;
  contact_phone: string | null;
  status: "pending" | "provisioned" | "declined";
  created_at: string;
  handled_at: string | null;
  team_id: string | null;
  agent_id: string;
  agent_name: string;
  agent_email: string;
  agent_city: string | null;
  agent_plan: string;
};

export type MemberDetail = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  created_at: string;
  checks_left: number;
  entry_left: number;
  customers: string | number;
  policies: string | number;
  leads: string | number;
  claims: string | number;
};

export type InvitePreview = {
  state: "pending" | "accepted" | "revoked" | "expired";
  email: string;
  invitedName: string | null;
  teamName: string;
  ownerName: string;
  expiresAt: string;
  checksPerSeat: number;
  /** The single-use code that gets them through agent signup. Present only
   *  while the invite is live; null once it is spent, revoked or expired. */
  signupCode: string | null;
};

export type AccessLogEntry = {
  id: string;
  surface: string;
  created_at: string;
  owner_name: string;
};

/**
 * One place that turns a failed response into a sentence a person can act on.
 * The backend already writes those sentences; this only has to avoid throwing
 * away the message and replacing it with "Request failed".
 */
async function unwrap<T>(res: Response): Promise<T> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // A non-JSON body on an error is still an error — fall through to status.
  }
  if (!res.ok) {
    throw new Error(body?.message || body?.error || `Something went wrong (${res.status}).`);
  }
  return body as T;
}

export async function fetchTeam(): Promise<TeamView> {
  return unwrap<TeamView>(await apiFetch("/api/team"));
}

export async function fetchMember(id: string): Promise<{ member: MemberDetail; checksPerSeat: number }> {
  return unwrap(await apiFetch(`/api/team/members/${id}`));
}

export async function fetchMemberPolicies(id: string) {
  return unwrap<{ policies: any[] }>(await apiFetch(`/api/team/members/${id}/policies`));
}

export async function fetchMemberCustomers(id: string) {
  return unwrap<{ customers: any[] }>(await apiFetch(`/api/team/members/${id}/customers`));
}

export async function fetchMemberLeads(id: string) {
  return unwrap<{ leads: any[] }>(await apiFetch(`/api/team/members/${id}/leads`));
}

export async function fetchMemberClaims(id: string) {
  return unwrap<{ claims: any[] }>(await apiFetch(`/api/team/members/${id}/claims`));
}

export async function inviteAdvisor(email: string, name?: string) {
  return unwrap<{ id: string; email: string; emailed: boolean; message: string }>(
    await apiFetch("/api/team/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    })
  );
}

export async function resendInvite(id: string) {
  return unwrap<{ emailed: boolean; message: string }>(
    await apiFetch(`/api/team/invites/${id}/resend`, { method: "POST" })
  );
}

export async function revokeInvite(id: string) {
  return unwrap<{ message: string }>(
    await apiFetch(`/api/team/invites/${id}/revoke`, { method: "POST" })
  );
}

export async function moveChecks(fromId: string, toId: string, count: number) {
  return unwrap<{ message: string }>(
    await apiFetch("/api/team/checks/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromId, toId, count }),
    })
  );
}

export async function removeMember(id: string) {
  return unwrap<{ message: string }>(
    await apiFetch(`/api/team/members/${id}`, { method: "DELETE" })
  );
}

export async function previewInvite(token: string): Promise<InvitePreview> {
  return unwrap<InvitePreview>(await apiFetch(`/api/team/invite/${encodeURIComponent(token)}`));
}

export async function acceptInvite(token: string) {
  return unwrap<{ joined: boolean; teamName: string; message: string }>(
    await apiFetch(`/api/team/invite/${encodeURIComponent(token)}/accept`, { method: "POST" })
  );
}

export async function fetchMyAccessLog(): Promise<{ reads: AccessLogEntry[] }> {
  return unwrap(await apiFetch("/api/team/access-log"));
}

/** What the advisor is shown for each logged read. Deliberately concrete —
 *  "opened your customers" is checkable; "accessed data" is not. */
export function describeSurface(surface: string): string {
  const map: Record<string, string> = {
    overview: "opened your summary",
    policies: "opened your policies",
    policy: "opened one of your policies",
    customers: "opened your customers",
    customer: "opened one of your customers",
    leads: "opened your leads",
    claims: "opened your claims",
    claim: "opened one of your claims",
    calculator: "opened your calculator reports",
  };
  return map[surface] ?? "opened your book";
}

/* ── Admin: enterprise signup requests ────────────────────────────────────── */

export async function fetchTeamRequests(): Promise<{ requests: AdminTeamRequest[] }> {
  return unwrap(await apiFetch("/api/admin/team-requests"));
}

/** Creates the team. The seat count is what the ADMIN sets, not what was asked
 *  for — `seats_wanted` is a note, `teams.seats` is what bills. */
export async function provisionTeam(id: string, seats: number, teamName?: string) {
  return unwrap<{ teamId: string; message: string }>(
    await apiFetch(`/api/admin/team-requests/${id}/provision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seats, teamName }),
    })
  );
}

export async function declineTeamRequest(id: string, note?: string) {
  return unwrap<{ message: string }>(
    await apiFetch(`/api/admin/team-requests/${id}/decline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    })
  );
}
