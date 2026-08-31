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
    <main className="min-h-screen bg-paper">
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-faint mb-4">
            <Link href="/dashboard" className="hover:text-ink transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-ink">My Profile</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-ink mb-2">
            My Profile
          </h1>
          <p className="text-body">
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
