/**
 * Term-plan rider detection and scoring. Deterministic, zero AI, zero network.
 *
 * Reads the plain text of a term policy and reports which protections it
 * actually carries, then scores it out of 100 on the founder's weighting.
 *
 * BUILT AGAINST TWO REAL POLICIES on 2026-09-11, and everything unusual in here
 * exists because one of those two required it:
 *
 *   ABSLI Poorna Suraksha Kawach   explicit elections plus plan-option gating
 *   Bajaj Allianz Smart Protection Goal   a slot table of abbreviations
 *
 * THE TWO GRAMMARS, AND WHY ONE PARSER CANNOT BE LAZY
 *
 * Bajaj prints an enumerated rider table. Every slot is listed whether or not it
 * was bought, and purchase is proved by a sum assured sitting in the adjacent
 * column:
 *     Add on/Riders | SA/GMB
 *     Main Coverage (Basic) | 10000000
 *     ADB |            <- listed, empty, therefore not bought
 *     CI  |
 * So a bare mention of "CI" proves nothing at all. Only a number beside it does.
 *
 * ABSLI prints elections, and hides the rest inside plan options:
 *     Accelerated Critical Illness Benefit : No
 *     Waiver of Premium ... For Plan Options 1 to 3 or 5 or 6: Not applicable
 * So the same benefit is present or absent depending on which option was bought,
 * and the schedule says which one.
 *
 * A detector that only hunted for rider names would report both of these
 * policies as carrying every rider, because both documents NAME every rider they
 * do not sell. That is why absence is proved here, never assumed from silence.
 *
 * WHY ABSENCE IS PROVABLE AT ALL
 * Both insurers enumerate. That is what makes a confident score possible: a
 * rider we can see listed with no value is `absent_proven`, not `not_found`, and
 * only genuinely unmentioned riders fall back to the unreadable states that
 * leave the denominator.
 */

export type TermRiderState =
  /** A number, an election of Yes, or a plan option that includes it. */
  | "present"
  /** Listed with no value, elected No, or excluded by the chosen plan option. */
  | "absent_proven"
  /** Not mentioned anywhere. We cannot tell. */
  | "not_found"
  /** Mentioned, but nothing proves whether it was bought. A human should look. */
  | "check_manually";

export interface TermRiderFinding {
  id: TermRiderId;
  label: string;
  state: TermRiderState;
  /** Points this rider is worth when present. */
  weight: number;
  /** The exact text the finding rests on. Null when nothing was found. */
  evidence: string | null;
}

export type TermRiderId =
  | "tpd"
  | "critical_illness"
  | "waiver_of_premium"
  | "accidental_death"
  | "accidental_disability"
  | "terminal_illness"
  | "specialised"
  | "income_benefit"
  | "dependent";

/**
 * The founder's weighting. Holding a term plan is half the score on its own,
 * because it is: the difference between cover and no cover dwarfs every rider.
 *
 * The remaining fifty are deliberately coarse. A rider is worth 10, 5 or 0, and
 * nothing in between, because the underlying distinction is not precise enough
 * to justify pretending one rider deserves 7 and another 8.
 *
 * Income benefit and dependent cover score 0 ON PURPOSE. They are still
 * detected and still shown, because a customer is entitled to know what they
 * hold; they simply do not raise the score. A card must not render them as
 * failures.
 */
export const HOLDING_TERM_PLAN_POINTS = 50;

