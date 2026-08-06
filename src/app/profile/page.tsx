import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { ProfileSettings } from "~/app/_components/profile-settings";
import { BillingSettings } from "~/app/_components/billing-settings";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const filterProducts = await db.filterProduct.findMany({
    where: { inStock: true, productType: "filter" },
    orderBy: [{ size: "asc" }, { merv: "asc" }],
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white">
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-white">My Profile</span>
          </div>
          <h1 className="text-4xl font-bold mb-2">My Profile</h1>
          <p className="text-gray-400">
            Your account, filter preferences, and payment details in one place.
          </p>
        </div>

        <div className="space-y-6">
          <ProfileSettings
            filterProducts={filterProducts.map((p) => ({
              id: p.id,
              size: p.size,
              name: p.name,
              merv: p.merv,
              price: p.price,
            }))}
          />

          {/* Payment method + shipping address (shared with /settings/billing) */}
          <BillingSettings />
        </div>
      </div>
    </main>
  );
}
