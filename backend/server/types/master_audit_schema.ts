
/**
 * IndSure Forensic Policy Audit Schema
 * Complete TypeScript interface matching MASTER_AUDIT_PROMPT
 * Version: 2.0 - Comprehensive Forensic Analysis
 */

export interface ForensicAuditReport {
    identity: {
        insured_names: string[];
        ages: (number | string)[]; // Allow "35-40", "unclear", or exact numbers
        genders: string[];
        city: string | null;
        assumed_zone: "A" | "B" | "C";
        health_flags: string[]; // Pre-existing conditions, risk indicators
        confidence: "high" | "medium" | "low";
    };

    policy_timeline: {
        policy_inception_date: string | null; // YYYY-MM-DD
        policy_expiry_date: string | null; // YYYY-MM-DD
        policy_tenure_years: number | null;
        policy_age_days: number | null; // Days since inception
        analysis_date: string; // YYYY-MM-DD
        confidence: "high" | "medium" | "low";
    };

    coverage_structure: {
        base_sum_insured: number | "unlimited" | null;
        top_up: {
            exists: boolean;
            sum_insured: number | null;
            deductible: number | null;
            type: "top-up" | "super-top-up" | "unclear";
            deductible_achievable: boolean | null; // Can deductible be reached in single claim?
            remarks: string;
        };
        super_top_up: {
            exists: boolean;
            sum_insured: number | null;
            deductible: number | null;
            deductible_achievable: boolean | null;
            remarks: string;
        };
        restoration: {
            exists: boolean;
            type: "full" | "partial" | "unclear" | null;
            restore_amount: number | string | null; // Amount or percentage
            trigger_conditions: string | null;
            actually_useful: boolean | null; // Real-world utility assessment
            remarks: string;
        };
        no_claim_bonus: {
            exists: boolean;
            rate_per_year: number | null; // Percentage increase per year
            cap_percentage: number | null; // Max bonus as % of base SI
            current_bonus: number | null; // Current accumulated bonus
            portability: "yes" | "no" | "unclear";
            clarity: "clear" | "unclear";
            remarks: string;
        };
        riders: Array<{
            name: string;
            coverage_amount: number | null;
            is_material: boolean; // Does it materially improve claim outcomes?
            remarks: string;
        }>;
        total_effective_coverage: number | string | null; // Base + top-up + restoration
        confidence: "high" | "medium" | "low";
    };

    waiting_period_analysis: {
        initial_waiting_period: {
            duration_days: number;
            end_date: string | null; // YYYY-MM-DD
            is_active_today: boolean;
            risk_commentary: string;
        };
        pre_existing_disease: {
            duration_months: number;
            start_date: string | null; // YYYY-MM-DD
            end_date: string | null; // YYYY-MM-DD
            is_active_today: boolean;
            months_remaining: number | null;
            risk_commentary: string;
        };
        specific_diseases: {
            duration_months: number;
            diseases_covered: string[]; // Hernia, cataract, joint replacement, etc.
            end_date: string | null; // YYYY-MM-DD
            is_active_today: boolean;
            risk_commentary: string;
        };
        maternity: {
            duration_months: number;
            end_date: string | null; // YYYY-MM-DD
            is_active_today: boolean;
            months_remaining: number | null;
            risk_commentary: string;
        };
        other_waiting_periods: Array<{
            category: string;
            duration_months: number;
            end_date: string | null; // YYYY-MM-DD
            risk_commentary: string;
        }>;
        policy_fully_active: boolean; // All waiting periods expired?
    };

