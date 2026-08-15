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
  ok: { label: "OK", cls: "bg-emerald-500/15 text-emerald-300" },
  replace_soon: { label: "Soon", cls: "bg-amber-500/15 text-amber-300" },
  replace_now: { label: "Replace", cls: "bg-red-500/15 text-red-300" },
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

  const tick = { fill: "#64748b", fontSize: 11 };
  const tooltipStyle = {
    backgroundColor: "#1e293b",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 8,
    color: "#e2e8f0",
    fontSize: 12,
  };

  return (
    <>
      {/* ── Fleet trends ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10">
          <h2 className="text-sm font-semibold text-white mb-1">
            Fleet average pressure drop
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Daily average ΔP (Pa) across all reporting monitors — a rising fleet
            average means filters are clogging.
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="day" tick={tick} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis tick={tick} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="avgPressure"
                  name="Avg ΔP (Pa)"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10">
          <h2 className="text-sm font-semibold text-white mb-1">Fleet activity</h2>
          <p className="text-xs text-gray-500 mb-4">
            Readings received per day, and how many distinct monitors reported.
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="day" tick={tick} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis tick={tick} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="readings"
                  name="Readings"
                  stroke="#34d399"
                  fill="rgba(52,211,153,0.15)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="devices"
                  name="Monitors reporting"
                  stroke="#a78bfa"
                  fill="rgba(167,139,250,0.12)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── All devices ──────────────────────────────────────────────────── */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 pb-3">
          <h2 className="text-lg font-semibold text-white">
            All Devices{" "}
            <span className="text-sm font-normal text-gray-500">
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
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === key
                    ? "bg-blue-600 text-white"
                    : "bg-white/10 text-gray-300 hover:bg-white/15"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Horizontal scroll keeps the table usable on phones */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-white/10">
                <th className="px-5 py-3 font-medium">Device</th>
                <th className="px-3 py-3 font-medium">Owner</th>
                <th className="px-3 py-3 font-medium">Status</th>
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
                  <tr key={d.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-5 py-3">
                      <div className="text-white font-medium">
                        {d.name ?? d.deviceId}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">{d.deviceId}</div>
                    </td>
                    <td className="px-3 py-3 text-gray-300">{d.ownerEmail ?? "—"}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${
                          d.online
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            d.online ? "bg-emerald-400" : "bg-gray-500"
                          }`}
                        />
                        {d.online ? "online" : "offline"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-400">{timeAgo(d.lastSeen)}</td>
                    <td className="px-3 py-3 text-gray-300">
                      {d.pressure !== null ? `${d.pressure.toFixed(1)} Pa` : "—"}
                    </td>
                    <td className="px-3 py-3 text-gray-300">
                      {d.temperature !== null ? `${cToF(d.temperature).toFixed(1)} °F` : "—"}
                    </td>
                    <td className="px-3 py-3">
                      {d.batteryPct !== null ? (
                        <span
                          className={
                            d.batteryPct <= 20 ? "text-amber-300" : "text-gray-300"
                          }
                        >
                          {Math.round(d.batteryPct)}%
                        </span>
                      ) : (
                        <span className="text-gray-500">wall</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${badge.cls}`}>
                        {badge.label}
                        {d.filterLifePct !== null
                          ? ` · ${Math.round(d.filterLifePct)}%`
                          : ""}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-300">
                      {d.blowerType === "ecm"
                        ? `$${(d.extraCostCents / 100).toFixed(2)}`
                        : "PSC"}
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-gray-500">
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
