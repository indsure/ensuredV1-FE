/**
 * Coverage Adequacy Dimension Scorer
 * Evaluates sum insured, restoration benefit, and coverage breadth
 */

import type { ExtractedPolicy } from '../../types/policy';
import type { UserProfile, DimensionScore } from '../../types/scoring';

export function scoreCoverageAdequacy(
  policy: ExtractedPolicy,
  userProfile: UserProfile
): DimensionScore {
  const inputs: Record<string, any> = {
    sum_insured: policy.sum_insured,
    restoration_benefit: policy.restoration_benefit,
    city_tier: userProfile.city_tier,
    coverage_need: userProfile.coverage_need,
  };
  
  // If sum_insured is missing, we can't score
  if (policy.sum_insured === null) {
    return {
      dimension_id: 'coverage_adequacy',
      raw_score: 50,
      weighted_score: 0, // Will be calculated by engine
      data_confidence: 'UNAVAILABLE',
      reasoning: 'Sum insured not specified in document',
      inputs_used: inputs,
    };
  }
  
  const sumInsured = policy.sum_insured;
  let baseScore = 0;
  
  // Base scoring curve (for METRO/TIER_1)
  // Research §9.2.1: ₹5L = 40, ₹10L = 70, ₹20L = 90, ₹50L+ = 100
  if (sumInsured >= 5000000) {
    baseScore = 100;
  } else if (sumInsured >= 2000000) {
    baseScore = 90;
  } else if (sumInsured >= 1000000) {
    baseScore = 70;
  } else if (sumInsured >= 500000) {
    baseScore = 40;
  } else if (sumInsured >= 300000) {
    baseScore = 20;
  } else {
    baseScore = 10;
  }
  
  // Adjust for city tier (lower bar for tier 2/3)
  if (userProfile.city_tier === 'TIER_2' || userProfile.city_tier === 'TIER_3') {
    baseScore = Math.min(100, baseScore + 10);
  }
  
  // Bonus for restoration benefit
  if (policy.restoration_benefit === true) {
    baseScore = Math.min(100, baseScore + 10);
  }
  
  // Adjust for coverage need
  if (userProfile.coverage_need === 'FAMILY_KIDS' || userProfile.coverage_need === 'MULTI_GEN') {
    // Higher bar for families
    if (sumInsured < 1000000) {
      baseScore = Math.max(0, baseScore - 15);
    }
  }
  
  const confidence = policy.extraction_confidence === 'HIGH' ? 'HIGH' : 'MEDIUM';
  
  const reasoning = `Sum insured of ₹${(sumInsured / 100000).toFixed(1)}L scores ${baseScore}/100. ${
    policy.restoration_benefit ? 'Includes restoration benefit (+10).' : 'No restoration benefit.'
  } ${
    userProfile.city_tier === 'TIER_2' || userProfile.city_tier === 'TIER_3'
      ? 'Adjusted for tier 2/3 city (+10).'
      : ''
  }`;
  
  return {
    dimension_id: 'coverage_adequacy',
    raw_score: baseScore,
    weighted_score: 0,
    data_confidence: confidence,
    reasoning,
    inputs_used: inputs,
  };
}
