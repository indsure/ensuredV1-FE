import { ReactNode, useEffect, useMemo, useState } from "react"
import { Link, useLocation } from "wouter"
import { BarChart3, FileText, LayoutDashboard, Settings, ListChecks, LogOut, User, Sparkles, Menu, X } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { useAgent } from "@/context/AgentContext"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAgentMetrics } from "@/hooks/use-agent-metrics"
import { InlineErrorState } from "@/components/agent/InlineErrorState"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

interface AgentLayoutProps {
  children: ReactNode;
}

export default function AgentLayout({ children }: AgentLayoutProps) {
  const { agent } = useAgent()
  const [location] = useLocation()
  const [profileOpen, setProfileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [queueCount, setQueueCount] = useState<number>(0)
  const [queueCountError, setQueueCountError] = useState<string | null>(null)

  const { stats, performance, loading: metricsLoading, error: metricsError, refetch: refetchMetrics } = useAgentMetrics(
    agent?.agentId
  )

  const nav = useMemo(
    () => [
      { label: "Overview", href: "/agent/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
      { label: "Live Demo", href: "/agent/demo", icon: <Sparkles className="h-4 w-4 text-amber-500" /> },
      { label: "My Queue", href: "/agent/my-queue", icon: <ListChecks className="h-4 w-4" /> },
      { label: "My Policies", href: "/agent/policies", icon: <FileText className="h-4 w-4" /> },
      { label: "My Reports", href: "/agent/reports", icon: <BarChart3 className="h-4 w-4" /> },
    ],
    []
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
      <aside className={`${sidebarCollapsed ? 'w-[80px]' : 'w-[260px]'} bg-[#0B1120] text-white flex flex-col border-r border-white/5 transition-all duration-300 ease-in-out relative`}>
        <div className={`${sidebarCollapsed ? 'px-3' : 'px-6'} py-4 border-b border-white/5 flex items-center justify-between transition-all duration-300`}>
          <Link to="/agent/dashboard" className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} flex-1 min-w-0`}>
            <img 
              src="/logo.png" 
              alt="IndSure" 
              className={`${sidebarCollapsed ? 'h-10 w-10' : 'h-12 w-12'} object-contain flex-shrink-0`}
            />
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-lg font-bold text-white leading-tight">IndSure</span>
                <span className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">Agent Portal</span>
              </div>
            )}
          </Link>
          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0"
              aria-label="Collapse sidebar"
            >
              <Menu className="h-5 w-5 text-white" />
            </button>
          )}
        </div>
        
        {sidebarCollapsed && (
          <div className="px-3 py-3 border-b border-white/5">
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
          <div>
            {!sidebarCollapsed && <div className="px-2 text-[10px] font-black uppercase tracking-[0.25em] text-white/40 mb-3">Main</div>}
            <nav className="space-y-1">
              {nav.map((item) => {
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
                      <span className="inline-flex items-center rounded-full bg-[#0D9488]/15 text-[#5eead4] border border-[#0D9488]/30 px-2 py-0.5 text-[10px] font-black tabular-nums">
                        {queueCount}
                      </span>
                    )}
                    {sidebarCollapsed && item.href === "/agent/my-queue" && queueCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[#0D9488] text-white text-[10px] font-black flex items-center justify-center">
                        {queueCount}
                      </span>
                    )}
                  </Link>
                )
              })}
              {queueCountError && !sidebarCollapsed && <div className="text-xs text-white/50 px-2 mt-2">Queue badge unavailable</div>}
            </nav>
          </div>

          <div>
            {!sidebarCollapsed && <div className="px-2 text-[10px] font-black uppercase tracking-[0.25em] text-white/40 mb-3">Account</div>}
            <nav className="space-y-1">
              <Link
                to="/agent/settings"
                className={[
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  location === "/agent/settings" ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
                  sidebarCollapsed ? "justify-center" : ""
                ].join(" ")}
                title={sidebarCollapsed ? "Settings" : undefined}
              >
                <Settings className="h-4 w-4" />
                {!sidebarCollapsed && "Settings"}
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
                    <div className="text-[10px] uppercase tracking-widest text-white/60 font-black truncate">
                      {agent?.role ?? "agent"}
                    </div>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                <User />
                My Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void signOut()}>
                <LogOut />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 lg:p-8">{children}</main>

      {/* My Profile Sheet */}
      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent side="right" className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>My Profile</SheetTitle>
            <SheetDescription>Your account and performance snapshot.</SheetDescription>
          </SheetHeader>

          {metricsError ? (
            <InlineErrorState onRetry={refetchMetrics} />
          ) : (
            <div className="space-y-6 mt-6">
              {/* Header */}
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-[#0D9488] to-[#14b8a6] flex items-center justify-center text-2xl font-black uppercase text-white">
                  {initials}
                </div>
                <div className="flex-1">
                  <div className="text-2xl font-bold text-slate-900">{agent?.name ?? "Agent"}</div>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-sm text-slate-600 font-semibold">{agent?.role ?? "agent"}</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-sm text-slate-600">{agent?.location ?? "—"}</span>
                    <span className="inline-flex items-center gap-2 ml-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-xs text-slate-500 font-semibold">Active</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Total Policies", stats.totalPolicies],
                  ["Completed", stats.completed],
                  ["High Risk", stats.highRisk],
                  ["Avg Risk Score", stats.avgRiskScore == null ? "—" : stats.avgRiskScore.toFixed(1)],
                ].map(([label, value]) => (
                  <Card key={label} className="p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</div>
                    <div className="mt-1 text-2xl font-black text-slate-900 tabular-nums">
                      {metricsLoading ? "…" : value}
                    </div>
                  </Card>
                ))}
              </div>

              {/* Details */}
              <Card className="p-4 space-y-3">
                {[
                  ["Email", agent?.email ?? "—"],
                  ["Phone", "—"],
                  ["Joined date", "—"],
                  ["Role", agent?.role ?? "agent"],
                  ["Location", agent?.location ?? "—"],
                  ["Companies partnered with", "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-slate-500 font-semibold">{k}</span>
                    <span className="text-slate-900 font-semibold">{v}</span>
                  </div>
                ))}
              </Card>

              {/* Mini chart */}
              <Card className="p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                  Performance (last 6 months)
                </div>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={performance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontWeight: "bold" }} />
                      <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#0D9488" strokeWidth={3} dot={{ r: 3, strokeWidth: 2 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="failed" name="Failed" stroke="#F43F5E" strokeWidth={3} dot={{ r: 3, strokeWidth: 2 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}

          <div className="mt-6 pt-6 border-t flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => (window.location.href = "/agent/settings")}>
              Edit Profile
            </Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={() => void signOut()}>
              Sign Out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
