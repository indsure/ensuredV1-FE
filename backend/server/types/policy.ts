/**
 * IndSure Forensic Policy Audit — TypeScript Types
 * Version: 3.0
 * Single source of truth. Matches ForensicAuditReport.schema.json v3.0
 * Prompt computes all scoring. Server only validates shape.
 */

// ─── Primitives ───────────────────────────────────────────────────────────────

export type Zone = "A" | "B" | "C";
export type Confidence = "high" | "medium" | "low";
export type RiskLevel = "low" | "medium" | "high";
export type Severity = "high" | "medium" | "low";
export type Verdict = "SAFE" | "BORDERLINE" | "RISKY";
export type SimulationVerdict = "COVERED" | "PARTIAL" | "EXPOSED";
export type DocumentQuality = "clear" | "acceptable" | "poor" | "unclear";

// ─── Identity ─────────────────────────────────────────────────────────────────

export interface Identity {
  insured_names: string[];
  ages: (number | string | null)[];
  genders: (string | null)[];
  city: string | null;
  assumed_zone: Zone;
  health_flags: string[];
  confidence: Confidence;
}

// ─── Policy Timeline ──────────────────────────────────────────────────────────

export interface PolicyTimeline {
  policy_inception_date: string | null;
  policy_expiry_date: string | null;
  policy_tenure_years: number | null;
  policy_age_days: number | null;
  analysis_date: string;
  confidence: Confidence;
}

// ─── Coverage Structure ───────────────────────────────────────────────────────

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

// ─── Waiting Period Analysis ──────────────────────────────────────────────────

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
  relevant: boolean;
}

export interface WaitingPeriodAnalysis {
  initial_waiting_period: InitialWaitingPeriod;
  pre_existing_disease: PEDWaitingPeriod;
  specific_diseases: SpecificDiseaseWaiting;
  personal_waiting_periods: PersonalWaitingPeriod[];
  maternity: MaternityWaiting;
  policy_fully_active: boolean;
}

// ─── Claim Risk Analysis ──────────────────────────────────────────────────────

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

// ─── Claim Simulations ────────────────────────────────────────────────────────

export interface ClaimSimulation {
  scenario: string;
  total_bill: number;
  insurer_pays: number;
  patient_oop: number;
  oop_ratio: number;
  verdict: SimulationVerdict;
  explanation: string | null;
}

// ─── Supplementary Coverage ───────────────────────────────────────────────────

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

// ─── Network Limitations ──────────────────────────────────────────────────────

export interface NetworkLimitations {
  network_type: "cashless_only" | "cashless_and_reimbursement" | "unclear";
  hospital_count_in_zone: number | string | null;
  major_hospitals_included: string[];
  reimbursement_allowed: boolean;
  claim_settlement_ratio: number | null;
  risk_level: RiskLevel;
  remarks: string | null;
}

// ─── Benefit Evaluation ───────────────────────────────────────────────────────

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

// ─── Audit Score ──────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  net_cover_penalty: number;
  claim_rejection_risk: number;
  oop_exposure: number;
  coverage_quality_gap: number;
}

export interface ScoreDeduction {
  reason: string;
  category: "NET_COVER" | "CLAIM_REJECTION" | "OOP_EXPOSURE" | "COVERAGE_GAP";
  severity: Severity;
  points: number;
}

export interface AuditScore {
  score: number;
  ncar: number;
  nec: number;
  rct: number;
  breakdown: ScoreBreakdown;
  deductions: ScoreDeduction[];
  interpretation: string | null;
}

// ─── Final Verdict ────────────────────────────────────────────────────────────

export interface FinalVerdict {
  label: Verdict;
  summary: string;
  key_failure_points: string[];
  will_this_policy_protect_in_real_claim: string;
}

// ─── Recommendations ──────────────────────────────────────────────────────────

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

// ─── Data Quality ─────────────────────────────────────────────────────────────

export interface DataQuality {
  overall: Confidence;
  wording_source: "repository_matched" | "schedule_only";
  missing_critical_fields: string[];
  ambiguous_clauses: string[];
  policy_document_quality: DocumentQuality;
}

// ─── Master Report Interface ──────────────────────────────────────────────────

