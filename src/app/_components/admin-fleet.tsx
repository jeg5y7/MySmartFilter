"use client";

import { useState } from "react";
import { cToF } from "~/lib/units";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export interface FleetDevice {
  id: string;
  deviceId: string;
  name: string | null;
  ownerEmail: string | null;
  firmware: string | null;
  online: boolean;
  lastSeen: string;
  pressure: number | null;
  temperature: number | null;
  batteryPct: number | null;
  blowerType: string;
  filterStatus: "ok" | "replace_soon" | "replace_now";
  filterLifePct: number | null;
  extraCostCents: number;
}

export interface FleetTrendPoint {
  day: string; // YYYY-MM-DD
  readings: number;
  devices: number;
  avgPressure: number | null;
}

const STATUS_BADGE: Record<FleetDevice["filterStatus"], { label: string; cls: string }> = {
  ok: { label: "OK", cls: "bg-sagemist text-sage-deep" },
  replace_soon: { label: "Soon", cls: "bg-clay/10 text-clay" },
  replace_now: { label: "Replace", cls: "bg-red-50 text-red-600" },
};

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function AdminFleet({
  devices,
  trend,
}: {
  devices: FleetDevice[];
  trend: FleetTrendPoint[];
}) {
  const [filter, setFilter] = useState<"all" | "online" | "offline" | "attention">("all");

  const shown = devices.filter((d) => {
    if (filter === "online") return d.online;
    if (filter === "offline") return !d.online;
    if (filter === "attention")
      return (
        !d.online ||
        d.filterStatus !== "ok" ||
        (d.batteryPct !== null && d.batteryPct <= 20)
      );
    return true;
  });

  const tick = { fill: "#8a867c", fontSize: 11 };
  const tooltipStyle = {
    backgroundColor: "#ffffff",
    border: "1px solid #eeebe4",
    borderRadius: 12,
    color: "#1c1b18",
    fontSize: 12,
  };

  return (
    <>
      {/* ── Fleet trends ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="rounded-[24px] border border-mist bg-card p-5">
          <h2 className="text-sm font-semibold text-ink mb-1">
            Fleet average pressure drop
          </h2>
          <p className="text-xs text-faint mb-4">
            Daily average ΔP (Pa) across all reporting monitors — a rising fleet
            average means filters are clogging.
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eeebe4" />
                <XAxis dataKey="day" tick={tick} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis tick={tick} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#8a867c" }} />
                <Line
                  type="monotone"
                  dataKey="avgPressure"
                  name="Avg ΔP (Pa)"
                  stroke="#3e8a72"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[24px] border border-mist bg-card p-5">
          <h2 className="text-sm font-semibold text-ink mb-1">Fleet activity</h2>
          <p className="text-xs text-faint mb-4">
            Readings received per day, and how many distinct monitors reported.
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eeebe4" />
                <XAxis dataKey="day" tick={tick} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis tick={tick} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#8a867c" }} />
                <Area
                  type="monotone"
                  dataKey="readings"
                  name="Readings"
                  stroke="#3e8a72"
                  fill="rgba(62,138,114,0.12)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="devices"
                  name="Monitors reporting"
                  stroke="#b9652f"
                  fill="rgba(185,101,47,0.10)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── All devices ──────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-[24px] border border-mist bg-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 pb-3">
          <h2 className="text-lg font-semibold text-ink">
            All Devices{" "}
            <span className="text-sm font-normal text-faint">
              ({shown.length} of {devices.length})
            </span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "All"],
                ["online", "Online"],
                ["offline", "Offline"],
                ["attention", "Needs attention"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  filter === key
                    ? "bg-ink text-paper"
                    : "border border-mist bg-card text-body hover:bg-mist/60"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Horizontal scroll keeps the table usable on phones */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-left text-xs font-semibold text-faint uppercase tracking-wide border-b border-mist">
                <th className="px-5 py-3 font-medium">Device</th>
                <th className="px-3 py-3 font-medium">Owner</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Firmware</th>
                <th className="px-3 py-3 font-medium">Last seen</th>
                <th className="px-3 py-3 font-medium">ΔP</th>
                <th className="px-3 py-3 font-medium">Temp</th>
                <th className="px-3 py-3 font-medium">Battery</th>
                <th className="px-3 py-3 font-medium">Filter</th>
                <th className="px-5 py-3 font-medium">Wasted cost</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => {
                const badge = STATUS_BADGE[d.filterStatus];
                return (
                  <tr key={d.id} className="border-t border-mist hover:bg-paper">
                    <td className="px-5 py-3">
                      <div className="text-ink font-medium">
                        {d.name ?? d.deviceId}
                      </div>
                      <span className="inline-block rounded bg-mist px-1.5 py-0.5 text-xs text-faint font-mono">{d.deviceId}</span>
                    </td>
                    <td className="px-3 py-3 text-body">{d.ownerEmail ?? "—"}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          d.online
                            ? "bg-sagemist text-sage-deep"
                            : "bg-mist text-body"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            d.online ? "bg-sage" : "bg-whisper"
                          }`}
                        />
                        {d.online ? "online" : "offline"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-block rounded bg-mist px-1.5 py-0.5 text-xs font-mono text-body">
                        {d.firmware ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-faint">{timeAgo(d.lastSeen)}</td>
                    <td className="px-3 py-3 text-body">
                      {d.pressure !== null ? `${d.pressure.toFixed(1)} Pa` : "—"}
                    </td>
                    <td className="px-3 py-3 text-body">
                      {d.temperature !== null ? `${cToF(d.temperature).toFixed(1)} °F` : "—"}
                    </td>
                    <td className="px-3 py-3">
                      {d.batteryPct !== null ? (
                        <span
                          className={
                            d.batteryPct <= 20 ? "text-clay" : "text-body"
                          }
                        >
                          {Math.round(d.batteryPct)}%
                        </span>
                      ) : (
                        <span className="text-faint">wall</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>
                        {badge.label}
                        {d.filterLifePct !== null
                          ? ` · ${Math.round(d.filterLifePct)}%`
                          : ""}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-body">
                      {d.blowerType === "ecm"
                        ? `$${(d.extraCostCents / 100).toFixed(2)}`
                        : "PSC"}
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-10 text-center text-faint">
                    No devices match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
