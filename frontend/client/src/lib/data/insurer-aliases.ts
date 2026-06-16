/**
 * Bridges the two insurer-name vocabularies in the app:
 *  - `agents.partnered_companies` (the profile selector) uses full marketing
 *    names, e.g. "Care Health Insurance", "ManipalCigna Health Insurance".
 *  - The rider directory (rider-data.ts) uses short canonical names, e.g.
 *    "Care Health", "Manipal Cigna".
 *
 * The agent-only calculator bias needs to translate a partner's profile name
 * into the rider-DB company so it can surface that insurer's actual riders.
 * The explicit map is the source of truth; a normalized-token fallback catches
 * minor formatting drift or a newly-added profile name.
 *
 * NOTE: 11 of the 28 profile insurers have no entries in the rider directory
 * (Tata AIG, Kotak, Galaxy, the four public-sector insurers, etc.). Those
 * resolve to null and the calculator falls back to neutral output for them.
 */

/** Canonical rider-DB company  →  profile partnered_companies name(s). */
export const INSURER_ALIASES: Record<string, string[]> = {
  "Niva Bupa": ["Niva Bupa Health Insurance"],
  "HDFC ERGO": ["HDFC Ergo Health Insurance"],
  "ICICI Lombard": ["ICICI Lombard Health Insurance"],
  "Aditya Birla": ["Aditya Birla Health Insurance"],
  "Star Health": ["Star Health and Allied Insurance"],
  "Care Health": ["Care Health Insurance"],
  "Bajaj Allianz": ["Bajaj Allianz Health Insurance"],
  "Manipal Cigna": ["ManipalCigna Health Insurance"],
  "Tata AIG": ["Tata AIG Health Insurance"],
  "Go Digit": ["Go Digit Health Insurance"],
  "Galaxy Health": ["Galaxy Health Insurance"],
  "Zurich Kotak": ["Zurich Kotak General Insurance", "Kotak Mahindra Health Insurance"],
  "Universal Sompo": ["Universal Sompo Health Insurance"],
  "Reliance General": ["Reliance Health Insurance"],
  "New India Assurance": ["New India Assurance"],
  "Royal Sundaram": ["Royal Sundaram Health Insurance"],
  "Liberty General": ["Liberty General Insurance"],
  "Cholamandalam": ["Cholamandalam MS Health Insurance"],
  "ACKO": ["Acko Health Insurance"],
  "SBI General": ["SBI Health Insurance"],
  "Raheja QBE": ["Raheja QBE Health Insurance"],
};

/**
 * Reduce an insurer name to a comparable token: lowercase, drop generic
 * descriptor words and punctuation/whitespace. "Care Health Insurance" and
 * "Care Health" both collapse to "carehealth"; "ManipalCigna Health Insurance"
 * and "Manipal Cigna" both collapse to "manipalcigna".
 */
function normalizeInsurer(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(health|general|life)\b/g, " ")
    .replace(/\band allied\b/g, " ")
    .replace(/\binsurance\b/g, " ")
    .replace(/\bcompany\b/g, " ")
    .replace(/\blimited\b|\bltd\b/g, " ")
    .replace(/\bms\b/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

// Prebuilt index of normalized canonical + alias tokens → canonical name.
const NORMALIZED_INDEX: Record<string, string> = (() => {
  const idx: Record<string, string> = {};
  for (const [canonical, aliases] of Object.entries(INSURER_ALIASES)) {
    idx[normalizeInsurer(canonical)] = canonical;
    for (const alias of aliases) idx[normalizeInsurer(alias)] = canonical;
  }
  return idx;
})();

/**
 * Translate a profile insurer name into its rider-DB canonical company.
 * Returns null when the insurer has no rider data (caller falls back to neutral).
 */
export function resolveInsurer(profileName: string): string | null {
  if (!profileName) return null;
  // Exact alias match first.
  for (const [canonical, aliases] of Object.entries(INSURER_ALIASES)) {
    if (canonical === profileName || aliases.includes(profileName)) return canonical;
  }
  // Normalized-token fallback.
  return NORMALIZED_INDEX[normalizeInsurer(profileName)] ?? null;
}

/**
 * Resolve a list of profile partner names to unique rider-DB companies,
 * dropping any with no rider data. Order is preserved by first appearance.
 */
export function resolvePartnerCompanies(profileNames: string[] | null | undefined): string[] {
  if (!profileNames?.length) return [];
  const out: string[] = [];
  for (const name of profileNames) {
    const canonical = resolveInsurer(name);
    if (canonical && !out.includes(canonical)) out.push(canonical);
  }
  return out;
}
