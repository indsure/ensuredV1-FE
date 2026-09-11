/**
 * IndSure Forensic Policy Audit — TypeScript Types
 * Version: 3.0
 * Single source of truth. Matches ForensicAuditReport.schema.json v3.0
 * Prompt computes all scoring. Server only validates shape.
 *
 * This file used to exist twice: backend/server/types/policy.ts and
 * frontend/client/src/lib/policy-types.ts, hand-copied and already drifted.
 * It now lives here and both sides import it through the @shared alias.
 *
 * Where the two copies disagreed, the rule applied was: take the backend's
 * version wherever the difference was purely additive (helpers, new fields),
 * and take the frontend's wherever it was widening a field that real stored
 * reports are known to omit. The producer is always stricter than what a
 * consumer may safely assume, because reports written by older versions of the
 * pipeline are still in the database and still get rendered. Every such
 * widening is marked LEGACY below with the reason.
 */

// ─── Primitives ───────────────────────────────────────────────────────────────

export type Zone = "A" | "B" | "C" | "D";
export type Confidence = "high" | "medium" | "low";
export type RiskLevel = "low" | "medium" | "high";
export type Severity = "high" | "medium" | "low";
/* EXCELLENT was added on the frontend when the vehicle report started
   emitting it, and never made it back into the backend copy. Both sides need
   it: without it, getVerdictColor returns undefined for a real verdict. */
export type Verdict = "SAFE" | "BORDERLINE" | "RISKY" | "EXCELLENT";
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
  /**
   * The three facts the scoring rule actually turns on. Before 1.3.0 none of
   * these existed, so "does this restore fire for the same illness" lived only
   * as prose in trigger_conditions and the model could express its answer only
   * by inflating total_effective_coverage, where nothing could check it.
   *
   * Optional because reports stored under earlier prompt versions do not carry
   * them. Absent must read as "not established", never as true.
   */
  same_illness_covered?: boolean | null;
  unlimited?: boolean | null;
  triggers_on_first_claim?: boolean | null;
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
  duration_months: number | null;
  /** True only when the document explicitly states the PED waiting period. */
  stated?: boolean;
  start_date: string | null;
  end_date: string | null;
  is_active_today: boolean | null;
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
  /** LEGACY: absent on reports written before this field was introduced. */
  relevant?: boolean;
}

export interface WaitingPeriodAnalysis {
  initial_waiting_period: InitialWaitingPeriod;
  pre_existing_disease: PEDWaitingPeriod;
  specific_diseases: SpecificDiseaseWaiting;
  /** LEGACY: older reports carry other_waiting_periods instead. */
  personal_waiting_periods?: PersonalWaitingPeriod[];
  maternity: MaternityWaiting;
  policy_fully_active: boolean;
  /** LEGACY: tolerates the differently-named fields older reports carry. */
  [key: string]: any;
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
  /* LEGACY: the breakdown keys have changed over time, so a stored report may
     carry some, all, or differently-named ones. Readers must guard. */
  net_cover_penalty?: number;
  claim_rejection_risk?: number;
  oop_exposure?: number;
  coverage_quality_gap?: number;
  [key: string]: number | undefined;
}

export interface ScoreDeduction {
  reason: string;
  category: "NET_COVER" | "CLAIM_REJECTION" | "OOP_EXPOSURE" | "COVERAGE_GAP";
  severity: Severity;
  points: number;
}

export interface AuditScore {
  score: number;
  raw_score?: number;           // Original score before bucketing
  bucket_label?: string;         // Human-readable label (e.g., "Below Average")
  bucketing_method?: string;     // Method used for bucketing (e.g., "nearest_5")
  /* LEGACY: reports predating the scoring rewrite have no ncar/nec/rct. The
     PDF renderer already crashed once on this assumption. */
  ncar?: number;
  nec?: number;
  rct?: number;
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
  /** LEGACY: postdates the wording repository; older reports omit it. */
  wording_source?: "repository_matched" | "schedule_only";
  missing_critical_fields: string[];
  ambiguous_clauses: string[];
  policy_document_quality: DocumentQuality;
}

