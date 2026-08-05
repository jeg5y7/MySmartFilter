import Link from "next/link";
import { auth } from "~/server/auth";
import { SignOutButton } from "./sign-out-button";

/** Global navigation: wordmark → home, section links, session controls. */
export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 bg-[#0f172a]/90 backdrop-blur-lg border-b border-white/10">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-white font-semibold tracking-tight hover:opacity-90 transition-opacity"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/20 border border-blue-500/40">
            <span className="block h-2.5 w-4 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400" />
          </span>
          MySmartFilter
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {session?.user ? (
            <>
              <Link
                href="/dashboard"
                className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              >
                Dashboard
              </Link>
              <Link
                href="/devices"
                className="hidden sm:block px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              >
                Devices
              </Link>
              <Link
                href="/store"
                className="hidden sm:block px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              >
                Store
              </Link>
              <Link
                href="/install"
                className="hidden md:block px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              >
                Installation
              </Link>
              <Link
                href="/profile"
                className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              >
                Profile
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/store"
                className="hidden sm:block px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              >
                Store
              </Link>
              <Link
                href="/install"
                className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              >
                Installation
              </Link>
              <Link
                href="/signin"
                className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-all"
              >
                Sign In
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
