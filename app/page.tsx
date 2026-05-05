import { redirect } from "next/navigation";

import { DashboardClient } from "@/components/dashboard-client";
import { ensureAppSetup } from "@/lib/app-setup";
import { getCurrentUser } from "@/lib/auth";
import { listCarsForUser } from "@/lib/cars";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  await ensureAppSetup();
  const cars = await listCarsForUser(user.username);

  return <DashboardClient initialCars={cars} username={user.username} />;
}
