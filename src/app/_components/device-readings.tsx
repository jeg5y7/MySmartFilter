"use client";

import { useState, useMemo, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Bar,
} from "recharts";
import { api } from "~/trpc/react";
import { cToF } from "~/lib/units";
import { BLOWER_ON_MIN_PA } from "~/lib/energy";

interface DeviceReadingsProps {
  deviceId: string;
  /** Allowed RISE (Pa) above the fresh-filter baseline before alerting. */
  pressureThreshold: number;
  /** Fresh-filter baseline ΔP (Pa); null until first capture. */
  baselineDeltaP: number | null;
  /** Filter AutoShip members get full history; free tier is live-only (1h). */
  isAutoShipMember: boolean;
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
  /** true = one point per local day: average of blower-ON readings only.
   *  Averaging idle near-zeros in would make the line track duty cycle
   *  instead of filter condition. */
  dailyOnAvg: boolean;
  tickFormat: (ts: number) => string;
}

const RANGES: Record<RangeKey, RangeConfig> = {
  "1h": {
    label: "1h",
    ms: 60 * 60 * 1000,
    dailyOnAvg: false,
    tickFormat: (ts) =>
      new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  },
  "6h": {
    label: "6h",
    ms: 6 * 60 * 60 * 1000,
    dailyOnAvg: false,
    tickFormat: (ts) =>
      new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  },
  "24h": {
    label: "24h",
    ms: 24 * 60 * 60 * 1000,
    dailyOnAvg: false,
    tickFormat: (ts) =>
      new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  },
  "7d": {
    label: "7d",
    ms: 7 * 24 * 60 * 60 * 1000,
    dailyOnAvg: true,
    tickFormat: (ts) =>
      new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  },
  "30d": {
    label: "30d",
    ms: 30 * 24 * 60 * 60 * 1000,
    dailyOnAvg: true,
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
  /** Daily mode only: minutes the blower ran that day. */
  runtimeMin?: number;
  /** Daily mode only: least-squares trend across the days. */
  trend?: number;
}

/** One point per local day. Pressure = average of blower-ON readings only
 *  (days where the blower never ran are omitted, so the line connects real
 *  measurements instead of dipping to zero). Temperature = daily average of
 *  all readings. */
function dailyOnAverage(readings: RawReading[]): ChartPoint[] {
  const days = new Map<
    number,
    { on: number[]; temperature: number[]; runtimeSec: number }
  >();

  let prev: RawReading | null = null;
  for (const r of readings) {
    const d = r.timestamp;
    const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (!days.has(key))
      days.set(key, { on: [], temperature: [], runtimeSec: 0 });
    const b = days.get(key)!;
    if (r.pressure >= BLOWER_ON_MIN_PA) {
      b.on.push(r.pressure);
      // Runtime: sum the gaps between consecutive blower-on readings.
      // Samples arrive every ~10-15 s while running; cap the credited gap so
      // a data outage doesn't count as runtime.
      if (prev && prev.pressure >= BLOWER_ON_MIN_PA) {
        const gapSec =
          (r.timestamp.getTime() - prev.timestamp.getTime()) / 1000;
        b.runtimeSec += Math.min(Math.max(gapSec, 0), 150);
      }
    }
    prev = r;
  }

  const points: ChartPoint[] = Array.from(days.entries())
    .sort(([a], [b]) => a - b)
    .filter(([, b]) => b.on.length > 0)
    .map(([key, b]) => ({
      ts: key,
      pressure: b.on.reduce((a, c) => a + c, 0) / b.on.length,
      temperature: cToF(
        b.temperature.reduce((a, c) => a + c, 0) / b.temperature.length
      ),
      runtimeMin: Math.round(b.runtimeSec / 60),
    }));

  // Least-squares trend across the daily averages — the slow, steady rise
  // of a loading filter is exactly what this line makes visible.
  if (points.length >= 2) {
    const n = points.length;
    const xs = points.map((_, i) => i);
    const ys = points.map((pt) => pt.pressure);
    const xMean = xs.reduce((a, c) => a + c, 0) / n;
    const yMean = ys.reduce((a, c) => a + c, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i]! - xMean) * (ys[i]! - yMean);
      den += (xs[i]! - xMean) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = yMean - slope * xMean;
    points.forEach((pt, i) => {
      pt.trend = Math.max(0, intercept + slope * i);
    });
  }

  return points;
}

