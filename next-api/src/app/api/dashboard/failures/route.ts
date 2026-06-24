import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    const isAdmin = auth.type === "api_key" || auth.agent?.role === "admin" || auth.agent?.role === "manager";

    const res = isAdmin
      ? await pool.query(`
          SELECT id, policy_number as "policyId", error_message as error, updated_at as timestamp
          FROM policies WHERE status = 'failed' ORDER BY updated_at DESC LIMIT 10
        `)
      : await pool.query(`
          SELECT id, policy_number as "policyId", error_message as error, updated_at as timestamp
          FROM policies WHERE status = 'failed' AND assigned_agent_id = $1 ORDER BY updated_at DESC LIMIT 10
        `, [auth.user.id]);

    return NextResponse.json(res.rows);
  } catch (err: any) {
    console.error("Dashboard failures error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
