/**
 * The one list of insurers an agent can pick from.
 *
 * WHY THIS FILE EXISTS
 * The app had four insurer vocabularies that disagreed: the signup picker,
 * `agents.partnered_companies`, the rider directory's short names, and the
 * backend's own `insurerMap`. Wherever an insurer was typed by hand instead of
 * picked, whatever the agent typed became the value. The claims form was a bare
 * text input with the placeholder "e.g. Niva Bupa".
 *
 * This list is the picker's source of truth. It is deliberately NOT a
 * normalisation map: see signup-insurer-map.ts for why token-matching between
 * these vocabularies produces confident nonsense ("SBI Life" -> "SBI Health").
 * Translating between them stays explicit and hand-written.
 *
 * Categories are shown as group headings, so an agent scanning for a motor
 * insurer is not reading past ten life companies to find it.
 */

export const INSURERS_BY_CATEGORY: Record<string, string[]> = {
  "Health Insurance": [
    "Star Health",
    "Niva Bupa",
    "Care Health Insurance",
    "HDFC Ergo Health",
    "ICICI Lombard Health",
    "Aditya Birla Health",
    "Manipal Cigna",
    "Galaxy Health",
    "Go Digit Health",
  ],
  "Life Insurance": [
    "LIC of India",
    "HDFC Life",
    "Max Life Insurance",
    "SBI Life",
    "ICICI Prudential Life",
    "Bajaj Allianz Life",
    "Tata AIA Life",
    "Aditya Birla Sun Life",
    "Kotak Life",
    "PNB MetLife",
  ],
  "General Insurance": [
    "Bajaj Allianz General",
    "Reliance General",
    "Tata AIG",
    "SBI General",
    "Royal Sundaram",
    "IFFCO Tokio",
    "New India Assurance",
    "United India Insurance",
    "Oriental Insurance",
    "National Insurance",
    "Go Digit General",
    "Chola MS",
  ],
};

/** Flat list, for search and for validating a stored value. */
export const ALL_INSURERS: string[] = Object.values(INSURERS_BY_CATEGORY).flat();

/** The category an insurer belongs to, for rendering a stored value's context. */
export function insurerCategory(name: string): string | null {
  for (const [category, list] of Object.entries(INSURERS_BY_CATEGORY)) {
    if (list.includes(name)) return category;
  }
  return null;
}

/**
 * Is this a name from the list, or something typed in the "Other" box?
 *
 * Callers use this to mark a free-typed insurer as unverified rather than
 * silently treating it as canonical. Exact match on purpose: a fuzzy match here
 * would reintroduce precisely the guessing this list exists to stop.
 */
export function isKnownInsurer(name: string | null | undefined): boolean {
  return !!name && ALL_INSURERS.includes(name);
}
