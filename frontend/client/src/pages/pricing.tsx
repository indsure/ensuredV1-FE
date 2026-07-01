import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Check, Minus } from "lucide-react";

// SKELETON — structure + real feature set only. Every {price: "—"} below is a
// placeholder for actual numbers; nothing here should ship as final copy.

type Tier = {
  name: string;
  tagline: string;
  price: string;
  priceAnnual: string;
  period: string;
  highlighted?: boolean;
  cta: string;
  ctaHref: string;
};

const tiers: Tier[] = [
  {
    name: "Solo",
    tagline: "For individual advisors just getting started.",
    price: "—",
    priceAnnual: "—",
    period: "/ agent / month",
    cta: "Start free",
    ctaHref: "/agent/signup/step1",
  },
  {
    name: "Growth",
    tagline: "For advisors ready to run their book like a business.",
    price: "—",
    priceAnnual: "—",
    period: "/ agent / month",
    highlighted: true,
    cta: "Start free",
    ctaHref: "/agent/signup/step1",
  },
  {
    name: "Agency",
    tagline: "For teams and agencies managing multiple advisors.",
    price: "Contact us",
    priceAnnual: "Contact us",
    period: "",
    cta: "Talk to sales",
    ctaHref: "/agent",
  },
];

// Real, already-built features — accurate as of this build. Update if the
// product surface changes before real pricing is finalized.
const featureRows: { label: string; solo: string | boolean; growth: string | boolean; agency: string | boolean }[] = [
  { label: "Leads pipeline (WhatsApp + Call one-tap)", solo: true, growth: true, agency: true },
  { label: "Customer portfolio & cover-gap suggestions", solo: true, growth: true, agency: true },
  { label: "Renewals hit-list (30-day expiring policies)", solo: true, growth: true, agency: true },
  { label: "Cover Calculator + shareable reports", solo: true, growth: true, agency: true },
  { label: "Policy compare (catalog, 63 plans / 10 insurers)", solo: "Limited", growth: "Unlimited", agency: "Unlimited" },
  { label: "Policy compare (PDF upload, any wording)", solo: false, growth: true, agency: true },
  { label: "WhatsApp message drafts (EN / Hinglish / Hindi)", solo: true, growth: true, agency: true },
  { label: "Rider directory", solo: true, growth: true, agency: true },
  { label: "Multi-advisor team management", solo: false, growth: false, agency: true },
  { label: "Priority support", solo: false, growth: true, agency: true },
  { label: "Dedicated onboarding", solo: false, growth: false, agency: true },
];

function FeatureCell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="w-5 h-5 text-[var(--color-green-primary)] mx-auto" />;
  if (value === false) return <Minus className="w-4 h-4 text-[var(--color-text-muted)] mx-auto" />;
  return <span className="text-sm text-[var(--color-text-secondary)]">{value}</span>;
}

const faqs = [
  { q: "Is there a free trial?", a: "[TBD — confirm trial length / whether Solo tier is free indefinitely.]" },
  { q: "Can I switch plans later?", a: "[TBD — confirm upgrade/downgrade + proration policy.]" },
  { q: "Do you offer a discount for annual billing?", a: "[TBD — confirm annual discount %.]" },
  { q: "What happens to my leads/customers if I cancel?", a: "[TBD — confirm data retention/export policy on cancellation.]" },
  { q: "Do you take a commission on policies I sell?", a: "No — IndSure charges a flat subscription fee. We are not an IRDAI-registered broker or agent and do not earn commissions." },
];

export default function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] font-sans text-[var(--color-text-main)] flex flex-col">
      <Header />

      <main className="flex-grow pt-32 pb-20 px-6 w-full">

        {/* HERO */}
        <section className="max-w-4xl mx-auto text-center mb-16 animate-reveal">
          <div className="inline-block py-1 px-3 border border-[var(--color-border-main)] rounded-full text-xs font-mono uppercase tracking-widest text-[var(--color-text-secondary)] mb-6 bg-white">
            For Advisors
          </div>
          <h1 className="text-5xl md:text-7xl font-serif mb-8 tracking-tight text-[var(--color-text-main)] leading-tight">
            Simple pricing. <br />
            <span className="italic text-[var(--color-green-primary)]">Serious tools.</span>
          </h1>
          <p className="text-xl md:text-2xl text-[var(--color-text-secondary)] font-light leading-relaxed max-w-2xl mx-auto">
            Straightforward plans for individual advisors and growing agencies.
            No commissions taken, no fine print here either.
          </p>
        </section>

        {/* BILLING TOGGLE */}
        <div className="flex items-center justify-center gap-4 mb-16">
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
            Annual <span className="text-[var(--color-green-primary)]">(save —%)</span>
          </span>
        </div>

        {/* TIER CARDS */}
        <section className="max-w-6xl mx-auto mb-24 grid md:grid-cols-3 gap-8 items-start">
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
              <div className="mb-8">
                <span className="text-4xl font-serif">{annual ? tier.priceAnnual : tier.price}</span>
                {tier.period && <span className="text-sm text-[var(--color-text-secondary)] ml-1">{tier.period}</span>}
              </div>
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

        {/* FEATURE COMPARISON TABLE */}
        <section className="max-w-5xl mx-auto mb-24 overflow-x-auto">
          <h2 className="text-3xl font-serif mb-8 text-center">What's included</h2>
          <table className="w-full border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-[var(--color-border-main)]">
                <th className="text-left py-4 font-normal text-sm text-[var(--color-text-secondary)]">Feature</th>
                <th className="py-4 font-serif text-lg">Solo</th>
                <th className="py-4 font-serif text-lg text-[var(--color-green-primary)]">Growth</th>
                <th className="py-4 font-serif text-lg">Agency</th>
              </tr>
            </thead>
            <tbody>
              {featureRows.map((row) => (
                <tr key={row.label} className="border-b border-[var(--color-border-light)]">
                  <td className="py-4 text-sm text-[var(--color-text-main)]">{row.label}</td>
                  <td className="py-4 text-center"><FeatureCell value={row.solo} /></td>
                  <td className="py-4 text-center bg-[var(--color-cream-dark)]/40"><FeatureCell value={row.growth} /></td>
                  <td className="py-4 text-center"><FeatureCell value={row.agency} /></td>
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
            <h2 className="text-3xl md:text-5xl font-serif mb-6">Not sure which plan fits?</h2>
            <p className="text-xl text-white/80 max-w-2xl mx-auto mb-10 font-light">
              Talk to us for 15 minutes — we'll tell you honestly if a free tier covers you.
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
