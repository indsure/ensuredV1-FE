import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { CalendarPlus, Download, Loader2, Paperclip, Shapes, Sparkles } from "lucide-react";

import { DraftMessageDialog } from "@/components/agent/DraftMessageDialog";
import { selectCls } from "@/components/agent/HealthFactsForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";
import UnlockPdfDialog from "@/components/UnlockPdfDialog";
import { needsPassword } from "@/lib/unlockPdf";
import { attachPolicyFile, downloadPolicyFile, readAsType } from "@/lib/bookApi";
import type { DraftTarget } from "@/lib/draftMessage";
import { TYPE_META, typeLabel, type InsuranceType } from "@/lib/insuranceTypes";
import { changeLifeType } from "@/lib/lifeApi";

const isLife = (ty: string) => ty === "life" || ty === "term";

/**
 * What an advisor can do with one policy besides reading it: get the original
 * file, message the customer, renew it, correct its type. On the policy page so
 * that a phone, whose list only opens the policy, has them too.
 */
export default function PolicyBookActions({ id, type, hasFile, filename, reading, draft, onChanged }: {
  id: string; type: string; hasFile: boolean; filename: string | null; reading: boolean; draft: DraftTarget; onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [draftOpen, setDraftOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const tl = (ty: string) => tOr(t, `common.type_${ty}`, typeLabel(ty));
  // Life and term are read the same way, so that change costs nothing.
  const free = !hasFile || (isLife(type) && isLife(to));

  async function download() {
    setBusy("download");
    try {
      await downloadPolicyFile(id, filename);
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("policies.download_failed"), description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  const picker = useRef<HTMLInputElement>(null);
  const [locked, setLocked] = useState<File | null>(null);
  async function attach(file: File) {
    if (file.size > 25 * 1024 * 1024) return toast({ variant: "destructive", title: t("uploads.too_large"), description: t("uploads.too_large_desc", { name: file.name }) });
    setBusy("attach");
    try {
      await attachPolicyFile(id, file);
      toast({ variant: "success", title: t("book.attached"), description: t("book.attached_desc") });
      onChanged();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("book.attach_failed"), description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  }
  async function pick(file: File | undefined) {
    if (picker.current) picker.current.value = "";
    if (!file) return;
    if (await needsPassword(file)) setLocked(file);
    else await attach(file);
  }

  async function changeType() {
    if (!to) return;
    setBusy("type");
    try {
      if (isLife(type) && isLife(to)) await changeLifeType(id, to as "life" | "term");
      else await readAsType(id, to);
      toast({ variant: "success", title: t(free ? "book.type_changed" : "book.type_reading", { type: tl(to) }) });
      setTypeOpen(false);
      onChanged();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("book.type_failed"), description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  const btn = "w-full border-slate-200 bg-white";
  return (
    <>
      <UnlockPdfDialog file={locked} onUnlocked={(_, open) => { setLocked(null); void attach(open); }} onCancel={() => setLocked(null)} />
      <input ref={picker} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif" className="hidden" aria-label={t("book.attach")} onChange={(e) => void pick(e.target.files?.[0])} />
      {!hasFile && !reading && (
        <Button variant="outline" className={btn} disabled={busy === "attach"} onClick={() => picker.current?.click()}>
          {busy === "attach" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />} {t("book.attach")}
        </Button>
      )}
      {hasFile && <Button variant="outline" className={btn} disabled={busy === "download"} onClick={download}>
        {busy === "download" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        {t("book.original")}
      </Button>}
      <Button variant="outline" className={btn} onClick={() => setDraftOpen(true)}>
        <Sparkles className="mr-2 h-4 w-4" /> {t("policies.draft_whatsapp")}
      </Button>
      <Button variant="outline" className={btn} onClick={() => setLocation(`/agent/uploads?renews=${id}&type=${type}`)}>
        <CalendarPlus className="mr-2 h-4 w-4" /> {t("book.renew")}
      </Button>
      <Button variant="outline" className={btn} disabled={reading} onClick={() => { setTo(""); setTypeOpen(true); }}>
        <Shapes className="mr-2 h-4 w-4" /> {t("book.change_type")}
      </Button>

      <Dialog open={typeOpen} onOpenChange={setTypeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("book.change_type")}</DialogTitle>
            <DialogDescription>{t("book.type_now", { type: tl(type) })}</DialogDescription>
          </DialogHeader>
          <label className="block text-sm font-semibold text-slate-700">
            {t("book.type_new")}
            <select className={`${selectCls} mt-1.5`} value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">{t("book.type_pick")}</option>
              {(Object.keys(TYPE_META) as InsuranceType[]).filter((x) => x !== type).map((x) => <option key={x} value={x}>{tl(x)}</option>)}
            </select>
          </label>
          {to && <p className="text-sm text-slate-600">{t(free ? "book.type_free" : to === "health" ? "book.type_cost_check" : "book.type_cost_read")}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="outline" className="border-slate-200 bg-white" onClick={() => setTypeOpen(false)}>{t("common.cancel")}</Button>
            <Button className="bg-[#0D9488] hover:bg-[#0f766e]" disabled={!to || busy === "type"} onClick={changeType}>
              {busy === "type" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("book.type_confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <DraftMessageDialog target={draftOpen ? draft : null} open={draftOpen} onClose={() => setDraftOpen(false)} />
    </>
  );
}
