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

/**
 * Pages where the demo must never answer. The flag lives in sessionStorage, so
 * a visitor who presses Back out of the demo and then signs up would otherwise
 * be "signed up" by the mock: a success screen and no account. On these paths
 * the real client always runs; the flag is kept, so Forward into the portal
 * still shows the demo.
 */
const REAL_ONLY = /^\/(login|signup|forgot-password|reset-password|app|account)(\/|$)|^\/agent\/(login|signup|forgot-password|reset-password|join)(\/|$)/;

export function isPlaygroundMode(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(PLAYGROUND_KEY) === "1" &&
      !REAL_ONLY.test(window.location.pathname)
    );
  } catch {
    return false;
  }
}

/** The raw flag, ignoring the page. Only for deciding whether to load the mock. */
export function playgroundFlagSet(): boolean {
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
    // The guided tour's position (lib/playground/tour.ts). Cleared here, not in
    // tour.ts, so every way out of the demo ends the tour too.
    window.sessionStorage.removeItem("indsure_playground_tour");
  } catch {
    /* ignore */
  }
}

/** Stable identity for the single demo agent every playground visitor "is". */
export const DEMO_AGENT_ID = "demo-agent-0000-0000-000000000001";
export const DEMO_EMAIL = "demo@indsure.in";
