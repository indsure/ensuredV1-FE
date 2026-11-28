import { X } from "lucide-react";
import { TYPE_META, type InsuranceType } from "@/lib/insuranceTypes";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";

/** "Has / Does not have" + a policy type, shared by Customers and Policies.
 *  The main list is fixed; every other type sits under "Other", which opens a
 *  second menu beside it (a native select cannot open a side menu). */
export const MAIN_TYPES: InsuranceType[] = ["health", "life", "term", "motor"];
export const OTHERS = "__others";
export const OTHER_TYPES = (Object.keys(TYPE_META) as InsuranceType[]).filter(ty => !MAIN_TYPES.includes(ty));

export type HasTypeValue = {
  mode: "has" | "lacks";
  /** "" = off, "any" = any policy at all, OTHERS = the Other group, or a type. */
  type: string;
  /** Inside Other: "" = any other type, or one of them. */
  other: string;
};
export const HAS_TYPE_OFF: HasTypeValue = { mode: "has", type: "", other: "" };

export const SELECT_CLS = "min-h-11 sm:min-h-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 sm:py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30";

/** Does a holding (policy counts by type) pass the filter? Off = always. */
export function matchesHasType(byType: Record<string, number>, f: HasTypeValue): boolean {
  if (!f.type) return true;
  const owns = (ty: string) => (byType[ty] ?? 0) > 0;
  const has = f.type === "any"
    ? Object.values(byType).some(n => n > 0)
    : f.type === OTHERS
      ? (f.other ? owns(f.other) : OTHER_TYPES.some(owns))
      : owns(f.type);
  return f.mode === "has" ? has : !has;
}

export function HasTypeFilter({ value, onChange, label }: {
  value: HasTypeValue;
  onChange: (v: HasTypeValue) => void;
  /** What the filter is about, e.g. "Filter" or "Customer". */
  label: string;
}) {
  const { t } = useLanguage();
  const typeName = (ty: InsuranceType) => tOr(t, `common.type_${ty}`, TYPE_META[ty].label);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
      <span className="font-medium">{label}</span>
      <select aria-label={label} value={value.mode} onChange={e => onChange({ ...value, mode: e.target.value as "has" | "lacks" })} className={SELECT_CLS}>
        <option value="has">{t("customers.filter_has")}</option>
        <option value="lacks">{t("customers.filter_lacks")}</option>
      </select>
      <select aria-label={t("customers.col_policies")} value={value.type} onChange={e => onChange({ ...value, type: e.target.value, other: "" })} className={SELECT_CLS}>
        <option value="">{t("customers.filter_pick_type")}</option>
        <option value="any">{t("customers.filter_any_type")}</option>
        {MAIN_TYPES.map(ty => (
          <option key={ty} value={ty}>{TYPE_META[ty].emoji} {ty === "motor" ? t("customers.filter_vehicle") : typeName(ty)}</option>
        ))}
        <option value={OTHERS}>{t("customers.filter_other")} ›</option>
      </select>
      {value.type === OTHERS && (
        <select aria-label={t("customers.filter_other")} value={value.other} onChange={e => onChange({ ...value, other: e.target.value })} className={SELECT_CLS}>
          <option value="">{t("customers.filter_all_other")}</option>
          {OTHER_TYPES.map(ty => (
            <option key={ty} value={ty}>{TYPE_META[ty].emoji} {typeName(ty)}</option>
          ))}
        </select>
      )}
      {value.type && (
        <button type="button" onClick={() => onChange(HAS_TYPE_OFF)} className="inline-flex min-h-11 sm:min-h-0 items-center gap-1 text-sm font-semibold text-[#0D9488] hover:underline">
          <X size={14} /> {t("customers.filter_clear")}
        </button>
      )}
    </div>
  );
}
