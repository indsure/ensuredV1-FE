import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Link } from "wouter";
import {
  Upload, ScanSearch, ShieldCheck, FileCheck2, Lock, Ban, ArrowRight, Plus,
} from "lucide-react";
import { Reveal, Stagger, RevealItem } from "@/components/motion";
import { Section, SectionHeading, Eyebrow, CTA } from "@/components/marketing";
import { useSEO } from "@/hooks/use-seo";
import { useLanguage } from "@/i18n/LanguageContext";

/* ============================================================
   HOW IT WORKS

   Copy corrections made here, all of them cases where the page
   contradicted the shipping product:

   - The hero promised "No forms" while step 01 asks for an
     account. It now says what the account actually costs you.
   - The closing CTA said "Two minutes. No signup." The product
     is gated behind an account, so that line is gone.
   - "forensic-grade" and "50+ individual risk checks per policy"
     had no source behind either. Both are now described by what
     the engine does rather than by an unbacked superlative.
   - Per-step second counts were precise to the second and
     sourced from nothing. The steps now carry what happens.
   ============================================================ */

// Visible strings in the data below are translation keys, rendered with t().
const steps = [
  {
    step: "01",
    icon: Upload,
    title: "how.s1",
    accent: "var(--lob-health)",
    wash: "var(--lob-health-wash)",
    chip: "how.s1_chip",
    summary: "how.s1_sum",
    details: [
      "how.s1_d1",
      "how.s1_d2",
      "how.s1_d3",
    ],
  },
  {
    step: "02",
    icon: ScanSearch,
    title: "how.s2",
    title2: "",
    accent: "var(--lob-life)",
    wash: "var(--lob-life-wash)",
    chip: "how.s2_chip",
    summary: "how.s2_sum",
    details: [
      "how.s2_d1",
      "how.s2_d2",
      "how.s2_d3",
    ],
  },
  {
    step: "03",
    icon: ShieldCheck,
    title: "how.s3",
    accent: "var(--lob-motor)",
    wash: "var(--lob-motor-wash)",
    chip: "how.s3_chip",
    summary: "how.s3_sum",
    details: [
      "how.s3_d1",
      "how.s3_d2",
      "how.s3_d3",
    ],
  },
  {
    step: "04",
    icon: FileCheck2,
    title: "how.s4",
    accent: "var(--lob-home)",
    wash: "var(--lob-home-wash)",
    chip: "how.s4_chip",
    summary: "how.s4_sum",
    details: [
      "how.s4_d1",
      "how.s4_d2",
      "how.s4_d3",
    ],
  },
];

const faqs = [
  {
    q: "how.q1",
    a: "how.a1",
  },
  {
    q: "how.q2",
    a: "how.a2",
  },
  {
    q: "how.q3",
    // No third-party sharing path exists in routes.ts; the only outbound
    // route is the consented "Talk to an advisor" flow, which the user starts.
    // claim-source: routes.ts:4565 (owner-initiated delete). Verified 2026-09-07.
    a: "how.a3",
  },
  {
    q: "how.q4",
    a: "how.a4",
  },
  {
    q: "how.q5",
    a: "how.a5",
  },
  {
    q: "how.q6",
    a: "how.a6",
  },
];

