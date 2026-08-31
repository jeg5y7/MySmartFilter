"use client";

import Link from "next/link";
import { api } from "~/trpc/react";

/** Compact profile summary for the dashboard sidebar. */
export function ProfileCard() {
  const { data } = api.user.getProfile.useQuery();

  const user = data?.user;
  const shippingReady = !!data; // billing lives on /profile; this card links there

  return (
    <div className="rounded-[24px] border border-mist bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-ink">My Profile</h3>
        {data && data.autoOrderCount > 0 ? (
          <span className="rounded-full bg-sagemist px-2.5 py-0.5 text-xs font-semibold text-sage-deep">
            Filter AutoShip
          </span>
        ) : (
          <span className="rounded-full bg-mist px-2.5 py-0.5 text-xs font-semibold text-body">
            Free monitoring
          </span>
        )}
      </div>

      <div className="space-y-3 mb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">Name</p>
          <p className="text-ink">
            {user?.name ?? <span className="text-whisper">Not set</span>}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">Email</p>
          <p className="text-ink truncate">{user?.email ?? "…"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">Default filter</p>
          <p className="text-ink">
            {data?.defaultPref ? (
              `${data.defaultPref.filterProduct.size} — ${data.defaultPref.filterProduct.name}`
            ) : (
              <span className="text-clay">Not chosen yet</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">Auto-order</p>
          <p className="text-ink">
            {data ? (
              data.autoOrderCount > 0 ? (
                <span className="text-sage">
                  Active ({data.autoOrderCount})
                </span>
              ) : (
                <span className="text-faint">Off</span>
              )
            ) : (
              "…"
            )}
          </p>
        </div>
      </div>

      <Link
        href="/profile"
        className="block w-full rounded-full bg-ink py-2.5 text-center text-sm font-semibold text-paper transition-colors hover:bg-ink/85"
      >
        {shippingReady ? "Manage Profile" : "Open Profile"}
      </Link>
    </div>
  );
}
