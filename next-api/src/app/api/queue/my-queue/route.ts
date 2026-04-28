import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    const res = await pool.query(`
      SELECT 
        p.id,
        p.policy_number as "policyNumber",
        p.client_name as client,
        p.status,
        'normal' as priority,
        to_char(p.created_at, 'YYYY-MM-DD HH24:MI') as "addedAt"
      FROM policies p
      WHERE p.assigned_agent_id = $1
        AND p.status IN ('queued', 'processing')
      ORDER BY p.created_at DESC
      LIMIT 50
    `, [auth.user.id]);

    return NextResponse.json({ data: res.rows });
  } catch (err: any) {
    console.error("My queue error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
