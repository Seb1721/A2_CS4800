import { NextResponse } from "next/server";

import { ensureAppSetup } from "@/lib/app-setup";
import { createSession, createUser, isAuthConfigurationError, setSessionCookie } from "@/lib/auth";
import { isDatabaseUnavailableError } from "@/lib/mongodb";
import { enforceRateLimit, isRateLimitError } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    await ensureAppSetup();
    enforceRateLimit(request, "auth:register", 6);

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
      isRateLimitError(error)
        ? 429
        : message === "Username must be at least 3 characters." ||
          message === "Password must be at least 12 characters." ||
          message === "Password must include a lowercase letter." ||
          message === "Password must include an uppercase letter." ||
          message === "Password must include a number." ||
          message === "Password must include a symbol." ||
          message === "Password must not contain your username or email name." ||
          message === "Enter a valid email address." ||
          message === "That username is already taken." ||
          message === "That email address is already in use."
          ? 400
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
