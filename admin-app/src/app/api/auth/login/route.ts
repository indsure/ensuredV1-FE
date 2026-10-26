import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_S, createSession, safeEqual } from "@/lib/session";

export async function POST(req: Request) {
  const { email, password } = await req.json();

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return NextResponse.json({ error: "Admin credentials not configured" }, { status: 500 });
  }

  // Both compared in full every time, so the response time does not hint at which one was wrong.
  const emailOk = safeEqual(String(email ?? ""), adminEmail);
  const passwordOk = safeEqual(String(password ?? ""), adminPassword);
  if (emailOk && passwordOk) {
    const session = await createSession();
    if (!session) {
      return NextResponse.json({ error: "Admin credentials not configured" }, { status: 500 });
    }
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_S,
      path: "/",
    });
    return response;
  }

  // A small fixed delay makes guessing the password over the network slow.
  await new Promise((r) => setTimeout(r, 750));
  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
}
