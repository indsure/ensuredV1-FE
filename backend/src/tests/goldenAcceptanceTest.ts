import { PolicyTransformer } from '../utils/policyTransformer.js';
import { ReplayMechanism } from '../utils/replayMechanism.js';
import assert from 'assert';

// --- Golden Data: Known Bad Policy ---
const GOLDEN_BAD_INPUT_RAW = {
    "schema_version": "2.0.0",
    "analysis_id": "00000000-0000-0000-0000-000000000000",
    "generated_at": "2026-02-04T12:00:00Z",
    "prompt_hash": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "model_version": "gemini-3-pro-preview",
    "policy_wordings_checksum": "f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5",
    "identity": {
        "insured_names": ["Test User"], "confidence": "high", "assumed_zone": "A",
        "ages": ["30"], "genders": ["Male"], "city": "Delhi", "health_flags": []
    },
    "policy_metadata": {
        "insurer_normalized": "Bad Insurer", "plan_name_normalized": "Worst Plan",
        "policy_type": "HEALTH", "extraction_method": "OCR_TEXT",
        "policy_document_page_count": 5, "file_sha256": "f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5", "extracted_date": "2024-01-01"
    },
    "policy_timeline": {
        "policy_tenure_years": 1, "analysis_date": "2026-02-04",
        "confidence": "high", "policy_inception_date": "2024-01-01",
        "policy_expiry_date": "2025-01-01", "policy_age_days": 365
    },
    "coverage_structure": {
        "base_sum_insured": 100000, "total_effective_coverage": 100000, "confidence": "high", "riders": [],
        "top_up": { "exists": false, "remarks": null, "sum_insured": null, "deductible": null, "type": null, "deductible_achievable": null },
        "super_top_up": { "exists": false, "remarks": null, "sum_insured": null, "deductible": null, "deductible_achievable": null },
        "restoration": { "exists": false, "remarks": null, "type": null, "restore_amount": null, "trigger_conditions": null, "actually_useful": null }
    },
    "waiting_period_analysis": {
        "initial_waiting_period": { "duration_days": 30, "end_date": null, "is_active_today": false, "risk_commentary": null },
        "pre_existing_disease": {
            "duration_months": 48, "months_remaining": 48, "start_date": null, "end_date": null, "is_active_today": true, "risk_commentary": "Critical 4 Year Wait",
            "clause_ref": { "clause_id": "9.1", "page_number": 2, "text_snippet": "PED wait 48 months", "confidence": 1 }
        },
        "specific_diseases": {
            "duration_months": 24, "diseases_covered": [], "end_date": null, "is_active_today": true, "risk_commentary": null,
            "clause_ref": { "clause_id": "9.2", "page_number": 2, "text_snippet": "Specific 24 months", "confidence": 1 }
        },
        "policy_fully_active": false
    },
    "claim_risk_analysis": {
        "room_rent": {
            "limit_type": "specific_amount", "limit_value": "1000/day", "risk_level": "critical", "explanation": "Low Cap",
            "clause_ref": { "clause_id": "3.1", "page_number": 1, "text_snippet": "Max 1000 per day", "confidence": 1 }
        },
        "co_payment": {
            "exists": true, "percentage": 20, "conditions": "All claims", "risk_level": "high", "oop_on_5L_claim": 100000,
            "clause_ref": { "clause_id": "3.2", "page_number": 1, "text_snippet": "20% co-pay applicable", "confidence": 1 }
        },
        "sub_limits": { "exists": false, "risk_level": "low", "remarks": null, "categories": [] },
        "deductibles": { "base_deductible": 0, "per_claim_impact": null, "remarks": null }
    },
    "supplementary_coverage": {},
    "network_limitations": null,
    "benefit_evaluation": null,
    "audit_ledger": {
        "initial_score": 100,
        "entries": [
            {
                "penalty_points": -30, "category": "WAITING_PERIOD", "reason": "4 Year PED Wait", "impact_scenario": "No coverage for 4 years",
                "clause_ref": { "clause_id": "9.1", "page_number": 2, "text_snippet": "PED wait 48 months", "confidence": 1 }
            },
            {
                "penalty_points": -15, "category": "ROOM_RENT", "reason": "Low Room Limit", "impact_scenario": "Heavy deduction",
                "clause_ref": { "clause_id": "3.1", "page_number": 1, "text_snippet": "Max 1000 per day", "confidence": 1 }
            },
            {
                "penalty_points": -20, "category": "COPAY_DEDUCTIBLE", "reason": "20% Co-pay", "impact_scenario": "20% loss",
                "clause_ref": { "clause_id": "3.2", "page_number": 1, "text_snippet": "20% co-pay applicable", "confidence": 1 }
            }
        ],
        "final_score": 35
    },
    "final_verdict": {
        "label": "RISKY", "summary": "Avoid", "key_failure_points": ["4yr Wait", "Low Room Rent", "20% Copay"],
        "will_this_policy_protect_in_real_claim": "No", "verdict_clause_refs": []
    },
    "recommendations": null, "data_quality": null, "confidence_notes": []
};


// --- The Test ---
async function runGoldenAcceptance() {
    console.log("Running Golden Acceptance Test...");

    try {
        // 1. Transform Step (Validates Schema + Logic + Scores)
        console.log("Step 1: Transformer Gate...");
        const cleanOutput = PolicyTransformer.transform(GOLDEN_BAD_INPUT_RAW);
        console.log(" Transformer Passed.");

        // 2. Assert Exact Penalties (Known Bad Policy)
        console.log("Step 2: Penalties Verification...");
        assert.strictEqual(cleanOutput.audit_ledger.final_score, 35, "Final Score mismatch");
        assert.strictEqual(cleanOutput.audit_ledger.entries.length, 3, "Penalty count mismatch");

        // 3. Replay Verification
        console.log("Step 3: Replay Mechanism...");
        const replayResult = ReplayMechanism.verifyReplay(GOLDEN_BAD_INPUT_RAW, cleanOutput);
        if (!replayResult.matches) {
            throw new Error("Replay Mismatch: " + replayResult.diffs.join(", "));
        }
        console.log(" Replay Verified.");

        console.log("GOLDEN TEST PASSED. System is Operational.");

    } catch (err: any) {
        console.error("GOLDEN TEST FAILED:", err.message);
        process.exit(1);
    }
}

runGoldenAcceptance();
