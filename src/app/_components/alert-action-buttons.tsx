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
        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-gray-300 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5"
      >
        {loading === "dismiss" ? (
          <span className="inline-block w-3 h-3 border-2 border-gray-400/30 border-t-gray-300 rounded-full animate-spin" />
        ) : (
          <span>✕</span>
        )}
        Dismiss
      </button>

      <button
        onClick={() => void handleAction("manual_ordered")}
        disabled={loading !== null}
        className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 disabled:opacity-50 text-green-300 text-xs font-medium rounded-lg border border-green-500/30 transition-all flex items-center gap-1.5"
      >
        {loading === "manual_ordered" ? (
          <span className="inline-block w-3 h-3 border-2 border-green-400/30 border-t-green-300 rounded-full animate-spin" />
        ) : (
          <span>✓</span>
        )}
        Mark as Ordered
      </button>

      {error && (
        <span className="text-red-400 text-xs">{error}</span>
      )}
    </div>
  );
}
