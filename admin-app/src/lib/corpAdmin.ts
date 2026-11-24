// Calls IndSure Commercial's organisation routes on the backend (/api/corp/admin). Server only: the key must
// never reach the browser, so nothing in a "use client" file may import this.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const URL_ = (process.env.CORP_API_URL || "https://api.indsure.in").replace(/\/+$/, "");

export async function corpAdmin(method: "GET" | "POST", path: string, body?: unknown) {
  // Checked here as well as in the middleware, because these routes hand out owner links.
  if (!(await verifySession((await cookies()).get(SESSION_COOKIE)?.value))) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const key = process.env.CORP_ADMIN_TOKEN || "";
  if (key.length < 32) {
    return NextResponse.json({ error: "CORP_ADMIN_TOKEN is not set for this dashboard." }, { status: 503 });
  }
  try {
    const res = await fetch(`${URL_}/api/corp/admin${path}`, {
      method,
      headers: { "Content-Type": "application/json", "x-corp-admin": key },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const json = await res.json().catch(() => null);
    if (json) {
      // A refused key is this dashboard's setup, not the person's sign-in.
      return NextResponse.json(json, { status: res.status === 401 ? 502 : res.status });
    }
    return NextResponse.json(
      { error: res.status === 404 ? "The server does not have the Commercial admin routes yet. Run the deploy kit." : `The server answered ${res.status}.` },
      { status: 502 },
    );
  } catch {
    return NextResponse.json({ error: `Could not reach the server at ${URL_}. Reload before trying again, because the change may have been made.` }, { status: 502 });
  }
}
