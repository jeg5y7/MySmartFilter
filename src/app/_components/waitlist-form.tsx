"use client";

import { useState } from "react";

export function WaitlistForm({ dark = false }: { dark?: boolean }) {
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
      <div className={`rounded-2xl px-6 py-5 text-center max-w-xl mx-auto ${dark ? "bg-glow/10" : "bg-sagemist"}`}>
        <p className={`font-semibold text-lg mb-1 ${dark ? "text-glow" : "text-sage-deep"}`}>
          {state === "done" ? "You're on the list! 🎉" : "You're already on the list 👍"}
        </p>
        <p className={`text-sm ${dark ? "text-paper/60" : "text-body"}`}>
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
          className={`flex-1 px-5 py-3.5 rounded-full focus:outline-none focus:ring-2 focus:ring-sage/50 ${dark ? "bg-paper/10 text-paper placeholder-paper/40" : "bg-card text-ink placeholder-whisper border border-mist"}`}
        />
        <input
          type="text"
          inputMode="numeric"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          placeholder="ZIP (optional)"
          maxLength={10}
          className={`sm:w-36 px-5 py-3.5 rounded-full focus:outline-none focus:ring-2 focus:ring-sage/50 ${dark ? "bg-paper/10 text-paper placeholder-paper/40" : "bg-card text-ink placeholder-whisper border border-mist"}`}
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className={`px-8 py-3.5 rounded-full font-semibold transition-all whitespace-nowrap disabled:opacity-60 ${dark ? "bg-glow text-ink hover:bg-glow/85" : "bg-ink text-paper hover:bg-ink/85"}`}
        >
          {state === "sending" ? "Joining…" : "Join the list"}
        </button>
      </div>
      {error && <p className={`text-sm mt-2 text-center ${dark ? "text-red-300" : "text-clay"}`}>{error}</p>}
      <p className={`text-xs mt-3 text-center ${dark ? "text-paper/50" : "text-whisper"}`}>
        One email when we launch, first dibs on the first batch. No spam, ever.
      </p>
    </form>
  );
}
