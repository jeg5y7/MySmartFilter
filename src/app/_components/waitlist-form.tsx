"use client";

import { useState } from "react";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [zip, setZip] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "already" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, zip: zip || undefined, source: "landing" }),
      });
      const body = (await res.json()) as { ok?: boolean; already?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setError(body.error ?? "Something went wrong — try again");
        setState("error");
        return;
      }
      setState(body.already ? "already" : "done");
    } catch {
      setError("Something went wrong — try again");
      setState("error");
    }
  };

  if (state === "done" || state === "already") {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-6 py-5 text-center max-w-xl mx-auto">
        <p className="text-emerald-300 font-semibold text-lg mb-1">
          {state === "done" ? "You're on the list! 🎉" : "You're already on the list 👍"}
        </p>
        <p className="text-gray-400 text-sm">
          {state === "done"
            ? "Check your inbox for a confirmation — we'll email you the moment monitors are available."
            : "We've got you — you'll hear from us the moment monitors are available."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="flex-1 px-4 py-3.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
        <input
          type="text"
          inputMode="numeric"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          placeholder="ZIP (optional)"
          maxLength={10}
          className="sm:w-36 px-4 py-3.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="px-8 py-3.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-60 text-white font-semibold transition-all whitespace-nowrap"
        >
          {state === "sending" ? "Joining…" : "Join the list"}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm mt-2 text-center">{error}</p>}
      <p className="text-gray-500 text-xs mt-3 text-center">
        One email when we launch, first dibs on the first batch. No spam, ever.
      </p>
    </form>
  );
}
