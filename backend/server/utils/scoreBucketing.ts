/**
 * Score Bucketing Utility
 * 
 * Reduces score variance by rounding to 12.5-point intervals.
 * This creates 9 possible score values: 0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100
 * 
 * Benefits:
 * - Reduces switching between runs (91% reduction in possible values)
 * - Maintains meaningful differentiation between policies
 * - Signals to users that scores are categories, not precise measurements
 */

export interface BucketedScore {
  display_score: number;      // Bucketed score for display (0, 12.5, 25, etc.)
  raw_score: number;           // Original calculated score
  bucket_label: string;        // Human-readable label
  bucketing_method: string;    // "nearest_12.5"
}

/**
 * Bucket a raw score to the nearest 12.5-point interval
 */
export function bucketScore(rawScore: number): number {
  // Round to nearest 12.5
  const bucketed = Math.round(rawScore / 12.5) * 12.5;
  
  // Ensure it's within 0-100 range
  return Math.max(0, Math.min(100, bucketed));
}

/**
 * Get human-readable label for a bucketed score
 */
export function getScoreLabel(bucketedScore: number): string {
  const labels: Record<number, string> = {
    0: "Critical",
    12.5: "Very Poor",
    25: "Poor",
    37.5: "Below Average",
    50: "Marginal",
    62.5: "Adequate",
    75: "Good",
    87.5: "Very Good",
    100: "Excellent"
  };
  
  return labels[bucketedScore] || "Unknown";
}

/**
 * Get bucket boundaries for a given score
 */
export function getBucketBoundaries(bucketedScore: number): { min: number; max: number } {
  const boundaries: Record<number, { min: number; max: number }> = {
    0: { min: 0, max: 6.24 },
    12.5: { min: 6.25, max: 18.74 },
    25: { min: 18.75, max: 31.24 },
    37.5: { min: 31.25, max: 43.74 },
    50: { min: 43.75, max: 56.24 },
    62.5: { min: 56.25, max: 68.74 },
    75: { min: 68.75, max: 81.24 },
    87.5: { min: 81.25, max: 93.74 },
    100: { min: 93.75, max: 100 }
  };
  
  return boundaries[bucketedScore] || { min: 0, max: 100 };
}

/**
 * Apply bucketing to an audit score object
 */
export function applyScoreBucketing(auditScore: any): any {
  if (!auditScore || typeof auditScore.score !== "number") {
    return auditScore;
  }
  
  const rawScore = auditScore.score;
  const displayScore = bucketScore(rawScore);
  const label = getScoreLabel(displayScore);
  
  return {
    ...auditScore,
    score: displayScore,           // Replace with bucketed score
    raw_score: rawScore,            // Preserve original for debugging
    bucket_label: label,            // Add human-readable label
    bucketing_method: "nearest_12.5" // Document the method used
  };
}

/**
 * Get explanation text for score bucketing
 */
export function getBucketingExplanation(): string {
  return "Scores are grouped in 12.5-point intervals to reflect policy assessment confidence levels and reduce variance between analyses.";
}

/**
 * Validate that a score is a valid bucket value
 */
export function isValidBucketScore(score: number): boolean {
  const validScores = [0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100];
  return validScores.includes(score);
}
