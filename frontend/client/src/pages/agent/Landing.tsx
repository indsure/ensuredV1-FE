import { Link } from "wouter";
import {
  ArrowRight, Users, CalendarClock, ListChecks, ShieldCheck, Scale, FileText,
  IndianRupee, UserCircle, MessageCircle, Phone, Calendar, Download,
} from "lucide-react";
import { useEffect } from "react";
import { useLanguage, LanguageToggle } from "@/i18n/LanguageContext";

/* Rebuilt 2026-08-25. The page this replaces sold four things the product does
   not have: commission tracking (the word appeared in no other file), IRDAI
   compliance reporting (no such module), insurer integrations (mocked, per
   rules.md), and a 200-plus-cities reach claim (the live database had 12
   agents). Every claim below is a shipped route or a price already published
   on /advisors/pricing. */

const WA = "https://wa.me/919987148125?text=Hi%2C%20I%27d%20like%20to%20know%20more%20about%20IndSure%20and%20joining%20as%20an%20agent";

const panelShadow =
  "0 0 0 1px rgba(0,0,0,0.07), 0 2px 2px -1px rgba(0,0,0,0.02), 0 6px 6px -3px rgba(0,0,0,0.02), 0 14px 14px -7px rgba(0,0,0,0.018), 0 28px 28px -14px rgba(0,0,0,0.018), 0 56px 56px -28px rgba(0,0,0,0.02)";

const cardShadow =
  "0 0 0 1px rgba(0,0,0,0.06), 0 3px 3px -1.5px rgba(0,0,0,0.014), 0 8px 8px -4px rgba(0,0,0,0.012)";

