import { supabase } from "@/lib/supabase";
import { apiFetch, apiOk } from "@/lib/api";
import { isPlaygroundMode } from "@/lib/playground/mode";

/**
 * Delete a policy for good, including its uploaded PDF and any attached covers.
 *
 * Goes through the backend, which removes the stored files and logs the delete.
 * Deleting the row from the browser left every file in storage while the screen
 * said it was gone. The playground has no backend, so it keeps the mock delete.
 */
export async function deletePolicyRecord(id: string, agentId: string): Promise<void> {
  if (isPlaygroundMode()) {
    const { error } = await supabase.from("clients").delete().eq("id", id).eq("agent_id", agentId);
    if (error) throw new Error(error.message);
    return;
  }
  await apiOk(apiFetch(`/api/agent/policies/${encodeURIComponent(id)}`, { method: "DELETE" }));
}
