import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(req);
    const { id } = await params;

    await pool.query(
      "UPDATE policies SET assigned_agent_id = $1, status = 'processing' WHERE id = $2",
      [auth.user.id, id]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Assign policy error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
