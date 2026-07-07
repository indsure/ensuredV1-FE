import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Check, Minus, Sparkles } from "lucide-react";

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
    tagline: "Your full client book, organised. Free forever.",
    price: "₹0",
    priceAnnual: "₹0",
    period: "forever",
    periodAnnual: "forever",
    features: [
      { label: "Full CRM — leads, renewals, portfolio" },
      { label: "Cover Calculator + shareable reports" },
      { label: "3 AI audit credits to try it out" },
      { label: "WhatsApp drafts in EN / Hinglish / Hindi" },
      { label: "No card needed" },
    ],
    cta: "Start free",
    ctaHref: "/agent/signup/step1",
  },
  {
    name: "Agent",
    tagline: "For advisors ready to run their book like a business.",
    price: "₹999",
    priceAnnual: "₹9,999",
    period: "/ month",
    periodAnnual: "/ year",
    subline: "12 audit credits every month",
    sublineAnnual: "≈ ₹833 / month · 2 months free",
    features: [
      { label: "12 AI audit credits every month" },
      { label: "Annual credits roll over till year-end" },
      { label: "Policy compare + Sach AI assistant" },
      { label: "Live quote feed — all insurance types", soon: true },
      { label: "Priority support" },
      { label: "Top-up packs from ₹449" },
    ],
    highlighted: true,
    cta: "Start free",
    ctaHref: "/agent/signup/step1",
  },
  {
    name: "Agency",
    tagline: "For teams and agencies managing multiple advisors.",
    price: "₹799",
    priceAnnual: "₹799",
    period: "/ seat / month",
    periodAnnual: "/ seat / month",
    subline: "Minimum 5 seats",
    sublineAnnual: "Minimum 5 seats",
    features: [
      { label: "Everything in Agent, per seat" },
      { label: "Credits pooled across the team (10 / seat)" },
      { label: "Live quote feed, pooled allowance", soon: true },
      { label: "Multi-advisor team management" },
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
  { label: "Policy data entry + Excel export (motor / life / travel / property)", free: "Up to 50 / month", agent: "Up to 50 / month", agency: "Up to 50 / month" },
  { label: "AI policy audit credits", free: "3 one-time", agent: "12 / month", agency: "10 / seat / month, pooled" },
  { label: "Policy compare (catalog or PDF wording)", free: "1 credit each", agent: "1 credit each", agency: "1 credit each" },
  { label: "Live quote feed — fetch & compare prices across insurers (coming soon)", free: false, agent: "Monthly allowance", agency: "Pooled allowance" },
  { label: "Extra credit top-ups (₹449 / 5 · ₹1,199 / 15)", free: false, agent: true, agency: true },
  { label: "Sach AI assistant", free: false, agent: "Fair use", agency: "Fair use" },
  { label: "Multi-advisor team management", free: false, agent: false, agency: true },
  { label: "Priority support", free: false, agent: true, agency: true },
  { label: "Dedicated onboarding", free: false, agent: false, agency: true },
];

function FeatureCell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="w-5 h-5 text-[var(--color-green-primary)] mx-auto" />;
  if (value === false) return <Minus className="w-4 h-4 text-[var(--color-text-muted)] mx-auto" />;
  return <span className="text-sm text-[var(--color-text-secondary)]">{value}</span>;
}

const topUpPacks = [
  { credits: 5, price: "₹449", perCredit: "₹90 / credit" },
  { credits: 15, price: "₹1,199", perCredit: "₹80 / credit" },
];

