"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => void signOut({ callbackUrl: "/" })}
      className="rounded-full border border-red-200 px-3 py-1.5 text-sm text-red-600 transition-all hover:bg-red-50"
    >
      Sign Out
    </button>
  );
}
