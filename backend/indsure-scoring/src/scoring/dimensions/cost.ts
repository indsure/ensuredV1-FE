/**
 * Cost Dimension Scorer
 * Evaluates premium affordability and value for money
 */

import type { ExtractedPolicy } from '../../types/policy';
import type { UserProfile, DimensionScore } from '../../types/scoring';

export function scoreCost(
  policy: ExtractedPolicy,
  userProfile: UserProfile
): DimensionScore {
  const inputs: Record<string, any> = {
    annual_premium: policy.annual_premium,
    sum_insured: policy.sum_insured,
    copay_percent: policy.copay_percent,
    room_rent_limit: policy.room_rent_limit,
  };
  
  if (policy.annual_premium === null || policy.sum_insured === null) {
    return {
      dimension_id: 'cost',
      raw_score: 50,
      weighted_score: 0,
      data_confidence: 'UNAVAILABLE',
      reasoning: 'Premium or sum insured not specified',
      inputs_used: inputs,
    };
  }
  
  // Calculate premium per ₹1L cover
  const premiumPer1L = (policy.annual_premium / policy.sum_insured) * 100000;
  
  let score = 0;
  
  // Scoring curve: Lower premium per 1L = better
  // ₹2000/1L = 100, ₹4000/1L = 70, ₹6000/1L = 40, ₹10000/1L = 10
  if (premiumPer1L <= 2000) {
    score = 100;
  } else if (premiumPer1L <= 4000) {
    score = 70 + ((4000 - premiumPer1L) / 2000) * 30;
  } else if (premiumPer1L <= 6000) {
    score = 40 + ((6000 - premiumPer1L) / 2000) * 30;
  } else if (premiumPer1L <= 10000) {
    score = 10 + ((10000 - premiumPer1L) / 4000) * 30;
  } else {
    score = 10;
  }
  
  // Penalize co-pay
  if (policy.copay_percent && policy.copay_percent > 0) {
    score = Math.max(0, score - (policy.copay_percent * 2));
  }
  
  // Penalize room rent caps for metro users
  if (userProfile.city_tier === 'METRO' && policy.room_rent_limit) {
    const limit = typeof policy.room_rent_limit === 'number' ? policy.room_rent_limit : 0;
    if (limit > 0 && limit < 5000) {
      score = Math.max(0, score - 10);
    }
  }
  
  const reasoning = `Premium of ₹${policy.annual_premium.toLocaleString()} for ₹${(policy.sum_insured / 100000).toFixed(1)}L cover = ₹${premiumPer1L.toFixed(0)}/1L. ${
    policy.copay_percent ? `Co-pay of ${policy.copay_percent}% reduces score.` : ''
  }`;
  
  return {
    dimension_id: 'cost',
    raw_score: Math.round(score),
    weighted_score: 0,
    data_confidence: policy.extraction_confidence === 'HIGH' ? 'HIGH' : 'MEDIUM',
    reasoning,
    inputs_used: inputs,
  };
}
