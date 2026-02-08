import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// --- Zod Schemas (Matching JSON Contracts) ---

// 1. Clause Reference Schema
const ClauseReferenceSchema = z.object({
  clause_id: z.string().min(1),
  page_number: z.number().int().min(1),
  text_snippet: z.string().min(5),
  confidence: z.number().min(0).max(1)
}).strict();

// 2. Base Audit Object Schema
const BaseAuditObjectSchema = z.object({
  schema_version: z.string(),
  analysis_id: z.string().uuid(),
  generated_at: z.string().datetime(),
  prompt_hash: z.string().length(64),
  model_version: z.string(),
  policy_wordings_checksum: z.string().length(64)
});

// 3. Definitions Schema
const WaitingPeriodAnalysisSchema = z.object({
  initial_waiting_period: z.object({
    duration_days: z.number(),
    end_date: z.string().nullable(),
    is_active_today: z.boolean(),
    risk_commentary: z.string().nullable()
  }).strict(),
  pre_existing_disease: z.object({
    duration_months: z.number(),
    months_remaining: z.number(),
    start_date: z.string().nullable(),
    end_date: z.string().nullable(),
    is_active_today: z.boolean(),
    risk_commentary: z.string().nullable(),
    clause_ref: ClauseReferenceSchema
  }).strict(),
  specific_diseases: z.object({
    duration_months: z.number(),
    diseases_covered: z.array(z.string()),
    end_date: z.string().nullable(),
    is_active_today: z.boolean(),
    risk_commentary: z.string().nullable(),
    clause_ref: ClauseReferenceSchema
  }).strict(),
  policy_fully_active: z.boolean()
}).strict();

const AuditPenaltyLedgerSchema = z.object({
  initial_score: z.literal(100),
  entries: z.array(z.object({
    penalty_points: z.number().int().max(0),
    category: z.enum([
      "COVERAGE_GAP", "SUB_LIMIT", "WAITING_PERIOD",
      "COPAY_DEDUCTIBLE", "ROOM_RENT", "EXCLUSION", "AMBIGUITY"
    ]),
    reason: z.string(),
    impact_scenario: z.string(),
    clause_ref: ClauseReferenceSchema
  }).strict()),
  final_score: z.number().int().min(0).max(100)
}).strict();

const PolicyMetadataSchema = z.object({
  insurer_normalized: z.string(),
  plan_name_normalized: z.string(),
  policy_type: z.enum(["HEALTH", "LIFE", "VEHICLE", "TRAVEL", "CRITICAL_ILLNESS", "UNKNOWN"]),
  extraction_method: z.enum(["OCR_TEXT", "NATIVE_PDF", "VISION_API"]),
  policy_document_page_count: z.number().int().min(1),
  file_sha256: z.string().length(64),
  extracted_date: z.string()
}).strict();

// 4. Full Report Schema (Partial for brevity, but enforcing key structure)
const ForensicAuditReportSchema = BaseAuditObjectSchema.extend({
  policy_metadata: PolicyMetadataSchema,
  audit_ledger: AuditPenaltyLedgerSchema,
  identity: z.object({
    insured_names: z.array(z.string()),
    confidence: z.enum(["high", "medium", "low"]),
    assumed_zone: z.enum(["A", "B", "C", "D", "Unknown"]),
    ages: z.array(z.string().nullable()),
    genders: z.array(z.string().nullable()),
    city: z.string().nullable(),
    health_flags: z.array(z.string())
  }).strict(),
  policy_timeline: z.object({
    policy_tenure_years: z.number(),
    analysis_date: z.string(),
    confidence: z.enum(["high", "medium", "low"]),
    policy_inception_date: z.string().nullable(),
    policy_expiry_date: z.string().nullable(),
    policy_age_days: z.number()
  }).strict(),
  coverage_structure: z.object({
    base_sum_insured: z.number(),
    total_effective_coverage: z.number(),
    confidence: z.string(),
    riders: z.array(z.object({
      name: z.string(),
      is_material: z.boolean(),
      coverage_amount: z.number().nullable(),
      remarks: z.string().nullable(),
      clause_ref: ClauseReferenceSchema
    })),
    top_up: z.object({
      exists: z.boolean(),
      sum_insured: z.number().nullable(),
      deductible: z.number().nullable(),
      type: z.string().nullable(),
      deductible_achievable: z.boolean().nullable(),
      remarks: z.string().nullable(),
      clause_ref: ClauseReferenceSchema.optional() // Optional if not exists, logic below
    }),
    super_top_up: z.object({
      exists: z.boolean(),
      sum_insured: z.number().nullable(),
      deductible: z.number().nullable(),
      deductible_achievable: z.boolean().nullable(),
      remarks: z.string().nullable(),
      clause_ref: ClauseReferenceSchema.optional()
    }),
    restoration: z.object({
      exists: z.boolean(),
      type: z.string().nullable(),
      restore_amount: z.number().nullable(),
      trigger_conditions: z.string().nullable(),
      actually_useful: z.boolean().nullable(),
      remarks: z.string().nullable(),
      clause_ref: ClauseReferenceSchema.optional()
    })
  }).strict(),
  waiting_period_analysis: WaitingPeriodAnalysisSchema,
  claim_risk_analysis: z.object({
    room_rent: z.object({
      limit_type: z.enum(["none", "specific_amount", "room_category", "percentage_of_si"]),
      limit_value: z.string().nullable(),
      risk_level: z.enum(["low", "medium", "high", "critical"]),
      explanation: z.string().nullable(),
      clause_ref: ClauseReferenceSchema
    }).strict(),
    co_payment: z.object({
      exists: z.boolean(),
      percentage: z.number().nullable(),
      conditions: z.string().nullable(),
      risk_level: z.string(),
      oop_on_5L_claim: z.number().nullable(),
      clause_ref: ClauseReferenceSchema
    }).strict(),
    sub_limits: z.object({
      exists: z.boolean(),
      risk_level: z.string(),
      remarks: z.string().nullable(),
      categories: z.array(z.object({
        name: z.string(),
        limit: z.string(),
        clause_ref: ClauseReferenceSchema
      }))
    }).strict(),
    deductibles: z.object({
      base_deductible: z.number(),
      per_claim_impact: z.string().nullable(),
      remarks: z.string().nullable(),
      clause_ref: ClauseReferenceSchema.optional()
    }).strict()
  }).strict(),
  supplementary_coverage: z.record(z.string(), z.object({
    covered: z.boolean(),
    limit: z.string().nullable(),
    conditions: z.string().nullable(),
    remarks: z.string().nullable(),
    clause_ref: ClauseReferenceSchema.optional()
  })),
  network_limitations: z.any(), // Keeping loose for brevity in this snippet, normally strict
  benefit_evaluation: z.any(),
  suitability_analysis: z.object({
    rbc_value: z.number(),
    bcar_ratio: z.number(),
    structural_verdict: z.enum(["SAFE", "BORDERLINE", "RISKY"]),
    first_claim_simulation: z.object({
      scenario_cost: z.number(),
      estimated_oop: z.number(),
      oop_ratio: z.number(),
      verdict: z.string()
    }).optional()
  }).optional(), // Optional for now to allow transitional data
  // audit_score: AuditPenaltyLedgerSchema, // REMOVED: Redundant with audit_ledger
  final_verdict: z.object({
    label: z.enum(["SAFE", "BORDERLINE", "RISKY"]),
    summary: z.string(),
    key_failure_points: z.array(z.string()),
    will_this_policy_protect_in_real_claim: z.string(),
    verdict_clause_refs: z.array(ClauseReferenceSchema)
  }).strict(),
  recommendations: z.any(),
  data_quality: z.any(),
  confidence_notes: z.array(z.string())
});


