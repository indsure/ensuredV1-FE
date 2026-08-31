import { Link, useLocation } from "wouter";
import {
  Shield, Lock, Clock, FileText, Search, Zap, ArrowRight,
  Ruler, Percent, CalendarClock, Ban, Layers, Building2, MapPin, RotateCcw,
} from "lucide-react";
import { loadSampleReport, mockReportHealth } from "@/lib/mock-data";
import { Reveal, Stagger, RevealItem } from "@/components/motion";
import { Section, SectionHeading, Eyebrow, CTA } from "@/components/marketing";
import { ClauseDecoder, ScoreDial, SpotlightCard } from "@/components/marketing/showcase";

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
   pipeline is organised. */
const CHECK_GROUPS = [
  {
    title: "What you get paid",
    accent: "var(--lob-health)",
    wash: "var(--lob-health-wash)",
    icon: Ruler,
    items: [
      { icon: Ruler, label: "Room rent caps", note: "and the proportionate deduction they trigger" },
      { icon: Percent, label: "Co-pay percentages", note: "including the ones that start at a birthday" },
      { icon: Layers, label: "Disease sub-limits", note: "cataract, knee, maternity, and the rest" },
    ],
  },
  {
    title: "When you get paid",
    accent: "var(--lob-life)",
    wash: "var(--lob-life-wash)",
    icon: CalendarClock,
    items: [
      { icon: CalendarClock, label: "Waiting periods", note: "pre-existing, specific surgeries, maternity" },
      { icon: Ban, label: "Permanent exclusions", note: "the ones written into the annexure" },
      { icon: RotateCcw, label: "Restoration terms", note: "whether it refills for the same illness" },
    ],
  },
  {
    title: "Where you stand",
    accent: "var(--lob-motor)",
    wash: "var(--lob-motor-wash)",
    icon: MapPin,
    items: [
      { icon: MapPin, label: "Zone limitations", note: "what changes if you are treated in a metro" },
      { icon: Building2, label: "Employer dependency", note: "what you lose the day you leave the job" },
      { icon: Shield, label: "Rider effectiveness", note: "which add-ons change a claim, and which do not" },
    ],
  },
];

const OUTCOMES = [
  {
    icon: Search,
    accent: "var(--lob-health)",
    wash: "var(--lob-health-wash)",
    title: "A clear verdict",
    body: "Correctly insured, under-insured, or exposed. One score, and the sentence that explains it.",
  },
  {
    icon: FileText,
    accent: "var(--lob-life)",
    wash: "var(--lob-life-wash)",
    title: "Plain English throughout",
    body: "\"Co-pay on Zone B treatment\" becomes \"you pay 20% of the bill in Mumbai\". Every clause, that treatment.",
  },
  {
    icon: Zap,
    accent: "var(--lob-motor)",
    wash: "var(--lob-motor-wash)",
    title: "Something to do about it",
    body: "Specific next steps for the gaps we find. We never tell you which policy to buy, because we cannot earn on it.",
  },
];

export function PolicyCheckerLanding() {
  const [, setLocation] = useLocation();

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
            <Eyebrow>Policy decoder</Eyebrow>

            <h1 className="font-serif font-bold tracking-[-0.035em] leading-[1.05] text-4xl sm:text-6xl text-[var(--color-navy-900)]">
              The fine print,
              <br />
              <span className="italic text-[var(--color-teal-600)]">translated.</span>
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-[var(--color-text-secondary)]">
              Upload the policy you already own. The engine reads every clause, exclusion and rider,
              and tells you what you are actually covered for, in the words you would use yourself.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <CTA href="/signup" icon={ArrowRight}>Check my policy</CTA>
              <CTA
                variant="secondary"
                onClick={() => { loadSampleReport(mockReportHealth); setLocation("/report?sample=health"); }}
              >
                See a finished report
              </CTA>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] text-[var(--color-text-secondary)]">
              <span className="flex items-center gap-1.5">
                <Lock className="h-4 w-4 shrink-0 text-[var(--color-teal-600)]" aria-hidden="true" />
                Private to your account
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 shrink-0 text-[var(--color-teal-600)]" aria-hidden="true" />
                About a minute
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="h-4 w-4 shrink-0 text-[var(--color-teal-600)]" aria-hidden="true" />
                PDF or a photo of the printout
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
                <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                  Insurance health score
                </span>
                <span className="rounded-md bg-[var(--color-cream-dark)] px-2 py-1 text-sm font-semibold text-[var(--color-text-secondary)]">
                  Illustrative
                </span>
              </div>

              <ScoreDial
                score={63}
                caption="A ₹10 L family floater with a room-rent cap and a co-pay after sixty."
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─────────── THE DECODER ─────────── */}
      <Section surface="mint">
        <div className="container-editorial flex flex-col gap-10">
          <SectionHeading
            eyebrow="What a decode looks like"
            title="One clause, both ways round"
            sub="This is the whole product. On the left, the sentence exactly as your policy words it. On the right, what it does to you at the hospital counter. Pick a clause."
          />

          <Reveal>
            <ClauseDecoder />
          </Reveal>

          <Reveal className="text-center">
            <p className="text-[15px] text-[var(--color-text-secondary)]">
              Your own report reads like this for every clause in the document, not just three.
            </p>
          </Reveal>
        </div>
      </Section>

      {/* ─────────── WHAT WE CHECK ─────────── */}
      <Section surface="white">
        <div className="container-editorial flex flex-col gap-10">
          <SectionHeading
            eyebrow="The checks"
            title="What the engine looks for"
            sub="Grouped the way a customer asks about them rather than the way the pipeline runs."
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
                        {g.title}
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
                              {it.label}
                            </span>
                            <span className="block text-sm leading-snug text-[var(--color-text-secondary)]">
                              {it.note}
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
            eyebrow="What comes back"
            title="Three things, and nothing to buy"
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
                    {o.title}
                  </h3>
                  <p className="text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                    {o.body}
                  </p>
                </div>
              </RevealItem>
            ))}
          </Stagger>

          {/* Samples run on mock data and are open to signed-out visitors. */}
          <Reveal className="flex flex-col items-center gap-4 pt-4">
            <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              Read a finished one first
            </span>

            <div className="flex flex-wrap justify-center gap-3">
              {[
                { label: "Health policy", href: "/report?sample=health", accent: "var(--lob-health)" },
                { label: "Term life", href: "/report?sample=life", accent: "var(--lob-life)" },
                { label: "Car insurance", href: "/report?sample=vehicle", accent: "var(--lob-motor)" },
              ].map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-white px-4 text-[15px] font-semibold transition-all duration-200 hover:-translate-y-0.5"
                  style={{ borderColor: `${s.accent}44`, color: s.accent }}
                >
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  {s.label}
                </Link>
              ))}
            </div>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
