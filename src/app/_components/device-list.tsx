"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";

// ─── Connectivity helpers ────────────────────────────────────────────────────

type ConnectivityStatus = "online" | "degraded" | "offline" | "error";

function getConnectivityStatus(
  deviceStatus: string,
  lastSeen: Date | string | null | undefined,
): ConnectivityStatus {
  if (deviceStatus === "error") return "error";
  if (!lastSeen) return "offline";

  const diffMin = (Date.now() - new Date(lastSeen).getTime()) / 60_000;
  if (diffMin < 5) return "online";
  if (diffMin < 60) return "degraded";
  return "offline";
}

function ConnectivityDot({ status }: { status: ConnectivityStatus }) {
  const base = "w-2.5 h-2.5 rounded-full flex-shrink-0";
  if (status === "online") {
    return (
      <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
        <span className={`${base} bg-green-400`} />
      </span>
    );
  }
  if (status === "degraded") return <span className={`${base} bg-yellow-400`} />;
  if (status === "error")    return <span className={`${base} bg-red-400`} />;
  return <span className={`${base} bg-gray-500`} />;
}

function connectivityLabel(status: ConnectivityStatus): string {
  switch (status) {
    case "online":   return "Online";
    case "degraded": return "Degraded";
    case "error":    return "Error";
    default:         return "Offline";
  }
}

function connectivityColor(status: ConnectivityStatus): string {
  switch (status) {
    case "online":   return "text-green-400";
    case "degraded": return "text-yellow-400";
    case "error":    return "text-red-400";
    default:         return "text-gray-400";
  }
}

function lastSeenText(lastSeen: Date | string | null | undefined): string {
  if (!lastSeen) return "Never seen";
  const diffMs  = Date.now() - new Date(lastSeen).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1)  return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24)  return `${diffHr} hr ago`;
  return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DeviceList() {
  const [deletingDevice, setDeletingDevice] = useState<string | null>(null);

  const {
    data: devices,
    isLoading,
    isError,
    refetch,
  } = api.device.list.useQuery(undefined, { refetchInterval: 60_000 });

  const handleDeleteDevice = async (id: string) => {
    if (!confirm("Are you sure you want to remove this device?")) return;

    setDeletingDevice(id);
    try {
      const response = await fetch(`/api/device/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        void refetch();
      } else {
        const data = (await response.json()) as { error?: string };
        alert(data.error ?? "Failed to delete device");
      }
    } catch {
      alert("Failed to delete device");
    } finally {
      setDeletingDevice(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center p-12">
        <p className="text-red-400 mb-4">Failed to load devices</p>
        <button
          onClick={() => void refetch()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!devices || devices.length === 0) {
    return (
      <div className="text-center p-12">
        <div className="text-6xl mb-4">📡</div>
        <h3 className="text-2xl font-bold text-white mb-2">No Devices Yet</h3>
        <p className="text-gray-400 mb-6">
          Connect your first Smart Filter device to start monitoring
        </p>
        <div className="inline-flex flex-col items-center gap-4">
          <div className="bg-white/5 rounded-lg p-4">
            <p className="text-sm text-gray-300 mb-2">Have a device ready?</p>
            <p className="text-xs text-gray-400">
              Power on your Smart Filter and it will display a QR code or setup link
            </p>
          </div>
          <Link
            href="/setup/device"
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium rounded-lg transition-all"
          >
            Add Your First Device
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">My Devices</h2>
        <Link
          href="/setup/device"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          Add Device
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {devices.map((device) => {
          const latestPressure = device.latestReading?.pressure;
          const pressurePct =
            latestPressure !== undefined
              ? latestPressure / device.pressureThreshold
              : null;
          const connectivity = getConnectivityStatus(device.status, device.lastSeen);

          return (
            <div
              key={device.id}
              className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10 hover:border-white/20 transition-all flex flex-col"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="min-w-0 flex-1 mr-3">
                  <h3 className="text-lg font-semibold text-white truncate">
                    {device.name ?? "Smart Filter"}
                  </h3>
                  {device.location && (
                    <p className="text-sm text-gray-400 truncate">{device.location}</p>
                  )}
                </div>

                {/* Connectivity Status Badge */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <ConnectivityDot status={connectivity} />
                    <span className={`text-xs font-medium ${connectivityColor(connectivity)}`}>
                      {connectivityLabel(connectivity)}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 leading-none">
                    {lastSeenText(device.lastSeen)}
                  </span>
                </div>
              </div>

              {/* Latest pressure mini-bar */}
              {latestPressure !== undefined && pressurePct !== null && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Filter pressure</span>
                    <span
                      className={
                        pressurePct >= 1
                          ? "text-red-400"
                          : pressurePct >= 0.7
                          ? "text-yellow-400"
                          : "text-green-400"
                      }
                    >
                      {latestPressure.toFixed(1)} Pa
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pressurePct >= 1
                          ? "bg-red-400"
                          : pressurePct >= 0.7
                          ? "bg-yellow-400"
                          : "bg-green-400"
                      }`}
                      style={{ width: `${Math.min(pressurePct * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {device.pressureThreshold} Pa threshold
                  </p>
                </div>
              )}

              {/* Meta */}
              <div className="space-y-2 mb-4 flex-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Device ID</span>
                  <span className="font-mono text-gray-300 text-xs truncate max-w-[120px]">
                    {device.deviceId}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Type</span>
                  <span className="text-gray-300">{device.type}</span>
                </div>
                {device.firmware && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Firmware</span>
                    <span className="text-gray-300">v{device.firmware}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-auto">
                <Link
                  href={`/devices/${device.id}`}
                  className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium text-center rounded-lg transition-all"
                >
                  View Details
                </Link>
                <button
                  onClick={() => void handleDeleteDevice(device.id)}
                  disabled={deletingDevice === device.id}
                  className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                  title="Remove Device"
                >
                  {deletingDevice === device.id ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400" />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
