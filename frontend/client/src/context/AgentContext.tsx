import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type AgentProfile = {
  agentId: string;
  name: string;
  email: string;
  role: string;
  location: string;
  authLevel: string;
  avatarInitials: string;
};

type AgentContextType = {
  agent: AgentProfile | null;
  creditsRemaining: number;
  ocrRemaining: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [ocrRemaining, setOcrRemaining] = useState(0);
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
    <AgentContext.Provider value={{ agent, creditsRemaining, ocrRemaining, loading, error, refresh: loadAgent }}>
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
