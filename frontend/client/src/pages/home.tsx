import { Link } from "wouter";
import { motion, type Variants } from "motion/react";
import {
  ArrowRight, Check, Lock, IndianRupee, ShieldCheck, ListChecks, Users,
  CalendarClock, Scale, FileText, MessageSquare, Bell, AlertTriangle,
  HeartPulse, Umbrella, Car, Bike, Plane,
} from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { tOr } from "@/i18n";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/use-seo";
import { seoFor } from "@/data/seo-pages";
import { AnimatedNumber, GrowBar, Reveal } from "@/components/motion";
import { calculatorIllustration, ILLUSTRATION_PROFILE } from "@/lib/calculator-illustration";

/* Every rupee figure inside a product panel on this page is illustrative and is
   labelled as such inside the panel border. Nothing here is a product output. */

const rise: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
};

const wrap: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

/* The chrome every product panel shares: traffic lights, a route, and the
   Illustrative label INSIDE the border — the old homepage put that label
   outside the card it qualified, so it read as a real capability. */
function PanelBar({ route }: { route: string }) {
  const { t } = useLanguage();
  return (
    <div className="h-11 bg-[var(--color-cream-main)] border-b border-[var(--color-border-light)] flex items-center gap-3 px-3.5">
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-border-light)]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-border-light)]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-border-light)]" />
      </div>
      <div className="flex-1 flex justify-center">
        <span className="px-3 py-1 rounded-md bg-[var(--color-cream-dark)] text-sm font-medium text-[var(--color-text-muted)]">
          {route}
        </span>
      </div>
      <span className="px-2 py-1 rounded-md bg-[var(--color-cream-dark)] text-sm font-semibold text-[var(--color-text-muted)]">
        {t("home.illustrative")}
      </span>
    </div>
  );
}

const panelShadow =
  "0 0 0 1px rgba(0,0,0,0.07), 0 2px 2px -1px rgba(0,0,0,0.02), 0 6px 6px -3px rgba(0,0,0,0.02), 0 14px 14px -7px rgba(0,0,0,0.018), 0 28px 28px -14px rgba(0,0,0,0.018), 0 56px 56px -28px rgba(0,0,0,0.02)";

/* ─────────────── HERO ─────────────── */

function Hero() {
  const { t } = useLanguage();
  return (
    <section className="relative bg-[var(--color-cream-main)] pb-4">
      {/* The fold used to be flat cream from edge to edge, which read as an
          unstyled page rather than as a canvas. A faint grid and two very soft
          brand washes give it depth without putting anything behind the words. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-grid-faint mask-fade-edges" />
        <div
          className="absolute -top-32 -right-24 h-[520px] w-[520px] rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(45,212,191,0.20), transparent 68%)" }}
        />
        <div
          className="absolute top-40 -left-40 h-[460px] w-[460px] rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(180,83,9,0.10), transparent 68%)" }}
        />
      </div>

      <div className="container-editorial relative px-6">
        <motion.div variants={wrap} initial="hidden" animate="visible" className="flex flex-col gap-6 pt-10 lg:pt-16">
          <motion.h1
            variants={rise}
            className="font-serif font-bold tracking-[-0.035em] leading-[1.04] text-4xl sm:text-6xl lg:text-7xl max-w-4xl text-[var(--color-navy-900)]"
          >
            {t("home.hero_a")} <span className="text-[var(--color-teal-600)]">{t("home.hero_b")}</span>
            <br className="hidden sm:block" /> {t("home.hero_c")}
          </motion.h1>

          <motion.p variants={rise} className="text-lg sm:text-xl leading-relaxed text-[var(--color-text-secondary)] max-w-2xl">
            {t("home.hero_sub")}
          </motion.p>

          {/* "Check my policy" goes to the upload gate, not to signup.
              It used to go straight to /signup, so the main call to action on
              the site asked a stranger to create an account before they had
              seen anything work. The gate exists precisely to avoid that: it
              takes the file first, parks it, and only then asks for an account,
              and the parked file is redeemed after signup so nothing is lost.
              Routing past it wasted the whole mechanism, and a tester reported
              it as the product demanding a signup up front. */}
          <motion.div variants={rise} className="flex flex-col sm:flex-row gap-3">
            <Link href="/policychecker" className="w-full sm:w-auto">
              <button className="w-full h-[52px] px-6 rounded-lg bg-[var(--color-cta)] text-white text-base font-semibold hover:bg-[var(--color-cta-hover)] transition-colors flex items-center justify-center gap-2">
                {t("home.cta_check")} <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/policychecker" className="w-full sm:w-auto">
              <button className="w-full h-[52px] px-6 rounded-lg bg-white border border-[var(--color-border-light)] text-base font-semibold text-[var(--color-text-main)] hover:bg-[var(--color-cream-dark)] transition-colors">
                {t("home.cta_see_all")}
              </button>
            </Link>
          </motion.div>

          <motion.div variants={rise} className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="flex items-center gap-2 text-sm sm:text-base text-[var(--color-text-secondary)]">
              <Lock className="w-4 h-4 text-[var(--color-teal-600)] shrink-0" />
              {t("home.no_spam")}
            </span>
            <span className="flex items-center gap-2 text-sm sm:text-base text-[var(--color-text-secondary)]">
              <IndianRupee className="w-4 h-4 text-[var(--color-teal-600)] shrink-0" />
              {t("home.zero_commission")}
            </span>
          </motion.div>
        </motion.div>
      </div>

      <HeroPanels />
    </section>
  );
}

