import { ADD_ON_FINDINGS_KEY, type AddOnScan, type AddOnFinding } from "./motorAddOns";

/**
 * A score out of 100 for a motor policy, built from the add-on scan.
 *
 * Health policies score out of 100 from the forensic audit. Motor policies had
 * no score at all, which is why a book of them showed an empty column. This
 * puts them on the same scale so the platform reads consistently.
 *
 * THE SCALE IS SHARED, THE MEANING IS NOT. A health 72 is a judgement about
 * wording: waiting periods, room caps, exclusions. A motor 72 is a statement
 * about how completely the vehicle is covered. They are not comparable, and any
 * surface showing both owes the reader a line saying what the number measures.
 * That is a copy obligation this module cannot discharge on its own.
 *
 * WEIGHTS
 * Own damage counts double; every add-on counts one. That is the founder's
 * call and it is the right shape: own damage is not an add-on, it is whether
 * the customer's own vehicle is covered at all. A third-party-only policy is
 * legal and is also the difference between a repaired car and an unrepaired
 * one, so it cannot sit level with tyre protection.
 *
 * WHAT IS DELIBERATELY NOT COUNTED
 * Anything we could not read. The scan reports four states, and two of them
 * (`not_found`, `check_manually`) mean OUR reader was unsure, not that the
 * customer lacks the cover. Scoring those as zero would mark a policy down for
 * our own uncertainty and print the result as a fact, which is the exact fault
 * the plan-name provenance work exists to prevent. They leave the denominator
 * instead, and `setAside` says how many, so the card can be honest that the
 * score was computed over less than the full list.
 *
 * NOT YET MODELLED: vehicle age. Zero depreciation is generally unavailable
 * past about five years and return-to-invoice past about three, so an old car
 * is currently marked down for not carrying cover it could not buy. Fixing that
 * needs per-insurer age limits, which are a founder decision and a public claim
 * the moment a report is forwarded, so they are not invented here. See
 * APPLICABILITY_NOT_MODELLED below.
 */

/** Own damage is worth two add-ons. The founder's weighting. */
export const OWN_DAMAGE_WEIGHT = 2;
export const ADD_ON_WEIGHT = 1;

/**
 * How much of the add-on list must be decidable before a number is published.
 *
 * Leaving unreadable add-ons out of the denominator is right on its own: a
 * policy should not be marked down because OUR reader failed. But taken alone
 * it produces a number that is true of the fragment we read and false of the
 * policy. A real Acko document showed one add-on of nine and was published as
 * 100 out of 100, "Strong cover", because the other eight had left the
 * denominator.
 *
 * So there are two gates, and both have to hold. The add-ons we could read stay
 * out of the denominator, AND we only publish at all when we read enough of the
 * list for the result to describe the policy rather than the fragment. Half is
 * the line. Below it the honest output is no score, which is a different
 * statement from a low score and is said differently on the card.
 */
export const MIN_DECIDABLE_SHARE = 0.5;

/**
 * The known gap, named so it cannot be forgotten.
 *
 * Applicability today means "in the catalog for this vehicle class" (car or
 * bike), which the scan already computes. It does NOT mean "this vehicle can
 * actually buy this cover". Until the age limits are decided, a 2011 hatchback
 * scores lower than a 2024 one for reasons its owner cannot act on.
 */
export const APPLICABILITY_NOT_MODELLED = "vehicle_age" as const;

export type OwnDamageState = "covered" | "not_covered" | "unknown";

export interface MotorScore {
  /** 0-100, or null when nothing could be determined at all. */
  score: number | null;
  ownDamage: OwnDamageState;
  /** Weight earned, and weight that was actually decidable. */
  earned: number;
  possible: number;
  /** Add-ons that counted, and those left out because we could not read them. */
  counted: number;
  setAside: number;
}

/** Phrases in `coverage_type` that mean the vehicle itself is covered. */
const COMPREHENSIVE_WORDS = /(comprehensive|bundled|package|own\s*damage|\bod\b|standalone\s*od)/i;
/** Phrases that mean only the other party is covered. */
const THIRD_PARTY_ONLY_WORDS = /(third[\s-]*party\s*only|liability\s*only|\btp\s*only\b|act\s*only)/i;

/**
 * Is the customer's own vehicle covered?
 *
 * Two independent signals, because either alone is weak. `coverage_type` is
 * what the document called itself and can be a marketing name. The own-damage
 * premium is arithmetic: an insurer that charged for own damage has sold own
 * damage. When they disagree, the money wins. When neither reads, say so
 * instead of assuming the cheaper answer, because guessing "not covered" tells
 * a customer their car is uninsured on no evidence.
 */