    claim_risk_analysis: {
        room_rent: {
            limit_type: "absolute" | "percentage" | "category" | "none" | "unclear";
            limit_value: string | null; // "₹5000/day" or "1% of SI" or "Single AC"
            limit_amount_per_day: number | null; // Calculated amount in INR
            penalty_type: "none" | "proportional" | "unclear";
            penalty_calculation: string | null; // Explain how penalty is calculated
            risk_level: "low" | "medium" | "high";
            zone_adequacy: "adequate" | "marginal" | "inadequate";
            explanation: string; // Plain language explanation with examples
        };
        co_payment: {
            exists: boolean;
            percentage: number | null;
            conditions: string | null;
            applies_to: "all_claims" | "seniors_only" | "specific_treatments" | "unclear";
            waiver_conditions: string | null;
            risk_level: "low" | "medium" | "high";
            oop_on_5L_claim: number | null; // Out-of-pocket on ₹5L claim
        };
        sub_limits: {
            exists: boolean;
            categories: Array<{
                procedure: string; // Cataract, joint replacement, dialysis, etc.
                limit: number | null;
                typical_cost_in_zone: number | null;
                gap: number | null; // Cost - limit = OOP exposure
                severity: "low" | "medium" | "high";
            }>;
            risk_level: "low" | "medium" | "high";
            remarks: string;
        };
        deductibles: {
            base_deductible: number | null;
            per_claim_impact: string | null;
            remarks: string;
        };
    };

    supplementary_coverage: {
        opd: {
            covered: boolean;
            limit_per_year: number | null;
            conditions: string | null;
            utility: "high" | "medium" | "low" | "none";
            remarks: string;
        };
        maternity: {
            covered: boolean;
            limit_per_delivery: number | null;
            waiting_period_over: boolean;
            conditions: string | null;
            utility: "high" | "medium" | "low" | "none";
            remarks: string;
        };
        consumables: {
            covered: boolean;
            coverage_type: "full" | "partial" | "none" | "unclear";
            limit: string | null; // "100%", "50%", "₹50,000", etc.
            remarks: string;
        };
        modern_treatments: {
            covered: boolean;
            examples: string[]; // Robotic surgery, HIPEC, stem cell, etc.
            conditions: string | null;
            remarks: string;
        };
        ambulance: {
            covered: boolean;
            limit_per_trip: number | null;
            remarks: string;
        };
        day_care_procedures: {
            covered: boolean;
            number_of_procedures: number | null;
            remarks: string;
        };
        preventive_health_checkup: {
            covered: boolean;
            limit_per_year: number | null;
            remarks: string;
        };
    };

    network_limitations: {
        network_type: "cashless_only" | "cashless_and_reimbursement" | "unclear";
        hospital_count_in_zone: number | string | null; // Number or "500+"
        major_hospitals_included: string[]; // Apollo, Fortis, Max, etc.
        reimbursement_allowed: boolean | "unclear";
        claim_settlement_ratio: number | null; // Insurer's CSR %
        risk_level: "low" | "medium" | "high";
        remarks: string;
    };

    benefit_evaluation: {
        what_actually_works: Array<{
            benefit: string;
            why_it_matters_in_claim: string;
            quantified_value: string | null; // "Saves ₹X in typical claim"
        }>;
        where_policy_fails: Array<{
            issue: string;
            real_world_claim_impact: string;
            quantified_oop_risk: string | null; // "₹X OOP on ₹Y claim"
        }>;
        structural_red_flags: Array<{
            flag: string;
            why_it_is_dangerous: string;
            severity: "high" | "medium" | "low";
        }>;
    };

    audit_score: {
        score: number; // 0-100
        breakdown: {
            claim_rejection_risk: number; // max 30
            oop_exposure: number; // max 30
            coverage_adequacy: number; // max 20
            structural_clarity: number; // max 10
            supplementary_benefits: number; // max 10
        };
        deductions: Array<{
            reason: string;
            category: string; // Which breakdown category
            severity: "high" | "medium" | "low";
            points: number;
        }>;
        interpretation: string; // What the score means
    };

    final_verdict: {
        label: "SAFE" | "BORDERLINE" | "RISKY";
        summary: string; // 2-3 sentences explaining verdict
        key_failure_points: string[]; // Most dangerous aspects
        will_this_policy_protect_in_real_claim: string; // Bottom-line answer
    };

