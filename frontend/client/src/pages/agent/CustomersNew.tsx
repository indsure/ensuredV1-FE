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
import { useIsMobile } from "@/hooks/use-mobile";
import { useLanguage } from "@/i18n/LanguageContext";
import { dateLocale } from "@/i18n";
import { CustomersMobileList } from "@/components/agent/CustomersMobileList";

type DraftState = { name: string; phone: string; email: string; city: string };
const EMPTY_DRAFT: DraftState = { name: "", phone: "", email: "", city: "" };

export default function CustomersNew() {
  const [, setLocation] = useLocation();
  const { agent } = useAgent();
  const { t, locale } = useLanguage();
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
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
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

  // Phones get a scannable list instead of the six-column table.
  const isMobile = useIsMobile();

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
      toast({ variant: "destructive", title: t("customers.still_loading"), description: t("customers.still_loading_desc") });
      return;
    }
    if (!draft.name.trim()) {
      toast({ variant: "destructive", title: t("customers.name_required") });
      return;
    }
    setSaving(true);
    try {
      const created = await createCustomer(agent.agentId, draft);
      toast({ variant: "success", title: t("customers.added") });
      setDraft(EMPTY_DRAFT);
      setCreateOpen(false);
      setLocation(`/agent/customers/${created.id}`);
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("customers.add_failed"), description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">{t("customers.title")}</h1>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <button
            onClick={() => setCreateOpen(v => !v)}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-[#0D9488] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#0f766e]"
          >
            {createOpen ? <X size={14} /> : <Plus size={14} />} {createOpen ? t("common.cancel") : t("customers.add")}
          </button>
          <button onClick={load} disabled={loading} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm text-[#0D9488] font-semibold hover:underline disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {t("common.refresh")}
          </button>
        </div>
      </div>

      {/* CREATE FORM */}
      {createOpen && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">{t("customers.new_customer")}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder={t("customers.ph_name")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
            <input value={draft.phone} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))} placeholder={t("customers.ph_phone")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
            <input value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} placeholder={t("customers.ph_email")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
            <input value={draft.city} onChange={e => setDraft(d => ({ ...d, city: e.target.value }))} placeholder={t("customers.ph_city")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30" />
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !draft.name.trim()}
            className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#0D9488] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />} {t("customers.save")}
          </button>
        </div>
      )}

      {error && <InlineErrorState onRetry={load} />}

      {!error && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

          {/* TOOLBAR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-slate-50">
            <p className="text-sm text-slate-500 font-medium">{t(customers.length === 1 ? "customers.count_one" : "customers.count_many", { count: customers.length })}</p>
            <input
              type="search"
              placeholder={t("customers.search_placeholder")}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="min-w-0 w-full sm:w-64 rounded-lg border border-slate-200 px-3 py-2 sm:py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
            />
          </div>

          {/* TABLE (md and up) / LIST (phones) */}
          {isMobile ? (
            <div className="p-3">
              <CustomersMobileList
                customers={filtered}
                statsFor={(id) => statsByCustomer.get(id)}
                formatAmount={formatAmount}
                loading={loading}
                emptyText={search ? t("common.no_results_for", { query: search }) : t("customers.empty")}
                onOpen={(id) => setLocation(`/agent/customers/${id}`)}
              />
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="table-cards w-full text-sm">
              <thead className="bg-slate-50/60 text-xs text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5 text-left">{t("customers.col_customer")}</th>
                  <th className="px-6 py-3.5 text-left">{t("customers.col_contact")}</th>
                  <th className="px-6 py-3.5 text-left">{t("customers.col_policies")}</th>
                  <th className="px-6 py-3.5 text-left">{t("customers.col_total_cover")}</th>
                  <th className="px-6 py-3.5 text-left">{t("customers.col_next_premium")}</th>
                  <th className="px-6 py-3.5 text-left">{t("customers.col_added")}</th>
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
                        ? <span className="italic">{t("common.no_results_for", { query: search })}</span>
                        : <span className="italic">{t("customers.empty")}</span>}
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
                      <td className="px-6 py-4" data-label={t("customers.col_customer")} data-cell="title">
                        <div className="font-semibold text-slate-800">{c.name}</div>
                        {c.city && <div className="text-[11px] text-slate-400 font-medium mt-0.5">{c.city}</div>}
                      </td>
                      <td className="px-6 py-4 text-slate-500" data-label={t("customers.col_contact")}>
                        <div>{c.phone || "—"}</div>
                        {c.email && <div className="text-[11px] text-slate-400 mt-0.5">{c.email}</div>}
                      </td>
                      <td className="px-6 py-4" data-label={t("customers.col_policies")}>
                        {stats ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {Object.entries(stats.byType).map(([ty, n]) => (
                              <span key={ty} className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-xs font-bold">
                                {TYPE_META[ty as InsuranceType]?.emoji ?? "📄"} {n}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">{t("customers.no_policies_tagged")}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700" data-label={t("customers.col_total_cover")}>{formatAmount(stats?.totalSumInsured ?? null)}</td>
                      <td className="px-6 py-4 text-slate-500" data-label={t("customers.col_next_premium")}>
                        {stats?.nextPremium ? format(new Date(stats.nextPremium.date), "d MMM yyyy", { locale: dateLocale(locale) }) : "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs" data-label={t("customers.col_added")}>{format(new Date(c.created_at), "d MMM yyyy", { locale: dateLocale(locale) })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="px-6 py-3 border-t border-slate-50 text-xs text-slate-400">
              {t("customers.showing", { shown: filtered.length, total: customers.length })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
