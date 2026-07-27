/**
 * Compare feature — frontend render types (N-way: 2..4 plans).
 * Mirror of the result shape emitted by backend/server/types/wordingProfile.ts.
 * Backend does all extraction + ranking; the frontend only renders this.
 */

export type AxisGroup =
  | "money_at_claim"
  | "waiting"
  | "bonus_reset"
  | "coverages"
  | "fine_print";

export interface Cell {
  display: string;
  note?: string | null;
  optional?: boolean;
  winner: boolean;
}

export interface ComparisonRow {
  key: string;
  label: string;
  group: AxisGroup;
  cells: Cell[];
}

export interface ComparisonSide {
  insurer: string | null;
  plan_name: string | null;
  uin: string | null;
  sum_insured_options: string | null;
  confidence: string;
}

export interface ComparisonVerdict {
  winner_index: number;
  winner_name: string | null;
  scores: number[];
  wins: number[];
  reasons: string[];
  counterpoint: string | null;
}

export interface ComparisonResult {
  sides: ComparisonSide[];
  groups: { group: AxisGroup; label: string; rows: ComparisonRow[] }[];
  verdict: ComparisonVerdict;
}

export interface CompareResponse {
  result: ComparisonResult;
  profiles?: unknown;
  hashes?: unknown;
}

export function sideName(s: ComparisonSide, fallback = "Plan"): string {
  return s.plan_name || s.insurer || fallback;
}
