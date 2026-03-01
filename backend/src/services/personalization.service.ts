import cityTiersData from "../data/city_tiers.json" with { type: "json" };
import type { UserProfile } from "../types/userProfile";

const TIER1_CITIES = new Set(cityTiersData.tier1.map((c) => c.toLowerCase()));
const TIER2_CITIES = new Set(cityTiersData.tier2.map((c) => c.toLowerCase()));

// PED conditions that trigger heightened risk profiles
const HIGH_RISK_PEDS = new Set([
  "cancer",
  "heart disease",
  "cardiac",
  "cardiovascular",
  "stroke",
  "renal failure",
  "kidney failure",
  "dialysis",
]);

const DIABETES_KEYWORDS = ["diabetes", "diabetic", "type 1", "type 2", "sugar"];
const HYPERTENSION_KEYWORDS = ["hypertension", "blood pressure", "bp"];

export interface SuitabilityAdjustments {
  riskMultiplier: number;
  premiumCeilingPercent: number;
  details: string[];
}

export class PersonalizationService {
  static deriveCityTier(
    city?: string,
    state?: string
  ): "Tier 1" | "Tier 2" | "Tier 3" {
    if (city) {
      const lower = city.toLowerCase().trim();
      if (TIER1_CITIES.has(lower)) return "Tier 1";
      if (TIER2_CITIES.has(lower)) return "Tier 2";
    }
    // Delhi state → Tier 1
    if (state?.toLowerCase().includes("delhi")) return "Tier 1";
    return "Tier 3";
  }

  /**
   * Generate prompt context from user profile for AI personalization.
   */
  static generateProfileContext(profile: UserProfile): string {
    const parts: string[] = [];
    const personalizations: string[] = [];

    // Basic info
    const infoParts: string[] = [];
    if (profile.age) infoParts.push(`Age: ${profile.age} years`);
    if (profile.city) {
      const tier = profile.cityTier || this.deriveCityTier(profile.city, profile.state);
      infoParts.push(`City: ${profile.city} (${tier})`);
    }
    if (profile.familySize && profile.familySize > 1) {
      infoParts.push(`Family size: ${profile.familySize}`);
    }
    if (profile.preExistingConditions?.length) {
      infoParts.push(
        `Pre-existing conditions: ${profile.preExistingConditions.join(", ")}`
      );
    }
    if (profile.householdIncome) {
      const inLakhs = profile.householdIncome / 100000;
      infoParts.push(`Household income: ~${inLakhs.toFixed(0)} LPA`);
    }

    if (infoParts.length > 0) {
      parts.push("USER PROFILE:\n" + infoParts.map((p) => `- ${p}`).join("\n"));
    }

    // Personalization context
    const tier = profile.cityTier || this.deriveCityTier(profile.city, profile.state);
    if (tier === "Tier 1") {
      personalizations.push(
        "Tier 1 city: hospital costs 30-50% higher than national average"
      );
    } else if (tier === "Tier 2") {
      personalizations.push(
        "Tier 2 city: hospital costs 10-20% above national average"
      );
    }

    // PED-specific personalizations
    if (profile.preExistingConditions?.length) {
      const peds = profile.preExistingConditions.map((p) => p.toLowerCase());

      if (peds.some((p) => DIABETES_KEYWORDS.some((k) => p.includes(k)))) {
        personalizations.push(
          "Diabetes: triggers PED waiting period (typically 36-48 months)"
        );
        personalizations.push(
          "Diabetes: increases claim probability for cardiovascular, renal, ophthalmology"
        );
      }
      if (peds.some((p) => HYPERTENSION_KEYWORDS.some((k) => p.includes(k)))) {
        personalizations.push(
          "Hypertension: triggers PED waiting period, increased stroke/cardiac risk"
        );
      }
      if (peds.some((p) => HIGH_RISK_PEDS.has(p))) {
        personalizations.push(
          "High-risk PED detected: verify coverage exclusions and sub-limits carefully"
        );
      }
    }

    // Family-size specific
    if (profile.familySize && profile.familySize > 2) {
      personalizations.push(
        `Family of ${profile.familySize}: consider floater vs individual policy cost comparison`
      );
    }

    // Income-based premium advice
    if (profile.householdIncome) {
      const maxPremium5 = (profile.householdIncome * 0.05) / 100000;
      const maxPremium8 = (profile.householdIncome * 0.08) / 100000;
      personalizations.push(
        `Income ${(profile.householdIncome / 100000).toFixed(0)}L: premium should not exceed 5-8% of income (~₹${(maxPremium5 * 100000).toLocaleString("en-IN")}-₹${(maxPremium8 * 100000).toLocaleString("en-IN")}/year)`
      );
    }

    if (personalizations.length > 0) {
      parts.push(
        "PERSONALIZATION CONTEXT:\n" +
          personalizations.map((p) => `- ${p}`).join("\n")
      );
    }

    return parts.join("\n");
  }

  /**
   * Adjust suitability thresholds based on user profile.
   */
  static adjustSuitabilityParams(
    profile: UserProfile
  ): SuitabilityAdjustments {
    let riskMultiplier = 1.0;
    const details: string[] = [];

    // Family size adjustment
    if (profile.familySize && profile.familySize > 2) {
      const familyMultiplier = 1 + (profile.familySize - 2) * 0.15;
      riskMultiplier *= familyMultiplier;
      details.push(
        `Family size ${profile.familySize}: risk multiplier ×${familyMultiplier.toFixed(2)}`
      );
    }

    // High-risk PED adjustment
    if (profile.preExistingConditions?.length) {
      const peds = profile.preExistingConditions.map((p) => p.toLowerCase());
      if (
        peds.some(
          (p) =>
            HIGH_RISK_PEDS.has(p) ||
            p.includes("cancer") ||
            p.includes("heart")
        )
      ) {
        riskMultiplier *= 2.0;
        details.push("High-risk PED (cancer/heart): risk multiplier ×2.0");
      }
    }

    // Premium ceiling as % of income
    const premiumCeilingPercent = profile.householdIncome ? 8 : 10;

    return { riskMultiplier, premiumCeilingPercent, details };
  }
}
