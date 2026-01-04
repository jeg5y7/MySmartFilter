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
        return "bg-green-500/20 text-green-300";
      case "shipped":
        return "bg-blue-500/20 text-blue-300";
      case "delivered":
        return "bg-purple-500/20 text-purple-300";
      case "cancelled":
        return "bg-red-500/20 text-red-300";
      default:
        return "bg-yellow-500/20 text-yellow-300";
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white">
      <div className="container mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <Link href="/store" className="hover:text-white transition-colors">
              Store
            </Link>
            <span>/</span>
            <span className="text-white">Orders</span>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Order History</h1>
              <p className="text-gray-400">Track your filter purchases and shipments</p>
            </div>

            <Link
              href="/store"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
            >
              Shop Filters
            </Link>
          </div>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-12 border border-white/10 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-2xl font-bold text-white mb-2">No Orders Yet</h2>
            <p className="text-gray-400 mb-6">
              You haven&apos;t placed any orders yet. Browse our filter selection!
            </p>
            <Link
              href="/store"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
            >
              Shop Now
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 overflow-hidden"
              >
                {/* Order Header */}
                <div className="p-6 border-b border-white/10 flex flex-wrap justify-between items-start gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                      {order.isAutoOrder && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300">
                          Auto-Order
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm">
                      Order placed {format(new Date(order.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">{formatPrice(order.total)}</p>
                    <p className="text-gray-500 text-xs">Order #{order.id.slice(-8)}</p>
                  </div>
                </div>

                {/* Order Items */}
                <div className="p-6">
                  <div className="space-y-4">
                    {order.orderItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white/10 rounded-lg flex items-center justify-center">
                          <span className="text-2xl">🔲</span>
                        </div>
                        <div className="flex-grow">
                          <h4 className="text-white font-medium">
                            {item.filterProduct.name}
                          </h4>
                          <p className="text-gray-400 text-sm">
                            {item.filterProduct.size}
                            {item.filterProduct.merv && ` • MERV ${item.filterProduct.merv}`}
                          </p>
                          <p className="text-gray-500 text-sm">Qty: {item.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-medium">
                            {formatPrice(item.priceAtPurchase * item.quantity)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Shipping Info */}
                  {order.shippingAddress1 && (
                    <div className="mt-6 pt-6 border-t border-white/10">
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Ships to</h4>
                      <p className="text-gray-300 text-sm">
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
