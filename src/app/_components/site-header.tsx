import Link from "next/link";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { SignOutButton } from "./sign-out-button";
import { PleatsMark, Wordmark } from "./logo";

/** Global navigation: wordmark → home, section links, session controls. */
export async function SiteHeader() {
  const session = await auth();
  const isAdmin = session?.user?.id
    ? (
        await db.user.findUnique({
          where: { id: session.user.id },
          select: { isAdmin: true },
        })
      )?.isAdmin ?? false
    : false;

  return (
    <header className="sticky top-0 z-50 bg-paper/90 backdrop-blur-lg border-b border-mist">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 hover:opacity-85 transition-opacity"
        >
          <PleatsMark size={22} />
          <Wordmark />
        </Link>

        {/* Every link stays visible at every width; the row scrolls sideways
            on narrow phones instead of dropping items. */}
        <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {session?.user ? (
            <>
              <Link
                href="/dashboard"
                className="px-2.5 sm:px-3 py-1.5 text-sm text-body hover:text-ink hover:bg-mist/60 rounded-full transition-all"
              >
                Dashboard
              </Link>
              <Link
                href="/devices"
                className="px-2.5 sm:px-3 py-1.5 text-sm text-body hover:text-ink hover:bg-mist/60 rounded-full transition-all"
              >
                Devices
              </Link>
              <Link
                href="/store"
                className="px-2.5 sm:px-3 py-1.5 text-sm text-body hover:text-ink hover:bg-mist/60 rounded-full transition-all"
              >
                Store
              </Link>
              <Link
                href="/install"
                className="px-2.5 sm:px-3 py-1.5 text-sm text-body hover:text-ink hover:bg-mist/60 rounded-full transition-all"
              >
                Install
              </Link>
              <Link
                href="/profile"
                className="px-2.5 sm:px-3 py-1.5 text-sm text-body hover:text-ink hover:bg-mist/60 rounded-full transition-all"
              >
                Profile
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="px-2.5 sm:px-3 py-1.5 text-sm text-clay hover:opacity-80 hover:bg-mist/60 rounded-full transition-all"
                >
                  Admin
                </Link>
              )}
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/store"
                className="px-2.5 sm:px-3 py-1.5 text-sm text-body hover:text-ink hover:bg-mist/60 rounded-full transition-all"
              >
                Store
              </Link>
              <Link
                href="/install"
                className="px-2.5 sm:px-3 py-1.5 text-sm text-body hover:text-ink hover:bg-mist/60 rounded-full transition-all"
              >
                Installation
              </Link>
              <Link
                href="/signin"
                className="px-4 py-1.5 text-sm text-paper bg-ink hover:bg-ink/85 rounded-full font-medium transition-all"
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
