import { NextResponse } from "next/server";

import { ensureAppSetup } from "@/lib/app-setup";
import { getCurrentUser, getUserProfileByUsername, updateUserProfile } from "@/lib/auth";

export async function GET() {
  await ensureAppSetup();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const profile = await getUserProfileByUsername(user.username);
  if (!profile) {
    return NextResponse.json({ error: "User profile not found." }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PUT(request: Request) {
  await ensureAppSetup();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  try {
    const profile = await updateUserProfile(user.username, {
      displayName: String(body?.displayName ?? ""),
      email: String(body?.email ?? "")
    });

    return NextResponse.json(profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update profile.";
    const status =
      message === "Enter a valid email address." ||
      message === "That email address is already in use."
        ? 400
        : message === "User profile not found."
          ? 404
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
