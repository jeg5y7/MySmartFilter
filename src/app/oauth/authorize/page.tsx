import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { validateClientRedirect } from "~/lib/oauth";

/**
 * OAuth2 consent screen for smart-home account linking.
 * Google / Alexa / SmartThings send the user here; approving issues an
 * authorization code back to the platform's redirect URI.
 */

interface AuthorizePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function ErrorCard({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10 text-center">
        <p className="text-4xl mb-4">⚠️</p>
        <h1 className="text-xl font-semibold mb-2">Can&apos;t link accounts</h1>
        <p className="text-sm text-gray-400">{message}</p>
      </div>
    </main>
  );
}

export default async function AuthorizePage({ searchParams }: AuthorizePageProps) {
  const params = await searchParams;
  const clientId = firstParam(params.client_id);
  const redirectUri = firstParam(params.redirect_uri);
  const state = firstParam(params.state);
  const responseType = firstParam(params.response_type);

  if (!clientId || !redirectUri) {
    return <ErrorCard message="The linking request is missing required information. Please start again from your smart-home app." />;
  }
  if (responseType !== "code") {
    return <ErrorCard message="Unsupported authorization type. Please start again from your smart-home app." />;
  }

  // Never redirect to an unvalidated URI — render the error instead.
  const client = await validateClientRedirect(clientId, redirectUri);
  if (!client) {
    return <ErrorCard message="This app isn't recognized, or its return address doesn't match what's on file. Please start again from your smart-home app." />;
  }

  const session = await auth();
  if (!session?.user?.id) {
    const here = `/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${encodeURIComponent(state)}`;
    redirect(`/signin?callbackUrl=${encodeURIComponent(here)}`);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white/5 backdrop-blur-lg rounded-xl p-8 border border-white/10">
        <div className="text-center mb-6">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-500/40 mb-4">
            <span className="block h-4 w-6 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400" />
          </span>
          <h1 className="text-xl font-semibold">
            Link {client.name} to MySmartFilter?
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            Signed in as {session.user.email}
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-300 mb-2 font-medium">
            {client.name} will be able to:
          </p>
          <ul className="text-sm text-gray-400 space-y-1.5">
            <li>✓ See your smart filter monitors and their status</li>
            <li>✓ Read live pressure, temperature, and battery levels</li>
            <li>✓ See filter health where your plan includes it</li>
          </ul>
          <p className="text-xs text-gray-500 mt-3">
            It can&apos;t place orders, change settings, or see payment
            details. You can unlink anytime from the {client.name} app.
          </p>
        </div>

        <form method="POST" action="/api/oauth/decision" className="space-y-3">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          <input type="hidden" name="state" value={state} />
          <button
            type="submit"
            name="decision"
            value="approve"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all"
          >
            Allow
          </button>
          <button
            type="submit"
            name="decision"
            value="deny"
            className="w-full py-3 bg-white/10 hover:bg-white/15 text-gray-300 rounded-lg font-medium transition-all"
          >
            Cancel
          </button>
        </form>
      </div>
    </main>
  );
}
