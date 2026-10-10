/**
 * Metric definitions, colours and formatting.
 *
 * This file is the single source for "what does a colour on the map mean".
 * Three rules are hard-coded here; do not work around them in components:
 *   1. Units with reliability = insufficient are never coloured; they get
 *      neutral grey + hatching.
 *   2. Domains are globally fixed (computed by the ETL into snapshot.json),
 *      not recomputed per quarter. Otherwise the timeline would show only
 *      ranking changes, not the difference between the 2009 crash and the
 *      2021 frenzy.
 *   3. Every growth rate reads the rolling 4-quarter columns
 *      (price_4q / yoy_pct), never a single quarter.
 */

export type Category = "house" | "flat" | "holiday";
export type Reliability = "ok" | "low" | "unverified" | "insufficient";
export type MetricId =
  | "price"
  | "growth"
  | "dom"
  | "volume"
  | "supply"
  | "gap"
  | "afford"
  // Monthly (UDB010/020/030), listing side only
  | "stock"
  | "asking"
  | "listed";

export interface PanelRow {
  area_code: string;
  category: Category;
  price_4q: number | null;
  yoy_pct: number | null;
  accel_pp: number | null;
  dom_4q: number | null;
  dom_yoy_days: number | null;
  n_sold: number | null;
  n_sold_4q: number | null;
  n_for_sale: number | null;
  quarters_of_supply: number | null;
  discount_pct: number | null;
  reliability: Reliability;
  /** Affordability: years of a family's disposable income to buy 100 m². See afford in METRICS. */
  years_income?: number | null;
  years_income_chg?: number | null;
  income_family?: number | null;
  /** Which year's income was used. Income is published two years behind
   *  prices, and the UI has to say so */
  income_year?: number | null;
  /** CPI-deflated to latest-quarter kroner. The nominal/real switch reads these two columns. */
  price_4q_real?: number | null;
  yoy_real_pct?: number | null;
  /** Monthly columns (UDB010/020/030), only populated in monthly mode */
  for_sale?: number | null;
  asking_price_m2?: number | null;
  days_listed?: number | null;
  for_sale_yoy?: number | null;
  asking_price_m2_yoy?: number | null;
  days_listed_yoy?: number | null;
}

export type Frequency = "quarter" | "month";

export type DomainKey =
  | "for_sale"
  | "asking_price_m2"
  | "days_listed"
  | "for_sale_yoy"
  | "asking_price_m2_yoy"
  | "days_listed_yoy"
  | "price_4q"
  | "price_4q_real"
  | "yoy_pct"
  | "yoy_real_pct"
  | "accel_pp"
  | "dom_4q"
  | "dom_yoy_days"
  | "n_sold_4q"
  | "quarters_of_supply"
  | "discount_pct"
  | "years_income"
  | "years_income_chg";

export type Domains = Record<string, Partial<Record<DomainKey, [number, number]>>>;

export interface Metric {
  id: MetricId;
  label: string;
  short: string;
  column: DomainKey;
  kind: "sequential" | "diverging";
  /**
   * How the colour ramp runs across the domain.
   *
   * Price and volume are strongly right-skewed ratio quantities: the most
   * expensive kommune is 8 times the cheapest, and laid out linearly 70 of
   * the 98 crowd into the two darkest classes so the map reads as one block.
   * On a log scale "twice the price" is the same distance anywhere on the
   * ramp, which is how a ratio quantity should read. Quarters of supply is
   * less skewed, so sqrt is enough.
   */
  scale?: "linear" | "log" | "sqrt";
  /** true = the larger the value, the "hotter" the colour. Days on market and
   *  quarters of supply run the other way: fewer days means a hotter market. */
  invert?: boolean;
  unit: string;
  blurb: string;
  format: (v: number) => string;
  /** Tick text for the two ends and the midpoint of the legend */
  tick: (v: number) => string;
}

const nf = (d: number) =>
  new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

