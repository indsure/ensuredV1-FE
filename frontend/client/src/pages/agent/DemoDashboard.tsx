import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Play, AlertCircle, Sparkles, TrendingUp, TrendingDown, HelpCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from 'recharts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

export default function DemoDashboard() {
  const [loading, setLoading] = useState(false);

  // Hardcoded impressive stats
  const stats = {
    myPolicies: "6,428",
    myPoliciesDelta: "214",
    highRisk: "582",
    highRiskDelta: "18",
    myQueue: "12",
    avgRiskScore: 78.4
  };

  // Hardcoded recent activity targeting exact requested columns
  const recentActivity = [
    { id: "POL-001", client_name: "Rahul Sharma", insurer_name: "HDFC Ergo", days_to_expiry: 42, score: 96, should_switch: false, painpoints: "Inflation erosion is the only long term risk. Solid policy." },
    { id: "POL-002", client_name: "Priya Patel", insurer_name: "Star Health & Allied", days_to_expiry: 15, score: 74, should_switch: true, painpoints: "Maternity permanently excluded. 3-Year PED waiting period active. Robotic surgery sub-limit." },
    { id: "POL-003", client_name: "Vikram Singh", insurer_name: "Niva Bupa Health", days_to_expiry: 200, score: 94, should_switch: false, painpoints: "Engine Protection is missing. High risk if living in a waterlogging area." },
    { id: "POL-004", client_name: "Anjali Desai", insurer_name: "Care Health Insurance", days_to_expiry: 5, score: 45, should_switch: true, painpoints: "High room rent co-pay (20%). Strict zone-based pricing limits. Missing modern treatments cover." },
    { id: "POL-005", client_name: "Sanjay Gupta", insurer_name: "ICICI Lombard", days_to_expiry: 112, score: 88, should_switch: false, painpoints: "OPD not covered. Consumables require an additional rider." },
    { id: "POL-006", client_name: "Ramesh Verma", insurer_name: "Tata AIG General", days_to_expiry: 30, score: 62, should_switch: true, painpoints: "Initial 30-day wait active. Sub-limits on cardiac. No NCB scaling." },
    { id: "POL-007", client_name: "Kavita Reddy", insurer_name: "New India Assurance", days_to_expiry: 85, score: 81, should_switch: false, painpoints: "Good basic cover. Network hospitals limited in Tier 2 cities." },
    { id: "POL-008", client_name: "Amitabh Nair", insurer_name: "Bajaj Allianz", days_to_expiry: 2, score: 55, should_switch: true, painpoints: "Very high claim rejection risk. Lacking critical illness riders." }
  ];

  const funnel = {
    submitted: 7240,
    inReview: 48,
    processing: 15,
    completed: 6428,
    highRisk: 582,
    needsAction: 24
  };

  const chartData = [
    { name: "W1", completed: 620, failed: 12 },
    { name: "W2", completed: 680, failed: 18 },
    { name: "W3", completed: 740, failed: 15 },
    { name: "W4", completed: 810, failed: 22 },
    { name: "W5", completed: 850, failed: 19 },
    { name: "W6", completed: 920, failed: 14 },
    { name: "W7", completed: 1100, failed: 28 },
    { name: "W8", completed: 1245, failed: 17 },
  ];

  const failedJobs = [
    { id: "JOB-101", policy_number: "SH-STAR-99211", client_name: "Neha Kapoor", error_type: "OCR Confidence Low", queued_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString() },
    { id: "JOB-102", policy_number: "AD-HDFC-22831", client_name: "Deepak Joshi", error_type: "Corrupted PDF", queued_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString() }
  ];

  function refreshDemo() {
    setLoading(true);
    setTimeout(() => setLoading(false), 800);
  }

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
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-['Playfair_Display'] flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-amber-400" /> Live Demo Mode
          </h1>
          <p className="text-sm text-slate-500 mt-1">Populated with simulated high-volume agency data.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="text-slate-500 bg-white" onClick={refreshDemo} disabled={loading}>
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button className="bg-[#0D9488] hover:bg-[#0f766e] text-white shadow-md font-semibold overflow-hidden relative group">
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 slant" />
            <Play size={16} className="mr-2 fill-current" /> Analyze Policies
          </Button>
        </div>
      </div>

      {/* STAT ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-slate-100 border-l-4 border-l-[#0D9488] hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex justify-between">
              Total Processed <TrendingUp className="w-4 h-4 text-[#0D9488]" />
            </h3>
            {loading ? <div className="animate-pulse h-10 w-24 bg-slate-100 rounded-lg mt-2" /> : (
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-slate-800">{stats.myPolicies}</span>
                <span className="text-xs font-semibold text-[#0D9488]">↑ {stats.myPoliciesDelta} this week</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-100 border-l-4 border-l-[#F43F5E] hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">High Risk Detected</h3>
            {loading ? <div className="animate-pulse h-10 w-24 bg-slate-100 rounded-lg mt-2" /> : (
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-slate-800">{stats.highRisk}</span>
                <span className="text-xs font-semibold text-[#F43F5E]">↑ {stats.highRiskDelta} this week</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-100 border-l-4 border-l-[#F59E0B] bg-amber-50/30 hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <h3 className="text-xs font-bold text-amber-600/70 uppercase tracking-widest mb-1.5">Action Queue</h3>
            {loading ? <div className="animate-pulse h-10 w-24 bg-slate-100 rounded-lg mt-2" /> : (
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-[#F59E0B]">{stats.myQueue}</span>
                <span className="text-xs font-medium text-amber-700/60">pending manual review</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-100 border-l-4 border-l-[#3B82F6] hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Avg Risk Score</h3>
            {loading ? <div className="animate-pulse h-10 w-24 bg-slate-100 rounded-lg mt-2" /> : (
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-slate-800">{stats.avgRiskScore.toFixed(1)}</span>
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
              <span>Live Analysis Feed</span>
              <Button variant="link" className="text-[#0D9488]">View All</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
               <div className="p-6 space-y-4">
                 {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-slate-50 animate-pulse rounded-md w-full" />)}
               </div>
            ) : (
               <table className="w-full text-sm">
                 <thead className="bg-[#FAFAF8] border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                   <tr>
                     <th className="px-6 py-4 text-left">Customer Name</th>
                     <th className="px-4 py-4 text-left">Insured With</th>
                     <th className="px-4 py-4 text-left">Days to Expiry</th>
                     <th className="px-4 py-4 text-center">Score</th>
                     <th className="px-4 py-4 text-center">Should Switch</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                   {recentActivity.map(p => (
                     <tr key={p.id} className="hover:bg-slate-50/80 cursor-pointer transition-colors group">
                       <td className="px-6 py-4 font-bold text-slate-800">{p.client_name}</td>
                       <td className="px-4 py-4 font-semibold text-slate-500">{p.insurer_name}</td>
                       <td className="px-4 py-4">
                         <span className={`font-bold ${p.days_to_expiry < 30 ? 'text-amber-600 bg-amber-50 px-2 py-1 rounded-md' : 'text-slate-700'}`}>
                           {p.days_to_expiry} days
                         </span>
                       </td>
                       <td className="px-4 py-4 text-center">
                         <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md font-black text-xs ${p.score < 70 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                           {p.score}
                         </span>
                       </td>
                       <td className="px-4 py-4 text-center">
                         <div className="flex items-center justify-center gap-1.5">
                           {p.should_switch ? (
                             <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-800">
                               <TrendingDown className="w-3 h-3" /> YES
                             </span>
                           ) : (
                             <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-600">
                               NO
                             </span>
                           )}
                           <Tooltip delayDuration={100}>
                             <TooltipTrigger asChild>
                               <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-slate-200">
                                 <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                               </Button>
                             </TooltipTrigger>
                             <TooltipContent className="max-w-xs p-3 text-sm shadow-xl border-slate-100" side="left">
                               <p className="font-extrabold text-[#0D9488] mb-1 text-[10px] uppercase tracking-widest">Painpoints Detected</p>
                               <p className="text-slate-700 font-medium leading-relaxed">{p.painpoints}</p>
                             </TooltipContent>
                           </Tooltip>
                         </div>
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
            <CardTitle className="text-lg font-bold text-slate-800">Pipeline Efficiency</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-6 flex flex-col justify-center space-y-6">
            {loading ? (
               <div className="space-y-6">
                 {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-slate-50 animate-pulse rounded-md w-full" />)}
               </div>
            ) : (
               <>
                  {[
                    { label: 'Total Uploaded (YTD)', count: funnel.submitted, color: 'bg-slate-200 text-slate-800' },
                    { label: 'Currently in Review', count: funnel.inReview, color: 'bg-amber-100 text-amber-800' },
                    { label: 'AI Processing Active', count: funnel.processing, color: 'bg-blue-100 text-blue-800' },
                    { label: 'Successfully Completed', count: funnel.completed, color: 'bg-[#0D9488] text-white shadow-md shadow-[#0D9488]/20' },
                    { label: 'Critical Risk Discovered', count: funnel.highRisk, color: 'bg-[#F43F5E] text-white shadow-md shadow-[#F43F5E]/20' },
                  ].map((stage, idx) => {
                     const pct = funnel.submitted > 0 ? (stage.count / funnel.submitted) * 100 : 0;
                     return (
                       <div key={stage.label} className="flex flex-col gap-1.5 relative group">
                         <div className="flex justify-between items-end">
                           <span className={`text-sm font-semibold ${idx >= 3 ? 'text-slate-800' : 'text-slate-500'}`}>{stage.label}</span>
                           <span className={`px-2 py-0.5 rounded-sm font-bold text-xs ${stage.color}`}>{stage.count.toLocaleString()}</span>
                         </div>
                         <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                           <div className={`h-full bg-slate-800 rounded-full transition-all duration-1000 ${idx === 3 ? 'bg-gradient-to-r from-[#0D9488] to-teal-400' : idx === 4 ? 'bg-gradient-to-r from-[#F43F5E] to-rose-400' : ''}`} style={{ width: `${Math.max(3, pct)}%` }} />
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
      <Card className="shadow-sm border-slate-100 overflow-hidden">
        <CardHeader className="border-b border-slate-50 pb-4 bg-gradient-to-b from-slate-50 to-white">
          <CardTitle className="text-lg font-bold text-slate-800">Processing Volume (Last 8 Weeks)</CardTitle>
          <p className="text-xs text-slate-500">Accelerated growth in automation throughput.</p>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
             <div className="w-full h-[300px] bg-slate-50 animate-pulse rounded-lg flex items-center justify-center">
               <span className="text-slate-400 font-medium">Loading Chart Data...</span>
             </div>
          ) : (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0D9488" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0D9488" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} 
                  />
                  <Area type="monotone" dataKey="completed" name="Successfully Processed" stroke="#0D9488" strokeWidth={3} fillOpacity={1} fill="url(#colorCompleted)" activeDot={{ r: 6, strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="failed" name="Failed/Requires Review" stroke="#F43F5E" strokeWidth={2} fillOpacity={1} fill="url(#colorFailed)" />
                </AreaChart>
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
              Recent AI Anomalies Action Required
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-[#FFF1F2] border-b border-rose-100 text-xs text-rose-800 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4 text-left">Internal ID</th>
                  <th className="px-6 py-4 text-left">Client</th>
                  <th className="px-6 py-4 text-left">Anomaly Type</th>
                  <th className="px-6 py-4 text-left">Flagged Time</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {failedJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-700">{job.policy_number}</td>
                    <td className="px-6 py-4 text-slate-700">{job.client_name}</td>
                    <td className="px-6 py-4"><span className="text-[#F43F5E] font-medium bg-red-50 px-2 py-1 rounded-md">{job.error_type}</span></td>
                    <td className="px-6 py-4 text-slate-400">{new Date(job.queued_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-6 py-4 text-right">
                      <Button size="sm" variant="outline" className="border-[#F43F5E] text-[#F43F5E] hover:bg-[#F43F5E] hover:text-white" onClick={() => refreshDemo()}>
                        Force Retry
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
