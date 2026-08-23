import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useLocation } from 'wouter';
import { useAgent } from '@/context/AgentContext';
import { RefreshCw, Play, AlertCircle, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { startOfWeek, subWeeks, subDays, format, isAfter } from 'date-fns';
import { Button } from '@/components/ui/button';
import { InlineErrorState } from '@/components/agent/InlineErrorState';
import { toast } from '@/hooks/use-toast';
import { rerunPolicy } from '@/lib/rerun';
import { useLanguage } from '@/i18n/LanguageContext';
import { translateAll } from '@/i18n/translate';
import { TYPE_META, typeLabel, getNextPremiumDate, type InsuranceType } from '@/lib/insuranceTypes';
import { useIsMobile } from "@/hooks/use-mobile";
import { DashboardMobile } from "@/components/agent/DashboardMobile";

const INSURER_HI: Record<string, string> = {
  "Tata AIG General Insurance Company Limited": "टाटा AIG जनरल इन्श्योरेंस कंपनी लिमिटेड",
  "ManipalCigna Health Insurance Company Limited": "मणिपाल सिग्ना हेल्थ इन्श्योरेंस कंपनी लिमिटेड",
  "Go Digit General Insurance Limited": "गो डिजिट जनरल इन्श्योरेंस लिमिटेड",
  "Star Health and Allied Insurance Co Ltd": "स्टार हेल्थ एंड अलाइड इन्श्योरेंस कंपनी लिमिटेड",
  "HDFC ERGO General Insurance Company Limited": "HDFC ERGO जनरल इन्श्योरेंस कंपनी लिमिटेड",
  "HDFC Ergo General Insurance Company Limited": "HDFC ERGO जनरल इन्श्योरेंस कंपनी लिमिटेड",
  "ICICI Lombard General Insurance Company Limited": "ICICI लोम्बार्ड जनरल इन्श्योरेंस कंपनी लिमिटेड",
  "Bajaj Allianz General Insurance Company Limited": "बजाज अलियांज जनरल इन्श्योरेंस कंपनी लिमिटेड",
  "New India Assurance Company Limited": "न्यू इंडिया अश्योरेंस कंपनी लिमिटेड",
  "United India Insurance Company Limited": "यूनाइटेड इंडिया इन्श्योरेंस कंपनी लिमिटेड",
  "Oriental Insurance Company Limited": "ओरिएंटल इन्श्योरेंस कंपनी लिमिटेड",
  "National Insurance Company Limited": "नेशनल इन्श्योरेंस कंपनी लिमिटेड",
  "SBI General Insurance Company Limited": "SBI जनरल इन्श्योरेंस कंपनी लिमिटेड",
  "Reliance General Insurance Company Limited": "रिलायंस जनरल इन्श्योरेंस कंपनी लिमिटेड",
  "Niva Bupa Health Insurance Company Limited": "निवा बूपा हेल्थ इन्श्योरेंस कंपनी लिमिटेड",
  "Aditya Birla Health Insurance Co. Limited": "आदित्य बिड़ला हेल्थ इन्श्योरेंस कंपनी लिमिटेड",
  "Care Health Insurance Limited": "केयर हेल्थ इन्श्योरेंस लिमिटेड",
  "Max Bupa Health Insurance Company Limited": "मैक्स बूपा हेल्थ इन्श्योरेंस कंपनी लिमिटेड",
  "LIC of India": "भारतीय जीवन बीमा निगम",
  "Life Insurance Corporation of India": "भारतीय जीवन बीमा निगम",
};

type RecentPolicy = {
  id: string;
  policy_name: string;
  name: string | null;
  policyholder_name: string | null;
  insurer: string;
  status: string;
  score: number | null;
  created_at: string;
  expiry_date: string | null;
  share_token: string | null;
  share_enabled: boolean | null;
  report_data: any | null;
  insurance_type: string | null;
  extracted_data: any | null;
};

type FailedJob = {
  id: string;
  status: string;
  error_message: string | null;
  created_at: string | null;
  policy_name: string | null;
  name: string | null;
};

type ChartDataPoint = {
  name: string;
  startDate: Date;
  completed: number;
  failed: number;
};

function getGreetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return "dashboard.good_morning";
  if (hour < 18) return "dashboard.good_afternoon";
  return "dashboard.good_evening";
}

