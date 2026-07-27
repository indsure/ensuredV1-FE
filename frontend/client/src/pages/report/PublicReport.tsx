import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'wouter';
import { Shield, Check, X, Info, Loader2, AlertCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { apiFetch } from '@/lib/api';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PublicReportData {
  recommendation_data: {
    recommended_insurer: string;
    recommended_plan: string;
    improvements: string[];
    premium_delta: string;
    confidence: string;
  };
  client_name: string;
  current_insurer: string;
  current_score: number;
  current_flaws: any;
  agent_name: string;
}

const PublicReport: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<PublicReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReport();
  }, [uuid]);

  const fetchReport = async () => {
    try {
      const response = await apiFetch(`/api/public-report/${uuid}`);
      if (!response.ok) throw new Error('Report not found or expired');
      const data = await response.json();
      setReport(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#0D9488]" size={48} />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-12 max-w-md text-center">
          <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
          <h1 className="font-['Playfair_Display'] text-2xl font-bold text-[#0F172A] mb-2">Report Unavailable</h1>
          <p className="text-slate-500">This report is no longer available or the link is incorrect.</p>
          <a href="/" className="inline-block mt-8 text-[#0D9488] font-semibold hover:underline">Return to IndSure</a>
        </div>
      </div>
    );
  }

  const currentFlaws = Array.isArray(report.current_flaws) ? report.current_flaws : [];
  const rec = report.recommendation_data;

  return (
    <div className="min-h-screen bg-[#FAFAF8] py-12 px-6">
      {/* Top Banner */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        // @ts-ignore
        className="fixed top-0 left-0 right-0 py-3 bg-[#B45309] text-white text-center text-xs font-semibold z-50 px-4"
      >
        This report was prepared exclusively for {report.client_name} by {report.agent_name}
      </motion.div>

      <div className="max-w-[700px] mx-auto pt-8">
        {/* Main Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          // @ts-ignore
          className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100"
        >
          {/* Logo Section */}
          <div className="p-10 pb-0 flex flex-col items-center">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-[#0D9488] text-white flex items-center justify-center rounded-lg font-serif font-bold text-2xl shadow-lg shadow-teal-900/20">
                I
              </div>
              <span className="font-serif text-3xl font-bold tracking-tight text-[#0F172A]">
                IndSure.
              </span>
            </div>
            <h1 className="font-['Playfair_Display'] text-3xl font-bold text-[#0F172A] text-center">Policy Switch Recommendation</h1>
            <div className="w-16 h-1 bg-[#B45309] mt-6 rounded-full" />
          </div>

          {/* Client Details */}
          <div className="p-10 pt-8 grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-slate-50">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Policyholder</p>
              <p className="text-lg font-bold text-[#0F172A]">{report.client_name}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Insurer</p>
              <div className="flex items-center gap-3">
                <p className="text-lg font-bold text-[#0F172A]">{report.current_insurer}</p>
                <span className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-bold",
                  report.current_score >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                )}>
                  Quality Score: {report.current_score}
                </span>
              </div>
            </div>
          </div>

          {/* Comparison table */}
          <div className="p-10 bg-slate-50/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Current */}
              <div className="space-y-4">
                <h4 className="flex items-center gap-2 text-red-600 font-bold text-sm uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-red-600" />
                  Key Constraints
                </h4>
                <ul className="space-y-3">
                  {currentFlaws.slice(0, 4).map((flaw: any, i: number) => (
                    <li key={i} className="flex gap-3 text-sm text-slate-600 leading-relaxed font-medium">
                      <X size={18} className="text-red-500 shrink-0" />
                      <span>{flaw}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommendation */}
              <div className="space-y-4">
                <h4 className="flex items-center gap-2 text-teal-600 font-bold text-sm uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
                  Recommended Switch
                </h4>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-teal-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50 rounded-full -mr-12 -mt-12" />
                  <p className="text-lg font-bold text-[#0F172A] relative z-10">{rec.recommended_insurer}</p>
                  <p className="text-sm font-semibold text-[#0D9488] mt-1 relative z-10">{rec.recommended_plan}</p>

                  <ul className="mt-5 space-y-3 relative z-10">
                    {rec.improvements.map((imp, i) => (
                      <li key={i} className="flex gap-2 text-xs text-slate-700 font-semibold">
                        <Check size={16} className="text-teal-500 shrink-0" />
                        <span>{imp}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 pt-4 border-t border-slate-50">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Savings/Benefit</p>
                        <p className="text-base font-bold text-[#B45309]">{rec.premium_delta}</p>
                      </div>
                      <Shield className="text-[#0D9488]/20" size={32} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer branding */}
          <div className="p-10 pt-6 flex flex-col items-center">
            <div className="flex items-center gap-3 bg-slate-50 px-6 py-4 rounded-full border border-slate-100 mb-6">
              <Info size={16} className="text-[#0D9488]" />
              <p className="text-[11px] font-medium text-slate-500">
                This analysis uses AI to compare over 5,000 policy clauses for maximum accuracy.
              </p>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Analyzed by <span className="text-slate-600 font-bold">{report.agent_name}</span> via IndSure
            </p>
          </div>
        </motion.div>

        {/* Action button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          // @ts-ignore
          className="mt-12 text-center"
        >
          <p className="text-slate-500 text-sm mb-4">Interested in making the switch?</p>
          <button className="px-8 py-4 bg-[#0F172A] text-white rounded-2xl font-bold hover:shadow-xl transition-all hover:-translate-y-1">
            Contact My Advisor
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default PublicReport;