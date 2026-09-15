import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';

export type AgentProfile = {
  agentId: string;
  name: string;
  email: string;
  role: string;
  location: string;
  authLevel: string;
  avatarInitials: string;
};

/** Agency membership, when there is one. `isOwner` is what gates the Team
 *  surface — it comes from teams.owner_id server-side, never from agents.role,
 *  which is a privilege column (see migration 017). */
export type AgentTeam = {
  id: string;
  name: string;
  isOwner: boolean;
};

type AgentContextType = {
  agent: AgentProfile | null;
  creditsRemaining: number;
  ocrRemaining: number;
  team: AgentTeam | null;
  /** They said "agency" at signup and we have not provisioned their team yet.
   *  Distinct from `team === null`, which means no agency involvement at all. */
  teamRequestPending: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [ocrRemaining, setOcrRemaining] = useState(0);
  const [team, setTeam] = useState<AgentTeam | null>(null);
  const [teamRequestPending, setTeamRequestPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAgent() {
    setLoading(true)
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        setError("Not authenticated")
        setAgent(null)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("agents")
        .select("*")
        .eq("id", user.id)
        .single()

      if (profileError || !profile) {
        setError("Profile not found")
        setAgent(null)
        return
      }

      const name = profile.name || profile.full_name || ""
      const initials = name
        ? name
            .split(" ")
            .map((w: string) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : user.email?.charAt(0).toUpperCase() || "?"

      setAgent({
        agentId: user.id,
        name: name,
        email: user.email || profile.email || "",
        role: profile.role || "agent",
        location: profile.location || "",
        authLevel: profile.role || "agent",
        avatarInitials: initials,
      })

      const { data: credits } = await supabase
        .from("agent_credits")
        .select("balance")
        .eq("agent_id", user.id)
        .single()
      setCreditsRemaining(credits?.balance ?? 0)

      // OCR / data-entry allowance. The balance row is seeded lazily server-side
      // on the agent's first data-entry upload, so it may not exist yet — a
      // missing row means "full allowance, nothing drawn" for the current plan.
      const { data: ocr } = await supabase
        .from("agent_ocr_credits")
        .select("balance")
        .eq("agent_id", user.id)
        .single()
      const ocrAllowanceByPlan: Record<string, number> = { free: 20, agent: 50, agency: 50 }
      const planAllowance = ocrAllowanceByPlan[(profile.plan || "free").toLowerCase()] ?? 20
      setOcrRemaining(ocr?.balance ?? planAllowance)

      // Team membership comes from the backend, not from a table read: the
      // browser has no cross-agent visibility by design (migration 017), and
      // ownership is decided by teams.owner_id server-side. A failure here is
      // not fatal — the portal works fine without the Team tab, so it degrades
      // to "no team" rather than breaking the whole profile load.
      try {
        const res = await apiFetch("/api/team")
        if (res.ok) {
          const data = await res.json()
          setTeam(
            data?.inTeam
              ? { id: data.team.id, name: data.team.name, isOwner: data.role === "owner" }
              : null
          )
          setTeamRequestPending(!data?.inTeam && !!data?.request)
        } else {
          setTeam(null)
          setTeamRequestPending(false)
        }
      } catch {
        setTeam(null)
        setTeamRequestPending(false)
      }

      setError(null)
    } catch (err: any) {
      setError(err?.message || "Error loading agent profile")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAgent()
  }, [])

  return (
    <AgentContext.Provider value={{ agent, creditsRemaining, ocrRemaining, team, teamRequestPending, loading, error, refresh: loadAgent }}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const context = useContext(AgentContext);
  if (context === undefined) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  return context;
}
