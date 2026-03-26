import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Always use service role for backend logic, but apply RLS manually where required
// based on the caller's ID if needed, or rely on service role passing x-user-id.
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function logAudit(
  actorAgentId: string | null,
  eventType: string,
  entityType: string,
  entityId: string | null,
  metadata: any = {}
) {
  try {
    await supabase.from('audit_logs').insert({
      event_type: eventType,
      actor_agent_id: actorAgentId,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}
