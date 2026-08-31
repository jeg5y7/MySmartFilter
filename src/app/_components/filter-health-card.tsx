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
    <div className="rounded-[24px] border border-mist bg-card p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-ink">Filter Health</h2>
        {installedLabel && (
          <span className="text-xs text-faint">Installed {installedLabel}</span>
        )}
      </div>

      {blowerType === "ecm" ? (
        <>
          <p className="text-sm text-body mb-5">
            Extra electricity spent pushing air through this filter vs. when it
            was clean. When it reaches the price of a new filter, replacing
            saves you money.
          </p>

          <div className="flex items-end justify-between mb-2">
            <span className="font-display text-3xl text-ink">
              {fmtUsd(extraEnergyCostCents)}
            </span>
            {filterPriceCents !== null && (
              <span className="text-sm text-faint">
                of {fmtUsd(filterPriceCents)}
                {filterName ? ` — ${filterName}` : ""}
              </span>
            )}
          </div>

          {pct !== null ? (
            <div className="w-full h-3 bg-mist rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all ${
                  pct >= 100
                    ? "bg-red-500"
                    : pct >= 75
                      ? "bg-clay"
                      : "bg-sage"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          ) : (
            <p className="text-xs text-clay mb-2">
              Select a preferred filter in Filter Settings to set the replacement
              price target.
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-faint">
            <span>
              {baselineDeltaP !== null
                ? `Clean-filter baseline: ${baselineDeltaP.toFixed(1)} Pa`
                : "Baseline pending — captured on the next blower cycle"}
            </span>
            <span>{Math.round(runtimeHours)} h blower runtime</span>
          </div>
        </>
      ) : (
        <p className="text-sm text-body mb-3">
          This system has a fixed-speed (PSC) blower — a clogged filter reduces
          airflow rather than raising your electric bill, so replacement alerts
          are based on the pressure threshold instead of energy cost.{" "}
          <span className="text-faint">
            {Math.round(runtimeHours)} h blower runtime on this filter.
          </span>
        </p>
      )}

      <div className="mt-5 pt-4 border-t border-mist">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="text-sm text-sage hover:text-sage-deep transition-colors"
          >
            ✓ I just replaced this filter
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-body">
              Reset tracking for a fresh filter?
            </span>
            <button
              onClick={handleReplaced}
              disabled={resetting}
              className="rounded-full bg-sage px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-sage-deep disabled:opacity-50"
            >
              {resetting ? "Resetting…" : "Yes, reset"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={resetting}
              className="rounded-full border border-mist bg-card px-3 py-1.5 text-sm text-ink transition hover:bg-mist/60"
            >
              Cancel
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
