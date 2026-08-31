import Link from "next/link";

/**
 * The pleats lockup: three staggered bars (filter pleats doubling as a tiny
 * chart) beside the split-weight wordmark. `dark` renders for dark surfaces.
 */
export function PleatsMark({
  size = 24,
  dark = false,
}: {
  size?: number;
  dark?: boolean;
}) {
  const ink = dark ? "#FAF8F5" : "#1C1B18";
  return (
    <svg
      width={(size * 22) / 26}
      height={size}
      viewBox="0 0 22 26"
      fill="none"
      aria-hidden="true"
    >
      <rect x="0" y="11" width="5.5" height="15" rx="2.75" fill="#3E8A72" />
      <rect x="8.25" y="2" width="5.5" height="24" rx="2.75" fill={ink} />
      <rect x="16.5" y="7" width="5.5" height="19" rx="2.75" fill="#3E8A72" />
    </svg>
  );
}

export function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <span
      className={`text-[17px] font-semibold tracking-[-0.035em] ${dark ? "text-paper" : "text-ink"}`}
    >
      <span className={`font-normal ${dark ? "text-glow" : "text-sage"}`}>
        my
      </span>
      smartfilter
    </span>
  );
}

export function Logo({
  dark = false,
  size = 24,
  href = "/",
}: {
  dark?: boolean;
  size?: number;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className="flex shrink-0 items-center gap-2.5 hover:opacity-85 transition-opacity"
    >
      <PleatsMark size={size} dark={dark} />
      <Wordmark dark={dark} />
    </Link>
  );
}
