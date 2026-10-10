"use client";

import { binsFor, type Domains, type Metric, type Theme } from "@/lib/metrics";

/**
 * The legend. Discrete colour blocks with the break value marked between
 * each pair.
 *
 * Why not a gradient bar: a gradient bar can only say "darker is larger" and
 * cannot turn a patch of map colour back into a number. Classes can: see a
 * colour, find the same block on the legend, and read off its range. Modelled
 * on the New York Fed's house price map (the direction listed in PRD §12).
 *
 * Two things that have to be made clear:
 *   1. Both ends are open-ended, so the two outermost classes have no outer
 *      tick. Units beyond the domain go into the outermost class; they are
 *      not dropped.
 *   2. Grey sits alongside the ramp; it is not one end of it.
 */
export default function Legend({
  metric,
  domains,
  category,
  theme,
}: {
  metric: Metric;
  domains: Domains;
  category: string;
  theme: Theme;
}) {
  const domain = domains[category]?.[metric.column];
  const bins = binsFor(metric, domain, theme);
  if (!bins) return null;

  const { breaks, colors } = bins;

  return (
    <div className="legend">
      <div className="legend__t">
        {metric.label} · {metric.unit}
      </div>

      <div
        className="legend__bins"
        role="img"
        aria-label={`${metric.label} colour scale`}
      >
        {colors.map((c, i) => (
          <span
            key={i}
            className="legend__bin"
            style={{ background: c }}
            title={binTitle(metric, breaks, i)}
          />
        ))}
      </div>

      {/* Ticks sit on the gaps between blocks, not at block centres.
          With many breaks only every other one is labelled, or nine labels
          in 262px blur together. Diverging metrics must always have 0
          labelled: it is the reference point of the whole map. */}
      <div className="legend__scale num">
        {breaks.map((b, i) => {
          const every = breaks.length > 6 ? 2 : 1;
          const anchor = metric.kind === "diverging" ? (breaks.length - 1) / 2 : 0;
          if (Math.abs(i - anchor) % every !== 0) return null;
          return (
            <span
              key={i}
              className="legend__tick"
              style={{ left: `${((i + 1) / colors.length) * 100}%` }}
            >
              {metric.tick(b)}
            </span>
          );
        })}
      </div>

      <div className="legend__gray">
        <span className="legend__swatch" aria-hidden />
        <span>No data published for this area</span>
      </div>
    </div>
  );
}

function binTitle(metric: Metric, breaks: number[], i: number): string {
  if (i === 0) return `under ${metric.format(breaks[0])}`;
  if (i === breaks.length) return `${metric.format(breaks[i - 1])} and above`;
  return `${metric.format(breaks[i - 1])} to ${metric.format(breaks[i])}`;
}
