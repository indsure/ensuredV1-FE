import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JOBS_TABLE = "public_analysis_jobs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext(req);
    const { id } = await params;
    
    const res = await pool.query(
      `INSERT INTO ${JOBS_TABLE} (policy_id, status) VALUES ($1, 'queued') RETURNING *`,
      [id]
    );
    
    await pool.query("UPDATE policies SET status = 'processing', updated_at = NOW() WHERE id = $1", [id]);
    await logAudit(auth.user.id, "ENQUEUE_ANALYSIS", JOBS_TABLE, id, { job_id: res.rows[0].id });
    
    return NextResponse.json({ data: res.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
