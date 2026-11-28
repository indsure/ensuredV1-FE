import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";

import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useAgent } from "@/context/AgentContext";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { deleteComparison, fetchComparisons, setComparisonCustomer, type SavedComparison } from "@/lib/bookApi";
import { fetchCustomers, type Customer } from "@/lib/customers";

/** Comparisons this advisor saved, to open again, link to a customer or delete. Nothing to show = nothing shown. */
export default function SavedComparisons() {
  const { t, locale } = useLanguage();
  const { agent } = useAgent();
  const [rows, setRows] = useState<SavedComparison[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [all, setAll] = useState(false);
  const [gone, setGone] = useState<SavedComparison | null>(null);

  const load = useCallback(() => { fetchComparisons().then(setRows).catch(() => setRows([])); }, []);
  useEffect(() => {
    load();
    if (agent?.agentId) fetchCustomers(agent.agentId).then(setCustomers).catch(() => {});
    window.addEventListener("indsure:comparison-saved", load);
    return () => window.removeEventListener("indsure:comparison-saved", load);
  }, [agent?.agentId, load]);

  const fail = (e: unknown) => toast({ variant: "destructive", title: t("common.request_failed"), description: e instanceof Error ? e.message : undefined });
  async function link(r: SavedComparison, id: string | null) {
    try {
      await setComparisonCustomer(r.id, id);
      setRows((l) => l.map((x) => (x.id === r.id ? { ...x, customer_id: id } : x)));
    } catch (e) { fail(e); }
  }
  async function remove() {
    if (!gone) return;
    const id = gone.id;
    setGone(null);
    try {
      await deleteComparison(id);
      setRows((l) => l.filter((x) => x.id !== id));
      toast({ variant: "success", title: t("book.cmp_deleted") });
    } catch (e) { fail(e); }
  }

  if (!rows.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-slate-900">{t("book.cmp_title")}</h2>
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white shadow-sm">
        {(all ? rows : rows.slice(0, 5)).map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1 basis-60">
              <div className="truncate font-semibold text-slate-800">{[r.name_a, r.name_b].filter(Boolean).join(", ") || t("book.cmp_untitled")}{r.plans > 2 ? ` +${r.plans - 2}` : ""}</div>
              <div className="text-sm text-slate-600">{new Date(r.created_at).toLocaleDateString(locale === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
            </div>
            {!agent?.limitedFree && (
              <select aria-label={t("book.customer")} value={r.customer_id ?? ""} onChange={(e) => void link(r, e.target.value || null)} className="min-h-11 max-w-[200px] rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700">
                <option value="">{t("book.no_customer")}</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <a href={`/compare/report/${r.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-[#0f766e]"><ExternalLink size={15} /> {t("book.open")}</a>
            <button type="button" aria-label={t("common.delete")} onClick={() => setGone(r)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
          </li>
        ))}
      </ul>
      {rows.length > 5 && <button type="button" className="min-h-11 text-sm font-semibold text-[#0f766e]" onClick={() => setAll((v) => !v)}>{t(all ? "book.show_less" : "book.show_all", { count: rows.length })}</button>}
      <ConfirmationDialog open={!!gone} onOpenChange={(o) => !o && setGone(null)} onConfirm={() => void remove()} title={t("book.cmp_delete")} description={t("book.cmp_delete_desc")} confirmText={t("common.delete")} cancelText={t("common.cancel")} variant="destructive" />
    </section>
  );
}
