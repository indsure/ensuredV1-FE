import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JOBS_TABLE = "public_analysis_jobs";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requireRole(auth, ["admin", "manager"]);
    
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const policyId = searchParams.get("policy_id");
    
    let query = `SELECT * FROM ${JOBS_TABLE} WHERE 1=1`;
    let params: any[] = [];
    let idx = 1;
    
    if (status) { query += ` AND status = $${idx++}`; params.push(status); }
    if (policyId) { query += ` AND policy_id = $${idx++}`; params.push(policyId); }
    
    const res = await pool.query(query + " ORDER BY queued_at DESC", params);
    return NextResponse.json({ data: res.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
