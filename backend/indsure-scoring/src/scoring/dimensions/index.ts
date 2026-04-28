/**
 * All Dimension Scorers
 */

import type { ExtractedPolicy } from '../../types/policy';
import type { UserProfile, DimensionScore, InsurerSnapshot } from '../../types/scoring';

export { scoreCoverageAdequacy } from './coverage-adequacy';
export { scoreCost } from './cost';
export { scoreWaitingPeriods } from './waiting-periods';

// Simplified implementations for remaining dimensions

export function scoreExclusionsSublimits(
  policy: ExtractedPolicy,
  _userProfile: UserProfile
): DimensionScore {
  const inputs = {
    sub_limits: policy.sub_limits,
    permanent_exclusions: policy.permanent_exclusions,
  };
  
  if (!policy.sub_limits && !policy.permanent_exclusions) {
    return {
      dimension_id: 'exclusions_sublimits',
      raw_score: 50,
      weighted_score: 0,
      data_confidence: 'UNAVAILABLE',
      reasoning: 'Sub-limits and exclusions not specified',
      inputs_used: inputs,
    };
  }
  
  let score = 100;
  
  // Penalize per sub-limit
  if (policy.sub_limits) {
    score -= policy.sub_limits.length * 10;
  }
  
  // Penalize unusual exclusions
  if (policy.permanent_exclusions && policy.permanent_exclusions.length > 10) {
    score -= 20;
  }
  
  score = Math.max(0, score);
  
  return {
    dimension_id: 'exclusions_sublimits',
    raw_score: score,
    weighted_score: 0,
    data_confidence: 'MEDIUM',
    reasoning: `${policy.sub_limits?.length || 0} sub-limits, ${policy.permanent_exclusions?.length || 0} exclusions`,
    inputs_used: inputs,
  };
}

export function scoreMaternityFamilyFit(
  policy: ExtractedPolicy,
  userProfile: UserProfile
): DimensionScore {
  const inputs = {
    maternity_covered: policy.maternity_covered,
    maternity_limit: policy.maternity_limit,
    newborn_covered: policy.newborn_covered,
    coverage_need: userProfile.coverage_need,
  };
  
  // Only material for families
  const isFamilyNeed = userProfile.coverage_need === 'SELF_SPOUSE' || 
                       userProfile.coverage_need === 'FAMILY_KIDS';
  
  if (!isFamilyNeed) {
    return {
      dimension_id: 'maternity_family_fit',
      raw_score: 50,
      weighted_score: 0,
      data_confidence: 'HIGH',
      reasoning: 'Not applicable for your coverage need',
      inputs_used: inputs,
    };
  }
  
  if (policy.maternity_covered === null) {
    return {
      dimension_id: 'maternity_family_fit',
      raw_score: 50,
      weighted_score: 0,
      data_confidence: 'UNAVAILABLE',
      reasoning: 'Maternity coverage not specified',
      inputs_used: inputs,
    };
  }
  
  let score = policy.maternity_covered ? 80 : 20;
  
  if (policy.maternity_covered && policy.maternity_limit && policy.maternity_limit >= 50000) {
    score = 100;
  }
  
  if (policy.newborn_covered) {
    score = Math.min(100, score + 10);
  }
  
  return {
    dimension_id: 'maternity_family_fit',
    raw_score: score,
    weighted_score: 0,
    data_confidence: 'MEDIUM',
    reasoning: `Maternity ${policy.maternity_covered ? 'covered' : 'not covered'}${policy.maternity_limit ? ` up to ₹${policy.maternity_limit.toLocaleString()}` : ''}`,
    inputs_used: inputs,
  };
}

export function scoreInsurerClaimPerformance(
  _policy: ExtractedPolicy,
  _userProfile: UserProfile,
  insurerData: InsurerSnapshot | null
): DimensionScore {
  const inputs = {
    insurer_id: insurerData?.insurer_id,
    csr_count: insurerData?.csr_count,
    icr: insurerData?.icr,
  };
  
  if (!insurerData) {
    return {
      dimension_id: 'insurer_claim_performance',
      raw_score: 50,
      weighted_score: 0,
      data_confidence: 'UNAVAILABLE',
      reasoning: 'Insurer not identified',
      inputs_used: inputs,
    };
  }
  
  // Blend CSR and ICR
  let score = 50;
  let reasoning = '';
  
  if (insurerData.csr_count) {
    const csr = insurerData.csr_count.value;
    // CSR: >98% = 100, >95% = 80, >90% = 60, <90% = 40
    if (csr >= 98) score = 100;
    else if (csr >= 95) score = 80;
    else if (csr >= 90) score = 60;
    else score = 40;
    
    reasoning = `CSR ${csr.toFixed(2)}% (${insurerData.csr_count.band}) for ${insurerData.csr_count.fy}. `;
  }
  
  if (insurerData.icr) {
    const icr = insurerData.icr.value;
    let icrScore = 0;
    
    // ICR: <70% = 100, 70-80% = 80, 80-90% = 60, >90% = 40
    if (icr < 70) icrScore = 100;
    else if (icr < 80) icrScore = 80;
    else if (icr < 90) icrScore = 60;
    else icrScore = 40;
    
    score = (score + icrScore) / 2;
    reasoning += `ICR ${icr.toFixed(2)}% (${insurerData.icr.band}).`;
  }
  
  return {
    dimension_id: 'insurer_claim_performance',
    raw_score: Math.round(score),
    weighted_score: 0,
    data_confidence: insurerData.csr_count || insurerData.icr ? 'MEDIUM' : 'LOW',
    reasoning: reasoning || 'No claim performance data available',
    inputs_used: inputs,
  };
}

