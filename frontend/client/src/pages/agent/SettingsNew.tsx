import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { FormFieldSkeleton } from "@/components/ui/skeleton"
import { supabase } from "@/lib/supabase"
import { useAgent } from "@/context/AgentContext"
import { InlineErrorState } from "@/components/agent/InlineErrorState"
import { toast } from "@/hooks/use-toast"

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
      toast({ variant: "success", title: "Profile updated" })
      await refresh()
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Update failed", description: e instanceof Error ? e.message : "Could not update profile." })
    } finally {
      setSaveStatus("")
    }
  }

  async function changePassword() {
    setPasswordError(null)
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Confirmation does not match.")
      return
    }

    setPasswordSaveStatus("saving")
    try {
      const { error: uErr } = await supabase.auth.updateUser({ password: newPassword })
      if (uErr) throw new Error(uErr.message)
      toast({ variant: "success", title: "Password updated" })
      setNewPassword("")
      setConfirmPassword("")
    } catch (e: unknown) {
      setPasswordError(e instanceof Error ? e.message : "Password update failed.")
    } finally {
      setPasswordSaveStatus("")
    }
  }

  if (error) return <InlineErrorState onRetry={() => window.location.reload()} />

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-end justify-between border-b border-slate-100 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">Account Orchestration</h1>
            <p className="text-slate-500 font-medium">Manage your professional identity and workspace preferences.</p>
          </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Identity Info */}
          <div className="space-y-6">
            <Card className="border-none shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="text-xs font-black text-slate-900 uppercase tracking-widest">Personal Identification</CardTitle>
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
                            <label className="text-[11px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</label>
                            <Input value={profileName} onChange={e => setProfileName(e.target.value)} className="bg-slate-50 border-slate-100 focus:border-[#0D9488] font-semibold h-11" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Registered Email</label>
                            <Input value={agentProfile?.email ?? ''} readOnly className="bg-slate-50/50 border-slate-100 text-slate-400 cursor-not-allowed font-medium h-11" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorization Level</label>
                                <div className="h-11 flex items-center px-4 bg-slate-50/50 border border-slate-100 rounded-lg text-xs font-bold text-slate-500 uppercase">
                                    {agentProfile?.role}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Location</label>
                                <Input value={profileLocation} onChange={e => setProfileLocation(e.target.value)} className="bg-slate-50 border-slate-100 focus:border-[#0D9488] font-semibold h-11" />
                            </div>
                        </div>
                    </div>
                    )}
                    <div className="pt-4 flex items-center gap-4">
                        <Button onClick={saveProfile} disabled={saveStatus === "saving" || loading} className="bg-[#0D9488] hover:bg-[#0f766e] text-white font-black uppercase text-[11px] sm:text-[10px] tracking-widest px-8">
                            {saveStatus === "saving" ? "Saving…" : "Save"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
          </div>

          {/* Security */}
          <div className="space-y-6">
            <Card className="border-none shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="text-xs font-black text-slate-900 uppercase tracking-widest">Security Credentials</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">New Vault Password</label>
                            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="bg-slate-50 border-slate-100 focus:border-[#0D9488] h-11" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Confirm Credentials</label>
                            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="bg-slate-50 border-slate-100 focus:border-[#0D9488] h-11" />
                        </div>
                    </div>
                    <div className="pt-4 flex flex-col gap-3">
                        <Button onClick={changePassword} disabled={passwordSaveStatus === "saving"} className="bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-[11px] sm:text-[10px] tracking-widest w-full h-11">
                            {passwordSaveStatus === "saving" ? "Saving…" : "Update Password"}
                        </Button>
                        <div className="min-h-4 text-center">
                          {passwordError && <span className="text-[11px] sm:text-[10px] font-black text-red-600 uppercase tracking-widest">{passwordError}</span>}
                        </div>
                    </div>
                </CardContent>
            </Card>
          </div>
      </div>
    </div>
  );
}
