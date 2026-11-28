import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { useLanguage } from "@/i18n/LanguageContext";
import {
  LIC_PLANS,
  LIC_PLAN_CATEGORIES,
  licPlanFamily,
  type LicPlan,
  type LicPlanCategory,
  type LicPlanStatus,
} from "@shared/licPlans";

// Same shape as the Rider Directory: search, two filters, a count, then cards.
// The number is the headline on every card because it is what the agent is holding:
// the Premium Due list and the Commission sheet print the plan number, not the name.

const SORTED = [...LIC_PLANS].sort((a, b) => a.no - b.no);

export default function LicPlanDirectory() {
  const { t, locale } = useLanguage();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | LicPlanStatus>("all");
  const [category, setCategory] = useState<"all" | LicPlanCategory>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // "149/77" or "945-15" pasted from a sheet: the plan is the part before the slash, exact.
    // Bare digits match as a prefix while typing, so "14" shows 14, 147, 148 and 149.
    const pasted = /^\d{1,3}\s*[/-]\s*\d+$/.test(q) ? parseInt(q, 10) : null;
    const digits = /^\d{1,3}$/.test(q) ? q : null;
    const rows = SORTED.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (category !== "all" && p.category !== category) return false;
      if (pasted !== null) return p.no === pasted;
      if (digits !== null) return String(p.no).startsWith(digits);
      if (q) return `${p.no} ${p.name}`.toLowerCase().includes(q);
      return true;
    });
    return rows;
  }, [search, status, category]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 font-['Playfair_Display']">{t("lic_plans.title")}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {t("lic_plans.subtitle", { count: LIC_PLANS.length })}
          {locale === "hi" && <> {t("lic_plans.details_english")}</>}
        </p>
      </div>

      {/* TOOLBAR */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="search"
            inputMode="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("lic_plans.search")}
            aria-label={t("lic_plans.search")}
            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as LicPlanStatus | "all")}
          aria-label={t("lic_plans.all_status")}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
        >
          <option value="all">{t("lic_plans.all_status")}</option>
          <option value="current">{t("lic_plans.status_current")}</option>
          <option value="withdrawn">{t("lic_plans.status_withdrawn")}</option>
          <option value="unsure">{t("lic_plans.status_unsure")}</option>
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as LicPlanCategory | "all")}
          aria-label={t("lic_plans.all_types")}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30"
        >
          <option value="all">{t("lic_plans.all_types")}</option>
          {LIC_PLAN_CATEGORIES.map((c) => (
            <option key={c} value={c}>{t(`lic_plans.cat.${c}`)}</option>
          ))}
        </select>
      </div>

      {/* COUNT */}
      <div className="text-xs text-slate-500">
        {t(filtered.length === 1 ? "lic_plans.showing_one" : "lic_plans.showing_many", { count: filtered.length })}
      </div>

      {/* LIST */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-10 lg:p-16 text-center text-slate-500 italic">
          {t("lic_plans.none")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((p) => (
            <PlanCard key={p.no} plan={p} onPick={(no) => setSearch(String(no))} />
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_STYLE: Record<LicPlanStatus, string> = {
  current: "bg-teal-50 text-teal-800 border-teal-100",
  withdrawn: "bg-slate-100 text-slate-600 border-slate-200",
  unsure: "bg-amber-50 text-amber-800 border-amber-100",
};

function PlanCard({ plan, onPick }: { plan: LicPlan; onPick: (no: number) => void }) {
  const { t } = useLanguage();
  const family = licPlanFamily(plan.no);
  const d = plan.details;
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="shrink-0 rounded-xl bg-[#0B1120] px-3 py-2 text-lg font-bold tabular-nums text-white">{plan.no}</span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-800">{plan.name}</div>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[plan.status]}`}>
              {t(`lic_plans.status_${plan.status}`)}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wider">
              {t(`lic_plans.cat.${plan.category}`)}
            </span>
          </div>
        </div>
      </div>

      {d && (
        <>
          <p className="mt-3 text-xs text-slate-600 leading-relaxed">{d.maturity}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            <Field label={t("lic_plans.f_type")} value={d.type} span />
            <Field label={t("lic_plans.f_sold")} value={d.sold} span />
            <Field label={t("lic_plans.f_term")} value={d.term} />
            <Field label={t("lic_plans.f_premium_term")} value={d.premiumTerm} />
            <Field label={t("lic_plans.f_bonus")} value={d.bonus} span />
          </dl>
        </>
      )}

      {family.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 flex-wrap text-[11px]">
          <span className="font-black uppercase tracking-widest text-slate-500">{t("lic_plans.other_versions")}</span>
          {family.map((f) => (
            <button
              key={f.no}
              type="button"
              onClick={() => onPick(f.no)}
              className="rounded-full border border-slate-200 px-2 py-0.5 font-bold tabular-nums text-slate-700 hover:border-[#0D9488] hover:text-[#0F766E]"
            >
              {f.no}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, span }: { label: string; value?: string; span?: boolean }) {
  if (!value) return null;
  return (
    <div className={span ? "col-span-2" : ""}>
      <dt className="font-black uppercase tracking-widest text-slate-500">{label}</dt>
      <dd className="text-slate-700">{value}</dd>
    </div>
  );
}
