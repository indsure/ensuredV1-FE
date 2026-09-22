/**
 * Sach AI retrieval layer: answer a policy question from data we already hold.
 *
 * NO NETWORK, NO DB, NO AI in this file. Everything here is pure: JSON in,
 * a rendered answer out. The route does the SQL (and the ownership check) and
 * hands the rows in, so every branch below is testable without a database.
 *
 * Why this exists
 * ---------------
 * The old /api/sach-ai shipped a ~40-line "policy context" block to Gemini on
 * every message, built from JSON paths that do not exist in a stored analysis
 * (coverage_structure.exclusions, cost_structure.copay_details, and so on). It
 * rendered as "Not available" seven times over and then told the model to "be
 * specific and reference their actual policy details". So the product paid a
 * model call to answer from nothing.
 *
 * The facts were always there, one path away. This module maps a question to the
 * path and renders the answer from the fields. A clause question is a lookup,
 * not a generation, and a lookup costs zero tokens.
 *
 * Two corpora, in priority order:
 *   A. analysis_jobs.result  - the caller's OWN uploaded policy. Ground truth.
 *   B. policy_catalog.profile - 69 published product wordings, normalized over
 *      the 27 axes in ../types/wordingProfile.ts. Right about the product, but
 *      marked status:"unverified" and variant-dependent, so it is labelled as
 *      the published wording and never as the reader's own schedule.
 *
 * Self-contained on purpose: the backend has no @shared alias and the EC2 box
 * runs tsx over backend/server alone, so formatINR is duplicated below rather
 * than imported (same reason as services/analysisPipeline.ts).
 */

/* ─── local helpers ─────────────────────────────────────────────────────────── */

/** Duplicated from shared/policy.ts. See the header note on @shared. */
function formatINR(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  const numeric = typeof value === "string" ? parseFloat(value.replace(/[₹,]/g, "")) : value;
  if (isNaN(numeric)) return "N/A";
  if (numeric >= 10000000) return `₹${(numeric / 10000000).toFixed(1)}Cr`;
  if (numeric >= 100000) return `₹${(numeric / 100000).toFixed(1)}L`;
  if (numeric >= 1000) return `₹${Math.round(numeric / 1000)}K`;
  return `₹${numeric.toLocaleString("en-IN")}`;
}

/** Walk a dotted path without throwing on a missing branch. */
function at(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((acc: any, k) => (acc == null ? undefined : acc[k]), obj);
}

/**
 * Lowercase, strip punctuation that breaks word boundaries, collapse spaces.
 *
 * Hyphens become spaces. People write the hyphenated form of exactly the
 * clauses that matter most ("co-pay", "sub-limit", "pre-existing", "day-care"),
 * and keeping the hyphen made every one of them miss its synonym and fall
 * through to the general path, which is the worst possible answer for the
 * clause the question was actually about.
 */
