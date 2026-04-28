import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requireRole(auth, ["admin", "manager"]);

    const { searchParams } = new URL(req.url);
    const severity = searchParams.get("severity");
    const status = searchParams.get("status");

    let query = `
      SELECT 
        p.id,
        p.policy_number as "policyId",
        'processing_error' as "errorType",
        CASE 
          WHEN p.status = 'failed' THEN 'high'
          ELSE 'medium'
        END as severity,
        COALESCE(p.error_message, 'Processing failed') as message,
        CASE 
          WHEN p.status = 'failed' THEN 'open'
          ELSE 'resolved'
        END as status,
        p.updated_at as timestamp
      FROM policies p
      WHERE p.status IN ('failed', 'error')
    `;

    const params: any[] = [];
    let idx = 1;

    if (severity) {
      query += ` AND CASE WHEN p.status = 'failed' THEN 'high' ELSE 'medium' END = $${idx++}`;
      params.push(severity);
    }

    if (status) {
      query += ` AND CASE WHEN p.status = 'failed' THEN 'open' ELSE 'resolved' END = $${idx++}`;
      params.push(status);
    }

    query += " ORDER BY p.updated_at DESC LIMIT 50";

    const res = await pool.query(query, params);
    return NextResponse.json({ data: res.rows });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Errors list error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
