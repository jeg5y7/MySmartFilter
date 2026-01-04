"use client";

import { useState } from "react";
import { type FilterProduct } from "@prisma/client";
import Link from "next/link";

interface DeviceSettingsProps {
  device: {
    id: string;
    deviceId: string;
    name: string | null;
    location: string | null;
    pressureThreshold: number;
  };
  filterProducts: FilterProduct[];
  currentPreference: {
    id: string;
    filterProductId: string;
    autoOrderEnabled: boolean;
    filterProduct: FilterProduct;
  } | null;
}

export function DeviceSettings({
  device,
  filterProducts,
  currentPreference,
}: DeviceSettingsProps) {
  const [selectedFilterId, setSelectedFilterId] = useState(
    currentPreference?.filterProductId ?? ""
  );
  const [autoOrderEnabled, setAutoOrderEnabled] = useState(
    currentPreference?.autoOrderEnabled ?? false
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(priceInCents / 100);
  };

  const handleSave = async () => {
    if (!selectedFilterId) {
      setMessage({ type: "error", text: "Please select a filter size" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/device/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: device.id,
          filterProductId: selectedFilterId,
          autoOrderEnabled,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (response.ok) {
        setMessage({ type: "success", text: "Settings saved!" });
      } else {
        setMessage({ type: "error", text: data.error ?? "Failed to save settings" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  const selectedFilter = filterProducts.find((p) => p.id === selectedFilterId);

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
      <h2 className="text-lg font-semibold text-white mb-4">Filter Settings</h2>

      {/* Filter Size Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Your Filter Size
        </label>
        <select
          value={selectedFilterId}
          onChange={(e) => setSelectedFilterId(e.target.value)}
          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="" className="bg-slate-800">
            Select filter size...
          </option>
          {filterProducts.map((product) => (
            <option key={product.id} value={product.id} className="bg-slate-800">
              {product.size} - {product.name} ({formatPrice(product.price)})
            </option>
          ))}
        </select>
        {selectedFilter && (
          <p className="mt-2 text-sm text-gray-400">
            {selectedFilter.merv ? `MERV ${selectedFilter.merv} • ` : ""}
            {selectedFilter.description}
          </p>
        )}
      </div>

      {/* Auto-Order Toggle */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">
            Auto-Order Replacement
          </label>
          <button
            onClick={() => setAutoOrderEnabled(!autoOrderEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              autoOrderEnabled ? "bg-blue-600" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                autoOrderEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        <p className="text-xs text-gray-400">
          {autoOrderEnabled
            ? "When this device detects a clogged filter, we'll email you and automatically order a replacement after 24 hours unless you cancel."
            : "Enable to automatically order replacement filters when needed."}
        </p>
      </div>

      {/* Auto-Order Info */}
      {autoOrderEnabled && (
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <h3 className="text-sm font-medium text-blue-300 mb-2">How Auto-Order Works</h3>
          <ol className="text-xs text-blue-200/70 space-y-1 list-decimal list-inside">
            <li>Device detects filter needs replacement</li>
            <li>You receive an email notification</li>
            <li>24-hour grace period to cancel</li>
            <li>Filter is automatically ordered and shipped</li>
          </ol>
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving || !selectedFilterId}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg font-semibold transition-all"
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>

      {/* Message */}
      {message && (
        <p
          className={`mt-3 text-sm text-center ${
            message.type === "success" ? "text-green-400" : "text-red-400"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* Shop Link */}
      <div className="mt-6 pt-6 border-t border-white/10">
        <Link
          href="/store"
          className="flex items-center justify-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
        >
          <span>🛒</span>
          Browse Filter Store
        </Link>
      </div>
    </div>
  );
}
