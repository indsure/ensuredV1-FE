/**
 * What a data-entry policy is allowed to show on a PUBLIC share link.
 *
 * The forensic audit lane produces `report_data`, and `/shared/report/:token`
 * has always required it. Every data-entry type (motor, life, term, travel,
 * property, fire, marine, CAR) produces `extracted_data` instead and never a
 * report, so sharing one produced a link that answered "report_not_ready"
 * forever. This module is what lets those policies be shared.
 *
 * WHY AN ALLOWLIST AND NOT A DENYLIST
 * `extracted_data` is whatever the OCR lane read off the document, and the
 * field registry grows. A denylist protects only the fields someone remembered
 * to name, so the first new field added to EXTRACTION_FIELDS would be published
 * to the open internet by default. Here the default is to publish nothing: a
 * key absent from this file never leaves the server. Adding a field to the
 * extraction registry does not add it to the share view, which is the safe
 * direction to fail in.
 *
 * WHAT IS DELIBERATELY WITHHELD, AND WHY
 * A share link has no login. Anyone holding the URL is the audience, so the
 * test is not "would the customer mind" but "what could a stranger do with
 * this".
 *   - `policy_number` (every type) — the identifier used to service, endorse or
 *     claim on the policy over the phone. Not needed to explain cover.
 *   - `vehicle_registration_no`, `engine_number`, `chassis_number` — the three
 *     values that identify a specific vehicle to an insurer. Together they are
 *     the raw material for a duplicate-insurance or fraudulent-claim attempt.
 *   - `nominee_name`, `life_assured_name`, `traveller_names` — third parties.
 *     They never saw this product, never consented to publication, and are not
 *     the person the agent is sending the link to.
 *   - `property_address`, `risk_location`, `project_site` — a precise physical
 *     address of a home or business, published beside its contents sum insured,
 *     tells a stranger what is inside a building and where it is.
 *   - `age_at_entry` — personal, and irrelevant to what the policy covers.
 *   - `policy_parameters` — an internal JSON blob of charges and assumptions.
 *
 * Sums insured and premiums ARE published. They are the substance of the
 * policy: a shared view that hides what the policy pays and what it costs is
 * not worth sending. That is the line drawn here — commercial terms yes,
 * identifiers and third parties no.
 *
 * Labels here are customer-facing and are deliberately NOT the agent form's
 * labels from EXTRACTION_FIELDS. The form says "IDV (sum insured)" because an
 * agent types into it; a customer reads "Insured value (IDV)".
 */

export type ShareFormat = "text" | "money" | "number" | "percent" | "date";

export interface ShareableField {
  key: string;
  label: string;
  format: ShareFormat;
}

/** The data-entry types, repeated here so this module stands alone. */
export const SHAREABLE_TYPES = [
  "motor",
  "life",
  "term",
  "travel",
  "property",
  "fire",
  "marine",
  "contractor_all_risk",
] as const;
export type ShareableType = (typeof SHAREABLE_TYPES)[number];

export function isShareableType(type: string | null | undefined): type is ShareableType {
  return !!type && (SHAREABLE_TYPES as readonly string[]).includes(type);
}

/**
 * Publishable fields, in the order a customer should read them. Anything not
 * listed here is never sent to the browser.
 */
