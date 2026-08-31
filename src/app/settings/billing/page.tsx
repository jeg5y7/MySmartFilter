import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "~/server/auth";
import { BillingSettings } from "~/app/_components/billing-settings";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");

  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-faint mb-4">
            <Link href="/dashboard" className="hover:text-ink transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-ink">Billing</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-ink mb-2">
            Billing
          </h1>
          <p className="text-body">
            The card and address used when a replacement filter is ordered
            automatically.
          </p>
        </div>
        <BillingSettings />
      </div>
    </main>
  );
}
