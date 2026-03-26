import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Pool } from "pg";

import { ShareReportSchema } from "@/lib/types";
import crypto from "crypto";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext(req);
    const { id } = await params;
    const body = await req.json();
    const parsed = ShareReportSchema.parse(body);
    
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = parsed.expires_at ? parsed.expires_at : new Date(Date.now() + 18 * 30 * 24 * 60 * 60 * 1000).toISOString();
    
    await pool.query(
      "INSERT INTO report_shares (report_id, token, expires_at, created_by_agent_id) VALUES ($1, $2, $3, $4)",
      [id, token, expiresAt, auth.user.id]
    );
    
    await logAudit(auth.user.id, "SHARE_REPORT", "report_shares", id, { token });
    return NextResponse.json({ share_url: `${req.nextUrl.origin}/r/${token}` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