export const fmtKr = (v: number) => `${nf(0).format(Math.round(v))} kr`;
export const fmtKrM2 = (v: number) => `${nf(0).format(Math.round(v))} kr/m²`;
export const fmtPct = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${nf(1).format(Math.abs(v))}%`;
export const fmtPp = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${nf(1).format(Math.abs(v))} pp`;
export const fmtDays = (v: number) => `${nf(0).format(Math.round(v))} days`;
export const fmtDaysDelta = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${nf(0).format(Math.abs(Math.round(v)))} d`;
export const fmtInt = (v: number) => nf(0).format(Math.round(v));
export const fmtQ = (v: number) => `${nf(1).format(v)}Q`;
export const fmtYears = (v: number) => `${nf(1).format(v)} years`;
export const fmtYearsDelta = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${nf(1).format(Math.abs(v))} yr`;

export const METRICS: Metric[] = [
  {
    id: "price",
    label: "Price level",
    short: "Price",
    column: "price_4q",
    kind: "sequential",
    scale: "log",
    unit: "kr/m²",
    blurb:
      "Realised transaction price per square metre, averaged over the trailing four quarters.",
    format: fmtKrM2,
    tick: (v) => `${Math.round(v / 1000)}k`,
  },
  {
    id: "growth",
    label: "Price growth (YoY)",
    short: "Growth",
    column: "yoy_pct",
    kind: "diverging",
    unit: "%",
    blurb:
      "Change in the trailing-four-quarter average price against the same period a year earlier.",
    format: fmtPct,
    tick: (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v))}%`,
  },
  {
    id: "dom",
    label: "Days on market",
    short: "Days",
    column: "dom_4q",
    kind: "sequential",
    invert: true,
    unit: "days",
    blurb:
      "Median time from listing to sale. Prices lag the market; selling time leads it — this moves first when the market turns.",
    format: fmtDays,
    tick: (v) => `${Math.round(v)}d`,
  },
  {
    id: "volume",
    label: "Transactions",
    short: "Volume",
    column: "n_sold_4q",
    kind: "sequential",
    scale: "log",
    unit: "sales",
    blurb: "Dwellings sold over the trailing four quarters.",
    format: (v) => `${fmtInt(v)} sales`,
    tick: (v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : `${Math.round(v)}`),
  },
  {
    id: "supply",
    label: "Quarters of supply",
    short: "Supply",
    column: "quarters_of_supply",
    kind: "sequential",
    scale: "sqrt",
    unit: "quarters",
    blurb:
      "Homes for sale at quarter end divided by homes sold that quarter — how long the standing stock would take to clear.",
    format: fmtQ,
    tick: (v) => `${nf(1).format(v)}Q`,
  },
  {
    id: "afford",
    label: "Years of income",
    short: "Years of income",
    column: "years_income",
    kind: "sequential",
    scale: "log",
    unit: "years",
    blurb:
      "Years of a family's disposable income to buy 100 m² at local prices. " +
      "Both halves are same-year kroner, so this needs no inflation adjustment — " +
      "it is the one measure here the nominal/real switch cannot change.",
    format: fmtYears,
    tick: (v) => `${nf(1).format(v)}y`,
  },
  {
    id: "gap",
    label: "Asking vs realised",
    short: "Gap",
    column: "discount_pct",
    kind: "diverging",
    invert: true,
    unit: "%",
    blurb:
      "How far the realised price landed from the initial asking price. Negative means sellers took less than they asked.",
    format: fmtPct,
    tick: (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v))}%`,
  },
];

/**
 * Monthly metrics. UDB010/020/030.
 *
 * Only three, all **listing-side**: homes for sale, asking price, days
 * listed. The free data has no monthly sale prices, so monthly mode has no
 * "Price" or "Growth". They are not missing; those two metrics simply do not
 * exist at monthly frequency. Leaving them off the menu is more honest than
 * listing them greyed out.
 *
 * The upside is that it is four months fresher than the quarterly data, and
 * listings move first while sales follow.
 */
