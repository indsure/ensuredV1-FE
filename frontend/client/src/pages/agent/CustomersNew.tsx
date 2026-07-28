import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Plus, RefreshCw, Users, X } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAgent } from "@/context/AgentContext";
import { InlineErrorState } from "@/components/agent/InlineErrorState";
import { toast } from "@/hooks/use-toast";
import { TYPE_META, type InsuranceType } from "@/lib/insuranceTypes";
import {
  buildPortfolioStats,
  createCustomer,
  fetchCustomers,
  formatAmount,
  PORTFOLIO_POLICY_COLUMNS,
  type Customer,
  type PortfolioPolicy,
} from "@/lib/customers";
import { format } from "date-fns";

type DraftState = { name: string; phone: string; email: string; city: string };
const EMPTY_DRAFT: DraftState = { name: "", phone: "", email: "", city: "" };

export default function CustomersNew() {
  const [, setLocation] = useLocation();
  const { agent } = useAgent();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [policies, setPolicies] = useState<PortfolioPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!agent?.agentId) return;
    setLoading(true);
    setError(null);
    try {
      const [custs, pols] = await Promise.all([
        fetchCustomers(agent.agentId),
        supabase
          .from("clients")
          .select(PORTFOLIO_POLICY_COLUMNS)
          .eq("agent_id", agent.agentId)
          .eq("status", "done")
          .not("customer_id", "is", null)
          .then(({ data, error: qErr }) => {
            if (qErr) throw new Error(qErr.message);
            return (data ?? []) as PortfolioPolicy[];
          }),
      ]);
      setCustomers(custs);
      setPolicies(pols);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [agent?.agentId]);

  useEffect(() => { void load(); }, [load]);

  const statsByCustomer = useMemo(() => {
    const grouped = new Map<string, PortfolioPolicy[]>();
    for (const p of policies) {
      if (!p.customer_id) continue;
      const list = grouped.get(p.customer_id) ?? [];
      list.push(p);
      grouped.set(p.customer_id, list);
    }
    const out = new Map<string, ReturnType<typeof buildPortfolioStats>>();
    grouped.forEach((list, cid) => out.set(cid, buildPortfolioStats(list)));
    return out;
  }, [policies]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.city ?? "").toLowerCase().includes(q)
    );
  }, [customers, search]);

  async function handleCreate() {
    if (!agent?.agentId) {
      toast({ variant: "destructive", title: "Still loading your account", description: "Please wait a moment and try again." });
      return;
    }
    if (!draft.name.trim()) {
      toast({ variant: "destructive", title: "Name required" });
      return;
    }
    setSaving(true);
    try {
      const created = await createCustomer(agent.agentId, draft);
      toast({ variant: "success", title: "Customer added" });
      setDraft(EMPTY_DRAFT);
      setCreateOpen(false);
      setLocation(`/agent/customers/${created.id}`);
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Could not add customer", description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">Customers</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCreateOpen(v => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-[#0D9488] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0f766e]"
          >
            {createOpen ? <X size={14} /> : <Plus size={14} />} {createOpen ? "Cancel" : "Add Customer"}
          </button>
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-sm text-[#0D9488] font-semibold hover:underline disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* CREATE FORM */}
      {createOpen && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">New customer</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Full name *" className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
            <input value={draft.phone} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))} placeholder="Phone" className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
            <input value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} placeholder="Email" className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
            <input value={draft.city} onChange={e => setDraft(d => ({ ...d, city: e.target.value }))} placeholder="City" className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !draft.name.trim()}
            className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#0D9488] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />} Save customer
          </button>
        </div>
      )}

      {error && <InlineErrorState onRetry={load} />}

      {!error && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

          {/* TOOLBAR */}
          <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-slate-50">
            <p className="text-sm text-slate-500 font-medium">{customers.length} customer{customers.length !== 1 ? "s" : ""}</p>
            <input
              type="search"
              placeholder="Search name, phone, email, city…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-64 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
            />
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/60 text-xs text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5 text-left">Customer</th>
                  <th className="px-6 py-3.5 text-left">Contact</th>
                  <th className="px-6 py-3.5 text-left">Policies</th>
                  <th className="px-6 py-3.5 text-left">Total Cover</th>
                  <th className="px-6 py-3.5 text-left">Next Premium</th>
                  <th className="px-6 py-3.5 text-left">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading && [1, 2, 3, 4].map(i => (
                  <tr key={i}>
                    {[1, 2, 3, 4, 5, 6].map(j => (
                      <td key={j} className="px-6 py-4"><div className="h-5 bg-slate-100 animate-pulse rounded-md w-3/4" /></td>
                    ))}
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                      <Users className="mx-auto mb-3 h-8 w-8 text-slate-200" />
                      {search
                        ? <span className="italic">No results for "{search}"</span>
                        : <span className="italic">No customers yet. Add one here, or tag a policy to a customer from its detail page.</span>}
                    </td>
                  </tr>
                )}
                {!loading && filtered.map(c => {
                  const stats = statsByCustomer.get(c.id);
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                      onClick={() => setLocation(`/agent/customers/${c.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{c.name}</div>
                        {c.city && <div className="text-[11px] text-slate-400 font-medium mt-0.5">{c.city}</div>}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        <div>{c.phone || "—"}</div>
                        {c.email && <div className="text-[11px] text-slate-400 mt-0.5">{c.email}</div>}
                      </td>
                      <td className="px-6 py-4">
                        {stats ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {Object.entries(stats.byType).map(([t, n]) => (
                              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-bold">
                                {TYPE_META[t as InsuranceType]?.emoji ?? "📄"} {n}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">No policies tagged</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700">{formatAmount(stats?.totalSumInsured ?? null)}</td>
                      <td className="px-6 py-4 text-slate-500">
                        {stats?.nextPremium ? format(new Date(stats.nextPremium.date), "d MMM yyyy") : "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">{format(new Date(c.created_at), "d MMM yyyy")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > 0 && (
            <div className="px-6 py-3 border-t border-slate-50 text-xs text-slate-400">
              Showing {filtered.length} of {customers.length} customers
            </div>
          )}
        </div>
      )}
    </div>
  );
}
