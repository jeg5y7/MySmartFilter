import Link from "next/link";
import { auth } from "~/server/auth";
import { SensorDashboard } from "~/app/_components/sensor-dashboard";
import { ProfileCard } from "~/app/_components/profile-card";
import { HydrateClient } from "~/trpc/server";

export default async function DashboardPage() {
  const session = await auth();
  
  // Redirect to sign in if not authenticated
  if (!session?.user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-paper">
        <div className="container flex flex-col items-center justify-center gap-8 px-4 py-16 text-center">
          <h1 className="font-display text-4xl font-normal tracking-tight text-ink sm:text-5xl">
            Sign in required
          </h1>
          <p className="text-lg text-body">Please sign in to access the dashboard</p>
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
      <main className="flex min-h-screen flex-col items-center bg-paper">
        <div className="container flex flex-col items-center px-4 py-10">
          <div className="flex w-full flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-8">
            <div>
              <h1 className="font-display text-3xl font-normal tracking-tight text-ink sm:text-4xl">Dashboard</h1>
              <p className="text-body">Welcome, {session.user.name ?? session.user.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-full border border-mist bg-card px-4 py-2 text-sm font-semibold text-ink no-underline transition hover:bg-mist/60"
              >
                My Profile
              </Link>
              <Link
                href="/store"
                className="flex items-center gap-2 rounded-full border border-mist bg-card px-4 py-2 text-sm font-semibold text-ink no-underline transition hover:bg-mist/60"
              >
                Filter Store
              </Link>
              <Link
                href="/devices"
                className="flex items-center gap-2 rounded-full border border-mist bg-card px-4 py-2 text-sm font-semibold text-ink no-underline transition hover:bg-mist/60"
              >
                Manage Devices
              </Link>
              <Link
                href="/settings/integrations"
                className="flex items-center gap-2 rounded-full border border-mist bg-card px-4 py-2 text-sm font-semibold text-ink no-underline transition hover:bg-mist/60"
              >
                Integrations
              </Link>
              <Link
                href="/api/auth/signout"
                className="rounded-full border border-mist bg-card px-4 py-2 text-sm font-semibold text-faint no-underline transition hover:bg-mist/60 hover:text-ink"
              >
                Sign out
              </Link>
            </div>
          </div>
          
          <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SensorDashboard />
            </div>
            <div className="lg:col-span-1">
              <ProfileCard />
            </div>
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}
