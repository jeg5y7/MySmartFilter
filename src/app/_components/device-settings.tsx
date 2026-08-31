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
    blowerType: string;
    airflowCfm: number;
    electricityRateCents: number;
    furnaceMake: string | null;
    furnaceModel: string | null;
  };
  filterProducts: FilterProduct[];
  currentPreference: {
    id: string;
    filterProductId: string;
    autoOrderEnabled: boolean;
    filterProduct: FilterProduct;
  } | null;
  stateAvgRateCents?: number | null;
  stateCode?: string | null;
}

export function DeviceSettings({
  device,
  filterProducts,
  currentPreference,
  stateAvgRateCents = null,
  stateCode = null,
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

  // ── HVAC system state ────────────────────────────────────────────────────
  const [blowerType, setBlowerType] = useState(device.blowerType);
  const [airflowCfm, setAirflowCfm] = useState(device.airflowCfm);
  const [electricityRate, setElectricityRate] = useState(device.electricityRateCents);
  const [furnaceMake, setFurnaceMake] = useState(device.furnaceMake ?? "");
  const [furnaceModel, setFurnaceModel] = useState(device.furnaceModel ?? "");
  const [hvacSaving, setHvacSaving] = useState(false);
  const [hvacMessage, setHvacMessage] = useState<{
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

  // ── HVAC system save ──────────────────────────────────────────────────────

  const handleHvacSave = async () => {
    setHvacSaving(true);
    setHvacMessage(null);

    try {
      const res = await fetch(`/api/device/${device.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blowerType,
          airflowCfm,
          electricityRateCents: electricityRate,
          furnaceMake: furnaceMake.trim() || null,
          furnaceModel: furnaceModel.trim() || null,
        }),
      });

      const data = (await res.json()) as { error?: string };

      if (res.ok) {
        setHvacMessage({ type: "success", text: "✓ HVAC settings saved!" });
        router.refresh();
      } else {
        setHvacMessage({
          type: "error",
          text: data.error ?? "Failed to save HVAC settings",
        });
      }
    } catch {
      setHvacMessage({ type: "error", text: "Failed to save HVAC settings" });
    } finally {
      setHvacSaving(false);
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
      <div className="rounded-[24px] border border-mist bg-card p-6">
        <h2 className="text-lg font-semibold text-ink mb-4">Filter Settings</h2>

        {/* Filter Size Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-body mb-2">
            Your Filter Size
          </label>
          <select
            value={selectedFilterId}
            onChange={(e) => setSelectedFilterId(e.target.value)}
            className="w-full rounded-2xl border border-mist bg-card px-4 py-3 text-sm text-ink focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20"
          >
            <option value="">
              Select filter size...
            </option>
            {filterProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.size} - {product.name} ({formatPrice(product.price)})
              </option>
            ))}
          </select>
          {selectedFilter && (
            <p className="mt-2 text-sm text-body">
              {selectedFilter.merv ? `MERV ${selectedFilter.merv} • ` : ""}
              {selectedFilter.description}
            </p>
          )}
        </div>

        {/* Auto-Order Toggle */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-body">
              Auto-Order Replacement
            </label>
            <button
              onClick={() => setAutoOrderEnabled(!autoOrderEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoOrderEnabled ? "bg-sage" : "bg-mist"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  autoOrderEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-faint">
            {autoOrderEnabled
              ? "When this device detects a clogged filter, we'll email you and automatically order a replacement after 24 hours unless you cancel."
              : "Enable to automatically order replacement filters when needed."}
          </p>
        </div>

        {/* Auto-Order Info */}
        {autoOrderEnabled && (
          <div className="mb-6 p-4 bg-sagemist border border-sage/30 rounded-2xl">
            <h3 className="text-sm font-medium text-sage-deep mb-2">How Auto-Order Works</h3>
            <ol className="text-xs text-sage-deep/80 space-y-1 list-decimal list-inside">
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
          className="w-full rounded-full bg-sage py-3 text-sm font-semibold text-white transition hover:bg-sage-deep disabled:bg-sage/50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>

        {/* Message */}
        {message && (
          <p
            className={`mt-3 text-sm text-center ${
              message.type === "success" ? "text-sage" : "text-red-600"
            }`}
          >
            {message.text}
          </p>
        )}

        {/* Shop Link */}
        <div className="mt-6 pt-6 border-t border-mist">
          <Link
            href="/store"
            className="flex items-center justify-center gap-2 text-sage hover:text-sage-deep text-sm"
          >
            <span>🛒</span>
            Browse Filter Store
          </Link>
        </div>
      </div>

      {/* ── HVAC System (energy model inputs) ───────────────────────────── */}
      <div className="rounded-[24px] border border-mist bg-card p-6">
        <h2 className="text-lg font-semibold text-ink mb-1">HVAC System</h2>
        <p className="text-sm text-body mb-5">
          These power the energy-cost model that decides when a new filter pays
          for itself.
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-body mb-2">
                Furnace Make{" "}
                <span className="text-whisper font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={furnaceMake}
                onChange={(e) => setFurnaceMake(e.target.value)}
                placeholder="e.g. Carrier"
                maxLength={80}
                className="w-full rounded-full border border-mist bg-card px-4 py-3 text-sm text-ink placeholder:text-whisper focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-body mb-2">
                Furnace Model{" "}
                <span className="text-whisper font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={furnaceModel}
                onChange={(e) => setFurnaceModel(e.target.value)}
                placeholder="e.g. 59TP6B080V17"
                maxLength={80}
                className="w-full rounded-full border border-mist bg-card px-4 py-3 text-sm text-ink placeholder:text-whisper focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-body mb-2">
              Blower Motor Type
            </label>
            <select
              value={blowerType}
              onChange={(e) => setBlowerType(e.target.value)}
              className="w-full rounded-2xl border border-mist bg-card px-4 py-3 text-sm text-ink focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20"
            >
              <option value="ecm">
                Variable-speed (ECM) — most systems after ~2019
              </option>
              <option value="psc">
                Fixed-speed (PSC) — most older systems
              </option>
            </select>
            <p className="mt-1.5 text-xs text-faint">
              {blowerType === "ecm"
                ? "ECM blowers work harder as the filter clogs, so we track the extra electricity cost."
                : "PSC blowers lose airflow as the filter clogs, so your whole system runs longer to heat or cool the house — we track that added runtime cost."}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-body mb-2">
              System Airflow
            </label>
            <div className="relative">
              <input
                type="number"
                value={airflowCfm}
                onChange={(e) => setAirflowCfm(Number(e.target.value))}
                min={100}
                max={5000}
                step={100}
                className="w-full rounded-full border border-mist bg-card px-4 py-3 pr-14 text-sm text-ink focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20 transition-all"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-faint text-sm pointer-events-none">
                CFM
              </span>
            </div>
            <p className="mt-1.5 text-xs text-faint">
              Rule of thumb: ~400 CFM per ton of cooling (3-ton system ≈ 1200 CFM).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-body mb-2">
              Electricity Rate
            </label>
            <div className="relative">
              <input
                type="number"
                value={electricityRate}
                onChange={(e) => setElectricityRate(Number(e.target.value))}
                min={1}
                max={100}
                step={1}
                className="w-full rounded-full border border-mist bg-card px-4 py-3 pr-16 text-sm text-ink focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20 transition-all"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-faint text-sm pointer-events-none">
                ¢/kWh
              </span>
            </div>
            <p className="mt-1.5 text-xs text-faint">
              Find it on your utility bill — US average is about 15¢/kWh.
              {stateAvgRateCents !== null && (
                <>
                  {" "}
                  {stateCode} average is ~{stateAvgRateCents}¢/kWh.{" "}
                  <button
                    type="button"
                    onClick={() => setElectricityRate(stateAvgRateCents)}
                    className="text-sage hover:text-sage-deep underline underline-offset-2"
                  >
                    Use {stateAvgRateCents}¢
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={handleHvacSave}
          disabled={hvacSaving}
          className="mt-5 w-full rounded-full bg-sage py-3 text-sm font-semibold text-white transition hover:bg-sage-deep disabled:bg-sage/50 disabled:cursor-not-allowed"
        >
          {hvacSaving ? "Saving…" : "Save HVAC Settings"}
        </button>

        {hvacMessage && (
          <p
            className={`mt-3 text-sm text-center ${
              hvacMessage.type === "success" ? "text-sage" : "text-red-600"
            }`}
          >
            {hvacMessage.text}
          </p>
        )}
      </div>

      {/* ── Device Info (Rename) ────────────────────────────────────────── */}
      <div className="rounded-[24px] border border-mist bg-card p-6">
        <h2 className="text-lg font-semibold text-ink mb-1">Device Info</h2>
        <p className="text-sm text-body mb-5">
          Update the name or location shown in your dashboard.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-body mb-2">
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
              className="w-full rounded-full border border-mist bg-card px-4 py-3 text-sm text-ink placeholder:text-whisper focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-body mb-2">
              Location{" "}
              <span className="text-whisper font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={renameLocation}
              onChange={(e) => setRenameLocation(e.target.value)}
              placeholder="e.g. Basement HVAC"
              maxLength={50}
              className="w-full rounded-full border border-mist bg-card px-4 py-3 text-sm text-ink placeholder:text-whisper focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-body mb-2">
              Alert Threshold
            </label>
            <div className="relative">
              <input
                type="number"
                value={pressureThreshold}
                onChange={(e) => setPressureThreshold(Number(e.target.value))}
                min={10}
                max={500}
                step={5}
                className="w-full rounded-full border border-mist bg-card px-4 py-3 pr-12 text-sm text-ink placeholder:text-whisper focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20 transition-all"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-faint text-sm pointer-events-none">
                Pa
              </span>
            </div>
            <p className="mt-1.5 text-xs text-faint">
              Alerts when the pressure rises this much above your fresh-filter baseline
            </p>
          </div>
        </div>

        <button
          onClick={handleRenameSave}
          disabled={renameSaving || !renameName.trim()}
          className="mt-5 w-full rounded-full bg-sage py-3 text-sm font-semibold text-white transition hover:bg-sage-deep disabled:bg-sage/50 disabled:cursor-not-allowed"
        >
          {renameSaving ? "Saving…" : "Save Changes"}
        </button>

        {renameMessage && (
          <p
            className={`mt-3 text-sm text-center ${
              renameMessage.type === "success" ? "text-sage" : "text-red-600"
            }`}
          >
            {renameMessage.text}
          </p>
        )}
      </div>

      {/* ── Danger Zone ─────────────────────────────────────────────────── */}
      <div className="rounded-[24px] border border-red-200 bg-red-50 p-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-red-600 text-lg">⚠️</span>
          <h2 className="text-lg font-semibold text-red-700">Danger Zone</h2>
        </div>
        <p className="text-sm text-body mb-5">
          Permanent actions that cannot be undone.
        </p>

        <div className="rounded-2xl border border-red-200 bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink">Remove this device</p>
              <p className="text-xs text-faint mt-0.5">
                Removes the device and all associated readings permanently.
              </p>
            </div>
            {!showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="shrink-0 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
              >
                Remove Device
              </button>
            )}
          </div>

          {/* Inline confirmation */}
          {showDeleteConfirm && (
            <div className="mt-4 pt-4 border-t border-red-200">
              <p className="text-sm text-body mb-3">
                Type the device name to confirm deletion:
              </p>
              <p className="text-sm text-body mb-2">
                Type{" "}
                <code className="bg-mist/60 px-1.5 py-0.5 rounded text-ink font-mono text-xs">
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
                className="w-full rounded-full border border-red-200 bg-card px-4 py-2.5 text-sm text-ink placeholder:text-whisper focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 mb-3 transition-all"
              />

              {deleteError && (
                <p className="text-red-600 text-sm mb-3">⚠️ {deleteError}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText("");
                    setDeleteError("");
                  }}
                  disabled={deleting}
                  className="flex-1 rounded-full border border-mist bg-card py-2 text-sm font-medium text-ink transition hover:bg-mist/60 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting || deleteConfirmText !== deviceDisplayName}
                  className="flex-1 rounded-full bg-red-600 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:bg-red-600/30 disabled:cursor-not-allowed"
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
