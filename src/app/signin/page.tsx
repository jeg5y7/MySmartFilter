"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMagicLoading, setIsMagicLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [activeTab, setActiveTab] = useState<"password" | "magic">("password");

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("email-password", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else if (result?.ok) {
        router.push("/dashboard");
      }
    } catch {
      setError("An error occurred during sign in");
    }
    
    setIsLoading(false);
  };

  const handleMagicLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsMagicLoading(true);

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
    
    setIsMagicLoading(false);
  };

  if (magicLinkSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#0f172a] to-[#1e293b]">
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
            <p className="mt-2 text-gray-400">
              We&apos;ve sent a magic link to <strong>{email}</strong>
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Click the link in your email to sign in
            </p>
          </div>
          
          <div className="mt-8">
            <button
              onClick={() => setMagicLinkSent(false)}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Try a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#0f172a] to-[#1e293b]">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white/10 backdrop-blur-lg p-8 border border-white/10">
        <div>
          <h2 className="text-center text-3xl font-bold text-white">
            Welcome Back
          </h2>
          <p className="mt-2 text-center text-gray-400">
            Sign in to your account
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex rounded-lg bg-white/5 p-1">
          <button
            onClick={() => setActiveTab("password")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
              activeTab === "password"
                ? "bg-blue-500 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Password
          </button>
          <button
            onClick={() => setActiveTab("magic")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
              activeTab === "magic"
                ? "bg-blue-500 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Magic Link
          </button>
        </div>

        {error && (
          <div className="rounded-md bg-red-500/20 border border-red-500/50 px-4 py-3">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Password Form */}
        {activeTab === "password" && (
          <form className="space-y-6" onSubmit={handlePasswordSignIn}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email-password" className="sr-only">
                  Email address
                </label>
                <input
                  id="email-password"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="relative block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              
              <div>
                <label htmlFor="password-input" className="sr-only">
                  Password
                </label>
                <input
                  id="password-input"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="relative block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative flex w-full justify-center rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 py-3 px-4 text-sm font-medium text-white hover:from-blue-700 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </button>
            </div>
          </form>
        )}

        {/* Magic Link Form */}
        {activeTab === "magic" && (
          <form className="space-y-6" onSubmit={handleMagicLinkSignIn}>
            <div>
              <label htmlFor="email-magic" className="sr-only">
                Email address
              </label>
              <input
                id="email-magic"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isMagicLoading}
                className="group relative flex w-full justify-center rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 py-3 px-4 text-sm font-medium text-white hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isMagicLoading ? "Sending..." : "Send Magic Link"}
              </button>
            </div>
            
            <p className="text-center text-sm text-gray-400">
              We&apos;ll email you a secure link to sign in
            </p>
          </form>
        )}

        <div className="text-center">
          <p className="text-sm text-gray-400">
            Don&apos;t have an account?{" "}
            <button
              onClick={() => setActiveTab("magic")}
              className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              Get started with email
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
