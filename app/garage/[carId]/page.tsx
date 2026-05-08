import { notFound, redirect } from "next/navigation";

import { DashboardClient } from "@/components/dashboard-client";
import { getCurrentUser } from "@/lib/auth";
import { getCarDetailsForUser } from "@/lib/cars";
import { loadWorkspaceData } from "@/lib/page-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ carId: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    return { title: "Vehicle Records | CarKeeper" };
  }

  const { carId } = await params;

  try {
    const car = await getCarDetailsForUser(user.username, Number(carId));
    return { title: `${car.carName} Records | CarKeeper` };
  } catch {
    return { title: "Vehicle Records | CarKeeper" };
  }
}

export default async function VehiclePage({
  params
}: {
  params: Promise<{ carId: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { carId } = await params;
  const { attentionItems, cars, overview, profile, recentServices } = await loadWorkspaceData(
    user.username
  );

  try {
    const selectedCar = await getCarDetailsForUser(user.username, Number(carId));

    return (
      <DashboardClient
        attentionItems={attentionItems}
        initialCars={cars}
        initialSelectedCar={selectedCar}
        overview={overview}
        profile={profile}
        recentServices={recentServices}
        username={user.username}
        view="vehicle"
      />
    );
  } catch {
    notFound();
  }
}
