"use client";

import { binsFor, type Domains, type Metric, type Theme } from "@/lib/metrics";

/**
 * 图例。离散色块，每块之间标出分界值。
 *
 * 为什么不用渐变条：渐变条只能告诉你"越深越大"，没法把地图上的某一块颜色
 * 还原成一个数。分档之后可以 —— 看到一块颜色，在图例上找到同色的块，
 * 直接读出它对应的区间。参考纽约联储的房价地图（PRD §12 列的方向）。
 *
 * 两件必须交代清楚的事：
 *   1. 两端是开区间，所以最外面两档没有外侧刻度 —— 超出值域的单元
 *      归进最外档，不是被丢掉。
 *   2. 灰色和色阶是并列关系，不是色阶的一端。
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

      {/* 刻度落在色块之间的缝上，不是色块中心。
          分界多的时候隔一个标一个，否则 262px 里塞九个标签会糊成一片；
          发散型必须保证 0 被标出来，那是整张图的参照点。 */}
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
