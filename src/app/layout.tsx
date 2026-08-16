import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { Providers } from "./_components/providers";
import { SiteHeader } from "./_components/site-header";

export const metadata: Metadata = {
  title: "MySmartFilter — Replace your HVAC filter only once you need to",
  description:
    "We turn every filter into a smart filter. The monitor works with the HVAC filter you already have — any brand, any size — and shows you in real time exactly how dirty it is. When a clogged filter starts costing you more than a new one would, we automatically send you one.",
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
