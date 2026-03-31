"use client";

import { useState } from "react";

interface ExportButtonProps {
  deviceId?: string;
  deviceName?: string;
  /** Optional className override */
  className?: string;
}

export function ExportButton({ deviceId, deviceName, className }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (deviceId) params.set("deviceId", deviceId);

      const res = await fetch(`/api/export/readings?${params.toString()}`);
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        alert(`Export failed: ${err.error ?? "Unknown error"}`);
        return;
      }

      // Trigger browser download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0] ?? "export";
      const label = deviceName ? `-${deviceName.replace(/\s+/g, "-").toLowerCase()}` : "";
      a.href = url;
      a.download = `smartfilter-readings${label}-${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Export failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className={
        className ??
        "flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      }
    >
      {loading ? (
        <>
          <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
          Exporting…
        </>
      ) : (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
          Export CSV
        </>
      )}
    </button>
  );
}
