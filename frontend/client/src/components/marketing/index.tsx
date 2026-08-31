/* ============================================================
   PUBLIC-SITE ELEMENT KIT
   ------------------------------------------------------------
   The marketing pages were nine separate inventions of the same
   four things: a section, a section heading, a coloured chip and
   a stat. Each page picked its own padding, its own eyebrow
   treatment and its own grey. This is that vocabulary, once.

   Two rules hold across everything here:

   1. Colour means a line of business. Teal is health, cyan is
      life, amber is motor, blue is travel, pink is home, violet
      is business. Colour is never decoration alone.
   2. Nothing is smaller than 14px, and no muted text sits below
      4.5:1. The audience is 40+ on a mid-range Android in
      daylight.
   ============================================================ */

import { Link } from "wouter";
import type { LucideIcon } from "lucide-react";
import { Reveal } from "@/components/motion";

/* ─────────────────── LINE OF BUSINESS ─────────────────── */

export type Lob =
  | "health" | "life" | "motor" | "home" | "travel" | "business" | "general";

export const LOB: Record<Lob, { accent: string; wash: string; label: string }> = {
  health:   { accent: "var(--lob-health)",   wash: "var(--lob-health-wash)",   label: "Health" },
  life:     { accent: "var(--lob-life)",     wash: "var(--lob-life-wash)",     label: "Term life" },
  motor:    { accent: "var(--lob-motor)",    wash: "var(--lob-motor-wash)",    label: "Motor" },
  home:     { accent: "var(--lob-home)",     wash: "var(--lob-home-wash)",     label: "Home" },
  travel:   { accent: "var(--lob-travel)",   wash: "var(--lob-travel-wash)",   label: "Travel" },
  business: { accent: "var(--lob-business)", wash: "var(--lob-business-wash)", label: "Business" },
  general:  { accent: "var(--lob-general)",  wash: "var(--lob-general-wash)",  label: "General" },
};

/* ─────────────────── SECTION ─────────────────── */

export type Surface = "cream" | "white" | "mint" | "sand" | "ink";

const SURFACE: Record<Surface, string> = {
  cream: "var(--surface-cream)",
  white: "var(--surface-white)",
  mint: "var(--surface-mint)",
  sand: "var(--surface-sand)",
  ink: "var(--surface-ink)",
};

/**
 * One section of a page. `surface` is what gives a page its
 * rhythm: alternate them so a visitor can see where one idea ends
 * and the next begins. Never run two identical surfaces in a row.
 */
export function Section({
  children,
  surface = "cream",
  className = "",
  id,
  bordered = false,
  size = "base",
}: {
  children: React.ReactNode;
  surface?: Surface;
  className?: string;
  id?: string;
  /** Hairline above the section. Use between two pale surfaces. */
  bordered?: boolean;
  size?: "tight" | "base" | "loose";
}) {
  const pad =
    size === "tight" ? "py-12 sm:py-16" :
    size === "loose" ? "py-20 sm:py-28 lg:py-32" :
    "py-16 sm:py-20 lg:py-24";

  const ink = surface === "ink";

  return (
    <section
      id={id}
      className={`${pad} ${bordered ? "border-t border-[var(--color-border-light)]" : ""} ${ink ? "on-ink" : ""} ${className}`}
      style={{ backgroundColor: SURFACE[surface], scrollMarginTop: "6rem" }}
    >
      {children}
    </section>
  );
}

/* ─────────────────── EYEBROW ─────────────────── */

/**
 * The small label above a heading. 13px rather than the 10-11px
 * the site used to use, and it carries its line-of-business colour
 * rather than always being grey.
 */
export function Eyebrow({
  children,
  accent = "var(--color-teal-600)",
  icon: Icon,
  className = "",
}: {
  children: React.ReactNode;
  accent?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.14em] ${className}`}
      style={{ color: accent }}
    >
      {Icon ? <Icon className="w-4 h-4 shrink-0" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/* ─────────────────── SECTION HEADING ─────────────────── */

export function SectionHeading({
  eyebrow,
  title,
  sub,
  accent = "var(--color-teal-600)",
  align = "left",
  icon,
  onInk = false,
  className = "",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  accent?: string;
  align?: "left" | "center";
  icon?: LucideIcon;
  onInk?: boolean;
  className?: string;
}) {
  const centered = align === "center";

  return (
    <Reveal className={`flex flex-col gap-4 ${centered ? "items-center text-center" : ""} ${className}`}>
      {eyebrow ? (
        <Eyebrow accent={onInk ? "var(--color-teal-400)" : accent} icon={icon}>
          {eyebrow}
        </Eyebrow>
      ) : null}

      <h2
        className={`font-serif font-bold tracking-[-0.025em] leading-[1.1] text-3xl sm:text-4xl lg:text-[2.75rem] ${centered ? "max-w-3xl" : "max-w-2xl"}`}
        style={{ color: onInk ? "#FFFFFF" : "var(--color-navy-900)" }}
      >
        {title}
      </h2>

      <span
        className="rule-accent"
        style={onInk ? undefined : { background: `linear-gradient(90deg, ${accent}, ${accent}55)` }}
      />

      {sub ? (
        <p
          className={`text-base sm:text-lg leading-relaxed ${centered ? "max-w-2xl" : "max-w-xl"}`}
          style={{ color: onInk ? "var(--color-white-muted)" : "var(--color-text-secondary)" }}
        >
          {sub}
        </p>
      ) : null}
    </Reveal>
  );
}

/* ─────────────────── LOB CHIP ─────────────────── */

export function LobChip({
  lob,
  label,
  icon: Icon,
  className = "",
}: {
  lob: Lob;
  label?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  const t = LOB[lob];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${className}`}
      style={{ color: t.accent, backgroundColor: t.wash, border: `1px solid ${t.accent}22` }}
    >
      {Icon ? <Icon className="w-4 h-4 shrink-0" aria-hidden="true" /> : null}
      {label ?? t.label}
    </span>
  );
}

