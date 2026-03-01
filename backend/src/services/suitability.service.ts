export interface UserProfile {
    age?: number;
    cityTier?: 'Tier 1' | 'Tier 2' | 'Tier 3';
    hasPED?: boolean;
    pedCount?: number;
}

export interface SuitabilityResult {
    rbc_value: number;
    bcar_ratio: number;
    structural_verdict: "SAFE" | "BORDERLINE" | "RISKY";
    details: string[];
    first_claim_simulation: {
        scenario_cost: number;
        estimated_oop: number;
        oop_ratio: number;
        verdict: string;
    };
}

export class SuitabilityEngine {
    private static readonly BASE_COST = 10_00_000; // 10 Lakhs

    public static evaluate(
        baseSumInsured: number,
        profile: UserProfile,
        subLimits: any
    ): SuitabilityResult {

        const rbc = this.computeRBC(profile);
        const bcar = baseSumInsured / rbc;

        let verdict: "SAFE" | "BORDERLINE" | "RISKY";
        if (bcar < 0.4) verdict = "RISKY";
        else if (bcar < 0.7) verdict = "BORDERLINE";
        else verdict = "SAFE";

        const simulation = this.simulateFirstClaim(baseSumInsured, profile, subLimits);

        if (simulation.oop_ratio > 0.20 && verdict !== "RISKY") {
            verdict = "RISKY";
        } else if (simulation.oop_ratio > 0.10 && verdict === "SAFE") {
            verdict = "BORDERLINE";
        }

        return {
            rbc_value: rbc,
            bcar_ratio: parseFloat(bcar.toFixed(2)),
            structural_verdict: verdict,
            details: [
                `Required Base Cover (RBC): ₹${(rbc / 100000).toFixed(1)}L`,
                `Base Cover Adequacy Ratio (BCAR): ${bcar.toFixed(2)}`,
                `First Claim OOP Ratio: ${(simulation.oop_ratio * 100).toFixed(1)}%`
            ],
            first_claim_simulation: simulation
        };
    }

    private static computeRBC(profile: UserProfile): number {
        let multiplier = 1.0;

        if (profile.cityTier === 'Tier 1') multiplier *= 1.4;
        else if (profile.cityTier === 'Tier 2') multiplier *= 1.2;

        const age = profile.age || 35;
        if (age >= 60) multiplier *= 1.8;
        else if (age >= 50) multiplier *= 1.5;
        else if (age >= 40) multiplier *= 1.2;

        if (profile.pedCount && profile.pedCount > 1) multiplier *= 1.7;
        else if (profile.hasPED || (profile.pedCount === 1)) multiplier *= 1.4;

        return this.BASE_COST * multiplier;
    }

    private static simulateFirstClaim(baseSI: number, profile: UserProfile, subLimits: any) {
        const claimAmount = 200000;
        let payable = claimAmount;

        if (subLimits?.room_rent?.risk_level === 'critical') {
            payable *= 0.70;
        } else if (subLimits?.room_rent?.risk_level === 'medium') {
            payable *= 0.85;
        }

        if (subLimits?.co_payment?.exists && subLimits?.co_payment?.percentage) {
            const copay = subLimits.co_payment.percentage / 100;
            payable = payable * (1 - copay);
        }

        const oop = Math.max(0, claimAmount - payable);

        return {
            scenario_cost: claimAmount,
            estimated_oop: oop,
            oop_ratio: parseFloat((oop / claimAmount).toFixed(2)),
            verdict: oop > (claimAmount * 0.2) ? "FAILED" : "PASSED"
        };
    }
}
