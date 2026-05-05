import { NextResponse } from "next/server";

import { ensureAppSetup } from "@/lib/app-setup";
import { getCurrentUser } from "@/lib/auth";
import { createCar, listCarsForUser } from "@/lib/cars";

export async function GET() {
  await ensureAppSetup();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const cars = await listCarsForUser(user.username);
  return NextResponse.json(cars);
}

export async function POST(request: Request) {
  await ensureAppSetup();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  try {
    const car = await createCar(user.username, {
      make: String(body?.make ?? ""),
      model: String(body?.model ?? ""),
      year: Number(body?.year),
      mileage: Number(body?.mileage),
      imageUrl: String(body?.imageUrl ?? "")
    });

    return NextResponse.json(car, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create car.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