export interface ForensicAuditReport {
  identity: Identity;
  policy_timeline: PolicyTimeline;
  coverage_structure: CoverageStructure;
  waiting_period_analysis: WaitingPeriodAnalysis;
  claim_risk_analysis: ClaimRiskAnalysis;
  claim_simulations: ClaimSimulation[];
  supplementary_coverage: SupplementaryCoverage;
  network_limitations: NetworkLimitations;
  benefit_evaluation: BenefitEvaluation;
  audit_score: AuditScore;
  final_verdict: FinalVerdict;
  recommendations: Recommendations;
  confidence_notes: string[];
  data_quality: DataQuality;
  __internal?: {
    policyText: string;
  };
}

// ─── Type Guards ──────────────────────────────────────────────────────────────

export const isValidVerdict = (v: string): v is Verdict =>
  ["SAFE", "BORDERLINE", "RISKY"].includes(v);

export const isValidZone = (z: string): z is Zone =>
  ["A", "B", "C"].includes(z);

export const isValidConfidence = (c: string): c is Confidence =>
  ["high", "medium", "low"].includes(c);

export const isValidRiskLevel = (r: string): r is RiskLevel =>
  ["low", "medium", "high"].includes(r);

export const isValidSeverity = (s: string): s is Severity =>
  ["high", "medium", "low"].includes(s);

// ─── Validation ───────────────────────────────────────────────────────────────

export const validateForensicAuditReport = (data: any): data is ForensicAuditReport => {
  try {
    if (!data?.identity || !data?.policy_timeline || !data?.coverage_structure) return false;
    if (!isValidZone(data.identity.assumed_zone)) return false;
    if (!isValidVerdict(data.final_verdict?.label)) return false;
    if (typeof data.audit_score?.score !== "number") return false;
    if (data.audit_score.score < 0 || data.audit_score.score > 100) return false;
    if (!Array.isArray(data.claim_simulations) || data.claim_simulations.length === 0) return false;
    if (!Array.isArray(data.recommendations?.critical_actions)) return false;
    return true;
  } catch {
    return false;
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const calculateEffectiveCoverage = (report: ForensicAuditReport): number => {
  const base = typeof report.coverage_structure.base_sum_insured === "number"
    ? report.coverage_structure.base_sum_insured
    : 0;

  const topUp = report.coverage_structure.top_up?.exists
    ? (report.coverage_structure.top_up.sum_insured ?? 0)
    : 0;

  const superTopUp = report.coverage_structure.super_top_up?.exists
    ? (report.coverage_structure.super_top_up.sum_insured ?? 0)
    : 0;

  const promptTotal = typeof report.coverage_structure.total_effective_coverage === "number"
    ? report.coverage_structure.total_effective_coverage
    : null;

  const computed = base + topUp + superTopUp;
  return promptTotal && promptTotal > computed ? promptTotal : computed;
};

export const getVerdictColor = (verdict: Verdict): string => {
  const colors: Record<Verdict, string> = {
    SAFE: "#10B981",
    BORDERLINE: "#F59E0B",
    RISKY: "#EF4444",
  };
  return colors[verdict];
};

export const formatINR = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return "N/A";
  const numeric = typeof value === "string"
    ? parseFloat(value.replace(/[₹,]/g, ""))
    : value;

  if (isNaN(numeric)) return "N/A";

  if (numeric >= 100000) return `₹${(numeric / 100000).toFixed(1)}L`;
  if (numeric >= 1000) return `₹${Math.round(numeric / 1000)}K`;
  return `₹${numeric?.toLocaleString("en-IN")}`;
};

export const getNCARLabel = (ncar: number): string => {
  if (ncar >= 1.0) return "Adequate";
  if (ncar >= 0.75) return "Marginal";
  if (ncar >= 0.50) return "Insufficient";
  if (ncar >= 0.30) return "Severely Insufficient";
  return "Critical";
};

export const computeUnlockDate = (
  inceptionDate: string | null,
  durationDays: number
): string | null => {
  if (!inceptionDate) return null;
  const start = new Date(inceptionDate);
  if (isNaN(start.getTime())) return null;
  start.setUTCDate(start.getUTCDate() + durationDays);
  return start.toISOString().split("T")[0];
};

export const getWaitingPeriodStatus = (
  isActive: boolean,
  monthsRemaining: number | null,
  endDate: string | null
): { status: "active" | "served"; label: string } => {
  if (!isActive) return { status: "served", label: "✅ Served" };
  if (monthsRemaining !== null) {
    return { status: "active", label: `⏳ ${monthsRemaining} months remaining` };
  }
  if (endDate) {
    return { status: "active", label: `⏳ Unlocks ${endDate}` };
  }
  return { status: "active", label: "⏳ Active" };
}