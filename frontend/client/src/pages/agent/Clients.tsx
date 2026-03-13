import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  FileText,
  AlertTriangle,
  RefreshCw,
  X,
  Share2,
  MoreVertical,
  ChevronRight,
  UploadCloud
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format, differenceInDays } from 'date-fns';
import { PolicyAuditReport } from '../../components/PolicyAuditReport';
import { useToast } from '../../hooks/use-toast';
import { Link } from 'react-router-dom';
import SwitchModal from '../../components/agent/SwitchModal';
import UploadModal from '../../components/agent/UploadModal';

interface Client {
  id: string;
  batch_id: string;
  policyholder_name: string | null;
  insurer: string | null;
  sum_insured: number | null;
  expiry_date: string | null;
  status: string;
  score: number;
  flaws: any;
  report_data: any;
  created_at: string;
}

export default function AgentPolicies() {
  const [userId, setUserId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [clientForSwitch, setClientForSwitch] = useState<Client | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  
  const { toast } = useToast();

  const fetchClients = async (uid: string) => {
    const { data: clientData, error } = await supabase
      .from('clients')
      .select('*')
      .eq('agent_id', uid)
      .order('created_at', { ascending: false });

    if (!error && clientData) {
      setClients(clientData);
    }
  };

  useEffect(() => {
    let channel: any;

    async function initialize() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        fetchClients(user.id);

        channel = supabase
          .channel('policies_changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'clients', filter: `agent_id=eq.${user.id}` },
            () => { fetchClients(user.id); }
          )
          .subscribe();
      }
    }

    initialize();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const hasSwitchOpportunity = (client: Client) => {
    if (client.status !== 'done' || (client.score || 0) >= 75) return false;
    const flaws = Array.isArray(client.flaws) ? client.flaws : [];
    const keywords = ['room rent', 'co-payment', 'restoration', 'limit'];
    return flaws.some((f: string) => keywords.some(k => f.toLowerCase().includes(k)));
  };

  const handleGenerateLink = async (client: Client) => {
    try {
      const { data, error } = await supabase
        .from('public_reports')
        .insert({
          agent_id: userId,
          client_id: client.id,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      
      const link = `${window.location.origin}/report/${data.id}`;
      await navigator.clipboard.writeText(link);
      
      console.log("[SHARE] Public report generated:", {
          id: data.id,
          link: link,
          client: client.policyholder_name
      });
      
      toast({
        title: "Link Copied!",
        description: "The public report link has been copied to your clipboard.",
        duration: 3000,
      });
    } catch (err: any) {
      toast({
        title: "Error generating link",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const deleteClient = async (clientId: string) => {
    if (!confirm("Delete this policy? This cannot be undone.")) return;
    await fetch(`/api/agent/delete-client/${clientId}`, { 
      method: "DELETE" 
    });
    setClients(prev => prev.filter(c => c.id !== clientId));
  };

  // ─── Filter & Search Logic ────────────────────────────────────────────────
  const filteredClients = clients.filter(c => {
    const matchesSearch = 
      (c.policyholder_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (c.insurer?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      
    if (!matchesSearch) return false;
    
    switch (activeFilter) {
      case 'Done': return c.status === 'done';
      case 'Processing': return c.status === 'processing' || c.status === 'pending';
      case 'Error': return c.status === 'error';
      case 'Switch Available': return hasSwitchOpportunity(c);
      default: return true;
    }
  });

  const getExpiryLabel = (date: string | null) => {
    if (!date) return <span className="text-slate-400 italic">Unknown</span>;
    const days = differenceInDays(new Date(date), new Date());
    if (days < 0) return <span className="text-red-600 font-medium">Expired</span>;
    if (days <= 30) return <span className="text-amber-600 font-medium">{days} days</span>;
    return <span className="text-slate-600">{days} days</span>;
  };

  const getScorePill = (score: number, status: string) => {
    if (status !== 'done') return <span className="text-slate-400">--</span>;
    if (score >= 75) return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">{score}</span>;
    if (score >= 50) return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">{score}</span>;
    return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">{score}</span>;
  };

  return (
    <div className="flex relative h-full">
      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${isDrawerOpen ? 'mr-[500px]' : ''}`}>
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="font-['Playfair_Display'] text-3xl font-semibold text-[#0F172A]">Policies</h1>
            <p className="text-[#64748B] text-sm mt-1">Manage all your client health policies and insights.</p>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search name or insurer..." 
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488]"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setIsUploadModalOpen(true)}
              className="md:hidden flex items-center justify-center w-10 h-10 bg-[#0D9488] text-white rounded-lg shrink-0"
            >
              <UploadCloud size={18} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {['All', 'Done', 'Processing', 'Error', 'Switch Available'].map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                activeFilter === filter 
                  ? 'bg-[#0B1120] text-white' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden relative">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-slate-100 text-[11px] uppercase tracking-wider text-[#64748B] font-semibold">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Insurer</th>
                  <th className="px-6 py-4">Sum Insured</th>
                  <th className="px-6 py-4">Expiry</th>
                  <th className="px-6 py-4">Score</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                        <div className="w-16 h-16 bg-[#0D9488]/10 text-[#0D9488] rounded-full flex items-center justify-center mb-4">
                          <UploadCloud size={32} />
                        </div>
                        <h4 className="font-['Playfair_Display'] text-xl font-semibold text-[#0F172A] mb-2">
                          No policies found
                        </h4>
                        <p className="text-[#64748B] text-sm mb-6">
                          {clients.length === 0 
                            ? "Upload your first batch to start analyzing policies." 
                            : "No policies match your search or filter criteria."}
                        </p>
                        {clients.length === 0 && (
                          <button 
                            onClick={() => setIsUploadModalOpen(true)}
                            className="px-6 py-2 bg-[#0D9488] hover:bg-[#0f766e] text-white text-sm font-semibold rounded-lg shadow-md transition-all"
                          >
                            Upload Batch
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredClients.map(client => (
                    <tr 
                      key={client.id} 
                      className={`border-b border-slate-50 hover:bg-[#F0F0ED] cursor-pointer transition-colors ${selectedClient?.id === client.id ? 'bg-slate-50' : ''}`}
                      onClick={() => {
                        if (client.status === 'done') {
                          setSelectedClient(client);
                          setIsDrawerOpen(true);
                        }
                      }}
                    >
                      <td className="px-6 py-4">
                        <p className={`text-sm font-medium ${!client.policyholder_name ? 'text-amber-600 italic' : 'text-[#0F172A]'}`}>
                          {client.policyholder_name || 'Missing Name'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{client.insurer || '--'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {client.sum_insured ? `₹${(client.sum_insured/100000).toFixed(1)}L` : '--'}
                      </td>
                      <td className="px-6 py-4 text-sm">{getExpiryLabel(client.expiry_date)}</td>
                      <td className="px-6 py-4">{getScorePill(client.score, client.status)}</td>
                      <td className="px-6 py-4">
                        {client.status === 'done' && <span className="text-xs font-bold text-green-600 uppercase">Done</span>}
                        {client.status === 'error' && <span className="text-xs font-bold text-red-600 uppercase">Failed</span>}
                        {(client.status === 'processing' || client.status === 'pending') && (
                          <span className="text-xs font-bold text-blue-600 uppercase flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"/>
                            {client.status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end items-center gap-2" onClick={e => e.stopPropagation()}>
                          {hasSwitchOpportunity(client) && (
                            <button 
                              onClick={() => { setClientForSwitch(client); setIsSwitchModalOpen(true); }}
                              className="px-2 py-1 text-xs font-bold text-[#B45309] bg-amber-100 hover:bg-amber-200 rounded"
                            >
                              Switch
                            </button>
                          )}
                          {client.status === 'done' && (
                            <button 
                              onClick={() => handleGenerateLink(client)}
                              className="p-1.5 text-slate-400 hover:text-[#0D9488] transition-colors"
                              title="Generate Shareable Link"
                            >
                              <Share2 size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => deleteClient(client.id)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            Delete
                          </button>
                          <ChevronRight size={18} className="text-slate-300" />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Drawer */}
      <AnimatePresence>
        {isDrawerOpen && selectedClient && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              // @ts-ignore
              onClick={() => setIsDrawerOpen(false)}
              // @ts-ignore
              className="fixed inset-0 bg-black/20 z-40 lg:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              // @ts-ignore
              className="fixed right-0 top-0 bottom-0 w-full max-w-[500px] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.1)] z-50 flex flex-col border-l border-slate-200 overflow-hidden"
            >
              <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 shrink-0 bg-[#0B1120]">
                <h2 className="font-['Playfair_Display'] text-lg font-semibold text-white truncate pr-4">
                  {selectedClient.policyholder_name}'s Report
                </h2>
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => handleGenerateLink(selectedClient)}
                    className="p-1.5 text-slate-300 hover:text-white rounded-lg transition-colors"
                    title="Share Report"
                  >
                    <Share2 size={18} />
                  </button>
                  <button 
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-1.5 text-slate-300 hover:text-white rounded-lg transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto no-scrollbar relative w-full h-full bg-[var(--color-cream-main)]">
                {selectedClient.report_data ? (
                  <PolicyAuditReport data={selectedClient.report_data} hideNav={true} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <AlertTriangle size={32} className="mb-2 opacity-50 text-amber-500" />
                    <p className="text-sm">Report data is unavailable or corrupted.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modals */}
      {clientForSwitch && (
        <SwitchModal
          isOpen={isSwitchModalOpen}
          onClose={() => setIsSwitchModalOpen(false)}
          client={{
              ...clientForSwitch,
              name: clientForSwitch.policyholder_name || 'Anonymous'
          }}
        />
      )}
      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        agentId={userId || ''} 
      />
    </div>
  );
}
