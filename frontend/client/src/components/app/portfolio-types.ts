// Shapes returned by GET /api/me/portfolio.

export type Policy = {
  id: string;
  insurance_type: string;
  status: string;
  filename: string | null;
  insurer: string | null;
  policy_name: string | null;
  nickname: string | null;
  score: number | null;
  expiry_date: string | null;
  renewal_date: string | null;
  sum_insured: string | null;
  flaws: string[] | null;
  has_pdf: boolean;
  created_at: string;
  // Only set when status === "error". Written in plain language by the backend
  // (readableFailure in routes.ts) and safe to show as-is — internal errors are
  // mapped away before they reach this column.
  error_message: string | null;
};

export type Portfolio = {
  plan: string;
  trialEndsAt: string;
  fullName: string | null;
  phone: string | null;
  renewalRemindersEnabled: boolean;
  hasOpenAgentRequest: boolean;
  // Set once the consumer's advisor request has been assigned to an agent.
  advisor: { name: string; phone: string | null; city: string | null } | null;
  freeSlotsPerType: number;
  slotsUsedByType: Record<string, number>;
  policies: Policy[];
};
