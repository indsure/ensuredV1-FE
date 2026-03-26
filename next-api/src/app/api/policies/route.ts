import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Pool } from "pg";

import { CreatePolicySchema } from "@/lib/types";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const agentId = searchParams.get("agent_id");
    
    let query = "SELECT * FROM policies WHERE 1=1";
    let params: any[] = [];
    let idx = 1;
    
    if (auth.agent?.role === "agent") {
      query += ` AND (assigned_agent_id = $${idx} OR created_by_agent_id = $${idx})`;
      params.push(auth.user.id);
      idx++;
    } else if (agentId === "me") {
      query += ` AND assigned_agent_id = $${idx++}`;
      params.push(auth.user.id);
    }
    
    if (status) {
      query += ` AND status = $${idx++}`;
      params.push(status);
    }
    
    const res = await pool.query(query + " ORDER BY created_at DESC", params);
    return NextResponse.json({ data: res.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    const body = await req.json();
    const parsed = CreatePolicySchema.parse(body);
    
    const res = await pool.query(
      `INSERT INTO policies (client_name, client_identifier, insurer_name, product_name, policy_number, status, created_by_agent_id) 
       VALUES ($1, $2, $3, $4, $5, 'queued', $6) RETURNING *`,
      [parsed.client_name, parsed.client_identifier, parsed.insurer_name, parsed.product_name, parsed.policy_number, auth.user.id]
    );
    
    await logAudit(auth.user.id, "CREATE_POLICY", "policies", res.rows[0].id, parsed);
    return NextResponse.json({ data: res.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
