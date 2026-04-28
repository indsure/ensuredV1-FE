import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requireRole(auth, ["admin"]);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "pending";

    const result = await pool.query(
      `SELECT id, name, email, phone, city, years_experience, status, created_at, 
              approved_at, approved_by, rejection_reason
       FROM agent_signup_requests 
       WHERE status = $1 
       ORDER BY created_at DESC`,
      [status]
    );

    return NextResponse.json({ data: result.rows });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
