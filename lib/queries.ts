/**
 * Parameterised query templates.
 *
 * PRD §10 says the NLQ stage does not open up free-form SQL; an LLM only
 * fills in parameters for a fixed set of templates. This file is that set.
 * The UI today and the LLM later use the same functions, so "the AI only sees
 * numbers returned by queries" is guaranteed by the architecture, not by a
 * prompt.
 *
 * Every function filters on the reliability column only and never recomputes
 * the thresholds itself.
 */

import { query, lit } from "./db";
import type { Category, PanelRow } from "./metrics";

/** Administrative levels.
 *
 * The first three levels read from the same kommune panel: the OMR20
 * dimension of BM010/020/030 already contains rows for region (081-085) and
 * landsdel (01-11); we do not aggregate them ourselves.
 * postnr is the fourth level, with its own panel (BM011/BM021/BM031), again
 * officially published rows. lib/db.ts reshapes both panels to the same
 * columns, so the templates below need no fork per level. */
export type GeoLevel = "landsdel" | "region" | "kommune" | "postnr";

/** Which table holds the numbers for this level. */
const src = (level: GeoLevel) => (level === "postnr" ? "postnr" : "kommune");

/** Every panel column sent to the UI, shared by all levels. */
const COLS = `price_4q, price_4q_real, yoy_pct, yoy_real_pct,
              accel_pp, dom_4q, dom_yoy_days,
              n_sold, n_sold_4q, n_for_sale, quarters_of_supply,
              discount_pct, reliability,
              years_income, years_income_chg, income_family, income_year`;

export interface MoverRow extends PanelRow {
  name?: string;
}

/** The full slice for one quarter and one property type. The map colouring uses this. */
export function mapSlice(
  quarter: string,
  category: Category,
  level: GeoLevel = "kommune",
) {
  return query<PanelRow>(
    `SELECT area_code, category, ${COLS}
     FROM ${src(level)}
     WHERE area_level = ${lit(level)}
       AND quarter = ${lit(quarter)}
       AND category = ${lit(category)}`,
  );
}

/**
 * Monthly slice. UDB010/020/030, with only the three listing-side metrics.
 *
 * This answers "is quarterly the finest grain?": for sale prices yes, for
 * listings no. Monthly mode has no sample-size tiers: homes for sale is a
 * census count, not a sample, so there is no such thing as "too thin a
 * sample"; missing simply means missing.
 */
export function monthlySlice(
  month: string,
  category: Category,
  level: GeoLevel = "kommune",
) {
  return query<PanelRow>(
    `SELECT area_code, category,
            for_sale, asking_price_m2, days_listed,
            for_sale_yoy, asking_price_m2_yoy, days_listed_yoy,
            CASE WHEN asking_price_m2 IS NULL AND for_sale IS NULL
                 THEN 'insufficient' ELSE 'ok' END AS reliability
     FROM monthly
     WHERE area_level = ${lit(level)}
       AND month = ${lit(month)}
       AND category = ${lit(category)}`,
  );
}

/** The months available in the monthly panel */
export function monthlyMonths() {
  return query<{ month: string }>(
    `SELECT DISTINCT month FROM monthly ORDER BY month`,
  );
}

/** The complete time series of one area, for the trend charts on the detail page. */
export function areaSeries(
  areaCode: string,
  category: Category,
  level: GeoLevel = "kommune",
) {
  // area_code is unique within its own panel. Postal codes need the level
  // spelled out because they live in another table: "2100" cannot collide
  // with a kommune code, but the two tables do not merge by themselves.
  return query<PanelRow & { quarter: string }>(
    `SELECT quarter, area_code, category, ${COLS}
     FROM ${src(level)}
     WHERE area_code = ${lit(areaCode)}
       AND category = ${lit(category)}
     ORDER BY quarter`,
  );
}

/** National baseline (OMR20 '00'). The detail page and the home page's top strip both need it. */
export function nationalSeries(category: Category) {
  return query<PanelRow & { quarter: string }>(
    `SELECT quarter, area_code, category, ${COLS}
     FROM kommune
     WHERE area_code = '00' AND category = ${lit(category)}
     ORDER BY quarter`,
  );
}

/**
 * The adequately sampled postnumre under one kommune. Feeds the drill-down
 * table on the detail page.
 *
 * The numbers are the postnummer panel's **own** rows (BM011/BM021/BM031,
 * officially published); the crosswalk only answers "which postal codes fall
 * in this kommune". 22.6% of postal codes span several kommuner, so that is
 * membership for display, not a weight for summing. Adding up postal codes
 * to get a kommune's numbers would give a kommune enclosed by its
 * neighbours, like Frederiksberg, 6 sales a year.
 */