export const MONTHLY_METRICS: Metric[] = [
  {
    id: "stock",
    label: "Homes for sale",
    short: "For sale",
    column: "for_sale",
    kind: "sequential",
    scale: "log",
    unit: "homes",
    blurb:
      "Homes standing on the market at the end of the month. Inventory builds before prices move.",
    format: (v) => `${fmtInt(v)} homes`,
    tick: (v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : `${Math.round(v)}`),
  },
  {
    id: "asking",
    label: "Asking price",
    short: "Asking",
    column: "asking_price_m2",
    kind: "sequential",
    scale: "log",
    unit: "kr/m²",
    blurb:
      "What sellers are asking for homes currently on the market. Higher than realised prices, because expensive homes linger and cheap ones clear.",
    format: fmtKrM2,
    tick: (v) => `${Math.round(v / 1000)}k`,
  },
  {
    id: "listed",
    label: "Days listed so far",
    short: "Days listed",
    column: "days_listed",
    kind: "sequential",
    invert: true,
    unit: "days",
    blurb:
      "How long the homes still for sale have been waiting. Not time-to-sale — these are the ones that have not sold.",
    format: fmtDays,
    tick: (v) => `${Math.round(v)}d`,
  },
];

export const METRIC_BY_ID = Object.fromEntries(
  [...METRICS, ...MONTHLY_METRICS].map((m) => [m.id, m]),
) as Record<MetricId, Metric>;

export const metricsFor = (freq: Frequency, level?: string) => {
  if (freq === "month") return MONTHLY_METRICS;
  if (level === "postnr") return METRICS.filter((m) => !NO_POSTNR.includes(m.id));
  return METRICS;
};

/**
 * Nominal / real.
 *
 * The timeline runs all the way back to 1992, when the national price was
 * 4,121 kr/m²; today it is 13,672. Nominally that is a 232% rise, but more
 * than half of it is just money losing value: the CPI more than doubled over
 * the same period.
 * Real prices are deflated to latest-quarter kroner with DST's PRIS113, so
 * they read as "what that is in today's money".
 *
 * Only price and price growth have a nominal/real distinction. Days, counts
 * and quarters of supply are not money to begin with.
 */
export function resolveMetric(metric: Metric, real: boolean): Metric {
  if (!real) return metric;
  if (metric.id === "price") {
    return {
      ...metric,
      column: "price_4q_real",
      label: "Price level, real",
      blurb:
        "Realised price per square metre, averaged over four quarters and " +
        "deflated to today's kroner using the consumer price index.",
    };
  }
  if (metric.id === "growth") {
    return {
      ...metric,
      column: "yoy_real_pct",
      label: "Price growth, real (YoY)",
      blurb:
        "Change in the four-quarter average price against a year earlier, " +
        "after stripping out consumer price inflation.",
    };
  }
  return metric;
}

/** Whether this metric has a real variant. If not, the switch has no effect on it. */
export const hasRealVariant = (id: MetricId) => id === "price" || id === "growth";

/** Administrative levels. The numbers for all three come from
 *  BM010/020/030's own rows, not from our aggregation. */
export const GEO_LEVELS: {
  id: "landsdel" | "region" | "kommune" | "postnr";
  label: string;
  note: string;
}[] = [
  {
    id: "landsdel",
    label: "Landsdele",
    note: "11 areas — the level where Zealand, Funen and Jutland separate",
  },
  { id: "region", label: "Regioner", note: "5 administrative regions" },
  { id: "kommune", label: "Kommuner", note: "98 municipalities" },
  {
    id: "postnr",
    label: "Postnumre",
    note: "605 postal districts — the finest level Finans Danmark publishes",
  },
];

/**
 * Metrics the postal level does not have.
 *
 * Income statistics (INDKF132) only go down to kommune. Spreading a
 * kommune's income over its postal codes would give a good-looking map, but
 * a made-up one: a villa district and a block of flats in the same kommune
 * would show the same affordability. This project publishes no modelled
 * numbers at all, so the postal level simply does not list this metric
 * rather than listing it greyed out.
 */
