/* Policy Data Structure Types */

export interface PolicyExtractionMetadata {
  extracted_by: string;
  extraction_confidence: number;
  extraction_timestamp: string;
  missing_fields: string[];
  manual_verification_needed: boolean;
  extraction_notes: string;
}

export interface BasicInfo {
  insurer: string;
  plan_name: string;
  plan_code?: string;
  policy_type: string;
  inception_date: string | null;
  expiry_date: string | null;
}

export interface CoverageAmount {
  amount: number;
  currency: string;
  display: string;
}

export interface RoomRent {
  type: "daily_limit" | "percentage" | "unlimited";
  amount: number | null;
  currency: string;
  percent_of_si: number | null;
  display: string;
  unlimited: boolean;
  capped_at?: number | null;
}

export interface Copay {
  exists: boolean;
  type: "all_claims" | "specific_treatments" | null;
  percent: number | null;
  flat_amount: number | null;
  note: string;
  applies_to: string[];
}

export interface Deductible {
  exists: boolean;
  amount: number | null;
  note: string;
}

export interface Coverage {
  base_si: CoverageAmount;
  annual_premium: CoverageAmount & { premium_per_month?: number };
  room_rent: RoomRent;
  copay: Copay;
  deductible: Deductible;
}

export interface SubLimit {
  capped: boolean;
  limit_amount: number | null;
  limit_percent_of_si?: number | null;
  display: string;
  unlimited: boolean;
}

export interface SubLimits {
  cancer: SubLimit;
  cardiac: SubLimit;
  organ_transplant: SubLimit;
  dialysis?: SubLimit;
  orthopedic_implants?: SubLimit;
  icu_charges?: SubLimit;
  other_major?: Record<string, { capped: boolean; limit_amount: number }>;
}

export interface WaitingPeriod {
  days: number;
  months: number;
  note?: string;
  covered?: boolean;
}

export interface SpecificDiseaseWaiting {
  [disease: string]: WaitingPeriod;
}

export interface WaitingPeriods {
  general_waiting_period: WaitingPeriod;
  specific_diseases: SpecificDiseaseWaiting & {
    other_major_diseases?: Array<{ disease: string; waiting_months: number }>;
  };
  pre_existing_disease: WaitingPeriod & {
    can_be_waived?: boolean;
  };
}

export interface CoverageDetails {
  hospitalization: {
    covered: boolean;
    note?: string;
  };
  pre_hospitalization: {
    covered: boolean;
    days_before_admission: number;
    display: string;
  };
  post_hospitalization: {
    covered: boolean;
    days_after_discharge: number;
    display: string;
  };
  domiciliary_care: {
    covered: boolean;
    limit_type: "percentage_of_si" | "fixed_amount";
    limit_amount: number;
    limit_percent: number;
    display: string;
    minimum_hospitalization_days?: number;
    note?: string;
  };
  daycare_procedures: {
    covered: boolean;
    note?: string;
    examples?: string[];
  };
  opd: {
    covered: boolean;
    limit: number | null;
    note: string;
  };
  consultation_charges?: {
    covered: boolean;
    note: string;
  };
  diagnostic_tests?: {
    covered: boolean;
    note: string;
    limit?: string;
  };
  pathology_radiology?: {
    covered: boolean;
    note: string;
  };
}

export interface Rider {
  available: boolean;
  base_premium_addition?: number;
  base_premium_addition_display?: string;
  total_premium_with_rider?: number;
  coverage_amount?: number;
  coverage_display?: string;
  diseases_covered?: string[];
  covers?: string[];
  waiting_period_months?: number;
  note?: string;
}

export interface Riders {
  critical_illness: Rider;
  personal_accident: Rider;
  maternity: Rider;
  accidental_hospitalization?: Rider;
  dental?: Rider;
}

export interface Exclusions {
  major_exclusions: string[];
  conditions_not_covered?: string[];
  pre_existing_exclusion: {
    applies: boolean;
    waiting_period_months: number;
    note: string;
  };
}

export interface Restoration {
  type: "unlimited" | "limited" | null;
  note: string;
  times_per_year: number;
  cost?: string;
  automatic: boolean;
  example?: string;
}

export interface Network {
  hospital_network_count?: {
    total: number;
    note?: string;
    international?: boolean;
  };
  cashless_available: boolean;
  third_party_administrator?: string;
  tpa_contact?: {
    phone?: string;
    email?: string;
    website?: string;
    helpline_24_7?: boolean;
  };
}

export interface ClaimProcess {
  claim_settlement_days?: {
    target: number;
    maximum: number;
    note: string;
  };
  pre_authorization?: {
    required: boolean;
    processing_time_hours?: number;
    processing_time_range?: string;
    contact?: string;
    documents_needed?: string[];
  };
  reimbursement?: {
    available: boolean;
    processing_time_days?: number;
    documents_needed?: string[];
  };
  dispute_resolution?: {
    available: boolean;
    escalation_to_ombudsman?: boolean;
    ombudsman_contact?: string;
  };
}

export interface PolicyData {
  policy_id: string;
  upload_date: string;
  file_name: string;
  extraction_metadata: PolicyExtractionMetadata;
  basic_info: BasicInfo;
  coverage: Coverage;
  sub_limits: SubLimits;
  waiting_periods: WaitingPeriods;
  coverage_details: CoverageDetails;
  riders: Riders;
  exclusions: Exclusions;
  restoration: Restoration;
  network: Network;
  claim_process?: ClaimProcess;
  irdai_updates?: Record<string, any>;
  user_ratings?: {
    covered: boolean;
    note?: string;
  };
  additional_info?: {
    policy_link?: string;
    download_brochure?: string;
    faq_link?: string;
    source: string;
    verified: boolean;
    verified_by?: string | null;
    verification_date?: string | null;
  };
}

