import Link from "next/link";

export const metadata = {
  title: "Installation Guide — MySmartFilter",
  description:
    "How the smart filter monitor installs on any furnace: one small hole on each side of the filter, two tubes, plug in. Diagrams for the four most common HVAC setups.",
};

/**
 * Customer-facing install guide. One principle covers every system: the
 * monitor measures the pressure DIFFERENCE across the filter, so it needs a
 * tube tapped on each side of it. The four diagrams below cover nearly all
 * US homes.
 */

// Shared SVG palette (fixed Nordic Arch light theme to match the site)
const C = {
  duct: "#eae6dd",
  ductLine: "#b8b2a4",
  metal: "#dfdacf",
  surface: "#ffffff",
  muted: "#55524a",
  faint: "#8a867c",
  accent: "#1c1b18",
  warn: "#b9652f",
  ok: "#3e8a72",
};

function MonitorBox({ x, y }: { x: number; y: number }) {
  return (
    <>
      <rect x={x} y={y} width="76" height="52" rx="8" fill={C.surface} stroke={C.accent} strokeWidth="2" />
      <rect x={x + 12} y={y + 14} width="52" height="6" rx="3" fill={C.accent} />
      <rect x={x + 18} y={y + 26} width="40" height="6" rx="3" fill={C.accent} opacity="0.7" />
      <text x={x + 38} y={y + 70} fill={C.accent} fontSize="11" textAnchor="middle" fontWeight="600">
        Monitor
      </text>
    </>
  );
}

