import { z } from "zod";

export type Role = "admin" | "manager" | "agent" | "test";
export type AuthContext = {
  type: "agent" | "api_key";
  user: { id: string; email: string };
  agent?: { id: string; role: Role; status: string };
  app?: string;
};

// Zod schemas for mutations
export const UpdateAgentSchema = z.object({
  role: z.enum(["admin", "manager", "agent", "test"]).optional(),
  status: z.enum(["active", "inactive", "test"]).optional(),
});

export const CreatePolicySchema = z.object({
  client_name: z.string(),
  client_identifier: z.string().optional(),
  insurer_name: z.string(),
  product_name: z.string(),
  policy_number: z.string(),
  policy_start_date: z.string().optional(),
  policy_end_date: z.string().optional(),
});

export const UpdatePolicySchema = z
  .object({
    client_name: z.string().optional(),
    client_identifier: z.string().nullable().optional(),
    insurer_name: z.string().optional(),
    product_name: z.string().optional(),
    policy_number: z.string().optional(),
    policy_start_date: z.string().nullable().optional(),
    policy_end_date: z.string().nullable().optional(),
    status: z
      .enum(["queued", "processing", "done", "failed", "needs_review", "archived"])
      .optional(),
    assigned_agent_id: z.string().uuid().nullable().optional(),
    priority: z.enum(["low", "normal", "high"]).optional(),
    score: z.number().nullable().optional(),
    flaws_count: z.number().int().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const AssignPolicySchema = z.object({
  agent_id: z.string().uuid(),
});

export const UpdateReportSchema = z.object({
  status: z.enum(["pending_review", "approved", "rejected"]),
  notes: z.string().optional(),
});

export const ShareReportSchema = z.object({
  expires_at: z.string().optional(), // ISO string
});
