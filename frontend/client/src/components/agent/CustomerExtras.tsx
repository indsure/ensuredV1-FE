import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, MessageCircle, Phone, Plus, ShieldPlus, Sparkles, Upload } from "lucide-react";

import { DraftMessageDialog } from "@/components/agent/DraftMessageDialog";
import { selectCls } from "@/components/agent/HealthFactsForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAgent } from "@/context/AgentContext";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";
import { mergeCustomers } from "@/lib/bookApi";
import { CLAIM_STATUS_META, fetchClaims, type Claim } from "@/lib/claims";
import { fetchCustomers, findDuplicate, formatAmount, type Customer } from "@/lib/customers";
import { telHref, waHref } from "@/lib/leads";

/** Call, message, upload, add by hand, open a claim: everything an advisor starts from a customer. */
export function CustomerActions({ customer }: { customer: Customer }) {
  const { t } = useLanguage();
  const { agent } = useAgent();
  const [, setLocation] = useLocation();
  const [draft, setDraft] = useState(false);
  const wa = waHref(customer.phone, `Hello ${customer.name.split(" ")[0]}, `);
  const tel = telHref(customer.phone);
  const base = "inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-bold";
  const plain = `${base} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <a href={wa ?? undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!wa} className={`${base} bg-[#25D366] text-white ${wa ? "" : "pointer-events-none opacity-40"}`}><MessageCircle size={16} /> {t("leads.whatsapp")}</a>
      <a href={tel ?? undefined} aria-disabled={!tel} className={`${base} bg-slate-800 text-white ${tel ? "" : "pointer-events-none opacity-40"}`}><Phone size={16} /> {t("leads.call")}</a>
      <button type="button" className={plain} onClick={() => setDraft(true)}><Sparkles size={16} /> {t("policies.draft_whatsapp")}</button>
      <button type="button" className={plain} onClick={() => setLocation(`/agent/uploads?customer=${customer.id}`)}><Upload size={16} /> {t("book.upload")}</button>
      {!agent?.limitedFree && <button type="button" className={plain} onClick={() => setLocation(`/agent/policies/add?customer=${customer.id}`)}><Plus size={16} /> {t("book.add_by_hand")}</button>}
      {!agent?.limitedFree && <button type="button" className={plain} onClick={() => setLocation(`/agent/claims?new=1&customer=${customer.id}`)}><ShieldPlus size={16} /> {t("book.open_claim")}</button>}
      <DraftMessageDialog target={draft ? { type: "client", id: customer.id, name: customer.name, phone: customer.phone } : null} open={draft} onClose={() => setDraft(false)} />
    </div>
  );
}

export function CustomerClaims({ customerId }: { customerId: string }) {
  const { t } = useLanguage();
  const { agent } = useAgent();
  const [, setLocation] = useLocation();
  const [claims, setClaims] = useState<Claim[]>([]);
  useEffect(() => {
    if (agent?.limitedFree) return;
    let on = true;
    fetchClaims().then((c) => on && setClaims(c.filter((x) => x.customer_id === customerId))).catch(() => {});
    return () => { on = false; };
  }, [customerId, agent?.limitedFree]);
  if (!claims.length) return null;
  return (
    <Card className="border-slate-100 shadow-sm">
      <CardHeader><CardTitle>{t("claims.title")}</CardTitle></CardHeader>
      <CardContent className="divide-y divide-slate-100 p-0">
        {claims.map((c) => (
          <button key={c.id} type="button" className="flex w-full flex-wrap items-center justify-between gap-2 px-6 py-4 text-left hover:bg-slate-50" onClick={() => setLocation(`/agent/claims/${c.id}`)}>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-slate-800">{[c.ailment, c.hospital].filter(Boolean).join(", ") || t("claim_detail.health_claim")}</span>
              <span className="block text-sm text-slate-600">{c.insurer || ""} {c.claimed_amount != null ? formatAmount(Number(c.claimed_amount)) : ""}</span>
            </span>
            <span className={`rounded-full border px-3 py-1 text-sm font-bold ${CLAIM_STATUS_META[c.status].badge}`}>{tOr(t, `claims.status_${c.status}`, CLAIM_STATUS_META[c.status].label)}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

/** Joins a second record of the same person into this one. */
export function MergeCustomer({ customer, onMerged }: { customer: Customer; onMerged: () => void }) {
  const { t } = useLanguage();
  const { agent } = useAgent();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Customer[]>([]);
  const [from, setFrom] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!agent?.agentId) return;
    fetchCustomers(agent.agentId).then((c) => setList(c.filter((x) => x.id !== customer.id))).catch(() => {});
  }, [agent?.agentId, customer.id]);

  const likely = findDuplicate(list, customer);
  const other = list.find((c) => c.id === from);
  if (agent?.limitedFree || !list.length) return null;

  async function run() {
    setBusy(true);
    try {
      await mergeCustomers(customer.id, from);
      toast({ variant: "success", title: t("book.merged") });
      setList((l) => l.filter((c) => c.id !== from));
      setOpen(false);
      onMerged();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("book.merge_failed"), description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {likely && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <span>{t("book.merge_likely", { name: likely.customer.name })}</span>
          <Button variant="outline" className="border-amber-300 bg-white" onClick={() => { setFrom(likely.customer.id); setOpen(true); }}>{t("book.merge")}</Button>
        </div>
      )}
      {!likely && <button type="button" className="min-h-11 text-sm font-semibold text-[#0f766e] hover:underline" onClick={() => { setFrom(""); setOpen(true); }}>{t("book.merge_start")}</button>}
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("book.merge_title", { name: customer.name })}</DialogTitle>
            <DialogDescription>{t("book.merge_desc")}</DialogDescription>
          </DialogHeader>
          <label className="block text-sm font-semibold text-slate-700">
            {t("book.merge_pick")}
            <select className={`${selectCls} mt-1.5`} value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="">{t("claims.choose_customer")}</option>
              {list.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ""}</option>)}
            </select>
          </label>
          {other && <p className="text-sm font-semibold text-red-700">{t("book.merge_warn", { name: other.name, keep: customer.name })}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="outline" className="border-slate-200 bg-white" disabled={busy} onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button className="bg-[#0D9488] hover:bg-[#0f766e]" disabled={!from || busy} onClick={run}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("book.merge")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
