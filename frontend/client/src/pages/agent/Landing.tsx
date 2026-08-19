import { Link } from "wouter";
import {
  Shield,
  IndianRupee,
  MessageCircle,
  FileText,
  Users,
  TrendingUp,
  CheckCircle2,
  Phone,
  Calendar,
  Sparkles
} from "lucide-react";
import { useEffect } from "react";
import { useLanguage, LanguageToggle } from "@/i18n/LanguageContext";

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
      // Fallback if the Calendly widget script hasn't loaded — open in a new tab.
      window.open(url, "_blank", "noopener,noreferrer");
    }
    return false;
  };

  const topFeatures = [
    {
      icon: Shield,
      title: t("agent_landing.feature_irdai_title"),
      description: t("agent_landing.feature_irdai_desc"),
    },
    {
      icon: IndianRupee,
      title: t("agent_landing.feature_commission_title"),
      description: t("agent_landing.feature_commission_desc"),
    },
    {
      icon: MessageCircle,
      title: t("agent_landing.feature_whatsapp_title"),
      description: t("agent_landing.feature_whatsapp_desc"),
    },
  ];

  const additionalFeatures = [
    {
      icon: FileText,
      title: t("agent_landing.feature_multiinsurer_title"),
      description: t("agent_landing.feature_multiinsurer_desc"),
    },
    {
      icon: Users,
      title: t("agent_landing.feature_crm_title"),
      description: t("agent_landing.feature_crm_desc"),
    },
    {
      icon: TrendingUp,
      title: t("agent_landing.feature_analytics_title"),
      description: t("agent_landing.feature_analytics_desc"),
    },
  ];

  const testimonials = [
    {
      name: "Rajesh Kumar",
      city: "Indore, MP",
      photo: "👨‍💼",
      quote: t("agent_landing.testimonial_1_quote"),
      policies: "47 policies/month",
    },
    {
      name: "Priya Sharma",
      city: "Pune, Maharashtra",
      photo: "👩‍💼",
      quote: t("agent_landing.testimonial_2_quote"),
      policies: "₹12L commission tracked",
    },
    {
      name: "Amit Patel",
      city: "Ahmedabad, Gujarat",
      photo: "👨‍💼",
      quote: t("agent_landing.testimonial_3_quote"),
      policies: "320+ active clients",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Top bar — Logo (left) + Pricing, Playground, Log in, Language (right).
          Pricing and Log in were missing entirely: pricing was unreachable from
          this page, and logging in meant scrolling to the hero. On a phone the
          Playground label collapses to its icon so the row still fits 375px. */}
      <nav className="flex justify-between items-center gap-2 px-4 sm:px-6 pt-4" aria-label="Advisor">
        <Link href="/agent" className="flex items-center gap-2 shrink-0">
          <img src="/logo.png" alt="IndSure" className="h-9 w-auto object-contain" />
          <span className="hidden sm:inline font-bold text-lg text-slate-900">IndSure</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/advisors/pricing"
          className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-[var(--color-green-primary)] transition-colors whitespace-nowrap"
        >
          Pricing
        </Link>
        <Link
          href="/agent/playground"
          className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold text-[var(--color-green-primary)] border border-[var(--color-green-primary)]/40 rounded-lg hover:bg-[var(--color-green-primary)] hover:text-white transition-all"
          title="डेमो आज़माएँ — कोई अकाउंट नहीं"
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Playground</span>
        </Link>
        <Link
          href="/agent/login"
          className="px-2.5 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold text-white bg-[var(--color-green-primary)] rounded-lg hover:bg-[#0F766E] transition-colors whitespace-nowrap"
        >
          Log in
        </Link>
        <LanguageToggle />
        </div>
      </nav>

      {/* Hero Section */}
      <div className="mx-auto max-w-7xl px-6 py-8 lg:py-16">
        <div className="text-center">
          <div className="mb-3 inline-block rounded-full bg-[var(--color-green-primary)]/10 px-4 py-1.5 text-sm font-medium text-[var(--color-green-primary)]">
            {t("agent_landing.badge")}
          </div>
          <h1 className="mb-5 text-4xl font-bold tracking-tight text-slate-900 lg:text-5xl" style={{ letterSpacing: "-0.02em" }}>
            {t("agent_landing.hero_title")}
            <span className="block text-[var(--color-green-primary)]">{t("agent_landing.hero_title_highlight")}</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-slate-600">
            {t("agent_landing.hero_subtitle")}
          </p>

          <div className="flex flex-col items-center justify-center gap-4">
            <Link href="/agent/login">
              <button className="w-full sm:w-auto px-10 py-4 text-lg font-semibold bg-[var(--color-green-primary)] text-white rounded-xl hover:bg-[var(--color-teal-400)] transition-all shadow-lg shadow-teal-900/20 hover:shadow-xl">
                {t("agent_landing.login_btn")}
              </button>
            </Link>

            <div className="flex flex-col items-center gap-3">
              <Link href="/agent/signup/step1">
                <p className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                  {t("agent_landing.signup_link")}{" "}
                  <span className="font-bold text-slate-900">{t("agent_landing.signup_link_action")}</span>
                </p>
              </Link>

              <div className="flex items-center gap-3 w-full max-w-xs">
                <div className="flex-1 h-px bg-slate-200"></div>
                <span className="text-xs text-slate-400 uppercase tracking-wider">{t("agent_landing.or")}</span>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>

              <button
                onClick={openCalendly}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-2 border-[var(--color-green-primary)] text-[var(--color-green-primary)] rounded-full hover:bg-[var(--color-green-primary)] hover:text-white transition-all"
              >
                <Calendar className="h-4 w-4" />
                {t("agent_landing.demo_btn")}
              </button>
            </div>
          </div>

          {/* Trust Strip */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[var(--color-green-primary)]" />
              <span className="font-medium">{t("agent_landing.trust_irdai")}</span>
            </div>
            <div className="hidden sm:block h-4 w-px bg-slate-300"></div>
            <div className="flex items-center gap-2">
              <span dangerouslySetInnerHTML={{ __html: `🇮🇳 ${t("agent_landing.trust_cities")}` }} />
            </div>
            <div className="hidden sm:block h-4 w-px bg-slate-300"></div>
            <div className="flex items-center gap-2">
              <span>{t("agent_landing.trust_security")}</span>
            </div>
          </div>

          {/* Insurer Logos */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-4">
              {t("agent_landing.integrates_label")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 text-slate-400 text-sm font-medium">
              <span>LIC</span>
              <span>HDFC Life</span>
              <span>SBI Life</span>
              <span>ICICI Prudential</span>
              <span>Max Life</span>
              <span>+15 more</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-10 text-center">
          <h2 className="mb-3 text-3xl font-bold text-slate-900">{t("agent_landing.features_heading")}</h2>
          <p className="text-lg text-slate-600">{t("agent_landing.features_subheading")}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          {topFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="rounded-xl border-2 border-[var(--color-green-primary)]/20 bg-white p-8 transition-all hover:shadow-xl hover:border-[var(--color-green-primary)]/50 hover:-translate-y-1">
                <div className="mb-4 inline-flex rounded-lg bg-[var(--color-green-primary)]/10 p-4">
                  <Icon className="h-7 w-7 text-[var(--color-green-primary)]" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-slate-900">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {additionalFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="rounded-lg border border-slate-200 bg-white p-5 transition-all hover:shadow-md hover:border-slate-300">
                <div className="mb-3 inline-flex rounded-lg bg-slate-100 p-2.5">
                  <Icon className="h-5 w-5 text-slate-600" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-slate-900">{feature.title}</h3>
                <p className="text-sm text-slate-600">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mid CTA Band */}
      <div className="bg-gradient-to-r from-[var(--color-green-primary)]/5 via-[var(--color-green-primary)]/10 to-[var(--color-green-primary)]/5 py-12">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="mb-3 text-2xl font-bold text-slate-900">{t("agent_landing.mid_cta_heading")}</h2>
          <p className="mb-8 text-lg text-slate-600">{t("agent_landing.mid_cta_subheading")}</p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={openCalendly}
              className="w-full sm:w-auto px-8 py-4 text-lg font-semibold bg-[var(--color-green-primary)] text-white rounded-xl hover:bg-[var(--color-teal-400)] transition-all shadow-lg shadow-teal-900/20 hover:shadow-xl flex items-center justify-center gap-2"
            >
              <Calendar className="h-5 w-5" />
              {t("agent_landing.book_demo_btn")}
            </button>
            <a href="https://wa.me/919987148125?text=Hi%2C%20I%27d%20like%20to%20know%20more%20about%20IndSure%20and%20joining%20as%20an%20agent" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <button className="w-full px-8 py-4 text-lg font-semibold bg-[#25D366] text-white rounded-xl hover:bg-[#20BA5A] transition-colors shadow-lg flex items-center justify-center gap-2">
                <MessageCircle className="h-5 w-5" />
                {t("agent_landing.whatsapp_btn")}
              </button>
            </a>
          </div>
        </div>
      </div>

      {/* Testimonials */}
      <div className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-3xl font-bold text-slate-900">{t("agent_landing.testimonials_heading")}</h2>
            <p className="text-lg text-slate-600">{t("agent_landing.testimonials_subheading")}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-start gap-3">
                  <div className="text-4xl">{testimonial.photo}</div>
                  <div>
                    <h4 className="font-semibold text-slate-900">{testimonial.name}</h4>
                    <p className="text-sm text-slate-500">{testimonial.city}</p>
                    <p className="mt-1 text-xs font-medium text-[var(--color-green-primary)]">{testimonial.policies}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed italic">"{testimonial.quote}"</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="mx-auto max-w-5xl px-6 py-16 text-center">
        <h2 className="mb-3 text-3xl font-bold text-slate-900">{t("agent_landing.final_cta_heading")}</h2>
        <p className="mb-10 text-lg text-slate-600">{t("agent_landing.final_cta_subheading")}</p>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <div className="flex flex-col items-center">
            <Link href="/agent/login" className="w-full">
              <button className="w-full px-6 py-4 text-lg font-semibold bg-[var(--color-green-primary)] text-white rounded-xl hover:bg-[var(--color-teal-400)] transition-all shadow-lg shadow-teal-900/20 hover:shadow-xl">
                {t("agent_landing.login_btn")}
              </button>
            </Link>
            <p className="mt-3 text-sm text-slate-500">{t("agent_landing.login_option_label")}</p>
          </div>

          <div className="flex flex-col items-center">
            <Link href="/agent/signup/step1" className="w-full">
              <button className="w-full px-6 py-4 text-lg font-semibold border-2 border-[var(--color-green-primary)] text-[var(--color-green-primary)] rounded-xl hover:bg-[var(--color-green-primary)] hover:text-white transition-all">
                {t("agent_landing.signup_option_btn")}
              </button>
            </Link>
            <p className="mt-3 text-sm text-slate-500">{t("agent_landing.signup_option_label")}</p>
          </div>

          <div className="flex flex-col items-center">
            <button
              onClick={openCalendly}
              className="w-full px-6 py-4 text-lg font-semibold border-2 border-slate-300 text-slate-700 rounded-xl hover:border-[var(--color-green-primary)] hover:text-[var(--color-green-primary)] transition-all flex items-center justify-center gap-2"
            >
              <Calendar className="h-5 w-5" />
              {t("agent_landing.book_option_btn")}
            </button>
            <p className="mt-3 text-sm text-slate-500">{t("agent_landing.book_option_label")}</p>
          </div>
        </div>

        <p className="text-sm text-slate-500 mb-6">{t("agent_landing.free_trial_note")}</p>

        <div className="pt-6 border-t border-slate-200">
          <p className="text-sm text-slate-600 mb-3">{t("agent_landing.contact_heading")}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://wa.me/919987148125?text=Hi%2C%20I%27d%20like%20to%20know%20more%20about%20IndSure%20and%20joining%20as%20an%20agent"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[#25D366] font-semibold hover:underline"
            >
              <MessageCircle className="h-4 w-4" />
              {t("agent_landing.whatsapp_contact")}
            </a>
            <span className="hidden sm:inline text-slate-300">|</span>
            <a href="tel:+919987148125" className="inline-flex items-center gap-2 text-[var(--color-green-primary)] font-semibold hover:underline">
              <Phone className="h-4 w-4" />
              {t("agent_landing.call_contact")}
            </a>
          </div>
          <p className="mt-3 text-xs text-slate-500">{t("agent_landing.demo_note")}</p>
        </div>
      </div>
    </div>
  );
}
