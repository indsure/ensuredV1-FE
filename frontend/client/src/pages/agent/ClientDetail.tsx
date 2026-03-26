import { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { supabase } from '@/lib/supabase';
import { PolicyAuditReport } from '../../components/PolicyAuditReport';
import { ArrowLeft, Loader2, AlertTriangle, Share2 } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

export default function AgentClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchClient() {
      try {
        if (!id) return;
        const { data, error: fetchError } = await supabase
          .from('clients')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;
        setClient(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchClient();
  }, [id]);

  const handleGenerateLink = async () => {
    if (!client) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('public_reports')
        .insert({
          agent_id: user?.id,
          client_id: client.id,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      const link = `${window.location.origin}/report/${data.id}`;
      await navigator.clipboard.writeText(link);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[#0D9488]" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <AlertTriangle className="w-12 h-12 mb-4 text-amber-500" />
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Client Not Found</h2>
        <p className="mb-6">{error || "The client could not be loaded."}</p>
        <Link href="/agent/dashboard">
          <button className="px-4 py-2 bg-[#0D9488] text-white rounded-lg hover:bg-teal-700">
            Back to Dashboard
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-cream-main)] rounded-xl overflow-hidden shadow-sm border border-slate-200">
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/agent/dashboard">
            <button className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft size={20} />
            </button>
          </Link>
          <h2 className="font-['Playfair_Display'] text-xl font-semibold text-slate-800 truncate">
            {client.policyholder_name}'s Report
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateLink}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#0D9488] bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
          >
            <Share2 size={16} />
            Share Report
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto no-scrollbar relative w-full h-full bg-[var(--color-cream-main)]">
        {client.report_data ? (
          <PolicyAuditReport data={client.report_data} hideNav={true} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
             <AlertTriangle size={32} className="mb-2 opacity-50 text-amber-500" />
             <p className="text-sm">Report data is unavailable or pending analysis.</p>
          </div>
        )}
      </div>
    </div>
  );
}