const faqs = [
  {
    q: "What exactly is a credit?",
    a: "1 credit = 1 full AI policy audit or 1 policy comparison. Everything else — leads, renewals, calculator, WhatsApp drafts, data entry — never uses credits.",
  },
  {
    q: "Is there a free trial?",
    a: "The Free plan is free forever, not a trial. Your leads, renewals, calculator and WhatsApp drafts stay free for life, and you get 3 audit credits to try the AI analysis. No card needed.",
  },
  {
    q: "What happens when I run out of credits?",
    a: "Buy a top-up pack anytime — ₹449 for 5 credits or ₹1,199 for 15. Top-up credits never expire while your plan is active.",
  },
  {
    q: "What is the live quote feed?",
    a: "An upcoming feature for Agent and Agency plans: fetch live premium quotes across insurers for every type of insurance, then compare price and wording side by side — so you can show a customer both the cheapest option and the best-value one. It won't use your audit credits; it comes with its own monthly quote allowance (limits announced at launch).",
  },
  {
    q: "Will prices increase later?",
    a: "Yes. Today's pricing is pre-quote-feed. When the live quote feed launches, prices for new signups will go up — Founding 50 members keep their locked rate forever.",
  },
  {
    q: "Do you offer a discount for annual billing?",
    a: "Yes — annual is 2 months free (₹9,999 instead of ₹11,988). Annual credits also roll over until year-end, while monthly-plan credits expire each month.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes. Upgrades apply immediately and your remaining credits carry over. Downgrades take effect from your next billing date.",
  },
  {
    q: "What happens to my leads/customers if I cancel?",
    a: "They stay yours. You can export your full book to Excel anytime, and your data is retained or deleted as per our Privacy Policy and India's DPDP Act — just ask.",
  },
  {
    q: "Do you take a commission on policies I sell?",
    a: "No — IndSure charges a flat subscription fee. We are not an IRDAI-registered broker or agent and do not earn commissions.",
  },
];

