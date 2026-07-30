"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface FilterHealthCardProps {
  deviceId: string; // cuid Device.id
  blowerType: string;
  extraEnergyCostCents: number;
  runtimeHours: number;
  baselineDeltaP: number | null;
  filterInstalledAt: string | null; // ISO string (serialized from server)
  filterPriceCents: number | null; // preferred filter price, null if no preference
  filterName: string | null;
}

const fmtUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function FilterHealthCard({
  deviceId,
  blowerType,
  extraEnergyCostCents,
  runtimeHours,
  baselineDeltaP,
  filterInstalledAt,
  filterPriceCents,
  filterName,
}: FilterHealthCardProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");

  const handleReplaced = async () => {
    setResetting(true);
    setError("");
    try {
      const res = await fetch(`/api/device/${deviceId}/filter-replaced`, {
        method: "POST",
      });
      if (res.ok) {
        setConfirming(false);
        router.refresh();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to reset");
      }
    } catch {
      setError("Failed to reset");
    } finally {
      setResetting(false);
    }
  };

  const pct =
    filterPriceCents && filterPriceCents > 0
      ? Math.min(100, (extraEnergyCostCents / filterPriceCents) * 100)
      : null;

  const installedLabel = filterInstalledAt
    ? new Date(filterInstalledAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-white">Filter Health</h2>
        {installedLabel && (
          <span className="text-xs text-gray-500">Installed {installedLabel}</span>
        )}
      </div>

      {blowerType === "ecm" ? (
        <>
          <p className="text-sm text-gray-400 mb-5">
            Extra electricity spent pushing air through this filter vs. when it
            was clean. When it reaches the price of a new filter, replacing
            saves you money.
          </p>

          <div className="flex items-end justify-between mb-2">
            <span className="text-3xl font-bold text-white">
              {fmtUsd(extraEnergyCostCents)}
            </span>
            {filterPriceCents !== null && (
              <span className="text-sm text-gray-400">
                of {fmtUsd(filterPriceCents)}
                {filterName ? ` — ${filterName}` : ""}
              </span>
            )}
          </div>

          {pct !== null ? (
            <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all ${
                  pct >= 100
                    ? "bg-red-500"
                    : pct >= 75
                      ? "bg-amber-400"
                      : "bg-emerald-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          ) : (
            <p className="text-xs text-amber-300/80 mb-2">
              Select a preferred filter in Filter Settings to set the replacement
              price target.
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {baselineDeltaP !== null
                ? `Clean-filter baseline: ${baselineDeltaP.toFixed(1)} Pa`
                : "Baseline pending — captured on the next blower cycle"}
            </span>
            <span>{Math.round(runtimeHours)} h blower runtime</span>
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-400 mb-3">
          This system has a fixed-speed (PSC) blower — a clogged filter reduces
          airflow rather than raising your electric bill, so replacement alerts
          are based on the pressure threshold instead of energy cost.{" "}
          <span className="text-gray-500">
            {Math.round(runtimeHours)} h blower runtime on this filter.
          </span>
        </p>
      )}

      <div className="mt-5 pt-4 border-t border-white/10">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            ✓ I just replaced this filter
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-300">
              Reset tracking for a fresh filter?
            </span>
            <button
              onClick={handleReplaced}
              disabled={resetting}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all"
            >
              {resetting ? "Resetting…" : "Yes, reset"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={resetting}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-gray-300 text-sm rounded-lg transition-all"
            >
              Cancel
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