function normalize(q: string): string {
  return (q || "")
    .toLowerCase()
    .replace(/[-‐-―]/g, " ")
    .replace(/[^\p{L}\p{N}\s%+]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Whole-phrase match, so "ped" does not fire inside "expedite". */
function hasPhrase(haystack: string, needle: string): boolean {
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${esc}(\\s|$)`, "u").test(haystack);
}

/* ─── the clause map ────────────────────────────────────────────────────────── */

export type ClauseKey =
  | "room_rent" | "icu" | "copayment" | "sub_limits" | "deductible"
  | "initial_waiting" | "ped_waiting" | "specific_disease_waiting" | "maternity"
  | "cumulative_bonus" | "restoration"
  | "pre_hosp" | "post_hosp" | "day_care" | "domiciliary" | "ayush"
  | "organ_donor" | "ambulance" | "modern_treatments" | "consumables"
  | "global_cover" | "opd" | "health_checkup"
  | "moratorium" | "grace_period" | "free_look" | "portability"
  | "notable_exclusions" | "optional_riders"
  | "sum_insured" | "network_hospitals";

/**
 * Whether the clause is something you WANT (a benefit), something you do NOT
 * want (a burden like a co-pay, a deductible or a waiting period), or a neutral
 * figure (a room-rent category, a sum insured).
 *
 * This is not cosmetic. `exists: false` on a co-payment is GOOD news, and the
 * first version of this renderer read it as "No, not covered", which told a
 * reader with no co-pay that they had no cover. A benefit and a burden cannot
 * share one set of words.
 */
export type ClausePolarity = "benefit" | "burden" | "info";

export interface ClauseDef {
  label: string;
  polarity: ClausePolarity;
  /** Path inside analysis_jobs.result. null = the audit schema has no such field. */
  auditPath: string | null;
  /** Axis key inside policy_catalog.profile. null = not a catalog axis. */
  catalogAxis: string | null;
  /**
   * Match phrases, longest-first at match time. These are what a real person
   * types, not the schema's vocabulary: nobody asks about "modern_treatments",
   * they ask "am I covered for robotic".
   */
  synonyms: string[];
}

export const CLAUSE_MAP: Record<ClauseKey, ClauseDef> = {
  modern_treatments: {
    label: "Modern treatments",
    polarity: "benefit",
    auditPath: "supplementary_coverage.modern_treatments",
    catalogAxis: "modern_treatments",
    synonyms: [
      "robotic surgery", "robot assisted surgery", "robotic surgeries", "robotic",
      "robot", "cyber knife", "cyberknife", "stem cell", "stem cell therapy",
      "immunotherapy", "oral chemotherapy", "bronchial thermoplasty",
      "deep brain stimulation", "modern treatment", "modern treatments",
      "advanced treatment", "advance technology", "advanced technology methods",
      "advance technology methods", "new age treatment",
    ],
  },
  room_rent: {
    label: "Room rent",
    polarity: "info",
    auditPath: "claim_risk_analysis.room_rent",
    catalogAxis: "room_rent",
    synonyms: ["room rent", "room rent limit", "room rent capping", "room cap", "room limit", "single private room", "room category", "bed charges"],
  },
  icu: {
    label: "ICU charges",
    polarity: "info",
    auditPath: null,
    catalogAxis: "icu",
    synonyms: ["icu", "iccu", "intensive care", "icu limit", "icu capping"],
  },
  copayment: {
    label: "Co-payment",
    polarity: "burden",
    auditPath: "claim_risk_analysis.co_payment",
    catalogAxis: "copayment",
    synonyms: ["copay", "co pay", "co payment", "copayment", "cost sharing", "my share of the claim"],
  },
  sub_limits: {
    label: "Sub-limits",
    polarity: "burden",
    auditPath: "claim_risk_analysis.sub_limits",
    catalogAxis: "sub_limits",
    synonyms: ["sub limit", "sub limits", "sublimit", "sublimits", "disease capping", "disease wise limit", "procedure cap", "capping"],
  },
  deductible: {
    label: "Deductible",
    polarity: "burden",
    auditPath: "claim_risk_analysis.deductibles",
    catalogAxis: "deductible",
    synonyms: ["deductible", "deductibles", "excess", "self pay amount"],
  },
  initial_waiting: {
    label: "Initial waiting period",
    polarity: "burden",
    auditPath: "waiting_period_analysis.initial_waiting_period",
    catalogAxis: "initial_waiting",
    synonyms: ["initial waiting", "initial waiting period", "30 day waiting", "first 30 days", "cooling period"],
  },
  ped_waiting: {
    label: "Pre-existing disease waiting",
    polarity: "burden",
    auditPath: "waiting_period_analysis.pre_existing_disease",
    catalogAxis: "ped_waiting",
    synonyms: ["ped", "ped waiting", "pre existing", "pre existing disease", "preexisting", "existing illness", "existing disease", "already have diabetes", "already have bp"],
  },
  specific_disease_waiting: {
    label: "Specific-disease waiting",
    polarity: "burden",
    auditPath: "waiting_period_analysis.specific_diseases",
    catalogAxis: "specific_disease_waiting",
    synonyms: ["specific disease", "specific diseases", "specific illness waiting", "named disease waiting", "2 year waiting", "two year waiting", "cataract waiting", "hernia waiting"],
  },
  maternity: {
    label: "Maternity",
    polarity: "benefit",
    auditPath: "supplementary_coverage.maternity",
    catalogAxis: "maternity",
    synonyms: ["maternity", "pregnancy", "delivery", "c section", "childbirth", "newborn", "new born"],
  },
  cumulative_bonus: {
    label: "Cumulative bonus",
    polarity: "benefit",
    auditPath: "coverage_structure.no_claim_bonus",
    catalogAxis: "cumulative_bonus",
    synonyms: ["cumulative bonus", "no claim bonus", "ncb", "bonus", "claim free bonus"],
  },
  restoration: {
    label: "Restoration",
    polarity: "benefit",
    auditPath: "coverage_structure.restoration",
    catalogAxis: "restoration",
    synonyms: ["restoration", "restore", "reset benefit", "refill", "recharge", "reinstatement"],
  },
  pre_hosp: {
    label: "Pre-hospitalisation",
    polarity: "benefit",
    auditPath: null,
    catalogAxis: "pre_hosp",
    synonyms: ["pre hospitalisation", "pre hospitalization", "pre hospital", "before admission", "tests before admission"],
  },
  post_hosp: {
    label: "Post-hospitalisation",
    polarity: "benefit",
    auditPath: null,
    catalogAxis: "post_hosp",
    synonyms: ["post hospitalisation", "post hospitalization", "post hospital", "after discharge", "follow up after discharge"],
  },
  day_care: {
    label: "Day-care procedures",
    polarity: "benefit",
    auditPath: "supplementary_coverage.day_care_procedures",
    catalogAxis: "day_care",
    synonyms: ["day care", "daycare", "day care procedure", "day care procedures", "less than 24 hours", "cataract surgery", "dialysis"],
  },
  domiciliary: {
    label: "Domiciliary treatment",
    polarity: "benefit",
    auditPath: null,
    catalogAxis: "domiciliary",
    synonyms: ["domiciliary", "home treatment", "treatment at home", "home hospitalisation", "home hospitalization"],
  },
  ayush: {
    label: "AYUSH treatment",
    polarity: "benefit",
    auditPath: null,
    catalogAxis: "ayush",
    synonyms: ["ayush", "ayurveda", "ayurvedic", "homeopathy", "homoeopathy", "unani", "siddha", "naturopathy"],
  },
  organ_donor: {
    label: "Organ donor",
    polarity: "benefit",
    auditPath: null,
    catalogAxis: "organ_donor",
    synonyms: ["organ donor", "donor expenses", "transplant donor", "kidney donor"],
  },
  ambulance: {
    label: "Ambulance",
    polarity: "benefit",
    auditPath: "supplementary_coverage.ambulance",
    catalogAxis: "ambulance",
    synonyms: ["ambulance", "road ambulance", "air ambulance"],
  },
  consumables: {
    label: "Consumables",
    polarity: "benefit",
    auditPath: "supplementary_coverage.consumables",
    catalogAxis: "consumables",
    synonyms: ["consumable", "consumables", "non medical expenses", "non medical items", "gloves and syringes", "annexure ii", "annexure 2"],
  },
  global_cover: {
    label: "Global cover",
    polarity: "benefit",
    auditPath: null,
    catalogAxis: "global_cover",
    synonyms: ["global cover", "worldwide cover", "international treatment", "treatment abroad", "overseas treatment"],
  },
  opd: {
    label: "OPD",
    polarity: "benefit",
    auditPath: "supplementary_coverage.opd",
    catalogAxis: null,
    synonyms: ["opd", "out patient", "outpatient", "doctor consultation", "consultation fees", "without admission"],
  },
  health_checkup: {
    label: "Preventive health check-up",
    polarity: "benefit",
    auditPath: "supplementary_coverage.preventive_health_checkup",
    catalogAxis: null,
    synonyms: ["health checkup", "health check up", "preventive checkup", "preventive health check", "annual checkup", "master health check"],
  },
  moratorium: {
    label: "Moratorium",
    polarity: "info",
    auditPath: null,
    catalogAxis: "moratorium",
    synonyms: ["moratorium", "moratorium period", "after how many years cannot reject", "non disclosure protection"],
  },
  grace_period: {
    label: "Grace period",
    polarity: "info",
    auditPath: null,
    catalogAxis: "grace_period",
    synonyms: ["grace period", "late payment", "missed premium", "premium due date"],
  },
  free_look: {
    label: "Free-look period",
    polarity: "info",
    auditPath: null,
    catalogAxis: "free_look",
    synonyms: ["free look", "freelook", "cancel within", "return the policy", "cooling off"],
  },
  portability: {
    label: "Portability",
    polarity: "info",
    auditPath: null,
    catalogAxis: "portability",
    synonyms: ["portability", "port my policy", "porting", "switch insurer", "change insurer"],
  },
  notable_exclusions: {
    label: "Exclusions",
    polarity: "burden",
    auditPath: null,
    catalogAxis: "notable_exclusions",
    synonyms: ["exclusion", "exclusions", "what is not covered", "not covered", "excluded"],
  },
  optional_riders: {
    label: "Riders and optional covers",
    polarity: "info",
    auditPath: "coverage_structure.riders",
    catalogAxis: "optional_riders",
    synonyms: ["rider", "riders", "optional cover", "optional covers", "add on", "add ons", "addon", "addons"],
  },
  sum_insured: {
    label: "Sum insured",
    polarity: "info",
    auditPath: "coverage_structure.base_sum_insured",
    catalogAxis: null,
    synonyms: ["sum insured", "my cover amount", "coverage amount", "si", "base cover"],
  },
  network_hospitals: {
    label: "Network hospitals",
    polarity: "info",
    auditPath: "network_limitations",
    catalogAxis: null,
    synonyms: ["network hospital", "network hospitals", "cashless hospital", "cashless", "empanelled", "which hospitals"],
  },
};

/* ─── intent parsing ────────────────────────────────────────────────────────── */

export type IntentKind = "clause" | "cover_need" | "compare" | "verdict" | "general";

export interface SachIntent {
  kind: IntentKind;
  clauseKey: ClauseKey | null;
  /** True when the question is about the reader's own policy, not a product in general. */
  aboutOwnPolicy: boolean;
  /** Free-text insurer/plan mention, e.g. "care health". Resolved against the catalog by the route. */
  namedPlanText: string | null;
}

const COVER_NEED_PHRASES = [
  "how much cover", "how much insurance", "how much health insurance",
  "how much sum insured", "what sum insured", "what cover should",
  "how much should i take", "adequate cover", "enough cover", "kitna cover",
  "recommended cover", "ideal sum insured",
];

const COMPARE_PHRASES = ["compare", "versus", " vs ", "better than", "which is better", "difference between"];

const OWN_POLICY_PHRASES = [
  "my policy", "my plan", "my cover", "my health insurance", "am i covered",
  "do i have", "am i eligible", "in my", "i am covered", "my sum insured",
  "my waiting", "my copay", "my room rent", "meri policy",
];

/**
 * Longest-synonym-first so "robotic surgery" wins over a bare "surgery"-ish
 * partial and "pre existing disease" wins over "pre hospital".
 */
const SYNONYM_INDEX: Array<{ phrase: string; key: ClauseKey }> = Object.entries(CLAUSE_MAP)
  .flatMap(([key, def]) => def.synonyms.map((phrase) => ({ phrase, key: key as ClauseKey })))
  .sort((a, b) => b.phrase.length - a.phrase.length);

export function parseIntent(question: string): SachIntent {
  const q = normalize(question);

  const clauseHit = SYNONYM_INDEX.find((s) => hasPhrase(q, s.phrase));
  const aboutOwnPolicy = OWN_POLICY_PHRASES.some((p) => q.includes(normalize(p)));
  const namedPlanText = extractPlanMention(q);

  // A compare question outranks a clause hit: "compare room rent on A and B"
  // is a comparison, not a room-rent lookup.
  if (COMPARE_PHRASES.some((p) => q.includes(p.trim()) || q.includes(p))) {
    return { kind: "compare", clauseKey: clauseHit?.key ?? null, aboutOwnPolicy, namedPlanText };
  }
  if (COVER_NEED_PHRASES.some((p) => q.includes(p))) {
    return { kind: "cover_need", clauseKey: null, aboutOwnPolicy, namedPlanText };
  }
  if (clauseHit) {
    return { kind: "clause", clauseKey: clauseHit.key, aboutOwnPolicy, namedPlanText };
  }
  // Checked after the clause hit on purpose: "what is wrong with the room rent" is a room-rent
  // question, and the specific answer beats the summary. Only an open question with no clause
  // in it reaches here.
  if (VERDICT_PHRASES.some((p) => q.includes(p))) {
    return { kind: "verdict", clauseKey: null, aboutOwnPolicy, namedPlanText };
  }
  return { kind: "general", clauseKey: null, aboutOwnPolicy, namedPlanText };
}

/**
 * Open questions that ask for the overall picture rather than one clause. This is the first
 * thing an advisor asks about a client's policy, and until now it fell through to "I do not
 * have a general answer for that one" while the audit sat on the answer.
 */
const VERDICT_PHRASES = [
  "what is wrong", "whats wrong", "what s wrong", "anything wrong", "what are the problems",
  "what are the issues", "any issues", "any problems", "red flag", "red flags",
  "is this any good", "is it any good", "is this policy good", "is this good", "how good is",
  "is this policy safe", "is this safe", "how risky", "is this risky",
  "should i switch", "should they switch", "should he switch", "should she switch",
  "should we switch", "should i port", "should they port", "should he port", "should she port",
  "review this policy", "review the policy", "overall verdict", "the verdict",
  "summarise this policy", "summarize this policy", "summarise the policy", "summarize the policy",
  "kya problem hai", "koi problem", "theek hai kya", "sahi hai kya",
];

/**
 * Pull an insurer mention out of the question so the route can look it up in
 * policy_catalog. Deliberately a fixed list of insurer names rather than a fuzzy
 * search: a wrong insurer match would answer about someone else's product.
 */
const INSURER_MENTIONS = [
  "care health", "care", "star health", "star", "hdfc ergo", "hdfc", "niva bupa",
  "max bupa", "niva", "aditya birla", "birla", "bajaj allianz", "bajaj",
  "icici lombard", "icici", "tata aig", "tata", "manipalcigna", "cigna",
  "new india", "oriental", "united india", "national insurance", "sbi general",
  "reliance general", "reliance", "digit", "acko", "indusind", "zuno", "future generali",
  "kotak", "universal sompo", "liberty", "raheja", "iffco tokio", "cholamandalam", "chola",
];

export function extractPlanMention(normalizedQuestion: string): string | null {
  const hit = INSURER_MENTIONS
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((name) => hasPhrase(normalizedQuestion, name));
  return hit ?? null;
}

/* ─── the retrieved fact ────────────────────────────────────────────────────── */

export type Verdict = "yes" | "no" | "conditional" | "unknown";

export interface ClauseFact {
  clauseKey: ClauseKey;
  label: string;
  verdict: Verdict;
  /** Short verdict line, e.g. "Covered, with a cap". */
  headline: string;
  /** Supporting lines already formatted for a reader. */
  details: string[];
  /** Where this came from. Rendered to the user verbatim, never dropped. */
  sourceLabel: string;
  /** Accuracy caveats that must survive to the screen (catalog variant notes etc). */
  caveats: string[];
}

/** Fields whose value is already a reader-ready sentence in the audit schema. */
const PROSE_FIELDS = ["remarks", "risk_commentary", "explanation", "note"];

function firstProse(leaf: any): string | null {
  for (const f of PROSE_FIELDS) {
    const v = leaf?.[f];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function verdictFromLeaf(leaf: any, polarity: ClausePolarity): Verdict {
  if (leaf == null) return "unknown";
  if (typeof leaf === "number" || typeof leaf === "string") return "yes";

  // `stated: false` means the document never said. That is not the same as "no",
  // and reporting it as "no" would tell someone a waiting period does not apply
  // when we simply could not find it.
  if (leaf.stated === false) return "unknown";

  const flag = leaf.covered ?? leaf.exists ?? leaf.relevant;
  if (flag === true) return hasLimit(leaf) ? "conditional" : "yes";
  if (flag === false) return "no";

  // No boolean flag. Several real sections carry only a value: a room-rent
  // category, a waiting period's duration. Presence of a value IS the answer.
  if (hasValue(leaf)) return polarity === "benefit" ? "conditional" : "yes";
  return "unknown";
}

/** Does this leaf carry any substantive figure or category at all? */
function hasValue(leaf: any): boolean {
  return (
    leaf.limit_value != null ||
    leaf.display != null ||
    leaf.duration_months != null ||
    leaf.duration_days != null ||
    leaf.limit != null ||
    leaf.limit_amount_per_day != null ||
    (leaf.percentage != null && Number(leaf.percentage) > 0) ||
    leaf.number != null
  );
}

/**
 * A `conditions` string is not automatically a cap. Real analyses put
 * "Covered up to the full Sum Insured" and "No sub-limits on modern treatments"
 * in that same field, and reading those as a limit tells someone their robotic
 * surgery is restricted when in fact it is not. A false cap warning is the
 * expensive direction to be wrong in: it pushes a reader to buy cover they
 * already have.
 */
const NOT_A_CAP = /(up to (the )?(full )?sum insured|up to si|full sum insured|no sub-?limits?|without (any )?sub-?limits?|no cap|not capped|uncapped)/i;

function conditionIsACap(text: unknown): boolean {
  if (typeof text !== "string" || !text.trim()) return false;
  return !NOT_A_CAP.test(text);
}

function hasLimit(leaf: any): boolean {
  const capped =
    conditionIsACap(leaf.conditions) ||
    (leaf.limit != null && leaf.limit !== "") ||
    (leaf.limit_per_year != null) ||
    (typeof leaf.coverage_type === "string" && leaf.coverage_type === "partial") ||
    (leaf.percentage != null && Number(leaf.percentage) > 0) ||
    (leaf.cap_percentage != null);
  return Boolean(capped);
}

/**
 * Headlines carry no clause label, so they read correctly whether the name is
 * singular ("Room rent") or plural ("Modern treatments"). The label leads the
 * detail lines instead.
 *
 * They are keyed by polarity because the same underlying flag means opposite
 * things: no co-payment is good news, no maternity cover is bad news. The first
 * version of this renderer shared one set of words and told a reader with no
 * co-pay "No, not covered", which reads as having no cover at all.
 */
const HEADLINES: Record<ClausePolarity, Record<Verdict, string>> = {
  benefit: {
    yes: "Yes, covered.",
    conditional: "Yes, but with a limit.",
    no: "No, not covered.",
    unknown: "Your document does not say.",
  },
  burden: {
    yes: "Yes, this applies to you.",
    conditional: "Yes, this applies, with conditions.",
    no: "No, this does not apply to you.",
    unknown: "Your document does not say.",
  },
  info: {
    yes: "Here is what your policy says.",
    conditional: "Here is what your policy says.",
    no: "Your policy does not set one.",
    unknown: "Your document does not say.",
  },
};

/**
 * Turn one audit leaf into a fact. Generic on purpose: the audit schema keeps
 * the same field vocabulary across sections (covered / exists / stated, limit,
 * conditions, duration_months, plus a prose field), so one renderer serves all
 * of them and a new section needs a CLAUSE_MAP entry, not new render code.
 */
export function resolveFromAudit(analysisResult: any, clauseKey: ClauseKey): ClauseFact | null {
  const def = CLAUSE_MAP[clauseKey];
  if (!def?.auditPath) return null;

  const leaf = at(analysisResult, def.auditPath);
  if (leaf === undefined || leaf === null) return null;

  const verdict = verdictFromLeaf(leaf, def.polarity);
  const details: string[] = [];

  if (typeof leaf === "number") {
    details.push(`${def.label}: ${formatINR(leaf)}`);
  } else if (typeof leaf === "string") {
    details.push(`${def.label}: ${leaf}`);
  } else {
    if (Array.isArray(leaf.examples) && leaf.examples.length) {
      details.push(`Includes: ${leaf.examples.join(", ")}.`);
    }
    if (typeof leaf.conditions === "string" && leaf.conditions.trim()) {
      details.push(`Condition: ${leaf.conditions.trim()}`);
    }
    if (leaf.limit != null && leaf.limit !== "") {
      details.push(`Limit: ${typeof leaf.limit === "number" ? formatINR(leaf.limit) : leaf.limit}`);
    }
    if (leaf.limit_value) details.push(`Limit: ${leaf.limit_value}`);
    if (leaf.limit_amount_per_day != null) {
      details.push(`Works out to about ${formatINR(leaf.limit_amount_per_day)} per day.`);
    }
    if (leaf.limit_per_year != null) {
      details.push(`Per year: ${typeof leaf.limit_per_year === "number" ? formatINR(leaf.limit_per_year) : leaf.limit_per_year}`);
    }
    if (leaf.percentage != null && Number(leaf.percentage) > 0) {
      details.push(`You pay ${leaf.percentage}% of every claim.`);
    }
    if (leaf.duration_months != null) details.push(`Waiting period: ${leaf.duration_months} months.`);
    if (leaf.duration_days != null) details.push(`Waiting period: ${leaf.duration_days} days.`);
    if (leaf.is_active_today === true) details.push("This waiting period is still running today.");
    if (leaf.is_active_today === false) details.push("This waiting period is already served.");
    if (leaf.months_remaining != null && Number(leaf.months_remaining) > 0) {
      details.push(`${leaf.months_remaining} months left to run.`);
    }
    if (leaf.current_bonus != null) details.push(`Bonus accrued so far: ${formatINR(leaf.current_bonus)}`);
    if (Array.isArray(leaf.categories) && leaf.categories.length) {
      details.push(`Applies to: ${leaf.categories.join(", ")}.`);
    }
    if (leaf.risk_level) details.push(`Risk level on this clause: ${leaf.risk_level}.`);

    const prose = firstProse(leaf);
    if (prose) details.push(prose);

    // Several sections carry only flags and a risk level, no sentence. Say the
    // good news out loud rather than leaving the reader with a bare verdict.
    const conditionsSpeak = typeof leaf.conditions === "string" && leaf.conditions.trim().length > 0;
    if (!prose && !conditionsSpeak && verdict === "no" && def.polarity === "burden") {
      details.push(`No ${def.label.toLowerCase()} is applied on this policy.`);
    }
  }

  return {
    clauseKey,
    label: def.label,
    verdict,
    headline: HEADLINES[def.polarity][verdict],
    details: [`${def.label}, in your policy:`, ...details],
    sourceLabel: "Source: your uploaded policy analysis.",
    caveats: [],
  };
}

/**
 * Turn one catalog axis into a fact. The catalog describes the PUBLISHED product
 * wording, not the reader's schedule, so every fact it produces carries that
 * caveat plus the row's own status/confidence and any "VERIFY per variant" note.
 * Dropping those would turn a product-level statement into a personal promise.
 */
export function resolveFromCatalogProfile(
  row: { insurer?: string | null; plan_name?: string | null; status?: string | null; confidence?: string | null; profile: any },
  clauseKey: ClauseKey
): ClauseFact | null {
  const def = CLAUSE_MAP[clauseKey];
  if (!def?.catalogAxis) return null;

  const axis = at(row.profile, def.catalogAxis);
  if (axis == null) return null;

  const planLabel = [row.insurer, row.plan_name].filter(Boolean).join(" ") || "this plan";
  const details: string[] = [];
  let verdict: Verdict = "unknown";

  if (typeof axis === "string") {
    details.push(axis);
    verdict = "yes";
  } else {
    if (axis.display) details.push(`${def.label}: ${axis.display}`);
    if (axis.number != null) details.push(`Value: ${axis.number}`);
    if (axis.note) details.push(String(axis.note));
    if (axis.exists === true) verdict = axis.optional === true ? "conditional" : "yes";
    else if (axis.exists === false) verdict = "no";
    else if (axis.display) verdict = "conditional";
    if (axis.optional === true) {
      details.push("Available only as a paid optional cover or rider, not built into the base plan.");
    }
  }

  const caveats = [
    `This describes the published ${planLabel} wording, not your own policy schedule. Your variant, sum insured and add-ons can change the answer.`,
  ];
  if (row.status && row.status !== "verified") {
    caveats.push(`Catalog entry status: ${row.status}. Confirm against your policy document before acting on it.`);
  }
  if (typeof axis?.note === "string" && /verify/i.test(axis.note)) {
    caveats.push("The wording itself flags that this clause varies by variant.");
  }

  return {
    clauseKey,
    label: def.label,
    verdict,
    headline: HEADLINES[def.polarity][verdict],
    details,
    sourceLabel: `Source: IndSure policy catalog, ${planLabel}${row.confidence ? ` (extraction confidence: ${row.confidence})` : ""}.`,
    caveats,
  };
}

/* ─── rendering ─────────────────────────────────────────────────────────────── */

/**
 * Render a fact as the chat message. Deterministic, zero tokens, and the source
 * line and caveats are part of the string rather than optional decoration, so
 * there is no path that ships a claim without its provenance.
 */
export function renderClauseAnswer(fact: ClauseFact): string {
  const parts: string[] = [`**${fact.headline}**`];
  if (fact.details.length) parts.push(fact.details.join("\n\n"));
  if (fact.caveats.length) parts.push(fact.caveats.map((c) => `Note: ${c}`).join("\n\n"));
  parts.push(fact.sourceLabel);
  return parts.join("\n\n");
}

/**
 * The whole deterministic path in one call. Returns null when nothing could be
 * answered from data, which is the ONLY case that should reach a model.
 */
/* ─── overall verdict ───────────────────────────────────────────────────────── */

export interface VerdictFact {
  /** "RISKY" | "SAFE" as the audit recorded it. Never invented. */
  label: string | null;
  summary: string | null;
  failurePoints: string[];
  realClaimAnswer: string | null;
  criticalActions: { action: string; reason: string }[];
  portAdvice: string | null;
  score: number | null;
  sourceLabel: string;
}

const asText = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/**
 * Read the audit's own verdict. Every field here is something the analysis already decided and
 * stored; nothing is recomputed and nothing is inferred. A report that carries no verdict
 * returns null so the caller can say so rather than assemble a reassuring-sounding summary out
 * of whatever else happens to be present.
 */
export function resolveVerdict(analysisResult: any): VerdictFact | null {
  const fv = analysisResult?.final_verdict;
  if (!fv || typeof fv !== "object") return null;

  const failurePoints = Array.isArray(fv.key_failure_points)
    ? fv.key_failure_points.map(asText).filter((s: string | null): s is string => Boolean(s))
    : [];

  const label = asText(fv.label);
  const summary = asText(fv.summary);
  if (!label && !summary && failurePoints.length === 0) return null;

  const recs = analysisResult?.recommendations ?? {};
  const criticalActions = (Array.isArray(recs.critical_actions) ? recs.critical_actions : [])
    .map((a: any) => ({ action: asText(a?.action) ?? "", reason: asText(a?.reason) ?? "" }))
    .filter((a: { action: string }) => a.action);

  // The audit stores this under recommendations; it is the direct answer to "should they switch".
  const port = recs.should_port_to_better_policy;
  const portAdvice =
    asText(port) ??
    asText(port?.reason) ??
    (typeof port === "boolean" ? (port ? "Yes, porting is worth considering." : "No, porting is not indicated.") : null);

  const rawScore = analysisResult?.audit_score?.score;

  return {
    label,
    summary,
    failurePoints,
    realClaimAnswer: asText(fv.will_this_policy_protect_in_real_claim),
    criticalActions,
    portAdvice,
    score: typeof rawScore === "number" ? rawScore : null,
    sourceLabel: "your uploaded policy analysis",
  };
}

export function renderVerdictAnswer(v: VerdictFact): string {
  const lines: string[] = [];

  if (v.label === "RISKY") lines.push("**This policy has real problems.**");
  else if (v.label === "SAFE") lines.push("**This policy holds up.**");
  else if (v.label) lines.push(`**Verdict: ${v.label}.**`);

  if (v.summary) lines.push(v.summary);
  if (typeof v.score === "number") lines.push(`Audit score: ${v.score} out of 100.`);

  if (v.failurePoints.length) {
    lines.push("What is wrong with it:");
    lines.push(v.failurePoints.map((p) => `- ${p}`).join("\n"));
  }

  if (v.realClaimAnswer) lines.push(`At an actual claim: ${v.realClaimAnswer}`);

  if (v.criticalActions.length) {
    lines.push("Do these first:");
    lines.push(
      v.criticalActions
        .slice(0, 3)
        .map((a) => `- **${a.action}**${a.reason ? `: ${a.reason}` : ""}`)
        .join("\n"),
    );
  }

  if (v.portAdvice) lines.push(`On switching: ${v.portAdvice}`);

  lines.push(`Source: ${v.sourceLabel}.`);
  return lines.join("\n\n");
}

export function answerFromData(
  question: string,
  sources: {
    ownAnalysis?: any | null;
    catalogRow?: { insurer?: string | null; plan_name?: string | null; status?: string | null; confidence?: string | null; profile: any } | null;
  }
): { intent: SachIntent; fact: ClauseFact | null; text: string | null } {
  const intent = parseIntent(question);

  // "What is wrong with this policy" is answered from the audit's own verdict. It only works
  // against a real report: there is no product-level equivalent, because a catalog row describes
  // a wording, not whether it suits a particular family.
  if (intent.kind === "verdict") {
    const verdict = sources.ownAnalysis ? resolveVerdict(sources.ownAnalysis) : null;
    if (verdict) return { intent, fact: null, text: renderVerdictAnswer(verdict) };
    if (sources.ownAnalysis) {
      return {
        intent,
        fact: null,
        text: "This report does not carry an overall verdict, so I will not invent one. Ask me about a specific clause instead, like the room rent limit, co-pay, waiting periods or modern treatments, and I will read it out of the document.",
      };
    }
    return { intent, fact: null, text: null };
  }

  if (intent.kind !== "clause" || !intent.clauseKey) {
    return { intent, fact: null, text: null };
  }

  // The reader's own policy always wins over the published wording.
  const fromAudit = sources.ownAnalysis
    ? resolveFromAudit(sources.ownAnalysis, intent.clauseKey)
    : null;
  if (fromAudit && fromAudit.verdict !== "unknown") {
    return { intent, fact: fromAudit, text: renderClauseAnswer(fromAudit) };
  }

  const fromCatalog = sources.catalogRow
    ? resolveFromCatalogProfile(sources.catalogRow, intent.clauseKey)
    : null;
  if (fromCatalog && fromCatalog.verdict !== "unknown") {
    return { intent, fact: fromCatalog, text: renderClauseAnswer(fromCatalog) };
  }

  // An explicit "your document does not say" beats a model guess, so a known
  // gap is still returned rather than escalated.
  const fallback = fromAudit ?? fromCatalog;
  if (fallback) return { intent, fact: fallback, text: renderClauseAnswer(fallback) };

  return { intent, fact: null, text: null };
}