/* Evidence-based extraction response from Gemini (before transformation) */
export interface EvidenceBasedField {
  status: "explicit" | "excluded" | "not_mentioned";
  value: string;
  evidence: string;
}

export interface RawPolicyExtraction {
  policy_metadata: {
    insurer: string;
    policy_name: string;
    document_source: string;
    policy_date: string;
    extraction_confidence: number;
  };
  coverage: {
    sum_insured: EvidenceBasedField;
    annual_premium?: EvidenceBasedField; // Optional - may not be in document
    room_rent: EvidenceBasedField;
    icu_charges: EvidenceBasedField;
    pre_hospitalization: EvidenceBasedField;
    post_hospitalization: EvidenceBasedField;
    domiciliary_hospitalization: EvidenceBasedField;
    daycare_procedures: EvidenceBasedField;
  };
  waiting_periods: {
    general: EvidenceBasedField;
    pre_existing_disease: EvidenceBasedField;
    specific_ailments: Array<{
      condition: string;
      status: "explicit" | "excluded" | "not_mentioned";
      value: string;
      evidence: string;
    }>;
  };
  sub_limits: {
    room_rent_limit: EvidenceBasedField;
    icu_limit: EvidenceBasedField;
    disease_specific_limits: Array<{
      condition: string;
      limit: string;
      evidence: string;
    }>;
  };
  restoration: EvidenceBasedField;
  riders: {
    critical_illness: EvidenceBasedField;
    personal_accident: EvidenceBasedField;
    maternity: EvidenceBasedField;
  };
  network: {
    cashless_hospitals: EvidenceBasedField;
  };
  exclusions: {
    explicit_exclusions: string[];
    evidence: string;
  };
  notes: string;
}

/* Legacy format for backward compatibility (will be removed after migration) */
export interface LegacyRawPolicyExtraction {
  basic_info: {
    insurer: string;
    plan_name: string;
    policy_type: string;
    inception_date: string; // YYYY-MM-DD or "" if not found
    expiry_date: string; // YYYY-MM-DD or "" if not found
  };
  coverage: {
    base_si: number; // Must be > 0
    annual_premium: number; // Must be > 0
    room_rent_amount: number; // 0 if unlimited or percentage-based
    room_rent_percent: number; // 0 if not percentage-based
    room_rent_unlimited: boolean;
    copay_percent: number; // 0 if no co-pay
    copay_type: "all_claims" | "specific_treatments" | ""; // "" if no co-pay
    deductible: number; // 0 if no deductible
  };
  sub_limits: {
    cancer_sublimit: number; // 0 if unlimited
    cardiac_sublimit: number; // 0 if unlimited
    organ_transplant_sublimit: number; // 0 if unlimited
    icu_sublimit: number; // 0 if unlimited
    orthopedic_sublimit: number; // 0 if unlimited
    dialysis_sublimit: number; // 0 if unlimited
    other_sublimits: Array<{ disease: string; amount: number }>; // [] if none
  };
  waiting_periods: {
    general_waiting: number; // Must be >= 0 (in months)
    cataract_waiting: number; // 0 if not specified
    cardiac_waiting: number; // 0 if not specified
    cancer_waiting: number; // 0 if not specified
    knee_replacement_waiting: number; // 0 if not specified
    pre_existing_waiting: number; // 0 if not specified
    arthritis_waiting: number; // 0 if not specified
    hernia_waiting: number; // 0 if not specified
    piles_waiting: number; // 0 if not specified
    other_waiting_periods: Array<{ disease: string; months: number }>; // [] if none
  };
  coverage_details: {
    hospitalization_covered: boolean;
    pre_hosp_days: number; // 0 if not covered
    post_hosp_days: number; // 0 if not covered
    domiciliary_care_covered: boolean;
    domiciliary_care_limit: number; // 0 if not covered or percentage-based
    domiciliary_care_percent: number; // 0 if not percentage-based
    daycare_covered: boolean;
    opd_covered: boolean;
    opd_limit: number; // 0 if not covered
    diagnostic_tests_covered: boolean;
  };
  riders: {
    critical_illness_available: boolean;
    critical_illness_premium: number; // 0 if not available
    critical_illness_amount: number; // 0 if not available
    critical_illness_diseases: string[]; // [] if not available
    personal_accident_available: boolean;
    personal_accident_premium: number; // 0 if not available
    personal_accident_amount: number; // 0 if not available
    maternity_available: boolean;
    maternity_premium: number; // 0 if not available
    maternity_waiting: number; // 0 if not available
    maternity_amount: number; // 0 if not available
  };
  exclusions: {
    major_exclusions: string[]; // [] if none listed
    pre_existing_excluded: boolean;
    pre_existing_waiting: number; // 0 if not excluded
  };
  restoration: {
    restoration_type: "unlimited" | "limited" | "none" | ""; // "" if not specified
    restoration_times_per_year: number; // 0 if none
    restoration_automatic: boolean;
  };
  network: {
    network_hospital_count: number; // 0 if not specified
    cashless_available: boolean;
    tpa_provider: string; // "" if not specified
    claim_settlement_days: number; // 0 if not specified
  };
  extraction_metadata: {
    extraction_confidence: number; // 0.0 to 1.0
    missing_fields: string[]; // Should be [] in hard mode
    extraction_notes: string; // "" if no notes
  };
}

