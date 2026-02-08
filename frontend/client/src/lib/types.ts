export type Verdict = "Sufficient" | "Sufficient, with gaps" | "Borderline" | "Insufficient";

export interface PolicyMember {
  name: string;
  age: number | null;
  dateOfBirth?: string;
  gender?: string;
  relationship?: string; // "Self", "Spouse", "Son", "Daughter", "Father", "Mother", etc.
}

export interface AnalysisResponse {
  id?: string;
  policyholderInfo?: {
    name: string;
    age: number | null;
    dateOfBirth?: string;
    city: string;
    gender: string;
    policyNumber?: string;
    policyStartDate?: string;
    policyType?: "Individual" | "Family Floater";
    members?: PolicyMember[]; // For family floater plans
  };
  page1: {
    verdict: Verdict;
    asOf: string;
    why: string;
    coveredFor: string[];
    whereItHurts: string[];
    costContext?: string[];
  };
  details: {
    policySummary: string[];
    activeWaitingPeriods: string[];
    gaps: {
      serious: string[];
      nonSerious: string[];
    };
    clauseExplanations?: string[];
    summary?: string;
  };
  recommendations: string[];
}

export interface AnalysisState {
  analysis: AnalysisResponse | null;
  analysisId: string | null;
  lastUpdated: number | null;
  error: string | null;
}