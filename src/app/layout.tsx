import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { Providers } from "./_components/providers";
import { SiteHeader } from "./_components/site-header";

export const metadata: Metadata = {
  title: "MySmartFilter — Replace your HVAC filter only once you need to",
  description:
    "The smart monitor that knows exactly how dirty your HVAC filter is. When a clogged filter starts costing you more to run your HVAC than a new filter would, we automatically send you one.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MySmartFilter",
  },
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body>
        <Providers>
          <TRPCReactProvider>
            <SiteHeader />
            {children}
          </TRPCReactProvider>
        </Providers>
      </body>
    </html>
  );
}
