import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Link } from "wouter";
import { Database, Cpu, Share2, ShieldOff, ArrowRight, Quote } from "lucide-react";
import { AnimatedNumber, Reveal, Stagger, RevealItem } from "@/components/motion";
import { Section, SectionHeading, Eyebrow, CTA } from "@/components/marketing";
import { useSEO } from "@/hooks/use-seo";

/* ============================================================
   WHY INDSURE

   Four claims about why this company can do the thing it says.
   The page used to render them as four identical grey boxes on
   one flat cream background, with a closing heading that was
   invisible: an <h2> with no colour class inherits navy from the
   base stylesheet, and it sat on a navy card.
   ============================================================ */

const pillars = [
  {
    n: "01",
    icon: Database,
    title: "The Catalog",
    accent: "var(--lob-health)",
    wash: "var(--lob-health-wash)",
    lead: "We read what insurers file, not what they advertise.",
    body: "A wording-level database of 69 health insurance plans across 10 insurers, hand-built rather than scraped: every room-rent clause, co-pay clause, sub-limit and waiting period, taken out of the policy documents insurers actually file. That takes months of work most comparison sites will not do.",
  },
  {
    n: "02",
    icon: Cpu,
    title: "The Engine",
    accent: "var(--lob-life)",
    wash: "var(--lob-life-wash)",
    lead: "The same policy produces the same answer every time.",
    body: "Reading one policy properly takes a trained human the better part of an hour, and two humans will not agree. The engine works clause by clause and deterministically, so the audit a first-time buyer gets is the audit a lawyer would get.",
  },
  {
    n: "03",
    icon: Share2,
    title: "Distribution",
    accent: "var(--lob-motor)",
    wash: "var(--lob-motor-wash)",
    lead: "The best analysis is useless if it never reaches the person deciding.",
    body: "So we built for the channel Indian households already buy through: the insurance advisor. Compare, the Cover Calculator and the client tools sit in an advisor's hand, with WhatsApp as the front door rather than a CRM login.",
  },
  {
    n: "04",
    icon: ShieldOff,
    title: "The Business Model",
    accent: "var(--lob-home)",
    wash: "var(--lob-home-wash)",
    lead: "We could not take a commission even if we wanted to.",
    body: "IndSure is not an IRDAI-registered broker or agent, which means there is no commission available to us on anything we recommend. That is not a promise about our character. It is a structural fact about our licence, and most of this industry cannot claim it.",
  },
];

/* claim-source: counted from backend/catalog_seed/*.json on 2026-08-31 —
   69 plan files across 10 insurer prefixes (adityabirla, bajaj, care,
   hdfc, indusind, manipalcigna, nia, nivabupa, sbi, tataaig). The page
   previously said 63, which was a stale count. /compare renders the same
   two figures live from the catalog (catalog-compare.tsx:268), so check
   them against each other whenever the catalog grows.

   The strip used to carry "50+ risk checks per audit" as its third
   figure. Nothing in the codebase substantiates that number, so it has
   been replaced with a second structural zero rather than restated. */
const stats = [
  { value: 69, suffix: "", label: "Plans indexed", accent: "var(--lob-health)" },
  { value: 10, suffix: "", label: "Insurers covered", accent: "var(--lob-life)" },
  { value: 0, suffix: "", label: "Commission earned, ever", accent: "var(--lob-motor)" },
  { value: 0, suffix: "", label: "Leads sold, ever", accent: "var(--lob-home)" },
];

