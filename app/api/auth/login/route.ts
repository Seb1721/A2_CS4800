import { NextResponse } from "next/server";

import { ensureAppSetup } from "@/lib/app-setup";
import { createSession, isAuthConfigurationError, setSessionCookie, verifyPassword } from "@/lib/auth";
import { isDatabaseUnavailableError } from "@/lib/mongodb";
import { enforceRateLimit, isRateLimitError } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    await ensureAppSetup();
    enforceRateLimit(request, "auth:login", 10);

    const body = await request.json().catch(() => null);
    const identifier = String(body?.username ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!identifier || !password) {
      return NextResponse.json({ error: "Username or email and password are required." }, { status: 400 });
    }

    const username = await verifyPassword(identifier, password);
    if (!username) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true, username });
    const token = await createSession(username);
    await setSessionCookie(response, token);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to log in.";
    const status = isRateLimitError(error)
      ? 429
      : isDatabaseUnavailableError(error)
        ? 503
        : isAuthConfigurationError(error)
          ? 500
          : 500;
    const response = NextResponse.json({ error: message }, { status });

    if (isRateLimitError(error)) {
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
    }

    return response;
  }
}
