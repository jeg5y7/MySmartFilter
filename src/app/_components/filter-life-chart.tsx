"use client";

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

interface Point {
  ts: number;
  pa?: number;
  proj?: number;
}

export interface FilterLifeChartProps {
  history: { ts: number; pa: number }[];
  projection: { ts: number; pa: number }[];
  ceiling: number;
  baseline: number;
  daysRemaining: number | null;
  predictedDate: string | null; // ISO
  deviceName: string | null;
}

const fmtDay = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/**
 * Filter life prediction: daily dry-coil pressure history (sage), the
 * fitted trend projected forward (dashed clay), and the replacement level
 * (red). Where the dashed line meets red is the predicted replacement date.
 */
export function FilterLifeChart({
  history,
  projection,
  ceiling,
  baseline,
  daysRemaining,
  predictedDate,
  deviceName,
}: FilterLifeChartProps) {
  const data: Point[] = [
    ...history.map((p) => ({ ts: p.ts, pa: p.pa })),
    ...projection.map((p) => ({ ts: p.ts, proj: p.pa })),
  ].sort((a, b) => a.ts - b.ts);

  const yMin = Math.max(0, Math.floor(Math.min(baseline, ...history.map((p) => p.pa)) - 5));
  const yMax = Math.ceil(ceiling + 5);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {daysRemaining !== null && predictedDate ? (
          <>
            <p className="font-display text-3xl text-ink">
              ~{daysRemaining} days
            </p>
            <p className="text-sm text-body">
              until replacement pays for itself — around{" "}
              <span className="font-semibold text-ink">
                {new Date(predictedDate).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                })}
              </span>
              {deviceName ? ` (${deviceName})` : ""}
            </p>
          </>
        ) : (
          <p className="text-sm text-body">
            Your filter isn&apos;t loading measurably yet — the projection
            appears once a clear trend develops.
          </p>
        )}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 6, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eeebe4" />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={fmtDay}
            tick={{ fill: "#8a867c", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#eeebe4" }}
            minTickGap={50}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fill: "#8a867c", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => v.toFixed(0)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid #eeebe4",
              borderRadius: 12,
              color: "#1c1b18",
              fontSize: 12,
            }}
            labelStyle={{ color: "#8a867c" }}
            labelFormatter={(ts: number) => fmtDay(ts)}
            formatter={(value: number, name: string) => [
              `${value.toFixed(1)} Pa`,
              name,
            ]}
          />
          <ReferenceLine
            y={ceiling}
            stroke="#dc2626"
            strokeDasharray="4 3"
            strokeOpacity={0.8}
            label={{
              value: "Replace",
              fill: "#dc2626",
              fontSize: 10,
              position: "insideTopRight",
            }}
          />
          <ReferenceLine
            y={baseline}
            stroke="#3e8a72"
            strokeDasharray="2 4"
            strokeOpacity={0.5}
            label={{
              value: "Fresh",
              fill: "#3e8a72",
              fontSize: 10,
              position: "insideBottomRight",
            }}
          />
          <Line
            type="monotone"
            dataKey="pa"
            name="Filter pressure"
            stroke="#3e8a72"
            strokeWidth={2}
            dot={{ r: 2, fill: "#3e8a72", strokeWidth: 0 }}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="proj"
            name="Projected"
            stroke="#b9652f"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2 text-[10px] text-whisper">
        Daily dry-coil readings with the trend projected to your replacement
        level. The projection assumes recent usage continues and re-fits
        every day.
      </p>
    </div>
  );
}
