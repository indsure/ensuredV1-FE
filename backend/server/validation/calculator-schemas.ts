import { z } from "zod";

// ─── Backend Validation Schemas ───────────────────────────────────────────────

export const healthCalculatorInputSchema = z.object({
  ageBand: z.enum(["18-30", "31-45", "46-60", "60+"]),
  cityTier: z.enum(["Metro", "Tier-1", "Tier-2", "Other"]),
  familyStructure: z.enum(["Individual", "Couple", "Couple + kids", "Parents included"]),
  employerCover: z.enum(["None", "< 5L", "5-10L", "> 10L"]),
  riskPosture: z.enum(["Minimum but safe", "Balanced", "Zero financial shock"]),
  hospitalPreference: z.enum([
    "Any good hospital",
    "Large private hospitals",
    "Premium corporate hospitals",
  ]).optional(),
  recurringExpenses: z.enum(["None", "Minor (tests/OPD/meds)", "Chronic but stable"]).optional(),
  parentsAge: z.enum(["< 60", "60-70", "70+"]).optional(),
  okWithDeductibles: z.boolean().optional(),
  preferTopUp: z.boolean().optional(),
  exactAge: z.number().int().min(18).max(75).optional(),
  spouseAge: z.number().int().min(18).max(75).optional(),
  childCount: z.number().int().min(0).max(10).optional(),
  annualIncome: z.enum(["< 5L", "5-10L", "10-20L", "20L+"]).optional(),
  gender: z.enum(["Male", "Female"]).optional(),
  spouseIncome: z.string().optional(),
  spouseEmployerCover: z.enum(["None", "< 5L", "5-10L", "> 10L"]).optional(),
  fatherAge: z.number().int().min(18).max(100).optional(),
  motherAge: z.number().int().min(18).max(100).optional(),
  childAges: z.array(z.number().int().min(0).max(25)).optional(),
  preExistingConditions: z.array(
    z.enum(["diabetes", "hypertension", "cardiac", "cancer", "obesity", "kidney", "none"])
  ).optional(),
});

export const lifeCalculatorInputSchema = z.object({
  age: z.number().int().min(18).max(75),
  gender: z.enum(["Male", "Female"]),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  annualIncome: z.number().int().min(300000).max(100000000),
  savings: z.number().int().min(0).max(100000000),
  maritalStatus: z.enum(["Single", "Married"]),
  childrenCount: z.number().int().min(0).max(10),
  youngestChildAge: z.number().int().min(0).max(25).optional(),
  educationType: z.enum(["Public", "Private", "International"]),
  homeLoan: z.number().int().min(0).max(100000000),
  carLoan: z.number().int().min(0).max(100000000),
  otherLoans: z.number().int().min(0).max(100000000),
  hasExistingInsurance: z.boolean(),
  existingInsuranceAmount: z.number().int().min(0).max(100000000),
  spouseAge: z.number().int().min(18).max(75).optional(),
  spouseIncome: z.number().int().min(0).max(100000000),
  desiredRetirementAge: z.number().int().min(50).max(75),
  legacyGoals: z.number().int().min(0).max(100000000),
});

export const calculatorReportSchema = z.object({
  inputs: z.union([healthCalculatorInputSchema, lifeCalculatorInputSchema]),
  result_data: z.record(z.string(), z.any()), // Allow any result structure
});

export type HealthCalculatorInput = z.infer<typeof healthCalculatorInputSchema>;
export type LifeCalculatorInput = z.infer<typeof lifeCalculatorInputSchema>;
export type CalculatorReport = z.infer<typeof calculatorReportSchema>;