export default function DashboardNew() {
  const [, setLocation] = useLocation();
  const { agent, creditsRemaining, refresh: refreshAgent } = useAgent();
  const { t, locale } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [translatedNames, setTranslatedNames] = useState<Record<string, string>>({});
  const translationRef = useRef<string>("");
  
  // Stat counts
  const [stats, setStats] = useState({
    myPolicies: 0,
    myPoliciesDelta: 0,
    highRisk: 0,
    highRiskDelta: 0,
    myQueue: 0,
    avgRiskScore: 0 as number | null,
    avgScoreWindow: "30d" as "30d" | "all"
  });

  const [recentActivity, setRecentActivity] = useState<RecentPolicy[]>([]);
  const [expiringSoon, setExpiringSoon] = useState<RecentPolicy[]>([]);
  const [funnel, setFunnel] = useState({ submitted: 0, inReview: 0, completed: 0, highRisk: 0, needsAction: 0 });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [failedJobs, setFailedJobs] = useState<FailedJob[]>([]);

  // Phones get an action-first view of the same data. Declared with the other
  // hooks: this component returns early on `!agent` and on `error`, so a hook
  // placed below those would not run on every render.
  const isMobile = useIsMobile();

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
        qFailures,
        // 11. Genuinely expiring soon (next 30 days, not already expired)
        qExpiring
      ] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('agent_id', agent.agentId).eq('insurance_type', 'health').eq('status', 'done'),
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('agent_id', agent.agentId).eq('insurance_type', 'health').eq('status', 'done').gte('created_at', sevenDaysAgo),
        
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('agent_id', agent.agentId).eq('insurance_type', 'health').eq('status', 'done').lt('score', 70),
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('agent_id', agent.agentId).eq('insurance_type', 'health').eq('status', 'done').lt('score', 70).gte('created_at', sevenDaysAgo),
        
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('agent_id', agent.agentId).eq('insurance_type', 'health').in('status', ['pending', 'processing', 'error']),
        
        supabase.from('clients').select('score, created_at').eq('agent_id', agent.agentId).eq('insurance_type', 'health').eq('status', 'done').not('score', 'is', null),
        
        supabase.from('clients').select('id, policy_name, name, policyholder_name, insurer, status, score, created_at, expiry_date, share_token, share_enabled, report_data, insurance_type, extracted_data').eq('agent_id', agent.agentId).eq('status', 'done').order('created_at', { ascending: false }).limit(8),
        
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('agent_id', agent.agentId).eq('insurance_type', 'health'),
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('agent_id', agent.agentId).eq('insurance_type', 'health').in('status', ['pending', 'processing']),
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('agent_id', agent.agentId).eq('insurance_type', 'health').in('status', ['error']),

        supabase.from('clients').select('status, created_at').eq('agent_id', agent.agentId).eq('insurance_type', 'health').gte('created_at', eightWeeksAgo).in('status', ['done', 'error']),

        supabase.from('clients').select('id, status, error_message, created_at, policy_name, name').eq('agent_id', agent.agentId).eq('insurance_type', 'health').eq('status', 'error').order('created_at', { ascending: false }).limit(10),

        supabase.from('clients').select('id, policy_name, name, policyholder_name, insurer, status, score, created_at, expiry_date, share_token, share_enabled, report_data, insurance_type, extracted_data').eq('agent_id', agent.agentId).eq('status', 'done').gte('expiry_date', new Date().toISOString().slice(0, 10)).lte('expiry_date', subDays(new Date(), -30).toISOString().slice(0, 10)).order('expiry_date', { ascending: true }).limit(8)
      ]);

      // Average risk score: prefer the last 30 days, fall back to all-time.
      const scoreRows = (q4.data ?? []).filter(p => p.score !== null);
      const recentScores = scoreRows.filter(p => p.created_at >= thirtyDaysAgo).map(p => p.score as number);
      const allScores = scoreRows.map(p => p.score as number);
      const usedScores = recentScores.length > 0 ? recentScores : allScores;
      const avgScore = usedScores.length > 0 ? usedScores.reduce((a, b) => a + b, 0) / usedScores.length : null;

      setStats({
        myPolicies: q1.count || 0,
        myPoliciesDelta: q1b.count || 0,
        highRisk: q2.count || 0,
        highRiskDelta: q2b.count || 0,
        myQueue: q3.count || 0,
        avgRiskScore: avgScore,
        avgScoreWindow: recentScores.length > 0 ? "30d" : "all"
      });

      setRecentActivity(q5.data as any[] || []);
      setExpiringSoon(qExpiring.data as any[] || []);

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
             if (policy.status === 'error') weekBucket.failed++;
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

  useEffect(() => {
    if (locale !== 'hi' || recentActivity.length === 0) return;
    const key = recentActivity.map(p => p.id).join(',') + locale;
    if (translationRef.current === key) return;
    translationRef.current = key;

    const names = recentActivity.map(p => p.policyholder_name || p.name || '');
    translateAll(names, 'hi').then(translated => {
      const map: Record<string, string> = {};
      recentActivity.forEach((p, i) => {
        map[p.id + '_name'] = translated[i] || names[i];
      });
      setTranslatedNames(map);
    });
  }, [recentActivity, locale]);

  function getDisplayName(p: RecentPolicy) {
    const raw = p.policyholder_name || p.name || '—';
    if (locale === 'hi' && translatedNames[p.id + '_name']) return translatedNames[p.id + '_name'];
    return raw;
  }

  function getDisplayInsurer(p: RecentPolicy) {
    if (!p.insurer) return '—';
    if (locale === 'hi') {
      const exact = INSURER_HI[p.insurer];
      if (exact) return exact;
      // fuzzy: check if any map key is contained in the value
      const key = Object.keys(INSURER_HI).find(k => p.insurer.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(p.insurer.toLowerCase()));
      if (key) return INSURER_HI[key];
    }
    return p.insurer;
  }

  async function retryJob(jobId: string) {
    try {
      await rerunPolicy(jobId);
      toast({ variant: 'success', title: 'Re-running analysis', description: 'Track progress in My Queue — the result lands in My Policies.' });
      fetchDashboard();
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Retry failed', description: e instanceof Error ? e.message : undefined });
    }
  }

  function PainpointCell({ shouldSwitch, reportData: rawData }: { shouldSwitch: boolean; reportData: any }) {
    const { locale, t } = useLanguage();
    const reportData = typeof rawData === 'string' ? (() => { try { return JSON.parse(rawData); } catch { return null; } })() : rawData;
    const failures: string[] = reportData?.final_verdict?.key_failure_points ?? [];
    const criticals: { action: string; reason: string }[] = reportData?.recommendations?.critical_actions ?? [];
    const portRec: string = reportData?.recommendations?.should_port_to_better_policy?.recommendation ?? '';
    const portReason: string = reportData?.recommendations?.should_port_to_better_policy?.reason ?? '';
    const hasPainpoints = failures.length > 0 || criticals.length > 0;

    const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
    const [txFailures, setTxFailures] = React.useState<string[]>(failures);
    const [txCriticals, setTxCriticals] = React.useState<string[]>(criticals.map(c => c.action));
    const [txPortReason, setTxPortReason] = React.useState<string>(portReason);
    const [translating, setTranslating] = React.useState(false);
    const btnRef = React.useRef<HTMLButtonElement>(null);

    async function handleEnter() {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left });

      if (locale === 'hi') {
        setTranslating(true);
        const allTexts = [
          ...failures.slice(0, 3),
          ...criticals.slice(0, 2).map(c => c.action),
          portReason,
        ];
        const translated = await translateAll(allTexts, 'hi');
        const fLen = Math.min(failures.length, 3);
        const cLen = Math.min(criticals.length, 2);
        setTxFailures(translated.slice(0, fLen));
        setTxCriticals(translated.slice(fLen, fLen + cLen));
        setTxPortReason(translated[fLen + cLen] ?? portReason);
        setTranslating(false);
      } else {
        setTxFailures(failures);
        setTxCriticals(criticals.map(c => c.action));
        setTxPortReason(portReason);
      }
    }

    return (
      <div className="inline-flex items-center gap-1.5">
        {shouldSwitch ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md">↙ YES</span>
        ) : (
          <span className="inline-flex items-center text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">NO</span>
        )}
        {hasPainpoints && (
          <>
            <button
              ref={btnRef}
              onMouseEnter={handleEnter}
              onMouseLeave={() => setPos(null)}
              className="-m-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-slate-300 hover:text-slate-500 transition-colors"
            >
              <Info size={13} />
            </button>
            {pos && (
              <div
                onMouseLeave={() => setPos(null)}
                style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
                className="w-72 rounded-xl border border-slate-100 bg-white shadow-xl p-4 text-left"
              >
                {translating && (
                  <p className="text-xs text-slate-400 text-center py-2">अनुवाद हो रहा है...</p>
                )}
                {!translating && failures.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[11px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">{t("dashboard.painpoints")}</p>
                    <ul className="space-y-1">
                      {txFailures.map((f, i) => (
                        <li key={i} className="text-xs text-slate-700 flex gap-1.5"><span className="text-red-400 mt-0.5">•</span>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {!translating && criticals.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[11px] sm:text-[10px] font-black uppercase tracking-widest text-orange-400 mb-1.5">{t("dashboard.critical_actions")}</p>
                    <ul className="space-y-1">
                      {txCriticals.map((action, i) => (
                        <li key={i} className="text-xs text-slate-700 flex gap-1.5"><span className="text-orange-400 mt-0.5">⚡</span>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {!translating && portRec && (
                  <div className="pt-2 border-t border-slate-50">
                    <p className="text-[11px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                      {t("dashboard.port")} <span className={portRec === 'yes' ? 'text-red-500' : portRec === 'consider' ? 'text-amber-500' : 'text-green-500'}>{portRec.toUpperCase()}</span>
                    </p>
                    {txPortReason && <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{txPortReason}</p>}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-md w-full bg-white border border-slate-100 rounded-2xl p-10 shadow-sm">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-[#0D9488]/10 flex items-center justify-center">
            !
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{t("dashboard.session_missing_title")}</h1>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            {t("dashboard.session_missing_desc")}
          </p>
          <button
            type="button"
            onClick={() => setLocation("/agent/login")}
            className="px-6 py-3 rounded-xl font-semibold bg-[#0D9488] hover:bg-[#0f766e] text-white transition-colors"
          >
            {t("dashboard.go_to_login")}
          </button>
        </div>
      </div>
    );
  }
  if (error) return <InlineErrorState onRetry={fetchDashboard} />;

  function StatusBadge({ status }: { status: string }) {
    if (status === 'done') return <span className="text-[11px] sm:text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-800 px-2 py-0.5 rounded-sm">Completed</span>;
    if (status === 'error') return <span className="text-[11px] sm:text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 px-2 py-0.5 rounded-sm">Failed</span>;
    if (status === 'pending') return <span className="text-[11px] sm:text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-sm">Pending</span>;
    return <span className="text-[11px] sm:text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-2 flex items-center gap-1 py-0.5 rounded-sm"><div className="w-2 h-2 rounded-full border border-blue-600 border-t-transparent animate-spin"/> Processing</span>;
  }

  if (isMobile) {
    const atRisk = recentActivity.filter(p => p.score !== null && p.score < 70);
    return (
      <DashboardMobile
        agentName={agent.name.split(' ')[0] || 'Agent'}
        loading={loading}
        expiringSoon={expiringSoon}
        atRisk={atRisk}
        failedJobs={failedJobs}
        onOpenPolicy={(id) => setLocation(`/agent/policies/${id}`)}
        onOpenQueue={() => setLocation('/agent/my-queue')}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-['Playfair_Display']">
          {t(getGreetingKey())}, {agent.name.split(' ')[0] || 'Agent'}
        </h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="text-slate-500 bg-white" onClick={() => { fetchDashboard(); void refreshAgent(); }} disabled={loading}>
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> {t("dashboard.refresh")}
          </Button>
          <Button
            className="bg-[#0D9488] hover:bg-[#0f766e] text-white shadow-md font-semibold"
            onClick={() => setLocation('/agent/uploads')}
            title={creditsRemaining <= 0 ? 'Health analysis needs policy checks. Data-entry types (motor, life, term…) use your separate monthly data-entry allowance.' : undefined}
          >
            <Play size={16} className="mr-2 fill-current" /> {t("dashboard.analyze_policies")}
            {creditsRemaining <= 0 && <span className="ml-2 text-xs opacity-80">{t("dashboard.no_credits")}</span>}
          </Button>
        </div>
      </div>

      {/* CREDIT WARNINGS */}
      {creditsRemaining === 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <span className="mt-0.5 text-red-500 text-lg">⛔</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-red-700">{t("dashboard.credits_zero_title")}</p>
            <p className="text-sm text-red-600 mt-0.5">{t("dashboard.credits_zero_desc")}</p>
          </div>
          <a
            href="https://wa.me/919987148125?text=Hi%2C%20I%27ve%20run%20out%20of%20policy%20checks%20on%20IndSure.%20Can%20you%20help%20me%20top%20up%20my%20account%3F"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
          >
            {t("dashboard.contact_us")}
          </a>
        </div>
      )}
      {creditsRemaining > 0 && creditsRemaining < 3 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <span className="mt-0.5 text-amber-500 text-lg">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-700">{creditsRemaining === 1 ? t("dashboard.credits_low_title").replace("{{count}}", "1") : t("dashboard.credits_low_title_plural").replace("{{count}}", String(creditsRemaining))}</p>
            <p className="text-sm text-amber-600 mt-0.5">{t("dashboard.credits_low_desc")}</p>
          </div>
          <a
            href="https://wa.me/919987148125?text=Hi%2C%20I%27m%20running%20low%20on%20policy%20checks%20on%20IndSure.%20Can%20you%20help%20me%20top%20up%20my%20account%3F"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            {t("dashboard.get_credits")}
          </a>
        </div>
      )}

      {/* STAT ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-slate-100 border-l-4 border-l-[#0D9488]">
          <CardContent className="p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">{t("dashboard.my_policies")}</h3>
            {loading ? <div className="animate-pulse h-10 w-24 bg-slate-100 rounded-lg mt-2" /> : (
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-slate-800">{stats.myPolicies}</span>
                <span className="text-xs font-semibold text-[#0D9488]">↑ {stats.myPoliciesDelta} {t("dashboard.this_week")}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-100 border-l-4 border-l-[#F43F5E]">
          <CardContent className="p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">{t("dashboard.high_risk")}</h3>
            {loading ? <div className="animate-pulse h-10 w-24 bg-slate-100 rounded-lg mt-2" /> : (
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-slate-800">{stats.highRisk}</span>
                <span className="text-xs font-semibold text-[#F43F5E]">↑ {stats.highRiskDelta} {t("dashboard.this_week")}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-100 border-l-4 border-l-[#F59E0B]">
          <CardContent className="p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">{t("dashboard.my_queue")}</h3>
            {loading ? <div className="animate-pulse h-10 w-24 bg-slate-100 rounded-lg mt-2" /> : (
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-[#F59E0B]">{stats.myQueue}</span>
                <span className="text-xs font-medium text-slate-400">{t("dashboard.pending_action")}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-100 border-l-4 border-l-[#3B82F6]">
          <CardContent className="p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">{t("dashboard.avg_risk_score")}</h3>
            {loading ? <div className="animate-pulse h-10 w-24 bg-slate-100 rounded-lg mt-2" /> : (
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-slate-800">
                  {stats.avgRiskScore === null ? '—' : stats.avgRiskScore.toFixed(1)}
                </span>
                <span className="text-xs font-medium text-slate-400">{stats.avgScoreWindow === "30d" ? t("dashboard.last_30_days") : "all time"}</span>
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
              <span>{t("dashboard.live_feed")}</span>
              <Button variant="link" className="text-[#0D9488]" onClick={() => setLocation('/agent/policies')}>{t("dashboard.view_all")}</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
               <div className="p-6 space-y-4">
                 {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-slate-50 animate-pulse rounded-md w-full" />)}
               </div>
            ) : recentActivity.length === 0 ? (
               <div className="p-6 sm:p-8 lg:p-12 text-center text-slate-400 italic">{t("dashboard.no_analyses")}</div>
            ) : (
               <table className="table-cards w-full text-sm md:min-w-[560px] lg:min-w-0">
                 <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                   <tr>
                     <th className="px-6 py-4 text-left">{t("dashboard.col_customer")}</th>
                     <th className="px-6 py-4 text-left">{t("dashboard.col_insured")}</th>
                     <th className="px-6 py-4 text-left">Next Premium</th>
                     <th className="px-6 py-4 text-left">{t("dashboard.col_score")}</th>
                     <th className="px-6 py-4 text-left">{t("dashboard.col_switch")}</th>
                     <th className="px-6 py-4 text-left">{t("dashboard.col_report")}</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                   {recentActivity.map(p => {
                     const npDate = getNextPremiumDate(p.expiry_date, p.extracted_data);
                     const npDateObj = npDate ? new Date(npDate) : null;
                     const npValid = npDateObj !== null && !isNaN(npDateObj.getTime());
                     const npDays = npValid ? Math.ceil((npDateObj!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                     const shouldSwitch = p.score !== null && p.score < 70;
                     const isHealth = (p.insurance_type || 'health') === 'health';
                     return (
                       <tr key={p.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setLocation(`/agent/policies/${p.id}`)}>
                         <td className="px-6 py-4 font-semibold text-slate-800" data-label={t("dashboard.col_customer")} data-cell="title">
                           <div className="flex flex-wrap items-center gap-2">
                             <span>{getDisplayName(p)}</span>
                             <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-[11px] sm:text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
                               {TYPE_META[(p.insurance_type || 'health') as InsuranceType]?.emoji} {typeLabel(p.insurance_type)}
                             </span>
                           </div>
                         </td>
                         <td className="px-6 py-4 text-slate-600" data-label={t("dashboard.col_insured")}>{getDisplayInsurer(p)}</td>
                         <td className="px-6 py-4" data-label="Next Premium">
                           {!npValid ? (
                             <span className="text-slate-400">—</span>
                           ) : (
                             <div className="flex flex-col leading-tight">
                               <span className={`text-sm font-semibold ${npDays !== null && (npDays < 0 || npDays <= 15) ? 'text-red-600' : npDays !== null && npDays <= 30 ? 'text-amber-600' : 'text-slate-700'}`}>
                                 {format(npDateObj!, 'd MMM yyyy')}
                               </span>
                               {npDays !== null && npDays < 0 ? (
                                 <span className="text-[11px] text-red-400">overdue</span>
                               ) : npDays !== null && npDays <= 60 ? (
                                 <span className="text-[11px] text-slate-400">in {npDays}d</span>
                               ) : null}
                             </div>
                           )}
                         </td>
                         <td className="px-6 py-4" data-label={t("dashboard.col_score")}>
                           {p.score !== null ? (
                             <span className={`inline-flex items-center justify-center w-10 h-7 rounded-md text-xs font-bold ${p.score >= 80 ? 'bg-green-100 text-green-700' : p.score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                               {p.score}
                             </span>
                           ) : <span className="text-slate-400">—</span>}
                         </td>
                         <td className="px-6 py-4" data-label={t("dashboard.col_switch")}>
                           {isHealth ? <PainpointCell shouldSwitch={shouldSwitch} reportData={p.report_data} /> : <span className="text-slate-400">—</span>}
                         </td>
                         <td className="px-6 py-4" data-label={t("dashboard.col_report")} data-cell="actions" onClick={e => e.stopPropagation()}>
                           <button
                             onClick={() => setLocation(`/agent/policies/${p.id}`)}
                             className="inline-flex min-h-10 items-center text-xs font-semibold text-[#0D9488] hover:underline"
                           >
                             {t("dashboard.open")}
                           </button>
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
            )}
          </CardContent>
        </Card>

        {/* RIGHT: PIPELINE FUNNEL */}
        <Card className="shadow-sm border-slate-100 flex flex-col">
          <CardHeader className="border-b border-slate-50 pb-4">
            <CardTitle className="text-lg font-bold text-slate-800">{t("dashboard.my_pipeline")}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-6 flex flex-col justify-center space-y-6">
            {loading ? (
               <div className="space-y-6">
                 {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-slate-50 animate-pulse rounded-md w-full" />)}
               </div>
            ) : (
               <>
                  {[
                    { label: t("dashboard.submitted"), count: funnel.submitted, color: 'bg-slate-200 text-slate-800' },
                    { label: t("dashboard.in_review"), count: funnel.inReview, color: 'bg-blue-100 text-blue-800' },
                    { label: t("dashboard.completed"), count: funnel.completed, color: 'bg-[#0D9488] text-white' },
                    { label: t("dashboard.high_risk"), count: funnel.highRisk, color: 'bg-[#F43F5E] text-white' },
                    { label: t("dashboard.needs_action"), count: funnel.needsAction, color: 'bg-[#F59E0B] text-white' },
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

      {/* EXPIRING SOON */}
      {!loading && expiringSoon.length > 0 && (
        <Card className="shadow-sm border-slate-100 border-l-4 border-l-amber-400">
          <CardHeader className="border-b border-slate-50 pb-4">
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center justify-between">
              <span>{t("dashboard.expiring_soon")}</span>
              <Button variant="link" className="text-[#0D9488]" onClick={() => setLocation('/agent/policies')}>{t("dashboard.view_all")}</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="table-cards w-full text-sm md:min-w-[560px] lg:min-w-0">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4 text-left">{t("dashboard.col_customer")}</th>
                  <th className="px-6 py-4 text-left">{t("dashboard.col_insured")}</th>
                  <th className="px-6 py-4 text-left">{t("dashboard.col_expiry")}</th>
                  <th className="px-6 py-4 text-left">{t("dashboard.col_score")}</th>
                  <th className="px-6 py-4 text-left">{t("dashboard.col_report")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {expiringSoon
                  .map(p => ({ ...p, days: p.expiry_date ? Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null }))
                  .map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setLocation(`/agent/policies/${p.id}`)}>
                      <td className="px-6 py-4 font-semibold text-slate-800" data-label={t("dashboard.col_customer")} data-cell="title">{getDisplayName(p)}</td>
                      <td className="px-6 py-4 text-slate-600" data-label={t("dashboard.col_insured")}>{getDisplayInsurer(p)}</td>
                      <td className="px-6 py-4" data-label={t("dashboard.col_expiry")}>
                        {p.days !== null && p.days <= 15
                          ? <span className="font-bold text-red-500">{p.days} days</span>
                          : <span className="font-semibold text-amber-500">{p.days} days</span>}
                      </td>
                      <td className="px-6 py-4" data-label={t("dashboard.col_score")}>
                        {p.score !== null ? (
                          <span className={`inline-flex items-center justify-center w-10 h-7 rounded-md text-xs font-bold ${p.score >= 80 ? 'bg-green-100 text-green-700' : p.score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{p.score}</span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-6 py-4" data-label={t("dashboard.col_report")} data-cell="actions" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setLocation(`/agent/policies/${p.id}`)} className="inline-flex min-h-10 items-center text-xs font-semibold text-[#0D9488] hover:underline">Open →</button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm border-slate-100">
        <CardHeader className="border-b border-slate-50 pb-4">
          <CardTitle className="text-lg font-bold text-slate-800">{t("dashboard.performance")}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
             <div className="w-full h-[300px] bg-slate-50 animate-pulse rounded-lg flex items-center justify-center">
               <span className="text-slate-400 font-medium">{t("dashboard.loading_chart")}</span>
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
              {t("dashboard.failures_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="table-cards w-full text-sm md:min-w-[560px] lg:min-w-0">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4 text-left">{t("dashboard.col_policy_id")}</th>
                  <th className="px-6 py-4 text-left">{t("dashboard.col_client")}</th>
                  <th className="px-6 py-4 text-left">{t("dashboard.col_failure")}</th>
                  <th className="px-6 py-4 text-left">{t("dashboard.col_time")}</th>
                  <th className="px-6 py-4 text-right">{t("dashboard.col_action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {failedJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-700" data-label={t("dashboard.col_policy_id")} data-cell="title">{job.policy_name ?? job.id}</td>
                    <td className="px-6 py-4 text-slate-700" data-label={t("dashboard.col_client")}>{job.name ?? '—'}</td>
                    <td className="px-6 py-4 text-[#F43F5E] font-medium" data-label={t("dashboard.col_failure")}>{job.error_message ?? t("dashboard.analysis_failed")}</td>
                    <td className="px-6 py-4 text-slate-400" data-label={t("dashboard.col_time")}>{job.created_at ? format(new Date(job.created_at), 'MMM d, h:mm a') : '—'}</td>
                    <td className="px-6 py-4 text-right" data-label={t("dashboard.col_action")} data-cell="actions">
                      <Button size="sm" variant="outline" className="border-[#F43F5E] text-[#F43F5E] hover:bg-[#F43F5E] hover:text-white" onClick={() => retryJob(job.id)}>
                        {t("dashboard.retry")}
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
