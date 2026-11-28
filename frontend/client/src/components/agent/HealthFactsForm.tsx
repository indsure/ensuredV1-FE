import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { saveHealthFacts } from "@/lib/bookApi";
import { parseRupees } from "@/lib/policyNumbers";

export type HealthFacts = { insurer: string; expiry_date: string; sum_insured: string; premium: string; premium_frequency: string };
export const FREQUENCY_OPTIONS = ["yearly", "half-yearly", "quarterly", "monthly", "single"] as const;

export const selectCls = "h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700";

export function FrequencySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useLanguage();
  // A frequency the document states in other words stays as it is until changed.
  const known = (FREQUENCY_OPTIONS as readonly string[]).includes(value) || value === "";
  return (
    <select className={selectCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t("book.freq_unknown")}</option>
      {!known && <option value={value}>{value}</option>}
      {FREQUENCY_OPTIONS.map((f) => <option key={f} value={f}>{t(`book.freq_${f.replace("-", "_")}`)}</option>)}
    </select>
  );
}

/** Corrects what was read off a health policy. Sends only what changed. */
export default function HealthFactsForm({ clientId, initial, hasReport, onSaved }: {
  clientId: string; initial: HealthFacts; hasReport: boolean; onSaved: () => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(!hasReport);
  const [v, setV] = useState(initial);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof HealthFacts, x: string) => setV((c) => ({ ...c, [k]: x }));

  async function save() {
    const patch: Record<string, unknown> = {};
    const bad: Record<string, string> = {};
    for (const k of Object.keys(v) as (keyof HealthFacts)[]) {
      const val = v[k].trim();
      if (val === initial[k].trim()) continue;
      if ((k === "sum_insured" || k === "premium") && val) {
        const p = parseRupees(val);
        if (!p.ok) { bad[k] = t("xform.bad_number", { field: t(`book.f_${k}`) }); continue; }
        patch[k] = p.value;
      } else patch[k] = val || null;
    }
    setErrs(bad);
    if (Object.keys(bad).length) return;
    if (!Object.keys(patch).length) { if (hasReport) setOpen(false); return; }
    setSaving(true);
    try {
      await saveHealthFacts(clientId, patch);
      toast({ variant: "success", title: t("xform.saved") });
      if (hasReport) setOpen(false);
      onSaved();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: t("xform.save_failed"), description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-slate-100 shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>{t("book.facts_title")}</CardTitle>
        {!open && <Button variant="outline" className="border-slate-200 bg-white" onClick={() => { setV(initial); setOpen(true); }}>{t("book.facts_edit")}</Button>}
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(["insurer", "expiry_date", "sum_insured", "premium"] as const).map((k) => (
              <label key={k} className="block text-sm font-semibold text-slate-700">
                {t(`book.f_${k}`)}
                <Input className="mt-1.5 h-11" type={k === "expiry_date" ? "date" : "text"} inputMode={k === "premium" || k === "sum_insured" ? "decimal" : undefined}
                  value={v[k]} onChange={(e) => set(k, e.target.value)} aria-invalid={errs[k] ? true : undefined} />
                {errs[k] && <span role="alert" className="mt-1 block text-sm font-semibold text-rose-700">{errs[k]}</span>}
              </label>
            ))}
            <label className="block text-sm font-semibold text-slate-700">
              {t("book.f_premium_frequency")}
              <div className="mt-1.5"><FrequencySelect value={v.premium_frequency} onChange={(x) => set("premium_frequency", x)} /></div>
            </label>
          </div>
          {hasReport && <p className="text-sm text-slate-600">{t("book.facts_note")}</p>}
          <div className="flex gap-3">
            <Button className="h-11 bg-[#0D9488] px-8 hover:bg-[#0f766e]" disabled={saving} onClick={save}>{saving ? t("xform.saving") : t("xform.save")}</Button>
            {hasReport && <Button variant="outline" className="h-11 border-slate-200 bg-white" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
