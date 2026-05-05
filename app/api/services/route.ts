import { NextResponse } from "next/server";

import { ensureAppSetup } from "@/lib/app-setup";
import { getCurrentUser } from "@/lib/auth";
import { addServiceToCar } from "@/lib/cars";

export async function POST(request: Request) {
  await ensureAppSetup();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  try {
    const car = await addServiceToCar(user.username, {
      carId: Number(body?.carId),
      serviceDate: String(body?.serviceDate ?? ""),
      mileage: Number(body?.mileage),
      serviceType: String(body?.serviceType ?? ""),
      description: String(body?.description ?? ""),
      notes: String(body?.notes ?? ""),
      cost: body?.cost ?? ""
    });

    return NextResponse.json(car);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add service.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