export const SHAREABLE_FIELDS: Record<ShareableType, ShareableField[]> = {
  motor: [
    { key: "policyholder_name", label: "Policyholder", format: "text" },
    { key: "insurer", label: "Insurer", format: "text" },
    { key: "plan_name", label: "Plan", format: "text" },
    { key: "coverage_type", label: "Cover type", format: "text" },
    { key: "make_and_model", label: "Vehicle", format: "text" },
    { key: "manufacturing_year", label: "Year", format: "text" },
    { key: "idv", label: "Insured value (IDV)", format: "money" },
    { key: "ncb_percent", label: "No-claim bonus", format: "percent" },
    { key: "premium", label: "Premium", format: "money" },
    { key: "policy_start_date", label: "Cover starts", format: "date" },
    { key: "policy_expiry_date", label: "Cover ends", format: "date" },
    // A bundled policy's two covers end on different days, and the customer is
    // entitled to know which. Dates are commercial terms, not identifiers, so
    // they are publishable: nothing here says which vehicle they belong to.
    { key: "od_expiry_date", label: "Own-damage cover ends", format: "date" },
    { key: "tp_expiry_date", label: "Third-party cover ends", format: "date" },
  ],
  life: [
    { key: "policyholder_name", label: "Policyholder", format: "text" },
    { key: "insurer", label: "Insurer", format: "text" },
    { key: "plan_name", label: "Plan", format: "text" },
    { key: "plan_type", label: "Plan type", format: "text" },
    { key: "sum_assured", label: "Sum assured", format: "money" },
    { key: "premium", label: "Premium", format: "money" },
    { key: "premium_frequency", label: "Paid", format: "text" },
    { key: "policy_term_years", label: "Policy term (years)", format: "number" },
    { key: "premium_paying_term_years", label: "Premiums payable for (years)", format: "number" },
    { key: "start_date", label: "Started", format: "date" },
    { key: "next_premium_date", label: "Next premium due", format: "date" },
    { key: "maturity_date", label: "Matures", format: "date" },
    { key: "maturity_amount", label: "Maturity amount", format: "money" },
    { key: "illustrated_maturity_value", label: "Illustrated maturity value", format: "money" },
    { key: "payout_amount", label: "Payout amount", format: "money" },
    { key: "payout_frequency", label: "Payout frequency", format: "text" },
    { key: "payout_start_date", label: "First payout", format: "date" },
    { key: "payout_end_date", label: "Last payout", format: "date" },
    { key: "bonus_per_1000", label: "Declared bonus per ₹1,000", format: "money" },
    { key: "fund_value", label: "Fund value", format: "money" },
    { key: "fund_value_as_on", label: "Fund value as on", format: "date" },
  ],
  term: [
    { key: "policyholder_name", label: "Policyholder", format: "text" },
    { key: "insurer", label: "Insurer", format: "text" },
    { key: "plan_name", label: "Plan", format: "text" },
    { key: "plan_type", label: "Plan type", format: "text" },
    { key: "sum_assured", label: "Cover", format: "money" },
    { key: "premium", label: "Premium", format: "money" },
    { key: "premium_frequency", label: "Paid", format: "text" },
    { key: "policy_term_years", label: "Policy term (years)", format: "number" },
    { key: "premium_paying_term_years", label: "Premiums payable for (years)", format: "number" },
    { key: "cover_till_age", label: "Cover till age", format: "number" },
    { key: "death_benefit_payout", label: "Death benefit paid as", format: "text" },
    { key: "start_date", label: "Started", format: "date" },
    { key: "next_premium_date", label: "Next premium due", format: "date" },
    { key: "cover_end_date", label: "Cover ends", format: "date" },
  ],
  travel: [
    { key: "policyholder_name", label: "Policyholder", format: "text" },
    { key: "insurer", label: "Insurer", format: "text" },
    { key: "plan_name", label: "Plan", format: "text" },
    { key: "destination", label: "Destination", format: "text" },
    { key: "geographical_scope", label: "Geographical scope", format: "text" },
    { key: "sum_insured", label: "Sum insured", format: "money" },
    { key: "premium", label: "Premium", format: "money" },
    { key: "trip_start_date", label: "Trip starts", format: "date" },
    { key: "trip_end_date", label: "Trip ends", format: "date" },
  ],
  property: [
    { key: "policyholder_name", label: "Policyholder", format: "text" },
    { key: "insurer", label: "Insurer", format: "text" },
    { key: "plan_name", label: "Plan", format: "text" },
    { key: "coverage_type", label: "Cover type", format: "text" },
    { key: "sum_insured", label: "Total sum insured", format: "money" },
    { key: "structure_sum_insured", label: "Structure", format: "money" },
    { key: "contents_sum_insured", label: "Contents", format: "money" },
    { key: "premium", label: "Premium", format: "money" },
    { key: "policy_start_date", label: "Cover starts", format: "date" },
    { key: "policy_expiry_date", label: "Cover ends", format: "date" },
  ],
  fire: [
    { key: "policyholder_name", label: "Insured", format: "text" },
    { key: "insurer", label: "Insurer", format: "text" },
    { key: "plan_name", label: "Plan", format: "text" },
    { key: "occupancy", label: "Occupancy", format: "text" },
    { key: "sum_insured", label: "Total sum insured", format: "money" },
    { key: "building_sum_insured", label: "Building", format: "money" },
    { key: "plant_machinery_sum_insured", label: "Plant & machinery", format: "money" },
    { key: "stock_sum_insured", label: "Stock", format: "money" },
    { key: "valuation_basis", label: "Basis of valuation", format: "text" },
    { key: "add_on_covers", label: "Add-on covers", format: "text" },
    { key: "premium", label: "Premium", format: "money" },
    { key: "policy_start_date", label: "Cover starts", format: "date" },
    { key: "policy_expiry_date", label: "Cover ends", format: "date" },
  ],
  marine: [
    { key: "policyholder_name", label: "Insured", format: "text" },
    { key: "insurer", label: "Insurer", format: "text" },
    { key: "plan_name", label: "Policy type", format: "text" },
    { key: "cover_clauses", label: "Cover clauses", format: "text" },
    { key: "goods_description", label: "Goods insured", format: "text" },
    { key: "transit_mode", label: "Mode of transit", format: "text" },
    { key: "transit_from", label: "From", format: "text" },
    { key: "transit_to", label: "To", format: "text" },
    { key: "sum_insured", label: "Sum insured", format: "money" },
    { key: "per_sending_limit", label: "Limit per sending", format: "money" },
    { key: "valuation_basis", label: "Basis of valuation", format: "text" },
    { key: "premium", label: "Premium", format: "money" },
    { key: "policy_start_date", label: "Cover starts", format: "date" },
    { key: "policy_expiry_date", label: "Cover ends", format: "date" },
  ],
  contractor_all_risk: [
    { key: "policyholder_name", label: "Insured", format: "text" },
    { key: "insurer", label: "Insurer", format: "text" },
    { key: "plan_name", label: "Plan", format: "text" },
    { key: "project_name", label: "Project", format: "text" },
    { key: "contract_value", label: "Contract value", format: "money" },
    { key: "material_damage_sum_insured", label: "Material damage (Section I)", format: "money" },
    { key: "third_party_liability_limit", label: "Third-party liability (Section II)", format: "money" },
    { key: "deductible", label: "Deductible", format: "money" },
    { key: "premium", label: "Premium", format: "money" },
    { key: "project_start_date", label: "Project starts", format: "date" },
    { key: "project_completion_date", label: "Project completes", format: "date" },
    { key: "maintenance_period_months", label: "Maintenance period (months)", format: "number" },
  ],
};

/**
 * Reduce a raw `extracted_data` object to only what may be published.
 *
 * Runs on the SERVER, before the payload leaves it. Filtering in the browser
 * would mean the withheld values had already been sent. Empty strings and
 * nulls are dropped too, so the view shows no blank rows.
 */
export function pickShareableFields(
  type: string | null | undefined,
  extracted: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!isShareableType(type) || !extracted || typeof extracted !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const field of SHAREABLE_FIELDS[type]) {
    const value = (extracted as Record<string, unknown>)[field.key];
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    out[field.key] = value;
  }
  return out;
}

/** True when there is enough to be worth rendering a page for. */
export function hasShareableContent(
  type: string | null | undefined,
  extracted: Record<string, unknown> | null | undefined,
): boolean {
  return Object.keys(pickShareableFields(type, extracted)).length > 0;
}
