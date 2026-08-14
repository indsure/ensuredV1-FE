/**
 * IndSure Forensic Policy Audit — TypeScript Types
 * Version: 3.0 (frontend copy)
 * Copied from backend/server/types/policy.ts so the frontend doesn't cross
 * the monorepo boundary via relative paths.
 * If the schema changes, update both files (or move to shared/).
 */

export type Zone = "A" | "B" | "C" | "D";
export type Confidence = "high" | "medium" | "low";
export type RiskLevel = "low" | "medium" | "high";
export type Severity = "high" | "medium" | "low";
export type Verdict = "SAFE" | "BORDERLINE" | "RISKY" | "EXCELLENT";
export type SimulationVerdict = "COVERED" | "PARTIAL" | "EXPOSED";
export type DocumentQuality = "clear" | "acceptable" | "poor" | "unclear";

export interface Identity {
  insured_names: string[];
  ages: (number | string | null)[];
  genders: (string | null)[];
  city: string | null;
  assumed_zone: Zone;
  health_flags: string[];
  confidence: Confidence;
}

export interface PolicyTimeline {
  policy_inception_date: string | null;
  policy_expiry_date: string | null;
  policy_tenure_years: number | null;
  policy_age_days: number | null;
  analysis_date: string;
  confidence: Confidence;
}

export interface TopUp {
  exists: boolean;
  sum_insured: number | null;
  deductible: number | null;
  type: "top-up" | "super-top-up" | "unclear" | null;
  deductible_achievable: boolean | null;
  remarks: string | null;
}

export interface SuperTopUp {
  exists: boolean;
  sum_insured: number | null;
  deductible: number | null;
  deductible_achievable: boolean | null;
  remarks: string | null;
}

export interface Restoration {
  exists: boolean;
  type: "full" | "partial" | "unclear" | null;
  restore_amount: number | string | null;
  trigger_conditions: string | null;
  actually_useful: boolean | null;
  remarks: string | null;
}

export interface NoClaimBonus {
  exists: boolean;
  rate_per_year: number | null;
  cap_percentage: number | null;
  current_bonus: number | null;
  portability: "yes" | "no" | "unclear" | null;
  clarity: "clear" | "unclear" | null;
  remarks: string | null;
}

export interface Rider {
  name: string;
  coverage_amount: number | null;
  is_material: boolean;
  remarks: string | null;
}

export interface CoverageStructure {
  base_sum_insured: number | null;
  top_up: TopUp;
  super_top_up: SuperTopUp;
  restoration: Restoration;
  no_claim_bonus: NoClaimBonus;
  riders: Rider[];
  total_effective_coverage: number | null;
  confidence: Confidence;
}

export interface InitialWaitingPeriod {
  duration_days: number;
  end_date: string | null;
  is_active_today: boolean;
  risk_commentary: string | null;
}

export interface PEDWaitingPeriod {
  duration_months: number;
  start_date: string | null;
  end_date: string | null;
  is_active_today: boolean;
  months_remaining: number | null;
  risk_commentary: string | null;
}

export interface SpecificDiseaseWaiting {
  duration_months: number;
  diseases_covered: string[];
  end_date: string | null;
  is_active_today: boolean;
  risk_commentary: string | null;
}

export interface PersonalWaitingPeriod {
  condition: string;
  duration_months: number;
  start_date: string | null;
  end_date: string | null;
  is_active_today: boolean;
  months_remaining: number | null;
  risk_commentary: string | null;
}

export interface MaternityWaiting {
  duration_months: number | null;
  end_date: string | null;
  is_active_today: boolean | null;
  months_remaining: number | null;
  risk_commentary: string | null;
  relevant?: boolean; // optional — not all backends send this
}

export interface WaitingPeriodAnalysis {
  initial_waiting_period: InitialWaitingPeriod;
  pre_existing_disease: PEDWaitingPeriod;
  specific_diseases: SpecificDiseaseWaiting;
  personal_waiting_periods?: PersonalWaitingPeriod[]; // optional — mocks use other_waiting_periods
  maternity: MaternityWaiting;
  policy_fully_active: boolean;
  [key: string]: any; // allow extra fields from backend (other_waiting_periods, etc.)
}

export interface RoomRentAnalysis {
  limit_type: "none" | "specific_amount" | "room_category" | "percentage_of_si" | "unclear";
  limit_value: string | null;
  limit_amount_per_day: number | null;
  penalty_type: "none" | "proportional" | "unclear" | null;
  penalty_calculation: string | null;
  risk_level: RiskLevel;
  zone_adequacy: "adequate" | "marginal" | "inadequate" | null;
  explanation: string | null;
}

