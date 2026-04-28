/**
 * Zod schemas for validating seed data files
 * Every JSON file in src/data/seed must conform to these schemas
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// INSURERS
// ═══════════════════════════════════════════════════════════════

export const InsurerCategorySchema = z.enum(['SAHI', 'PRIVATE_GENERAL', 'PSU_GENERAL']);

export const InsurerSeedSchema = z.object({
  id: z.string().min(1),
  registeredName: z.string().min(1),
  brandName: z.string().min(1),
  formerNames: z.array(z.string()),
  category: InsurerCategorySchema,
  foundedYear: z.number().int().positive().nullable(),
  notes: z.string().nullable(),
  sourceCitation: z.string().min(1),
  dataAsOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // ISO 8601 date
});

export const InsurersSeedSchema = z.array(InsurerSeedSchema);

export type InsurerSeed = z.infer<typeof InsurerSeedSchema>;

// ═══════════════════════════════════════════════════════════════
// INSURER METRICS
// ═══════════════════════════════════════════════════════════════

export const MetricNameSchema = z.enum([
  'CSR_BY_COUNT',
  'CSR_BY_VALUE',
  'ICR',
  'CLAIM_REJECTION_RATE',
  'AVG_CLAIM_PROCESSING_DAYS',
  'CASHLESS_APPROVAL_RATIO',
  'SOLVENCY_RATIO',
  'COMPLAINTS_PER_10K_POLICIES',
  'COMPLAINTS_PER_CRORE_PREMIUM',
  'OMBUDSMAN_AWARDS_AGAINST',
  'COMPLAINT_RESOLUTION_RATE',
  'GWP_HEALTH',
  'NETWORK_HOSPITAL_COUNT',
  'REGULATORY_ACTIONS_COUNT_5Y',
]);

export const DataSourceTypeSchema = z.enum([
  'OFFICIAL_IRDAI',
  'JOURNALISTIC_DERIVED',
  'INSURER_SELF_REPORTED',
  'ESTIMATED',
]);

export const ConfidenceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);

export const InsurerMetricSeedSchema = z.object({
  insurerId: z.string().min(1),
  fiscalYear: z.string().regex(/^FY \d{4}-\d{2}$/), // e.g., "FY 2023-24"
  metricName: MetricNameSchema,
  value: z.number().nullable(),
  valueText: z.string().nullable(),
  dataSourceType: DataSourceTypeSchema,
  sourceCitation: z.string().min(1),
  confidence: ConfidenceSchema,
  notes: z.string().nullable(),
}).refine(
  (data) => data.value !== null || data.valueText !== null,
  { message: 'Either value or valueText must be provided' }
);

export const InsurerMetricsSeedSchema = z.array(InsurerMetricSeedSchema);

export type InsurerMetricSeed = z.infer<typeof InsurerMetricSeedSchema>;

// ═══════════════════════════════════════════════════════════════
// SECTOR BENCHMARKS
// ═══════════════════════════════════════════════════════════════

export const SegmentSchema = z.enum([
  'OVERALL_NON_LIFE',
  'PSU',
  'PRIVATE_GENERAL',
  'SAHI',
]);

export const SectorBenchmarkSeedSchema = z.object({
  fiscalYear: z.string().regex(/^FY \d{4}-\d{2}$/),
  segment: SegmentSchema,
  metricName: MetricNameSchema,
  value: z.number(),
  sourceCitation: z.string().min(1),
});

export const SectorBenchmarksSeedSchema = z.array(SectorBenchmarkSeedSchema);

export type SectorBenchmarkSeed = z.infer<typeof SectorBenchmarkSeedSchema>;

// ═══════════════════════════════════════════════════════════════
// METRIC THRESHOLDS
// ═══════════════════════════════════════════════════════════════

export const DirectionSchema = z.enum(['HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'BAND']);

export const MetricThresholdSeedSchema = z.object({
  metricName: MetricNameSchema,
  excellentMin: z.number().nullable(),
  goodMin: z.number().nullable(),
  concerningMin: z.number().nullable(),
  redFlagMax: z.number().nullable(),
  direction: DirectionSchema,
  interpretationText: z.string().min(1),
  misinterpretationWarning: z.string().min(1),
  sourceCitation: z.string().min(1),
});

export const MetricThresholdsSeedSchema = z.array(MetricThresholdSeedSchema);

export type MetricThresholdSeed = z.infer<typeof MetricThresholdSeedSchema>;

// ═══════════════════════════════════════════════════════════════
// SCORING PROFILES
// ═══════════════════════════════════════════════════════════════

export const ScoringWeightsSchema = z.object({
  coverage_adequacy: z.number().min(0).max(100),
  cost: z.number().min(0).max(100),
  waiting_periods: z.number().min(0).max(100),
  exclusions_sublimits: z.number().min(0).max(100),
  maternity_family_fit: z.number().min(0).max(100),
  insurer_claim_performance: z.number().min(0).max(100),
  insurer_complaint_rate: z.number().min(0).max(100),
  insurer_financial_health: z.number().min(0).max(100),
  network_strength: z.number().min(0).max(100),
  renewal_terms: z.number().min(0).max(100),
}).refine(
  (weights) => {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    return Math.abs(sum - 100) < 0.01; // Allow for floating point precision
  },
  { message: 'Weights must sum to exactly 100' }
);

export const ScoringProfileSeedSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().min(1),
  weights: ScoringWeightsSchema,
  recommendedFor: z.string().min(1),
});

export const ScoringProfilesSeedSchema = z.array(ScoringProfileSeedSchema);

export type ScoringProfileSeed = z.infer<typeof ScoringProfileSeedSchema>;

// ═══════════════════════════════════════════════════════════════
// SCORING DIMENSIONS
// ═══════════════════════════════════════════════════════════════

export const ScoringDimensionSeedSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().min(1),
  scoringCurve: z.record(z.any()), // JSON object, structure varies by dimension
  sourceCitation: z.string().min(1),
});

export const ScoringDimensionsSeedSchema = z.array(ScoringDimensionSeedSchema);

export type ScoringDimensionSeed = z.infer<typeof ScoringDimensionSeedSchema>;

// ═══════════════════════════════════════════════════════════════
// GLOSSARY TERMS
// ═══════════════════════════════════════════════════════════════

export const LanguageSchema = z.enum(['EN', 'HI']);

export const GlossaryTermSeedSchema = z.object({
  term: z.string().min(1),
  language: LanguageSchema,
  displayName: z.string().min(1),
  shortDefinition: z.string().min(1),
  longDefinition: z.string().min(1),
  example: z.string().nullable(),
  relatedTerms: z.array(z.string()),
});

export const GlossaryTermsSeedSchema = z.array(GlossaryTermSeedSchema);

export type GlossaryTermSeed = z.infer<typeof GlossaryTermSeedSchema>;

// ═══════════════════════════════════════════════════════════════
// EDUCATIONAL FACTS
// ═══════════════════════════════════════════════════════════════

export const FactCategorySchema = z.enum([
  'regulatory',
  'consumer_traps',
  'industry_stats',
  'tip',
]);

export const EducationalFactSeedSchema = z.object({
  factText: z.string().min(1),
  category: FactCategorySchema,
  sourceCitation: z.string().nullable(),
  language: LanguageSchema,
});

export const EducationalFactsSeedSchema = z.array(EducationalFactSeedSchema);

export type EducationalFactSeed = z.infer<typeof EducationalFactSeedSchema>;
