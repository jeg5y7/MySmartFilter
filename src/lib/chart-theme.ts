"use client";

import { useEffect, useState } from "react";

/**
 * Chart colors that follow the phone's light/dark scheme. The page chrome
 * flips automatically via the CSS tokens in globals.css, but recharts and
 * inline SVG take literal color values — this hook supplies the matching
 * pair. SSR renders the light palette; the effect corrects on mount and a
 * media-query listener tracks live scheme changes.
 */

export interface ChartTheme {
  grid: string;
  tick: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  muted: string;
  sage: string;
  sageSoft: string; // translucent fill
  clay: string;
  leaf: string;
  red: string;
}

const LIGHT: ChartTheme = {
  grid: "#eeebe4",
  tick: "#8a867c",
  axis: "#eeebe4",
  tooltipBg: "#ffffff",
  tooltipBorder: "#eeebe4",
  tooltipText: "#1c1b18",
  muted: "#8a867c",
  sage: "#3e8a72",
  sageSoft: "rgba(62,138,114,0.12)",
  clay: "#b9652f",
  leaf: "#5f8a54",
  red: "#dc2626",
};

const DARK: ChartTheme = {
  grid: "#2e2c28",
  tick: "#8a867c",
  axis: "#2e2c28",
  tooltipBg: "#201f1c",
  tooltipBorder: "#2e2c28",
  tooltipText: "#f0eee9",
  muted: "#8a867c",
  sage: "#4fa98c",
  sageSoft: "rgba(79,169,140,0.16)",
  clay: "#d28a52",
  leaf: "#83a978",
  red: "#e0695f",
};

export function useChartTheme(): ChartTheme {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return dark ? DARK : LIGHT;
}
