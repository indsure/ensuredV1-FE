import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Check, Minus, ShieldCheck, ArrowRight, Plus } from "lucide-react";
import { Reveal, Stagger, RevealItem } from "@/components/motion";
import { Section, SectionHeading, Eyebrow, CTA } from "@/components/marketing";

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
  highlighted?: boolean;
};

const tiers: Tier[] = [
  {
    name: "Free",
    tagline: "See what your policy really says, before you pay anything.",
    price: "₹0",
    priceAnnual: "₹0",
    period: "forever",
    periodAnnual: "forever",
    subline: "No card needed",
    sublineAnnual: "No card needed",
    features: [
      { label: "One policy of each type: health, term, life and vehicle" },
      { label: "Full health policy check in plain language" },
      { label: "Room rent, co-pay, sub-limits and waiting periods explained" },
      { label: "Renewal reminders 30 days before expiry" },
      { label: "Download your report as a PDF" },
      { label: "No expiry date. Stays free as long as you want it", muted: true },
    ],
    cta: "Create free account",
    ctaHref: "/signup",
  },
  {
    name: "Personal",
    tagline: "Your whole family's cover in one place, checked and watched.",
    price: "₹99",
    priceAnnual: "₹999",
    period: "a month",
    periodAnnual: "a year",
    subline: "Or ₹999 a year",
    sublineAnnual: "Under ₹84 a month · saves ₹189",
    features: [
      { label: "4 health policy checks a year" },
      { label: "Room for 12 more policies across term, life and vehicle, any mix" },
      { label: "Renewal reminders on every policy you store" },
      { label: "Unlimited consultation with our team (fair use)" },
      { label: "Ask the Sach assistant any question about your cover" },
      { label: "Download every report as a PDF" },
    ],
    cta: "Start free, upgrade anytime",
    ctaHref: "/signup",
    highlighted: true,
  },
];

const featureRows: { label: string; free: string | boolean; paid: string | boolean }[] = [
  { label: "Health policy checks", free: "1", paid: "4 a year" },
  { label: "Policies stored and tracked", free: "1 of each type", paid: "16 total" },
  { label: "Term, life and vehicle policies", free: "1 each, stored", paid: "12 slots, any mix" },
  { label: "Renewal reminders", free: true, paid: true },
  { label: "Plain-language report", free: true, paid: true },
  { label: "PDF download", free: true, paid: true },
  { label: "Sach assistant", free: false, paid: true },
  { label: "Consultation with our team", free: false, paid: "Unlimited, fair use" },
  { label: "Expires", free: "Never", paid: "Never" },
];

const faqs = [
  {
    q: "What counts as a policy check?",
    a: "A full read of your health policy wording — room rent caps, co-pay, sub-limits, waiting periods and the gaps between what you assumed and what is written. You get four of these a year on the Personal plan.",
  },
  {
    q: "What do the 12 term, life and vehicle slots do?",
    a: "They store the policy and watch its renewal date, so nothing lapses quietly. They are not full policy checks — those are for health policies today. You can split the 12 however you like across term, life and vehicle.",
  },
  /* The time-based gate that used to return "trial_expired" on day 31 was
     deliberately removed from the server; trial_started_at is still written
     but no longer gates anything, so "no trial clock" describes what the code
     does rather than promising something. */
  {
    /* claim-source: checkIndividualQuota, backend/server/routes.ts:772-798,
       verified 2026-08-31 — free is metered by FREE_SLOTS_PER_TYPE, not time. */
    q: "Is the free plan really free forever?",
    a: "Yes. There is no trial clock and no card. You keep one policy of each type, health, term, life and vehicle, with the full health check, renewal reminders and PDF reports, for as long as you want. You move to Personal only when you need more than one policy of a type, or more checks.",
  },
  {
    q: "Can I pay monthly instead of yearly?",
    a: "Yes. Personal is ₹99 a month or ₹999 a year. Paying for the year costs ₹189 less than twelve monthly payments, and you can switch between the two whenever you like.",
  },
  {
    q: "What does unlimited consultation mean?",
    a: "You can talk to our team about anything in your portfolio — what a clause means, whether your cover is enough, what to ask your insurer. It is fair use: it is meant for your own policies, not for running someone else's advice practice.",
  },
  {
    q: "Do you sell insurance or earn commission?",
    a: "No. IndSure charges a flat fee and is not an IRDAI-registered broker or agent. We do not earn commission on anything you buy, so there is nothing we gain by pointing you at one insurer over another.",
  },
  {
    q: "Is my policy document private?",
    a: "Yes. Your documents are yours, they are never sold or shared, and you can delete them whenever you want — as set out in our Privacy Policy and under India's DPDP Act.",
  },
];

