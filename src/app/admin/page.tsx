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

  // Waitlist signups (table self-creates on first signup — may not exist yet)
  let waitlistCount = 0;
  let recentSignups: { email: string; zip: string | null; createdAt: Date }[] =
    [];
  try {
    [waitlistCount, recentSignups] = await Promise.all([
      db.waitlist.count(),
      db.waitlist.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { email: true, zip: true, createdAt: true },
      }),
    ]);
  } catch {
    // no signups yet
  }

  const stats = [
    { label: "Devices", value: String(fleet.length) },
    { label: "Online", value: `${online} / ${fleet.length}` },
    { label: "Users", value: String(userCount) },
    { label: "AutoShip members", value: String(autoShipUsers) },
    { label: "Open alerts", value: String(pendingAlerts) },
    { label: "Readings · 24 h", value: readings24h.toLocaleString() },
    { label: "Low battery", value: String(lowBattery) },
    { label: "Filters due", value: String(needReplace) },
    { label: "Waitlist", value: String(waitlistCount) },
  ];

  return (
    <main className="min-h-screen bg-paper">
      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-clay mb-1">
              Admin
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-ink">Fleet Dashboard</h1>
            <p className="text-body mt-1">
              Every monitor across every account, and how the fleet is trending.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/orders"
              className="rounded-full border border-mist bg-card px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist/60"
            >
              📦 Order Queue
            </Link>
            <Link
              href="/admin/labels"
              className="rounded-full border border-mist bg-card px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist/60"
            >
              🏷️ QR Labels
            </Link>
            <Link
              href="/admin/firmware"
              className="rounded-full border border-mist bg-card px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist/60"
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
              className="rounded-2xl border border-mist bg-card p-4"
            >
              <div className="text-2xl font-bold text-ink">{s.value}</div>
              <div className="text-xs text-faint mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <AdminFleet devices={fleet} trend={trend} />

        {/* ── Launch waitlist ─────────────────────────────────────────────── */}
        <div className="rounded-[24px] border border-mist bg-card mt-8 p-5">
          <h2 className="text-lg font-semibold text-ink mb-1">
            Launch Waitlist{" "}
            <span className="text-sm font-normal text-faint">
              ({waitlistCount} signups)
            </span>
          </h2>
          {recentSignups.length === 0 ? (
            <p className="text-sm text-faint">
              No signups yet — the form is live on the landing page.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[420px]">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-faint border-b border-mist">
                    <th className="py-2 pr-4 font-medium">Email</th>
                    <th className="py-2 pr-4 font-medium">ZIP</th>
                    <th className="py-2 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSignups.map((w) => (
                    <tr key={w.email} className="border-t border-mist">
                      <td className="py-2 pr-4 text-body">{w.email}</td>
                      <td className="py-2 pr-4 text-faint">{w.zip ?? "—"}</td>
                      <td className="py-2 text-faint">
                        {w.createdAt.toISOString().slice(0, 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
