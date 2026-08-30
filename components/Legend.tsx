"use client";

import {
  legendGradient,
  unitToValue,
  type Domains,
  type Metric,
  type Theme,
} from "@/lib/metrics";

/**
 * 图例。两件事必须说清楚：
 *   1. 色阶两端是什么值（而且是 clamp 过的，所以写 ≤ / ≥）
 *   2. 灰色是什么意思 —— 它和色阶是并列关系，不是色阶的一端
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
  const d = domains[category]?.[metric.column];
  if (!d) return null;
  const [lo, hi] = d;
  // 中点刻度要按色阶实际的变换算 —— log 色阶的中点是几何中位数，
  // 写成算术平均的话刻度会和颜色对不上。
  const mid = unitToValue(metric, 0.5, lo, hi);

  return (
    <div className="legend">
      <div className="legend__t">
        {metric.label} · {metric.unit}
      </div>
      <div
        className="legend__bar"
        style={{ background: legendGradient(metric, theme) }}
        aria-hidden
      />
      <div className="legend__ticks num">
        <span>≤ {metric.tick(lo)}</span>
        <span>{metric.tick(mid)}</span>
        <span>≥ {metric.tick(hi)}</span>
      </div>
      <div className="legend__gray">
        <span className="legend__swatch" aria-hidden />
        <span>No data published for this area</span>
      </div>
    </div>
  );
}
