"use client";

/**
 * 区域详情页。PRD §9。
 *
 * 数据全部在客户端向 DuckDB 要 —— 页面本身是静态导出的空壳，
 * 只带名字和层级。这样 114 个区域页不需要 114 份预生成的 JSON，
 * 用的还是首页那份已经加载好的 Parquet。
 *
 * PRD §9 明确要求的一条在最下面：**数据不足的区域也要有页面**，
 * 页面上诚实写清楚为什么没有数据，而不是 404 或者一堆空图表。
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as Plot from "@observablehq/plot";
import Chart, { cssVar, plotBase } from "./Chart";
import ThemeToggle, { useTheme } from "./ThemeToggle";
import { RealToggle, CategoryPicker } from "./Controls";
import { getConnection } from "@/lib/db";
import { areaSeries, nationalSeries } from "@/lib/queries";
import {
  CATEGORIES,
  fmtDays,
  fmtInt,
  fmtKrM2,
  fmtPct,
  fmtQ,
  quarterLabel,
  trendClass,
  RELIABILITY_NOTE,
  type Category,
  type Domains,
  type PanelRow,
  type Reliability,
} from "@/lib/metrics";

type Point = PanelRow & { quarter: string };

/** 图表只画 2004 年以后 —— 成交量和挂牌天数从那年才有，
 *  再往前拉整条线会有一半是空的。价格的完整历史在首页时间轴上看。 */
const FROM = "2004Q1";

