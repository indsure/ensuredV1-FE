import { Link, useSearch } from "wouter";
import { MessageCircle, PlayCircle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAgent } from "@/context/AgentContext";
import { FeatureGrid } from "@/components/advisor-guide/FeatureGrid";
import { HowToGuides } from "@/components/advisor-guide/HowToGuides";
import { teamWaLink } from "@/components/app/portfolio-utils";
import { isPlaygroundMode } from "@/lib/playground/mode";
import { startTour } from "@/lib/playground/tour";

/**
 * /agent/help — what every tool does and how to use it, inside the portal.
 * The same content as /advisors/features and /advisors/how-to-use, with every
 * link going to the real screen.
 */
export default function AgentHelp() {
  const { t } = useLanguage();
  const { team } = useAgent();
  const search = useSearch();
  const view = new URLSearchParams(search).get("tab") === "howto" ? "howto" : "features";

  const tabs = [
    { view: "features", label: t("aguide.tab_features"), href: "/agent/help" },
    { view: "howto", label: t("aguide.tab_howto"), href: "/agent/help?tab=howto" },
  ];

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{t("aguide.portal_h")}</h1>
        <p className="text-base sm:text-lg text-slate-600">{t("aguide.portal_sub")}</p>
      </header>

      {isPlaygroundMode() && (
        <button
          type="button"
          onClick={() => startTour()}
          className="self-start inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#0D9488] px-5 text-base font-semibold text-white hover:bg-[#0F766E]"
        >
          <PlayCircle className="h-5 w-5" aria-hidden="true" />
          {t("tour.take_tour")}
        </button>
      )}

      <nav aria-label={t("aguide.tabs_label")} className="flex gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.view}
            href={tab.href}
            aria-current={tab.view === view ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-5 text-base font-semibold transition-colors ${
              tab.view === view
                ? "bg-[#0B1120] text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:border-[#0D9488]"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {view === "features" ? <FeatureGrid mode="portal" isOwner={!!team?.isOwner} /> : <HowToGuides mode="portal" />}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{t("aguide.stuck_h")}</h2>
          <p className="text-base text-slate-600">{t("aguide.stuck_sub")}</p>
        </div>
        <a
          href={teamWaLink("Hi, I am an IndSure advisor and I need help with the portal.")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-base font-semibold text-slate-800 hover:border-[#0D9488]"
        >
          <MessageCircle className="h-5 w-5 text-[#0D9488]" aria-hidden="true" />
          {t("aguide.stuck_btn")}
        </a>
      </section>
    </div>
  );
}
