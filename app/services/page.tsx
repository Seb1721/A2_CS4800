import { redirect } from "next/navigation";

import { DashboardClient } from "@/components/dashboard-client";
import { getCurrentUser } from "@/lib/auth";
import { listFleetInsightRecords } from "@/lib/cars";
import { loadWorkspaceData } from "@/lib/page-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Analytics | CarKeeper"
};

export default async function ServicesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { attentionItems, cars, overview, profile, recentServices } = await loadWorkspaceData(
    user.username,
    250
  );
  const fleetInsightRecords = await listFleetInsightRecords(user.username);

  return (
    <DashboardClient
      attentionItems={attentionItems}
      fleetInsightRecords={fleetInsightRecords}
      initialCars={cars}
      overview={overview}
      profile={profile}
      recentServices={recentServices.slice(0, 6)}
      serviceFeed={recentServices}
      username={user.username}
      view="services"
    />
  );
}
