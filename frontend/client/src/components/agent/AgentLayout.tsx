import { ReactNode, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useSearch } from "wouter"
import { BookOpen, ChevronRight, FileText, LayoutDashboard, Settings, LogOut, TrendingUp, Upload, User, Users, Menu, X, UsersRound, Wrench } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAgent } from "@/context/AgentContext"
import PlaygroundBanner from "@/components/agent/PlaygroundBanner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useLanguage, LanguageToggle } from "@/i18n/LanguageContext"
import { AgentTabBar } from "@/components/agent/AgentTabBar"

interface AgentLayoutProps {
  children: ReactNode;
}

type NavChild = {
  label: string;
  href: string;
  /** Only the queue child carries a live count. */
  badge?: "queue";
};

type NavParent = {
  key: string;
  label: string;
  /** Where clicking the parent lands. Always a real route in App.tsx. */
  href: string;
  icon: ReactNode;
  children: NavChild[];
};

export default function AgentLayout({ children }: AgentLayoutProps) {
  const { agent, team, teamRequestPending } = useAgent()
  const [location, setLocation] = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [queueCount, setQueueCount] = useState<number>(0)
  const [queueCountError, setQueueCountError] = useState<string | null>(null)

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false)
  }, [location])

  const { t, locale } = useLanguage()
  const search = useSearch()

  // `t` echoes the key back when a string is missing, so `t(k) ?? "Fallback"`
  // never fires — it renders "layout.grow" on screen. Compare against the key.
  const label = (key: string, fallback: string) => {
    const value = t(key)
    return !value || value === key ? fallback : value
  }

  // One expanding rail instead of three flat groups of fifteen. Parents are the
  // jobs an agent has; children are the cuts inside each job. Only one group is
  // open at a time — five parents with up to six children each is twenty rows
  // if they all stay open, which defeats the point of grouping.
  //
  // "Analyze" is deliberately absent: uploading a policy for a check is the most
  // repeated thing in the product and it is an *action*, not a place, so it sits
  // on the permanent button above the tree instead of costing a nav slot.
  //
  // Every href points at a route that exists in App.tsx. Nothing here is a
  // placeholder for a screen we have not built.
  const navTree = useMemo<NavParent[]>(
    () => [
      {
        key: "home",
        label: label("layout.nav_home", "Home"),
        href: "/agent/dashboard",
        icon: <LayoutDashboard className="h-4 w-4" />,
        children: [
          { label: label("layout.nav_overview", "Overview"), href: "/agent/dashboard" },
          { label: label("layout.nav_needs_attention", "Needs Attention"), href: "/agent/my-queue", badge: "queue" },
        ],
      },
      {
        key: "insights",
        label: label("layout.nav_insights", "Insights"),
        href: "/agent/insights",
        icon: <TrendingUp className="h-4 w-4" />,
        // No children: it is one screen, and a parent that expands to a single
        // child is a click that buys nothing.
        children: [],
      },
      {
        key: "people",
        label: label("layout.nav_people", "People"),
        href: "/agent/customers",
        icon: <Users className="h-4 w-4" />,
        children: [
          { label: label("layout.customers", "Customers"), href: "/agent/customers" },
          { label: label("layout.leads", "Leads"), href: "/agent/leads" },
          { label: label("layout.renewals", "Renewals"), href: "/agent/renewals" },
        ],
      },
      {
        key: "policies",
        label: label("layout.nav_policies", "Policies"),
        href: "/agent/policies",
        icon: <FileText className="h-4 w-4" />,
        // Type children map to `insurance_type` values that already exist in
        // DATA_ENTRY_TYPES. "others" is the catch-all the Policies page resolves
        // to everything outside health/life/term/motor.
        children: [
          { label: label("layout.nav_overview", "Overview"), href: "/agent/policies" },
          { label: label("layout.type_health", "Health"), href: "/agent/policies?type=health" },
          { label: label("layout.type_life", "Life"), href: "/agent/policies?type=life" },
          { label: label("layout.type_term", "Term"), href: "/agent/policies?type=term" },
          { label: label("layout.type_motor", "Motor"), href: "/agent/policies?type=motor" },
          { label: label("layout.type_others", "Others"), href: "/agent/policies?type=others" },
        ],
      },
      {
        key: "services",
        label: label("layout.nav_services", "Services"),
        href: "/agent/compare",
        icon: <Wrench className="h-4 w-4" />,
        children: [
          { label: label("layout.nav_compare", "Compare Policies"), href: "/agent/compare" },
          { label: label("layout.nav_calculator", "Cover Calculator"), href: "/agent/calculator" },
          { label: label("layout.policy_values", "Surrender Value"), href: "/agent/values" },
          { label: label("layout.claims", "Claims"), href: "/agent/claims" },
          { label: label("layout.nav_my_website", "My Website"), href: "/agent/my-page" },
        ],
      },
      // Agency: for the person who owns a team, and for someone whose team we
      // have not provisioned yet — they asked for one at signup, and hiding the
      // tab would look like the answer was thrown away. A plain MEMBER gets
      // nothing here: they have nothing to manage.
      ...(team?.isOwner || teamRequestPending
        ? [{
            key: "agency",
            label: label("layout.nav_agency", "My Agency"),
            href: "/agent/team",
            icon: <UsersRound className="h-4 w-4" />,
            children: [
              { label: label("layout.team", "Team"), href: "/agent/team" },
            ],
          }]
        : []),
    ],
    [locale, team?.isOwner, teamRequestPending]
  )

  // A child is active on an exact match including the query string, so
  // Policies > Overview does not stay lit while Health is selected.
  const currentPath = search ? `${location}?${search}` : location
  const isChildActive = (href: string) => currentPath === href

  // Which group the current route lives in. Drives auto-open, so the rail always
  // shows you where you are after a reload or a deep link.
  const activeKey = useMemo(() => {
    const hit = navTree.find(
      (p) => p.href === location || p.children.some((c) => c.href.split("?")[0] === location)
    )
    return hit?.key ?? null
  }, [navTree, location])

  const [openGroup, setOpenGroup] = useState<string | null>(activeKey)

  // Re-open on navigation only. Collapsing the group you are already in stays
  // collapsed, because activeKey has not changed.
  useEffect(() => {
    if (activeKey) setOpenGroup(activeKey)
  }, [activeKey])

  async function fetchQueueCount() {
    if (!agent?.agentId) return
    setQueueCountError(null)
    const { count, error } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agent.agentId)
      .in("status", ["error", "processing", "pending"])
    if (error) {
      setQueueCountError(error.message)
      return
    }
    setQueueCount(count ?? 0)
  }

  useEffect(() => {
    void fetchQueueCount()
    const t = window.setInterval(() => void fetchQueueCount(), 10000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.agentId])

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = "/agent/login"
  }

  const initials = agent?.avatarInitials ?? "A"

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex text-slate-800 font-['Inter']">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          "bg-[#0B1120] text-white flex flex-col border-r border-white/5",
          // Mobile: off-canvas drawer that slides in over the content.
          "fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] transform transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: static column that can collapse to an icon rail.
          "lg:static lg:translate-x-0 lg:transition-all",
          sidebarCollapsed ? "lg:w-[80px]" : "lg:w-[260px]",
        ].join(" ")}
      >
        <div className={`${sidebarCollapsed ? 'lg:px-3' : 'lg:px-6'} px-6 py-4 border-b border-white/5 flex items-center justify-between transition-all duration-300`}>
          <Link to="/agent/dashboard" className={`flex items-center ${sidebarCollapsed ? 'lg:justify-center' : 'gap-3'} flex-1 min-w-0`}>
            <img
              src="/logo-white.png"
              alt="IndSure"
              className={`${sidebarCollapsed ? 'lg:h-9 lg:w-9 h-10 w-10' : 'h-10 w-10'} object-contain flex-shrink-0`}
            />
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-lg font-bold text-white leading-tight">IndSure</span>
                <span className="text-xs uppercase tracking-wider text-white/60 font-semibold">{t("layout.agent_portal")}</span>
              </div>
            )}
          </Link>
          {/* Desktop collapse toggle */}
          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex h-9 w-9 rounded-lg hover:bg-white/10 items-center justify-center transition-colors flex-shrink-0"
              aria-label="Collapse sidebar"
            >
              <Menu className="h-5 w-5 text-white" />
            </button>
          )}
          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden h-11 w-11 -mr-2 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0"
            aria-label="Close menu"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>
        
        {sidebarCollapsed && (
          <div className="hidden lg:block px-3 py-3 border-b border-white/5">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full h-10 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
              aria-label="Expand sidebar"
            >
              <Menu className="h-5 w-5 text-white" />
            </button>
          </div>
        )}

        <div className={`${sidebarCollapsed ? 'px-2' : 'px-4'} py-6 space-y-6 flex-1 transition-all duration-300`}>
          {/* The single most-repeated action in the product, always in reach. */}
          <Link
            to="/agent/uploads"
            title={sidebarCollapsed ? label("layout.nav_check_policy", "Check a Policy") : undefined}
            className={[
              "flex min-h-11 items-center rounded-xl bg-[#0D9488] text-white text-sm font-bold transition-colors hover:bg-[#0f766e]",
              sidebarCollapsed ? "w-full justify-center" : "gap-2 px-3 py-3",
            ].join(" ")}
          >
            <Upload className="h-4 w-4 flex-shrink-0" />
            {!sidebarCollapsed && label("layout.nav_check_policy", "Check a Policy")}
          </Link>

          <nav className="space-y-1">
            {navTree.map((parent) => {
              const open = !sidebarCollapsed && openGroup === parent.key
              const parentActive = activeKey === parent.key
              return (
                <div key={parent.key}>
                  <button
                    type="button"
                    onClick={() => {
                      // Collapsed to icons there is nowhere to draw children, and
                      // the old flat rail could reach every destination from its
                      // icons. Navigating only to the parent would strand a
                      // collapsed user with no route to Policies > Term, so open
                      // the rail on the way and show them where they landed.
                      if (sidebarCollapsed) {
                        if (parent.children.length > 0) setSidebarCollapsed(false)
                        setOpenGroup(parent.key)
                        setLocation(parent.href)
                        return
                      }
                      // Nothing to expand: it is a destination, always navigate.
                      if (parent.children.length === 0) { setLocation(parent.href); return }
                      // Clicking the open group closes it without navigating away.
                      if (openGroup === parent.key) { setOpenGroup(null); return }
                      setOpenGroup(parent.key)
                      setLocation(parent.href)
                    }}
                    // Only a control that expands something announces itself as
                    // expandable. Hiding the chevron but keeping aria-expanded
                    // would fix the sighted reading and leave the screen-reader
                    // one wrong.
                    aria-expanded={sidebarCollapsed || parent.children.length === 0 ? undefined : open}
                    title={sidebarCollapsed ? parent.label : undefined}
                    className={[
                      "relative flex w-full min-h-11 items-center rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                      parentActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
                      sidebarCollapsed ? "justify-center" : "justify-between",
                    ].join(" ")}
                  >
                    <span className={`flex items-center ${sidebarCollapsed ? "" : "gap-3"}`}>
                      {parent.icon}
                      {!sidebarCollapsed && parent.label}
                    </span>
                    {/* A chevron promises something to expand. Insights has no
                        children, so drawing one there offered a click that did
                        nothing — and rotated on arrival, which read as a group
                        that had opened onto an empty list. */}
                    {!sidebarCollapsed && parent.children.length > 0 && (
                      <ChevronRight
                        className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
                      />
                    )}
                    {sidebarCollapsed && parent.key === "home" && queueCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[#0D9488] text-white text-xs font-black flex items-center justify-center">
                        {queueCount}
                      </span>
                    )}
                  </button>

                  {open && (
                    <div className="mt-1 mb-2 ml-5 space-y-0.5 border-l border-white/10 pl-2">
                      {parent.children.map((child) => {
                        const active = isChildActive(child.href)
                        return (
                          <Link
                            key={child.href}
                            to={child.href}
                            aria-current={active ? "page" : undefined}
                            className={[
                              "flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                              active
                                ? "bg-[#0D9488]/15 font-bold text-[#5eead4]"
                                : "font-medium text-white/60 hover:bg-white/5 hover:text-white",
                            ].join(" ")}
                          >
                            <span>{child.label}</span>
                            {child.badge === "queue" && (
                              <span className="inline-flex items-center rounded-full border border-[#0D9488]/30 bg-[#0D9488]/15 px-2 py-0.5 text-xs font-black tabular-nums text-[#5eead4]">
                                {queueCount}
                              </span>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {queueCountError && !sidebarCollapsed && (
              <div className="px-2 mt-2 text-xs text-white/50">Queue badge unavailable</div>
            )}
          </nav>

          <div>
            {!sidebarCollapsed && <div className="px-2 text-xs font-black uppercase tracking-[0.25em] text-white/40 mb-3">{t("layout.account")}</div>}
            <nav className="space-y-1">
              <Link
                to="/agent/settings"
                className={[
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  location === "/agent/settings" ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
                  sidebarCollapsed ? "justify-center" : ""
                ].join(" ")}
                title={sidebarCollapsed ? t("layout.settings") : undefined}
              >
                <Settings className="h-4 w-4" />
                {!sidebarCollapsed && t("layout.settings")}
              </Link>
            </nav>
          </div>
        </div>

        {/* Bottom agent pill */}
        <div className={`${sidebarCollapsed ? 'p-2' : 'p-4'} border-t border-white/5 transition-all duration-300`}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} rounded-xl bg-white/5 hover:bg-white/10 transition-colors px-3 py-3`}>
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#0D9488] to-[#14b8a6] flex items-center justify-center text-sm font-black uppercase flex-shrink-0">
                  {initials}
                </div>
                {!sidebarCollapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-semibold truncate">{agent?.name ?? "Agent"}</div>
                    <div className="text-xs uppercase tracking-widest text-white/60 font-black truncate">
                      {/* Ownership is not a role — it lives in teams.owner_id
                          (migration 017), so `role` still reads "agent" for
                          someone who runs an agency. Say the more useful thing. */}
                      {team?.isOwner ? (t("layout.team_owner") ?? "Team owner") : (agent?.role ?? "agent")}
                    </div>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setLocation("/agent/riders")}>
                <BookOpen />
                {t("layout.rider_directory") ?? "Rider Directory"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/agent/profile")}>
                <User />
                {t("layout.my_profile")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void signOut()}>
                <LogOut />
                {t("layout.sign_out")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-[#0B1120] text-white px-4 h-14">
          <button
            onClick={() => setMobileOpen(true)}
            className="h-11 w-11 -ml-2 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <Link to="/agent/dashboard" className="flex min-h-11 items-center gap-2 px-1">
            <img src="/logo-white.png" alt="IndSure" className="h-8 w-8 object-contain" />
            <span className="font-bold">IndSure</span>
          </Link>
          <LanguageToggle variant="dark" />
        </div>

        <PlaygroundBanner />
        <div className="hidden lg:flex justify-end px-4 md:px-6 lg:px-8 pt-3 pb-1">
          <LanguageToggle />
        </div>
        <div className="flex-1 p-4 pb-24 md:p-6 md:pb-6 lg:p-8 lg:pt-2">{children}</div>
        <AgentTabBar onMore={() => setMobileOpen(true)} />
      </main>

    </div>
  )
}
