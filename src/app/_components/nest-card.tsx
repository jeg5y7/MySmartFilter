"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface NestStatus {
  configured: boolean;
  linked: boolean;
  link?: {
    lastHumidityPct: number | null;
    lastTempC: number | null;
    lastHvacStatus: string | null;
    lastSyncAt: string | null;
    createdAt: string;
  } | null;
}

const cToF = (c: number) => (c * 9) / 5 + 32;

/**
 * Google Nest (sandbox) card on the Integrations page. Connect starts the
 * OAuth flow at /api/nest/connect; once linked, humidity samples flow in
 * automatically alongside the monitor's readings.
 */
export function NestCard() {
  const searchParams = useSearchParams();
  const flash = searchParams.get("nest");

  const [status, setStatus] = useState<NestStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetch("/api/nest")
      .then((r) => (r.ok ? (r.json() as Promise<NestStatus>) : null))
      .then((s) => setStatus(s))
      .catch(() => setStatus(null));
  };
  useEffect(load, []);

  const disconnect = async () => {
    if (!confirm("Disconnect your Nest thermostat?")) return;
    setBusy(true);
    try {
      await fetch("/api/nest", { method: "DELETE" });
      load();
    } finally {
      setBusy(false);
    }
  };

  // Hidden entirely until the founder configures the Google side (env vars).
  if (!status || !status.configured) return null;

  const link = status.link;
  const syncAgo = link?.lastSyncAt
    ? Math.round((Date.now() - new Date(link.lastSyncAt).getTime()) / 60000)
    : null;

  return (
    <div className="rounded-[24px] border border-mist bg-card p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-ink">Google Nest</h2>
        <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold text-body">
          Pilot
        </span>
      </div>
      <p className="text-sm text-body mb-4">
        Pull indoor humidity from your Nest thermostat so we can correlate it
        with your filter and system data. Read-only — we never change your
        thermostat settings.
      </p>

      {flash === "connected" && (
        <div className="mb-4 rounded-2xl border border-sage/30 bg-sagemist p-3 text-sm text-sage-deep">
          Nest connected — humidity tracking has started.
        </div>
      )}
      {flash === "no-thermostat" && (
        <div className="mb-4 rounded-2xl border border-clay/30 bg-clay/10 p-3 text-sm text-clay">
          No thermostat with a humidity sensor was found on that Google account.
        </div>
      )}
      {flash === "error" && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Connection didn&apos;t complete — try again.
        </div>
      )}

      {status.linked && link ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                Indoor humidity
              </p>
              <p className="text-lg font-bold text-ink">
                {link.lastHumidityPct !== null ? `${Math.round(link.lastHumidityPct)}%` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                Indoor temp
              </p>
              <p className="text-lg font-bold text-ink">
                {link.lastTempC !== null ? `${cToF(link.lastTempC).toFixed(1)} °F` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                System
              </p>
              <p
                className={`text-lg font-bold ${
                  link.lastHvacStatus === "COOLING" || link.lastHvacStatus === "HEATING"
                    ? "text-sage"
                    : "text-faint"
                }`}
              >
                {link.lastHvacStatus ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                Updated
              </p>
              <p className="text-lg font-bold text-ink">
                {syncAgo === null ? "—" : syncAgo < 1 ? "just now" : `${syncAgo}m ago`}
              </p>
            </div>
          </div>
          <p className="text-xs text-faint">
            Samples update about every 5 minutes while your monitor is reporting.
          </p>
          <button
            onClick={disconnect}
            disabled={busy}
            className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            {busy ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      ) : (
        <a
          href="/api/nest/connect"
          className="inline-block rounded-full bg-sage px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sage-deep"
        >
          Connect Google Nest
        </a>
      )}
    </div>
  );
}
