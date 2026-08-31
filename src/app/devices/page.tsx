import Link from "next/link";
import { auth } from "~/server/auth";
import { DeviceList } from "~/app/_components/device-list";
import { HydrateClient } from "~/trpc/server";

export default async function DevicesPage() {
  const session = await auth();

  // Redirect to sign in if not authenticated
  if (!session?.user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-paper">
        <div className="container flex flex-col items-center justify-center gap-8 px-4 py-16 text-center">
          <h1 className="font-display text-4xl font-normal tracking-tight text-ink sm:text-5xl">
            Sign in required
          </h1>
          <p className="text-lg text-body">Please sign in to manage your devices</p>
          <Link
            href="/api/auth/signin"
            className="rounded-full bg-ink px-8 py-3 text-sm font-semibold text-paper no-underline transition hover:bg-ink/85"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col bg-paper">
        <div className="container mx-auto px-4 py-10">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-faint mb-4">
              <Link href="/dashboard" className="hover:text-ink transition-colors">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-ink">Devices</span>
            </div>

            <div className="flex justify-between items-center">
              <div>
                <h1 className="font-display text-3xl font-normal tracking-tight text-ink sm:text-4xl mb-2">Device Management</h1>
                <p className="text-body">Monitor and manage all your Smart Filter devices</p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="rounded-full border border-mist bg-card px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist/60"
                >
                  Back to Dashboard
                </Link>
                <Link
                  href="/api/auth/signout"
                  className="rounded-full border border-mist bg-card px-4 py-2 text-sm font-semibold text-faint transition hover:bg-mist/60 hover:text-ink"
                >
                  Sign out
                </Link>
              </div>
            </div>
          </div>

          {/* Device List Component */}
          <div className="rounded-[24px] border border-mist bg-card p-8">
            <DeviceList />
          </div>

          {/* Help Section */}
          <div className="mt-8 grid md:grid-cols-2 gap-6">
            <div className="rounded-[24px] border border-mist bg-card p-6">
              <h3 className="text-lg font-semibold text-ink mb-3">📱 How to Add a Device</h3>
              <ol className="space-y-2 text-sm text-body">
                <li>1. Power on your Smart Filter device</li>
                <li>2. Connect it to WiFi using the device's setup mode</li>
                <li>3. The device will display a QR code or setup link</li>
                <li>4. Scan the QR code or click the link to add the device</li>
              </ol>
            </div>

            <div className="rounded-[24px] border border-mist bg-card p-6">
              <h3 className="text-lg font-semibold text-ink mb-3">🔧 Device Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sage"></span>
                  <span className="text-body"><strong className="text-ink">Active:</strong> Device is online and sending data</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-whisper"></span>
                  <span className="text-body"><strong className="text-ink">Offline:</strong> Device hasn't sent data recently</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-clay"></span>
                  <span className="text-body"><strong className="text-ink">Pending:</strong> Device registered but not linked</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span className="text-body"><strong className="text-ink">Error:</strong> Device reported an error</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}
