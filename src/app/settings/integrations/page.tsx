import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { IntegrationsPanel } from "~/app/_components/integrations-panel";

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin");

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white">
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Integrations</h1>
          <p className="text-gray-400">
            Manage API keys and webhooks to connect SmartFilter with external services.
          </p>
        </div>
        <IntegrationsPanel />
      </div>
    </main>
  );
}
