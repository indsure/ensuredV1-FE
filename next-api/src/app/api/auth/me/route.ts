import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    if (auth.type !== "agent") {
      return NextResponse.json({ error: "Invalid auth type" }, { status: 401 });
    }

    // Get full agent details
    const agentRes = await pool.query(
      "SELECT id, email, role, status, name FROM agents WHERE id = $1",
      [auth.user.id]
    );

    if (agentRes.rows.length === 0) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const agent = agentRes.rows[0];

    return NextResponse.json({
      id: agent.id,
      email: agent.email,
      name: agent.name || agent.email,
      role: agent.role,
    });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
