"use client";

import { useState } from "react";

/** Shown when the firmware-release queries fail (e.g. table missing). */
export function FirmwareSchemaRepair({ detail }: { detail: string | null }) {
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const run = async () => {
    setState("working");
    try {
      const res = await fetch("/api/admin/firmware/schema", { method: "POST" });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      window.location.reload();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  };

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-amber-300 mb-2">
        One-time setup needed
      </h2>
      <p className="text-sm text-gray-300 mb-4 max-w-xl">
        The firmware-release table hasn&apos;t been created in this database
        yet. This button creates it through the app&apos;s own database
        connection — no SQL editor involved, and it&apos;s safe to run more
        than once.
      </p>
      <button
        onClick={run}
        disabled={state === "working"}
        className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-semibold transition-all"
      >
        {state === "working" ? "Creating…" : "Create firmware table"}
      </button>
      {state === "error" && (
        <p className="text-sm text-red-300 mt-3 break-all">
          That didn&apos;t work: {errorMsg}
        </p>
      )}
      {detail && (
        <p className="text-xs text-gray-500 mt-4 font-mono break-all">
          Underlying error: {detail}
        </p>
      )}
    </div>
  );
}
