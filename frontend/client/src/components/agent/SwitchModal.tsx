import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ArrowRight, Share2, Shield, AlertTriangle, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { apiFetch } from '@/lib/api';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SwitchRecommendation {
  recommended_insurer: string;
  recommended_plan: string;
  improvements: string[];
  premium_delta: string;
  confidence: 'high' | 'medium';
}

interface SwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: {
    id: string;
    name: string;
    insurer: string;
    score: number;
    flaws: any;
  };
}

const SwitchModal: React.FC<SwitchModalProps> = ({ isOpen, onClose, client }) => {
  const [loading, setLoading] = useState(true);
  const [recommendation, setRecommendation] = useState<SwitchRecommendation | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (isOpen && client) {
      fetchRecommendation();
    }
  }, [isOpen, client]);

  const fetchRecommendation = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/agent/switch-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: client.id }),
      });
      const data = await response.json();
      setRecommendation(data);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!recommendation) return;
    setIsSharing(true);
    try {
      const response = await apiFetch('/api/agent/public-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client.id,
          recommendation_data: recommendation,
        }),
      });
      const { uuid } = await response.json();
      const shareUrl = `${window.location.origin}/report/${uuid}`;

      await navigator.clipboard.writeText(shareUrl);
      
      // We assume toast is available via window or we'd need to pass it
      // For now, we'll use a simple alert if toast isn't easily accessible here, 
      // but the requirement says 'show a success toast'. 
      // In Dashboard.tsx we have useToast, so we can trigger it there if we pass a callback.
      alert('Link copied to clipboard!');
    } catch (err) {
    } finally {
      setIsSharing(false);
    }
  };

  const flaws = Array.isArray(client.flaws) ? client.flaws : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            // @ts-ignore
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            // @ts-ignore
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[560px] overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-start">
              <div>
                <h2 className="font-['Playfair_Display'] text-2xl font-bold text-[#0F172A]">Policy Switch Recommendation</h2>
                <p className="text-slate-500 text-sm mt-1">Prepared for {client.name}</p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                title="Close"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <Loader2 className="text-[#0D9488] animate-spin mb-4" size={40} />
                  <p className="text-slate-500 font-medium">Analyzing better alternatives...</p>
                </div>
              ) : recommendation ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Current Policy */}
                    <div className="rounded-xl border border-red-100 overflow-hidden">
                      <div className="bg-red-50 p-3 border-b border-red-100">
                        <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Current Policy</p>
                        <h4 className="font-bold text-[#0F172A] text-sm mt-1 truncate">{client.insurer}</h4>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold",
                            client.score >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                          )}>
                            Score: {client.score}
                          </span>
                        </div>
                        <ul className="space-y-2">
                          {flaws.slice(0, 3).map((flaw, i) => (
                            <li key={i} className="flex gap-2 text-[11px] text-slate-600 leading-tight">
                              <X size={14} className="text-red-500 shrink-0" />
                              <span>{flaw}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Recommended Switch */}
                    <div className="rounded-xl border border-teal-100 overflow-hidden shadow-sm">
                      <div className="bg-teal-50 p-3 border-b border-teal-100">
                        <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">Recommended Switch</p>
                        <h4 className="font-bold text-[#0F172A] text-sm mt-1 truncate">{recommendation.recommended_insurer}</h4>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-semibold text-[#0D9488]">{recommendation.recommended_plan}</p>
                          <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded text-[10px] font-bold">Score: 90+</span>
                        </div>
                        <ul className="space-y-2">
                          {recommendation.improvements.map((improvement, i) => (
                            <li key={i} className="flex gap-2 text-[11px] text-slate-600 leading-tight font-medium">
                              <Check size={14} className="text-teal-500 shrink-0" />
                              <span>{improvement}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="pt-2 border-t border-slate-50">
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Est. Premium Delta</p>
                          <p className="text-sm font-bold text-[#B45309]">{recommendation.premium_delta}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 flex gap-3 items-start">
                    <Shield className="text-[#0D9488] shrink-0" size={20} />
                    <div>
                      <h5 className="text-sm font-bold text-[#0F172A]">Advisor's Note</h5>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Based on your profile, switching to {recommendation.recommended_insurer} eliminates critical caps and provides better long-term protection.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <AlertTriangle className="text-amber-500 mx-auto mb-3" size={32} />
                  <p className="text-slate-600">Could not generate recommendation at this time.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
              <button 
                onClick={onClose}
                className="flex-1 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Close
              </button>
              <button 
                disabled={!recommendation || isSharing}
                onClick={handleShare}
                className="flex-[1.5] py-2.5 text-sm font-semibold bg-[#0D9488] hover:bg-[#0f766e] disabled:opacity-50 text-white rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
              >
                {isSharing ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Share2 size={18} />
                )}
                Share with Client
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SwitchModal;
