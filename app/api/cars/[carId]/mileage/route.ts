import { NextResponse } from "next/server";

import { ensureAppSetup } from "@/lib/app-setup";
import { getCurrentUser } from "@/lib/auth";
import { updateMileageForUser } from "@/lib/cars";

type RouteContext = {
  params: Promise<{
    carId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  await ensureAppSetup();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const { carId } = await context.params;
  const body = await request.json().catch(() => null);

  try {
    const car = await updateMileageForUser(user.username, {
      allowCorrection: Boolean(body?.allowCorrection),
      carId: Number(carId),
      mileage: Number(body?.mileage),
      notes: String(body?.notes ?? "")
    });

    return NextResponse.json(car);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update mileage.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
