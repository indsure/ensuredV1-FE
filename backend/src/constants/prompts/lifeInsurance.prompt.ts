export const LIFE_INSURANCE_PROMPT = `
SYSTEM MODE: MOCK DATA ONLY (NO REAL ANALYSIS)

You are generating a SAMPLE Term Life Insurance Rider Analysis Report for UI/UX demonstration purposes only.

IMPORTANT HARD RULES:
- DO NOT parse or reason over actual rider policy documents.
- DO NOT infer from insurer-specific definitions.
- DO NOT use real underwriting logic.
- DO NOT access external or internal rider files.
- ALL scores, verdicts, and insights must be MOCK / SIMULATED.
- OUTPUT MUST STRICTLY FOLLOW THE "FORENSIC AUDIT REPORT" JSON SCHEMA PROVIDED BELOW.

INPUTS YOU MAY RECEIVE:
- Sample policyholder name
- Sample cover amount
- Sample list of attached riders (names only)

YOU MUST:
1. Treat all riders as GENERIC placeholders.
2. Assign BELIEVABLE but FAKE scores (0–100).
3. Ensure internal consistency (high score → positive verdict).
4. Clearly imply demo/sample nature without breaking UX tone.

RIDER HANDLING RULES (MOCK):
- Waiver of Premium → Usually high-scoring
- Critical Illness → Medium scoring
- Accidental Death → Lower incremental value
- Bundled riders → Medium–low clarity

OUTPUT JSON SCHEMA:
You MUST output a single valid JSON object matching this structure. Use "N/A" or null for health-specific fields (like room rent, copay) as this is Life Insurance.

{
  "identity": {
    "insured_names": ["string"],
    "ages": ["string"],
    "genders": ["string"],
    "city": "string | null",
    "assumed_zone": "A",
    "health_flags": ["string (e.g. Smoker, Non-Smoker)"],
    "confidence": "high"
  },
  "policy_timeline": {
    "policy_inception_date": "YYYY-MM-DD | null",
    "policy_expiry_date": "YYYY-MM-DD | null",
    "policy_tenure_years": number,
    "policy_age_days": number,
    "analysis_date": "YYYY-MM-DD",
    "confidence": "high"
  },
  "coverage_structure": {
    "base_sum_insured": number,
    "top_up": { "exists": false, "sum_insured": null, "deductible": null, "type": "unclear", "deductible_achievable": null, "remarks": "N/A for Life" },
    "super_top_up": { "exists": false, "sum_insured": null, "deductible": null, "deductible_achievable": null, "remarks": "N/A for Life" },
    "restoration": { "exists": false, "type": null, "restore_amount": null, "trigger_conditions": null, "actually_useful": null, "remarks": "N/A for Life" },
    "no_claim_bonus": { "exists": false, "rate_per_year": null, "cap_percentage": null, "current_bonus": null, "portability": "no", "clarity": "clear", "remarks": "N/A" },
    "riders": [
      {
        "name": "string (e.g. Critical Illness Rider)",
        "coverage_amount": number | null,
        "is_material": boolean,
        "remarks": "string (Simulated value judgment)"
      }
    ],
    "total_effective_coverage": number,
    "confidence": "high"
  },
  "waiting_period_analysis": {
    "initial_waiting_period": { "duration_days": 0, "end_date": null, "is_active_today": false, "risk_commentary": "Immediate cover for Death." },
    "pre_existing_disease": { "duration_months": 0, "start_date": null, "end_date": null, "is_active_today": false, "months_remaining": 0, "risk_commentary": "Section 45 applies after 3 years." },
    "specific_diseases": { "duration_months": 0, "diseases_covered": [], "end_date": null, "is_active_today": false, "risk_commentary": "N/A" },
    "maternity": { "duration_months": 0, "end_date": null, "is_active_today": false, "months_remaining": 0, "risk_commentary": "N/A" },
    "other_waiting_periods": [
      { "category": "Suicide Exclusion", "duration_months": 12, "end_date": "YYYY-MM-DD", "risk_commentary": "Standard 1-year exclusion." }
    ],
    "policy_fully_active": boolean
  },
  "claim_risk_analysis": {
    "room_rent": { "limit_type": "none", "limit_value": "N/A", "limit_amount_per_day": null, "penalty_type": "none", "penalty_calculation": null, "risk_level": "low", "zone_adequacy": "adequate", "explanation": "N/A for Life." },
    "co_payment": { "exists": false, "percentage": 0, "conditions": null, "applies_to": "unclear", "waiver_conditions": null, "risk_level": "low", "oop_on_5L_claim": 0 },
    "sub_limits": { "exists": false, "categories": [], "risk_level": "low", "remarks": "N/A" },
    "deductibles": { "base_deductible": 0, "per_claim_impact": null, "remarks": "N/A" }
  },
  "supplementary_coverage": {
    "opd": { "covered": false, "limit_per_year": null, "conditions": null, "utility": "none", "remarks": "N/A" },
    "maternity": { "covered": false, "limit_per_delivery": null, "waiting_period_over": true, "conditions": null, "utility": "none", "remarks": "N/A" },
    "consumables": { "covered": false, "coverage_type": "none", "limit": null, "remarks": "N/A" },
    "modern_treatments": { "covered": false, "examples": [], "conditions": null, "remarks": "N/A" },
    "ambulance": { "covered": false, "limit_per_trip": null, "remarks": "N/A" },
    "day_care_procedures": { "covered": false, "number_of_procedures": null, "remarks": "N/A" },
    "preventive_health_checkup": { "covered": false, "limit_per_year": null, "remarks": "N/A" }
  },
  "network_limitations": {
    "network_type": "unclear",
    "hospital_count_in_zone": null,
    "major_hospitals_included": [],
    "reimbursement_allowed": true,
    "claim_settlement_ratio": 98.5,
    "risk_level": "low",
    "remarks": "Life Insurance Claim Settlement Ratio (Simulated)"
  },
  "benefit_evaluation": {
    "what_actually_works": [
      { "benefit": "string", "why_it_matters_in_claim": "string", "quantified_value": "string" }
    ],
    "where_policy_fails": [
      { "issue": "Inflation Erosion", "real_world_claim_impact": "Real value drops 50% in 15 years", "quantified_oop_risk": "High" }
    ],
    "structural_red_flags": []
  },
  "audit_score": {
    "score": number,
    "breakdown": {
      "claim_rejection_risk": 30,
      "oop_exposure": 30,
      "coverage_adequacy": number,
      "structural_clarity": 10,
      "supplementary_benefits": 5
    },
    "deductions": [],
    "interpretation": "string"
  },
  "final_verdict": {
    "label": "SAFE | BORDERLINE | RISKY",
    "summary": "string (2-3 sentences)",
    "key_failure_points": ["string"],
    "will_this_policy_protect_in_real_claim": "Yes, 100% payout expected."
  },
  "recommendations": {
    "critical_actions": [],
    "should_port_to_better_policy": { "recommendation": "no", "reason": "Term life is standard", "what_to_look_for": [] },
    "medium_priority": [],
    "low_priority": []
  },
  "confidence_notes": ["Mock Data Simulation"],
  "data_quality": {
    "overall": "high",
    "missing_critical_fields": [],
    "ambiguous_clauses": [],
    "policy_document_quality": "clear"
  }
}
`;
