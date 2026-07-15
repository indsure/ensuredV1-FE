import type { ReactNode } from "react";
import { Link } from "wouter";
import { Lock, ShieldCheck, Clock, Scale } from "lucide-react";

/**
 * Shared shell for the consumer auth pages (/signup, /login).
 *
 * Mobile-first (this is where Instagram traffic lands): a dark brand hero at the
 * top, with the form card floating up over it — the "premium app" overlap.
 * On desktop it becomes a classic split screen: dark brand panel left, form right.
 */

const TRUST_PILLS = [
  { icon: Lock, label: "No spam, ever" },
  { icon: Scale, label: "₹0 commission" },
  { icon: Clock, label: "~60-sec audit" },
];

const BENEFITS = [
  "Unbiased audit — we earn ₹0 commission, so we have no reason to sell you anything.",
  "50+ risk checks per policy — room-rent caps, waiting periods, silent exclusions.",
  "Private by default — no agent ever sees your policy.",
];

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-cream-main)] lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ─── BRAND PANEL (dark) ─── */}
      <div className="relative overflow-hidden bg-[var(--color-navy-900)] text-white px-6 pt-8 pb-28 lg:pb-12 lg:px-14 xl:px-20 lg:flex lg:flex-col lg:justify-between">
        {/* soft gradient blobs — depth, not decoration-for-its-own-sake */}
        <div className="pointer-events-none absolute -top-24 -right-16 w-80 h-80 rounded-full bg-[var(--color-teal-600)]/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 -left-20 w-72 h-72 rounded-full bg-[var(--color-teal-400)]/10 blur-3xl" />

        <div className="relative z-10">
          <Link href="/">
            <img
              src="/logo-white.png"
              alt="IndSure"
              className="h-9 lg:h-10 w-auto object-contain cursor-pointer"
            />
          </Link>

          <div className="mt-10 lg:mt-16 max-w-lg">
            <span className="inline-block py-1 px-3 rounded-full border border-white/15 bg-white/5 text-[11px] font-mono uppercase tracking-widest text-[var(--color-teal-400)]">
              {eyebrow}
            </span>

            {/* text-white is explicit: a global h1 rule sets a dark color and would
                otherwise beat the inherited text-white from the panel. */}
            <h1 className="mt-5 text-4xl lg:text-5xl xl:text-6xl font-serif font-bold leading-[1.08] text-white">
              {title}
            </h1>

            <p className="mt-4 text-base lg:text-lg text-[var(--color-white-muted)] font-light leading-relaxed max-w-md">
              {subtitle}
            </p>

            {/* trust pills — visible on every screen size */}
            <div className="mt-6 flex flex-wrap gap-2">
              {TRUST_PILLS.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/85"
                >
                  <Icon className="w-3.5 h-3.5 text-[var(--color-teal-400)]" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* benefits — desktop only, keeps mobile short and thumb-friendly */}
          <ul className="hidden lg:block mt-12 space-y-4 max-w-md">
            {BENEFITS.map((b) => (
              <li key={b} className="flex gap-3 text-sm text-[var(--color-white-muted)] leading-relaxed">
                <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-teal-400)]" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* The promise. This is the brand — it stays on screen. */}
        <div className="relative z-10 hidden lg:flex items-start gap-2.5 mt-12 text-sm text-white/60">
          <Lock className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-teal-400)]" />
          <span>We will never call you, message you, or sell your data. Ever.</span>
        </div>
      </div>

      {/* ─── FORM PANEL ─── */}
      {/* Mobile: card floats up over the dark hero. Desktop: centered in right column. */}
      <div className="relative z-10 px-4 -mt-20 lg:mt-0 lg:px-14 xl:px-20 pb-12 lg:pb-0 lg:flex lg:items-center">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-[var(--color-border-light)] bg-white p-6 sm:p-8 shadow-2xl shadow-black/10 lg:shadow-xl">
          {children}

          {/* promise repeated at the moment of hesitation (mobile especially) */}
          <div className="lg:hidden mt-6 flex items-start gap-2 text-xs text-[var(--color-text-muted)] leading-relaxed">
            <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--color-teal-600)]" />
            <span>We will never call you, message you, or sell your data. Ever.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
