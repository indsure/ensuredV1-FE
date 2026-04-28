/**
 * Waiting Periods Dimension Scorer
 * Evaluates PED, specific illness, and maternity waiting periods
 */

import type { ExtractedPolicy } from '../../types/policy';
import type { UserProfile, DimensionScore } from '../../types/scoring';

export function scoreWaitingPeriods(
  policy: ExtractedPolicy,
  userProfile: UserProfile
): DimensionScore {
  const inputs: Record<string, any> = {
    ped_waiting_months: policy.ped_waiting_months,
    specific_illness_waiting_months: policy.specific_illness_waiting_months,
    maternity_waiting_months: policy.maternity_waiting_months,
    pre_existing: userProfile.pre_existing,
  };
  
  let score = 50; // Neutral baseline
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNAVAILABLE' = 'MEDIUM';
  let reasoning = '';
  
  const hasPED = userProfile.pre_existing.length > 0;
  
  // PED waiting period (most critical if user has pre-existing)
  if (policy.ped_waiting_months !== null) {
    const pedMonths = policy.ped_waiting_months;
    
    // IRDAI cap is 36 months
    // ≤24 = excellent (100), 36 = good (70), >36 = concerning (30)
    if (pedMonths <= 24) {
      score = 100;
    } else if (pedMonths <= 36) {
      score = 70;
    } else {
      score = 30;
    }
    
    // Heavy weight if user has PED
    if (hasPED) {
      reasoning = `PED waiting of ${pedMonths} months is critical for your pre-existing conditions. `;
    } else {
      reasoning = `PED waiting of ${pedMonths} months. `;
    }
    
    confidence = 'HIGH';
  } else {
    reasoning = 'PED waiting period not specified. ';
    confidence = 'UNAVAILABLE';
  }
  
  // Specific illness waiting
  if (policy.specific_illness_waiting_months !== null) {
    const siMonths = policy.specific_illness_waiting_months;
    let siScore = 0;
    
    if (siMonths <= 12) {
      siScore = 90;
    } else if (siMonths <= 24) {
      siScore = 70;
    } else {
      siScore = 40;
    }
    
    // Blend with PED score
    score = (score + siScore) / 2;
    reasoning += `Specific illness waiting: ${siMonths} months. `;
  }
  
  return {
    dimension_id: 'waiting_periods',
    raw_score: Math.round(score),
    weighted_score: 0,
    data_confidence: confidence,
    reasoning: reasoning.trim(),
    inputs_used: inputs,
  };
}
