"use client";

/**
 * Area detail page. PRD §9.
 *
 * All data is requested from DuckDB on the client. The page itself is a
 * statically exported shell carrying only the name and level. That way 114
 * area pages do not need 114 pre-generated JSON files; they use the same
 * Parquet the home page has already loaded.
 *
 * One explicit requirement of PRD §9 is at the very bottom: **areas with
 * insufficient data must have a page too**, one that says honestly why there
 * is no data, rather than a 404 or a pile of empty charts.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as Plot from "@observablehq/plot";
import Chart, { cssVar, plotBase } from "./Chart";
import ThemeToggle, { useTheme } from "./ThemeToggle";
import { RealToggle, CategoryPicker } from "./Controls";
import { useLocale } from "./LocaleProvider";
import { getConnection } from "@/lib/db";
import {
  areaSeries,
  nationalSeries,
  postnrIn,
  type GeoLevel,
} from "@/lib/queries";
import {
  CATEGORIES,
  trendClass,
  type Category,
  type Domains,
  type PanelRow,
  type Reliability,
} from "@/lib/metrics";

type Point = PanelRow & { quarter: string };

/** Charts only go back to 2004: volumes and days on market start that year,
 *  and going further back would leave half of every line empty. The full
 *  price history is on the home page timeline. */
const FROM = "2004Q1";

