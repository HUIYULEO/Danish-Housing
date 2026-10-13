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
import { trendClass, type Category, type PanelRow } from "@/lib/metrics";
import { useLocale } from "./LocaleProvider";

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
  const { t, fmt, href } = useLocale();
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
          aria-label={t.card.close}
          style={{ color: "var(--ink-3)", fontSize: 18, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {insufficient ? (
        <div className="card__s">
          {monthlyMode
            ? t.card.nothingThisMonth(t.categories[category].noun)
            : t.card.tooFew(
                t.categories[category].noun,
                quarter,
                row.n_sold_4q != null ? fmt.int(row.n_sold_4q) : null,
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
                  k={t.card.forSale}
                  v={row.for_sale != null ? fmt.int(row.for_sale) : "—"}
                />
                <Stat
                  k={t.card.asking}
                  v={
                    row.asking_price_m2 != null
                      ? fmt.krM2(row.asking_price_m2)
                      : "—"
                  }
                />
                <Stat
                  k={t.card.listed}
                  v={row.days_listed != null ? fmt.days(row.days_listed) : "—"}
                />
                <Stat
                  k={t.card.stockYoy}
                  v={row.for_sale_yoy != null ? fmt.pct(row.for_sale_yoy) : "—"}
                  cls={trendClass(row.for_sale_yoy, true)}
                />
              </>
            ) : (
              <>
            {/* The nominal/real switch has to govern this card too, or the
                map and the card show two prices */}
            <Stat
              k={real ? t.card.priceReal : t.card.price}
              v={price != null ? fmt.krM2(price) : "—"}
            />
            <Stat
              k={real ? t.card.yoyReal : t.card.yoy}
              v={yoy != null ? fmt.pct(yoy) : "—"}
              cls={trendClass(yoy)}
            />
            <Stat
              k={t.card.dom}
              v={row.dom_4q != null ? fmt.days(row.dom_4q) : "—"}
            />
            <Stat
              k={t.card.supply}
              v={
                row.quarters_of_supply != null
                  ? fmt.q(row.quarters_of_supply)
                  : "—"
              }
            />
            <Stat
              k={t.card.sales}
              v={row.n_sold_4q != null ? fmt.int(row.n_sold_4q) : "—"}
            />
            <Stat
              k={t.card.gap}
              v={row.discount_pct != null ? fmt.pct(row.discount_pct) : "—"}
            />
            {/* Income is annual and two years behind prices, so the year goes
                right on the label rather than in a tooltip. The postal level
                has no such column and the whole row is absent. */}
            {row.years_income != null && (
              <Stat
                k={`${t.card.yearsIncome}${
                  row.income_year != null ? ` · ${row.income_year}` : ""
                }`}
                v={fmt.years(row.years_income)}
              />
            )}
              </>
            )}
          </div>

          {postnrs.length > 0 && (
            <div className="tip__r" style={{ alignItems: "flex-start" }}>
              <span>{t.card.postnrs}</span>
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
              {t.card.lowSample(fmt.sales(row.n_sold_4q ?? 0))}
            </div>
          )}

          <Spark series={series} dbReady={dbReady} real={real} />
        </>
      )}

      <Link
        className="card__more"
        href={href(
          level === "postnr"
            ? `/area/postnr/${row.area_code}`
            : `/area/${row.area_code}`,
        )}
      >
        {t.card.more(name)}
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
  const { t, fmt } = useLocale();
  if (!dbReady) {
    return (
      <div style={{ marginTop: 10 }}>
        <span className="loading">
          <span className="loading__dot" />
          {t.card.loading}
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
        aria-label={t.card.sparkAria(
          fmt.quarter(pts[0].quarter),
          fmt.quarter(pts[pts.length - 1].quarter),
        )}
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
        <span className="num">{fmt.quarter(pts[0].quarter)}</span>
        <span className="num">{fmt.quarter(pts[pts.length - 1].quarter)}</span>
      </div>
    </div>
  );
}
