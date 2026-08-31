import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Check, Minus, Sparkles, ArrowRight } from "lucide-react";

type TierFeature = { label: string; soon?: boolean };

type Tier = {
  name: string;
  tagline: string;
  price: string;
  priceAnnual: string;
  period: string;
  periodAnnual: string;
  subline?: string;
  sublineAnnual?: string;
  features: TierFeature[];
  highlighted?: boolean;
  cta: string;
  ctaHref: string;
};

const tiers: Tier[] = [
  {
    name: "Free",
    tagline: "Everything for your daily work. Free forever.",
    price: "₹0",
    priceAnnual: "₹0",
    period: "forever",
    periodAnnual: "forever",
    features: [
      { label: "Leads, renewals and client portfolio" },
      { label: "Cover Calculator with shareable reports" },
      { label: "3 policy checks to try" },
      { label: "20 data-entry policies (motor / life / term / travel)" },
      { label: "WhatsApp drafts in English, Hindi and Hinglish" },
      { label: "No card needed" },
    ],
    cta: "Start free",
    ctaHref: "/agent/signup/step1",
  },
  {
    name: "Agent",
    tagline: "For the full-time advisor.",
    price: "₹1,499",
    priceAnnual: "₹14,990",
    period: "/ month",
    periodAnnual: "/ year",
    subline: "12 policy checks every month",
    sublineAnnual: "12 policy checks every month · 2 months free",
    features: [
      { label: "12 policy checks every month — audit or compare" },
      { label: "50 data-entry policies every month (annual plan carries unused ones over)" },
      { label: "On annual plan, unused checks roll over till year-end" },
      { label: "Sach assistant for policy questions" },
      { label: "Live premium quotes across insurers", soon: true },
      { label: "Priority support" },
      { label: "Need more? Packs from ₹449" },
    ],
    highlighted: true,
    cta: "Start free",
    ctaHref: "/agent/signup/step1",
  },
  {
    name: "Agency",
    tagline: "For agencies with a team of advisors.",
    price: "₹1,199",
    priceAnnual: "₹1,199",
    period: "/ seat / month",
    periodAnnual: "/ seat / month",
    subline: "Minimum 5 seats",
    sublineAnnual: "Minimum 5 seats",
    features: [
      { label: "Everything in Agent, for every seat" },
      // Was "shared across the team". The team feature that shipped gives each
      // seat its own 10 and lets the owner move unused ones between advisors —
      // there is no common pool, so the old wording promised something the
      // product does not do.
      { label: "10 policy checks a seat — move spare ones between advisors" },
      { label: "Live quotes with a shared allowance", soon: true },
      { label: "Manage all your advisors in one place" },
      { label: "Dedicated onboarding" },
    ],
    cta: "Talk to us",
    ctaHref: "/agent",
  },
];

const featureRows: { label: string; free: string | boolean; agent: string | boolean; agency: string | boolean }[] = [
  { label: "Leads pipeline (WhatsApp + Call one-tap)", free: true, agent: true, agency: true },
  { label: "Customer portfolio & cover-gap suggestions", free: true, agent: true, agency: true },
  { label: "Renewals hit-list (30-day expiring policies)", free: true, agent: true, agency: true },
  { label: "Cover Calculator + shareable reports", free: true, agent: true, agency: true },
  { label: "WhatsApp message drafts (EN / Hinglish / Hindi)", free: true, agent: true, agency: true },
  { label: "Rider directory", free: true, agent: true, agency: true },
  { label: "Policy data entry + Excel export (motor / life / travel / property)", free: "20 total", agent: "50 / month", agency: "50 / seat / month" },
  { label: "Policy checks — full audit of any policy", free: "3 one-time", agent: "12 / month", agency: "10 / seat / month, movable" },
  { label: "Policy compare, side by side (uses 1 check)", free: true, agent: true, agency: true },
  { label: "Live quotes — fetch & compare prices across insurers (coming soon)", free: false, agent: "Monthly allowance", agency: "Shared allowance" },
  { label: "Extra check packs (5 for ₹449 · 15 for ₹1,199)", free: false, agent: true, agency: true },
  { label: "Sach assistant — ask any policy question", free: false, agent: "Fair use", agency: "Fair use" },
  { label: "Manage multiple advisors as a team", free: false, agent: false, agency: true },
  { label: "Priority support", free: false, agent: true, agency: true },
  { label: "Dedicated onboarding", free: false, agent: false, agency: true },
];

