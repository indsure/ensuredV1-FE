import { useEffect, useRef, useState } from "react";

/**
 * Animated score dial for the portfolio hero.
 *
 * The arc sweeps and the number counts up on mount (and whenever the score
 * changes), which gives the page its one moment of "this was calculated for
 * you". Honours prefers-reduced-motion by snapping straight to the value.
 */
export function ScoreRing({
  score,
  size = 168,
  stroke = 12,
  color,
  track = "rgba(255,255,255,0.14)",
  label,
}: {
  score: number;
  size?: number;
  stroke?: number;
  color: string;
  track?: string;
  label?: string;
}) {
  const [shown, setShown] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(score);
      return;
    }
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic — fast then settles, so the number lands rather than stops.
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(score * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [score]);

  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  // Leave the bottom quarter open so the dial reads as a gauge, not a pie.
  const sweep = 0.75;
  const arc = circumference * sweep;
  const filled = arc * (Math.min(100, Math.max(0, shown)) / 100);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Cover score ${Math.round(score)} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-[225deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circumference}`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif font-bold leading-none" style={{ fontSize: size * 0.3, color }}>
          {Math.round(shown)}
        </span>
        {label && (
          <span className="mt-1.5 text-[11px] sm:text-[10px] font-mono uppercase tracking-widest text-[var(--color-white-muted)]">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Slim horizontal meter used for "portfolio completeness" and per-policy score
 * bars inside expanded cards.
 */
export function Meter({
  value,
  max = 100,
  color,
  track = "rgba(255,255,255,0.14)",
  height = 8,
}: {
  value: number;
  max?: number;
  color: string;
  track?: string;
  height?: number;
}) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const pct = Math.min(100, Math.max(0, (value / max) * 100));
    if (reduced) {
      setW(pct);
      return;
    }
    const id = setTimeout(() => setW(pct), 60); // let the CSS transition catch it
    return () => clearTimeout(id);
  }, [value, max]);

  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: track }}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${w}%`, background: color }}
      />
    </div>
  );
}
