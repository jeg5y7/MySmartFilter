import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { DeviceSettings } from "~/app/_components/device-settings";
import { DeviceReadings } from "~/app/_components/device-readings";
import { AlertActionButtons } from "~/app/_components/alert-action-buttons";
import { AlertHistory } from "~/app/_components/alert-history";
import { ExportButton } from "~/app/_components/export-button";
import { FilterHealthCard } from "~/app/_components/filter-health-card";
import { LocalTime } from "~/app/_components/local-time";
import { isAutoShipMember } from "~/lib/membership";
import { suggestedRateForState } from "~/lib/electricity-rates";

interface DevicePageProps {
  params: Promise<{ id: string }>;
}

export default async function DevicePage({ params }: DevicePageProps) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  const device = await db.device.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    include: {
      filterPreferences: {
        include: {
          filterProduct: true,
        },
      },
      filterAlerts: {
        where: {
          status: { in: ["pending", "notified"] },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!device) {
    notFound();
  }

  // Get all filter products for the dropdown (filters only — not hardware)
  const filterProducts = await db.filterProduct.findMany({
    where: { inStock: true, productType: "filter" },
    orderBy: [{ size: "asc" }, { merv: "asc" }],
  });

  const preference = device.filterPreferences[0];
  const autoShip = await isAutoShipMember(session.user.id);

  // Suggested electricity rate from the shipping state on file
  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { shippingState: true },
  });
  const stateRate = suggestedRateForState(me?.shippingState);

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white">
      <div className="container mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <Link href="/devices" className="hover:text-white transition-colors">
              Devices
            </Link>
            <span>/</span>
            <span className="text-white">{device.name ?? device.deviceId}</span>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                {device.name ?? "Smart Filter Device"}
              </h1>
              <p className="text-gray-400">
                {device.location ?? "No location set"} • {device.deviceId}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {autoShip && (
                <ExportButton
                  deviceId={device.deviceId}
                  deviceName={device.name ?? device.deviceId}
                />
              )}
              <Link
                href="/devices"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
              >
                Back to Devices
              </Link>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Device Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Card */}
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <h2 className="text-lg font-semibold text-white mb-4">Device Status</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Status</p>
                  <p
                    className={`font-semibold ${
                      device.status === "active"
                        ? "text-green-400"
                        : device.status === "error"
                        ? "text-red-400"
                        : "text-yellow-400"
                    }`}
                  >
                    {device.status.charAt(0).toUpperCase() + device.status.slice(1)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Last Seen</p>
                  <p className="text-white font-medium">
                    {device.lastSeen ? (
                      <LocalTime iso={device.lastSeen.toISOString()} />
                    ) : (
                      "Never"
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Firmware</p>
                  <p className="text-white font-medium">{device.firmware ?? "Unknown"}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">
                    {device.batteryPct !== null ? "Battery" : "Alert Threshold"}
                  </p>
                  {device.batteryPct !== null ? (
                    <p
                      className={`font-medium ${
                        device.batteryPct <= 20
                          ? "text-red-400"
                          : device.batteryPct <= 40
                            ? "text-amber-300"
                            : "text-green-400"
                      }`}
                    >
                      🔋 {Math.round(device.batteryPct)}%
                    </p>
                  ) : (
                    <p className="text-white font-medium">
                      +{device.pressureThreshold} Pa
                      <span className="text-gray-500 text-xs font-normal"> over baseline</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Filter Health — energy-cost meter (Filter AutoShip feature) */}
            {autoShip ? (
              <FilterHealthCard
                deviceId={device.id}
                blowerType={device.blowerType}
                extraEnergyCostCents={device.extraEnergyCostCents}
                runtimeHours={device.runtimeHours}
                baselineDeltaP={device.baselineDeltaP}
                filterInstalledAt={
                  device.filterInstalledAt?.toISOString() ?? null
                }
                filterPriceCents={preference?.filterProduct.price ?? null}
                filterName={
                  preference
                    ? `${preference.filterProduct.size} ${preference.filterProduct.name}`
                    : null
                }
              />
            ) : (
              <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-blue-500/30">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-semibold text-white">Filter Health</h2>
                  <span className="px-3 py-1 rounded-full bg-blue-500/15 text-blue-300 text-xs font-medium">
                    Filter AutoShip feature
                  </span>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  See exactly how much extra electricity this filter is costing
                  you — and let a replacement ship itself the moment a new one
                  is cheaper. Included when you get your filters through us:
                  pick a filter and enable Auto-Order in Filter Settings. No
                  monthly fee.
                </p>
                <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden mb-2 opacity-40">
                  <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-emerald-500 to-amber-400" />
                </div>
                <p className="text-xs text-gray-500">
                  🔒 Energy-savings calculation, historical trending &amp; upcoming
                  HVAC diagnostics unlock with AutoShip.
                </p>
              </div>
            )}

            {/* Active Alerts */}
            {device.filterAlerts.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-red-300 mb-4 flex items-center gap-2">
                  <span>⚠️</span> Active Filter Alerts
                </h2>
                <div className="space-y-3">
                  {device.filterAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="bg-red-500/10 rounded-lg p-4 border border-red-500/20"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-red-200 font-medium">
                            Filter replacement needed
                          </p>
                          <p className="text-red-300/70 text-sm">
                            Pressure: {alert.pressure.toFixed(1)} Pa (threshold:{" "}
                            {alert.threshold} Pa)
                          </p>
                        </div>
                        <span className="px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded-full">
                          {alert.status}
                        </span>
                      </div>
                      {alert.autoOrderAt && (
                        <p className="text-yellow-300 text-sm">
                          Auto-order scheduled for:{" "}
                          <LocalTime iso={new Date(alert.autoOrderAt).toISOString()} />
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <Link
                          href="/store"
                          className="inline-block px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-all"
                        >
                          Order Replacement Filter
                        </Link>
                        <AlertActionButtons alertId={alert.id} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alert History */}
            <AlertHistory deviceId={device.id} />

            {/* Recent Readings — live sensor data */}
            <Suspense
              fallback={
                <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                  <h2 className="text-lg font-semibold text-white mb-4">Recent Readings</h2>
                  <div className="flex items-center justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
                  </div>
                </div>
              }
            >
              <DeviceReadings
                deviceId={device.deviceId}
                pressureThreshold={device.pressureThreshold}
                baselineDeltaP={device.baselineDeltaP}
                isAutoShipMember={autoShip}
              />
            </Suspense>
          </div>

          {/* Settings Sidebar */}
          <div className="space-y-6">
            <DeviceSettings
              device={{
                id: device.id,
                deviceId: device.deviceId,
                name: device.name,
                location: device.location,
                pressureThreshold: device.pressureThreshold,
                blowerType: device.blowerType,
                airflowCfm: device.airflowCfm,
                electricityRateCents: device.electricityRateCents,
                furnaceMake: device.furnaceMake,
                furnaceModel: device.furnaceModel,
              }}
              stateAvgRateCents={stateRate}
              stateCode={me?.shippingState ?? null}
              filterProducts={filterProducts}
              currentPreference={
                preference
                  ? {
                      id: preference.id,
                      filterProductId: preference.filterProductId,
                      autoOrderEnabled: preference.autoOrderEnabled,
                      filterProduct: preference.filterProduct,
                    }
                  : null
              }
            />
          </div>
        </div>
      </div>
    </main>
  );
}
