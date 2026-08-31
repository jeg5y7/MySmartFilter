"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => void signOut({ callbackUrl: "/" })}
      className="px-3 py-1.5 text-sm text-body hover:text-ink bg-mist/50 hover:bg-mist border border-mist rounded-full transition-all"
    >
      Sign Out
    </button>
  );
}
