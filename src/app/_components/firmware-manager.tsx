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
      <div className="rounded-[24px] border border-mist bg-card p-5">
        <h2 className="text-sm font-semibold text-ink mb-3">Fleet versions</h2>
        <div className="flex flex-wrap gap-2">
          {fleetVersions.length === 0 ? (
            <p className="text-sm text-faint">No devices yet.</p>
          ) : (
            fleetVersions.map((v) => (
              <span
                key={v.version}
                className="px-3 py-1 rounded-full bg-mist text-body text-xs font-mono"
              >
                {v.version} × {v.count}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Publish */}
      <div className="rounded-[24px] border border-mist bg-card p-5">
        <h2 className="text-sm font-semibold text-ink mb-1">Publish a release</h2>
        <p className="text-xs text-faint mb-4">
          Put the merged .bin in the repo under <code className="text-body">public/firmware/</code>{" "}
          (deploys to mysmartfilter.com/firmware/…), then register it here.
          Starts as a 1% canary.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="Version, e.g. 1.4.0"
            className="rounded-full border border-mist bg-card px-4 py-2.5 text-sm text-ink placeholder:text-whisper font-mono focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20"
          />
          <input
            value={binaryUrl}
            onChange={(e) => setBinaryUrl(e.target.value)}
            placeholder="https://www.mysmartfilter.com/firmware/….bin"
            className="rounded-full border border-mist bg-card px-4 py-2.5 text-sm text-ink placeholder:text-whisper font-mono focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20"
          />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Release notes (optional)"
          rows={2}
          className="w-full rounded-2xl border border-mist bg-card px-4 py-2.5 text-sm text-ink placeholder:text-whisper focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20 mb-3"
        />
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button
          onClick={create}
          disabled={busy || !version.trim() || !binaryUrl.trim()}
          className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-paper transition hover:bg-ink/85 disabled:opacity-50"
        >
          {busy ? "Publishing…" : "Publish (1% canary)"}
        </button>
      </div>

      {/* Releases */}
      <div className="space-y-3">
        {releases.map((r) => (
          <div
            key={r.id}
            className="rounded-[24px] border border-mist bg-card p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-mist px-2 py-0.5 font-mono text-xs font-semibold text-ink">{r.version}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    r.isActive
                      ? "bg-sagemist text-sage-deep"
                      : "bg-mist text-body"
                  }`}
                >
                  {r.isActive ? "active" : "inactive"}
                </span>
                <span className="text-xs text-faint">
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
              <button
                onClick={() => patch(r.id, { isActive: !r.isActive })}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  r.isActive
                    ? "border border-red-200 text-red-600 hover:bg-red-50"
                    : "border border-mist bg-card text-ink hover:bg-mist/60"
                }`}
              >
                {r.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
            {r.releaseNotes && (
              <p className="text-sm text-body mb-3">{r.releaseNotes}</p>
            )}
            <p className="text-xs text-faint font-mono truncate mb-3">{r.binaryUrl}</p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-faint w-28">
                Rollout: {r.rolloutPct}%
              </span>
              {[1, 10, 50, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => patch(r.id, { rolloutPct: pct })}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    r.rolloutPct === pct
                      ? "bg-clay text-white"
                      : "border border-mist bg-card text-body hover:bg-mist/60"
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        ))}
        {releases.length === 0 && (
          <p className="text-sm text-faint text-center py-6">
            No releases yet — devices stay on their flashed firmware.
          </p>
        )}
      </div>
    </div>
  );
}
