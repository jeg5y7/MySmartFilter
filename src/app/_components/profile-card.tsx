"use client";

import Link from "next/link";
import { api } from "~/trpc/react";

/** Compact profile summary for the dashboard sidebar. */
export function ProfileCard() {
  const { data } = api.user.getProfile.useQuery();

  const user = data?.user;
  const shippingReady = !!data; // billing lives on /profile; this card links there

  return (
    <div className="rounded-xl bg-white/10 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-white">My Profile</h3>
        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-xs">
          Pay-per-filter
        </span>
      </div>

      <div className="space-y-3 mb-5">
        <div>
          <p className="text-xs text-white/50 uppercase tracking-wide">Name</p>
          <p className="text-white">
            {user?.name ?? <span className="text-white/40">Not set</span>}
          </p>
        </div>
        <div>
          <p className="text-xs text-white/50 uppercase tracking-wide">Email</p>
          <p className="text-white truncate">{user?.email ?? "…"}</p>
        </div>
        <div>
          <p className="text-xs text-white/50 uppercase tracking-wide">Default filter</p>
          <p className="text-white">
            {data?.defaultPref ? (
              `${data.defaultPref.filterProduct.size} — ${data.defaultPref.filterProduct.name}`
            ) : (
              <span className="text-amber-300/80">Not chosen yet</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-xs text-white/50 uppercase tracking-wide">Auto-order</p>
          <p className="text-white">
            {data ? (
              data.autoOrderCount > 0 ? (
                <span className="text-emerald-300">
                  Active ({data.autoOrderCount})
                </span>
              ) : (
                <span className="text-white/60">Off</span>
              )
            ) : (
              "…"
            )}
          </p>
        </div>
      </div>

      <Link
        href="/profile"
        className="block w-full text-center py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
      >
        {shippingReady ? "Manage Profile" : "Open Profile"}
      </Link>
    </div>
  );
}
