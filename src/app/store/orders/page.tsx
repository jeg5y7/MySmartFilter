import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { format } from "date-fns";

export default async function OrdersPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  const orders = await db.order.findMany({
    where: { userId: session.user.id },
    include: {
      orderItems: {
        include: {
          filterProduct: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(priceInCents / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-sagemist text-sage-deep";
      case "shipped":
        return "bg-sagemist text-sage-deep";
      case "delivered":
        return "bg-mist text-body";
      case "cancelled":
        return "bg-red-50 text-red-600";
      default:
        return "bg-clay/10 text-clay";
    }
  };

  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-faint mb-4">
            <Link href="/dashboard" className="hover:text-ink transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <Link href="/store" className="hover:text-ink transition-colors">
              Store
            </Link>
            <span>/</span>
            <span className="text-ink">Orders</span>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-ink mb-2">Order History</h1>
              <p className="text-body">Track your filter purchases and shipments</p>
            </div>

            <Link
              href="/store"
              className="rounded-full bg-sage px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sage-deep"
            >
              Shop Filters
            </Link>
          </div>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="rounded-[24px] border border-mist bg-card p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-2xl font-semibold text-ink mb-2">No Orders Yet</h2>
            <p className="text-body mb-6">
              You haven&apos;t placed any orders yet. Browse our filter selection!
            </p>
            <Link
              href="/store"
              className="inline-block rounded-full bg-sage px-6 py-3 text-sm font-semibold text-white transition hover:bg-sage-deep"
            >
              Shop Now
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-[24px] border border-mist bg-card overflow-hidden"
              >
                {/* Order Header */}
                <div className="p-6 border-b border-mist flex flex-wrap justify-between items-start gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                      {order.isAutoOrder && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-mist text-body">
                          Auto-Order
                        </span>
                      )}
                    </div>
                    <p className="text-faint text-sm">
                      Order placed {format(new Date(order.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl text-ink">{formatPrice(order.total)}</p>
                    <p className="text-faint text-xs">Order #{order.id.slice(-8)}</p>
                  </div>
                </div>

                {/* Order Items */}
                <div className="p-6">
                  <div className="space-y-4">
                    {order.orderItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-mist rounded-2xl flex items-center justify-center">
                          <span className="text-2xl">🔲</span>
                        </div>
                        <div className="flex-grow">
                          <h4 className="text-ink font-medium">
                            {item.filterProduct.name}
                          </h4>
                          <p className="text-body text-sm">
                            {item.filterProduct.size}
                            {item.filterProduct.merv && ` • MERV ${item.filterProduct.merv}`}
                          </p>
                          <p className="text-faint text-sm">Qty: {item.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-ink font-medium">
                            {formatPrice(item.priceAtPurchase * item.quantity)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Shipping Info */}
                  {order.shippingAddress1 && (
                    <div className="mt-6 pt-6 border-t border-mist">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-faint mb-2">Ships to</h4>
                      <p className="text-body text-sm">
                        {order.shippingName}
                        <br />
                        {order.shippingAddress1}
                        {order.shippingAddress2 && (
                          <>
                            <br />
                            {order.shippingAddress2}
                          </>
                        )}
                        <br />
                        {order.shippingCity}, {order.shippingState} {order.shippingZip}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
