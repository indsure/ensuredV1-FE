import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function logAudit(
  actorId: string,
  eventType: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, any>
) {
  try {
    await pool.query(
      "INSERT INTO audit_logs (event_type, actor_agent_id, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5)",
      [eventType, actorId, entityType, entityId, JSON.stringify(metadata)]
    );
  } catch(e) {
    console.error("Failed to write audit log:", e);
  }
}
