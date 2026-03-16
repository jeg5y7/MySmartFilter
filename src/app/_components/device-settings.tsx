"use client";

import { useState } from "react";
import { type FilterProduct } from "@prisma/client";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  // ── Filter settings state ────────────────────────────────────────────────
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

  // ── Rename state ─────────────────────────────────────────────────────────
  const [renameName, setRenameName] = useState(device.name ?? "");
  const [renameLocation, setRenameLocation] = useState(device.location ?? "");
  const [pressureThreshold, setPressureThreshold] = useState(device.pressureThreshold);
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameMessage, setRenameMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // ── Delete state ─────────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const deviceDisplayName = device.name ?? device.deviceId;

  // ── Helpers ───────────────────────────────────────────────────────────────

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(priceInCents / 100);
  };

  // ── Filter settings save ──────────────────────────────────────────────────

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

  // ── Rename save ───────────────────────────────────────────────────────────

  const handleRenameSave = async () => {
    if (!renameName.trim()) {
      setRenameMessage({ type: "error", text: "Device name cannot be empty" });
      return;
    }

    setRenameSaving(true);
    setRenameMessage(null);

    try {
      const res = await fetch(`/api/device/${device.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: renameName.trim(),
          location: renameLocation.trim() || null,
          pressureThreshold,
        }),
      });

      const data = (await res.json()) as { error?: string };

      if (res.ok) {
        setRenameMessage({ type: "success", text: "✓ Device updated!" });
        router.refresh();
      } else {
        setRenameMessage({
          type: "error",
          text: data.error ?? "Failed to update device",
        });
      }
    } catch {
      setRenameMessage({ type: "error", text: "Failed to update device" });
    } finally {
      setRenameSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (deleteConfirmText !== deviceDisplayName) return;

    setDeleting(true);
    setDeleteError("");

    try {
      const res = await fetch(`/api/device/${device.id}`, {
        method: "DELETE",
      });

      const data = (await res.json()) as { error?: string };

      if (res.ok) {
        window.location.href = "/devices";
      } else {
        setDeleteError(data.error ?? "Failed to delete device");
        setDeleting(false);
      }
    } catch {
      setDeleteError("Failed to delete device. Please try again.");
      setDeleting(false);
    }
  };

  const selectedFilter = filterProducts.find((p) => p.id === selectedFilterId);

  return (
    <div className="space-y-6">
      {/* ── Filter Settings ─────────────────────────────────────────────── */}
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

      {/* ── Device Info (Rename) ────────────────────────────────────────── */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-1">Device Info</h2>
        <p className="text-sm text-gray-400 mb-5">
          Update the name or location shown in your dashboard.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Device Name
            </label>
            <input
              type="text"
              value={renameName}
              onChange={(e) => {
                setRenameName(e.target.value);
                setRenameMessage(null);
              }}
              placeholder="e.g. Living Room Filter"
              maxLength={50}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Location{" "}
              <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={renameLocation}
              onChange={(e) => setRenameLocation(e.target.value)}
              placeholder="e.g. Basement HVAC"
              maxLength={50}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Alert Threshold
            </label>
            <div className="relative">
              <input
                type="number"
                value={pressureThreshold}
                onChange={(e) => setPressureThreshold(Number(e.target.value))}
                min={50}
                max={500}
                step={10}
                className="w-full px-4 py-3 pr-12 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                Pa
              </span>
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              Alert triggers when pressure exceeds this value
            </p>
          </div>
        </div>

        <button
          onClick={handleRenameSave}
          disabled={renameSaving || !renameName.trim()}
          className="mt-5 w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all"
        >
          {renameSaving ? "Saving…" : "Save Changes"}
        </button>

        {renameMessage && (
          <p
            className={`mt-3 text-sm text-center ${
              renameMessage.type === "success" ? "text-green-400" : "text-red-400"
            }`}
          >
            {renameMessage.text}
          </p>
        )}
      </div>

      {/* ── Danger Zone ─────────────────────────────────────────────────── */}
      <div className="bg-red-500/10 backdrop-blur-lg rounded-xl p-6 border border-red-500/30">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-red-400 text-lg">⚠️</span>
          <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>
        </div>
        <p className="text-sm text-gray-400 mb-5">
          Permanent actions that cannot be undone.
        </p>

        <div className="border border-red-500/20 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">Remove this device</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Removes the device and all associated readings permanently.
              </p>
            </div>
            {!showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="shrink-0 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-all"
              >
                Remove Device
              </button>
            )}
          </div>

          {/* Inline confirmation */}
          {showDeleteConfirm && (
            <div className="mt-4 pt-4 border-t border-red-500/20">
              <p className="text-sm text-gray-300 mb-3">
                Type the device name to confirm deletion:
              </p>
              <p className="text-sm text-gray-400 mb-2">
                Type{" "}
                <code className="bg-white/10 px-1.5 py-0.5 rounded text-white text-xs">
                  {deviceDisplayName}
                </code>{" "}
                to confirm:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => {
                  setDeleteConfirmText(e.target.value);
                  setDeleteError("");
                }}
                placeholder={deviceDisplayName}
                className="w-full px-4 py-2.5 bg-white/10 border border-red-500/30 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500/40 text-sm mb-3 transition-all"
              />

              {deleteError && (
                <p className="text-red-400 text-sm mb-3">⚠️ {deleteError}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText("");
                    setDeleteError("");
                  }}
                  disabled={deleting}
                  className="flex-1 py-2 bg-white/10 hover:bg-white/15 text-gray-300 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting || deleteConfirmText !== deviceDisplayName}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/30 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all"
                >
                  {deleting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Deleting…
                    </span>
                  ) : (
                    "Confirm Delete"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
