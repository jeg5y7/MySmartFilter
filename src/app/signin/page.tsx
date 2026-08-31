"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleMagicLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("resend", {
        email,
        redirect: false,
      });

      if (result?.error) {
        setError("Failed to send magic link. Please try again.");
      } else {
        setMagicLinkSent(true);
      }
    } catch {
      setError("An error occurred sending the magic link");
    }

    setIsLoading(false);
  };

  if (magicLinkSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="w-full max-w-md space-y-8 rounded-[24px] border border-mist bg-card p-8">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sagemist">
              <svg className="h-8 w-8 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-6 font-display text-3xl font-normal tracking-tight text-ink">
              Check Your Email
            </h2>
            <p className="mt-2 text-body">
              We&apos;ve sent a magic link to <strong className="text-ink">{email}</strong>
            </p>
            <p className="mt-1 text-sm text-faint">
              Click the link in your email to sign in instantly
            </p>
          </div>

          <div className="mt-8">
            <button
              onClick={() => setMagicLinkSent(false)}
              className="flex w-full justify-center rounded-full border border-mist bg-card px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-mist/60 focus:outline-none focus:ring-2 focus:ring-sage/20"
            >
              Try a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md space-y-8 rounded-[24px] border border-mist bg-card p-8">
        <div className="text-center">
          <h2 className="font-display text-3xl font-normal tracking-tight text-ink">
            Welcome to My Smart Filter
          </h2>
          <p className="mt-2 text-body">
            Enter your email to get started with secure, passwordless sign in
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form className="space-y-6" onSubmit={handleMagicLinkSignIn}>
          <div>
            <label htmlFor="email" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-faint">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="relative block w-full rounded-full border border-mist bg-card px-4 py-3 text-sm text-ink placeholder:text-whisper focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full justify-center rounded-full bg-ink py-3 px-4 text-sm font-semibold text-paper transition-all hover:bg-ink/85 focus:outline-none focus:ring-2 focus:ring-sage/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Sending Magic Link..." : "Send Magic Link"}
            </button>
          </div>

          <div className="text-center">
            <p className="text-xs text-faint">
              ✨ No password required • 🔒 Secure • ⚡ Instant access
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