export function postnrIn(codes: string[], quarter: string, category: Category) {
  if (!codes.length) return Promise.resolve([]);
  const list = codes.map(lit).join(",");
  return query<PanelRow>(
    `SELECT area_code, category, ${COLS}
     FROM postnr
     WHERE area_code IN (${list})
       AND quarter = ${lit(quarter)}
       AND category = ${lit(category)}
       AND reliability <> 'insufficient'
     ORDER BY n_sold_4q DESC NULLS LAST`,
  );
}

export type BoardId =
  | "rising"
  | "falling"
  | "accelerating"
  | "cooling"
  | "heating"
  | "stalling"
  | "stretching"
  | "easing";

export interface BoardSpec {
  id: BoardId;
  title: string;
  hint: string;
  /** Which column the card shows on its right */
  valueColumn: "yoy_pct" | "accel_pp" | "dom_yoy_days" | "years_income_chg";
  /** Whether to invert the value colouring (falling days is good news) */
  invert?: boolean;
  /** The postal level has no income data, so these two boards do not appear there */
  kommuneOnly?: boolean;
}

export const BOARDS: BoardSpec[] = [
  {
    id: "rising",
    title: "Fastest rising",
    hint: "Biggest year-on-year price gain",
    valueColumn: "yoy_pct",
  },
  {
    id: "falling",
    title: "Fastest falling",
    hint: "Biggest year-on-year price fall",
    valueColumn: "yoy_pct",
  },
  {
    id: "accelerating",
    title: "Accelerating",
    hint: "Growth speeding up, and still positive",
    valueColumn: "accel_pp",
  },
  {
    id: "cooling",
    title: "Cooling",
    hint: "Growth slowing, but still positive",
    valueColumn: "accel_pp",
  },
  {
    id: "heating",
    title: "Heating up",
    hint: "Selling faster than a year ago",
    valueColumn: "dom_yoy_days",
    invert: true,
  },
  {
    id: "stalling",
    title: "Stalling",
    hint: "Taking longer to sell than a year ago",
    valueColumn: "dom_yoy_days",
    invert: true,
  },
  {
    id: "stretching",
    title: "Stretching",
    hint: "Prices pulling away from local incomes fastest",
    valueColumn: "years_income_chg",
    invert: true,
    kommuneOnly: true,
  },
  {
    id: "easing",
    title: "Coming back in reach",
    hint: "Local incomes gaining on prices fastest",
    valueColumn: "years_income_chg",
    invert: true,
    kommuneOnly: true,
  },
];

/** Which boards this level can show. */
export const boardsFor = (level: GeoLevel) =>
  level === "postnr" ? BOARDS.filter((b) => !b.kommuneOnly) : BOARDS;

/**
 * The boards. One line per definition in PRD §7:
 *
 *   Fastest Rising    largest g(latest)
 *   Fastest Falling   smallest g(latest)
 *   Accelerating      largest g(latest) - g(latest-4), with g(latest) > 0
 *   Cooling           smallest g(latest) - g(latest-4), with g(latest) > 0
 *   Heating up        biggest year-on-year fall in days on market
 *   Stalling          biggest year-on-year rise in days on market
 *
 * The g > 0 constraint on Cooling cannot be dropped, or it would list the
 * same areas as Fastest Falling.
 * Everything uses reliability = 'ok' only: a board is "what we think is
 * worth looking at" and should not mix in numbers we do not trust ourselves.
 */
