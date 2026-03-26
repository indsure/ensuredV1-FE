import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    const totalPolicies = (await pool.query("SELECT count(*) FROM policies")).rows[0].count;
    const totalAgents = (await pool.query("SELECT count(*) FROM agents WHERE status = 'active'")).rows[0].count;
    
    return NextResponse.json({
      data: {
        totalPolicies: parseInt(totalPolicies),
        activeAgents: parseInt(totalAgents),
        trends: []
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