export function scoreInsurerComplaintRate(
  _policy: ExtractedPolicy,
  _userProfile: UserProfile,
  insurerData: InsurerSnapshot | null
): DimensionScore {
  const inputs = {
    insurer_id: insurerData?.insurer_id,
    complaints_normalized: insurerData?.complaints_normalized,
  };
  
  if (!insurerData || !insurerData.complaints_normalized) {
    return {
      dimension_id: 'insurer_complaint_rate',
      raw_score: 50,
      weighted_score: 0,
      data_confidence: 'UNAVAILABLE',
      reasoning: 'Complaint data not available',
      inputs_used: inputs,
    };
  }
  
  const complaints = insurerData.complaints_normalized.value;
  
  // Lower complaints = better
  // <5 per 10k = 100, <10 = 80, <20 = 60, >20 = 40
  let score = 0;
  if (complaints < 5) score = 100;
  else if (complaints < 10) score = 80;
  else if (complaints < 20) score = 60;
  else score = 40;
  
  return {
    dimension_id: 'insurer_complaint_rate',
    raw_score: score,
    weighted_score: 0,
    data_confidence: 'MEDIUM',
    reasoning: `${complaints.toFixed(1)} complaints per 10k policies (${insurerData.complaints_normalized.band})`,
    inputs_used: inputs,
  };
}

export function scoreInsurerFinancialHealth(
  _policy: ExtractedPolicy,
  _userProfile: UserProfile,
  insurerData: InsurerSnapshot | null
): DimensionScore {
  const inputs = {
    insurer_id: insurerData?.insurer_id,
    solvency: insurerData?.solvency,
  };
  
  if (!insurerData || !insurerData.solvency) {
    return {
      dimension_id: 'insurer_financial_health',
      raw_score: 50,
      weighted_score: 0,
      data_confidence: 'UNAVAILABLE',
      reasoning: 'Solvency data not available',
      inputs_used: inputs,
    };
  }
  
  const solvency = insurerData.solvency.value;
  
  // IRDAI minimum is 150%. Higher = better
  // >200% = 100, >175% = 80, >150% = 60, <150% = 20
  let score = 0;
  if (solvency >= 200) score = 100;
  else if (solvency >= 175) score = 80;
  else if (solvency >= 150) score = 60;
  else score = 20;
  
  return {
    dimension_id: 'insurer_financial_health',
    raw_score: score,
    weighted_score: 0,
    data_confidence: 'HIGH',
    reasoning: `Solvency ratio ${solvency.toFixed(0)}% (${insurerData.solvency.band})`,
    inputs_used: inputs,
  };
}

export function scoreNetworkStrength(
  policy: ExtractedPolicy,
  userProfile: UserProfile,
  insurerData: InsurerSnapshot | null
): DimensionScore {
  const inputs = {
    cashless_hospitals_count: policy.cashless_hospitals_count,
    network_count: insurerData?.network_count,
    city_tier: userProfile.city_tier,
  };
  
  const networkCount = insurerData?.network_count?.value || policy.cashless_hospitals_count;
  
  if (!networkCount) {
    return {
      dimension_id: 'network_strength',
      raw_score: 50,
      weighted_score: 0,
      data_confidence: 'UNAVAILABLE',
      reasoning: 'Network size not specified',
      inputs_used: inputs,
    };
  }
  
  // >10k = 100, >7k = 80, >5k = 60, <5k = 40
  let score = 0;
  if (networkCount >= 10000) score = 100;
  else if (networkCount >= 7000) score = 80;
  else if (networkCount >= 5000) score = 60;
  else score = 40;
  
  return {
    dimension_id: 'network_strength',
    raw_score: score,
    weighted_score: 0,
    data_confidence: 'LOW', // Always LOW per research (unaudited)
    reasoning: `${networkCount.toLocaleString()} network hospitals (unaudited)`,
    inputs_used: inputs,
  };
}

export function scoreRenewalTerms(
  _policy: ExtractedPolicy,
  _userProfile: UserProfile
): DimensionScore {
  const inputs = {
    // Would check renewal/portability fields if available
  };
  
  // Simplified: assume lifetime renewability is baseline
  return {
    dimension_id: 'renewal_terms',
    raw_score: 70,
    weighted_score: 0,
    data_confidence: 'LOW',
    reasoning: 'Renewal terms not explicitly extracted',
    inputs_used: inputs,
  };
}
