/**
 * Risk Meter Evaluation Thresholds
 * 
 * All values in Indian Rupees (₹)
 * Used for deterministic risk classification
 */

export const THRESHOLDS = {
  // Sum Insured Minimums (Hard Fail)
  SI_MIN_METRO: 300_000, // ₹3L
  SI_MIN_NON_METRO: 200_000, // ₹2L

  // Sum Insured Adequacy (Core Check)
  SI_ADEQUATE_METRO: 1_000_000, // ₹10L
  SI_ADEQUATE_NON_METRO: 700_000, // ₹7L

  // Major Sub-limits Minimums
  CARDIAC_SUBLIMIT_MIN: 200_000, // ₹2L
  CANCER_SUBLIMIT_MIN: 500_000, // ₹5L
  ORTHOPEDIC_SUBLIMIT_MIN: 100_000, // ₹1L

  // Co-pay Thresholds
  COPAY_HIGH_THRESHOLD: 20, // 20% (Hard Fail)
  COPAY_MINOR_THRESHOLD: 10, // 10% (Minor Gap)

  // Minor Gap Thresholds
  AMBULANCE_MIN: 3_000, // ₹3k
  DIAGNOSTICS_MIN: 5_000, // ₹5k
  PHARMACY_MIN: 5_000, // ₹5k
} as const;

