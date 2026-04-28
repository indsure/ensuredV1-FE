import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!supabase) {
      return NextResponse.json({ error: "Authentication not configured" }, { status: 500 });
    }

    // Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // Get agent details from database
    const agentRes = await pool.query(
      "SELECT id, email, role, status, name FROM agents WHERE id = $1",
      [data.user.id]
    );

    if (agentRes.rows.length === 0) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const agent = agentRes.rows[0];

    return NextResponse.json({
      user: {
        id: agent.id,
        email: agent.email,
        name: agent.name || agent.email,
        role: agent.role,
      },
      token: data.session.access_token,
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json({ error: err.message || "Login failed" }, { status: 500 });
  }
}
