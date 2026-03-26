import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Pool } from "pg";

import { AssignPolicySchema } from "@/lib/types";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext(req);
    requireRole(auth, ["admin", "manager"]);
    const { id } = await params;
    const body = await req.json();
    const parsed = AssignPolicySchema.parse(body);
    
    const res = await pool.query("UPDATE policies SET assigned_agent_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *", [parsed.agent_id, id]);
    
    await logAudit(auth.user.id, "ASSIGN_POLICY", "policies", id, { assigned_to: parsed.agent_id });
    return NextResponse.json({ data: res.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
