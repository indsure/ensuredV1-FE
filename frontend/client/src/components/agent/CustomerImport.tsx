import { useRef, useState } from "react";
import { FileDown, FileUp, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { createCustomers, findDuplicate, type Customer, type CustomerDraft } from "@/lib/customers";
import { readCustomerRows, type ReadRow } from "@/lib/customerSheet";

/** Customers in from Excel or CSV, and out to Excel. Shows what will happen before it does. */
export default function CustomerImport({ agentId, customers, canAdd, onDone }: {
  agentId: string; customers: Customer[]; canAdd: boolean; onDone: () => void;
}) {
  const { t } = useLanguage();
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<(ReadRow & { dupe: boolean })[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const read = await readCustomerRows(file);
      const seen: Customer[] = [...customers];
      const marked = read.map((r) => {
        const dupe = !!r.draft && !!findDuplicate(seen, r.draft);
        if (r.draft && !dupe) seen.push({ id: "", agent_id: "", created_at: "", phone: null, email: null, dob: null, city: null, notes: null, ...r.draft } as Customer);
        return { ...r, dupe };
      });
      if (!marked.length) throw new Error(t("book.import_empty"));
      setRows(marked);
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("book.import_failed"), description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const good = (rows ?? []).filter((r) => r.draft && !r.dupe);
  const dupes = (rows ?? []).filter((r) => r.dupe).length;
  const noName = (rows ?? []).filter((r) => !r.draft).length;
  const badDob = good.filter((r) => r.badDob).length;

  async function run() {
    setBusy(true);
    try {
      const n = await createCustomers(agentId, good.map((r) => r.draft as CustomerDraft));
      toast({ variant: "success", title: t("book.import_done", { count: n }) });
      setRows(null);
      onDone();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("book.import_failed"), description: e instanceof Error ? e.message : undefined });
      onDone(); // some may have gone in before it stopped
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(customers.map((c) => ({
      Name: c.name, Phone: c.phone ?? "", Email: c.email ?? "", City: c.city ?? "", "Date of birth": c.dob?.slice(0, 10) ?? "", Notes: c.notes ?? "",
    })), { header: ["Name", "Phone", "Email", "City", "Date of birth", "Notes"] });
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Customers");
    XLSX.writeFile(book, `indsure-customers-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const cls = "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
  return (
    <>
      <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden" aria-label={t("book.import")} onChange={(e) => void pick(e.target.files?.[0])} />
      {canAdd && (
        <button type="button" className={cls} disabled={busy} onClick={() => input.current?.click()}>
          {busy && !rows ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />} {t("book.import")}
        </button>
      )}
      <button type="button" className={cls} disabled={!customers.length} onClick={() => void download()}><FileDown size={14} /> {t("book.export")}</button>

      <Dialog open={!!rows} onOpenChange={(o) => !o && !busy && setRows(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("book.import_title", { count: good.length })}</DialogTitle>
            <DialogDescription>{t("book.import_columns")}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 text-sm text-slate-700">
            {dupes > 0 && <li>{t("book.import_dupes", { count: dupes })}</li>}
            {noName > 0 && <li>{t("book.import_noname", { count: noName })}</li>}
            {badDob > 0 && <li>{t("book.import_baddob", { count: badDob })}</li>}
          </ul>
          <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-sm">
            {good.slice(0, 200).map((r, i) => (
              <li key={i} className="px-3 py-2"><span className="font-semibold">{r.draft!.name}</span> <span className="text-slate-600">{[r.draft!.phone, r.draft!.city, r.draft!.dob].filter(Boolean).join(", ")}</span></li>
            ))}
          </ul>
          <div className="flex justify-end gap-3">
            <Button variant="outline" className="border-slate-200 bg-white" disabled={busy} onClick={() => setRows(null)}>{t("common.cancel")}</Button>
            <Button className="bg-[#0D9488] hover:bg-[#0f766e]" disabled={busy || !good.length} onClick={() => void run()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("book.import_go", { count: good.length })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
