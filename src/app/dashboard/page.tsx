import Link from "next/link";
import { auth } from "~/server/auth";
import { SensorDashboard } from "~/app/_components/sensor-dashboard";
import { UserProfile } from "~/app/_components/user-profile";
import { HydrateClient } from "~/trpc/server";

export default async function DashboardPage() {
  const session = await auth();
  
  // Redirect to sign in if not authenticated
  if (!session?.user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            Sign in required
          </h1>
          <p className="text-2xl text-white/70">Please sign in to access the dashboard</p>
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
      <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center py-10">
          <div className="flex w-full justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold">My Smart Filter</h1>
              <p className="text-white/70">Welcome, {session.user.name ?? session.user.email}</p>
            </div>
            <div className="flex items-center gap-4">
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
              <UserProfile />
            </div>
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}
