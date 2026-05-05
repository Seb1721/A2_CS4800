import { NextResponse } from "next/server";

import { ensureAppSetup } from "@/lib/app-setup";
import { getCurrentUser } from "@/lib/auth";
import { deleteServiceForCar, updateServiceForCar } from "@/lib/cars";

type RouteContext = {
  params: Promise<{
    carId: string;
    serviceId: string;
  }>;
};

export async function PUT(request: Request, context: RouteContext) {
  await ensureAppSetup();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const { carId, serviceId } = await context.params;
  const body = await request.json().catch(() => null);

  try {
    const car = await updateServiceForCar(user.username, Number(carId), Number(serviceId), {
      carId: Number(body?.carId),
      cost: body?.cost ?? "",
      description: String(body?.description ?? ""),
      mileage: Number(body?.mileage),
      notes: String(body?.notes ?? ""),
      serviceDate: String(body?.serviceDate ?? ""),
      serviceType: String(body?.serviceType ?? "")
    });

    return NextResponse.json(car);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update service.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  await ensureAppSetup();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const { carId, serviceId } = await context.params;

  try {
    const car = await deleteServiceForCar(user.username, Number(carId), Number(serviceId));
    return NextResponse.json(car);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete service.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
