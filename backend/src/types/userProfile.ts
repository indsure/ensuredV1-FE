import { z } from "zod";

export const UserProfileSchema = z.object({
  age: z.number().int().min(0).max(120).optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  pincode: z
    .string()
    .regex(/^\d{6}$/, "Pincode must be exactly 6 digits")
    .optional(),
  preExistingConditions: z.array(z.string()).default([]),
  householdIncome: z.number().positive().optional(),
  familySize: z.number().int().min(1).max(20).optional(),
  preferredLanguage: z.enum(["en", "hi"]).default("en"),
});

export type UserProfileInput = z.infer<typeof UserProfileSchema>;

export interface UserProfile extends UserProfileInput {
  id?: string;
  cityTier?: "Tier 1" | "Tier 2" | "Tier 3";
  createdAt?: Date;
  updatedAt?: Date;
}
