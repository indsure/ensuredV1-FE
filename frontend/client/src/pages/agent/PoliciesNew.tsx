import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { useLocation } from "wouter"
import { Info, RefreshCw, ExternalLink, Download, Loader2, Trash2, FileSpreadsheet, Sparkles } from "lucide-react"
import React from "react"
import { formatDistanceToNow, format } from "date-fns"
import { supabase } from "@/lib/supabase"
import { getApiBase } from "@/lib/queryClient"
import { useAgent } from "@/context/AgentContext"
import { InlineErrorState } from "@/components/agent/InlineErrorState"
import { ShareLinkPopover } from "@/components/agent/ShareLinkPopover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { TYPE_META, typeLabel, isDataEntryType, getNextPremiumDate, type InsuranceType } from "@/lib/insuranceTypes"
import { exportPoliciesToExcel } from "@/lib/exportPolicies"
import { fetchCustomers, type Customer } from "@/lib/customers"
import { DraftMessageDialog } from "@/components/agent/DraftMessageDialog"
import type { DraftTarget } from "@/lib/draftMessage"

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
  insurance_type: string | null;
  extracted_data: any | null;
  customer_id: string | null;
  client_phone: string | null;
};

function getDays(expiry_date: string | null): number | null {
  if (!expiry_date) return null;
  return Math.ceil((new Date(expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function NextPremiumBadge({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) return <span className="text-slate-400 text-sm">—</span>;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return <span className="text-slate-400 text-sm">—</span>;
  const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const dateLabel = format(d, "d MMM yyyy");
  const sub =
    days < 0 ? { text: "overdue", cls: "text-red-400" }
    : days <= 60 ? { text: `in ${days}d`, cls: days <= 15 ? "text-red-400" : days <= 30 ? "text-amber-500" : "text-slate-400" }
    : null;
  const dateCls = days < 0 || days <= 15 ? "text-red-600" : days <= 30 ? "text-amber-600" : "text-slate-700";
  return (
    <div className="flex flex-col leading-tight">
      <span className={`text-sm font-semibold ${dateCls}`}>{dateLabel}</span>
      {sub && <span className={`text-[11px] ${sub.cls}`}>{sub.text}</span>}
    </div>
  );
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
  const [typeFilter, setTypeFilter] = useState<"all" | InsuranceType>("all");
  const [sort, setSort] = useState<SortKey>("expiry");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [draftTarget, setDraftTarget] = useState<DraftTarget | null>(null);
  const [customersById, setCustomersById] = useState<Map<string, Customer>>(new Map());
  const shareBaseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const { agent } = useAgent();

  const fetchPolicies = useCallback(async () => {
    if (!agent?.agentId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("clients")
        .select("id, name, policyholder_name, insurer, score, expiry_date, share_token, share_enabled, report_data, created_at, views, policy_identifier, policy_name, filename, pdf_url, insurance_type, extracted_data, customer_id, client_phone")
        .eq("agent_id", agent.agentId)
        .eq("status", "done")
        .order("created_at", { ascending: false });
      if (qErr) throw new Error(qErr.message);
      setRows(data ?? []);
      // Customer names for the tag chips — non-fatal if it fails.
      try {
        const customers = await fetchCustomers(agent.agentId);
        setCustomersById(new Map(customers.map(c => [c.id, c])));
      } catch { /* chips just won't render */ }
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
      // The endpoint streams the file itself — no storage URL ever reaches the
      // browser — so save the blob client-side.
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = row.filename || "policy.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Could not download PDF.");
    } finally {
      setDownloadingId(null);
    }
  }

  // Stats
  const stats = useMemo(() => {
    const expiringSoon = rows.filter(r => { const d = getDays(r.expiry_date); return d !== null && d >= 0 && d <= 30; }).length;
    const shouldSwitch = rows.filter(r => r.score !== null && r.score < 70).length;
    const healthy = rows.filter(r => r.score !== null && r.score >= 70).length;
    return { total: rows.length, expiringSoon, shouldSwitch, healthy };
  }, [rows]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = rows.filter(r =>
      (r.policyholder_name || r.name || "").toLowerCase().includes(q) ||
      (r.insurer || "").toLowerCase().includes(q) ||
      (r.policy_identifier || "").toLowerCase().includes(q)
    );
    if (typeFilter !== "all") list = list.filter(r => (r.insurance_type || "health") === typeFilter);
    if (tab === "expiring") list = list.filter(r => { const d = getDays(r.expiry_date); return d !== null && d >= 0 && d <= 30; });
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
  }, [rows, search, tab, sort, typeFilter]);

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: rows.length },
    { key: "expiring", label: "Expiring Soon", count: stats.expiringSoon },
    { key: "switch", label: "Should Switch", count: stats.shouldSwitch },
    { key: "healthy", label: "Healthy", count: stats.healthy },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">My Policies</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => exportPoliciesToExcel(filtered, typeFilter)}
            disabled={loading || filtered.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:border-[#0D9488] hover:text-[#0D9488] disabled:opacity-50"
          >
            <FileSpreadsheet size={14} /> Export to Excel
          </button>
          <button onClick={fetchPolicies} disabled={loading} className="flex items-center gap-1.5 text-sm text-[#0D9488] font-semibold hover:underline disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
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

          {/* TYPE FILTER */}
          <div className="flex flex-wrap items-center gap-2 px-6 pt-5">
            {(["all", ...(Object.keys(TYPE_META) as InsuranceType[])] as ("all" | InsuranceType)[]).map(tk => {
              const active = typeFilter === tk;
              const label = tk === "all" ? "All types" : `${TYPE_META[tk].emoji} ${TYPE_META[tk].label}`;
              return (
                <button
                  key={tk}
                  onClick={() => setTypeFilter(tk)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
                    active
                      ? "border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488]"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* TOOLBAR */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 pt-4 pb-4 border-b border-slate-50">
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
                  <th className="px-6 py-3.5 text-left">Type</th>
                  <th className="px-6 py-3.5 text-left">Insured With</th>
                  <th className="px-6 py-3.5 text-left">Next Premium</th>
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
                        {[1,2,3,4,5,6,7,8].map(j => (
                          <td key={j} className="px-6 py-4"><div className="h-5 bg-slate-100 animate-pulse rounded-md w-3/4" /></td>
                        ))}
                      </tr>
                    ))}
                  </>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center text-slate-400 italic">
                      {search ? `No results for "${search}"` : "No policies in this category."}
                    </td>
                  </tr>
                )}
                {!loading && filtered.map(p => {
                  const npDate = getNextPremiumDate(p.expiry_date, p.extracted_data);
                  const shouldSwitch = p.score !== null && p.score < 70;
                  const shareUrl = p.share_token ? `${shareBaseUrl}/shared/report/${p.share_token}` : null;
                  const views = p.views ?? 0;
                  const isHealth = (p.insurance_type || "health") === "health";

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
                        {p.customer_id && customersById.has(p.customer_id) && (
                          <button
                            onClick={e => { e.stopPropagation(); setLocation(`/agent/customers/${p.customer_id}`); }}
                            className="mt-1 inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700 hover:bg-teal-100 transition-colors"
                          >
                            👤 {customersById.get(p.customer_id)!.name}
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          {TYPE_META[(p.insurance_type || "health") as InsuranceType]?.emoji} {typeLabel(p.insurance_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{p.insurer || "—"}</td>
                      <td className="px-6 py-4"><NextPremiumBadge dateStr={npDate} /></td>
                      <td className="px-6 py-4">{isHealth ? <ScoreBadge score={p.score} /> : <span className="text-slate-300 text-sm">—</span>}</td>
                      <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                        {isHealth ? <SwitchCell shouldSwitch={shouldSwitch} reportData={p.report_data} /> : <span className="text-slate-300 text-sm">—</span>}
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

                          {/* Draft AI WhatsApp message */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => {
                                    const rd = typeof p.report_data === "string"
                                      ? (() => { try { return JSON.parse(p.report_data); } catch { return null; } })()
                                      : p.report_data;
                                    const weak = rd?.final_verdict?.key_failure_points?.[0] ?? null;
                                    setDraftTarget({
                                      type: "client",
                                      id: p.id,
                                      name: p.policyholder_name || p.name,
                                      phone: p.client_phone,
                                      insurer: p.insurer,
                                      renewalDate: npDate,
                                      weakPoint: weak,
                                    });
                                  }}
                                  className="p-1.5 rounded text-slate-400 hover:text-[#0D9488] hover:bg-teal-50 transition-colors"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Draft WhatsApp message</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

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

      <DraftMessageDialog
        target={draftTarget}
        open={!!draftTarget}
        onClose={() => setDraftTarget(null)}
      />
    </div>
  );
}
