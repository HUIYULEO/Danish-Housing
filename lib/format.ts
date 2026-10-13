/**
 * Number, unit and date formatting, per language.
 *
 * Danish is not English with the words swapped: the decimal comma and the
 * thousands point trade places (88.282 kr./m², +11,1 %), the percent sign
 * takes a space, and quarters are written "2. kvt. 2026". Getting these
 * wrong is the first thing a Danish reader notices.
 */

import type { Locale } from "./i18n";

export interface Fmt {
  kr: (v: number) => string;
  krM2: (v: number) => string;
  pct: (v: number) => string;
  pp: (v: number) => string;
  days: (v: number) => string;
  daysDelta: (v: number) => string;
  int: (v: number) => string;
  sales: (v: number) => string;
  homes: (v: number) => string;
  q: (v: number) => string;
  years: (v: number) => string;
  yearsDelta: (v: number) => string;
  /** "2026Q1" -> "2026 Q1" / "1. kvt. 2026" */
  quarter: (q: string) => string;
  /** "2026M07" -> "Jul 2026" / "jul. 2026" */
  month: (m: string) => string;
  /** Legend ticks: short forms of the above */
  tickK: (v: number) => string;
  tickPct: (v: number) => string;
  tickDays: (v: number) => string;
  tickCount: (v: number) => string;
  tickQ: (v: number) => string;
  tickYears: (v: number) => string;
}

export type FmtKey = keyof Fmt;

const MONTHS: Record<Locale, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  da: ["jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec."],
};

const NBSP = " ";
const sign = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "");

function build(locale: Locale): Fmt {
  const da = locale === "da";
  const cache = new Map<number, Intl.NumberFormat>();
  const nf = (d: number) => {
    let f = cache.get(d);
    if (!f) {
      f = new Intl.NumberFormat(da ? "da-DK" : "en-GB", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });
      cache.set(d, f);
    }
    return f;
  };
  const int = (v: number) => nf(0).format(Math.round(v));
  const kr = da ? `${NBSP}kr.` : " kr";
  const pc = da ? `${NBSP}%` : "%";

  return {
    kr: (v) => `${int(v)}${kr}`,
    krM2: (v) => `${int(v)}${kr}/m²`,
    pct: (v) => `${sign(v)}${nf(1).format(Math.abs(v))}${pc}`,
    pp: (v) =>
      `${sign(v)}${nf(1).format(Math.abs(v))}${da ? `${NBSP}pct.point` : " pp"}`,
    days: (v) =>
      da
        ? `${int(v)}${NBSP}${Math.round(v) === 1 ? "dag" : "dage"}`
        : `${int(v)} days`,
    daysDelta: (v) => `${sign(v)}${int(Math.abs(v))} d`,
    int,
    sales: (v) => `${int(v)}${da ? `${NBSP}handler` : " sales"}`,
    homes: (v) => `${int(v)}${da ? `${NBSP}boliger` : " homes"}`,
    q: (v) => (da ? `${nf(1).format(v)}${NBSP}kvt.` : `${nf(1).format(v)}Q`),
    years: (v) => `${nf(1).format(v)}${da ? `${NBSP}år` : " years"}`,
    yearsDelta: (v) =>
      `${sign(v)}${nf(1).format(Math.abs(v))}${da ? `${NBSP}år` : " yr"}`,
    quarter: (q) => {
      if (!q.includes("Q")) return q;
      const [y, n] = q.split("Q");
      return da ? `${n}. kvt. ${y}` : `${y} Q${n}`;
    },
    month: (m) => {
      if (!m || !m.includes("M")) return m;
      const [y, mm] = m.split("M");
      return `${MONTHS[locale][Number(mm) - 1] ?? mm} ${y}`;
    },
    tickK: (v) => `${Math.round(v / 1000)}k`,
    tickPct: (v) => `${sign(v)}${Math.abs(Math.round(v))}${pc}`,
    tickDays: (v) => `${Math.round(v)}d`,
    tickCount: (v) =>
      v >= 1000 ? `${nf(1).format(Math.round(v / 100) / 10).replace(/[.,]0$/, "")}k` : `${Math.round(v)}`,
    tickQ: (v) => (da ? `${nf(1).format(v)}${NBSP}kvt.` : `${nf(1).format(v)}Q`),
    tickYears: (v) => (da ? `${nf(1).format(v)}${NBSP}år` : `${nf(1).format(v)}y`),
  };
}

const BUILT: Partial<Record<Locale, Fmt>> = {};

export function formatters(locale: Locale): Fmt {
  return (BUILT[locale] ??= build(locale));
}
