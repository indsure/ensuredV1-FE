import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

// Invite codes are the only gate on advisor signup, so they come from the crypto source,
// not Math.random.
function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "INDSURE-";
  for (let i = 0; i < 6; i++) {
    code += chars[randomInt(chars.length)];
  }
  return code;
}

export async function POST() {
  const code = generateCode();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { data, error } = await supabaseAdmin
    .from("invite_codes")
    .insert({ code, expires_at: expiresAt.toISOString() })
    .select()
    .single();

  if (error) {
    console.error("[invite-codes] Supabase error:", error);
    return NextResponse.json({ error: "Could not create the invite code. Try again." }, { status: 500 });
  }

  return NextResponse.json({ code: data });
}