const NO_POSTNR: MetricId[] = ["afford"];

export const CATEGORIES: { id: Category; label: string; note: string }[] = [
  { id: "house", label: "Houses", note: "Detached and terraced" },
  { id: "flat", label: "Flats", note: "Owner-occupied flats — an urban market" },
  { id: "holiday", label: "Holiday homes", note: "Concentrated on the coasts" },
];

/* ------------------------------------------------------------------ *
 * Colours
 * ------------------------------------------------------------------ */

export type Theme = "light" | "dark";

/**
 * Two palettes, one for light and one for dark. Dark is not light reversed:
 * on a light ground "darker = higher", on a dark ground "brighter = higher";
 * the semantic direction is opposite on the two sides.
 *
 * Hues stay within warm Nordic tones: terracotta, ochre, old wood. The other
 * end of the diverging ramp is a moss green leaning teal, avoiding the
 * warning-light look of pure blue and pure red.
 */
interface Palette {
  /** Insufficient data. Neutral + hatch texture, never part of any ramp. */
  gray: string;
  grayLine: string;
  /** Sea. The map background must not be blank */
  water: string;
  coast: string;
  /** Dividing lines between areas */
  border: string;
  hover: string;
  select: string;
  /** Sequential ramp */
  seq: string[];
  /** Diverging ramp: teal (falling) -> near-paper neutral (flat) -> terracotta (rising) */
  div: string[];
}

const PALETTES: Record<Theme, Palette> = {
  light: {
    gray: "#cdc5b6",
    grayLine: "#a89e8c",
    water: "#dde3e2",
    coast: "#c3ccca",
    border: "#f4efe6",
    hover: "#2a2621",
    select: "#a35a38",
    // Linen -> ochre -> dark brown. On a light ground, darker is higher.
    seq: ["#f2e8d6", "#e5cfa9", "#d3ad78", "#b9854f", "#95602f", "#653c18"],
    div: [
      "#1f5c58",
      "#3d8480",
      "#8fb5b0",
      "#ece4d6",
      "#dda683",
      "#bf6a45",
      "#8c3a20",
    ],
  },
  dark: {
    gray: "#423b31",
    grayLine: "#5d5445",
    water: "#14171a",
    coast: "#2a3033",
    border: "#1a1714",
    hover: "#f0e9dd",
    select: "#d98a5f",
    // Reversed on a dark ground: brighter is higher
    seq: ["#2b241c", "#4a3826", "#6d4f2e", "#956b38", "#c29352", "#e8c384"],
    div: [
      "#4fa39d",
      "#3a807b",
      "#2c5450",
      "#332c24",
      "#7a4a30",
      "#b26a42",
      "#e59460",
    ],
  },
};

export const palette = (theme: Theme) => PALETTES[theme];

/** For legacy callers: the light theme's grey by default */
export const GRAY_DATA = PALETTES.light.gray;