export interface CoPaymentAnalysis {
  exists: boolean;
  percentage: number | null;
  conditions: string | null;
  applies_to: "all_claims" | "seniors_only" | "specific_treatments" | "unclear" | null;
  waiver_conditions: string | null;
  risk_level: RiskLevel;
  oop_on_5L_claim: number | null;
}

export interface SubLimitCategory {
  procedure: string;
  limit: number | null;
  typical_cost_in_zone: number | null;
  gap: number | null;
  severity: Severity;
}

export interface SubLimitsAnalysis {
  exists: boolean;
  categories: SubLimitCategory[];
  risk_level: RiskLevel;
  remarks: string | null;
}

export interface DeductibleAnalysis {
  base_deductible: number | null;
  per_claim_impact: string | null;
  remarks: string | null;
}

export interface ClaimRiskAnalysis {
  room_rent: RoomRentAnalysis;
  co_payment: CoPaymentAnalysis;
  sub_limits: SubLimitsAnalysis;
  deductibles: DeductibleAnalysis;
}

export interface ClaimSimulation {
  scenario: string;
  total_bill: number;
  insurer_pays: number;
  patient_oop: number;
  oop_ratio: number;
  verdict: SimulationVerdict;
  explanation: string | null;
}

export type CoverageUtility = "high" | "medium" | "low" | "none" | null;

export interface OPDCoverage {
  covered: boolean;
  limit_per_year: number | null;
  conditions: string | null;
  utility: CoverageUtility;
  remarks: string | null;
}

export interface MaternityCoverage {
  covered: boolean;
  limit_per_delivery: number | null;
  waiting_period_over: boolean | null;
  conditions: string | null;
  utility: CoverageUtility;
  remarks: string | null;
}

export interface ConsumablesCoverage {
  covered: boolean;
  coverage_type: "full" | "partial" | "none" | "unclear" | null;
  limit: string | null;
  remarks: string | null;
}

export interface ModernTreatmentsCoverage {
  covered: boolean;
  examples: string[];
  conditions: string | null;
  remarks: string | null;
}

export interface AmbulanceCoverage {
  covered: boolean;
  limit_per_trip: number | null;
  remarks: string | null;
}

export interface DayCareCoverage {
  covered: boolean;
  number_of_procedures: number | null;
  remarks: string | null;
}

export interface PreventiveCoverage {
  covered: boolean;
  limit_per_year: number | null;
  remarks: string | null;
}

export interface SupplementaryCoverage {
  opd: OPDCoverage;
  maternity: MaternityCoverage;
  consumables: ConsumablesCoverage;
  modern_treatments: ModernTreatmentsCoverage;
  ambulance: AmbulanceCoverage;
  day_care_procedures: DayCareCoverage;
  preventive_health_checkup: PreventiveCoverage;
  [key: string]: any;
}

export interface NetworkLimitations {
  network_type: "cashless_only" | "cashless_and_reimbursement" | "unclear";
  hospital_count_in_zone: number | string | null;
  major_hospitals_included: string[];
  reimbursement_allowed: boolean;
  risk_level: RiskLevel;
  remarks: string | null;
}

export interface BenefitWorking {
  benefit: string;
  why_it_matters_in_claim: string;
  quantified_value: string | null;
}

export interface BenefitFailure {
  issue: string;
  real_world_claim_impact: string;
  quantified_oop_risk: string | null;
}

export interface StructuralRedFlag {
  flag: string;
  why_it_is_dangerous: string;
  severity: Severity;
}

export interface BenefitEvaluation {
  what_actually_works: BenefitWorking[];
  where_policy_fails: BenefitFailure[];
  structural_red_flags: StructuralRedFlag[];
}

export interface ScoreBreakdown {
  net_cover_penalty?: number;
  claim_rejection_risk?: number;
  oop_exposure?: number;
  coverage_quality_gap?: number;
  [key: string]: number | undefined; // allow extra breakdown fields
}

export interface ScoreDeduction {
  reason: string;
  category: string;
  severity: Severity;
  points: number;
}

export interface AuditScore {
  score: number;
  ncar?: number;
  nec?: number;
  rct?: number;
  breakdown: ScoreBreakdown;
  deductions: ScoreDeduction[];
  interpretation: string | null;
}

