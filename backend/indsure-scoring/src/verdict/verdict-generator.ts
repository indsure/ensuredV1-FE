/**
 * Verdict Generator - Converts scored policies into human-readable insights
 */

import type { ScoredPolicy } from '../types/scoring';
import type { Verdict, PolicyInsight } from '../types/verdict';

const DISCLAIMERS = [
  'AI analysis based on uploaded documents and public IRDAI data. Not personalized financial advice.',
  'Insurer-level statistics are at company level, not plan-specific. Two products from the same insurer share the same track record data.',
  'Data freshness: Insurer claim and complaint data sourced from IRDAI Annual Report FY 2023-24, the most recent available.',
];

/**
 * Generate verdict from scored policies
 */
export function generateVerdict(scoredPolicies: ScoredPolicy[]): Verdict {
  if (scoredPolicies.length === 0) {
    throw new Error('No policies to generate verdict for');
  }
  
  // Check for tie
  const tieWarning = scoredPolicies.length >= 2 &&
    Math.abs(scoredPolicies[0].total_score - scoredPolicies[1].total_score) <= 5;
  
  // Generate headline
  const headline = generateHeadline(scoredPolicies, tieWarning);
  
  // Winner ID
  const winnerId = tieWarning ? null : scoredPolicies[0].policy.policy_id;
  
  // Confidence label
  const confidenceLabel = generateConfidenceLabel(scoredPolicies);
  
  // Reasoning bullets
  const reasoningBullets = generateReasoningBullets(scoredPolicies, tieWarning);
  
  // Tradeoff bullet
  const tradeoffBullet = generateTradeoffBullet(scoredPolicies[0]);
  
  // Per-policy insights
  const perPolicyInsights = scoredPolicies.map((sp) => generatePolicyInsight(sp));
  
  // Data freshness
  const dataFreshness = 'Insurer data as of FY 2023-24 IRDAI report';
  
  // Add quote-level disclaimer if needed
  const disclaimers = [...DISCLAIMERS];
  const hasQuotes = scoredPolicies.some((sp) => sp.policy.document_type === 'QUOTE');
  if (hasQuotes) {
    disclaimers.splice(2, 0, 'Some policies were analyzed from quote documents only. Full policy wordings may contain additional terms.');
  }
  
  return {
    headline,
    winner_id: winnerId,
    tie_warning: tieWarning,
    confidence_label: confidenceLabel,
    reasoning_bullets: reasoningBullets,
    tradeoff_bullet: tradeoffBullet,
    per_policy_insights: perPolicyInsights,
    data_freshness: dataFreshness,
    disclaimers,
  };
}

function generateHeadline(scoredPolicies: ScoredPolicy[], tieWarning: boolean): string {
  if (tieWarning) {
    const p1 = scoredPolicies[0].insurer_data.brand_name;
    const p2 = scoredPolicies[1].insurer_data.brand_name;
    return `${p1} and ${p2} are statistically similar. The choice depends on your soft preferences.`;
  }
  
  const winner = scoredPolicies[0];
  const winnerName = winner.insurer_data.brand_name;
  
  if (scoredPolicies.length === 1) {
    return `${winnerName} scores ${winner.total_score}/100 overall.`;
  }
  
  // Find what winner excels at
  const topDimensions = winner.dimension_scores
    .filter((d) => d.raw_score >= 80)
    .sort((a, b) => b.raw_score - a.raw_score)
    .slice(0, 2)
    .map((d) => d.dimension_id.replace(/_/g, ' '));
  
  const runner = scoredPolicies[1];
  const runnerName = runner.insurer_data.brand_name;
  
  if (topDimensions.length > 0) {
    return `${winnerName} wins on ${topDimensions.join(' and ')}; ${runnerName} is ${
      runner.policy.annual_premium && winner.policy.annual_premium &&
      runner.policy.annual_premium < winner.policy.annual_premium
        ? 'significantly cheaper'
        : 'a close alternative'
    }.`;
  }
  
  return `${winnerName} scores ${winner.total_score}/100, ahead of ${runnerName} at ${runner.total_score}/100.`;
}

function generateConfidenceLabel(scoredPolicies: ScoredPolicy[]): string {
  const avgConfidence = scoredPolicies.reduce((sum, sp) => {
    const conf = sp.confidence_overall === 'HIGH' ? 3 : sp.confidence_overall === 'MEDIUM' ? 2 : 1;
    return sum + conf;
  }, 0) / scoredPolicies.length;
  
  if (avgConfidence >= 2.5) {
    return 'High confidence — full policies parsed';
  } else if (avgConfidence >= 1.5) {
    return 'Medium confidence — quote-level data';
  } else {
    return 'Low confidence — limited data available';
  }
}

