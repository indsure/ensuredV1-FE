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
 * The only pages the demo may answer: the advisor portal itself. The flag lives
 * in sessionStorage for the whole tab, so a visitor who leaves the demo for the
 * public site would otherwise be served by the mock everywhere: signups with no
 * account, and a public calculator whose "saved" report was never saved (the
 * report page then read the mock's generic reply and showed "Report data
 * missing"). An allowlist, not a denylist, so a new public page is real by
 * default. The flag is kept, so going back into the portal still shows the demo.
 * The advisor landing (/agent) and the auth pages are real.
 */
const DEMO_PAGES = /^\/agent\/(?!(login|signup|forgot-password|reset-password|join)(\/|$))/;

export function isPlaygroundMode(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(PLAYGROUND_KEY) === "1" &&
      DEMO_PAGES.test(window.location.pathname)
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
