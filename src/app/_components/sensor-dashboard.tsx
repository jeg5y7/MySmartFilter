import { api } from "~/trpc/server";
import { cToF } from "~/lib/units";
import { LocalTime } from "~/app/_components/local-time";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { computeFilterHealth } from "~/lib/filter-health";

export async function SensorDashboard() {
  const latestReadings = await api.sensor.getLatest({ limit: 20 });
  const stats = await api.sensor.getStats({ hours: 24 });

  // Real filter status across the user's devices (worst one wins)
  const session = await auth();
  let filterValue = "No devices";
  let filterSubtitle = "Add a monitor to begin";
  let filterIcon = "✅";
  if (session?.user?.id) {
    const devices = await db.device.findMany({
      where: { userId: session.user.id },
      include: { sensorReadings: { orderBy: { timestamp: "desc" }, take: 1 } },
    });
    if (devices.length > 0) {
      const rank = { ok: 0, replace_soon: 1, replace_now: 2 } as const;
      let worst: { status: keyof typeof rank; lifePct: number | null } = {
        status: "ok",
        lifePct: null,
      };
      for (const d of devices) {
        const health = await computeFilterHealth(
          d,
          d.sensorReadings[0]?.pressure ?? null
        );
        if (
          rank[health.status] > rank[worst.status] ||
          (health.lifePct !== null &&
            (worst.lifePct === null || health.lifePct < worst.lifePct))
        ) {
          worst = { status: health.status, lifePct: health.lifePct };
        }
      }
      filterValue =
        worst.status === "replace_now"
          ? "Replace Now"
          : worst.status === "replace_soon"
            ? "Replace Soon"
            : "Good";
      filterIcon =
        worst.status === "replace_now"
          ? "🚨"
          : worst.status === "replace_soon"
            ? "⚠️"
            : "✅";
      filterSubtitle =
        worst.lifePct !== null
          ? `${worst.lifePct}% filter life left`
          : "Tracking live";
    }
  }

  return (
    <div className="w-full max-w-6xl space-y-6">
      {/* Header */}
      <div className="rounded-[24px] border border-mist bg-card p-6">
        <h2 className="text-2xl font-semibold text-ink">Filter Performance Dashboard</h2>
        <p className="text-body">Real-time filter pressure differential and system health monitoring</p>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard
            title="Total Readings"
            value={stats.count.toString()}
            subtitle="Last 24 hours"
            icon="📊"
          />
          <StatCard
            title="Avg Differential Pressure"
            value={
              stats.runningPressure
                ? `${stats.runningPressure.avg.toFixed(1)} Pa`
                : "—"
            }
            subtitle={
              stats.runningPressure
                ? `While running · peak ${stats.runningPressure.max.toFixed(1)} Pa`
                : "No blower runtime in last 24 h"
            }
            icon="🔄"
          />
          <StatCard
            title="Avg Temperature"
            value={`${cToF(stats.temperature.avg).toFixed(1)} °F`}
            subtitle={`Range: ${stats.temperature.min.toFixed(1)} - ${stats.temperature.max.toFixed(1)}`}
            icon="🌡️"
          />
          <StatCard
            title="Filter Status"
            value={filterValue}
            subtitle={filterSubtitle}
            icon={filterIcon}
          />
        </div>
      )}

      {/* Chart Section */}
      {latestReadings.length > 0 && (
        <div className="rounded-[24px] border border-mist bg-card p-6">
        <h3 className="mb-4 text-xl font-semibold text-ink">Pressure Trend</h3>
          <SensorChart data={latestReadings} />
        </div>
      )}

      {/* Latest Readings Grid */}
      <div className="rounded-[24px] border border-mist bg-card p-6">
        <h3 className="mb-4 text-xl font-semibold text-ink">Latest Filter Readings</h3>

        {latestReadings.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔧</div>
            <p className="text-xl text-body mb-2">No filter data yet</p>
            <p className="text-faint">Connect your Smart Filter monitor to start tracking performance</p>
            <div className="mt-6 rounded-2xl border border-mist bg-paper p-4 text-left">
              <p className="text-sm text-body mb-2">Quick Setup:</p>
              <ol className="text-sm text-faint space-y-1">
                <li>1. Install the smart filter monitor next to your furnace</li>
                <li>2. Connect it to your home WiFi from your phone</li>
                <li>3. Scan the QR label to link it to your account</li>
                <li>4. It starts tracking your filter automatically</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {latestReadings.map((reading) => (
              <ReadingCard key={reading.id} reading={reading} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Statistics Card Component
function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-mist bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-faint">{title}</p>
          <p className="text-2xl font-bold text-ink">{value}</p>
          <p className="text-xs text-faint">{subtitle}</p>
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </div>
  );
}

// Reading Card Component
function ReadingCard({ reading }: { reading: { id: string; deviceId: string; pressure: number; temperature: number; timestamp: Date } }) {
  return (
    <div className="rounded-2xl border border-mist bg-paper p-4 hover:bg-mist/40 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <p className="text-sm text-ink font-medium">
            {reading.deviceId}
          </p>
          <p className="text-xs text-faint">
            <LocalTime iso={new Date(reading.timestamp).toISOString()} mode="time" />
          </p>
        </div>
        <div className="text-sage">●</div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-faint">Differential:</span>
          <span className="font-semibold text-ink">{reading.pressure.toFixed(2)} Pa</span>
        </div>
        <div className="flex justify-between">
          <span className="text-faint">Temperature:</span>
          <span className="font-semibold text-ink">{cToF(reading.temperature).toFixed(1)} °F</span>
        </div>
      </div>

      <div className="mt-3 h-1 bg-mist rounded-full overflow-hidden">
        <div
          className="h-full bg-sage"
          style={{ width: `${Math.min((reading.pressure / 1100) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

// Chart Component (simplified for now, will enhance with Recharts)
function SensorChart({ data }: { data: unknown[] }) {
  return (
    <div className="h-64 rounded-2xl border border-mist bg-paper p-4 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-2">📈</div>
        <p className="text-body">Filter life prediction chart coming soon</p>
        <p className="text-sm text-faint mt-1">
          {data.length} data points ready for visualization
        </p>
      </div>
    </div>
  );
}