export const TERM_RIDER_CATALOG: Array<{
  id: TermRiderId;
  label: string;
  weight: number;
  /** Anchored phrases and schedule abbreviations. Never a bare single letter. */
  aliases: string[];
}> = [
  {
    id: "tpd",
    label: "Total permanent disability",
    weight: 10,
    aliases: ["total and permanent disability", "total & permanent disability", "TPD", "PTD"],
  },
  {
    id: "critical_illness",
    label: "Critical illness",
    weight: 10,
    // "CI" is the Bajaj schedule abbreviation. It is upper-cased and matched
    // whole-word only, or it would fire inside a hundred ordinary words.
    aliases: ["critical illness", "accelerated critical illness", "ACI", "CI"],
  },
  {
    id: "waiver_of_premium",
    label: "Waiver of premium",
    weight: 10,
    aliases: ["waiver of premium", "WOP", "premium waiver"],
  },
  {
    id: "accidental_death",
    label: "Accidental death",
    weight: 5,
    aliases: ["accidental death benefit", "accidental death", "ADB"],
  },
  {
    id: "accidental_disability",
    label: "Accidental disability or dismemberment",
    weight: 5,
    aliases: [
      "accidental permanent total",
      "accidental disability",
      "dismemberment",
      "APTPDB",
      "ADDB",
    ],
  },
  {
    id: "terminal_illness",
    label: "Terminal illness",
    weight: 5,
    aliases: ["terminal illness"],
  },
  {
    id: "specialised",
    label: "Specialised rider",
    weight: 5,
    aliases: ["hospital cash", "surgical care", "cancer care", "heart care"],
  },
  {
    id: "income_benefit",
    label: "Income benefit",
    weight: 0,
    aliases: ["family income benefit", "income benefit", "FIB"],
  },
  {
    id: "dependent",
    label: "Spouse, child or dependent cover",
    weight: 0,
    aliases: ["child education", "spouse cover", "spouse rider", "dependent cover"],
  },
];

/** The most points the riders can add. Derived, never typed by hand. */
export const MAX_RIDER_POINTS = TERM_RIDER_CATALOG.reduce((n, r) => n + r.weight, 0);

export interface TermScan {
  /** Bumped when the shape changes, so stored rows stay readable. */
  version: 1;
  scannedAt: string;
  findings: TermRiderFinding[];
}

export interface TermScore {
  /** 0-100, or null when the policy itself could not be confirmed. */
  score: number | null;
  /** 50 when a term plan is held. */
  base: number;
  /** Rider points earned, and the points that were actually decidable. */
  earned: number;
  possible: number;
  counted: number;
  setAside: number;
}

/* ── Detection ──────────────────────────────────────────────────────────── */

/** Upper-case abbreviations must match as whole words; phrases may not. */
function isAbbreviation(alias: string): boolean {
  return /^[A-Z]{2,7}$/.test(alias);
}

function findAlias(text: string, alias: string): number {
  if (isAbbreviation(alias)) {
    const m = new RegExp(`(^|[^A-Za-z])${alias}([^A-Za-z]|$)`).exec(text);
    return m ? m.index : -1;
  }
  return text.toLowerCase().indexOf(alias.toLowerCase());
}

/**
 * Does a money value sit close after this mention?
 *
 * The Bajaj slot table proves purchase with a sum assured in the next column,
 * and the columns collapse into "ADB   500000" once the PDF is flattened to
 * text. A short window is used on purpose: a number far away belongs to some
 * other row, and treating it as this rider's would invent cover the customer
 * never bought.
 */
