/**
 * Compare feature — frontend render types.
 * Mirror of the result shape emitted by backend/server/types/wordingProfile.ts.
 * The backend does all extraction + ranking; the frontend only renders this.
 * If the backend shape changes, update here too.
 */

export type Winner = "a" | "b" | "tie" | "na";

export type AxisGroup =
  | "money_at_claim"
  | "waiting"
  | "bonus_reset"
  | "coverages"
  | "fine_print";

export interface ComparisonRow {
  key: string;
  label: string;
  group: AxisGroup;
  a: { display: string; note?: string | null; optional?: boolean };
  b: { display: string; note?: string | null; optional?: boolean };
  winner: Winner;
}

export interface ComparisonSide {
  insurer: string | null;
  plan_name: string | null;
  uin: string | null;
  sum_insured_options: string | null;
  confidence: string;
}

export interface ComparisonVerdict {
  winner: Winner;
  winner_name: string | null;
  score_a: number;
  score_b: number;
  wins_a: number;
  wins_b: number;
  ties: number;
  reasons: string[];
  counterpoint: string | null;
}

export interface ComparisonResult {
  a: ComparisonSide;
  b: ComparisonSide;
  groups: { group: AxisGroup; label: string; rows: ComparisonRow[] }[];
  verdict: ComparisonVerdict;
}

export interface CompareResponse {
  result: ComparisonResult;
  profiles?: { a: unknown; b: unknown };
  hashes?: { a: string; b: string };
}

export function sideName(s: ComparisonSide, fallback: string): string {
  return s.plan_name || s.insurer || fallback;
}
