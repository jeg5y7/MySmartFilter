"use client";

import { useState } from "react";

/** Shown when the FirmwareRelease table doesn't exist in this database yet. */
export function FirmwareSchemaRepair() {
  const [state, setState] = useState<"idle" | "working" | "error">("idle");

  const run = async () => {
    setState("working");
    try {
      const res = await fetch("/api/admin/firmware/schema", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      window.location.reload();
    } catch {
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
        <p className="text-sm text-red-300 mt-3">
          That didn&apos;t work — refresh and try again, or check the server
          logs.
        </p>
      )}
    </div>
  );
}
