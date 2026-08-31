import { useEffect, useMemo, useState } from "react"
import { useLocation } from "wouter"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { TableRowSkeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { rerunPolicy } from "@/lib/rerun"
import { supabase } from "@/lib/supabase"
import { useAgent } from "@/context/AgentContext"
import { InlineErrorState } from "@/components/agent/InlineErrorState"
import { toast } from "@/hooks/use-toast"

type QueuePolicy = {
  id: string;
  client_name: string;
  filename: string | null;
  error_message: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-slate-200 text-slate-800',
    processing: 'bg-blue-100 text-blue-800 border-blue-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    done: 'bg-green-100 text-green-800 border-green-200',
  };
  return map[status] ?? 'bg-slate-100 text-slate-600';
}

export default function MyQueue() {
  const [, setLocation] = useLocation();
  const [myPolicies, setMyPolicies] = useState<QueuePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"failed" | "processing">("failed")
  const [polling, setPolling] = useState(false)
  const [confirmDismissId, setConfirmDismissId] = useState<string | null>(null)
  const [dismissingId, setDismissingId] = useState<string | null>(null)
  const { agent } = useAgent();

  async function fetchQueue() {
    if (!agent?.agentId) return;
    setLoading(true);
    setError(null)

    try {
      const { data, error: qErr } = await supabase
        .from("clients")
        .select("id, name, policyholder_name, filename, status, error_message, created_at")
        .eq("agent_id", agent.agentId)
        .in("status", ["error", "processing", "pending"])
        .order("created_at", { ascending: false })

      if (qErr) throw new Error(qErr.message)

      const mappedData = (data ?? []).map(item => ({
        id: item.id,
        client_name: item.policyholder_name || item.name || item.filename || '—',
        filename: item.filename,
        error_message: item.error_message,
        status: item.status,
        created_at: item.created_at,
        updated_at: item.created_at,
      }))
      
      setMyPolicies(mappedData as QueuePolicy[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    if (agent?.agentId) fetchQueue(); 
  }, [agent?.agentId]);

  const failedRows = useMemo(() => myPolicies.filter((p) => p.status === "error"), [myPolicies])
  const processingRows = useMemo(() => myPolicies.filter((p) => p.status === "processing" || p.status === "pending"), [myPolicies])

  async function retry(id: string) {
    if (!agent?.agentId) return
    try {
      await rerunPolicy(id)
      setMyPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, status: "processing", error_message: null } : p)))
      toast({ variant: "success", title: "Re-running analysis", description: "Watch the Processing tab — it will finish or report an error." })
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Retry failed", description: e instanceof Error ? e.message : "Could not retry." })
    }
  }

  // This DELETES the policy row — it does not merely hide it from the queue.
  // The button, the confirmation and the toast must all keep saying so. An
  // earlier version said "Dismiss / Removed from queue" while running this
  // exact delete, and agents cleared their queue believing it was a notification.
  async function deletePolicy(id: string) {
    if (!agent?.agentId) return
    setDismissingId(id)
    try {
      const { error: dErr } = await supabase
        .from("clients")
        .delete()
        .eq("id", id)
        .eq("agent_id", agent.agentId)
      if (dErr) throw new Error(dErr.message)
      setMyPolicies((prev) => prev.filter((p) => p.id !== id))
      toast({ variant: "success", title: "Policy deleted", description: "The upload and its record are gone. This cannot be undone." })
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not delete", description: e instanceof Error ? e.message : undefined })
    } finally {
      setDismissingId(null)
      setConfirmDismissId(null)
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
          </TabsList>

          <TabsContent value="failed" className="mt-6">
            <QueueTable
              loading={loading}
              emptyText="No failed analyses. 🎉"
              rows={failedRows}
              actionLabel="Retry"
              onAction={retry}
              onRowClick={(rid) => setLocation(`/agent/policies/${rid}`)}
              onDismiss={deletePolicy}
              confirmDismissId={confirmDismissId}
              setConfirmDismissId={setConfirmDismissId}
              dismissingId={dismissingId}
              showError
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
              onDismiss={deletePolicy}
              confirmDismissId={confirmDismissId}
              setConfirmDismissId={setConfirmDismissId}
              dismissingId={dismissingId}
              showSpinner
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
  onDismiss,
  confirmDismissId,
  setConfirmDismissId,
  dismissingId,
  showSpinner,
  showError,
}: {
  loading: boolean
  rows: QueuePolicy[]
  emptyText: string
  actionLabel: string
  onAction: (id: string) => void
  onRowClick: (id: string) => void
  onDismiss: (id: string) => void
  confirmDismissId: string | null
  setConfirmDismissId: (id: string | null) => void
  dismissingId: string | null
  showSpinner?: boolean
  showError?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table-cards w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr className="text-left text-xs text-slate-400 uppercase tracking-wider font-semibold">
              <th className="px-5 py-3.5">File</th>
              <th className="px-5 py-3.5">Client</th>
              {showError && <th className="px-5 py-3.5">Reason</th>}
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5">Date</th>
              <th className="px-5 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading && (
              <>
                <TableRowSkeleton columns={showError ? 6 : 5} />
                <TableRowSkeleton columns={showError ? 6 : 5} />
                <TableRowSkeleton columns={showError ? 6 : 5} />
              </>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={showError ? 6 : 5} className="p-10 text-center text-slate-400 italic">
                  {emptyText}
                </td>
              </tr>
            )}
            {!loading && rows.map((p) => (
              <tr
                key={p.id}
                className="group hover:bg-slate-50/50 transition-colors cursor-pointer"
                onClick={() => onRowClick(p.id)}
              >
                <td className="px-5 py-4 font-medium text-slate-600 text-xs" data-label="File">{p.filename || '—'}</td>
                <td className="px-5 py-4 font-semibold text-slate-800" data-label="Client" data-cell="title">{p.client_name}</td>
                {showError && (
                  <td className="px-5 py-4 text-xs text-red-500 max-w-xs md:truncate" data-label="Reason">
                    {p.error_message || 'Analysis failed'}
                  </td>
                )}
                <td className="px-5 py-4" data-label="Status">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] sm:text-[10px] font-black uppercase tracking-widest border ${statusColor(p.status)}`}>
                    {showSpinner && (p.status === "processing" || p.status === "pending") ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full border border-blue-600 border-t-transparent animate-spin" />
                        {p.status}
                      </span>
                    ) : p.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-5 py-4 text-slate-400 text-xs" data-label="Date">
                  {new Date(p.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
                <td className="px-5 py-4 text-right" data-label="Action" data-cell="actions" onClick={(e) => e.stopPropagation()}>
                  <div className="inline-flex items-center gap-2 max-md:w-full">
                    <Button size="sm" variant="outline" className="border-slate-200" onClick={() => onAction(p.id)}>
                      {actionLabel}
                    </Button>
                    {confirmDismissId === p.id ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-sm text-slate-700">Delete permanently?</span>
                        <button
                          onClick={() => onDismiss(p.id)}
                          disabled={dismissingId === p.id}
                          className="text-sm font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-2 rounded transition-colors disabled:opacity-50"
                        >
                          {dismissingId === p.id ? "Deleting…" : "Delete"}
                        </button>
                        <button
                          onClick={() => setConfirmDismissId(null)}
                          className="text-sm font-bold text-slate-600 hover:text-slate-900 px-3 py-2"
                        >
                          Keep
                        </button>
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200"
                        onClick={() => setConfirmDismissId(p.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
