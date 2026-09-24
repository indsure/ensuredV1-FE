import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Link } from "wouter";
import { Mail, MessagesSquare, BookOpen, Plus, ArrowRight, Briefcase } from "lucide-react";
import { Reveal, Stagger, RevealItem } from "@/components/motion";
import { Section, SectionHeading, Eyebrow, CTA } from "@/components/marketing";
import { useLanguage } from "@/i18n/LanguageContext";

/* ============================================================
   HELP

   This page predated the public-site design system and still
   wore the old look: a mint page wash, four pulsing blurred
   blobs, generic grey type and shadcn cards. It is rebuilt on
   the same kit as /why-indsure and /pricing: cream hero with a
   serif headline, one mint section for the questions, an ink
   close. The FAQ copy is unchanged, only the chrome is new.
   ============================================================ */

const SUPPORT_EMAIL = "nikhil@indsure.in";

// Visible strings are translation keys, rendered with t().
const faqItems = [
  { q: "help.q1", a: "help.a1" },
  // Policies persist in individual_policies and are removed only by their
  // owner. That handler deletes the storage object FIRST and refuses to
  // drop the row if the file delete fails, which is what the "we leave the
  // record alone" sentence describes. The 90 days is RETENTION_GRACE_DAYS.
  // claim-source: backend/server/routes.ts:4565, :4584-4596;
  // pages/app/portfolio.tsx:157; backend/server/index.ts:80.
  { q: "help.q2", a: "help.a2" },
  { q: "help.q3", a: "help.a3" },
  { q: "help.q4", a: "help.a4" },
  { q: "help.q5", a: "help.a5" },
  { q: "help.q6", a: "help.a6" },
  { q: "help.q7", a: "help.a7" },
  // Plan contents and the ₹999 price mirror the live /pricing table. "No
  // expiry" is enforced server-side: the 30-day trial gate was removed and
  // Free is now capped by slots, not by time.
  // claim-source: pricing.tsx; backend/server/routes.ts:771, :784-789.
  { q: "help.q8", a: "help.a8" },
];

/* Three ways in. The third used to be labelled "Documentation" and
   pointed at /blog, which is articles, not docs, so it now says what
   it is. Colours are health / life / travel so the row reads as three
   different doors rather than one card printed three times. */
const routes = [
  {
    icon: Mail,
    title: "help.email_t",
    body: "help.email_d",
    action: SUPPORT_EMAIL,
    href: `mailto:${SUPPORT_EMAIL}`,
    accent: "var(--lob-health)",
    wash: "var(--lob-health-wash)",
  },
  {
    icon: MessagesSquare,
    title: "help.faq_t",
    body: "help.faq_d",
    action: "help.faq_a",
    href: "#faq",
    accent: "var(--lob-life)",
    wash: "var(--lob-life-wash)",
  },
  {
    icon: BookOpen,
    title: "help.guides_t",
    body: "help.guides_d",
    action: "help.guides_a",
    href: "/blog",
    accent: "var(--lob-travel)",
    wash: "var(--lob-travel-wash)",
  },
];

// Same look as the shared CTA, but a plain <a>: wouter's Link would treat
// a mailto: as an in-app route.
const MAIL_CTA =
  "inline-flex h-[52px] items-center justify-center gap-2 rounded-lg px-6 text-base font-semibold transition-all duration-200 bg-[var(--color-cta)] text-white hover:bg-[#0F766E] hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-8px_rgba(13,148,136,0.6)]";

