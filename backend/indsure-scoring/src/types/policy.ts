/**
 * Policy Data Schema - The canonical extracted form
 * Every uploaded PDF gets extracted into this strict schema
 */

import { z } from 'zod';

export const DocumentTypeSchema = z.enum(['QUOTE', 'POLICY_WORDING', 'CIS', 'UNKNOWN']);
export const ExtractionConfidenceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);

export const SourceQuoteSchema = z.object({
  field: z.string(),
  quote: z.string(),
  page: z.number(),
});

export const SubLimitSchema = z.object({
  category: z.string(),
  limit: z.string(),
});

export const ExtractedPolicySchema = z.object({
  // Identity
  policy_id: z.string().uuid(),
  insurer_id: z.string().nullable(),
  insurer_raw_name: z.string(),
  product_name: z.string().nullable(),
  document_type: DocumentTypeSchema,

  // Money
  sum_insured: z.number().nullable(),
  annual_premium: z.number().nullable(),
  copay_percent: z.number().nullable(),
  deductible: z.number().nullable(),

  // Hospitalization
  room_rent_limit: z.union([z.number(), z.string()]).nullable(),
  icu_limit: z.union([z.number(), z.string()]).nullable(),

  // Waiting periods (in months)
  initial_waiting_months: z.number().nullable(),
  ped_waiting_months: z.number().nullable(),
  specific_illness_waiting_months: z.number().nullable(),
  maternity_waiting_months: z.number().nullable(),

  // Coverage
  maternity_covered: z.boolean().nullable(),
  maternity_limit: z.number().nullable(),
  newborn_covered: z.boolean().nullable(),
  pre_hospitalization_days: z.number().nullable(),
  post_hospitalization_days: z.number().nullable(),
  daycare_procedures_count: z.number().nullable(),
  ayush_covered: z.boolean().nullable(),
  modern_treatments_covered: z.boolean().nullable(),

  // Benefits
  restoration_benefit: z.boolean().nullable(),
  no_claim_bonus_max_pct: z.number().nullable(),
  free_health_checkup: z.boolean().nullable(),

  // Network
  cashless_hospitals_count: z.number().nullable(),

  // Sub-limits & exclusions
  sub_limits: z.array(SubLimitSchema).nullable(),
  permanent_exclusions: z.array(z.string()).nullable(),

  // Metadata
  extraction_confidence: ExtractionConfidenceSchema,
  fields_missing: z.array(z.string()),
  source_quotes: z.array(SourceQuoteSchema),
  raw_text_excerpt: z.string(),
});

export type ExtractedPolicy = z.infer<typeof ExtractedPolicySchema>;
export type DocumentType = z.infer<typeof DocumentTypeSchema>;
export type ExtractionConfidence = z.infer<typeof ExtractionConfidenceSchema>;
export type SourceQuote = z.infer<typeof SourceQuoteSchema>;
export type SubLimit = z.infer<typeof SubLimitSchema>;
