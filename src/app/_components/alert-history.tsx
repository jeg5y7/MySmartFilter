"use client";

import { api } from "~/trpc/react";

interface AlertHistoryProps {
  deviceId: string;
}

type AlertStatus =
  | "pending"
  | "notified"
  | "auto_ordered"
  | "dismissed"
  | "manual_ordered";

function statusBadge(status: string) {
  switch (status as AlertStatus) {
    case "pending":
      return "bg-clay/10 text-clay border-clay/30";
    case "notified":
      return "bg-sagemist text-sage-deep border-sage/30";
    case "auto_ordered":
      return "bg-sagemist text-sage-deep border-sage/30";
    case "manual_ordered":
      return "bg-sagemist text-sage-deep border-sage/30";
    case "dismissed":
      return "bg-mist text-faint border-mist";
    default:
      return "bg-mist text-body border-mist";
  }
}

function statusLabel(status: string): string {
  switch (status as AlertStatus) {
    case "pending":       return "Pending";
    case "notified":      return "Notified";
    case "auto_ordered":  return "Auto Ordered";
    case "manual_ordered": return "Manually Ordered";
    case "dismissed":     return "Dismissed";
    default:              return status;
  }
}

function timeAgo(date: Date | string): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60)  return "just now";
  if (diffMin < 60)  return `${diffMin}m ago`;
  if (diffHr < 24)   return `${diffHr}h ago`;
  if (diffDay < 30)  return `${diffDay}d ago`;
  return new Date(date).toLocaleDateString();
}

export function AlertHistory({ deviceId }: AlertHistoryProps) {
  const { data: alerts, isLoading } = api.device.getAlerts.useQuery(
    { deviceId, limit: 10 },
    { refetchOnWindowFocus: false }
  );

  if (isLoading) {
    return (
      <div className="rounded-[24px] border border-mist bg-card p-6">
        <h2 className="text-lg font-semibold text-ink mb-4">Alert History</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sage" />
        </div>
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="rounded-[24px] border border-mist bg-card p-6">
        <h2 className="text-lg font-semibold text-ink mb-2">Alert History</h2>
        <p className="text-body text-sm">No alerts recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-mist bg-card p-6">
      <h2 className="text-lg font-semibold text-ink mb-4 flex items-center gap-2">
        <span>🕐</span> Alert History
      </h2>

      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-start justify-between gap-3 py-3 border-b border-mist last:border-0"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${statusBadge(alert.status)}`}
                >
                  {statusLabel(alert.status)}
                </span>
                <span className="text-faint text-xs">{timeAgo(alert.createdAt)}</span>
              </div>
              <p className="text-sm text-body">
                {alert.pressure.toFixed(1)} Pa
                <span className="text-faint mx-1">vs</span>
                {alert.threshold.toFixed(0)} Pa threshold
              </p>
              <p className="text-xs text-faint mt-0.5">
                {new Date(alert.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
