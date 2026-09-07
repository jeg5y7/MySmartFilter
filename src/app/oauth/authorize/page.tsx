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
    <main className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-[24px] border border-mist bg-card p-8 text-center">
        <p className="text-4xl mb-4">⚠️</p>
        <h1 className="text-xl font-semibold text-ink mb-2">Can&apos;t link accounts</h1>
        <p className="text-sm text-body">{message}</p>
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
    <main className="min-h-screen bg-paper flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-[24px] border border-mist bg-card p-8">
        <div className="text-center mb-6">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-sagemist border border-sage/40 mb-4">
            <span className="block h-4 w-6 rounded-full bg-gradient-to-r from-sage to-glow" />
          </span>
          <h1 className="text-xl font-semibold text-ink">
            Link {client.name} to MySmartFilter?
          </h1>
          <p className="text-sm text-faint mt-2">
            Signed in as {session.user.email}
          </p>
        </div>

        <div className="bg-paper border border-mist rounded-2xl p-4 mb-6">
          <p className="text-sm text-ink mb-2 font-medium">
            {client.name} will be able to:
          </p>
          <ul className="text-sm text-body space-y-1.5">
            <li>✓ See your smart filter monitors and their status</li>
            <li>✓ Read live pressure, temperature, and battery levels</li>
            <li>✓ See filter health where your plan includes it</li>
          </ul>
          <p className="text-xs text-faint mt-3">
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
            className="w-full py-3 bg-sage hover:bg-sage-deep text-white rounded-full text-sm font-semibold transition-all"
          >
            Allow
          </button>
          <button
            type="submit"
            name="decision"
            value="deny"
            className="w-full py-3 border border-mist bg-card hover:bg-mist/60 text-ink rounded-full text-sm font-semibold transition-all"
          >
            Cancel
          </button>
        </form>
      </div>
    </main>
  );
}