export default function Help() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <Header />

      <main id="main-content" className="flex-grow pt-32" role="main">

        {/* ─────────── HERO ─────────── */}
        <section className="relative overflow-hidden pb-14 sm:pb-20">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute inset-0 bg-grid-faint mask-fade-edges" />
            <div
              className="absolute -top-40 left-1/2 h-[540px] w-[900px] -translate-x-1/2 rounded-full opacity-70 blur-3xl"
              style={{ background: "radial-gradient(ellipse, rgba(45,212,191,0.20), transparent 68%)" }}
            />
          </div>

          <div className="container-editorial relative">
            <Reveal className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
              <Eyebrow>{t("help.eyebrow")}</Eyebrow>

              <h1 className="font-serif font-bold tracking-[-0.035em] leading-[1.05] text-4xl sm:text-6xl lg:text-7xl text-[var(--color-navy-900)]">
                {t("help.h_a")}
                <br />
                <span className="italic text-[var(--color-teal-600)]">{t("help.h_b")}</span>
              </h1>

              <p className="max-w-2xl text-lg sm:text-xl leading-relaxed text-[var(--color-text-secondary)]">
                {t("help.sub")}
              </p>
            </Reveal>

            {/* ─────────── THREE DOORS ─────────── */}
            <Stagger className="mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-3">
              {routes.map((r) => {
                const isMail = r.href.startsWith("mailto:");
                const card = (
                  <article
                    className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl bg-white p-7 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_-16px_rgba(15,23,42,0.18)]"
                    style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.05), 0 0 0 1px rgba(15,23,42,0.05)" }}
                  >
                    <span
                      className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
                      style={{ backgroundColor: r.accent }}
                      aria-hidden="true"
                    />

                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105"
                      style={{ backgroundColor: r.wash, color: r.accent }}
                    >
                      <r.icon className="h-5 w-5" aria-hidden="true" />
                    </span>

                    <div className="flex flex-col gap-1.5">
                      <h2 className="font-serif text-2xl font-bold text-[var(--color-navy-900)]">
                        {t(r.title)}
                      </h2>
                      <p className="text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                        {t(r.body)}
                      </p>
                    </div>

                    <span
                      className="mt-auto inline-flex items-center gap-2 pt-2 text-base font-semibold break-all"
                      style={{ color: r.accent }}
                    >
                      {isMail ? r.action : t(r.action)}
                      <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                    </span>
                  </article>
                );

                return (
                  <RevealItem key={r.title}>
                    {isMail || r.href.startsWith("#") ? (
                      <a href={r.href} className="block h-full rounded-2xl">{card}</a>
                    ) : (
                      <Link href={r.href} className="block h-full rounded-2xl">{card}</Link>
                    )}
                  </RevealItem>
                );
              })}
            </Stagger>
          </div>
        </section>

        {/* ─────────── QUESTIONS ─────────── */}
        <Section surface="mint" id="faq">
          <div className="container-editorial grid gap-10 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-16">
            <div className="flex flex-col gap-6 lg:sticky lg:top-32 lg:self-start">
              <SectionHeading
                eyebrow={t("help.faq_eyebrow")}
                title={t("help.faq_h")}
                sub={t("help.faq_sub")}
              />

              {/* Advisors land here from the footer too. Their answers live
                  in /docs, so point them there instead of making them read
                  consumer questions. */}
              <Link
                href="/docs"
                className="group flex items-start gap-4 rounded-2xl border border-[var(--color-border-light)] bg-white p-5 transition-colors hover:border-[var(--color-teal-600)]/40"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "var(--lob-business-wash)", color: "var(--lob-business)" }}
                >
                  <Briefcase className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-base font-semibold text-[var(--color-navy-900)]">
                    {t("help.adv_t")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[var(--color-teal-600)]">
                    {t("help.adv_a")}
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                </span>
              </Link>
            </div>

            <Stagger className="flex flex-col gap-3">
              {faqItems.map((f) => (
                <RevealItem key={f.q}>
                  <details className="group rounded-xl border border-[var(--color-border-light)] bg-white px-5 py-4 open:border-[var(--color-teal-600)]/30">
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

        {/* ─────────── CLOSE ─────────── */}
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
              {t("help.still")}
            </h2>

            <p className="max-w-2xl text-lg leading-relaxed text-white/80">
              {t("help.here")}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a href={`mailto:${SUPPORT_EMAIL}`} className={MAIL_CTA}>
                <Mail className="h-4 w-4" aria-hidden="true" />
                {t("help.email_us")}
              </a>
              <CTA href="/" variant="ghost-ink">{t("help.back_home")}</CTA>
            </div>

            <p className="text-sm text-white/60">{SUPPORT_EMAIL}</p>
          </Reveal>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