function UpflowDiagram() {
  return (
    <svg
      className="w-full h-auto block rounded-2xl border border-mist bg-paper"
      viewBox="0 0 460 300"
      role="img"
      aria-label="Upflow furnace: return duct enters low on the side, filter sits in a slot at the cabinet base, taps on each side of the filter slot"
    >
      <rect x="180" y="14" width="120" height="42" fill={C.duct} stroke={C.ductLine} />
      <text x="240" y="40" fill={C.muted} fontSize="12" textAnchor="middle">Supply duct</text>
      <rect x="170" y="56" width="140" height="210" rx="6" fill={C.metal} stroke={C.ductLine} />
      <text x="240" y="112" fill={C.muted} fontSize="12" textAnchor="middle">Furnace</text>
      <circle cx="240" cy="176" r="26" fill="none" stroke={C.ductLine} strokeWidth="2" />
      <path d="M240 156 a20 20 0 0 1 17 30 M240 196 a20 20 0 0 1 -17 -30" fill="none" stroke={C.ductLine} strokeWidth="2" />
      <text x="240" y="222" fill={C.muted} fontSize="11" textAnchor="middle">Blower</text>
      <rect x="24" y="216" width="146" height="50" fill={C.duct} stroke={C.ductLine} />
      <text x="95" y="243" fill={C.muted} fontSize="12" textAnchor="middle">Return duct</text>
      <rect x="163" y="212" width="12" height="58" fill={C.accent} opacity="0.85" />
      <text x="169" y="290" fill={C.accent} fontSize="11" textAnchor="middle">Filter slot</text>
      <path d="M40 241 h70" stroke={C.faint} strokeWidth="2" markerEnd="url(#arr1)" />
      <path d="M240 140 v-50" stroke={C.faint} strokeWidth="2" markerEnd="url(#arr1)" />
      <defs>
        <marker id="arr1" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 z" fill={C.faint} />
        </marker>
      </defs>
      <circle cx="140" cy="222" r="7" fill={C.warn} />
      <text x="140" y="208" fill={C.warn} fontSize="11" textAnchor="middle" fontWeight="600">Tap A</text>
      <circle cx="196" cy="248" r="7" fill={C.ok} />
      <text x="205" y="237" fill={C.ok} fontSize="11" fontWeight="600">Tap B</text>
      <MonitorBox x={356} y={180} />
      <path d="M140 229 C 140 292, 340 300, 362 226" fill="none" stroke={C.warn} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M203 248 C 260 280, 330 268, 358 220" fill="none" stroke={C.ok} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function MediaCabinetDiagram() {
  return (
    <svg
      className="w-full h-auto block rounded-2xl border border-mist bg-paper"
      viewBox="0 0 460 300"
      role="img"
      aria-label="External filter cabinet mounted between the vertical return drop and the furnace, taps on the duct above and below the cabinet"
    >
      <rect x="60" y="14" width="70" height="88" fill={C.duct} stroke={C.ductLine} />
      <text x="95" y="60" fill={C.muted} fontSize="12" textAnchor="middle">Return</text>
      <rect x="46" y="102" width="98" height="64" rx="4" fill={C.metal} stroke={C.ductLine} />
      <rect x="56" y="112" width="12" height="44" fill={C.accent} opacity="0.85" />
      <text x="100" y="140" fill={C.muted} fontSize="11">Filter</text>
      <text x="100" y="154" fill={C.muted} fontSize="11">cabinet</text>
      <rect x="60" y="166" width="70" height="56" fill={C.duct} stroke={C.ductLine} />
      <rect x="150" y="150" width="130" height="120" rx="6" fill={C.metal} stroke={C.ductLine} />
      <text x="215" y="215" fill={C.muted} fontSize="12" textAnchor="middle">Furnace</text>
      <rect x="180" y="108" width="70" height="42" fill={C.duct} stroke={C.ductLine} />
      <text x="215" y="133" fill={C.muted} fontSize="11" textAnchor="middle">Supply</text>
      <path d="M95 26 v40" stroke={C.faint} strokeWidth="2" markerEnd="url(#arr2)" />
      <defs>
        <marker id="arr2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 z" fill={C.faint} />
        </marker>
      </defs>
      <circle cx="122" cy="90" r="7" fill={C.warn} />
      <text x="140" y="84" fill={C.warn} fontSize="11" fontWeight="600">Tap A</text>
      <circle cx="122" cy="180" r="7" fill={C.ok} />
      <text x="140" y="186" fill={C.ok} fontSize="11" fontWeight="600">Tap B</text>
      <MonitorBox x={340} y={60} />
      <path d="M129 88 C 220 60, 280 70, 342 80" fill="none" stroke={C.warn} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M129 178 C 250 150, 300 130, 344 100" fill="none" stroke={C.ok} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function HorizontalDiagram() {
  return (
    <svg
      className="w-full h-auto block rounded-2xl border border-mist bg-paper"
      viewBox="0 0 460 300"
      role="img"
      aria-label="Horizontal furnace lying on its side: return duct on the left, filter slot where the return meets the unit, supply on the right, taps on each side of the slot"
    >
      <rect x="16" y="120" width="110" height="70" fill={C.duct} stroke={C.ductLine} />
      <text x="71" y="158" fill={C.muted} fontSize="12" textAnchor="middle">Return</text>
      <rect x="126" y="112" width="12" height="86" fill={C.accent} opacity="0.85" />
      <text x="132" y="222" fill={C.accent} fontSize="11" textAnchor="middle">Filter slot</text>
      <rect x="138" y="104" width="200" height="102" rx="6" fill={C.metal} stroke={C.ductLine} />
      <text x="238" y="145" fill={C.muted} fontSize="12" textAnchor="middle">Furnace / air handler</text>
      <circle cx="190" cy="176" r="18" fill="none" stroke={C.ductLine} strokeWidth="2" />
      <text x="190" y="180" fill={C.muted} fontSize="9" textAnchor="middle">fan</text>
      <rect x="338" y="120" width="106" height="70" fill={C.duct} stroke={C.ductLine} />
      <text x="391" y="158" fill={C.muted} fontSize="12" textAnchor="middle">Supply</text>
      <path d="M30 155 h60" stroke={C.faint} strokeWidth="2" markerEnd="url(#arr3)" />
      <path d="M350 155 h60" stroke={C.faint} strokeWidth="2" markerEnd="url(#arr3)" />
      <defs>
        <marker id="arr3" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 z" fill={C.faint} />
        </marker>
      </defs>
      <circle cx="106" cy="128" r="7" fill={C.warn} />
      <text x="106" y="112" fill={C.warn} fontSize="11" textAnchor="middle" fontWeight="600">Tap A</text>
      <circle cx="158" cy="128" r="7" fill={C.ok} />
      <text x="162" y="112" fill={C.ok} fontSize="11" fontWeight="600">Tap B</text>
      <MonitorBox x={204} y={24} />
      <path d="M106 121 C 110 60, 160 44, 206 44" fill="none" stroke={C.warn} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M158 121 C 166 80, 180 62, 206 58" fill="none" stroke={C.ok} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function GrilleDiagram() {
  return (
    <svg
      className="w-full h-auto block rounded-2xl border border-mist bg-paper"
      viewBox="0 0 460 300"
      role="img"
      aria-label="Return grille in a wall with the filter directly behind it: Tap A senses room air at the grille, Tap B taps the duct behind the filter"
    >
      <rect x="150" y="20" width="18" height="260" fill={C.metal} stroke={C.ductLine} />
      <text x="159" y="14" fill={C.muted} fontSize="10" textAnchor="middle">Wall</text>
      <rect x="120" y="90" width="30" height="120" rx="4" fill={C.surface} stroke={C.ductLine} />
      <g stroke={C.ductLine} strokeWidth="3">
        <line x1="126" y1="100" x2="144" y2="100" />
        <line x1="126" y1="115" x2="144" y2="115" />
        <line x1="126" y1="130" x2="144" y2="130" />
        <line x1="126" y1="145" x2="144" y2="145" />
        <line x1="126" y1="160" x2="144" y2="160" />
        <line x1="126" y1="175" x2="144" y2="175" />
        <line x1="126" y1="190" x2="144" y2="190" />
      </g>
      <text x="100" y="150" fill={C.muted} fontSize="12" textAnchor="end">Return grille</text>
      <rect x="168" y="92" width="12" height="116" fill={C.accent} opacity="0.85" />
      <text x="174" y="228" fill={C.accent} fontSize="11" textAnchor="middle">Filter</text>
      <rect x="180" y="80" width="150" height="140" fill={C.duct} stroke={C.ductLine} />
      <text x="255" y="155" fill={C.muted} fontSize="12" textAnchor="middle">Return duct → unit</text>
      <path d="M60 150 h44" stroke={C.faint} strokeWidth="2" markerEnd="url(#arr4)" />
      <path d="M255 168 h40" stroke={C.faint} strokeWidth="2" markerEnd="url(#arr4)" />
      <defs>
        <marker id="arr4" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 z" fill={C.faint} />
        </marker>
      </defs>
      <circle cx="135" cy="76" r="7" fill={C.warn} />
      <text x="135" y="62" fill={C.warn} fontSize="11" textAnchor="middle" fontWeight="600">Tap A · room side</text>
      <circle cx="200" cy="100" r="7" fill={C.ok} />
      <text x="216" y="96" fill={C.ok} fontSize="11" fontWeight="600">Tap B</text>
      <MonitorBox x={350} y={40} />
      <path d="M142 74 C 220 30, 300 34, 352 56" fill="none" stroke={C.warn} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M207 98 C 270 80, 310 72, 352 72" fill="none" stroke={C.ok} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function SetupCard({
  freq,
  freqCommon,
  title,
  diagram,
  steps,
}: {
  freq: string;
  freqCommon?: boolean;
  title: string;
  diagram: React.ReactNode;
  steps: React.ReactNode[];
}) {
  return (
    <section className="rounded-[24px] border border-mist bg-card p-6">
      <p
        className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${
          freqCommon ? "text-sage" : "text-faint"
        }`}
      >
        {freq}
      </p>
      <h2 className="text-xl font-semibold text-ink mb-4">{title}</h2>
      {diagram}
      <ol className="mt-4 space-y-1.5 text-sm text-body list-decimal list-inside">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </section>
  );
}

export default function InstallPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto w-full px-4 py-12 max-w-5xl">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="mb-10">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-sage mb-2">
            Installation Guide
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-normal mb-4 tracking-tight">
            How the monitor installs on any furnace
          </h1>
          <p className="text-body text-lg max-w-3xl">
            One principle covers every system: the smart filter monitor measures
            the pressure <em>difference</em> across your filter, so it needs one
            tube tapped on each side of it — one where air enters the filter
            (dusty side), one where air leaves it (clean side). Below are the
            four layouts that cover nearly all US homes.
          </p>
        </header>

        {/* ── Universal recipe ───────────────────────────────────────────── */}
        <section className="rounded-[24px] border border-sage/30 bg-sagemist p-6 mb-8">
          <h2 className="text-lg font-semibold text-ink mb-1">
            The universal recipe
          </h2>
          <p className="text-body text-sm mb-4">
            Find the filter → drill a ¼″ hole on each side of it → push a tube
            into each hole → connect both tubes to the monitor → plug in.
            About 15 minutes with a drill; everything else is in the kit.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-body">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-clay shrink-0" />
              Tap A — before the filter (return / dusty side)
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-sage shrink-0" />
              Tap B — after the filter (blower / clean side)
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-ink shrink-0" />
              Monitor — mounts to the cabinet, tubes ≤ 24″
            </span>
          </div>
        </section>

        {/* ── The four setups ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SetupCard
            freq="Most common · basements & utility closets"
            freqCommon
            title="Upflow furnace, side return"
            diagram={<UpflowDiagram />}
            steps={[
              <>Your filter sits in a slot where the return duct meets the <strong className="text-ink">bottom of the cabinet</strong>.</>,
              <><strong className="text-ink">Tap A:</strong> drill into the return duct 2–6″ before the filter slot.</>,
              <><strong className="text-ink">Tap B:</strong> drill into the blower compartment just past the slot.</>,
              <>Mount the monitor on the cabinet side, out of the way of the access panels.</>,
            ]}
          />
          <SetupCard
            freq="Very common · with 4–5″ media filters"
            freqCommon
            title="Filter cabinet in the return drop"
            diagram={<MediaCabinetDiagram />}
            steps={[
              <>A separate <strong className="text-ink">filter cabinet</strong> sits between the return duct and the furnace.</>,
              <><strong className="text-ink">Tap A:</strong> drill the return duct just <strong className="text-ink">above</strong> (upstream of) the cabinet.</>,
              <><strong className="text-ink">Tap B:</strong> drill the duct or cabinet just <strong className="text-ink">below</strong> (downstream of) the filter.</>,
              <>Works identically for 1″ slots and 4–5″ media filters.</>,
            ]}
          />
          <SetupCard
            freq="Common in attics & crawlspaces"
            title="Horizontal unit"
            diagram={<HorizontalDiagram />}
            steps={[
              <>The unit lies on its side; the filter slot is at the <strong className="text-ink">end where the return duct connects</strong>.</>,
              <><strong className="text-ink">Tap A:</strong> drill the return duct a few inches before the slot.</>,
              <><strong className="text-ink">Tap B:</strong> drill the cabinet just past the slot.</>,
              <>Strap or screw the monitor to the top of the unit — keep it clear of the condensate pan.</>,
            ]}
          />
          <SetupCard
            freq="Common in ranch homes & apartments"
            title="Filter behind a wall / ceiling grille"
            diagram={<GrilleDiagram />}
            steps={[
              <>The filter sits <strong className="text-ink">directly behind the return grille</strong> in a wall or ceiling.</>,
              <><strong className="text-ink">Tap A</strong> simply senses room air — the tube tucks behind the grille frame, <strong className="text-ink">no drilling</strong>.</>,
              <><strong className="text-ink">Tap B:</strong> one small hole into the duct wall <strong className="text-ink">behind</strong> the filter.</>,
              <>Monitor mounts beside the grille; needs an outlet within reach of the power cord.</>,
            ]}
          />
        </div>

        {/* ── Universal rules ────────────────────────────────────────────── */}
        <section className="mt-8 rounded-[24px] border border-mist bg-card p-6">
          <h2 className="text-lg font-semibold text-ink mb-3">
            Rules that apply to every setup
          </h2>
          <ul className="space-y-2.5 text-sm text-body list-disc list-inside">
            <li>
              <strong className="text-ink">Tap placement:</strong> 2–6″ from
              the filter on each side, in a flat section of sheet metal — never
              in a seam or corner.
            </li>
            <li>
              <strong className="text-ink">Drilling:</strong> ¼″ bit, sheet
              metal only. The kit&apos;s grommets seal each hole around the tube
              — no air leaks, and the hole is invisible if you ever remove the
              monitor.
            </li>
            <li>
              <strong className="text-ink">Tube routing:</strong> keep tubes
              short (≤ 24″), without kinks or sags. Either tube can be A or B —
              the app figures out flow direction from the readings.
            </li>
            <li>
              <strong className="text-ink">Mounting:</strong> the monitor
              sticks to the cabinet with the included adhesive pad or two
              screws. Keep it clear of access panels you open to change the
              filter.
            </li>
            <li>
              <strong className="text-ink">Power:</strong> standard wall
              adapter — most furnaces have a service outlet within a few feet.
            </li>
          </ul>
          <div className="mt-5 rounded-2xl border border-clay/30 bg-clay/10 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-clay mb-1">
              Don&apos;t drill here
            </p>
            <p className="text-sm text-body">
              Never drill into the supply side near the indoor AC coil
              (refrigerant lines), through anything with wiring or gas lines
              behind it, or into the heat-exchanger section of the furnace body.
              When unsure, tap the return duct — it&apos;s always safe sheet
              metal.
            </p>
          </div>
        </section>

        {/* ── After the drill ────────────────────────────────────────────── */}
        <section className="mt-8 rounded-[24px] border border-mist bg-card p-6">
          <h2 className="text-lg font-semibold text-ink mb-3">
            After the tubes are in: connect it to your WiFi
          </h2>
          <ol className="space-y-2 text-sm text-body list-decimal list-inside">
            <li>Plug in the power adapter — the monitor starts a temporary WiFi network.</li>
            <li>Join that network from your phone and enter your home WiFi when asked.</li>
            <li>
              Scan the QR label on the monitor to register it to your account —
              that&apos;s it. No app to install, no wiring, no tools beyond the
              drill.
            </li>
          </ol>
        </section>

        {/* ── CTA ────────────────────────────────────────────────────────── */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/store"
            className="px-8 py-3 bg-sage hover:bg-sage-deep text-white rounded-full font-semibold transition-all"
          >
            Get your monitor
          </Link>
          <Link
            href="/setup"
            className="px-8 py-3 border border-mist bg-card hover:bg-mist/60 text-ink rounded-full font-semibold transition-all"
          >
            Already have one? Set it up →
          </Link>
        </div>
      </div>
    </main>
  );
}
