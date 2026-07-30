"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { api } from "~/trpc/react";

interface DeviceReadingsProps {
  deviceId: string;
  pressureThreshold: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Time Range Config ───────────────────────────────────────────────────────

type RangeKey = "1h" | "6h" | "24h" | "7d" | "30d";

interface RangeConfig {
  label: string;
  ms: number;
  /** bucket size for downsampling (ms). null = no downsampling */
  bucketMs: number | null;
  tickFormat: (ts: number) => string;
}

const RANGES: Record<RangeKey, RangeConfig> = {
  "1h": {
    label: "1h",
    ms: 60 * 60 * 1000,
    bucketMs: null,
    tickFormat: (ts) =>
      new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  },
  "6h": {
    label: "6h",
    ms: 6 * 60 * 60 * 1000,
    bucketMs: null,
    tickFormat: (ts) =>
      new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  },
  "24h": {
    label: "24h",
    ms: 24 * 60 * 60 * 1000,
    bucketMs: null,
    tickFormat: (ts) =>
      new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  },
  "7d": {
    label: "7d",
    ms: 7 * 24 * 60 * 60 * 1000,
    bucketMs: 60 * 60 * 1000, // 1-hour buckets → ~168 pts
    tickFormat: (ts) =>
      new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  },
  "30d": {
    label: "30d",
    ms: 30 * 24 * 60 * 60 * 1000,
    bucketMs: 6 * 60 * 60 * 1000, // 6-hour buckets → ~120 pts
    tickFormat: (ts) =>
      new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  },
};

const RANGE_ORDER: RangeKey[] = ["1h", "6h", "24h", "7d", "30d"];

// ─── Downsampling ────────────────────────────────────────────────────────────

interface RawReading {
  id: string;
  timestamp: Date;
  pressure: number;
  temperature: number;
}

interface ChartPoint {
  ts: number;
  pressure: number;
  temperature: number;
}

function downsample(readings: RawReading[], bucketMs: number): ChartPoint[] {
  const buckets = new Map<number, { pressure: number[]; temperature: number[] }>();

  for (const r of readings) {
    const key = Math.floor(r.timestamp.getTime() / bucketMs) * bucketMs;
    if (!buckets.has(key)) buckets.set(key, { pressure: [], temperature: [] });
    const b = buckets.get(key)!;
    b.pressure.push(r.pressure);
    b.temperature.push(r.temperature);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([key, b]) => ({
      ts: key,
      pressure: b.pressure.reduce((a, c) => a + c, 0) / b.pressure.length,
      temperature: b.temperature.reduce((a, c) => a + c, 0) / b.temperature.length,
    }));
}

function toChartPoints(readings: RawReading[], cfg: RangeConfig): ChartPoint[] {
  const sorted = [...readings].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  if (cfg.bucketMs) return downsample(sorted, cfg.bucketMs);
  return sorted.map((r) => ({
    ts: r.timestamp.getTime(),
    pressure: r.pressure,
    temperature: r.temperature,
  }));
}

// ─── Sparkline (kept for backward compat) ───────────────────────────────────

function PressureSparkline({
  readings,
  threshold,
}: {
  readings: { pressure: number }[];
  threshold: number;
}) {
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

  const areaPath =
    `M${toX(0)},${toY(points[0]!.pressure)} ` +
    points.map((p, i) => `L${toX(i)},${toY(p.pressure)}`).join(" ") +
    ` L${toX(points.length - 1)},${H - padY} L${toX(0)},${H - padY} Z`;

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
      <path d={areaPath} fill="url(#sparkGrad)" />
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
      <polyline
        points={polyPoints}
        fill="none"
        stroke="#60a5fa"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={toX(points.length - 1)}
        cy={toY(points[points.length - 1]!.pressure)}
        r="3"
        fill="#60a5fa"
      />
    </svg>
  );
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
  unit?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: number;
  rangeKey: RangeKey;
}

function CustomTooltip({ active, payload, label, rangeKey }: CustomTooltipProps) {
  if (!active || !payload?.length || label === undefined) return null;

  const dateStr =
    rangeKey === "7d" || rangeKey === "30d"
      ? new Date(label).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : new Date(label).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

  return (
    <div className="bg-slate-900/95 border border-white/20 rounded-lg px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
      <p className="text-gray-400 mb-1">{dateStr}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-mono">
          {p.name}: <span className="font-bold">{p.value.toFixed(1)}</span>{" "}
          {p.unit}
        </p>
      ))}
    </div>
  );
}

// ─── Chart Panel ─────────────────────────────────────────────────────────────

