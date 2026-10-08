import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { getApiBase } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { getFields, typeLabel, type ExtractionField } from "@/lib/insuranceTypes";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";
import { parseRupees } from "@/lib/policyNumbers";

// Field labels are keyed by the label text, not the field key: the same key
// carries different labels on different insurance types.
const labelKey = (s: string) => "xform.f_" + s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

interface ExtractedDataFormProps {
  clientId: string;
  insuranceType: string;
  initialData: Record<string, any> | null | undefined;
  onSaved?: (data: Record<string, any>) => void;
}

function toInputValue(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

export default function ExtractedDataForm({
  clientId,
  insuranceType,
  initialData,
  onSaved,
}: ExtractedDataFormProps) {
  const { t } = useLanguage();
  // json fields (the charge table) are edited on the value card, not here — a
  // text input would stringify the object and destroy it on the next save.
  const fields = useMemo<ExtractionField[]>(
    () => getFields(insuranceType).filter((f) => f.type !== "json"),
    [insuranceType]
  );

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) init[f.key] = toInputValue(initialData?.[f.key]);
    return init;
  });
  const [saving, setSaving] = useState(false);
  // Fields whose text could not be read as a value, shown under the field.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Life and term amounts drive surrender values, so they use the strict
  // grammar: "1.5 lakh" is 150000, "approx 50k" is refused. Other lines keep
  // their previous reading; tightening them is a separate change.
  const strict = insuranceType === "life" || insuranceType === "term";

  function setField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      // Coerce back to typed values; empty → null.
      const payload: Record<string, any> = {};
      const errs: Record<string, string> = {};
      for (const f of fields) {
        const raw = values[f.key]?.trim() ?? "";
        if (raw === "") {
          payload[f.key] = null;
        } else if (f.type === "number" && strict) {
          const p = parseRupees(raw);
          if (p.ok) payload[f.key] = p.value;
          else errs[f.key] = t("xform.bad_number", { field: tOr(t, labelKey(f.label), f.label) });
        } else if (f.type === "number") {
          const n = Number(raw.replace(/[^0-9.\-]/g, ""));
          payload[f.key] = Number.isFinite(n) ? n : null;
        } else {
          payload[f.key] = raw;
        }
      }
      setFieldErrors(errs);
      if (Object.keys(errs).length) {
        setSaving(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(t("xform.not_signed_in"));

      const res = await fetch(`${getApiBase()}/api/agent/clients/${clientId}/extracted-data`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          extracted_data: payload,
          // The revision this form was loaded at; a save made elsewhere since then gets a 409.
          expected_rev: Number.isInteger(initialData?._rev) ? initialData!._rev : 0,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 409) throw new Error(t("xform.stale"));
        if (Array.isArray(body.fields)) {
          const next: Record<string, string> = {};
          for (const fe of body.fields) {
            const f = fields.find((x) => x.key === fe.field);
            if (f) next[f.key] = t(f.type === "date" ? "xform.bad_date" : "xform.bad_number", { field: tOr(t, labelKey(f.label), f.label) });
          }
          setFieldErrors(next);
        }
        throw new Error(body.message || body.error || t("xform.save_failed"));
      }

      toast({ variant: "success", title: t("xform.saved") });
      onSaved?.(payload);
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: t("xform.save_failed"),
        description: e instanceof Error ? e.message : t("xform.save_failed_desc"),
      });
    } finally {
      setSaving(false);
    }
  }

  if (fields.length === 0) {
    return (
      <Card className="border-slate-100 shadow-sm">
        <CardContent className="p-8 text-center text-slate-400 text-sm italic">
          {t("xform.no_fields")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-100 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 pb-4">
        <CardTitle className="text-lg font-bold text-slate-800">
          {t("xform.title", { type: tOr(t, `common.type_${insuranceType}`, typeLabel(insuranceType)) })}
        </CardTitle>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {t("xform.badge")}
        </span>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        <p className="text-sm text-slate-500">
          {t("xform.intro")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                {tOr(t, labelKey(f.label), f.label)}
              </label>
              <Input
                type={f.type === "date" ? "date" : f.type === "number" && !strict ? "number" : "text"}
                inputMode={f.type === "number" ? "decimal" : undefined}
                value={values[f.key] ?? ""}
                onChange={(e) => setField(f.key, e.target.value)}
                className="bg-slate-50 border-slate-200 focus:border-[#0D9488] font-medium h-11"
                aria-invalid={fieldErrors[f.key] ? true : undefined}
              />
              {fieldErrors[f.key] && (
                <p className="text-sm font-semibold text-rose-700" role="alert">{fieldErrors[f.key]}</p>
              )}
            </div>
          ))}
        </div>
        <div className="pt-2">
          <Button
            onClick={save}
            disabled={saving}
            className="bg-[#0D9488] hover:bg-[#0f766e] text-white font-semibold px-8 h-11"
          >
            {saving ? t("xform.saving") : t("xform.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
