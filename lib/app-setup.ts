import { hash } from "bcryptjs";

import { getDatabase } from "@/lib/mongodb";

let setupPromise: Promise<void> | null = null;

export async function ensureAppSetup() {
  if (!setupPromise) {
    setupPromise = runSetup().catch((error) => {
      setupPromise = null;
      throw error;
    });
  }

  await setupPromise;
}

async function runSetup() {
  const db = await getDatabase();
  const users = db.collection("users");
  const cars = db.collection("cars");

  await Promise.all([
    users.createIndex({ username: 1 }, { unique: true }),
    users.createIndex({ email: 1 }, { unique: true, sparse: true }),
    cars.createIndex({ carId: 1 }, { unique: true }),
    cars.createIndex({ ownerUsername: 1, carId: 1 }, { unique: true })
  ]);

  const adminUser = process.env.CARKEEPER_ADMIN_USER?.trim().toLowerCase();
  const adminPassword = process.env.CARKEEPER_ADMIN_PASSWORD;
  const adminEmail = process.env.CARKEEPER_ADMIN_EMAIL?.trim().toLowerCase();

  if (!adminUser || !adminPassword) {
    return;
  }

  const existing = await users.findOne({ username: adminUser });
  if (existing) {
    return;
  }

  await users.insertOne({
    displayName: "Administrator",
    email: adminEmail || null,
    username: adminUser,
    passwordHash: await hash(adminPassword, 12),
    createdAt: new Date()
  });
}
