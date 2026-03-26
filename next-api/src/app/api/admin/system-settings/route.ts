import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requireRole(auth, ["admin"]);
    
    return NextResponse.json(
      { error: "System settings are not implemented in next-api yet" },
      { status: 501 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requireRole(auth, ["admin"]);
    await req.json();
    return NextResponse.json(
      { error: "System settings persistence is not implemented in next-api yet" },
      { status: 501 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
