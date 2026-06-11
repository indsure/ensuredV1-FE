/**
 * Insurance-type registry for the agent portal.
 *
 * `health` keeps the full forensic-audit flow (score + PolicyAuditReport).
 * The "data-entry" types (motor/life/travel/property) use OCR-only extraction
 * into the flat fields below — no score, no audit. The review form, the
 * type-aware list, and the Excel export are all driven by this file.
 *
 * IMPORTANT: keep the field lists in sync with the backend copy at
 *   backend/server/services/extractionFields.ts
 */

export type FieldType = "text" | "number" | "date";

export type SharedColumn =
  | "insurer"
  | "policy_name"
  | "expiry_date"
  | "sum_insured"
  | "policyholder_name";

export interface ExtractionField {
  key: string;
  label: string;
  type: FieldType;
  shared?: SharedColumn;
}

export const DATA_ENTRY_TYPES = ["motor", "life", "term", "travel", "property"] as const;
export type DataEntryType = (typeof DATA_ENTRY_TYPES)[number];
export type InsuranceType = "health" | DataEntryType;

export function isDataEntryType(type: string | null | undefined): type is DataEntryType {
  return !!type && (DATA_ENTRY_TYPES as readonly string[]).includes(type);
}

/** Label + emoji used in the type selector, badges and filters. */
export const TYPE_META: Record<InsuranceType, { label: string; emoji: string }> = {
  health: { label: "Health", emoji: "🩺" },
  motor: { label: "Motor", emoji: "🚗" },
  life: { label: "Life", emoji: "🛡️" },
  term: { label: "Term", emoji: "⏳" },
  travel: { label: "Travel", emoji: "✈️" },
  property: { label: "Property", emoji: "🏠" },
};

