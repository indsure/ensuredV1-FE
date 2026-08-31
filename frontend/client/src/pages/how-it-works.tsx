import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Link } from "wouter";
import {
  Upload, ScanSearch, ShieldCheck, FileCheck2, Lock, Ban, ArrowRight, Plus,
} from "lucide-react";
import { Reveal, Stagger, RevealItem } from "@/components/motion";
import { Section, SectionHeading, Eyebrow, CTA } from "@/components/marketing";
import { useSEO } from "@/hooks/use-seo";

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

const steps = [
  {
    step: "01",
    icon: Upload,
    title: "Upload",
    accent: "var(--lob-health)",
    wash: "var(--lob-health-wash)",
    chip: "Your file",
    summary: "Drag in your policy PDF, or up to four if you want them compared side by side.",
    details: [
      "Works with scanned copies and phone photos, not just clean PDFs",
      "A free account, no card, so the result is saved to your portfolio",
      "Encrypted in transit the moment it leaves your device",
    ],
  },
  {
    step: "02",
    icon: ScanSearch,
    title: "Decipher",
    title2: "",
    accent: "var(--lob-life)",
    wash: "var(--lob-life-wash)",
    chip: "Every clause",
    summary: "The engine reads each clause the way a claims examiner would, not the way a brochure summarises it.",
    details: [
      "Room rent limits, co-pay percentages, sub-limits and restoration benefits",
      "Waiting periods for pre-existing conditions, maternity and specific surgeries",
      "Exclusions buried in annexures most people never open",
    ],
  },
  {
    step: "03",
    icon: ShieldCheck,
    title: "Audit",
    accent: "var(--lob-motor)",
    wash: "var(--lob-motor-wash)",
    chip: "Against the patterns",
    summary: "Each extracted clause is checked against the ways claims actually get refused and, if you uploaded more than one policy, against the others.",
    details: [
      "The clauses that decide a claim, checked one by one",
      "Flags cover you are paying for twice across two policies",
      "Flags silent gaps: cover you assumed you had, and do not",
    ],
  },
  {
    step: "04",
    icon: FileCheck2,
    title: "Report",
    accent: "var(--lob-home)",
    wash: "var(--lob-home-wash)",
    chip: "In your words",
    summary: "One Insurance Health Score and a short list of things you can actually do, rather than a wall of legal text.",
    details: [
      "Specific enough to act on: which cap to avoid, and why it costs you",
      "A shareable link, or a PDF you can hand to your family",
      "Nothing to sign and nothing to buy",
    ],
  },
];

const faqs = [
  {
    q: "How long does this actually take?",
    a: "About two minutes end to end for a single policy. Comparing up to four takes a little longer, but you are still looking at minutes rather than an evening of manual reading.",
  },
  {
    q: "Do I need an account?",
    a: "Yes. The result is saved to your portfolio so you can open it again later, compare against it, and get a reminder before the policy renews, and that needs somewhere to keep it. Signing up is free and takes an email address. We never ask for a card to see your first result.",
  },
  {
    q: "Is my data safe?",
    a: "Your document is encrypted in transit and stored so you can open it again from your portfolio. We never share it with insurers, agents or anyone else unless you ask us to, and you can delete it whenever you want.",
  },
  {
    q: "Do you sell insurance or earn commissions on my results?",
    a: "No. IndSure is not an IRDAI-registered broker or agent. We have no policy to sell you and no commission riding on what the audit finds, which is the whole point.",
  },
  {
    q: "What if I don't have a soft copy of my policy?",
    a: "A clear photo of the printed document works fine. If the scan is genuinely unreadable we will tell you instead of guessing.",
  },
  {
    q: "Can I compare policies from different insurers?",
    a: "Yes. Upload up to four policies, yours or ones you are considering, and we line them up on the same dimensions: coverage limit, room rent, co-pay, exclusions and waiting periods.",
  },
];