function hex2rgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgb2hex(r: number, g: number, b: number) {
  const c = (x: number) =>
    Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear interpolation across the stops for t∈[0,1]. Good enough; not worth pulling in d3 for. */
function ramp(stops: string[], t: number) {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = hex2rgb(stops[i]);
  const b = hex2rgb(stops[i + 1]);
  return rgb2hex(
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  );
}

/** Forward transform: map a raw value to [0,1]. The log lower bound is
 *  clamped to stay positive, to avoid 0 and negatives. */
function toUnit(metric: Metric, v: number, lo: number, hi: number): number {
  const s = metric.scale ?? "linear";
  if (s === "log") {
    const a = Math.log(Math.max(lo, 1e-6));
    const b = Math.log(Math.max(hi, 1e-6));
    return (Math.log(Math.max(v, 1e-6)) - a) / (b - a || 1);
  }
  if (s === "sqrt") {
    const a = Math.sqrt(Math.max(lo, 0));
    const b = Math.sqrt(Math.max(hi, 0));
    return (Math.sqrt(Math.max(v, 0)) - a) / (b - a || 1);
  }
  return (v - lo) / (hi - lo || 1);
}

/** Inverse transform: the raw value at position t on the legend, used to label the inner ticks. */
export function unitToValue(
  metric: Metric,
  t: number,
  lo: number,
  hi: number,
): number {
  const s = metric.scale ?? "linear";
  if (s === "log") {
    const a = Math.log(Math.max(lo, 1e-6));
    const b = Math.log(Math.max(hi, 1e-6));
    return Math.exp(a + (b - a) * t);
  }
  if (s === "sqrt") {
    const a = Math.sqrt(Math.max(lo, 0));
    const b = Math.sqrt(Math.max(hi, 0));
    return (a + (b - a) * t) ** 2;
  }
  return lo + (hi - lo) * t;
}

/* ------------------------------------------------------------------ *
 * Classes
 *
 * The map uses **discrete colour classes**, not a continuous gradient. A
 * gradient looks good, but a reader cannot turn a patch of colour back into
 * a number, only "a bit darker than its neighbour". With classes every
 * colour maps to a range printed on the legend and can be read off directly.
 * The New York Fed's house price map works this way (PRD §12 lists it as a
 * reference).
 * ------------------------------------------------------------------ */

/**
 * The "nice numbers" family: 1 / 2 / 2.5 / 5 / 10.
 *
 * Rounds **down**, not up. Rounding up would give a ±26% domain a 10% step
 * and breaks out to ±40%, while the actual data sits within ±20%; 98
 * kommuner would crowd into the two middle classes and the classing would
 * achieve nothing. Rounding down gives 5% and breaks to ±20%, and the two
 * outer classes are open-ended, which catches the tails.
 */
function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = norm >= 10 ? 10 : norm >= 5 ? 5 : norm >= 2.5 ? 2.5 : norm >= 2 ? 2 : 1;
  return step * mag;
}

export interface Bins {
  /** Break values, ascending */
  breaks: number[];
  /** breaks.length + 1 colours; the i-th covers breaks[i-1] to breaks[i] */
  colors: string[];
}

/**
 * Compute the classes for a metric.
 *
 * Diverging metrics (growth, negotiation margin) are classed symmetrically
 * around 0, and **0 must be exactly on a break**. Otherwise "up a little" and
 * "down a little" would share a colour, which is unacceptable on a house
 * price map. Sequential metrics are classed at equal steps along their own
 * transform (log / sqrt), with the breaks then rounded to nice numbers.
 */
export function binsFor(
  metric: Metric,
  domain: [number, number] | undefined,
  theme: Theme = "light",
): Bins | null {
  if (!domain) return null;
  const [lo, hi] = domain;
  if (!(hi > lo)) return null;
  const pal = PALETTES[theme];

  if (metric.kind === "diverging") {
    // Four classes per side, 0 in the middle. ±26% gives ±5 / ±10 / ±15 / ±20.
    const per = 4;
    const step = niceStep(Math.max(Math.abs(lo), Math.abs(hi)) / per);
    const breaks = Array.from({ length: per * 2 + 1 }, (_, i) => (i - per) * step);
    const colors = Array.from({ length: breaks.length + 1 }, (_, i) =>
      ramp(pal.div, i / breaks.length),
    );
    return { breaks, colors: metric.invert ? colors.slice().reverse() : colors };
  }

  const n = 6;
  const raw = Array.from({ length: n - 1 }, (_, i) =>
    unitToValue(metric, (i + 1) / n, lo, hi),
  );
  const breaks: number[] = [];
  for (const v of raw) {
    const st = niceStep(Math.abs(v) / 2 || 1);
    const r = Math.round(v / st) * st;
    if (!breaks.length || r > breaks[breaks.length - 1]) breaks.push(r);
  }
  if (!breaks.length) return null;
  const colors = Array.from({ length: breaks.length + 1 }, (_, i) =>
    ramp(pal.seq, i / breaks.length),
  );
  return { breaks, colors: metric.invert ? colors.slice().reverse() : colors };
}

