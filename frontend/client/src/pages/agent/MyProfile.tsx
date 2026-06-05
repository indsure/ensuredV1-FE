import { useEffect, useState, useCallback } from "react"
import { format } from "date-fns"
import { subMonths, startOfMonth, endOfMonth } from "date-fns"
import { Coins, MapPin, Building2, Phone, Mail, Calendar, ShieldCheck, TrendingUp, CheckCircle2, Circle } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import { useAgent } from "@/context/AgentContext"
import { toast } from "@/hooks/use-toast"
import { InlineErrorState } from "@/components/agent/InlineErrorState"
import { useLanguage } from "@/i18n/LanguageContext"

// ─── Health Insurance Companies ───────────────────────────────────────────────

type InsuranceCompany = {
  name: string;
  type: "standalone" | "general" | "public";
  founded?: number;
};

const HEALTH_INSURANCE_COMPANIES: InsuranceCompany[] = [
  // Standalone Health Insurers (SAHIs)
  { name: "Star Health and Allied Insurance", type: "standalone", founded: 2006 },
  { name: "Niva Bupa Health Insurance", type: "standalone", founded: 2008 },
  { name: "Care Health Insurance", type: "standalone", founded: 2012 },
  { name: "Aditya Birla Health Insurance", type: "standalone", founded: 2016 },
  { name: "ManipalCigna Health Insurance", type: "standalone", founded: 2014 },
  { name: "Acko Health Insurance", type: "standalone", founded: 2016 },
  { name: "Galaxy Health Insurance", type: "standalone", founded: 2023 },
  // Private General Insurers
  { name: "HDFC Ergo Health Insurance", type: "general", founded: 2002 },
  { name: "ICICI Lombard Health Insurance", type: "general", founded: 2001 },
  { name: "Bajaj Allianz Health Insurance", type: "general", founded: 2001 },
  { name: "Tata AIG Health Insurance", type: "general", founded: 2001 },
  { name: "Go Digit Health Insurance", type: "general", founded: 2017 },
  { name: "SBI Health Insurance", type: "general", founded: 2009 },
  { name: "Kotak Mahindra Health Insurance", type: "general", founded: 2015 },
  { name: "Royal Sundaram Health Insurance", type: "general", founded: 2001 },
  { name: "Future Generali Health Insurance", type: "general", founded: 2007 },
  { name: "Cholamandalam MS Health Insurance", type: "general", founded: 2001 },
  { name: "Magma HDI Health Insurance", type: "general", founded: 2009 },
  { name: "Liberty General Insurance", type: "general", founded: 2013 },
  { name: "Iffco Tokio Health Insurance", type: "general", founded: 2000 },
  { name: "Universal Sompo Health Insurance", type: "general", founded: 2007 },
  { name: "Raheja QBE Health Insurance", type: "general", founded: 2007 },
  { name: "Reliance Health Insurance", type: "general", founded: 2000 },
  { name: "Zurich Kotak General Insurance", type: "general", founded: 2015 },
  // Public Sector
  { name: "New India Assurance", type: "public", founded: 1919 },
  { name: "United India Insurance", type: "public", founded: 1938 },
  { name: "Oriental Insurance", type: "public", founded: 1947 },
  { name: "National Insurance Company", type: "public", founded: 1906 },
];

const TYPE_LABELS: Record<InsuranceCompany["type"], string> = {
  standalone: "Standalone Health Insurer",
  general: "Private General Insurer",
  public: "Public Sector Insurer",
};

const TYPE_COLORS: Record<InsuranceCompany["type"], string> = {
  standalone: "bg-teal-50 text-teal-700 border-teal-100",
  general: "bg-indigo-50 text-indigo-700 border-indigo-100",
  public: "bg-amber-50 text-amber-700 border-amber-100",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentRow = {
  id: string;
  name: string | null;
  full_name: string | null;
  email: string;
  role: string;
  status: string;
  location: string | null;
  city: string | null;
  phone: string | null;
  phone_number: string | null;
  firm_name: string | null;
  experience_years: number | null;
  created_at: string | null;
  partnered_companies?: string[] | null;
};

type Stats = {
  total: number;
  completed: number;
  highRisk: number;
  avgScore: number | null;
};

type ChartPoint = { month: string; completed: number; failed: number };

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="border-none shadow-sm bg-white p-5">
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
      <div className="mt-1.5 text-3xl font-black text-slate-900 tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-slate-400 font-medium">{sub}</div>}
    </Card>
  )
}

