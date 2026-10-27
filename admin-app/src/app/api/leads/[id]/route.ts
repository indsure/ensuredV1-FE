import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const STATUSES = ["new", "contacted", "closed"] as const;
type Status = (typeof STATUSES)[number];

// What the consumer said they wanted → a plain interest label for the agent.
const TOPIC_INTEREST: Record<string, string> = {
  renew: "Renewal",
  "new-cover": "New cover",
  review: "Policy review",
  claim: "Claim help",
  other: "General",
};

type ConnectRequest = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  topic: string | null;
  message: string | null;
  pushed_lead_id: string | null;
};

// Compose the note the agent sees on the pushed lead, so they know where it came
// from and what the person asked for.
function leadNotes(r: ConnectRequest): string {
  const want = r.topic ? (TOPIC_INTEREST[r.topic] ?? r.topic) : null;
  const lines = [
    "From IndSure: consumer asked to talk to an advisor (consented).",
    want ? `Wants: ${want}.` : null,
    r.message ? `\n"${r.message}"` : null,
  ].filter(Boolean);
  return lines.join(" ");
}

/** True once the advisor has done anything with the pushed lead: moved its
 *  status, set a follow-up, or written in the notes. A worked lead is theirs:
 *  it is never deleted or handed to someone else from here. */
async function advisorWorked(leadId: string, request: ConnectRequest): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("agent_leads")
    .select("status, notes, next_follow_up")
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return false; // already gone
  return data.status !== "new" || !!data.next_follow_up || (data.notes ?? "") !== leadNotes(request);
}

// Founder-side updates to a consumer advisor request. Assigning an agent pushes
// the lead into that agent's /agent/leads (agent_leads table); un-assigning
// removes it, unless the advisor has already worked it (then it stays with them). Runs with the service-role key, so it can write agent_leads rows
// on any agent's behalf and bypass the individuals-own RLS on the source table.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  try {
    const patch: Record<string, unknown> = {};
    let kept = false;

    if ("assigned_agent_id" in body) {
      const target = body.assigned_agent_id;

      // Load the source request so we can build / relocate the agent_leads row.
      const { data: reqRow, error: reqErr } = await supabaseAdmin
        .from("agent_connect_requests")
        .select("id, name, phone, email, topic, message, pushed_lead_id")
        .eq("id", id)
        .single();
      if (reqErr || !reqRow) throw reqErr ?? new Error("Request not found");
      const request = reqRow as ConnectRequest;

      if (target === null || target === "") {
        // Un-assign: pull the lead back out of the agent's pipeline.
        if (request.pushed_lead_id) {
          if (await advisorWorked(request.pushed_lead_id, request)) {
            kept = true;
          } else {
            const { error } = await supabaseAdmin
              .from("agent_leads")
              .delete()
              .eq("id", request.pushed_lead_id);
            if (error) throw error;
          }
        }
        patch.assigned_agent_id = null;
        patch.assigned_at = null;
        patch.pushed_lead_id = null;
      } else if (typeof target === "string") {
        const worked = request.pushed_lead_id ? await advisorWorked(request.pushed_lead_id, request) : false;
        if (worked) kept = true;
        if (request.pushed_lead_id && !worked) {
          // Already in a pipeline, untouched: move it to the newly chosen agent.
          const { error } = await supabaseAdmin
            .from("agent_leads")
            .update({ agent_id: target, updated_at: new Date().toISOString() })
            .eq("id", request.pushed_lead_id);
          if (error) throw error;
        } else {
          // First push, or the first advisor already worked it: a fresh lead for
          // the chosen agent, so the first advisor's notes stay with them.
          const { data: lead, error } = await supabaseAdmin
            .from("agent_leads")
            .insert({
              agent_id: target,
              name: request.name,
              phone: request.phone,
              email: request.email,
              source: "IndSure",
              insurance_interest: request.topic ? (TOPIC_INTEREST[request.topic] ?? request.topic) : null,
              status: "new",
              notes: leadNotes(request),
            })
            .select("id")
            .single();
          if (error) throw error;
          patch.pushed_lead_id = lead.id;
        }
        patch.assigned_agent_id = target;
        patch.assigned_at = new Date().toISOString();
      } else {
        return NextResponse.json({ error: "Invalid assigned_agent_id" }, { status: 400 });
      }
    }

    if ("status" in body) {
      if (!STATUSES.includes(body.status as Status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      patch.status = body.status;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("agent_connect_requests")
      .update(patch)
      .eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true, kept });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[leads PATCH] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
