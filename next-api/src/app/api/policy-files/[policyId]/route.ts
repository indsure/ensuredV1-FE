import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function POST(req: NextRequest, { params }: { params: Promise<{ policyId: string }> }) {
  try {
    const auth = await getAuthContext(req);
    const { policyId } = await params;
    
    await logAudit(auth.user.id, "CREATE_SIGNED_URL", "policy_files", policyId, {});
    return NextResponse.json(
      { error: "Signed policy file uploads are not implemented in next-api yet" },
      { status: 501 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ policyId: string }> }) {
  try {
    const auth = await getAuthContext(req);
    const { policyId } = await params;
    const res = await pool.query("SELECT * FROM policy_files WHERE policy_id = $1 ORDER BY uploaded_at DESC", [policyId]);
    return NextResponse.json({ data: res.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