function FeatureCell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="w-5 h-5 text-[var(--color-green-primary)] mx-auto" />;
  if (value === false) return <Minus className="w-4 h-4 text-[var(--color-text-muted)] mx-auto" />;
  return <span className="text-sm text-[var(--color-text-secondary)]">{value}</span>;
}

const topUpPacks = [
  { credits: 5, price: "₹449" },
  { credits: 15, price: "₹1,199" },
];

const faqs = [
  {
    q: "What is a policy check?",
    a: "One check is one full policy audit, or one side-by-side comparison of two policies. Leads, renewals, calculator and WhatsApp drafts never use your checks. Data entry (motor / life / term / travel) has its own separate allowance — 20 in total on Free, 50 a month on paid plans — so it never touches your policy checks either.",
  },
  {
    q: "Is there a free trial?",
    a: "The Free plan is free forever, not a trial. Your leads, renewals, calculator and WhatsApp drafts stay free for life, and you get 3 policy checks to see the reports for yourself. No card needed.",
  },
  {
    q: "What happens when I run out of checks?",
    a: "Buy a pack anytime — ₹449 for 5 checks or ₹1,199 for 15. Purchased checks never expire while your plan is active.",
  },
  {
    q: "What are live quotes?",
    a: "An upcoming feature for Agent and Agency plans: fetch live premium quotes across insurers for every type of insurance, then compare price and wording side by side — so you can show a customer both the cheapest option and the best-value one. Live quotes won't use your policy checks; they come with their own monthly allowance (limits announced at launch).",
  },
  {
    q: "Will prices increase later?",
    a: "Yes. When live quotes launch, prices for new signups will go up. Founding 50 members keep their locked rate forever.",
  },
  {
    q: "Do you offer a discount for annual billing?",
    a: "Yes — annual is 2 months free (₹14,990 instead of ₹17,988). Unused checks on the annual plan also roll over until year-end, while monthly-plan checks expire each month.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes. Upgrades apply immediately and your remaining checks carry over. Downgrades take effect from your next billing date.",
  },
  {
    q: "What happens to my leads and customers if I cancel?",
    a: "They stay yours. You can export everything to Excel anytime, and your data is retained or deleted as per our Privacy Policy and India's DPDP Act — just ask.",
  },
  {
    q: "Do you take a commission on policies I sell?",
    a: "No — IndSure charges a flat subscription fee. We are not an IRDAI-registered broker or agent and do not earn commissions.",
  },
];

