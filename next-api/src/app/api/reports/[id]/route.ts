import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Pool } from "pg";

import { UpdateReportSchema } from "@/lib/types";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext(req);
    const { id } = await params;
    const res = await pool.query("SELECT * FROM reports WHERE id = $1", [id]);
    return NextResponse.json({ data: res.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext(req);
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateReportSchema.parse(body);
    
    const res = await pool.query(
      "UPDATE reports SET status = $1, summary = COALESCE($2, summary), reviewed_by_agent_id = $3, reviewed_at = NOW(), updated_at = NOW() WHERE id = $4 RETURNING *",
      [parsed.status, parsed.notes, auth.user.id, id]
    );
    
    await logAudit(auth.user.id, "REVIEW_REPORT", "reports", id, parsed);
    return NextResponse.json({ data: res.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
