import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { OrdersQueue } from "~/app/_components/orders-queue";

export const dynamic = "force-dynamic";

/**
 * Admin dropship queue: paid orders waiting to ship, plus recent shipments.
 * Only visible to users with isAdmin = true.
 */
export default async function AdminOrdersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!me?.isAdmin) notFound();

  const orders = await db.order.findMany({
    where: { status: { in: ["paid", "pending", "shipped"] } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      user: { select: { email: true, name: true } },
      orderItems: { include: { filterProduct: true } },
    },
  });

  const queue = orders.map((o) => ({
    id: o.id,
    status: o.status,
    isAutoOrder: o.isAutoOrder,
    createdAt: o.createdAt.toISOString(),
    total: o.total,
    trackingNumber: o.trackingNumber,
    customerEmail: o.user.email,
    customerName: o.user.name,
    shippingName: o.shippingName,
    shippingAddress1: o.shippingAddress1,
    shippingAddress2: o.shippingAddress2,
    shippingCity: o.shippingCity,
    shippingState: o.shippingState,
    shippingZip: o.shippingZip,
    items: o.orderItems.map((i) => ({
      name: i.filterProduct.name,
      size: i.filterProduct.size,
      sku: i.filterProduct.sku,
      quantity: i.quantity,
    })),
  }));

  return (
    <main className="flex min-h-screen flex-col bg-paper">
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-faint mb-4">
            <Link href="/admin" className="hover:text-ink transition-colors">
              Admin
            </Link>
            <span>/</span>
            <span className="text-ink">Order Queue</span>
          </div>
          <h1 className="font-display text-4xl font-normal tracking-tight text-ink mb-2">Order Queue</h1>
          <p className="text-body">
            Paid orders ready to dropship. Mark shipped with a tracking number
            to notify the customer.
          </p>
        </div>
        <OrdersQueue orders={queue} />
      </div>
    </main>
  );
}
