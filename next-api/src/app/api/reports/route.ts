import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    const isAdmin = auth.type === "api_key" || auth.agent?.role === "admin" || auth.agent?.role === "manager";
    const res = isAdmin
      ? await pool.query("SELECT * FROM reports ORDER BY created_at DESC LIMIT 50")
      : await pool.query("SELECT * FROM reports WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 50", [auth.user.id]);
    return NextResponse.json({ data: res.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.message === "Unauthorized" ? 401 : 500 });
  }
}
