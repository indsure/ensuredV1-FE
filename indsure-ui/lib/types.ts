/**
 * TypeScript types for IndSure UI
 * Mirrors the backend types from the scoring engine
 */

// Policy Types
export type DocumentType = 'QUOTE' | 'POLICY_WORDING' | 'CIS' | 'UNKNOWN';
export type ExtractionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface SourceQuote {
  field: string;
  quote: string;
  page: number;
}

export interface SubLimit {
  category: string;
  limit: string;
}

export interface ExtractedPolicy {
  policy_id: string;
  insurer_id: string | null;
  insurer_raw_name: string;
  product_name: string | null;
  document_type: DocumentType;
  
  // Money
  sum_insured: number | null;
  annual_premium: number | null;
  copay_percent: number | null;
  deductible: number | null;
  
  // Hospitalization
  room_rent_limit: number | string | null;
  icu_limit: number | string | null;
  
  // Waiting periods (in months)
  initial_waiting_months: number | null;
  ped_waiting_months: number | null;
  specific_illness_waiting_months: number | null;
  maternity_waiting_months: number | null;
  
  // Coverage
  maternity_covered: boolean | null;
  maternity_limit: number | null;
  newborn_covered: boolean | null;
  pre_hospitalization_days: number | null;
  post_hospitalization_days: number | null;
  daycare_procedures_count: number | null;
  ayush_covered: boolean | null;
  modern_treatments_covered: boolean | null;
  
  // Benefits
  restoration_benefit: boolean | null;
  no_claim_bonus_max_pct: number | null;
  free_health_checkup: boolean | null;
  
  // Network
  cashless_hospitals_count: number | null;
  
  // Sub-limits & exclusions
  sub_limits: SubLimit[] | null;
  permanent_exclusions: string[] | null;
  
  // Metadata
  extraction_confidence: ExtractionConfidence;
  fields_missing: string[];
  source_quotes: SourceQuote[];
  raw_text_excerpt: string;
}

// User Profile Types
export type AgeBand = '18-30' | '31-45' | '46-60' | '60+';
export type CoverageNeed = 'SELF' | 'SELF_SPOUSE' | 'FAMILY_KIDS' | 'MULTI_GEN';
export type CityTier = 'METRO' | 'TIER_1' | 'TIER_2' | 'TIER_3';

export interface UserProfile {
  age_band: AgeBand | null;
  coverage_need: CoverageNeed | null;
  city_tier: CityTier | null;
  pre_existing: string[];
  scoring_profile_id: string;
}

// Scoring Types
export type DataConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNAVAILABLE';
export type Medal = 'WINNER' | 'RUNNER_UP' | 'BUDGET_PICK' | 'NOT_RECOMMENDED';

export interface DimensionScore {
  dimension_id: string;
  raw_score: number;
  weighted_score: number;
  data_confidence: DataConfidence;
  reasoning: string;
  inputs_used: Record<string, any>;
}

export interface MetricSnapshot {
  value: number;
  band: string;
  fy: string;
  source_type: string;
}

export interface NetworkSnapshot {
  value: number;
  source_type: string;
}

export interface InsurerSnapshot {
  insurer_id: string;
  brand_name: string;
  csr_count: MetricSnapshot | null;
  csr_value: MetricSnapshot | null;
  icr: MetricSnapshot | null;
  complaints_normalized: MetricSnapshot | null;
  solvency: MetricSnapshot | null;
  network_count: NetworkSnapshot | null;
  sector_benchmark_icr: number | null;
  data_gaps: string[];
}

export interface ScoredPolicy {
  policy: ExtractedPolicy;
  dimension_scores: DimensionScore[];
  total_score: number;
  rank: number;
  medal: Medal;
  insurer_data: InsurerSnapshot;
  confidence_overall: DataConfidence;
}

// Verdict Types
export interface PolicyInsight {
  policy_id: string;
  medal: string;
  strengths: string[];
  watch_outs: string[];
  best_for: string;
  insurer_note: string;
}

export interface Verdict {
  headline: string;
  winner_id: string | null;
  tie_warning: boolean;
  confidence_label: string;
  reasoning_bullets: string[];
  tradeoff_bullet: string;
  per_policy_insights: PolicyInsight[];
  data_freshness: string;
  disclaimers: string[];
}

// API Response Types
export interface UploadResponse {
  session_id: string;
  extracted_policies: ExtractedPolicy[];
}

export interface CompareResponse {
  scored_policies: ScoredPolicy[];
  verdict: Verdict;
}

// Glossary Types
export interface GlossaryTerm {
  term: string;
  language: string;
  displayName: string;
  shortDefinition: string;
  longDefinition: string;
  example: string | null;
  relatedTerms: string[];
}

// Educational Facts
export interface EducationalFact {
  factText: string;
  category: 'regulatory' | 'consumer_traps' | 'industry_stats' | 'tip';
  sourceCitation: string | null;
  language: string;
}

// Insurer Types
export interface Insurer {
  id: string;
  registeredName: string;
  brandName: string;
  formerNames: string[];
  category: 'SAHI' | 'PRIVATE_GENERAL' | 'PSU_GENERAL';
  foundedYear: number | null;
  notes: string | null;
  sourceCitation: string;
  dataAsOf: string;
}

// Smart Lens Types
export type SmartLens = 
  | 'all'
  | 'hospitalization'
  | 'family'
  | 'pre_existing'
  | 'budget'
  | 'red_flags';

// Advisor Types
export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
  last_activity: string | null;
  saved_profile: UserProfile | null;
  saved_weights: Record<string, number> | null;
}

export interface Comparison {
  id: string;
  client_id: string;
  session_id: string;
  created_at: string;
  policies_count: number;
  winner_policy_id: string | null;
  notes: string | null;
}
