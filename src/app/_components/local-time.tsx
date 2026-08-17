"use client";

import { useEffect, useState } from "react";

/**
 * Renders a timestamp in the VIEWER's timezone. Server components render in
 * the server's timezone (UTC on Vercel), so any user-facing absolute time
 * must go through a client component like this one. Shows a placeholder
 * until mounted to avoid a server/client hydration mismatch.
 */
export function LocalTime({
  iso,
  mode = "datetime",
}: {
  iso: string;
  mode?: "datetime" | "time";
}) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const d = new Date(iso);
    setText(
      mode === "time"
        ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
        : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    );
  }, [iso, mode]);

  return <span suppressHydrationWarning>{text ?? "—"}</span>;
}
