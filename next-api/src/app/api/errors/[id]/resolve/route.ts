import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(req);
    requireRole(auth, ["admin", "manager"]);
    const { id } = await params;

    await pool.query(
      "UPDATE policies SET status = 'completed', error_message = NULL WHERE id = $1",
      [id]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Resolve error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