export default function Pricing() {
  // Annual is the default view: it is the better deal and the price the reel
  // and prerendered copy both quote.
  const [annual, setAnnual] = useState(true);

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
            <Eyebrow>For you and your family</Eyebrow>

            <h1 className="font-serif font-bold tracking-[-0.035em] leading-[1.05] text-4xl sm:text-6xl text-[var(--color-navy-900)]">
              Know what you are
              <br />
              covered for. <span className="italic text-[var(--color-teal-600)]">₹999 a year.</span>
            </h1>

            <p className="max-w-2xl text-lg sm:text-xl leading-relaxed text-[var(--color-text-secondary)]">
              Most people find out what their policy does not cover on the day they claim. Start
              free and read yours properly first.
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
                aria-label="Billing period"
              >
                {[
                  { on: false, label: "Monthly", note: "" },
                  { on: true, label: "Annual", note: "saves ₹189" },
                ].map((opt) => {
                  const active = annual === opt.on;
                  return (
                    <button
                      key={opt.label}
                      onClick={() => setAnnual(opt.on)}
                      aria-pressed={active}
                      className={`flex min-h-11 items-center gap-2 rounded-full px-5 text-[15px] transition-colors ${
                        active
                          ? "bg-[var(--color-teal-600)] font-bold text-white"
                          : "font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-navy-900)]"
                      }`}
                    >
                      {opt.label}
                      {opt.note ? (
                        <span className={active ? "text-white/85" : "text-[var(--color-teal-700)]"}>
                          {opt.note}
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
                            {tier.name}
                          </h2>
                          {paid ? (
                            <span
                              className="rounded-full px-3 py-1 text-[13px] font-bold uppercase tracking-[0.1em] text-white"
                              style={{ backgroundColor: accent }}
                            >
                              Best value
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-2 min-h-[44px] text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                          {tier.tagline}
                        </p>

                        <div className="mt-4 flex flex-wrap items-baseline gap-2">
                          <span className="font-serif text-5xl font-bold tracking-tight text-[var(--color-navy-900)] tabular">
                            {annual ? tier.priceAnnual : tier.price}
                          </span>
                          <span className="text-[15px] text-[var(--color-text-secondary)]">
                            {annual ? tier.periodAnnual : tier.period}
                          </span>
                        </div>

                        <p className="mt-1 text-[15px] font-semibold" style={{ color: accent }}>
                          {annual ? tier.sublineAnnual : tier.subline}
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
                              <span>{f.label}</span>
                            </li>
                          ))}
                        </ul>

                        <Link
                          href={tier.ctaHref}
                          className={`mt-auto inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-lg text-base font-semibold transition-all duration-200 ${
                            paid
                              ? "bg-[var(--color-teal-600)] text-white hover:bg-[#0F766E] hover:-translate-y-0.5"
                              : "border border-[var(--color-border-medium)] bg-white text-[var(--color-text-main)] hover:border-[var(--color-teal-600)] hover:text-[var(--color-teal-600)]"
                          }`}
                        >
                          {tier.cta}
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>

            <Reveal className="flex w-full max-w-3xl items-start gap-3 rounded-2xl border border-[var(--color-teal-600)]/25 bg-white px-6 py-5">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-teal-600)]" aria-hidden="true" />
              <p className="text-[15px] leading-relaxed text-[var(--color-text-main)]">
                <span className="font-bold">We do not sell insurance.</span> IndSure earns nothing
                from insurers, so there is no commission and no referral fee riding on what your
                report says. You pay us, which is why we work for you.
              </p>
            </Reveal>
          </div>
        </Section>

        {/* COMPARISON */}
        <Section surface="white">
          <div className="container-editorial mx-auto flex max-w-4xl flex-col gap-8">
            <SectionHeading eyebrow="Side by side" title="What you get" align="center" />

            <Reveal className="overflow-x-auto rounded-2xl border border-[var(--color-border-light)]">
              <table className="table-cards w-full text-[15px] md:min-w-[520px]">
                <thead>
                  <tr className="bg-[var(--color-cream-main)]">
                    <th className="w-1/2 p-4 text-left text-[13px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                      Feature
                    </th>
                    <th className="p-4 text-center font-bold text-[var(--color-navy-900)]">Free</th>
                    <th className="p-4 text-center font-bold text-[var(--color-teal-700)]">Personal</th>
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
                        data-label="Feature"
                        data-cell="title"
                      >
                        {row.label}
                      </td>
                      {[row.free, row.paid].map((val, j) => (
                        <td
                          key={j}
                          className="p-4 text-center text-[var(--color-text-secondary)]"
                          style={j === 1 ? { backgroundColor: "var(--lob-health-wash)" } : undefined}
                          data-label={j === 0 ? "Free" : "Personal"}
                        >
                          {val === true ? (
                            <Check className="mx-auto h-5 w-5 text-[var(--color-teal-600)]" aria-label="Included" />
                          ) : val === false ? (
                            <Minus className="mx-auto h-5 w-5 text-[var(--color-border-medium)]" aria-label="Not included" />
                          ) : (
                            <span className="font-semibold text-[var(--color-navy-900)]">{val}</span>
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
            <SectionHeading eyebrow="Questions" title="Before you decide" align="center" />

            <Stagger className="flex flex-col gap-3">
              {faqs.map((f) => (
                <RevealItem key={f.q}>
                  <details className="group rounded-xl border border-[var(--color-border-light)] bg-white px-5 py-4 open:border-[var(--color-teal-600)]/30">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[17px] font-semibold text-[var(--color-navy-900)]">
                      {f.q}
                      <Plus
                        className="mt-1 h-5 w-5 shrink-0 text-[var(--color-teal-600)] transition-transform duration-300 group-open:rotate-45"
                        aria-hidden="true"
                      />
                    </summary>
                    <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                      {f.a}
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
              Start with the policy you already have
            </h2>
            <p className="max-w-2xl text-lg leading-relaxed text-white/80">
              Upload it, read what it actually covers, and decide from there. Free, and there is
              nothing to buy at the end.
            </p>

            <CTA href="/signup" icon={ArrowRight}>Check my policy</CTA>

            {/* The advisor cross-link used to be the last line on the page in
                small grey text, which is where the second audience was quietly
                losing the site. */}
            <p className="pt-2 text-[15px] text-white/70">
              Selling insurance rather than buying it?{" "}
              <Link
                href="/advisors/pricing"
                className="font-semibold text-[var(--color-teal-400)] underline underline-offset-4"
              >
                See advisor plans
              </Link>
            </p>
          </Reveal>
        </Section>

      </main>

      <Footer />
    </div>
  );
}
