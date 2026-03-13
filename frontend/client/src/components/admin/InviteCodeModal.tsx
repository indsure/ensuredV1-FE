import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Key, Wand2, Check, Loader2 } from 'lucide-react';

interface InviteCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const InviteCodeModal: React.FC<InviteCodeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleGenerateRandom = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPart = '';
    for (let i = 0; i < 4; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCode(`INDSURE-${randomPart}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/invite-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, is_random: false }),
      });

      if (!response.ok) throw new Error('Failed to create code');

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setCode('');
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Invite code creation error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* @ts-ignore */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          
          {/* @ts-ignore */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-['Playfair_Display'] text-2xl font-bold text-[#0F172A]">Generate Invite Code</h3>
                  <p className="text-slate-500 text-sm mt-1">Create a unique access code for new agents.</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Access Code</label>
                   <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                      <input 
                        type="text" 
                        placeholder="e.g. INDSURE-WELCOME"
                        className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl font-bold text-[#0F172A] uppercase placeholder:text-slate-300 focus:border-[#0D9488]/20 focus:bg-white transition-all outline-none"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                      />
                      <button 
                        type="button"
                        onClick={handleGenerateRandom}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white text-[#0D9488] hover:bg-teal-50 rounded-xl shadow-sm border border-slate-100 transition-all"
                        title="Generate Random"
                      >
                        <Wand2 size={18} />
                      </button>
                   </div>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting || !code || isSuccess}
                  className={`w-full py-4 rounded-2xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
                    isSuccess ? 'bg-green-500' : 'bg-[#0D9488] hover:bg-[#0f766e] shadow-xl shadow-teal-900/20'
                  }`}
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : isSuccess ? <Check size={20} /> : 'Create Invite Code'}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default InviteCodeModal;
