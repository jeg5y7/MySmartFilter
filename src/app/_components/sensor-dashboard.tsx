import { api } from "~/trpc/server";

export async function SensorDashboard() {
  const latestReadings = await api.sensor.getLatest({ limit: 20 });
  const stats = await api.sensor.getStats({ hours: 24 });

  return (
    <div className="w-full max-w-6xl space-y-6">
      {/* Header */}
      <div className="rounded-xl bg-white/10 p-6">
        <h2 className="text-3xl font-bold text-white">IoT Sensor Dashboard</h2>
        <p className="text-white/70">Real-time pressure and temperature monitoring</p>
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
            title="Avg Pressure"
            value={`${stats.pressure.avg.toFixed(1)} Pa`}
            subtitle={`Range: ${stats.pressure.min.toFixed(1)} - ${stats.pressure.max.toFixed(1)}`}
            icon="🌡️"
          />
          <StatCard
            title="Avg Temperature"
            value={`${stats.temperature.avg.toFixed(1)} °C`}
            subtitle={`Range: ${stats.temperature.min.toFixed(1)} - ${stats.temperature.max.toFixed(1)}`}
            icon="🌡️"
          />
          <StatCard
            title="Device Status"
            value="Online"
            subtitle="Last reading: now"
            icon="✅"
          />
        </div>
      )}

      {/* Chart Section */}
      {latestReadings.length > 0 && (
        <div className="rounded-xl bg-white/10 p-6">
          <h3 className="mb-4 text-xl font-semibold text-white">Recent Readings</h3>
          <SensorChart data={latestReadings} />
        </div>
      )}

      {/* Latest Readings Grid */}
      <div className="rounded-xl bg-white/10 p-6">
        <h3 className="mb-4 text-xl font-semibold text-white">Latest Sensor Data</h3>
        
        {latestReadings.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📡</div>
            <p className="text-xl text-white/60 mb-2">No sensor data yet</p>
            <p className="text-white/40">Configure your ESP32 device to start collecting data</p>
            <div className="mt-6 rounded-lg bg-white/5 p-4 text-left">
              <p className="text-sm text-white/70 mb-2">Quick Setup:</p>
              <ol className="text-sm text-white/60 space-y-1">
                <li>1. Flash the ESP32 with provided Arduino code</li>
                <li>2. Configure WiFi and User ID</li>
                <li>3. Connect SDP810 sensor via I2C</li>
                <li>4. Data will appear here automatically</li>
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
function ReadingCard({ reading }: { reading: any }) {
  const timeAgo = new Date(reading.timestamp).toLocaleTimeString();
  
  return (
    <div className="rounded-lg bg-white/20 p-4 hover:bg-white/25 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <p className="text-sm text-white/80 font-medium">
            {reading.deviceId}
          </p>
          <p className="text-xs text-white/60">{timeAgo}</p>
        </div>
        <div className="text-green-400">●</div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-white/70">Pressure:</span>
          <span className="font-semibold">{reading.pressure.toFixed(2)} Pa</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/70">Temperature:</span>
          <span className="font-semibold">{reading.temperature.toFixed(1)} °C</span>
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
function SensorChart({ data }: { data: any[] }) {
  return (
    <div className="h-64 rounded-lg bg-white/5 p-4 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-2">📈</div>
        <p className="text-white/60">Interactive charts coming soon</p>
        <p className="text-sm text-white/40 mt-1">
          {data.length} data points ready for visualization
        </p>
      </div>
    </div>
  );
}
