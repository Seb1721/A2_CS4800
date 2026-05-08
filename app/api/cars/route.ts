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
      imageUrl: String(body?.imageUrl ?? ""),
      maintenanceAppointments: Array.isArray(body?.maintenanceAppointments) ? body.maintenanceAppointments : [],
      make: String(body?.make ?? ""),
      serviceReminderRules: Array.isArray(body?.serviceReminderRules) ? body.serviceReminderRules : [],
      model: String(body?.model ?? ""),
      mileage: Number(body?.mileage),
      year: Number(body?.year)
    });

    return NextResponse.json(car, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create car.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
