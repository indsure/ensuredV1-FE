import { NextResponse } from "next/server";
import { corpAdmin } from "@/lib/corpAdmin";

// Owner link, rename, switch on or off, unlock. The backend owns the rules; this only relays.
export async function POST(req: Request, { params }: { params: Promise<{ code: string; action: string }> }) {
  const { code, action } = await params;
  if (!/^IC\d{5}$/.test(code) || !["owner", "rename", "on", "off", "unlock"].includes(action)) {
    return NextResponse.json({ error: "No such action." }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  return corpAdmin("POST", `/orgs/${code}/${action}`, { name: body.name, email: body.email });
}