// ─── Master Report Interface ──────────────────────────────────────────────────

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
 *  Indicative only — read off schedules, not a second audit score. */
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
  /** LEGACY: absent on older reports and on playground mock data. */
  claim_simulations?: ClaimSimulation[];
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

// ─── Type Guards ──────────────────────────────────────────────────────────────

export const isValidVerdict = (v: string): v is Verdict =>
  ["SAFE", "BORDERLINE", "RISKY", "EXCELLENT"].includes(v);

export const isValidZone = (z: string): z is Zone =>
  ["A", "B", "C", "D"].includes(z);

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

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;

/**
 * current_bonus is specified as absolute rupees, but the field is populated as a
 * PERCENTAGE in places (motor NCB is a percentage by nature, and reports written
 * before the schema said otherwise vary). Guessing wrong in one direction adds ~20
 * rupees to a crore; guessing wrong in the other multiplies the cover by 5,000.
 *
 * So: a value that cannot be rupees on a policy this size is discarded, not
 * reinterpreted. This only ever LOWERS the stated cover, which is the safe way to
 * be wrong about a number a customer relies on.
 */
export const accruedBonusRupees = (
  ncb: { current_bonus?: number | null; cap_percentage?: number | null } | null | undefined,
  base: number,
): number => {
  const raw = num(ncb?.current_bonus);
  if (raw === 0 || base <= 0) return 0; // a bonus means nothing without a policy under it

  // A percentage wearing a rupee label. Discarded, never rescaled: we do not know
  // it IS a percentage, only that it cannot be the rupee figure it claims to be.
  if (raw <= 100) return 0;

  // An accrued bonus cannot exceed its own cap. Beyond it the value is a unit
  // error, so it is DROPPED rather than clamped: clamping a 5Cr bonus down to a
  // 1Cr base would double a 1Cr policy's headline, which is the exact failure
  // this whole change exists to remove.
  const capPct = num(ncb?.cap_percentage);
  const ceiling = capPct > 0 ? base * (capPct / 100) : base;
  return raw > ceiling ? 0 : raw;
};

/**
 * Effective cover = what this policy can pay for ONE hospitalisation, today.
 * Founder call, 2026-09-08: "effective cover, that it can pay in 1 event."
 *
 * This is the single definition. audit_score.nec, cover_stack.combined_effective_cover
 * and coverage_structure.total_effective_coverage are all reconciled to it server-side
 * (see reconcileEffectiveCover in analysisPipeline.ts). Before 1.3.0 each of those was
 * written independently by the model and nothing forced them to agree, which is how
 * report 1b520f0d came to show 2.0Cr in its header while scoring NCAR on 1.0Cr.
 *
 * Deliberately NOT counted:
 *   - Restoration, of any kind. It refills the cover for a LATER claim and cannot
 *     enlarge the one in front of you. It is scored in STEP 4 of the prompt instead.
 *   - A top-up whose deductible the base cover cannot bridge. The old code added
 *     top-ups on `exists` alone, which contradicted the prompt's own NEC rule.
 *   - The model's own total. It reports components; the sum happens here.
 */
export const calculateEffectiveCoverage = (report: ForensicAuditReport): number => {
  const cs = report.coverage_structure;
  const base = num(cs?.base_sum_insured);

  // Without a base sum insured nothing here is meaningful: a bonus and a top-up
  // are both defined relative to it. Returning 0 marks "not extracted" so callers
  // can leave the report alone, rather than publishing a cover figure built out of
  // the leftovers (a percentage bonus of 50 rendering as "Effective Cover Rs 50").
  if (base <= 0) return 0;

  const ncb = cs?.no_claim_bonus?.exists ? accruedBonusRupees(cs.no_claim_bonus, base) : 0;

  // A top-up only helps a single event if the base cover actually reaches its
  // deductible. `deductible_achievable` must be explicitly true; null is "unknown",
  // and unknown never adds cover.
  const topUp = cs?.top_up?.exists && cs.top_up.deductible_achievable === true
    ? num(cs.top_up.sum_insured)
    : 0;

  const superTopUp = cs?.super_top_up?.exists && cs.super_top_up.deductible_achievable === true
    ? num(cs.super_top_up.sum_insured)
    : 0;

  return base + ncb + topUp + superTopUp;
};

