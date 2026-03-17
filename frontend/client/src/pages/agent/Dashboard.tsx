import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import {
  Users,
  ShieldCheck,
  AlertCircle,
  TrendingUp,
  FileText,
  AlertTriangle,
  RefreshCw,
  Edit2,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AgentSummaryCard from '../../components/agent/AgentSummaryCard';
import { format, differenceInDays } from 'date-fns';
import { apiFetch } from '@/lib/api';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
};

interface Client {
  id: string;
  batch_id: string;
  policyholder_name: string | null;
  status: string;
  score: number;
  expiry_date: string | null;
  created_at: string;
}

export default function AgentDashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const fetchDashboardData = async (uid: string) => {
    const { data: clientData, error } = await supabase
      .from('clients')
      .select('*')
      .eq('agent_id', uid)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching clients:', error);
      return;
    }
    setClients(clientData || []);
  };

  useEffect(() => {
    let channel: any;

    async function initialize() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        fetchDashboardData(user.id);

        channel = supabase
          .channel('dashboard_changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'clients', filter: `agent_id=eq.${user.id}` },
            () => { fetchDashboardData(user.id); }
          )
          .subscribe();
      }
    }

    initialize();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const handleRetry = async (client: Client) => {
    setIsUpdating(client.id);
    try {
      await supabase.from('clients').update({ status: 'pending', error_message: null }).eq('id', client.id);
      await apiFetch('/api/agent/trigger-batch-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: client.batch_id })
      });
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setIsUpdating(null);
    }
  };

  // ─── Stats Calculation ──────────────────────────────────────────
  const doneClients = clients.filter(c => c.status === 'done');
  const avgScore = doneClients.length > 0 
    ? Math.round(doneClients.reduce((acc, curr) => acc + (curr.score || 0), 0) / doneClients.length)
    : 0;
  
  const now = new Date();
  const expiringSoonCount = doneClients.filter(c => {
    if (!c.expiry_date) return false;
    const expiry = new Date(c.expiry_date);
    const diff = differenceInDays(expiry, now);
    return diff >= 0 && diff <= 30;
  }).length;

  const totalFlaws = doneClients.reduce((acc, curr: any) => {
    const flaws = Array.isArray(curr.flaws) ? curr.flaws : [];
    return acc + flaws.length;
  }, 0);

  // ─── Action Queue ────────────────────────────────────────────────
  const actionQueueItems = clients.filter(c => {
    if (c.status === 'error') return true;
    if (c.status === 'done' && (!c.policyholder_name || !c.expiry_date)) return true;
    if (c.status === 'done' && c.score < 50) return true;
    if (c.status === 'done' && c.expiry_date) {
      const diff = differenceInDays(new Date(c.expiry_date), now);
      if (diff >= 0 && diff <= 30) return true;
    }
    return false;
  }).slice(0, 5); // Limit to top 5 flagged items

  // ─── Batch Aggregation ───────────────────────────────────────────
  const batchesMap = new Map<string, { id: string, created_at: string, total: number, processed: number, failed: number }>();
  clients.forEach(c => {
    if (!batchesMap.has(c.batch_id)) {
      batchesMap.set(c.batch_id, { id: c.batch_id, created_at: c.created_at, total: 0, processed: 0, failed: 0 });
    }
    const batch = batchesMap.get(c.batch_id)!;
    batch.total += 1;
    if (c.status === 'done') batch.processed += 1;
    if (c.status === 'error') batch.failed += 1;
  });
  
  const recentBatches = Array.from(batchesMap.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);

  return (
    <motion.div 
      className="max-w-7xl mx-auto space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants} className="flex justify-between items-end">
        <div>
          <h2 className="font-['Playfair_Display'] text-3xl font-semibold text-[#0F172A]">Overview</h2>
          <p className="text-[#64748B] text-sm mt-1">Here's what needs your attention today.</p>
        </div>
      </motion.div>

      {/* Action Queue */}
      <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.1)] border-l-4 border-l-[#B45309]">
        <h3 className="font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
          <AlertCircle className="text-[#B45309]" size={20} />
          Action Queue
        </h3>
        
        {actionQueueItems.length === 0 ? (
          <div className="flex items-center gap-3 text-[#0D9488] bg-[#0D9488]/10 p-4 rounded-lg">
            <CheckCircle2 size={24} />
            <span className="font-medium">All caught up. No action needed.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {actionQueueItems.map(client => {
              let tag = null;
              let action = null;
              
              if (client.status === 'error') {
                tag = <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold uppercase">Analysis Failed</span>;
                action = (
                  <button onClick={() => handleRetry(client)} disabled={isUpdating === client.id} className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1 disabled:opacity-50">
                    <RefreshCw size={14} className={isUpdating === client.id ? 'animate-spin' : ''} /> Retry
                  </button>
                );
              } else if (!client.policyholder_name || !client.expiry_date) {
                tag = <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold uppercase">Missing Info</span>;
                action = <Link to={`/agent/policies?edit=${client.id}`} className="text-amber-600 hover:text-amber-700 text-sm font-medium flex items-center gap-1"><Edit2 size={14} /> Edit</Link>;
              } else if (client.score < 50) {
                tag = <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold uppercase">Critical Score</span>;
                action = <Link to={`/agent/policies?switch=${client.id}`} className="text-red-600 hover:text-red-700 text-sm font-medium border border-red-200 px-2 py-1 rounded">Find Switch</Link>;
              } else {
                tag = <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold uppercase">Expiring Soon</span>;
                action = <Link to={`/agent/policies`} className="text-amber-600 hover:text-amber-700 text-sm font-medium">Review Policy</Link>;
              }

              return (
                <div key={client.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-4">
                    {tag}
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">{client.policyholder_name || `Client ID: ${client.id.substring(0,8)}`}</p>
                      <p className="text-xs text-slate-500">Uploaded {format(new Date(client.created_at), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                  <div>{action}</div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* 4 Stat Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-slate-100 flex flex-col">
          <p className="text-sm font-medium text-[#64748B] mb-2">Avg Portfolio Score</p>
          <div className="mt-auto flex items-end gap-2">
            <span className={`font-['Playfair_Display'] text-4xl font-semibold ${avgScore >= 75 ? 'text-[#0D9488]' : avgScore >= 50 ? 'text-[#B45309]' : avgScore > 0 ? 'text-[#ef4444]' : 'text-[#64748B]'}`}>
              {avgScore || '--'}
            </span>
            <span className="text-sm text-[#64748B] mb-1">/100</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-slate-100 flex flex-col">
          <p className="text-sm font-medium text-[#64748B] mb-2">Total Clients</p>
          <div className="mt-auto flex items-end justify-between">
            <span className="font-['Playfair_Display'] text-4xl font-semibold text-[#0D9488]">{clients.length}</span>
            <div className="w-10 h-10 rounded-full bg-[#0D9488]/10 flex items-center justify-center text-[#0D9488]"><Users size={20} /></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-slate-100 flex flex-col">
          <p className="text-sm font-medium text-[#64748B] mb-2">Expiring (30 days)</p>
          <div className="mt-auto flex items-end justify-between">
            <span className={`font-['Playfair_Display'] text-4xl font-semibold ${expiringSoonCount > 0 ? 'text-amber-600' : 'text-[#64748B]'}`}>{expiringSoonCount}</span>
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600"><AlertTriangle size={20} /></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-slate-100 flex flex-col">
          <p className="text-sm font-medium text-[#64748B] mb-2">Flaws Detected</p>
          <div className="mt-auto flex items-end justify-between">
            <span className="font-['Playfair_Display'] text-4xl font-semibold text-[#ef4444]">{totalFlaws}</span>
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600"><ShieldCheck size={20} /></div>
          </div>
        </div>
      </motion.div>

      {/* Bottom Row */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
        {/* Recent Uploads */}
        <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-6 flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-[#0F172A]">Recent Uploads</h3>
            <Link to="/agent/uploads" className="text-sm font-medium text-[#0D9488] hover:underline">View all uploads →</Link>
          </div>
          {recentBatches.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <FileText size={32} className="mb-2 opacity-50" />
              <p className="text-sm text-center">No uploads yet. Click 'New Upload' to start.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentBatches.map(batch => {
                const isComplete = batch.processed + batch.failed === batch.total;
                return (
                  <div key={batch.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-lg">
                    <div>
                      <p className="font-medium text-sm text-[#0F172A]">Batch • {format(new Date(batch.created_at), 'MMM d, yyyy')}</p>
                      <p className="text-xs text-slate-500">{batch.total} policies uploaded</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {isComplete ? (
                        <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-teal-100">Completed</span>
                      ) : (
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-blue-100 flex items-center gap-1"><RefreshCw size={10} className="animate-spin"/> Processing</span>
                      )}
                      <span className="text-xs text-slate-400">{batch.processed} successful, {batch.failed} failed</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Agent Summary Card */}
        <div className="h-full">
          <AgentSummaryCard agentId={userId || ''} hasClients={clients.length > 0} />
        </div>
      </motion.div>
    </motion.div>
  );
}
