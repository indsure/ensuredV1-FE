/**
 * Constants for IndSure UI
 */

// Brand Colors
export const BRAND_COLORS = {
  teal: {
    primary: '#0D9488',
    dark: '#0F766E',
    light: '#5EEAD4',
    50: '#F0FDFA',
    100: '#CCFBF1',
  },
  cream: '#FAF9F6',
  ink: '#0F172A',
  slate: '#475569',
  slateLight: '#94A3B8',
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
} as const;

// Scoring Profiles
export const SCORING_PROFILES = [
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Equal weight on coverage, cost, and insurer performance',
  },
  {
    id: 'cost_focused',
    name: 'Cost-Focused',
    description: 'Prioritizes affordability and value for money',
  },
  {
    id: 'coverage_focused',
    name: 'Coverage-Focused',
    description: 'Maximizes coverage breadth and depth',
  },
  {
    id: 'claims_focused',
    name: 'Claims-Focused',
    description: 'Emphasizes insurer track record and claim settlement',
  },
] as const;

// Dimension IDs
export const DIMENSIONS = [
  'coverage_adequacy',
  'cost',
  'waiting_periods',
  'exclusions_sublimits',
  'maternity_family_fit',
  'insurer_claim_performance',
  'insurer_complaint_rate',
  'insurer_financial_health',
  'network_strength',
  'renewal_terms',
] as const;

// Smart Lenses
export const SMART_LENSES = [
  { id: 'all', label: 'Show everything', icon: '📋' },
  { id: 'hospitalization', label: 'Hospitalization basics', icon: '🏥' },
  { id: 'family', label: 'Planning a family', icon: '👶' },
  { id: 'pre_existing', label: 'Pre-existing condition', icon: '💊' },
  { id: 'budget', label: 'Budget-focused', icon: '💰' },
  { id: 'red_flags', label: 'Red flags only', icon: '🚩' },
] as const;

// Profile Options
export const AGE_BANDS = [
  { value: '18-30', label: '18-30 years' },
  { value: '31-45', label: '31-45 years' },
  { value: '46-60', label: '46-60 years' },
  { value: '60+', label: '60+ years' },
] as const;

export const COVERAGE_NEEDS = [
  { value: 'SELF', label: 'Self only' },
  { value: 'SELF_SPOUSE', label: 'Self + Spouse' },
  { value: 'FAMILY_KIDS', label: 'Family with kids' },
  { value: 'MULTI_GEN', label: 'Multi-generational' },
] as const;

export const CITY_TIERS = [
  { value: 'METRO', label: 'Metro (Mumbai, Delhi, etc.)' },
  { value: 'TIER_1', label: 'Tier 1 (Pune, Jaipur, etc.)' },
  { value: 'TIER_2', label: 'Tier 2 (Indore, Bhopal, etc.)' },
  { value: 'TIER_3', label: 'Tier 3 (Smaller cities)' },
] as const;

export const PRE_EXISTING_CONDITIONS = [
  'None',
  'Diabetes',
  'Hypertension',
  'Heart Disease',
  'Thyroid',
  'Asthma',
  'Other',
  'Prefer not to say',
] as const;

// Comparison Table Categories
export const TABLE_CATEGORIES = [
  {
    id: 'money',
    label: 'Money',
    rows: [
      'sum_insured',
      'annual_premium',
      'copay_percent',
      'deductible',
    ],
  },
  {
    id: 'hospitalization',
    label: 'Hospitalization',
    rows: [
      'room_rent_limit',
      'icu_limit',
      'cashless_hospitals_count',
    ],
  },
  {
    id: 'pre_post_hospitalization',
    label: 'Pre/Post Hospitalization',
    rows: [
      'pre_hospitalization_days',
      'post_hospitalization_days',
      'daycare_procedures_count',
    ],
  },
  {
    id: 'waiting_periods',
    label: 'Waiting Periods',
    rows: [
      'initial_waiting_months',
      'ped_waiting_months',
      'specific_illness_waiting_months',
      'maternity_waiting_months',
    ],
  },
  {
    id: 'maternity',
    label: 'Maternity & Newborn',
    rows: [
      'maternity_covered',
      'maternity_limit',
      'newborn_covered',
    ],
  },
  {
    id: 'modern_treatments',
    label: 'Modern Treatments & AYUSH',
    rows: [
      'ayush_covered',
      'modern_treatments_covered',
    ],
  },
  {
    id: 'insurer_track_record',
    label: 'Insurer Track Record',
    rows: [
      'csr_count',
      'icr',
      'complaints_normalized',
      'solvency',
    ],
  },
  {
    id: 'benefits',
    label: 'Benefits',
    rows: [
      'restoration_benefit',
      'no_claim_bonus_max_pct',
      'free_health_checkup',
    ],
  },
  {
    id: 'exclusions',
    label: 'Exclusions',
    rows: [
      'sub_limits',
      'permanent_exclusions',
    ],
  },
] as const;

// Processing Steps
export const PROCESSING_STEPS = [
  'Reading policy document...',
  'Extracting coverage and waiting periods...',
  'Mapping exclusions and sub-limits...',
  'Pulling insurer track records from IRDAI data...',
  'Scoring against your profile...',
  'Picking a winner...',
] as const;

// Disclaimers
export const DISCLAIMERS = [
  'AI analysis based on uploaded documents and public IRDAI data. Not personalized financial advice.',
  'Insurer-level statistics are at company level, not plan-specific. Two products from the same insurer share the same track record data.',
  'Data freshness: Insurer claim and complaint data sourced from IRDAI Annual Report FY 2023-24, the most recent available.',
] as const;

// Max Upload Limits
export const MAX_FILES = 4;
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MIN_FILES_TO_COMPARE = 2;

// Animation Durations
export const ANIMATION_DURATION = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const;

// Breakpoints (matching Tailwind)
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;
