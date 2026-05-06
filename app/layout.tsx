import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

import { AnalyticsTracker } from "@/components/analytics-tracker";

export const metadata: Metadata = {
  title: "CarKeeper",
  description: "Secure vehicle tracking with Next.js and MongoDB.",
  icons: {
    icon: "/icon.svg"
  }
};

const googleAnalyticsId = process.env.NEXT_PUBLIC_GA_ID;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        {googleAnalyticsId ? (
          <>
            <AnalyticsTracker />
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${googleAnalyticsId}', { send_page_view: false });
              `}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
