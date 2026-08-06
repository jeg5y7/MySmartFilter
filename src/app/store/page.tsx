import Link from "next/link";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { FilterProductCard } from "~/app/_components/filter-product-card";
import { MonitorProductCard } from "~/app/_components/monitor-product-card";

export default async function StorePage() {
  const session = await auth();
  const allProducts = await db.filterProduct.findMany({
    where: { inStock: true },
    orderBy: [{ size: "asc" }, { merv: "asc" }],
  });
  const monitor = allProducts.find((p) => p.productType === "monitor") ?? null;
  const products = allProducts.filter((p) => p.productType !== "monitor");

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
            <span className="text-white">Filter Store</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Store</h1>
              <p className="text-gray-400">
                The smart filter monitor, and the filters it reorders for you
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {session?.user && (
                <Link
                  href="/store/orders"
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm"
                >
                  Order History
                </Link>
              )}
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* The monitor itself */}
        {monitor && (
          <MonitorProductCard product={monitor} isLoggedIn={!!session?.user} />
        )}

        {/* Replacement filters */}
        <h2 className="text-2xl font-bold text-white mb-4">Replacement Filters</h2>

        {/* Filter Size Guide */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-300 mb-2">
            📏 How to Find Your Filter Size
          </h3>
          <p className="text-gray-300 text-sm">
            Check the side of your current filter for dimensions (e.g., 20x20x1). The format is
            Width × Height × Depth in inches. If you&apos;ve set up a Smart Filter device, we can
            remember your preferred size for automatic reorders.
          </p>
        </div>

        {/* Products Grid */}
        {products.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-12 border border-white/10 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-2xl font-bold text-white mb-2">Coming Soon</h2>
            <p className="text-gray-400">
              We&apos;re stocking up on filters. Check back soon!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <FilterProductCard
                key={product.id}
                product={product}
                isLoggedIn={!!session?.user}
              />
            ))}
          </div>
        )}

        {/* Auto-Order Info */}
        {session?.user && (
          <div className="mt-12 bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-3">
              🔄 Auto-Order Feature
            </h3>
            <p className="text-gray-300 text-sm mb-4">
              Enable auto-order on your devices and we&apos;ll automatically order a replacement
              filter when your Smart Filter detects reduced airflow. You&apos;ll receive an email
              notification before any order is placed, giving you time to cancel if needed.
            </p>
            <Link
              href="/devices"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
            >
              Configure auto-order in Device Settings →
            </Link>
          </div>
        )}

        {/* Not logged in prompt */}
        {!session?.user && (
          <div className="mt-12 bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10 text-center">
            <h3 className="text-lg font-semibold text-white mb-3">
              Sign in to Purchase
            </h3>
            <p className="text-gray-300 text-sm mb-4">
              Create an account or sign in to purchase filters and enable automatic reordering.
            </p>
            <Link
              href="/api/auth/signin"
              className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
            >
              Sign In
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
