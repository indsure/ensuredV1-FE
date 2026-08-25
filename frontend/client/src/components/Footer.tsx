import { Link } from "wouter";
import { Twitter, Linkedin, Instagram } from "lucide-react";

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
    heading: "Product",
    links: [
      { label: "Check a policy", href: "/policychecker" },
      { label: "Compare plans", href: "/compare" },
      { label: "Cover Calculator", href: "/calculator" },
      { label: "Clause library", href: "/learn" },
      { label: "Find a network hospital", href: "/find-provider" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Why IndSure", href: "/why-indsure" },
      { label: "Pricing", href: "/pricing" },
      { label: "For advisors", href: "/agent" },
      { label: "Blog", href: "/blog" },
      { label: "Meet the team", href: "/team" },
      { label: "Help & support", href: "/help" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Cookie Policy", href: "/cookie-policy" },
      { label: "Grievance Officer", href: "/grievance" },
    ],
  },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[var(--color-navy-900)] text-[var(--color-white)]">
      <div className="container-editorial px-6 py-12 lg:py-14">
        <div className="max-w-6xl mx-auto">

          <div className="grid grid-cols-2 lg:grid-cols-12 gap-y-10 gap-x-8 mb-10">

            {/* Brand */}
            <div className="col-span-2 lg:col-span-4 pr-4">
              <Link href="/">
                <img
                  src="/logo.png"
                  alt="IndSure"
                  className="h-8 w-auto mb-4 cursor-pointer hover:opacity-80 transition-opacity"
                />
              </Link>
              <p className="text-sm leading-relaxed text-[var(--color-white-muted)] max-w-xs mb-5">
                We do not sell insurance and we earn zero commissions, so the report you get is the
                one the policy deserves.
              </p>
              <div className="flex gap-2.5">
                {socialLinks.map((social) => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={social.name}
                      href={social.href}
                      aria-label={social.name}
                      target="_blank" rel="noopener noreferrer"
                      className="w-9 h-9 rounded-full border border-[var(--color-border-subtle)] flex items-center justify-center text-[var(--color-white-muted)] hover:bg-[var(--color-gold-500)] hover:text-[var(--color-navy-900)] hover:border-[var(--color-gold-500)] transition-colors"
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
                  {col.heading}
                </h4>
                <ul className="space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href}>
                        <span className="text-sm text-[var(--color-white-muted)] hover:text-white transition-colors cursor-pointer">
                          {l.label}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="pt-6 border-t border-[var(--color-border-subtle)] flex flex-col md:flex-row md:items-end justify-between gap-5 text-sm text-[var(--color-white-muted)]">
            <div className="flex flex-col gap-1">
              <p>© {currentYear} Indsuretech Intelligence Private Limited</p>
              <p className="opacity-60">CIN: U62099MR2026PTC473468</p>
            </div>
            <p className="md:text-right max-w-sm leading-relaxed opacity-80">
              <span className="font-bold text-white">Not an IRDAI-registered broker or agent.</span>{" "}
              We have no incentive to recommend or sell any policy.
            </p>
          </div>

        </div>
      </div>
    </footer>
  );
}
