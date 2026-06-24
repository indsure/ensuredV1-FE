import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    const isAdmin = auth.type === "api_key" || auth.agent?.role === "admin" || auth.agent?.role === "manager";

    let totalPolicies: number, pendingQueue: number, completed: number, failed: number;

    if (isAdmin) {
      const [tp, pq, c, f] = await Promise.all([
        pool.query("SELECT COUNT(*) FROM policies"),
        pool.query("SELECT COUNT(*) FROM policies WHERE status IN ('queued', 'processing')"),
        pool.query("SELECT COUNT(*) FROM policies WHERE status = 'completed'"),
        pool.query("SELECT COUNT(*) FROM policies WHERE status = 'failed'"),
      ]);
      totalPolicies = parseInt(tp.rows[0].count);
      pendingQueue = parseInt(pq.rows[0].count);
      completed = parseInt(c.rows[0].count);
      failed = parseInt(f.rows[0].count);
    } else {
      const agentId = auth.user.id;
      const [tp, pq, c, f] = await Promise.all([
        pool.query("SELECT COUNT(*) FROM policies WHERE assigned_agent_id = $1", [agentId]),
        pool.query("SELECT COUNT(*) FROM policies WHERE assigned_agent_id = $1 AND status IN ('queued', 'processing')", [agentId]),
        pool.query("SELECT COUNT(*) FROM policies WHERE assigned_agent_id = $1 AND status = 'completed'", [agentId]),
        pool.query("SELECT COUNT(*) FROM policies WHERE assigned_agent_id = $1 AND status = 'failed'", [agentId]),
      ]);
      totalPolicies = parseInt(tp.rows[0].count);
      pendingQueue = parseInt(pq.rows[0].count);
      completed = parseInt(c.rows[0].count);
      failed = parseInt(f.rows[0].count);
    }

    // Active agents count is admin-only; non-admins get their own agent count (1)
    const activeAgentsRes = isAdmin
      ? await pool.query("SELECT COUNT(*) FROM agents WHERE status = 'active'")
      : null;
    const activeAgents = activeAgentsRes ? parseInt(activeAgentsRes.rows[0].count) : 1;

    const successRate = completed + failed > 0 ? ((completed / (completed + failed)) * 100).toFixed(1) : "0.0";

    return NextResponse.json({
      totalPolicies,
      activeAgents,
      pendingQueue,
      successRate: parseFloat(successRate),
    });
  } catch (err: any) {
    console.error("Dashboard metrics error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
