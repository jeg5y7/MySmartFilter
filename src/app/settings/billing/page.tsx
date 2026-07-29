import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "~/server/auth";
import { BillingSettings } from "~/app/_components/billing-settings";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white">
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-white">Billing</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Billing</h1>
          <p className="text-gray-400">
            The card and address used when a replacement filter is ordered
            automatically.
          </p>
        </div>
        <BillingSettings />
      </div>
    </main>
  );
}
