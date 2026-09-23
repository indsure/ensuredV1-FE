import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import TeamAccessLog from "@/components/agent/TeamAccessLog"
import { FormFieldSkeleton } from "@/components/ui/skeleton"
import { supabase } from "@/lib/supabase"
import { useAgent } from "@/context/AgentContext"
import { InlineErrorState } from "@/components/agent/InlineErrorState"
import { toast } from "@/hooks/use-toast"
import { apiFetch } from "@/lib/api"
import { useLanguage } from "@/i18n/LanguageContext"

type AgentProfile = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  location: string | null;
  experience_years: number | null;
};

type TeamAgent = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  created_at: string;
};

function roleBadge(role: string) {
  const map: Record<string, string> = {
    admin: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    manager: 'bg-blue-50 text-blue-700 border-blue-100',
    agent: 'bg-slate-50 text-slate-600 border-slate-100',
  };
  return map[role] ?? 'bg-slate-50 text-slate-600 border-slate-100';
}

export default function SettingsNew() {
  const { t } = useLanguage()
  const [exporting, setExporting] = useState(false)

  /* Fetched rather than linked, because the route needs the auth header and a
     plain anchor cannot carry one. The blob is built in the browser and
     released straight after, so nothing is left sitting in memory. */
  async function exportAccount() {
    setExporting(true)
    try {
      const res = await apiFetch("/api/agent/export")
      if (!res.ok) throw new Error(t("settings.export_failed"))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `indsure-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({ variant: "success", title: t("settings.downloaded") })
    } catch {
      toast({ variant: "destructive", title: t("settings.export_build_failed"), description: t("settings.try_moment") })
    } finally {
      setExporting(false)
    }
  }

  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { agent, refresh } = useAgent();

  const [profileName, setProfileName] = useState('');
  const [profileLocation, setProfileLocation] = useState('');
  const [saveStatus, setSaveStatus] = useState<"" | "saving">("")

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaveStatus, setPasswordSaveStatus] = useState<"" | "saving">("")
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAll() {
      if (!agent?.agentId) return;
      setLoading(true);
      
      // Select * rather than an explicit column list: the live `agents` table
      // has drifted from local (some columns like `status`/`experience_years`
      // may not exist), and naming a missing column 500s the whole query and
      // blanks this page. `*` returns whatever exists.
      const { data: q1, error } = await supabase.from('agents').select('*').eq('id', agent.agentId).single();

      if (error) { setError(error.message); setLoading(false); return; }
      const profile = q1 as unknown as AgentProfile;
      setAgentProfile(profile);
      setProfileName(profile.name ?? '');
      setProfileLocation(profile.location ?? '');
      setLoading(false);
    }
    fetchAll();
  }, [agent?.agentId]);

  async function saveProfile() {
    if (!agentProfile) return;
    setSaveStatus("saving")
    try {
      const { error: uErr } = await supabase
        .from("agents")
        .update({ 
          name: profileName, 
          full_name: profileName,
          location: profileLocation,
          city: profileLocation
        })
        .eq("id", agentProfile.id)

      if (uErr) throw new Error(uErr.message)
      toast({ variant: "success", title: t("settings.profile_updated") })
      await refresh()
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("settings.update_failed"), description: e instanceof Error ? e.message : t("settings.profile_failed") })
    } finally {
      setSaveStatus("")
    }
  }

  async function changePassword() {
    setPasswordError(null)
    if (newPassword.length < 8) {
      setPasswordError(t("settings.pw_short"))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("settings.pw_mismatch"))
      return
    }

    setPasswordSaveStatus("saving")
    try {
      const { error: uErr } = await supabase.auth.updateUser({ password: newPassword })
      if (uErr) throw new Error(uErr.message)
      toast({ variant: "success", title: t("settings.pw_updated") })
      setNewPassword("")
      setConfirmPassword("")
    } catch (e: unknown) {
      setPasswordError(e instanceof Error ? e.message : t("settings.pw_failed"))
    } finally {
      setPasswordSaveStatus("")
    }
  }

  if (error) return <InlineErrorState onRetry={() => window.location.reload()} />

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-end justify-between border-b border-slate-100 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">{t("settings.title")}</h1>
            <p className="text-slate-500 font-medium">{t("settings.subtitle")}</p>
          </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Identity Info */}
          <div className="space-y-6">
            <Card className="border-none shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="text-xs font-black text-slate-900 uppercase tracking-widest">{t("settings.profile")}</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                    {loading ? (
                      <div className="space-y-4">
                        <FormFieldSkeleton />
                        <FormFieldSkeleton />
                        <FormFieldSkeleton />
                      </div>
                    ) : (
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label htmlFor="settings-name" className="text-xs font-black text-slate-500 uppercase tracking-widest">{t("settings.full_name")}</label>
                            <Input id="settings-name" value={profileName} onChange={e => setProfileName(e.target.value)} className="bg-slate-50 border-slate-100 focus:border-[#0D9488] font-semibold h-11" />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="settings-email" className="text-xs font-black text-slate-500 uppercase tracking-widest">{t("settings.email")}</label>
                            <Input id="settings-email" value={agentProfile?.email ?? ''} readOnly className="bg-slate-50/50 border-slate-100 text-slate-400 cursor-not-allowed font-medium h-11" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{t("settings.role")}</span>
                                <div className="h-11 flex items-center px-4 bg-slate-50/50 border border-slate-100 rounded-lg text-xs font-bold text-slate-500 uppercase">
                                    {!agentProfile?.role || agentProfile.role === "agent" ? t("layout.role_agent") : agentProfile.role}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="settings-city" className="text-xs font-black text-slate-500 uppercase tracking-widest">{t("settings.location")}</label>
                                <Input id="settings-city" value={profileLocation} onChange={e => setProfileLocation(e.target.value)} className="bg-slate-50 border-slate-100 focus:border-[#0D9488] font-semibold h-11" />
                            </div>
                        </div>
                    </div>
                    )}
                    <div className="pt-4 flex items-center gap-4">
                        <Button onClick={saveProfile} disabled={saveStatus === "saving" || loading} className="bg-[#0D9488] hover:bg-[#0f766e] text-white font-black uppercase text-xs tracking-widest px-8">
                            {saveStatus === "saving" ? t("settings.saving") : t("settings.save")}
                        </Button>
                    </div>
                </CardContent>
            </Card>
          </div>

          {/* Security */}
          <div className="space-y-6">
            <Card className="border-none shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="text-xs font-black text-slate-900 uppercase tracking-widest">{t("settings.security")}</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label htmlFor="settings-new-pw" className="text-xs font-black text-slate-500 uppercase tracking-widest">{t("settings.new_password")}</label>
                            <Input id="settings-new-pw" autoComplete="new-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="bg-slate-50 border-slate-100 focus:border-[#0D9488] h-11" />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="settings-confirm-pw" className="text-xs font-black text-slate-500 uppercase tracking-widest">{t("settings.confirm_password")}</label>
                            <Input id="settings-confirm-pw" autoComplete="new-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="bg-slate-50 border-slate-100 focus:border-[#0D9488] h-11" />
                        </div>
                    </div>
                    <div className="pt-4 flex flex-col gap-3">
                        <Button onClick={changePassword} disabled={passwordSaveStatus === "saving"} className="bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-xs tracking-widest w-full h-11">
                            {passwordSaveStatus === "saving" ? t("settings.saving") : t("settings.update_password")}
                        </Button>
                        <div className="min-h-4 text-center">
                          {passwordError && <span className="text-xs font-black text-red-600 uppercase tracking-widest">{passwordError}</span>}
                        </div>
                    </div>
                </CardContent>
            </Card>
          </div>
      </div>

      {/* Your data, on request. The privacy policy has always promised people
          control over what we hold; until now there was no way to exercise any
          of it from inside the product. Export is the half that cannot destroy
          anything, so it ships first. Deletion follows as its own change. */}
      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-xs font-black text-slate-900 uppercase tracking-widest">{t("settings.your_data")}</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-slate-600 max-w-prose">
            {t("settings.your_data_desc")}
          </p>
          <Button
            onClick={exportAccount}
            disabled={exporting}
            variant="outline"
            className="font-bold"
          >
            {exporting ? t("settings.preparing") : t("settings.download")}
          </Button>
        </CardContent>
      </Card>

      {/* Renders only for an advisor who is on someone's team. */}
      <TeamAccessLog />
    </div>
  );
}
