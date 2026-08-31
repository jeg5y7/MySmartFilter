"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AlertActionButtonsProps {
  alertId: string;
}

export function AlertActionButtons({ alertId }: AlertActionButtonsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"dismiss" | "manual_ordered" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: "dismiss" | "manual_ordered") => {
    setLoading(action);
    setError(null);

    try {
      const res = await fetch(`/api/device/alert/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = (await res.json()) as { error?: string };

      if (res.ok) {
        router.refresh();
      } else {
        setError(data.error ?? "Action failed");
      }
    } catch {
      setError("Failed to update alert");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        onClick={() => void handleAction("dismiss")}
        disabled={loading !== null}
        className="rounded-full border border-mist bg-card px-3 py-1.5 text-xs font-medium text-body transition hover:bg-mist/60 disabled:opacity-50 flex items-center gap-1.5"
      >
        {loading === "dismiss" ? (
          <span className="inline-block w-3 h-3 border-2 border-mist border-t-faint rounded-full animate-spin" />
        ) : (
          <span>✕</span>
        )}
        Dismiss
      </button>

      <button
        onClick={() => void handleAction("manual_ordered")}
        disabled={loading !== null}
        className="rounded-full border border-sage/30 bg-sagemist px-3 py-1.5 text-xs font-medium text-sage-deep transition hover:bg-sagemist/70 disabled:opacity-50 flex items-center gap-1.5"
      >
        {loading === "manual_ordered" ? (
          <span className="inline-block w-3 h-3 border-2 border-sage/30 border-t-sage rounded-full animate-spin" />
        ) : (
          <span>✓</span>
        )}
        Mark as Ordered
      </button>

      {error && (
        <span className="text-red-600 text-xs">{error}</span>
      )}
    </div>
  );
}
