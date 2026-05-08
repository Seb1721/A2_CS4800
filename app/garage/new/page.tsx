import { redirect } from "next/navigation";

import { DashboardClient } from "@/components/dashboard-client";
import { getCurrentUser } from "@/lib/auth";
import { loadWorkspaceData } from "@/lib/page-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Add Vehicle | CarKeeper"
};

export default async function NewVehiclePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { attentionItems, cars, overview, profile, recentServices } = await loadWorkspaceData(
    user.username
  );

  return (
    <DashboardClient
      attentionItems={attentionItems}
      initialCars={cars}
      overview={overview}
      profile={profile}
      recentServices={recentServices}
      username={user.username}
      view="new-vehicle"
    />
  );
}
