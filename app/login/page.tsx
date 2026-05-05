import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { ensureAppSetup } from "@/lib/app-setup";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await ensureAppSetup();
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  return <LoginForm />;
}
