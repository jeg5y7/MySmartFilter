import Link from "next/link";
import { auth } from "~/server/auth";
import { DeviceList } from "~/app/_components/device-list";
import { HydrateClient } from "~/trpc/server";

export default async function DevicesPage() {
  const session = await auth();
  
  // Redirect to sign in if not authenticated
  if (!session?.user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            Sign in required
          </h1>
          <p className="text-2xl text-white/70">Please sign in to manage your devices</p>
          <Link 
            href="/api/auth/signin"
            className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white">
        <div className="container mx-auto px-4 py-10">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
              <Link href="/dashboard" className="hover:text-white transition-colors">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-white">Devices</span>
            </div>
            
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-bold text-white mb-2">Device Management</h1>
                <p className="text-gray-400">Monitor and manage all your Smart Filter devices</p>
              </div>
              
              <div className="flex items-center gap-4">
                <Link 
                  href="/dashboard"
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
                >
                  Back to Dashboard
                </Link>
                <Link 
                  href="/api/auth/signout"
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
                >
                  Sign out
                </Link>
              </div>
            </div>
          </div>

          {/* Device List Component */}
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
            <DeviceList />
          </div>

          {/* Help Section */}
          <div className="mt-8 grid md:grid-cols-2 gap-6">
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-3">📱 How to Add a Device</h3>
              <ol className="space-y-2 text-sm text-gray-300">
                <li>1. Power on your Smart Filter device</li>
                <li>2. Connect it to WiFi using the device's setup mode</li>
                <li>3. The device will display a QR code or setup link</li>
                <li>4. Scan the QR code or click the link to add the device</li>
              </ol>
            </div>
            
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-3">🔧 Device Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  <span className="text-gray-300"><strong>Active:</strong> Device is online and sending data</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                  <span className="text-gray-300"><strong>Offline:</strong> Device hasn't sent data recently</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                  <span className="text-gray-300"><strong>Pending:</strong> Device registered but not linked</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  <span className="text-gray-300"><strong>Error:</strong> Device reported an error</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}
