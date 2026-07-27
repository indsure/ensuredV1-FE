/**
 * Verdict Generator Types
 */

import { z } from 'zod';

export const PolicyInsightSchema = z.object({
  policy_id: z.string(),
  medal: z.string(),
  strengths: z.array(z.string()),
  watch_outs: z.array(z.string()),
  best_for: z.string(),
  insurer_note: z.string(),
});

export const VerdictSchema = z.object({
  headline: z.string(),
  winner_id: z.string().nullable(),
  tie_warning: z.boolean(),
  confidence_label: z.string(),
  reasoning_bullets: z.array(z.string()),
  tradeoff_bullet: z.string(),
  per_policy_insights: z.array(PolicyInsightSchema),
  data_freshness: z.string(),
  disclaimers: z.array(z.string()),
});

export type Verdict = z.infer<typeof VerdictSchema>;
export type PolicyInsight = z.infer<typeof PolicyInsightSchema>;
