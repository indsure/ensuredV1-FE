import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    
    const shareRes = await pool.query(
      "SELECT * FROM report_shares WHERE token = $1 AND (expires_at > NOW() OR expires_at IS NULL) AND revoked_at IS NULL", 
      [token]
    );
    if (shareRes.rows.length === 0) return NextResponse.json({ error: "Invalid, expired, or revoked share link" }, { status: 404 });
    const share = shareRes.rows[0];
    
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return NextResponse.json({ error: "Link expired" }, { status: 410 });
    }
    if (share.revoked_at) {
      return NextResponse.json({ error: "Link revoked" }, { status: 410 });
    }
    
    await pool.query("UPDATE report_shares SET last_accessed_at = NOW() WHERE id = $1", [share.id]);
    
    const reportRes = await pool.query("SELECT score, flaws_count, summary, report_json, report_markdown FROM reports WHERE id = $1", [share.report_id]);
    return NextResponse.json({ data: reportRes.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