    recommendations: {
        critical_actions: Array<{
            action: string;
            reason: string;
            oop_risk_if_ignored: string | null;
            suggested_riders_or_topups: string[];
            estimated_cost: string | null;
        }>;
        should_port_to_better_policy: {
            recommendation: "yes" | "no" | "consider";
            reason: string;
            what_to_look_for: string[];
        };
        medium_priority: Array<{
            action: string;
            reason: string;
        }>;
        low_priority: Array<{
            action: string;
            reason: string;
        }>;
    };

    forward_planning_truths: Array<{
        title: string;
        statement: string; // The direct fact
        implication: string; // The specific outcome/impact
    }>;

    positive_state_assertions: Array<{
        label: string; // e.g., "Initial Waiting Period"
        status: string; // e.g., "Served. Non-accidental hospitalization is covered."
    }>;

    decision_summary: {
        recommended_if: string[]; // Conditions where policy is suitable
        not_recommended_if: string[]; // Conditions where policy is unsuitable
    };

    future_planning_considerations: Array<{
        title: string;
        body: string;
        disclosure: string;
        neutral_context: string;
    }>;

    confidence_notes: string[]; // All uncertainties, missing data, assumptions

    data_quality: {
        overall: "high" | "medium" | "low";
        missing_critical_fields: string[];
        ambiguous_clauses: string[];
        policy_document_quality: "clear" | "acceptable" | "poor" | "unclear";
    };
}

/**
 * Type guards for runtime validation
 */
export const isValidVerdict = (label: string): label is ForensicAuditReport['final_verdict']['label'] => {
    return ['SAFE', 'BORDERLINE', 'RISKY'].includes(label);
};

export const isValidZone = (zone: string): zone is ForensicAuditReport['identity']['assumed_zone'] => {
    return ['A', 'B', 'C'].includes(zone);
};

export const isValidConfidence = (confidence: string): confidence is 'high' | 'medium' | 'low' => {
    return ['high', 'medium', 'low'].includes(confidence);
};

export const isValidRiskLevel = (level: string): level is 'low' | 'medium' | 'high' => {
    return ['low', 'medium', 'high'].includes(level);
};

export const isValidSeverity = (severity: string): severity is 'high' | 'medium' | 'low' => {
    return ['high', 'medium', 'low'].includes(severity);
};

/**
 * Validation helper to ensure AI output matches schema
 */
export const validateForensicAuditReport = (data: any): data is ForensicAuditReport => {
    try {
        // Critical field checks
        if (!data.identity || !data.policy_timeline || !data.coverage_structure) {
            return false;
        }

        if (!isValidZone(data.identity.assumed_zone)) {
            return false;
        }

        if (!isValidVerdict(data.final_verdict.label)) {
            return false;
        }

        if (typeof data.audit_score.score !== 'number' ||
            data.audit_score.score < 0 ||
            data.audit_score.score > 100) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
};

/**
 * Helper function to calculate effective coverage
 */
export const calculateEffectiveCoverage = (report: ForensicAuditReport): number | null => {
    const base = typeof report.coverage_structure.base_sum_insured === 'number'
        ? report.coverage_structure.base_sum_insured
        : null;

    const topUp = report.coverage_structure.top_up.exists && report.coverage_structure.top_up.sum_insured
        ? report.coverage_structure.top_up.sum_insured
        : 0;

    const superTopUp = report.coverage_structure.super_top_up.exists && report.coverage_structure.super_top_up.sum_insured
        ? report.coverage_structure.super_top_up.sum_insured
        : 0;

    if (base === null) return null;

    return base + topUp + superTopUp;
};

/**
 * Helper to get human-readable verdict color
 */
export const getVerdictColor = (verdict: ForensicAuditReport['final_verdict']['label']): string => {
    switch (verdict) {
        case 'SAFE': return '#10B981'; // Green
        case 'BORDERLINE': return '#F59E0B'; // Amber
        case 'RISKY': return '#EF4444'; // Red
    }
};

/**
 * Helper to format currency
 */
export const formatINR = (amount: number | null): string => {
    if (amount === null) return 'N/A';
    return `₹${amount.toLocaleString('en-IN')}`;
};
