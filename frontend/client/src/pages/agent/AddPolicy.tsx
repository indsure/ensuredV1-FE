import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Loader2 } from "lucide-react";

import { BackLink } from "@/components/agent/BackLink";
import { FrequencySelect, selectCls } from "@/components/agent/HealthFactsForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAgent } from "@/context/AgentContext";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";
import { addManualPolicy } from "@/lib/bookApi";
import { fetchCustomers, type Customer } from "@/lib/customers";
import { getFields, isDataEntryType, TYPE_META, typeLabel, type ExtractionField, type InsuranceType } from "@/lib/insuranceTypes";
import { parseRupees } from "@/lib/policyNumbers";

const labelKey = (s: string) => "xform.f_" + s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/** Only what an advisor knows by heart; the rest is on the policy page's own form. */
const SHORT: Partial<Record<InsuranceType, string[]>> = {
  motor: ["insurer", "plan_name", "vehicle_registration_no", "make_and_model", "idv", "premium", "policy_start_date", "policy_expiry_date"],
  life: ["insurer", "plan_name", "life_assured_name", "sum_assured", "premium", "premium_frequency", "start_date", "next_premium_date", "premium_paying_term_years", "maturity_date", "nominee_name"],
  term: ["insurer", "plan_name", "life_assured_name", "sum_assured", "premium", "premium_frequency", "start_date", "next_premium_date", "premium_paying_term_years", "cover_end_date", "nominee_name"],
};
const HEALTH: ExtractionField[] = [
  { key: "insurer", label: "Insurer", type: "text" },
  { key: "policy_name", label: "Plan / product name", type: "text" },
  { key: "sum_insured", label: "Sum insured", type: "number" },
  { key: "premium", label: "Premium", type: "number" },
  { key: "premium_frequency", label: "Premium frequency", type: "text" },
  { key: "expiry_date", label: "Policy expiry date", type: "date" },
];
const SKIP = new Set(["policyholder_name", "policy_number"]);

export default function AddPolicy() {
  const { t } = useLanguage();
  const { agent } = useAgent();
  const [, setLocation] = useLocation();
  const q = new URLSearchParams(useSearch());
  const askedType = q.get("type") ?? "";
  const [type, setType] = useState<InsuranceType>(askedType in TYPE_META ? (askedType as InsuranceType) : "motor");
  const [customerId, setCustomerId] = useState(q.get("customer") ?? "");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [who, setWho] = useState({ policyholder_name: "", policy_number: "", client_phone: "", client_email: "" });
  const [values, setValues] = useState<Record<string, string>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!agent?.agentId) return;
    fetchCustomers(agent.agentId).then(setCustomers).catch(() => {});
  }, [agent?.agentId]);

  // Picking the customer fills what is already known about them, never over what was typed.
  useEffect(() => {
    const c = customers.find((x) => x.id === customerId);
    if (c) setWho((w) => ({ ...w, policyholder_name: w.policyholder_name || c.name, client_phone: w.client_phone || c.phone || "", client_email: w.client_email || c.email || "" }));
  }, [customerId, customers]);

  const fields = useMemo(() => {
    if (!isDataEntryType(type)) return HEALTH;
    const all = getFields(type).filter((f) => f.type !== "json" && !SKIP.has(f.key));
    const short = SHORT[type];
    return short ? short.map((k) => all.find((f) => f.key === k)).filter((f): f is ExtractionField => !!f) : all;
  }, [type]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const bad: Record<string, string> = {};
    if (!who.policyholder_name.trim()) bad.policyholder_name = t("book.name_needed");
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = (values[f.key] ?? "").trim();
      if (!raw) continue;
      if (f.type === "number") {
        const p = parseRupees(raw);
        if (p.ok) out[f.key] = p.value;
        else bad[f.key] = t("xform.bad_number", { field: tOr(t, labelKey(f.label), f.label) });
      } else out[f.key] = raw;
    }
    setErrs(bad);
    if (Object.keys(bad).length) return;
    setSaving(true);
    try {
      const { id } = await addManualPolicy({ type, customer_id: customerId || null, ...who, fields: out });
      toast({ variant: "success", title: t("book.added") });
      setLocation(`/agent/policies/${id}`);
    } catch (err: unknown) {
      toast({ variant: "destructive", title: t("xform.save_failed"), description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  const label = "block text-sm font-semibold text-slate-700";
  const box = (key: string, text: string, el: React.ReactNode) => (
    <label key={key} className={label}>
      {text}
      <div className="mt-1.5">{el}</div>
      {errs[key] && <span role="alert" className="mt-1 block text-sm font-semibold text-rose-700">{errs[key]}</span>}
    </label>
  );

  return (
    <div className="space-y-6 pb-8">
      <BackLink to="/agent/policies" label={t("policy_detail.back")} />
      <div>
        <h1 className="font-['Playfair_Display'] text-3xl font-bold text-slate-900">{t("book.add_title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{t("book.add_desc")}</p>
      </div>
      <form onSubmit={save}>
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="space-y-6 p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {box("type", t("book.type"), (
                <select className={selectCls} value={type} onChange={(e) => { setType(e.target.value as InsuranceType); setValues({}); setErrs({}); }}>
                  {(Object.keys(TYPE_META) as InsuranceType[]).map((x) => <option key={x} value={x}>{tOr(t, `common.type_${x}`, typeLabel(x))}</option>)}
                </select>
              ))}
              {box("customer", t("book.customer"), (
                <select className={selectCls} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">{t("book.no_customer")}</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ""}</option>)}
                </select>
              ))}
              {(["policyholder_name", "policy_number", "client_phone", "client_email"] as const).map((k) =>
                box(k, t(`book.f_${k}`), <Input className="h-11" type={k === "client_phone" ? "tel" : "text"} value={who[k]} onChange={(e) => setWho((w) => ({ ...w, [k]: e.target.value }))} />))}
            </div>
            <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2">
              {fields.map((f) => box(f.key, tOr(t, labelKey(f.label), f.label), f.key === "premium_frequency"
                ? <FrequencySelect value={values[f.key] ?? ""} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
                : <Input className="h-11" type={f.type === "date" ? "date" : "text"} inputMode={f.type === "number" ? "decimal" : undefined}
                    value={values[f.key] ?? ""} onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))} />))}
            </div>
            <Button type="submit" className="h-11 bg-[#0D9488] px-8 hover:bg-[#0f766e]" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("book.add_save")}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
