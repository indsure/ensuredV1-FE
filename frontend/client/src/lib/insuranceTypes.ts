/**
 * Insurance-type registry for the agent portal.
 *
 * `health` keeps the full forensic-audit flow (score + PolicyAuditReport).
 * The "data-entry" types (motor/life/term/travel/property, plus the commercial
 * lines fire/marine/contractor_all_risk) use OCR-only extraction into the flat
 * fields below — no score, no audit. The review form, the type-aware list, and
 * the Excel export are all driven by this file.
 *
 * IMPORTANT: keep the field lists in sync with the backend copy at
 *   backend/server/services/extractionFields.ts
 */

export type FieldType = "text" | "number" | "date" | "json";

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

export const DATA_ENTRY_TYPES = [
  "motor",
  "life",
  "term",
  "travel",
  "property",
  "fire",
  "marine",
  "contractor_all_risk",
] as const;
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
  fire: { label: "Fire", emoji: "🔥" },
  marine: { label: "Marine", emoji: "🚢" },
  contractor_all_risk: { label: "Contractor's All Risk", emoji: "🏗️" },
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
    { key: "plan_type", label: "Plan type (term / return of premium / endowment / unit linked)", type: "text" },
    { key: "bonus_per_1000", label: "Declared bonus per ₹1,000 sum assured (if any)", type: "number" },
    { key: "fund_value", label: "Fund value (unit linked only)", type: "number" },
    { key: "age_at_entry", label: "Age when the policy started", type: "number" },
    { key: "illustrated_maturity_value", label: "Maturity value stated in the document's illustration", type: "number" },
    { key: "policy_parameters", label: "Charges and assumptions", type: "json" },
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
    { key: "plan_type", label: "Plan type (term / return of premium)", type: "text" },
    { key: "death_benefit_payout", label: "Death benefit payout (lump sum / income)", type: "text" },
    { key: "age_at_entry", label: "Age when the policy started", type: "number" },
    { key: "illustrated_maturity_value", label: "Maturity value stated in the document's illustration", type: "number" },
    { key: "policy_parameters", label: "Charges and assumptions", type: "json" },
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
  fire: [
    { key: "policyholder_name", label: "Insured name", type: "text", shared: "policyholder_name" },
    { key: "insurer", label: "Insurer", type: "text", shared: "insurer" },
    { key: "policy_number", label: "Policy number", type: "text" },
    { key: "plan_name", label: "Plan / product name", type: "text", shared: "policy_name" },
    { key: "risk_location", label: "Risk location / address", type: "text" },
    { key: "occupancy", label: "Occupancy / nature of business", type: "text" },
    { key: "building_sum_insured", label: "Building sum insured", type: "number" },
    { key: "plant_machinery_sum_insured", label: "Plant & machinery sum insured", type: "number" },
    { key: "stock_sum_insured", label: "Stock sum insured", type: "number" },
    { key: "sum_insured", label: "Total sum insured", type: "number", shared: "sum_insured" },
    { key: "valuation_basis", label: "Basis of valuation (reinstatement / market value)", type: "text" },
    { key: "add_on_covers", label: "Add-on covers", type: "text" },
    { key: "premium", label: "Premium", type: "number" },
    { key: "policy_start_date", label: "Policy start date", type: "date" },
    { key: "policy_expiry_date", label: "Policy expiry date", type: "date", shared: "expiry_date" },
  ],
  marine: [
    { key: "policyholder_name", label: "Insured name", type: "text", shared: "policyholder_name" },
    { key: "insurer", label: "Insurer", type: "text", shared: "insurer" },
    { key: "policy_number", label: "Policy / certificate number", type: "text" },
    { key: "plan_name", label: "Policy type (open / specific voyage)", type: "text", shared: "policy_name" },
    { key: "cover_clauses", label: "Cover clauses (ICC A / B / C)", type: "text" },
    { key: "goods_description", label: "Goods / commodity insured", type: "text" },
    { key: "transit_mode", label: "Mode of transit (sea / air / road / rail)", type: "text" },
    { key: "transit_from", label: "Transit from", type: "text" },
    { key: "transit_to", label: "Transit to", type: "text" },
    { key: "sum_insured", label: "Sum insured", type: "number", shared: "sum_insured" },
    { key: "per_sending_limit", label: "Limit per sending / per bottom", type: "number" },
    { key: "valuation_basis", label: "Basis of valuation", type: "text" },
    { key: "premium", label: "Premium", type: "number" },
    { key: "policy_start_date", label: "Policy start date", type: "date" },
    { key: "policy_expiry_date", label: "Policy expiry date", type: "date", shared: "expiry_date" },
  ],
  contractor_all_risk: [
    { key: "policyholder_name", label: "Insured (principal / contractor)", type: "text", shared: "policyholder_name" },
    { key: "insurer", label: "Insurer", type: "text", shared: "insurer" },
    { key: "policy_number", label: "Policy number", type: "text" },
    { key: "plan_name", label: "Plan / product name", type: "text", shared: "policy_name" },
    { key: "project_name", label: "Project / contract name", type: "text" },
    { key: "project_site", label: "Project site address", type: "text" },
    { key: "contract_value", label: "Contract value / sum insured", type: "number", shared: "sum_insured" },
    { key: "material_damage_sum_insured", label: "Section I — material damage sum insured", type: "number" },
    { key: "third_party_liability_limit", label: "Section II — third-party liability limit", type: "number" },
    { key: "deductible", label: "Deductible / excess", type: "number" },
    { key: "premium", label: "Premium", type: "number" },
    { key: "project_start_date", label: "Project start date", type: "date" },
    { key: "project_completion_date", label: "Project completion date", type: "date", shared: "expiry_date" },
    { key: "maintenance_period_months", label: "Maintenance period (months)", type: "number" },
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
