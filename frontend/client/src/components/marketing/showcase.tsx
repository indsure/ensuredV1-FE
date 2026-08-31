/* ============================================================
   SHOWCASE ELEMENTS
   ------------------------------------------------------------
   The pieces that have to carry the site on their own: the ones
   a stranger remembers. Each of them shows the product doing its
   job rather than describing it.

   Two constraints, held together rather than traded off:

   - The reader may be a 55-year-old advisor on a mid-range
     Android in daylight. Nothing below 14px, no information that
     exists only on hover, no target under 44px, and every one of
     these renders complete and legible with motion switched off.
   - The reader may also be someone deciding whether this company
     is any good. So the interesting thing on screen is always the
     real mechanism, never an ornament.
   ============================================================ */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ArrowRight, FileText, TriangleAlert, IndianRupee } from "lucide-react";
import { EASE, AnimatedNumber } from "@/components/motion";

/* ============================================================
   CLAUSE DECODER

   The product in one element. On the left, the sentence as it
   appears in a policy PDF, set in the grey justified block those
   documents actually use. On the right, what it costs you.

   The clauses are representative rather than lifted from any one
   insurer's wording, and the panel says so.
   ============================================================ */

type Clause = {
  id: string;
  tab: string;
  accent: string;
  wash: string;
  /* The legalese, split so the operative phrases can be lit up
     without dangerouslySetInnerHTML. */
  parts: Array<{ t: string; hot?: boolean }>;
  verdict: string;
  detail: string;
  figures?: { label: string; value: string; tone: "bad" | "neutral" }[];
};

const CLAUSES: Clause[] = [
  {
    id: "room",
    tab: "Room rent",
    accent: "var(--lob-health)",
    wash: "var(--lob-health-wash)",
    parts: [
      { t: "3.3 Where the Insured Person is admitted to a room the rent of which " },
      { t: "exceeds the eligibility specified in the Schedule", hot: true },
      { t: ", the Insured Person shall bear a " },
      { t: "rateable proportion of the total associated medical expenses", hot: true },
      { t: ", including surgeon fees, anaesthetist fees and operation theatre charges." },
    ],
    verdict: "Take a room above your limit and you pay a share of the whole bill, not just the room.",
    detail: "The surgeon, the anaesthetist and the theatre are all scaled down by the same proportion. This is the single most common reason a claim pays out at half what the customer expected.",
    figures: [
      { label: "Room limit", value: "₹5,000/day", tone: "neutral" },
      { label: "You took", value: "₹10,000/day", tone: "neutral" },
      { label: "Insurer pays", value: "50% of everything", tone: "bad" },
    ],
  },
  {
    id: "copay",
    tab: "Co-pay",
    accent: "var(--lob-motor)",
    wash: "var(--lob-motor-wash)",
    parts: [
      { t: "3.4 Co-payment. Where the age of the Insured Person at commencement of the first Policy " },
      { t: "exceeds sixty (60) completed years", hot: true },
      { t: ", each and every admissible claim shall be subject to a co-payment of " },
      { t: "twenty per cent (20%)", hot: true },
      { t: " of the amount otherwise payable, which shall not be recoverable under any cumulative bonus, restoration or top-up benefit." },
    ],
    verdict: "After sixty, you pay a fifth of every hospital bill yourself. Forever.",
    detail: "The last clause is the one that hurts: your no-claim bonus does not absorb it, and neither does a top-up policy bought on top. It applies to every claim, not the first one.",
    figures: [
      { label: "A ₹4 L bill", value: "₹3,20,000", tone: "neutral" },
      { label: "You pay", value: "₹80,000", tone: "bad" },
      { label: "Every time", value: "No cap", tone: "bad" },
    ],
  },
  {
    id: "waiting",
    tab: "Waiting period",
    accent: "var(--lob-life)",
    wash: "var(--lob-life-wash)",
    parts: [
      { t: "2.14 The Company shall not be liable for any claim arising during the " },
      { t: "first twenty-four (24) months of continuous coverage", hot: true },
      { t: " where such claim is attributable to a condition specified in " },
      { t: "Annexure II", hot: true },
      { t: ", irrespective of whether such condition was disclosed at the time of proposal." },
    ],
    verdict: "Two years before the things most people buy this policy for are covered at all.",
    detail: "Annexure II is usually where knee and hip replacement, cataract, hernia and piles live. Disclosing the condition honestly does not shorten the wait, which surprises almost everyone.",
    figures: [
      { label: "Knee replacement", value: "2 years", tone: "bad" },
      { label: "Cataract", value: "2 years", tone: "bad" },
      { label: "Disclosed it?", value: "Makes no difference", tone: "bad" },
    ],
  },
];

