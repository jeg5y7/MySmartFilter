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
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#0f172a] to-[#1e293b]">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white/10 backdrop-blur-lg p-8 border border-white/10">
        <div>
          <h2 className="text-center text-3xl font-bold text-white">
            Set Up Your Password
          </h2>
          <p className="mt-2 text-center text-gray-400">
            Create a password to make future logins easier
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-500/20 border border-red-500/50 px-4 py-3">
              <p className="text-sm text-red-300">{error}</p>
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
                className="relative block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="relative block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="group relative flex w-full justify-center rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 py-3 px-4 text-sm font-medium text-white hover:from-blue-700 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? "Setting up password..." : "Set Password"}
            </button>
          </div>
          
          <div className="text-center">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
