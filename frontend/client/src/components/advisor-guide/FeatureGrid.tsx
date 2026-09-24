import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { FEATURE_GROUPS, demoHref, uiLabelVars } from "@/lib/advisorGuide";

/**
 * Every portal tool, grouped by the job it serves. Public mode links each card
 * into the demo; portal mode links straight to the real screen.
 */
export function FeatureGrid({ mode, isOwner = false }: { mode: "public" | "portal"; isOwner?: boolean }) {
  const { t } = useLanguage();
  const labels = uiLabelVars(t);

  return (
    <div className="flex flex-col gap-12">
      {FEATURE_GROUPS.map((group) => {
        // Inside the portal a non-owner has no Team screen, so do not offer one.
        const features = group.features.filter((f) => mode === "public" || !f.ownersOnly || isOwner);
        return (
          <section key={group.id} aria-labelledby={`grp-${group.id}`}>
            <h2 id={`grp-${group.id}`} className="text-xl sm:text-2xl font-bold text-slate-900 mb-5">
              {t(`aguide.grp_${group.id}`)}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((f) => {
                const Icon = f.icon;
                const href = mode === "public" ? demoHref(f.route) : f.route;
                return (
                  <Link
                    key={f.id}
                    href={href}
                    className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-[#0D9488]"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F0FDFA] text-[#0F766E]">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-lg font-bold text-slate-900">{t(`aguide.f_${f.id}_t`)}</span>
                    <span className="text-base leading-relaxed text-slate-600">{t(`aguide.f_${f.id}_d`, labels)}</span>
                    {f.ownersOnly && (
                      <span className="text-sm font-medium text-slate-500">{t("aguide.owners_only")}</span>
                    )}
                    <span className="mt-auto inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-[#0F766E]">
                      {mode === "public" ? t("aguide.see_in_demo") : t("aguide.open_it")}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
