"use client";

import { api } from "~/trpc/react";

interface DeviceReadingsProps {
  deviceId: string;
  pressureThreshold: number;
}

function getPressureColor(pressure: number, threshold: number): string {
  const pct = pressure / threshold;
  if (pct >= 1.0) return "text-red-400";
  if (pct >= 0.7) return "text-yellow-400";
  return "text-green-400";
}

function getPressureBg(pressure: number, threshold: number): string {
  const pct = pressure / threshold;
  if (pct >= 1.0) return "bg-red-400/20 border-red-400/40";
  if (pct >= 0.7) return "bg-yellow-400/20 border-yellow-400/40";
  return "bg-green-400/20 border-green-400/40";
}

function PressureSparkline({
  readings,
  threshold,
}: {
  readings: { pressure: number }[];
  threshold: number;
}) {
  // Show last 20 in chronological order
  const points = [...readings].reverse().slice(-20);
  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center h-16 text-gray-500 text-sm">
        Not enough data for chart
      </div>
    );
  }

  const W = 400;
  const H = 80;
  const padX = 8;
  const padY = 8;

  const pressures = points.map((p) => p.pressure);
  const minP = Math.min(...pressures);
  const maxP = Math.max(...pressures, threshold * 1.1);
  const range = maxP - minP || 1;

  const toX = (i: number) =>
    padX + (i / (points.length - 1)) * (W - padX * 2);
  const toY = (p: number) =>
    H - padY - ((p - minP) / range) * (H - padY * 2);

  const polyPoints = points
    .map((p, i) => `${toX(i)},${toY(p.pressure)}`)
    .join(" ");

  // Area fill path
  const areaPath =
    `M${toX(0)},${toY(points[0]!.pressure)} ` +
    points.map((p, i) => `L${toX(i)},${toY(p.pressure)}`).join(" ") +
    ` L${toX(points.length - 1)},${H - padY} L${toX(0)},${H - padY} Z`;

  // Threshold line Y
  const thresholdY = toY(threshold);
  const thresholdVisible = thresholdY >= padY && thresholdY <= H - padY;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-16"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path d={areaPath} fill="url(#sparkGrad)" />

      {/* Threshold line */}
      {thresholdVisible && (
        <>
          <line
            x1={padX}
            y1={thresholdY}
            x2={W - padX}
            y2={thresholdY}
            stroke="#f59e0b"
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity="0.7"
          />
          <text
            x={W - padX - 2}
            y={thresholdY - 3}
            fill="#f59e0b"
            fontSize="9"
            textAnchor="end"
            opacity="0.8"
          >
            threshold
          </text>
        </>
      )}

      {/* Sparkline */}
      <polyline
        points={polyPoints}
        fill="none"
        stroke="#60a5fa"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Last point dot */}
      <circle
        cx={toX(points.length - 1)}
        cy={toY(points[points.length - 1]!.pressure)}
        r="3"
        fill="#60a5fa"
      />
    </svg>
  );
}

export function DeviceReadings({
  deviceId,
  pressureThreshold,
}: DeviceReadingsProps) {
  const { data: readings, isLoading, isError } = api.sensor.getByDevice.useQuery(
    { deviceId, limit: 50 },
    { refetchInterval: 30_000 },
  );

  if (isLoading) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Readings</h2>
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
        </div>
      </div>
    );
  }

  if (isError || !readings) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Readings</h2>
        <p className="text-red-400 text-sm">Failed to load sensor readings.</p>
      </div>
    );
  }

  if (readings.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Readings</h2>
        <p className="text-gray-400 text-sm">
          No readings yet. Your device will start sending data once it comes online.
        </p>
      </div>
    );
  }

  const pressures = readings.map((r) => r.pressure);
  const avgPressure = pressures.reduce((a, b) => a + b, 0) / pressures.length;
  const maxPressure = Math.max(...pressures);
  const recentTen = readings.slice(0, 10);

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Recent Readings</h2>
        <span className="text-xs text-gray-500">Auto-refreshes every 30s</span>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
          <p className="text-gray-400 text-xs mb-1">Avg Pressure</p>
          <p className={`text-lg font-bold ${getPressureColor(avgPressure, pressureThreshold)}`}>
            {avgPressure.toFixed(1)}
            <span className="text-xs font-normal text-gray-400 ml-1">Pa</span>
          </p>
        </div>
        <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
          <p className="text-gray-400 text-xs mb-1">Peak Pressure</p>
          <p className={`text-lg font-bold ${getPressureColor(maxPressure, pressureThreshold)}`}>
            {maxPressure.toFixed(1)}
            <span className="text-xs font-normal text-gray-400 ml-1">Pa</span>
          </p>
        </div>
        <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
          <p className="text-gray-400 text-xs mb-1">Total Readings</p>
          <p className="text-lg font-bold text-blue-400">
            {readings.length}
            <span className="text-xs font-normal text-gray-400 ml-1">pts</span>
          </p>
        </div>
      </div>

      {/* Sparkline Chart */}
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <p className="text-xs text-gray-400 mb-2">Pressure trend — last 20 readings</p>
        <PressureSparkline readings={readings} threshold={pressureThreshold} />
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-blue-400 rounded" />
            <span className="text-xs text-gray-400">Pressure (Pa)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-yellow-400 rounded border-dashed border-t border-yellow-400" />
            <span className="text-xs text-gray-400">Threshold ({pressureThreshold} Pa)</span>
          </div>
        </div>
      </div>

      {/* Readings Table */}
      <div>
        <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider">Last 10 Readings</p>
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-4 py-2 text-gray-400 font-medium">Time</th>
                <th className="text-right px-4 py-2 text-gray-400 font-medium">Pressure</th>
                <th className="text-right px-4 py-2 text-gray-400 font-medium">Temp</th>
                <th className="text-center px-4 py-2 text-gray-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentTen.map((reading, i) => {
                const pct = reading.pressure / pressureThreshold;
                const label =
                  pct >= 1.0 ? "High" : pct >= 0.7 ? "Warning" : "Normal";
                return (
                  <tr
                    key={reading.id}
                    className={`border-b border-white/5 transition-colors ${
                      i % 2 === 0 ? "bg-white/2" : ""
                    } hover:bg-white/5`}
                  >
                    <td className="px-4 py-2.5 text-gray-300 tabular-nums">
                      {new Date(reading.timestamp).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono font-semibold ${getPressureColor(reading.pressure, pressureThreshold)}`}>
                      {reading.pressure.toFixed(1)} Pa
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-300">
                      {reading.temperature.toFixed(1)} °C
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${getPressureBg(reading.pressure, pressureThreshold)} ${getPressureColor(reading.pressure, pressureThreshold)}`}
                      >
                        {label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
