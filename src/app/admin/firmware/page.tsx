import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { FirmwareManager } from "~/app/_components/firmware-manager";

export const dynamic = "force-dynamic";

/**
 * Admin firmware releases: publish a version, canary it on a slice of the
 * fleet, ramp the rollout, or kill it instantly.
 */
export default async function AdminFirmwarePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!me?.isAdmin) notFound();

  const [releases, versionCounts] = await Promise.all([
    db.firmwareRelease.findMany({ orderBy: { createdAt: "desc" } }),
    db.device.groupBy({
      by: ["firmware"],
      _count: { _all: true },
    }),
  ]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white">
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
            <Link href="/admin" className="hover:text-white transition-colors">
              Admin
            </Link>
            <span>/</span>
            <span className="text-white">Firmware</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Firmware Releases</h1>
          <p className="text-gray-400 max-w-2xl">
            Devices check for updates on boot and every 24 hours. New releases
            default to a 1% canary — ramp the rollout as the canary proves
            healthy, or deactivate to stop serving it instantly. A release
            that fails on-device rolls itself back automatically.
          </p>
        </div>

        <FirmwareManager
          initialReleases={releases.map((r) => ({
            id: r.id,
            version: r.version,
            binaryUrl: r.binaryUrl,
            releaseNotes: r.releaseNotes,
            isActive: r.isActive,
            rolloutPct: r.rolloutPct,
            createdAt: r.createdAt.toISOString(),
          }))}
          fleetVersions={versionCounts.map((v) => ({
            version: v.firmware ?? "unknown",
            count: v._count._all,
          }))}
        />
      </div>
    </main>
  );
}
