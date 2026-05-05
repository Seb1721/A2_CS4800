import { ensureAppSetup } from "@/lib/app-setup";
import { getUserProfileByUsername } from "@/lib/auth";
import {
  getDashboardOverview,
  listAttentionVehicles,
  listCarsForUser,
  listRecentServicesForUser
} from "@/lib/cars";

export async function loadWorkspaceData(username: string, recentLimit = 6) {
  await ensureAppSetup();

  const [cars, overview, profile, recentServices, attentionItems] = await Promise.all([
    listCarsForUser(username),
    getDashboardOverview(username),
    getUserProfileByUsername(username),
    listRecentServicesForUser(username, recentLimit),
    listAttentionVehicles(username)
  ]);

  return {
    attentionItems,
    cars,
    overview,
    profile,
    recentServices
  };
}
