import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "INDSURE-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
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
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  return NextResponse.json({ code: data });
}
