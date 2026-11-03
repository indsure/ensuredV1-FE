import { Link, useLocation } from "wouter";
import {
  Heart,
  Users,
  Car,
  ArrowRight,
  FileText,
  Calculator,
  Scale,
  FileSearch,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/motion";
import { Section, SectionHeading, Eyebrow, LOB } from "@/components/marketing";
import { useSEO } from "@/hooks/use-seo";
import { loadSampleReport, mockReport, mockReportLife, mockReportVehicle } from "@/lib/mock-data";
import { useLanguage } from "@/i18n/LanguageContext";

export default function AnalyzePage() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  useSEO({
    title: "Analyze Your Insurance Policy | Health, Life, Vehicle Insurance Analyzer | IndSure",
    description: "Choose your insurance type: Health, Life, or Vehicle. Upload your policy PDF and get instant analysis of your coverage, gaps, and recommendations.",
    keywords: "insurance analyzer, health insurance analyzer, life insurance analyzer, vehicle insurance analyzer, policy analyzer",
    canonical: "/analyze",
    // Superseded by /policychecker, /life, /term and /vehicle; not in the sitemap.
    noindex: true,
  });

  // Each check starts at the customer login; ?next= brings them back to that
  // checker once they are signed in.
  const insuranceTypes = [
    {
      id: "health",
      title: t("cflow.an_health"),
      cta: t("cflow.an_health_cta"),
      description: t("cflow.an_health_d"),
      icon: Heart,
      lob: LOB.health,
      href: "/login?next=/policychecker",
      badge: t("cflow.an_popular"),
      sampleReport: mockReport,
    },
    {
      id: "life",
      title: t("cflow.an_life"),
      cta: t("cflow.an_life_cta"),
      description: t("cflow.an_life_d"),
      icon: Users,
      lob: LOB.life,
      href: "/login?next=/life",
      badge: null,
      sampleReport: mockReportLife,
    },
    {
      id: "vehicle",
      title: t("cflow.an_vehicle"),
      cta: t("cflow.an_vehicle_cta"),
      description: t("cflow.an_vehicle_d"),
      icon: Car,
      lob: LOB.motor,
      href: "/login?next=/vehicle",
      badge: null,
      sampleReport: mockReportVehicle,
    },
  ];

  const tools = [
    { icon: Calculator, title: t("cflow.an_calc"), body: t("cflow.an_calc_b"), cta: t("cflow.an_calc_cta"), href: "/calculator" },
    { icon: Scale, title: t("cflow.an_cmp"), body: t("cflow.an_cmp_b"), cta: t("cflow.an_cmp_cta"), href: "/compare" },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <Header />

      <main className="flex-grow pt-32">

        {/* HERO. Same cream hero as /pricing and /calculator. This page used to
            carry the old dark cyan gradient, and the base h1 colour painted the
            heading navy on top of it, so it could not be read. */}
        <section className="relative overflow-hidden pb-12">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute inset-0 bg-grid-faint mask-fade-edges" />
            <div
              className="absolute -top-40 left-1/2 h-[480px] w-[860px] -translate-x-1/2 rounded-full opacity-70"
              style={{ background: "radial-gradient(ellipse, rgba(45,212,191,0.20), transparent 68%)" }}
            />
          </div>

          <Reveal className="container-editorial relative mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            <Eyebrow icon={FileText}>{t("cflow.an_choose")}</Eyebrow>
            <h1 className="font-serif font-bold tracking-[-0.035em] leading-[1.05] text-4xl sm:text-6xl text-[var(--color-navy-900)]">
              {t("cflow.an_h")}
            </h1>
            <p className="max-w-2xl text-lg sm:text-xl leading-relaxed text-[var(--color-text-secondary)]">
              {t("cflow.an_sub")}
            </p>
          </Reveal>
        </section>

        {/* INSURANCE TYPES. Each card carries its line-of-business colour. */}
        <Section surface="mint" size="tight">
          <div className="container-editorial">
            <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3 md:items-stretch">
              {insuranceTypes.map((type, i) => {
                const Icon = type.icon;
                return (
                  <Reveal key={type.id} delay={i * 0.08} className="h-full">
                    <div
                      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-shadow duration-300 hover:shadow-[0_16px_40px_-16px_rgba(15,23,42,0.2)]"
                      style={{ outline: "1px solid var(--color-border-light)", outlineOffset: -1 }}
                      onClick={() => setLocation(type.href)}
                    >
                      <div className="flex items-start justify-between gap-3 px-7 pt-7 pb-6" style={{ backgroundColor: type.lob.wash }}>
                        <div
                          className="flex h-14 w-14 items-center justify-center rounded-xl bg-white"
                          style={{ color: type.lob.accent, boxShadow: "0 1px 2px rgba(15,23,42,0.06)" }}
                        >
                          <Icon className="h-7 w-7" strokeWidth={1.75} aria-hidden="true" />
                        </div>
                        {type.badge ? (
                          <span
                            className="rounded-full px-3 py-1 text-sm font-bold uppercase tracking-[0.1em] text-white"
                            style={{ backgroundColor: type.lob.accent }}
                          >
                            {type.badge}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-1 flex-col gap-4 p-7">
                        <h2 className="font-serif text-2xl font-bold text-[var(--color-navy-900)]">
                          {type.title}
                        </h2>
                        <p className="text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                          {type.description}
                        </p>

                        <div className="mt-auto flex flex-col gap-1 pt-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(type.href);
                            }}
                            className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-cta)] text-base font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0F766E]"
                          >
                            {type.cta}
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              loadSampleReport(type.sampleReport);
                              setLocation("/report?sample=" + type.id);
                            }}
                            className="flex min-h-11 w-full items-center justify-center gap-2 text-[15px] font-semibold text-[var(--color-teal-700)] hover:text-[var(--color-navy-900)]"
                          >
                            <FileSearch className="h-4 w-4" aria-hidden="true" />
                            {t("cflow.an_sample")}
                          </button>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </Section>

        {/* RELATED TOOLS */}
        <Section surface="cream" size="tight" bordered>
          <div className="container-editorial flex flex-col items-center gap-10">
            <SectionHeading title={t("cflow.an_more")} align="center" />
            <div className="grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <div
                    key={tool.href}
                    className="flex flex-col gap-4 rounded-2xl bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
                    style={{ outline: "1px solid var(--color-border-light)", outlineOffset: -1 }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--lob-health-wash)] text-[var(--color-teal-600)]">
                        <Icon className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <h3 className="font-serif text-xl font-bold text-[var(--color-navy-900)]">{tool.title}</h3>
                    </div>
                    <p className="text-[15px] leading-relaxed text-[var(--color-text-secondary)]">{tool.body}</p>
                    <Link
                      href={tool.href}
                      className="mt-auto inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-border-medium)] bg-white text-base font-semibold text-[var(--color-text-main)] transition-all duration-200 hover:border-[var(--color-teal-600)] hover:text-[var(--color-teal-600)]"
                    >
                      {tool.cta}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
