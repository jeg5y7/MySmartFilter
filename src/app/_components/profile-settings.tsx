"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";

interface ProductOption {
  id: string;
  size: string;
  name: string;
  merv: number | null;
  price: number;
}

const fmtUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function ProfileSettings({ filterProducts }: { filterProducts: ProductOption[] }) {
  const utils = api.useUtils();
  const { data, isLoading } = api.user.getProfile.useQuery();

  // ── Name editing ──────────────────────────────────────────────────────────
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const updateProfile = api.user.updateProfile.useMutation({
    onSuccess: () => {
      setEditingName(false);
      void utils.user.getProfile.invalidate();
    },
  });

  // ── Default filter preference ─────────────────────────────────────────────
  const [prefProduct, setPrefProduct] = useState<string | null>(null);
  const [prefAutoOrder, setPrefAutoOrder] = useState<boolean | null>(null);
  const [prefSaved, setPrefSaved] = useState(false);
  const setDefaultPref = api.user.setDefaultFilterPreference.useMutation({
    onSuccess: () => {
      setPrefSaved(true);
      setTimeout(() => setPrefSaved(false), 2500);
      void utils.user.getProfile.invalidate();
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
      </div>
    );
  }

  const { user, devices, defaultPref, autoOrderCount } = data;
  const selectedProduct = prefProduct ?? defaultPref?.filterProductId ?? "";
  const autoOrderOn = prefAutoOrder ?? defaultPref?.autoOrderEnabled ?? false;
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <>
      {/* ── Account ─────────────────────────────────────────────────────── */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-4">Account</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Name</p>
              {!editingName ? (
                <p className="text-white truncate">
                  {user?.name ?? <span className="text-gray-500">Not set</span>}
                </p>
              ) : (
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Your name"
                  maxLength={100}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              )}
            </div>
            {!editingName ? (
              <button
                onClick={() => {
                  setNameInput(user?.name ?? "");
                  setEditingName(true);
                }}
                className="shrink-0 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Edit
              </button>
            ) : (
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => updateProfile.mutate({ name: nameInput })}
                  disabled={updateProfile.isPending || !nameInput.trim()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/40 text-white text-sm rounded-lg transition-all"
                >
                  {updateProfile.isPending ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-gray-300 text-sm rounded-lg transition-all"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Email</p>
            <p className="text-white">{user?.email}</p>
          </div>

          {memberSince && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Member since</p>
              <p className="text-gray-300">{memberSince}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Plan ─────────────────────────────────────────────────────────── */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-white">Plan</h2>
          {autoOrderCount > 0 ? (
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-medium">
              Filter AutoShip
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-white/10 text-gray-300 text-xs font-medium">
              Free monitoring
            </span>
          )}
        </div>
        {autoOrderCount > 0 ? (
          <p className="text-sm text-gray-400">
            You&apos;re an AutoShip member — filters ship automatically when
            replacing saves you money, and your plan includes the
            energy-savings calculation, historical trending, and upcoming
            HVAC diagnostics. No monthly fee — you simply get your filters
            through us.
          </p>
        ) : (
          <p className="text-sm text-gray-400">
            You have live readings on your dashboard and smart home.{" "}
            <span className="text-amber-300/80">
              Choose a filter below and turn on Auto-Order to join Filter
              AutoShip
            </span>{" "}
            — it unlocks the energy-savings calculation, historical trending,
            and upcoming HVAC diagnostics. No monthly fee; your filters just
            arrive when replacing saves you money.
          </p>
        )}
      </div>

      {/* ── Default filter preference ────────────────────────────────────── */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-1">Default Filter</h2>
        <p className="text-sm text-gray-400 mb-5">
          Used for any device that doesn&apos;t have its own filter choice. A
          device&apos;s own setting always wins.
        </p>

        <select
          value={selectedProduct}
          onChange={(e) => setPrefProduct(e.target.value)}
          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        >
          <option value="" className="bg-slate-800">
            Select filter size…
          </option>
          {filterProducts.map((p) => (
            <option key={p.id} value={p.id} className="bg-slate-800">
              {p.size} — {p.name}
              {p.merv ? ` (MERV ${p.merv})` : ""} — {fmtUsd(p.price)}
            </option>
          ))}
        </select>

        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm font-medium text-gray-300">Auto-Order by default</p>
            <p className="text-xs text-gray-500">
              Ship a replacement automatically when it saves money
            </p>
          </div>
          <button
            onClick={() => setPrefAutoOrder(!autoOrderOn)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              autoOrderOn ? "bg-blue-600" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                autoOrderOn ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <button
          onClick={() =>
            selectedProduct &&
            setDefaultPref.mutate({
              filterProductId: selectedProduct,
              autoOrderEnabled: autoOrderOn,
            })
          }
          disabled={setDefaultPref.isPending || !selectedProduct}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all"
        >
          {setDefaultPref.isPending ? "Saving…" : prefSaved ? "✓ Saved!" : "Save Default Filter"}
        </button>
        {setDefaultPref.error && (
          <p className="mt-3 text-sm text-red-400 text-center">
            {setDefaultPref.error.message}
          </p>
        )}
      </div>

      {/* ── HVAC systems ─────────────────────────────────────────────────── */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-1">My HVAC Systems</h2>
        <p className="text-sm text-gray-400 mb-5">
          Blower type, airflow, and electricity rate are set per device — they
          power each monitor&apos;s savings math.
        </p>
        {devices.length > 0 ? (
          <div className="space-y-3">
            {devices.map((d) => (
              <Link
                key={d.id}
                href={`/devices/${d.id}`}
                className="flex items-center justify-between gap-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-4 py-3 transition-all"
              >
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">
                    {d.name ?? d.deviceId}
                    {d.location ? (
                      <span className="text-gray-500 font-normal"> · {d.location}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-gray-400">
                    {d.blowerType === "ecm" ? "Variable-speed (ECM)" : "Fixed-speed (PSC)"} ·{" "}
                    {d.airflowCfm} CFM · {d.electricityRateCents}¢/kWh
                  </p>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-full text-xs ${
                    d.status === "active"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {d.status}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <Link href="/setup" className="text-sm text-blue-400 hover:text-blue-300">
            No devices yet — set up your smart filter monitor →
          </Link>
        )}
      </div>
    </>
  );
}
