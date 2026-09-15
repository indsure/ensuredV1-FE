/* ============================================================
   MOTION PRIMITIVES
   ------------------------------------------------------------
   Every public page animates through these components, so easing,
   distance and timing are decided once rather than re-invented per
   page. Before this, home.tsx, CompareSample.tsx and hospitals.tsx
   each carried their own near-identical variant objects with
   slightly different durations.

   All of them collapse to a plain, fully-visible render when the
   visitor asks for reduced motion. Nothing here may be the only
   thing that makes content appear.
   ============================================================ */

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  type Variants,
  type HTMLMotionProps,
} from "motion/react";

/* One easing curve for the whole site. A gentle deceleration:
   content arrives and settles rather than springing. */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const DURATION = { fast: 0.35, base: 0.55, slow: 0.8 } as const;

/* Content enters from below by this much. Deliberately small:
   large travel on a page full of cards reads as jitter, and on a
   slow Android it drops frames. */
const TRAVEL = 18;

export const riseVariants: Variants = {
  hidden: { opacity: 0, y: TRAVEL },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE } },
};

export const staggerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

/* Once an element has arrived it stays arrived. Re-animating on
   every scroll past is the single fastest way to make a marketing
   page feel cheap. */
const VIEWPORT = { once: true, margin: "0px 0px -12% 0px" } as const;

type RevealProps = {
  children: React.ReactNode;
  /** Seconds to wait before this element starts. */
  delay?: number;
  /** Edge the element travels in from. */
  from?: "bottom" | "left" | "right" | "none";
  className?: string;
} & Omit<HTMLMotionProps<"div">, "children" | "variants" | "initial" | "animate">;

/**
 * Fades and lifts its children into place the first time they
 * scroll into view. The most-used primitive on the site.
 */
export function Reveal({
  children,
  delay = 0,
  from = "bottom",
  className,
  ...rest
}: RevealProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  const offset =
    from === "bottom" ? { y: TRAVEL } :
    from === "left" ? { x: -TRAVEL } :
    from === "right" ? { x: TRAVEL } :
    {};

  return (
    <motion.div
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: DURATION.base, ease: EASE, delay }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * Wraps a list so its children arrive one after another. Pair with
 * <RevealItem> for each child; a plain child will not animate.
 */
export function Stagger({
  children,
  className,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
} & Omit<HTMLMotionProps<"div">, "children" | "variants" | "initial" | "whileInView">) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={staggerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
} & Omit<HTMLMotionProps<"div">, "children" | "variants">) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div variants={riseVariants} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

/**
 * Counts a number up when it scrolls into view.
 *
 * Only ever point this at a figure that is true, or one the
 * surrounding panel labels illustrative. A counter makes a number
 * feel earned, which is exactly why it must not be aimed at an
 * invented one.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  duration = 1.1,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduced) { setDisplay(value); return; }

    /* If the element never registers as in view — an observer that does not
       fire, a container that never scrolls — the figure must still be the
       real one rather than a confident 0. */
    if (!inView) {
      const settle = window.setTimeout(() => setDisplay(value), 2000);
      setDisplay(0);
      return () => clearTimeout(settle);
    }

    let frame = 0;
    const start = performance.now();
    const ms = duration * 1000;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      // The scalar form of EASE.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    /* Browsers throttle rAF in a background tab, which strands the count
       at a partial value and leaves it there. This guarantees the true
       figure lands: a wrong number on screen beats a missed animation. */
    const settle = window.setTimeout(() => setDisplay(value), ms + 400);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [inView, value, duration, reduced]);

  return (
    <span ref={ref} className={`tabular ${className ?? ""}`}>
      {prefix}
      {display.toLocaleString("en-IN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/**
 * A horizontal bar that fills to `percent` when scrolled into
 * view. Used for coverage gaps, where the gap is the point.
 */
export function GrowBar({
  percent,
  color = "var(--color-teal-600)",
  track = "var(--color-cream-dark)",
  height = 10,
  className,
  label,
  delay = 0,
}: {
  percent: number;
  color?: string;
  track?: string;
  height?: number;
  className?: string;
  label?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div
      className={`w-full overflow-hidden rounded-full ${className ?? ""}`}
      style={{ height, backgroundColor: track }}
      role="img"
      aria-label={label ?? `${Math.round(clamped)} percent`}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: reduced ? `${clamped}%` : 0 }}
        whileInView={{ width: `${clamped}%` }}
        viewport={VIEWPORT}
        transition={{ duration: reduced ? 0 : 0.95, ease: EASE, delay }}
      />
    </div>
  );
}
