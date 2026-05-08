import { NextResponse } from "next/server";

import { ensureAppSetup } from "@/lib/app-setup";
import { getCurrentUser } from "@/lib/auth";
import { deleteMileageEntryForUser, updateMileageEntryForUser } from "@/lib/cars";

type RouteContext = {
  params: Promise<{
    carId: string;
    entryId: string;
  }>;
};

export async function PUT(request: Request, context: RouteContext) {
  await ensureAppSetup();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const { carId, entryId } = await context.params;
  const body = await request.json().catch(() => null);

  try {
    const car = await updateMileageEntryForUser(user.username, Number(carId), Number(entryId), {
      allowCorrection: Boolean(body?.allowCorrection),
      mileage: Number(body?.mileage),
      notes: String(body?.notes ?? "")
    });

    return NextResponse.json(car);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update mileage entry.";
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

  const { carId, entryId } = await context.params;

  try {
    const car = await deleteMileageEntryForUser(user.username, Number(carId), Number(entryId));
    return NextResponse.json(car);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete mileage entry.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
