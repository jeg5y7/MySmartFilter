"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Release {
  id: string;
  version: string;
  binaryUrl: string;
  releaseNotes: string | null;
  isActive: boolean;
  rolloutPct: number;
  createdAt: string;
}

interface FleetVersion {
  version: string;
  count: number;
}

export function FirmwareManager({
  initialReleases,
  fleetVersions,
}: {
  initialReleases: Release[];
  fleetVersions: FleetVersion[];
}) {
  const router = useRouter();
  const [releases, setReleases] = useState(initialReleases);
  const [version, setVersion] = useState("");
  const [binaryUrl, setBinaryUrl] = useState("https://www.mysmartfilter.com/firmware/");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/firmware", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: version.trim(),
          binaryUrl: binaryUrl.trim(),
          releaseNotes: notes.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { release?: Release; error?: string };
      if (!res.ok || !data.release) {
        setError(data.error ?? "Failed to create release");
        return;
      }
      setReleases([data.release, ...releases]);
      setVersion("");
      setNotes("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, body: { isActive?: boolean; rolloutPct?: number }) => {
    const res = await fetch("/api/admin/firmware", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    const data = (await res.json()) as { release?: Release };
    if (data.release) {
      setReleases(releases.map((r) => (r.id === id ? data.release! : r)));
    }
  };

  return (
    <div className="space-y-6">
      {/* Fleet version spread */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10">
        <h2 className="text-sm font-semibold text-white mb-3">Fleet versions</h2>
        <div className="flex flex-wrap gap-2">
          {fleetVersions.length === 0 ? (
            <p className="text-sm text-gray-500">No devices yet.</p>
          ) : (
            fleetVersions.map((v) => (
              <span
                key={v.version}
                className="px-3 py-1 rounded-full bg-white/10 text-gray-300 text-xs font-mono"
              >
                {v.version} × {v.count}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Publish */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10">
        <h2 className="text-sm font-semibold text-white mb-1">Publish a release</h2>
        <p className="text-xs text-gray-500 mb-4">
          Put the merged .bin in the repo under <code className="text-gray-400">public/firmware/</code>{" "}
          (deploys to mysmartfilter.com/firmware/…), then register it here.
          Starts as a 1% canary.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="Version, e.g. 1.4.0"
            className="px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <input
            value={binaryUrl}
            onChange={(e) => setBinaryUrl(e.target.value)}
            placeholder="https://www.mysmartfilter.com/firmware/….bin"
            className="px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Release notes (optional)"
          rows={2}
          className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-3"
        />
        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
        <button
          onClick={create}
          disabled={busy || !version.trim() || !binaryUrl.trim()}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/40 text-white rounded-lg font-semibold text-sm transition-all"
        >
          {busy ? "Publishing…" : "Publish (1% canary)"}
        </button>
      </div>

      {/* Releases */}
      <div className="space-y-3">
        {releases.map((r) => (
          <div
            key={r.id}
            className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-white font-semibold">{r.version}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    r.isActive
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-gray-500/20 text-gray-400"
                  }`}
                >
                  {r.isActive ? "active" : "inactive"}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
              <button
                onClick={() => patch(r.id, { isActive: !r.isActive })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  r.isActive
                    ? "bg-red-600/80 hover:bg-red-600 text-white"
                    : "bg-white/10 hover:bg-white/20 text-gray-300"
                }`}
              >
                {r.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
            {r.releaseNotes && (
              <p className="text-sm text-gray-400 mb-3">{r.releaseNotes}</p>
            )}
            <p className="text-xs text-gray-500 font-mono truncate mb-3">{r.binaryUrl}</p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-28">
                Rollout: {r.rolloutPct}%
              </span>
              {[1, 10, 50, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => patch(r.id, { rolloutPct: pct })}
                  className={`px-3 py-1 rounded-lg text-xs transition-all ${
                    r.rolloutPct === pct
                      ? "bg-blue-600 text-white"
                      : "bg-white/10 text-gray-300 hover:bg-white/20"
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        ))}
        {releases.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-6">
            No releases yet — devices stay on their flashed firmware.
          </p>
        )}
      </div>
    </div>
  );
}
