import { useEffect, useMemo, useState } from "react"
import { useLocation } from "wouter"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { TableRowSkeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/lib/supabase"
import { useAgent } from "@/context/AgentContext"
import { InlineErrorState } from "@/components/agent/InlineErrorState"
import { toast } from "@/hooks/use-toast"

type QueuePolicy = {
  id: string;
  client_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  needs_review: boolean | null;
};

function statusColor(status: string): string {
  const map: Record<string, string> = {
    queued: 'bg-blue-100 text-blue-800',
    processing: 'bg-blue-100 text-blue-800 border-blue-200',
    needs_review: 'bg-amber-100 text-amber-800 border-amber-200',
    failed: 'bg-red-100 text-red-800 border-red-200',
    done: 'bg-green-100 text-green-800 border-green-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
  };
  return map[status] ?? 'bg-slate-100 text-slate-600';
}

export default function MyQueue() {
  const [, setLocation] = useLocation();
  const [myPolicies, setMyPolicies] = useState<QueuePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"failed" | "processing" | "needs_review">("failed")
  const [polling, setPolling] = useState(false)
  const { agent } = useAgent();

  async function fetchQueue() {
    if (!agent?.agentId) return;
    setLoading(true);
    setError(null)

    try {
      const { data, error: qErr } = await supabase
        .from("policy_analyses")
        .select("id, client_name, status, needs_review, created_at, updated_at")
        .eq("agent_id", agent.agentId)
        .or("status.eq.failed,status.eq.processing,needs_review.eq.true")
        .order("updated_at", { ascending: false })

      if (qErr) throw new Error(qErr.message)
      setMyPolicies(((data as any[]) ?? []) as QueuePolicy[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    if (agent?.agentId) fetchQueue(); 
  }, [agent?.agentId]);

  const failedRows = useMemo(() => myPolicies.filter((p) => p.status === "failed"), [myPolicies])
  const processingRows = useMemo(() => myPolicies.filter((p) => p.status === "processing"), [myPolicies])
  const reviewRows = useMemo(() => myPolicies.filter((p) => p.needs_review), [myPolicies])

  async function retry(id: string) {
    try {
      const res = await fetch(`/api/analyses/${id}/retry`, { method: "POST" })
      if (!res.ok) throw new Error("Request failed")
      setMyPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, status: "processing" } : p)))
      toast({ variant: "success", title: "Requeued", description: "Requeued — check back in a moment" })
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Retry failed", description: e instanceof Error ? e.message : "Could not retry." })
    }
  }

  async function markDone(id: string) {
    if (!agent?.agentId) return
    try {
      const { error: uErr } = await supabase
        .from("policy_analyses")
        .update({ needs_review: false })
        .eq("id", id)
        .eq("agent_id", agent.agentId)
      if (uErr) throw new Error(uErr.message)
      setMyPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, needs_review: false } : p)))
      toast({ variant: "success", title: "Updated", description: "Marked done" })
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Update failed", description: e instanceof Error ? e.message : "Could not update." })
    }
  }

  // Poll processing tab every 5s
  useEffect(() => {
    if (tab !== "processing") return
    setPolling(true)
    const t = window.setInterval(() => {
      void fetchQueue()
    }, 5000)
    return () => {
      window.clearInterval(t)
      setPolling(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, agent?.agentId])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">My Queue</h1>
        <Button variant="outline" className="border-slate-200 text-slate-600" onClick={fetchQueue} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && <InlineErrorState onRetry={fetchQueue} />}

      {!error && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
          <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-6">
            <TabsTrigger value="failed" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#0D9488] data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-sm font-semibold">
              Failed ({failedRows.length})
            </TabsTrigger>
            <TabsTrigger value="processing" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#0D9488] data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-sm font-semibold">
              Processing ({processingRows.length})
            </TabsTrigger>
            <TabsTrigger value="needs_review" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#0D9488] data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-sm font-semibold">
              Needs Review ({reviewRows.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="failed" className="mt-6">
            <QueueTable
              loading={loading}
              emptyText="No failed analyses."
              rows={failedRows}
              actionLabel="Retry"
              onAction={retry}
              onRowClick={(rid) => setLocation(`/agent/policies/${rid}`)}
            />
          </TabsContent>

          <TabsContent value="processing" className="mt-6">
            <div className="text-xs text-slate-500 mb-3">{polling ? "Auto-refreshing every 5s" : ""}</div>
            <QueueTable
              loading={loading}
              emptyText="No analyses currently processing."
              rows={processingRows}
              actionLabel="View"
              onAction={(rid) => setLocation(`/agent/policies/${rid}`)}
              onRowClick={(rid) => setLocation(`/agent/policies/${rid}`)}
              showSpinner
            />
          </TabsContent>

          <TabsContent value="needs_review" className="mt-6">
            <QueueTable
              loading={loading}
              emptyText="No items marked for review."
              rows={reviewRows}
              actionLabel="Mark Done"
              onAction={markDone}
              onRowClick={(rid) => setLocation(`/agent/policies/${rid}`)}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function QueueTable({
  loading,
  rows,
  emptyText,
  actionLabel,
  onAction,
  onRowClick,
  showSpinner,
}: {
  loading: boolean
  rows: QueuePolicy[]
  emptyText: string
  actionLabel: string
  onAction: (id: string) => void
  onRowClick: (id: string) => void
  showSpinner?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr className="text-left text-slate-500 font-medium">
              <th className="p-4">Policy ID</th>
              <th className="p-4">Client</th>
              <th className="p-4">Status</th>
              <th className="p-4">Updated</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading && (
              <>
                <TableRowSkeleton columns={5} />
                <TableRowSkeleton columns={5} />
                <TableRowSkeleton columns={5} />
              </>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-slate-400 italic">
                  {emptyText}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((p) => (
                <tr
                  key={p.id}
                  className="group hover:bg-slate-50/50 transition-colors cursor-pointer"
                  onClick={() => onRowClick(p.id)}
                >
                  <td className="p-4 font-bold text-[#0D9488]">{p.id}</td>
                  <td className="p-4 text-slate-700 font-medium">{p.client_name}</td>
                  <td className="p-4">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest border ${statusColor(p.status)}`}>
                      {showSpinner && p.status === "processing" ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full border border-blue-600 border-t-transparent animate-spin" />
                          processing
                        </span>
                      ) : (
                        p.status.replace(/_/g, " ")
                      )}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400 font-medium text-[11px] uppercase tracking-tighter">
                    {new Date(p.updated_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" className="border-slate-200" onClick={() => onAction(p.id)}>
                      {actionLabel}
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
