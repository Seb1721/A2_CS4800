import { compare, hash } from "bcryptjs";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { getDatabase } from "@/lib/mongodb";
import type { SessionUser, UserProfile } from "@/lib/types";

const SESSION_COOKIE = "carkeeper_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12;
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || process.env.FLASK_SECRET_KEY || "dev-only-secret"
);

type UserRecord = {
  _id?: ObjectId;
  displayName?: string;
  email?: string | null;
  username: string;
  passwordHash: string;
  createdAt: Date;
};

export async function createUser(
  usernameInput: string,
  password: string,
  emailInput: string,
  displayNameInput: string
) {
  const username = usernameInput.trim().toLowerCase();
  const email = normalizeEmail(emailInput);
  const displayName = normalizeDisplayName(displayNameInput, username);
  if (username.length < 3) {
    throw new Error("Username must be at least 3 characters.");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  if (!isValidEmail(email)) {
    throw new Error("Enter a valid email address.");
  }

  const db = await getDatabase();
  const users = db.collection<UserRecord>("users");
  const existing = await users.findOne({ $or: [{ username }, { email }] });

  if (existing?.username === username) {
    throw new Error("That username is already taken.");
  }

  if (existing?.email === email) {
    throw new Error("That email address is already in use.");
  }

  await users.insertOne({
    displayName,
    email,
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

export async function getUserProfileByUsername(usernameInput: string): Promise<UserProfile | null> {
  const username = usernameInput.trim().toLowerCase();
  const db = await getDatabase();
  const users = db.collection<UserRecord>("users");
  const user = await users.findOne({ username });

  return user ? toUserProfile(user) : null;
}

export async function updateUserProfile(
  usernameInput: string,
  input: { email: string; displayName: string }
): Promise<UserProfile> {
  const username = usernameInput.trim().toLowerCase();
  const email = normalizeEmail(input.email);
  const displayName = normalizeDisplayName(input.displayName, username);

  if (!isValidEmail(email)) {
    throw new Error("Enter a valid email address.");
  }

  const db = await getDatabase();
  const users = db.collection<UserRecord>("users");
  const existing = await users.findOne({
    email,
    username: { $ne: username }
  });

  if (existing) {
    throw new Error("That email address is already in use.");
  }

  const result = await users.findOneAndUpdate(
    { username },
    {
      $set: {
        displayName,
        email
      }
    },
    { returnDocument: "after" }
  );

  if (!result) {
    throw new Error("User profile not found.");
  }

  return toUserProfile(result);
}

export async function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
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
    secure: shouldUseSecureCookies(),
    path: "/",
    maxAge: 0
  });
}

function toUserProfile(user: UserRecord): UserProfile {
  return {
    createdAt: user.createdAt.toISOString(),
    displayName: user.displayName?.trim() || user.username,
    email: user.email ?? null,
    id: user._id?.toString() ?? user.username,
    username: user.username
  };
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeDisplayName(value: string, username: string) {
  return value.trim() || username;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function shouldUseSecureCookies() {
  if (process.env.COOKIE_SECURE === "false") {
    return false;
  }

  return process.env.NODE_ENV === "production";
}