export function board(
  id: BoardId,
  quarter: string,
  category: Category,
  limit = 5,
  real = false,
  level: GeoLevel = "kommune",
) {
  // Nominal/real has to follow the map. A map labelled "real kroner" next to
  // a board ranked on nominal growth is two tables contradicting each other.
  const yoy = real ? "yoy_real_pct" : "yoy_pct";
  const base = `FROM ${src(level)}
     WHERE area_level = ${lit(level)}
       AND quarter = ${lit(quarter)}
       AND category = ${lit(category)}
       AND reliability = 'ok'`;

  const spec: Record<BoardId, { where: string; order: string }> = {
    rising: { where: `${yoy} IS NOT NULL`, order: `${yoy} DESC` },
    falling: { where: `${yoy} IS NOT NULL`, order: `${yoy} ASC` },
    accelerating: {
      where: `accel_pp IS NOT NULL AND ${yoy} > 0`,
      order: "accel_pp DESC",
    },
    cooling: {
      where: `accel_pp IS NOT NULL AND ${yoy} > 0`,
      order: "accel_pp ASC",
    },
    heating: { where: "dom_yoy_days IS NOT NULL", order: "dom_yoy_days ASC" },
    stalling: { where: "dom_yoy_days IS NOT NULL", order: "dom_yoy_days DESC" },
    // Affordability change is ranked in "years". These two boards only exist
    // at levels with income data; at the postal level the query would come
    // back empty, so boardsFor() removes them first.
    stretching: {
      where: "years_income_chg IS NOT NULL",
      order: "years_income_chg DESC",
    },
    easing: {
      where: "years_income_chg IS NOT NULL",
      order: "years_income_chg ASC",
    },
  };

  const s = spec[id];
  return query<MoverRow>(
    `SELECT area_code, category, ${COLS}
     ${base} AND ${s.where}
     ORDER BY ${s.order}
     LIMIT ${Math.max(1, Math.min(50, Math.floor(limit)))}`,
  );
}

/** Coverage counts, so the Data & Methods page shows real numbers instead of hard-coded copy. */
export function coverage(quarter: string, category: Category) {
  return query<{ reliability: string; n: number }>(
    `SELECT reliability, COUNT(*)::INT AS n
     FROM kommune
     WHERE area_level = 'kommune'
       AND quarter = ${lit(quarter)}
       AND category = ${lit(category)}
     GROUP BY reliability`,
  );
}

/**
 * Price change over an arbitrary time window.
 *
 * The time switch in PRD §6.1 is 1Q/4Q/3Y/5Y/10Y, but only the 4Q
 * year-on-year is precomputed in the panel. Other windows are computed here:
 * take the current quarter's rolling 4-quarter mean price and compare it with
 * the same column N quarters earlier.
 *
 * Using price_4q rather than price_m2_realised is the rule from PRD §5:
 * growth rates always come from the rolling 4-quarter mean price, never
 * single-quarter point to point, or thin samples turn the curve into a
 * sawtooth.
 */
export function growthSlice(
  quarter: string,
  prevQuarter: string,
  category: Category,
  real = false,
  level: GeoLevel = "kommune",
) {
  // In real terms both the start and the end must use the deflated column,
  // otherwise the result is "nominal end over real start", which is not a
  // meaningful number of any kind
  const priceCol = real ? "price_4q_real" : "price_4q";
  return query<PanelRow>(
    `WITH s AS (
       SELECT area_code, quarter, ${COLS}
       FROM ${src(level)}
       WHERE area_level = ${lit(level)} AND category = ${lit(category)}
     ),
     cur AS (SELECT * FROM s WHERE quarter = ${lit(quarter)}),
     prv AS (
       SELECT area_code, ${priceCol} AS p0, reliability AS r0
       FROM s WHERE quarter = ${lit(prevQuarter)}
     )
     SELECT
       cur.area_code,
       ${lit(category)} AS category,
       cur.price_4q, cur.price_4q_real, cur.accel_pp, cur.dom_4q, cur.dom_yoy_days,
       cur.n_sold, cur.n_sold_4q, cur.n_for_sale,
       cur.quarters_of_supply, cur.discount_pct,
       cur.years_income, cur.years_income_chg,
       cur.income_family, cur.income_year,
       CASE WHEN prv.p0 > 0 AND prv.r0 <> 'insufficient'
            THEN (cur.${priceCol} / prv.p0 - 1) * 100 END
         AS ${real ? "yoy_real_pct" : "yoy_pct"},
       ${real ? "cur.yoy_pct" : "cur.yoy_real_pct"} AS
         ${real ? "yoy_pct" : "yoy_real_pct"},
       -- If the sample at the start point really is too thin, the change
       -- cannot be trusted either, so it is downgraded too.
       -- But "volumes were not published before 2004" is not too thin: that
       -- would turn every quarter before 2014 solid grey in the 10Y window,
       -- while the start price is officially published.
       CASE
         WHEN prv.p0 IS NULL THEN 'insufficient'
         WHEN prv.r0 = 'insufficient' THEN 'insufficient'
         WHEN prv.r0 = 'unverified' AND cur.reliability = 'ok'
              THEN 'unverified'
         ELSE cur.reliability
       END AS reliability
     FROM cur LEFT JOIN prv USING (area_code)`,
  );
}