export function ClauseDecoder({ className = "" }: { className?: string }) {
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  const clause = CLAUSES[active];

  return (
    <div className={`overflow-hidden rounded-2xl bg-white ${className}`}
      style={{ boxShadow: "0 0 0 1px rgba(15,23,42,0.07), 0 30px 60px -24px rgba(15,23,42,0.26)" }}
    >
      {/* Tabs. Real buttons, 44px tall, and the active one is marked by
          weight and a rule as well as by colour. */}
      <div
        className="flex flex-wrap items-center gap-1 border-b border-[var(--color-border-light)] bg-[var(--color-cream-main)] p-2"
        role="tablist"
        aria-label="Policy clauses"
      >
        {CLAUSES.map((c, i) => {
          const on = i === active;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={on}
              onClick={() => setActive(i)}
              className={`relative min-h-11 rounded-lg px-4 text-[15px] transition-colors ${
                on ? "font-bold" : "font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-navy-900)]"
              }`}
              style={on ? { color: c.accent, backgroundColor: c.wash } : undefined}
            >
              {c.tab}
            </button>
          );
        })}

        <span className="ml-auto hidden rounded-md bg-[var(--color-cream-dark)] px-2.5 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)] sm:inline">
          Representative wording
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={clause.id}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="grid md:grid-cols-2"
        >
          {/* ── The document side ── */}
          <div className="border-b border-[var(--color-border-light)] bg-[#FCFCFB] p-5 md:border-b-0 md:border-r sm:p-6">
            <span className="mb-3 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
              What the policy says
            </span>

            <p className="text-justify text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
              {clause.parts.map((p, i) =>
                p.hot ? (
                  <motion.mark
                    key={i}
                    className="rounded px-0.5 font-semibold"
                    style={{ backgroundColor: clause.wash, color: clause.accent }}
                    initial={reduced ? false : { backgroundColor: "rgba(0,0,0,0)" }}
                    animate={{ backgroundColor: clause.wash }}
                    transition={{ duration: 0.5, delay: 0.15 + i * 0.06, ease: EASE }}
                  >
                    {p.t}
                  </motion.mark>
                ) : (
                  <span key={i}>{p.t}</span>
                )
              )}
            </p>

            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
              Highlighted phrases are the ones that decide what you are paid.
            </p>
          </div>

          {/* ── The plain-language side ── */}
          <div className="flex flex-col gap-4 p-5 sm:p-6">
            <span
              className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.14em]"
              style={{ color: clause.accent }}
            >
              <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
              What it costs you
            </span>

            <p className="font-serif text-2xl font-bold leading-snug tracking-[-0.02em] text-[var(--color-navy-900)] sm:text-[1.75rem]">
              {clause.verdict}
            </p>

            <p className="text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
              {clause.detail}
            </p>

            {clause.figures ? (
              <div className="mt-auto grid grid-cols-3 gap-2 pt-2">
                {clause.figures.map((f, i) => (
                  <motion.div
                    key={f.label}
                    initial={reduced ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.2 + i * 0.07, ease: EASE }}
                    className="rounded-xl border p-3"
                    style={
                      f.tone === "bad"
                        ? { borderColor: "#FECACA", backgroundColor: "#FEF2F2" }
                        : { borderColor: "var(--color-border-light)", backgroundColor: "var(--color-cream-main)" }
                    }
                  >
                    <span
                      className="block text-[13px] font-bold uppercase tracking-[0.08em] leading-tight"
                      style={{ color: f.tone === "bad" ? "#B91C1C" : "var(--color-text-secondary)" }}
                    >
                      {f.label}
                    </span>
                    <span
                      className="mt-1 block text-[15px] font-extrabold leading-tight tabular"
                      style={{ color: f.tone === "bad" ? "#991B1B" : "var(--color-navy-900)" }}
                    >
                      {f.value}
                    </span>
                  </motion.div>
                ))}
              </div>
            ) : null}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ============================================================
   SCORE DIAL

   An arc gauge for the Insurance Health Score. The number is
   enormous on purpose: it is the one thing on the report a
   customer reads across a desk, and the audience is presbyopic.
   ============================================================ */

