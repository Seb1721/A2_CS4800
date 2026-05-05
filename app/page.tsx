import { redirect } from "next/navigation";

import { DashboardClient } from "@/components/dashboard-client";
import { ensureAppSetup } from "@/lib/app-setup";
import { getCurrentUser, getUserProfileByUsername } from "@/lib/auth";
import { getDashboardOverview, listAttentionVehicles, listCarsForUser, listRecentServicesForUser } from "@/lib/cars";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  await ensureAppSetup();
  const [cars, overview, profile, recentServices, attentionItems] = await Promise.all([
    listCarsForUser(user.username),
    getDashboardOverview(user.username),
    getUserProfileByUsername(user.username),
    listRecentServicesForUser(user.username),
    listAttentionVehicles(user.username)
  ]);

  return (
    <DashboardClient
      attentionItems={attentionItems}
      initialCars={cars}
      overview={overview}
      profile={profile}
      recentServices={recentServices}
      username={user.username}
    />
  );
}
