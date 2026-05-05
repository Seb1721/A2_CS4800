import { NextResponse } from "next/server";

import { ensureAppSetup } from "@/lib/app-setup";
import { getCurrentUser } from "@/lib/auth";
import { getCarDetailsForUser } from "@/lib/cars";

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
