import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Pool } from "pg";

import { UpdateAgentSchema } from "@/lib/types";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext(req);
    requireRole(auth, ["admin", "manager"]);
    const { id } = await params;
    
    const res = await pool.query("SELECT * FROM agents WHERE id = $1", [id]);
    return NextResponse.json({ data: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message === "Unauthorized" ? 401 : 403 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext(req);
    requireRole(auth, ["admin"]);
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateAgentSchema.parse(body);
    
    let query = "UPDATE agents SET updated_at = NOW()";
    let values: any[] = [];
    let idx = 1;
    
    if (parsed.role) {
      query += `, role = $${idx++}`;
      values.push(parsed.role);
    }
    if (parsed.status) {
      query += `, status = $${idx++}`;
      values.push(parsed.status);
    }
    
    query += ` WHERE id = $${idx} RETURNING *`;
    values.push(id);
    
    const res = await pool.query(query, values);
    await logAudit(auth.user.id, "UPDATE_AGENT", "agents", id, parsed);
    
    return NextResponse.json({ data: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
