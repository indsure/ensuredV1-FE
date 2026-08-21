import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { getApiBase } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { getFields, typeLabel, type ExtractionField } from "@/lib/insuranceTypes";

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

  function setField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      // Coerce back to typed values; empty → null.
      const payload: Record<string, any> = {};
      for (const f of fields) {
        const raw = values[f.key]?.trim() ?? "";
        if (raw === "") {
          payload[f.key] = null;
        } else if (f.type === "number") {
          const n = Number(raw.replace(/[^0-9.\-]/g, ""));
          payload[f.key] = Number.isFinite(n) ? n : null;
        } else {
          payload[f.key] = raw;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(`${getApiBase()}/api/agent/clients/${clientId}/extracted-data`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ extracted_data: payload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Save failed");
      }

      toast({ variant: "success", title: "Details saved" });
      onSaved?.(payload);
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: e instanceof Error ? e.message : "Could not save the details.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (fields.length === 0) {
    return (
      <Card className="border-slate-100 shadow-sm">
        <CardContent className="p-8 text-center text-slate-400 text-sm italic">
          No data-entry fields are configured for this insurance type.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-100 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 pb-4">
        <CardTitle className="text-lg font-bold text-slate-800">
          {typeLabel(insuranceType)} policy details
        </CardTitle>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Data entry · review &amp; edit
        </span>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        <p className="text-sm text-slate-500">
          These fields were read from the uploaded document. Please review and correct anything before saving.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {f.label}
              </label>
              <Input
                type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                value={values[f.key] ?? ""}
                onChange={(e) => setField(f.key, e.target.value)}
                className="bg-slate-50 border-slate-200 focus:border-[#0D9488] font-medium h-11"
              />
            </div>
          ))}
        </div>
        <div className="pt-2">
          <Button
            onClick={save}
            disabled={saving}
            className="bg-[#0D9488] hover:bg-[#0f766e] text-white font-semibold px-8 h-11"
          >
            {saving ? "Saving…" : "Save details"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
