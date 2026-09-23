import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { teamWaLink } from "@/components/app/portfolio-utils";
import { Link } from "wouter";
import { Check, Minus, ShieldCheck, ArrowRight, Plus } from "lucide-react";
import { Reveal, Stagger, RevealItem } from "@/components/motion";
import { Section, SectionHeading, Eyebrow, CTA } from "@/components/marketing";
import { useLanguage } from "@/i18n/LanguageContext";

// Consumer pricing. The advisor plans (Free / ₹1,499 / ₹1,199 a seat) moved to
// /advisors/pricing — this URL is the one the portfolio's own upgrade CTAs
// point at (see pages/app/portfolio.tsx), so it has to speak to a person
// holding their own policies, not to someone selling them.
//
// The free tier below describes what checkIndividualQuota actually enforces:
// one policy per line of business, metered by slots and NOT by time.
//
// This comment used to say the server enforced a 30-day trial window, which
// stopped being true when the trial gate was removed from checkIndividualQuota
// (backend/server/routes.ts:784-787 — "Free is forever, not a trial ... Slots
// are now the only thing that meters the free plan"). The stale comment, not
// the card, was the thing that was wrong: an audit read it and flagged the
// page's "forever" copy as a false claim. Verified against the server on
// 2026-08-31. If the gate ever comes back, change the card and this note.
//
// Every visible string in the data below is a translation key, rendered with t().

type TierFeature = { label: string; muted?: boolean };

type Tier = {
  name: string;
  tagline: string;
  price: string;
  priceAnnual: string;
  period: string;
  periodAnnual: string;
  subline: string;
  sublineAnnual: string;
  features: TierFeature[];
  cta: string;
  ctaHref: string;
  /** Leaves the site (WhatsApp), so it renders as an anchor, not a router link. */
  ctaExternal?: boolean;
  highlighted?: boolean;
};

const tiers: Tier[] = [
  {
    name: "pricing.free",
    tagline: "pricing.free_tag",
    price: "₹0",
    priceAnnual: "₹0",
    period: "pricing.forever",
    periodAnnual: "pricing.forever",
    subline: "pricing.no_card",
    sublineAnnual: "pricing.no_card",
    features: [
      { label: "pricing.ff1" },
      { label: "pricing.ff2" },
      { label: "pricing.ff3" },
      { label: "pricing.ff4" },
      { label: "pricing.ff5" },
      // claim-source: backend/server/routes.ts:772-798 (FREE_SLOTS_PER_TYPE is the only gate; the 30-day trial gate was removed). Verified 2026-09-07.
      { label: "pricing.ff6", muted: true },
    ],
    cta: "pricing.start_free",
    ctaHref: "/signup",
  },
  {
    name: "pricing.personal",
    tagline: "pricing.pers_tag",
    price: "₹99",
    priceAnnual: "₹999",
    period: "pricing.a_month",
    periodAnnual: "pricing.a_year",
    subline: "pricing.or_year",
    sublineAnnual: "pricing.under_84",
    features: [
      { label: "pricing.pf1" },
      { label: "pricing.pf2" },
      { label: "pricing.pf3" },
      // claim-source: founder decision 2026-09-07. Bounded deliberately: an
      // unbounded "unlimited consultation" is a human-time promise nobody had
      // committed to staffing.
      { label: "pricing.pf4" },
      { label: "pricing.pf5" },
      { label: "pricing.pf6" },
    ],
    /* Upgrading is a conversation, not a checkout: there is no payment
       integration in the product, so a button that looked like one would take
       somebody to a page that cannot charge them. WhatsApp reaches a person who
       can actually move the account onto the plan. */
    cta: "pricing.upgrade_wa",
    ctaHref: teamWaLink(
      "Hi, I would like to upgrade my IndSure account to the Personal plan.",
    ),
    ctaExternal: true,
    highlighted: true,
  },
];

