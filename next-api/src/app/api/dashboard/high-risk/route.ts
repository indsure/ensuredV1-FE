import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    const res = await pool.query(`
      SELECT 
        r.id,
        r.policy_id as "policyId",
        r.score,
        r.created_at as timestamp
      FROM reports r
      WHERE r.score < 70
      ORDER BY r.score ASC, r.created_at DESC
      LIMIT 10
    `);

    return NextResponse.json(res.rows);
  } catch (err: any) {
    console.error("Dashboard high-risk error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
