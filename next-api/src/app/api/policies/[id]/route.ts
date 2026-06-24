import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Pool } from "pg";
import { UpdatePolicySchema } from "@/lib/types";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext(req);
    const { id } = await params;
    const isAdmin = auth.type === "api_key" || auth.agent?.role === "admin" || auth.agent?.role === "manager";
    const res = isAdmin
      ? await pool.query("SELECT * FROM policies WHERE id = $1", [id])
      : await pool.query("SELECT * FROM policies WHERE id = $1 AND assigned_agent_id = $2", [id, auth.user.id]);
    if (!res.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: res.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.message === "Unauthorized" ? 401 : 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext(req);
    requireRole(auth, ["admin", "manager"]);
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdatePolicySchema.parse(body);

    const entries = Object.entries(parsed);
    const values = entries.map(([, value]) => value);
    const updates = entries.map(([key], index) => `${key} = $${index + 1}`);
    values.push(id);

    const res = await pool.query(
      `UPDATE policies SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${entries.length + 1} RETURNING *`,
      values
    );

    await logAudit(auth.user.id, "UPDATE_POLICY", "policies", id, parsed);
    return NextResponse.json({ data: res.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
