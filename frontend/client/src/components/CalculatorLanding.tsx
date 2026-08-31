import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Lock, Clock, Activity, AlertTriangle, ChevronDown, ArrowRight,
  Shield, TrendingUp, Search, Zap, Building2, Users, Layers,
} from "lucide-react";
import { Reveal, Stagger, RevealItem, EASE } from "@/components/motion";
import { Section, SectionHeading, Eyebrow, CTA } from "@/components/marketing";
import { CoverGap, SpotlightCard } from "@/components/marketing/showcase";

interface LandingProps {
  onStart: () => void;
}

/* ============================================================
   COVER CALCULATOR — landing

   The eyebrow chip, the logic timeline and the journey stepper on
   this page were all styled with --color-teal-50 / -100 / -200 /
   -700 / -800, none of which were ever defined. Every one of those
   rules was invalid, so the chips rendered with no background and
   the timeline with no rule. Those variables now exist, and this
   page is rebuilt around them.
   ============================================================ */

const OUTCOMES = [
  {
    icon: TrendingUp,
    accent: "var(--lob-health)",
    wash: "var(--lob-health-wash)",
    title: "A number, not a range",
    body: "What your family actually needs, anchored to private hospital costs in your own city rather than a national average.",
  },
  {
    icon: Search,
    accent: "var(--lob-life)",
    wash: "var(--lob-life-wash)",
    title: "Which riders earn their keep",
    body: "Room Rent Waiver changes whether a claim pays in full. Most of the others do not. We say which is which.",
  },
  {
    icon: Zap,
    accent: "var(--lob-motor)",
    wash: "var(--lob-motor-wash)",
    title: "How to buy it for less",
    body: "The cheapest way to hold a given amount of cover is usually not one large base policy. We show you the structure.",
  },
];

const LOGIC = [
  {
    icon: Building2,
    accent: "var(--lob-health)",
    title: "City anchor",
    desc: "We start from realistic private hospital costs for your city zone. A ₹10 L cover means something different in Mumbai than in Nashik.",
  },
  {
    icon: TrendingUp,
    accent: "var(--lob-life)",
    title: "Inflation planning",
    desc: "Medical costs are modelled forward so the cover still works in ten years, not just this year.",
  },
  {
    icon: Users,
    accent: "var(--lob-motor)",
    title: "Family stacking",
    desc: "Risk does not add up in a straight line across a family. We calculate the overlap rather than multiplying by heads.",
  },
  {
    icon: Layers,
    accent: "var(--lob-home)",
    title: "Structure",
    desc: "Base versus super top-up. In our model the same total cover is usually far cheaper bought as a smaller base with a top-up above it.",
  },
];

const MISTAKES = [
  {
    quote: "₹5 L is enough, my office covers me.",
    risk: "Employer cover ends the day the job does, and it ends at exactly the age when buying your own becomes expensive or impossible.",
  },
  {
    quote: "I'll just buy a higher base cover.",
    risk: "A base plus a super top-up usually holds the same total cover for substantially less premium. Most people are never shown the structure.",
  },
  {
    quote: "Riders are just marketing.",
    risk: "Some are. A Room Rent Waiver is not: it decides whether your claim pays in full or gets cut proportionately across the entire bill.",
  },
];

