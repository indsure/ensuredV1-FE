import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext(req);
    const { id } = await params;
    
    await logAudit(auth.user.id, "EXPORT_REPORT_PDF", "reports", id, {});
    return NextResponse.json(
      { error: "PDF export is not implemented in next-api yet" },
      { status: 501 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
