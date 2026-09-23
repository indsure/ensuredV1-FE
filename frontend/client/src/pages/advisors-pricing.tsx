import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { teamWaLink } from "@/components/app/portfolio-utils";
import { Check, Minus, Sparkles, ArrowRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

// Every visible string in the data below is a translation key, rendered with t().

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
  /** Leaves the site (WhatsApp), so it renders as an anchor, not a router link. */
  ctaExternal?: boolean;
};

const tiers: Tier[] = [
  {
    name: "advp.free",
    // claim-source: backend/server/routes.ts:772-798 (FREE_SLOTS_PER_TYPE is the only gate; the 30-day trial gate was removed). Verified 2026-09-07.
    tagline: "advp.free_tag",
    price: "₹0",
    priceAnnual: "₹0",
    period: "advp.forever",
    periodAnnual: "advp.forever",
    features: [
      { label: "advp.ff1" },
      { label: "advp.ff2" },
      { label: "advp.ff3" },
      { label: "advp.ff4" },
      { label: "advp.ff5" },
      { label: "advp.ff6" },
    ],
    cta: "advp.start_free",
    ctaHref: "/agent/signup/step1",
  },
  {
    name: "advp.agent",
    tagline: "advp.agent_tag",
    price: "₹1,499",
    priceAnnual: "₹14,990",
    period: "advp.per_month",
    periodAnnual: "advp.per_year",
    subline: "advp.agent_sub",
    sublineAnnual: "advp.agent_sub_annual",
    features: [
      { label: "advp.af1" },
      { label: "advp.af2" },
      { label: "advp.af3" },
      { label: "advp.af4" },
      { label: "advp.af5", soon: true },
      { label: "advp.af6" },
      { label: "advp.af7" },
    ],
    highlighted: true,
    /* There is no checkout in the product, so a button that looked like one
       would land an advisor on a page that cannot charge them. WhatsApp reaches
       a person who can actually put the account on the plan. The free signup on
       the card to the left is the only self-serve path, and it stays one. */
    cta: "advp.upgrade_wa",
    ctaHref: teamWaLink(
      "Hi, I would like to put my IndSure account on the Agent plan.",
    ),
    ctaExternal: true,
  },
  {
    name: "advp.agency",
    tagline: "advp.agency_tag",
    price: "₹1,199",
    priceAnnual: "₹1,199",
    period: "advp.per_seat",
    periodAnnual: "advp.per_seat",
    subline: "advp.min_seats",
    sublineAnnual: "advp.min_seats",
    features: [
      { label: "advp.gf1" },
      // Was "shared across the team". The team feature that shipped gives each
      // seat its own 10 and lets the owner move unused ones between advisors —
      // there is no common pool, so the old wording promised something the
      // product does not do.
      { label: "advp.gf2" },
      { label: "advp.gf3", soon: true },
      { label: "advp.gf4" },
      { label: "advp.gf5" },
    ],
    cta: "advp.talk_wa",
    ctaHref: teamWaLink(
      "Hi, I run an agency and would like to know more about the IndSure Agency plan.",
    ),
    ctaExternal: true,
  },
];

const featureRows: { label: string; free: string | boolean; agent: string | boolean; agency: string | boolean }[] = [
  { label: "advp.r1", free: true, agent: true, agency: true },
  { label: "advp.r2", free: true, agent: true, agency: true },
  { label: "advp.r3", free: true, agent: true, agency: true },
  { label: "advp.r4", free: true, agent: true, agency: true },
  { label: "advp.r5", free: true, agent: true, agency: true },
  { label: "advp.r6", free: true, agent: true, agency: true },
  { label: "advp.r7", free: "advp.v_20_total", agent: "advp.v_50_month", agency: "advp.v_50_seat" },
  { label: "advp.r8", free: "advp.v_3_once", agent: "advp.v_12_month", agency: "advp.v_10_seat" },
  { label: "advp.r9", free: true, agent: true, agency: true },
  { label: "advp.r10", free: false, agent: "advp.v_monthly_allow", agency: "advp.v_shared_allow" },
  { label: "advp.r11", free: false, agent: true, agency: true },
  { label: "advp.r12", free: false, agent: "advp.v_fair", agency: "advp.v_fair" },
  { label: "advp.r13", free: false, agent: false, agency: true },
  { label: "advp.af6", free: false, agent: true, agency: true },
  { label: "advp.gf5", free: false, agent: false, agency: true },
];

function FeatureCell({ value }: { value: string | boolean }) {
  const { t } = useLanguage();
  if (value === true) return <Check className="w-5 h-5 text-[var(--color-green-primary)] mx-auto" />;
  if (value === false) return <Minus className="w-4 h-4 text-[var(--color-text-muted)] mx-auto" />;
  return <span className="text-sm text-[var(--color-text-secondary)]">{t(value)}</span>;
}

const topUpPacks = [
  { credits: 5, price: "₹449" },
  { credits: 15, price: "₹1,199" },
];

