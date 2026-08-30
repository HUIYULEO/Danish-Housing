"use client";

/**
 * Observable Plot 的 React 外壳。
 *
 * Plot 是"生成一个 DOM 节点"的 API，不是 React 组件，所以这里的活就是：
 * 在 effect 里生成、塞进容器、下次渲染前把上一个删掉。
 * 不这么做的话每次重渲都会往容器里堆一个新的 svg。
 *
 * 颜色全部从 CSS 变量读，这样亮暗主题切换时图表跟着走，
 * 不需要把整套调色板再在 JS 里写一遍。
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
  /** 返回 Plot.plot 的配置。用函数而不是对象，是为了让它在
   *  effect 里执行 —— 那时候才读得到 CSS 变量。 */
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
    // options 每次渲染都是新函数，不能进依赖数组，靠 deps 显式控制
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return (
    <figure className="chart" style={{ minHeight: height }}>
      <div ref={host} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/** 所有图表共用的坐标轴和网格样式，省得每张图都写一遍 */
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