interface ChartPanelProps {
  title: string;
  unit: string;
  dataKey: "pressure" | "temperature";
  color: string;
  data: ChartPoint[];
  rangeKey: RangeKey;
  referenceLine?: number;
  referenceColor?: string;
  referenceLabel?: string;
  isLoading: boolean;
}

function ChartPanel({
  title,
  unit,
  dataKey,
  color,
  data,
  rangeKey,
  referenceLine,
  referenceColor,
  referenceLabel,
  isLoading,
}: ChartPanelProps) {
  const cfg = RANGES[rangeKey];

  return (
    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-300">{title}</p>
        <span className="text-xs text-gray-500">{unit}</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400" />
        </div>
      ) : data.length < 2 ? (
        <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
          No data for this time range
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="ts"
              type="number"
              domain={["dataMin", "dataMax"]}
              scale="time"
              tickFormatter={cfg.tickFormat}
              tick={{ fill: "#6b7280", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              minTickGap={40}
            />
            <YAxis
              tick={{ fill: "#6b7280", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => v.toFixed(0)}
            />
            <Tooltip
              content={
                <CustomTooltip rangeKey={rangeKey} />
              }
            />
            {referenceLine !== undefined && (
              <ReferenceLine
                y={referenceLine}
                stroke={referenceColor ?? "#f59e0b"}
                strokeDasharray="4 3"
                strokeOpacity={0.7}
                label={{
                  value: referenceLabel ?? "",
                  fill: referenceColor ?? "#f59e0b",
                  fontSize: 9,
                  position: "insideTopRight",
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey={dataKey}
              name={title}
              unit={` ${unit}`}
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

// ─── Sensor type labels ───────────────────────────────────────────────────────

const SENSOR_TYPE_LABELS: Record<string, { name: string; unit: string }> = {
  pressure_differential: { name: "Pressure", unit: "Pa" },
  humidity: { name: "Humidity", unit: "%RH" },
  co2: { name: "CO₂", unit: "ppm" },
  voc: { name: "VOC", unit: "ppb" },
};

export function DeviceReadings({
  deviceId,
  pressureThreshold,
}: DeviceReadingsProps) {
  const [activeRange, setActiveRange] = useState<RangeKey>("24h");
  const [activeSensorType, setActiveSensorType] = useState<string>("pressure_differential");

  const rangeCfg = RANGES[activeRange];
  const now = useMemo(() => Date.now(), [activeRange]); // refresh anchor on range change
  const startDate = useMemo(() => new Date(now - rangeCfg.ms), [now, rangeCfg.ms]);
  const endDate = useMemo(() => new Date(now), [now]);

  // Available sensor types for this device
  const { data: sensorTypes = ["pressure_differential"] } = api.sensor.getSensorTypes.useQuery(
    { deviceId },
    { refetchInterval: 60_000 },
  );

  // Recent readings (for stats bar + table + sparkline)
  const {
    data: recentReadings,
    isLoading: recentLoading,
    isError: recentError,
  } = api.sensor.getByDevice.useQuery(
    { deviceId, limit: 50, sensorType: activeSensorType },
    { refetchInterval: 30_000 },
  );

  // Time-range readings (for charts)
  const {
    data: rangeReadings,
    isLoading: rangeLoading,
  } = api.sensor.getByTimeRange.useQuery(
    { deviceId, startDate, endDate, sensorType: activeSensorType },
    { refetchInterval: 30_000 },
  );

  const chartPoints = useMemo(() => {
    if (!rangeReadings) return [];
    return toChartPoints(rangeReadings, rangeCfg);
  }, [rangeReadings, rangeCfg]);

  // ── Loading state ────────────────────────────────────────────────────────
  if (recentLoading) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-4">Sensor Data</h2>
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
        </div>
      </div>
    );
  }

  if (recentError || !recentReadings) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-4">Sensor Data</h2>
        <p className="text-red-400 text-sm">Failed to load sensor readings.</p>
      </div>
    );
  }

  if (recentReadings.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-4">Sensor Data</h2>
        <p className="text-gray-400 text-sm">
          No readings yet. Your device will start sending data once it comes online.
        </p>
      </div>
    );
  }

  const pressures = recentReadings.map((r) => r.pressure);
  const temperatures = recentReadings.map((r) => r.temperature);
  const avgPressure = pressures.reduce((a, b) => a + b, 0) / pressures.length;
  const maxPressure = Math.max(...pressures);
  const avgTemp = temperatures.reduce((a, b) => a + b, 0) / temperatures.length;
  const recentTen = recentReadings.slice(0, 10);

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Sensor Data</h2>
        <span className="text-xs text-gray-500">Auto-refreshes every 30s</span>
      </div>

      {/* Sensor Type Tabs — only shown when multiple types are present */}
      {sensorTypes.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Sensor:</span>
          {sensorTypes.map((type) => {
            const label = SENSOR_TYPE_LABELS[type] ?? { name: type, unit: "" };
            return (
              <button
                key={type}
                onClick={() => setActiveSensorType(type)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                  activeSensorType === type
                    ? "bg-purple-500/30 border-purple-400/60 text-purple-300"
                    : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                }`}
              >
                {label.name} {label.unit ? `(${label.unit})` : ""}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Charts Section ──────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Time Range Selector */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-500 mr-1">Range:</span>
          {RANGE_ORDER.map((key) => (
            <button
              key={key}
              onClick={() => setActiveRange(key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                activeRange === key
                  ? "bg-blue-500/30 border-blue-400/60 text-blue-300"
                  : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200"
              }`}
            >
              {RANGES[key].label}
            </button>
          ))}
        </div>

        {/* Pressure Chart */}
        <ChartPanel
          title="Pressure"
          unit="Pa"
          dataKey="pressure"
          color="#60a5fa"
          data={chartPoints}
          rangeKey={activeRange}
          referenceLine={pressureThreshold}
          referenceColor="#f59e0b"
          referenceLabel={`${pressureThreshold} Pa`}
          isLoading={rangeLoading}
        />

        {/* Temperature Chart */}
        <ChartPanel
          title="Temperature"
          unit="°C"
          dataKey="temperature"
          color="#34d399"
          data={chartPoints}
          rangeKey={activeRange}
          isLoading={rangeLoading}
        />
      </div>

      {/* ── Stats Bar ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
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
          <p className="text-gray-400 text-xs mb-1">Avg Temp</p>
          <p className="text-lg font-bold text-emerald-400">
            {avgTemp.toFixed(1)}
            <span className="text-xs font-normal text-gray-400 ml-1">°C</span>
          </p>
        </div>
        <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
          <p className="text-gray-400 text-xs mb-1">Total Readings</p>
          <p className="text-lg font-bold text-blue-400">
            {recentReadings.length}
            <span className="text-xs font-normal text-gray-400 ml-1">pts</span>
          </p>
        </div>
      </div>

      {/* ── Sparkline (legacy) ──────────────────────────────────────────── */}
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <p className="text-xs text-gray-400 mb-2">Pressure trend — last 20 readings</p>
        <PressureSparkline readings={recentReadings} threshold={pressureThreshold} />
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-blue-400 rounded" />
            <span className="text-xs text-gray-400">Pressure (Pa)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-yellow-400 rounded" />
            <span className="text-xs text-gray-400">Threshold ({pressureThreshold} Pa)</span>
          </div>
        </div>
      </div>

      {/* ── Readings Table ──────────────────────────────────────────────── */}
      <div>
        <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider">Last 10 Readings</p>
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-4 py-2 text-gray-400 font-medium">Time</th>
                <th className="text-right px-4 py-2 text-gray-400 font-medium">Pressure (Pa)</th>
                <th className="text-right px-4 py-2 text-gray-400 font-medium">Temp (°C)</th>
                {(recentReadings.some((r) => r.humidity != null)) && (
                  <th className="text-right px-4 py-2 text-gray-400 font-medium">Humidity (%)</th>
                )}
                {(recentReadings.some((r) => r.co2 != null)) && (
                  <th className="text-right px-4 py-2 text-gray-400 font-medium">CO₂ (ppm)</th>
                )}
                {(recentReadings.some((r) => r.voc != null)) && (
                  <th className="text-right px-4 py-2 text-gray-400 font-medium">VOC (ppb)</th>
                )}
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
                    <td
                      className={`px-4 py-2.5 text-right font-mono font-semibold ${getPressureColor(reading.pressure, pressureThreshold)}`}
                    >
                      {reading.pressure.toFixed(1)} Pa
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-300">
                      {reading.temperature.toFixed(1)} °C
                    </td>
                    {recentReadings.some((r) => r.humidity != null) && (
                      <td className="px-4 py-2.5 text-right font-mono text-cyan-300">
                        {reading.humidity != null ? `${reading.humidity.toFixed(1)}%` : "—"}
                      </td>
                    )}
                    {recentReadings.some((r) => r.co2 != null) && (
                      <td className="px-4 py-2.5 text-right font-mono text-orange-300">
                        {reading.co2 != null ? `${reading.co2.toFixed(0)} ppm` : "—"}
                      </td>
                    )}
                    {recentReadings.some((r) => r.voc != null) && (
                      <td className="px-4 py-2.5 text-right font-mono text-pink-300">
                        {reading.voc != null ? `${reading.voc.toFixed(0)} ppb` : "—"}
                      </td>
                    )}
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