export function readOwnDamage(
  scan: AddOnScan | null | undefined,
  coverageType: string | null | undefined,
): OwnDamageState {
  const paidForOwnDamage = !!scan?.arithmetic && scan.arithmetic.basicOd > 0;
  if (paidForOwnDamage) return "covered";

  const text = (coverageType ?? "").trim();
  if (text) {
    // Order matters: "third party only" contains no comprehensive word, but a
    // "Package (Third Party + Own Damage)" contains both, so the narrower
    // exclusion is tested first only when the inclusive words are absent.
    if (COMPREHENSIVE_WORDS.test(text)) return "covered";
    if (THIRD_PARTY_ONLY_WORDS.test(text)) return "not_covered";
  }

  return "unknown";
}

/** A finding we can score: we either proved it is there or proved it is not. */
function isDecidable(f: AddOnFinding): boolean {
  return f.state === "present" || f.state === "absent_proven";
}

/**
 * Score a motor policy out of 100.
 *
 * Returns null when nothing was decidable, rather than 0. A policy we could not
 * read is not a policy that scores zero, and the difference matters to whoever
 * is reading the number.
 */
export function scoreMotorPolicy(
  scan: AddOnScan | null | undefined,
  coverageType: string | null | undefined,
): MotorScore {
  const ownDamage = readOwnDamage(scan, coverageType);

  let earned = 0;
  let possible = 0;

  if (ownDamage !== "unknown") {
    possible += OWN_DAMAGE_WEIGHT;
    if (ownDamage === "covered") earned += OWN_DAMAGE_WEIGHT;
  }

  const findings = scan?.findings ?? [];
  const decidable = findings.filter(isDecidable);
  const counted = decidable.length;
  for (const f of decidable) {
    possible += ADD_ON_WEIGHT;
    if (f.state === "present") earned += ADD_ON_WEIGHT;
  }

  /* A score has to describe the policy, not the fragment we could read.

     Two conditions, both required. At least one add-on must be decidable, so
     the number is never own damage alone dressed up as a full reading. And a
     MAJORITY of the applicable list must be decidable, so a document we mostly
     failed to read cannot publish a confident number over the sliver we
     managed. See MIN_DECIDABLE_SHARE for what went wrong without the second.

     Null means "we could not read enough". The card says that in words, and it
     is not the same statement as a low score. */
  const applicable = scan?.applicable ?? findings.length;
  const readEnough = applicable > 0 && counted / applicable >= MIN_DECIDABLE_SHARE;
  const scoreable = counted > 0 && readEnough && possible > 0;

  return {
    score: scoreable ? Math.round((earned / possible) * 100) : null,
    ownDamage,
    earned,
    possible,
    counted,
    setAside: findings.length - decidable.length,
  };
}

/**
 * One line saying what the number means, for any surface that shows it beside a
 * health score. Kept here so the wording cannot drift between the policy card,
 * the list and a shared report.
 */
export function motorScoreCaption(s: MotorScore): string {
  if (s.score === null) {
    /* Own damage may still be known even when nothing is scoreable, and it is
       the single most useful fact about a motor policy, so say it rather than
       withholding everything. */
    const od =
      s.ownDamage === "covered"
        ? "Own damage is covered. "
        : s.ownDamage === "not_covered"
        ? "This is third-party only: own damage is not covered. "
        : "";
    return `${od}We could not read the add-on cover on this document, so it is not scored.`;
  }
  const base =
    s.ownDamage === "covered"
      ? "Own damage covered"
      : s.ownDamage === "not_covered"
      ? "Third-party only, own damage not covered"
      : "Own damage could not be read";
  const addOns = `${s.counted === 0 ? "no" : s.counted} add-on${s.counted === 1 ? "" : "s"} checked`;
  const aside = s.setAside > 0 ? `, ${s.setAside} left out as unreadable` : "";
  return `${base}. ${addOns}${aside}. This measures how completely the vehicle is covered, not the quality of the wording.`;
}

/**
 * The score to store on a policy row, straight from its extracted data.
 *
 * One helper, used by every write path, so the advisor's copy of a policy and
 * the consumer's copy of the same document cannot end up scored differently.
 * Returns null for anything that is not motor, and for a motor policy nothing
 * could be read from: `score` is nullable in both tables and null means "no
 * score", which is the truth in both cases.
 *
 * Never throws. A scoring fault must not fail an extraction that otherwise
 * succeeded, because the fields are worth more to the agent than the number is.
 */
export function scoreFromExtractedData(
  insuranceType: string | null | undefined,
  data: Record<string, any> | null | undefined,
): number | null {
  if (insuranceType !== "motor" || !data) return null;
  try {
    const scan = data[ADD_ON_FINDINGS_KEY] as AddOnScan | undefined;
    const coverageType = typeof data.coverage_type === "string" ? data.coverage_type : null;
    return scoreMotorPolicy(scan ?? null, coverageType).score;
  } catch {
    return null;
  }
}