export default function HowItWorks() {
  const { t } = useLanguage();
  useSEO({
    title: "How IndSure Reads Your Policy: Upload, Decipher, Audit, Report | IndSure",
    description:
      "Four steps from a policy PDF to a plain-language verdict. See what the engine reads, what it checks against, and what you get back. Free to start, no commission, no sales calls.",
    canonical: "https://indsure.in/how-it-works",
  });

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <Header />

      <main className="flex-grow pt-32">

        {/* ─────────── HERO ─────────── */}
        <section className="relative overflow-hidden pb-12 sm:pb-16">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute inset-0 bg-grid-faint mask-fade-edges" />
            <div
              className="absolute -top-40 left-1/2 h-[520px] w-[880px] -translate-x-1/2 rounded-full opacity-70 blur-3xl"
              style={{ background: "radial-gradient(ellipse, rgba(45,212,191,0.20), transparent 68%)" }}
            />
          </div>

          <Reveal className="container-editorial relative mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            <Eyebrow>{t("how.eyebrow")}</Eyebrow>

            <h1 className="font-serif font-bold tracking-[-0.035em] leading-[1.05] text-4xl sm:text-6xl lg:text-7xl text-[var(--color-navy-900)]">
              {t("how.h_a")}
              <br />
              {t("how.h_b")} <span className="italic text-[var(--color-teal-600)]">{t("how.h_c")}</span>
            </h1>

            {/* This used to read "No forms. No sales calls." while step 01 asks
                for an account. It now says what the account is for. */}
            <p className="max-w-2xl text-lg sm:text-xl leading-relaxed text-[var(--color-text-secondary)]">
              {t("how.sub")}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <CTA href="/signup" icon={ArrowRight}>{t("how.check")}</CTA>
              <CTA href="/policychecker" variant="secondary">{t("how.see_all")}</CTA>
            </div>
          </Reveal>
        </section>

        {/* ─────────── STEPS ─────────── */}
        <Section surface="mint">
          <div className="container-editorial flex flex-col gap-12">
            <SectionHeading
              eyebrow={t("how.steps_eyebrow")}
              title={t("how.steps_h")}
              sub={t("how.steps_sub")}
            />

            {/* No connector spine between these: the cards are opaque, so a
                line behind them shows only in the gaps and reads as stray
                dashes. The step numbers and accent bars carry the sequence. */}
            <div className="flex flex-col gap-5">
              {steps.map((item, i) => (
                <Reveal key={item.step} delay={i * 0.06}>
                  <article className="group relative flex flex-col gap-6 overflow-hidden rounded-2xl bg-white p-6 transition-shadow duration-300 hover:shadow-[0_20px_50px_-18px_rgba(15,23,42,0.2)] sm:p-8 lg:flex-row lg:gap-10"
                    style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.05)" }}
                  >
                    <span
                      className="absolute inset-y-0 left-0 w-1"
                      style={{ backgroundColor: item.accent }}
                      aria-hidden="true"
                    />

                    <div className="flex shrink-0 items-center gap-4 lg:w-44 lg:flex-col lg:items-start lg:gap-3">
                      <span
                        className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl ring-4 ring-white transition-transform duration-300 group-hover:scale-105"
                        style={{ backgroundColor: item.wash, color: item.accent }}
                      >
                        <item.icon className="h-6 w-6" aria-hidden="true" />
                      </span>

                      <div className="flex flex-col gap-1">
                        <span
                          className="text-sm font-bold uppercase tracking-[0.16em]"
                          style={{ color: item.accent }}
                        >
                          {t("how.step_n", { n: item.step })}
                        </span>
                        <span
                          className="inline-flex w-fit rounded-full px-2.5 py-1 text-sm font-semibold"
                          style={{ backgroundColor: item.wash, color: item.accent }}
                        >
                          {t(item.chip)}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1">
                      <h3 className="font-serif text-2xl font-bold text-[var(--color-navy-900)] sm:text-3xl">
                        {t(item.title)}
                      </h3>
                      <p className="mt-3 text-lg leading-relaxed text-[var(--color-text-secondary)]">
                        {t(item.summary)}
                      </p>
                      <ul className="mt-5 flex flex-col gap-2.5">
                        {item.details.map((d) => (
                          <li key={d} className="flex items-start gap-3 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                            <span
                              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: item.accent }}
                              aria-hidden="true"
                            />
                            {t(d)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </Section>

        {/* ─────────── TRUST ─────────── */}
        <Section surface="white">
          <div className="container-editorial flex flex-col gap-10">
            <SectionHeading
              eyebrow={t("how.wont_eyebrow")}
              title={t("how.wont_h")}
              sub={t("how.wont_sub")}
              align="center"
            />

            <Stagger className="grid gap-6 md:grid-cols-2">
              {[
                {
                  icon: Lock,
                  accent: "var(--lob-life)",
                  wash: "var(--lob-life-wash)",
                  title: "how.p1",
                  body: "how.p1_b",
                },
                {
                  icon: Ban,
                  accent: "var(--lob-home)",
                  wash: "var(--lob-home-wash)",
                  title: "how.p2",
                  body: "how.p2_b",
                },
              ].map((p) => (
                <RevealItem key={p.title}>
                  <div
                    className="flex h-full items-start gap-5 rounded-2xl border border-[var(--color-border-light)] p-7"
                    style={{ backgroundColor: p.wash }}
                  >
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white"
                      style={{ color: p.accent }}
                    >
                      <p.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="font-serif text-xl font-bold text-[var(--color-navy-900)]">
                        {t(p.title)}
                      </h3>
                      <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                        {t(p.body)}
                      </p>
                    </div>
                  </div>
                </RevealItem>
              ))}
            </Stagger>
          </div>
        </Section>

        {/* ─────────── FAQ ─────────── */}
        <Section surface="cream" bordered>
          <div className="container-editorial mx-auto flex max-w-3xl flex-col gap-10">
            <SectionHeading
              eyebrow={t("how.q_eyebrow")}
              title={t("how.q_h")}
              align="center"
            />

            <Stagger className="flex flex-col gap-3">
              {faqs.map((f) => (
                <RevealItem key={f.q}>
                  {/* <details> rather than a JS accordion: it is keyboard and
                      screen-reader correct for free, and it works before the
                      bundle loads on a slow connection. */}
                  <details className="group rounded-xl border border-[var(--color-border-light)] bg-white px-5 py-4 transition-colors open:border-[var(--color-teal-600)]/30">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[17px] font-semibold text-[var(--color-navy-900)]">
                      {t(f.q)}
                      <Plus
                        className="mt-1 h-5 w-5 shrink-0 text-[var(--color-teal-600)] transition-transform duration-300 group-open:rotate-45"
                        aria-hidden="true"
                      />
                    </summary>
                    <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                      {t(f.a)}
                    </p>
                  </details>
                </RevealItem>
              ))}
            </Stagger>
          </div>
        </Section>

        {/* ─────────── CTA ─────────── */}
        <Section surface="ink" className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute inset-0 bg-grid-faint-dark mask-fade-edges" />
            <div
              className="absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 -translate-y-1/3 rounded-full blur-3xl"
              style={{ background: "radial-gradient(ellipse, rgba(45,212,191,0.22), transparent 70%)" }}
            />
          </div>

          <Reveal className="container-editorial relative flex flex-col items-center gap-6 text-center">
            <h2 className="font-serif text-3xl font-bold tracking-[-0.03em] leading-[1.1] text-white sm:text-5xl">
              {t("how.ready")}
            </h2>

            {/* Was "Two minutes. No signup. Just clarity." The product has been
                gated behind an account since the D2C portfolio shipped. */}
            <p className="max-w-2xl text-lg leading-relaxed text-white/80">
              {t("how.ready_sub")}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <CTA href="/signup" icon={ArrowRight}>{t("how.check_cov")}</CTA>
              <CTA href="/compare" variant="ghost-ink">{t("how.compare")}</CTA>
            </div>
          </Reveal>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
