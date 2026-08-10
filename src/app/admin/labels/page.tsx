import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { LabelSheet } from "~/app/_components/label-sheet";

export const dynamic = "force-dynamic";

/**
 * Admin QR label sheet: one unique QR per monitor, encoding
 * https://www.mysmartfilter.com/setup/device?id=<deviceId>.
 * Print onto sticker paper and apply one label per unit.
 */
export default async function AdminLabelsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!me?.isAdmin) notFound();

  const devices = await db.device.findMany({
    orderBy: { createdAt: "desc" },
    select: { deviceId: true, name: true },
    take: 100,
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white print:bg-white">
      <div className="container mx-auto px-4 py-10">
        <div className="print:hidden mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
            <Link href="/admin" className="hover:text-white transition-colors">
              Admin
            </Link>
            <span>/</span>
            <span className="text-white">QR Labels</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Device QR Labels</h1>
          <p className="text-gray-400 max-w-2xl">
            Each label&apos;s QR opens the setup page with that monitor&apos;s ID
            prefilled. Pick registered devices or paste new IDs (one per line),
            then print onto sticker paper.
          </p>
        </div>

        <LabelSheet knownDeviceIds={devices.map((d) => d.deviceId)} />
      </div>
    </main>
  );
}
