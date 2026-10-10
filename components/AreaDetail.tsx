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
import { getConnection } from "@/lib/db";
import {
  areaSeries,
  nationalSeries,
  postnrIn,
  type GeoLevel,
} from "@/lib/queries";
import {
  CATEGORIES,
  fmtDays,
  fmtInt,
  fmtKrM2,
  fmtPct,
  fmtQ,
  fmtYears,
  quarterLabel,
  trendClass,
  RELIABILITY_NOTE,
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
        for (const c of CATEGORIES) {
          const s = await areaSeries(code, c.id, geo);
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
  }, [code, geo]);

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

      {!insufficient && summary}

      {insufficient ? (
        // PRD §9: areas with insufficient data get a page too, and it says why
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
            {latest?.years_income != null && (
              <Stat
                k="Years of income"
                v={fmtOrDash(latest.years_income, fmtYears)}
                sub={`for 100 m², family income ${latest.income_year ?? ""}`}
              />
            )}
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

              {affordRows.length > 8 && (
                <section className="detail__block">
                  <h2 className="detail__h2">
                    Years of income to buy 100 m²
                  </h2>
                  <Chart
                    height={180}
                    deps={[affordRows, affordNatRows, theme]}
                    caption={
                      "Local price per m² × 100, divided by average disposable " +
                      "family income in the same area and year. " +
                      `${name} in colour, all of Denmark dashed. ` +
                      "Both halves are same-year kroner, so inflation cancels " +
                      "and the nominal/real switch does not apply here."
                    }
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
              <h2 className="detail__h2">Inside {name}</h2>
              {drill === null ? (
                <span className="loading">
                  <span className="loading__dot" />
                  Loading postal districts…
                </span>
              ) : drill.length === 0 ? (
                <p className="detail__note">
                  None of the {postnrs.length} postal districts here had enough{" "}
                  {category === "house"
                    ? "house"
                    : category === "flat"
                      ? "flat"
                      : "holiday-home"}{" "}
                  sales in the four quarters to {quarterLabel(latestQuarter)} to
                  report a price. The kommune total above is still published —
                  it pools all of them.
                </p>
              ) : (
                <div className="drill">
                  <table className="drill__t">
                    <thead>
                      <tr>
                        <th scope="col">Postal district</th>
                        <th scope="col">Price</th>
                        <th scope="col">Year on year</th>
                        <th scope="col">Days</th>
                        <th scope="col">Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drill.map((r) => (
                        <tr key={r.area_code} data-low={r.reliability === "low"}>
                          <th scope="row">
                            <Link href={`/area/postnr/${r.area_code}`}>
                              <span className="num">{r.area_code}</span>
                            </Link>
                          </th>
                          <td className="num">
                            {fmtOrDash(r.price_4q, fmtKrM2)}
                          </td>
                          <td className={`num ${trendClass(r.yoy_pct)}`}>
                            {fmtOrDash(r.yoy_pct, fmtPct)}
                          </td>
                          <td className="num">{fmtOrDash(r.dom_4q, fmtDays)}</td>
                          <td className="num">
                            {fmtOrDash(r.n_sold_4q, fmtInt)}
                            {r.reliability === "low" ? " ·" : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="detail__note">
                    Rows marked · have 10-39 sales in the trailing four
                    quarters: shown, but kept off the rankings. Districts with
                    fewer than 10 are left out entirely.
                    {drill.length < postnrs.length && (
                      <>
                        {" "}
                        {postnrs.length - drill.length} of {postnrs.length}{" "}
                        districts here are below that bar this quarter.
                      </>
                    )}{" "}
                    These are each district&apos;s own published figures, not
                    the kommune total split up — and about 23% of Danish postal
                    districts straddle a kommune boundary, so they will not add
                    back up to it.
                  </p>
                </div>
              )}
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

/** "2012Q3" -> 2012.5; Plot's x axis needs continuous numbers */
function qNum(q: string): number {
  return Number(q.slice(0, 4)) + (Number(q.slice(5)) - 1) / 4;
}
