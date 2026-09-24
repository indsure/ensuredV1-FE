import {
  BarChart3, BookOpen, Calculator, CalendarClock, ClipboardList, FileSearch, FileText, Globe,
  Inbox, IndianRupee, MessageCircle, Scale, Sheet, Users, UserPlus, UsersRound,
  type LucideIcon,
} from "lucide-react";

/**
 * What the advisor portal does and how to use it, as data.
 *
 * Rendered twice: publicly at /advisors/features and /advisors/how-to-use, and
 * inside the portal at /agent/help. One list so the two can never disagree.
 *
 * Every `route` is a real route in App.tsx, and every step names a button by the
 * label that screen already shows (see the Claims Ledger in
 * docs/plans/2026-09-24-advisor-help-and-tour.md). Change a button label and the
 * step that quotes it goes stale, so grep for it here.
 */

export type GuideFeature = {
  id: string;
  icon: LucideIcon;
  /** The screen inside the portal. */
  route: string;
  /** Only agency owners see it in the menu. */
  ownersOnly?: boolean;
};

export type FeatureGroup = { id: string; features: GuideFeature[] };

// Keys: aguide.grp_<group id>, aguide.f_<feature id>_t / _d
export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: "people",
    features: [
      { id: "customers", icon: Users, route: "/agent/customers" },
      { id: "leads", icon: UserPlus, route: "/agent/leads" },
      { id: "renewals", icon: CalendarClock, route: "/agent/renewals" },
      { id: "whatsapp", icon: MessageCircle, route: "/agent/renewals" },
    ],
  },
  {
    id: "advise",
    features: [
      { id: "check", icon: FileSearch, route: "/agent/uploads" },
      { id: "compare", icon: Scale, route: "/agent/compare" },
      { id: "calculator", icon: Calculator, route: "/agent/calculator" },
      { id: "values", icon: IndianRupee, route: "/agent/values" },
      { id: "riders", icon: BookOpen, route: "/agent/riders" },
    ],
  },
  {
    id: "business",
    features: [
      { id: "queue", icon: Inbox, route: "/agent/my-queue" },
      { id: "insights", icon: BarChart3, route: "/agent/insights" },
      { id: "claims", icon: ClipboardList, route: "/agent/claims" },
      { id: "website", icon: Globe, route: "/agent/my-page" },
      { id: "export", icon: Sheet, route: "/agent/policies" },
      { id: "team", icon: UsersRound, route: "/agent/team", ownersOnly: true },
    ],
  },
];

export type Guide = {
  id: string;
  icon: LucideIcon;
  /** Where the guide starts. */
  route: string;
  /** Number of steps; keys are aguide.g_<id>_s1 … _s<steps>. */
  steps: number;
};

// Keys: aguide.g_<id>_t (title), aguide.g_<id>_s<n> (steps)
export const GUIDES: Guide[] = [
  { id: "check", icon: FileSearch, route: "/agent/uploads", steps: 5 },
  { id: "share", icon: FileText, route: "/agent/policies", steps: 3 },
  { id: "compare", icon: Scale, route: "/agent/compare", steps: 5 },
  { id: "leads", icon: UserPlus, route: "/agent/leads", steps: 5 },
  { id: "renewals", icon: CalendarClock, route: "/agent/renewals", steps: 4 },
  { id: "calculator", icon: Calculator, route: "/agent/calculator", steps: 3 },
  { id: "claims", icon: ClipboardList, route: "/agent/claims", steps: 4 },
  { id: "website", icon: Globe, route: "/agent/my-page", steps: 5 },
];

/**
 * Screens a public "See it in the demo" link may land on. PlaygroundEntry only
 * forwards `?go=` to one of these, so the parameter cannot be used to send a
 * visitor anywhere else.
 */
export const DEMO_ROUTES: ReadonlySet<string> = new Set([
  "/agent/dashboard",
  ...FEATURE_GROUPS.flatMap((g) => g.features.map((f) => f.route)),
  ...GUIDES.map((g) => g.route),
]);

export function demoHref(route: string): string {
  return `/agent/playground?go=${encodeURIComponent(route)}`;
}

/**
 * The on-screen name of every button or menu item a guide mentions, by the
 * i18n key that screen renders it with. Steps say "Press {{check}}" and get the
 * label the advisor actually sees, in whichever language the portal is in.
 * Rename a button and the guide follows; delete its key and the step shows the
 * raw key, which the i18n key check catches.
 */
const UI_LABELS: Record<string, string> = {
  check_policy: "layout.nav_check_policy",
  check: "uploads.check_btn",
  view_results: "uploads.view_results",
  needs_attention: "layout.nav_needs_attention",
  policies: "layout.nav_policies",
  share_report: "policy_detail.share_report",
  services: "layout.nav_services",
  compare_nav: "layout.nav_compare",
  add_plan: "compare.add_plan",
  save_share: "compare.save_share",
  compare_quotes: "compare.title",
  people: "layout.nav_people",
  leads: "layout.leads",
  add_lead: "leads.add",
  st_new: "leads.status_new",
  st_contacted: "leads.status_contacted",
  st_interested: "leads.status_interested",
  st_won: "leads.status_won",
  st_lost: "leads.status_lost",
  draft_message: "leads.draft_message",
  save_as_customer: "lead_detail.save_as_customer",
  renewals: "layout.renewals",
  draft: "renewals.draft",
  renewal_reminder: "drafter.kind_renewal",
  send_wa: "drafter.send",
  mark_spoken: "renewals.mark_spoken",
  calculator: "layout.nav_calculator",
  copy_share: "agent_calc.copy_share",
  claims: "layout.claims",
  new_claim: "claims.new_claim",
  c_docs: "claims.status_docs_received",
  c_submitted: "claims.status_submitted",
  c_process: "claims.status_under_process",
  c_query: "claims.status_query_raised",
  c_settled: "claims.status_settled",
  c_rejected: "claims.status_rejected",
  my_website: "layout.nav_my_website",
  publish: "mypage.publish",
  download_qr: "mypage.download_qr",
};

/** Every UI label, quoted, ready to pass as t() vars. */
export function uiLabelVars(t: (key: string) => string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, key] of Object.entries(UI_LABELS)) vars[name] = `“${t(key)}”`;
  return vars;
}
