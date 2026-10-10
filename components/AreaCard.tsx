"use client";

/**
 * The card laid over the top-left of the map once a kommune is picked.
 *
 * One requirement of PRD §9 lives here: areas with insufficient data **must
 * have content too**, saying honestly why there is no data (too few sales)
 * instead of showing a pile of empty charts.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { areaSeries, type GeoLevel } from "@/lib/queries";
import { Eyebrow } from "./Controls";
import {
  fmtDays,
  fmtInt,
  fmtKrM2,
  fmtPct,
  fmtQ,
  fmtYears,
  quarterLabel,
  trendClass,
  type Category,
  type PanelRow,
} from "@/lib/metrics";

type Point = PanelRow & { quarter: string };

export default function AreaCard({
  row,
  name,
  category,
  quarter,
  real,
  monthlyMode,
  postnrs,
  level,
  dbReady,
  onClose,
}: {
  row: PanelRow;
  name: string;
  category: Category;
  quarter: string;
  real: boolean;
  monthlyMode: boolean;
  postnrs: string[];
  level: GeoLevel;
  dbReady: boolean;
  onClose: () => void;
}) {
  const [series, setSeries] = useState<Point[] | null>(null);

  useEffect(() => {
    if (!dbReady || monthlyMode) return;
    let alive = true;
    setSeries(null);
    areaSeries(row.area_code, category, level)
      .then((s) => alive && setSeries(s))
      .catch((e) => console.error("[series]", e));
    return () => {
      alive = false;
    };
  }, [row.area_code, category, level, dbReady, monthlyMode]);

  const insufficient = row.reliability === "insufficient";
  const price = real ? (row.price_4q_real ?? null) : row.price_4q;
  const yoy = real ? (row.yoy_real_pct ?? null) : row.yoy_pct;

  return (
    <div className="card" style={{ minWidth: 272 }}>
      {/* The time basis has to travel with the card. Without this line, once
          a kommune is opened nothing on screen says "which quarter these
          numbers are from". */}
      <Eyebrow quarter={quarter} category={category} real={real} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div className="card__t" style={{ flex: 1 }}>
          {name}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ color: "var(--ink-3)", fontSize: 18, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {insufficient ? (
        <div className="card__s">
          {monthlyMode ? (
            <>
              Nothing published for {label(category)} here this month — no
              listings on the market, or too few to report.
            </>
          ) : (
            <>
          Fewer than 10 {label(category)} sold here in the four quarters to{" "}
          {quarterLabel(quarter)}
          {row.n_sold_4q != null ? ` (${fmtInt(row.n_sold_4q)})` : ""}. With a
          sample that thin, a price per square metre would say more about which
          handful of homes happened to change hands than about the market. We
          would rather show nothing.
            </>
          )}
        </div>
      ) : (
        <>
          <div style={{ marginTop: 8, display: "grid", gap: 3 }}>
            {monthlyMode ? (
              <>
                {/* In monthly mode the quarterly columns are all empty and
                    showing them only gives a row of dashes. Show the three
                    measures this month actually has. */}
                <Stat
                  k="Homes for sale"
                  v={row.for_sale != null ? fmtInt(row.for_sale) : "—"}
                />
                <Stat
                  k="Asking price"
                  v={
                    row.asking_price_m2 != null
                      ? fmtKrM2(row.asking_price_m2)
                      : "—"
                  }
                />
                <Stat
                  k="Listed so far"
                  v={row.days_listed != null ? fmtDays(row.days_listed) : "—"}
                />
                <Stat
                  k="Stock vs a year ago"
                  v={row.for_sale_yoy != null ? fmtPct(row.for_sale_yoy) : "—"}
                  cls={trendClass(row.for_sale_yoy, true)}
                />
              </>
            ) : (
              <>
            {/* The nominal/real switch has to govern this card too, or the
                map and the card show two prices */}
            <Stat
              k={real ? "Price, today's kroner" : "Price"}
              v={price != null ? fmtKrM2(price) : "—"}
            />
            <Stat
              k={real ? "Year on year, real" : "Year on year"}
              v={yoy != null ? fmtPct(yoy) : "—"}
              cls={trendClass(yoy)}
            />
            <Stat
              k="Days on market"
              v={row.dom_4q != null ? fmtDays(row.dom_4q) : "—"}
            />
            <Stat
              k="Quarters of supply"
              v={
                row.quarters_of_supply != null
                  ? fmtQ(row.quarters_of_supply)
                  : "—"
              }
            />
            <Stat
              k="Sales, 4 quarters"
              v={row.n_sold_4q != null ? fmtInt(row.n_sold_4q) : "—"}
            />
            <Stat
              k="Asking vs realised"
              v={row.discount_pct != null ? fmtPct(row.discount_pct) : "—"}
            />
            {/* Income is annual and two years behind prices, so the year goes
                right on the label rather than in a tooltip. The postal level
                has no such column and the whole row is absent. */}
            {row.years_income != null && (
              <Stat
                k={`Years of income${
                  row.income_year != null ? ` · ${row.income_year}` : ""
                }`}
                v={fmtYears(row.years_income)}
              />
            )}
              </>
            )}
          </div>

          {postnrs.length > 0 && (
            <div className="tip__r" style={{ alignItems: "flex-start" }}>
              <span>Postal districts</span>
              <b
                className="num"
                style={{ textAlign: "right", fontWeight: 500, maxWidth: 168 }}
              >
                {postnrs.slice(0, 6).join(" · ")}
                {postnrs.length > 6 ? ` +${postnrs.length - 6}` : ""}
              </b>
            </div>
          )}

          {row.reliability === "low" && (
            <div className="tip__flag">
              Low sample · {fmtInt(row.n_sold_4q ?? 0)} sales — shown, but kept
              off the rankings
            </div>
          )}

          <Spark series={series} dbReady={dbReady} real={real} />
        </>
      )}

      <Link
        className="card__more"
        href={
          level === "postnr"
            ? `/area/postnr/${row.area_code}`
            : `/area/${row.area_code}`
        }
      >
        Full history for {name} →
      </Link>
    </div>
  );
}