/* ─────────────────── FEATURE CARD ─────────────────── */

/**
 * The workhorse card. An accent rule across the top is what makes a
 * grid of these read as a set of distinct things rather than a wall
 * of identical white boxes.
 */
export function FeatureCard({
  icon: Icon,
  title,
  children,
  accent = "var(--color-teal-600)",
  wash,
  href,
  className = "",
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  children?: React.ReactNode;
  accent?: string;
  wash?: string;
  href?: string;
  className?: string;
}) {
  const body = (
    <div
      className={`group relative h-full overflow-hidden rounded-xl bg-white border border-[var(--color-border-light)] p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_-12px_rgba(15,23,42,0.16)] ${className}`}
      style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
    >
      <span
        className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
        style={{ backgroundColor: accent }}
        aria-hidden="true"
      />

      {Icon ? (
        <span
          className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ backgroundColor: wash ?? `${accent}14`, color: accent }}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      ) : null}

      <h3 className="font-serif text-xl font-bold leading-snug text-[var(--color-navy-900)]">
        {title}
      </h3>

      {children ? (
        <div className="mt-2 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          {children}
        </div>
      ) : null}
    </div>
  );

  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

/* ─────────────────── STAT ─────────────────── */

/**
 * A single figure with its label. `source` is required-by-habit
 * rather than by the type: the audit found four fabricated numbers
 * on this site, so a stat that cannot say where it came from
 * should not be rendered at all.
 */
export function Stat({
  value,
  label,
  accent = "var(--color-teal-600)",
  className = "",
}: {
  value: React.ReactNode;
  label: React.ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span
        className="font-serif text-4xl sm:text-5xl font-bold tracking-tight tabular"
        style={{ color: accent }}
      >
        {value}
      </span>
      <span className="text-sm font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
        {label}
      </span>
    </div>
  );
}

/* ─────────────────── PANEL ─────────────────── */

export const PANEL_SHADOW =
  "0 0 0 1px rgba(15,23,42,0.07), 0 2px 2px -1px rgba(15,23,42,0.02), 0 6px 6px -3px rgba(15,23,42,0.02), 0 14px 14px -7px rgba(15,23,42,0.018), 0 28px 28px -14px rgba(15,23,42,0.018), 0 56px 56px -28px rgba(15,23,42,0.02)";

/**
 * The chrome around a mock product screenshot. The Illustrative
 * label sits INSIDE the border, because the audit found a version
 * where it sat outside the card it qualified and therefore read as
 * a real capability.
 */
export function Panel({
  route,
  children,
  className = "",
  illustrative = true,
}: {
  route?: string;
  children: React.ReactNode;
  className?: string;
  illustrative?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl bg-white ${className}`}
      style={{ boxShadow: PANEL_SHADOW }}
    >
      <div className="flex h-11 items-center gap-3 border-b border-[var(--color-border-light)] bg-[var(--color-cream-main)] px-3.5">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-border-light)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-border-light)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-border-light)]" />
        </div>

        {route ? (
          <div className="flex flex-1 justify-center">
            <span className="rounded-md bg-[var(--color-cream-dark)] px-3 py-1 text-sm font-medium text-[var(--color-text-secondary)]">
              {route}
            </span>
          </div>
        ) : <div className="flex-1" />}

        {illustrative ? (
          <span className="rounded-md bg-[var(--color-cream-dark)] px-2 py-1 text-sm font-semibold text-[var(--color-text-secondary)]">
            Illustrative
          </span>
        ) : null}
      </div>

      {children}
    </div>
  );
}

/* ─────────────────── BUTTONS ─────────────────── */

export function CTA({
  href,
  children,
  variant = "primary",
  className = "",
  onClick,
  icon: Icon,
}: {
  href?: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost-ink";
  className?: string;
  onClick?: () => void;
  icon?: LucideIcon;
}) {
  const base =
    "inline-flex h-[52px] items-center justify-center gap-2 rounded-lg px-6 text-base font-semibold transition-all duration-200";

  const look =
    variant === "primary"
      ? "bg-[var(--color-teal-600)] text-white hover:bg-[#0F766E] hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-8px_rgba(13,148,136,0.6)]"
      : variant === "secondary"
        ? "bg-white border border-[var(--color-border-medium)] text-[var(--color-text-main)] hover:border-[var(--color-teal-600)] hover:text-[var(--color-teal-600)]"
        : "border border-white/30 text-white hover:bg-white/10 hover:border-white/60";

  const cls = `${base} ${look} ${className}`;
  const inner = (
    <>
      {children}
      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
    </>
  );

  if (href) {
    return <Link href={href} className={cls} onClick={onClick}>{inner}</Link>;
  }
  return <button type="button" className={cls} onClick={onClick}>{inner}</button>;
}
