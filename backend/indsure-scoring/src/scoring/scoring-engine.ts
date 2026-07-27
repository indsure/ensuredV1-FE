/**
 * Scoring Engine - Main orchestrator for policy scoring
 */

import { PrismaClient } from '@prisma/client';
import type { ExtractedPolicy } from '../types/policy';
import type { UserProfile, ScoredPolicy, DimensionScore, ScoringWeights } from '../types/scoring';
import { getInsurerSnapshot } from './insurer-data-repository';
import * as scorers from './dimensions';

const prisma = new PrismaClient();

export class ScoringError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'ScoringError';
  }
}

/**
 * Score multiple policies and rank them
 */
export async function scorePolicies(
  policies: ExtractedPolicy[],
  userProfile: UserProfile
): Promise<ScoredPolicy[]> {
  if (policies.length === 0) {
    throw new ScoringError('No policies to score');
  }
  
  // Load scoring profile weights
  const weights = await loadScoringWeights(userProfile.scoring_profile_id);
  
  // Score each policy
  const scoredPolicies: ScoredPolicy[] = [];
  
  for (const policy of policies) {
    const scored = await scorePolicy(policy, userProfile, weights);
    scoredPolicies.push(scored);
  }
  
  // Rank by total score
  scoredPolicies.sort((a, b) => b.total_score - a.total_score);
  
  for (let i = 0; i < scoredPolicies.length; i++) {
    scoredPolicies[i].rank = i + 1;
  }
  
  // Assign medals
  assignMedals(scoredPolicies);
  
  return scoredPolicies;
}

/**
 * Score a single policy
 */
async function scorePolicy(
  policy: ExtractedPolicy,
  userProfile: UserProfile,
  weights: ScoringWeights
): Promise<ScoredPolicy> {
  // Get insurer data
  let insurerData = null;
  if (policy.insurer_id) {
    try {
      insurerData = await getInsurerSnapshot(policy.insurer_id);
    } catch (error) {
      console.warn(`Failed to get insurer data for ${policy.insurer_id}:`, error);
    }
  }
  
  // Run all dimension scorers
  const dimensionScores: DimensionScore[] = [
    scorers.scoreCoverageAdequacy(policy, userProfile),
    scorers.scoreCost(policy, userProfile),
    scorers.scoreWaitingPeriods(policy, userProfile),
    scorers.scoreExclusionsSublimits(policy, userProfile),
    scorers.scoreMaternityFamilyFit(policy, userProfile),
    scorers.scoreInsurerClaimPerformance(policy, userProfile, insurerData),
    scorers.scoreInsurerComplaintRate(policy, userProfile, insurerData),
    scorers.scoreInsurerFinancialHealth(policy, userProfile, insurerData),
    scorers.scoreNetworkStrength(policy, userProfile, insurerData),
    scorers.scoreRenewalTerms(policy, userProfile),
  ];
  
  // Apply weights
  let totalScore = 0;
  for (const dimScore of dimensionScores) {
    const weight = weights[dimScore.dimension_id] || 0;
    dimScore.weighted_score = (dimScore.raw_score * weight) / 100;
    totalScore += dimScore.weighted_score;
  }
  
  // Determine overall confidence
  const confidenceCounts = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    UNAVAILABLE: 0,
  };
  
  for (const dimScore of dimensionScores) {
    confidenceCounts[dimScore.data_confidence]++;
  }
  
  let confidenceOverall: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  if (confidenceCounts.UNAVAILABLE >= 4 || confidenceCounts.LOW >= 4) {
    confidenceOverall = 'LOW';
  } else if (confidenceCounts.HIGH >= 7) {
    confidenceOverall = 'HIGH';
  }
  
  return {
    policy,
    dimension_scores: dimensionScores,
    total_score: Math.round(totalScore),
    rank: 0, // Will be set by scorePolicies
    medal: 'NOT_RECOMMENDED', // Will be set by assignMedals
    insurer_data: insurerData || {
      insurer_id: 'unknown',
      brand_name: policy.insurer_raw_name,
      csr_count: null,
      csr_value: null,
      icr: null,
      complaints_normalized: null,
      solvency: null,
      network_count: null,
      sector_benchmark_icr: null,
      data_gaps: ['Insurer not identified'],
    },
    confidence_overall: confidenceOverall,
  };
}

/**
 * Assign medals based on ranking and scores
 */
function assignMedals(scoredPolicies: ScoredPolicy[]): void {
  if (scoredPolicies.length === 0) return;
  
  // Check for tie at top
  const tieWarning = scoredPolicies.length >= 2 &&
    Math.abs(scoredPolicies[0].total_score - scoredPolicies[1].total_score) <= 5;
  
  // Assign medals
  for (let i = 0; i < scoredPolicies.length; i++) {
    const policy = scoredPolicies[i];
    
    if (policy.total_score < 40) {
      policy.medal = 'NOT_RECOMMENDED';
    } else if (i === 0 && policy.total_score >= 50) {
      policy.medal = tieWarning ? 'WINNER' : 'WINNER';
    } else if (i === 1 && policy.total_score >= 50) {
      policy.medal = tieWarning ? 'WINNER' : 'RUNNER_UP';
    } else {
      policy.medal = 'RUNNER_UP';
    }
  }
  
  // Find budget pick (lowest premium among rank >= 3)
  if (scoredPolicies.length >= 3) {
    let lowestPremium = Infinity;
    let budgetPickIndex = -1;
    
    for (let i = 2; i < scoredPolicies.length; i++) {
      const premium = scoredPolicies[i].policy.annual_premium;
      if (premium && premium < lowestPremium) {
        lowestPremium = premium;
        budgetPickIndex = i;
      }
    }
    
    if (budgetPickIndex >= 0) {
      scoredPolicies[budgetPickIndex].medal = 'BUDGET_PICK';
    }
  }
}

/**
 * Load scoring weights from database
 */
async function loadScoringWeights(profileId: string): Promise<ScoringWeights> {
  const profile = await prisma.scoringProfile.findUnique({
    where: { id: profileId },
  });
  
  if (!profile) {
    throw new ScoringError(`Scoring profile not found: ${profileId}`);
  }
  
  return JSON.parse(profile.weights) as ScoringWeights;
}

/**
 * Rescore with custom weights
 */
export async function rescoreWithCustomWeights(
  policies: ExtractedPolicy[],
  userProfile: UserProfile,
  customWeights: ScoringWeights
): Promise<ScoredPolicy[]> {
  // Validate weights sum to 100
  const sum = Object.values(customWeights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.01) {
    throw new ScoringError(`Custom weights must sum to 100, got ${sum}`);
  }
  
  // Score each policy with custom weights
  const scoredPolicies: ScoredPolicy[] = [];
  
  for (const policy of policies) {
    const scored = await scorePolicy(policy, userProfile, customWeights);
    scoredPolicies.push(scored);
  }
  
  // Rank and assign medals
  scoredPolicies.sort((a, b) => b.total_score - a.total_score);
  
  for (let i = 0; i < scoredPolicies.length; i++) {
    scoredPolicies[i].rank = i + 1;
  }
  
  assignMedals(scoredPolicies);
  
  return scoredPolicies;
}