export class PolicyTransformer {

  /**
   * The Hard Gate: Accepts raw model output and strictly enforces contracts.
   */
  public static transform(rawJson: any): any {

    // 1. Contract Validation (Structure & Types)
    const parseResult = ForensicAuditReportSchema.safeParse(rawJson);

    if (!parseResult.success) {
      console.error("Schema Violation Errors:", parseResult.error.format());
      throw new Error(`SCHEMA_VIOLATION: ${parseResult.error.issues.map(i => i.path.join('.') + ': ' + i.message).join(', ')}`);
    }

    const data = parseResult.data;

    // 2. Clause Trace Enforcement (Logic Check)
    this.enforceClauseRef(data);

    // 3. Scoring Invariants (Math Check)
    this.enforceScoringMath(data.audit_ledger);

    // 4. Output Normalization (Dates, etc.)
    // Zod already handles strict type coercion if configured, but we can do extra passes here.

    return data;
  }

  private static enforceClauseRef(data: any) {
    // Audit Ledger Entries
    data.audit_ledger.entries.forEach((entry: any, index: number) => {
      if (!entry.clause_ref || !entry.clause_ref.clause_id) {
        throw new Error(`CLAUSE_TRACE_MISSING: Ledger entry #${index} (${entry.reason}) lacks valid clause citation.`);
      }
    });

    // Room Rent
    if (!data.claim_risk_analysis.room_rent.clause_ref) {
      throw new Error("CLAUSE_TRACE_MISSING: Room Rent analysis lacks clause citation.");
    }

    // Co-payment
    if (!data.claim_risk_analysis.co_payment.clause_ref) {
      throw new Error("CLAUSE_TRACE_MISSING: Co-payment analysis lacks clause citation.");
    }
  }

  private static enforceScoringMath(ledger: any) {
    // Rule 1: Starts at 100
    if (ledger.initial_score !== 100) {
      throw new Error("SCORING_INVARIANT_VIOLATION: Initial score must be 100.");
    }

    // Rule 2: Penalties are negative integers
    let calculatedPenalties = 0;
    ledger.entries.forEach((entry: any) => {
      if (entry.penalty_points > 0) {
        throw new Error(`SCORING_INVARIANT_VIOLATION: Penalty must be negative. Found ${entry.penalty_points}.`);
      }
      if (!Number.isInteger(entry.penalty_points)) {
        throw new Error(`SCORING_INVARIANT_VIOLATION: Penalty must be integer. Found ${entry.penalty_points}.`);
      }
      calculatedPenalties += entry.penalty_points;
    });

    // Rule 3: Final Score Calculation
    const expectedFinal = 100 + calculatedPenalties;
    // Clamp to 0 if logic allows, but schema says min 0.
    const clampedFinal = Math.max(0, expectedFinal);

    if (ledger.final_score !== clampedFinal) {
      throw new Error(`SCORING_MATH_ERROR: Reported ${ledger.final_score} but calculated ${clampedFinal} (100 + ${calculatedPenalties}).`);
    }
  }
}

export function transformRawExtraction(rawJson: any, _originalName: string) {
  return PolicyTransformer.transform(rawJson);
}
