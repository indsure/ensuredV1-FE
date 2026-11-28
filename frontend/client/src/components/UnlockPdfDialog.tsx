import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";
import { unlockPdf } from "@/lib/unlockPdf";

/** Asks for one locked PDF's password and hands back an unlocked copy. */
export default function UnlockPdfDialog({ file, onUnlocked, onCancel }: {
  file: File | null;
  onUnlocked: (locked: File, open: File) => void;
  onCancel: (locked: File) => void;
}) {
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setPassword(""); setError(null); setBusy(false); }, [file]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !password) return;
    setBusy(true);
    setError(null);
    try {
      const open = await unlockPdf(file, password);
      if (open) return onUnlocked(file, open);
      setError(t("book.unlock_wrong"));
    } catch {
      setError(t("book.unlock_failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!file} onOpenChange={(o) => { if (!o && file) onCancel(file); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="h-5 w-5 text-[#0D9488]" /> {t("book.unlock_title")}</DialogTitle>
          <DialogDescription className="break-all">{file?.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-slate-600">{t("book.unlock_body")}</p>
          <label className="block text-sm font-semibold text-slate-700">
            {t("book.unlock_label")}
            <Input className="mt-1.5" type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} autoFocus
              value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!error || undefined} />
          </label>
          {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="outline" className="border-slate-200 bg-white" onClick={() => file && onCancel(file)}>{t("book.unlock_skip")}</Button>
            <Button type="submit" className="bg-[#0D9488] hover:bg-[#0f766e]" disabled={busy || !password}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("book.unlock_btn")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