export default function AreaDetail({
  code,
  name,
  level,
  latestQuarter,
  postnrs,
  summary,
}: {
  code: string;
  name: string;
  level: string;
  latestQuarter: string;
  domains: Domains;
  /** Server-rendered headline numbers in words; in the HTML before DuckDB loads. */
  summary?: React.ReactNode;
  postnrs: string[];
}) {
  // The postal page and the kommune page share this component, but the
  // numbers sit in two different panels
  const geo: GeoLevel = level === "postnr" ? "postnr" : "kommune";
  const [theme, themeChoice, setThemeChoice] = useTheme();
  const { t, fmt, href } = useLocale();
  const [category, setCategory] = useState<Category>("house");
  const [real, setReal] = useState(false);
  const [series, setSeries] = useState<Point[] | null>(null);
  const [national, setNational] = useState<Point[] | null>(null);
  const [available, setAvailable] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // First fetch all three property types to see which really have data.
  // PRD §9: types without data are simply not shown; no empty charts.
  useEffect(() => {
    let alive = true;
    getConnection()
      .then(async () => {
        const found: Category[] = [];
        // Types with a publishable price in the latest quarter, as opposed
        // to only somewhere in their history
        const current: Category[] = [];
        for (const c of CATEGORIES) {
          const s = await areaSeries(code, c.id, geo);
          if (s.some((r) => r.price_4q != null)) found.push(c.id);
          const now = s.find((r) => r.quarter === latestQuarter);
          if (now?.price_4q != null && now.reliability !== "insufficient") {
            current.push(c.id);
          }
        }
        if (!alive) return;
        setAvailable(found);
        // Open on a type that has numbers today. Urban postal districts sell
        // flats, not houses: defaulting to houses there opens the page on a
        // row of dashes while the flat data sits one click away.
        const open = current.length ? current : found;
        if (open.length && !open.includes("house")) setCategory(open[0]);
      })
      .catch((e) => alive && setError(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, [code, geo, latestQuarter]);

  useEffect(() => {
    if (!available) return;
    let alive = true;
    setSeries(null);
    Promise.all([areaSeries(code, category, geo), nationalSeries(category)])
      .then(([a, n]) => {
        if (!alive) return;
        setSeries(a.filter((r) => r.quarter >= FROM));
        setNational(n.filter((r) => r.quarter >= FROM));
      })
      .catch((e) => alive && setError(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, [code, category, available, geo]);

  const latest = useMemo(
    () => series?.find((r) => r.quarter === latestQuarter) ?? null,
    [series, latestQuarter],
  );

  /* -------- Postal drill-down -------- *
   *
   * The numbers are the postnummer panel's own rows (BM011/BM021/BM031), not
   * the kommune's numbers spread downwards. The crosswalk only answers
   * "which postal codes fall in this kommune", and 23% of postal codes
   * straddle a boundary, so it is membership, not a weight. That is what the
   * note under the table says. */
  const [drill, setDrill] = useState<PanelRow[] | null>(null);
  useEffect(() => {
    if (!available || !postnrs.length) return;
    let alive = true;
    setDrill(null);
    postnrIn(postnrs, latestQuarter, category)
      .then((r) => alive && setDrill(r))
      .catch((e) => console.error("[drill]", e));
    return () => {
      alive = false;
    };
  }, [postnrs, latestQuarter, category, available]);

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
  const affordRows = useMemo(
    () =>
      (series ?? [])
        .filter((r) => r.years_income != null)
        .map((r) => ({ q: qNum(r.quarter), v: r.years_income as number })),
    [series],
  );
  const affordNatRows = useMemo(
    () =>
      (national ?? [])
        .filter((r) => r.years_income != null)
        .map((r) => ({ q: qNum(r.quarter), v: r.years_income as number })),
    [national],
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
            {t.levels[level as keyof typeof t.levels]?.one ?? level} ·{" "}
            {fmt.quarter(latestQuarter)}
            {latest && latest.reliability !== "ok" && (
              <span className="detail__flag">
                {t.reliability[latest.reliability as Exclude<Reliability, "ok">]}
              </span>
            )}
          </p>
        </div>
        <ThemeToggle choice={themeChoice} onChange={setThemeChoice} />
      </div>

      {error && (
        <p className="empty">
          {t.detail.loadError} — {error}
        </p>
      )}

      {!insufficient && summary}

      {insufficient ? (
        // PRD §9: areas with insufficient data get a page too, and it says why
        <section className="detail__block">
          <p className="detail__prose">{t.detail.noSeries(name)}</p>
          <p className="detail__prose">
            <Link href={href("/")}>{t.detail.backToMap}</Link>
            {t.detail.greyReason(name)}
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
              k={real ? t.card.priceReal : t.card.price}
              v={latest ? fmtOrDash(val(latest, priceCol), fmt.krM2) : "—"}
              sub={t.detail.subPrice}
            />
            <Stat
              k={real ? t.card.yoyReal : t.card.yoy}
              v={latest ? fmtOrDash(val(latest, yoyCol), fmt.pct) : "—"}
              cls={latest ? trendClass(val(latest, yoyCol)) : ""}
            />
            <Stat
              k={t.card.dom}
              v={latest ? fmtOrDash(latest.dom_4q, fmt.days) : "—"}
              sub={t.detail.subDom}
            />
            <Stat
              k={t.detail.sales}
              v={latest ? fmtOrDash(latest.n_sold_4q, fmt.int) : "—"}
              sub={t.detail.subSales}
            />
            <Stat
              k={t.card.supply}
              v={latest ? fmtOrDash(latest.quarters_of_supply, fmt.q) : "—"}
              sub={t.detail.subSupply}
            />
            <Stat
              k={t.card.gap}
              v={latest ? fmtOrDash(latest.discount_pct, fmt.pct) : "—"}
              sub={t.detail.subGap}
            />
            {latest?.years_income != null && (
              <Stat
                k={t.card.yearsIncome}
                v={fmtOrDash(latest.years_income, fmt.years)}
                sub={t.detail.subIncome(latest.income_year ?? "")}
              />
            )}
          </section>

          {loading ? (
            <div className="detail__block">
              <span className="loading">
                <span className="loading__dot" />
                {t.card.loading}
              </span>
            </div>
          ) : (
            <>
              <section className="detail__block">
                <h2 className="detail__h2">{t.detail.chartPrice}</h2>
                <Chart
                  height={210}
                  deps={[priceRows, natRows, theme, real]}
                  caption={t.detail.captionPrice(name, real)}
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

              {affordRows.length > 8 && (
                <section className="detail__block">
                  <h2 className="detail__h2">{t.detail.chartAfford}</h2>
                  <Chart
                    height={180}
                    deps={[affordRows, affordNatRows, theme]}
                    caption={t.detail.captionAfford(name)}
                    options={() => ({
                      ...plotBase(760, 180),
                      y: { label: null, grid: true, ticks: 4 },
                      marks: [
                        Plot.ruleY([0], { stroke: cssVar("--line") }),
                        Plot.line(affordNatRows, {
                          x: "q",
                          y: "v",
                          stroke: cssVar("--ink-3"),
                          strokeWidth: 1.2,
                          strokeDasharray: "3,3",
                        }),
                        Plot.line(affordRows, {
                          x: "q",
                          y: "v",
                          stroke: cssVar("--neg"),
                          strokeWidth: 2,
                        }),
                      ],
                    })}
                  />
                </section>
              )}

              <section className="detail__block detail__block--two">
                <div>
                  <h2 className="detail__h2">{t.detail.chartSold}</h2>
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
                  <h2 className="detail__h2">{t.detail.chartDom}</h2>
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
              <h2 className="detail__h2">{t.detail.inside(name)}</h2>
              {drill === null ? (
                <span className="loading">
                  <span className="loading__dot" />
                  {t.detail.loadingPostnr}
                </span>
              ) : drill.length === 0 ? (
                <p className="detail__note">
                  {t.detail.drillNone(
                    postnrs.length,
                    t.categories[category].one,
                    fmt.quarter(latestQuarter),
                  )}
                </p>
              ) : (
                <div className="drill">
                  <table className="drill__t">
                    <thead>
                      <tr>
                        <th scope="col">{t.detail.colPostnr}</th>
                        <th scope="col">{t.detail.colPrice}</th>
                        <th scope="col">{t.detail.colYoy}</th>
                        <th scope="col">{t.detail.colDays}</th>
                        <th scope="col">{t.detail.colSales}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drill.map((r) => (
                        <tr key={r.area_code} data-low={r.reliability === "low"}>
                          <th scope="row">
                            <Link href={href(`/area/postnr/${r.area_code}`)}>
                              <span className="num">{r.area_code}</span>
                            </Link>
                          </th>
                          <td className="num">
                            {fmtOrDash(r.price_4q, fmt.krM2)}
                          </td>
                          <td className={`num ${trendClass(r.yoy_pct)}`}>
                            {fmtOrDash(r.yoy_pct, fmt.pct)}
                          </td>
                          <td className="num">{fmtOrDash(r.dom_4q, fmt.days)}</td>
                          <td className="num">
                            {fmtOrDash(r.n_sold_4q, fmt.int)}
                            {r.reliability === "low" ? " ·" : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="detail__note">
                    {t.detail.drillNote}
                    {drill.length < postnrs.length &&
                      t.detail.drillBelow(
                        postnrs.length - drill.length,
                        postnrs.length,
                      )}
                    {t.detail.drillOwn}
                  </p>
                </div>
              )}
            </section>
          )}
        </>
      )}

      <p className="detail__back">
        <Link href={href("/")}>← {t.detail.backToMap}</Link>
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

/** "2012Q3" -> 2012.5; Plot's x axis needs continuous numbers */
function qNum(q: string): number {
  return Number(q.slice(0, 4)) + (Number(q.slice(5)) - 1) / 4;
}
