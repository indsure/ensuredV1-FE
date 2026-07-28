/**
 * Typographic + illustrated editorial cover for blog cards and article heroes.
 *
 * Honest and deterministic: a category-tinted canvas, a large line-art category
 * icon, a mono eyebrow, and the article title set in the site serif. No fake
 * metrics, no stock photos — but enough visual identity to read as a real
 * thumbnail rather than a blank panel.
 */

import {
  HeartPulse, ShieldCheck, Car, Home, Plane, Briefcase, BookOpen,
  GraduationCap, Lightbulb, type LucideIcon,
} from "lucide-react";

const CATEGORY_TINTS: Record<string, { accent: string; wash: string }> = {
  "Health Insurance":   { accent: "#0D9488", wash: "rgba(13,148,136,0.08)" },
  "Life Insurance":     { accent: "#0E7490", wash: "rgba(14,116,144,0.08)" },
  "Vehicle Insurance":  { accent: "#B45309", wash: "rgba(180,83,9,0.08)" },
  "Home Insurance":     { accent: "#9D174D", wash: "rgba(157,23,77,0.07)" },
  "Travel Insurance":   { accent: "#1D4ED8", wash: "rgba(29,78,216,0.07)" },
  "Business Insurance": { accent: "#6D28D9", wash: "rgba(109,40,217,0.07)" },
  "General":            { accent: "#334155", wash: "rgba(51,65,85,0.07)" },
  Education:            { accent: "#0D9488", wash: "rgba(13,148,136,0.08)" },
  Tips:                 { accent: "#B45309", wash: "rgba(180,83,9,0.08)" },
  Guide:                { accent: "#0E7490", wash: "rgba(14,116,144,0.08)" },
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Health Insurance":   HeartPulse,
  "Life Insurance":     ShieldCheck,
  "Vehicle Insurance":  Car,
  "Home Insurance":     Home,
  "Travel Insurance":   Plane,
  "Business Insurance": Briefcase,
  "General":            BookOpen,
  Education:            GraduationCap,
  Tips:                 Lightbulb,
  Guide:                BookOpen,
};

export function BlogCover({
  title,
  category,
  hero = false,
  className = "",
}: {
  title: string;
  category: string;
  /** hero = full-width article banner; default = card thumbnail */
  hero?: boolean;
  className?: string;
}) {
  const tint = CATEGORY_TINTS[category] ?? CATEGORY_TINTS.General;
  const Icon = CATEGORY_ICONS[category] ?? BookOpen;
  // Keep the display line short — covers are a graphic, not a repeat of the
  // card title below them. Cut at the first ":" and cap the word count.
  const display = title.split(":")[0].split(" ").slice(0, hero ? 10 : 6).join(" ");

  return (
    <div
      className={`relative h-full w-full overflow-hidden flex flex-col justify-between ${hero ? "p-8 md:p-12" : "p-5"} ${className}`}
      style={{
        background: `linear-gradient(135deg, var(--color-cream-dark) 0%, #FFFFFF 60%, ${tint.wash} 100%)`,
      }}
      aria-hidden="true"
    >
      {/* fine grid texture */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(11,17,32,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(11,17,32,0.045) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* accent rule */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: tint.accent }} />

      {/* Category illustration — large line-art icon, upper-right */}
      <Icon
        className="absolute pointer-events-none"
        strokeWidth={1.25}
        style={{
          color: tint.accent,
          opacity: 0.9,
          width: hero ? 128 : 76,
          height: hero ? 128 : 76,
          right: hero ? "8%" : "1.25rem",
          top: hero ? "16%" : "1rem",
        }}
      />

      <span
        className={`relative font-mono uppercase tracking-[0.2em] ${hero ? "text-xs" : "text-[10px]"} font-bold`}
        style={{ color: tint.accent }}
      >
        {category}
      </span>

      <span
        className={`relative font-serif font-bold leading-[1.08] text-[var(--color-navy-900)] ${
          hero ? "text-3xl md:text-5xl max-w-3xl" : "text-xl line-clamp-3 max-w-[75%]"
        }`}
      >
        {display}
        <span style={{ color: tint.accent }}>.</span>
      </span>
    </div>
  );
}
