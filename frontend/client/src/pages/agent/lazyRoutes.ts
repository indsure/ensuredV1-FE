import { lazyWithPreload, type PreloadableComponent } from "@/lib/lazyPreload";

/**
 * Every screen behind AgentProtectedRoute, declared once so App.tsx can render
 * them and the preloader can warm them from the same definitions.
 *
 * Signed-out agent screens (Landing, LoginNew, SignupFlow, JoinTeam) stay in
 * App.tsx: warming them costs bandwidth for a session that is already past them.
 */
export const DashboardNew = lazyWithPreload(() => import("@/pages/agent/DashboardNew"));
export const Insights = lazyWithPreload(() => import("@/pages/agent/Insights"));
export const LeadRenewals = lazyWithPreload(() => import("@/pages/agent/LeadRenewals"));
export const AgentUploads = lazyWithPreload(() => import("@/pages/agent/AgentUploads"));
export const PoliciesNew = lazyWithPreload(() => import("@/pages/agent/PoliciesNew"));
export const PolicyValues = lazyWithPreload(() => import("@/pages/agent/PolicyValues"));
export const AgentCalculator = lazyWithPreload(() => import("@/pages/agent/AgentCalculator"));
export const AgentCompare = lazyWithPreload(() => import("@/pages/agent/Compare"));
export const AgentCatalogCompare = lazyWithPreload(() => import("@/pages/agent/CatalogCompare"));
export const RiderDirectory = lazyWithPreload(() => import("@/pages/agent/RiderDirectory"));
export const PolicyDetail = lazyWithPreload(() => import("@/pages/agent/PolicyDetail"));
export const CustomersNew = lazyWithPreload(() => import("@/pages/agent/CustomersNew"));
export const CustomerDetail = lazyWithPreload(() => import("@/pages/agent/CustomerDetail"));
export const LeadsNew = lazyWithPreload(() => import("@/pages/agent/LeadsNew"));
export const LeadDetail = lazyWithPreload(() => import("@/pages/agent/LeadDetail"));
export const Claims = lazyWithPreload(() => import("@/pages/agent/Claims"));
export const ClaimDetail = lazyWithPreload(() => import("@/pages/agent/ClaimDetail"));
export const MyQueue = lazyWithPreload(() => import("@/pages/agent/MyQueue"));
export const SettingsNew = lazyWithPreload(() => import("@/pages/agent/SettingsNew"));
export const MyProfile = lazyWithPreload(() => import("@/pages/agent/MyProfile"));
export const AgentMyPage = lazyWithPreload(() => import("@/pages/agent/MyPage"));
export const AgentTeam = lazyWithPreload(() => import("@/pages/agent/Team"));
export const AgentTeamMember = lazyWithPreload(() => import("@/pages/agent/TeamMember"));

/**
 * Wave 1: everything the sidebar can reach in one click, most-likely-first.
 *
 * These are the screens the agent perceives as "the app". They are also the
 * light ones, so this wave is what makes the rail feel instant even on a phone
 * connection. Re-warming an already-loaded route is free (the loader memoises),
 * so leaving the landing screen at the head costs nothing and covers deep links.
 */
const NAV_ROUTES: PreloadableComponent<any>[] = [
  DashboardNew,
  MyQueue,
  PoliciesNew,
  CustomersNew,
  Insights,
  LeadsNew,
  LeadRenewals,
  AgentCompare,
  AgentCalculator,
  PolicyValues,
  Claims,
  AgentMyPage,
  AgentCatalogCompare,
  RiderDirectory,
  AgentUploads,
  SettingsNew,
  MyProfile,
  AgentTeam,
];

/**
 * Wave 2: the detail screens, reachable only by opening a row on a wave 1 page.
 *
 * Held back because they are where the weight is — PolicyDetail alone drags in
 * the audit report renderer, which is larger than every other agent chunk put
 * together. In one flat blast it competed with the rail for bandwidth and the
 * cheap screens finished last, which is exactly backwards: nobody reaches a
 * detail page without first loading, and reading, the list it hangs off.
 */
const DETAIL_ROUTES: PreloadableComponent<any>[] = [
  PolicyDetail,
  CustomerDetail,
  LeadDetail,
  ClaimDetail,
  AgentTeamMember,
];

/** Both waves, in order. Exported for tests and for anything that wants the
 *  full set without caring how it is scheduled. */
export const AGENT_PRELOAD_ORDER: PreloadableComponent<any>[] = [
  ...NAV_ROUTES,
  ...DETAIL_ROUTES,
];

/**
 * Pathname -> screen, for prefetching on hover/focus. Only exact nav targets
 * are listed; parameterised routes are reached from these pages, and the
 * background sweep has them covered anyway.
 */
const ROUTE_BY_PATH: Record<string, PreloadableComponent<any>> = {
  "/agent/dashboard": DashboardNew,
  "/agent/insights": Insights,
  "/agent/uploads": AgentUploads,
  "/agent/policies": PoliciesNew,
  "/agent/values": PolicyValues,
  "/agent/customers": CustomersNew,
  "/agent/team": AgentTeam,
  "/agent/claims": Claims,
  "/agent/leads": LeadsNew,
  "/agent/renewals": LeadRenewals,
  "/agent/my-page": AgentMyPage,
  "/agent/my-queue": MyQueue,
  "/agent/calculator": AgentCalculator,
  "/agent/compare": AgentCompare,
  "/agent/compare/catalog": AgentCatalogCompare,
  "/agent/riders": RiderDirectory,
  "/agent/settings": SettingsNew,
  "/agent/profile": MyProfile,
};

/** Prefetch the chunk behind a nav href. Safe to call on every hover. */
export function preloadAgentRoute(href: string): void {
  const route = ROUTE_BY_PATH[href.split("?")[0]];
  // A miss is normal (external links, parameterised hrefs), not an error.
  if (route) void route.preload().catch(() => {});
}

let sweepStarted = false;

/** Metered or 2G connections pay real money per megabyte. Warming twenty
 *  screens they may never open is the wrong trade there, so navigate normally
 *  and let each route load on demand. */
function connectionAllowsPrefetch(): boolean {
  const connection = (navigator as any)?.connection;
  if (!connection) return true;
  if (connection.saveData) return false;
  return !/(^|-)2g$/.test(connection.effectiveType ?? "");
}

// A warm-up miss is not a user-visible failure: the route still loads normally
// when it is actually visited, so every rejection is swallowed here.
const warmAll = (routes: PreloadableComponent<any>[]) =>
  Promise.allSettled(routes.map((route) => route.preload()));

/**
 * Pull every agent screen into memory, once per page load.
 *
 * Wave 1 goes out immediately and all at once: no idle callback, no throttling.
 * Dribbling it out to protect the landing screen bought nothing and left the
 * rail slow for ten seconds, and the two costs it was guarding against do not
 * really exist — the browser multiplexes these down one HTTP/2 connection, and
 * the data calls they could crowd out go to Supabase and api.indsure.in, which
 * are separate origins on separate connections.
 *
 * Wave 2 follows the moment wave 1 settles, so the heavy detail screens are
 * warm within a second or so of the rail without ever competing with it.
 */
export function preloadAgentRoutes(): void {
  if (sweepStarted || typeof window === "undefined") return;
  sweepStarted = true;
  if (!connectionAllowsPrefetch()) return;

  void warmAll(NAV_ROUTES).then(() => warmAll(DETAIL_ROUTES));
}
