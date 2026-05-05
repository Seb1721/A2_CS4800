import { NextResponse } from "next/server";

import { ensureAppSetup } from "@/lib/app-setup";
import { createSession, setSessionCookie, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  await ensureAppSetup();

  const body = await request.json().catch(() => null);
  const username = String(body?.username ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  const isValid = await verifyPassword(username, password);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, username });
  const token = await createSession(username);
  await setSessionCookie(response, token);
  return response;
}