const faqs = [
  {
    q: "advp.q1",
    a: "advp.a1",
  },
  {
    // claim-source: backend/server/routes.ts:772-798 (FREE_SLOTS_PER_TYPE is the only gate; the 30-day trial gate was removed). Verified 2026-09-07.
    q: "advp.q2",
    a: "advp.a2",
  },
  {
    q: "advp.q3",
    a: "advp.a3",
  },
  {
    q: "advp.q4",
    a: "advp.a4",
  },
  {
    q: "advp.q5",
    a: "advp.a5",
  },
  {
    q: "advp.q6",
    a: "advp.a6",
  },
  {
    q: "advp.q7",
    a: "advp.a7",
  },
  {
    q: "advp.q8",
    a: "advp.a8",
  },
  {
    q: "advp.q9",
    a: "advp.a9",
  },
];

export default function Pricing() {
  const [annual, setAnnual] = useState(false);
  const { t } = useLanguage();

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
          <div className="inline-block py-1.5 px-3.5 border border-[var(--color-teal-600)]/25 bg-[var(--color-teal-50)] rounded-full text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-teal-700)] mb-4">
            {t("advp.for_adv")}
          </div>
          <h1 className="text-4xl md:text-5xl font-serif mb-4 tracking-tight text-[var(--color-text-main)] leading-tight">
            {t("advp.h_a")} <span className="italic text-[var(--color-green-primary)]">{t("advp.h_b")}</span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-secondary)] font-light leading-relaxed max-w-2xl mx-auto">
            {/* claim-source: backend/server/routes.ts:772-798 (FREE_SLOTS_PER_TYPE is the only gate; the 30-day trial gate was removed). Verified 2026-09-07. */}
            {t("advp.sub")}
          </p>
        </section>

        {/* FOUNDING 50 BANNER */}
        <section className="max-w-3xl mx-auto mb-8">
          <div className="flex items-center justify-center gap-4 rounded-2xl border border-[var(--lob-motor)]/30 bg-[var(--lob-motor-wash)] px-6 py-5 text-center">
            <Sparkles className="h-6 w-6 shrink-0 text-[var(--lob-motor)]" aria-hidden="true" />
            <div>
              <p className="text-[15px] md:text-base text-[var(--color-text-main)]">
                <span className="font-semibold">{t("advp.f50_b")}</span>{" "}
                {t("advp.f50", { price: "₹9,990", old: "₹14,990" })}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {t("advp.f50_rise")}
              </p>
            </div>
          </div>
        </section>

        {/* BILLING TOGGLE */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <span className={`text-sm font-medium ${!annual ? "text-[var(--color-text-main)]" : "text-[var(--color-text-muted)]"}`}>{t("advp.monthly")}</span>
          <button
            onClick={() => setAnnual(!annual)}
            className="relative before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] w-14 h-8 rounded-full bg-[var(--color-cream-dark)] border border-[var(--color-border-main)] transition-colors"
            aria-label={t("advp.toggle")}
          >
            <span
              className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-[var(--color-green-primary)] transition-transform ${annual ? "translate-x-6" : ""}`}
            />
          </button>
          <span className={`text-sm font-medium ${annual ? "text-[var(--color-text-main)]" : "text-[var(--color-text-muted)]"}`}>
            {t("advp.annual")} <span className="text-[var(--color-green-primary)]">{t("advp.two_free")}</span>
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
            const ctaClass = `mt-auto inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-lg text-base font-semibold transition-all duration-200 ${
              pick
                ? "bg-[var(--color-cta)] text-white hover:bg-[#0F766E] hover:-translate-y-0.5"
                : "border border-[var(--color-border-medium)] bg-white text-[var(--color-text-main)] hover:border-[var(--color-teal-600)] hover:text-[var(--color-teal-600)]"
            }`;
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
                    <h3 className="font-serif text-2xl font-bold text-[var(--color-navy-900)]">{t(tier.name)}</h3>
                    {/* Was "Most Popular". With the book this size that is a
                        claim about other customers we cannot support, so the
                        badge says what it actually is. */}
                    {pick && (
                      <span
                        className="shrink-0 rounded-full px-3 py-1 text-sm font-bold uppercase tracking-[0.1em] text-white"
                        style={{ backgroundColor: accent }}
                      >
                        {t("advp.our_pick")}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 min-h-[44px] text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                    {t(tier.tagline)}
                  </p>

                  <div className="mt-4 flex flex-wrap items-baseline gap-2">
                    <span className="font-serif text-4xl font-bold tracking-tight text-[var(--color-navy-900)] tabular">
                      {annual ? tier.priceAnnual : tier.price}
                    </span>
                    <span className="text-[15px] text-[var(--color-text-secondary)]">
                      {t(annual ? tier.periodAnnual : tier.period)}
                    </span>
                  </div>

                  <p className="mt-1 min-h-[22px] text-[15px] font-semibold" style={{ color: accent }}>
                    {(() => { const v = annual ? tier.sublineAnnual : tier.subline; return v ? t(v) : ""; })()}
                  </p>
                </div>

                <div className="flex flex-1 flex-col gap-6 p-6">
                  <ul className="flex flex-col gap-3">
                    {tier.features.map((f) => (
                      <li key={f.label} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-[var(--color-text-main)]">
                        <Check className="mt-1 h-4 w-4 shrink-0" style={{ color: accent }} aria-hidden="true" />
                        <span>
                          {t(f.label)}
                          {f.soon && (
                            <span className="ml-1.5 inline-block rounded-full border px-1.5 align-middle text-sm font-semibold uppercase leading-5 tracking-wider"
                              style={{ color: accent, borderColor: accent }}>
                              {t("advp.soon")}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {tier.ctaExternal ? (
                    /* wouter's Link pushes onto the router's history, so an
                       off-site href would route to a page that does not exist
                       instead of opening WhatsApp. */
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
            );
          })}
        </section>

        <p className="mb-16 text-center text-sm text-[var(--color-text-secondary)]">
          {t("advp.gst")}
        </p>

        {/* CREDIT EXPLAINER + TOP-UPS */}
        <section className="max-w-4xl mx-auto mb-12 sm:mb-16 lg:mb-24">
          <div className="card-white p-8 md:p-10 text-center">
            <h2 className="mb-3 font-serif text-2xl font-bold text-[var(--color-navy-900)]">{t("advp.how_checks")}</h2>
            <span className="rule-accent mx-auto mb-6" />
            <p className="text-[var(--color-text-secondary)] leading-relaxed max-w-2xl mx-auto mb-8">
              <span className="font-semibold text-[var(--color-text-main)]">{t("advp.one_check_b")}</span>{" "}
              {t("advp.one_check")}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              {topUpPacks.map((pack) => (
                <a
                  key={pack.credits}
                  href={teamWaLink(
                    `Hi, I would like to buy the ${pack.credits}-check pack (${pack.price}) on IndSure.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-cream-main)] px-8 py-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-teal-600)]/40"
                >
                  <div className="font-serif text-3xl font-bold text-[var(--color-navy-900)] tabular">{pack.price}</div>
                  <div className="text-[15px] font-semibold text-[var(--color-text-secondary)]">
                    {t("advp.n_checks", { n: pack.credits })}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[var(--color-teal-700)]">
                    {t("advp.buy_wa")}
                  </div>
                </a>
              ))}
            </div>
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
              {t("advp.never_expire")}
            </p>
          </div>
        </section>

        {/* FEATURE COMPARISON TABLE */}
        <section className="bleed bleed-mint max-w-5xl mx-auto mb-12 sm:mb-16 lg:mb-24 py-14 md:overflow-x-auto">
          <h2 className="text-3xl font-serif mb-3 text-center">{t("advp.included")}</h2>
          <span className="rule-accent mx-auto mb-8" />
          <table className="table-cards w-full border-collapse md:min-w-[640px]">
            <thead>
              <tr className="border-b border-[var(--color-border-main)]">
                <th className="text-left py-4 font-normal text-sm text-[var(--color-text-secondary)]">{t("advp.feature")}</th>
                <th className="py-4 font-serif text-lg">{t("advp.free")}</th>
                <th className="py-4 font-serif text-lg text-[var(--color-green-primary)]">{t("advp.agent")}</th>
                <th className="py-4 font-serif text-lg">{t("advp.agency")}</th>
              </tr>
            </thead>
            <tbody>
              {featureRows.map((row) => (
                <tr key={row.label} className="border-b border-[var(--color-border-light)]">
                  <td className="py-4 text-sm text-[var(--color-text-main)]" data-label={t("advp.feature")} data-cell="title">{t(row.label)}</td>
                  <td className="py-4 text-center px-2" data-label={t("advp.free")}><FeatureCell value={row.free} /></td>
                  <td className="py-4 text-center px-2 bg-[var(--color-cream-dark)]/40" data-label={t("advp.agent")}><FeatureCell value={row.agent} /></td>
                  <td className="py-4 text-center px-2" data-label={t("advp.agency")}><FeatureCell value={row.agency} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto mb-12 sm:mb-16 lg:mb-24 pt-4">
          <h2 className="text-3xl font-serif mb-3 text-center">{t("advp.questions")}</h2>
          <span className="rule-accent mx-auto mb-10" />
          <div className="space-y-6">
            {faqs.map((f) => (
              <div key={f.q} className="border-b border-[var(--color-border-light)] pb-6">
                <h3 className="text-lg font-semibold mb-2">{t(f.q)}</h3>
                <p className="text-[var(--color-text-secondary)] leading-relaxed">{t(f.a)}</p>
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
            <h2 className="text-3xl md:text-5xl font-serif mb-6 text-white">{t("advp.not_sure")}</h2>
            <p className="text-xl text-white/80 max-w-2xl mx-auto mb-10 font-light">
              {t("advp.talk15")}
            </p>
            <Button asChild size="lg" className="bg-[var(--color-green-primary)] hover:bg-[var(--color-green-secondary)] text-white h-14 px-8 text-lg rounded-full">
              <a
                href={teamWaLink(
                  "Hi, I am an advisor and I am not sure which IndSure plan fits me.",
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("advp.talk_us_wa")}
              </a>
            </Button>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
