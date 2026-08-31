"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

export default function SetupPasswordPage() {
  const { status } = useSession() ?? { status: 'loading' };
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const setupPasswordMutation = api.user.setupPassword.useMutation({
    onSuccess: () => {
      router.push("/dashboard");
    },
    onError: (error) => {
      setError(error.message);
      setIsLoading(false);
    },
  });

  if (status === "loading") {
    return <div className="flex min-h-screen items-center justify-center bg-paper text-body">Loading...</div>;
  }

  if (status === "unauthenticated") {
    router.push("/api/auth/signin");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      setIsLoading(false);
      return;
    }

    setupPasswordMutation.mutate({ password });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md space-y-8 rounded-[24px] border border-mist bg-card p-8">
        <div>
          <h2 className="text-center font-display text-3xl font-normal tracking-tight text-ink">
            Set Up Your Password
          </h2>
          <p className="mt-2 text-center text-body">
            Create a password to make future logins easier
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="relative block w-full rounded-full border border-mist bg-card px-4 py-3 text-sm text-ink placeholder:text-whisper focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="sr-only">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                className="relative block w-full rounded-full border border-mist bg-card px-4 py-3 text-sm text-ink placeholder:text-whisper focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full justify-center rounded-full bg-sage py-3 px-4 text-sm font-semibold text-white transition-all hover:bg-sage-deep focus:outline-none focus:ring-2 focus:ring-sage/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Setting up password..." : "Set Password"}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="text-sm text-faint hover:text-ink transition-colors"
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
