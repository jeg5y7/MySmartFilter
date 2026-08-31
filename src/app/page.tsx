import Link from "next/link";

import { api, HydrateClient } from "~/trpc/server";
import { auth } from "~/server/auth";
import { WaitlistForm } from "~/app/_components/waitlist-form";

/* Nordic Arch — light editorial system. Display serif for headlines,
   sage accent, arch-framed product panel, generous whitespace. */

function GlowMonitor({ scale = 1 }: { scale?: number }) {
  return (
    <div
      className="relative rounded-[22px] shadow-[inset_0_1px_0_#ffffff]"
      style={{
        width: 190 * scale,
        height: 122 * scale,
        background: "linear-gradient(180deg, #F4F2ED, #E9E6DF)",
      }}
    >
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: 44 * scale,
          height: 44 * scale,
          background:
            "radial-gradient(circle, rgba(96,199,160,0.95) 0%, rgba(96,199,160,0.25) 55%, transparent 75%)",
        }}
      />
    </div>
  );
}

function LiveReadingCard() {
  return (
    <div className="w-full flex flex-col gap-2.5">
      <div className="flex justify-between items-baseline">
        <span className="text-[13px] text-faint">Right now</span>
        <span className="text-[13px] text-sage font-semibold">
          Filter healthy
        </span>
      </div>
      <div className="text-4xl font-semibold tracking-tight">
        121 <span className="text-lg font-medium text-faint">Pa</span>
      </div>
      <div className="h-1.5 rounded-full bg-mist overflow-hidden">
        <div className="h-full w-1/4 bg-sage rounded-full" />
      </div>
      <div className="text-[13px] text-faint">
        Wasted energy this month: $0.14
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg
      className="h-4 w-4 text-sage shrink-0 mt-0.5"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    void api.sensor.getLatest.prefetch({ limit: 5 });
  }

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col bg-paper text-ink">
        {/* ── Hero: copy left, sage arch panel right ─────────────────── */}
        <section className="relative overflow-hidden">
          <div className="mx-auto flex max-w-[1440px] flex-col lg:flex-row">
            <div className="flex-1 flex flex-col justify-center gap-7 px-6 sm:px-12 lg:pl-16 xl:pl-20 lg:pr-10 py-16 lg:py-24">
              <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-sage">
                We turn every filter into a smart filter
              </div>
              <h1 className="font-display text-5xl sm:text-6xl xl:text-7xl leading-[1.04] tracking-tight">
                Replace your HVAC filter{" "}
                <em className="text-sage">only once you need to.</em>
              </h1>
              <p className="max-w-xl text-lg sm:text-xl leading-relaxed text-body">
                The smart filter monitor works with the filter you already have
                — any brand, any size. It shows you in real time exactly how
                dirty your filter is, and ships a fresh one only when replacing
                saves you money. No guessing, no reminders, no wasted filters.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                {session ? (
                  <Link
                    href="/dashboard"
                    className="rounded-full bg-ink px-9 py-4 text-center font-semibold text-paper transition-all hover:bg-ink/85"
                  >
                    Go to your dashboard
                  </Link>
                ) : (
                  <a
                    href="#waitlist"
                    className="rounded-full bg-ink px-9 py-4 text-center font-semibold text-paper transition-all hover:bg-ink/85"
                  >
                    Join the launch list
                  </a>
                )}
                <a
                  href="#how-it-works"
                  className="text-center font-medium text-ink underline decoration-sage underline-offset-4 hover:text-sage transition-colors"
                >
                  See how it works
                </a>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13.5px] text-faint">
                <span>Any filter, any brand</span>
                <span aria-hidden="true">·</span>
                <span>2-minute install</span>
                <span aria-hidden="true">·</span>
                <span>No monthly fee</span>
              </div>
              <p className="max-w-xl text-sm text-whisper">
                &ldquo;How often should I really change my filter?&rdquo; Even
                the experts answer &ldquo;it depends&rdquo; —{" "}
                <a
                  href="https://www.waltonemc.com/blog/how-often-do-i-really-have-to-change-my-hvac-filter/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sage underline underline-offset-2 hover:text-sage-deep"
                >
                  see this utility-company explainer
                </a>
                . Your monitor replaces &ldquo;it depends&rdquo; with a
                measurement.
              </p>
            </div>

            {/* Sage panel with arch-framed product */}
            <div className="lg:w-[520px] xl:w-[560px] bg-sagemist flex items-end justify-center px-10 sm:px-14 pt-16 lg:pt-24">
              <div className="w-full max-w-[400px] rounded-t-[250px] bg-card px-8 sm:px-10 pb-12 pt-20 sm:pt-24 shadow-[0_18px_60px_rgba(28,27,24,0.10)] flex flex-col items-center gap-7">
                <GlowMonitor />
                <LiveReadingCard />
              </div>
            </div>
          </div>
        </section>

        {/* ── Why it matters ─────────────────────────────────────────── */}
        <section className="py-20 sm:py-24">
          <div className="container mx-auto px-6 sm:px-12">
            <div className="max-w-2xl mb-14">
              <h2 className="font-display text-4xl sm:text-5xl leading-tight mb-4">
                Your filter is already fine.{" "}
                <em className="text-sage">Now make it smart.</em>
              </h2>
              <p className="text-lg text-body leading-relaxed">
                No special filters required — the monitor works with whatever
                filter your system uses today. Save money, breathe cleaner air,
                and never think about filter schedules again.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-3xl bg-card p-8 shadow-[0_12px_36px_rgba(28,27,24,0.06)]">
                <div className="mb-5 flex h-11 w-11 items-end justify-center gap-[3px] rounded-2xl bg-sagemist pb-2.5">
                  <span className="w-[5px] rounded-full bg-sage" style={{ height: 12 }} />
                  <span className="w-[5px] rounded-full bg-ink" style={{ height: 20 }} />
                  <span className="w-[5px] rounded-full bg-sage" style={{ height: 16 }} />
                </div>
                <h3 className="mb-2 text-lg font-semibold">
                  It measures, not guesses
                </h3>
                <p className="text-[15px] leading-relaxed text-body">
                  The monitor reads the pressure drop across your filter all
                  day, every day — the honest signal of how much air your
                  filter is actually blocking.
                </p>
              </div>
              <div className="rounded-3xl bg-card p-8 shadow-[0_12px_36px_rgba(28,27,24,0.06)]">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-sagemist">
                  <svg className="h-5 w-5 text-sage" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3M4 4l2.1 2.1M13.9 13.9L16 16M16 4l-2.1 2.1M6.1 13.9L4 16" />
                    <circle cx="10" cy="10" r="3.2" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-semibold">
                  It knows the real cost
                </h3>
                <p className="text-[15px] leading-relaxed text-body">
                  A clogging filter makes your HVAC work harder than it needs
                  to. The monitor turns that into dollars — and acts only when
                  a new filter is genuinely cheaper.
                </p>
              </div>
              <div className="rounded-3xl bg-card p-8 shadow-[0_12px_36px_rgba(28,27,24,0.06)]">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-sagemist">
                  <svg className="h-5 w-5 text-sage" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6.5L10 2l7 4.5v7L10 18l-7-4.5v-7z" />
                    <path d="M6.5 10.2l2.3 2.3 4.7-5" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-semibold">
                  The right filter shows up
                </h3>
                <p className="text-[15px] leading-relaxed text-body">
                  You get an email before any order, with one-click cancel.
                  Otherwise the correct filter simply arrives before the old
                  one starts costing you money.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ───────────────────────────────────────────── */}
        <section id="how-it-works" className="bg-sagemist py-20 sm:py-24">
          <div className="container mx-auto px-6 sm:px-12">
            <div className="max-w-2xl mb-14">
              <h2 className="font-display text-4xl sm:text-5xl leading-tight mb-4">
                Up and running in minutes
              </h2>
              <p className="text-lg text-body leading-relaxed">
                No apps to install, no wiring, no technician. The monitor
                arrives assembled and walks you through setup from your phone.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  n: "1",
                  title: "Install the monitor",
                  body: "Drill one small hole on each side of your filter, slip in the kit's two flexible tubes, connect them to the monitor, and plug in the power adapter.",
                },
                {
                  n: "2",
                  title: "Connect it to your WiFi",
                  body: "The monitor creates its own temporary WiFi network. Join it from your phone, pick your home WiFi, then scan the QR label to link it to your account.",
                },
                {
                  n: "3",
                  title: "Let it do the math",
                  body: "It tracks your filter around the clock. When replacing would save you money, you get an email — and the new filter ships itself.",
                },
              ].map((step) => (
                <div
                  key={step.n}
                  className="rounded-t-[110px] rounded-b-3xl bg-card px-8 pb-8 pt-14 text-center shadow-[0_12px_36px_rgba(28,27,24,0.07)]"
                >
                  <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-sage font-display text-xl text-paper">
                    {step.n}
                  </div>
                  <h3 className="mb-2.5 text-lg font-semibold">{step.title}</h3>
                  <p className="text-[15px] leading-relaxed text-body">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Tiers ──────────────────────────────────────────────────── */}
        <section className="py-20 sm:py-24">
          <div className="container mx-auto px-6 sm:px-12">
            <div className="mx-auto max-w-2xl text-center mb-14">
              <h2 className="font-display text-4xl sm:text-5xl leading-tight mb-4">
                Your data is free. <em className="text-sage">The magic is in the filters.</em>
              </h2>
              <p className="text-lg text-body leading-relaxed">
                Every monitor comes with live data, no strings attached. Enroll
                in Filter AutoShip — your replacement filters, delivered
                automatically — and the full intelligence turns on. No monthly
                fee, ever.
              </p>
            </div>
            <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
              <div className="rounded-3xl bg-card p-9 shadow-[0_12px_36px_rgba(28,27,24,0.06)]">
                <h3 className="text-xl font-semibold mb-1">With every monitor</h3>
                <p className="mb-6 text-sm text-faint">Included free, forever</p>
                <ul className="space-y-3.5 text-[15px] text-body">
                  <li className="flex gap-2.5">
                    <Check />
                    Live pressure &amp; temperature on your dashboard
                  </li>
                  <li className="flex gap-2.5">
                    <Check />
                    Works with your smart home — Home Assistant today; Google
                    Home, Alexa &amp; SmartThings coming
                  </li>
                  <li className="flex gap-2.5">
                    <Check />
                    Device status at a glance
                  </li>
                </ul>
              </div>
              <div className="relative rounded-3xl bg-sagemist p-9 shadow-[0_12px_36px_rgba(28,27,24,0.06)]">
                <span className="absolute -top-3 left-8 rounded-full bg-sage px-3.5 py-1 text-xs font-semibold text-paper">
                  Filter AutoShip
                </span>
                <h3 className="text-xl font-semibold mb-1">
                  With automatic filter delivery
                </h3>
                <p className="mb-6 text-sm text-faint">
                  Just buy your filters through us — no subscription fee
                </p>
                <ul className="space-y-3.5 text-[15px] text-body">
                  <li className="flex gap-2.5">
                    <Check />
                    Everything in the free tier
                  </li>
                  <li className="flex gap-2.5">
                    <Check />
                    <span>
                      <strong className="text-ink">Energy-savings calculation</strong>{" "}
                      — what your filter costs you, in real dollars
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <Check />
                    <span>
                      <strong className="text-ink">Historical trending</strong> —
                      pressure, runtime, and cost over weeks and seasons
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <Check />
                    <span>
                      <strong className="text-ink">Filters ship themselves</strong>{" "}
                      — with an email and one-click cancel first
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <Check />
                    <span>
                      <strong className="text-ink">Advanced HVAC diagnostics</strong>{" "}
                      <span className="text-faint">(coming soon)</span>
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Waitlist ───────────────────────────────────────────────── */}
        <section id="waitlist" className="pb-24 pt-4">
          <div className="container mx-auto px-6 sm:px-12">
            <div className="mx-auto max-w-3xl rounded-[40px] bg-ink px-8 py-14 sm:px-14 text-center">
              <div className="mb-5 inline-block rounded-full bg-glow/15 px-4 py-1.5 text-[13px] font-semibold text-glow">
                Launching soon
              </div>
              <h2 className="font-display text-4xl sm:text-5xl leading-tight text-paper mb-4">
                Be first in line
              </h2>
              <p className="mx-auto mb-9 max-w-xl text-lg leading-relaxed text-paper/70">
                We&apos;re hand-building the first batch now. Join the launch
                list and you&apos;ll get one email the moment monitors are
                available — launch-list members get first dibs.
              </p>
              <WaitlistForm dark />
            </div>
          </div>
        </section>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer className="border-t border-mist py-14">
          <div className="container mx-auto px-6 sm:px-12">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
              <div>
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex items-end gap-[3px]" aria-hidden="true">
                    <span className="w-[5px] rounded-full bg-sage" style={{ height: 12 }} />
                    <span className="w-[5px] rounded-full bg-ink" style={{ height: 19 }} />
                    <span className="w-[5px] rounded-full bg-sage" style={{ height: 15 }} />
                  </span>
                  <span className="font-semibold tracking-tight">
                    <span className="font-normal text-sage">my</span>smartfilter
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-faint">
                  Replace your HVAC filter when the energy it wastes costs more
                  than a new one — automatically.
                </p>
              </div>
              <div>
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-whisper">
                  Product
                </h3>
                <ul className="space-y-2.5 text-sm text-body">
                  <li><Link href="/store" className="hover:text-ink transition-colors">Filter Store</Link></li>
                  <li><Link href="/install" className="hover:text-ink transition-colors">Installation Guide</Link></li>
                  <li><Link href="/setup" className="hover:text-ink transition-colors">Device Setup</Link></li>
                  <li><Link href="/dashboard" className="hover:text-ink transition-colors">Dashboard</Link></li>
                  <li><Link href="/settings/integrations" className="hover:text-ink transition-colors">API &amp; Integrations</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-whisper">
                  Legal
                </h3>
                <ul className="space-y-2.5 text-sm text-body">
                  <li><Link href="/terms" className="hover:text-ink transition-colors">Terms of Service</Link></li>
                  <li><Link href="/privacy" className="hover:text-ink transition-colors">Privacy Policy</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-whisper">
                  Contact
                </h3>
                <ul className="space-y-2.5 text-sm text-body">
                  <li>
                    <a href="mailto:support@mysmartfilter.com" className="hover:text-ink transition-colors">
                      support@mysmartfilter.com
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-mist pt-7 md:flex-row">
              <p className="text-sm text-whisper">
                © 2026 MySmartFilter. All rights reserved.
              </p>
              <div className="text-sm text-faint">
                <Link href="/privacy" className="hover:text-ink transition-colors">Privacy Policy</Link>
                <span className="mx-2 text-mist">·</span>
                <Link href="/terms" className="hover:text-ink transition-colors">Terms of Service</Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </HydrateClient>
  );
}
