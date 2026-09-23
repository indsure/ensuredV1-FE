import { supabase } from "@/lib/supabase";
import type { UserInputs } from "@/lib/health-engine-logic";

/**
 * The advisor's in-progress Cover Calculator run, held in memory only.
 *
 * The consumer calculator autosaves to localStorage. The advisor one cannot:
 * its answers describe a CLIENT (age, income, dependants, health) and rules.md
 * forbids putting that in web storage. Before this, an advisor who clicked any
 * other portal page mid-wizard lost every answer without a warning, because an
 * in-app navigation never fires `beforeunload`.
 *
 * A module-level variable survives in-app navigation but dies with the tab, so
 * nothing about the client is written anywhere. A hard refresh still loses the
 * run; the calculator's own `beforeunload` prompt covers that case.
 *
 * One slot only. It is bound to the advisor and the customer it was started
 * for, so it never surfaces for a different advisor on a shared device or on a
 * different customer's calculator, and it is dropped on sign-out.
 */
export interface AgentCalcDraft {
  agentId: string;
  customerId: string | null;
  stepId: string;
  inputs: Partial<UserInputs>;
  state?: string;
  city?: string;
  savedAt: number;
}

// Long enough to survive a detour to look something up, short enough that a
// forgotten run does not greet the advisor the next morning.
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

let draft: AgentCalcDraft | null = null;

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") draft = null;
});

export function saveAgentCalcDraft(d: Omit<AgentCalcDraft, "savedAt">): void {
  draft = { ...d, savedAt: Date.now() };
}

export function readAgentCalcDraft(agentId: string, customerId: string | null): AgentCalcDraft | null {
  if (!draft) return null;
  if (Date.now() - draft.savedAt > MAX_AGE_MS) {
    draft = null;
    return null;
  }
  if (draft.agentId !== agentId || draft.customerId !== customerId) return null;
  return draft;
}

export function clearAgentCalcDraft(): void {
  draft = null;
}
