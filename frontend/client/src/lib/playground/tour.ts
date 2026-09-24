/**
 * Guided tour of the playground.
 *
 * Every /agent/* route renders its own ProtectedRoute + AgentLayout, so the
 * layout (and the tour card inside it) remounts on each navigation. The tour's
 * position therefore lives in sessionStorage, not React state: a step index or
 * "welcome", never anything personal. A window event tells the mounted card to
 * re-read it.
 *
 * Only playground visitors ever see this; the card checks isPlaygroundMode().
 */

const TOUR_KEY = "indsure_playground_tour";
const TOUR_EVENT = "indsure-tour-change";

export type TourStep = {
  /** i18n: tour.<id>_t / tour.<id>_d */
  id: string;
  /** Where the step takes the visitor. */
  route: string;
  /** Sidebar link to ring on desktop, matched by href. */
  navHref?: string;
};

// pol-1 is the seeded family floater (lib/playground/seed.ts) whose full report
// renders in demo mode. If the seed renames it, this step lands on a 404 card.
export const TOUR_STEPS: TourStep[] = [
  { id: "dashboard", route: "/agent/dashboard", navHref: "/agent/dashboard" },
  { id: "check", route: "/agent/uploads", navHref: "/agent/uploads" },
  { id: "report", route: "/agent/policies/pol-1", navHref: "/agent/policies" },
  { id: "compare", route: "/agent/compare", navHref: "/agent/compare" },
  { id: "leads", route: "/agent/leads", navHref: "/agent/leads" },
  { id: "renewals", route: "/agent/renewals", navHref: "/agent/renewals" },
  { id: "website", route: "/agent/my-page", navHref: "/agent/my-page" },
  { id: "done", route: "/agent/dashboard" },
];

export type TourState = "welcome" | number | null;

export function getTourState(): TourState {
  try {
    const raw = window.sessionStorage.getItem(TOUR_KEY);
    if (raw === "welcome") return "welcome";
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 && n < TOUR_STEPS.length ? n : null;
  } catch {
    return null;
  }
}

export function setTourState(state: TourState): void {
  try {
    if (state === null) window.sessionStorage.removeItem(TOUR_KEY);
    else window.sessionStorage.setItem(TOUR_KEY, String(state));
  } catch {
    /* private mode: the tour just will not survive a reload */
  }
  window.dispatchEvent(new Event(TOUR_EVENT));
}

export function onTourChange(fn: () => void): () => void {
  window.addEventListener(TOUR_EVENT, fn);
  return () => window.removeEventListener(TOUR_EVENT, fn);
}

/** Start from step 1. The card navigates to the step's route itself. */
export function startTour(): void {
  setTourState(0);
}

export function endTour(): void {
  setTourState(null);
}
