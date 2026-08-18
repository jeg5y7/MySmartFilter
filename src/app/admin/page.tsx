import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { computeFilterHealth } from "~/lib/filter-health";
import { AdminFleet, type FleetDevice, type FleetTrendPoint } from "~/app/_components/admin-fleet";

export const dynamic = "force-dynamic";

/**
 * Admin fleet dashboard: every device across every account, plus 30-day
 * fleet-wide trends. Only visible to users with isAdmin = true.
 */

const OFFLINE_AFTER_MISSED_CHECKINS = 3;

interface TrendRow {
  day: Date;
  readings: bigint;
  devices: bigint;
  avg_pressure: number | null;
}

export default async function AdminFleetPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!me?.isAdmin) notFound();

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [devices, userCount, autoShipUsers, pendingAlerts, readings24h, trendRows] =
    await Promise.all([
      db.device.findMany({
        orderBy: { lastSeen: "desc" },
        include: {
          user: { select: { email: true } },
          sensorReadings: { orderBy: { timestamp: "desc" }, take: 1 },
        },
      }),
      db.user.count(),
      db.userFilterPreference
        .findMany({
          where: { autoOrderEnabled: true },
          select: { userId: true },
          distinct: ["userId"],
        })
        .then((rows) => rows.length),
      db.filterAlert.count({ where: { status: { in: ["pending", "notified"] } } }),
      db.sensorReading.count({ where: { timestamp: { gte: dayAgo } } }),
      db.$queryRaw<TrendRow[]>`
        SELECT date_trunc('day', "timestamp") AS day,
               COUNT(*)::bigint AS readings,
               COUNT(DISTINCT "deviceId")::bigint AS devices,
               AVG("pressure") AS avg_pressure
        FROM "SensorReading"
        WHERE "timestamp" > NOW() - INTERVAL '30 days'
        GROUP BY 1
        ORDER BY 1
      `,
    ]);

  const now = Date.now();
  const fleet: FleetDevice[] = await Promise.all(
    devices.map(async (d) => {
      const latest = d.sensorReadings[0] ?? null;
      const health = await computeFilterHealth(d, latest?.pressure ?? null);
      const offlineAfterMs =
        d.reportingIntervalMin * OFFLINE_AFTER_MISSED_CHECKINS * 60 * 1000;
      return {
        id: d.id,
        deviceId: d.deviceId,
        name: d.name,
        ownerEmail: d.user?.email ?? null,
        firmware: d.firmware,
        online: now - new Date(d.lastSeen).getTime() < offlineAfterMs,
        lastSeen: d.lastSeen.toISOString(),
        pressure: latest?.pressure ?? null,
        temperature: latest?.temperature ?? null,
        batteryPct: d.batteryPct,
        blowerType: d.blowerType,
        filterStatus: health.status,
        filterLifePct: health.lifePct,
        extraCostCents: Math.round(d.extraEnergyCostCents),
      };
    })
  );

  const trend: FleetTrendPoint[] = trendRows.map((r) => ({
    day: r.day.toISOString().slice(0, 10),
    readings: Number(r.readings),
    devices: Number(r.devices),
    avgPressure:
      r.avg_pressure === null ? null : Math.round(r.avg_pressure * 10) / 10,
  }));

  const online = fleet.filter((d) => d.online).length;
  const lowBattery = fleet.filter(
    (d) => d.batteryPct !== null && d.batteryPct <= 20
  ).length;
  const needReplace = fleet.filter((d) => d.filterStatus === "replace_now").length;

  const stats = [
    { label: "Devices", value: String(fleet.length) },
    { label: "Online", value: `${online} / ${fleet.length}` },
    { label: "Users", value: String(userCount) },
    { label: "AutoShip members", value: String(autoShipUsers) },
    { label: "Open alerts", value: String(pendingAlerts) },
    { label: "Readings · 24 h", value: readings24h.toLocaleString() },
    { label: "Low battery", value: String(lowBattery) },
    { label: "Filters due", value: String(needReplace) },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white">
      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-blue-400 mb-1">
              Admin
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold">Fleet Dashboard</h1>
            <p className="text-gray-400 mt-1">
              Every monitor across every account, and how the fleet is trending.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/orders"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm"
            >
              📦 Order Queue
            </Link>
            <Link
              href="/admin/labels"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm"
            >
              🏷️ QR Labels
            </Link>
            <Link
              href="/admin/firmware"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm"
            >
              ⬆️ Firmware
            </Link>
          </div>
        </div>

        {/* Fleet stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10"
            >
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <AdminFleet devices={fleet} trend={trend} />
      </div>
    </main>
  );
}
