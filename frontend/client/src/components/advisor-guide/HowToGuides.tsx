import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { GUIDES, demoHref, uiLabelVars } from "@/lib/advisorGuide";

/**
 * Short numbered guides for the jobs advisors do most. A jump list first, so a
 * long page is one tap from the guide you came for.
 */
export function HowToGuides({ mode }: { mode: "public" | "portal" }) {
  const { t } = useLanguage();
  const labels = uiLabelVars(t);

  return (
    <div className="flex flex-col gap-10">
      <nav aria-label={t("aguide.jump_label")} className="flex flex-wrap gap-2">
        {GUIDES.map((g) => (
          <a
            key={g.id}
            href={`#guide-${g.id}`}
            className="inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-4 text-base font-medium text-slate-700 hover:border-[#0D9488] hover:text-[#0F766E]"
          >
            {t(`aguide.g_${g.id}_t`)}
          </a>
        ))}
      </nav>

      {GUIDES.map((g) => {
        const Icon = g.icon;
        const href = mode === "public" ? demoHref(g.route) : g.route;
        return (
          <section
            key={g.id}
            id={`guide-${g.id}`}
            aria-labelledby={`guide-${g.id}-h`}
            className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
          >
            <div className="flex items-center gap-3 mb-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F0FDFA] text-[#0F766E]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 id={`guide-${g.id}-h`} className="text-xl sm:text-2xl font-bold text-slate-900">
                {t(`aguide.g_${g.id}_t`)}
              </h2>
            </div>
            <ol className="flex flex-col gap-4">
              {Array.from({ length: g.steps }, (_, i) => (
                <li key={i} className="flex gap-4">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0D9488] text-base font-bold text-white"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-base sm:text-lg leading-relaxed text-slate-700">
                    {t(`aguide.g_${g.id}_s${i + 1}`, labels)}
                  </span>
                </li>
              ))}
            </ol>
            <Link
              href={href}
              className="mt-6 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[#0D9488] px-5 text-base font-semibold text-white hover:bg-[#0F766E]"
            >
              {mode === "public" ? t("aguide.try_in_demo") : t("aguide.go_there")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        );
      })}
    </div>
  );
}