/* The fold used to carry a headline, four unsourced numbers and a marquee — no
   picture of the product at all. This is the product: everything you own, a
   second tool answering a question analysis cannot, and Sach. */
function HeroPanels() {
  // The cover panel quotes the real engine, and the same illustration the
  // calculator landing page uses, so the two can never disagree.
  const illustration = calculatorIllustration();
  const { t } = useLanguage();

  return (
    <div className="container-editorial px-6 pt-10 lg:pt-14">
      <div className="rounded-3xl bg-[var(--color-cream-dark)] border border-[var(--color-border-light)] p-4 sm:p-8 lg:p-12">
        <div className="grid lg:grid-cols-5 gap-5">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="lg:col-span-3 rounded-xl bg-white overflow-hidden"
            style={{ boxShadow: panelShadow }}
          >
            <PanelBar route="indsure.in / app" />
            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-end justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                    {t("home.sharmas")}
                  </span>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-3xl font-extrabold tracking-tight text-[var(--color-navy-900)]">₹1.6 Cr</span>
                    <span className="text-sm text-[var(--color-text-secondary)]">{t("home.across")}</span>
                  </div>
                </div>
              </div>

              {/* Each kind of cover carries its own colour here and everywhere
                  else on the site. Five identical grey boxes was the picture of
                  the problem the product exists to solve, not of the solution. */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { k: "home.lob_health", v: "₹10 L", m: "home.m_health", c: "var(--lob-health)", w: "var(--lob-health-wash)", i: HeartPulse },
                  { k: "home.lob_term", v: "₹1 Cr", m: "home.m_term", c: "var(--lob-life)", w: "var(--lob-life-wash)", i: Umbrella },
                  { k: "home.lob_car", v: "₹6.4 L", m: "home.m_car", c: "var(--lob-motor)", w: "var(--lob-motor-wash)", i: Car },
                  { k: "home.lob_bike", v: "₹84 K", m: "Bajaj Allianz", c: "var(--lob-motor)", w: "var(--lob-motor-wash)", i: Bike },
                  { k: "home.lob_travel", v: "₹42 L", m: "home.m_travel", c: "var(--lob-travel)", w: "var(--lob-travel-wash)", i: Plane },
                ].map((p) => (
                  <div
                    key={p.k}
                    className="group relative overflow-hidden rounded-xl border border-[var(--color-border-light)] p-3 flex flex-col gap-1.5 transition-colors duration-300 hover:border-transparent"
                    style={{ borderLeftWidth: 3, borderLeftColor: p.c }}
                  >
                    <span
                      className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      style={{ backgroundColor: p.w }}
                      aria-hidden="true"
                    />
                    <span className="relative flex items-center gap-1.5 text-sm font-bold" style={{ color: p.c }}>
                      <p.i className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {t(p.k)}
                    </span>
                    <span className="relative text-base font-extrabold tracking-tight text-[var(--color-navy-900)] tabular">{p.v}</span>
                    <span className="relative text-sm text-[var(--color-text-secondary)] leading-snug">{tOr(t, p.m, p.m)}</span>
                  </div>
                ))}
                <div className="rounded-xl border border-dashed border-[var(--color-border-medium)] bg-[var(--color-cream-main)] p-3 flex flex-col gap-1.5 justify-center">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-[var(--color-gold-500)]">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {t("home.missing")}
                  </span>
                  <span className="text-sm font-bold text-[var(--color-gold-500)] leading-snug">{t("home.personal_accident")}</span>
                </div>
              </div>

              <div className="rounded-xl bg-[#F0FDFA] border border-[#CCFBF1] px-3.5 py-3 flex items-center gap-2.5">
                <IndianRupee className="w-4 h-4 text-[var(--color-teal-600)] shrink-0" />
                <span className="text-sm leading-relaxed text-[#115E59]">
                  {t("home.pay_a")} <strong className="font-bold">{t("home.pay_b")}</strong> {t("home.pay_c")}
                </span>
              </div>
            </div>
          </motion.div>

          <div className="lg:col-span-2 flex flex-col gap-5">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
              className="rounded-xl bg-white overflow-hidden"
              style={{ boxShadow: panelShadow }}
            >
              <div className="h-11 bg-[var(--color-cream-main)] border-b border-[var(--color-border-light)] flex items-center justify-between px-3.5">
                <span className="text-sm font-bold text-[var(--color-navy-900)]">{t("home.how_much")}</span>
                <span className="text-sm text-[var(--color-text-muted)]">{t("home.cover_calc")}</span>
              </div>
              <div className="p-4 flex flex-col gap-3.5">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-[var(--color-text-secondary)]">
                    {t("home.calc_for", { age: ILLUSTRATION_PROFILE.exactAge ?? "", city: ILLUSTRATION_PROFILE.city ?? "" })}
                  </span>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-serif text-3xl font-bold tracking-tight text-[var(--color-navy-900)]">{illustration.needLabel}</span>
                    <span className="text-sm text-[var(--color-text-secondary)]">{t("home.need")}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-secondary)] font-semibold">{t("home.have")}</span>
                    <span className="font-bold text-[var(--color-navy-900)]">{illustration.haveLabel}</span>
                  </div>
                  {/* The shortfall is the whole point of this panel, so the bar
                      grows to it rather than arriving already drawn. */}
                  <div className="relative h-2.5 overflow-hidden rounded-full bg-[#FECACA]">
                    <GrowBar
                      percent={illustration.heldPercent}
                      height={10}
                      track="transparent"
                      label={t("home.held_aria", { pct: illustration.heldPercent })}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-[#B91C1C]">{t("home.short_by", { amount: illustration.shortLabel })}</span>
                    <span className="text-[var(--color-text-muted)]">
                      {t("home.per_month", { amount: illustration.monthly.toLocaleString("en-IN") })}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="rounded-xl bg-white p-4 flex flex-col gap-3"
              style={{ boxShadow: panelShadow }}
            >
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[var(--color-teal-600)] flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4 text-white" />
                </span>
                <span className="text-sm font-bold text-[var(--color-navy-900)]">Sach</span>
                <span className="text-sm text-[var(--color-text-muted)]">{t("home.sach_hindi")}</span>
              </div>
              <div className="self-end max-w-[85%] rounded-xl rounded-br-sm bg-[var(--color-cream-dark)] px-3 py-2">
                <span className="text-sm leading-relaxed text-[var(--color-text-main)]">
                  {t("home.sach_q")}
                </span>
              </div>
              <div className="self-start max-w-[92%] rounded-xl rounded-bl-sm bg-[#F0FDFA] border border-[#CCFBF1] px-3 py-2">
                <span className="text-sm leading-relaxed text-[#115E59]">
                  {t("home.sach_a")}
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── PRODUCT — two portals ─────────────── */

// label, title, chip and blurb are translation keys.
const ADVISOR_TABS = [
  { id: "queue", label: "home.tab_queue", icon: ListChecks, title: "home.tab_queue_title", route: "/agent/my-queue", chip: "home.tab_queue_chip",
    blurb: "home.tab_queue_blurb" },
  { id: "leads", label: "home.tab_leads", icon: Users, title: "home.tab_leads", route: "/agent/leads", chip: "home.tab_leads_chip",
    blurb: "home.tab_leads_blurb" },
  { id: "renewals", label: "home.tab_renewals", icon: CalendarClock, title: "home.tab_renewals", route: "/agent/renewals", chip: "home.tab_renewals_chip",
    blurb: "home.tab_renewals_blurb" },
  { id: "compare", label: "home.tab_compare", icon: Scale, title: "home.tab_compare", route: "/agent/compare", chip: "home.tab_compare_chip",
    blurb: "home.tab_compare_blurb" },
  { id: "claims", label: "home.tab_claims", icon: FileText, title: "home.tab_claims_title", route: "/agent/claims", chip: "home.tab_claims_chip",
    blurb: "home.tab_claims_blurb" },
];

function Chip({ tone, children }: { tone: "red" | "amber" | "teal" | "slate"; children: React.ReactNode }) {
  const map = {
    red: "bg-[#FEF2F2] text-[#DC2626]",
    amber: "bg-[#FFFBEB] text-[var(--color-gold-500)]",
    teal: "bg-[#F0FDFA] text-[#0F766E]",
    slate: "bg-[var(--color-cream-dark)] text-[var(--color-text-secondary)]",
  } as const;
  return <span className={`px-2 py-1 rounded-md text-sm font-bold whitespace-nowrap ${map[tone]}`}>{children}</span>;
}

function Score({ n, tone }: { n: number; tone: "red" | "amber" | "teal" }) {
  const map = {
    red: "bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]",
    amber: "bg-[#FEF3C7] text-[var(--color-gold-500)] border-[#FDE68A]",
    teal: "bg-[#F0FDFA] text-[#0F766E] border-[#CCFBF1]",
  } as const;
  return (
    <span className={`min-w-9 px-2 py-1 rounded-md border text-base font-extrabold text-center ${map[tone]}`}>{n}</span>
  );
}

const QUEUE_ROWS = [
  { name: "Vikram Singh", meta: "Star Health · ₹42,000", due: 3, tone: "red" as const, score: 49, s: "red" as const },
  { name: "Meena Patel", meta: "HDFC Ergo · ₹28,500", due: 6, tone: "amber" as const, score: 63, s: "amber" as const },
  { name: "Imran Qureshi", meta: "Niva Bupa · ₹19,200", due: 11, tone: "slate" as const, score: 78, s: "teal" as const },
];

function AdvisorPanel() {
  const [tab, setTab] = useState("queue");
  const { t } = useLanguage();
  const active = ADVISOR_TABS.find((x) => x.id === tab) ?? ADVISOR_TABS[0];

  return (
    <div className="rounded-xl bg-white overflow-hidden grid grid-cols-[76px_1fr]" style={{ boxShadow: panelShadow }}>
      <div className="bg-[var(--color-cream-dark)] border-r border-[var(--color-border-light)] py-5 flex flex-col items-center gap-4">
        {ADVISOR_TABS.map((x) => {
          const Icon = x.icon;
          const on = x.id === tab;
          return (
            <button
              key={x.id}
              onClick={() => setTab(x.id)}
              aria-pressed={on}
              className="w-16 flex flex-col items-center gap-1.5 outline-none"
            >
              <span
                className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-colors ${
                  on
                    ? "bg-[var(--color-teal-600)] border-[var(--color-teal-600)]"
                    : "bg-white border-[var(--color-border-light)] hover:bg-[var(--color-cream-main)]"
                }`}
              >
                <Icon className={`w-5 h-5 ${on ? "text-white" : "text-[var(--color-text-muted)]"}`} />
              </span>
              <span className={`text-sm font-semibold ${on ? "text-[var(--color-navy-900)]" : "text-[var(--color-text-muted)]"}`}>
                {t(x.label)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col min-h-[520px]">
        <div className="px-5 pt-5 pb-4 border-b border-[var(--color-border-light)] flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold tracking-tight text-[var(--color-navy-900)]">{t(active.title)}</h3>
            <span className="px-2 py-1 rounded-md bg-[var(--color-cream-dark)] text-sm font-semibold text-[var(--color-text-muted)]">
              {t("home.illustrative")}
            </span>
          </div>
          <p className="text-base leading-relaxed text-[var(--color-text-secondary)]">{t(active.blurb)}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-md border border-[var(--color-border-light)] bg-[var(--color-cream-main)] text-sm font-semibold text-[var(--color-text-secondary)]">
              {active.route}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-[#F0FDFA] border border-[#CCFBF1] text-sm font-bold text-[#0F766E]">
              {t(active.chip)}
            </span>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-3.5">
          {tab === "queue" && (
            <>
              <div className="border border-[var(--color-border-light)] rounded-xl overflow-hidden">
                {QUEUE_ROWS.map((r, i) => (
                  <div
                    key={r.name}
                    className={`flex items-center gap-3 px-3.5 py-3 flex-wrap ${i < 2 ? "border-b border-[var(--color-cream-dark)]" : ""}`}
                  >
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-base font-semibold text-[var(--color-navy-900)]">{r.name}</span>
                      <span className="text-sm text-[var(--color-text-secondary)]">{r.meta}</span>
                    </div>
                    <Chip tone={r.tone}>{t("home.renews_in", { n: r.due })}</Chip>
                    <Score n={r.score} tone={r.s} />
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-[#F0FDFA] border border-[#CCFBF1] p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-bold text-[#0F766E]">{t("home.draft_ready")}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-[var(--color-cta)] text-white text-sm font-bold">EN</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#CCFBF1] text-[#0F766E] text-sm font-bold">हिंदी</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#CCFBF1] text-[#0F766E] text-sm font-bold">Hinglish</span>
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-[#115E59]">
                  Namaste Vikram ji, your Star Health policy renews on 4 September. Shall I send you
                  the check before you pay?
                </p>
              </div>
            </>
          )}

          {tab === "leads" && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <Chip tone="slate">{t("home.lead_new")}</Chip>
                <Chip tone="slate">{t("home.lead_contacted")}</Chip>
                <Chip tone="amber">{t("home.lead_interested")}</Chip>
                <Chip tone="teal">{t("home.lead_won")}</Chip>
              </div>
              <div className="rounded-xl bg-[#FFFBEB] border border-[#FDE68A] px-3.5 py-3 flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-[var(--color-gold-500)] shrink-0" />
                <span className="text-base font-bold text-[#78350F]">{t("home.call_today")}</span>
              </div>
              <div className="border border-[var(--color-border-light)] rounded-xl overflow-hidden">
                {[
                  { n: "Sunita Rao", m: "home.lm_sunita", d: "home.ld_call", t: "amber" as const },
                  { n: "Arjun Mehta", m: "home.lm_arjun", d: "home.ld_overdue", t: "red" as const },
                  { n: "Fatima Sheikh", m: "home.lm_fatima", d: "home.ld_contacted", t: "slate" as const },
                ].map((l, i) => (
                  <div key={l.n} className={`flex items-center gap-3 px-3.5 py-3 flex-wrap ${i < 2 ? "border-b border-[var(--color-cream-dark)]" : ""}`}>
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-base font-semibold text-[var(--color-navy-900)]">{l.n}</span>
                      <span className="text-sm text-[var(--color-text-secondary)]">{t(l.m)}</span>
                    </div>
                    <Chip tone={l.t}>{t(l.d)}</Chip>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "renewals" && (
            <>
              <p className="text-base leading-relaxed text-[var(--color-text-secondary)]">
                <strong className="font-bold text-[var(--color-navy-900)]">{t("home.ren_strong")}</strong>{" "}
                {t("home.ren_rest")}
              </p>
              <div className="border border-[var(--color-border-light)] rounded-xl overflow-hidden">
                {[
                  { n: "Vikram Singh", m: "home.rm_vikram", d: 3, p: "₹42,000", c: "text-[#DC2626]" },
                  { n: "Meena Patel", m: "home.rm_meena", d: 6, p: "₹28,500", c: "text-[var(--color-gold-500)]" },
                  { n: "Imran Qureshi", m: "home.rm_imran", d: 11, p: "₹19,200", c: "text-[var(--color-gold-500)]" },
                  { n: "Kavita Nair", m: "home.rm_kavita", d: 24, p: "₹8,400", c: "text-[var(--color-text-secondary)]" },
                ].map((r, i) => (
                  <div key={r.n} className={`flex items-center gap-3 px-3.5 py-3 flex-wrap ${i < 3 ? "border-b border-[var(--color-cream-dark)]" : ""}`}>
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-base font-semibold text-[var(--color-navy-900)]">{r.n}</span>
                      <span className="text-sm text-[var(--color-text-secondary)]">{t(r.m)}</span>
                    </div>
                    <span className="flex flex-col items-end gap-0.5">
                      <span className={`text-sm font-extrabold ${r.c}`}>{t("home.in_days", { n: r.d })}</span>
                      <span className="text-sm text-[var(--color-text-muted)]">{r.p}</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "compare" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#CCFBF1] bg-[#F0FDFA] p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-bold text-[var(--color-navy-900)]">Star Health</span>
                    <Score n={78} tone="teal" />
                  </div>
                  <span className="text-sm font-semibold text-[#0F766E]">₹10 L · ₹42,000</span>
                </div>
                <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-cream-main)] p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-bold text-[var(--color-navy-900)]">Niva Bupa</span>
                    <Score n={63} tone="amber" />
                  </div>
                  <span className="text-sm font-semibold text-[var(--color-text-secondary)]">₹10 L · ₹38,700</span>
                </div>
              </div>
              <div className="border border-[var(--color-border-light)] rounded-xl overflow-hidden">
                {[
                  ["home.c_room", "home.c_nocap", "home.c_perday"],
                  ["home.c_copay", "home.c_none", "home.c_over60"],
                  ["home.c_knee", "home.c_2y", "home.c_4y"],
                ].map(([k, a, b], i) => (
                  <div key={k} className={`grid grid-cols-3 gap-2 px-3.5 py-3 items-center ${i < 2 ? "border-b border-[var(--color-cream-dark)]" : ""}`}>
                    <span className="text-base font-semibold text-[var(--color-navy-900)]">{t(k)}</span>
                    <span className="text-sm font-bold text-[#0F766E]">{t(a)}</span>
                    <span className="text-sm font-bold text-[#DC2626]">{t(b)}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {t("home.c_note")}
              </p>
            </>
          )}

          {tab === "claims" && (
            <>
              <div className="border border-[var(--color-border-light)] rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-base font-bold text-[var(--color-navy-900)]">Meena Patel · HDFC Ergo</span>
                    <span className="text-sm text-[var(--color-text-secondary)]">{t("home.cl_where")}</span>
                  </div>
                  <Chip tone="amber">{t("home.cl_query")}</Chip>
                </div>
                <div className="flex items-center gap-2">
                  {["home.cl_filed", "home.cl_docs", "home.cl_q", "home.cl_settled"].map((s, i) => (
                    <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
                      <span
                        className={`w-full h-1 rounded-full ${
                          i < 2 ? "bg-[var(--color-teal-600)]" : i === 2 ? "bg-[var(--color-gold-500)]" : "bg-[var(--color-border-light)]"
                        }`}
                      />
                      <span className={`text-sm font-semibold ${i <= 2 ? "text-[var(--color-navy-900)]" : "text-[var(--color-text-muted)]"}`}>
                        {t(s)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-[#FFFBEB] border border-[#FDE68A] p-3.5 flex flex-col gap-1">
                <span className="text-sm font-bold text-[#78350F]">{t("home.cl_asked")}</span>
                <span className="text-sm leading-relaxed text-[#92400E]">
                  {t("home.cl_asked_text")}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductSection() {
  const { t } = useLanguage();
  return (
    /* Mint rather than cream. Every section on this page used to share one
       background, so nothing marked where one idea ended and the next began. */
    <section id="product" className="scroll-mt-28 bg-[var(--surface-mint)] py-14 sm:py-20 lg:py-24">
      <Reveal className="container-editorial px-6 flex flex-col items-center gap-3 text-center">
        <span className="px-3 py-1 rounded-full bg-[var(--color-teal-600)]/10 border border-[var(--color-teal-600)]/20 text-sm font-bold uppercase tracking-[0.14em] text-[#0F766E]">
          {t("home.product")}
        </span>
        <h2 className="font-serif font-bold tracking-[-0.03em] leading-tight text-3xl sm:text-4xl lg:text-5xl text-[var(--color-navy-900)]">
          {t("home.product_h")}
        </h2>
        <span className="rule-accent" />
        <p className="text-lg leading-relaxed text-[var(--color-text-secondary)] max-w-xl">
          {t("home.product_sub")}
        </p>
      </Reveal>

      {/* Band 1 — Advisor Portal */}
      <div className="container-editorial px-6 mt-12 lg:mt-16 grid lg:grid-cols-[minmax(0,400px)_1fr] gap-10 lg:gap-14 items-start">
        <div className="flex flex-col gap-6 lg:pt-2">
          <Link href="/agent">
            <span className="inline-flex items-center gap-2 text-base font-semibold text-[var(--color-teal-600)] hover:underline cursor-pointer">
              {t("home.advisor_portal")} <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
          <h3 className="font-serif font-bold tracking-[-0.03em] leading-[1.1] text-3xl sm:text-4xl text-[var(--color-navy-900)]">
            {t("home.advisor_h")}
          </h3>
          <p className="text-base sm:text-lg leading-relaxed text-[var(--color-text-secondary)]">
            {t("home.advisor_sub")}
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/agent/signup/step1" className="w-full sm:w-auto">
              <button className="w-full h-12 px-5 rounded-lg bg-[var(--color-cta)] text-white text-base font-semibold hover:bg-[var(--color-cta-hover)] transition-colors">
                {t("home.start_free")}
              </button>
            </Link>
            <Link href="/agent/playground" className="w-full sm:w-auto">
              <button className="w-full h-12 px-5 rounded-lg bg-white border border-[var(--color-border-light)] text-base font-semibold text-[var(--color-text-main)] hover:bg-[var(--color-cream-dark)] transition-colors">
                {t("home.try_demo")}
              </button>
            </Link>
          </div>

          <div className="h-px bg-[var(--color-border-light)]" />

          {/* claim-source: every item below is a shipped route or a Free-tier line on
              /advisors/pricing (advisors-pricing.tsx:33-42), verified 2026-08-25 */}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {["home.f_wa", "home.f_renewals", "home.f_calc", "home.f_compare",
              "home.f_riders", "home.f_excel", "home.f_team", "home.f_sach"].map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-base font-medium text-[var(--color-text-main)]">
                <Check className="w-4 h-4 text-[var(--color-teal-600)] shrink-0" />
                {t(f)}
              </li>
            ))}
          </ul>
        </div>

        <AdvisorPanel />
      </div>

      <div className="container-editorial px-6">
        <div className="h-px bg-[var(--color-border-light)] my-14 lg:my-20" />
      </div>

      {/* Band 2 — My Portfolio */}
      <div className="container-editorial px-6 grid lg:grid-cols-[1fr_minmax(0,420px)] gap-10 lg:gap-14 items-center">
        <div className="rounded-xl bg-white overflow-hidden order-2 lg:order-1" style={{ boxShadow: panelShadow }}>
          <PanelBar route={t("home.pdf_route")} />
          <div className="grid md:grid-cols-2">
            <div className="border-b md:border-b-0 md:border-r border-[var(--color-border-light)] p-4 flex flex-col gap-2.5 bg-[#FCFCFB]">
              <span className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{t("home.says")}</span>
              <p className="text-sm leading-relaxed text-[var(--color-border-medium)] text-justify">
                3.3 Where the Insured Person is admitted to a room the rent of which exceeds the
                eligibility specified in the Schedule, the Insured Person shall bear a rateable
                proportion of the total associated medical expenses.
              </p>
              <div className="bg-[#FFFBEB] border-l-[3px] border-[var(--color-gold-500)] rounded-r-lg px-3 py-2.5">
                <p className="text-sm leading-relaxed text-[#78350F] text-justify">
                  <strong className="font-extrabold">3.4 Co-payment.</strong> Where the age of the
                  Insured Person at commencement of the first Policy exceeds sixty (60) completed
                  years, each and every admissible claim shall be subject to a co-payment of twenty
                  per cent (20%) of the amount otherwise payable, which shall not be recoverable
                  under any cumulative bonus, restoration or top-up benefit.
                </p>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-3">
              <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-[#0F766E]">
                <ShieldCheck className="w-4 h-4 shrink-0" /> {t("home.means")}
              </span>
              <p className="font-serif text-xl sm:text-2xl font-bold tracking-[-0.025em] leading-snug text-[var(--color-navy-900)]">
                {t("home.means_h")}
              </p>
              <div className="flex gap-2.5">
                <div className="flex-1 rounded-xl bg-[var(--color-cream-main)] border border-[var(--color-border-light)] p-3 flex flex-col gap-0.5">
                  <span className="text-sm font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">{t("home.bill")}</span>
                  <span className="text-lg font-extrabold tracking-tight text-[var(--color-navy-900)]">₹3,20,000</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">{t("home.they_pay")}</span>
                </div>
                <div className="flex-1 rounded-xl bg-[#FEF2F2] border border-[#FECACA] p-3 flex flex-col gap-0.5">
                  <span className="text-sm font-bold uppercase tracking-[0.1em] text-[#DC2626]">{t("home.you_pay")}</span>
                  <span className="text-lg font-extrabold tracking-tight text-[#B91C1C]">₹80,000</span>
                  <span className="text-sm text-[#991B1B]">{t("home.every_time")}</span>
                </div>
              </div>
              <p className="flex items-start gap-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                <AlertTriangle className="w-4 h-4 text-[var(--color-gold-500)] shrink-0 mt-0.5" />
                {t("home.bonus_note")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 order-1 lg:order-2">
          <span className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-teal-600)]">
            {t("home.own_policies")}
          </span>
          <h3 className="font-serif font-bold tracking-[-0.03em] leading-[1.1] text-3xl sm:text-4xl text-[var(--color-navy-900)]">
            {t("home.portfolio")}
          </h3>
          <p className="text-base sm:text-lg leading-relaxed text-[var(--color-text-secondary)]">
            {t("home.portfolio_sub")}
          </p>

          {/* claim-source: Free tier on /pricing (pricing.tsx:46-50), verified 2026-08-25 */}
          <ul className="flex flex-col gap-3">
            {["home.p_one_each",
              "home.p_explained",
              "home.p_reminders"].map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-base leading-relaxed text-[var(--color-text-main)]">
                <Check className="w-4 h-4 text-[var(--color-teal-600)] shrink-0 mt-1" />
                {t(f)}
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/policychecker" className="w-full sm:w-auto">
              <button className="w-full h-12 px-5 rounded-lg bg-[var(--color-cta)] text-white text-base font-semibold hover:bg-[var(--color-cta-hover)] transition-colors flex items-center justify-center gap-2">
                {t("home.cta_check")} <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/policychecker" className="w-full sm:w-auto">
              <button className="w-full h-12 px-5 rounded-lg bg-white border border-[var(--color-border-light)] text-base font-semibold text-[var(--color-text-main)] hover:bg-[var(--color-cream-dark)] transition-colors">
                {t("home.what_we_check")}
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────── HOW IT WORKS — three cards ─────────────── */

function HowItWorks() {
  const { t } = useLanguage();
  return (
    <section id="how-it-works" className="scroll-mt-28 bg-white py-14 sm:py-20 lg:py-24">
      <div className="container-editorial px-6 flex flex-col gap-10">
        <Reveal className="flex flex-col gap-3.5">
          <span className="self-start px-2.5 py-1 rounded-md bg-[var(--color-teal-600)]/10 text-sm font-bold uppercase tracking-[0.14em] text-[#0F766E]">
            {t("home.how")}
          </span>
          <h2 className="font-serif font-bold tracking-[-0.03em] leading-tight text-3xl sm:text-4xl lg:text-5xl text-[var(--color-navy-900)]">
            {t("home.how_h")}
          </h2>
          <span className="rule-accent" />
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6">
          <Reveal className="flex flex-col gap-4" delay={0}>
            {/* The four floating tiles are the scattered policies; each carries
                the colour of the cover it stands for, and they settle inward
                towards the single figure. */}
            <div
              className="relative h-64 sm:h-72 overflow-hidden rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(150deg, var(--lob-health-wash), var(--color-cream-dark))" }}
            >
              {[
                { cls: "left-7 top-8", c: "var(--lob-health)", i: HeartPulse, d: 0 },
                { cls: "right-8 top-7", c: "var(--lob-life)", i: Umbrella, d: 0.1 },
                { cls: "left-10 bottom-10", c: "var(--lob-motor)", i: Car, d: 0.2 },
                { cls: "right-9 bottom-9", c: "var(--lob-travel)", i: Plane, d: 0.3 },
              ].map((t) => (
                <motion.span
                  key={t.cls}
                  className={`absolute ${t.cls} flex h-11 w-11 items-center justify-center rounded-xl bg-white/85 shadow-sm`}
                  style={{ color: t.c }}
                  initial={{ opacity: 0, scale: 0.7 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "0px 0px -12% 0px" }}
                  transition={{ duration: 0.5, delay: 0.25 + t.d, ease: [0.22, 1, 0.36, 1] }}
                  aria-hidden="true"
                >
                  <t.i className="h-5 w-5" />
                </motion.span>
              ))}
              <div className="relative rounded-xl bg-white px-5 py-4 flex flex-col items-center gap-1" style={{ boxShadow: panelShadow }}>
                <span className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">{t("home.one_family")}</span>
                <span className="font-serif text-3xl font-bold tracking-tight text-[var(--color-navy-900)]">
                  ₹<AnimatedNumber value={1.6} decimals={1} /> Cr
                </span>
                <span className="text-sm text-[var(--color-text-secondary)]">{t("home.five_three")}</span>
              </div>
            </div>
            <p className="text-base leading-relaxed text-[var(--color-text-secondary)]">
              <strong className="font-bold text-[var(--color-navy-900)]">{t("home.step1_b")}</strong>{" "}
              {t("home.step1")}
            </p>
          </Reveal>

          <Reveal className="flex flex-col gap-4" delay={0.1}>
            {/* This panel used to read "62 pp. in 41 seconds". Neither figure had
                a source, and the audit flagged it as a benchmark presented as
                product output, so the claim is now the thing the engine does
                rather than a number nobody can stand behind. */}
            <div
              className="relative h-64 sm:h-72 overflow-hidden rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(150deg, var(--lob-life-wash), var(--color-cream-dark))" }}
            >
              {[208, 144].map((size, i) => (
                <motion.span
                  key={size}
                  className={`absolute rounded-full ${i === 0 ? "border border-dashed" : "border"}`}
                  style={{ width: size, height: size, borderColor: "var(--lob-life)", opacity: 0.35 }}
                  initial={{ scale: 0.85, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 0.35 }}
                  viewport={{ once: true, margin: "0px 0px -12% 0px" }}
                  transition={{ duration: 0.7, delay: 0.2 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                  aria-hidden="true"
                />
              ))}
              <div className="relative rounded-xl bg-white px-4 py-3.5 flex flex-col items-center gap-0.5" style={{ boxShadow: panelShadow }}>
                <span className="text-sm font-bold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">{t("home.every_clause")}</span>
                <span className="font-serif text-2xl font-bold tracking-tight text-[var(--color-navy-900)]">{t("home.read_full")}</span>
                <span className="text-sm font-bold text-[var(--lob-life)]">{t("home.annexures")}</span>
              </div>
            </div>
            <p className="text-base leading-relaxed text-[var(--color-text-secondary)]">
              <strong className="font-bold text-[var(--color-navy-900)]">{t("home.step2_b")}</strong>{" "}
              {t("home.step2")}
            </p>
          </Reveal>

          <Reveal className="flex flex-col gap-4" delay={0.2}>
            <div
              className="relative h-64 sm:h-72 overflow-hidden rounded-xl"
              style={{ background: "linear-gradient(150deg, var(--lob-motor-wash), var(--color-cream-dark))" }}
            >
              <span className="absolute left-[62%] top-0 bottom-0 w-0.5 bg-[var(--lob-motor)]/35" />
              {/* A quiet pulse on the marker: this is the only thing on the page
                  standing in for "a reminder arrives". */}
              <span className="absolute left-[62%] top-20 -translate-x-1/2 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--lob-motor)] opacity-60" />
                <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-white bg-[var(--lob-motor)]" />
              </span>
              <div className="absolute left-5 top-24 right-14 rounded-xl bg-white p-3.5 flex flex-col gap-2" style={{ boxShadow: panelShadow }}>
                <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.06em] text-[var(--color-gold-500)]">
                  <Bell className="w-4 h-4 shrink-0" /> {t("home.renewal")}
                </span>
                <span className="text-sm leading-relaxed text-[var(--color-navy-900)]">
                  <strong className="font-bold">{t("home.car_expires")}</strong>{" "}
                  {t("home.car_due")}
                </span>
              </div>
            </div>
            <p className="text-base leading-relaxed text-[var(--color-text-secondary)]">
              <strong className="font-bold text-[var(--color-navy-900)]">{t("home.step3_b")}</strong>{" "}
              {t("home.step3")}
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─────────────── PAGE ─────────────── */

export default function Home() {
  const { t } = useLanguage();
  useSEO(seoFor("/"));

  return (
    <div className="bg-[var(--color-cream-main)] text-[var(--color-text-main)] font-sans selection:bg-[var(--color-cta)] selection:text-white min-h-screen flex flex-col overflow-x-hidden">
      <Header />

      <main className="flex-grow pt-32">
        <Hero />
        <ProductSection />
        <HowItWorks />

        <section className="on-ink relative overflow-hidden py-16 sm:py-24 lg:py-32 bg-[var(--color-navy-900)] text-center text-white">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute inset-0 bg-grid-faint-dark mask-fade-edges" />
            <div
              className="absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 -translate-y-1/3 rounded-full blur-3xl"
              style={{ background: "radial-gradient(ellipse, rgba(45,212,191,0.22), transparent 70%)" }}
            />
          </div>

          <div className="container-editorial relative px-6">
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-serif font-bold tracking-[-0.035em] leading-[1.08] mb-6 text-white">
              {t("home.final_h1")}<br />{t("home.final_h2")}
            </h2>
            <p className="text-lg sm:text-xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed">
              {t("home.final_sub")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/policychecker" className="w-full sm:w-auto">
                <button className="w-full h-14 px-8 rounded-lg bg-[var(--color-cta)] text-white text-lg font-bold hover:bg-[var(--color-cta-hover)] transition-colors flex items-center justify-center gap-2">
                  {t("home.cta_check")} <ArrowRight className="w-5 h-5" />
                </button>
              </Link>
              <Link href="/agent" className="w-full sm:w-auto">
                <button className="w-full h-14 px-8 rounded-lg border border-white/25 text-white/90 text-lg font-semibold hover:bg-white/10 hover:text-white transition-colors">
                  {t("home.i_advise")}
                </button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
