import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    // Get total policies
    const totalPoliciesRes = await pool.query("SELECT COUNT(*) FROM policies");
    const totalPolicies = parseInt(totalPoliciesRes.rows[0].count);

    // Get active agents
    const activeAgentsRes = await pool.query("SELECT COUNT(*) FROM agents WHERE status = 'active'");
    const activeAgents = parseInt(activeAgentsRes.rows[0].count);

    // Get pending queue
    const pendingQueueRes = await pool.query("SELECT COUNT(*) FROM policies WHERE status IN ('queued', 'processing')");
    const pendingQueue = parseInt(pendingQueueRes.rows[0].count);

    // Calculate success rate
    const completedRes = await pool.query("SELECT COUNT(*) FROM policies WHERE status = 'completed'");
    const failedRes = await pool.query("SELECT COUNT(*) FROM policies WHERE status = 'failed'");
    const completed = parseInt(completedRes.rows[0].count);
    const failed = parseInt(failedRes.rows[0].count);
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
