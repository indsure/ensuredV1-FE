import { Link, useLocation } from "wouter";
import {
  Shield, Lock, Clock, FileText, Search, Zap, ArrowRight,
  Ruler, Percent, CalendarClock, Ban, Layers, Building2, MapPin, RotateCcw,
} from "lucide-react";
import { loadSampleReport, mockReportHealth } from "@/lib/mock-data";
import { Reveal, Stagger, RevealItem } from "@/components/motion";
import { Section, SectionHeading, Eyebrow, CTA } from "@/components/marketing";
import { ClauseDecoder, ScoreDial, SpotlightCard } from "@/components/marketing/showcase";
import { useLanguage } from "@/i18n/LanguageContext";

/* ============================================================
   POLICY CHECKER — value page

   The old version led with a sign-up card and then listed twelve
   check names in four grey columns. It described the product
   without ever showing it, on a page whose entire job is to make
   someone believe a policy check is worth an account.

   It now shows the decode first and asks for the account after.
   ============================================================ */

/* Every check below maps to a clause class the engine extracts.
   Grouped the way a customer would ask about them, not the way the
   pipeline is organised. Visible strings are translation keys. */
const CHECK_GROUPS = [
  {
    title: "pcl.g1",
    accent: "var(--lob-health)",
    wash: "var(--lob-health-wash)",
    icon: Ruler,
    items: [
      { icon: Ruler, label: "pcl.i1", note: "pcl.i1n" },
      { icon: Percent, label: "pcl.i2", note: "pcl.i2n" },
      { icon: Layers, label: "pcl.i3", note: "pcl.i3n" },
    ],
  },
  {
    title: "pcl.g2",
    accent: "var(--lob-life)",
    wash: "var(--lob-life-wash)",
    icon: CalendarClock,
    items: [
      { icon: CalendarClock, label: "pcl.i4", note: "pcl.i4n" },
      { icon: Ban, label: "pcl.i5", note: "pcl.i5n" },
      { icon: RotateCcw, label: "pcl.i6", note: "pcl.i6n" },
    ],
  },
  {
    title: "pcl.g3",
    accent: "var(--lob-motor)",
    wash: "var(--lob-motor-wash)",
    icon: MapPin,
    items: [
      { icon: MapPin, label: "pcl.i7", note: "pcl.i7n" },
      { icon: Building2, label: "pcl.i8", note: "pcl.i8n" },
      { icon: Shield, label: "pcl.i9", note: "pcl.i9n" },
    ],
  },
];

const OUTCOMES = [
  {
    icon: Search,
    accent: "var(--lob-health)",
    wash: "var(--lob-health-wash)",
    title: "pcl.o1",
    body: "pcl.o1b",
  },
  {
    icon: FileText,
    accent: "var(--lob-life)",
    wash: "var(--lob-life-wash)",
    title: "pcl.o2",
    body: "pcl.o2b",
  },
  {
    icon: Zap,
    accent: "var(--lob-motor)",
    wash: "var(--lob-motor-wash)",
    title: "pcl.o3",
    body: "pcl.o3b",
  },
];

