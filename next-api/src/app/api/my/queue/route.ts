import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    const res = await pool.query(
      "SELECT * FROM policies WHERE assigned_agent_id = $1 AND status IN ('queued', 'needs_review') ORDER BY priority DESC, created_at ASC", 
      [auth.user.id]
    );
    return NextResponse.json({ data: res.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