export const EXTRACTION_FIELDS: Record<DataEntryType, ExtractionField[]> = {
  motor: [
    { key: "policyholder_name", label: "Policyholder name", type: "text", shared: "policyholder_name" },
    { key: "insurer", label: "Insurer", type: "text", shared: "insurer" },
    { key: "policy_number", label: "Policy number", type: "text" },
    { key: "plan_name", label: "Plan / product name", type: "text", shared: "policy_name" },
    { key: "vehicle_registration_no", label: "Vehicle registration no.", type: "text" },
    { key: "make_and_model", label: "Make & model", type: "text" },
    { key: "manufacturing_year", label: "Manufacturing year", type: "text" },
    { key: "engine_number", label: "Engine number", type: "text" },
    { key: "chassis_number", label: "Chassis number", type: "text" },
    { key: "idv", label: "IDV (sum insured)", type: "number", shared: "sum_insured" },
    { key: "ncb_percent", label: "No-claim bonus (%)", type: "number" },
    { key: "premium", label: "Premium", type: "number" },
    { key: "coverage_type", label: "Coverage type", type: "text" },
    { key: "policy_start_date", label: "Policy start date", type: "date" },
    { key: "policy_expiry_date", label: "Policy expiry date", type: "date", shared: "expiry_date" },
  ],
  life: [
    { key: "policyholder_name", label: "Policyholder / proposer", type: "text", shared: "policyholder_name" },
    { key: "life_assured_name", label: "Life assured", type: "text" },
    { key: "insurer", label: "Insurer", type: "text", shared: "insurer" },
    { key: "policy_number", label: "Policy number", type: "text" },
    { key: "plan_name", label: "Plan / product name", type: "text", shared: "policy_name" },
    { key: "sum_assured", label: "Sum assured", type: "number", shared: "sum_insured" },
    { key: "premium", label: "Premium", type: "number" },
    { key: "premium_frequency", label: "Premium frequency", type: "text" },
    { key: "policy_term_years", label: "Policy term (years)", type: "number" },
    { key: "premium_paying_term_years", label: "Premium paying term (years)", type: "number" },
    { key: "start_date", label: "Commencement date", type: "date" },
    { key: "next_premium_date", label: "Next premium due date", type: "date" },
    { key: "maturity_date", label: "Maturity date", type: "date", shared: "expiry_date" },
    { key: "nominee_name", label: "Nominee", type: "text" },
  ],
  term: [
    { key: "policyholder_name", label: "Policyholder / proposer", type: "text", shared: "policyholder_name" },
    { key: "life_assured_name", label: "Life assured", type: "text" },
    { key: "insurer", label: "Insurer", type: "text", shared: "insurer" },
    { key: "policy_number", label: "Policy number", type: "text" },
    { key: "plan_name", label: "Plan / product name", type: "text", shared: "policy_name" },
    { key: "sum_assured", label: "Sum assured (cover)", type: "number", shared: "sum_insured" },
    { key: "premium", label: "Premium", type: "number" },
    { key: "premium_frequency", label: "Premium frequency", type: "text" },
    { key: "policy_term_years", label: "Policy term (years)", type: "number" },
    { key: "premium_paying_term_years", label: "Premium paying term (years)", type: "number" },
    { key: "cover_till_age", label: "Cover till age", type: "number" },
    { key: "start_date", label: "Commencement date", type: "date" },
    { key: "next_premium_date", label: "Next premium due date", type: "date" },
    { key: "cover_end_date", label: "Cover end date", type: "date", shared: "expiry_date" },
    { key: "death_benefit_payout", label: "Death benefit payout (lump sum / income)", type: "text" },
    { key: "nominee_name", label: "Nominee", type: "text" },
  ],
  travel: [
    { key: "policyholder_name", label: "Policyholder name", type: "text", shared: "policyholder_name" },
    { key: "insurer", label: "Insurer", type: "text", shared: "insurer" },
    { key: "policy_number", label: "Policy number", type: "text" },
    { key: "plan_name", label: "Plan / product name", type: "text", shared: "policy_name" },
    { key: "traveller_names", label: "Traveller(s)", type: "text" },
    { key: "destination", label: "Destination", type: "text" },
    { key: "geographical_scope", label: "Geographical scope", type: "text" },
    { key: "trip_start_date", label: "Trip start date", type: "date" },
    { key: "trip_end_date", label: "Trip end date", type: "date", shared: "expiry_date" },
    { key: "sum_insured", label: "Sum insured", type: "number", shared: "sum_insured" },
    { key: "premium", label: "Premium", type: "number" },
  ],
  property: [
    { key: "policyholder_name", label: "Policyholder name", type: "text", shared: "policyholder_name" },
    { key: "insurer", label: "Insurer", type: "text", shared: "insurer" },
    { key: "policy_number", label: "Policy number", type: "text" },
    { key: "plan_name", label: "Plan / product name", type: "text", shared: "policy_name" },
    { key: "property_address", label: "Property address", type: "text" },
    { key: "coverage_type", label: "Coverage type (structure/contents)", type: "text" },
    { key: "sum_insured", label: "Sum insured", type: "number", shared: "sum_insured" },
    { key: "structure_sum_insured", label: "Structure sum insured", type: "number" },
    { key: "contents_sum_insured", label: "Contents sum insured", type: "number" },
    { key: "premium", label: "Premium", type: "number" },
    { key: "policy_start_date", label: "Policy start date", type: "date" },
    { key: "policy_expiry_date", label: "Policy expiry date", type: "date", shared: "expiry_date" },
  ],
};

export function getFields(type: string | null | undefined): ExtractionField[] {
  return isDataEntryType(type) ? EXTRACTION_FIELDS[type] : [];
}

export function typeLabel(type: string | null | undefined): string {
  const t = (type || "health") as InsuranceType;
  return TYPE_META[t]?.label ?? "Health";
}

/**
 * The date an advisor should follow up on: the extracted "next premium due date"
 * if we captured one, otherwise the policy's renewal/expiry date. Returns an
 * ISO date string (or null).
 */
export function getNextPremiumDate(
  expiryDate: string | null | undefined,
  extractedData: any
): string | null {
  const np = extractedData?.next_premium_date;
  if (np) return String(np);
  return expiryDate ?? null;
}