const VALUE_WINDOW = 40;
function hasValueAfter(text: string, at: number): string | null {
  const tail = text.slice(at, at + VALUE_WINDOW);
  const m = /[\s:]\s*(?:`|Rs\.?|INR|₹)?\s*([0-9][0-9,]{3,})/.exec(tail);
  return m ? m[0].trim() : null;
}

/** "Accelerated Critical Illness Benefit : No" and friends. */
function electionAfter(text: string, at: number): "yes" | "no" | null {
  const tail = text.slice(at, at + 80);
  if (/:\s*(No|NA|N\/A|Nil|Not\s+Applicable|Not\s+Opted)\b/i.test(tail)) return "no";
  if (/:\s*(Yes|Opted|Selected)\b/i.test(tail)) return "yes";
  return null;
}

/**
 * Read one rider out of the policy text.
 *
 * Order of proof: an explicit election beats everything, because the insurer
 * has answered the question directly. A sum assured beside the mention proves
 * purchase. A mention with neither is the Bajaj empty-slot case, which is a
 * proven absence only when the document enumerates its riders; otherwise it is
 * a mention we cannot interpret, and it goes to a human rather than to a guess.
 */
function detectRider(
  text: string,
  entry: (typeof TERM_RIDER_CATALOG)[number],
  enumerates: boolean,
): TermRiderFinding {
  const base = { id: entry.id, label: entry.label, weight: entry.weight };

  /* Longest alias first, so the most specific phrase wins. "critical illness"
     and "accelerated critical illness" both match the same ABSLI line, but only
     the longer one quotes the benefit by its real name, and the evidence string
     is what an advisor reads when they check our answer against the document. */
  const aliases = [...entry.aliases].sort((a, z) => z.length - a.length);

  for (const alias of aliases) {
    const at = findAlias(text, alias);
    if (at < 0) continue;

    const election = electionAfter(text, at);
    if (election === "no") {
      return { ...base, state: "absent_proven", evidence: text.slice(at, at + 70).trim() };
    }
    if (election === "yes") {
      return { ...base, state: "present", evidence: text.slice(at, at + 70).trim() };
    }

    const value = hasValueAfter(text, at);
    if (value) {
      return { ...base, state: "present", evidence: text.slice(at, at + 70).trim() };
    }

    return {
      ...base,
      state: enumerates ? "absent_proven" : "check_manually",
      evidence: text.slice(at, at + 70).trim(),
    };
  }

  return { ...base, state: "not_found", evidence: null };
}

/**
 * Does this document list its riders whether or not they were bought?
 *
 * When it does, a named rider with no value is a proven absence. When it does
 * not, the same silence means nothing. Getting this wrong in the generous
 * direction would tell a customer they lack cover they actually hold, so the
 * test is a specific schedule heading rather than a guess.
 */
export function enumeratesRiders(text: string): boolean {
  return /add\s*on\s*\/\s*riders|rider\s*(details|schedule)|sa\s*\/\s*gmb/i.test(text);
}

export function scanTermRiders(text: string): TermScan {
  const enumerates = enumeratesRiders(text);
  return {
    version: 1,
    scannedAt: new Date().toISOString(),
    findings: TERM_RIDER_CATALOG.map((e) => detectRider(text, e, enumerates)),
  };
}

/* ── Scoring ────────────────────────────────────────────────────────────── */

/**
 * Score a term policy out of 100.
 *
 * Holding the plan is 50. Riders make up the rest on the founder's weights.
 *
 * As with motor, anything we could not read leaves the denominator rather than
 * scoring zero, so our uncertainty never costs the customer points. A rider
 * worth 0 is always counted as decided when we can see it: it neither helps nor
 * hurts, and excluding it would quietly change everyone else's denominator.
 *
 * THE BASE IS FLAT ON PURPOSE. Term cover is underwritten against income: a
 * person earning 2 lakh cannot buy 2 crore however much they want it. Scaling
 * the base by rupees of cover would mark somebody down for earning less while
 * holding the most the market will sell them, which is both unfair and useless,
 * because there is no action they could take in response. The only honest
 * version of adequacy is cover against income, and the policy document does not
 * carry income.
 */
export function scoreTermPolicy(scan: TermScan | null | undefined, holdsTermPlan = true): TermScore {
  const base = holdsTermPlan ? HOLDING_TERM_PLAN_POINTS : 0;
  const findings = scan?.findings ?? [];

  const decidable = findings.filter(
    (f) => f.state === "present" || f.state === "absent_proven",
  );

  let earned = 0;
  let possible = 0;
  for (const f of decidable) {
    possible += f.weight;
    if (f.state === "present") earned += f.weight;
  }

  if (!holdsTermPlan) return { score: null, base: 0, earned, possible, counted: decidable.length, setAside: findings.length - decidable.length };

  /* The rider half is scaled to whatever was decidable, so a policy where two
     riders were unreadable is scored out of the rest rather than out of 50. */
  const riderPoints =
    possible === 0 ? 0 : Math.round((earned / possible) * (MAX_RIDER_POINTS));

  return {
    score: Math.min(100, base + riderPoints),
    base,
    earned,
    possible,
    counted: decidable.length,
    setAside: findings.length - decidable.length,
  };
}

/** One line saying what the number means, so no surface invents its own. */
export function termScoreCaption(s: TermScore): string {
  if (s.score === null) return "No term cover was confirmed in this document.";
  const held = "Term cover held, which is half the score on its own";
  const riders =
    s.counted === 0
      ? "no riders could be read"
      : `${s.counted} rider${s.counted === 1 ? "" : "s"} checked`;
  const aside = s.setAside > 0 ? `, ${s.setAside} left out as unreadable` : "";
  return `${held}. ${riders}${aside}. This measures the protections attached to the plan, not whether the cover amount is enough.`;
}
