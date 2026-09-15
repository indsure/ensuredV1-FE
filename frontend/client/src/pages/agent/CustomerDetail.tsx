import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Calculator, ExternalLink, Loader2, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { format } from "date-fns";

import { supabase } from "@/lib/supabase";
import { useAgent } from "@/context/AgentContext";
import { InlineErrorState } from "@/components/agent/InlineErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { TYPE_META, getNextPremiumDate, typeLabel, type InsuranceType } from "@/lib/insuranceTypes";
import {
  buildPortfolioStats,
  deleteCustomer,
  fetchCustomer,
  formatAmount,
  parseAmount,
  PORTFOLIO_POLICY_COLUMNS,
  suggestCustomers,
  tagPolicyToCustomer,
  updateCustomer,
  type Customer,
  type PortfolioPolicy,
} from "@/lib/customers";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { agent } = useAgent();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [policies, setPolicies] = useState<PortfolioPolicy[]>([]);
  const [untagged, setUntagged] = useState<PortfolioPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", phone: "", email: "", city: "", notes: "" });
  const [addPolicyId, setAddPolicyId] = useState("");
  const [calcReports, setCalcReports] = useState<{ id: string; created_at: string; result_data: any }[]>([]);

  const load = useCallback(async () => {
    if (!id || !agent?.agentId) return;
    setLoading(true);
    setError(null);
    try {
      const [cust, polsRes, calcsRes] = await Promise.all([
        fetchCustomer(agent.agentId, id),
        supabase
          .from("clients")
          .select(PORTFOLIO_POLICY_COLUMNS)
          .eq("agent_id", agent.agentId)
          .eq("status", "done")
          .order("created_at", { ascending: false }),
        supabase
          .from("calculator_reports")
          .select("id, created_at, result_data")
          .eq("customer_id", id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      if (!cust) throw new Error("Customer not found.");
      if (polsRes.error) throw new Error(polsRes.error.message);
      // Calculator history is best-effort — never blocks the portfolio.
      setCalcReports(calcsRes.error ? [] : (calcsRes.data ?? []));

      const all = (polsRes.data ?? []) as PortfolioPolicy[];
      setCustomer(cust);
      setPolicies(all.filter(p => p.customer_id === id));
      setUntagged(all.filter(p => !p.customer_id));
      setDraft({
        name: cust.name,
        phone: cust.phone ?? "",
        email: cust.email ?? "",
        city: cust.city ?? "",
        notes: cust.notes ?? "",
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [id, agent?.agentId]);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => buildPortfolioStats(policies), [policies]);

  /** Actual health cover (the calculator's recommendation is health-only). */
  const healthCover = useMemo(
    () =>
      policies
        .filter(p => (p.insurance_type || "health") === "health")
        .reduce((sum, p) => sum + (parseAmount(p.sum_insured) ?? 0), 0),
    [policies]
  );

  const latestCalc = calcReports[0] ?? null;
  const recommendedCover: number | null =
    typeof latestCalc?.result_data?.coverageBreakdown?.finalOptimal === "number"
      ? latestCalc.result_data.coverageBreakdown.finalOptimal
      : null;
  const coverGap = recommendedCover != null ? recommendedCover - healthCover : null;

  /** Untagged policies whose holder details look like this customer — likely candidates. */
  const suggestedPolicyIds = useMemo(() => {
    if (!customer) return new Set<string>();
    const ids = new Set<string>();
    for (const p of untagged) {
      const match = suggestCustomers([customer], { name: p.policyholder_name || p.name }, 1);
      if (match.length > 0) ids.add(p.id);
    }
    return ids;
  }, [customer, untagged]);

  const sortedUntagged = useMemo(
    () => [...untagged].sort((a, b) => Number(suggestedPolicyIds.has(b.id)) - Number(suggestedPolicyIds.has(a.id))),
    [untagged, suggestedPolicyIds]
  );

  async function saveDetails() {
    if (!customer) return;
    if (!draft.name.trim()) {
      toast({ variant: "destructive", title: "Name required" });
      return;
    }
    setBusy("edit");
    try {
      await updateCustomer(customer.id, draft);
      setEditOpen(false);
      await load();
      toast({ variant: "success", title: "Customer updated" });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Update failed", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  async function removeCustomer() {
    if (!customer) return;
    setBusy("delete");
    try {
      await deleteCustomer(customer.id);
      toast({ variant: "success", title: "Customer deleted", description: "Their policies were kept and are now untagged." });
      setLocation("/agent/customers");
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Delete failed", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  async function tagPolicy(policyId: string) {
    if (!customer || !policyId) return;
    setBusy(`tag-${policyId}`);
    try {
      await tagPolicyToCustomer(policyId, customer.id);
      setAddPolicyId("");
      await load();
      toast({ variant: "success", title: "Policy tagged" });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Tag failed", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  async function untagPolicy(policyId: string) {
    setBusy(`untag-${policyId}`);
    try {
      await tagPolicyToCustomer(policyId, null);
      await load();
      toast({ variant: "success", title: "Policy untagged" });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Untag failed", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  if (error) return <InlineErrorState onRetry={load} />;

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="text-slate-600" onClick={() => setLocation("/agent/customers")}>
          Back to customers
        </Button>
        <Button variant="outline" size="sm" className="border-slate-200 bg-white" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading && <Card className="border-slate-100 shadow-sm"><CardContent className="p-10 text-center text-slate-400">Loading customer…</CardContent></Card>}

      {!loading && customer && (
        <>
          {/* HEADER CARD */}
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="font-['Playfair_Display'] text-3xl sm:text-4xl font-bold text-slate-900">{customer.name}</h1>
                  <p className="mt-2 text-sm text-slate-500">
                    {[customer.phone, customer.email, customer.city].filter(Boolean).join(" · ") || "No contact details yet"}
                  </p>
                  {customer.notes && <p className="mt-2 text-sm text-slate-400 italic">{customer.notes}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="bg-[#0D9488] hover:bg-[#0f766e]"
                    onClick={() => setLocation(`/agent/calculator?customer=${customer.id}`)}
                  >
                    <Calculator className="mr-2 h-3.5 w-3.5" /> Calculate Cover Need
                  </Button>
                  <Button variant="outline" size="sm" className="border-slate-200 bg-white" onClick={() => setEditOpen(v => !v)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="destructive" size="sm" className="bg-red-500 text-white hover:bg-red-600" onClick={() => setDeleteOpen(true)} disabled={busy === "delete"}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </div>

              {editOpen && (
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Full name *" />
                  <Input value={draft.phone} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))} placeholder="Phone" />
                  <Input value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} placeholder="Email" />
                  <Input value={draft.city} onChange={e => setDraft(d => ({ ...d, city: e.target.value }))} placeholder="City" />
                  <Input value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} placeholder="Notes" className="lg:col-span-2" />
                  <div className="flex gap-3 sm:col-span-2 lg:col-span-3">
                    <Button className="bg-[#0D9488] hover:bg-[#0f766e]" onClick={saveDetails} disabled={busy === "edit"}>
                      {busy === "edit" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
                    </Button>
                    <Button variant="outline" className="border-slate-200 bg-white" onClick={() => setEditOpen(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AGGREGATE STATS */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Policies</p>
              <p className="text-3xl font-extrabold text-slate-800">{stats.policyCount}</p>
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                {Object.entries(stats.byType).map(([t, n]) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-xs font-bold">
                    {TYPE_META[t as InsuranceType]?.emoji ?? "📄"} {typeLabel(t)} × {n}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Cover</p>
              <p className="text-3xl font-extrabold text-slate-800">{formatAmount(stats.totalSumInsured)}</p>
              {stats.totalPremium != null && (
                <p className="mt-2 text-[11px] text-slate-400 font-medium">Premium (as extracted): {formatAmount(stats.totalPremium)}</p>
              )}
            </div>
            <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-5 border-l-4 border-l-amber-400">
              <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Next Premium</p>
              <p className="text-2xl font-extrabold text-amber-600">
                {stats.nextPremium ? format(new Date(stats.nextPremium.date), "d MMM yyyy") : "—"}
              </p>
              {stats.nextPremium && (
                <button
                  className="mt-1 text-[11px] text-amber-500 font-semibold hover:underline"
                  onClick={() => setLocation(`/agent/policies/${stats.nextPremium!.policyId}`)}
                >
                  View policy →
                </button>
              )}
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Health Score</p>
              <p className={`text-3xl font-extrabold ${stats.worstHealthScore == null ? "text-slate-300" : stats.worstHealthScore >= 70 ? "text-emerald-600" : "text-red-500"}`}>
                {stats.worstHealthScore ?? "—"}
              </p>
              {stats.worstHealthScore != null && stats.worstHealthScore < 70 && (
                <p className="mt-1 text-[11px] text-red-400 font-semibold">Should switch</p>
              )}
            </div>
          </div>

          {/* COVER NEED (CALCULATOR) */}
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-6">
              {recommendedCover != null ? (
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-6">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Recommended Health Cover</p>
                      <p className="text-2xl font-extrabold text-slate-800">{formatAmount(recommendedCover)}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Calculated {format(new Date(latestCalc!.created_at), "d MMM yyyy")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Current Health Cover</p>
                      <p className="text-2xl font-extrabold text-slate-800">{formatAmount(healthCover)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Cover Gap</p>
                      {coverGap != null && coverGap > 0 ? (
                        <p className="text-2xl font-extrabold text-red-500">{formatAmount(coverGap)} short</p>
                      ) : (
                        <p className="text-2xl font-extrabold text-emerald-600">✓ Covered</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {calcReports.map((c, i) => (
                      <a
                        key={c.id}
                        href={`/calculator/report/${c.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 hover:border-[#0D9488] hover:text-[#0D9488]"
                        title="Open shareable report"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {i === 0 ? "Latest report" : format(new Date(c.created_at), "d MMM")}
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Calculator className="h-5 w-5 text-slate-300" />
                    <p className="text-sm text-slate-500">
                      No cover-need calculation yet — run one to see {customer.name.split(" ")[0]}'s coverage gap here.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#0D9488]/30 text-[#0D9488] bg-white hover:bg-teal-50"
                    onClick={() => setLocation(`/agent/calculator?customer=${customer.id}`)}
                  >
                    Calculate now
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* POLICIES TABLE */}
          <Card className="border-slate-100 shadow-sm overflow-hidden">
            <CardHeader><CardTitle>Portfolio</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="table-cards w-full text-sm">
                  <thead className="bg-slate-50/60 text-xs text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3.5 text-left">Policy</th>
                      <th className="px-6 py-3.5 text-left">Type</th>
                      <th className="px-6 py-3.5 text-left">Insurer</th>
                      <th className="px-6 py-3.5 text-left">Cover</th>
                      <th className="px-6 py-3.5 text-left">Next Premium</th>
                      <th className="px-6 py-3.5 text-left">Score</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {policies.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                          No policies tagged yet — add one below.
                        </td>
                      </tr>
                    )}
                    {policies.map(p => {
                      const type = (p.insurance_type || "health") as InsuranceType;
                      const np = getNextPremiumDate(p.expiry_date, p.extracted_data);
                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                          onClick={() => setLocation(`/agent/policies/${p.id}`)}
                        >
                          <td className="px-6 py-4" data-label="Policy" data-cell="title">
                            <div className="font-semibold text-slate-800">{p.policy_name || p.policy_identifier || p.policyholder_name || p.name || "—"}</div>
                            {p.policy_identifier && p.policy_name && (
                              <div className="text-[11px] text-slate-400 font-medium mt-0.5">{p.policy_identifier}</div>
                            )}
                          </td>
                          <td className="px-6 py-4" data-label="Type">
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider">
                              {TYPE_META[type]?.emoji} {typeLabel(type)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500" data-label="Insurer">{p.insurer || "—"}</td>
                          <td className="px-6 py-4 font-semibold text-slate-700" data-label="Cover">{formatAmount(parseAmount(p.sum_insured))}</td>
                          <td className="px-6 py-4 text-slate-500" data-label="Next Premium">{np ? format(new Date(np), "d MMM yyyy") : "—"}</td>
                          <td className="px-6 py-4" data-label="Score">
                            {type === "health" && p.score != null
                              ? <span className={`font-black ${p.score >= 70 ? "text-emerald-600" : "text-red-500"}`}>{p.score}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-6 py-4 text-right" data-label="Actions" data-cell="actions" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => window.open(`/agent/policies/${p.id}`, "_blank")}
                                className="p-1.5 rounded text-slate-400 hover:text-[#0D9488] hover:bg-teal-50 transition-colors"
                                title="Open policy"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => untagPolicy(p.id)}
                                disabled={busy === `untag-${p.id}`}
                                className="p-1.5 rounded text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-50"
                                title="Untag from customer"
                              >
                                {busy === `untag-${p.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ADD POLICY */}
              <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-t border-slate-50 bg-slate-50/40">
                <select
                  value={addPolicyId}
                  onChange={e => setAddPolicyId(e.target.value)}
                  className="flex-1 min-w-[240px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
                >
                  <option value="">
                    {untagged.length === 0 ? "No untagged policies available" : "Tag an existing policy to this customer…"}
                  </option>
                  {sortedUntagged.map(p => (
                    <option key={p.id} value={p.id}>
                      {suggestedPolicyIds.has(p.id) ? "★ " : ""}
                      {(p.policyholder_name || p.name || "Unnamed")} — {p.insurer || "Unknown insurer"} ({typeLabel(p.insurance_type)})
                    </option>
                  ))}
                </select>
                <Button
                  className="bg-[#0D9488] hover:bg-[#0f766e]"
                  onClick={() => tagPolicy(addPolicyId)}
                  disabled={!addPolicyId || busy?.startsWith("tag-")}
                >
                  {busy?.startsWith("tag-") ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Tag policy
                </Button>
                {suggestedPolicyIds.size > 0 && (
                  <p className="w-full text-[11px] text-slate-400">★ = policyholder name matches this customer</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => void removeCustomer()}
        title="Delete this customer?"
        description="The customer record is removed. Their policies are NOT deleted — they just become untagged."
        confirmText={busy === "delete" ? "Deleting…" : "Delete customer"}
        variant="destructive"
      />
    </div>
  );
}
