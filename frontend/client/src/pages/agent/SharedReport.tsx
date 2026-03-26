import { useEffect, useState } from 'react';
import { useParams } from 'wouter';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';

type Report = {
  id: string;
  version: number;
  status: string;
  score: number | null;
  flaws_count: number | null;
  summary: string | null;
  report_markdown: string | null;
  created_at: string;
  policy_id: string;
  policies: {
    policy_number: string;
    client_name: string;
    insurer_name: string;
    product_name: string;
  } | null;
};

export default function SharedReport() {
  const { token } = useParams<{ token: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSharedReport() {
      if (!token) return;
      setLoading(true);
      try {
        const { data: share, error: shareError } = await supabase
          .from('report_shares')
          .select('id, token, expires_at, revoked_at, report_id')
          .eq('token', token)
          .single();

        if (shareError || !share) {
          setError('This intelligence link is invalid or has reached its lifecycle end.');
          return;
        }

        if (share.revoked_at) {
          setError('This report access has been revoked by the issuing advisor.');
          return;
        }

        if (share.expires_at && new Date(share.expires_at) < new Date()) {
          setError('Temporal access for this report has expired.');
          return;
        }

        const { data: reportData, error: reportError } = await supabase
          .from('reports')
          .select('id, version, status, score, flaws_count, summary, report_markdown, created_at, policy_id, policies(policy_number, client_name, insurer_name, product_name)')
          .eq('id', share.report_id)
          .single();

        if (reportError || !reportData) {
          setError('The requested diagnostic data is currently unavailable.');
          return;
        }

        setReport(reportData as unknown as Report);
        
        supabase.from('report_shares')
          .update({ last_accessed_at: new Date().toISOString() })
          .eq('id', share.id)
          .then();

      } catch (err) {
        setError('A system anomaly occurred during data retrieval.');
      } finally {
        setLoading(false);
      }
    }
    fetchSharedReport();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
        <div className="w-12 h-12 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Decrypting Intelligence...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-10 shadow-2xl shadow-slate-200 text-center border border-white">
          <div className="h-16 w-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-red-100">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 font-['Playfair_Display'] mb-4">{error}</h1>
          <p className="text-slate-400 font-medium mb-8 leading-relaxed">Please contact your insurance advisor for a new secured access link.</p>
          <a href="/" className="inline-block bg-slate-900 text-white text-xs font-black uppercase tracking-widest px-8 py-3 rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-black/10">
            Return to Gateway
          </a>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
        <Card className="max-w-md w-full p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-slate-200 flex items-center justify-center text-slate-600">
            !
          </div>
          <h1 className="text-2xl font-bold text-slate-800 font-['Playfair_Display'] mb-2">
            Report unavailable
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            This shared link does not contain report data anymore. Ask your advisor for a fresh access link.
          </p>
          <a
            href="/agent/login"
            className="inline-block bg-slate-900 text-white text-xs font-black uppercase tracking-widest px-8 py-3 rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-black/10"
          >
            Go to Agent Portal
          </a>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-16 px-6 lg:px-12 font-['Inter']">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Branding & Type */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-3 font-black text-[20px] tracking-tighter uppercase font-['Playfair_Display'] text-[#0D9488]">
                <div className="w-8 h-8 bg-[#0D9488] rounded-lg flex items-center justify-center shadow-md shadow-[#0D9488]/20">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L20 6V12C20 16.4 16.4 20.4 12 22C7.6 20.4 4 16.4 4 12V6L12 2Z" stroke="white" strokeWidth="2.5" fill="none" />
                    </svg>
                </div>
                IndSure
            </div>
            <div className="px-5 py-1.5 bg-white border border-slate-200 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] shadow-sm">
                Secured Intelligence Report · {new Date(report.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
        </div>

        {/* Executive Header */}
        <div className="bg-white rounded-[2.5rem] p-10 md:p-14 border border-white shadow-2xl shadow-slate-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#0D9488]/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
            
            <div className="relative z-10">
                <h1 className="text-4xl md:text-5xl font-bold text-slate-900 font-['Playfair_Display'] leading-tight">
                    Diagnostic Summary for <br />
                    <span className="text-[#0D9488]">{report.policies?.client_name}</span>
                </h1>
                
                <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 py-8 border-y border-slate-50">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Policy Identifier</p>
                        <p className="font-bold text-slate-800 text-lg uppercase tracking-tight">{report.policies?.policy_number}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Insurance Carrier</p>
                        <p className="font-bold text-slate-800 text-lg">{report.policies?.insurer_name}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Coverage Product</p>
                        <p className="font-bold text-slate-800 text-lg">{report.policies?.product_name}</p>
                    </div>
                </div>

                <div className="mt-10 flex flex-wrap gap-12 items-center">
                    <div className="flex items-end gap-3">
                        <span className={`text-6xl font-black font-['Playfair_Display'] ${report.score && report.score < 40 ? 'text-red-500' : 'text-slate-900'}`}>
                            {report.score ? Number(report.score).toFixed(1) : '—'}
                        </span>
                        <div className="pb-2 space-y-0.5">
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Quality Score</p>
                            <div className="flex gap-1">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className={`h-1 w-4 rounded-full ${i < (report.score || 0) / 20 ? 'bg-[#0D9488]' : 'bg-slate-100'}`} />
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-end gap-3">
                        <span className="text-6xl font-black font-['Playfair_Display'] text-slate-900">
                            {report.flaws_count ?? '0'}
                        </span>
                        <div className="pb-2">
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Detected Anomalies</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Narrative Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-xl shadow-slate-900/20">
                    <h3 className="text-xs font-black text-[#0D9488] uppercase tracking-[0.2em] mb-4">Executive Brief</h3>
                    <p className="text-sm font-medium text-slate-400 leading-relaxed italic">
                        "{report.summary ?? "The intelligence engine has finalized the extraction. Please review the detailed analysis on the right."}"
                    </p>
                    <div className="mt-8 pt-6 border-t border-slate-800 flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black uppercase">v{report.version}</div>
                         <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">IndSure Neural Audit Engine</p>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-[2rem] p-10 md:p-14 border border-slate-100 shadow-sm relative">
                <div className="flex items-center gap-3 mb-8">
                     <div className="w-2 h-2 rounded-full bg-[#0D9488]" />
                     <h2 className="text-xl font-bold text-slate-900 font-['Playfair_Display']">Comprehensive Analysis</h2>
                </div>
                {report.report_markdown ? (
                    <div className="prose prose-slate max-w-none prose-sm leading-relaxed text-slate-600 font-medium">
                        <pre className="whitespace-pre-wrap font-sans bg-transparent p-0 text-slate-600">
                             {report.report_markdown}
                        </pre>
                    </div>
                ) : (
                    <p className="text-slate-400 italic">Detailed narrative content is being projected...</p>
                )}
            </div>
        </div>

        {/* Global Footer */}
        <div className="pt-20 pb-10 flex flex-col items-center gap-6 border-t border-slate-100">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] text-center max-w-md leading-relaxed">
                CONFIDENTIAL RECORD · THIS INTELLIGENCE DOCUMENT IS INTENDED ONLY FOR THE AUTHORIZED CLIENT AND REPRESENTATIVE.
            </p>
            <div className="w-px h-12 bg-slate-100" />
            <p className="text-[10px] font-black text-[#0D9488] uppercase tracking-widest">© 2026 INDSURE TECHNOLOGIES</p>
        </div>
      </div>
    </div>
  );
}
