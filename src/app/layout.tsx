import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { Instrument_Sans, Instrument_Serif } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { Providers } from "./_components/providers";
import { SiteHeader } from "./_components/site-header";
import { PullToRefresh } from "./_components/pull-to-refresh";

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

export const viewport: Viewport = {
  // Browser chrome follows the page scheme (paper / Nordic Night)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#161513" },
  ],
};

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${instrumentSans.variable} ${instrumentSerif.variable}`}>
      <body className="bg-paper text-ink font-sans antialiased">
        <Providers>
          <TRPCReactProvider>
            <PullToRefresh />
            <SiteHeader />
            {children}
          </TRPCReactProvider>
        </Providers>
      </body>
    </html>
  );
}
