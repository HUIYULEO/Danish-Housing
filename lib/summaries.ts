/**
 * Latest-quarter headline numbers per area, for server components only.
 *
 * The charts on an area page are drawn by DuckDB in the browser, which
 * crawlers and LLM fetchers do not run. These numbers are written into the
 * static HTML at build time so the page says something without JavaScript.
 * Do not import this from a client component: it would ship every area.
 */

import raw from "../public/data/summaries.json";
import { formatters } from "./format";
import type { Locale } from "./i18n";
import { MESSAGES } from "./messages";
import type { Category } from "./metrics";

export interface Summary {
  reliability: string;
  price?: number;
  yoy?: number;
  dom?: number;
  sales?: number;
}

const AREAS = raw.areas as Record<string, Partial<Record<Category, Summary>>>;

/** The quarter the summaries are for, written out in the given language. */
export const summaryQuarter = (locale: Locale) =>
  formatters(locale).quarter(raw.quarter);

export const summaryOf = (code: string) => AREAS[code] ?? {};

/** A unit the map would colour: it has a price and is not insufficient. */
export const hasPrice = (s: Summary | undefined): s is Summary & { price: number } =>
  !!s && s.reliability !== "insufficient" && s.price != null;

/** One plain sentence or two about a property type in an area, or null if
 *  there is no publishable price. */
export function describe(
  locale: Locale,
  name: string,
  cat: Category,
  s: Summary | undefined,
) {
  if (!hasPrice(s)) return null;
  const t = MESSAGES[locale];
  const fmt = formatters(locale);
  const parts = [
    t.summary.price(
      summaryQuarter(locale),
      t.categories[cat].noun,
      name,
      fmt.krM2(s.price),
      s.yoy != null ? fmt.pct(s.yoy) : null,
    ),
  ];
  if (s.dom != null) parts.push(t.summary.dom(fmt.days(s.dom)));
  if (s.sales != null) {
    parts.push(t.summary.sales(fmt.int(s.sales), s.reliability === "low"));
  }
  return parts.join(" ");
}

/** For <meta name="description">: the house line, or whichever type has data. */
export function metaDescription(locale: Locale, name: string, code: string) {
  const t = MESSAGES[locale];
  const fmt = formatters(locale);
  const all = summaryOf(code);
  for (const cat of ["house", "flat", "holiday"] as const) {
    const s = all[cat];
    if (!hasPrice(s)) continue;
    return t.summary.meta(
      t.categories[cat].label,
      name,
      fmt.krM2(s.price),
      summaryQuarter(locale),
      s.yoy != null ? fmt.pct(s.yoy) : null,
      s.dom != null ? fmt.days(s.dom) : null,
    );
  }
  return t.summary.metaNone(name);
}