export default function MyProfile() {
  const { agent, creditsRemaining, refresh } = useAgent()
  const { t } = useLanguage()

  const [profile, setProfile] = useState<AgentRow | null>(null)
  const [stats, setStats] = useState<Stats>({ total: 0, completed: 0, highRisk: 0, avgScore: null })
  const [chart, setChart] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<"profile" | "companies">("profile")

  // Edit form state
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [location, setLocation] = useState("")
  const [firm, setFirm] = useState("")
  const [saving, setSaving] = useState(false)

  // Partnered companies state
  const [partnered, setPartnered] = useState<Set<string>>(new Set())
  const [savingPartners, setSavingPartners] = useState(false)

  // Password state
  const [newPass, setNewPass] = useState("")
  const [confirmPass, setConfirmPass] = useState("")
  const [passError, setPassError] = useState<string | null>(null)
  const [savingPass, setSavingPass] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!agent?.agentId) return
    setLoading(true)
    setError(null)
    try {
      const [profileRes, statsRes] = await Promise.all([
        supabase
          .from("agents")
          .select("*")
          .eq("id", agent.agentId)
          .single(),
        supabase
          .from("clients")
          .select("id, status, score")
          .eq("agent_id", agent.agentId),
      ])

      if (profileRes.error) throw new Error(profileRes.error.message)

      const p = profileRes.data as AgentRow
      setProfile(p)
      setName(p.full_name || p.name || "")
      setPhone(p.phone_number || p.phone || "")
      setLocation(p.location || p.city || "")
      setFirm(p.firm_name || "")
      setPartnered(new Set(p.partnered_companies ?? []))

      const rows = statsRes.data ?? []
      const completed = rows.filter(r => r.status === "done")
      const scores = completed.map(r => r.score).filter((s): s is number => s != null)
      setStats({
        total: rows.length,
        completed: completed.length,
        highRisk: completed.filter(r => (r.score ?? 101) < 70).length,
        avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      })

      // Re-fetch with created_at for chart
      const { data: chartRows } = await supabase
        .from("clients")
        .select("status, created_at")
        .eq("agent_id", agent.agentId)
        .gte("created_at", subMonths(new Date(), 6).toISOString())

      const chartData: ChartPoint[] = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(new Date(), 5 - i)
        const start = startOfMonth(d)
        const end = endOfMonth(d)
        const inMonth = (chartRows ?? []).filter(r => {
          const dt = new Date(r.created_at)
          return dt >= start && dt <= end
        })
        return {
          month: format(d, "MMM"),
          completed: inMonth.filter(r => r.status === "done").length,
          failed: inMonth.filter(r => r.status === "error").length,
        }
      })
      setChart(chartData)
    } catch (e: unknown) {
      console.error("[MyProfile] fetch error:", e)
      setError(e instanceof Error ? e.message : "Failed to load profile")
    } finally {
      setLoading(false)
    }
  }, [agent?.agentId])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function saveProfile() {
    if (!profile) return
    setSaving(true)
    try {
      const { error: uErr } = await supabase
        .from("agents")
        .update({ name, full_name: name, phone, location, city: location })
        .eq("id", profile.id)
      if (uErr) throw new Error(uErr.message)
      // Save extended fields separately — silently ignore if columns don't exist yet
      await supabase.from("agents").update({ phone_number: phone, firm_name: firm }).eq("id", profile.id)
      await refresh()
      toast({ variant: "success", title: "Profile updated" })
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Update failed", description: e instanceof Error ? e.message : "Could not save." })
    } finally {
      setSaving(false)
    }
  }

  async function changePassword() {
    setPassError(null)
    if (newPass.length < 8) { setPassError("Minimum 8 characters."); return }
    if (newPass !== confirmPass) { setPassError("Passwords don't match."); return }
    setSavingPass(true)
    try {
      const { error: uErr } = await supabase.auth.updateUser({ password: newPass })
      if (uErr) throw new Error(uErr.message)
      toast({ variant: "success", title: "Password updated" })
      setNewPass(""); setConfirmPass("")
    } catch (e: unknown) {
      setPassError(e instanceof Error ? e.message : "Password update failed.")
    } finally {
      setSavingPass(false)
    }
  }

  function toggleCompany(name: string) {
    setPartnered(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  async function savePartners() {
    if (!profile) return
    setSavingPartners(true)
    try {
      const { error: uErr } = await supabase
        .from("agents")
        .update({ partnered_companies: Array.from(partnered) })
        .eq("id", profile.id)
      if (uErr) throw new Error(uErr.message)
      toast({ variant: "success", title: "Partnerships saved" })
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Save failed", description: e instanceof Error ? e.message : "Could not save. The partnered_companies column may need to be added to your agents table." })
    } finally {
      setSavingPartners(false)
    }
  }

  const initials = agent?.avatarInitials ?? "?"
  const displayName = name || profile?.email || "Agent"
  const joinedDate = profile?.created_at ? format(new Date(profile.created_at), "MMM yyyy") : "—"

  if (error) return <InlineErrorState onRetry={fetchAll} />

  return (
    <div className="space-y-8 pb-12">
      {/* Page title */}
      <div className="border-b border-slate-100 pb-6">
        <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">{t("my_profile.title")}</h1>
        <p className="mt-1 text-slate-500 font-medium">{t("my_profile.subtitle")}</p>
      </div>

      {/* Hero */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-[#0D9488] to-[#14b8a6] flex items-center justify-center text-3xl font-black text-white shadow-lg flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-900">{displayName}</h2>
              <span className="inline-flex rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-widest border bg-indigo-50 text-indigo-700 border-indigo-100">
                {profile?.role ?? agent?.role ?? "agent"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("my_profile.active")}</span>
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{profile?.email ?? agent?.email ?? "—"}</span>
              {(location) && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{location}</span>}
              {firm && <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />{firm}</span>}
              <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{t("my_profile.joined")} {joinedDate}</span>
            </div>
          </div>
          {/* Credits chip */}
          <div className="flex-shrink-0 rounded-2xl border border-teal-100 bg-teal-50 px-5 py-4 text-center min-w-[120px]">
            <div className="flex items-center justify-center gap-1.5 text-[#0D9488] mb-1">
              <Coins className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">{t("my_profile.credits")}</span>
            </div>
            <div className="text-3xl font-black text-[#0D9488] tabular-nums">{creditsRemaining}</div>
            <div className="text-[10px] text-teal-600 font-semibold mt-0.5">{t("my_profile.remaining")}</div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t("my_profile.total_policies")} value={loading ? "…" : stats.total} sub={t("my_profile.total_policies_sub")} />
        <StatCard label={t("my_profile.completed")} value={loading ? "…" : stats.completed} sub={t("my_profile.completed_sub")} />
        <StatCard label={t("my_profile.high_risk")} value={loading ? "…" : stats.highRisk} sub={t("my_profile.high_risk_sub")} />
        <StatCard
          label={t("my_profile.avg_score")}
          value={loading ? "…" : stats.avgScore != null ? stats.avgScore : "—"}
          sub={t("my_profile.avg_score_sub")}
        />
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-slate-100">
        {(["profile", "companies"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              "px-5 py-2.5 text-sm font-bold capitalize tracking-tight transition-colors border-b-2 -mb-px",
              activeTab === tab
                ? "border-[#0D9488] text-[#0D9488]"
                : "border-transparent text-slate-400 hover:text-slate-700",
            ].join(" ")}
          >
            {tab === "companies" ? t("my_profile.tab_companies") : t("my_profile.tab_profile")}
          </button>
        ))}
      </div>

      {/* Partnered Companies tab */}
      {activeTab === "companies" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">{t("my_profile.companies_sub")}</p>
              <p className="text-xs text-slate-400 mt-0.5">{partnered.size} {t("my_profile.companies_count")} {HEALTH_INSURANCE_COMPANIES.length} {t("my_profile.companies_selected")}</p>
            </div>
            <Button
              onClick={savePartners}
              disabled={savingPartners}
              className="bg-[#0D9488] hover:bg-[#0f766e] text-white font-black uppercase text-[10px] tracking-widest px-6 h-10"
            >
              {savingPartners ? t("my_profile.saving") : t("my_profile.save_partnerships")}
            </Button>
          </div>

          {(["standalone", "general", "public"] as InsuranceCompany["type"][]).map(type => {
            const companies = HEALTH_INSURANCE_COMPANIES.filter(c => c.type === type)
            return (
              <div key={type}>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`inline-flex rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-widest border ${TYPE_COLORS[type]}`}>
                    {TYPE_LABELS[type]}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    {companies.filter(c => partnered.has(c.name)).length}/{companies.length} {t("my_profile.partnered")}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {companies.map(company => {
                    const selected = partnered.has(company.name)
                    return (
                      <button
                        key={company.name}
                        onClick={() => toggleCompany(company.name)}
                        className={[
                          "flex items-start gap-3 rounded-xl border p-4 text-left transition-all",
                          selected
                            ? "border-[#0D9488] bg-teal-50/50 shadow-sm"
                            : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50",
                        ].join(" ")}
                      >
                        {selected
                          ? <CheckCircle2 className="w-4 h-4 text-[#0D9488] flex-shrink-0 mt-0.5" />
                          : <Circle className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
                        }
                        <div className="min-w-0">
                          <div className={`text-sm font-bold leading-snug ${selected ? "text-slate-900" : "text-slate-600"}`}>
                            {company.name}
                          </div>
                          {company.founded && (
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5">{t("my_profile.est")} {company.founded}</div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Main grid */}
      <div className={activeTab !== "profile" ? "hidden" : ""}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        {/* Left: edit form */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
              <CardTitle className="text-xs font-black text-slate-900 uppercase tracking-widest">{t("my_profile.personal_details")}</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("my_profile.full_name")}</label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    disabled={loading}
                    className="bg-slate-50 border-slate-200 focus:border-[#0D9488] font-semibold h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("my_profile.phone")}</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      disabled={loading}
                      placeholder="+91 98765 43210"
                      className="pl-9 bg-slate-50 border-slate-200 focus:border-[#0D9488] font-semibold h-11"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("my_profile.city")}</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      disabled={loading}
                      placeholder="Mumbai"
                      className="pl-9 bg-slate-50 border-slate-200 focus:border-[#0D9488] font-semibold h-11"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("my_profile.firm")}</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                      value={firm}
                      onChange={e => setFirm(e.target.value)}
                      disabled={loading}
                      placeholder={t("my_profile.firm_placeholder")}
                      className="pl-9 bg-slate-50 border-slate-200 focus:border-[#0D9488] font-semibold h-11"
                    />
                  </div>
                </div>
              </div>

              {/* Read-only fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("my_profile.registered_email")}</label>
                  <div className="h-11 flex items-center px-3 bg-slate-50/50 border border-slate-100 rounded-lg text-sm font-semibold text-slate-400 cursor-not-allowed">
                    {profile?.email ?? "—"}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("my_profile.auth_level")}</label>
                  <div className="h-11 flex items-center px-3 bg-slate-50/50 border border-slate-100 rounded-lg text-xs font-black text-slate-400 uppercase tracking-widest cursor-not-allowed">
                    {profile?.role ?? agent?.role ?? "agent"}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={saveProfile}
                  disabled={saving || loading}
                  className="bg-[#0D9488] hover:bg-[#0f766e] text-white font-black uppercase text-[10px] tracking-widest px-8 h-11"
                >
                  {saving ? t("my_profile.saving") : t("my_profile.save_changes")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Password */}
          <Card className="border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
              <CardTitle className="text-xs font-black text-slate-900 uppercase tracking-widest">{t("my_profile.change_password")}</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("my_profile.new_password")}</label>
                  <Input
                    type="password"
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    className="bg-slate-50 border-slate-200 focus:border-[#0D9488] h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("my_profile.confirm_password")}</label>
                  <Input
                    type="password"
                    value={confirmPass}
                    onChange={e => setConfirmPass(e.target.value)}
                    className="bg-slate-50 border-slate-200 focus:border-[#0D9488] h-11"
                  />
                </div>
              </div>
              {passError && (
                <p className="text-[11px] font-black text-red-500 uppercase tracking-widest">{passError}</p>
              )}
              <Button
                onClick={changePassword}
                disabled={savingPass}
                className="bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-[10px] tracking-widest px-8 h-11"
              >
                {savingPass ? t("my_profile.updating") : t("my_profile.update_password")}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: chart + info */}
        <div className="space-y-6">
          {/* Performance chart */}
          <Card className="border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#0D9488]" />
                <CardTitle className="text-xs font-black text-slate-900 uppercase tracking-widest">{t("my_profile.activity")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontWeight: "bold", fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="completed" name={t("my_profile.chart_completed")} stroke="#0D9488" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="failed" name={t("my_profile.chart_failed")} stroke="#F43F5E" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex items-center gap-4 text-[11px] font-semibold text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#0D9488] rounded-full inline-block" />{t("my_profile.chart_completed")}</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-rose-500 rounded-full inline-block" />{t("my_profile.chart_failed")}</span>
              </div>
            </CardContent>
          </Card>

          {/* Account info */}
          <Card className="border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
              <CardTitle className="text-xs font-black text-slate-900 uppercase tracking-widest">{t("my_profile.account_info")}</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              {[
                [t("my_profile.role"), profile?.role ?? agent?.role ?? "—"],
                [t("my_profile.experience"), profile?.experience_years ? `${profile.experience_years} ${t("my_profile.yrs")}` : "—"],
                [t("my_profile.member_since"), joinedDate],
                [t("my_profile.credits_remaining"), creditsRemaining],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-semibold">{k}</span>
                  <span className="text-slate-900 font-bold tabular-nums">{v}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* IndSure notice */}
          <Card className="border-none shadow-sm bg-white overflow-hidden">
            <CardContent className="p-5 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#0D9488] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-slate-500 leading-relaxed">
                {t("my_profile.privacy_note")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>{/* end profile tab wrapper */}
    </div>
  )
}
