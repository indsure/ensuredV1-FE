import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Edit2, 
  Check, 
  X,
  Mail,
  MapPin,
  Calendar,
  FileText,
  ShieldAlert
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';

interface Agent {
  id: string;
  full_name: string;
  email: string;
  city: string;
  created_at: string;
  upload_limit: number;
  client_count: number;
  avg_score: string;
  empanelments: string[];
}

const AdminAgents: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLimit, setEditLimit] = useState<number>(10);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const response = await fetch('/api/admin/agents', {
        headers: { 'x-user-id': user.id }
      });
      if (!response.ok) return;
      const data = await response.json();
      setAgents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLimit = async (agentId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await fetch(`/api/admin/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({ upload_limit: editLimit }),
      });
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, upload_limit: editLimit } : a));
      setEditingId(null);
    } catch (err) {
      console.error('Update limit failed:', err);
    }
  };

  const filteredAgents = agents.filter(a => 
    a.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0D9488] mb-4"></div>
        <p className="text-slate-500 font-medium">Loading agents data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative flex-1 max-w-md">
           <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
           <input 
              type="text" 
              placeholder="Filter by name, email, or city..."
              className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-[#0D9488]/20 transition-all text-sm font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>
        <div className="flex gap-2">
           <button className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">Export CSV</button>
        </div>
      </div>

      {/* Agents Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Agent</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">City</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Signup Date</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Clients</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg Portfolio</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Upload Limit</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredAgents.map((agent) => (
                <React.Fragment key={agent.id}>
                  <tr className={`hover:bg-slate-50/80 transition-colors group ${expandedId === agent.id ? 'bg-slate-50/80' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs uppercase shadow-sm">
                           {agent.full_name?.charAt(0) || 'A'}
                        </div>
                        <div>
                          <p className="font-bold text-[#0F172A] text-sm">{agent.full_name}</p>
                          <p className="text-xs text-slate-500">{agent.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-xs font-semibold text-slate-600 px-2 py-1 bg-slate-100 rounded-lg">{agent.city}</span>
                    </td>
                    <td className="px-6 py-4">
                       <p className="text-xs text-slate-500 font-medium">
                          {agent.created_at ? format(new Date(agent.created_at), 'MMM dd, yyyy') : 'N/A'}
                       </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <span className="text-sm font-bold text-[#0F172A]">{agent.client_count}</span>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2">
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden max-w-[60px]">
                             <div 
                                className="h-full bg-[#0D9488]" 
                                style={{ width: `${agent.avg_score}%` }}
                             />
                          </div>
                          <span className="text-xs font-bold text-slate-700">{agent.avg_score}/100</span>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       {editingId === agent.id ? (
                         <div className="flex items-center gap-2">
                           <input 
                              type="number" 
                              className="w-16 px-2 py-1 text-xs font-bold border rounded-lg focus:ring-2 focus:ring-[#0D9488]/20"
                              value={editLimit}
                              onChange={(e) => setEditLimit(parseInt(e.target.value))}
                           />
                           <button onClick={() => handleUpdateLimit(agent.id)} className="p-1 text-[#0D9488] hover:bg-teal-50 rounded-md transition-colors">
                             <Check size={14} />
                           </button>
                           <button onClick={() => setEditingId(null)} className="p-1 text-red-400 hover:bg-red-50 rounded-md transition-colors">
                             <X size={14} />
                           </button>
                         </div>
                       ) : (
                         <div className="flex items-center gap-2 group/limit">
                           <span className="text-sm font-bold text-slate-700">{agent.upload_limit}</span>
                           <button 
                             onClick={() => {
                               setEditingId(agent.id);
                               setEditLimit(agent.upload_limit);
                             }} 
                             className="p-1 text-slate-400 hover:text-slate-600 opacity-0 group-hover/limit:opacity-100 transition-opacity"
                           >
                             <Edit2 size={12} />
                           </button>
                         </div>
                       )}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button 
                         onClick={() => setExpandedId(expandedId === agent.id ? null : agent.id)}
                         className="p-2 hover:bg-white rounded-xl transition-all shadow-sm border border-slate-100"
                       >
                         {expandedId === agent.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                       </button>
                    </td>
                  </tr>
                  {/* Expanded Empanelments Row */}
                  <AnimatePresence>
                    {expandedId === agent.id && (
                      <tr>
                        <td colSpan={7} className="px-8 py-6 bg-slate-50/50">
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                          >
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                   <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Empanelled Insurers</h5>
                                   <div className="flex flex-wrap gap-2">
                                      {agent.empanelments.length > 0 ? agent.empanelments.map((ins, i) => (
                                        <span key={i} className="px-3 py-1.5 bg-white border border-teal-100 text-[#0D9488] text-[11px] font-bold rounded-full shadow-sm">
                                          {ins}
                                        </span>
                                      )) : (
                                        <p className="text-xs text-slate-400 italic">No empanelments listed</p>
                                      )}
                                   </div>
                                </div>
                                <div className="space-y-4">
                                   <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Quick Stats</h5>
                                   <div className="grid grid-cols-2 gap-4">
                                      <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                                         <Mail size={16} className="text-slate-400" />
                                         <p className="text-xs font-bold text-slate-700 truncate">{agent.email}</p>
                                      </div>
                                      <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                                         <ShieldAlert size={16} className="text-amber-500" />
                                         <p className="text-xs font-bold font-['Inter'] text-slate-700 uppercase">Limit: {agent.upload_limit}</p>
                                      </div>
                                   </div>
                                </div>
                             </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              ))}
              {filteredAgents.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-medium italic">
                    No agents found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminAgents;
