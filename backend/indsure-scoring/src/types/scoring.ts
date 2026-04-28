/**
 * Scoring Engine Types
 */

import { z } from 'zod';

// User Profile
export const AgeBandSchema = z.enum(['18-30', '31-45', '46-60', '60+']);
export const CoverageNeedSchema = z.enum(['SELF', 'SELF_SPOUSE', 'FAMILY_KIDS', 'MULTI_GEN']);
export const CityTierSchema = z.enum(['METRO', 'TIER_1', 'TIER_2', 'TIER_3']);

export const UserProfileSchema = z.object({
  age_band: AgeBandSchema.nullable(),
  coverage_need: CoverageNeedSchema.nullable(),
  city_tier: CityTierSchema.nullable(),
  pre_existing: z.array(z.string()),
  scoring_profile_id: z.string().default('balanced'),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type AgeBand = z.infer<typeof AgeBandSchema>;
export type CoverageNeed = z.infer<typeof CoverageNeedSchema>;
export type CityTier = z.infer<typeof CityTierSchema>;

// Data Confidence
export const DataConfidenceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW', 'UNAVAILABLE']);
export type DataConfidence = z.infer<typeof DataConfidenceSchema>;

// Dimension Score
export const DimensionScoreSchema = z.object({
  dimension_id: z.string(),
  raw_score: z.number().min(0).max(100),
  weighted_score: z.number(),
  data_confidence: DataConfidenceSchema,
  reasoning: z.string(),
  inputs_used: z.record(z.string(), z.any()),
});

export type DimensionScore = z.infer<typeof DimensionScoreSchema>;

// Insurer Snapshot
export const MetricSnapshotSchema = z.object({
  value: z.number(),
  band: z.string(),
  fy: z.string(),
  source_type: z.string(),
});

export const NetworkSnapshotSchema = z.object({
  value: z.number(),
  source_type: z.string(),
});

export const InsurerSnapshotSchema = z.object({
  insurer_id: z.string(),
  brand_name: z.string(),
  csr_count: MetricSnapshotSchema.nullable(),
  csr_value: MetricSnapshotSchema.nullable(),
  icr: MetricSnapshotSchema.nullable(),
  complaints_normalized: MetricSnapshotSchema.nullable(),
  solvency: MetricSnapshotSchema.nullable(),
  network_count: NetworkSnapshotSchema.nullable(),
  sector_benchmark_icr: z.number().nullable(),
  data_gaps: z.array(z.string()),
});

export type InsurerSnapshot = z.infer<typeof InsurerSnapshotSchema>;
export type MetricSnapshot = z.infer<typeof MetricSnapshotSchema>;
export type NetworkSnapshot = z.infer<typeof NetworkSnapshotSchema>;

// Medal
export const MedalSchema = z.enum(['WINNER', 'RUNNER_UP', 'BUDGET_PICK', 'NOT_RECOMMENDED']);
export type Medal = z.infer<typeof MedalSchema>;

// Scored Policy
export const ScoredPolicySchema = z.object({
  policy: z.any(), // ExtractedPolicy
  dimension_scores: z.array(DimensionScoreSchema),
  total_score: z.number().min(0).max(100),
  rank: z.number().int().positive(),
  medal: MedalSchema,
  insurer_data: InsurerSnapshotSchema,
  confidence_overall: DataConfidenceSchema,
});

export type ScoredPolicy = z.infer<typeof ScoredPolicySchema>;

// Scoring Weights
export const ScoringWeightsSchema = z.record(z.string(), z.number()).refine(
  (weights) => {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    return Math.abs(sum - 100) < 0.01;
  },
  { message: 'Weights must sum to exactly 100' }
);

export type ScoringWeights = z.infer<typeof ScoringWeightsSchema>;
