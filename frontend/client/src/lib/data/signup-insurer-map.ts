/**
 * Signup insurer names  →  profile `agents.partnered_companies` names.
 *
 * WHY THIS FILE EXISTS
 * An agent picks their insurers at signup (SignupStep2, written to the
 * `empanelments` table) and never sees that answer again: the cover calculator
 * reads `agents.partnered_companies`, which only the profile page writes. So
 * the signup question was decorative until they re-entered the same insurers by
 * hand in their profile.
 *
 * WHY THE MAP IS WRITTEN OUT BY HAND
 * The obvious fix is to normalize both names to a token and match. Do not. The
 * two lists cover different lines of business, and token matching produces
 * confident nonsense:
 *
 *     "SBI Life"              -> "SBI Health Insurance"          WRONG
 *     "Bajaj Allianz Life"    -> "Bajaj Allianz Health Insurance" WRONG
 *     "Bajaj Allianz General" -> "Bajaj Allianz Health Insurance" WRONG
 *     "Reliance General"      -> "Reliance Health Insurance"      WRONG
 *
 * Same brand, different company, different products. A calculator told an agent
 * partners with SBI Health when they actually sell SBI Life will recommend
 * riders that agent cannot place, and it will look perfectly plausible doing it.
 *
 * SO ONLY HEALTH IS MAPPED
 * Signup offers 24 insurers across life, health and general. The profile
 * selector is 28 health insurers. Only the 7 health ones have a true
 * counterpart, and only those are listed below. Life and general selections stay
 * in `empanelments`, which remains the record of everything an agent sells.
 * They are not dropped, and they are not guessed at either.
 *
 * The two stores therefore have distinct jobs, and merging them needs the
 * profile vocabulary extended to life and general first:
 *
 *   empanelments          — everything this agent sells, all lines. Admin view.
 *   partnered_companies   — health partners only. What the calculator biases to.
 *
 * If you add a health insurer to SignupStep2's list, add its mapping here, or
 * the signup answer silently stops reaching the calculator again.
 */

/** Signup name → the exact `partnered_companies` value the profile writes. */
export const SIGNUP_TO_PARTNER: Record<string, string> = {
  "Star Health": "Star Health and Allied Insurance",
  "Niva Bupa": "Niva Bupa Health Insurance",
  "Care Health Insurance": "Care Health Insurance",
  "HDFC Ergo Health": "HDFC Ergo Health Insurance",
  "ICICI Lombard Health": "ICICI Lombard Health Insurance",
  "Aditya Birla Health": "Aditya Birla Health Insurance",
  "Manipal Cigna": "ManipalCigna Health Insurance",
};

/**
 * Translate a signup selection into the health partners the calculator uses.
 * Anything with no explicit mapping (every life and general insurer) is dropped
 * rather than approximated. Order is preserved and duplicates removed.
 */
export function partnersFromSignup(selected: readonly string[]): string[] {
  const out: string[] = [];
  for (const name of selected) {
    const mapped = SIGNUP_TO_PARTNER[name.trim()];
    if (mapped && !out.includes(mapped)) out.push(mapped);
  }
  return out;
}