/** Which class a value falls into */
export function binIndex(breaks: number[], v: number): number {
  let i = 0;
  while (i < breaks.length && v >= breaks[i]) i++;
  return i;
}

/**
 * The final colour of a unit.
 * Values beyond either end go into the outermost class. Frederiksberg's
 * 88,000 kr/m² is a genuine outlier, and letting it stretch the whole ramp
 * would wreck the readability of the other 97 kommuner.
 */
export function colorFor(
  metric: Metric,
  value: number | null | undefined,
  domain: [number, number] | undefined,
  theme: Theme = "light",
): string {
  const pal = PALETTES[theme];
  if (value == null || !Number.isFinite(value)) return pal.gray;
  const bins = binsFor(metric, domain, theme);
  if (!bins) return pal.gray;
  return bins.colors[binIndex(bins.breaks, value)] ?? pal.gray;
}

/** Up/down colouring for the board numbers, consistent with the map's diverging ramp. */
export function trendClass(v: number | null | undefined, invert = false) {
  if (v == null || !Number.isFinite(v)) return "";
  const positive = invert ? v < 0 : v > 0;
  return positive ? "row__v--pos" : "row__v--neg";
}

/* ------------------------------------------------------------------ *
 * Sample size
 * ------------------------------------------------------------------ */

/**
 * Four tiers. The ETL has already computed them into the reliability column;
 * this part only puts them into words.
 *
 * unverified is the extra tier beyond the PRD's three: volume data only
 * starts in 2004 while prices go back to 1992. Marking those twelve years
 * insufficient would claim "we know too few homes sold there", when we
 * simply lack the number. The difference matters.
 */
export const RELIABILITY_NOTE: Record<Reliability, string | null> = {
  ok: null,
  low: "Low sample",
  unverified: "Sample size not published before 2004",
  insufficient: "Insufficient data",
};

/** Whether a unit can be coloured. Only insufficient is grey. */
export const canColor = (r: Reliability) => r !== "insufficient";

/** Whether a unit can appear on a board. PRD §5: low-sample units are
 *  excluded outright, not shown with a caveat. Units whose sample size cannot
 *  be checked are excluded the same way: what cannot be ranked is not ranked. */
export const canRank = (r: Reliability) => r === "ok";

/* ------------------------------------------------------------------ *
 * Quarter helpers
 * ------------------------------------------------------------------ */

export const quarterLabel = (q: string) => q.replace("Q", " Q");

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026M07" -> "Jul 2026" */
export function monthLabel(m: string): string {
  if (!m || !m.includes("M")) return m;
  const [y, mm] = m.split("M");
  return `${MONTH_NAMES[Number(mm) - 1] ?? mm} ${y}`;
}

/** "2026Q1" -> 8104, for comparisons and subtraction */
export function quarterIndex(q: string): number {
  const y = Number(q.slice(0, 4));
  const n = Number(q.slice(5));
  return y * 4 + (n - 1);
}

export function shiftQuarter(q: string, by: number): string {
  const i = quarterIndex(q) + by;
  return `${Math.floor(i / 4)}Q${(i % 4) + 1}`;
}

/** Time-window buttons. PRD §6.1: there is no monthly price data, so the shortest window is 1 quarter. */
export const WINDOWS = [
  { id: "1Q", quarters: 1, label: "1Q" },
  { id: "4Q", quarters: 4, label: "4Q" },
  { id: "3Y", quarters: 12, label: "3Y" },
  { id: "5Y", quarters: 20, label: "5Y" },
  { id: "10Y", quarters: 40, label: "10Y" },
] as const;

export type WindowId = (typeof WINDOWS)[number]["id"];
