"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { trackPageView } from "@/lib/analytics";

export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const query = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
    const path = query ? `${pathname}?${query}` : pathname;
    trackPageView(path);
  }, [pathname]);

  return null;
}