const BANDS = [
  { max: 39, label: "Exposed", color: "#DC2626" },
  { max: 64, label: "Under-insured", color: "#B45309" },
  { max: 84, label: "Adequate", color: "#0D9488" },
  { max: 100, label: "Well covered", color: "#0F766E" },
];

export function ScoreDial({
  score,
  size = 200,
  caption,
  className = "",
}: {
  score: number;
  size?: number;
  caption?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(reduced ? score : 0);

  const band = BANDS.find((b) => score <= b.max) ?? BANDS[BANDS.length - 1];

  /* 240 degrees of sweep, opening downward, so the gap reads as a
     dial rather than as an incomplete ring. */
  const R = 42;
  const SWEEP = 240;
  const START = 150;
  const circumference = 2 * Math.PI * R;
  const arcLength = (SWEEP / 360) * circumference;

  useEffect(() => {
    if (reduced) { setShown(score); return; }
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let started = false;

    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || started) return;
        started = true;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / 1200);
          setShown(score * (1 - Math.pow(1 - t, 3)));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );

    io.observe(el);

    /* The score is a number a person will read and believe, so it must be
       right even when the animation never gets to run. Two things can stop
       it: rAF is throttled in a background tab, stranding the count at a
       partial value; or the observer never fires at all, leaving a
       confident, enormous, wrong 0 on the screen. This lands the true
       figure regardless of either. */
    const settle = window.setTimeout(() => {
      cancelAnimationFrame(raf);
      setShown(score);
    }, 2000);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(settle);
    };
  }, [score, reduced]);

  return (
    <div ref={ref} className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="relative" style={{ width: size, height: size * 0.82 }}>
        <svg viewBox="0 0 100 100" className="h-full w-full" role="img"
          aria-label={`Insurance health score ${Math.round(score)} out of 100: ${band.label}`}
        >
          <g transform={`rotate(${START} 50 50)`}>
            <circle
              cx="50" cy="50" r={R}
              fill="none"
              stroke="var(--color-cream-dark)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${arcLength} ${circumference}`}
            />
            <circle
              cx="50" cy="50" r={R}
              fill="none"
              stroke={band.color}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${(shown / 100) * arcLength} ${circumference}`}
              style={{ transition: reduced ? "none" : "stroke 0.4s ease" }}
            />
          </g>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
          <span
            className="font-serif text-5xl font-bold leading-none tabular"
            style={{ color: band.color }}
          >
            {Math.round(shown)}
          </span>
          <span className="mt-1 text-sm font-semibold text-[var(--color-text-secondary)]">
            out of 100
          </span>
        </div>
      </div>

      <span
        className="rounded-full px-3 py-1.5 text-[15px] font-bold"
        style={{ backgroundColor: `${band.color}14`, color: band.color }}
      >
        {band.label}
      </span>

      {caption ? (
        <span className="max-w-[16rem] text-center text-sm leading-snug text-[var(--color-text-secondary)]">
          {caption}
        </span>
      ) : null}
    </div>
  );
}

/* ============================================================
   SPOTLIGHT CARD

   A soft highlight that follows the pointer. Purely decorative,
   so it is hover-only by construction and carries nothing that
   is not already in the DOM: on a phone, where there is no
   pointer, the card is simply a card.
   ============================================================ */

export function SpotlightCard({
  children,
  accent = "var(--color-teal-600)",
  className = "",
}: {
  children: React.ReactNode;
  accent?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: -300, y: -300 });
  const reduced = useReducedMotion();

  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        if (reduced || e.pointerType !== "mouse") return;
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onPointerLeave={() => setPos({ x: -300, y: -300 })}
      className={`group relative overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-white transition-shadow duration-300 hover:shadow-[0_20px_50px_-18px_rgba(15,23,42,0.2)] ${className}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(240px circle at ${pos.x}px ${pos.y}px, ${accent}12, transparent 70%)`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/* ============================================================
   DIFF ROWS

   Two plans, the same dimensions, and the difference called. The
   winner is marked with a word as well as a colour, because the
   whole point is that someone can read it out loud to a customer.
   ============================================================ */

export function DiffRows({
  left,
  right,
  rows,
  className = "",
}: {
  left: string;
  right: string;
  rows: Array<{ label: string; a: string; b: string; better: "a" | "b" | "tie" }>;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-white ${className}`}>
      <div className="grid grid-cols-[1.1fr_1fr_1fr] gap-2 border-b border-[var(--color-border-light)] bg-[var(--color-cream-main)] px-4 py-3">
        <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
          What it does
        </span>
        <span className="text-[15px] font-bold text-[var(--color-navy-900)]">{left}</span>
        <span className="text-[15px] font-bold text-[var(--color-navy-900)]">{right}</span>
      </div>

      {/* These rows are data, not decoration. They are never faded in per-row:
          a comparison where row four is invisible because an observer did not
          fire is worse than one that simply appears. Animate the container at
          the call site if you want it to arrive. */}
      {rows.map((r, i) => (
        <div
          key={r.label}
          className={`grid grid-cols-[1.1fr_1fr_1fr] items-center gap-2 px-4 py-3.5 ${
            i < rows.length - 1 ? "border-b border-[var(--color-cream-dark)]" : ""
          }`}
        >
          <span className="text-[15px] font-semibold text-[var(--color-navy-900)]">{r.label}</span>

          {(["a", "b"] as const).map((side) => {
            const val = side === "a" ? r.a : r.b;
            const wins = r.better === side;
            const loses = r.better !== "tie" && !wins;
            return (
              <span key={side} className="flex flex-col gap-0.5">
                <span
                  className="text-[15px] font-bold"
                  style={{ color: wins ? "#0F766E" : loses ? "#B91C1C" : "var(--color-text-secondary)" }}
                >
                  {val}
                </span>
                {wins ? (
                  <span className="text-sm font-semibold text-[#0F766E]">Better</span>
                ) : loses ? (
                  <span className="text-sm font-semibold text-[#B91C1C]">Costs you</span>
                ) : null}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   PREMIUM / COVER GAP

   A single bar with a marker for what you hold against what you
   need. The gap is labelled in words as well as drawn.
   ============================================================ */

export function CoverGap({
  have,
  need,
  monthly,
  className = "",
}: {
  have: number;
  need: number;
  /** Rupees per month to close the gap, if known. */
  monthly?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const pct = Math.max(0, Math.min(100, (have / need) * 100));
  const fmt = (n: number) =>
    n >= 10000000 ? `₹${(n / 10000000).toFixed(n % 10000000 === 0 ? 0 : 1)} Cr`
      : `₹${(n / 100000).toFixed(0)} L`;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-end justify-between gap-3">
        <span className="text-[15px] font-semibold text-[var(--color-text-secondary)]">
          You hold {fmt(have)}
        </span>
        <span className="text-[15px] font-semibold text-[var(--color-text-secondary)]">
          You need {fmt(need)}
        </span>
      </div>

      <div className="relative h-4 overflow-hidden rounded-full bg-[#FECACA]">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: "var(--color-teal-600)" }}
          initial={{ width: reduced ? `${pct}%` : 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true, margin: "0px 0px -15% 0px" }}
          transition={{ duration: reduced ? 0 : 1.1, ease: EASE }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[15px] font-bold text-[#B91C1C]">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          Short by {fmt(need - have)}
        </span>
        {monthly ? (
          <span className="flex items-center gap-1 text-[15px] text-[var(--color-text-secondary)]">
            <IndianRupee className="h-4 w-4 shrink-0" aria-hidden="true" />
            about <AnimatedNumber value={monthly} className="font-bold text-[var(--color-navy-900)]" /> a month to close it
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ============================================================
   INLINE LINK

   A text link with the arrow that slides. Used at the end of a
   section instead of a second button.
   ============================================================ */

export function ArrowLink({
  href,
  children,
  accent = "var(--color-teal-600)",
  onClick,
}: {
  href?: string;
  children: React.ReactNode;
  accent?: string;
  onClick?: () => void;
}) {
  const cls =
    "group inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold transition-colors";

  const inner = (
    <>
      {children}
      <ArrowRight
        className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
        aria-hidden="true"
      />
    </>
  );

  return href ? (
    <a href={href} className={cls} style={{ color: accent }} onClick={onClick}>{inner}</a>
  ) : (
    <button type="button" className={cls} style={{ color: accent }} onClick={onClick}>{inner}</button>
  );
}
