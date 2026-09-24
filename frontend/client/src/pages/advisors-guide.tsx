import { Link } from "wouter";
import { ArrowRight, PlayCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/use-seo";
import { useLanguage } from "@/i18n/LanguageContext";
import { FeatureGrid } from "@/components/advisor-guide/FeatureGrid";
import { HowToGuides } from "@/components/advisor-guide/HowToGuides";

type View = "features" | "howto";

const PATH: Record<View, string> = {
  features: "/advisors/features",
  howto: "/advisors/how-to-use",
};

// Kept in step with STATIC_ROUTES in scripts/prerender.mjs, which writes the
// same title and description into the HTML crawlers read first.
const SEO: Record<View, { title: string; description: string }> = {
  features: {
    title: "Features for Insurance Advisors | IndSure",
    description:
      "Every tool in the IndSure advisor portal: customers, leads, renewals, policy checks, compare, cover calculator, claims and your own website.",
  },
  howto: {
    title: "How to Use the IndSure Advisor Portal | IndSure",
    description:
      "Step-by-step guides for IndSure advisors: check a policy, share a report, compare plans, follow up leads, send renewal reminders on WhatsApp.",
  },
};

/**
 * Public advisor guide. The same content lives inside the portal at
 * /agent/help; the cards here open the demo instead of the real screens.
 */
export default function AdvisorsGuide({ view }: { view: View }) {
  const { t } = useLanguage();
  useSEO({ ...SEO[view], canonical: `https://indsure.in${PATH[view]}` });

  const tabs: { view: View; label: string }[] = [
    { view: "features", label: t("aguide.tab_features") },
    { view: "howto", label: t("aguide.tab_howto") },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <Header />

      <main className="flex-grow pt-24 pb-12 sm:pb-16 lg:pb-20 px-4 sm:px-6 w-full">
        <section className="max-w-4xl mx-auto text-center mb-8">
          <div className="inline-block py-1.5 px-3.5 border border-[var(--color-teal-600)]/25 bg-[var(--color-teal-50)] rounded-full text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-teal-700)] mb-4">
            {t("aguide.for_advisors")}
          </div>
          <h1 className="text-4xl md:text-5xl font-serif mb-4 tracking-tight leading-tight text-[var(--color-navy-900)]">
            {view === "features" ? t("aguide.features_h") : t("aguide.howto_h")}
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-secondary)] leading-relaxed max-w-2xl mx-auto">
            {view === "features" ? t("aguide.features_sub") : t("aguide.howto_sub")}
          </p>
        </section>

        <nav aria-label={t("aguide.tabs_label")} className="max-w-6xl mx-auto mb-10 flex justify-center gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.view}
              href={PATH[tab.view]}
              aria-current={tab.view === view ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full px-5 text-base font-semibold transition-colors ${
                tab.view === view
                  ? "bg-[var(--color-navy-900)] text-white"
                  : "border border-[var(--color-border-medium)] bg-white text-[var(--color-text-main)] hover:border-[var(--color-teal-600)]"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="max-w-6xl mx-auto mb-10">
          {view === "features" ? <FeatureGrid mode="public" /> : <HowToGuides mode="public" />}
        </div>

        <p className="max-w-6xl mx-auto mb-16 text-center text-lg text-[var(--color-text-secondary)]">
          {t("aguide.docs_more")}{" "}
          <Link href="/docs" className="font-semibold text-[var(--color-teal-700)] underline underline-offset-4">
            {t("aguide.docs_link")}
          </Link>
        </p>

        <section className="max-w-4xl mx-auto rounded-2xl bg-[var(--color-navy-900)] text-white p-6 sm:p-10 text-center">
          <h2 className="text-2xl sm:text-3xl font-serif mb-3">{t("aguide.cta_h")}</h2>
          <p className="text-lg text-white/80 max-w-2xl mx-auto mb-7">{t("aguide.cta_sub")}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/agent/playground?tour=1"
              className="inline-flex h-[52px] items-center justify-center gap-2 rounded-lg bg-[var(--color-cta)] px-6 text-base font-semibold text-white hover:bg-[var(--color-cta-hover)]"
            >
              <PlayCircle className="h-5 w-5" aria-hidden="true" />
              {t("aguide.cta_tour")}
            </Link>
            <Link
              href="/agent/signup/step1"
              className="inline-flex h-[52px] items-center justify-center gap-2 rounded-lg border border-white/30 px-6 text-base font-semibold text-white hover:bg-white/10"
            >
              {t("agent_landing.cta_start")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
