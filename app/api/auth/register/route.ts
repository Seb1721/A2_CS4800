import { NextResponse } from "next/server";

import { ensureAppSetup } from "@/lib/app-setup";
import { createSession, createUser, setSessionCookie } from "@/lib/auth";
import { isDatabaseUnavailableError } from "@/lib/mongodb";

export async function POST(request: Request) {
  try {
    await ensureAppSetup();

    const body = await request.json().catch(() => null);
    const displayName = String(body?.displayName ?? "");
    const email = String(body?.email ?? "");
    const username = String(body?.username ?? "");
    const password = String(body?.password ?? "");

    const createdUsername = await createUser(username, password, email, displayName);
    const response = NextResponse.json({ ok: true, username: createdUsername }, { status: 201 });
    const token = await createSession(createdUsername);
    await setSessionCookie(response, token);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create account.";
    const status =
      message === "Username must be at least 3 characters." ||
      message === "Password must be at least 8 characters." ||
      message === "Enter a valid email address." ||
      message === "That username is already taken." ||
      message === "That email address is already in use."
        ? 400
        : isDatabaseUnavailableError(error)
          ? 503
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
