"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => void signOut({ callbackUrl: "/" })}
      className="px-3 py-1.5 text-sm text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
    >
      Sign Out
    </button>
  );
}
