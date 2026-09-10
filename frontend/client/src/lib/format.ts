/**
 * Rupee formatting, in one place.
 *
 * There were five implementations of this before, two of them called
 * formatINR and disagreeing about what that name meant: one abbreviated to
 * "₹5.0L", the other spelled out "₹5,00,000". Moving a line of JSX between
 * two files silently changed what the customer saw.
 *
 * Three formats, because the product genuinely needs three. Pick by what the
 * reader needs, not by what is nearest:
 *
 *   compact  ₹1.2Cr    tight UI, magnitude matters more than the exact figure
 *   short    ₹1.2 Cr   the spaced variant the consumer portfolio uses
 *   full     ₹1,20,00,000
 *                      documents and anywhere the exact rupee is the point
 *
 * All three use Indian grouping (lakh/crore), never Western thousands.
 */

// The compact form lives in shared/policy.ts because it is part of the report
// contract the backend describes. Re-exported here so callers have one import
// to reach for, rather than having to know which of the two homes to use.
export { formatINR as formatINRCompact } from "@shared/policy";

/** Digits after the decimal, but only when they say something. 1.0 -> "1". */
const trim = (n: number): string =>
  n.toFixed(1).replace(/\.0$/, "");

/**
 * "₹1.2 Cr" / "₹5 L" / "₹50 K" / "₹900".
 * The spaced variant. Reads better at larger type sizes, which is why the
 * consumer portfolio uses it.
 */
export function formatINRShort(n: number): string {
  if (!Number.isFinite(n)) return "₹0";
  if (n >= 1e7) return `₹${trim(n / 1e7)} Cr`;
  if (n >= 1e5) return `₹${trim(n / 1e5)} L`;
  if (n >= 1e3) return `₹${trim(n / 1e3)} K`;
  return `₹${Math.round(n)}`;
}

/**
 * "₹1,20,00,000". Full Indian grouping, no abbreviation.
 * `fallback` is what a null or unparseable value renders as; the default is
 * an en dash rather than "0", because a missing figure is not a zero one.
 */
export function formatINRFull(
  value: number | string | null | undefined,
  fallback = "–",
): string {
  if (value === null || value === undefined) return fallback;
  const numeric =
    typeof value === "string" ? parseFloat(value.replace(/[₹,\s]/g, "")) : value;
  if (!Number.isFinite(numeric)) return fallback;
  return `₹${numeric.toLocaleString("en-IN")}`;
}

/**
 * Lakhs and crore, the way a sum insured is actually said out loud.
 * Shared so the calculator report, the agent portal and the marketing panels
 * cannot render the same figure three different ways.
 */
export function formatLakhs(n: number): string {
    if (!Number.isFinite(n)) return "—";
    if (n >= 10000000) {
        const cr = n / 10000000;
        return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)} Cr`;
    }
    const lakhs = Math.round((n / 100000) * 2) / 2;
    return `₹${lakhs % 1 === 0 ? lakhs.toFixed(0) : lakhs.toFixed(1)} Lakhs`;
}
