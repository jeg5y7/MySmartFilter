import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { LocalTime } from "~/app/_components/local-time";

export const dynamic = "force-dynamic";

/**
 * Admin user directory: every account with email, devices, and AutoShip
 * status, searchable by email or name. Only visible to isAdmin users.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!me?.isAdmin) notFound();

  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const users = await db.user.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { id: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      shippingCity: true,
      shippingState: true,
      devices: {
        select: { deviceId: true, name: true, lastSeen: true, status: true },
      },
      filterPreferences: {
        where: { autoOrderEnabled: true },
        select: { id: true },
        take: 1,
      },
      _count: { select: { orders: true } },
    },
  });

  const total = await db.user.count();

  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-faint mb-4">
              <Link href="/admin" className="hover:text-ink transition-colors">
                Admin
              </Link>
              <span>/</span>
              <span className="text-ink">Users</span>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-clay mb-1">
              Admin
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-ink">
              Users
            </h1>
            <p className="text-body mt-1">
              {query
                ? `${users.length} match${users.length === 1 ? "" : "es"} for “${query}” (${total} accounts total)`
                : `${total} account${total === 1 ? "" : "s"}${total > 100 ? " — showing newest 100" : ""}`}
            </p>
          </div>
          <form method="get" className="flex gap-2">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search email or name…"
              className="w-64 rounded-full border border-mist bg-card px-4 py-2.5 text-sm text-ink placeholder:text-whisper focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20"
            />
            <button
              type="submit"
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-ink/85"
            >
              Search
            </button>
          </form>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-mist bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-xs font-semibold text-faint uppercase tracking-wide border-b border-mist">
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-3 py-3 font-medium">Location</th>
                  <th className="px-3 py-3 font-medium">Plan</th>
                  <th className="px-3 py-3 font-medium">Devices</th>
                  <th className="px-3 py-3 font-medium">Orders</th>
                  <th className="px-5 py-3 font-medium">Last device check-in</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const lastSeen = u.devices.reduce<Date | null>(
                    (acc, d) =>
                      d.lastSeen && (!acc || d.lastSeen > acc) ? d.lastSeen : acc,
                    null
                  );
                  const autoShip = u.filterPreferences.length > 0;
                  return (
                    <tr key={u.id} className="border-t border-mist hover:bg-paper align-top">
                      <td className="px-5 py-3">
                        <div className="text-ink font-medium">
                          {u.email ?? "(no email)"}
                          {u.isAdmin && (
                            <span className="ml-2 rounded-full bg-clay/10 px-2 py-0.5 text-xs font-semibold text-clay">
                              admin
                            </span>
                          )}
                        </div>
                        {u.name && <div className="text-faint text-xs">{u.name}</div>}
                      </td>
                      <td className="px-3 py-3 text-body">
                        {u.shippingCity
                          ? `${u.shippingCity}, ${u.shippingState ?? ""}`
                          : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            autoShip
                              ? "bg-sagemist text-sage-deep"
                              : "bg-mist text-body"
                          }`}
                        >
                          {autoShip ? "AutoShip" : "Free"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {u.devices.length === 0 ? (
                          <span className="text-faint">—</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {u.devices.map((d) => (
                              <span
                                key={d.deviceId}
                                className="inline-block rounded bg-mist px-1.5 py-0.5 text-xs font-mono text-body"
                              >
                                {d.deviceId}
                                {d.status.startsWith("error") ? " ⚠" : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-body">{u._count.orders}</td>
                      <td className="px-5 py-3 text-body">
                        {lastSeen ? <LocalTime iso={lastSeen.toISOString()} /> : "—"}
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-faint">
                      No users match “{query}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