export default function HowItWorks() {
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
            <Eyebrow>How it works</Eyebrow>

            <h1 className="font-serif font-bold tracking-[-0.035em] leading-[1.05] text-4xl sm:text-6xl lg:text-7xl text-[var(--color-navy-900)]">
              From chaos
              <br />
              to <span className="italic text-[var(--color-teal-600)]">clarity.</span>
            </h1>

            {/* This used to read "No forms. No sales calls." while step 01 asks
                for an account. It now says what the account is for. */}
            <p className="max-w-2xl text-lg sm:text-xl leading-relaxed text-[var(--color-text-secondary)]">
              No sales calls, and nothing to buy at the end. A free account, your policy PDF, and
              about two minutes.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <CTA href="/signup" icon={ArrowRight}>Check my policy</CTA>
              <CTA href="/policychecker" variant="secondary">See everything we check</CTA>
            </div>
          </Reveal>
        </section>

        {/* ─────────── STEPS ─────────── */}
        <Section surface="mint">
          <div className="container-editorial flex flex-col gap-12">
            <SectionHeading
              eyebrow="The four steps"
              title="What happens to your policy"
              sub="Nothing here is a black box. This is the whole path from the file on your phone to the verdict on your screen."
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
                          className="text-[13px] font-bold uppercase tracking-[0.16em]"
                          style={{ color: item.accent }}
                        >
                          Step {item.step}
                        </span>
                        <span
                          className="inline-flex w-fit rounded-full px-2.5 py-1 text-sm font-semibold"
                          style={{ backgroundColor: item.wash, color: item.accent }}
                        >
                          {item.chip}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1">
                      <h3 className="font-serif text-2xl font-bold text-[var(--color-navy-900)] sm:text-3xl">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-lg leading-relaxed text-[var(--color-text-secondary)]">
                        {item.summary}
                      </p>
                      <ul className="mt-5 flex flex-col gap-2.5">
                        {item.details.map((d) => (
                          <li key={d} className="flex items-start gap-3 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                            <span
                              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: item.accent }}
                              aria-hidden="true"
                            />
                            {d}
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
              eyebrow="What we will not do"
              title="Two promises, both structural"
              sub="Neither of these depends on us being nice about it."
              align="center"
            />

            <Stagger className="grid gap-6 md:grid-cols-2">
              {[
                {
                  icon: Lock,
                  accent: "var(--lob-life)",
                  wash: "var(--lob-life-wash)",
                  title: "Your data, yours to delete",
                  body: "Documents are encrypted in transit and processed securely. We keep your file so you can open it again later, and you can delete any policy and its file whenever you want. We are not building a database to sell.",
                },
                {
                  icon: Ban,
                  accent: "var(--lob-home)",
                  wash: "var(--lob-home-wash)",
                  title: "No commission, no upsell",
                  body: "We are not an IRDAI-registered broker or agent, so there is no policy we are steering you towards at the end of this. The audit is the product, not the lead.",
                },
              ].map((t) => (
                <RevealItem key={t.title}>
                  <div
                    className="flex h-full items-start gap-5 rounded-2xl border border-[var(--color-border-light)] p-7"
                    style={{ backgroundColor: t.wash }}
                  >
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white"
                      style={{ color: t.accent }}
                    >
                      <t.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="font-serif text-xl font-bold text-[var(--color-navy-900)]">
                        {t.title}
                      </h3>
                      <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                        {t.body}
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
              eyebrow="Questions"
              title="Questions people actually ask"
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
              Ready to see where you actually stand?
            </h2>

            {/* Was "Two minutes. No signup. Just clarity." The product has been
                gated behind an account since the D2C portfolio shipped. */}
            <p className="max-w-2xl text-lg leading-relaxed text-white/80">
              A free account and about two minutes. No card, and no call afterwards.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <CTA href="/signup" icon={ArrowRight}>Check my coverage</CTA>
              <CTA href="/compare" variant="ghost-ink">Compare plans</CTA>
            </div>
          </Reveal>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
