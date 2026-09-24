import { Link } from "wouter";
import { Twitter, Linkedin, Instagram } from "lucide-react";
import { useLanguage, LanguageToggle } from "@/i18n/LanguageContext";

/* Rebuilt 2026-08-25: was ~900px tall, mostly because eight serif links sat in
   one column at 18px with 24px gaps. Same links, four columns, 14px sans.
   Also drops two claims nothing supports — "the only insurance audit engine"
   and "tested on real claim rejections" — and fixes the social links, which
   had no accessible name and opened cross-origin without rel. */

const socialLinks = [
  { name: "LinkedIn", icon: Linkedin, href: "https://www.linkedin.com/company/indsure" },
  { name: "X", icon: Twitter, href: "https://x.com/IndSure_Ind" },
  { name: "Instagram", icon: Instagram, href: "https://www.instagram.com/indsure.in/" },
];

const columns: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "site.f_product",
    links: [
      { label: "site.f_check", href: "/policychecker" },
      { label: "site.f_compare", href: "/compare" },
      { label: "site.f_calc", href: "/calculator" },
      { label: "site.f_clauses", href: "/learn" },
      { label: "site.f_hospital", href: "/find-provider" },
    ],
  },
  {
    heading: "site.f_company",
    links: [
      { label: "site.f_why", href: "/why-indsure" },
      { label: "site.f_pricing", href: "/pricing" },
      { label: "site.f_advisors", href: "/agent" },
      { label: "site.f_docs", href: "/docs" },
      { label: "site.f_blog", href: "/blog" },
      { label: "site.f_team", href: "/team" },
      { label: "site.f_help", href: "/help" },
    ],
  },
  {
    heading: "site.f_legal",
    links: [
      { label: "site.f_privacy", href: "/privacy-policy" },
      { label: "site.f_terms", href: "/terms" },
      { label: "site.f_cookies", href: "/cookie-policy" },
      { label: "site.f_grievance", href: "/grievance" },
    ],
  },
];

export function Footer() {
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[var(--color-navy-900)] text-[var(--color-white)]">
      <div className="container-editorial px-6 py-12 lg:py-14">
        <div className="max-w-6xl mx-auto">

          <div className="grid grid-cols-2 lg:grid-cols-12 gap-y-10 gap-x-8 mb-10">

            {/* Brand */}
            {/* data-nosnippet: Google quoted "IndSure. We do not sell insurance..."
                as the snippet for /calculator because this was the only text
                on the page naming the brand. Same for the disclaimer below. */}
            <div className="col-span-2 lg:col-span-4 pr-4" data-nosnippet>
              <Link href="/">
                <span className="font-serif text-3xl font-bold tracking-tighter inline-flex items-center mb-4 cursor-pointer text-[var(--color-gold-500)] hover:text-white transition-colors">
                  IndSure.
                </span>
              </Link>
              <p className="text-sm leading-relaxed text-[var(--color-white-muted)] max-w-xs mb-5">
                {t("site.f_tagline")}
              </p>
              <div className="mb-5"><LanguageToggle variant="dark" /></div>
              <div className="flex gap-2.5">
                {socialLinks.map((social) => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={social.name}
                      href={social.href}
                      aria-label={social.name}
                      target="_blank" rel="noopener noreferrer"
                      className="w-11 h-11 md:w-9 md:h-9 rounded-full border border-[var(--color-border-subtle)] flex items-center justify-center text-[var(--color-white-muted)] hover:bg-[var(--color-gold-500)] hover:text-[var(--color-navy-900)] hover:border-[var(--color-gold-500)] transition-colors"
                    >
                      <Icon className="w-4 h-4" />
                    </a>
                  );
                })}
              </div>
            </div>

            {columns.map((col) => (
              <div key={col.heading} className="lg:col-span-3 last:lg:col-span-2">
                <h4 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-gold-500)] mb-4">
                  {t(col.heading)}
                </h4>
                <ul className="space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      {/* 19px tall was the real hit area on a phone: the text
                          box and nothing else. On a 375px screen, for the 40+
                          audience this product is built for, that is a link you
                          miss and then mistrust. inline-flex + min-h-11 gives
                          the 44px target the house rules already require,
                          without moving anything on desktop. */}
                      <Link href={l.href} className="inline-flex min-h-11 items-center md:min-h-0">
                        <span className="text-sm text-[var(--color-white-muted)] hover:text-white transition-colors cursor-pointer">
                          {t(l.label)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div data-nosnippet className="pt-6 border-t border-[var(--color-border-subtle)] flex flex-col md:flex-row md:items-end justify-between gap-5 text-sm text-[var(--color-white-muted)]">
            <div className="flex flex-col gap-1">
              <p>© {currentYear} Indsuretech Intelligence Private Limited</p>
              <p className="opacity-60">CIN: U62099MR2026PTC473468</p>
            </div>
            <p className="md:text-right max-w-sm leading-relaxed opacity-80">
              <span className="font-bold text-white">{t("site.f_not_broker")}</span>{" "}
              {t("site.f_no_incentive")}
            </p>
          </div>

        </div>
      </div>
    </footer>
  );
}
