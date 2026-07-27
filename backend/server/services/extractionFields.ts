/**
 * Field registry for the "data-entry" insurance lanes (motor / life / travel /
 * property). These types do NOT run the forensic audit pipeline — AI is used
 * only to OCR the document and read these flat fields, which the agent then
 * reviews/edits.
 *
 * IMPORTANT: keep this in sync with the frontend copy at
 *   frontend/client/src/lib/insuranceTypes.ts
 * (the review form + Excel export are driven by the same field list).
 */

export type FieldType = "text" | "number" | "date";

/** Shared `clients` columns a field can also populate, so the unified
 *  My-Policies list + filters work without reading into `extracted_data`. */
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
  /** If set, this field's value is also copied into that top-level column. */
  shared?: SharedColumn;
}

/** The non-health types that use the OCR/data-entry lane. */
export const DATA_ENTRY_TYPES = ["motor", "life", "term", "travel", "property"] as const;
export type DataEntryType = (typeof DATA_ENTRY_TYPES)[number];

export function isDataEntryType(type: string): type is DataEntryType {
  return (DATA_ENTRY_TYPES as readonly string[]).includes(type);
}

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

/** Build the strict, type-specific OCR/extraction prompt. */
export function buildExtractionPrompt(type: DataEntryType): string {
  const fields = EXTRACTION_FIELDS[type];
  const lines = fields
    .map((f) => {
      const hint =
        f.type === "date"
          ? " (date, format YYYY-MM-DD)"
          : f.type === "number"
          ? " (number only — no currency symbols, commas, or units)"
          : "";
      return `  "${f.key}": <${f.label}${hint}>`;
    })
    .join(",\n");

  const hasNextPremium = fields.some((f) => f.key === "next_premium_date");
  const today = new Date().toISOString().slice(0, 10);
  const nextPremiumRule = hasNextPremium
    ? `
- "next_premium_date": today's date is ${today}. Premiums are usually stated as a recurring schedule (e.g. "Due Dates of Premium: 21 June of every Year") alongside a "Due Date of Last Premium". Return the NEXT premium due date strictly AFTER today — the next future occurrence of that recurring due date — NOT the maturity date and NOT the last/final premium date. If one explicit upcoming due date is stated, use it. If the plan is single-premium / fully paid-up / no further premium is payable, use null. (This is the only field where computing the next recurring date from the stated schedule is expected.)`
    : "";

  return `You are an insurance policy data-entry assistant for ${type} insurance.
Read the provided policy document text and extract ONLY the fields below.
Return STRICTLY a single JSON object with EXACTLY these keys and nothing else:

{
${lines}
}

Rules:
- Use null for any field not clearly stated in the document. Do NOT guess or infer.
- Dates must be formatted as YYYY-MM-DD.
- Numeric fields must contain a plain number (e.g. 500000), no currency symbols, commas, or words.${nextPremiumRule}
- Do NOT add extra keys, comments, or markdown. Return only the raw JSON object.`;
}

/**
 * Map an extracted data object to the shared top-level `clients` columns,
 * so the unified policy list + filters work. Returns only the columns that
 * have a non-empty value.
 */
export function deriveSharedColumns(
  type: string,
  data: Record<string, any> | null | undefined
): Partial<Record<SharedColumn, any>> {
  const out: Partial<Record<SharedColumn, any>> = {};
  if (!data || !isDataEntryType(type)) return out;
  for (const f of EXTRACTION_FIELDS[type]) {
    if (!f.shared) continue;
    const raw = data[f.key];
    if (raw === null || raw === undefined || raw === "") continue;
    out[f.shared] = raw;
  }
  return out;
}
