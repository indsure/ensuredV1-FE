import { NextRequest } from "next/server";
import { AuthContext, Role } from "./types";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

async function getAgentAuthContext(userId: string): Promise<AuthContext | null> {
  const res = await pool.query("SELECT id, email, role, status FROM agents WHERE id = $1", [userId]);
  if (res.rows.length === 0) {
    return null;
  }

  const agent = res.rows[0];
  return {
    type: "agent",
    user: { id: agent.id, email: agent.email },
    agent: { id: agent.id, role: agent.role as Role, status: agent.status },
  };
}

export async function getAuthContext(req: NextRequest): Promise<AuthContext> {
  const authHeader = req.headers.get("authorization");
  const apiKey = req.headers.get("x-api-key");

  if (apiKey) {
    if (apiKey === process.env.ADMIN_API_KEY) {
      return { type: "api_key", user: { id: "system", email: "system@indsure.com" }, app: "indsure-admin" };
    }
  }

  // NOTE: The previous `x-user-id` "dev auth" path was removed. It allowed
  // anyone to impersonate any agent by sending a header, with no token. Do not
  // reintroduce it — authenticate via the Supabase bearer token only.

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];

    try {
      if (supabase) {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data.user) {
          const context = await getAgentAuthContext(data.user.id);
          if (context) {
            return context;
          }
        }
      }
    } catch(e) {
      console.error("Auth DB Error", e);
    }
  }

  throw new Error("Unauthorized");
}

export function requireRole(auth: AuthContext, allowedRoles: Role[]) {
  if (auth.type === "api_key") return;
  if (!auth.agent || !allowedRoles.includes(auth.agent.role)) {
    throw new Error("Forbidden");
  }
}