export function CalculatorLanding({ onStart }: LandingProps) {
  const [openLogic, setOpenLogic] = useState(false);

  return (
    <>
      {/* ─────────── HERO ─────────── */}
      <section className="relative overflow-hidden pb-14">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-grid-faint mask-fade-edges" />
          <div
            className="absolute -top-32 left-1/2 h-[480px] w-[860px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
            style={{ background: "radial-gradient(ellipse, rgba(45,212,191,0.20), transparent 68%)" }}
          />
        </div>

        <div className="container-editorial relative grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-center">
          <Reveal className="flex flex-col items-start gap-6">
            <Eyebrow icon={Activity}>Cover calculator</Eyebrow>

            <h1 className="font-serif font-bold tracking-[-0.035em] leading-[1.05] text-4xl sm:text-6xl text-[var(--color-navy-900)]">
              Exact coverage.
              <br />
              <span className="italic text-[var(--color-teal-600)]">Zero sales.</span>
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-[var(--color-text-secondary)]">
              How much health cover your family actually needs, worked out from hospital costs in
              your city, your ages and your obligations. No policy upload, and nothing to buy at
              the end of it.
            </p>

            <CTA onClick={onStart} icon={ArrowRight}>Start the calculator</CTA>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] text-[var(--color-text-secondary)]">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 shrink-0 text-[var(--color-teal-600)]" aria-hidden="true" />
                Two to three minutes
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="h-4 w-4 shrink-0 text-[var(--color-teal-600)]" aria-hidden="true" />
                No policy upload
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 shrink-0 text-[var(--color-teal-600)]" aria-hidden="true" />
                No medical history
              </span>
            </div>
          </Reveal>

          {/* What the calculator hands back, shown rather than described. */}
          <Reveal from="right">
            <div
              className="rounded-2xl bg-white p-6 sm:p-7"
              style={{ boxShadow: "0 0 0 1px rgba(15,23,42,0.07), 0 30px 60px -24px rgba(15,23,42,0.24)" }}
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                    Your result
                  </span>
                  <span className="mt-1 text-[15px] text-[var(--color-text-secondary)]">
                    38, two children, home loan, Pune
                  </span>
                </div>
                <span className="shrink-0 rounded-md bg-[var(--color-cream-dark)] px-2 py-1 text-sm font-semibold text-[var(--color-text-secondary)]">
                  Illustrative
                </span>
              </div>

              <div className="mb-5 flex items-baseline gap-2">
                <span className="font-serif text-5xl font-bold tracking-tight text-[var(--color-navy-900)]">
                  ₹1.9 Cr
                </span>
                <span className="text-[15px] text-[var(--color-text-secondary)]">is what you need</span>
              </div>

              <CoverGap have={10000000} need={19000000} monthly={1100} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─────────── WHAT YOU GET ─────────── */}
      <Section surface="mint">
        <div className="container-editorial flex flex-col gap-10">
          <SectionHeading
            eyebrow="What comes back"
            title="Three answers you cannot get from a brochure"
            sub="Every one of them is arithmetic. None of them depends on which policy you eventually buy, because we do not earn on that."
          />

          <Stagger className="grid gap-6 md:grid-cols-3">
            {OUTCOMES.map((o) => (
              <RevealItem key={o.title} className="h-full">
                <SpotlightCard accent={o.accent} className="h-full">
                  <div className="flex h-full flex-col gap-3 p-6">
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-xl"
                      style={{ backgroundColor: o.wash, color: o.accent }}
                    >
                      <o.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="font-serif text-xl font-bold text-[var(--color-navy-900)]">
                      {o.title}
                    </h3>
                    <p className="text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                      {o.body}
                    </p>
                  </div>
                </SpotlightCard>
              </RevealItem>
            ))}
          </Stagger>
        </div>
      </Section>

      {/* ─────────── THE LOGIC ─────────── */}
      <Section surface="white">
        <div className="container-editorial mx-auto flex max-w-4xl flex-col gap-8">
          <SectionHeading
            eyebrow="No black box"
            title="How the number is calculated"
            sub="Four steps, all of them arithmetic you could check yourself."
            align="center"
          />

          <Reveal className="flex justify-center">
            <button
              onClick={() => setOpenLogic((v) => !v)}
              aria-expanded={openLogic}
              aria-controls="calc-logic"
              className="group inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--color-border-medium)] bg-white px-5 text-[15px] font-semibold text-[var(--color-navy-900)] transition-colors hover:border-[var(--color-teal-600)] hover:text-[var(--color-teal-600)]"
            >
              {openLogic ? "Hide the working" : "Show the working"}
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-300 ${openLogic ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
          </Reveal>

          <AnimatePresence initial={false}>
            {openLogic && (
              <motion.div
                id="calc-logic"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="overflow-hidden"
              >
                <ol className="grid gap-4 pt-2 sm:grid-cols-2">
                  {LOGIC.map((s, i) => (
                    <li
                      key={s.title}
                      className="flex gap-4 rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-cream-main)] p-5"
                    >
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white"
                        style={{ color: s.accent }}
                      >
                        <s.icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <span
                          className="text-[13px] font-bold uppercase tracking-[0.14em]"
                          style={{ color: s.accent }}
                        >
                          Step {i + 1}
                        </span>
                        <h3 className="font-serif text-lg font-bold text-[var(--color-navy-900)]">
                          {s.title}
                        </h3>
                        <p className="mt-1 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                          {s.desc}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>

                <p className="mt-5 text-center text-sm text-[var(--color-text-secondary)]">
                  IndSure does not sell insurance and earns no commission. The result is a
                  calculation, not a recommendation to buy anything in particular.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Section>

      {/* ─────────── COMMON MISTAKES ─────────── */}
      <Section surface="ink" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-grid-faint-dark mask-fade-edges" />
          <div
            className="absolute -top-24 right-0 h-[420px] w-[560px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(180,83,9,0.22), transparent 70%)" }}
          />
        </div>

        <div className="container-editorial relative flex flex-col gap-10">
          <SectionHeading
            eyebrow="Before you start"
            title="Three things almost everybody gets wrong"
            icon={AlertTriangle}
            onInk
          />

          <Stagger className="grid gap-6 md:grid-cols-3">
            {MISTAKES.map((m) => (
              <RevealItem key={m.quote}>
                <div className="flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                  <p className="font-serif text-xl italic leading-snug text-[var(--color-teal-300)]">
                    &ldquo;{m.quote}&rdquo;
                  </p>
                  <span className="h-px w-10 bg-white/20" aria-hidden="true" />
                  <p className="text-[15px] leading-relaxed text-white/75">{m.risk}</p>
                </div>
              </RevealItem>
            ))}
          </Stagger>

          <Reveal className="flex justify-center pt-2">
            <CTA onClick={onStart} icon={ArrowRight}>Work out my number</CTA>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
