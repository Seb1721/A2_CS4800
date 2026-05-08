"use client";

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (
      command: "config" | "event",
      targetIdOrEventName: string,
      params?: Record<string, unknown>
    ) => void;
  }
}

function getAnalyticsId() {
  return process.env.NEXT_PUBLIC_GA_ID;
}

function canTrack() {
  return typeof window !== "undefined" && typeof window.gtag === "function" && Boolean(getAnalyticsId());
}

export function trackPageView(path: string) {
  const analyticsId = getAnalyticsId();

  if (!analyticsId || !canTrack()) {
    return;
  }

  window.gtag?.("config", analyticsId, {
    page_path: path,
    page_title: document.title
  });
}

export function trackEvent(eventName: string, params: AnalyticsParams = {}) {
  if (!canTrack()) {
    return;
  }

  window.gtag?.("event", eventName, params);
}
