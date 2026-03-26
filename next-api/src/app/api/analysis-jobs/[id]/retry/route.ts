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
    
    const jobRes = await pool.query(`SELECT policy_id FROM ${JOBS_TABLE} WHERE id = $1`, [id]);
    if (jobRes.rows.length === 0) throw new Error("Job not found");
    const policyId = jobRes.rows[0].policy_id;
    
    const newJob = await pool.query(
      `INSERT INTO ${JOBS_TABLE} (policy_id, status, retry_of_job_id) VALUES ($1, 'queued', $2) RETURNING *`,
      [policyId, id]
    );
    
    await logAudit(auth.user.id, "RETRY_JOB", JOBS_TABLE, id, { new_job_id: newJob.rows[0].id });
    return NextResponse.json({ data: newJob.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
