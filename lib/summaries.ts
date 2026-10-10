/**
 * Latest-quarter headline numbers per area, for server components only.
 *
 * The charts on an area page are drawn by DuckDB in the browser, which
 * crawlers and LLM fetchers do not run. These numbers are written into the
 * static HTML at build time so the page says something without JavaScript.
 * Do not import this from a client component: it would ship all 718 areas.
 */

import raw from "../public/data/summaries.json";
import {
  fmtDays,
  fmtInt,
  fmtKrM2,
  fmtPct,
  quarterLabel,
  type Category,
} from "./metrics";

export interface Summary {
  reliability: string;
  price?: number;
  yoy?: number;
  dom?: number;
  sales?: number;
}

const AREAS = raw.areas as Record<string, Partial<Record<Category, Summary>>>;

export const SUMMARY_QUARTER = quarterLabel(raw.quarter);

export const summaryOf = (code: string) => AREAS[code] ?? {};

/** A unit the map would colour: it has a price and is not insufficient. */
export const hasPrice = (s: Summary | undefined): s is Summary & { price: number } =>
  !!s && s.reliability !== "insufficient" && s.price != null;

const NOUN: Record<Category, string> = {
  house: "houses",
  flat: "flats",
  holiday: "holiday homes",
};

/** One plain sentence or two about a property type in an area, or null if
 *  there is no publishable price. */
export function describe(name: string, cat: Category, s: Summary | undefined) {
  if (!hasPrice(s)) return null;
  const parts = [
    `In ${SUMMARY_QUARTER}, ${NOUN[cat]} in ${name} sold for ${fmtKrM2(s.price)} ` +
      `on a trailing four-quarter average` +
      (s.yoy != null ? `, ${fmtPct(s.yoy)} on a year earlier.` : "."),
  ];
  if (s.dom != null) parts.push(`A sale took ${fmtDays(s.dom)} on average.`);
  if (s.sales != null) {
    parts.push(
      `${fmtInt(s.sales)} changed hands over the four quarters` +
        (s.reliability === "low" ? ", a low sample." : "."),
    );
  }
  return parts.join(" ");
}

/** For <meta name="description">: the house line, or whichever type has data. */
export function metaDescription(name: string, code: string) {
  const all = summaryOf(code);
  for (const cat of ["house", "flat", "holiday"] as const) {
    const s = all[cat];
    if (!hasPrice(s)) continue;
    return (
      `${NOUN[cat][0].toUpperCase()}${NOUN[cat].slice(1)} in ${name}: ` +
      `${fmtKrM2(s.price)} in ${SUMMARY_QUARTER}` +
      (s.yoy != null ? `, ${fmtPct(s.yoy)} year on year` : "") +
      (s.dom != null ? `, ${fmtDays(s.dom)} to sell` : "") +
      `. Prices, selling times, volume and supply since 1992, from Finans Danmark.`
    );
  }
  return `Too few homes sell in ${name} for a square-metre price to be published. Data from Finans Danmark.`;
}
