import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { useLocation } from "wouter"
import { Info, RefreshCw, ExternalLink, Download, Loader2, Trash2 } from "lucide-react"
import React from "react"
import { formatDistanceToNow } from "date-fns"
import { supabase } from "@/lib/supabase"
import { getApiBase } from "@/lib/queryClient"
import { useAgent } from "@/context/AgentContext"
import { InlineErrorState } from "@/components/agent/InlineErrorState"
import { ShareLinkPopover } from "@/components/agent/ShareLinkPopover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type ClientRow = {
  id: string;
  name: string | null;
  policyholder_name: string | null;
  insurer: string | null;
  score: number | null;
  expiry_date: string | null;
  share_token: string | null;
  share_enabled: boolean | null;
  report_data: any | null;
  created_at: string;
  views: number | null;
  policy_identifier: string | null;
  policy_name: string | null;
  filename: string | null;
  pdf_url: string | null;
};

function getDays(expiry_date: string | null): number | null {
  if (!expiry_date) return null;
  return Math.ceil((new Date(expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function ExpiryBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-slate-400 text-sm">—</span>;
  if (days <= 0) return <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-red-500 px-2.5 py-1 rounded-full">Expired</span>;
  if (days <= 15) return <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">⚠ {days}d left</span>;
  if (days <= 30) return <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">⏰ {days}d left</span>;
  return <span className="text-sm text-slate-500">{days} days</span>;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-400 text-sm">—</span>;
  const cls = score >= 80
    ? "bg-green-100 text-green-700 border-green-200"
    : score >= 60
    ? "bg-amber-100 text-amber-700 border-amber-200"
    : "bg-red-100 text-red-700 border-red-200";
  return (
    <span className={`inline-flex items-center justify-center w-11 h-8 rounded-lg text-sm font-black border ${cls}`}>
      {score}
    </span>
  );
}

function SwitchCell({ shouldSwitch, reportData: rawData }: { shouldSwitch: boolean; reportData: any }) {
  const reportData = typeof rawData === 'string' ? (() => { try { return JSON.parse(rawData); } catch { return null; } })() : rawData;
  const failures: string[] = reportData?.final_verdict?.key_failure_points ?? [];
  const criticals: { action: string; reason: string }[] = reportData?.recommendations?.critical_actions ?? [];
  const portRec: string = reportData?.recommendations?.should_port_to_better_policy?.recommendation ?? '';
  const portReason: string = reportData?.recommendations?.should_port_to_better_policy?.reason ?? '';
  const hasPainpoints = failures.length > 0 || criticals.length > 0;
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);

  function handleEnter() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left });
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      {shouldSwitch
        ? <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">↙ Switch</span>
        : <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">✓ Keep</span>
      }
      {hasPainpoints && (
        <>
          <button
            ref={btnRef}
            onMouseEnter={handleEnter}
            onMouseLeave={() => setPos(null)}
            className="text-slate-300 hover:text-slate-500 transition-colors"
          >
            <Info size={13} />
          </button>
          {pos && (
            <div
              onMouseLeave={() => setPos(null)}
              style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
              className="w-80 rounded-xl border border-slate-100 bg-white shadow-2xl p-4 text-left"
            >
              {failures.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Painpoints</p>
                  <ul className="space-y-1.5">
                    {failures.slice(0, 3).map((f, i) => (
                      <li key={i} className="text-xs text-slate-700 flex gap-2"><span className="text-red-400 shrink-0 mt-0.5">•</span>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {criticals.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-orange-400 mb-2">Critical Actions</p>
                  <ul className="space-y-1.5">
                    {criticals.slice(0, 2).map((c, i) => (
                      <li key={i} className="text-xs text-slate-700 flex gap-2"><span className="text-orange-400 shrink-0 mt-0.5">⚡</span>{c.action}</li>
                    ))}
                  </ul>
                </div>
              )}
              {portRec && (
                <div className="pt-2.5 border-t border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                    Port? <span className={portRec === 'yes' ? 'text-red-500' : portRec === 'consider' ? 'text-amber-500' : 'text-green-500'}>{portRec.toUpperCase()}</span>
                  </p>
                  {portReason && <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{portReason}</p>}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

type FilterTab = "all" | "expiring" | "switch" | "healthy";
type SortKey = "expiry" | "score" | "name";

export default function PoliciesNew() {
  const [, setLocation] = useLocation();
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [sort, setSort] = useState<SortKey>("expiry");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const shareBaseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const { agent } = useAgent();

  const fetchPolicies = useCallback(async () => {
    if (!agent?.agentId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("clients")
        .select("id, name, policyholder_name, insurer, score, expiry_date, share_token, share_enabled, report_data, created_at, views, policy_identifier, policy_name, filename, pdf_url")
        .eq("agent_id", agent.agentId)
        .eq("status", "done")
        .order("created_at", { ascending: false });
      if (qErr) throw new Error(qErr.message);
      setRows(data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [agent?.agentId]);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await supabase.from("reports").delete().eq("policy_id", id);
      await supabase.from("policy_files").delete().eq("policy_id", id);
      await supabase.from("clients").delete().eq("id", id);
      setRows(prev => prev.filter(r => r.id !== id));
    } catch {
      alert("Delete failed. Please try again.");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  async function handleDownload(row: ClientRow) {
    setDownloadingId(row.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const res = await fetch(`${getApiBase()}/api/agent/clients/${row.id}/download-pdf`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Download failed");
      }
      const { url, filename } = await res.json();
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Could not download PDF.");
    } finally {
      setDownloadingId(null);
    }
  }

  // Stats
  const stats = useMemo(() => {
    const expiringSoon = rows.filter(r => { const d = getDays(r.expiry_date); return d !== null && d <= 30; }).length;
    const shouldSwitch = rows.filter(r => r.score !== null && r.score < 70).length;
    return { total: rows.length, expiringSoon, shouldSwitch };
  }, [rows]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = rows.filter(r =>
      (r.policyholder_name || r.name || "").toLowerCase().includes(q) ||
      (r.insurer || "").toLowerCase().includes(q) ||
      (r.policy_identifier || "").toLowerCase().includes(q)
    );
    if (tab === "expiring") list = list.filter(r => { const d = getDays(r.expiry_date); return d !== null && d <= 30; });
    if (tab === "switch") list = list.filter(r => r.score !== null && r.score < 70);
    if (tab === "healthy") list = list.filter(r => r.score !== null && r.score >= 70);

    return [...list].sort((a, b) => {
      if (sort === "expiry") {
        const da = getDays(a.expiry_date) ?? 99999;
        const db = getDays(b.expiry_date) ?? 99999;
        return da - db;
      }
      if (sort === "score") return (a.score ?? 999) - (b.score ?? 999);
      return (a.policyholder_name || a.name || "").localeCompare(b.policyholder_name || b.name || "");
    });
  }, [rows, search, tab, sort]);

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: rows.length },
    { key: "expiring", label: "Expiring Soon", count: stats.expiringSoon },
    { key: "switch", label: "Should Switch", count: stats.shouldSwitch },
    { key: "healthy", label: "Healthy", count: rows.length - stats.shouldSwitch },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">My Policies</h1>
        <button onClick={fetchPolicies} disabled={loading} className="flex items-center gap-1.5 text-sm text-[#0D9488] font-semibold hover:underline disabled:opacity-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* STAT STRIP */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Analysed</p>
            <p className="text-3xl font-extrabold text-slate-800">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-5 border-l-4 border-l-amber-400">
            <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Expiring in 30 days</p>
            <p className="text-3xl font-extrabold text-amber-600">{stats.expiringSoon}</p>
          </div>
          <div className="bg-white rounded-xl border border-red-100 shadow-sm p-5 border-l-4 border-l-red-400">
            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Should Switch</p>
            <p className="text-3xl font-extrabold text-red-500">{stats.shouldSwitch}</p>
          </div>
        </div>
      )}

      {error && <InlineErrorState onRetry={fetchPolicies} />}

      {!error && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

          {/* TOOLBAR */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-slate-50">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${tab === t.key ? "bg-slate-100 text-slate-600" : "text-slate-400"}`}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="search"
                placeholder="Search client, insurer, policy ID…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 sm:w-56 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
              />
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortKey)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
              >
                <option value="expiry">Expiring Soon</option>
                <option value="score">Lowest Score</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/60 text-xs text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5 text-left">Customer</th>
                  <th className="px-6 py-3.5 text-left">Insured With</th>
                  <th className="px-6 py-3.5 text-left">Expiry</th>
                  <th className="px-6 py-3.5 text-left">Score</th>
                  <th className="px-6 py-3.5 text-left">Recommendation</th>
                  <th className="px-6 py-3.5 text-left">Views</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading && (
                  <>
                    {[1,2,3,4,5].map(i => (
                      <tr key={i}>
                        {[1,2,3,4,5,6,7].map(j => (
                          <td key={j} className="px-6 py-4"><div className="h-5 bg-slate-100 animate-pulse rounded-md w-3/4" /></td>
                        ))}
                      </tr>
                    ))}
                  </>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-slate-400 italic">
                      {search ? `No results for "${search}"` : "No policies in this category."}
                    </td>
                  </tr>
                )}
                {!loading && filtered.map(p => {
                  const days = getDays(p.expiry_date);
                  const shouldSwitch = p.score !== null && p.score < 70;
                  const shareUrl = p.share_token ? `${shareBaseUrl}/shared/report/${p.share_token}` : null;
                  const views = p.views ?? 0;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer group"
                      onClick={() => setLocation(`/agent/policies/${p.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{p.policyholder_name || p.name || "—"}</div>
                        {(p.policy_identifier || p.policy_name) && (
                          <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                            {p.policy_identifier || p.policy_name}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500">{p.insurer || "—"}</td>
                      <td className="px-6 py-4"><ExpiryBadge days={days} /></td>
                      <td className="px-6 py-4"><ScoreBadge score={p.score} /></td>
                      <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                        <SwitchCell shouldSwitch={shouldSwitch} reportData={p.report_data} />
                      </td>
                      <td className="px-6 py-4">
                        {views === 0 ? (
                          <span className="text-xs text-slate-400">Not viewed</span>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center rounded-full bg-teal-50 text-teal-700 border border-teal-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest cursor-default">
                                  {views} views
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                Shared report viewed {views} time{views !== 1 ? "s" : ""}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </td>
                      <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">

                          {/* Open detail */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => window.open(`/agent/policies/${p.id}`, "_blank")}
                                  className="p-1.5 rounded text-slate-400 hover:text-[#0D9488] hover:bg-teal-50 transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Open report</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Download PDF */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleDownload(p)}
                                  disabled={!p.pdf_url || downloadingId === p.id}
                                  className="p-1.5 rounded text-slate-400 hover:text-[#0D9488] hover:bg-teal-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  {downloadingId === p.id
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Download className="w-3.5 h-3.5" />
                                  }
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>{p.pdf_url ? "Download original PDF" : "No PDF stored"}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Share */}
                          <ShareLinkPopover
                            shareUrl={shareUrl}
                            shareEnabled={p.share_enabled ?? true}
                            disabled={!shareUrl}
                            onDisable={async () => {
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session) return;
                              const res = await fetch(`${getApiBase()}/api/agent/clients/${p.id}/share/toggle`, {
                                method: "POST",
                                headers: {
                                  Authorization: `Bearer ${session.access_token}`,
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ enabled: false }),
                              });
                              if (!res.ok) throw new Error("Request failed");
                              setRows(prev => prev.map(x => x.id === p.id ? { ...x, share_enabled: false } : x));
                            }}
                          />

                          {/* Delete */}
                          {confirmId === p.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(p.id)}
                                disabled={deletingId === p.id}
                                className="text-[10px] font-black uppercase tracking-wider text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded transition-colors disabled:opacity-50"
                              >
                                {deletingId === p.id ? "…" : "Delete"}
                              </button>
                              <button
                                onClick={() => setConfirmId(null)}
                                className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 px-1.5 py-1 rounded"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmId(p.id)}
                              className="p-1.5 rounded text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > 0 && (
            <div className="px-6 py-3 border-t border-slate-50 text-xs text-slate-400">
              Showing {filtered.length} of {rows.length} policies
            </div>
          )}
        </div>
      )}
    </div>
  );
}
