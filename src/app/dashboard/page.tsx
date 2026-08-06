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
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Sign in required
          </h1>
          <p className="text-xl sm:text-2xl text-white/70">Please sign in to access the dashboard</p>
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
      <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white">
        <div className="container flex flex-col items-center px-4 py-10">
          <div className="flex w-full flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold">My Smart Filter</h1>
              <p className="text-white/70">Welcome, {session.user.name ?? session.user.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Link
                href="/profile"
                className="rounded-full bg-cyan-600/20 px-4 py-2 text-sm font-semibold no-underline transition hover:bg-cyan-600/30 text-cyan-300 hover:text-cyan-200 flex items-center gap-2"
              >
                <span>👤</span>
                My Profile
              </Link>
              <Link
                href="/store"
                className="rounded-full bg-green-600/20 px-4 py-2 text-sm font-semibold no-underline transition hover:bg-green-600/30 text-green-300 hover:text-green-200 flex items-center gap-2"
              >
                <span>🛒</span>
                Filter Store
              </Link>
              <Link 
                href="/devices"
                className="rounded-full bg-blue-600/20 px-4 py-2 text-sm font-semibold no-underline transition hover:bg-blue-600/30 text-blue-300 hover:text-blue-200 flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13 7H7v6h6V7z" />
                  <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2z" clipRule="evenodd" />
                </svg>
                Manage Devices
              </Link>
              <Link
                href="/settings/integrations"
                className="rounded-full bg-purple-600/20 px-4 py-2 text-sm font-semibold no-underline transition hover:bg-purple-600/30 text-purple-300 hover:text-purple-200 flex items-center gap-2"
              >
                <span>🔌</span>
                Integrations
              </Link>
              <Link 
                href="/api/auth/signout"
                className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold no-underline transition hover:bg-white/20"
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
