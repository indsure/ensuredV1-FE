import { useEffect, useMemo, useState } from "react"
import { useLocation } from "wouter"
import { formatDistanceToNow } from "date-fns"

import { Card } from "@/components/ui/card"
import { TableRowSkeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { supabase } from "@/lib/supabase"
import { useAgent } from "@/context/AgentContext"
import { InlineErrorState } from "@/components/agent/InlineErrorState"
import { ShareLinkPopover } from "@/components/agent/ShareLinkPopover"

type AnalysisRow = {
  id: string;
  status: string;
  created_at: string;
  updated_at: string | null;
  client_name: string | null;
  insurer: string | null;
  risk_score: number | null;
  view_count: number | null;
  viewed_at: string | null;
  share_enabled: boolean | null;
  share_token: string | null;
};

function statusClass(status: string): string {
  const map: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
    processing: "bg-blue-50 text-blue-700 border-blue-100",
    failed: "bg-red-50 text-red-700 border-red-100",
  };
  return map[status] ?? "bg-slate-50 text-slate-600 border-slate-200"
}

export default function ReportsNew() {
  const [, setLocation] = useLocation();
  const [rows, setRows] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { agent } = useAgent();

  async function fetchReports() {
    if (!agent?.agentId) return;
    setLoading(true);
    setError(null)
    try {
      const { data, error: qErr } = await supabase
        .from("clients")
        .select(
          "id, name, insurer, status, score, created_at, policyholder_name, share_token, share_enabled, views, client_email, client_phone, policy_identifier"
        )
        .eq("agent_id", agent.agentId)
        .eq("status", "done")
        .order("created_at", { ascending: false })
        .limit(100)

      if (qErr) throw new Error(qErr.message)
      
      // Map the data to match the expected structure
      const mappedData = (data ?? []).map(item => ({
        id: item.id,
        client_name: item.policyholder_name || item.name,
        insurer: item.insurer,
        status: 'completed',
        risk_score: item.score,
        view_count: item.views,
        viewed_at: null,
        share_enabled: item.share_enabled,
        share_token: item.share_token,
        created_at: item.created_at,
        updated_at: item.created_at
      }))
      
      setRows(mappedData as AnalysisRow[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    if (agent?.agentId) fetchReports(); 
  }, [agent?.agentId]);

  const shareBaseUrl = useMemo(() => {
    if (typeof window === "undefined") return ""
    return window.location.origin
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">Report Ledger</h1>
          <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-0.5 text-[11px] font-black text-slate-500 tracking-tight uppercase">
            {rows.length} Reports
          </span>
        </div>
        <button 
          onClick={fetchReports}
          className="text-sm text-[#0D9488] font-semibold hover:underline"
        >
          Refresh Ledger
        </button>
      </div>

      {error && <InlineErrorState onRetry={fetchReports} />}

      {!loading && !error && rows.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-20 text-center">
            <p className="text-slate-400 italic font-medium">No diagnostic reports have been finalized yet.</p>
        </div>
      )}

      {!error && (
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50 text-left text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
                <tr>
                  <th className="p-5">Policy ID</th>
                  <th className="p-5">Client</th>
                  <th className="p-5">Insurer</th>
                  <th className="p-5">Risk Score</th>
                  <th className="p-5">Status</th>
                  <th className="p-5">Views</th>
                  <th className="p-5">Created</th>
                  <th className="p-5 text-right">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-medium">
                {loading && (
                  <>
                    <TableRowSkeleton columns={8} />
                    <TableRowSkeleton columns={8} />
                    <TableRowSkeleton columns={8} />
                  </>
                )}

                {!loading &&
                  rows.map((r) => {
                    const shareUrl = r.share_token ? `${shareBaseUrl}/report/${r.share_token}` : null
                    const views = r.view_count ?? 0
                    const viewedAt = r.viewed_at ? new Date(r.viewed_at) : null
                    const viewedLabel = viewedAt ? formatDistanceToNow(viewedAt, { addSuffix: true }) : null

                    return (
                      <tr
                        key={r.id}
                        className="group hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => setLocation(`/agent/policies/${r.id}`)}
                      >
                        <td className="p-5 font-black text-[#0D9488]">{r.id}</td>
                        <td className="p-5 text-slate-700">{r.client_name ?? "—"}</td>
                        <td className="p-5 text-slate-700 font-bold">{r.insurer ?? "—"}</td>
                        <td className="p-5 font-black text-slate-900">{r.risk_score ?? "—"}</td>
                        <td className="p-5">
                          <span className={`inline-flex rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-widest border ${statusClass(r.status)}`}>
                            {r.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="p-5">
                          {views === 0 ? (
                            <span className="text-xs text-slate-400">Not viewed</span>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center rounded-full bg-teal-50 text-teal-700 border border-teal-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest">
                                    {views} views
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Last opened: {viewedLabel ?? "—"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </td>
                        <td className="p-5 text-slate-500 text-xs">
                          {new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td className="p-5 text-right" onClick={(e) => e.stopPropagation()}>
                          <ShareLinkPopover
                            shareUrl={shareUrl}
                            shareEnabled={r.share_enabled ?? true}
                            disabled={!shareUrl}
                            onDisable={async () => {
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session) return;
                              
                              const res = await fetch(`/api/agent/clients/${r.id}/share/toggle`, {
                                method: "POST",
                                headers: {
                                  "Authorization": `Bearer ${session.access_token}`,
                                  "Content-Type": "application/json"
                                },
                                body: JSON.stringify({ enabled: false }),
                              })
                              if (!res.ok) throw new Error("Request failed")
                              setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, share_enabled: false } : x)))
                            }}
                          />
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
