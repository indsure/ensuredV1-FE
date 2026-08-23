import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, RefreshCw, AlertCircle, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { apiFetch } from '@/lib/api';

interface AgentSummaryCardProps {
  agentId: string;
  hasClients: boolean;
}

const AgentSummaryCard: React.FC<AgentSummaryCardProps> = ({ agentId, hasClients }) => {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<string[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);

  const fetchSummary = async (showLoading = true) => {
    if (!agentId || !hasClients) return;
    
    if (showLoading) setLoading(true);
    setError(null);
    
    try {
      const response = await apiFetch(`/api/agent/summary/${agentId}`);
      const data = await response.json();
      
      if (data.empty) {
        setIsEmpty(true);
        setInsights([]);
      } else if (data.insights) {
        setInsights(data.insights);
        setGeneratedAt(data.generated_at);
        setIsEmpty(false);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load portfolio insights');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [agentId, hasClients]);

  const canRegenerate = () => {
    if (!generatedAt) return true;
    const date = new Date(generatedAt);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return date < thirtyDaysAgo;
  };

  if (!hasClients || isEmpty) {
    return (
      <div className="bg-[#0B1120] rounded-2xl p-8 border-l-4 border-[#B45309] flex flex-col items-center justify-center text-center h-full min-h-[300px] shadow-2xl">
        <div className="w-16 h-16 bg-[#2DD4BF]/10 rounded-full flex items-center justify-center mb-4">
          <TrendingUp className="text-[#2DD4BF]" size={32} />
        </div>
        <h3 className="font-['Playfair_Display'] text-xl font-semibold text-white mb-2">Portfolio Insights</h3>
        <p className="text-[#CBD5E1] text-sm max-w-[240px]">Analyze your first batch to generate portfolio-wide AI insights.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0B1120] rounded-2xl p-6 border-l-4 border-[#B45309] shadow-2xl flex flex-col h-full min-h-[300px]">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="font-['Playfair_Display'] text-[#2DD4BF] text-xl font-semibold flex items-center gap-2">
            <Sparkles size={20} />
            Portfolio Insights
          </h3>
          {generatedAt && (
            <p className="text-slate-500 text-[11px] sm:text-[10px] mt-1 uppercase tracking-wider">
              Last updated {formatDistanceToNow(new Date(generatedAt), { addSuffix: true })}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700 mt-2 shrink-0" />
                <div className="h-4 bg-slate-800 rounded w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-4 rounded-xl">
            <AlertCircle size={18} />
            {error}
          </div>
        ) : (
          <div className="space-y-4">
            {insights.map((insight, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex gap-3 items-start"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF] mt-2 shrink-0" />
                <p className="text-[#CBD5E1] text-sm leading-relaxed">{insight}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-end">
        <p className="text-slate-500 text-[11px] sm:text-[10px] uppercase tracking-wider">Refreshes every 30 days</p>
        
        {canRegenerate() && !loading && (
          <button 
            onClick={() => fetchSummary()}
            className="flex items-center gap-1.5 text-[#2DD4BF] hover:text-[#2DD4BF]/80 text-xs font-semibold transition-colors group"
          >
            <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
            Regenerate
          </button>
        )}
      </div>
    </div>
  );
};

export default AgentSummaryCard;