export interface FinalVerdict {
  label: Verdict;
  summary: string;
  key_failure_points: string[];
  will_this_policy_protect_in_real_claim: string;
}

export interface CriticalAction {
  action: string;
  reason: string;
  oop_risk_if_ignored: string | null;
  suggested_riders_or_topups: string[];
  estimated_cost: string | null;
}

export interface PortingRecommendation {
  recommendation: "yes" | "no" | "consider";
  reason: string;
  what_to_look_for: string[];
}

export interface PriorityAction {
  action: string;
  reason: string;
}

export interface Recommendations {
  critical_actions: CriticalAction[];
  should_port_to_better_policy: PortingRecommendation;
  medium_priority: PriorityAction[];
  low_priority: PriorityAction[];
}

export interface DataQuality {
  overall: Confidence;
  missing_critical_fields: string[];
  ambiguous_clauses: string[];
  policy_document_quality: DocumentQuality;
}

/** One other health cover the same insured holds, uploaded alongside the base
 *  policy. Optional everywhere: reports produced before this existed have none. */
export interface OtherCover {
  kind: "super_topup" | "corporate" | "ayushman";
  insurer?: string | null;
  plan_name?: string | null;
  sum_insured?: number | null;
  deductible?: number | null;
  expiry_date?: string | null;
  own_limits?: string[];
  dependency_risk?: string | null;
  what_it_does_not_solve?: string | null;
  usable_today?: boolean | null;
  /** False when the cover is left out of cover_stack.combined_effective_cover —
   *  e.g. employment-linked cover, real today and gone when the job ends. */
  counted_in_total?: boolean | null;
  remarks?: string | null;
}

/** Total protection across the base policy and every other cover supplied.
 *  Indicative only — it is read off schedules, not a second audit score. */
export interface CoverStack {
  combined_effective_cover?: number | null;
  required_cover?: number | null;
  stack_ratio?: number | null;
  verdict?: "ADEQUATE" | "THIN" | "INADEQUATE" | "unclear" | null;
  counted?: string[];
  excluded?: string[];
  where_the_stack_still_breaks?: string[];
  remarks?: string | null;
}

export interface ForensicAuditReport {
  identity: Identity;
  policy_timeline: PolicyTimeline;
  coverage_structure: CoverageStructure;
  waiting_period_analysis: WaitingPeriodAnalysis;
  claim_risk_analysis: ClaimRiskAnalysis;
  claim_simulations?: ClaimSimulation[]; // optional — not all mocks/legacy reports include this
  supplementary_coverage: SupplementaryCoverage;
  network_limitations: NetworkLimitations;
  benefit_evaluation: BenefitEvaluation;
  audit_score: AuditScore;
  final_verdict: FinalVerdict;
  recommendations: Recommendations;
  /** Present only when other cover was uploaded with the policy. */
  other_cover?: OtherCover[];
  cover_stack?: CoverStack;
  confidence_notes: string[];
  data_quality: DataQuality;
  __internal?: {
    policyText: string;
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

export const validateForensicAuditReport = (data: any): data is ForensicAuditReport => {
  try {
    if (!data?.identity || !data?.policy_timeline || !data?.coverage_structure) return false;
    const zone = data.identity.assumed_zone;
    if (!["A", "B", "C", "D"].includes(zone)) return false;
    const verdict = data.final_verdict?.label;
    if (!["SAFE", "BORDERLINE", "RISKY", "EXCELLENT"].includes(verdict)) return false;
    if (typeof data.audit_score?.score !== "number") return false;
    if (data.audit_score.score < 0 || data.audit_score.score > 100) return false;
    // Make claim_simulations optional - allow empty array
    if (data.claim_simulations !== undefined && !Array.isArray(data.claim_simulations)) return false;
    // Make critical_actions optional - allow empty array
    if (data.recommendations?.critical_actions !== undefined && !Array.isArray(data.recommendations.critical_actions)) return false;
    return true;
  } catch {
    return false;
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const formatINR = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return "N/A";
  const numeric = typeof value === "string"
    ? parseFloat(value.replace(/[₹,]/g, ""))
    : value;
  if (isNaN(numeric)) return "N/A";
  if (numeric >= 100000) return `₹${(numeric / 100000).toFixed(1)}L`;
  if (numeric >= 1000) return `₹${Math.round(numeric / 1000)}K`;
  return `₹${numeric.toLocaleString("en-IN")}`;
};
