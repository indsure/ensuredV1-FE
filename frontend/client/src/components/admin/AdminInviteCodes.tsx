import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Key, 
  CheckCircle2, 
  Clock, 
  User, 
  RefreshCcw,
  Search,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
// @ts-ignore
import InviteCodeModal from './InviteCodeModal';

interface InviteCode {
  id: string;
  code: string;
  status: 'active' | 'used';
  used_by: string | null;
  used_by_name?: string;
  used_at: string | null;
  created_at: string;
}

const AdminInviteCodes: React.FC = () => {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCodes();
  }, []);

  const fetchCodes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const response = await fetch('/api/admin/invite-codes', {
        headers: { 'x-user-id': user.id }
      });
      if (!response.ok) return;
      const data = await response.json();
      setCodes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch invite codes:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCodes = codes.filter(c => 
    c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative flex-1 max-w-md">
           <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
           <input 
              type="text" 
              placeholder="Search codes or status..."
              className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-[#0D9488]/20 transition-all text-sm font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-2.5 bg-[#0D9488] text-white text-sm font-bold rounded-xl shadow-lg shadow-teal-900/10 hover:bg-[#0f766e] transition-all flex items-center gap-2"
        >
          <Plus size={18} />
          Generate New Code
        </button>
      </div>

      {/* Codes Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100 font-serif">
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Invite Code</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Used By</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Used At</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Created At</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              [1, 2, 3].map(i => (
                <tr key={i} className="animate-pulse">
                   <td colSpan={6} className="px-6 py-8"><div className="h-4 bg-slate-100 rounded"></div></td>
                </tr>
              ))
            ) : filteredCodes.map((code) => (
              <tr key={code.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Key size={16} className="text-[#0D9488]" />
                    <span className="font-['JetBrains_Mono'] text-sm font-bold text-[#0F172A] tracking-wider">{code.code}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                   <div className="flex justify-center">
                    {code.used_by ? (
                      <span className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase rounded-full border border-amber-200">Used</span>
                    ) : (
                      <span className="px-3 py-1 bg-teal-100 text-teal-700 text-[10px] font-bold uppercase rounded-full border border-teal-200">Active</span>
                    )}
                   </div>
                </td>
                <td className="px-6 py-4">
                  {code.used_by_name ? (
                    <div className="flex items-center gap-2">
                       <User size={14} className="text-slate-400" />
                       <span className="text-xs font-bold text-slate-700">{code.used_by_name}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Available</span>
                  )}
                </td>
                <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                  {code.used_at ? format(new Date(code.used_at), 'MMM dd, HH:mm') : '—'}
                </td>
                <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                   {format(new Date(code.created_at), 'MMM dd, yyyy')}
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete Code">
                    <AlertCircle size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InviteCodeModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchCodes}
      />
    </div>
  );
};

export default AdminInviteCodes;