function toChartPoints(readings: RawReading[], cfg: RangeConfig): ChartPoint[] {
  const sorted = [...readings].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  if (cfg.dailyOnAvg) return dailyOnAverage(sorted);
  return sorted.map((r) => ({
    ts: r.timestamp.getTime(),
    pressure: r.pressure,
    temperature: cToF(r.temperature),
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
  payload?: { runtimeMin?: number };
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
      ? new Date(label).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : new Date(label).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

  return (
    <div className="bg-slate-900/95 border border-white/20 rounded-lg px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
      <p className="text-gray-400 mb-1">{dateStr}</p>
      {payload
        .filter((p) => p.name !== "Trend")
        .map((p) => (
          <p key={p.name} style={{ color: p.color }} className="font-mono">
            {p.name}: <span className="font-bold">{p.value.toFixed(1)}</span>{" "}
            {p.unit}
          </p>
        ))}
      {payload[0]?.payload?.runtimeMin !== undefined && (
        <p className="text-gray-300 font-mono mt-1">
          HVAC ran:{" "}
          <span className="font-bold">
            {Math.floor(payload[0].payload.runtimeMin / 60)}h{" "}
            {payload[0].payload.runtimeMin % 60}m
          </span>
        </p>
      )}
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
  referenceLine2?: number;
  referenceColor2?: string;
  referenceLabel2?: string;
  /** Fit the Y axis to the data (with padding) instead of starting at 0 —
   *  essential for temperature, where the interesting detail is a few
   *  degrees of movement around room temperature. */
  autoScaleY?: boolean;
  /** Render daily points as bars with the trend line across their tops. */
  bars?: boolean;
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
  referenceLine2,
  referenceColor2,
  referenceLabel2,
  autoScaleY = false,
  bars = false,
  isLoading,
}: ChartPanelProps) {
  const cfg = RANGES[rangeKey];
  const ChartComp = bars ? ComposedChart : LineChart;
  const hasTrend = bars && data.some((d) => d.trend !== undefined);

  // Daily-bar mode zooms the Y axis to the data: a fresh filter sits at a
  // high absolute pressure, and against a zero-based axis the slow loading
  // slope — the entire point of the long views — is invisible.
  let yDomain: React.ComponentProps<typeof YAxis>["domain"] = autoScaleY
    ? [
        (dataMin: number) => Math.floor(dataMin - 1),
        (dataMax: number) => Math.ceil(dataMax + 1),
      ]
    : [0, "auto"];
  if (bars) {
    const vals = data
      .map((d) => d[dataKey])
      .filter((v): v is number => typeof v === "number");
    if (vals.length > 0) {
      const mn = Math.min(...vals);
      const mx = Math.max(...vals);
      const span = Math.max(mx - mn, 4);
      yDomain = [
        Math.max(0, Math.floor(mn - span * 0.3)),
        Math.ceil(mx + span * 0.3),
      ];
    }
  }

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
          <ChartComp data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="ts"
              type="number"
              domain={bars ? ["dataMin - 43200000", "dataMax + 43200000"] : ["dataMin", "dataMax"]}
              scale="time"
              tickFormatter={cfg.tickFormat}
              tick={{ fill: "#6b7280", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              minTickGap={40}
            />
            <YAxis
              domain={yDomain}
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
            {referenceLine2 !== undefined && (
              <ReferenceLine
                y={referenceLine2}
                stroke={referenceColor2 ?? "#34d399"}
                strokeDasharray="4 3"
                strokeOpacity={0.8}
                label={{
                  value: referenceLabel2 ?? "",
                  fill: referenceColor2 ?? "#34d399",
                  fontSize: 9,
                  position: "insideBottomRight",
                }}
              />
            )}
            {bars ? (
              <Bar
                dataKey={dataKey}
                name={title}
                unit={` ${unit}`}
                fill={color}
                fillOpacity={0.65}
                radius={[4, 4, 0, 0]}
                maxBarSize={26}
                isAnimationActive={false}
              />
            ) : (
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
            )}
            {hasTrend && (
              <Line
                type="linear"
                dataKey="trend"
                name="Trend"
                unit={` ${unit}`}
                stroke="#f8fafc"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            )}
          </ChartComp>
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

/** "Updated Xs ago" + a tappable refresh — visible proof the data is live. */
function FreshnessBadge({
  updatedAt,
  fetching,
  onRefresh,
}: {
  updatedAt: number;
  fetching: boolean;
  onRefresh: () => void;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const secs = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
  const ago =
    secs < 5 ? "just now" : secs < 90 ? `${secs}s ago` : `${Math.round(secs / 60)}m ago`;

  return (
    <button
      onClick={onRefresh}
      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      title="Refresh now"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className={`h-3.5 w-3.5 ${fetching ? "animate-spin text-blue-400" : ""}`}
      >
        <path
          fillRule="evenodd"
          d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.22z"
          clipRule="evenodd"
        />
      </svg>
      {fetching ? "Refreshing…" : `Updated ${ago}`}
    </button>
  );
}

export function DeviceReadings({
  deviceId,
  pressureThreshold,
  baselineDeltaP,
  isAutoShipMember,
}: DeviceReadingsProps) {
  // Absolute alert level shown to the user: baseline + allowed rise
  const alertCeiling = (baselineDeltaP ?? 0) + pressureThreshold;
  const [activeRange, setActiveRange] = useState<RangeKey>(
    isAutoShipMember ? "24h" : "1h"
  );
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
    isFetching: recentFetching,
    dataUpdatedAt: recentUpdatedAt,
    refetch: refetchRecent,
  } = api.sensor.getByDevice.useQuery(
    { deviceId, limit: 50, sensorType: activeSensorType },
    { refetchInterval: 30_000 },
  );

  // Time-range readings (for charts)
  const {
    data: rangeReadings,
    isLoading: rangeLoading,
    refetch: refetchRange,
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

  // Stat tiles follow the SELECTED RANGE (falling back to the recent list
  // while the range query loads or returns nothing)
  const statsReadings =
    rangeReadings && rangeReadings.length > 0 ? rangeReadings : recentReadings;
  const pressures = statsReadings.map((r) => r.pressure);
  const temperatures = statsReadings.map((r) => r.temperature);
  // "Average" means average while the system is RUNNING — near-zero readings
  // from idle periods would drag it down and hide the number that matters
  const runningPressures = pressures.filter((v) => v >= BLOWER_ON_MIN_PA);
  const avgRunning =
    runningPressures.length > 0
      ? runningPressures.reduce((a, b) => a + b, 0) / runningPressures.length
      : null;
  const maxPressure = Math.max(...pressures);
  const avgTemp = temperatures.reduce((a, b) => a + b, 0) / temperatures.length;
  const recentTen = recentReadings.slice(0, 10);

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Sensor Data</h2>
        <FreshnessBadge
          updatedAt={recentUpdatedAt}
          fetching={recentFetching}
          onRefresh={() => {
            void refetchRecent();
            void refetchRange();
          }}
        />
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
        {/* Time Range Selector — history beyond 1h is a Filter AutoShip feature */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-500 mr-1">Range:</span>
          {RANGE_ORDER.map((key) => {
            const locked = !isAutoShipMember && key !== "1h";
            return (
              <button
                key={key}
                onClick={() => !locked && setActiveRange(key)}
                disabled={locked}
                title={locked ? "Historical trending is included with Filter AutoShip" : undefined}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                  activeRange === key
                    ? "bg-blue-500/30 border-blue-400/60 text-blue-300"
                    : locked
                      ? "bg-white/5 border-white/10 text-gray-600 cursor-not-allowed"
                      : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                }`}
              >
                {locked ? "🔒 " : ""}
                {RANGES[key].label}
              </button>
            );
          })}
        </div>
        {!isAutoShipMember && (
          <p className="text-xs text-amber-300/80">
            You&apos;re seeing live data. Historical trending is included with
            Filter AutoShip — enable Auto-Order in this device&apos;s Filter
            Settings to unlock it.
          </p>
        )}

        {/* Pressure Chart */}
        <ChartPanel
          title="Pressure Drop Across Filter"
          unit="Pa"
          dataKey="pressure"
          color="#60a5fa"
          data={chartPoints}
          rangeKey={activeRange}
          bars={rangeCfg.dailyOnAvg}
          referenceLine={alertCeiling}
          referenceColor="#f59e0b"
          referenceLabel="Alert level"
          referenceLine2={avgRunning ?? undefined}
          referenceColor2="#34d399"
          referenceLabel2="Average while running"
          isLoading={rangeLoading}
        />

        {/* Temperature Chart */}
        <ChartPanel
          title="Temperature"
          unit="°F"
          dataKey="temperature"
          color="#34d399"
          data={chartPoints}
          rangeKey={activeRange}
          autoScaleY
          isLoading={rangeLoading}
        />
      </div>

      {/* ── Stats Bar ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
          <p className="text-gray-400 text-xs mb-1">Avg While Running</p>
          {avgRunning !== null ? (
            <p className={`text-lg font-bold ${getPressureColor(avgRunning, alertCeiling)}`}>
              {avgRunning.toFixed(1)}
              <span className="text-xs font-normal text-gray-400 ml-1">Pa</span>
            </p>
          ) : (
            <p className="text-lg font-bold text-gray-500">—</p>
          )}
        </div>
        <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
          <p className="text-gray-400 text-xs mb-1">Peak Pressure</p>
          <p className={`text-lg font-bold ${getPressureColor(maxPressure, alertCeiling)}`}>
            {maxPressure.toFixed(1)}
            <span className="text-xs font-normal text-gray-400 ml-1">Pa</span>
          </p>
        </div>
        <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
          <p className="text-gray-400 text-xs mb-1">Avg Temp</p>
          <p className="text-lg font-bold text-emerald-400">
            {cToF(avgTemp).toFixed(1)}
            <span className="text-xs font-normal text-gray-400 ml-1">°F</span>
          </p>
        </div>
        <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
          <p className="text-gray-400 text-xs mb-1">Readings · {rangeCfg.label}</p>
          <p className="text-lg font-bold text-blue-400">
            {statsReadings.length}
            <span className="text-xs font-normal text-gray-400 ml-1">pts</span>
          </p>
        </div>
      </div>

      {/* ── Sparkline (legacy) ──────────────────────────────────────────── */}
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <p className="text-xs text-gray-400 mb-2">Pressure trend — last 20 readings</p>
        <PressureSparkline readings={recentReadings} threshold={alertCeiling} />
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-blue-400 rounded" />
            <span className="text-xs text-gray-400">Pressure (Pa)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-yellow-400 rounded" />
            <span className="text-xs text-gray-400">Alert level ({Math.round(alertCeiling)} Pa)</span>
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
                <th className="text-right px-4 py-2 text-gray-400 font-medium">Temp (°F)</th>
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
                const pct = reading.pressure / alertCeiling;
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
                      className={`px-4 py-2.5 text-right font-mono font-semibold ${getPressureColor(reading.pressure, alertCeiling)}`}
                    >
                      {reading.pressure.toFixed(1)} Pa
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-300">
                      {cToF(reading.temperature).toFixed(1)} °F
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
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${getPressureBg(reading.pressure, alertCeiling)} ${getPressureColor(reading.pressure, alertCeiling)}`}
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