export function PolicyCheckerLanding() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  return (
    <>
      {/* ─────────── HERO ─────────── */}
      <section className="relative overflow-hidden pb-14">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-grid-faint mask-fade-edges" />
          <div
            className="absolute -top-32 right-0 h-[480px] w-[620px] rounded-full opacity-60 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(45,212,191,0.20), transparent 68%)" }}
          />
        </div>

        <div className="container-editorial relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-center">
          <Reveal className="flex flex-col items-start gap-6">
            {/* The eyebrow sits INSIDE the h1 so the heading carries the words
                people search for; the slogan alone told Google nothing. */}
            <h1 className="flex flex-col items-start gap-6">
              <Eyebrow className="font-sans">{t("pcl.eyebrow")}</Eyebrow>
              <span className="block font-serif font-bold tracking-[-0.035em] leading-[1.05] text-4xl sm:text-6xl text-[var(--color-navy-900)]">
                {t("pcl.h_a")}
                <br />
                <span className="italic text-[var(--color-teal-600)]">{t("pcl.h_b")}</span>
              </span>
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-[var(--color-text-secondary)]">
              {t("pcl.sub")}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <CTA href="/signup" icon={ArrowRight}>{t("pcl.check")}</CTA>
              <CTA
                variant="secondary"
                onClick={() => { loadSampleReport(mockReportHealth); setLocation("/report?sample=health"); }}
              >
                {t("pcl.finished")}
              </CTA>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] text-[var(--color-text-secondary)]">
              <span className="flex items-center gap-1.5">
                <Lock className="h-4 w-4 shrink-0 text-[var(--color-teal-600)]" aria-hidden="true" />
                {t("pcl.private")}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 shrink-0 text-[var(--color-teal-600)]" aria-hidden="true" />
                {t("pcl.minute")}
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="h-4 w-4 shrink-0 text-[var(--color-teal-600)]" aria-hidden="true" />
                {t("pcl.pdf_photo")}
              </span>
            </div>
          </Reveal>

          {/* The score is what a customer actually reads across a desk, so it
              stands in for the whole report here. */}
          <Reveal from="right" className="flex justify-center lg:justify-end">
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-7"
              style={{ boxShadow: "0 0 0 1px rgba(15,23,42,0.07), 0 30px 60px -24px rgba(15,23,42,0.24)" }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                  {t("pcl.score")}
                </span>
                <span className="rounded-md bg-[var(--color-cream-dark)] px-2 py-1 text-sm font-semibold text-[var(--color-text-secondary)]">
                  {t("pcl.illustrative")}
                </span>
              </div>

              <ScoreDial
                score={63}
                caption={t("pcl.dial_caption")}
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─────────── THE DECODER ─────────── */}
      <Section surface="mint">
        <div className="container-editorial flex flex-col gap-10">
          <SectionHeading
            eyebrow={t("pcl.dec_eyebrow")}
            title={t("pcl.dec_h")}
            sub={t("pcl.dec_sub")}
          />

          <Reveal>
            <ClauseDecoder />
          </Reveal>

          <Reveal className="text-center">
            <p className="text-[15px] text-[var(--color-text-secondary)]">
              {t("pcl.every_clause")}
            </p>
          </Reveal>
        </div>
      </Section>

      {/* ─────────── WHAT WE CHECK ─────────── */}
      <Section surface="white">
        <div className="container-editorial flex flex-col gap-10">
          <SectionHeading
            eyebrow={t("pcl.chk_eyebrow")}
            title={t("pcl.chk_h")}
            sub={t("pcl.chk_sub")}
          />

          <Stagger className="grid gap-6 md:grid-cols-3">
            {CHECK_GROUPS.map((g) => (
              <RevealItem key={g.title} className="h-full">
                <SpotlightCard accent={g.accent} className="h-full">
                  <div className="flex h-full flex-col gap-5 p-6">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                        style={{ backgroundColor: g.wash, color: g.accent }}
                      >
                        <g.icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <h3 className="font-serif text-xl font-bold text-[var(--color-navy-900)]">
                        {t(g.title)}
                      </h3>
                    </div>

                    <ul className="flex flex-col gap-4">
                      {g.items.map((it) => (
                        <li key={it.label} className="flex items-start gap-3">
                          <it.icon
                            className="mt-0.5 h-[18px] w-[18px] shrink-0"
                            style={{ color: g.accent }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0">
                            <span className="block text-[15px] font-semibold text-[var(--color-navy-900)]">
                              {t(it.label)}
                            </span>
                            <span className="block text-sm leading-snug text-[var(--color-text-secondary)]">
                              {t(it.note)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </SpotlightCard>
              </RevealItem>
            ))}
          </Stagger>
        </div>
      </Section>

      {/* ─────────── WHAT YOU GET ─────────── */}
      <Section surface="cream" bordered>
        <div className="container-editorial flex flex-col gap-10">
          <SectionHeading
            eyebrow={t("pcl.back_eyebrow")}
            title={t("pcl.back_h")}
            align="center"
          />

          <Stagger className="grid gap-6 md:grid-cols-3">
            {OUTCOMES.map((o) => (
              <RevealItem key={o.title} className="h-full">
                <div
                  className="flex h-full flex-col gap-3 rounded-2xl border border-[var(--color-border-light)] bg-white p-6"
                  style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
                >
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ backgroundColor: o.wash, color: o.accent }}
                  >
                    <o.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="font-serif text-xl font-bold text-[var(--color-navy-900)]">
                    {t(o.title)}
                  </h3>
                  <p className="text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                    {t(o.body)}
                  </p>
                </div>
              </RevealItem>
            ))}
          </Stagger>

          {/* Samples run on mock data and are open to signed-out visitors. */}
          <Reveal className="flex flex-col items-center gap-4 pt-4">
            <span className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              {t("pcl.read_first")}
            </span>

            <div className="flex flex-wrap justify-center gap-3">
              {[
                { label: "pcl.s1", href: "/report?sample=health", accent: "var(--lob-health)" },
                { label: "pcl.s2", href: "/report?sample=life", accent: "var(--lob-life)" },
                { label: "pcl.s3", href: "/report?sample=vehicle", accent: "var(--lob-motor)" },
              ].map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-white px-4 text-[15px] font-semibold transition-all duration-200 hover:-translate-y-0.5"
                  style={{ borderColor: `${s.accent}44`, color: s.accent }}
                >
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  {t(s.label)}
                </Link>
              ))}
            </div>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