export default function AreaDetail({
  code,
  name,
  level,
  latestQuarter,
  postnrs,
}: {
  code: string;
  name: string;
  level: string;
  latestQuarter: string;
  domains: Domains;
  postnrs: string[];
}) {
  const [theme, themeChoice, setThemeChoice] = useTheme();
  const [category, setCategory] = useState<Category>("house");
  const [real, setReal] = useState(false);
  const [series, setSeries] = useState<Point[] | null>(null);
  const [national, setNational] = useState<Point[] | null>(null);
  const [available, setAvailable] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 先把三个房产类型都拉一遍，看哪些真的有数据。
  // PRD §9：没有数据的类型直接不显示，不显示空图表。
  useEffect(() => {
    let alive = true;
    getConnection()
      .then(async () => {
        const found: Category[] = [];
        for (const c of CATEGORIES) {
          const s = await areaSeries(code, c.id);
          if (s.some((r) => r.price_4q != null)) found.push(c.id);
        }
        if (!alive) return;
        setAvailable(found);
        if (found.length && !found.includes("house")) setCategory(found[0]);
      })
      .catch((e) => alive && setError(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, [code]);

  useEffect(() => {
    if (!available) return;
    let alive = true;
    setSeries(null);
    Promise.all([areaSeries(code, category), nationalSeries(category)])
      .then(([a, n]) => {
        if (!alive) return;
        setSeries(a.filter((r) => r.quarter >= FROM));
        setNational(n.filter((r) => r.quarter >= FROM));
      })
      .catch((e) => alive && setError(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, [code, category, available]);

  const latest = useMemo(
    () => series?.find((r) => r.quarter === latestQuarter) ?? null,
    [series, latestQuarter],
  );

  const priceCol = real ? "price_4q_real" : "price_4q";
  const yoyCol = real ? "yoy_real_pct" : "yoy_pct";
  const val = (r: Point, c: string) => (r as never as Record<string, number | null>)[c];

  const priceRows = useMemo(
    () =>
      (series ?? [])
        .filter((r) => val(r, priceCol) != null)
        .map((r) => ({ q: qNum(r.quarter), v: val(r, priceCol) as number })),
    [series, priceCol],
  );
  const natRows = useMemo(
    () =>
      (national ?? [])
        .filter((r) => val(r, priceCol) != null)
        .map((r) => ({ q: qNum(r.quarter), v: val(r, priceCol) as number })),
    [national, priceCol],
  );

  const loading = !available || !series;
  const insufficient =
    available !== null && available.length === 0;

  return (
    <main className="detail">
      <div className="detail__head">
        <div>
          <h1 className="detail__title">{name}</h1>
          <p className="detail__sub">
            {level === "kommune"
              ? "Kommune"
              : level === "region"
                ? "Region"
                : "Landsdel"}{" "}
            · {quarterLabel(latestQuarter)}
            {latest && RELIABILITY_NOTE[latest.reliability as Reliability] && (
              <span className="detail__flag">
                {RELIABILITY_NOTE[latest.reliability as Reliability]}
              </span>
            )}
          </p>
        </div>
        <ThemeToggle choice={themeChoice} onChange={setThemeChoice} />
      </div>

      {error && (
        <p className="empty">
          Could not load the history for this area — {error}
        </p>
      )}

      {insufficient ? (
        // PRD §9：数据不足的区域也要有页面，并且写清楚为什么
        <section className="detail__block">
          <p className="detail__prose">
            Finans Danmark publishes no price series for {name}. That is not a
            gap in this site — it means too few homes change hands here for a
            square-metre price to be meaningful, so the figure is withheld at
            source rather than published as a number nobody should trust.
          </p>
          <p className="detail__prose">
            <Link href="/">Back to the map</Link>, where {name} is drawn in
            neutral grey for exactly this reason.
          </p>
        </section>
      ) : (
        <>
          <div className="detail__controls">
            <CategoryPicker
              value={category}
              onChange={setCategory}
              only={available ?? undefined}
            />
            <RealToggle value={real} onChange={setReal} />
          </div>

          <section className="statgrid">
            <Stat
              k={real ? "Price, today's kroner" : "Price"}
              v={latest ? fmtOrDash(val(latest, priceCol), fmtKrM2) : "—"}
              sub="per m², 4-quarter average"
            />
            <Stat
              k={real ? "Year on year, real" : "Year on year"}
              v={latest ? fmtOrDash(val(latest, yoyCol), fmtPct) : "—"}
              cls={latest ? trendClass(val(latest, yoyCol)) : ""}
            />
            <Stat
              k="Days on market"
              v={latest ? fmtOrDash(latest.dom_4q, fmtDays) : "—"}
              sub="median, listing to sale"
            />
            <Stat
              k="Sales"
              v={latest ? fmtOrDash(latest.n_sold_4q, fmtInt) : "—"}
              sub="trailing four quarters"
            />
            <Stat
              k="Quarters of supply"
              v={latest ? fmtOrDash(latest.quarters_of_supply, fmtQ) : "—"}
              sub="stock ÷ sales"
            />
            <Stat
              k="Asking vs realised"
              v={latest ? fmtOrDash(latest.discount_pct, fmtPct) : "—"}
              sub="negative = sold under asking"
            />
          </section>

          {loading ? (
            <div className="detail__block">
              <span className="loading">
                <span className="loading__dot" />
                Loading history…
              </span>
            </div>
          ) : (
            <>
              <section className="detail__block">
                <h2 className="detail__h2">
                  Price against the national average
                </h2>
                <Chart
                  height={210}
                  deps={[priceRows, natRows, theme, real]}
                  caption={`${name} in colour, all of Denmark dashed in grey. ${
                    real ? "Deflated to today's kroner." : "Nominal kroner."
                  }`}
                  options={() => ({
                    ...plotBase(760, 210),
                    y: { label: null, grid: true, ticks: 4 },
                    marks: [
                      Plot.ruleY([0], { stroke: cssVar("--line") }),
                      Plot.line(natRows, {
                        x: "q",
                        y: "v",
                        stroke: cssVar("--ink-3"),
                        strokeWidth: 1.2,
                        strokeDasharray: "3,3",
                      }),
                      Plot.line(priceRows, {
                        x: "q",
                        y: "v",
                        stroke: cssVar("--accent"),
                        strokeWidth: 2,
                      }),
                    ],
                  })}
                />
              </section>

              <section className="detail__block detail__block--two">
                <div>
                  <h2 className="detail__h2">Homes sold each quarter</h2>
                  <Chart
                    height={170}
                    deps={[series, theme]}
                    options={() => ({
                      ...plotBase(370, 170),
                      marks: [
                        Plot.rectY(
                          (series ?? []).filter((r) => r.n_sold != null),
                          {
                            x: (r: Point) => qNum(r.quarter),
                            y: "n_sold",
                            interval: 0.25,
                            fill: cssVar("--accent"),
                            fillOpacity: 0.7,
                          },
                        ),
                        Plot.ruleY([0], { stroke: cssVar("--line") }),
                      ],
                    })}
                  />
                </div>
                <div>
                  <h2 className="detail__h2">Days on market</h2>
                  <Chart
                    height={170}
                    deps={[series, theme]}
                    options={() => ({
                      ...plotBase(370, 170),
                      marks: [
                        Plot.line(
                          (series ?? []).filter((r) => r.dom_4q != null),
                          {
                            x: (r: Point) => qNum(r.quarter),
                            y: "dom_4q",
                            stroke: cssVar("--neg"),
                            strokeWidth: 1.8,
                          },
                        ),
                        Plot.ruleY([0], { stroke: cssVar("--line") }),
                      ],
                    })}
                  />
                </div>
              </section>
            </>
          )}

          {postnrs.length > 0 && (
            <section className="detail__block">
              <h2 className="detail__h2">Postal codes in {name}</h2>
              <p className="detail__codes num">{postnrs.join(" · ")}</p>
              <p className="detail__note">
                Postal-code level figures exist in the source data but are not
                published on this site yet. Note that about 23% of Danish postal
                codes straddle a kommune boundary, so this is a display
                grouping, not a way to add numbers up.
              </p>
            </section>
          )}
        </>
      )}

      <p className="detail__back">
        <Link href="/">← Back to the map</Link>
      </p>
    </main>
  );
}

function Stat({
  k,
  v,
  sub,
  cls,
}: {
  k: string;
  v: string;
  sub?: string;
  cls?: string;
}) {
  return (
    <div className="statgrid__cell">
      <div className="statgrid__k">{k}</div>
      <div className={`statgrid__v num ${cls ?? ""}`}>{v}</div>
      {sub && <div className="statgrid__sub">{sub}</div>}
    </div>
  );
}

const fmtOrDash = (
  v: number | null | undefined,
  f: (n: number) => string,
) => (v != null && Number.isFinite(v) ? f(v) : "—");

/** "2012Q3" -> 2012.5，Plot 的 x 轴要连续数值 */
function qNum(q: string): number {
  return Number(q.slice(0, 4)) + (Number(q.slice(5)) - 1) / 4;
}
