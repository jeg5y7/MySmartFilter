"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pull-to-refresh for the installed (home-screen) app. iOS gives standalone
 * PWAs no native pull-to-refresh, so we recreate it: pull down from the top
 * of the page, a spinner follows your finger, release past the threshold to
 * reload. Inert in a normal browser tab, where the native gesture exists.
 */
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari's non-standard flag for home-screen apps
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!standalone) return;

    const THRESHOLD = 70;

    const onStart = (e: TouchEvent) => {
      if (window.scrollY <= 0 && e.touches[0]) {
        startY.current = e.touches[0].clientY;
      } else {
        startY.current = null;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current === null || !e.touches[0]) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && window.scrollY <= 0) {
        setPull(Math.min(dy * 0.45, 100));
      } else {
        setPull(0);
      }
    };
    const onEnd = () => {
      setPull((current) => {
        if (current >= THRESHOLD * 0.45) {
          setRefreshing(true);
          window.location.reload();
          return current;
        }
        return 0;
      });
      startY.current = null;
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);

  if (pull <= 4 && !refreshing) return null;

  return (
    <div
      className="fixed left-1/2 z-50 -translate-x-1/2 transition-transform"
      style={{ top: -44, transform: `translate(-50%, ${pull}px)` }}
    >
      <div className="h-10 w-10 rounded-full bg-card border border-mist shadow-xl flex items-center justify-center">
        <div
          className={`h-5 w-5 rounded-full border-2 border-sage border-t-transparent ${
            refreshing || pull >= 31 ? "animate-spin" : ""
          }`}
          style={
            refreshing ? undefined : { transform: `rotate(${pull * 4}deg)` }
          }
        />
      </div>
    </div>
  );
}