export interface CoverView {
  effectiveCover: number;
  rct: number | null;
  ncar: number | null;
  stack: {
    combined: number;
    required: number | null;
    ratio: number | null;
    verdict: "ADEQUATE" | "THIN" | "INADEQUATE" | "unclear";
    counted: string[];
    excluded: string[];
    /** Suppressed when the stored prose was written about a different number. */
    remarks: string | null;
  } | null;
  /** True when the stored report disagreed with this derivation. */
  restated: boolean;
}

const stackVerdictFor = (ratio: number | null): "ADEQUATE" | "THIN" | "INADEQUATE" | "unclear" =>
  ratio === null ? "unclear" : ratio >= 1.0 ? "ADEQUATE" : ratio >= 0.6 ? "THIN" : "INADEQUATE";

/**
 * Every cover figure on the page, derived together from one number.
 *
 * The renderer MUST use this rather than reading the stored fields directly.
 * Reports written before 1.3.0 have a stored cover that includes a restoration
 * tranche, a stored NCAR computed from something else again, and a stored stack
 * verdict derived from the inflated total. Recomputing only the headline and
 * leaving its neighbours stored is how one page came to show 1.0Cr beside 2.0Cr:
 * exactly the defect this change exists to remove, reproduced across the archive.
 *
 * Deriving them together means an old report renders self-consistently under the
 * current rule, without rewriting stored data or paying for a re-analysis.
 */
export const deriveCoverView = (report: ForensicAuditReport): CoverView => {
  const computed = calculateEffectiveCoverage(report);
  const storedTotal = num(report.coverage_structure?.total_effective_coverage);

  // This renderer serves health, motor and life reports and the report object
  // carries no type marker, so the derivation only LOWERS a stored figure when it
  // can explain the gap. A restoration tranche folded into the total is the defect
  // being corrected; anything else (a motor IDV, a life sum assured plus its rider
  // amounts) is a number this function has no business overwriting from here.
  // The server-side reconciler, which does know the line of business, is the
  // authority for newly written reports.
  const canExplainGap = report.coverage_structure?.restoration?.exists === true;
  const effectiveCover =
    computed <= 0 ? storedTotal                       // nothing extracted
      : computed >= storedTotal ? computed            // never understates: safe
        : canExplainGap ? computed                    // a restore accounts for it
          : storedTotal;                              // unexplained: leave it alone

  const rctRaw = num(report.audit_score?.rct);
  const rct = rctRaw > 0 ? rctRaw : null;
  const storedNcar = typeof report.audit_score?.ncar === "number" ? report.audit_score.ncar : null;
  const ncar = rct && effectiveCover > 0
    ? Number((effectiveCover / rct).toFixed(2))
    : storedNcar;

  const restated =
    (storedTotal > 0 && Math.abs(storedTotal - effectiveCover) >= 1) ||
    (storedNcar !== null && ncar !== null && Math.abs(storedNcar - ncar) >= 0.01);

  const cs = report.cover_stack;
  let stack: CoverView["stack"] = null;
  if (cs && typeof cs.combined_effective_cover === "number") {
    // The companion-cover portion is whatever the stack held beyond this policy's
    // own stored total. Carrying that delta forward preserves real other cover
    // without re-deriving it, and without silently dropping a policy the prose
    // beside it still lists.
    const others = Math.max(0, cs.combined_effective_cover - (storedTotal || effectiveCover));
    const combined = effectiveCover + others;
    const required = num(cs.required_cover) > 0 ? num(cs.required_cover) : rct;
    const ratio = required ? Number((combined / required).toFixed(2)) : null;

    // A restore is not in the total, so it must not survive in the list that
    // explains the total. Older reports itemise one there ("Unlimited same-illness
    // restoration of 1 Crore") and leaving it would contradict the figure above it.
    const counted = (cs.counted ?? []).filter((s) => !/restor/i.test(String(s)));
    const excluded = [...(cs.excluded ?? [])];
    if (counted.length !== (cs.counted ?? []).length) {
      excluded.push(
        "Restoration: refills the cover for a later claim, so it is not counted toward what this policy can pay for one event."
      );
    }

    stack = {
      combined,
      required,
      ratio,
      verdict: stackVerdictFor(ratio),
      counted,
      excluded,
      // Prose written against a total that has since been restated cannot be
      // trusted to describe the current one.
      remarks: restated ? null : (cs.remarks ?? null),
    };
  }

  return { effectiveCover, rct, ncar, stack, restated };
};

