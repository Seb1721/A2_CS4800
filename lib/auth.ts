import { compare, hash } from "bcryptjs";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";

import { getDatabase } from "@/lib/mongodb";
import type { SessionUser } from "@/lib/types";

const SESSION_COOKIE = "carkeeper_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12;
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || process.env.FLASK_SECRET_KEY || "dev-only-secret"
);

type UserRecord = {
  username: string;
  passwordHash: string;
  createdAt: Date;
};

export async function createUser(usernameInput: string, password: string) {
  const username = usernameInput.trim().toLowerCase();
  if (username.length < 3) {
    throw new Error("Username must be at least 3 characters.");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const db = await getDatabase();
  const users = db.collection<UserRecord>("users");
  const existing = await users.findOne({ username });

  if (existing) {
    throw new Error("That username is already taken.");
  }

  await users.insertOne({
    username,
    passwordHash: await hash(password, 12),
    createdAt: new Date()
  });

  return username;
}

export async function verifyPassword(usernameInput: string, password: string) {
  const username = usernameInput.trim().toLowerCase();
  const db = await getDatabase();
  const users = db.collection<UserRecord>("users");
  const user = await users.findOne({ username });

  if (!user) {
    return false;
  }

  return compare(password, user.passwordHash);
}

export async function createSession(username: string) {
  return new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secret);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    const username = typeof payload.username === "string" ? payload.username : null;

    if (!username) {
      return null;
    }

    return { username };
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS
  });
}

export async function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
