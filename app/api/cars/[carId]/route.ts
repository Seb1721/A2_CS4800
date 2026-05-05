import { NextResponse } from "next/server";

import { ensureAppSetup } from "@/lib/app-setup";
import { getCurrentUser } from "@/lib/auth";
import { deleteCarForUser, getCarDetailsForUser, updateCarForUser } from "@/lib/cars";

type RouteContext = {
  params: Promise<{
    carId: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  await ensureAppSetup();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const { carId } = await context.params;

  try {
    const car = await getCarDetailsForUser(user.username, Number(carId));
    return NextResponse.json(car);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load car.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  await ensureAppSetup();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const { carId } = await context.params;
  const body = await request.json().catch(() => null);

  try {
    const car = await updateCarForUser(user.username, Number(carId), {
      allowMileageCorrection: Boolean(body?.allowMileageCorrection),
      imageUrl: String(body?.imageUrl ?? ""),
      make: String(body?.make ?? ""),
      model: String(body?.model ?? ""),
      mileage: Number(body?.mileage),
      serviceReminderRules: Array.isArray(body?.serviceReminderRules) ? body.serviceReminderRules : [],
      year: Number(body?.year)
    });

    return NextResponse.json(car);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update car.";
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

  const { carId } = await context.params;

  try {
    await deleteCarForUser(user.username, Number(carId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete car.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
