/**
 * Score bucketing.
 *
 * Raw scores are rounded to the nearest 5 points, which gives 21 possible
 * values. A policy score is a band, not a measurement to two decimal places,
 * and rounding says so on the face of the number.
 *
 * 2026-09-11: the interval was 12.5, which produced the odd-looking 37.5 / 62.5
 * / 87.5 and, because `clients.score` is an integer column, was silently
 * re-rounded on the way into the database so the stored score disagreed with
 * the report by half a point. Every 5-step value is already an integer, so that
 * second rounding is now a no-op.
 *
 * A note on what this does NOT do: the old comment claimed bucketing "reduces
 * variance between analyses". It does not, much. The same policy has been
 * observed scoring 87, 87, 95, 100 and 100 raw across five runs, and a spread
 * that wide crosses 12.5 boundaries just as easily as 5-point ones. The cure
 * for run-to-run variance is deterministic scoring (compute the wording
 * penalties in code rather than asking the model for them), not coarser
 * rounding. Rounding only stops us implying a precision we do not have.
 *
 * getBucketBoundaries() and isValidBucketScore() used to live here. Both were
 * exported, both were hard-coded to the nine 12.5-step values, and both were
 * called by nothing. Left in place they would have returned confident wrong
 * answers the moment anyone wired them up.
 */

/** The rounding interval, in points. */
export const BUCKET_STEP = 5;

export interface BucketedScore {
  display_score: number;      // Bucketed score for display (0, 5, 10, ... 100)
  raw_score: number;           // Original calculated score
  bucket_label: string;        // Human-readable label
  bucketing_method: string;    // "nearest_5"
}

/** Round a raw score to the nearest bucket, clamped to 0-100. */
export function bucketScore(rawScore: number): number {
  if (!Number.isFinite(rawScore)) return 0;
  const bucketed = Math.round(rawScore / BUCKET_STEP) * BUCKET_STEP;
  return Math.max(0, Math.min(100, bucketed));
}

/**
 * Human-readable label for a score.
 *
 * A threshold ladder, not a lookup on exact bucket values: at 5-point steps an
 * exact-match table would return "Unknown" for 85, 90, 45 and most other real
 * scores. The thresholds are chosen so every score from the old 12.5 grid keeps
 * the label it has today (87.5 is still "Very Good", 62.5 still "Adequate"),
 * because stored reports carry no ruleset version and would otherwise change
 * wording under the reader.
 */
export function getScoreLabel(score: number): string {
  if (!Number.isFinite(score)) return "Unknown";
  if (score >= 95) return "Excellent";
  if (score >= 85) return "Very Good";
  if (score >= 75) return "Good";
  if (score >= 60) return "Adequate";
  if (score >= 50) return "Marginal";
  if (score >= 35) return "Below Average";
  if (score >= 25) return "Poor";
  if (score >= 10) return "Very Poor";
  return "Critical";
}

/** Apply bucketing to an audit score object. */
export function applyScoreBucketing(auditScore: any): any {
  if (!auditScore || typeof auditScore.score !== "number") {
    return auditScore;
  }

  const rawScore = auditScore.score;
  const displayScore = bucketScore(rawScore);

  return {
    ...auditScore,
    score: displayScore,            // Replace with bucketed score
    raw_score: rawScore,            // Preserve original for debugging
    bucket_label: getScoreLabel(displayScore),
    bucketing_method: `nearest_${BUCKET_STEP}`,
  };
}

/** Explanation text, shown to the reader as a confidence note. */
export function getBucketingExplanation(): string {
  return `Scores are rounded to the nearest ${BUCKET_STEP} points, because a policy score is a band rather than a precise measurement. Two policies ${BUCKET_STEP} points apart are not meaningfully different.`;
}
