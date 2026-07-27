import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Delete from Supabase Auth — cascades to agents table via FK
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[delete-agent] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { upload_limit, credits, plan, billing_cycle, ocr_balance } = body;

  try {
    // Update upload limit on agents table
    if (upload_limit !== undefined) {
      const { error } = await supabaseAdmin
        .from("agents")
        .update({ upload_limit })
        .eq("id", id);
      if (error) throw error;
    }

    // Update plan / billing cycle on agents table. billing_cycle drives whether
    // the monthly OCR refill resets (monthly) or carries over (annual).
    const agentPatch: Record<string, string> = {};
    if (plan !== undefined) agentPatch.plan = plan;
    if (billing_cycle !== undefined) agentPatch.billing_cycle = billing_cycle;
    if (Object.keys(agentPatch).length > 0) {
      const { error } = await supabaseAdmin
        .from("agents")
        .update(agentPatch)
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
          .update({ balance: credits })
          .eq("agent_id", id);
        if (error) throw error;
      } else {
        const { error } = await supabaseAdmin
          .from("agent_credits")
          .insert({ agent_id: id, balance: credits });
        if (error) throw error;
      }
    }

    // Update OCR / data-entry balance on agent_ocr_credits. Stamp the current
    // 'YYYY-MM' period so the backend's monthly refill job leaves this manual
    // value alone until the next month boundary.
    if (ocr_balance !== undefined) {
      const period = new Date().toISOString().slice(0, 7);
      const { data: existing } = await supabaseAdmin
        .from("agent_ocr_credits")
        .select("agent_id")
        .eq("agent_id", id)
        .single();

      if (existing) {
        const { error } = await supabaseAdmin
          .from("agent_ocr_credits")
          .update({ balance: ocr_balance, period })
          .eq("agent_id", id);
        if (error) throw error;
      } else {
        const { error } = await supabaseAdmin
          .from("agent_ocr_credits")
          .insert({ agent_id: id, balance: ocr_balance, period });
        if (error) throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
