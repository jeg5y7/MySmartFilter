import { type MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MySmartFilter",
    short_name: "SmartFilter",
    description:
      "Live HVAC filter monitoring with automatic replacement ordering when a clogged filter costs more than a new one.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#faf8f5",
    theme_color: "#faf8f5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
