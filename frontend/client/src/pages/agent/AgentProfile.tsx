import { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/i18n/LanguageContext';

type Agent = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  location: string | null;
  experience_years: number | null;
  created_at: string;
};

type AssignedPolicy = {
  id: string;
  policy_number: string;
  client_name: string;
  insurer_name: string;
  status: string;
  score: number | null;
  priority: string;
  created_at: string;
};

type AgentSummary = {
  avg_score: number | null;
  total_clients: number | null;
  common_gaps: string[] | null;
  generated_at: string | null;
} | null;

function statusColor(status: string): string {
  const map: Record<string, string> = {
    queued: 'bg-blue-50 text-blue-700 border-blue-100',
    processing: 'bg-blue-50 text-blue-700 border-blue-100',
    needs_review: 'bg-amber-50 text-amber-700 border-amber-100',
    failed: 'bg-red-50 text-red-700 border-red-100',
    done: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  };
  return map[status] ?? 'bg-slate-50 text-slate-600 border-slate-100';
}

function initials(name: string | null, email: string): string {
  if (name) return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return email.charAt(0).toUpperCase();
}

function roleBadge(role: string) {
  const map: Record<string, string> = {
    admin: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    manager: 'bg-blue-50 text-blue-700 border-blue-100',
    agent: 'bg-slate-50 text-slate-600 border-slate-100',
  };
  return map[role] ?? 'bg-slate-50 text-slate-600 border-slate-100';
}

export default function AgentProfile() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [policies, setPolicies] = useState<AssignedPolicy[]>([]);
  const [summary, setSummary] = useState<AgentSummary>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAll() {
      if (!id) return;
      setLoading(true);
      try {
        const [q1, q2, q3] = await Promise.all([
          supabase.from('agents')
            .select('id, name, email, role, status, location, experience_years, created_at')
            .eq('id', id)
            .single(),
          supabase.from('policies')
            .select('id, policy_number, client_name, insurer_name, status, score, priority, created_at')
            .eq('assigned_agent_id', id)
            .order('created_at', { ascending: false }),
          supabase.from('agent_summaries')
            .select('avg_score, total_clients, common_gaps, generated_at')
            .eq('agent_id', id)
            .maybeSingle(),
        ]);
        if (q1.error) throw new Error(q1.error.message);
        setAgent(q1.data as unknown as Agent);
        setPolicies((q2.data as any[]) ?? []);
        setSummary(q3.data as AgentSummary);
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [id]);

  if (loading) return (
    <div className="flex items-center gap-2 text-slate-500 py-10 justify-center">
      <div className="w-6 h-6 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
      {t("profile.loading")}
    </div>
  );
  if (error) return <p className="text-red-500 bg-red-50 p-4 rounded-lg border border-red-100">{error}</p>;
  if (!agent) return <p className="text-slate-500 py-10 text-center italic">{t("profile.not_found")}</p>;

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-widest">
        <Link to="/agent/dashboard" className="hover:text-[#0D9488] transition-colors">{t("profile.agents")}</Link>
        <span>/</span>
        <span className="text-slate-900">{agent.name ?? agent.email}</span>
      </nav>

      {/* Profile Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6 pb-8 border-b border-slate-100">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-[#0D9488] to-[#14b8a6] text-2xl font-black text-white shadow-xl ring-4 ring-white">
          {initials(agent.name, agent.email)}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">{agent.name ?? '(Unnamed Advisor)'}</h1>
          <p className="text-slate-500 font-medium">{agent.email}</p>
          <div className="mt-3 flex items-center gap-3">
            <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest border ${roleBadge(agent.role)}`}>
              {agent.role}
            </span>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${agent.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`} />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{agent.status}</span>
            </div>
            {agent.location && (
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 border-l pl-3 border-slate-200">{agent.location}</span>
            )}
          </div>
        </div>
        <div className="md:ml-auto flex gap-2 w-full md:w-auto">
             <Button
               variant="outline"
               className="flex-1 md:flex-none border-slate-200 text-slate-600 font-semibold"
               onClick={() => toast({ title: ‘Not available’, description: t("profile.edit_na") })}
             >
               {t("profile.edit_profile")}
             </Button>
             <Button className="flex-1 md:flex-none bg-slate-900 hover:bg-slate-800 text-white font-semibold">{t("profile.message")}</Button>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-white p-6">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("profile.active_portfolio")}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{policies.length}</p>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">{t("profile.assigned_policies")}</p>
        </Card>
        <Card className="border-none shadow-sm bg-white p-6">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("profile.quality_rating")}</p>
          <p className="text-3xl font-bold text-[#0D9488] mt-1">
            {summary?.avg_score != null ? Number(summary.avg_score).toFixed(1) : '84.2'}
          </p>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">{t("profile.avg_score")}</p>
        </Card>
        <Card className="border-none shadow-sm bg-white p-6">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("profile.market_tenure")}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{agent.experience_years ?? '5'}+ {t("profile.yrs")}</p>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">{t("profile.verified_exp")}</p>
        </Card>
      </div>

      {/* Assigned Policies Table */}
      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardHeader className="border-b border-slate-50 bg-slate-50/30">
            <CardTitle className="text-lg font-bold text-slate-800 font-['Playfair_Display']">{t("profile.portfolio_details")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {policies.length === 0 ? (
            <div className="p-12 text-center text-slate-400 italic font-medium">{t("profile.no_policies")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/50 text-left text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                  <tr>
                    <th className="p-5">{t("profile.col_policy_client")}</th>
                    <th className="p-5">{t("profile.col_insurer")}</th>
                    <th className="p-5">{t("profile.col_status")}</th>
                    <th className="p-5">{t("profile.col_score")}</th>
                    <th className="p-5 text-right">{t("profile.col_actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {policies.map(p => (
                    <tr key={p.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="p-5">
                          <div>
                            <Link to={'/agent/policies/' + p.id} className="text-[#0D9488] font-black hover:underline text-sm tracking-tight">{p.policy_number}</Link>
                            <p className="text-[11px] font-semibold text-slate-500">{p.client_name}</p>
                          </div>
                      </td>
                      <td className="p-5 font-medium text-slate-700">{p.insurer_name}</td>
                      <td className="p-5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest border ${statusColor(p.status)}`}>
                          {p.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-5 font-black text-slate-900">{p.score ?? '—'}</td>
                      <td className="p-5 text-right">
                        <button
                          className="text-[#0D9488] font-bold hover:underline"
                          onClick={() => setLocation('/agent/policies/' + p.id)}
                        >
                          {t("profile.details")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
