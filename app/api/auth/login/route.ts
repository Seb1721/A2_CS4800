import { NextResponse } from "next/server";

import { ensureAppSetup } from "@/lib/app-setup";
import { createSession, setSessionCookie, verifyPassword } from "@/lib/auth";
import { isDatabaseUnavailableError } from "@/lib/mongodb";

export async function POST(request: Request) {
  try {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to log in.";
    return NextResponse.json({ error: message }, { status: isDatabaseUnavailableError(error) ? 503 : 500 });
  }
}