/**
 * How the restoration line should be described to the user, or null when there is
 * nothing honest to say. Kept beside the cover calculation so the two cannot drift:
 * restoration is excluded from the number above, so it has to be visible here.
 */
export const describeRestoration = (report: ForensicAuditReport): string | null => {
  const r = report.coverage_structure?.restoration;
  if (!r?.exists) return null;

  // Say nothing unless the structured facts are actually present. Reports written
  // before 1.3.0 carry no restoration booleans at all, and a confident sentence
  // built out of their absence is a fabricated claim: "refills without limit" and
  // "refills once the cover is used up" are BOTH assertions, and neither is
  // established by a null. Silence here is correct, not a gap.
  const knowsCount = typeof r.unlimited === "boolean";
  const knowsScope = typeof r.same_illness_covered === "boolean";
  if (!knowsCount && !knowsScope) return null;

  // A restore the audit itself judged useless does not get a positive line.
  if (r.actually_useful === false) return null;

  const count = knowsCount
    ? (r.unlimited ? "without limit" : "a limited number of times")
    : "";
  const scope = knowsScope
    ? (r.same_illness_covered ? "same illness included" : "unrelated illnesses only")
    : "";
  const first = r.triggers_on_first_claim === false
    ? " The first claim is capped at the cover above."
    : "";

  const body = [count, scope].filter(Boolean).join(", ");
  return `Cover refills ${body} for a later claim.${first}`;
};

export const getVerdictColor = (verdict: Verdict): string => {
  const colors: Record<Verdict, string> = {
    EXCELLENT: "#059669",
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

  if (numeric >= 10000000) return `₹${(numeric / 10000000).toFixed(1)}Cr`;
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

/**
 * Unlock date for a month-based waiting period, using true calendar months
 * (not a 30-day approximation, which drifts ~10 days over 24 months).
 */
export const computeUnlockDateMonths = (
  inceptionDate: string | null,
  durationMonths: number | null
): string | null => {
  if (!inceptionDate || durationMonths == null) return null;
  const start = new Date(inceptionDate);
  if (isNaN(start.getTime())) return null;
  const day = start.getUTCDate();
  start.setUTCMonth(start.getUTCMonth() + durationMonths);
  // Guard month overflow (e.g. 31 Jan + 1 month → 3 Mar): clamp back to month end
  if (start.getUTCDate() < day) start.setUTCDate(0);
  return start.toISOString().split("T")[0];
};

/** Whole calendar months from today until `endDate` (min 1 while active). */
const monthsRemainingUntil = (endDate: string | null): number | null => {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (isNaN(end.getTime())) return null;
  const now = new Date();
  if (end <= now) return 0;
  let months =
    (end.getUTCFullYear() - now.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - now.getUTCMonth());
  if (end.getUTCDate() < now.getUTCDate()) months -= 1;
  return Math.max(1, months);
};

export const getWaitingPeriodStatus = (
  isActive: boolean,
  monthsRemaining: number | null,
  endDate: string | null
): { status: "active" | "served"; label: string } => {
  if (!isActive) return { status: "served", label: "✅ Served" };
  // Always prefer remaining derived from the unlock date so the label reflects
  // time left from today, not the policy's full original duration. Fall back to
  // the supplied value only when there is no usable end date.
  const remaining = monthsRemainingUntil(endDate) ?? monthsRemaining;
  if (remaining !== null && remaining > 0) {
    return { status: "active", label: `⏳ ${remaining} months remaining` };
  }
  if (endDate) {
    return { status: "active", label: `⏳ Unlocks ${endDate}` };
  }
  return { status: "active", label: "⏳ Active" };
}