function Stat({ k, v, cls }: { k: string; v: string; cls?: string }) {
  return (
    <div className="tip__r">
      <span>{k}</span>
      <b className={`num ${cls ?? ""}`}>{v}</b>
    </div>
  );
}

const label = (c: Category) =>
  c === "house" ? "houses" : c === "flat" ? "flats" : "holiday homes";

/**
 * Price trend sparkline. Draws only the rolling 4-quarter mean price, the
 * same column the map uses, so the line on the card and the colour on the
 * map do not tell two stories.
 */
function Spark({
  series,
  dbReady,
  real,
}: {
  series: Point[] | null;
  dbReady: boolean;
  real: boolean;
}) {
  if (!dbReady) {
    return (
      <div style={{ marginTop: 10 }}>
        <span className="loading">
          <span className="loading__dot" />
          Loading history…
        </span>
      </div>
    );
  }
  if (!series) {
    return <div className="skeleton" style={{ marginTop: 12, height: 38 }} />;
  }

  // Reads the same column as the map, so the card's line and the map's
  // colour do not tell two stories
  const val = (p: Point) => (real ? (p.price_4q_real ?? null) : p.price_4q);
  const pts = series.filter((p) => {
    const v = val(p);
    return v != null && Number.isFinite(v);
  });
  if (pts.length < 8) return null;

  const W = 236;
  const H = 40;
  const xs = pts.map((_, i) => (i / (pts.length - 1)) * W);
  const vals = pts.map((p) => val(p) as number);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const y = (v: number) => H - ((v - lo) / (hi - lo || 1)) * (H - 4) - 2;
  const d = pts.map((p, i) => `${i ? "L" : "M"}${xs[i]},${y(vals[i])}`).join(" ");

  return (
    <div style={{ marginTop: 11 }}>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ display: "block", height: H }}
        aria-label={`Price from ${pts[0].quarter} to ${pts[pts.length - 1].quarter}`}
      >
        <path
          d={`${d} L${W},${H} L0,${H} Z`}
          fill="rgba(29,95,168,0.10)"
          stroke="none"
        />
        <path d={d} fill="none" stroke="#1d5fa8" strokeWidth="1.4" />
      </svg>
      <div
        className="tip__r"
        style={{ marginTop: 2, fontSize: 10.5, color: "var(--ink-3)" }}
      >
        <span className="num">{pts[0].quarter}</span>
        <span className="num">{pts[pts.length - 1].quarter}</span>
      </div>
    </div>
  );
}
