import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";
import { apiFetch } from "@/lib/api";
import { clearSessionKeys } from "@/lib/clearSessionKeys";
import { isPlaygroundMode } from "@/lib/playground/mode";
import { supabase } from "@/lib/supabase";

// The server deletes only when it receives this exact phrase (accountData.ts).
const PHRASE = "DELETE MY ACCOUNT";

export default function DeleteAgentAccount() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function run() {
    if (text.trim() !== PHRASE) return;
    if (isPlaygroundMode()) return setError(t("book.del_demo"));
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/agent/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: PHRASE }) });
      const body = await res.json().catch(() => ({} as any));
      if (!res.ok || body.deleted !== true) return setError(body.message || t("book.del_failed"));
      setDone(true);
    } catch {
      setError(t("book.del_failed"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Card className="border-none bg-white shadow-sm">
        <CardContent className="space-y-4 p-6" role="status">
          <p className="text-base font-semibold text-slate-800">{t("book.del_done")}</p>
          <Button className="bg-[#0D9488] hover:bg-[#0f766e]" onClick={() => { clearSessionKeys(); void supabase.auth.signOut().catch(() => {}).finally(() => { window.location.href = "/"; }); }}>{t("book.del_leave")}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border border-red-100 bg-white shadow-sm">
      <CardHeader><CardTitle className="text-lg font-bold text-red-800">{t("book.del_title")}</CardTitle></CardHeader>
      <CardContent className="space-y-4 p-6 pt-0">
        <p className="max-w-prose text-sm text-slate-700">{t("book.del_body")}</p>
        {!open ? (
          <Button variant="outline" className="border-red-200 bg-white font-bold text-red-700 hover:bg-red-50" onClick={() => setOpen(true)}>{t("book.del_start")}</Button>
        ) : (
          <div className="max-w-md space-y-3">
            <label className="block text-sm font-semibold text-slate-700">
              {t("book.del_type", { phrase: PHRASE })}
              <Input className="mt-1.5 h-11" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
            </label>
            {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
            <div className="flex gap-3">
              <Button className="bg-red-600 text-white hover:bg-red-700" disabled={busy || text.trim() !== PHRASE} onClick={run}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("book.del_go")}
              </Button>
              <Button variant="outline" className="border-slate-200 bg-white" disabled={busy} onClick={() => { setOpen(false); setText(""); setError(null); }}>{t("common.cancel")}</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
