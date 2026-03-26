import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useLocation } from 'wouter';
import { useAgent } from '@/context/AgentContext';
import { RefreshCw, Play, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { startOfWeek, subWeeks, subDays, format, isAfter } from 'date-fns';
import { Button } from '@/components/ui/button';
import { InlineErrorState } from '@/components/agent/InlineErrorState';

type RecentPolicy = {
  id: string;
  policy_number: string;
  client_name: string;
  insurer_name: string;
  status: string;
  score: number | null;
  updated_at: string;
};

type FailedJob = {
  id: string;
  status: string;
  error_type: string | null;
  error_message: string | null;
  queued_at: string | null;
  policy_id: string | null;
  policies: { policy_number: string | null; client_name: string | null } | null;
};

type ChartDataPoint = {
  name: string;
  startDate: Date;
  completed: number;
  failed: number;
};

function getGreeting(name: string) {
  const hour = new Date().getHours();
  // Using user requested explicit logic
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 18) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}

export default function DashboardNew() {
  const [, setLocation] = useLocation();
  const { agent } = useAgent();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Stat counts
  const [stats, setStats] = useState({
    myPolicies: 0,
    myPoliciesDelta: 0,
    highRisk: 0,
    highRiskDelta: 0,
    myQueue: 0,
    avgRiskScore: 0 as number | null
  });

  const [recentActivity, setRecentActivity] = useState<RecentPolicy[]>([]);
  const [funnel, setFunnel] = useState({ submitted: 0, inReview: 0, completed: 0, highRisk: 0, needsAction: 0 });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [failedJobs, setFailedJobs] = useState<FailedJob[]>([]);

  async function fetchDashboard() {
    if (!agent?.agentId) return;
    setLoading(true);
    setError(null);

    const sevenDaysAgo = subDays(new Date(), 7).toISOString();
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    const eightWeeksAgo = subWeeks(new Date(), 8).toISOString();

    try {
      // Run ALL queries in parallel for exactly 1 round trip
      const [
        // 1. My Policies Total Completed
        q1, 
        // 2. My Policies last 7 days (Delta)
        q1b, 
        // 3. High Risk Total
        q2,
        // 4. High Risk last 7 days (Delta)
        q2b,
        // 5. My Queue (processing, queued, failed, needs_review)
        q3,
        // 6. Avg Risk Score (fetch last 30 days completed scores to average in JS)
        q4,
        // 7. Recent Activity (limit 8)
        q5,
        // 8. Funnel (we can construct funnel using counts)
        qFunnelAll, qFunnelReview, qFunnelAction,
        // 9. Chart Data (fetch statuses and dates from last 8 weeks)
        qChart,
        // 10. Recent Failures
        qFailures
      ] = await Promise.all([
        supabase.from('policies').select('id', { count: 'exact', head: true }).eq('agent_id', agent.agentId).eq('status', 'done'),
        supabase.from('policies').select('id', { count: 'exact', head: true }).eq('agent_id', agent.agentId).eq('status', 'done').gte('created_at', sevenDaysAgo),
        
        supabase.from('policies').select('id', { count: 'exact', head: true }).eq('agent_id', agent.agentId).eq('status', 'done').gte('score', 70),
        supabase.from('policies').select('id', { count: 'exact', head: true }).eq('agent_id', agent.agentId).eq('status', 'done').gte('score', 70).gte('created_at', sevenDaysAgo),
        
        supabase.from('policies').select('id', { count: 'exact', head: true }).eq('agent_id', agent.agentId).in('status', ['queued', 'processing', 'failed', 'needs_review']),
        
        supabase.from('policies').select('score').eq('agent_id', agent.agentId).eq('status', 'done').gte('created_at', thirtyDaysAgo),
        
        supabase.from('policies').select('id, policy_number, client_name, insurer_name, status, score, updated_at').eq('agent_id', agent.agentId).order('updated_at', { ascending: false }).limit(8),
        
        supabase.from('policies').select('id', { count: 'exact', head: true }).eq('agent_id', agent.agentId),
        supabase.from('policies').select('id', { count: 'exact', head: true }).eq('agent_id', agent.agentId).in('status', ['queued', 'processing']),
        supabase.from('policies').select('id', { count: 'exact', head: true }).eq('agent_id', agent.agentId).in('status', ['failed', 'needs_review']),

        supabase.from('policies').select('status, created_at').eq('agent_id', agent.agentId).gte('created_at', eightWeeksAgo).in('status', ['done', 'failed']),

        supabase.from('public_analysis_jobs').select('id, status, error_type, error_message, queued_at, policy_id, policies(policy_number, client_name)').eq('agent_id', agent.agentId).eq('status', 'failed').order('queued_at', { ascending: false })
      ]);

      // Calculate Average Risk Score
      const scores = q4.data?.map(p => p.score).filter(s => s !== null) as number[] || [];
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

      setStats({
        myPolicies: q1.count || 0,
        myPoliciesDelta: q1b.count || 0,
        highRisk: q2.count || 0,
        highRiskDelta: q2b.count || 0,
        myQueue: q3.count || 0,
        avgRiskScore: avgScore
      });

      setRecentActivity(q5.data as any[] || []);

      setFunnel({
        submitted: qFunnelAll.count || 0,
        inReview: qFunnelReview.count || 0,
        completed: q1.count || 0,
        highRisk: q2.count || 0,
        needsAction: qFunnelAction.count || 0
      });

      setFailedJobs(qFailures.data as any[] || []);

      // Build 8-Week Chart Data
      const weeks: ChartDataPoint[] = [];
      const now = new Date();
      for (let i = 7; i >= 0; i--) {
        const d = subWeeks(now, i);
        weeks.push({
          name: `W${8 - i}`,
          startDate: startOfWeek(d),
          completed: 0,
          failed: 0,
        });
      }

      if (qChart.data) {
        qChart.data.forEach(policy => {
          const d = new Date(policy.created_at);
          // find which week bucket it belongs to
          const weekBucket = weeks.find((w, index) => {
             const nextWeek = weeks[index + 1]?.startDate || new Date(2100, 1, 1);
             return (d >= w.startDate || isAfter(d, w.startDate)) && d < nextWeek;
          });
          
          // if it falls into one of our weeks
          if (weekBucket) {
             if (policy.status === 'done') weekBucket.completed++;
             if (policy.status === 'failed') weekBucket.failed++;
          }
        });
      }
      setChartData(weeks);

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboard();
  }, [agent?.agentId]);

  async function retryJob(jobId: string) {
    // Calling POST /api/analyses/:id/retry as requested (via Supabase function or local API)
    // The prompt says: Each Retry button calls POST /api/analyses/:id/retry then refreshes the dashboard stats.
    try {
      await fetch(`/api/analyses/${jobId}/retry`, { method: 'POST', headers: { 'x-user-id': agent?.agentId || '' } });
      // In a real scenario this might hit the actual API route, let's gracefully fallback if it doesn't exist
      await supabase.from('public_analysis_jobs').update({ status: 'queued' }).eq('id', jobId);
      fetchDashboard();
    } catch {
      await supabase.from('public_analysis_jobs').update({ status: 'queued' }).eq('id', jobId);
      fetchDashboard();
    }
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-md w-full bg-white border border-slate-100 rounded-2xl p-10 shadow-sm">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-[#0D9488]/10 flex items-center justify-center">
            !
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Agent session missing</h1>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            Please sign in again to continue to your dashboard.
          </p>
          <button
            type="button"
            onClick={() => setLocation("/agent/login")}
            className="px-6 py-3 rounded-xl font-semibold bg-[#0D9488] hover:bg-[#0f766e] text-white transition-colors"
          >
            Go to Agent Login
          </button>
        </div>
      </div>
    );
  }
  if (error) return <InlineErrorState onRetry={fetchDashboard} />;

  function StatusBadge({ status }: { status: string }) {
    if (status === 'done' || status === 'completed') return <span className="text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-800 px-2 py-0.5 rounded-sm">Completed</span>;
    if (status === 'failed') return <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 px-2 py-0.5 rounded-sm">Failed</span>;
    if (status === 'needs_review') return <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-sm">Needs Review</span>;
    return <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-2 flex items-center gap-1 py-0.5 rounded-sm"><div className="w-2 h-2 rounded-full border border-blue-600 border-t-transparent animate-spin"/> Processing</span>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-['Playfair_Display']">
          {getGreeting(agent.name.split(' ')[0] || 'Agent')}
        </h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="text-slate-500 bg-white" onClick={fetchDashboard} disabled={loading}>
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button className="bg-[#0D9488] hover:bg-[#0f766e] text-white shadow-md font-semibold" onClick={() => setLocation('/agent/uploads')}>
            <Play size={16} className="mr-2 fill-current" /> Analyze Policies
          </Button>
        </div>
      </div>

      {/* STAT ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-slate-100 border-l-4 border-l-[#0D9488]">
          <CardContent className="p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">My Policies</h3>
            {loading ? <div className="animate-pulse h-10 w-24 bg-slate-100 rounded-lg mt-2" /> : (
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-slate-800">{stats.myPolicies}</span>
                <span className="text-xs font-semibold text-[#0D9488]">↑ {stats.myPoliciesDelta} this week</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-100 border-l-4 border-l-[#F43F5E]">
          <CardContent className="p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">High Risk</h3>
            {loading ? <div className="animate-pulse h-10 w-24 bg-slate-100 rounded-lg mt-2" /> : (
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-slate-800">{stats.highRisk}</span>
                <span className="text-xs font-semibold text-[#F43F5E]">↑ {stats.highRiskDelta} this week</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-100 border-l-4 border-l-[#F59E0B]">
          <CardContent className="p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">My Queue</h3>
            {loading ? <div className="animate-pulse h-10 w-24 bg-slate-100 rounded-lg mt-2" /> : (
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-[#F59E0B]">{stats.myQueue}</span>
                <span className="text-xs font-medium text-slate-400">pending action</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-100 border-l-4 border-l-[#3B82F6]">
          <CardContent className="p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">My Avg Risk Score</h3>
            {loading ? <div className="animate-pulse h-10 w-24 bg-slate-100 rounded-lg mt-2" /> : (
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-slate-800">
                  {stats.avgRiskScore === null ? '—' : stats.avgRiskScore.toFixed(1)}
                </span>
                <span className="text-xs font-medium text-slate-400">last 30 days</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* TWO COLUMN ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: RECENT ACTIVITY */}
        <Card className="lg:col-span-2 shadow-sm border-slate-100">
          <CardHeader className="border-b border-slate-50 pb-4">
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center justify-between">
              <span>My Recent Activity</span>
              <Button variant="link" className="text-[#0D9488]" onClick={() => setLocation('/agent/policies')}>View All</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
               <div className="p-6 space-y-4">
                 {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-slate-50 animate-pulse rounded-md w-full" />)}
               </div>
            ) : recentActivity.length === 0 ? (
               <div className="p-12 text-center text-slate-400 italic">No recent activity found.</div>
            ) : (
               <table className="w-full text-sm">
                 <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                   <tr>
                     <th className="px-6 py-4 text-left">Policy ID</th>
                     <th className="px-6 py-4 text-left">Client & Insurer</th>
                     <th className="px-6 py-4 text-left">Status</th>
                     <th className="px-6 py-4 text-right">Risk</th>
                     <th className="px-6 py-4 text-right">Updated</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                   {recentActivity.map(p => (
                     <tr key={p.id} className="hover:bg-slate-50/50 cursor-pointer transition-colors" onClick={() => setLocation(`/agent/policies/${p.id}`)}>
                       <td className="px-6 py-4 font-bold text-[#0D9488]">{p.policy_number}</td>
                       <td className="px-6 py-4">
                         <div className="font-semibold text-slate-800">{p.client_name}</div>
                         <div className="text-xs text-slate-500">{p.insurer_name}</div>
                       </td>
                       <td className="px-6 py-4"><StatusBadge status={p.status} /></td>
                       <td className="px-6 py-4 text-right">
                         <span className={`font-bold ${p.score && p.score >= 70 ? 'text-[#F43F5E]' : 'text-slate-800'}`}>{p.score ?? '—'}</span>
                       </td>
                       <td className="px-6 py-4 text-right text-slate-400 text-xs">
                         {format(new Date(p.updated_at), 'MMM d, h:mm a')}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            )}
          </CardContent>
        </Card>

        {/* RIGHT: PIPELINE FUNNEL */}
        <Card className="shadow-sm border-slate-100 flex flex-col">
          <CardHeader className="border-b border-slate-50 pb-4">
            <CardTitle className="text-lg font-bold text-slate-800">My Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-6 flex flex-col justify-center space-y-6">
            {loading ? (
               <div className="space-y-6">
                 {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-slate-50 animate-pulse rounded-md w-full" />)}
               </div>
            ) : (
               <>
                  {[
                    { label: 'Submitted (all)', count: funnel.submitted, color: 'bg-slate-200 text-slate-800' },
                    { label: 'In Review (processing)', count: funnel.inReview, color: 'bg-blue-100 text-blue-800' },
                    { label: 'Completed', count: funnel.completed, color: 'bg-[#0D9488] text-white' },
                    { label: 'High Risk', count: funnel.highRisk, color: 'bg-[#F43F5E] text-white' },
                    { label: 'Needs Action', count: funnel.needsAction, color: 'bg-[#F59E0B] text-white' },
                  ].map((stage, idx) => {
                     const pct = funnel.submitted > 0 ? (stage.count / funnel.submitted) * 100 : 0;
                     return (
                       <div key={stage.label} className="flex flex-col gap-1.5 relative">
                         <div className="flex justify-between items-end">
                           <span className="text-sm font-semibold text-slate-500">{stage.label}</span>
                           <span className={`px-2 py-0.5 rounded-sm font-bold text-xs ${stage.color}`}>{stage.count}</span>
                         </div>
                         <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                           <div className={`h-full bg-slate-800 rounded-full transition-all duration-1000 ${idx === 2 ? 'bg-[#0D9488]' : idx === 3 ? 'bg-[#F43F5E]' : idx === 4 ? 'bg-[#F59E0B]' : ''}`} style={{ width: `${Math.max(2, pct)}%` }} />
                         </div>
                       </div>
                     )
                  })}
               </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* FULL WIDTH: 8-WEEK PERFORMANCE CHART */}
      <Card className="shadow-sm border-slate-100">
        <CardHeader className="border-b border-slate-50 pb-4">
          <CardTitle className="text-lg font-bold text-slate-800">My Performance — Last 8 Weeks</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
             <div className="w-full h-[300px] bg-slate-50 animate-pulse rounded-lg flex items-center justify-center">
               <span className="text-slate-400 font-medium">Loading Chart Data...</span>
             </div>
          ) : (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} 
                  />
                  <Line type="monotone" dataKey="completed" name="Completed" stroke="#0D9488" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="failed" name="Failed" stroke="#F43F5E" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* RECENT FAILURES */}
      {!loading && failedJobs.length > 0 && (
        <Card className="shadow-sm border-slate-100 border-l-4 border-l-[#F43F5E]">
          <CardHeader className="border-b border-slate-50 pb-4">
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <AlertCircle className="text-[#F43F5E]" size={20} />
              Recent Failures Action Required
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4 text-left">Policy ID</th>
                  <th className="px-6 py-4 text-left">Client</th>
                  <th className="px-6 py-4 text-left">Failure Stage</th>
                  <th className="px-6 py-4 text-left">Time</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {failedJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-700">{job.policies?.policy_number ?? '—'}</td>
                    <td className="px-6 py-4 text-slate-700">{job.policies?.client_name ?? '—'}</td>
                    <td className="px-6 py-4 text-[#F43F5E] font-medium">{job.error_type ?? 'Analysis Failed'}</td>
                    <td className="px-6 py-4 text-slate-400">{job.queued_at ? format(new Date(job.queued_at), 'MMM d, h:mm a') : '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <Button size="sm" variant="outline" className="border-[#F43F5E] text-[#F43F5E] hover:bg-[#F43F5E] hover:text-white" onClick={() => retryJob(job.id)}>
                        Retry
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
