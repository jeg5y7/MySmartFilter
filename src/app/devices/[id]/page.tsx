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
    <main className="flex min-h-screen flex-col bg-paper">
      <div className="container mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-faint mb-4">
            <Link href="/dashboard" className="hover:text-ink transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <Link href="/devices" className="hover:text-ink transition-colors">
              Devices
            </Link>
            <span>/</span>
            <span className="text-ink">{device.name ?? device.deviceId}</span>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="font-display text-3xl font-normal tracking-tight text-ink sm:text-4xl mb-2">
                {device.name ?? "Smart Filter Device"}
              </h1>
              <p className="text-faint">
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
                className="rounded-full border border-mist bg-card px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist/60"
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
            <div className="rounded-[24px] border border-mist bg-card p-6">
              <h2 className="text-lg font-semibold text-ink mb-4">Device Status</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-faint text-sm">Status</p>
                  <p
                    className={`font-semibold ${
                      device.status === "active"
                        ? "text-sage"
                        : device.status.startsWith("error")
                        ? "text-red-600"
                        : "text-clay"
                    }`}
                  >
                    {device.status.charAt(0).toUpperCase() + device.status.slice(1)}
                  </p>
                </div>
                <div>
                  <p className="text-faint text-sm">Last Seen</p>
                  <p className="text-ink font-medium">
                    {device.lastSeen ? (
                      <LocalTime iso={device.lastSeen.toISOString()} />
                    ) : (
                      "Never"
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-faint text-sm">Firmware</p>
                  <p className="text-ink font-medium">{device.firmware ?? "Unknown"}</p>
                </div>
                <div>
                  <p className="text-faint text-sm">
                    {device.batteryPct !== null ? "Battery" : "Alert Threshold"}
                  </p>
                  {device.batteryPct !== null ? (
                    <p
                      className={`font-medium ${
                        device.batteryPct <= 20
                          ? "text-red-600"
                          : device.batteryPct <= 40
                            ? "text-clay"
                            : "text-sage"
                      }`}
                    >
                      🔋 {Math.round(device.batteryPct)}%
                    </p>
                  ) : (
                    <p className="text-ink font-medium">
                      +{device.pressureThreshold} Pa
                      <span className="text-faint text-xs font-normal"> over baseline</span>
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
              <div className="rounded-[24px] border border-sage/30 bg-card p-6">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-semibold text-ink">Filter Health</h2>
                  <span className="px-3 py-1 rounded-full bg-sagemist text-sage-deep text-xs font-semibold">
                    Filter AutoShip feature
                  </span>
                </div>
                <p className="text-sm text-body mb-4">
                  See exactly how much extra electricity this filter is costing
                  you — and let a replacement ship itself the moment a new one
                  is cheaper. Included when you get your filters through us:
                  pick a filter and enable Auto-Order in Filter Settings. No
                  monthly fee.
                </p>
                <div className="w-full h-3 bg-mist rounded-full overflow-hidden mb-2 opacity-60">
                  <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-sage to-clay" />
                </div>
                <p className="text-xs text-faint">
                  🔒 Energy-savings calculation, historical trending &amp; upcoming
                  HVAC diagnostics unlock with AutoShip.
                </p>
              </div>
            )}

            {/* Active Alerts */}
            {device.filterAlerts.length > 0 && (
              <div className="rounded-[24px] border border-red-200 bg-red-50 p-6">
                <h2 className="text-lg font-semibold text-red-700 mb-4 flex items-center gap-2">
                  <span>⚠️</span> Active Filter Alerts
                </h2>
                <div className="space-y-3">
                  {device.filterAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="rounded-2xl border border-red-200 bg-card p-4"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-ink font-medium">
                            Filter replacement needed
                          </p>
                          <p className="text-body text-sm">
                            Pressure: {alert.pressure.toFixed(1)} Pa (threshold:{" "}
                            {alert.threshold} Pa)
                          </p>
                        </div>
                        <span className="px-2 py-1 bg-red-50 text-red-600 text-xs font-semibold rounded-full">
                          {alert.status}
                        </span>
                      </div>
                      {alert.autoOrderAt && (
                        <p className="text-clay text-sm">
                          Auto-order scheduled for:{" "}
                          <LocalTime iso={new Date(alert.autoOrderAt).toISOString()} />
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <Link
                          href="/store"
                          className="inline-block rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
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
                <div className="rounded-[24px] border border-mist bg-card p-6">
                  <h2 className="text-lg font-semibold text-ink mb-4">Recent Readings</h2>
                  <div className="flex items-center justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage" />
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
