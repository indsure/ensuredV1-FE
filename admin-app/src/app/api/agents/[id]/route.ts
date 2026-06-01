import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { upload_limit, credits } = body;

  try {
    // Update upload limit on agents table
    if (upload_limit !== undefined) {
      const { error } = await supabaseAdmin
        .from("agents")
        .update({ upload_limit })
        .eq("id", id);
      if (error) throw error;
    }

    // Update credits on agent_credits table
    if (credits !== undefined) {
      const { data: existing } = await supabaseAdmin
        .from("agent_credits")
        .select("*")
        .eq("agent_id", id)
        .single();

      if (existing) {
        const { error } = await supabaseAdmin
          .from("agent_credits")
          .update({ credits_remaining: credits })
          .eq("agent_id", id);
        if (error) throw error;
      } else {
        const { error } = await supabaseAdmin
          .from("agent_credits")
          .insert({ agent_id: id, credits_remaining: credits });
        if (error) throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
