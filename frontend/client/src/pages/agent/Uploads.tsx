import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Plus
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import UploadModal from '../../components/agent/UploadModal';
import { useToast } from '../../hooks/use-toast';

interface Client {
  id: string;
  batch_id: string;
  policyholder_name: string | null;
  status: string;
  score: number;
  created_at: string;
}

interface Batch {
  id: string;
  created_at: string;
  total: number;
  processed: number;
  failed: number;
  clients: Client[];
  isComplete: boolean;
}

export default function AgentUploads() {
  const [userId, setUserId] = useState<string | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  
  const { toast } = useToast();

  const fetchUploads = async (uid: string) => {
    const { data: clientData, error } = await supabase
      .from('clients')
      .select('*')
      .eq('agent_id', uid)
      .order('created_at', { ascending: false });

    if (!error && clientData) {
      const batchesMap = new Map<string, Batch>();
      clientData.forEach(c => {
        if (!batchesMap.has(c.batch_id)) {
          batchesMap.set(c.batch_id, { 
            id: c.batch_id, 
            created_at: c.created_at, 
            total: 0, 
            processed: 0, 
            failed: 0,
            clients: [],
            isComplete: false
          });
        }
        const batch = batchesMap.get(c.batch_id)!;
        batch.total += 1;
        batch.clients.push(c);
        if (c.status === 'done') batch.processed += 1;
        if (c.status === 'error') batch.failed += 1;
      });
      
      const batchesArray = Array.from(batchesMap.values()).map(b => ({
        ...b,
        isComplete: (b.processed + b.failed) === b.total
      })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setBatches(batchesArray);
    }
  };

  useEffect(() => {
    let channel: any;

    async function initialize() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        fetchUploads(user.id);

        channel = supabase
          .channel('uploads_changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'clients', filter: `agent_id=eq.${user.id}` },
            () => { fetchUploads(user.id); }
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
      await fetch('/api/agent/trigger-batch-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: client.batch_id })
      });
      toast({ title: "Retry started", description: "The policy is being re-analyzed in the background." });
    } catch (err: any) {
      toast({ title: "Retry failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUpdating(null);
    }
  };

  const toggleExpand = (batchId: string) => {
    setExpandedBatch(prev => prev === batchId ? null : batchId);
  };

  return (
    <div className="h-full">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-['Playfair_Display'] text-3xl font-semibold text-[#0F172A]">Uploads</h1>
          <p className="text-[#64748B] text-sm mt-1">View your batch history and track processing status.</p>
        </div>
        
        <button 
          onClick={() => setIsUploadModalOpen(true)}
          className="flex items-center gap-2 px-6 py-2 bg-[#0D9488] hover:bg-[#0f766e] text-white text-sm font-semibold rounded-lg shadow-[0_4px_14px_0_rgba(13,148,136,0.39)] transition-all hover:-translate-y-0.5"
        >
          <Plus size={18} />
          New Upload
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden">
        {batches.length === 0 ? (
          <div className="py-20 text-center">
            <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
              <div className="w-16 h-16 bg-[#0D9488]/10 text-[#0D9488] rounded-full flex items-center justify-center mb-4">
                <UploadCloud size={32} />
              </div>
              <h4 className="font-['Playfair_Display'] text-xl font-semibold text-[#0F172A] mb-2">No uploads yet</h4>
              <p className="text-[#64748B] text-sm mb-6">You haven't uploaded any batches. Click New Upload to get started.</p>
            </div>
          </div>
        ) : (
          <div className="w-full">
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-[#F8FAFC] border-b border-slate-100 text-[11px] uppercase tracking-wider text-[#64748B] font-semibold">
              <div className="col-span-4">Batch Date / ID</div>
              <div className="col-span-2 text-center">Uploaded</div>
              <div className="col-span-2 text-center">Processed</div>
              <div className="col-span-2 text-center">Failed</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            
            <div className="divide-y divide-slate-50">
              {batches.map(batch => (
                <div key={batch.id} className="group">
                  <div 
                    onClick={() => toggleExpand(batch.id)}
                    className={`cursor-pointer transition-colors p-4 md:px-6 hover:bg-slate-50 ${expandedBatch === batch.id ? 'bg-slate-50' : ''}`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      <div className="col-span-12 md:col-span-4 flex items-center gap-3">
                        <button className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
                          {expandedBatch === batch.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                        <div>
                          <p className="text-sm font-semibold text-[#0F172A]">
                            {format(new Date(batch.created_at), 'MMMM d, yyyy • h:mm a')}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {batch.id.substring(0,8)}</p>
                        </div>
                      </div>
                      
                      <div className="col-span-4 md:col-span-2 flex justify-between md:justify-center items-center">
                        <span className="text-xs text-slate-500 md:hidden">Total:</span>
                        <span className="text-sm font-medium text-slate-700">{batch.total} Files</span>
                      </div>
                      
                      <div className="col-span-4 md:col-span-2 flex justify-between md:justify-center items-center">
                        <span className="text-xs text-slate-500 md:hidden">Processed:</span>
                        <span className="text-sm font-medium text-green-600">{batch.processed}</span>
                      </div>
                      
                      <div className="col-span-4 md:col-span-2 flex justify-between md:justify-center items-center">
                        <span className="text-xs text-slate-500 md:hidden">Failed:</span>
                        <span className={`text-sm font-bold ${batch.failed > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                          {batch.failed}
                        </span>
                      </div>
                      
                      <div className="col-span-12 md:col-span-2 flex justify-end">
                        {batch.isComplete ? (
                          <span className="px-2.5 py-1 bg-teal-50 text-teal-700 rounded text-[10px] font-bold uppercase border border-teal-100">
                            Completed
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded text-[10px] font-bold uppercase border border-blue-100 flex items-center gap-1">
                            <RefreshCw size={12} className="animate-spin" /> Processing
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Row */}
                  <AnimatePresence>
                    {expandedBatch === batch.id && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-slate-50/50 border-t border-slate-100"
                      >
                        <div className="p-4 md:px-12 md:py-6">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                            <FileText size={14}/> Batch Contents
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {batch.clients.map(client => (
                              <div key={client.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col justify-between">
                                <div>
                                  <div className="flex justify-between items-start mb-2">
                                    <p className="text-sm font-semibold truncate pr-2 text-[#0F172A]" title={client.policyholder_name || "Unknown Name"}>
                                      {client.policyholder_name || "Unknown Name"}
                                    </p>
                                    {client.status === 'done' && (
                                      <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold border ${client.score >= 75 ? 'bg-green-50 border-green-200 text-green-700' : client.score >= 50 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                        {client.score}/100
                                      </span>
                                    )}
                                    {client.status === 'error' && (
                                      <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
                                        <AlertTriangle size={10} /> Failed
                                      </span>
                                    )}
                                    {(client.status === 'pending' || client.status === 'processing') && (
                                      <span className="shrink-0 text-xs font-semibold text-blue-600 flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"/>
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 font-mono">ID: {client.id.substring(0,8)}</p>
                                </div>
                                
                                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                                  {client.status === 'done' ? (
                                    <Link to={`/agent/policies?view=${client.id}`} className="text-xs font-semibold text-[#0D9488] hover:underline">View Policy</Link>
                                  ) : client.status === 'error' ? (
                                    <button 
                                      onClick={() => handleRetry(client)}
                                      disabled={isUpdating === client.id}
                                      className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 disabled:opacity-50"
                                    >
                                      <RefreshCw size={12} className={isUpdating === client.id ? 'animate-spin' : ''} /> Retry Extraction
                                    </button>
                                  ) : (
                                    <span className="text-xs text-slate-400 italic">Processing in background...</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        agentId={userId || ''} 
      />
    </div>
  );
}
