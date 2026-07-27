/**
 * Playground (demo) mode flag.
 *
 * When ON, the whole agent portal runs against an in-memory mock instead of the
 * real Supabase backend (see ./mockClient + ../supabase). This lets a brand-new
 * user click "Go to Playground" on the agent landing page and poke around a
 * fully-populated dashboard — leads, customers, policies, calculator — without
 * an account and without ever touching the real database. Nothing is saved.
 *
 * It's deliberately a *mode flag*, not a separate /playground route tree: every
 * existing /agent/* page, link and nav already works, so flipping this flag is
 * all it takes. Kept dependency-free to avoid import cycles with supabase.ts.
 */

const PLAYGROUND_KEY = "indsure_playground";

export function isPlaygroundMode(): boolean {
  try {
    return typeof window !== "undefined" && window.sessionStorage.getItem(PLAYGROUND_KEY) === "1";
  } catch {
    return false;
  }
}

export function enterPlayground(): void {
  try {
    window.sessionStorage.setItem(PLAYGROUND_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function exitPlayground(): void {
  try {
    window.sessionStorage.removeItem(PLAYGROUND_KEY);
  } catch {
    /* ignore */
  }
}

/** Stable identity for the single demo agent every playground visitor "is". */
export const DEMO_AGENT_ID = "demo-agent-0000-0000-000000000001";
export const DEMO_EMAIL = "demo@indsure.in";
