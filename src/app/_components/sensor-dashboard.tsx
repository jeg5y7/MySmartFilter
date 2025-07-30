import { api } from "~/trpc/server";

export async function SensorDashboard() {
  const latestReadings = await api.sensor.getLatest.query({ limit: 20 });

  return (
    <div className="w-full max-w-4xl rounded-xl bg-white/10 p-4">
      <h2 className="text-2xl font-bold text-white">Sensor Dashboard</h2>
      
      {latestReadings.length === 0 ? (
        <p className="mt-4 text-center text-white/60">No sensor data yet</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {latestReadings.map((reading) => (
            <div key={reading.id} className="rounded-lg bg-white/20 p-4">
              <p className="text-sm text-white/80">
                Device: {reading.deviceId}
              </p>
              <p className="text-lg font-semibold">
                Pressure: {reading.pressure.toFixed(2)} Pa
              </p>
              <p className="text-lg font-semibold">
                Temp: {reading.temperature.toFixed(2)} °C
              </p>
              <p className="text-xs text-white/60">
                {new Date(reading.timestamp).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
