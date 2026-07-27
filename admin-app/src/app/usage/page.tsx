import { AppShell } from "@/components/AppShell";
import { supabaseAdmin } from "@/lib/supabase";
import { UsageClient, type UsageRow } from "./UsageClient";

// Always read fresh — this is a live spend monitor.
export const dynamic = "force-dynamic";

async function getUsage(days = 7): Promise<UsageRow[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("gemini_usage_log")
    .select(
      "created_at, feature, model, source_type, actor_id, input_hash, prompt_tokens, output_tokens, total_tokens, est_cost_usd, status"
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    // Table may not exist yet (migration not run). Render empty rather than 500.
    console.error("gemini_usage_log read failed:", error.message);
    return [];
  }
  return (data ?? []) as UsageRow[];
}

export default async function UsagePage() {
  const rows = await getUsage(7);
  return (
    <AppShell>
      <UsageClient rows={rows} rangeDays={7} />
    </AppShell>
  );
}