export default function WhyIndSure() {
  useSEO({
    title: "Why IndSure: The Catalog, The Engine, The Business Model | IndSure",
    description:
      "Everyone promises unbiased insurance advice. IndSure can prove it: a wording-level catalog of health plans, a deterministic engine that reads clause by clause, and a licence that makes commission impossible.",
    canonical: "https://indsure.in/why-indsure",
  });

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <Header />

      <main className="flex-grow pt-32">

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
              <Eyebrow>Why IndSure</Eyebrow>

              <h1 className="font-serif font-bold tracking-[-0.035em] leading-[1.05] text-4xl sm:text-6xl lg:text-7xl text-[var(--color-navy-900)]">
                Insurance,
                <br />
                <span className="italic text-[var(--color-teal-600)]">decoded.</span>
              </h1>

              <p className="max-w-2xl text-lg sm:text-xl leading-relaxed text-[var(--color-text-secondary)]">
                Everyone promises unbiased advice. Almost nobody can back it with the data, the
                technology and the business model to prove it. Here is ours.
              </p>
            </Reveal>

            {/* ─────────── STATS ─────────── */}
            <Stagger className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
              {stats.map((s) => (
                <RevealItem key={s.label} className="flex flex-col items-center gap-1.5 text-center">
                  <span
                    className="font-serif text-5xl font-bold tracking-tight md:text-6xl"
                    style={{ color: s.accent }}
                  >
                    <AnimatedNumber value={s.value} suffix={s.suffix} />
                  </span>
                  <span className="max-w-[10rem] text-sm font-semibold uppercase tracking-[0.1em] leading-snug text-[var(--color-text-secondary)]">
                    {s.label}
                  </span>
                </RevealItem>
              ))}
            </Stagger>
          </div>
        </section>

        {/* ─────────── PILLARS ─────────── */}
        <Section surface="mint">
          <div className="container-editorial flex flex-col gap-12">
            <SectionHeading
              eyebrow="The proof"
              title="Four things that have to be true"
              sub="Any of these on its own is a marketing line. Together they are the reason the answer you get is not shaped by what somebody earns on it."
            />

            <Stagger className="grid gap-6 md:grid-cols-2">
              {pillars.map((p) => (
                <RevealItem key={p.title}>
                  <article
                    className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_-16px_rgba(15,23,42,0.18)] sm:p-9"
                    style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.05)" }}
                  >
                    {/* The accent rule grows across the top on hover, which is
                        the only thing separating four cards of equal weight. */}
                    <span
                      className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
                      style={{ backgroundColor: p.accent }}
                      aria-hidden="true"
                    />

                    <div className="flex items-center gap-4">
                      <span
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105"
                        style={{ backgroundColor: p.wash, color: p.accent }}
                      >
                        <p.icon className="h-6 w-6" aria-hidden="true" />
                      </span>

                      <div className="flex flex-col">
                        <span
                          className="font-serif text-sm font-bold tracking-[0.18em]"
                          style={{ color: p.accent }}
                        >
                          {p.n}
                        </span>
                        <h3 className="font-serif text-2xl font-bold text-[var(--color-navy-900)]">
                          {p.title}
                        </h3>
                      </div>
                    </div>

                    <p
                      className="font-serif text-xl leading-snug"
                      style={{ color: p.accent }}
                    >
                      {p.lead}
                    </p>

                    <p className="text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                      {p.body}
                    </p>
                  </article>
                </RevealItem>
              ))}
            </Stagger>
          </div>
        </Section>

        {/* ─────────── THE FINE PRINT PROBLEM ─────────── */}
        <Section surface="white">
          <div className="container-editorial grid gap-12 lg:grid-cols-[1fr_minmax(0,460px)] lg:items-center">
            <div className="flex flex-col gap-6">
              <SectionHeading
                eyebrow="The problem"
                title={<>The clause nobody read out loud</>}
              />

              {/* The original opened with an unsourced count of claims
                  rejected per year. Nothing substantiates that figure, so the
                  point is made with the mechanism instead, which needs no
                  number at all. */}
              <div className="flex flex-col gap-5 text-lg leading-relaxed text-[var(--color-text-secondary)]">
                <p>
                  Claims are refused for reasons that were on page 42 the whole time. A room-rent
                  cap. A co-pay that starts at sixty. A waiting period that had two years left to
                  run. None of it is hidden, exactly. It is just never the part anyone reads at the
                  time of sale.
                </p>
                <p>
                  No advisor can hold ten insurers worth of fine print in their head, consistently,
                  for every customer, every time. A system built to do exactly that, and nothing
                  else, can.
                </p>
              </div>

              <Reveal
                className="relative rounded-2xl border-l-4 bg-[var(--surface-sand)] p-6 sm:p-7"
                style={{ borderLeftColor: "var(--lob-motor)" }}
              >
                <Quote
                  className="absolute right-5 top-5 h-7 w-7 opacity-20"
                  style={{ color: "var(--lob-motor)" }}
                  aria-hidden="true"
                />
                <p className="pr-10 font-serif text-xl leading-snug text-[var(--color-navy-900)] sm:text-2xl">
                  Codify the fine print once, apply it consistently, and never let a commission
                  check the outcome.
                </p>
                <p className="mt-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                  The bet IndSure is built on
                </p>
              </Reveal>
            </div>

            {/* A single clause, shown the way the product shows it. Abstract
                claims about fine print land better next to actual fine print. */}
            <Reveal from="right" className="flex flex-col gap-3">
              <div
                className="overflow-hidden rounded-2xl bg-white"
                style={{ boxShadow: "0 0 0 1px rgba(15,23,42,0.07), 0 24px 50px -20px rgba(15,23,42,0.22)" }}
              >
                <div className="flex items-center justify-between border-b border-[var(--color-border-light)] bg-[var(--color-cream-main)] px-4 py-3">
                  <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
                    policy-wording.pdf · page 42
                  </span>
                  <span className="rounded-md bg-[var(--color-cream-dark)] px-2 py-1 text-sm font-semibold text-[var(--color-text-secondary)]">
                    Illustrative
                  </span>
                </div>

                <div className="flex flex-col gap-4 p-5">
                  <p className="text-sm leading-relaxed text-[var(--color-border-medium)]">
                    2.14 The Company shall not be liable for any claim arising in respect of an
                    Insured Person during the first twenty-four (24) months of continuous coverage,
                    where such claim is attributable to a condition specified in Annexure II.
                  </p>

                  <div
                    className="rounded-r-lg border-l-[3px] bg-[var(--lob-motor-wash)] px-4 py-3"
                    style={{ borderLeftColor: "var(--lob-motor)" }}
                  >
                    <p className="text-sm leading-relaxed text-[#78350F]">
                      2.15 Notwithstanding the foregoing, a co-payment of twenty per cent (20%) shall
                      apply to each and every admissible claim where the Insured Person has attained
                      sixty (60) years.
                    </p>
                  </div>

                  <div className="h-px bg-[var(--color-border-light)]" />

                  <div className="flex flex-col gap-2">
                    <Eyebrow accent="var(--lob-health)">What that means</Eyebrow>
                    <p className="font-serif text-xl font-bold leading-snug text-[var(--color-navy-900)]">
                      Your knee replacement is not covered for two more years, and after sixty you
                      pay a fifth of every bill.
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-center text-sm text-[var(--color-text-secondary)]">
                Wording shown is representative, not from any one insurer.
              </p>
            </Reveal>
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
            {/* This heading carried no colour class, so it inherited navy from
                the base stylesheet and rendered invisible on the navy card. */}
            <h2 className="font-serif text-3xl font-bold tracking-[-0.03em] leading-[1.1] text-white sm:text-5xl">
              Stop guessing. Start knowing.
            </h2>

            <p className="max-w-2xl text-lg leading-relaxed text-white/80">
              Check the policy you already own, or put two plans side by side before you buy the
              next one.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <CTA href="/policychecker" icon={ArrowRight}>Check my policy</CTA>
              <CTA href="/compare" variant="ghost-ink">Compare plans</CTA>
            </div>

            <p className="text-sm text-white/60">
              Free to start. No sales calls, and no commission on either answer.
            </p>
          </Reveal>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