export default function Pricing() {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <Header />

      <main className="flex-grow pt-24 pb-20 px-6 w-full">

        {/* HERO */}
        <section className="max-w-4xl mx-auto text-center mb-8 animate-reveal">
          <div className="inline-block py-1 px-3 border border-[var(--color-border-main)] rounded-full text-xs font-mono uppercase tracking-widest text-[var(--color-text-secondary)] mb-4 bg-white">
            For Advisors
          </div>
          <h1 className="text-4xl md:text-5xl font-serif mb-4 tracking-tight text-[var(--color-text-main)] leading-tight">
            Simple pricing. <span className="italic text-[var(--color-green-primary)]">Serious tools.</span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-secondary)] font-light leading-relaxed max-w-2xl mx-auto">
            One closed policy pays for months of IndSure.
            No commissions taken, no fine print here either.
          </p>
        </section>

        {/* FOUNDING 50 BANNER */}
        <section className="max-w-3xl mx-auto mb-8">
          <div className="flex items-center justify-center gap-3 bg-[var(--color-green-primary)]/10 border border-[var(--color-green-primary)] rounded-lg px-6 py-3 text-center">
            <Sparkles className="w-5 h-5 text-[var(--color-green-primary)] shrink-0" />
            <div>
              <p className="text-sm md:text-base text-[var(--color-text-main)]">
                <span className="font-semibold">Founding 50:</span> the first 50 agents get their first year at{" "}
                <span className="font-semibold">₹4,999</span>{" "}
                <span className="line-through text-[var(--color-text-muted)]">₹9,999</span> — locked in when you join.
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Prices rise when the live quote feed launches. Founding 50 keep their rate forever.
              </p>
            </div>
          </div>
        </section>

        {/* BILLING TOGGLE */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <span className={`text-sm font-medium ${!annual ? "text-[var(--color-text-main)]" : "text-[var(--color-text-muted)]"}`}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            className="relative w-14 h-8 rounded-full bg-[var(--color-cream-dark)] border border-[var(--color-border-main)] transition-colors"
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
        <section className="max-w-6xl mx-auto mb-6 grid md:grid-cols-3 gap-8 items-start">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`card-white p-8 md:p-10 flex flex-col ${tier.highlighted ? "border-2 border-[var(--color-green-primary)] shadow-xl relative" : ""}`}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[var(--color-green-primary)] text-white text-xs font-semibold uppercase tracking-widest px-4 py-1 rounded-full">
                  Most Popular
                </div>
              )}
              <h3 className="text-2xl font-serif mb-2">{tier.name}</h3>
              <p className="text-sm text-[var(--color-text-secondary)] mb-6 min-h-[40px]">{tier.tagline}</p>
              <div className="mb-2">
                <span className="text-4xl font-serif">{annual ? tier.priceAnnual : tier.price}</span>
                <span className="text-sm text-[var(--color-text-secondary)] ml-1">{annual ? tier.periodAnnual : tier.period}</span>
              </div>
              <p className="text-sm text-[var(--color-green-primary)] mb-6 min-h-[20px]">
                {(annual ? tier.sublineAnnual : tier.subline) ?? ""}
              </p>
              <ul className="space-y-3 mb-8">
                {tier.features.map((f) => (
                  <li key={f.label} className="flex items-start gap-2 text-sm text-[var(--color-text-main)]">
                    <Check className="w-4 h-4 text-[var(--color-green-primary)] mt-0.5 shrink-0" />
                    <span>
                      {f.label}
                      {f.soon && (
                        <span className="ml-1.5 align-middle inline-block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-green-primary)] border border-[var(--color-green-primary)] rounded-full px-1.5 leading-4">
                          Soon
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                size="lg"
                className={
                  tier.highlighted
                    ? "bg-[var(--color-green-primary)] hover:bg-[var(--color-green-secondary)] text-white rounded-full mt-auto"
                    : "bg-transparent border border-[var(--color-border-main)] text-[var(--color-text-main)] hover:bg-[var(--color-cream-dark)] rounded-full mt-auto"
                }
              >
                <Link href={tier.ctaHref}>{tier.cta}</Link>
              </Button>
            </div>
          ))}
        </section>

        <p className="text-center text-xs text-[var(--color-text-muted)] mb-16">
          All prices in INR, inclusive of GST.
        </p>

        {/* CREDIT EXPLAINER + TOP-UPS */}
        <section className="max-w-4xl mx-auto mb-24">
          <div className="card-white p-8 md:p-10 text-center">
            <h2 className="text-2xl font-serif mb-3">How credits work</h2>
            <p className="text-[var(--color-text-secondary)] leading-relaxed max-w-2xl mx-auto mb-8">
              <span className="font-semibold text-[var(--color-text-main)]">1 credit = 1 full AI policy audit or 1 policy comparison.</span>{" "}
              Less than ₹100 to walk into a client meeting with a complete audit in hand —
              and one closed policy pays for months of them.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              {topUpPacks.map((pack) => (
                <div key={pack.credits} className="border border-[var(--color-border-main)] rounded-lg px-8 py-5 bg-[var(--color-cream-main)]">
                  <div className="text-2xl font-serif">{pack.price}</div>
                  <div className="text-sm text-[var(--color-text-main)] font-medium">{pack.credits} credits</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{pack.perCredit}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-4">
              Top-up credits never expire while your plan is active.
              Live quotes (coming soon) won't use credits — they'll have their own monthly allowance.
            </p>
          </div>
        </section>

        {/* FEATURE COMPARISON TABLE */}
        <section className="max-w-5xl mx-auto mb-24 overflow-x-auto">
          <h2 className="text-3xl font-serif mb-8 text-center">What's included</h2>
          <table className="w-full border-collapse min-w-[640px]">
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
                  <td className="py-4 text-sm text-[var(--color-text-main)]">{row.label}</td>
                  <td className="py-4 text-center px-2"><FeatureCell value={row.free} /></td>
                  <td className="py-4 text-center px-2 bg-[var(--color-cream-dark)]/40"><FeatureCell value={row.agent} /></td>
                  <td className="py-4 text-center px-2"><FeatureCell value={row.agency} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto mb-24">
          <h2 className="text-3xl font-serif mb-10 text-center">Pricing questions</h2>
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
        <section className="bg-[var(--color-petrol-900)] text-white rounded-lg p-16 text-center max-w-5xl mx-auto shadow-2xl relative overflow-hidden">
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
