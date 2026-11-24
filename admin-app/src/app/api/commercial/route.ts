import { corpAdmin } from "@/lib/corpAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  return corpAdmin("GET", "/orgs");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return corpAdmin("POST", "/orgs", { name: body.name, email: body.email });
}
