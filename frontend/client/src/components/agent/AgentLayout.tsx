import { ReactNode, useEffect, useMemo, useState } from "react"
import { Link, useLocation } from "wouter"
import { BookOpen, Calculator, FileText, Globe, LayoutDashboard, Settings, ListChecks, LogOut, Scale, ShieldCheck, Target, Upload, User, Users, Menu, X, TrendingUp } from "lucide-react"

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

export default function AgentLayout({ children }: AgentLayoutProps) {
  const { agent } = useAgent()
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

  // Grouped by the agent's two real jobs (win business / service the book) so the
  // sidebar reads as a few short clusters instead of one long flat list.
  // Renewals lives as a tab inside Leads, not as its own nav item.
  const navSections = useMemo(
    () => [
      {
        key: "main",
        label: t("layout.main"),
        items: [
          { label: t("layout.overview"), href: "/agent/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
          { label: t("layout.analyze") ?? "Analyze", href: "/agent/uploads", icon: <Upload className="h-4 w-4" /> },
          { label: t("layout.my_queue"), href: "/agent/my-queue", icon: <ListChecks className="h-4 w-4" /> },
        ],
      },
      {
        key: "grow",
        label: t("layout.grow") ?? "Grow",
        items: [
          { label: t("layout.leads") ?? "Leads", href: "/agent/leads", icon: <Target className="h-4 w-4" /> },
          { label: t("layout.my_page") ?? "My Page", href: "/agent/my-page", icon: <Globe className="h-4 w-4" /> },
          { label: t("layout.calculator") ?? "Calculator", href: "/agent/calculator", icon: <Calculator className="h-4 w-4" /> },
          { label: t("layout.compare") ?? "Compare", href: "/agent/compare", icon: <Scale className="h-4 w-4" /> },
        ],
      },
      {
        key: "book",
        label: t("layout.my_book") ?? "My Book",
        items: [
          { label: t("layout.my_policies") ?? "My Policies", href: "/agent/policies", icon: <FileText className="h-4 w-4" /> },
          { label: t("layout.policy_values") ?? "Surrender Values", href: "/agent/values", icon: <TrendingUp className="h-4 w-4" /> },
          { label: t("layout.customers") ?? "Customers", href: "/agent/customers", icon: <Users className="h-4 w-4" /> },
          { label: t("layout.claims") ?? "Claims", href: "/agent/claims", icon: <ShieldCheck className="h-4 w-4" /> },
        ],
      },
    ],
    [locale]
  )

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
                <span className="text-[11px] sm:text-[10px] uppercase tracking-wider text-white/60 font-semibold">{t("layout.agent_portal")}</span>
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
          {navSections.map((section) => (
            <div key={section.key}>
              {!sidebarCollapsed && <div className="px-2 text-[11px] sm:text-[10px] font-black uppercase tracking-[0.25em] text-white/40 mb-3">{section.label}</div>}
              <nav className="space-y-1">
                {section.items.map((item) => {
                  const active = location === item.href
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={[
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors relative group",
                        active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
                        sidebarCollapsed ? "justify-center" : "justify-between"
                      ].join(" ")}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <span className={`flex items-center ${sidebarCollapsed ? '' : 'gap-3'}`}>
                        {item.icon}
                        {!sidebarCollapsed && item.label}
                      </span>
                      {!sidebarCollapsed && item.href === "/agent/my-queue" && (
                        <span className="inline-flex items-center rounded-full bg-[#0D9488]/15 text-[#5eead4] border border-[#0D9488]/30 px-2 py-0.5 text-[11px] sm:text-[10px] font-black tabular-nums">
                          {queueCount}
                        </span>
                      )}
                      {sidebarCollapsed && item.href === "/agent/my-queue" && queueCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[#0D9488] text-white text-[11px] sm:text-[10px] font-black flex items-center justify-center">
                          {queueCount}
                        </span>
                      )}
                    </Link>
                  )
                })}
                {section.key === "main" && queueCountError && !sidebarCollapsed && <div className="text-xs text-white/50 px-2 mt-2">Queue badge unavailable</div>}
              </nav>
            </div>
          ))}

          <div>
            {!sidebarCollapsed && <div className="px-2 text-[11px] sm:text-[10px] font-black uppercase tracking-[0.25em] text-white/40 mb-3">{t("layout.account")}</div>}
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
                    <div className="text-[11px] sm:text-[10px] uppercase tracking-widest text-white/60 font-black truncate">
                      {agent?.role ?? "agent"}
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