const featureRows: { label: string; free: string | boolean; paid: string | boolean }[] = [
  { label: "pricing.r1", free: "1", paid: "pricing.v_4_year" },
  { label: "pricing.r2", free: "pricing.v_1_each_type", paid: "pricing.v_16_total" },
  { label: "pricing.r3", free: "pricing.v_1_each_stored", paid: "pricing.v_12_slots" },
  { label: "pricing.r4", free: true, paid: true },
  { label: "pricing.r5", free: true, paid: true },
  { label: "pricing.r6", free: true, paid: true },
  { label: "pricing.r7", free: false, paid: true },
  // claim-source: founder decision 2026-09-07, same bound as the plan card
  // above. "Unlimited, fair use" contradicted it once the card was reworded.
  { label: "pricing.r8", free: false, paid: "pricing.v_2_days" },
  { label: "pricing.r9", free: "pricing.never", paid: "pricing.never" },
];

const faqs = [
  {
    q: "pricing.q1",
    a: "pricing.a1",
  },
  {
    q: "pricing.q2",
    a: "pricing.a2",
  },
  /* The time-based gate that used to return "trial_expired" on day 31 was
     deliberately removed from the server; trial_started_at is still written
     but no longer gates anything, so "no trial clock" describes what the code
     does rather than promising something. */
  {
    /* claim-source: checkIndividualQuota, backend/server/routes.ts:772-798,
       verified 2026-08-31 — free is metered by FREE_SLOTS_PER_TYPE, not time. */
    q: "pricing.q3",
    a: "pricing.a3",
  },
  {
    q: "pricing.q4",
    a: "pricing.a4",
  },
  {
    q: "pricing.q5",
    a: "pricing.a5",
  },
  {
    q: "pricing.q6",
    a: "pricing.a6",
  },
  {
    q: "pricing.q7",
    a: "pricing.a7",
  },
];

