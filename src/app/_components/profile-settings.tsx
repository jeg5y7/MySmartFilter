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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage" />
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
      <div className="rounded-[24px] border border-mist bg-card p-6">
        <h2 className="text-lg font-semibold text-ink mb-4">Account</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-faint mb-1">Name</p>
              {!editingName ? (
                <p className="text-ink truncate">
                  {user?.name ?? <span className="text-whisper">Not set</span>}
                </p>
              ) : (
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Your name"
                  maxLength={100}
                  className="w-full rounded-full border border-mist bg-card px-3 py-2 text-sm text-ink placeholder:text-whisper focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20"
                />
              )}
            </div>
            {!editingName ? (
              <button
                onClick={() => {
                  setNameInput(user?.name ?? "");
                  setEditingName(true);
                }}
                className="shrink-0 text-sm text-sage hover:text-sage-deep transition-colors"
              >
                Edit
              </button>
            ) : (
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => updateProfile.mutate({ name: nameInput })}
                  disabled={updateProfile.isPending || !nameInput.trim()}
                  className="rounded-full bg-sage px-3 py-1.5 text-sm font-semibold text-white transition-all hover:bg-sage-deep disabled:bg-sage/40"
                >
                  {updateProfile.isPending ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="rounded-full border border-mist bg-card px-3 py-1.5 text-sm font-semibold text-ink transition-all hover:bg-mist/60"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-faint mb-1">Email</p>
            <p className="text-ink">{user?.email}</p>
          </div>

          {memberSince && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-faint mb-1">Member since</p>
              <p className="text-body">{memberSince}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Plan ─────────────────────────────────────────────────────────── */}
      <div className="rounded-[24px] border border-mist bg-card p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-ink">Plan</h2>
          {autoOrderCount > 0 ? (
            <span className="rounded-full bg-sagemist px-3 py-1 text-xs font-semibold text-sage-deep">
              Filter AutoShip
            </span>
          ) : (
            <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold text-body">
              Free monitoring
            </span>
          )}
        </div>
        {autoOrderCount > 0 ? (
          <p className="text-sm text-body">
            You&apos;re an AutoShip member — filters ship automatically when
            replacing saves you money, and your plan includes the
            energy-savings calculation, historical trending, and upcoming
            HVAC diagnostics. No monthly fee — you simply get your filters
            through us.
          </p>
        ) : (
          <p className="text-sm text-body">
            You have live readings on your dashboard and smart home.{" "}
            <span className="text-clay">
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
      <div className="rounded-[24px] border border-mist bg-card p-6">
        <h2 className="text-lg font-semibold text-ink mb-1">Default Filter</h2>
        <p className="text-sm text-faint mb-5">
          Used for any device that doesn&apos;t have its own filter choice. A
          device&apos;s own setting always wins.
        </p>

        <select
          value={selectedProduct}
          onChange={(e) => setPrefProduct(e.target.value)}
          className="w-full rounded-full border border-mist bg-card px-4 py-2.5 text-sm text-ink focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20 mb-4"
        >
          <option value="">
            Select filter size…
          </option>
          {filterProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.size} — {p.name}
              {p.merv ? ` (MERV ${p.merv})` : ""} — {fmtUsd(p.price)}
            </option>
          ))}
        </select>

        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm font-medium text-ink">Auto-Order by default</p>
            <p className="text-xs text-faint">
              Ship a replacement automatically when it saves money
            </p>
          </div>
          <button
            onClick={() => setPrefAutoOrder(!autoOrderOn)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              autoOrderOn ? "bg-sage" : "bg-mist"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
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
          className="w-full rounded-full bg-sage py-3 font-semibold text-white transition-all hover:bg-sage-deep disabled:bg-sage/40 disabled:cursor-not-allowed"
        >
          {setDefaultPref.isPending ? "Saving…" : prefSaved ? "✓ Saved!" : "Save Default Filter"}
        </button>
        {setDefaultPref.error && (
          <p className="mt-3 text-sm text-red-600 text-center">
            {setDefaultPref.error.message}
          </p>
        )}
      </div>

      {/* ── HVAC systems ─────────────────────────────────────────────────── */}
      <div className="rounded-[24px] border border-mist bg-card p-6">
        <h2 className="text-lg font-semibold text-ink mb-1">My HVAC Systems</h2>
        <p className="text-sm text-faint mb-5">
          Blower type, airflow, and electricity rate are set per device — they
          power each monitor&apos;s savings math.
        </p>
        {devices.length > 0 ? (
          <div className="space-y-3">
            {devices.map((d) => (
              <Link
                key={d.id}
                href={`/devices/${d.id}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-mist bg-mist/30 px-4 py-3 transition-all hover:bg-mist/60"
              >
                <div className="min-w-0">
                  <p className="text-ink font-medium truncate">
                    {d.name ?? d.deviceId}
                    {d.location ? (
                      <span className="text-faint font-normal"> · {d.location}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-faint">
                    {d.furnaceMake || d.furnaceModel ? (
                      <>
                        {[d.furnaceMake, d.furnaceModel].filter(Boolean).join(" ")}
                        {" · "}
                      </>
                    ) : null}
                    {d.blowerType === "ecm" ? "Variable-speed (ECM)" : "Fixed-speed (PSC)"} ·{" "}
                    {d.airflowCfm} CFM · {d.electricityRateCents}¢/kWh
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    d.status === "active"
                      ? "bg-sagemist text-sage-deep"
                      : "bg-clay/10 text-clay"
                  }`}
                >
                  {d.status}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <Link href="/setup" className="text-sm text-sage hover:text-sage-deep">
            No devices yet — set up your smart filter monitor →
          </Link>
        )}
      </div>
    </>
  );
}
