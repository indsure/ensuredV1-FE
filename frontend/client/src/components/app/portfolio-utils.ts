// Shared formatting + derivation helpers for the consumer portfolio (/app).
// Kept out of the page component so the page reads as layout, not arithmetic.

export const LOBS = [
  {
    type: "health",
    label: "Health",
    blurb: "Hospital bills are the #1 reason Indian families dip into savings.",
    why: "One hospitalisation can cost more than a year of rent. Health cover is the first policy anyone should own.",
  },
  {
    type: "term",
    label: "Term",
    blurb: "The cheapest way to protect your family's income if you're not around.",
    why: "If anyone depends on your salary, term cover replaces it. It costs the least of any policy you'll ever buy.",
  },
  {
    type: "life",
    label: "Life",
    blurb: "Savings-linked plans — worth checking what you're actually paying for.",
    why: "Endowment and ULIP plans mix insurance with investment. Worth auditing what the returns really are.",
  },
  {
    type: "motor",
    label: "Vehicle",
    blurb: "Mandatory by law — but most people are under-covered on own-damage.",
    why: "Third-party cover is the legal minimum. Own-damage and zero-dep decide what you actually get paid.",
  },
] as const;

export type LobType = (typeof LOBS)[number]["type"];

export const labelFor = (t: string) => LOBS.find((l) => l.type === t)?.label ?? t;
export const lobFor = (t: string) => LOBS.find((l) => l.type === t);

/* ── Score bands ──────────────────────────────────────────────────────── */

export type ScoreBand = "strong" | "ok" | "weak";

export const bandFor = (s: number): ScoreBand => (s >= 75 ? "strong" : s >= 50 ? "ok" : "weak");

// Light palette: teal (strong) / gold (has gaps) / red (needs attention).
export const scoreClasses = (s: number) =>
  ({
    strong: {
      text: "text-[var(--color-teal-600)]",
      tile: "bg-[var(--color-teal-600)]/10 border-[var(--color-teal-600)]/20",
      stroke: "var(--color-teal-600)",
      dot: "bg-[var(--color-teal-600)]",
    },
    ok: {
      text: "text-[var(--color-gold-500)]",
      tile: "bg-[var(--color-gold-500)]/10 border-[var(--color-gold-500)]/20",
      stroke: "var(--color-gold-500)",
      dot: "bg-[var(--color-gold-500)]",
    },
    weak: {
      text: "text-red-600",
      tile: "bg-red-50 border-red-200",
      stroke: "#DC2626",
      dot: "bg-red-500",
    },
  })[bandFor(s)];

export const scoreVerdict = (s: number) =>
  s >= 75 ? "Strong cover" : s >= 50 ? "Decent, has gaps" : "Needs attention";

// Plain-language reading of the number, for people who've never seen a policy score.
export const scoreMeaning = (s: number) =>
  s >= 75
    ? "Your policies would mostly hold up at claim time. Keep them renewed."
    : s >= 50
      ? "You're covered, but a few clauses could cost you at claim time."
      : "There are clauses here that could get a claim reduced or rejected.";

/* ── Dates ────────────────────────────────────────────────────────────── */

// Days until a YYYY-MM-DD date (negative = past). null when unset/unparseable.
export const daysUntil = (d: string | null): number | null => {
  if (!d) return null;
  const t = new Date(d + "T00:00:00").getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
};

export const fmtDate = (d: string | null) => {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return Number.isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export const renewalPhrase = (days: number) =>
  days === 0 ? "renews today" : days === 1 ? "renews tomorrow" : `renews in ${days} days`;

/* ── Money ────────────────────────────────────────────────────────────── */

// sum_insured is a free-text column: the analyzer usually writes a plain number
// (coverage_structure.base_sum_insured), but older rows can carry "₹5,00,000"
// or "10 Lakh". Parse defensively and return rupees, or null when unusable.
export function parseSumInsured(raw: string | null): number | null {
  if (raw == null) return null;
  const s = String(raw).toLowerCase().replace(/,/g, "").trim();
  const num = parseFloat(s.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(num) || num <= 0) return null;
  if (/(crore|\bcr\b)/.test(s)) return num * 1e7;
  if (/(lakh|lac|\bl\b)/.test(s)) return num * 1e5;
  return num;
}

const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));

// Indian short form: ₹1.5 Cr / ₹10 L / ₹50 K.
export function formatINRShort(n: number): string {
  if (n >= 1e7) return `₹${trim(n / 1e7)} Cr`;
  if (n >= 1e5) return `₹${trim(n / 1e5)} L`;
  if (n >= 1e3) return `₹${trim(n / 1e3)} K`;
  return `₹${Math.round(n)}`;
}

/* ── Contact links (Indian mobiles: last 10 digits, +91) ──────────────── */

export const advisorTel = (phone: string | null): string | null => {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length >= 10 ? `tel:+91${d.slice(-10)}` : null;
};

export const advisorWa = (phone: string | null): string | null => {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length >= 10 ? `https://wa.me/91${d.slice(-10)}` : null;
};

/**
 * IndSure's own WhatsApp — the escape hatch when we could not read someone's
 * policy and telling them to try again would just waste their time. Same number
 * the agent-facing pages use; change it here if support ever moves.
 */
export const TEAM_WHATSAPP = "919987148125";

export const teamWaLink = (message: string): string =>
  `https://wa.me/${TEAM_WHATSAPP}?text=${encodeURIComponent(message)}`;
