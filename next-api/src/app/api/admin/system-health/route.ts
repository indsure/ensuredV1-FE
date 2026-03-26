import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requireRole(auth, ["admin"]);
    
    const dbRes = await pool.query("SELECT 1 as ok");
    return NextResponse.json({
      status: "healthy",
      database: dbRes.rows.length === 1 ? "connected" : "error",
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
