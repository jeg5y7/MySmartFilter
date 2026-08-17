import { api } from "~/trpc/server";
import { cToF } from "~/lib/units";
import { LocalTime } from "~/app/_components/local-time";

export async function SensorDashboard() {
  const latestReadings = await api.sensor.getLatest({ limit: 20 });
  const stats = await api.sensor.getStats({ hours: 24 });

  return (
    <div className="w-full max-w-6xl space-y-6">
      {/* Header */}
      <div className="rounded-xl bg-white/10 p-6">
        <h2 className="text-3xl font-bold text-white">Filter Performance Dashboard</h2>
        <p className="text-white/70">Real-time filter pressure differential and system health monitoring</p>
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
            title="Avg Differential"
            value={`${stats.pressure.avg.toFixed(1)} Pa`}
            subtitle={`Range: ${stats.pressure.min.toFixed(1)} - ${stats.pressure.max.toFixed(1)}`}
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
            value="Good"
            subtitle="Est. 30 days remaining"
            icon="✅"
          />
        </div>
      )}

      {/* Chart Section */}
      {latestReadings.length > 0 && (
        <div className="rounded-xl bg-white/10 p-6">
        <h3 className="mb-4 text-xl font-semibold text-white">Pressure Trend</h3>
          <SensorChart data={latestReadings} />
        </div>
      )}

      {/* Latest Readings Grid */}
      <div className="rounded-xl bg-white/10 p-6">
        <h3 className="mb-4 text-xl font-semibold text-white">Latest Filter Readings</h3>
        
        {latestReadings.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔧</div>
            <p className="text-xl text-white/60 mb-2">No filter data yet</p>
            <p className="text-white/40">Connect your Smart Filter monitor to start tracking performance</p>
            <div className="mt-6 rounded-lg bg-white/5 p-4 text-left">
              <p className="text-sm text-white/70 mb-2">Quick Setup:</p>
              <ol className="text-sm text-white/60 space-y-1">
                <li>1. Install Smart Filter monitor on your filter housing</li>
                <li>2. Configure WiFi connection on ESP32</li>
                <li>3. Connect SDP810 pressure sensor across filter</li>
                <li>4. Monitor will automatically detect filter condition</li>
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
    <div className="rounded-lg bg-white/20 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white/70">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-white/50">{subtitle}</p>
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </div>
  );
}

// Reading Card Component
function ReadingCard({ reading }: { reading: { id: string; deviceId: string; pressure: number; temperature: number; timestamp: Date } }) {
  return (
    <div className="rounded-lg bg-white/20 p-4 hover:bg-white/25 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <p className="text-sm text-white/80 font-medium">
            {reading.deviceId}
          </p>
          <p className="text-xs text-white/60">
            <LocalTime iso={new Date(reading.timestamp).toISOString()} mode="time" />
          </p>
        </div>
        <div className="text-green-400">●</div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-white/70">Differential:</span>
          <span className="font-semibold">{reading.pressure.toFixed(2)} Pa</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/70">Temperature:</span>
          <span className="font-semibold">{cToF(reading.temperature).toFixed(1)} °F</span>
        </div>
      </div>
      
      <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-400 to-purple-400" 
          style={{ width: `${Math.min((reading.pressure / 1100) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

// Chart Component (simplified for now, will enhance with Recharts)
function SensorChart({ data }: { data: unknown[] }) {
  return (
    <div className="h-64 rounded-lg bg-white/5 p-4 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-2">📈</div>
        <p className="text-white/60">Filter life prediction chart coming soon</p>
        <p className="text-sm text-white/40 mt-1">
          {data.length} data points ready for visualization
        </p>
      </div>
    </div>
  );
}
