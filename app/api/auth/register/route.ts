import { NextResponse } from "next/server";

import { ensureAppSetup } from "@/lib/app-setup";
import { createSession, createUser, setSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await ensureAppSetup();

    const body = await request.json().catch(() => null);
    const username = String(body?.username ?? "");
    const password = String(body?.password ?? "");

    const createdUsername = await createUser(username, password);
    const response = NextResponse.json({ ok: true, username: createdUsername }, { status: 201 });
    const token = await createSession(createdUsername);
    await setSessionCookie(response, token);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create account.";
    const status =
      message === "Username must be at least 3 characters." ||
      message === "Password must be at least 8 characters." ||
      message === "That username is already taken."
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
