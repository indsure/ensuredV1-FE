import type { Request, Response } from "express";
import { UserProfileSchema } from "../types/userProfile";
import { PersonalizationService } from "../services/personalization.service";

export async function handleCreateProfile(req: Request, res: Response) {
  try {
    const parsed = UserProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid profile data",
          details: parsed.error.issues,
        },
      });
    }

    const profile = parsed.data;
    const cityTier = PersonalizationService.deriveCityTier(
      profile.city,
      profile.state
    );

    // Try DB first, fallback to in-memory response
    try {
      const { db } = await import("../db/client");
      const { userProfiles } = await import("../db/schema");

      const [inserted] = await db
        .insert(userProfiles)
        .values({
          age: profile.age,
          city: profile.city,
          state: profile.state,
          pincode: profile.pincode,
          preExistingConditions: profile.preExistingConditions,
          householdIncome: profile.householdIncome?.toString(),
          familySize: profile.familySize,
          preferredLanguage: profile.preferredLanguage,
          cityTier,
        })
        .returning();

      return res.json({
        success: true,
        data: inserted,
      });
    } catch {
      // DB not available — return ephemeral profile
      return res.json({
        success: true,
        data: {
          ...profile,
          cityTier,
          id: `temp-${Date.now()}`,
        },
      });
    }
  } catch (err: any) {
    console.error("[UserProfile] Create error:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL", message: err.message },
    });
  }
}

export async function handleGetProfile(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const { db } = await import("../db/client");
    const { userProfiles } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");

    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, id))
      .limit(1);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Profile not found" },
      });
    }

    res.json({ success: true, data: profile });
  } catch (err: any) {
    console.error("[UserProfile] Get error:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL", message: err.message },
    });
  }
}

export async function handleGetHistory(req: Request, res: Response) {
  try {
    const { profileId } = req.params;

    const { db } = await import("../db/client");
    const {
      analysisJobs: jobsTable,
      analysisResults,
    } = await import("../db/schema");
    const { eq, desc } = await import("drizzle-orm");

    const jobs = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.profileId, profileId))
      .orderBy(desc(jobsTable.createdAt))
      .limit(20);

    res.json({ success: true, data: jobs });
  } catch (err: any) {
    console.error("[UserProfile] History error:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL", message: err.message },
    });
  }
}
