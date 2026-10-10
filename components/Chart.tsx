"use client";

/**
 * A React shell around Observable Plot.
 *
 * Plot is a "produce a DOM node" API, not a React component, so the job here
 * is: create it in an effect, put it in the container, and remove the
 * previous one before the next render. Otherwise every re-render would
 * stack another svg into the container.
 *
 * All colours are read from CSS variables, so the charts follow light/dark
 * theme switches without the palette being written out again in JS.
 */

import { useEffect, useRef } from "react";
import * as Plot from "@observablehq/plot";

export function cssVar(name: string, fallback = "#888"): string {
  if (typeof window === "undefined") return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}

export default function Chart({
  options,
  height = 180,
  caption,
  deps = [],
}: {
  /** Returns the config for Plot.plot. A function rather than an object so
   *  that it runs inside the effect, the only point where the CSS variables
   *  can be read. */
  options: () => Plot.PlotOptions;
  height?: number;
  caption?: string;
  deps?: unknown[];
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let node: (SVGSVGElement | HTMLElement) | null = null;
    try {
      node = Plot.plot(options());
      el.append(node);
    } catch (e) {
      console.error("[plot]", e);
    }
    return () => {
      node?.remove();
    };
    // options is a new function on every render and cannot go in the
    // dependency array; deps controls it explicitly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return (
    <figure className="chart" style={{ minHeight: height }}>
      <div ref={host} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/** Axis and grid styles shared by every chart, so each one need not repeat them */
export function plotBase(width: number, height: number): Plot.PlotOptions {
  return {
    width,
    height,
    marginLeft: 52,
    marginRight: 14,
    marginTop: 10,
    marginBottom: 26,
    style: {
      background: "transparent",
      color: cssVar("--ink-3", "#888"),
      fontFamily: "var(--font-sans), system-ui, sans-serif",
      fontSize: "11px",
    },
    x: { label: null, tickFormat: (d: number) => String(d), grid: false },
    y: { label: null, grid: true, ticks: 4 },
  };
}
