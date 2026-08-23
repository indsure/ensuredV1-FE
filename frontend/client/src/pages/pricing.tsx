import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Check, Minus, ShieldCheck } from "lucide-react";

// Consumer pricing. The advisor plans (Free / ₹999 / ₹9,999) moved to
// /advisors/pricing — this URL is the one the portfolio's own upgrade CTAs
// point at (see pages/app/portfolio.tsx), so it has to speak to a person
// holding their own policies, not to someone selling them.
//
// The free tier below describes what checkIndividualQuota actually enforces:
// a 30-day full-access window from signup, one policy per line of business.
// It is a trial, not a standing free tier — if that changes on the server,
// the "Free" card's copy changes with it and nowhere else.

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
      { label: "One policy of each type — health, term life, vehicle" },
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
      { label: "Room for 12 more policies — term life and vehicle, any mix" },
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
  { label: "Term life and vehicle policies", free: "1 each, stored", paid: "12 slots, any mix" },
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
    q: "What do the 12 term life and vehicle slots do?",
    a: "They store the policy and watch its renewal date, so nothing lapses quietly. They are not full policy checks — those are for health policies today. You can split the 12 however you like between term life and vehicle.",
  },
  {
    q: "Is the free plan really free forever?",
    a: "Yes. There is no trial clock and no card. You keep one policy of each type — health, term life and vehicle — with the full health check, renewal reminders and PDF reports, for as long as you want. You move to Personal only when you need more than one policy of a type, or more checks.",
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

      <main className="flex-grow pt-24 pb-12 sm:pb-16 lg:pb-20 px-6 w-full">

        {/* HERO */}
        <section className="max-w-4xl mx-auto text-center mb-10 animate-reveal">
          <div className="inline-block py-1 px-3 border border-[var(--color-border-main)] rounded-full text-xs font-mono uppercase tracking-widest text-[var(--color-text-secondary)] mb-4 bg-white">
            For you and your family
          </div>
          <h1 className="text-4xl md:text-5xl font-serif mb-4 tracking-tight text-[var(--color-text-main)] leading-tight">
            Know what you are covered for.{" "}
            <span className="italic text-[var(--color-green-primary)]">₹999 a year.</span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-secondary)] font-light leading-relaxed max-w-2xl mx-auto">
            Most people find out what their policy does not cover on the day they
            claim. Start free and read yours properly first — it takes a few minutes.
          </p>
        </section>

        {/* BILLING TOGGLE */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <span className={`text-sm font-medium ${!annual ? "text-[var(--color-text-main)]" : "text-[var(--color-text-muted)]"}`}>
            Monthly
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            className="relative before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] w-14 h-8 rounded-full bg-[var(--color-cream-dark)] border border-[var(--color-border-main)] transition-colors"
            role="switch"
            aria-checked={annual}
            aria-label="Pay annually"
          >
            <span
              className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-[var(--color-green-primary)] transition-transform ${annual ? "translate-x-6" : ""}`}
            />
          </button>
          <span className={`text-sm font-medium ${annual ? "text-[var(--color-text-main)]" : "text-[var(--color-text-muted)]"}`}>
            Annual <span className="text-[var(--color-green-primary)]">(saves ₹189)</span>
          </span>
        </div>

        {/* TIER CARDS */}
        <section className="max-w-4xl mx-auto mb-14 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`card-white p-8 md:p-10 flex flex-col ${tier.highlighted ? "border-2 border-[var(--color-green-primary)] shadow-xl relative" : ""}`}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[var(--color-green-primary)] text-white text-xs font-semibold uppercase tracking-widest px-4 py-1 rounded-full whitespace-nowrap">
                  Best value
                </div>
              )}
              <h2 className="text-2xl font-serif mb-2">{tier.name}</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-6 min-h-[40px]">{tier.tagline}</p>
              <div className="mb-2">
                <span className="text-3xl sm:text-4xl font-serif">{annual ? tier.priceAnnual : tier.price}</span>
                <span className="text-sm text-[var(--color-text-secondary)] ml-1">
                  {annual ? tier.periodAnnual : tier.period}
                </span>
              </div>
              <p className="text-sm text-[var(--color-green-primary)] mb-6">
                {annual ? tier.sublineAnnual : tier.subline}
              </p>
              <ul className="space-y-3 mb-8">
                {tier.features.map((f) => (
                  <li
                    key={f.label}
                    className={`flex items-start gap-2 text-sm ${f.muted ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-main)]"}`}
                  >
                    <Check className="w-4 h-4 text-[var(--color-green-primary)] mt-0.5 shrink-0" />
                    <span>{f.label}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                size="lg"
                className={`mt-auto w-full ${tier.highlighted ? "" : "bg-white text-[var(--color-text-main)] border border-[var(--color-border-main)] hover:bg-[var(--color-cream-dark)]"}`}
              >
                <Link href={tier.ctaHref}>{tier.cta}</Link>
              </Button>
            </div>
          ))}
        </section>

        {/* COMPARISON TABLE */}
        <section className="max-w-4xl mx-auto mb-14">
          <h2 className="text-2xl md:text-3xl font-serif text-center mb-8">What you get</h2>
          <div className="card-white overflow-x-auto">
            <table className="table-cards w-full text-sm md:min-w-[520px]">
              <thead>
                <tr className="border-b border-[var(--color-border-light)]">
                  <th className="text-left font-semibold p-4 w-1/2">&nbsp;</th>
                  <th className="text-center font-semibold p-4">Free</th>
                  <th className="text-center font-semibold p-4 text-[var(--color-green-primary)]">Personal</th>
                </tr>
              </thead>
              <tbody>
                {featureRows.map((row) => (
                  <tr key={row.label} className="border-b border-[var(--color-border-light)] last:border-0">
                    <td className="p-4 text-[var(--color-text-main)]" data-label="Feature" data-cell="title">{row.label}</td>
                    {[row.free, row.paid].map((val, i) => (
                      <td key={i} className="p-4 text-center text-[var(--color-text-secondary)]" data-label={i === 0 ? "Free" : "Personal"}>
                        {val === true ? (
                          <Check className="w-4 h-4 text-[var(--color-green-primary)] mx-auto" aria-label="Included" />
                        ) : val === false ? (
                          <Minus className="w-4 h-4 text-[var(--color-text-muted)] mx-auto" aria-label="Not included" />
                        ) : (
                          val
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* NO COMMISSION NOTE */}
        <section className="max-w-3xl mx-auto mb-14">
          <div className="flex items-start gap-3 bg-[var(--color-green-primary)]/10 border border-[var(--color-green-primary)] rounded-lg px-6 py-4">
            <ShieldCheck className="w-5 h-5 text-[var(--color-green-primary)] shrink-0 mt-0.5" />
            <p className="text-sm text-[var(--color-text-main)]">
              <span className="font-semibold">We do not sell insurance.</span>{" "}
              IndSure earns nothing from insurers — no commission, no referral fee.
              You pay us, so we work for you.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto mb-14">
          <h2 className="text-2xl md:text-3xl font-serif text-center mb-8">Questions</h2>
          <div className="space-y-4">
            {faqs.map((f) => (
              <div key={f.q} className="card-white p-6">
                <h3 className="font-semibold mb-2 text-[var(--color-text-main)]">{f.q}</h3>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CLOSING CTA */}
        <section className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-serif mb-4">
            Start with the policy you already have
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            Upload it, read what it actually covers, and decide from there.
          </p>
          <Button asChild size="lg">
            <Link href="/signup">Analyze my policy — free</Link>
          </Button>
        </section>

        {/* ADVISOR CROSS-LINK */}
        <p className="text-center text-sm text-[var(--color-text-secondary)] mt-12">
          Are you an insurance agent or advisor?{" "}
          <Link href="/advisors/pricing" className="text-[var(--color-green-primary)] underline underline-offset-4">
            See advisor plans
          </Link>
        </p>

      </main>

      <Footer />
    </div>
  );
}