export default function AgentLanding() {
  const { t } = useLanguage();

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://assets.calendly.com/assets/external/widget.css";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(script);
    };
  }, []);

  const openCalendly = (e: React.MouseEvent) => {
    e.preventDefault();
    const url = "https://calendly.com/deep-indsure/30min";
    // @ts-ignore
    if (window.Calendly) {
      // @ts-ignore
      window.Calendly.initPopupWidget({ url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    return false;
  };

  const capabilities = [
    { icon: Users, title: t("agent_landing.cap_leads_title"), desc: t("agent_landing.cap_leads_desc") },
    { icon: CalendarClock, title: t("agent_landing.cap_renewals_title"), desc: t("agent_landing.cap_renewals_desc") },
    { icon: ListChecks, title: t("agent_landing.cap_book_title"), desc: t("agent_landing.cap_book_desc") },
    { icon: ShieldCheck, title: t("agent_landing.cap_checks_title"), desc: t("agent_landing.cap_checks_desc") },
    { icon: Scale, title: t("agent_landing.cap_compare_title"), desc: t("agent_landing.cap_compare_desc") },
    { icon: FileText, title: t("agent_landing.cap_claims_title"), desc: t("agent_landing.cap_claims_desc") },
    { icon: IndianRupee, title: t("agent_landing.cap_calc_title"), desc: t("agent_landing.cap_calc_desc") },
    { icon: UserCircle, title: t("agent_landing.cap_page_title"), desc: t("agent_landing.cap_page_desc") },
  ];

  return (
    <div className="min-h-screen bg-white text-[var(--color-text-main)]">

      {/* ─────────── NAV ─────────── */}
      <nav className="sticky top-0 z-50 h-14 bg-white border-b border-[var(--color-border-light)] flex items-center justify-between px-5 sm:px-10 gap-4">
        <div className="flex items-center gap-5">
          <Link href="/agent">
            <span className="font-serif text-xl font-bold tracking-tight text-[var(--color-gold-500)] cursor-pointer">
              IndSure.
            </span>
          </Link>
          <span className="hidden md:inline-flex px-2.5 py-1 rounded-lg bg-[#EAF3F1] text-sm font-semibold text-[#0F766E]">
            {t("agent_landing.pill_advisors")}
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-1">
          <Link href="/advisors/pricing">
            <span className="px-2.5 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] transition-colors cursor-pointer">
              {t("agent_landing.nav_pricing")}
            </span>
          </Link>
          <Link href="/agent/playground">
            <span className="px-2.5 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] transition-colors cursor-pointer">
              {t("agent_landing.nav_playground")}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <LanguageToggle />
          <Link href="/agent/login">
            <span className="hidden sm:inline text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] transition-colors cursor-pointer px-1">
              {t("agent_landing.nav_login")}
            </span>
          </Link>
          <button
            onClick={openCalendly}
            className="hidden sm:inline-flex h-9 items-center gap-1.5 px-3.5 rounded-lg bg-white border border-[var(--color-border-light)] text-sm font-semibold text-[var(--color-text-main)] hover:bg-[var(--color-cream-dark)] transition-colors"
          >
            <MessageCircle className="w-4 h-4 text-[var(--color-teal-600)]" />
            {t("agent_landing.nav_talk")}
          </button>
          <Link href="/agent/signup/step1">
            <button className="h-9 px-3.5 rounded-lg bg-[var(--color-teal-600)] text-white text-sm font-semibold hover:bg-[var(--color-teal-400)] transition-colors">
              {t("agent_landing.nav_start")}
            </button>
          </Link>
        </div>
      </nav>

      {/* ─────────── HERO ─────────── */}
      <section className="px-5 sm:px-10 lg:px-20 pt-12 lg:pt-20 max-w-[1280px] mx-auto flex flex-col gap-5">
        {/* claim-source: Free tier on /advisors/pricing (advisors-pricing.tsx:26-43) — the
            daily tools carry no time limit and no card. Verified 2026-08-25. */}
        <span className="self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EAF3F1] text-sm font-bold text-[#0F766E]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-teal-600)]" />
          {t("agent_landing.badge")}
        </span>

        <h1 className="font-serif font-bold tracking-[-0.038em] leading-[1.05] text-4xl sm:text-5xl lg:text-6xl text-[var(--color-navy-900)] max-w-3xl">
          {t("agent_landing.hero_title")}
        </h1>

        <p className="text-lg sm:text-xl leading-relaxed text-[var(--color-text-secondary)] max-w-2xl">
          {t("agent_landing.hero_subtitle")}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mt-1">
          <Link href="/agent/signup/step1" className="w-full sm:w-auto">
            <button className="w-full h-[52px] px-6 rounded-lg bg-[var(--color-teal-600)] text-white text-base font-semibold hover:bg-[var(--color-teal-400)] transition-colors flex items-center justify-center gap-2">
              {t("agent_landing.cta_start")} <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
          <Link href="/agent/playground" className="w-full sm:w-auto">
            <button className="w-full h-[52px] px-6 rounded-lg bg-white border border-[var(--color-border-light)] text-base font-semibold text-[var(--color-text-main)] hover:bg-[var(--color-cream-dark)] transition-colors">
              {t("agent_landing.cta_playground")}
            </button>
          </Link>
        </div>

        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-1">
          {[t("agent_landing.trust_nocard"), t("agent_landing.trust_language"), t("agent_landing.trust_yours")].map((s) => (
            <li key={s} className="flex items-center gap-2 text-sm sm:text-base text-[var(--color-text-secondary)]">
              <ShieldCheck className="w-4 h-4 text-[var(--color-teal-600)] shrink-0" />
              {s}
            </li>
          ))}
        </ul>
      </section>

      {/* ─────────── HERO VISUAL ─────────── */}
      <section className="px-5 sm:px-10 lg:px-20 pt-10 lg:pt-14 max-w-[1280px] mx-auto">
        <div className="rounded-3xl bg-[var(--color-cream-dark)] border border-[var(--color-border-light)] p-4 sm:p-8 lg:p-10">
          <div className="grid lg:grid-cols-[1fr_300px] gap-5 items-start">

            <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: panelShadow }}>
              <div className="h-11 bg-[var(--color-cream-main)] border-b border-[var(--color-border-light)] flex items-center gap-3 px-3.5">
                <span className="text-sm font-medium text-[var(--color-text-muted)] flex-1">indsure.in / agent / policies</span>
                <span className="px-2 py-1 rounded-md bg-[var(--color-cream-dark)] text-sm font-semibold text-[var(--color-text-muted)]">
                  {t("agent_landing.illustrative")}
                </span>
              </div>

              <div className="p-4 sm:p-5 flex flex-col gap-3.5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-lg font-bold tracking-tight text-[var(--color-navy-900)]">
                      {t("agent_landing.panel_book")}
                    </span>
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {t("agent_landing.panel_book_meta")}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[var(--color-border-light)] text-sm font-semibold text-[var(--color-text-secondary)]">
                    <Download className="w-4 h-4" /> Excel
                  </span>
                </div>

                <div className="border border-[var(--color-border-light)] rounded-xl overflow-hidden">
                  {[
                    { n: "Vikram Singh", i: "Star Health", p: "₹42,000", d: t("agent_landing.in_3_days"), dc: "text-[#DC2626]", s: 49, sc: "bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]" },
                    { n: "Meena Patel", i: "HDFC Ergo", p: "₹28,500", d: t("agent_landing.in_6_days"), dc: "text-[var(--color-gold-500)]", s: 63, sc: "bg-[#FEF3C7] text-[var(--color-gold-500)] border-[#FDE68A]" },
                    { n: "Imran Qureshi", i: "Niva Bupa", p: "₹19,200", d: t("agent_landing.in_11_days"), dc: "text-[var(--color-text-secondary)]", s: 78, sc: "bg-[#F0FDFA] text-[#0F766E] border-[#CCFBF1]" },
                  ].map((r, idx) => (
                    <div key={r.n} className={`flex items-center gap-3 px-3.5 py-3 flex-wrap ${idx < 2 ? "border-b border-[var(--color-cream-dark)]" : ""}`}>
                      <span className="flex-1 min-w-0 text-base font-semibold text-[var(--color-navy-900)]">{r.n}</span>
                      <span className="text-sm text-[var(--color-text-secondary)]">{r.i}</span>
                      <span className="text-sm text-[var(--color-text-main)]">{r.p}</span>
                      <span className={`text-sm font-bold ${r.dc}`}>{r.d}</span>
                      <span className={`min-w-9 px-2 py-1 rounded-md border text-base font-extrabold text-center ${r.sc}`}>{r.s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: panelShadow }}>
              <div className="h-12 bg-[var(--color-navy-900)] flex items-center justify-between px-4">
                <span className="text-white text-base font-bold tracking-tight">IndSure</span>
                <span className="flex items-center gap-1 bg-white/10 rounded-full p-0.5">
                  <span className="px-2 py-0.5 rounded-full bg-[var(--color-teal-600)] text-white text-sm font-bold">EN</span>
                  <span className="px-2 py-0.5 rounded-full text-white/60 text-sm font-bold">हिंदी</span>
                </span>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-base font-bold tracking-tight text-[var(--color-navy-900)]">
                    {t("agent_landing.panel_today")}
                  </span>
                  <span className="text-sm text-[var(--color-text-secondary)]">{t("agent_landing.panel_today_meta")}</span>
                </div>
                <div className="border border-[var(--color-border-light)] rounded-xl p-3 flex items-center gap-2.5">
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <span className="text-base font-semibold text-[var(--color-navy-900)]">Vikram Singh</span>
                    <span className="text-sm text-[var(--color-text-secondary)]">Star Health · ₹42,000</span>
                    <span className="self-start px-2 py-0.5 rounded-md bg-[#FEF2F2] text-sm font-bold text-[#DC2626]">
                      {t("agent_landing.in_3_days")}
                    </span>
                  </div>
                  <span className="w-11 h-11 shrink-0 rounded-xl bg-[#F0FDFA] border border-[#CCFBF1] flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-[var(--color-teal-600)]" />
                  </span>
                </div>
                <div className="rounded-xl bg-[#F0FDFA] border border-[#CCFBF1] p-3 flex flex-col gap-1">
                  <span className="text-sm font-bold text-[#0F766E]">{t("agent_landing.draft_ready")}</span>
                  <span className="text-sm leading-relaxed text-[#115E59]">
                    नमस्ते विक्रम जी, आपकी Star Health पॉलिसी 4 सितंबर को रिन्यू हो रही है।
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── WHAT IT REPLACES ─────────── */}
      <section className="px-5 sm:px-10 lg:px-20 py-10 lg:py-16 max-w-[1280px] mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
        <span className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          {t("agent_landing.replaces_label")}
        </span>
        {[t("agent_landing.replaces_1"), t("agent_landing.replaces_2"), t("agent_landing.replaces_3"), t("agent_landing.replaces_4")].map((s, i) => (
          <span key={s} className="flex items-center gap-4">
            {i > 0 && <span className="w-1 h-1 rounded-full bg-[var(--color-border-medium)]" />}
            <span className="text-base text-[var(--color-text-secondary)]">{s}</span>
          </span>
        ))}
      </section>

      {/* ─────────── CAPABILITIES ─────────── */}
      <section className="bg-[var(--color-cream-main)] border-y border-[var(--color-border-light)] py-14 lg:py-20">
        <div className="px-5 sm:px-10 lg:px-20 max-w-[1280px] mx-auto flex flex-col gap-10">
          <div className="flex flex-col gap-3 max-w-2xl">
            <span className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-teal-600)]">
              {t("agent_landing.caps_eyebrow")}
            </span>
            <h2 className="font-serif font-bold tracking-[-0.03em] leading-tight text-3xl sm:text-4xl text-[var(--color-navy-900)]">
              {t("agent_landing.caps_heading")}
            </h2>
            {/* claim-source: every tile below is a route in App.tsx (/agent/leads, /renewals,
                /policies, /compare, /claims, /calculator, /riders, /my-page); the free/paid split
                is the Free and Agent tiers on advisors-pricing.tsx. Verified 2026-08-25. */}
            <p className="text-lg leading-relaxed text-[var(--color-text-secondary)]">
              {t("agent_landing.caps_sub")}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {capabilities.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.title} className="rounded-xl bg-white p-5 flex flex-col gap-2.5" style={{ boxShadow: cardShadow }}>
                  <Icon className="w-5 h-5 text-[var(--color-teal-600)]" />
                  <h3 className="text-lg font-bold tracking-tight text-[var(--color-navy-900)]">{c.title}</h3>
                  <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{c.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────── BLOCK 1 · RENEWALS ─────────── */}
      <section className="px-5 sm:px-10 lg:px-20 py-14 lg:py-24 max-w-[1280px] mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className="flex flex-col gap-4">
          <span className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-teal-600)]">
            {t("agent_landing.b1_eyebrow")}
          </span>
          <h2 className="text-2xl sm:text-[26px] leading-snug tracking-[-0.02em] text-[var(--color-navy-900)]">
            {t("agent_landing.b1_heading")}
          </h2>
          <p className="text-base leading-relaxed text-[var(--color-text-secondary)]">{t("agent_landing.b1_body")}</p>
          <Link href="/agent/playground">
            <span className="inline-flex items-center gap-2 text-base font-semibold text-[var(--color-teal-600)] hover:underline cursor-pointer">
              {t("agent_landing.b1_link")} <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>

        <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: panelShadow }}>
          <div className="h-11 bg-[var(--color-cream-main)] border-b border-[var(--color-border-light)] flex items-center justify-between px-3.5">
            <span className="text-sm font-bold text-[var(--color-navy-900)]">{t("agent_landing.panel_renewals")}</span>
            <span className="px-2 py-1 rounded-md bg-[var(--color-cream-dark)] text-sm font-semibold text-[var(--color-text-muted)]">
              {t("agent_landing.illustrative")}
            </span>
          </div>
          {[
            { n: "Vikram Singh", m: "Star Health · ₹42,000", d: "in 3d", c: "text-[#DC2626]", bar: "bg-[#DC2626]" },
            { n: "Meena Patel", m: "HDFC Ergo · ₹28,500", d: "in 6d", c: "text-[var(--color-gold-500)]", bar: "bg-[var(--color-gold-500)]" },
          ].map((r) => (
            <div key={r.n} className="flex items-center gap-3 px-3.5 py-3 border-b border-[var(--color-cream-dark)]">
              <span className={`w-1 h-8 rounded-full shrink-0 ${r.bar}`} />
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-base font-semibold text-[var(--color-navy-900)]">{r.n}</span>
                <span className="text-sm text-[var(--color-text-secondary)]">{r.m}</span>
              </span>
              <span className={`text-sm font-extrabold ${r.c}`}>{r.d}</span>
            </div>
          ))}
          <div className="p-3.5 bg-[#F0FDFA] flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-bold text-[#0F766E]">{t("agent_landing.draft_for")}</span>
              <span className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-[var(--color-teal-600)] text-white text-sm font-bold">EN</span>
                <span className="px-2 py-0.5 rounded-full bg-[#CCFBF1] text-[#0F766E] text-sm font-bold">हिंदी</span>
                <span className="px-2 py-0.5 rounded-full bg-[#CCFBF1] text-[#0F766E] text-sm font-bold">Hinglish</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed text-[#115E59]">
              Namaste Vikram ji, your Star Health policy renews on 4 September. Shall I send you the
              check before you pay?
            </p>
          </div>
        </div>
      </section>

      {/* ─────────── BLOCK 2 · CHECKS ─────────── */}
      <section className="bg-[var(--color-cream-main)] border-t border-[var(--color-border-light)]">
        <div className="px-5 sm:px-10 lg:px-20 py-14 lg:py-24 max-w-[1280px] mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="rounded-xl bg-white overflow-hidden order-2 lg:order-1" style={{ boxShadow: panelShadow }}>
            <div className="h-11 bg-[var(--color-cream-main)] border-b border-[var(--color-border-light)] flex items-center justify-between px-3.5">
              <span className="text-sm font-bold text-[var(--color-navy-900)]">{t("agent_landing.panel_check")}</span>
              <span className="px-2 py-1 rounded-md bg-[var(--color-cream-dark)] text-sm font-semibold text-[var(--color-text-muted)]">
                {t("agent_landing.illustrative")}
              </span>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3.5">
                <span className="min-w-14 px-3 py-2 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] text-2xl font-extrabold text-[var(--color-gold-500)] text-center">63</span>
                <span className="flex-1 flex flex-col gap-0.5">
                  <span className="text-base font-bold text-[var(--color-navy-900)]">{t("agent_landing.check_verdict")}</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">{t("agent_landing.check_meta")}</span>
                </span>
              </div>
              <div className="rounded-xl bg-[#FEF2F2] border border-[#FECACA] p-3.5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-base font-bold text-[#7F1D1D]">{t("agent_landing.check_clause_1")}</span>
                  <span className="px-2 py-0.5 rounded-md bg-[#FEE2E2] text-sm font-extrabold text-[#B91C1C]">≈ ₹1.6 L</span>
                </div>
                <p className="text-sm leading-relaxed text-[#991B1B]">{t("agent_landing.check_clause_1_desc")}</p>
              </div>
              <div className="rounded-xl bg-[#FFFBEB] border border-[#FDE68A] p-3.5 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-base font-bold text-[#78350F]">{t("agent_landing.check_clause_2")}</span>
                <span className="px-2 py-0.5 rounded-md bg-[#FEF3C7] text-sm font-extrabold text-[var(--color-gold-500)]">
                  {t("agent_landing.check_waiting")}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 order-1 lg:order-2">
            <span className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-teal-600)]">
              {t("agent_landing.b2_eyebrow")}
            </span>
            <h2 className="text-2xl sm:text-[26px] leading-snug tracking-[-0.02em] text-[var(--color-navy-900)]">
              {t("agent_landing.b2_heading")}
            </h2>
            {/* claim-source: 3 checks on Free, 12/month on Agent — advisors-pricing.tsx:36,52.
                Verified 2026-08-25. */}
            <p className="text-base leading-relaxed text-[var(--color-text-secondary)]">{t("agent_landing.b2_body")}</p>
            <Link href="/policychecker">
              <span className="inline-flex items-center gap-2 text-base font-semibold text-[var(--color-teal-600)] hover:underline cursor-pointer">
                {t("agent_landing.b2_link")} <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────── BLOCK 3 · YOUR MONTH ─────────── */}
      <section className="px-5 sm:px-10 lg:px-20 py-14 lg:py-24 max-w-[1280px] mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className="flex flex-col gap-4">
          <span className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-teal-600)]">
            {t("agent_landing.b3_eyebrow")}
          </span>
          <h2 className="text-2xl sm:text-[26px] leading-snug tracking-[-0.02em] text-[var(--color-navy-900)]">
            {t("agent_landing.b3_heading")}
          </h2>
          <p className="text-base leading-relaxed text-[var(--color-text-secondary)]">{t("agent_landing.b3_body")}</p>
          <Link href="/agent/playground">
            <span className="inline-flex items-center gap-2 text-base font-semibold text-[var(--color-teal-600)] hover:underline cursor-pointer">
              {t("agent_landing.b3_link")} <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>

        <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: panelShadow }}>
          <div className="h-11 bg-[var(--color-cream-main)] border-b border-[var(--color-border-light)] flex items-center justify-between px-3.5">
            <span className="text-sm font-bold text-[var(--color-navy-900)]">{t("agent_landing.panel_month")}</span>
            <span className="px-2 py-1 rounded-md bg-[var(--color-cream-dark)] text-sm font-semibold text-[var(--color-text-muted)]">
              {t("agent_landing.illustrative")}
            </span>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-[var(--color-border-light)] p-3 flex flex-col gap-0.5">
                <span className="text-sm font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                  {t("agent_landing.month_renewals")}
                </span>
                <span className="text-2xl font-extrabold tracking-tight text-[var(--color-navy-900)]">9 of 11</span>
              </div>
              <div className="rounded-xl border border-[var(--color-border-light)] p-3 flex flex-col gap-0.5">
                <span className="text-sm font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                  {t("agent_landing.month_checks")}
                </span>
                <span className="text-2xl font-extrabold tracking-tight text-[var(--color-navy-900)]">7 of 12</span>
              </div>
            </div>
            <div className="border-t border-[var(--color-cream-dark)] pt-3 flex flex-col gap-2">
              <span className="text-sm font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                {t("agent_landing.month_coming")}
              </span>
              {[
                { c: "bg-[#DC2626]", s: t("agent_landing.month_item_1"), v: "₹89,700" },
                { c: "bg-[var(--color-gold-500)]", s: t("agent_landing.month_item_2"), v: "2 days" },
                { c: "bg-[var(--color-border-medium)]", s: t("agent_landing.month_item_3"), v: "overdue" },
              ].map((r) => (
                <div key={r.s} className="flex items-center gap-2.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.c}`} />
                  <span className="flex-1 text-sm text-[var(--color-text-main)]">{r.s}</span>
                  <span className="text-sm text-[var(--color-text-muted)]">{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── PRICING ─────────── */}
      <section className="bg-[var(--color-cream-main)] border-t border-[var(--color-border-light)] py-14 lg:py-20">
        <div className="px-5 sm:px-10 lg:px-20 max-w-[1280px] mx-auto flex flex-col gap-9">
          <div className="flex flex-col gap-3 max-w-2xl">
            <span className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-teal-600)]">
              {t("agent_landing.price_eyebrow")}
            </span>
            <h2 className="font-serif font-bold tracking-[-0.03em] leading-tight text-3xl sm:text-4xl text-[var(--color-navy-900)]">
              {t("agent_landing.price_heading")}
            </h2>
            {/* claim-source: tier prices and inclusions are advisors-pricing.tsx:26-86.
                Verified 2026-08-25. */}
            <p className="text-lg leading-relaxed text-[var(--color-text-secondary)]">{t("agent_landing.price_sub")}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              { name: t("agent_landing.tier_free"), price: "₹0", per: t("agent_landing.per_forever"), desc: t("agent_landing.tier_free_desc"), hi: false },
              { name: t("agent_landing.tier_agent"), price: "₹999", per: t("agent_landing.per_month"), desc: t("agent_landing.tier_agent_desc"), hi: true },
              { name: t("agent_landing.tier_agency"), price: "₹799", per: t("agent_landing.per_seat"), desc: t("agent_landing.tier_agency_desc"), hi: false },
            ].map((tier) => (
              <div
                key={tier.name}
                className={`rounded-xl bg-white p-5 flex flex-col gap-3 ${tier.hi ? "border-t-[3px] border-t-[var(--color-teal-600)]" : ""}`}
                style={{ boxShadow: cardShadow }}
              >
                <span className="text-base font-bold text-[var(--color-navy-900)]">{tier.name}</span>
                <span className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="font-serif text-3xl font-bold tracking-tight text-[var(--color-navy-900)]">{tier.price}</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">{tier.per}</span>
                </span>
                <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{tier.desc}</p>
              </div>
            ))}
          </div>

          <Link href="/advisors/pricing">
            <span className="inline-flex items-center gap-2 text-base font-semibold text-[var(--color-teal-600)] hover:underline cursor-pointer">
              {t("agent_landing.price_link")} <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
      </section>

      {/* ─────────── FINAL CTA ─────────── */}
      <section className="bg-[var(--color-navy-900)] py-16 lg:py-24 px-5 sm:px-10">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-5 text-center">
          <h2 className="font-serif font-bold tracking-[-0.035em] leading-[1.1] text-3xl sm:text-5xl text-white">
            {t("agent_landing.final_heading")}
          </h2>
          <p className="text-lg leading-relaxed text-white/80 max-w-xl">{t("agent_landing.final_sub")}</p>

          <div className="flex flex-col sm:flex-row gap-3 mt-3 w-full sm:w-auto">
            <Link href="/agent/signup/step1" className="w-full sm:w-auto">
              <button className="w-full h-14 px-7 rounded-lg bg-[var(--color-teal-600)] text-white text-lg font-bold hover:bg-[var(--color-teal-400)] transition-colors flex items-center justify-center gap-2">
                {t("agent_landing.cta_start")} <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Link href="/agent/playground" className="w-full sm:w-auto">
              <button className="w-full h-14 px-7 rounded-lg border border-white/25 text-white/90 text-lg font-semibold hover:bg-white/10 hover:text-white transition-colors">
                {t("agent_landing.cta_playground_short")}
              </button>
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-white/15 w-full flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-7 flex-wrap">
            <span className="text-base text-white/60">{t("agent_landing.contact_heading")}</span>
            <a
              href={WA}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 text-base font-semibold text-[var(--color-teal-400)] hover:underline"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp 99871 48125
            </a>
            <a href="tel:+919987148125" className="inline-flex min-h-11 items-center gap-2 text-base font-semibold text-[var(--color-teal-400)] hover:underline">
              <Phone className="w-4 h-4" /> {t("agent_landing.call_contact")}
            </a>
            <button
              onClick={openCalendly}
              className="inline-flex min-h-11 items-center gap-2 text-base font-semibold text-[var(--color-teal-400)] hover:underline"
            >
              <Calendar className="w-4 h-4" /> {t("agent_landing.book_15")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
