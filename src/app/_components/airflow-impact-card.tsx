import type { AirflowImpact } from "~/lib/airflow-impact";

/**
 * Hero tile at the top of the device page: what the filter's dirt is doing
 * to the system, in the currency the home actually experiences — airflow
 * for fixed-speed blowers, energy dollars for variable-speed (which defend
 * their airflow and burn watts instead). Pa charts stay below for the
 * instrument-panel crowd.
 */
export function AirflowImpactCard({
  impact,
  filterInstalledAt,
}: {
  impact: AirflowImpact;
  filterInstalledAt: Date | null;
}) {
  const installedLabel = filterInstalledAt
    ? filterInstalledAt.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : null;

  if (impact.kind === "pending") {
    return (
      <div className="mb-6 rounded-[24px] border border-mist bg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint mb-1">
          Airflow impact of your filter
        </p>
        <p className="font-display text-3xl text-whisper">Measuring…</p>
        <p className="mt-1 text-sm text-body">
          {impact.reason === "no-baseline"
            ? "Your fresh-filter baseline will be captured the next time your system runs."
            : "Waiting for your system to run — the measurement is taken in the first minutes of a cycle."}
        </p>
      </div>
    );
  }

  if (impact.kind === "ecm") {
    const dollars = (impact.extraCostCents / 100).toFixed(2);
    return (
      <div className="mb-6 rounded-[24px] border border-mist bg-card p-6">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            Energy impact of your filter
          </p>
          <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold text-body">
            Measured
          </span>
        </div>
        <p className="font-display text-4xl text-ink">${dollars}</p>
        <p className="mt-1 text-sm text-body">
          Extra electricity spent pushing air through this filter
          {installedLabel ? ` since it was installed ${installedLabel}` : ""}.
          Your variable-speed fan holds airflow steady and works harder
          instead — this is what that effort costs.
        </p>
      </div>
    );
  }

  const pct = impact.lossFraction * 100;
  const tone =
    pct >= 15
      ? { text: "text-red-600", chip: "bg-red-50 text-red-600" }
      : pct >= 5
        ? { text: "text-clay", chip: "bg-clay/10 text-clay" }
        : { text: "text-sage", chip: "bg-sagemist text-sage-deep" };
  const pctLabel = pct < 0.05 ? "0%" : pct < 1 ? "<1%" : `−${pct.toFixed(1)}%`;

  return (
    <div className="mb-6 rounded-[24px] border border-mist bg-card p-6">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">
          Airflow impact of your filter
        </p>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone.chip}`}>
          Estimated
        </span>
      </div>
      <div className="flex items-baseline gap-3 flex-wrap">
        <p className={`font-display text-4xl ${tone.text}`}>{pctLabel}</p>
        {impact.cfmLost !== null && impact.q0Cfm !== null && (
          <p className="text-lg text-body">
            ≈ {impact.cfmLost} CFM of your ~{Math.round(impact.q0Cfm)} CFM
          </p>
        )}
      </div>
      <p className="mt-1 text-sm text-body">
        {pct < 1
          ? `Your filter is barely restricting airflow${installedLabel ? ` — effectively as fresh as when it was installed ${installedLabel}` : ""}. No wasted energy yet.`
          : `How much less air your system moves because of dirt collected${installedLabel ? ` since ${installedLabel}` : ""} — less airflow means longer run times and more energy per degree of comfort.`}
      </p>
      {impact.cfmLost === null && (
        <p className="mt-2 text-xs text-faint">
          Select your exact filter model in Filter Settings below and this
          reading also shows real CFM, calibrated from that filter&apos;s
          published airflow curve.
        </p>
      )}
    </div>
  );
}
