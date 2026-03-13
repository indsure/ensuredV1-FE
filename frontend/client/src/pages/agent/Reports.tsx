import { useState, useEffect } from 'react';
import {
  Share2,
  Copy,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { useToast } from '../../hooks/use-toast';

interface PublicReport {
  id: string;
  created_at: string;
  is_active: boolean;
  client: {
    id: string;
    policyholder_name: string;
    insurer: string;
    score: number;
    flaws: any;
    report_data: any;
  };
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
};

export default function AgentReports() {
  const [userId, setUserId] = useState<string | null>(null);
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  
  const { toast } = useToast();

  const fetchReports = async (uid: string) => {
    // We need to join public_reports with clients
    const { data: reportData, error } = await supabase
      .from('public_reports')
      .select('*, client:clients(*)')
      .eq('agent_id', uid)
      .order('created_at', { ascending: false });

    if (!error && reportData) {
      setReports(reportData as unknown as PublicReport[]);
    }
  };

  useEffect(() => {
    async function initialize() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        fetchReports(user.id);
      }
    }
    initialize();
  }, []);

  const handleCopyLink = async (id: string) => {
    const link = `${window.location.origin}/report/${id}`;
    await navigator.clipboard.writeText(link);
    toast({
      title: "Link Copied!",
      description: "The public report link has been copied to your clipboard.",
      duration: 3000,
    });
  };

  const handleRevoke = async (id: string) => {
    const { error } = await supabase
      .from('public_reports')
      .update({ is_active: false })
      .eq('id', id);

    if (!error) {
      setReports(prev => prev.map(r => r.id === id ? { ...r, is_active: false } : r));
      toast({
        title: "Link Revoked",
        description: "The shareable link is now inactive.",
      });
    } else {
      toast({
        title: "Failed to revoke",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-['Playfair_Display'] text-3xl font-semibold text-[#0F172A]">Shared Reports</h1>
          <p className="text-[#64748B] text-sm mt-1">Manage public links generated for your clients.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden flex-1">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-slate-100 text-[11px] uppercase tracking-wider text-[#64748B] font-semibold">
                <th className="px-6 py-4">Client Name</th>
                <th className="px-6 py-4">Policy</th>
                <th className="px-6 py-4">Created Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-16 h-16 bg-[#0D9488]/10 text-[#0D9488] rounded-full flex items-center justify-center mb-4">
                        <Share2 size={32} />
                      </div>
                      <h4 className="font-['Playfair_Display'] text-xl font-semibold text-[#0F172A] mb-2">No reports shared yet</h4>
                      <p className="text-[#64748B] text-sm mb-6">Generate your first shareable link from the Policies page.</p>
                      <button 
                        onClick={() => window.location.href = '/agent/policies'}
                        className="px-6 py-2 bg-[#0D9488] hover:bg-[#0f766e] text-white text-sm font-semibold rounded-lg shadow-md transition-all"
                      >
                        Go to Policies
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                reports.map(report => (
                  <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-[#0F172A]">{report.client?.policyholder_name || "Unknown Name"}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {report.client?.id?.substring(0,8)}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[200px]">
                      {report.client?.insurer || '--'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {format(new Date(report.created_at), 'MMM d, yyyy • h:mm a')}
                    </td>
                    <td className="px-6 py-4">
                      {report.is_active ? (
                        <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-100">
                          Active
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-xs font-bold border border-red-100">
                          Revoked
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <button 
                          onClick={() => window.open(`/report/${report.id}`, '_blank')}
                          disabled={!report.is_active}
                          className="p-2 text-slate-400 hover:text-[#0D9488] disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                          title="Open Link"
                        >
                          <ExternalLink size={16} />
                        </button>
                        <button 
                          onClick={() => handleCopyLink(report.id)}
                          disabled={!report.is_active}
                          className="p-2 text-slate-400 hover:text-[#0D9488] disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                          title="Copy Link"
                        >
                          <Copy size={16} />
                        </button>
                        {report.is_active ? (
                          <button 
                            onClick={() => handleRevoke(report.id)}
                            className="p-2 text-red-400 hover:text-red-600 transition-colors ml-2"
                            title="Revoke Access"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <div className="w-[32px] ml-2" /> // spacer
                        )}
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
  );
}
