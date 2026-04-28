import { useEffect, useState } from "react"
import { useLocation } from "wouter"
import { AlertTriangle, TrendingDown, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { supabase } from "@/lib/supabase"
import { useAgent } from "@/context/AgentContext"
import { InlineErrorState } from "@/components/agent/InlineErrorState"
import { TableRowSkeleton } from "@/components/ui/skeleton"

type Policy = {
  id: string;
  name: string;
  insurer: string;
  policy_name: string;
  status: string;
  score: number | null;
  created_at: string;
  updated_at: string;
};

export default function PoliciesNew() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { agent } = useAgent();

  async function fetchPolicies() {
    if (!agent?.agentId) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: qErr } = await supabase
        .from("policies")
        .select("id, client_name, insurer_name, product_name, status, score, created_at")
        .or(`created_by_agent_id.eq.${agent.agentId},assigned_agent_id.eq.${agent.agentId}`)
        .order("created_at", { ascending: false });

      if (qErr) throw new Error(qErr.message);
      
      // Map to match the expected Policy type
      const mappedData = (data ?? []).map(item => ({
        id: item.id,
        name: item.client_name || 'Unknown',
        insurer: item.insurer_name || 'Unknown',
        policy_name: item.product_name || 'Unknown',
        status: item.status,
        score: item.score,
        created_at: item.created_at,
        updated_at: item.created_at
      }));
      
      setPolicies(mappedData as any[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (agent?.agentId) fetchPolicies();
  }, [agent?.agentId]);

  const filtered = policies.filter(p => 
    p.name?.toLowerCase().includes(search.toLowerCase()) || 
    p.insurer?.toLowerCase().includes(search.toLowerCase()) ||
    p.policy_name?.toLowerCase().includes(search.toLowerCase())
  );

  function statusColor(status: string): string {
    const map: Record<string, string> = {
      done: 'bg-green-100 text-green-800 border-green-200',
      processing: 'bg-blue-100 text-blue-800 border-blue-200',
      error: 'bg-red-100 text-red-800 border-red-200',
      pending: 'bg-slate-100 text-slate-800 border-slate-200',
    };
    return map[status] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">My Policies</h1>
        <Button variant="outline" onClick={fetchPolicies} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && <InlineErrorState onRetry={fetchPolicies} />}

      {!error && (
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters */}
          <div className="w-full lg:w-64 shrink-0 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-800 mb-4">Filters</h3>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Search</label>
                <input
                  type="text"
                  placeholder="Client, Insurer, or Policy..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>
            </div>
          </div>

          {/* Table Area */}
          <div className="flex-1 relative">
            <Card className="border-none shadow-sm overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#FAFAF8] border-b border-slate-100 uppercase tracking-wider text-xs font-bold text-slate-400">
                    <tr className="text-left">
                      <th className="p-4 px-6">Policy Name</th>
                      <th className="p-4">Customer Name</th>
                      <th className="p-4">Insured With</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Risk Score</th>
                      <th className="p-4 text-right px-6">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loading && (
                      <>
                        <TableRowSkeleton columns={6} />
                        <TableRowSkeleton columns={6} />
                        <TableRowSkeleton columns={6} />
                      </>
                    )}
                    {!loading && filtered.length === 0 && (
                      <tr><td colSpan={6} className="p-10 text-center text-slate-400 italic font-medium">No policies found matching your search.</td></tr>
                    )}
                    {!loading && filtered.map((policy) => (
                      <tr key={policy.id} className="group hover:bg-slate-50/80 transition-colors cursor-pointer" onClick={() => setLocation('/agent/policies/' + policy.id)}>
                        <td className="p-4 px-6 font-bold text-[#0D9488]">{policy.policy_name || '—'}</td>
                        <td className="p-4 font-bold text-slate-800">{policy.name}</td>
                        <td className="p-4 font-semibold text-slate-500">{policy.insurer}</td>
                        <td className="p-4">
                          <span className={`inline-flex rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-widest border ${statusColor(policy.status)}`}>
                            {policy.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="p-4">
                          {policy.score !== null ? (
                            <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md font-black text-xs ${policy.score >= 70 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                              {policy.score}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-[#0D9488] font-bold hover:bg-[#0D9488]/10"
                            onClick={() => setLocation('/agent/policies/' + policy.id)}
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
