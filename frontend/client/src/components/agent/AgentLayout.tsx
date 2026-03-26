import { ReactNode, useEffect, useMemo, useState } from "react"
import { Link, useLocation } from "wouter"
import { BarChart3, FileText, LayoutDashboard, Settings, ListChecks, LogOut, User, Sparkles } from "lucide-react"

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
      .from("policy_analyses")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agent.agentId)
      .or("status.eq.failed,status.eq.processing,needs_review.eq.true")
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
      <aside className="w-[260px] bg-[#0B1120] text-white flex flex-col border-r border-white/5">
        <div className="px-6 py-5 border-b border-white/5">
          <Link to="/agent/dashboard" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#0D9488] flex items-center justify-center shadow-md shadow-[#0D9488]/20">
              <span className="font-['Playfair_Display'] font-black text-lg">I</span>
            </div>
            <div>
              <div className="font-['Playfair_Display'] text-xl font-bold leading-tight">IndSure</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-black">Agent Portal</div>
            </div>
          </Link>
        </div>

        <div className="px-4 py-6 space-y-6 flex-1">
          <div>
            <div className="px-2 text-[10px] font-black uppercase tracking-[0.25em] text-white/40 mb-3">Main</div>
            <nav className="space-y-1">
              {nav.map((item) => {
                const active = location === item.href
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={[
                      "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                      active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-3">
                      {item.icon}
                      {item.label}
                    </span>
                    {item.href === "/agent/my-queue" && (
                      <span className="inline-flex items-center rounded-full bg-[#0D9488]/15 text-[#5eead4] border border-[#0D9488]/30 px-2 py-0.5 text-[10px] font-black tabular-nums">
                        {queueCount}
                      </span>
                    )}
                  </Link>
                )
              })}
              {queueCountError && <div className="text-xs text-white/50 px-2 mt-2">Queue badge unavailable</div>}
            </nav>
          </div>

          <div>
            <div className="px-2 text-[10px] font-black uppercase tracking-[0.25em] text-white/40 mb-3">Account</div>
            <nav className="space-y-1">
              <Link
                to="/agent/settings"
                className={[
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  location === "/agent/settings" ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </nav>
          </div>
        </div>

        {/* Bottom agent pill */}
        <div className="p-4 border-t border-white/5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors px-3 py-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#0D9488] to-[#14b8a6] flex items-center justify-center text-sm font-black uppercase">
                  {initials}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-semibold truncate">{agent?.name ?? "Agent"}</div>
                  <div className="text-[10px] uppercase tracking-widest text-white/60 font-black truncate">
                    {agent?.role ?? "agent"}
                  </div>
                </div>
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
            <div className="space-y-6">
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

          <SheetFooter className="gap-2">
            <Button variant="outline" onClick={() => (window.location.href = "/agent/settings")}>
              Edit Profile
            </Button>
            <Button variant="destructive" onClick={() => void signOut()}>
              Sign Out
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
