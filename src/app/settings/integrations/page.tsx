import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { IntegrationsPanel } from "~/app/_components/integrations-panel";
import { NestCard } from "~/app/_components/nest-card";

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");

  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-ink mb-2">
            Integrations
          </h1>
          <p className="text-body">
            Manage API keys and webhooks to connect SmartFilter with external services.
          </p>
        </div>
        <div className="mb-6">
          {/* useSearchParams inside needs a Suspense boundary for prerender */}
          <Suspense fallback={null}>
            <NestCard />
          </Suspense>
        </div>
        <IntegrationsPanel />
      </div>
    </main>
  );
}
