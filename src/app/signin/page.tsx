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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c]">
        <div className="w-full max-w-md space-y-8 rounded-lg bg-white/10 backdrop-blur-lg p-8 border border-white/10">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <svg className="h-8 w-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-bold text-white">
              Check Your Email
            </h2>
            <p className="mt-2 text-gray-200">
              We&apos;ve sent a magic link to <strong className="text-blue-300">{email}</strong>
            </p>
            <p className="mt-1 text-sm text-white/70">
              Click the link in your email to sign in instantly
            </p>
          </div>
          
          <div className="mt-8">
            <button
              onClick={() => setMagicLinkSent(false)}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Try a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c]">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white/10 backdrop-blur-lg p-8 border border-white/10">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white">
            Welcome to My Smart Filter
          </h2>
          <p className="mt-2 text-white/70">
            Enter your email to get started with secure, passwordless sign in
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-500/20 border border-red-500/50 px-4 py-3">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <form className="space-y-6" onSubmit={handleMagicLinkSignIn}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="relative block w-full rounded-lg border border-white/20 bg-white/10 px-3 py-3 text-white placeholder-white/50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full justify-center rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 py-3 px-4 text-sm font-medium text-white hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#2e026d] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? "Sending Magic Link..." : "Send Magic Link"}
            </button>
          </div>
          
          <div className="text-center">
            <p className="text-xs text-white/50">
              ✨ No password required • 🔒 Secure • ⚡ Instant access
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
