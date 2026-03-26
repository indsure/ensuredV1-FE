import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext(req);
    requireRole(auth, ["admin", "manager"]);
    const { id } = await params;
    
    await pool.query("UPDATE policies SET status = 'archived', updated_at = NOW() WHERE id = $1", [id]);
    await logAudit(auth.user.id, "ARCHIVE_POLICY", "policies", id, {});
    
    return NextResponse.json({ status: "archived" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
