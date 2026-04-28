import { z } from "zod";

// ─── Validation Schemas ───────────────────────────────────────────────────────

export const ageSchema = z
  .number()
  .int("Age must be a whole number")
  .min(18, "Minimum age is 18")
  .max(75, "Maximum age is 75");

export const incomeSchema = z
  .number()
  .int("Income must be a whole number")
  .min(300000, "Minimum annual income is ₹3,00,000")
  .max(100000000, "Maximum annual income is ₹10,00,00,000");

export const childAgeSchema = z
  .number()
  .int("Child age must be a whole number")
  .min(0, "Child age cannot be negative")
  .max(25, "Maximum child age is 25");

export const loanAmountSchema = z
  .number()
  .int("Loan amount must be a whole number")
  .min(0, "Loan amount cannot be negative")
  .max(100000000, "Maximum loan amount is ₹10 Crore");

export const savingsSchema = z
  .number()
  .int("Savings must be a whole number")
  .min(0, "Savings cannot be negative")
  .max(100000000, "Maximum savings is ₹10 Crore");

// ─── Health Calculator Input Validation ───────────────────────────────────────

export const healthCalculatorInputSchema = z.object({
  // Required fields
  ageBand: z.enum(["18-30", "31-45", "46-60", "60+"]),
  cityTier: z.enum(["Metro", "Tier-1", "Tier-2", "Other"]),
  familyStructure: z.enum(["Individual", "Couple", "Couple + kids", "Parents included"]),
  employerCover: z.enum(["None", "< 5L", "5-10L", "> 10L"]),
  riskPosture: z.enum(["Minimum but safe", "Balanced", "Zero financial shock"]),

  // Optional fields
  hospitalPreference: z.enum([
    "Any good hospital",
    "Large private hospitals",
    "Premium corporate hospitals",
  ]).optional(),
  recurringExpenses: z.enum(["None", "Minor (tests/OPD/meds)", "Chronic but stable"]).optional(),
  parentsAge: z.enum(["< 60", "60-70", "70+"]).optional(),
  okWithDeductibles: z.boolean().optional(),
  preferTopUp: z.boolean().optional(),

  // Granular fields with validation
  exactAge: ageSchema.optional(),
  spouseAge: ageSchema.optional(),
  childCount: z.number().int().min(0).max(10).optional(),
  annualIncome: z.enum(["< 5L", "5-10L", "10-20L", "20L+"]).optional(),
  gender: z.enum(["Male", "Female"]).optional(),
  spouseIncome: z.string().optional(),
  spouseEmployerCover: z.enum(["None", "< 5L", "5-10L", "> 10L"]).optional(),
  fatherAge: ageSchema.optional(),
  motherAge: ageSchema.optional(),
  childAges: z.array(childAgeSchema).optional(),
  preExistingConditions: z.array(
    z.enum(["diabetes", "hypertension", "cardiac", "cancer", "obesity", "kidney", "none"])
  ).optional(),
});

export type HealthCalculatorInput = z.infer<typeof healthCalculatorInputSchema>;

// ─── Life Calculator Input Validation ─────────────────────────────────────────

export const lifeCalculatorInputSchema = z.object({
  age: ageSchema,
  gender: z.enum(["Male", "Female"]),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  annualIncome: incomeSchema,
  savings: savingsSchema,
  maritalStatus: z.enum(["Single", "Married"]),
  childrenCount: z.number().int().min(0).max(10),
  youngestChildAge: childAgeSchema.optional(),
  educationType: z.enum(["Public", "Private", "International"]),
  homeLoan: loanAmountSchema,
  carLoan: loanAmountSchema,
  otherLoans: loanAmountSchema,
  hasExistingInsurance: z.boolean(),
  existingInsuranceAmount: loanAmountSchema,
  spouseAge: ageSchema.optional(),
  spouseIncome: z.number().int().min(0).max(100000000),
  desiredRetirementAge: z.number().int().min(50).max(75),
  legacyGoals: z.number().int().min(0).max(100000000),
});

export type LifeCalculatorInput = z.infer<typeof lifeCalculatorInputSchema>;

// ─── Validation Helper Functions ──────────────────────────────────────────────

export function validateField<T>(
  schema: z.ZodSchema<T>,
  value: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = schema.parse(value);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Validation failed" };
  }
}

export function sanitizeNumericInput(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  
  const num = typeof value === "string" ? parseFloat(value) : value;
  
  if (isNaN(num) || !isFinite(num)) return undefined;
  
  return num;
}

export function sanitizeIntegerInput(value: string | number | undefined): number | undefined {
  const num = sanitizeNumericInput(value);
  if (num === undefined) return undefined;
  return Math.floor(num);
}

// ─── Real-time Validation Helpers ─────────────────────────────────────────────

export function getAgeError(age: number | undefined): string | null {
  if (age === undefined) return null;
  const result = validateField(ageSchema, age);
  return result.success ? null : result.error;
}

export function getIncomeError(income: number | undefined): string | null {
  if (income === undefined) return null;
  const result = validateField(incomeSchema, income);
  return result.success ? null : result.error;
}

export function getChildAgeError(age: number | undefined): string | null {
  if (age === undefined) return null;
  const result = validateField(childAgeSchema, age);
  return result.success ? null : result.error;
}

export function getLoanAmountError(amount: number | undefined): string | null {
  if (amount === undefined) return null;
  const result = validateField(loanAmountSchema, amount);
  return result.success ? null : result.error;
}