function generateReasoningBullets(scoredPolicies: ScoredPolicy[], tieWarning: boolean): string[] {
  const bullets: string[] = [];
  
  if (tieWarning) {
    // Parallel comparison for ties
    const p1 = scoredPolicies[0];
    const p2 = scoredPolicies[1];
    
    bullets.push(`Both score similarly: ${p1.insurer_data.brand_name} ${p1.total_score}/100, ${p2.insurer_data.brand_name} ${p2.total_score}/100`);
    
    // Compare key dimensions
    const coverageP1 = p1.dimension_scores.find((d) => d.dimension_id === 'coverage_adequacy');
    const coverageP2 = p2.dimension_scores.find((d) => d.dimension_id === 'coverage_adequacy');
    
    if (coverageP1 && coverageP2) {
      bullets.push(`Coverage: ${p1.insurer_data.brand_name} ₹${(p1.policy.sum_insured! / 100000).toFixed(1)}L vs ${p2.insurer_data.brand_name} ₹${(p2.policy.sum_insured! / 100000).toFixed(1)}L`);
    }
    
    return bullets;
  }
  
  const winner = scoredPolicies[0];
  
  // Top strengths
  const topDims = winner.dimension_scores
    .filter((d) => d.raw_score >= 70)
    .sort((a, b) => b.raw_score - a.raw_score)
    .slice(0, 4);
  
  for (const dim of topDims) {
    bullets.push(`${dim.dimension_id.replace(/_/g, ' ')}: ${dim.reasoning}`);
  }
  
  // Comparison with runner-up
  if (scoredPolicies.length >= 2) {
    const runner = scoredPolicies[1];
    if (winner.policy.annual_premium && runner.policy.annual_premium) {
      const diff = winner.policy.annual_premium - runner.policy.annual_premium;
      if (Math.abs(diff) > 1000) {
        bullets.push(`Premium: ₹${winner.policy.annual_premium.toLocaleString()} vs ${runner.insurer_data.brand_name} at ₹${runner.policy.annual_premium.toLocaleString()}`);
      }
    }
  }
  
  return bullets.slice(0, 6);
}

function generateTradeoffBullet(winner: ScoredPolicy): string {
  // Find weakest dimension
  const weakest = winner.dimension_scores
    .filter((d) => d.data_confidence !== 'UNAVAILABLE')
    .sort((a, b) => a.raw_score - b.raw_score)[0];
  
  if (!weakest || weakest.raw_score >= 60) {
    return 'No significant tradeoffs identified.';
  }
  
  return `Tradeoff: ${weakest.dimension_id.replace(/_/g, ' ')} scores ${weakest.raw_score}/100. ${weakest.reasoning}`;
}

function generatePolicyInsight(scoredPolicy: ScoredPolicy): PolicyInsight {
  const strengths: string[] = [];
  const watchOuts: string[] = [];
  
  // Strengths (dimensions >= 70)
  const strongDims = scoredPolicy.dimension_scores
    .filter((d) => d.raw_score >= 70 && d.data_confidence !== 'UNAVAILABLE')
    .sort((a, b) => b.raw_score - a.raw_score)
    .slice(0, 4);
  
  for (const dim of strongDims) {
    strengths.push(`${dim.dimension_id.replace(/_/g, ' ')}: ${dim.reasoning}`);
  }
  
  // Watch-outs (dimensions < 50)
  const weakDims = scoredPolicy.dimension_scores
    .filter((d) => d.raw_score < 50 && d.data_confidence !== 'UNAVAILABLE')
    .sort((a, b) => a.raw_score - b.raw_score)
    .slice(0, 4);
  
  for (const dim of weakDims) {
    watchOuts.push(`${dim.dimension_id.replace(/_/g, ' ')}: ${dim.reasoning}`);
  }
  
  // Best for
  let bestFor = 'General health insurance needs';
  if (scoredPolicy.policy.sum_insured && scoredPolicy.policy.sum_insured >= 2000000) {
    bestFor = 'High coverage needs, comprehensive protection';
  } else if (scoredPolicy.policy.annual_premium && scoredPolicy.policy.annual_premium < 10000) {
    bestFor = 'Budget-conscious buyers seeking basic coverage';
  }
  
  // Insurer note
  const insurerNote = generateInsurerNote(scoredPolicy);
  
  return {
    policy_id: scoredPolicy.policy.policy_id,
    medal: scoredPolicy.medal,
    strengths: strengths.length > 0 ? strengths : ['No standout strengths identified'],
    watch_outs: watchOuts.length > 0 ? watchOuts : ['No major concerns identified'],
    best_for: bestFor,
    insurer_note: insurerNote,
  };
}

function generateInsurerNote(scoredPolicy: ScoredPolicy): string {
  const insurer = scoredPolicy.insurer_data;
  
  if (insurer.data_gaps.length > 0) {
    return `${insurer.brand_name} data limited: ${insurer.data_gaps.join(', ')}`;
  }
  
  if (insurer.csr_count) {
    return `${insurer.brand_name} has ${insurer.csr_count.value.toFixed(1)}% claim settlement ratio (${insurer.csr_count.band})`;
  }
  
  return `${insurer.brand_name} track record available in analysis`;
}
