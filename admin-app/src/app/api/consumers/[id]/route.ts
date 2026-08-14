import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Founder-side edits to a D2C consumer account (individual_profiles).
//
// What each lever actually does at the backend gate (routes.ts
// checkIndividualQuota, which runs before any Gemini spend on /api/me/analyze):
//   plan = 'paid'   → returns allowed immediately. Lifts BOTH the 30-day trial
//                     gate and the 1-free-policy-per-insurance-type slot cap.
//   restart_trial   → rewrites trial_started_at to now, giving another 30 days.
//                     The per-type slot cap still applies, so this only helps
//                     someone who has NOT already used their free slot.
const PLANS = ["free", "paid"] as const;
type Plan = (typeof PLANS)[number];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  try {
    const patch: Record<string, unknown> = {};

    if ("plan" in body) {
      if (!PLANS.includes(body.plan as Plan)) {
        return NextResponse.json({ error: "Invalid plan — expected 'free' or 'paid'" }, { status: 400 });
      }
      patch.plan = body.plan;
    }

    if (body.restart_trial === true) {
      patch.trial_started_at = new Date().toISOString();
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("individual_profiles")
      .update(patch)
      .eq("id", id)
      .select("id, plan, trial_started_at")
      .single();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Consumer not found" }, { status: 404 });

    return NextResponse.json({ success: true, ...data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[consumers PATCH] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