export default function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <Header />

      <main className="flex-grow pt-24 pb-12 sm:pb-16 lg:pb-20 px-6 w-full">

        {/* HERO */}
        <section className="relative max-w-4xl mx-auto text-center mb-8 animate-reveal">
          <div className="pointer-events-none absolute -inset-x-24 -top-16 -bottom-8 -z-10 overflow-hidden" aria-hidden="true">
            <div className="absolute inset-0 bg-grid-faint mask-fade-edges" />
            <div
              className="absolute -top-24 left-1/2 h-[380px] w-[760px] -translate-x-1/2 rounded-full opacity-70 blur-3xl"
              style={{ background: "radial-gradient(ellipse, rgba(45,212,191,0.18), transparent 68%)" }}
            />
          </div>
          <div className="inline-block py-1.5 px-3.5 border border-[var(--color-teal-600)]/25 bg-[var(--color-teal-50)] rounded-full text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--color-teal-700)] mb-4">
            For advisors
          </div>
          <h1 className="text-4xl md:text-5xl font-serif mb-4 tracking-tight text-[var(--color-text-main)] leading-tight">
            Simple pricing. <span className="italic text-[var(--color-green-primary)]">One policy covers it.</span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-secondary)] font-light leading-relaxed max-w-2xl mx-auto">
            Your daily tools are free forever. The full plan costs ₹1,499 a month —
            close one policy and it has paid for itself. We take no commission, ever.
          </p>
        </section>

        {/* FOUNDING 50 BANNER */}
        <section className="max-w-3xl mx-auto mb-8">
          <div className="flex items-center justify-center gap-4 rounded-2xl border border-[var(--lob-motor)]/30 bg-[var(--lob-motor-wash)] px-6 py-5 text-center">
            <Sparkles className="h-6 w-6 shrink-0 text-[var(--lob-motor)]" aria-hidden="true" />
            <div>
              <p className="text-[15px] md:text-base text-[var(--color-text-main)]">
                <span className="font-semibold">Founding 50:</span> the first 50 advisors get a full year at{" "}
                <span className="font-semibold">₹9,990</span>{" "}
                <span className="line-through text-[var(--color-text-muted)]">₹14,990</span> — a third off, locked in forever.
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Prices rise when live quotes launch. Founding members keep their rate.
              </p>
            </div>
          </div>
        </section>

        {/* BILLING TOGGLE */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <span className={`text-sm font-medium ${!annual ? "text-[var(--color-text-main)]" : "text-[var(--color-text-muted)]"}`}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            className="relative before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] w-14 h-8 rounded-full bg-[var(--color-cream-dark)] border border-[var(--color-border-main)] transition-colors"
            aria-label="Toggle annual billing"
          >
            <span
              className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-[var(--color-green-primary)] transition-transform ${annual ? "translate-x-6" : ""}`}
            />
          </button>
          <span className={`text-sm font-medium ${annual ? "text-[var(--color-text-main)]" : "text-[var(--color-text-muted)]"}`}>
            Annual <span className="text-[var(--color-green-primary)]">(2 months free)</span>
          </span>
        </div>

        {/* TIER CARDS */}
        <section className="max-w-6xl mx-auto mb-6 grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {/* Three cards that used to differ only by a border colour. Each now
              carries a coloured cap in its own line-of-business accent, so the
              row has a shape before you read a word of it. */}
          {tiers.map((tier, i) => {
            const accent = ["var(--lob-life)", "var(--lob-health)", "var(--lob-motor)"][i] ?? "var(--lob-general)";
            const wash = ["var(--lob-life-wash)", "var(--lob-health-wash)", "var(--lob-motor-wash)"][i] ?? "var(--lob-general-wash)";
            const pick = !!tier.highlighted;
            return (
              <div
                key={tier.name}
                className={`relative flex flex-col overflow-hidden rounded-2xl bg-white transition-shadow duration-300 ${
                  pick
                    ? "shadow-[0_24px_60px_-22px_rgba(13,148,136,0.45)]"
                    : "shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:shadow-[0_16px_40px_-16px_rgba(15,23,42,0.2)]"
                }`}
                style={{
                  outline: pick ? "2px solid var(--color-teal-600)" : "1px solid var(--color-border-light)",
                  outlineOffset: -1,
                }}
              >
                <div className="px-6 pt-7 pb-6" style={{ backgroundColor: wash }}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-serif text-2xl font-bold text-[var(--color-navy-900)]">{tier.name}</h3>
                    {/* Was "Most Popular". With the book this size that is a
                        claim about other customers we cannot support, so the
                        badge says what it actually is. */}
                    {pick && (
                      <span
                        className="shrink-0 rounded-full px-3 py-1 text-[13px] font-bold uppercase tracking-[0.1em] text-white"
                        style={{ backgroundColor: accent }}
                      >
                        Our pick
                      </span>
                    )}
                  </div>

                  <p className="mt-2 min-h-[44px] text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                    {tier.tagline}
                  </p>

                  <div className="mt-4 flex flex-wrap items-baseline gap-2">
                    <span className="font-serif text-4xl font-bold tracking-tight text-[var(--color-navy-900)] tabular">
                      {annual ? tier.priceAnnual : tier.price}
                    </span>
                    <span className="text-[15px] text-[var(--color-text-secondary)]">
                      {annual ? tier.periodAnnual : tier.period}
                    </span>
                  </div>

                  <p className="mt-1 min-h-[22px] text-[15px] font-semibold" style={{ color: accent }}>
                    {(annual ? tier.sublineAnnual : tier.subline) ?? ""}
                  </p>
                </div>

                <div className="flex flex-1 flex-col gap-6 p-6">
                  <ul className="flex flex-col gap-3">
                    {tier.features.map((f) => (
                      <li key={f.label} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-[var(--color-text-main)]">
                        <Check className="mt-1 h-4 w-4 shrink-0" style={{ color: accent }} aria-hidden="true" />
                        <span>
                          {f.label}
                          {f.soon && (
                            <span className="ml-1.5 inline-block rounded-full border px-1.5 align-middle text-[13px] font-semibold uppercase leading-5 tracking-wider"
                              style={{ color: accent, borderColor: accent }}>
                              Soon
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={tier.ctaHref}
                    className={`mt-auto inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-lg text-base font-semibold transition-all duration-200 ${
                      pick
                        ? "bg-[var(--color-teal-600)] text-white hover:bg-[#0F766E] hover:-translate-y-0.5"
                        : "border border-[var(--color-border-medium)] bg-white text-[var(--color-text-main)] hover:border-[var(--color-teal-600)] hover:text-[var(--color-teal-600)]"
                    }`}
                  >
                    {tier.cta}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            );
          })}
        </section>

        <p className="mb-16 text-center text-sm text-[var(--color-text-secondary)]">
          All prices in INR, inclusive of GST.
        </p>

        {/* CREDIT EXPLAINER + TOP-UPS */}
        <section className="max-w-4xl mx-auto mb-12 sm:mb-16 lg:mb-24">
          <div className="card-white p-8 md:p-10 text-center">
            <h2 className="mb-3 font-serif text-2xl font-bold text-[var(--color-navy-900)]">How policy checks work</h2>
            <span className="rule-accent mx-auto mb-6" />
            <p className="text-[var(--color-text-secondary)] leading-relaxed max-w-2xl mx-auto mb-8">
              <span className="font-semibold text-[var(--color-text-main)]">One check is one full policy audit, or one side-by-side comparison.</span>{" "}
              That's less than ₹100 to walk into a client meeting with a complete audit in hand.
              The commission on a single closed policy covers your month many times over.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              {topUpPacks.map((pack) => (
                <div
                  key={pack.credits}
                  className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-cream-main)] px-8 py-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-teal-600)]/40"
                >
                  <div className="font-serif text-3xl font-bold text-[var(--color-navy-900)] tabular">{pack.price}</div>
                  <div className="text-[15px] font-semibold text-[var(--color-text-secondary)]">
                    {pack.credits} policy checks
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
              Purchased checks never expire while your plan is active.
              Live quotes (coming soon) won't use your checks — they'll have their own monthly allowance.
            </p>
          </div>
        </section>

        {/* FEATURE COMPARISON TABLE */}
        <section className="bleed bleed-mint max-w-5xl mx-auto mb-12 sm:mb-16 lg:mb-24 py-14 md:overflow-x-auto">
          <h2 className="text-3xl font-serif mb-3 text-center">What&apos;s included</h2>
          <span className="rule-accent mx-auto mb-8" />
          <table className="table-cards w-full border-collapse md:min-w-[640px]">
            <thead>
              <tr className="border-b border-[var(--color-border-main)]">
                <th className="text-left py-4 font-normal text-sm text-[var(--color-text-secondary)]">Feature</th>
                <th className="py-4 font-serif text-lg">Free</th>
                <th className="py-4 font-serif text-lg text-[var(--color-green-primary)]">Agent</th>
                <th className="py-4 font-serif text-lg">Agency</th>
              </tr>
            </thead>
            <tbody>
              {featureRows.map((row) => (
                <tr key={row.label} className="border-b border-[var(--color-border-light)]">
                  <td className="py-4 text-sm text-[var(--color-text-main)]" data-label="Feature" data-cell="title">{row.label}</td>
                  <td className="py-4 text-center px-2" data-label="Free"><FeatureCell value={row.free} /></td>
                  <td className="py-4 text-center px-2 bg-[var(--color-cream-dark)]/40" data-label="Agent"><FeatureCell value={row.agent} /></td>
                  <td className="py-4 text-center px-2" data-label="Agency"><FeatureCell value={row.agency} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto mb-12 sm:mb-16 lg:mb-24 pt-4">
          <h2 className="text-3xl font-serif mb-3 text-center">Pricing questions</h2>
          <span className="rule-accent mx-auto mb-10" />
          <div className="space-y-6">
            {faqs.map((f) => (
              <div key={f.q} className="border-b border-[var(--color-border-light)] pb-6">
                <h3 className="text-lg font-semibold mb-2">{f.q}</h3>
                <p className="text-[var(--color-text-secondary)] leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[var(--color-petrol-900)] text-white rounded-lg p-6 sm:p-10 lg:p-16 text-center max-w-5xl mx-auto shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-[-50%] left-[-20%] w-[500px] h-[500px] bg-[var(--color-green-primary)] rounded-full blur-[100px]"></div>
          </div>
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-serif mb-6 text-white">Not sure which plan fits?</h2>
            <p className="text-xl text-white/80 max-w-2xl mx-auto mb-10 font-light">
              Talk to us for 15 minutes — we'll tell you honestly if the free plan covers you.
            </p>
            <Button asChild size="lg" className="bg-[var(--color-green-primary)] hover:bg-[var(--color-green-secondary)] text-white h-14 px-8 text-lg rounded-full">
              <Link href="/agent">Talk to Us</Link>
            </Button>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
