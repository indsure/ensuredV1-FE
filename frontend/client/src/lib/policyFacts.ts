/**
 * Header facts read straight off the policy timeline, shared by the on-screen
 * report and the PDF so the two can never print different dates.
 *
 * Every helper returns null when the source value is missing or unreadable.
 * Callers drop a null row entirely: an absent row reads as absent data, a dash
 * reads as a value.
 */
import { parseIsoDate } from "@shared/policyNumbers";

/** "12 March 2026". ISO dates are built from their parts, not `new Date(iso)`,
 *  which reads them as UTC midnight and shows the day before west of UTC. */
export function formatPolicyDate(raw: unknown, locale = "en-IN"): string | null {
    const iso = parseIsoDate(raw);
    let date: Date | null = null;
    if (iso.ok) {
        const [y, m, d] = iso.value.split("-").map(Number);
        date = new Date(y, m - 1, d);
    } else if (typeof raw === "string" && raw.trim() !== "") {
        const parsed = new Date(raw);
        date = Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (!date) return null;
    return date.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
}

/** Whole years only. A term the document did not state is null, never "0 years". */
export function policyTermYears(raw: unknown): number | null {
    const n = typeof raw === "string" ? Number(raw) : raw;
    if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 10) / 10;
}
