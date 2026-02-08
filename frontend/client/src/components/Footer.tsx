import { Link } from "wouter";
import {
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
  Youtube,
  Mail,
} from "lucide-react";
import { IndSureLogo } from "@/components/IndSureLogo";

export function Footer() {
  const currentYear = new Date().getFullYear();

  const socialLinks = [
    { name: "LinkedIn", icon: Linkedin, href: "#" },
    { name: "Twitter", icon: Twitter, href: "#" },
    { name: "Instagram", icon: Instagram, href: "#" },
  ];

  return (
    <footer className="border-t border-[var(--color-navy-900)] bg-[var(--color-navy-900)] text-[var(--color-white)]">
      <div className="container-editorial py-24">

        {/* Constrain width further to standard 'editorial' limits (max-w-6xl) to fix "floating islands" */}
        <div className="max-w-6xl">

          {/* Reduce horizontal gap from 24 to 12/16 to tighten the system */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-12 gap-x-8 lg:gap-x-12 mb-20 items-start">

            {/* COL 1: Brand (4 cols) */}
            <div className="lg:col-span-4 pr-4">
              <Link href="/">
                <IndSureLogo
                  className="h-20 w-auto mb-6 -ml-4 cursor-pointer opacity-90 hover:opacity-100 transition-opacity text-white"
                  aria-label="IndSure"
                />
              </Link>
              <p className="text-lg text-[var(--color-white-muted)] leading-relaxed font-light mb-6">
                We replace confusion with forensic intelligence.
                <br />
                The only insurance audit engine engineered for the modern Indian policyholder.
              </p>
              <div className="flex gap-4">
                {socialLinks.map((social) => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={social.name}
                      href={social.href}
                      className="w-10 h-10 rounded-full border border-[var(--color-border-subtle)] flex items-center justify-center text-[var(--color-white-muted)] hover:bg-[var(--color-gold-500)] hover:text-[var(--color-navy-900)] hover:border-[var(--color-gold-500)] transition-all"
                    >
                      <Icon className="w-5 h-5" />
                    </a>
                  );
                })}
              </div>
            </div>

            {/* COL 2: Trust Block (3 cols) - Aligned */}
            <div className="lg:col-span-3">
              <h4 className="font-mono text-xs uppercase tracking-widest text-[var(--color-gold-500)] mb-6 mt-2">Why IndSure Exists</h4>
              <ul className="space-y-4 text-sm text-[var(--color-white-muted)]">
                <li className="flex gap-3 items-start">
                  <span className="text-[var(--color-gold-500)] font-bold">✓</span> <span>We do not sell insurance.</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="text-[var(--color-gold-500)] font-bold">✓</span> <span>We earn zero commissions.</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="text-[var(--color-gold-500)] font-bold">✓</span> <span>We audit objectively.</span>
                </li>
              </ul>
            </div>

            {/* COL 3: Actions (3 cols) */}
            <div className="lg:col-span-3 pl-2">
              <h4 className="font-mono text-xs uppercase tracking-widest text-[var(--color-gold-500)] mb-6 mt-2">Start Here</h4>
              <ul className="space-y-6">
                <li>
                  <Link href="/policychecker">
                    <div className="group cursor-pointer">
                      <span className="font-serif text-lg text-[var(--color-white)] group/start-audit group-hover:text-[var(--color-gold-500)] transition-colors flex items-center gap-2">
                        Start an Audit <span className="text-[var(--color-gold-500)] group-hover/start-audit:scale-x-150 transition-transform group-hover/start-audit:translate-x-1">→</span>
                      </span>
                      <p className="text-sm text-[var(--color-white-muted)] mt-1 group-hover:text-white transition-colors">
                        Upload your policy. Takes ~2 minutes.
                      </p>
                    </div>
                  </Link>
                </li>
                <li>
                  <Link href="/compare">
                    <span className="font-serif text-lg text-[var(--color-white-muted)] hover:text-white cursor-pointer transition-colors block">
                      Compare Plans
                    </span>
                  </Link>
                </li>
                <li>
                  <Link href="/why-indsure">
                    <span className="font-serif text-lg text-[var(--color-white-muted)] hover:text-white cursor-pointer transition-colors block">
                      Our Philosophy
                    </span>
                  </Link>
                </li>
              </ul>
            </div>

            {/* COL 4: Legal Links (2 cols) - Recessed */}
            <div className="lg:col-span-2">
              <h4 className="font-mono text-xs uppercase tracking-widest text-[var(--color-gold-500)] mb-6 mt-2">Legal</h4>
              <ul className="space-y-4 font-normal text-sm">
                <li><a href="#" className="text-[var(--color-gold-500)] hover:text-white transition-colors">Privacy Protocol</a></li>
                <li><a href="#" className="text-[var(--color-gold-500)] hover:text-white transition-colors">Service Terms</a></li>
                <li><a href="#" className="text-[var(--color-gold-500)] hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>

          </div>

          {/* Bottom Bar - Constrained Width to bring text blocks inward */}
          <div className="pt-8 border-t border-[var(--color-border-subtle)] flex flex-col md:flex-row justify-between items-end gap-6 text-xs font-mono uppercase tracking-widest w-full mx-auto text-[var(--color-white-muted)]">
            <div className="flex flex-col gap-2">
              <p>© {currentYear}</p>
              <p className="normal-case tracking-normal opacity-70">Built for Indian policy documents. Tested on real claim rejections.</p>
            </div>
            <p className="text-right max-w-xs leading-relaxed normal-case tracking-normal opacity-70">
              <span className="font-bold text-white">Independent Forensic Analysis.</span><br />
              We are not an IRDAI-registered broker or agent, which means we have no incentive to recommend or sell policies.
            </p>
          </div>

        </div>
      </div>
    </footer>
  );
}