export default function Pricing() {
  // Annual is the default view: it is the better deal and the price the reel
  // and prerendered copy both quote.
  const [annual, setAnnual] = useState(true);
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <Header />

      <main className="flex-grow pt-32">

        {/* HERO */}
        <section className="relative overflow-hidden pb-12">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute inset-0 bg-grid-faint mask-fade-edges" />
            <div
              className="absolute -top-40 left-1/2 h-[480px] w-[860px] -translate-x-1/2 rounded-full opacity-70 blur-3xl"
              style={{ background: "radial-gradient(ellipse, rgba(45,212,191,0.20), transparent 68%)" }}
            />
          </div>

          <Reveal className="container-editorial relative mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            <Eyebrow>{t("pricing.eyebrow")}</Eyebrow>

            <h1 className="font-serif font-bold tracking-[-0.035em] leading-[1.05] text-4xl sm:text-6xl text-[var(--color-navy-900)]">
              {t("pricing.h_a")}
              <br />
              {t("pricing.h_b")} <span className="italic text-[var(--color-teal-600)]">{t("pricing.h_c")}</span>
            </h1>

            <p className="max-w-2xl text-lg sm:text-xl leading-relaxed text-[var(--color-text-secondary)]">
              {t("pricing.sub")}
            </p>
          </Reveal>
        </section>

        {/* PLANS */}
        <Section surface="mint" size="tight">
          <div className="container-editorial flex flex-col items-center gap-10">

            {/* Billing toggle as a segmented control. The bare switch gave no
                hint that either label was clickable. */}
            <Reveal>
              <div
                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-light)] bg-white p-1"
                role="group"
                aria-label={t("pricing.billing")}
              >
                {[
                  { on: false, label: "pricing.monthly", note: "" },
                  { on: true, label: "pricing.annual", note: "pricing.saves" },
                ].map((opt) => {
                  const active = annual === opt.on;
                  return (
                    <button
                      key={opt.label}
                      onClick={() => setAnnual(opt.on)}
                      aria-pressed={active}
                      className={`flex min-h-11 items-center gap-2 rounded-full px-5 text-[15px] transition-colors ${
                        active
                          ? "bg-[var(--color-cta)] font-bold text-white"
                          : "font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-navy-900)]"
                      }`}
                    >
                      {t(opt.label)}
                      {opt.note ? (
                        <span className={active ? "text-white/85" : "text-[var(--color-teal-700)]"}>
                          {t(opt.note)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </Reveal>

            <div className="grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-2 md:items-stretch">
              {tiers.map((tier, i) => {
                const paid = !!tier.highlighted;
                const accent = paid ? "var(--lob-health)" : "var(--lob-life)";
                const ctaClass = `mt-auto inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-lg text-base font-semibold transition-all duration-200 ${
                  paid
                    ? "bg-[var(--color-cta)] text-white hover:bg-[#0F766E] hover:-translate-y-0.5"
                    : "border border-[var(--color-border-medium)] bg-white text-[var(--color-text-main)] hover:border-[var(--color-teal-600)] hover:text-[var(--color-teal-600)]"
                }`;
                const wash = paid ? "var(--lob-health-wash)" : "var(--lob-life-wash)";
                return (
                  <Reveal key={tier.name} delay={i * 0.08} className="h-full">
                    <div
                      className={`relative flex h-full flex-col overflow-hidden rounded-2xl bg-white transition-shadow duration-300 ${
                        paid
                          ? "shadow-[0_24px_60px_-22px_rgba(13,148,136,0.45)]"
                          : "shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:shadow-[0_16px_40px_-16px_rgba(15,23,42,0.2)]"
                      }`}
                      style={{
                        outline: paid ? "2px solid var(--color-teal-600)" : "1px solid var(--color-border-light)",
                        outlineOffset: -1,
                      }}
                    >
                      {/* Coloured cap. The two cards used to differ only by a
                          border colour, so at a glance the page had no shape. */}
                      <div className="px-7 pt-7 pb-6" style={{ backgroundColor: wash }}>
                        <div className="flex items-center justify-between gap-3">
                          <h2 className="font-serif text-2xl font-bold text-[var(--color-navy-900)]">
                            {t(tier.name)}
                          </h2>
                          {paid ? (
                            <span
                              className="rounded-full px-3 py-1 text-sm font-bold uppercase tracking-[0.1em] text-white"
                              style={{ backgroundColor: accent }}
                            >
                              {t("pricing.best")}
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-2 min-h-[44px] text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                          {t(tier.tagline)}
                        </p>

                        <div className="mt-4 flex flex-wrap items-baseline gap-2">
                          <span className="font-serif text-5xl font-bold tracking-tight text-[var(--color-navy-900)] tabular">
                            {annual ? tier.priceAnnual : tier.price}
                          </span>
                          <span className="text-[15px] text-[var(--color-text-secondary)]">
                            {t(annual ? tier.periodAnnual : tier.period)}
                          </span>
                        </div>

                        <p className="mt-1 text-[15px] font-semibold" style={{ color: accent }}>
                          {t(annual ? tier.sublineAnnual : tier.subline)}
                        </p>
                      </div>

                      <div className="flex flex-1 flex-col gap-6 p-7">
                        <ul className="flex flex-col gap-3">
                          {tier.features.map((f) => (
                            <li
                              key={f.label}
                              className="flex items-start gap-2.5 text-[15px] leading-relaxed text-[var(--color-text-main)]"
                            >
                              <Check className="mt-1 h-4 w-4 shrink-0" style={{ color: accent }} aria-hidden="true" />
                              <span>{t(f.label)}</span>
                            </li>
                          ))}
                        </ul>

                        {tier.ctaExternal ? (
                          /* wouter's Link pushes onto the router's history, so an
                             off-site href would route to a page that does not
                             exist instead of opening WhatsApp. */
                          <a
                            href={tier.ctaHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={ctaClass}
                          >
                            {t(tier.cta)}
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </a>
                        ) : (
                          <Link href={tier.ctaHref} className={ctaClass}>
                            {t(tier.cta)}
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>

            <Reveal className="flex w-full max-w-3xl items-start gap-3 rounded-2xl border border-[var(--color-teal-600)]/25 bg-white px-6 py-5">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-teal-600)]" aria-hidden="true" />
              <p className="text-[15px] leading-relaxed text-[var(--color-text-main)]">
                <span className="font-bold">{t("pricing.no_sell_b")}</span> {t("pricing.no_sell")}
              </p>
            </Reveal>
          </div>
        </Section>

        {/* COMPARISON */}
        <Section surface="white">
          <div className="container-editorial mx-auto flex max-w-4xl flex-col gap-8">
            <SectionHeading eyebrow={t("pricing.side")} title={t("pricing.what_get")} align="center" />

            <Reveal className="overflow-x-auto rounded-2xl border border-[var(--color-border-light)]">
              <table className="table-cards w-full text-[15px] md:min-w-[520px]">
                <thead>
                  <tr className="bg-[var(--color-cream-main)]">
                    <th className="w-1/2 p-4 text-left text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                      {t("pricing.feature")}
                    </th>
                    <th className="p-4 text-center font-bold text-[var(--color-navy-900)]">{t("pricing.free")}</th>
                    <th className="p-4 text-center font-bold text-[var(--color-teal-700)]">{t("pricing.personal")}</th>
                  </tr>
                </thead>
                <tbody>
                  {featureRows.map((row, i) => (
                    <tr
                      key={row.label}
                      className={`border-t border-[var(--color-border-light)] ${i % 2 ? "bg-[#FCFCFB]" : "bg-white"}`}
                    >
                      <td
                        className="p-4 font-medium text-[var(--color-navy-900)]"
                        data-label={t("pricing.feature")}
                        data-cell="title"
                      >
                        {t(row.label)}
                      </td>
                      {[row.free, row.paid].map((val, j) => (
                        <td
                          key={j}
                          className="p-4 text-center text-[var(--color-text-secondary)]"
                          style={j === 1 ? { backgroundColor: "var(--lob-health-wash)" } : undefined}
                          data-label={j === 0 ? t("pricing.free") : t("pricing.personal")}
                        >
                          {val === true ? (
                            <Check className="mx-auto h-5 w-5 text-[var(--color-teal-600)]" aria-label={t("pricing.included")} />
                          ) : val === false ? (
                            <Minus className="mx-auto h-5 w-5 text-[var(--color-border-medium)]" aria-label={t("pricing.not_included")} />
                          ) : (
                            <span className="font-semibold text-[var(--color-navy-900)]">{/^\d+$/.test(val) ? val : t(val)}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
          </div>
        </Section>

        {/* FAQ */}
        <Section surface="cream" bordered>
          <div className="container-editorial mx-auto flex max-w-3xl flex-col gap-8">
            <SectionHeading eyebrow={t("pricing.questions")} title={t("pricing.before")} align="center" />

            <Stagger className="flex flex-col gap-3">
              {faqs.map((f) => (
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

        {/* CLOSING */}
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
              {t("pricing.close_h")}
            </h2>
            <p className="max-w-2xl text-lg leading-relaxed text-white/80">
              {t("pricing.close_d")}
            </p>

            <CTA href="/signup" icon={ArrowRight}>{t("pricing.check")}</CTA>

            {/* The advisor cross-link used to be the last line on the page in
                small grey text, which is where the second audience was quietly
                losing the site. */}
            <p className="pt-2 text-[15px] text-white/70">
              {t("pricing.selling")}{" "}
              <Link
                href="/advisors/pricing"
                className="font-semibold text-[var(--color-teal-400)] underline underline-offset-4"
              >
                {t("pricing.adv_plans")}
              </Link>
            </p>
          </Reveal>
        </Section>

      </main>

      <Footer />
    </div>
  );
}
